import { describe, expect, it } from "vitest";
import { Prisma } from "@/generated/prisma/client";
import { calculateEmployee, DEFAULT_PAYROLL_RULES, grossOn, payrollPeriod, type DayFact, type EmployeeInput, type LateRule, type PayrollRules, type PolicySet } from "@/features/hrm/payroll/server/engine";

const D = Prisma.Decimal;
const SEPT = { month: "2026-09", fromDate: "2026-09-01", toDate: "2026-09-30", monthDays: 30 };
const OCT = { month: "2026-10", fromDate: "2026-10-01", toDate: "2026-10-31", monthDays: 31 };
const LATE: LateRule = { id: "late-1", latesAllowed: 3, deductionDays: new D(1), deductFrom: "Salary" };

/** A month of days: Fridays off, every other day worked on time unless overridden. */
function days(period: typeof SEPT, overrides: Record<number, Partial<DayFact>> = {}, lateRuleId: string | null = LATE.id): DayFact[] {
  return Array.from({ length: period.monthDays }, (_, i) => {
    const date = `${period.month}-${String(i + 1).padStart(2, "0")}`;
    const friday = new Date(`${date}T00:00:00Z`).getUTCDay() === 5;
    const base: DayFact = friday
      ? { date, schedule: "weekly-off", source: "Calendar Assign: OFF", punch: null, leaveType: null, lateRuleId, future: false }
      : { date, schedule: "working", source: "Calendar Assign: G", punch: { status: "Present", time: "09:00" }, leaveType: null, lateRuleId, future: false };
    return { ...base, ...overrides[i + 1] };
  });
}

const late = { punch: { status: "Late" as const, time: "09:31" } };
const noPunch = { punch: null };

function employee(extra: Partial<EmployeeInput> = {}, salary: Partial<EmployeeInput["salary"]> = {}): EmployeeInput {
  return {
    id: "e1",
    code: "E-1",
    name: "Employee One",
    joiningDate: "2020-01-01",
    terminationDate: null,
    designation: "Officer",
    department: "Accounts",
    holdSalary: false,
    salary: { salaryType: "regular", salaryOption: "gross", gross: new D(30000), basic: null, houseRent: null, medical: null, conveyance: null, eligiblePF: false, disbursementMode: "bank", bankOrProvider: "City Bank", accountNo: "AC-1" },
    increments: [],
    adjustments: [],
    allowances: [],
    days: days(SEPT),
    ...extra,
    ...(Object.keys(salary).length ? { salary: { ...employee().salary, ...salary } } : {}),
  };
}

const policies = (rules: Partial<PayrollRules> = {}, extra: Partial<PolicySet> = {}): PolicySet => ({
  rules: { ...DEFAULT_PAYROLL_RULES, ...rules },
  structure: null,
  pf: null,
  lateRules: new Map([[LATE.id, LATE]]),
  ...extra,
});

describe("payroll engine", () => {
  it("pays the full gross for a full month on time", () => {
    const r = calculateEmployee(employee(), SEPT, policies());
    expect(r).toMatchObject({ grossSalary: 30000, earnedGross: 30000, attendanceDeduction: 0, netPayable: 30000, errors: [] });
    expect(r.attendance).toMatchObject({ workingDays: 26, presentDays: 26, weeklyOffDays: 4, lateCount: 0, totalDeductionDays: 0 });
  });

  it("deducts one day's salary per three lates: 6 lates = 2 days, 5 lates = 1 day, 2 lates = none", () => {
    const withLates = (n: number) => calculateEmployee(employee({ days: days(SEPT, Object.fromEntries([1, 2, 3, 5, 6, 7].slice(0, n).map((d) => [d, late]))) }), SEPT, policies());
    expect(withLates(6)).toMatchObject({ attendanceDeduction: 2000, netPayable: 28000 });
    expect(withLates(6).attendance).toMatchObject({ lateCount: 6, lateDeductionDays: 2 });
    expect(withLates(5)).toMatchObject({ attendanceDeduction: 1000, netPayable: 29000 });
    expect(withLates(2)).toMatchObject({ attendanceDeduction: 0, netPayable: 30000 });
  });

  it("does not penalise lates when the rule takes them from the leave balance, or when no rule is in force", () => {
    const six = Object.fromEntries([1, 2, 3, 5, 6, 7].map((d) => [d, late]));
    const fromLeave = calculateEmployee(employee({ days: days(SEPT, six) }), SEPT, policies({}, { lateRules: new Map([[LATE.id, { ...LATE, deductFrom: "Leave Balance" }]]) }));
    expect(fromLeave).toMatchObject({ attendanceDeduction: 0, netPayable: 30000 });
    expect(fromLeave.attendance.lateLeaveBalanceDays).toBe(2);
    const noRule = calculateEmployee(employee({ days: days(SEPT, six, null) }), SEPT, policies());
    expect(noRule.netPayable).toBe(30000);
    expect(noRule.warnings.join(" ")).toMatch(/6 lates on days without a Late Punishment rule/);
  });

  it("never charges a day twice: a leave day is not also late or absent", () => {
    // Day 1: unpaid leave (with a late punch that must be ignored). Days 2, 3: late. → 1 unpaid day, 2 lates, no late deduction.
    const r = calculateEmployee(employee({ days: days(SEPT, { 1: { ...late, leaveType: "Leave Without Pay" }, 2: late, 3: late }) }), SEPT, policies());
    expect(r.attendance).toMatchObject({ lateCount: 2, unpaidLeaveDays: 1, unpaidLeaveDeductionDays: 1, lateDeductionDays: 0, totalDeductionDays: 1 });
    expect(r).toMatchObject({ attendanceDeduction: 1000, netPayable: 29000 });
  });

  it("pays approved paid leave and counts it by category", () => {
    const r = calculateEmployee(employee({ days: days(SEPT, { 1: { ...noPunch, leaveType: "Casual Leave" }, 2: { ...noPunch, leaveType: "Sick Leave" }, 3: { ...noPunch, leaveType: "Sick Leave" } }) }), SEPT, policies());
    expect(r.attendance).toMatchObject({ leaveDays: { "Casual Leave": 1, "Sick Leave": 2 }, paidLeaveDays: 3, unpaidLeaveDays: 0 });
    expect(r.netPayable).toBe(30000);
  });

  it("does not treat missing punches as absences unless a Payroll Rule says so", () => {
    const gaps = days(SEPT, { 1: noPunch, 2: noPunch, 3: { punch: { status: "Absent", time: "12:30" } } });
    const byDefault = calculateEmployee(employee({ days: gaps }), SEPT, policies());
    expect(byDefault).toMatchObject({ attendanceDeduction: 0, netPayable: 30000 });
    expect(byDefault.attendance).toMatchObject({ unrecordedDays: 2, absentDays: 1 });
    expect(byDefault.warnings.join(" ")).toMatch(/2 working days without punch or approved leave: not deducted/);

    const absentOnly = calculateEmployee(employee({ days: gaps }), SEPT, policies({ deductAbsentDays: true }));
    expect(absentOnly).toMatchObject({ attendanceDeduction: 1000 });
    const all = calculateEmployee(employee({ days: gaps }), SEPT, policies({ deductAbsentDays: true, deductUnrecordedDays: true }));
    expect(all).toMatchObject({ attendanceDeduction: 3000, netPayable: 27000 });
  });

  it("warns instead of deducting when no calendar is assigned", () => {
    const unassigned = days(SEPT).map((d) => ({ ...d, schedule: "unassigned" as const, source: "No calendar assigned", punch: null }));
    const r = calculateEmployee(employee({ days: unassigned }), SEPT, policies({ deductAbsentDays: true, deductUnrecordedDays: true }));
    expect(r).toMatchObject({ netPayable: 30000, attendanceDeduction: 0 });
    expect(r.warnings.join(" ")).toMatch(/30 days without an assigned calendar/);
  });

  it("prorates joiners and leavers by calendar days", () => {
    expect(calculateEmployee(employee({ joiningDate: "2026-09-16" }), SEPT, policies())).toMatchObject({ earnedGross: 15000, netPayable: 15000 });
    expect(calculateEmployee(employee({ terminationDate: "2026-09-10" }), SEPT, policies())).toMatchObject({ earnedGross: 10000 });
  });

  it("uses the salary in force on each day when an increment takes effect mid-month", () => {
    // 30,000 until 15 Sept, 36,000 from 16 Sept: 15 days each.
    const e = employee({ increments: [{ effectiveDate: "2026-09-16", previousGross: new D(30000) }] }, { gross: new D(36000) });
    expect(grossOn("2026-09-15", e.salary.gross, e.increments).toNumber()).toBe(30000);
    expect(calculateEmployee(e, SEPT, policies())).toMatchObject({ grossSalary: 36000, earnedGross: 33000 });
    // An increment effective next month does not raise this month's salary.
    expect(calculateEmployee(employee({ increments: [{ effectiveDate: "2026-10-01", previousGross: new D(30000) }] }, { gross: new D(36000) }), SEPT, policies())).toMatchObject({ grossSalary: 30000, earnedGross: 30000 });
  });

  it("rounds to paisa, half up, and the net equals the rounded parts", () => {
    // 10,000 ÷ 31 = 322.5806… → one unpaid day = 322.58.
    const r = calculateEmployee(employee({ days: days(OCT, { 1: { ...noPunch, leaveType: "Leave Without Pay" } }) }, { gross: new D(10000) }), OCT, policies());
    expect(r).toMatchObject({ attendanceDeduction: 322.58, netPayable: 9677.42 });
    expect(r.earnedGross + r.additions - r.totalDeduction).toBeCloseTo(r.netPayable, 10);
    // "30 days" basis: 10,000 ÷ 30 = 333.33.
    expect(calculateEmployee(employee({ days: days(OCT, { 1: { ...noPunch, leaveType: "Leave Without Pay" } }) }, { gross: new D(10000) }), OCT, policies({ dayRateBasis: "30 days" })).attendanceDeduction).toBe(333.33);
  });

  it("splits gross by the salary structure, pays mapped allowances and deducts PF", () => {
    const pct = (n: number) => new D(n);
    const r = calculateEmployee(
      employee(
        {
          allowances: [
            { code: "MA", name: "Mobile Allowance", calculation: "Fixed Amount", value: new D(500), monthly: true, fromDate: "2026-01-01" },
            { code: "FA", name: "Food Allowance", calculation: "% of Basic", value: new D(10), monthly: true, fromDate: "2026-01-01" },
            { code: null, name: "Laptop", calculation: "Fixed Amount", value: new D(200), monthly: false, fromDate: "2026-08-01" },
          ],
          adjustments: [
            { type: "addition", amount: new D(1000) },
            { type: "deduction", amount: new D(250) },
          ],
        },
        { eligiblePF: true },
      ),
      SEPT,
      policies({}, { structure: { id: "s", name: "Standard", basicPercent: pct(60), houseRentPercent: pct(25), medicalPercent: pct(10), conveyancePercent: pct(5) }, pf: { id: "pf", basis: "Basic", employeePercent: pct(10), eligibleAfterMonths: 6 } }),
    );
    expect(r).toMatchObject({ basic: 18000, houseRent: 7500, medical: 3000, transport: 1500, components: { MA: 500, FA: 1800, PFD: 1800 } });
    // Earnings 30,000 + 500 + 1,800 + 1,000; deductions PF 1,800 + 250. The one-off Laptop allowance was for August.
    expect(r).toMatchObject({ additions: 3300, otherDeduction: 2050, netPayable: 31250, errors: [] });
  });

  it("flags what it cannot calculate instead of guessing", () => {
    const pfOnBasic = calculateEmployee(employee({}, { eligiblePF: true }), SEPT, policies({}, { pf: { id: "pf", basis: "Basic", employeePercent: new D(10), eligibleAfterMonths: 0 } }));
    expect(pfOnBasic.errors.join(" ")).toMatch(/PF Setup deducts PF on Basic, but this salary has no Basic/);
    const noPfRule = calculateEmployee(employee({}, { eligiblePF: true }), SEPT, policies());
    expect(noPfRule.warnings.join(" ")).toMatch(/no PF Setup rule/);
    const tooMuch = calculateEmployee(employee({ adjustments: [{ type: "deduction", amount: new D(40000) }] }), SEPT, policies());
    expect(tooMuch.errors.join(" ")).toMatch(/Deductions .* are more than the earnings/);
  });

  it("runs the payroll period from the 21st to the 20th of the next month by default", () => {
    expect(DEFAULT_PAYROLL_RULES).toMatchObject({ periodStartDay: 21, periodMonth: "start" });
    expect(payrollPeriod("2026-11", 21)).toEqual({ month: "2026-11", fromDate: "2026-11-21", toDate: "2026-12-20", monthDays: 30 });
    expect(payrollPeriod("2026-12", 21)).toEqual({ month: "2026-12", fromDate: "2026-12-21", toDate: "2027-01-20", monthDays: 31 });
    expect(payrollPeriod("2027-02", 21)).toMatchObject({ fromDate: "2027-02-21", toDate: "2027-03-20", monthDays: 28 });
    expect(payrollPeriod("2026-11", 21, "end")).toMatchObject({ fromDate: "2026-10-21", toDate: "2026-11-20", monthDays: 31 });
    expect(payrollPeriod("2026-01", 21, "end")).toMatchObject({ fromDate: "2025-12-21", toDate: "2026-01-20" });
    expect(payrollPeriod("2026-09", 1)).toEqual({ month: "2026-09", fromDate: "2026-09-01", toDate: "2026-09-30", monthDays: 30 });
  });

  it("keeps held salaries on the sheet but pays nothing", () => {
    expect(calculateEmployee(employee({ holdSalary: true }), SEPT, policies())).toMatchObject({ earnedGross: 30000, netPayable: 0, payMethod: "hold" });
  });

  it("explains the net in a trace", () => {
    const r = calculateEmployee(employee({ days: days(SEPT, { 1: late, 2: late, 3: late }) }), SEPT, policies());
    expect(r.trace.map((t) => t.label)).toEqual(expect.arrayContaining(["Earned gross", "Attendance", "Late punishment", "Attendance deduction", "Net payable"]));
    expect(r.trace.at(-1)).toMatchObject({ label: "Net payable", amount: 29000, kind: "=" });
  });
});
