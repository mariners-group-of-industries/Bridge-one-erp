import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma/client", async () => {
  const { testPrisma } = await import("./helpers/test-db");
  return { db: testPrisma };
});
import { createBusinessUnit } from "@/features/configuration/business-config/company-profile/server/business-unit.service";
import { saveCompany } from "@/features/configuration/business-config/company-profile/server/company.service";
import { createOffice } from "@/features/configuration/business-config/company-profile/server/office.service";
import { myAttendance, myAttendanceDay, myCalendar } from "@/features/ess/server/ess-attendance.service";
import {
  applyOwnLeave,
  cancelOwnLeave,
  essMe,
  markNotificationsRead,
  myDashboard,
  myLeave,
  myLeaveDetail,
  myNotifications,
  myPayslip,
  myPayslips,
  myProfile,
  ownLeaveAttachment,
  previewLeave,
  requestCorrection,
} from "@/features/ess/server/ess.service";
import { publishPayslips } from "@/features/hrm/payroll/server/payroll-batch.service";
import { decideLeave } from "@/features/hrm/self-service/leave-movement/server/leave-movement.service";
import type { Actor } from "@/lib/auth/actor";
import { checkApiAccess } from "@/lib/permissions/api-rules";
import { grantsFromList, type AccessGrants } from "@/lib/permissions/registry";
import { setStorage } from "@/lib/storage";
import { MemoryStorage, adminActor, businessUnitInput, companyInput, officeInput } from "./helpers/fixtures";
import { resetTestDb, startTestDb, stopTestDb, testPrisma } from "./helpers/test-db";

/** An ordinary employee: signed in, no page permissions at all. */
const NO_GRANTS: AccessGrants = { all: false, keys: new Set() };
const person = (id: string, name: string, grants: AccessGrants = NO_GRANTS): Actor => ({ ...adminActor, id, name, isMaster: false, via: "session", grants });
const PDF = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31]);
const day = (iso: string) => new Date(`${iso}T00:00:00Z`);

let rahim: Actor; // employee A
let salma: Actor; // employee B
let stranger: Actor; // a login with no employee record
let hr: Actor; // HR who approves leave and payroll, linked to their own employee record
let rahimId: string;
let salmaId: string;
let hrEmployeeId: string;
let officeId: string;
let unitId: string;

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
  unitId = (await createBusinessUnit(adminActor, businessUnitInput)).id;
  officeId = (await createOffice(adminActor, unitId, officeInput)).id;
  const user = (name: string, phone: string) => testPrisma().user.create({ data: { name, phone, passwordHash: "x", erpAccess: true } });
  const [u1, u2, u3, u4] = [await user("Rahim", "01700000091"), await user("Salma", "01700000092"), await user("Nobody", "01700000093"), await user("Hasan HR", "01700000094")];
  const base = { officeId, joiningDate: day("2024-01-01") };
  rahimId = (await testPrisma().employee.create({ data: { ...base, employeeCode: "E-1", name: "Rahim Uddin", gender: "Male", userId: u1.id, nidNumber: "1234567890" } })).id;
  salmaId = (await testPrisma().employee.create({ data: { ...base, employeeCode: "E-2", name: "Salma Begum", gender: "Female", userId: u2.id } })).id;
  hrEmployeeId = (await testPrisma().employee.create({ data: { ...base, employeeCode: "E-9", name: "Hasan", userId: u4.id } })).id;
  rahim = person(u1.id, "Rahim");
  salma = person(u2.id, "Salma");
  stranger = person(u3.id, "Nobody");
  hr = person(u4.id, "Hasan HR", grantsFromList(["hrm.self-service.leave-movement.view", "hrm.self-service.leave-movement.approve", "hrm.payroll.view", "hrm.payroll.approve"]));
});

/** Leave policy (HR Governance › Leave) for every office. */
async function leavePolicy(data: Record<string, unknown>) {
  await testPrisma().hrPolicyRecord.create({ data: { tab: "leave", effectiveFrom: day("2020-01-01"), data: { gender: "All", ...data } } });
}

/** A payroll batch with one line per employee, in the given status. */
async function payroll(status: string, month: string, published: boolean) {
  const batch = await testPrisma().payrollBatch.create({
    data: {
      reference: `PAY-${month}-${status.slice(0, 3)}`,
      businessUnitId: unitId,
      officeId,
      salaryType: "Monthly",
      month,
      fromDate: day(`${month}-01`),
      toDate: day(`${month}-28`),
      payrollDate: day(`${month}-28`),
      status,
      sourceHash: "x",
      calculatedAt: new Date(),
      payslipsPublishedAt: published ? new Date() : null,
    },
  });
  for (const [sl, employeeId, name] of [[1, rahimId, "Rahim Uddin"], [2, salmaId, "Salma Begum"]] as const) {
    await testPrisma().payrollBatchLine.create({
      data: {
        batchId: batch.id,
        employeeId,
        sl,
        employeeCode: `E-${sl}`,
        employeeName: name,
        joiningDate: day("2024-01-01"),
        grossSalary: 30000 + sl,
        basic: 15000,
        components: { MA: 500, PFD: 750 },
        earnedGross: 30000,
        additions: 500,
        attendanceDeduction: 1000,
        otherDeduction: 0,
        totalDeduction: 1750,
        netPayable: 28750,
        payMethod: "Bank",
        sourceHash: "x",
      },
    });
  }
  return batch.id;
}

describe("ESS › access without Employee Master permissions", () => {
  it("lets any signed-in user call /api/ess while module APIs stay closed to them", () => {
    for (const method of ["GET", "POST"]) {
      expect(checkApiAccess(NO_GRANTS, method, "/api/ess/dashboard").allowed).toBe(true);
      expect(checkApiAccess(NO_GRANTS, method, "/api/ess/leave").allowed).toBe(true);
    }
    expect(checkApiAccess(NO_GRANTS, "GET", "/api/configuration/entity-master-data/employees").allowed).toBe(false);
    expect(checkApiAccess(NO_GRANTS, "GET", "/api/hrm/self-service/leaves").allowed).toBe(false);
    expect(checkApiAccess(NO_GRANTS, "GET", "/api/hrm/payroll/batches").allowed).toBe(false);
    // No principal, or a read-only API token: no access.
    expect(checkApiAccess(undefined, "GET", "/api/ess/dashboard").allowed).toBe(false);
    expect(checkApiAccess({ all: true, readOnly: true, keys: new Set() }, "GET", "/api/ess/dashboard").allowed).toBe(false);
  });

  it("shows a linked employee their own dashboard, profile and attendance", async () => {
    expect(await essMe(rahim)).toMatchObject({ linked: true, employee: { code: "E-1", name: "Rahim Uddin" } });
    const dashboard = await myDashboard(rahim);
    expect(dashboard.employee.code).toBe("E-1");
    expect(dashboard.upcoming).toHaveLength(14);
    const profile = await myProfile(rahim);
    expect(profile.employee.name).toBe("Rahim Uddin");
    // Confidential fields are not part of the self-service profile.
    expect(JSON.stringify(profile)).not.toContain("1234567890");
    expect((await myAttendance(rahim, { month: "2026-01" })).month).toBe("2026-01");
    expect((await myCalendar(rahim, "2026-01")).days).toHaveLength(31);
  });

  it("refuses a login without an employee record, and never acts for API tokens", async () => {
    expect(await essMe(stranger)).toMatchObject({ linked: false });
    await expect(myDashboard(stranger)).rejects.toMatchObject({ status: 403, details: { reason: "NOT_LINKED" } });
    await expect(myLeave(stranger)).rejects.toMatchObject({ status: 403 });
    await expect(myPayslips(stranger)).rejects.toMatchObject({ status: 403 });
    const token: Actor = { ...rahim, via: "token" };
    expect(await essMe(token)).toMatchObject({ linked: false });
  });

  it("refuses new requests from an employee who has left", async () => {
    await testPrisma().employee.update({ where: { id: rahimId }, data: { terminationDate: day("2025-01-31") } });
    await expect(applyOwnLeave(rahim, { leaveType: "Casual Leave", fromDate: "2026-03-01", toDate: "2026-03-01", reason: "x" }, [])).rejects.toMatchObject({ status: 403 });
    // Their history stays readable.
    expect((await myLeave(rahim)).canApply).toBe(false);
  });
});

describe("ESS › Employee A cannot reach Employee B", () => {
  it("keeps leave applications, attachments and cancellations to their owner", async () => {
    const { id } = await applyOwnLeave(salma, { leaveType: "Casual Leave", fromDate: "2026-03-01", toDate: "2026-03-02", reason: "Family" }, [{ name: "note.pdf", type: "application/pdf", size: PDF.byteLength, bytes: PDF }]);
    const attachmentId = (await myLeaveDetail(salma, id)).attachments[0].id;

    expect((await myLeave(rahim)).applications).toHaveLength(0);
    await expect(myLeaveDetail(rahim, id)).rejects.toMatchObject({ status: 404 });
    await expect(ownLeaveAttachment(rahim, id, attachmentId)).rejects.toMatchObject({ status: 404 });
    await expect(cancelOwnLeave(rahim, id)).rejects.toMatchObject({ status: 404 });
    expect((await ownLeaveAttachment(salma, id, attachmentId)).originalName).toBe("note.pdf");
  });

  it("files a leave for the signed-in employee whatever employee id the request names", async () => {
    const { id } = await applyOwnLeave(rahim, { leaveType: "Casual Leave", fromDate: "2026-03-01", toDate: "2026-03-01", reason: "x", employeeId: salmaId } as never, []);
    expect((await testPrisma().leaveApplication.findUniqueOrThrow({ where: { id } })).employeeId).toBe(rahimId);
  });

  it("shows each employee only their own published payslip", async () => {
    await payroll("Approved", "2026-01", true);
    const [own] = await myPayslips(rahim);
    expect(own).toMatchObject({ month: "2026-01", netPayable: 28750 });
    const [other] = await myPayslips(salma);
    await expect(myPayslip(rahim, other.id)).rejects.toMatchObject({ status: 404 });
    const slip = await myPayslip(rahim, own.id);
    expect(slip.employee.code).toBe("E-1");
    expect(slip.deductionLines.map((d) => d.label)).toEqual(["Attendance deduction", "Provident Fund (PFD)"]);
  });

  it("marks only the owner's notifications read", async () => {
    await testPrisma().userNotification.create({ data: { userId: salma.id, kind: "general", title: "Hello Salma" } });
    const note = (await myNotifications(salma)).items[0];
    expect((await markNotificationsRead(rahim, note.id)).updated).toBe(0);
    expect((await myNotifications(rahim)).items).toHaveLength(0);
    expect((await markNotificationsRead(salma, note.id)).updated).toBe(1);
  });
});

describe("ESS › payslip publication", () => {
  it("hides payroll under processing and approved but unpublished payroll", async () => {
    await payroll("Under Processing", "2026-02", false);
    const approved = await payroll("Approved", "2026-03", false);
    expect(await myPayslips(rahim)).toHaveLength(0);

    await publishPayslips(hr, approved);
    expect((await myPayslips(rahim)).map((p) => p.month)).toEqual(["2026-03"]);
    // Each employee in the payroll is told.
    expect((await myNotifications(rahim)).items[0]).toMatchObject({ kind: "payslip", read: false });
    await expect(publishPayslips(hr, approved)).rejects.toMatchObject({ status: 409 });
  });

  it("publishes only approved payroll, and only for payroll approvers", async () => {
    const processing = await payroll("Under Processing", "2026-04", false);
    await expect(publishPayslips(hr, processing)).rejects.toMatchObject({ status: 409 });
    const approved = await payroll("Approved", "2026-05", false);
    await expect(publishPayslips(rahim, approved)).rejects.toMatchObject({ status: 403 });
  });
});

describe("ESS › leave policy and workflow", () => {
  it("offers the policy's leave types for the employee's gender and charges working days only", async () => {
    await leavePolicy({ name: "Annual Leave", shortCode: "AL", yearlyQuota: 15 });
    await leavePolicy({ name: "Maternity Leave", shortCode: "ML", yearlyQuota: 112, gender: "Female" });
    expect((await myLeave(rahim)).balances.map((b) => b.leaveType)).toEqual(["Annual Leave"]);
    expect((await myLeave(salma)).balances.map((b) => b.leaveType)).toEqual(["Annual Leave", "Maternity Leave"]);
    await expect(applyOwnLeave(rahim, { leaveType: "Maternity Leave", fromDate: "2026-03-01", toDate: "2026-03-01", reason: "x" }, [])).rejects.toMatchObject({ status: 400 });
    await expect(applyOwnLeave(rahim, { leaveType: "Casual Leave", fromDate: "2026-03-01", toDate: "2026-03-01", reason: "x" }, [])).rejects.toMatchObject({ status: 400 });

    // 2026-03-06 is assigned as a weekly off (Calendar Assign): a 3-day range charges 2 days.
    await testPrisma().employeeCalendarDay.create({ data: { employeeId: rahimId, date: day("2026-03-06"), code: "OFF" } });
    const preview = await previewLeave(rahim, { leaveType: "Annual Leave", fromDate: "2026-03-05", toDate: "2026-03-07" });
    expect(preview).toMatchObject({ days: 2, calendarDays: 3, excluded: [{ date: "2026-03-06", reason: "Weekly off" }], remaining: 15, problems: [] });
    const { days } = await applyOwnLeave(rahim, { leaveType: "Annual Leave", fromDate: "2026-03-05", toDate: "2026-03-07", reason: "Trip" }, []);
    expect(days).toBe(2);
    expect((await myLeave(rahim)).balances[0]).toMatchObject({ quota: 15, pending: 2, remaining: 13 });
  });

  it("applies the sandwich rule to off days between leave days", async () => {
    await testPrisma().hrPolicyRecord.create({ data: { tab: "sandwich-leave", effectiveFrom: day("2020-01-01"), data: { countOffDays: true, countHolidays: false, leaveTypes: "" } } });
    await testPrisma().employeeCalendarDay.create({ data: { employeeId: rahimId, date: day("2026-03-06"), code: "OFF" } });
    expect((await previewLeave(rahim, { leaveType: "Casual Leave", fromDate: "2026-03-05", toDate: "2026-03-07" })).days).toBe(3);
    // An off day at the edge of the range is not between two leave days.
    expect((await previewLeave(rahim, { leaveType: "Casual Leave", fromDate: "2026-03-06", toDate: "2026-03-07" })).days).toBe(1);
  });

  it("enforces notice and attachment rules from the policy", async () => {
    await leavePolicy({ name: "Annual Leave", yearlyQuota: 15, noticeDays: 7 });
    await leavePolicy({ name: "Sick Leave", yearlyQuota: 14, attachmentAfterDays: 2 });
    const soon = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
    await expect(applyOwnLeave(rahim, { leaveType: "Annual Leave", fromDate: soon, toDate: soon, reason: "x" }, [])).rejects.toThrow(/in advance/);
    await expect(applyOwnLeave(rahim, { leaveType: "Sick Leave", fromDate: "2026-03-01", toDate: "2026-03-03", reason: "Flu" }, [])).rejects.toThrow(/supporting document/);
    await expect(applyOwnLeave(rahim, { leaveType: "Sick Leave", fromDate: "2026-03-01", toDate: "2026-03-03", reason: "Flu" }, [{ name: "rx.pdf", type: "application/pdf", size: PDF.byteLength, bytes: PDF }])).resolves.toMatchObject({ days: 3 });
  });

  it("tracks approval, notifies the employee, and refuses self-approval", async () => {
    const { id } = await applyOwnLeave(rahim, { leaveType: "Casual Leave", fromDate: "2026-03-01", toDate: "2026-03-02", reason: "Family" }, []);
    expect((await myLeaveDetail(rahim, id)).status).toBe("Pending");

    // HR may not decide their own leave.
    const own = await applyOwnLeave(hr, { leaveType: "Casual Leave", fromDate: "2026-04-01", toDate: "2026-04-01", reason: "Errand" }, []);
    await expect(decideLeave(hr, own.id, "Approved")).rejects.toMatchObject({ status: 403 });
    // Nor may an ordinary employee decide anyone's.
    await expect(decideLeave(rahim, id, "Approved")).rejects.toMatchObject({ status: 403 });

    await decideLeave(hr, id, "Approved");
    expect((await myLeaveDetail(rahim, id)).status).toBe("Approved");
    const titles = (await myNotifications(rahim)).items.map((n) => n.title);
    expect(titles).toContain("Casual Leave approved");
    expect(titles).toContain("Casual Leave application submitted");
    // An approved application can no longer be cancelled by the employee.
    await expect(cancelOwnLeave(rahim, id)).rejects.toMatchObject({ status: 409 });
    expect(hrEmployeeId).toBeTruthy();
  });

  it("cancels a pending application, which frees its days", async () => {
    const { id } = await applyOwnLeave(rahim, { leaveType: "Casual Leave", fromDate: "2026-03-01", toDate: "2026-03-03", reason: "Family" }, []);
    expect((await myLeave(rahim, 2026)).balances.find((b) => b.leaveType === "Casual Leave")).toMatchObject({ pending: 3, remaining: 7 });
    await cancelOwnLeave(rahim, id);
    expect((await myLeave(rahim, 2026)).balances.find((b) => b.leaveType === "Casual Leave")).toMatchObject({ pending: 0, remaining: 10 });
    expect((await myLeaveDetail(rahim, id)).status).toBe("Cancelled");
    // The same dates can be applied for again.
    await expect(applyOwnLeave(rahim, { leaveType: "Casual Leave", fromDate: "2026-03-01", toDate: "2026-03-03", reason: "Again" }, [])).resolves.toBeTruthy();
  });

  it("serialises concurrent submissions so only one of two overlapping applications is accepted", async () => {
    const input = { leaveType: "Casual Leave", fromDate: "2026-05-04", toDate: "2026-05-05", reason: "Double click" };
    const results = await Promise.allSettled([applyOwnLeave(rahim, input, []), applyOwnLeave(rahim, input, [])]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await testPrisma().leaveApplication.count({ where: { employeeId: rahimId } })).toBe(1);
  });
});

describe("ESS › attendance corrections", () => {
  it("files a correction for the employee's own day and flags a day already in payroll", async () => {
    const date = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dhaka" }).format(new Date(Date.now() - 3 * 86_400_000));
    const first = await requestCorrection(rahim, { date, correctionType: "Missing Check-In", requestedStatus: "Present", inTime: "09:00", outTime: "", reason: "Device was down" });
    expect(first.warning).toBeNull();
    const detail = await myAttendanceDay(rahim, date);
    expect(detail.requests[0]).toMatchObject({ requestedStatus: "Present", status: "Pending" });
    expect(detail.requests[0].reason).toContain("[Missing Check-In]");
    // Salma sees none of Rahim's requests.
    expect((await myAttendanceDay(salma, date)).requests).toHaveLength(0);

    // A day inside an approved payroll is flagged for a payroll adjustment.
    const batch = await payroll("Approved", date.slice(0, 7), false);
    await testPrisma().payrollBatch.update({ where: { id: batch }, data: { fromDate: day(date), toDate: day(date) } });
    const second = await requestCorrection(rahim, { date, correctionType: "Incorrect Attendance", requestedStatus: "Present", inTime: "", outTime: "", reason: "Was present" });
    expect(second.warning).toMatch(/payroll adjustment/);
  });

  it("requires the missing time for check-in and check-out corrections", async () => {
    await expect(requestCorrection(rahim, { date: "2026-01-05", correctionType: "Missing Check-Out", requestedStatus: "Present", inTime: "", outTime: "", reason: "x" })).rejects.toMatchObject({ name: "ZodError" });
  });
});
