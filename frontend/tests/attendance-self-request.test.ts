import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma/client", async () => {
  const { testPrisma } = await import("./helpers/test-db");
  return { db: testPrisma };
});
import { createBusinessUnit } from "@/features/configuration/business-config/company-profile/server/business-unit.service";
import { saveCompany } from "@/features/configuration/business-config/company-profile/server/company.service";
import { createOffice } from "@/features/configuration/business-config/company-profile/server/office.service";
import { createDevice, uploadPunches } from "@/features/configuration/gateways/attendance-device/server/attendance-device.service";
import { createPipeline } from "@/features/configuration/security/approval/server/approval.service";
import {
  getDailyAttendance,
  myAttendanceDay,
  myAttendanceRequests,
  requestOwnAttendanceChange,
  withdrawOwnAttendanceRequest,
} from "@/features/hrm/attendance/services/attendance.service";
import { decidePending, pendingApprovals } from "@/features/hrm/governance/server/governance.service";
import type { Actor } from "@/lib/auth/actor";
import { grantsFromList } from "@/lib/permissions/registry";
import { adminActor, businessUnitInput, companyInput, officeInput } from "./helpers/fixtures";
import { resetTestDb, startTestDb, stopTestDb, testPrisma } from "./helpers/test-db";

const as = (id: string, name: string): Actor => ({ ...adminActor, id, name, isMaster: false });
/** HR staff who may open Pending Approval and approve there; only the pipeline decides whose approval counts. */
const hrStaff = (id: string, name: string): Actor => ({
  ...as(id, name),
  grants: grantsFromList(["hrm.governance.pending-approval.view", "hrm.governance.pending-approval.approve"]),
});
/** A day N days ago in Dhaka, YYYY-MM-DD. */
const daysAgo = (n: number) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dhaka" }).format(new Date(Date.now() - n * 86_400_000));

let rahim: Actor;
let hr: Actor;
let other: Actor;
let rahimId: string;
let karimId: string;
const day = daysAgo(3);

beforeAll(async () => {
  await startTestDb();
});
afterAll(async () => {
  await stopTestDb();
});
beforeEach(async () => {
  await resetTestDb();
  await saveCompany(adminActor, companyInput);
  const unitId = (await createBusinessUnit(adminActor, businessUnitInput)).id;
  const officeId = (await createOffice(adminActor, unitId, officeInput)).id;
  const user = (name: string, phone: string) => testPrisma().user.create({ data: { name, phone, passwordHash: "x", erpAccess: true } });
  const [rahimUser, hrUser, otherUser] = await Promise.all([user("Rahim", "01700000001"), user("Sabbir HR", "01700000002"), user("Someone", "01700000003")]);
  rahim = as(rahimUser.id, "Rahim");
  hr = hrStaff(hrUser.id, "Sabbir HR");
  other = hrStaff(otherUser.id, "Someone");
  rahimId = (await testPrisma().employee.create({ data: { officeId, employeeCode: "E-1", attendanceId: "101", name: "Rahim", joiningDate: new Date("2024-01-01"), userId: rahimUser.id } })).id;
  karimId = (await testPrisma().employee.create({ data: { officeId, employeeCode: "E-2", attendanceId: "202", name: "Karim", joiningDate: new Date("2024-01-01") } })).id;

  // Approval Setup › HR & Payroll › Employee Attendance: HR approves.
  await createPipeline(adminActor, {
    name: "Employee Attendance Approval",
    feature: "Employee Attendance",
    userType: "USER",
    superApproverId: hrUser.id,
    remarks: "",
    stages: [{ name: "HR", approvalOrder: "ANY", requiredCount: 1, approvers: [{ userType: "USER", businessUnitId: "", approverId: hrUser.id, authorizationType: "APPROVAL" }] }],
  } as Parameters<typeof createPipeline>[1]);

  // Rahim punched in at 10:00: Late under the default rule (after 9:25).
  const { id } = await createDevice(adminActor, { name: "Gate", ipAddress: "192.168.0.119", port: 4370, officeId });
  await uploadPunches(adminActor, id, { punches: [{ userId: "101", time: `${day}T10:00:00+06:00` }] });
});

describe("Employee Self Service › attendance change requests", () => {
  it("lets an employee ask for their own change, which applies only once the pipeline approver approves", async () => {
    expect((await myAttendanceDay(rahim, day))?.actualAttendance).toBe("Late");

    const { id } = await requestOwnAttendanceChange(rahim, { date: day, requestedStatus: "Present", inTime: "09:05", reason: "The device did not take my 9:05 punch." });
    // Still Late while pending; HR sees it with the status the server read, not one the employee sent.
    expect((await myAttendanceDay(rahim, day))?.actualAttendance).toBe("Late");
    const pending = await pendingApprovals(adminActor, "attendance");
    expect(pending.rows).toHaveLength(1);
    expect(pending.rows[0]).toMatchObject({ id, current: "Late", requested: "Present" });
    expect(await myAttendanceRequests(rahim)).toMatchObject([{ id, status: "Pending", originalStatus: "Late", requestedStatus: "Present", inTime: "09:05 AM" }]);

    // Other HR staff who are not on the pipeline cannot approve it.
    await expect(decidePending(other, "attendance", id, "Approved")).rejects.toThrow(/waiting for Sabbir HR/);
    expect((await myAttendanceRequests(rahim))[0].status).toBe("Pending");

    await decidePending(hr, "attendance", id, "Approved");
    const row = (await getDailyAttendance({ fromDate: day, toDate: day, viewBy: "Employee", employeeId: rahimId, officeId: "ALL", status: "ALL", pageSize: 50, page: 1 })).records[0];
    expect(row).toMatchObject({ actualAttendance: "Present", inTime: "09:05 AM", adjustmentStatus: "Approved", lastActionBy: "Sabbir HR" });
    expect((await myAttendanceRequests(rahim))[0].status).toBe("Approved");
    // A decided request cannot be withdrawn.
    await expect(withdrawOwnAttendanceRequest(rahim, id)).rejects.toThrow(/Only a pending request/);
  });

  it("only ever changes the signed-in employee, within today and the last 60 days, with a reason", async () => {
    await expect(requestOwnAttendanceChange(rahim, { date: daysAgo(-1), requestedStatus: "Present", reason: "x" })).rejects.toThrow(/today or an earlier day/);
    await expect(requestOwnAttendanceChange(rahim, { date: daysAgo(61), requestedStatus: "Present", reason: "x" })).rejects.toThrow(/last 60 days/);
    await expect(requestOwnAttendanceChange(rahim, { date: day, requestedStatus: "Present", reason: "  " })).rejects.toThrow(/reason/);
    await expect(requestOwnAttendanceChange(rahim, { date: day, requestedStatus: "Late", reason: "Same" })).rejects.toThrow(/already Late/);
    // An account without a linked employee record cannot ask at all.
    await expect(requestOwnAttendanceChange(other, { date: day, requestedStatus: "Present", reason: "x" })).rejects.toThrow(/No employee record is linked/);

    // A day with no record (Karim never punched) can still be requested by its own employee only.
    const { id } = await requestOwnAttendanceChange(rahim, { date: daysAgo(5), requestedStatus: "Present", reason: "On duty at the factory" });
    expect((await myAttendanceRequests(rahim)).find((r) => r.id === id)?.originalStatus).toBeNull();
    expect((await testPrisma().attendanceAdjustment.findMany()).map((a) => a.employeeId)).toEqual([rahimId]);
    expect(karimId).not.toBe(rahimId);
  });

  it("lets the employee withdraw a pending request, but not someone else's", async () => {
    const { id } = await requestOwnAttendanceChange(rahim, { date: day, requestedStatus: "Present", reason: "Missed punch" });
    await expect(withdrawOwnAttendanceRequest(other, id)).rejects.toThrow(/No employee record is linked/);
    await withdrawOwnAttendanceRequest(rahim, id);
    expect(await myAttendanceRequests(rahim)).toEqual([]);
    expect((await pendingApprovals(adminActor, "attendance")).rows).toHaveLength(0);
  });
});
