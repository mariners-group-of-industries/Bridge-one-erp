import type { Prisma } from "@/generated/prisma/client";
import { badRequest, conflict, notFound } from "@/lib/api/errors";
import type { Actor } from "@/lib/auth/actor";
import { db } from "@/lib/prisma/client";
import { grossOf, monthRange } from "../../payroll/server/payroll.service";
import { decisionBy, isoDate, money, num, officeScope, requireHr, toDate } from "../../shared/hr-access";
import {
  calculateQuerySchema,
  decisionInputSchema,
  entryInputSchema,
  entryListQuerySchema,
  summaryQuerySchema,
  type CalculateQuery,
  type CalculatedDay,
  type CalculationResult,
  type DecisionInput,
  type EntryInput,
  type EntryListQuery,
  type EntryRow,
  type OvertimeRule,
  type OvertimeSource,
  type OvertimeStatus,
  type SummaryQuery,
  type SummaryResult,
  type SummaryRow,
} from "../types";

/** Devices keep local time; days and times are worked out in this time zone. */
const TIME_ZONE = process.env.APP_TIMEZONE || "Asia/Dhaka";
const DAY_MS = 86_400_000;
const dayKey = new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" });
const clock = new Intl.DateTimeFormat("en-GB", { timeZone: TIME_ZONE, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const weekday = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", weekday: "short" });
/** Friday is the weekly off: all time worked that day is overtime. */
const isOffDay = (date: string) => new Date(`${date}T00:00:00Z`).getUTCDay() === 5;

// ─── Rule (HR Settings › Overtime Setup) ─────────────────────────────────────

/**
 * Used when no rule is set up: Bangladesh Labour Act, s.108 — twice the basic
 * hourly rate, the hourly rate being basic ÷ 208 (26 days × 8 hours).
 */
export const DEFAULT_OVERTIME_RULE: OvertimeRule = {
  basis: "Basic",
  multiplier: 2,
  daysPerMonth: 26,
  hoursPerDay: 8,
  minMinutes: 0,
  maxHoursPerDay: null,
  maxHoursPerMonth: null,
  configured: false,
};

const positive = (value: unknown) => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
};

/** The office's own rule in force on `date`, else the all-office one (latest effective date first), else the defaults. */
export async function overtimeRule(officeId: string, date: string): Promise<OvertimeRule> {
  const day = toDate(date);
  const records = await db().hrPolicyRecord.findMany({
    where: {
      tab: "overtime-setup",
      employeeId: null,
      OR: [{ officeId }, { officeId: null }],
      AND: [{ OR: [{ effectiveFrom: null }, { effectiveFrom: { lte: day } }] }, { OR: [{ effectiveTo: null }, { effectiveTo: { gte: day } }] }],
    },
    orderBy: [{ effectiveFrom: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
    select: { officeId: true, data: true },
  });
  const record = records.find((r) => r.officeId === officeId) ?? records.find((r) => r.officeId === null);
  if (!record) return DEFAULT_OVERTIME_RULE;
  const data = (record.data ?? {}) as Record<string, unknown>;
  return {
    basis: data.basis === "Gross" ? "Gross" : "Basic",
    multiplier: positive(data.multiplier) ?? DEFAULT_OVERTIME_RULE.multiplier,
    daysPerMonth: positive(data.daysPerMonth) ?? DEFAULT_OVERTIME_RULE.daysPerMonth,
    hoursPerDay: positive(data.hoursPerDay) ?? DEFAULT_OVERTIME_RULE.hoursPerDay,
    minMinutes: Math.round(positive(data.minMinutes) ?? 0),
    maxHoursPerDay: positive(data.maxHoursPerDay),
    maxHoursPerMonth: positive(data.maxHoursPerMonth),
    configured: true,
  };
}

/** Overtime of one day after the rule: below the minimum is not paid, above the daily maximum is cut. */
export function overtimeOf(workedMinutes: number, offDay: boolean, rule: OvertimeRule): number {
  const raw = offDay ? workedMinutes : workedMinutes - Math.round(rule.hoursPerDay * 60);
  if (raw <= 0 || raw < rule.minMinutes) return 0;
  return rule.maxHoursPerDay ? Math.min(raw, Math.round(rule.maxHoursPerDay * 60)) : raw;
}

// ─── Access ───────────────────────────────────────────────────────────────────

async function requireOffice(actor: Actor, officeId: string) {
  const office = await db().office.findFirst({ where: { id: officeId, ...officeScope(actor) }, select: { id: true, name: true } });
  if (!office) throw notFound("Office");
  return office;
}

const entryScope = (actor: Actor): Prisma.OvertimeEntryWhereInput => (actor.companyScope === "ALL" ? {} : { office: officeScope(actor) });

// ─── Calculation from attendance ─────────────────────────────────────────────

/**
 * Each OT-eligible employee's overtime per day from the device punches: first
 * punch = in, last = out; worked time beyond the standard day (all of it on a
 * Friday) is overtime, after the office's Overtime Setup rule.
 */
export async function calculateOvertime(actor: Actor, input: CalculateQuery): Promise<CalculationResult> {
  requireHr(actor);
  const query = calculateQuerySchema.parse(input);
  await requireOffice(actor, query.officeId);
  const rule = await overtimeRule(query.officeId, query.to);

  // A day either side covers the time-zone offset; rows are then kept by local day.
  const from = new Date(toDate(query.from).getTime() - DAY_MS);
  const to = new Date(toDate(query.to).getTime() + 2 * DAY_MS);
  const [punches, employees, entries] = await Promise.all([
    db().attendancePunch.findMany({
      where: { punchTime: { gte: from, lt: to }, employee: { officeId: query.officeId } },
      orderBy: { punchTime: "asc" },
      select: { employeeId: true, punchTime: true },
    }),
    db().employee.findMany({
      where: { officeId: query.officeId, isActive: true },
      orderBy: { employeeCode: "asc" },
      select: { id: true, employeeCode: true, name: true, designation: true, salary: { select: { eligibleOT: true } } },
    }),
    db().overtimeEntry.findMany({
      where: { officeId: query.officeId, date: { gte: toDate(query.from), lte: toDate(query.to) } },
      select: { id: true, employeeId: true, date: true, status: true, minutes: true },
    }),
  ]);

  const eligible = new Map(employees.filter((e) => e.salary?.eligibleOT).map((e) => [e.id, e]));
  const entryOf = new Map(entries.map((e) => [`${e.employeeId}:${isoDate(e.date)}`, e]));
  const byDay = new Map<string, { employeeId: string; date: string; first: Date; last: Date }>();
  const punchedButNotEligible = new Set<string>();
  for (const punch of punches) {
    if (!punch.employeeId) continue;
    if (!eligible.has(punch.employeeId)) {
      punchedButNotEligible.add(punch.employeeId);
      continue;
    }
    const date = dayKey.format(punch.punchTime);
    if (date < query.from || date > query.to) continue;
    const key = `${punch.employeeId}:${date}`;
    const row = byDay.get(key);
    if (row) row.last = punch.punchTime;
    else byDay.set(key, { employeeId: punch.employeeId, date, first: punch.punchTime, last: punch.punchTime });
  }

  const days: CalculatedDay[] = [...byDay.entries()].map(([key, row]) => {
    const employee = eligible.get(row.employeeId)!;
    const offDay = isOffDay(row.date);
    const hasOut = row.last.getTime() > row.first.getTime();
    const workedMinutes = hasOut ? Math.floor((row.last.getTime() - row.first.getTime()) / 60_000) : 0;
    const entry = entryOf.get(key);
    return {
      employeeId: row.employeeId,
      employeeCode: employee.employeeCode,
      employeeName: employee.name,
      designation: employee.designation ?? "",
      date: row.date,
      day: weekday.format(toDate(row.date)),
      offDay,
      inTime: clock.format(row.first),
      outTime: hasOut ? clock.format(row.last) : null,
      workedMinutes,
      standardMinutes: offDay ? 0 : Math.round(rule.hoursPerDay * 60),
      overtimeMinutes: overtimeOf(workedMinutes, offDay, rule),
      entry: entry ? { id: entry.id, status: entry.status as OvertimeStatus, minutes: entry.minutes } : null,
    };
  });
  days.sort((a, b) => b.date.localeCompare(a.date) || a.employeeCode.localeCompare(b.employeeCode));

  return {
    rule,
    days,
    employees: [...eligible.values()].map((e) => ({ id: e.id, code: e.employeeCode, name: e.name, designation: e.designation ?? "" })),
    notEligible: punchedButNotEligible.size,
  };
}

// ─── Entries ──────────────────────────────────────────────────────────────────

/** Submits overtime for approval. A day that already has overtime cannot be submitted twice. */
export async function createEntries(actor: Actor, input: EntryInput): Promise<{ created: number }> {
  requireHr(actor);
  const { entries } = entryInputSchema.parse(input);
  const keys = entries.map((e) => `${e.employeeId}:${e.date}`);
  if (new Set(keys).size !== keys.length) throw badRequest("The same employee and day is listed twice.");

  const employeeIds = [...new Set(entries.map((e) => e.employeeId))];
  const employees = await db().employee.findMany({
    where: { id: { in: employeeIds }, isActive: true, office: officeScope(actor) },
    select: { id: true, name: true, officeId: true, salary: { select: { eligibleOT: true } } },
  });
  const byId = new Map(employees.map((e) => [e.id, e]));
  for (const id of employeeIds) {
    const employee = byId.get(id);
    if (!employee) throw notFound("Employee");
    if (!employee.salary?.eligibleOT) throw badRequest(`${employee.name} is not eligible for overtime (Employee › Salary).`);
  }

  const existing = await db().overtimeEntry.findMany({
    where: { OR: entries.map((e) => ({ employeeId: e.employeeId, date: toDate(e.date) })) },
    select: { employeeId: true, date: true },
  });
  if (existing.length) {
    const first = existing[0];
    throw conflict(`${byId.get(first.employeeId)?.name ?? "An employee"} already has overtime on ${isoDate(first.date)}.`);
  }

  const createdByName = decisionBy(actor);
  const { count } = await db().overtimeEntry.createMany({
    data: entries.map((e) => ({
      employeeId: e.employeeId,
      officeId: byId.get(e.employeeId)!.officeId,
      date: toDate(e.date),
      minutes: e.minutes,
      source: e.source,
      inTime: e.inTime ?? null,
      outTime: e.outTime ?? null,
      workedMinutes: e.workedMinutes ?? null,
      reason: e.reason || null,
      createdByName,
    })),
    skipDuplicates: true,
  });
  return { created: count };
}

export async function listEntries(actor: Actor, input: EntryListQuery): Promise<EntryRow[]> {
  requireHr(actor);
  const query = entryListQuerySchema.parse(input);
  const rows = await db().overtimeEntry.findMany({
    where: {
      ...entryScope(actor),
      ...(query.officeId ? { officeId: query.officeId } : {}),
      ...(query.status ? { status: query.status } : {}),
      date: { gte: toDate(query.from), lte: toDate(query.to) },
    },
    orderBy: [{ date: "desc" }, { employee: { employeeCode: "asc" } }],
    take: 3000,
    include: { employee: { select: { employeeCode: true, name: true, designation: true } }, office: { select: { name: true } } },
  });
  return rows.map((r) => ({
    id: r.id,
    employeeId: r.employeeId,
    employeeCode: r.employee.employeeCode,
    employeeName: r.employee.name,
    designation: r.employee.designation ?? "",
    officeName: r.office.name,
    date: isoDate(r.date),
    minutes: r.minutes,
    source: r.source as OvertimeSource,
    inTime: r.inTime,
    outTime: r.outTime,
    workedMinutes: r.workedMinutes,
    reason: r.reason,
    status: r.status as OvertimeStatus,
    createdByName: r.createdByName,
    decidedByName: r.decidedByName,
  }));
}

/** Approves or rejects pending entries; entries already decided are left as they are. */
export async function decideEntries(actor: Actor, input: DecisionInput, status: "Approved" | "Rejected"): Promise<{ updated: number }> {
  requireHr(actor);
  const { ids } = decisionInputSchema.parse(input);
  const { count } = await db().overtimeEntry.updateMany({
    where: { id: { in: ids }, status: "Pending", ...entryScope(actor) },
    data: { status, decidedByName: decisionBy(actor), decidedAt: new Date() },
  });
  if (!count) throw conflict("None of the selected entries is pending any more.");
  return { updated: count };
}

export async function deleteEntry(actor: Actor, id: string): Promise<void> {
  requireHr(actor);
  const entry = await db().overtimeEntry.findFirst({ where: { id, ...entryScope(actor) }, select: { status: true } });
  if (!entry) throw notFound("Overtime entry");
  if (entry.status !== "Pending") throw badRequest("Only pending overtime can be deleted.");
  await db().overtimeEntry.delete({ where: { id } });
}

// ─── Monthly summary ─────────────────────────────────────────────────────────

type SalaryRecord = Prisma.EmployeeSalaryGetPayload<object>;

/** Monthly basic salary, when the salary has one. */
export function basicOf(salary: SalaryRecord | null): number {
  if (!salary) return 0;
  const candidates = salary.salaryOption === "structure-basic" ? [salary.structBasic, salary.sgBasic] : [salary.sgBasic, salary.structBasic];
  return num(candidates.find((value) => value != null && Number(value) > 0));
}

/** The month's approved overtime per employee, priced with the office's rule. */
export async function overtimeSummary(actor: Actor, input: SummaryQuery): Promise<SummaryResult> {
  requireHr(actor);
  const query = summaryQuerySchema.parse(input);
  await requireOffice(actor, query.officeId);
  const { from, to } = monthRange(query.month);
  const rule = await overtimeRule(query.officeId, isoDate(to));

  const [approved, pendingCount] = await Promise.all([
    db().overtimeEntry.groupBy({ by: ["employeeId"], where: { officeId: query.officeId, status: "Approved", date: { gte: from, lte: to } }, _sum: { minutes: true } }),
    db().overtimeEntry.count({ where: { officeId: query.officeId, status: "Pending", date: { gte: from, lte: to } } }),
  ]);
  const employees = await db().employee.findMany({
    where: { id: { in: approved.map((a) => a.employeeId) } },
    select: { id: true, employeeCode: true, name: true, designation: true, salary: true },
  });
  const byId = new Map(employees.map((e) => [e.id, e]));
  const monthCap = rule.maxHoursPerMonth ? Math.round(rule.maxHoursPerMonth * 60) : null;

  const rows: SummaryRow[] = approved
    .map((a) => {
      const e = byId.get(a.employeeId)!;
      const gross = grossOf(e.salary);
      const basic = basicOf(e.salary);
      const basicMissing = rule.basis === "Basic" && basic <= 0;
      const rateBasis: "Basic" | "Gross" = rule.basis === "Basic" && !basicMissing ? "Basic" : "Gross";
      const rateSalary = rateBasis === "Basic" ? basic : gross;
      const hourlyRate = rateSalary / rule.daysPerMonth / rule.hoursPerDay;
      const approvedMinutes = a._sum.minutes ?? 0;
      const payableMinutes = monthCap ? Math.min(approvedMinutes, monthCap) : approvedMinutes;
      return {
        employeeId: e.id,
        employeeCode: e.employeeCode,
        employeeName: e.name,
        designation: e.designation ?? "",
        rateSalary: money(rateSalary),
        rateBasis,
        basicMissing,
        hourlyRate: money(hourlyRate),
        approvedMinutes,
        payableMinutes,
        amount: money((payableMinutes / 60) * hourlyRate * rule.multiplier),
      };
    })
    .sort((a, b) => a.employeeCode.localeCompare(b.employeeCode));

  return {
    month: query.month,
    rule,
    rows,
    totals: {
      approvedMinutes: rows.reduce((t, r) => t + r.approvedMinutes, 0),
      payableMinutes: rows.reduce((t, r) => t + r.payableMinutes, 0),
      amount: money(rows.reduce((t, r) => t + r.amount, 0)),
    },
    pendingCount,
  };
}
