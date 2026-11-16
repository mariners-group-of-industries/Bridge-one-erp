import { createHash } from "node:crypto";
import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/prisma/client";
import { attendanceRules, dayKey, ruleFor, statusOf, TIME_ZONE } from "@/features/hrm/attendance/services/attendance.service";
import { PAYROLL_DAY_RATE_BASES, PAYROLL_PERIOD_MONTHS, WEEKDAYS } from "@/features/hrm/governance/policy-fields";
import { COMPONENT_CODES, PF_CODE, type ComponentCode, type ExcludedEmployee, type PolicyUse } from "../batch-types";
import { DEFAULT_PAYROLL_RULES, payrollPeriod, type AllowanceInput, type DayFact, type EmployeeInput, type LateRule, type PayrollRules, type PeriodInput, type PfRule, type PolicySet, type SalaryStructure } from "./engine";
import { grossOf, monthRange } from "./payroll.service";

/**
 * Loads everything the payroll engine needs for one office and month from the
 * modules that own it: Employee Master Data (salary, increments, adjustments),
 * Calendar Assign / Roster / Employee Assign / Off Day / Holidays, device punches
 * rated by the attendance rule, approved leave, and the HR Governance policies.
 */

const D = Prisma.Decimal;
const DAY_MS = 86_400_000;
const iso = (d: Date) => d.toISOString().slice(0, 10);
const dec = (value: unknown) => {
  const n = typeof value === "number" ? value : typeof value === "string" && value.trim() !== "" ? Number(value) : NaN;
  return Number.isFinite(n) ? new D(n) : new D(0);
};
const weekdayOf = (date: string) => WEEKDAYS[(new Date(`${date}T00:00:00Z`).getUTCDay() + 1) % 7];
const hhmm = new Intl.DateTimeFormat("en-GB", { timeZone: TIME_ZONE, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

type PolicyRow = { id: string; tab: string; officeId: string | null; employeeId: string | null; effectiveFrom: Date | null; effectiveTo: Date | null; data: Prisma.JsonValue; updatedAt: Date };
const data = (r: PolicyRow) => (r.data ?? {}) as Record<string, unknown>;
const from = (r: PolicyRow) => (r.effectiveFrom ? iso(r.effectiveFrom) : "");
const to = (r: PolicyRow) => (r.effectiveTo ? iso(r.effectiveTo) : null);
const inForceOn = (r: PolicyRow, date: string) => from(r) <= date && (!to(r) || to(r)! >= date);

/** The office's own record in force on the day, else the all-office one (latest effective date first). */
function officeRecord(records: PolicyRow[], tab: string, officeId: string, date: string): PolicyRow | null {
  const live = records.filter((r) => r.tab === tab && !r.employeeId && inForceOn(r, date)).sort((a, b) => from(b).localeCompare(from(a)));
  return live.find((r) => r.officeId === officeId) ?? live.find((r) => r.officeId === null) ?? null;
}

const TAB_LABELS: Record<string, string> = {
  "attendance-process": "Atten Process",
  "late-punishment": "Late Punishment",
  "payroll-rules": "Payroll Rules",
  salary: "Salary structure",
  "pf-setup": "PF Setup",
  "off-day": "Off Day",
  holidays: "Holidays",
  allowance: "Allowance",
};

function payrollRules(r: PolicyRow | null): PayrollRules {
  if (!r) return DEFAULT_PAYROLL_RULES;
  const d = data(r);
  const basis = PAYROLL_DAY_RATE_BASES.find((b) => b === d.dayRateBasis) ?? DEFAULT_PAYROLL_RULES.dayRateBasis;
  const unpaid =
    typeof d.unpaidLeaveTypes === "string" && d.unpaidLeaveTypes.trim()
      ? d.unpaidLeaveTypes
          .split(",")
          .map((s) => s.trim().toLowerCase())
          .filter(Boolean)
      : DEFAULT_PAYROLL_RULES.unpaidLeaveTypes;
  const startDay = Number(d.periodStartDay);
  return {
    id: r.id,
    dayRateBasis: basis,
    deductAbsentDays: d.deductAbsentDays === true,
    deductUnrecordedDays: d.deductUnrecordedDays === true,
    unpaidLeaveTypes: unpaid,
    periodStartDay: Number.isInteger(startDay) && startDay >= 1 && startDay <= 28 ? startDay : DEFAULT_PAYROLL_RULES.periodStartDay,
    periodMonth: d.periodMonth === PAYROLL_PERIOD_MONTHS[1] ? "end" : DEFAULT_PAYROLL_RULES.periodMonth,
  };
}

function lateRule(r: PolicyRow): LateRule | null {
  const d = data(r);
  const allowed = Number(d.latesAllowed);
  if (!Number.isInteger(allowed) || allowed < 1) return null;
  return { id: r.id, latesAllowed: allowed, deductionDays: dec(d.deductionDays), deductFrom: d.deductFrom === "Leave Balance" ? "Leave Balance" : "Salary" };
}

const componentCode = (shortCode: unknown, name: unknown): ComponentCode | null => {
  for (const value of [shortCode, name]) {
    const code = typeof value === "string" ? value.trim().toUpperCase() : "";
    const hit = COMPONENT_CODES.find((c) => c === code && c !== PF_CODE);
    if (hit) return hit;
  }
  return null;
};

export interface LoadedPayroll {
  office: { id: string; name: string; businessUnitId: string; businessUnit: string };
  period: PeriodInput;
  employees: (EmployeeInput & { hash: string; bankOrProvider: string | null; accountNo: string | null })[];
  excluded: ExcludedEmployee[];
  eligibleCount: number;
  policies: PolicySet;
  policyUses: PolicyUse[];
  notices: string[];
  /** Hash of every input; changes when salary, attendance, calendar or policy data changes. */
  sourceHash: string;
}

const sha = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");

/** Loads one office's payroll inputs for the month. `employeeScope` keeps it inside the actor's companies. */
export async function loadPayrollInputs(officeId: string, month: string, employeeWhere: Prisma.EmployeeWhereInput = {}): Promise<LoadedPayroll | null> {
  const office = await db().office.findFirst({ where: { id: officeId }, select: { id: true, name: true, businessUnitId: true, businessUnit: { select: { name: true } } } });
  if (!office) return null;
  // The Payroll Rule in force at the end of the named month decides the period (21st – 20th unless it says otherwise).
  const calendarEnd = iso(monthRange(month).to);
  const ruleRows = await db().hrPolicyRecord.findMany({
    where: { tab: "payroll-rules", OR: [{ officeId: null }, { officeId }] },
    select: { id: true, tab: true, officeId: true, employeeId: true, effectiveFrom: true, effectiveTo: true, data: true, updatedAt: true },
    orderBy: { id: "asc" },
  });
  const rulesRow = officeRecord(ruleRows, "payroll-rules", officeId, calendarEnd);
  const rules = payrollRules(rulesRow);
  const period = payrollPeriod(month, rules.periodStartDay, rules.periodMonth);
  const { fromDate, toDate } = period;
  const range = { from: new Date(`${fromDate}T00:00:00Z`), to: new Date(`${toDate}T00:00:00Z`), monthDays: period.monthDays };
  const dates = Array.from({ length: range.monthDays }, (_, i) => iso(new Date(range.from.getTime() + i * DAY_MS)));
  const today = dayKey.format(new Date());

  const people = await db().employee.findMany({
    where: {
      ...employeeWhere,
      officeId,
      joiningDate: { lte: range.to },
      OR: [{ terminationDate: null, isActive: true }, { terminationDate: { gte: range.from } }],
    },
    orderBy: { employeeCode: "asc" },
    include: {
      salary: true,
      adjustments: { where: { fromMonth: { lte: month }, toMonth: { gte: month } }, orderBy: { createdAt: "asc" } },
      salaryIncrements: { where: { status: "Approved" }, select: { id: true, effectiveDate: true, previousGross: true, newGross: true }, orderBy: { effectiveDate: "asc" } },
    },
  });
  const ids = people.map((p) => p.id);

  const [policyRows, calendarDays, punches, leaves, attendance] = await Promise.all([
    db().hrPolicyRecord.findMany({
      where: {
        tab: { in: ["late-punishment", "salary", "pf-setup", "off-day", "holidays", "allowance", "allowance-setup", "roster", "employee-assign"] },
        AND: [
          { OR: [{ officeId: null }, { officeId }] },
          { OR: [{ employeeId: null }, { employeeId: { in: ids } }] },
          { OR: [{ effectiveFrom: null }, { effectiveFrom: { lte: range.to } }] },
          { OR: [{ effectiveTo: null }, { effectiveTo: { gte: range.from } }] },
        ],
      },
      select: { id: true, tab: true, officeId: true, employeeId: true, effectiveFrom: true, effectiveTo: true, data: true, updatedAt: true },
      orderBy: { id: "asc" },
    }),
    db().employeeCalendarDay.findMany({ where: { employeeId: { in: ids }, date: { gte: range.from, lte: range.to } }, select: { employeeId: true, date: true, shortCode: true } }),
    // A day either side covers the time-zone offset; rows are then filtered by local day.
    db().attendancePunch.findMany({
      where: { employeeId: { in: ids }, punchTime: { gte: new Date(range.from.getTime() - DAY_MS), lt: new Date(range.to.getTime() + 2 * DAY_MS) } },
      orderBy: { punchTime: "asc" },
      select: { employeeId: true, punchTime: true },
    }),
    db().leaveApplication.findMany({
      where: { employeeId: { in: ids }, status: "Approved", fromDate: { lte: range.to }, toDate: { gte: range.from } },
      select: { id: true, employeeId: true, leaveType: true, fromDate: true, toDate: true, updatedAt: true },
    }),
    attendanceRules(toDate),
  ]);

  // ── Office-level policies ──
  const used = new Map<string, PolicyRow>();
  const track = (r: PolicyRow | null) => {
    if (r) used.set(r.id, r);
    return r;
  };
  track(rulesRow);
  const structureRow = track(officeRecord(policyRows, "salary", officeId, toDate));
  const pfRow = track(officeRecord(policyRows, "pf-setup", officeId, toDate));
  const structure: SalaryStructure | null = structureRow
    ? {
        id: structureRow.id,
        name: String(data(structureRow).name ?? "Salary structure"),
        basicPercent: dec(data(structureRow).basicPercent),
        houseRentPercent: dec(data(structureRow).houseRentPercent),
        medicalPercent: dec(data(structureRow).medicalPercent),
        conveyancePercent: dec(data(structureRow).conveyancePercent),
      }
    : null;
  const pf: PfRule | null = pfRow
    ? { id: pfRow.id, basis: data(pfRow).basis === "Gross" ? "Gross" : "Basic", employeePercent: dec(data(pfRow).employeePercent), eligibleAfterMonths: Number(data(pfRow).eligibleAfterMonths) || 0 }
    : null;

  const lateRules = new Map<string, LateRule>();
  const lateRuleOn = new Map<string, string | null>();
  const offDaysOn = new Map<string, string[]>();
  for (const date of dates) {
    const late = officeRecord(policyRows, "late-punishment", officeId, date);
    const parsed = late ? lateRule(late) : null;
    if (parsed) {
      lateRules.set(parsed.id, parsed);
      track(late);
    }
    lateRuleOn.set(date, parsed?.id ?? null);
    const off = track(officeRecord(policyRows, "off-day", officeId, date));
    offDaysOn.set(date, off && Array.isArray(data(off).days) ? (data(off).days as string[]) : []);
  }

  // Holiday groups of the year: the office's own and the all-office ones.
  // The period can cross a year end (21 Dec – 20 Jan).
  const years = new Set([Number(fromDate.slice(0, 4)), Number(toDate.slice(0, 4))]);
  const groups = policyRows
    .filter((r) => r.tab === "holidays" && years.has(Number(data(r).year)))
    .map((r) => ({
      row: r,
      name: String(data(r).name ?? ""),
      days: new Map(((Array.isArray(data(r).holidays) ? data(r).holidays : []) as Record<string, string>[]).filter((l) => l.date).map((l) => [l.date, `${l.title} (${l.holidayType})`])),
    }));
  const officeHolidays = new Map<string, string>();
  for (const g of groups) for (const [d, title] of g.days) if (!officeHolidays.has(d)) officeHolidays.set(d, title);

  // ── Per employee ──
  const codeOf = new Map(calendarDays.map((c) => [`${c.employeeId}:${iso(c.date)}`, c.shortCode]));
  const firstPunch = new Map<string, Date>();
  for (const p of punches) {
    if (!p.employeeId) continue;
    const day = dayKey.format(p.punchTime);
    const key = `${p.employeeId}:${day}`;
    if (!firstPunch.has(key)) firstPunch.set(key, p.punchTime);
  }
  const leaveOn = new Map<string, string>();
  for (const l of leaves) for (let t = l.fromDate.getTime(); t <= l.toDate.getTime(); t += DAY_MS) leaveOn.set(`${l.employeeId}:${iso(new Date(t))}`, l.leaveType);

  const allowanceTypes = policyRows.filter((r) => r.tab === "allowance");
  const employees: LoadedPayroll["employees"] = [];
  const excluded: ExcludedEmployee[] = [];

  for (const p of people) {
    const gross = grossOf(p.salary);
    if (!p.salary || gross <= 0) {
      excluded.push({ employeeId: p.id, employeeCode: p.employeeCode, employeeName: p.name, reason: "No salary set (Employee › Salary)." });
      continue;
    }
    const own = policyRows.filter((r) => r.employeeId === p.id);
    const periodCalendar = (date: string) =>
      own
        .filter((r) => (r.tab === "roster" || r.tab === "employee-assign") && inForceOn(r, date) && typeof data(r).calendar === "string" && data(r).calendar)
        .sort((a, b) => (a.tab === b.tab ? from(b).localeCompare(from(a)) : a.tab === "roster" ? -1 : 1))[0] ?? null;

    const days: DayFact[] = dates.map((date) => {
      const key = `${p.id}:${date}`;
      const code = codeOf.get(key);
      const punchAt = firstPunch.get(key);
      const punch = punchAt ? { status: statusOf(punchAt, ruleFor(attendance, p.officeId, date)), time: hhmm.format(punchAt) } : null;
      const base = { date, punch, leaveType: leaveOn.get(key) ?? null, lateRuleId: lateRuleOn.get(date) ?? null, future: date > today };
      if (code) {
        if (code === "OFF") return { ...base, schedule: "weekly-off", source: "Calendar Assign: OFF" };
        if (code === "HOL") return { ...base, schedule: "holiday", source: "Calendar Assign: HOL" };
        return { ...base, schedule: "working", source: `Calendar Assign: ${code}` };
      }
      const assigned = periodCalendar(date);
      const groupName = assigned?.tab === "employee-assign" && typeof data(assigned).holidayGroup === "string" ? String(data(assigned).holidayGroup) : "";
      const holiday = groupName ? groups.find((g) => g.name === groupName)?.days.get(date) : officeHolidays.get(date);
      const isOff = offDaysOn.get(date)?.includes(weekdayOf(date)) ?? false;
      if (holiday) return { ...base, schedule: "holiday", source: `Holiday: ${holiday}` };
      if (isOff) return { ...base, schedule: "weekly-off", source: "Off Day policy" };
      if (assigned) return { ...base, schedule: "working", source: `${assigned.tab === "roster" ? "Roster" : "Employee Assign"}: ${String(data(assigned).calendar)}` };
      return { ...base, schedule: "unassigned", source: "No calendar assigned" };
    });

    const allowances: AllowanceInput[] = own
      .filter((r) => r.tab === "allowance-setup")
      .flatMap((r) => {
        const type = allowanceTypes.find((t) => data(t).name === data(r).allowance);
        if (!type) return [];
        const calc = data(type).calculation;
        return [
          {
            code: componentCode(data(type).shortCode, data(type).name),
            name: String(data(type).name),
            calculation: calc === "% of Basic" || calc === "% of Gross" ? calc : "Fixed Amount",
            value: dec(data(r).amount),
            monthly: data(type).monthly === true,
            fromDate: from(r),
          } satisfies AllowanceInput,
        ];
      });

    const s = p.salary;
    const input: EmployeeInput = {
      id: p.id,
      code: p.employeeCode,
      name: p.name,
      joiningDate: iso(p.joiningDate),
      terminationDate: p.terminationDate ? iso(p.terminationDate) : null,
      designation: p.designation,
      department: p.department,
      holdSalary: p.holdSalary,
      salary: {
        salaryType: s.salaryType,
        salaryOption: s.salaryOption,
        gross: new D(gross),
        basic: s.sgBasic ?? s.structBasic ?? null,
        houseRent: s.sgHouseRent,
        medical: s.sgMedical,
        conveyance: s.sgConveyance,
        eligiblePF: s.eligiblePF,
        disbursementMode: s.disbursementMode,
        bankOrProvider: s.disbursementMode === "bank" ? s.bankName : s.disbursementMode === "mfs" ? s.mfsProvider : null,
        accountNo: s.disbursementMode === "bank" ? s.bankAccountNo : s.disbursementMode === "mfs" ? s.mfsNumber : null,
      },
      increments: p.salaryIncrements.map((i) => ({ effectiveDate: iso(i.effectiveDate), previousGross: i.previousGross })),
      adjustments: p.adjustments.map((a) => ({ type: a.type === "deduction" ? "deduction" : "addition", amount: a.amount })),
      allowances,
      days,
    };
    for (const r of own) used.set(r.id, r);
    for (const a of allowances) {
      const type = allowanceTypes.find((t) => data(t).name === a.name);
      if (type) used.set(type.id, type);
    }
    const hash = sha({ input, salaryUpdatedAt: s.updatedAt, rules, structure, pf, lateRules: [...lateRules.values()] });
    employees.push({ ...input, hash, bankOrProvider: input.salary.bankOrProvider, accountNo: input.salary.accountNo });
  }

  // ── Batch-wide notices about missing configuration ──
  const notices: string[] = [];
  if (!rulesRow) notices.push("No Payroll Rule (HR Governance › Settings / Policies › Payroll Rules): the period is the 21st to the 20th of the next month, a day's salary is gross ÷ the days of the period, and absences are not deducted.");
  if (lateRules.size === 0) notices.push("No Late Punishment rule in force this month: lates are not penalised.");
  if (employees.length > 0 && employees.every((e) => e.days.every((d) => d.schedule === "unassigned")))
    notices.push("No employee of this office has a calendar for the month (Calendar Assign, Roster, Employee Assign or Off Day): absences cannot be checked.");
  if (!structure && employees.some((e) => e.salary.salaryOption === "gross" && e.salary.salaryType !== "day-basis"))
    notices.push("No Salary structure (HR Governance › Salary): gross-only salaries are not split into Basic, House Rent, Medical and Transport.");

  const policyUses: PolicyUse[] = [...used.values()]
    .filter((r) => TAB_LABELS[r.tab])
    .map((r) => ({ id: r.id, tab: r.tab, label: `${TAB_LABELS[r.tab]}${r.tab === "allowance" ? `: ${String(data(r).name)}` : ""}${from(r) ? ` (from ${from(r)})` : ""}`, updatedAt: r.updatedAt.toISOString() }))
    .sort((a, b) => a.label.localeCompare(b.label));

  return {
    office: { id: office.id, name: office.name, businessUnitId: office.businessUnitId, businessUnit: office.businessUnit.name },
    period,
    employees,
    excluded,
    eligibleCount: employees.length + excluded.length,
    policies: { rules, structure, pf, lateRules },
    policyUses,
    notices,
    sourceHash: sha({ employees: employees.map((e) => [e.id, e.hash]), excluded: excluded.map((x) => x.employeeId), policies: policyUses.map((u) => [u.id, u.updatedAt]), attendance }),
  };
}
