import type { Prisma } from "@/generated/prisma/client";
import { badRequest, conflict, notFound } from "@/lib/api/errors";
import type { Actor } from "@/lib/auth/actor";
import { db } from "@/lib/prisma/client";
import { decisionBy, isoDate, money, num, officeScope, requireHr, scopedOffices } from "../../shared/hr-access";
import { monthSchema, type PayrollRow, type SalaryLine, type SalarySheet } from "../types";

const DAY_MS = 86_400_000;

export function monthRange(month: string) {
  monthSchema.parse(month);
  const [year, m] = month.split("-").map(Number);
  const from = new Date(Date.UTC(year, m - 1, 1));
  const to = new Date(Date.UTC(year, m, 0));
  return { from, to, monthDays: to.getUTCDate() };
}

type SalaryRecord = Prisma.EmployeeSalaryGetPayload<object>;

/** Monthly gross from whichever salary option the employee uses. */
export function grossOf(salary: SalaryRecord | null): number {
  if (!salary) return 0;
  const byOption: Record<string, (Prisma.Decimal | null)[]> = {
    gross: [salary.grossOnly],
    "structure-gross": [salary.structGross, salary.sgGross],
    "structure-basic": [salary.sgGross, salary.structGross],
  };
  const candidates = [...(byOption[salary.salaryOption] ?? []), salary.grossOnly, salary.structGross, salary.sgGross];
  return num(candidates.find((value) => value != null && Number(value) > 0));
}

const bankOf = (s: SalaryRecord | null) => {
  if (!s) return { bankOrProvider: null, accountNo: null };
  if (s.disbursementMode === "bank") return { bankOrProvider: s.bankName, accountNo: s.bankAccountNo };
  if (s.disbursementMode === "mfs") return { bankOrProvider: s.mfsProvider, accountNo: s.mfsNumber };
  return { bankOrProvider: null, accountNo: null };
};

/**
 * Live calculation for employees of the given offices: gross prorated by the
 * days employed in the month (joining / termination), plus the month's salary
 * additions, less deductions. Day-basis salaries are a daily rate.
 */
async function calculate(officeIds: string[], month: string): Promise<Map<string, { lines: SalaryLine[]; withoutSalary: number }>> {
  const { from, to, monthDays } = monthRange(month);
  const employees = await db().employee.findMany({
    where: {
      officeId: { in: officeIds },
      joiningDate: { lte: to },
      OR: [{ terminationDate: null, isActive: true }, { terminationDate: { gte: from } }],
    },
    orderBy: { employeeCode: "asc" },
    include: { salary: true, adjustments: { where: { fromMonth: { lte: month }, toMonth: { gte: month } } } },
  });
  const result = new Map(officeIds.map((id) => [id, { lines: [] as SalaryLine[], withoutSalary: 0 }]));
  for (const e of employees) {
    const bucket = result.get(e.officeId)!;
    const gross = grossOf(e.salary);
    if (gross <= 0) {
      bucket.withoutSalary += 1;
      continue;
    }
    const start = e.joiningDate > from ? e.joiningDate : from;
    const end = e.terminationDate && e.terminationDate < to ? e.terminationDate : to;
    const payableDays = Math.max(0, Math.round((end.getTime() - start.getTime()) / DAY_MS) + 1);
    const earned = money(e.salary?.salaryType === "day-basis" ? gross * payableDays : (gross * payableDays) / monthDays);
    const additions = money(e.adjustments.filter((a) => a.type === "addition").reduce((sum, a) => sum + num(a.amount), 0));
    const deductions = money(e.adjustments.filter((a) => a.type === "deduction").reduce((sum, a) => sum + num(a.amount), 0));
    bucket.lines.push({
      employeeId: e.id,
      employeeCode: e.employeeCode,
      employeeName: e.name,
      designation: e.designation,
      monthDays,
      payableDays,
      grossSalary: money(gross),
      earnedSalary: earned,
      additions,
      deductions,
      // Held salaries stay on the sheet but are not paid.
      netAmount: e.holdSalary ? 0 : money(Math.max(0, earned + additions - deductions)),
      disbursementMode: e.holdSalary ? "hold" : (e.salary?.disbursementMode ?? "cash"),
      ...bankOf(e.salary),
    });
  }
  return result;
}

const sum = (lines: SalaryLine[], key: keyof Pick<SalaryLine, "grossSalary" | "earnedSalary" | "additions" | "deductions" | "netAmount">) => money(lines.reduce((total, l) => total + l[key], 0));

// ─── Payroll list ─────────────────────────────────────────────────────────────

export async function listPayroll(actor: Actor, filter: { officeId?: string; month: string }): Promise<PayrollRow[]> {
  requireHr(actor);
  const { from, to } = monthRange(filter.month);
  const offices = await scopedOffices(actor, filter.officeId);
  if (offices.length === 0) return [];
  const [runs, live] = await Promise.all([
    db().payrollRun.findMany({ where: { month: filter.month, officeId: { in: offices.map((o) => o.id) } } }),
    calculate(
      offices.map((o) => o.id),
      filter.month,
    ),
  ]);
  return offices.map((office) => {
    const run = runs.find((r) => r.officeId === office.id);
    const lines = live.get(office.id)?.lines ?? [];
    return {
      officeId: office.id,
      businessUnit: office.businessUnit.name,
      officeName: office.name,
      month: filter.month,
      fromDate: isoDate(run?.fromDate ?? from),
      toDate: isoDate(run?.toDate ?? to),
      employeeCount: run?.employeeCount ?? lines.length,
      netAmount: run ? num(run.netAmount) : sum(lines, "netAmount"),
      status: run ? "Processed" : "Not Processed",
      runId: run?.id ?? null,
      processedByName: run?.processedByName ?? null,
      processedAt: run?.processedAt.toISOString() ?? null,
    };
  });
}

/** The generate sheet / advice for one office and month: the processed snapshot, or a live calculation. */
export async function salarySheet(actor: Actor, officeId: string, month: string): Promise<SalarySheet> {
  requireHr(actor);
  const [office] = await scopedOffices(actor, officeId);
  if (!office) throw notFound("Office");
  const { from, to } = monthRange(month);
  const run = await db().payrollRun.findUnique({ where: { officeId_month: { officeId, month } }, include: { lines: { orderBy: { employeeCode: "asc" } } } });
  let lines: SalaryLine[];
  let withoutSalary = 0;
  if (run) {
    lines = run.lines.map((l) => ({
      employeeId: l.employeeId,
      employeeCode: l.employeeCode,
      employeeName: l.employeeName,
      designation: l.designation,
      monthDays: l.monthDays,
      payableDays: l.payableDays,
      grossSalary: num(l.grossSalary),
      earnedSalary: num(l.earnedSalary),
      additions: num(l.additions),
      deductions: num(l.deductions),
      netAmount: num(l.netAmount),
      disbursementMode: l.disbursementMode,
      bankOrProvider: l.bankOrProvider,
      accountNo: l.accountNo,
    }));
  } else {
    const live = (await calculate([officeId], month)).get(officeId)!;
    lines = live.lines;
    withoutSalary = live.withoutSalary;
  }
  return {
    officeName: office.name,
    businessUnit: office.businessUnit.name,
    month,
    fromDate: isoDate(from),
    toDate: isoDate(to),
    status: run ? "Processed" : "Not Processed",
    lines,
    totals: {
      grossSalary: sum(lines, "grossSalary"),
      earnedSalary: sum(lines, "earnedSalary"),
      additions: sum(lines, "additions"),
      deductions: sum(lines, "deductions"),
      netAmount: sum(lines, "netAmount"),
    },
    withoutSalary,
  };
}

/** Locks the office's payroll for the month; later salary changes no longer alter it. */
export async function processPayroll(actor: Actor, officeId: string, month: string) {
  requireHr(actor);
  const [office] = await scopedOffices(actor, officeId);
  if (!office) throw notFound("Office");
  const { from, to } = monthRange(month);
  if (from > new Date()) throw badRequest("A payroll cannot be processed before its month starts.");
  if (await db().payrollRun.findUnique({ where: { officeId_month: { officeId, month } }, select: { id: true } })) throw conflict("This payroll has already been processed.");
  const { lines } = (await calculate([officeId], month)).get(officeId)!;
  if (lines.length === 0) throw badRequest("No employees with a salary in this office for the month.");
  const run = await db().payrollRun.create({
    data: {
      officeId,
      month,
      fromDate: from,
      toDate: to,
      employeeCount: lines.length,
      grossAmount: sum(lines, "grossSalary"),
      netAmount: sum(lines, "netAmount"),
      processedByName: decisionBy(actor),
      lines: { create: lines },
    },
    select: { id: true },
  });
  return run;
}

/** Undoes processing so the month is calculated live again. */
export async function unprocessPayroll(actor: Actor, runId: string) {
  requireHr(actor);
  const run = await db().payrollRun.findFirst({ where: { id: runId, office: officeScope(actor) }, select: { id: true } });
  if (!run) throw notFound("Payroll");
  await db().payrollRun.delete({ where: { id: runId } });
}
