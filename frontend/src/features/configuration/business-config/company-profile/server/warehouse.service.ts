import { conflict } from "@/lib/api/errors";
import type { Actor } from "@/lib/auth/actor";
import { db, type Prisma } from "@/lib/prisma/client";
import type { WarehouseInput } from "../schemas/office.schema";
import type { WarehouseDto } from "../types";
import { loadOffice, loadWarehouse, sameName } from "./access";

function toDto(warehouse: {
  id: string;
  officeId: string;
  name: string;
  updatedAt: Date;
}): WarehouseDto {
  return {
    id: warehouse.id,
    officeId: warehouse.officeId,
    name: warehouse.name,
    updatedAt: warehouse.updatedAt.toISOString(),
  };
}

async function assertUniqueName(
  tx: Prisma.TransactionClient,
  officeId: string,
  name: string,
  excludeId?: string,
) {
  const duplicate = await tx.warehouse.findFirst({
    where: { officeId, name: sameName(name), NOT: excludeId ? { id: excludeId } : undefined },
    select: { id: true },
  });
  if (duplicate) throw conflict(`A warehouse named "${name}" already exists in this office.`);
}

export async function listWarehouses(actor: Actor, officeId: string): Promise<WarehouseDto[]> {
  await loadOffice(actor, officeId);
  const warehouses = await db().warehouse.findMany({
    where: { officeId },
    orderBy: { createdAt: "asc" },
  });
  return warehouses.map(toDto);
}

export async function createWarehouse(
  actor: Actor,
  officeId: string,
  input: WarehouseInput,
): Promise<WarehouseDto> {
  const warehouse = await db().$transaction(async (tx) => {
    await loadOffice(actor, officeId, tx);
    await assertUniqueName(tx, officeId, input.name);
    return tx.warehouse.create({ data: { ...input, officeId } });
  });
  return toDto(warehouse);
}

export async function updateWarehouse(
  actor: Actor,
  id: string,
  input: WarehouseInput,
): Promise<WarehouseDto> {
  const warehouse = await db().$transaction(async (tx) => {
    const existing = await loadWarehouse(actor, id, tx);
    await assertUniqueName(tx, existing.officeId, input.name, id);
    return tx.warehouse.update({ where: { id }, data: input });
  });
  return toDto(warehouse);
}

/**
 * Deletes a warehouse. Future modules (inventory, purchase receive, ...) must
 * reference warehouses with RESTRICT foreign keys; such references surface as
 * an IN_USE (409) response via the shared API error mapping.
 */
export async function deleteWarehouse(actor: Actor, id: string): Promise<void> {
  await db().$transaction(async (tx) => {
    await loadWarehouse(actor, id, tx);
    await tx.warehouse.delete({ where: { id } });
  });
}
