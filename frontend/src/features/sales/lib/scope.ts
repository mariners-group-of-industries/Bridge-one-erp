import { notFound } from "@/lib/api/errors";
import { assertCompanyAccess, type Actor } from "@/lib/auth/actor";
import { db } from "@/lib/prisma/client";

/** Business units the actor may see, narrowed to `businessUnitId` when given. */
export async function scopedBusinessUnitIds(actor: Actor, businessUnitId?: string): Promise<string[]> {
  const units = await db().businessUnit.findMany({
    where: {
      ...(actor.companyScope === "ALL" ? {} : { companyId: { in: [...actor.companyScope] } }),
      ...(businessUnitId ? { id: businessUnitId } : {}),
    },
    select: { id: true },
  });
  if (businessUnitId && units.length === 0) throw notFound("Business unit");
  return units.map((unit) => unit.id);
}

/** The office with its business unit, if the actor may access it (404 otherwise). */
export async function requireOffice(actor: Actor, officeId: string) {
  const office = await db().office.findUnique({
    where: { id: officeId },
    select: { id: true, name: true, businessUnitId: true, businessUnit: { select: { companyId: true } } },
  });
  if (!office) throw notFound("Office");
  assertCompanyAccess(actor, office.businessUnit.companyId, "Office");
  return office;
}

/** Throws 404 unless the actor may access the business unit. */
export async function requireBusinessUnit(actor: Actor, businessUnitId: string): Promise<void> {
  const unit = await db().businessUnit.findUnique({ where: { id: businessUnitId }, select: { companyId: true } });
  if (!unit) throw notFound("Business unit");
  assertCompanyAccess(actor, unit.companyId, "Business unit");
}
