import { conflict, inUse } from "@/lib/api/errors";
import type { Actor } from "@/lib/auth/actor";
import { db, type Prisma } from "@/lib/prisma/client";
import type { BusinessUnitInput } from "../schemas/business-unit.schema";
import type { BusinessUnitDto } from "../types";
import { findActorCompany, loadBusinessUnit, requireActorCompany, sameName } from "./access";

type BusinessUnitRow = Prisma.BusinessUnitGetPayload<{
  include: { _count: { select: { offices: true } } };
}>;

function toDto(unit: BusinessUnitRow): BusinessUnitDto {
  return {
    id: unit.id,
    companyId: unit.companyId,
    name: unit.name,
    address: unit.address,
    contactNumber: unit.contactNumber,
    email: unit.email,
    dateFormat: unit.dateFormat,
    officeCount: unit._count.offices,
    updatedAt: unit.updatedAt.toISOString(),
  };
}

const withCounts = { _count: { select: { offices: true } } } as const;

async function assertUniqueName(
  tx: Prisma.TransactionClient,
  companyId: string,
  name: string,
  excludeId?: string,
) {
  const duplicate = await tx.businessUnit.findFirst({
    where: { companyId, name: sameName(name), NOT: excludeId ? { id: excludeId } : undefined },
    select: { id: true },
  });
  if (duplicate) throw conflict(`A business unit named "${name}" already exists.`);
}

export async function listBusinessUnits(actor: Actor): Promise<BusinessUnitDto[]> {
  const company = await findActorCompany(actor);
  if (!company) return [];
  const units = await db().businessUnit.findMany({
    where: { companyId: company.id },
    include: withCounts,
    orderBy: { name: "asc" },
  });
  return units.map(toDto);
}

export async function createBusinessUnit(
  actor: Actor,
  input: BusinessUnitInput,
): Promise<BusinessUnitDto> {
  const unit = await db().$transaction(async (tx) => {
    const company = await requireActorCompany(actor, tx);
    await assertUniqueName(tx, company.id, input.name);
    return tx.businessUnit.create({
      data: { ...input, companyId: company.id },
      include: withCounts,
    });
  });
  return toDto(unit);
}

export async function updateBusinessUnit(
  actor: Actor,
  id: string,
  input: BusinessUnitInput,
): Promise<BusinessUnitDto> {
  const unit = await db().$transaction(async (tx) => {
    const existing = await loadBusinessUnit(actor, id, tx);
    await assertUniqueName(tx, existing.companyId, input.name, id);
    return tx.businessUnit.update({ where: { id }, data: input, include: withCounts });
  });
  return toDto(unit);
}

/**
 * Deletes a business unit. Blocked while it still has offices; its terms &
 * conditions are configuration owned by the unit and are removed with it.
 */
export async function deleteBusinessUnit(actor: Actor, id: string): Promise<void> {
  await db().$transaction(async (tx) => {
    await loadBusinessUnit(actor, id, tx);
    const offices = await tx.office.count({ where: { businessUnitId: id } });
    if (offices > 0) {
      throw inUse(
        `This business unit still has ${offices} office(s). Remove them before deleting the business unit.`,
        { offices },
      );
    }
    await tx.termsCondition.deleteMany({ where: { businessUnitId: id } });
    await tx.businessUnit.delete({ where: { id } });
  });
}
