import { Prisma } from "@/generated/prisma/client";
import { COMPONENT_CODES, PF_CODE, type AttendanceSummary, type ComponentCode, type TraceStep } from "../batch-types";

/**
 * The payroll calculation, as a pure function of its inputs (loaded by
 * payroll-inputs.ts from Employee Master Data, Calendar Assign, Attendance and the
 * HR Governance policies). No database access, so it is unit-tested directly.
 *
 * Money is Prisma.Decimal throughout; every reported amount is rounded once, to
 * paisa (2 decimals, half up), and the net is built from the rounded parts so the
 * line always adds up to what is shown.
 */

const D = Prisma.Decimal;
type Dec = Prisma.Decimal;
const ZERO = new D(0);
const round = (value: Dec) => value.toDecimalPlaces(2, D.ROUND_HALF_UP);
const toNum = (value: Dec) => round(value).toNumber();
const fmt = (value: Dec) => round(value).toFixed(2);

// ─── Inputs ───────────────────────────────────────────────────────────────────

export type ScheduleKind = "working" | "weekly-off" | "holiday" | "unassigned";

/** What the ERP knows about one employee's day. */
export interface DayFact {
  date: string;
  schedule: ScheduleKind;
  /** Where the schedule came from ("Calendar Assign: G", "Roster: General-G", "Office off day" …). */
  source: string;
  /** First punch rated by the attendance rule; null without punches. */
  punch: { status: "Present" | "Late" | "Absent"; time: string } | null;
  /** Approved leave covering the day. */
  leaveType: string | null;
  /** Late Punishment rule in force on the day. */
  lateRuleId: string | null;
  /** The day is after today. */
  future: boolean;
}

export interface LateRule {
  id: string;
  latesAllowed: number;
  deductionDays: Dec;
  deductFrom: "Salary" | "Leave Balance";
}

export interface PayrollRules {
  id: string | null;
  dayRateBasis: "Calendar days of the month" | "30 days" | "Assigned working days";
  deductAbsentDays: boolean;
  deductUnrecordedDays: boolean;
  /** Lower-cased leave type names that are unpaid. */
  unpaidLeaveTypes: string[];
  /** Day of the month the payroll period starts on (1 = calendar month; 21 = 21st to the 20th). */
  periodStartDay: number;
  /** Whether "November" is the period starting in November or the one ending in it. */
  periodMonth: "start" | "end";
}

export const DEFAULT_PAYROLL_RULES: PayrollRules = {
  id: null,
  dayRateBasis: "Calendar days of the month",
  deductAbsentDays: false,
  deductUnrecordedDays: false,
  unpaidLeaveTypes: ["leave without pay"],
  // The company's payroll month: the 21st to the 20th of the next month.
  periodStartDay: 21,
  periodMonth: "start",
};

/**
 * The payroll period of a month label (YYYY-MM). Start day 1 is the calendar
 * month; otherwise the period runs from the start day to the day before it in
 * the following month: "2026-11" with day 21 is 21 Nov – 20 Dec ("start"), or
 * 21 Oct – 20 Nov when the month is named after the period's end ("end").
 */
export function payrollPeriod(month: string, startDay: number, naming: "start" | "end" = "start"): PeriodInput {
  const [year, m] = month.split("-").map(Number);
  const day = Number.isInteger(startDay) && startDay >= 1 && startDay <= 28 ? startDay : 1;
  const first = day === 1 || naming === "start" ? m - 1 : m - 2;
  const from = new Date(Date.UTC(year, first, day));
  const to = new Date(Date.UTC(year, first + 1, day) - 86_400_000);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { month, fromDate: iso(from), toDate: iso(to), monthDays: Math.round((to.getTime() - from.getTime()) / 86_400_000) + 1 };
}

export interface SalaryStructure {
  id: string;
  name: string;
  basicPercent: Dec;
  houseRentPercent: Dec;
  medicalPercent: Dec;
  conveyancePercent: Dec;
}

export interface AllowanceInput {
  /** Column it shows in (MA, FA …), or null for other allowances. */
  code: ComponentCode | null;
  name: string;
  calculation: "Fixed Amount" | "% of Basic" | "% of Gross";
  value: Dec;
  monthly: boolean;
  /** Assignment From Date; a one-off allowance is paid in the month of this date. */
  fromDate: string;
}

export interface PfRule {
  id: string;
  basis: "Basic" | "Gross";
  employeePercent: Dec;
  eligibleAfterMonths: number;
}

export interface SalaryInput {
  /** regular | day-basis */
  salaryType: string;
  /** gross | structure-basic | structure-gross */
  salaryOption: string;
  /** Current monthly gross (daily rate for day-basis). */
  gross: Dec;
  basic: Dec | null;
  houseRent: Dec | null;
  medical: Dec | null;
  conveyance: Dec | null;
  eligiblePF: boolean;
  disbursementMode: string;
  bankOrProvider: string | null;
  accountNo: string | null;
}

export interface EmployeeInput {
  id: string;
  code: string;
  name: string;
  joiningDate: string;
  terminationDate: string | null;
  designation: string | null;
  department: string | null;
  holdSalary: boolean;
  salary: SalaryInput;
  /** Approved increments, any date: the gross before each one's effective date was its previousGross. */
  increments: { effectiveDate: string; previousGross: Dec }[];
  adjustments: { type: "addition" | "deduction"; amount: Dec }[];
  allowances: AllowanceInput[];
  /** Every day of the month, employed or not. */
  days: DayFact[];
}

export interface PeriodInput {
  month: string;
  fromDate: string;
  toDate: string;
  monthDays: number;
}

export interface PolicySet {
  rules: PayrollRules;
  structure: SalaryStructure | null;
  pf: PfRule | null;
  lateRules: Map<string, LateRule>;
}

// ─── Result ───────────────────────────────────────────────────────────────────

export interface EngineResult {
  grossSalary: number;
  basic: number | null;
  houseRent: number | null;
  medical: number | null;
  transport: number | null;
  components: Partial<Record<ComponentCode, number>>;
  allowanceTotal: number;
  earnedGross: number;
  additions: number;
  attendanceDeduction: number;
  otherDeduction: number;
  totalDeduction: number;
  netPayable: number;
  payMethod: string;
  attendance: AttendanceSummary;
  trace: TraceStep[];
  warnings: string[];
  errors: string[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Whole months between joining and the given date. */
export function serviceMonths(joining: string, at: string) {
  const [jy, jm, jd] = joining.split("-").map(Number);
  const [ay, am, ad] = at.split("-").map(Number);
  let months = (ay - jy) * 12 + (am - jm);
  if (ad < jd) months -= 1;
  return Math.max(0, months);
}

/** Gross in force on a day: before an increment's effective date, its previous gross applied. */
export function grossOn(date: string, current: Dec, increments: EmployeeInput["increments"]): Dec {
  const later = increments.filter((i) => i.effectiveDate > date).sort((a, b) => a.effectiveDate.localeCompare(b.effectiveDate))[0];
  return later ? later.previousGross : current;
}

const pct = (base: Dec, percent: Dec) => base.mul(percent).div(100);
const plural = (n: number | Dec, word: string) => `${n.toString()} ${word}${Number(n) === 1 ? "" : "s"}`;

// ─── Calculation ──────────────────────────────────────────────────────────────

export function calculateEmployee(e: EmployeeInput, period: PeriodInput, policies: PolicySet): EngineResult {
  const { rules } = policies;
  const trace: TraceStep[] = [];
  const warnings: string[] = [];
  const errors: string[] = [];
  const dayBasis = e.salary.salaryType === "day-basis";
  const step = (kind: TraceStep["kind"], label: string, detail: string, amount?: Dec | null) => trace.push({ kind, label, detail, amount: amount == null ? null : toNum(amount) });

  // 1. Employment window inside the month.
  const start = e.joiningDate > period.fromDate ? e.joiningDate : period.fromDate;
  const end = e.terminationDate && e.terminationDate < period.toDate ? e.terminationDate : period.toDate;
  const employed = e.days.filter((d) => d.date >= start && d.date <= end);
  if (start > period.fromDate) step("i", "Joined in the month", `Joined ${e.joiningDate}; paid from that day.`);
  if (end < period.toDate) step("i", "Left in the month", `Last day ${e.terminationDate}; paid up to that day.`);

  // 2. Gross: the salary in force on each employed day (increments change it mid-month).
  const grossEnd = grossOn(end, e.salary.gross, e.increments);
  const segments = new Map<string, { gross: Dec; days: number }>();
  for (const d of employed) {
    const g = grossOn(d.date, e.salary.gross, e.increments);
    const key = g.toString();
    segments.set(key, { gross: g, days: (segments.get(key)?.days ?? 0) + 1 });
  }
  let earned = ZERO;
  for (const seg of segments.values()) earned = earned.add(dayBasis ? seg.gross.mul(seg.days) : seg.gross.mul(seg.days).div(period.monthDays));
  earned = round(earned);
  if (segments.size > 1) step("i", "Salary changed in the month", [...segments.values()].map((s) => `${fmt(s.gross)} × ${plural(s.days, "day")}`).join(", "));
  step(
    "=",
    "Earned gross",
    dayBasis
      ? `Day-basis: daily rate ${fmt(grossEnd)} × ${plural(employed.length, "employed day")}.`
      : employed.length === period.monthDays && segments.size === 1
        ? `Full month at gross ${fmt(grossEnd)}.`
        : `Gross prorated by the days of the payroll period: ${[...segments.values()].map((s) => `${fmt(s.gross)} × ${s.days}/${period.monthDays}`).join(" + ")}.`,
    earned,
  );

  // 3. Salary components (monthly figures as of the month end).
  let basic: Dec | null = null;
  let houseRent: Dec | null = null;
  let medical: Dec | null = null;
  let transport: Dec | null = null;
  if (dayBasis) {
    step("i", "Components", "Day-basis salary: no Basic / House Rent split.");
  } else if (e.salary.salaryOption !== "gross" && e.salary.basic !== null) {
    const ratio = e.salary.gross.isZero() ? new D(1) : grossEnd.div(e.salary.gross);
    const scale = (v: Dec | null) => (v === null ? null : round(v.mul(ratio)));
    [basic, houseRent, medical, transport] = [scale(e.salary.basic), scale(e.salary.houseRent), scale(e.salary.medical), scale(e.salary.conveyance)];
    step("i", "Components", "From the employee's salary structure (Employee › Salary).");
  } else if (policies.structure) {
    const s = policies.structure;
    [basic, houseRent, medical, transport] = [s.basicPercent, s.houseRentPercent, s.medicalPercent, s.conveyancePercent].map((p) => round(pct(grossEnd, p)));
    step("i", "Components", `Gross split by salary structure "${s.name}": Basic ${s.basicPercent}%, House Rent ${s.houseRentPercent}%, Medical ${s.medicalPercent}%, Conveyance ${s.conveyancePercent}%.`);
  } else {
    // Reported once for the batch (payroll-inputs.ts), not on every line.
    step("i", "Components", "Gross-only salary; no salary structure applies, so it is not split.");
  }

  // 4. Attendance against the assigned calendar.
  const att: AttendanceSummary = {
    periodDays: period.monthDays,
    employedDays: employed.length,
    workingDays: 0,
    presentDays: 0,
    lateCount: 0,
    absentDays: 0,
    unrecordedDays: 0,
    unassignedDays: 0,
    futureDays: 0,
    weeklyOffDays: 0,
    holidayDays: 0,
    leaveDays: {},
    paidLeaveDays: 0,
    unpaidLeaveDays: 0,
    offDaysWorked: 0,
    absentDeductionDays: 0,
    unpaidLeaveDeductionDays: 0,
    lateDeductionDays: 0,
    lateLeaveBalanceDays: 0,
    totalDeductionDays: 0,
  };
  /** Days whose salary is deducted, with the reason: each day at most once. */
  const deductedDays: { date: string; reason: "absent" | "unpaid leave" }[] = [];
  const latesByRule = new Map<string, number>();
  let latesWithoutRule = 0;

  for (const d of employed) {
    if (d.schedule === "weekly-off" || d.schedule === "holiday") {
      if (d.schedule === "weekly-off") att.weeklyOffDays += 1;
      else att.holidayDays += 1;
      if (d.punch) att.offDaysWorked += 1;
      continue;
    }
    if (d.schedule === "working") att.workingDays += 1;
    else att.unassignedDays += 1;

    if (d.leaveType) {
      att.leaveDays[d.leaveType] = (att.leaveDays[d.leaveType] ?? 0) + 1;
      if (rules.unpaidLeaveTypes.includes(d.leaveType.toLowerCase())) {
        att.unpaidLeaveDays += 1;
        deductedDays.push({ date: d.date, reason: "unpaid leave" });
      } else att.paidLeaveDays += 1;
      continue; // A leave day is never also late or absent.
    }
    if (d.punch) {
      if (d.punch.status === "Absent") {
        att.absentDays += 1;
        if (rules.deductAbsentDays) deductedDays.push({ date: d.date, reason: "absent" });
        continue;
      }
      att.presentDays += 1;
      if (d.punch.status === "Late") {
        att.lateCount += 1;
        if (d.lateRuleId) latesByRule.set(d.lateRuleId, (latesByRule.get(d.lateRuleId) ?? 0) + 1);
        else latesWithoutRule += 1;
      }
      continue;
    }
    if (d.future) {
      att.futureDays += 1;
      continue;
    }
    if (d.schedule === "unassigned") continue; // No calendar: nothing says the day was a working day.
    att.unrecordedDays += 1;
    if (rules.deductAbsentDays && rules.deductUnrecordedDays) deductedDays.push({ date: d.date, reason: "absent" });
  }
  att.absentDeductionDays = deductedDays.filter((d) => d.reason === "absent").length;
  att.unpaidLeaveDeductionDays = deductedDays.filter((d) => d.reason === "unpaid leave").length;

  const leaveText = Object.entries(att.leaveDays).map(([type, n]) => `${type} ${n}`).join(", ");
  step(
    "i",
    "Attendance",
    `${plural(att.workingDays, "working day")}, ${att.presentDays} present (${plural(att.lateCount, "late")}), ${att.absentDays} absent, ${att.unrecordedDays} without punch or leave` +
      `${leaveText ? `, leave: ${leaveText}` : ""}, ${att.weeklyOffDays} weekly off, ${att.holidayDays} holidays${att.unassignedDays ? `, ${att.unassignedDays} without calendar` : ""}.`,
  );

  if (att.unassignedDays > 0) warnings.push(`${plural(att.unassignedDays, "day")} without an assigned calendar: paid, and absences on them not checked.`);
  if (att.futureDays > 0) warnings.push(`The month is not over: ${plural(att.futureDays, "future working day")} paid as scheduled.`);
  if (att.unrecordedDays > 0 && !(rules.deductAbsentDays && rules.deductUnrecordedDays))
    warnings.push(`${plural(att.unrecordedDays, "working day")} without punch or approved leave: not deducted (no Payroll Rule treats them as absent).`);
  if (att.absentDays > 0 && !rules.deductAbsentDays) warnings.push(`${plural(att.absentDays, "absent day")} not deducted: no Payroll Rule deducts absent days.`);
  if (latesWithoutRule > 0) warnings.push(`${plural(latesWithoutRule, "late")} on days without a Late Punishment rule: not penalised.`);

  // 5. Late punishment, per rule in force (3 lates = 1 day …).
  let lateSalaryDays = ZERO;
  for (const [ruleId, count] of latesByRule) {
    const rule = policies.lateRules.get(ruleId);
    if (!rule) continue;
    const days = new D(Math.floor(count / rule.latesAllowed)).mul(rule.deductionDays);
    if (days.isZero()) {
      step("i", "Late punishment", `${plural(count, "late")}; ${rule.latesAllowed} lates = ${rule.deductionDays} day: no deduction.`);
      continue;
    }
    if (rule.deductFrom === "Salary") {
      lateSalaryDays = lateSalaryDays.add(days);
      step("i", "Late punishment", `${plural(count, "late")} ÷ ${rule.latesAllowed} = ${Math.floor(count / rule.latesAllowed)} × ${rule.deductionDays} = ${plural(days, "day")} of salary.`);
    } else {
      att.lateLeaveBalanceDays += days.toNumber();
      step("i", "Late punishment", `${plural(count, "late")}: ${plural(days, "day")} to take from the leave balance (not from salary).`);
      warnings.push(`${plural(days, "late deduction day")} is to be taken from the leave balance; payroll does not change leave balances.`);
    }
  }
  att.lateDeductionDays = lateSalaryDays.toNumber();

  // 6. Daily rate and attendance deduction.
  const workingInMonth = e.days.filter((d) => d.schedule === "working").length;
  const unassignedInMonth = e.days.filter((d) => d.schedule === "unassigned").length;
  const basisDays = rules.dayRateBasis === "30 days" ? 30 : rules.dayRateBasis === "Assigned working days" ? workingInMonth : period.monthDays;
  const totalDeductionDays = new D(deductedDays.length).add(lateSalaryDays);
  let attendanceDeduction = ZERO;
  if (totalDeductionDays.gt(0)) {
    if (!dayBasis && rules.dayRateBasis === "Assigned working days" && (unassignedInMonth > 0 || workingInMonth === 0)) {
      errors.push("The Payroll Rule rates a day by assigned working days, but this month's calendar is not fully assigned.");
    } else {
      const rateOn = (date: string) => (dayBasis ? grossOn(date, e.salary.gross, e.increments) : grossOn(date, e.salary.gross, e.increments).div(basisDays));
      for (const d of deductedDays) attendanceDeduction = attendanceDeduction.add(rateOn(d.date));
      attendanceDeduction = attendanceDeduction.add(lateSalaryDays.mul(rateOn(end)));
      attendanceDeduction = round(attendanceDeduction);
      if (attendanceDeduction.gt(earned)) {
        attendanceDeduction = earned;
        warnings.push("Attendance deductions were more than the earned gross; capped at the earned gross.");
      }
      step(
        "-",
        "Attendance deduction",
        `${plural(totalDeductionDays, "day")} (${att.absentDeductionDays} absent, ${att.unpaidLeaveDeductionDays} unpaid leave, ${att.lateDeductionDays} late) × daily rate ` +
          (dayBasis ? `(day-basis rate)` : `${fmt(rateOn(end))} (gross ÷ ${basisDays}, ${rules.dayRateBasis.toLowerCase()})`) +
          ".",
        attendanceDeduction,
      );
    }
  }
  att.totalDeductionDays = totalDeductionDays.toNumber();

  // 7. Allowances (earnings) and adjustments.
  const components: Partial<Record<ComponentCode, number>> = {};
  const employedShare = dayBasis || grossEnd.isZero() ? new D(1) : earned.div(grossEnd);
  let allowanceTotal = ZERO;
  for (const a of e.allowances) {
    const base = a.calculation === "% of Basic" ? basic : a.calculation === "% of Gross" ? grossEnd : null;
    if (a.calculation !== "Fixed Amount" && base === null) {
      errors.push(`Allowance "${a.name}" is a percentage of Basic, but this salary has no Basic.`);
      continue;
    }
    const monthly = a.calculation === "Fixed Amount" ? a.value : pct(base!, a.value);
    let amount: Dec;
    if (a.monthly) amount = round(monthly.mul(employedShare));
    else if (a.fromDate >= period.fromDate && a.fromDate <= period.toDate) amount = round(monthly);
    else continue;
    allowanceTotal = allowanceTotal.add(amount);
    if (a.code) components[a.code] = toNum(new D(components[a.code] ?? 0).add(amount));
    step("+", `Allowance: ${a.name}${a.code ? ` (${a.code})` : ""}`, `${a.calculation === "Fixed Amount" ? fmt(a.value) : `${a.value}% of ${a.calculation.slice(5)} ${fmt(base!)}`}${a.monthly ? (employedShare.lt(1) ? ", prorated to the days employed" : ", monthly") : ", one-off"}.`, amount);
  }
  const adjAdd = round(e.adjustments.filter((a) => a.type === "addition").reduce((t, a) => t.add(a.amount), ZERO));
  const adjDed = round(e.adjustments.filter((a) => a.type === "deduction").reduce((t, a) => t.add(a.amount), ZERO));
  if (adjAdd.gt(0)) step("+", "Salary additions", "Employee › Salary adjustments for the month.", adjAdd);
  const additions = round(allowanceTotal.add(adjAdd));

  // 8. Provident fund (PFD).
  let pf = ZERO;
  if (e.salary.eligiblePF) {
    const rule = policies.pf;
    if (!rule) warnings.push("Eligible for PF, but there is no PF Setup rule: PF not deducted.");
    else if (serviceMonths(e.joiningDate, period.toDate) < rule.eligibleAfterMonths) step("i", "Provident fund", `Not yet eligible: PF starts after ${plural(rule.eligibleAfterMonths, "month")} of service.`);
    else {
      const base = rule.basis === "Basic" ? basic : grossEnd;
      if (base === null) errors.push("PF Setup deducts PF on Basic, but this salary has no Basic.");
      else {
        pf = round(pct(base, rule.employeePercent).mul(employedShare));
        components[PF_CODE] = toNum(pf);
        step("-", "Provident fund (PFD)", `${rule.employeePercent}% of ${rule.basis} ${fmt(base)}${employedShare.lt(1) ? ", prorated to the days employed" : ""}.`, pf);
      }
    }
  }
  if (adjDed.gt(0)) step("-", "Salary deductions", "Employee › Salary adjustments for the month.", adjDed);
  const otherDeduction = round(pf.add(adjDed));

  // 9. Net payable.
  const totalDeduction = round(attendanceDeduction.add(otherDeduction));
  let net = round(earned.add(additions).sub(totalDeduction));
  if (net.lt(0)) {
    errors.push(`Deductions (${fmt(totalDeduction)}) are more than the earnings (${fmt(earned.add(additions))}).`);
    net = ZERO;
  }
  let payMethod = e.salary.disbursementMode || "cash";
  if (e.holdSalary) {
    step("i", "Salary on hold", "Employee › Hold Salary is ticked: calculated, but nothing is paid.");
    payMethod = "hold";
    net = ZERO;
  }
  step("=", "Net payable", `Earned gross ${fmt(earned)} + additions ${fmt(additions)} − deductions ${fmt(totalDeduction)}${e.holdSalary ? " (held: 0.00)" : ""}.`, net);

  return {
    grossSalary: toNum(grossEnd),
    basic: basic === null ? null : toNum(basic),
    houseRent: houseRent === null ? null : toNum(houseRent),
    medical: medical === null ? null : toNum(medical),
    transport: transport === null ? null : toNum(transport),
    components,
    allowanceTotal: toNum(allowanceTotal),
    earnedGross: toNum(earned),
    additions: toNum(additions),
    attendanceDeduction: toNum(attendanceDeduction),
    otherDeduction: toNum(otherDeduction),
    totalDeduction: toNum(totalDeduction),
    netPayable: toNum(net),
    payMethod,
    attendance: att,
    trace,
    warnings,
    errors,
  };
}

/** Totals of several lines, added as decimals (never as floats). */
export function sumLines<T>(lines: T[], pick: (line: T) => number | null | undefined): number {
  return toNum(lines.reduce((total, l) => total.add(new D(pick(l) ?? 0)), ZERO));
}

export { COMPONENT_CODES };
