import type { Prisma } from "@/generated/prisma/client";
import { AppError } from "@/lib/api/errors";
import { can, type Actor } from "@/lib/auth/actor";
import { db } from "@/lib/prisma/client";

/** HR administration pages; each API call is also checked for its own page and action. */
export const HR_ADMIN_PAGES = [
  "/hrm/attendance",
  "/hrm/calendar-assign",
  "/hrm/overtime",
  "/hrm/payroll",
  "/hrm/compensation/salary-disbursement",
  "/hrm/compensation/bonus",
  "/hrm/talent/increment",
  "/hrm/governance/pending-approval",
  "/hrm/governance/settings",
] as const;

/**
 * Payroll, bonus, increment and HR governance show every employee's salary, so
 * they are for HR: the master account, or users granted one of the HR admin pages.
 */
export function requireHr(actor: Actor) {
  if (!actor.isMaster && !HR_ADMIN_PAGES.some((page) => can(actor, page))) throw new AppError(403, "FORBIDDEN", "Only HR can open payroll and HR administration.");
}

export const officeScope = (actor: Actor): Prisma.OfficeWhereInput => (actor.companyScope === "ALL" ? {} : { businessUnit: { companyId: { in: [...actor.companyScope] } } });

export const employeeScope = (actor: Actor): Prisma.EmployeeWhereInput => (actor.companyScope === "ALL" ? {} : { office: officeScope(actor) });

export interface HrOptions {
  offices: { id: string; name: string; businessUnit: string }[];
}

export async function hrOptions(actor: Actor): Promise<HrOptions> {
  requireHr(actor);
  const offices = await db().office.findMany({ where: officeScope(actor), orderBy: { name: "asc" }, select: { id: true, name: true, businessUnit: { select: { name: true } } } });
  return { offices: offices.map((o) => ({ id: o.id, name: o.name, businessUnit: o.businessUnit.name })) };
}

/** Offices the actor may see, optionally narrowed to one. */
export async function scopedOffices(actor: Actor, officeId?: string) {
  return db().office.findMany({
    where: { ...officeScope(actor), ...(officeId ? { id: officeId } : {}) },
    orderBy: { name: "asc" },
    select: { id: true, name: true, businessUnit: { select: { name: true } } },
  });
}

export const money = (value: number) => Math.round(value * 100) / 100;
export const num = (value: Prisma.Decimal | number | null | undefined) => (value == null ? 0 : Number(value));
export const isoDate = (value: Date) => value.toISOString().slice(0, 10);
export const toDate = (iso: string) => new Date(`${iso}T00:00:00Z`);
export const decisionBy = (actor: Actor) => (actor.name ?? "Administrator").slice(0, 150);
