import type { Prisma } from "@/generated/prisma/client";
import { badRequest, conflict, notFound } from "@/lib/api/errors";
import type { Actor } from "@/lib/auth/actor";
import { db } from "@/lib/prisma/client";
import { grossOf } from "../../payroll/server/payroll.service";
import { decisionBy, employeeScope, isoDate, money, num, officeScope, requireHr, toDate } from "../../shared/hr-access";
import { bonusInputSchema, incrementInputSchema, type ApprovalStatus, type BonusAdviceRow, type BonusInput, type BonusRunRow, type IncrementInput, type IncrementRow } from "../types";

const LIMIT = 500;
const statusWhere = (status?: string) => (status ? { status } : {});

/** Whole months between joining and the given date. */
export function serviceMonths(joining: Date, at: Date) {
  let months = (at.getUTCFullYear() - joining.getUTCFullYear()) * 12 + (at.getUTCMonth() - joining.getUTCMonth());
  if (at.getUTCDate() < joining.getUTCDate()) months -= 1;
  return Math.max(0, months);
}

// ─── Bonus ────────────────────────────────────────────────────────────────────

const bonusScope = (actor: Actor): Prisma.BonusRunWhereInput => (actor.companyScope === "ALL" ? {} : { OR: [{ officeId: null }, { office: officeScope(actor) }] });

export async function listBonusRuns(actor: Actor, status?: string): Promise<BonusRunRow[]> {
  requireHr(actor);
  const runs = await db().bonusRun.findMany({
    where: { ...bonusScope(actor), ...statusWhere(status) },
    orderBy: [{ bonusDate: "desc" }, { createdAt: "desc" }],
    take: LIMIT,
    include: { office: { select: { name: true } } },
  });
  return runs.map((r) => ({
    id: r.id,
    name: r.name,
    officeName: r.office?.name ?? "All offices",
    bonusDate: isoDate(r.bonusDate),
    percentOfGross: num(r.percentOfGross),
    minServiceMonths: r.minServiceMonths,
    employeeCount: r.employeeCount,
    totalAmount: num(r.totalAmount),
    status: r.status as ApprovalStatus,
    createdByName: r.createdByName,
    createdAt: r.createdAt.toISOString(),
    decidedByName: r.decidedByName,
  }));
}

export async function listBonusAdvice(actor: Actor, status?: string): Promise<BonusAdviceRow[]> {
  requireHr(actor);
  const lines = await db().bonusLine.findMany({
    where: { bonusRun: { ...bonusScope(actor), ...statusWhere(status) } },
    orderBy: [{ bonusRun: { bonusDate: "desc" } }, { employeeCode: "asc" }],
    take: 2000,
    include: { bonusRun: { select: { name: true, bonusDate: true, status: true } } },
  });
  return lines.map((l) => ({
    id: l.id,
    bonusName: l.bonusRun.name,
    bonusDate: isoDate(l.bonusRun.bonusDate),
    status: l.bonusRun.status as ApprovalStatus,
    employeeCode: l.employeeCode,
    employeeName: l.employeeName,
    officeName: l.officeName,
    serviceMonths: l.serviceMonths,
    grossSalary: num(l.grossSalary),
    amount: num(l.amount),
  }));
}

/** Generates the bonus for every eligible active employee: gross × percent, if served long enough by the bonus date. */
export async function createBonus(actor: Actor, input: BonusInput): Promise<{ id: string; employeeCount: number }> {
  requireHr(actor);
  const data = bonusInputSchema.parse(input);
  if (data.officeId && !(await db().office.findFirst({ where: { id: data.officeId, ...officeScope(actor) }, select: { id: true } }))) throw notFound("Office");
  const bonusDate = toDate(data.bonusDate);
  const employees = await db().employee.findMany({
    where: { isActive: true, holdSalary: false, joiningDate: { lte: bonusDate }, ...employeeScope(actor), ...(data.officeId ? { officeId: data.officeId } : {}) },
    orderBy: { employeeCode: "asc" },
    include: { salary: true, office: { select: { name: true } } },
  });
  const lines = employees
    .map((e) => ({ e, gross: grossOf(e.salary), months: serviceMonths(e.joiningDate, bonusDate) }))
    .filter(({ gross, months }) => gross > 0 && months >= data.minServiceMonths)
    .map(({ e, gross, months }) => ({
      employeeId: e.id,
      employeeCode: e.employeeCode,
      employeeName: e.name,
      officeName: e.office.name,
      serviceMonths: months,
      grossSalary: money(gross),
      amount: money((gross * data.percentOfGross) / 100),
    }));
  if (lines.length === 0) throw badRequest("No employee is eligible for this bonus (salary set and enough service by the bonus date).");
  const run = await db().bonusRun.create({
    data: {
      name: data.name,
      officeId: data.officeId || null,
      bonusDate,
      percentOfGross: data.percentOfGross,
      minServiceMonths: data.minServiceMonths,
      employeeCount: lines.length,
      totalAmount: money(lines.reduce((total, l) => total + l.amount, 0)),
      createdByName: decisionBy(actor),
      lines: { create: lines },
    },
    select: { id: true },
  });
  return { id: run.id, employeeCount: lines.length };
}

export async function decideBonus(actor: Actor, id: string, status: "Approved" | "Rejected") {
  requireHr(actor);
  if (!(await db().bonusRun.findFirst({ where: { id, ...bonusScope(actor) }, select: { id: true } }))) throw notFound("Bonus");
  const { count } = await db().bonusRun.updateMany({ where: { id, status: "Pending" }, data: { status, decidedByName: decisionBy(actor), decidedAt: new Date() } });
  if (!count) throw conflict("This bonus has already been decided.");
}

export async function deleteBonus(actor: Actor, id: string) {
  requireHr(actor);
  const run = await db().bonusRun.findFirst({ where: { id, ...bonusScope(actor) }, select: { status: true } });
  if (!run) throw notFound("Bonus");
  if (run.status !== "Pending") throw badRequest("Only pending bonuses can be deleted.");
  await db().bonusRun.delete({ where: { id } });
}

// ─── Increment ────────────────────────────────────────────────────────────────

const newGrossOf = (previous: number, type: string, value: number) => money(type === "Percent" ? previous * (1 + value / 100) : previous + value);

export interface IncrementFilter {
  officeId?: string;
  status?: string;
  fromDate?: string;
  toDate?: string;
}

export async function listIncrements(actor: Actor, filter: IncrementFilter = {}): Promise<IncrementRow[]> {
  requireHr(actor);
  const increments = await db().salaryIncrement.findMany({
    where: {
      employee: { ...employeeScope(actor), ...(filter.officeId ? { officeId: filter.officeId } : {}) },
      ...statusWhere(filter.status),
      ...(filter.fromDate || filter.toDate ? { effectiveDate: { ...(filter.fromDate ? { gte: toDate(filter.fromDate) } : {}), ...(filter.toDate ? { lte: toDate(filter.toDate) } : {}) } } : {}),
    },
    orderBy: [{ effectiveDate: "desc" }, { createdAt: "desc" }],
    take: LIMIT,
    include: { employee: { select: { employeeCode: true, name: true, designation: true, office: { select: { name: true } } } } },
  });
  return increments.map((i) => ({
    id: i.id,
    employeeCode: i.employee.employeeCode,
    employeeName: i.employee.name,
    officeName: i.employee.office.name,
    designation: i.employee.designation,
    effectiveDate: isoDate(i.effectiveDate),
    incrementType: i.incrementType,
    value: num(i.value),
    previousGross: num(i.previousGross),
    newGross: num(i.newGross),
    remarks: i.remarks ?? "",
    status: i.status as ApprovalStatus,
    createdByName: i.createdByName,
    decidedByName: i.decidedByName,
  }));
}

export async function createIncrement(actor: Actor, input: IncrementInput): Promise<{ id: string }> {
  requireHr(actor);
  const data = incrementInputSchema.parse(input);
  const employee = await db().employee.findFirst({ where: { id: data.employeeId, ...employeeScope(actor) }, include: { salary: true } });
  if (!employee) throw notFound("Employee");
  const previous = grossOf(employee.salary);
  if (previous <= 0) throw badRequest("This employee has no salary set. Set it in Employee › Salary first.");
  if (await db().salaryIncrement.findFirst({ where: { employeeId: employee.id, status: "Pending" }, select: { id: true } })) {
    throw conflict("This employee already has a pending increment. Approve or reject it first.");
  }
  return db().salaryIncrement.create({
    data: {
      employeeId: employee.id,
      effectiveDate: toDate(data.effectiveDate),
      incrementType: data.incrementType,
      value: data.value,
      previousGross: money(previous),
      newGross: newGrossOf(previous, data.incrementType, data.value),
      remarks: data.remarks || null,
      createdByName: decisionBy(actor),
    },
    select: { id: true },
  });
}

const SALARY_AMOUNTS = ["grossOnly", "structBasic", "structGross", "sgGross", "sgBasic", "sgHouseRent", "sgMedical", "sgConveyance", "sgMobile", "sgFood", "sgExtra"] as const;

/**
 * Approving applies the raise to the employee's salary: every salary amount is
 * scaled by the same ratio, so a structured salary keeps its proportions.
 */
export async function decideIncrement(actor: Actor, id: string, status: "Approved" | "Rejected") {
  requireHr(actor);
  const increment = await db().salaryIncrement.findFirst({ where: { id, employee: employeeScope(actor) }, include: { employee: { include: { salary: true } } } });
  if (!increment) throw notFound("Increment");
  if (increment.status !== "Pending") throw conflict("This increment has already been decided.");
  const decided = { status, decidedByName: decisionBy(actor), decidedAt: new Date() };
  if (status === "Rejected") {
    await db().salaryIncrement.update({ where: { id }, data: decided });
    return;
  }
  const salary = increment.employee.salary;
  const current = grossOf(salary);
  if (!salary || current <= 0) throw badRequest("This employee no longer has a salary set.");
  // The salary may have changed since the increment was raised; apply the same raise to today's figure.
  const newGross = newGrossOf(current, increment.incrementType, num(increment.value));
  const ratio = newGross / current;
  const scaled = Object.fromEntries(SALARY_AMOUNTS.filter((key) => salary[key] != null).map((key) => [key, money(num(salary[key]) * ratio)]));
  await db().$transaction([
    db().employeeSalary.update({ where: { id: salary.id }, data: scaled }),
    db().salaryIncrement.update({ where: { id }, data: { ...decided, previousGross: money(current), newGross } }),
  ]);
}

export async function deleteIncrement(actor: Actor, id: string) {
  requireHr(actor);
  const increment = await db().salaryIncrement.findFirst({ where: { id, employee: employeeScope(actor) }, select: { status: true } });
  if (!increment) throw notFound("Increment");
  if (increment.status !== "Pending") throw badRequest("Only pending increments can be deleted.");
  await db().salaryIncrement.delete({ where: { id } });
}
