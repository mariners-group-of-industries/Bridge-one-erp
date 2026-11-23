import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma/client", async () => {
  const { testPrisma } = await import("./helpers/test-db");
  return { db: testPrisma };
});
import { createBusinessUnit } from "@/features/configuration/business-config/company-profile/server/business-unit.service";
import { saveCompany } from "@/features/configuration/business-config/company-profile/server/company.service";
import { createOffice } from "@/features/configuration/business-config/company-profile/server/office.service";
import {
  applyLeave,
  applyMovement,
  decideLeave,
  decideMovement,
  deleteLeave,
  getLeave,
  leaveBalance,
  listLeaves,
  listMovements,
  readLeaveAttachment,
} from "@/features/hrm/self-service/leave-movement/server/leave-movement.service";
import { createPipeline } from "@/features/configuration/security/approval/server/approval.service";
import type { Actor } from "@/lib/auth/actor";
import { FULL_ACCESS } from "@/lib/permissions/registry";
import { setStorage } from "@/lib/storage";
import { MemoryStorage, adminActor, businessUnitInput, companyInput, officeInput } from "./helpers/fixtures";
import { resetTestDb, startTestDb, stopTestDb, testPrisma } from "./helpers/test-db";

let rahim: Actor;
let salma: Actor;
let rahimId: string;
let salmaId: string;
const PDF = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31]);
const leave = (extra: Record<string, unknown> = {}) => ({ leaveType: "Casual Leave", fromDate: "2026-03-01", toDate: "2026-03-03", reason: "Family event", ...extra });

beforeAll(async () => {
  await startTestDb();
});
afterAll(async () => {
  await stopTestDb();
  setStorage(undefined);
});
beforeEach(async () => {
  await resetTestDb();
  setStorage(new MemoryStorage());
  await saveCompany(adminActor, companyInput);
  const unitId = (await createBusinessUnit(adminActor, businessUnitInput)).id;
  const officeId = (await createOffice(adminActor, unitId, officeInput)).id;
  const user = (name: string, phone: string) => testPrisma().user.create({ data: { name, phone, passwordHash: "x" } });
  const [u1, u2] = [await user("Rahim", "01700000081"), await user("Salma", "01700000082")];
  const base = { officeId, joiningDate: new Date("2024-01-01") };
  rahimId = (await testPrisma().employee.create({ data: { ...base, employeeCode: "E-1", name: "Rahim Uddin", userId: u1.id } })).id;
  salmaId = (await testPrisma().employee.create({ data: { ...base, employeeCode: "E-2", name: "Salma Begum", userId: u2.id } })).id;
  rahim = { ...adminActor, id: u1.id, name: "Rahim", isMaster: false };
  salma = { ...adminActor, id: u2.id, name: "Salma", isMaster: false };
});

describe("Leave", () => {
  it("holds pending days in the balance, counts them as taken once approved, and refuses overlaps and over-quota", async () => {
    const { id } = await applyLeave(rahim, leave(), [{ name: "note.pdf", type: "application/pdf", size: PDF.byteLength, bytes: PDF }]);
    const casual = async () => (await leaveBalance(rahim, undefined, 2026)).find((b) => b.leaveType === "Casual Leave");
    expect(await casual()).toMatchObject({ leaveType: "Casual Leave", quota: 10, taken: 0, pending: 3, remaining: 7 });

    await expect(applyLeave(rahim, leave({ leaveType: "Sick Leave", fromDate: "2026-03-03", toDate: "2026-03-04" }))).rejects.toThrow(/overlap/);
    await expect(applyLeave(rahim, leave({ fromDate: "2026-04-01", toDate: "2026-04-08" }))).rejects.toThrow(/Only 7 day/);
    await expect(applyLeave(rahim, leave({ fromDate: "2026-12-30", toDate: "2027-01-02" }))).rejects.toThrow(/next year/);

    await expect(decideLeave(rahim, id, "Approved")).rejects.toThrow(/Only HR/);
    await decideLeave(adminActor, id, "Approved");
    expect(await casual()).toMatchObject({ leaveType: "Casual Leave", quota: 10, taken: 3, pending: 0, remaining: 7 });
    await expect(decideLeave(adminActor, id, "Rejected")).rejects.toThrow(/already been decided/);
    await expect(deleteLeave(rahim, id)).rejects.toThrow(/Only pending/);

    const [row] = await listLeaves(rahim);
    expect(row).toMatchObject({ employeeCode: "E-1", days: 3, status: "Approved", decidedByName: "Administrator", canDelete: false, canDecide: false });
    expect((await readLeaveAttachment(rahim, id, row.attachments[0].id)).originalName).toBe("note.pdf");
  });

  it("lets each login see and act only on their own applications; the master account sees everyone", async () => {
    const { id } = await applyLeave(rahim, leave());
    await applyLeave(salma, leave({ leaveType: "Sick Leave" }));
    await expect(applyLeave(rahim, leave({ employeeId: salmaId, fromDate: "2026-05-01", toDate: "2026-05-01" }))).rejects.toThrow(/only apply for yourself/);
    await expect(leaveBalance(rahim, salmaId)).rejects.toThrow(/only apply for yourself/);

    expect((await listLeaves(rahim)).map((r) => r.employeeCode)).toEqual(["E-1"]);
    expect((await listLeaves(salma)).map((r) => r.employeeCode)).toEqual(["E-2"]);
    expect((await listLeaves(adminActor)).map((r) => r.employeeCode).sort()).toEqual(["E-1", "E-2"]);
    await expect(deleteLeave(salma, id)).rejects.toThrow(/not found/i);

    // HR applies on someone's behalf, and the applicant can delete while pending.
    await applyLeave(adminActor, leave({ employeeId: salmaId, leaveType: "Earned Leave", fromDate: "2026-06-01", toDate: "2026-06-02" }));
    expect((await listLeaves(salma)).length).toBe(2);
    await deleteLeave(rahim, id);
    expect(await listLeaves(rahim)).toEqual([]);
    expect((await listLeaves(adminActor, rahimId)).length).toBe(0);
  });
});

describe("Movement", () => {
  it("validates times, is scoped per login, and is approved by HR without touching the leave balance", async () => {
    const movement = { movementType: "Client Visit" as const, fromDate: "2026-03-10", toDate: "2026-03-10", startTime: "10:00", endTime: "13:30", location: "Gulshan", reason: "Client meeting" };
    await expect(applyMovement(rahim, { ...movement, endTime: "09:00" })).rejects.toThrow(/End Time/);
    const { id } = await applyMovement(rahim, movement);

    expect(await listMovements(salma)).toEqual([]);
    const [row] = await listMovements(rahim);
    expect(row).toMatchObject({ movementType: "Client Visit", startTime: "10:00", endTime: "13:30", location: "Gulshan", status: "Pending", canDelete: true, canDecide: false });

    await expect(decideMovement(rahim, id, "Approved")).rejects.toThrow(/Only HR/);
    await decideMovement(adminActor, id, "Approved");
    expect((await listMovements(adminActor))[0].status).toBe("Approved");
    expect((await leaveBalance(rahim, undefined, 2026)).every((b) => b.taken === 0 && b.pending === 0)).toBe(true);
  });
});

describe("Leave approval notifications", () => {
  const inbox = (userId: string) => testPrisma().userNotification.findMany({ where: { userId }, orderBy: { createdAt: "asc" }, select: { title: true, body: true, link: true } });
  const hrUser = async () => {
    const id = (await testPrisma().user.create({ data: { name: "HR Officer", phone: "01700000083", passwordHash: "x", erpAccess: true } })).id;
    const group = await testPrisma().permissionGroup.create({
      data: { name: "HR", code: "HR", entries: { create: { activityKey: "/hrm/self-service/leave-movement", moduleName: "HR", activityName: "Leave & Movement", canView: true, canApprove: true } } },
    });
    await testPrisma().userPermissionGroup.create({ data: { userId: id, groupId: group.id } });
    return id;
  };

  it("tells everyone who may approve leave, with a link that opens the application", async () => {
    const hr = await hrUser();
    const { id } = await applyLeave(rahim, leave());
    const link = `/hrm/self-service/leave-movement?leave=${id}`;
    expect(await inbox(hr)).toEqual([{ title: "Leave application to approve: Casual Leave", body: "Rahim Uddin (E-1): Casual Leave, 3 day(s), 2026-03-01 to 2026-03-03.", link }]);
    // The applicant only hears that it was submitted; a colleague without the permission hears nothing.
    expect((await inbox(rahim.id)).map((n) => n.link)).toEqual(["/employee/leave/history"]);
    expect(await inbox(salma.id)).toEqual([]);
    expect(await getLeave(adminActor, id)).toMatchObject({ id, employeeName: "Rahim Uddin", status: "Pending", canDecide: true, stages: [] });
    await expect(getLeave(salma, id)).rejects.toThrow(/not found/i);
  });

  it("with an approval pipeline, tells only the stage that has to act, and the next stage once it approves", async () => {
    const hr = await hrUser();
    const director = (await testPrisma().user.create({ data: { name: "Director", phone: "01700000084", passwordHash: "x", erpAccess: true } })).id;
    const approver = (approverId: string) => ({ userType: "USER" as const, businessUnitId: "", approverId, authorizationType: "APPROVAL" as const });
    await createPipeline(adminActor, {
      name: "Leave approval",
      feature: "Employee Leave",
      userType: "USER",
      superApproverId: director,
      remarks: "",
      stages: [
        { name: "Line Manager", approvalOrder: "ANY", requiredCount: 1, approvers: [approver(salma.id)] },
        { name: "HR", approvalOrder: "ANY", requiredCount: 1, approvers: [approver(hr)] },
      ],
    } as Parameters<typeof createPipeline>[1]);

    const { id } = await applyLeave(rahim, leave());
    expect((await inbox(salma.id)).map((n) => n.title)).toEqual(["Leave application to approve: Casual Leave"]);
    // The super approver may act at any stage, so they hear of it too.
    expect((await inbox(director)).map((n) => n.title)).toEqual(["Leave application to approve: Casual Leave"]);
    expect(await inbox(hr)).toEqual([]);
    expect((await getLeave(adminActor, id)).stages.map((s) => [s.name, s.status, s.approverNames])).toEqual([
      ["Line Manager", "PENDING", ["Salma"]],
      ["HR", "PENDING", ["HR Officer"]],
    ]);

    // Salma decides as a line manager: Approve on Leave & Movement.
    await decideLeave({ ...salma, grants: FULL_ACCESS }, id, "Approved");
    expect((await inbox(hr)).map((n) => [n.title, n.link])).toEqual([["Leave application to approve: Casual Leave (stage 2)", `/hrm/self-service/leave-movement?leave=${id}`]]);
  });
});
