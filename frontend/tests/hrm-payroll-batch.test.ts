import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma/client", async () => {
  const { testPrisma } = await import("./helpers/test-db");
  return { db: testPrisma };
});
import { getApprovalSummary } from "@/features/approvals/server/summary.service";
import { createPipeline } from "@/features/configuration/security/approval/server/approval.service";
import {
  cancelPayrollBatch,
  createPayrollBatch,
  decidePayrollBatch,
  getPayrollBatch,
  getPayrollLine,
  listPayrollBatches,
  listPayrollLines,
  nextMonthOf,
  payrollSequence,
  previewPayroll,
  recalculatePayrollBatch,
  submitPayrollBatch,
  updatePayrollBatch,
} from "@/features/hrm/payroll/server/payroll-batch.service";
import type { Actor } from "@/lib/auth/actor";
import { FULL_ACCESS, grantsFromList, permissionKey } from "@/lib/permissions/registry";
import { adminActor, businessUnitInput, companyInput, officeInput, scopedActor } from "./helpers/fixtures";
import { resetTestDb, startTestDb, stopTestDb, testPrisma } from "./helpers/test-db";

const MONTH = "2026-09"; // 30 days; Fridays: 4, 11, 18, 25
const input = () => ({ officeId, month: MONTH, salaryType: "Monthly" as const, payrollDate: "2026-10-05", description: "September salary" });
const dhaka = (date: string, time: string) => new Date(`${date}T${time}:00+06:00`);
const day = (n: number) => `${MONTH}-${String(n).padStart(2, "0")}`;

let officeId: string;
let businessUnitId: string;
let deviceId: string;
let managerId: string;
let financeId: string;
const ids: Record<string, string> = {};
/** HR officer: every page, but not the master account. */
const hr: Actor = { ...adminActor, id: "hr-officer", name: "HR Officer", isMaster: false, grants: FULL_ACCESS };
const approver = (id: string, name: string): Actor => ({ ...adminActor, id, name, isMaster: false, grants: FULL_ACCESS });
/** Can open and edit Payroll, but has no Approve permission. */
const noApprove: Actor = { ...adminActor, id: "hr-clerk", name: "HR Clerk", isMaster: false, grants: grantsFromList(["view", "create", "edit"].map((a) => permissionKey("/hrm/payroll", a as "view"))) };

async function policy(tab: string, data: Record<string, unknown>, effectiveFrom = "2026-01-01", employeeId?: string) {
  await testPrisma().hrPolicyRecord.create({ data: { tab, data: data as never, effectiveFrom: new Date(effectiveFrom), employeeId: employeeId ?? null } });
}

/** Calendar Assign for September: G on working days, OFF on Fridays. */
async function assignCalendar(code: string) {
  await testPrisma().employeeCalendarDay.createMany({
    data: Array.from({ length: 30 }, (_, i) => {
      const date = new Date(`${day(i + 1)}T00:00:00Z`);
      return { employeeId: ids[code], date, shortCode: date.getUTCDay() === 5 ? "OFF" : "G" };
    }),
  });
}

/** Punches on every working day at `time`, except the days in `skip`; `lateOn` days punch at 09:30. */
async function punchMonth(code: string, { lateOn = [], skip = [] }: { lateOn?: number[]; skip?: number[] } = {}) {
  const data = [];
  for (let n = 1; n <= 30; n++) {
    if (new Date(`${day(n)}T00:00:00Z`).getUTCDay() === 5 || skip.includes(n)) continue;
    data.push({ deviceId, deviceUserId: code, employeeId: ids[code], punchTime: dhaka(day(n), lateOn.includes(n) ? "09:30" : "09:05") });
  }
  await testPrisma().attendancePunch.createMany({ data });
}

async function twoStagePipeline() {
  managerId = (await testPrisma().user.create({ data: { name: "HR Manager", phone: "01711111111", passwordHash: "x" } })).id;
  financeId = (await testPrisma().user.create({ data: { name: "Finance Head", phone: "01722222222", passwordHash: "x" } })).id;
  const directorId = (await testPrisma().user.create({ data: { name: "Director", phone: "01733333333", passwordHash: "x" } })).id;
  const who = (approverId: string) => ({ userType: "USER" as const, businessUnitId: "", approverId, authorizationType: "APPROVAL" as const });
  await createPipeline(adminActor, {
    name: "Payroll",
    feature: "Salary Sheet",
    userType: "USER",
    superApproverId: directorId,
    remarks: "",
    stages: [
      { name: "HR Manager", approvalOrder: "ANY", requiredCount: 1, approvers: [who(managerId)] },
      { name: "Finance", approvalOrder: "ANY", requiredCount: 1, approvers: [who(financeId)] },
    ],
  } as Parameters<typeof createPipeline>[1]);
}

beforeAll(async () => {
  await startTestDb();
});
afterAll(async () => {
  await stopTestDb();
});
beforeEach(async () => {
  await resetTestDb();
  const companyId = (await testPrisma().company.create({ data: companyInput })).id;
  businessUnitId = (await testPrisma().businessUnit.create({ data: { ...businessUnitInput, companyId } })).id;
  officeId = (await testPrisma().office.create({ data: { ...officeInput, businessUnitId } })).id;
  deviceId = (await testPrisma().attendanceDevice.create({ data: { name: "Gate", ipAddress: "10.0.0.5", officeId } })).id;
  const add = async (code: string, gross: number | null, extra: Record<string, unknown> = {}) => {
    const { id } = await testPrisma().employee.create({ data: { officeId, employeeCode: code, name: `Employee ${code}`, joiningDate: new Date("2020-01-01"), department: "Accounts", designation: "Officer", ...extra } });
    if (gross !== null) await testPrisma().employeeSalary.create({ data: { employeeId: id, salaryType: "regular", salaryOption: "gross", grossOnly: gross, disbursementMode: "bank", bankName: "City Bank", bankAccountNo: `AC-${code}` } });
    ids[code] = id;
  };
  await add("E-1", 30000);
  await add("E-2", 30000);
  await add("E-3", null); // no salary
  // The configured policies: late after 09:20, three lates = one day's salary.
  await policy("attendance-process", { dayStart: "08:00", lateAfter: "09:20", absentAfter: "12:00" });
  await policy("late-punishment", { latesAllowed: 3, deductionDays: 1, deductFrom: "Salary", halfDayCounts: false });
  // These scenarios use a calendar-month period; the 21st – 20th default has its own test.
  await policy("payroll-rules", { periodStartDay: 1, dayRateBasis: "Calendar days of the month", deductAbsentDays: false, deductUnrecordedDays: false, unpaidLeaveTypes: "" });
  await assignCalendar("E-1");
  await assignCalendar("E-2");
  await punchMonth("E-1", { lateOn: [1, 2, 3, 5, 6, 7] }); // six lates → two days
  await punchMonth("E-2", { skip: [8, 9] }); // two days without punch or leave
});

describe("Salary generation", () => {
  it("calculates from the assigned calendar, punches and the configured late rule", async () => {
    const preview = await previewPayroll(hr, input());
    expect(preview).toMatchObject({ eligibleCount: 3, warningCount: 1, errorCount: 0, existing: null });
    expect(preview.excluded).toEqual([expect.objectContaining({ employeeCode: "E-3", reason: expect.stringMatching(/No salary/) })]);
    const [e1, e2] = preview.lines;
    expect(e1.attendance).toMatchObject({ workingDays: 26, weeklyOffDays: 4, presentDays: 26, lateCount: 6, lateDeductionDays: 2, unassignedDays: 0 });
    expect(e1).toMatchObject({ grossSalary: 30000, attendanceDeduction: 2000, netPayable: 28000, payMethod: "bank" });
    // Missing punches are reported, not silently deducted.
    expect(e2.attendance).toMatchObject({ presentDays: 24, unrecordedDays: 2, lateCount: 0 });
    expect(e2).toMatchObject({ attendanceDeduction: 0, netPayable: 30000 });
    expect(e2.warnings[0]).toMatch(/2 working days without punch or approved leave/);
    // Totals reconcile with the lines, and the eligible list with rows + exclusions.
    expect(preview.totals).toMatchObject({ employees: 2, gross: 60000, attendanceDeduction: 2000, net: 58000 });
    expect(preview.lines.length + preview.excluded.length).toBe(preview.eligibleCount);
    expect(preview.policies.map((p) => p.tab)).toContain("late-punishment");
    // Nothing was saved.
    expect(await testPrisma().payrollBatch.count()).toBe(0);
  });

  it("uses each employee's own calendar, approved leave and a Payroll Rule when one exists", async () => {
    // E-2 works Fridays and is off on Saturdays instead; takes one unpaid and one casual leave on the unpunched days.
    await testPrisma().employeeCalendarDay.deleteMany({ where: { employeeId: ids["E-2"] } });
    await testPrisma().employeeCalendarDay.createMany({
      data: Array.from({ length: 30 }, (_, i) => {
        const date = new Date(`${day(i + 1)}T00:00:00Z`);
        return { employeeId: ids["E-2"], date, shortCode: date.getUTCDay() === 6 ? "OFF" : "A" };
      }),
    });
    await testPrisma().leaveApplication.createMany({
      data: [
        { employeeId: ids["E-2"], leaveType: "Leave Without Pay", fromDate: new Date(day(8)), toDate: new Date(day(8)), days: 1, reason: "Personal", status: "Approved" },
        { employeeId: ids["E-2"], leaveType: "Casual Leave", fromDate: new Date(day(9)), toDate: new Date(day(9)), days: 1, reason: "Personal", status: "Approved" },
        { employeeId: ids["E-2"], leaveType: "Sick Leave", fromDate: new Date(day(10)), toDate: new Date(day(10)), days: 1, reason: "Pending one", status: "Pending" },
      ],
    });
    await policy("payroll-rules", { periodStartDay: 1, dayRateBasis: "Calendar days of the month", deductAbsentDays: true, deductUnrecordedDays: true, unpaidLeaveTypes: "" }, "2026-02-01");
    const e2 = (await previewPayroll(hr, input())).lines[1];
    // Saturdays off (5, 12, 19, 26) → 26 working days. The 4 Fridays have no punch and no leave → absent under the rule.
    expect(e2.attendance).toMatchObject({ workingDays: 26, weeklyOffDays: 4, leaveDays: { "Leave Without Pay": 1, "Casual Leave": 1 }, unpaidLeaveDeductionDays: 1, unrecordedDays: 4, absentDeductionDays: 4, offDaysWorked: 4 });
    expect(e2).toMatchObject({ attendanceDeduction: 5000, netPayable: 25000 });
  });

  it("uses the 21st – 20th payroll period unless a Payroll Rule says otherwise", async () => {
    await testPrisma().hrPolicyRecord.deleteMany({ where: { tab: "payroll-rules" } });
    // September payroll = 21 Sept – 20 Oct (30 days). The fixtures only cover September days.
    const preview = await previewPayroll(hr, input());
    expect(preview).toMatchObject({ fromDate: "2026-09-21", toDate: "2026-10-20" });
    const e1 = preview.lines[0];
    // Calendar and punches exist for 21 – 30 Sept only: 9 working days (the 25th is a Friday); the other 20 days have no calendar.
    expect(e1.attendance).toMatchObject({ periodDays: 30, employedDays: 30, workingDays: 9, weeklyOffDays: 1, presentDays: 9, lateCount: 0, unassignedDays: 20 });
    expect(e1).toMatchObject({ earnedGross: 30000, netPayable: 30000 });
    expect(preview.notices.join(" ")).toMatch(/21st to the 20th of the next month/);
    // A joiner on 6 Oct is paid 15 of the period's 30 days.
    await testPrisma().employee.update({ where: { id: ids["E-2"] }, data: { joiningDate: new Date("2026-10-06") } });
    expect((await previewPayroll(hr, input())).lines[1]).toMatchObject({ earnedGross: 15000 });
    // Named after the month the period ends in: September = 21 Aug – 20 Sept.
    await policy("payroll-rules", { periodStartDay: 21, periodMonth: "The month the period ends in", dayRateBasis: "Calendar days of the month" });
    expect(await previewPayroll(hr, input())).toMatchObject({ fromDate: "2026-08-21", toDate: "2026-09-20" });
    const { id } = await createPayrollBatch(hr, input());
    expect(await getPayrollBatch(hr, id)).toMatchObject({ month: MONTH, fromDate: "2026-08-21", toDate: "2026-09-20" });
  });

  it("saves a draft with a reference, lines, snapshot and audit event; submission does not approve it", async () => {
    const { id, reference } = await createPayrollBatch(hr, input());
    expect(reference).toBe("PAY-2026-00001");
    const batch = await getPayrollBatch(hr, id);
    expect(batch).toMatchObject({ status: "Draft", stale: false, eligibleCount: 3, totals: { employees: 2, net: 58000 }, can: { edit: true, submit: true, cancel: true, decide: false } });
    expect(batch.events.map((e) => [e.action, e.toStatus, e.actorName])).toEqual([["Generated", "Draft", "HR Officer"]]);
    const lines = await listPayrollLines(hr, id, { search: "e-1" });
    expect(lines).toMatchObject({ total: 1, rows: [{ employeeCode: "E-1", netPayable: 28000 }] });
    expect((await listPayrollLines(hr, id, { sort: "net", dir: "asc" })).rows.map((l) => l.employeeCode)).toEqual(["E-1", "E-2"]);
    expect((await listPayrollLines(hr, id, { issues: true })).rows.map((l) => l.employeeCode)).toEqual(["E-2"]);
    const detail = await getPayrollLine(hr, id, lines.rows[0].id!);
    expect(detail.trace.at(-1)).toMatchObject({ label: "Net payable", amount: 28000 });

    await submitPayrollBatch(hr, id, { version: batch.version });
    expect(await getPayrollBatch(hr, id)).toMatchObject({ status: "Under Processing", can: { edit: false, submit: false, cancel: false, decide: true } });
    expect((await listPayrollBatches(hr, { year: "2026", month: "09", search: "Employee E-2" })).rows).toEqual([expect.objectContaining({ reference, status: "Under Processing", employeeCount: 2, totalNet: 58000, totalDeduction: 2000 })]);
  });

  it("prevents a second payroll for the same office and period, also when two users generate at once", async () => {
    const results = await Promise.allSettled([createPayrollBatch(hr, input()), createPayrollBatch(adminActor, input())]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect((results.find((r) => r.status === "rejected") as PromiseRejectedResult).reason.message).toMatch(/already exists/);
    await expect(createPayrollBatch(hr, input())).rejects.toThrow(/PAY-2026-\d+ \(Draft\) already exists/);
    expect((await previewPayroll(hr, input())).existing).toMatchObject({ status: "Draft" });
    expect(await testPrisma().payrollBatch.count()).toBe(1);
    // The database itself refuses a second live salary for the same employee and period.
    const batch = await testPrisma().payrollBatch.findFirstOrThrow({ include: { lines: true } });
    const { id: _id, ...line } = batch.lines[0];
    await expect(testPrisma().payrollBatchLine.create({ data: { ...line, components: {}, attendance: {}, trace: [], warnings: [], errors: [] } })).rejects.toThrow();
  });

  it("keeps the snapshot when salary or attendance changes, flags it stale and recalculates only on request", async () => {
    const { id } = await createPayrollBatch(hr, input());
    await testPrisma().employeeSalary.update({ where: { employeeId: ids["E-2"] }, data: { grossOnly: 45000 } });
    await testPrisma().attendancePunch.create({ data: { deviceId, deviceUserId: "E-2", employeeId: ids["E-2"], punchTime: dhaka(day(8), "09:00") } });

    let batch = await getPayrollBatch(hr, id);
    expect(batch).toMatchObject({ stale: true, totals: { net: 58000 }, can: { submit: false } });
    await expect(submitPayrollBatch(hr, id, { version: batch.version })).rejects.toThrow(/changed since this payroll was calculated/);

    await recalculatePayrollBatch(hr, id, { version: batch.version });
    batch = await getPayrollBatch(hr, id);
    expect(batch).toMatchObject({ stale: false, totals: { gross: 75000, net: 73000 } });
    expect(batch.events.at(-1)).toMatchObject({ action: "Recalculated", remarks: expect.stringContaining("58000.00 → 73000.00") });
    // A stale version number (someone else changed the batch) is refused.
    await expect(recalculatePayrollBatch(hr, id, { version: 1 })).rejects.toThrow(/changed by someone else/);
  });

  it("locks a submitted payroll: no edit, recalculation or cancellation", async () => {
    const { id } = await createPayrollBatch(hr, input());
    await submitPayrollBatch(hr, id, { version: 1 });
    const { version } = await getPayrollBatch(hr, id);
    await expect(recalculatePayrollBatch(hr, id, { version })).rejects.toThrow(/Under Processing is locked/);
    await expect(updatePayrollBatch(hr, id, { version, payrollDate: "2026-10-06", description: "x" })).rejects.toThrow(/cannot be edited/);
    await expect(cancelPayrollBatch(hr, id, { version, reason: "x" })).rejects.toThrow(/cannot be cancelled/);
    await expect(submitPayrollBatch(hr, id, { version })).rejects.toThrow(/cannot be submitted/);
    // Later salary changes do not alter the frozen figures.
    await testPrisma().employeeSalary.update({ where: { employeeId: ids["E-1"] }, data: { grossOnly: 90000 } });
    expect(await getPayrollBatch(hr, id)).toMatchObject({ stale: false, totals: { net: 58000 } });
  });

  it("goes through every approval stage: an intermediate approval is not final, and only the stage's approvers may act", async () => {
    await twoStagePipeline();
    const manager = approver(managerId, "HR Manager");
    const finance = approver(financeId, "Finance Head");
    const { id } = await createPayrollBatch(hr, input());
    await submitPayrollBatch(hr, id, { version: 1 });
    let batch = await getPayrollBatch(hr, id);

    // Not an approver of the stage; Finance cannot jump the queue; no Approve permission at all.
    await expect(decidePayrollBatch(hr, id, { decision: "approve", version: batch.version })).rejects.toThrow(/stage 1 \(HR Manager\)/);
    await expect(decidePayrollBatch(finance, id, { decision: "approve", version: batch.version })).rejects.toThrow(/stage 1 \(HR Manager\)/);
    await expect(decidePayrollBatch(noApprove, id, { decision: "approve", version: batch.version })).rejects.toThrow(/permission to approve/);
    expect((await getPayrollBatch(hr, id)).status).toBe("Under Processing");

    // Stage 1 of 2: still Under Processing.
    expect(await decidePayrollBatch(manager, id, { decision: "approve", remarks: "Checked", version: batch.version })).toEqual({ status: "Under Processing", final: false });
    batch = await getPayrollBatch(hr, id);
    expect(batch).toMatchObject({ status: "Under Processing", approval: { stages: 2, current: { stageNo: 2, name: "Finance" } } });
    await expect(decidePayrollBatch(manager, id, { decision: "approve", version: batch.version })).rejects.toThrow(/stage 2 \(Finance\)/);
    const summary = (await getApprovalSummary(adminActor)).categories.find((c) => c.id === "salary-sheet");
    expect(summary).toMatchObject({ pending: 1, pipeline: { stages: 2 }, stageLoad: [{ stageNo: 2, name: "Finance", pending: 1 }] });

    // Final stage: Approved, and immutable from then on.
    expect(await decidePayrollBatch(finance, id, { decision: "approve", version: batch.version })).toEqual({ status: "Approved", final: true });
    batch = await getPayrollBatch(hr, id);
    expect(batch).toMatchObject({ status: "Approved", decidedByName: "Finance Head", can: { edit: false, submit: false, cancel: false, decide: false } });
    expect(batch.stages.map((s) => [s.name, s.status, s.approvedNames])).toEqual([
      ["HR Manager", "APPROVED", ["HR Manager"]],
      ["Finance", "APPROVED", ["Finance Head"]],
    ]);
    expect(batch.events.map((e) => [e.action, e.fromStatus, e.toStatus, e.stageNo, e.actorName])).toEqual([
      ["Generated", null, "Draft", null, "HR Officer"],
      ["Submitted", "Draft", "Under Processing", null, "HR Officer"],
      ["Stage approved", "Under Processing", "Under Processing", 1, "HR Manager"],
      ["Approved", "Under Processing", "Approved", 2, "Finance Head"],
    ]);
    await expect(decidePayrollBatch(finance, id, { decision: "approve", version: batch.version })).rejects.toThrow(/is Approved/);
    await expect(recalculatePayrollBatch(hr, id, { version: batch.version })).rejects.toThrow(/locked/);
    await expect(cancelPayrollBatch(hr, id, { version: batch.version, reason: "x" })).rejects.toThrow(/cannot be cancelled/);
  });

  it("keeps the rejection reason, allows correction and restarts approval on resubmission", async () => {
    await twoStagePipeline();
    const manager = approver(managerId, "HR Manager");
    const finance = approver(financeId, "Finance Head");
    const { id } = await createPayrollBatch(hr, input());
    await submitPayrollBatch(hr, id, { version: 1 });
    let batch = await getPayrollBatch(hr, id);
    await decidePayrollBatch(manager, id, { decision: "approve", version: batch.version });
    batch = await getPayrollBatch(hr, id);
    await expect(decidePayrollBatch(finance, id, { decision: "reject", remarks: "", version: batch.version })).rejects.toThrow();
    await decidePayrollBatch(finance, id, { decision: "reject", remarks: "E-2 gross is wrong", version: batch.version });
    batch = await getPayrollBatch(hr, id);
    expect(batch).toMatchObject({ status: "Rejected", rejectionReason: "E-2 gross is wrong", can: { edit: true, decide: false } });
    expect(batch.events.at(-1)).toMatchObject({ action: "Rejected", stageNo: 2, stageName: "Finance", remarks: "E-2 gross is wrong" });

    // Correct the source data, recalculate, resubmit: approval starts again at stage 1.
    await testPrisma().employeeSalary.update({ where: { employeeId: ids["E-2"] }, data: { grossOnly: 32000 } });
    await recalculatePayrollBatch(hr, id, { version: batch.version });
    batch = await getPayrollBatch(hr, id);
    await submitPayrollBatch(hr, id, { version: batch.version });
    batch = await getPayrollBatch(hr, id);
    expect(batch).toMatchObject({ status: "Under Processing", rejectionReason: null, totals: { net: 60000 } });
    await expect(decidePayrollBatch(finance, id, { decision: "approve", version: batch.version })).rejects.toThrow(/stage 1/);
    await decidePayrollBatch(manager, id, { decision: "approve", version: batch.version });
    batch = await getPayrollBatch(hr, id);
    expect(await decidePayrollBatch(finance, id, { decision: "approve", version: batch.version })).toMatchObject({ status: "Approved" });
    expect((await getPayrollBatch(hr, id)).events.map((e) => e.action)).toEqual(["Generated", "Submitted", "Stage approved", "Rejected", "Recalculated", "Resubmitted", "Stage approved", "Approved"]);
  });

  it("approves in one step when no pipeline is set up, for users with the Approve permission", async () => {
    const { id } = await createPayrollBatch(hr, input());
    await submitPayrollBatch(hr, id, { version: 1 });
    const { version } = await getPayrollBatch(hr, id);
    await expect(decidePayrollBatch(noApprove, id, { decision: "approve", version })).rejects.toThrow(/permission to approve/);
    expect(await decidePayrollBatch(hr, id, { decision: "approve", version })).toEqual({ status: "Approved", final: true });
  });

  it("generates month after month: no earlier month and no gap once a payroll exists", async () => {
    const forMonth = (month: string) => ({ ...input(), month });
    // The first payroll of an office may be for any month.
    expect((await previewPayroll(hr, forMonth("2026-08"))).sequence).toBeNull();
    const sept = await createPayrollBatch(hr, input());

    // Earlier months are closed, and October cannot be skipped.
    await expect(createPayrollBatch(hr, forMonth("2026-08"))).rejects.toThrow(/already generated up to September 2026 \(PAY-2026-00001\).*next payroll is October 2026/);
    await expect(createPayrollBatch(hr, forMonth("2025-12"))).rejects.toThrow(/earlier month cannot be generated/);
    await expect(createPayrollBatch(hr, forMonth("2026-11"))).rejects.toThrow(/must be October 2026; November 2026 would skip a month/);
    expect(await previewPayroll(hr, forMonth("2026-08"))).toMatchObject({ inSequence: false, sequence: { lastMonth: "2026-09", lastReference: "PAY-2026-00001", nextMonth: "2026-10" } });
    expect(await previewPayroll(hr, forMonth("2026-10"))).toMatchObject({ inSequence: true, existing: null });
    expect(await payrollSequence(hr, officeId, "Monthly")).toMatchObject({ lastMonth: "2026-09", nextMonth: "2026-10" });

    // October follows; then only November is open, across the year end too.
    const oct = await createPayrollBatch(hr, forMonth("2026-10"));
    await expect(createPayrollBatch(hr, forMonth("2026-10"))).rejects.toThrow(/already exists/);
    expect(await payrollSequence(hr, officeId, "Monthly")).toMatchObject({ lastMonth: "2026-10", nextMonth: "2026-11" });
    expect(nextMonthOf("2026-12")).toBe("2027-01");

    // A cancelled payroll does not count: cancelling October reopens October, not August.
    await cancelPayrollBatch(hr, oct.id, { version: 1, reason: "Wrong figures" });
    await expect(createPayrollBatch(hr, forMonth("2026-11"))).rejects.toThrow(/must be October 2026/);
    expect((await createPayrollBatch(hr, forMonth("2026-10"))).reference).toBe("PAY-2026-00003");
    // Recalculating an existing payroll is not a new generation.
    await recalculatePayrollBatch(hr, sept.id, { version: 1 });
    // Another office has its own sequence.
    const other = (await testPrisma().office.create({ data: { ...officeInput, name: "Factory", businessUnitId } })).id;
    expect(await payrollSequence(hr, other, "Monthly")).toBeNull();
  });

  it("cancels a draft with a reason, keeps it for audit and frees the period", async () => {
    const { id } = await createPayrollBatch(hr, input());
    await expect(cancelPayrollBatch(hr, id, { version: 1, reason: "" })).rejects.toThrow();
    await cancelPayrollBatch(hr, id, { version: 1, reason: "Wrong month" });
    expect(await getPayrollBatch(hr, id)).toMatchObject({ status: "Cancelled", cancelReason: "Wrong month", can: { edit: false } });
    const again = await createPayrollBatch(hr, input());
    expect(again.reference).toBe("PAY-2026-00002");
    expect((await listPayrollBatches(hr, { status: "Cancelled" })).total).toBe(1);
    expect((await listPayrollBatches(hr, {})).total).toBe(2);
  });

  it("stops submission while a line has an error", async () => {
    await testPrisma().employeeSalaryAdjustment.create({ data: { employeeId: ids["E-2"], fromMonth: MONTH, toMonth: MONTH, type: "deduction", amount: 50000 } });
    const { id } = await createPayrollBatch(hr, input());
    const batch = await getPayrollBatch(hr, id);
    expect(batch).toMatchObject({ errorCount: 1, can: { submit: false } });
    await expect(submitPayrollBatch(hr, id, { version: batch.version })).rejects.toThrow(/Fix the 1 error/);
  });

  it("is limited to HR, to the user's companies and to editors", async () => {
    const { id } = await createPayrollBatch(hr, input());
    const staff: Actor = { ...adminActor, id: "staff", isMaster: false };
    await expect(listPayrollBatches(staff, {})).rejects.toThrow(/Only HR/);
    await expect(previewPayroll(staff, input())).rejects.toThrow(/Only HR/);
    const otherCompany = { ...scopedActor(["00000000-0000-4000-8000-000000000000"]), grants: FULL_ACCESS };
    expect((await listPayrollBatches(otherCompany, {})).total).toBe(0);
    await expect(getPayrollBatch(otherCompany, id)).rejects.toThrow(/not found/i);
    await expect(previewPayroll(otherCompany, input())).rejects.toThrow(/not found/i);
    const viewer: Actor = { ...adminActor, id: "viewer", isMaster: false, grants: grantsFromList([permissionKey("/hrm/payroll", "view")]) };
    expect((await getPayrollBatch(viewer, id)).can).toEqual({ edit: false, submit: false, cancel: false, decide: false });
    await expect(recalculatePayrollBatch(viewer, id, { version: 1 })).rejects.toThrow(/permission to change/);
    await expect(cancelPayrollBatch(viewer, id, { version: 1, reason: "x" })).rejects.toThrow(/permission to change/);
  });
});
