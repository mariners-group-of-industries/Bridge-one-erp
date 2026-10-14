import type { Prisma } from "@/generated/prisma/client";
import { badRequest, notFound } from "@/lib/api/errors";
import { assertCompanyAccess, type Actor } from "@/lib/auth/actor";
import { db } from "@/lib/prisma/client";
import { fromDbDate, toDbDate } from "../../lib/dates";
import { scopedBusinessUnitIds } from "../../lib/scope";
import { stockAdjustmentSchema, type StockLevel, type StockSummary, type WarehouseOption } from "../schemas/delivery.schema";

type Tx = Prisma.TransactionClient;

const round3 = (value: number) => Math.round(value * 1000) / 1000;

/** Warehouse with its business unit, if the actor may access it. */
export async function requireWarehouse(actor: Actor, warehouseId: string, client: Tx | ReturnType<typeof db> = db()) {
  const warehouse = await client.warehouse.findUnique({
    where: { id: warehouseId },
    select: { id: true, name: true, officeId: true, office: { select: { businessUnitId: true, businessUnit: { select: { companyId: true } } } } },
  });
  if (!warehouse) throw notFound("Warehouse");
  assertCompanyAccess(actor, warehouse.office.businessUnit.companyId, "Warehouse");
  return { id: warehouse.id, name: warehouse.name, officeId: warehouse.officeId, businessUnitId: warehouse.office.businessUnitId };
}

export async function listWarehouses(actor: Actor): Promise<WarehouseOption[]> {
  const unitIds = await scopedBusinessUnitIds(actor);
  return db().warehouse.findMany({
    where: { office: { businessUnitId: { in: unitIds } } },
    select: { id: true, name: true, officeId: true },
    orderBy: { name: "asc" },
  });
}

/** Stock of items in a warehouse (sum of the ledger). Items without movements are 0. */
export async function stockLevels(warehouseId: string, itemIds: string[], client: Tx | ReturnType<typeof db> = db()): Promise<Map<string, number>> {
  const rows = await client.stockEntry.groupBy({
    by: ["itemId"],
    where: { warehouseId, itemId: { in: itemIds } },
    _sum: { qty: true },
  });
  const levels = new Map(itemIds.map((id) => [id, 0]));
  for (const row of rows) levels.set(row.itemId, round3(row._sum.qty?.toNumber() ?? 0));
  return levels;
}

export async function getStockLevels(actor: Actor, warehouseId: string, itemIds: string[]): Promise<StockLevel[]> {
  await requireWarehouse(actor, warehouseId);
  const levels = await stockLevels(warehouseId, itemIds);
  return [...levels].map(([itemId, qty]) => ({ itemId, qty }));
}

/**
 * Serialises stock-changing transactions per warehouse so two deliveries
 * cannot both take the last units. Released when the transaction ends.
 */
export async function lockWarehouse(tx: Tx, warehouseId: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`stock:${warehouseId}`}))`;
}

/** Throws unless every item has enough stock for the requested outgoing quantities. */
export async function assertStockAvailable(
  tx: Tx,
  warehouseId: string,
  needs: Map<string, number>,
  names: Map<string, string>,
) {
  const current = await stockLevels(warehouseId, [...needs.keys()], tx);
  const short = [...needs].filter(([itemId, qty]) => (current.get(itemId) ?? 0) + 1e-9 < qty);
  if (short.length) {
    const list = short
      .map(([itemId, qty]) => `${names.get(itemId) ?? "Item"} (need ${round3(qty)}, in stock ${current.get(itemId) ?? 0})`)
      .join("; ");
    throw badRequest(`Not enough stock in the warehouse: ${list}.`);
  }
}

export async function adjustStock(actor: Actor, raw: unknown): Promise<void> {
  const input = stockAdjustmentSchema.parse(raw);
  const warehouse = await requireWarehouse(actor, input.warehouseId);
  const item = await db().item.findFirst({ where: { id: input.itemId, businessUnitId: warehouse.businessUnitId }, select: { id: true, name: true } });
  if (!item) throw badRequest("Item does not belong to the warehouse's business unit.");
  await db().$transaction(async (tx) => {
    await lockWarehouse(tx, warehouse.id);
    if (input.qty < 0) await assertStockAvailable(tx, warehouse.id, new Map([[item.id, -input.qty]]), new Map([[item.id, item.name]]));
    await tx.stockEntry.create({
      data: {
        businessUnitId: warehouse.businessUnitId,
        warehouseId: warehouse.id,
        itemId: item.id,
        qty: input.qty,
        source: input.source,
        postingDate: toDbDate(input.postingDate),
        remarks: input.remarks,
        createdBy: actor.id,
      },
    });
  });
}

/** Stock of one item per warehouse plus its latest movements. */
export async function getItemStock(actor: Actor, itemId: string): Promise<StockSummary> {
  const item = await db().item.findUnique({ where: { id: itemId }, select: { businessUnitId: true, businessUnit: { select: { companyId: true } } } });
  if (!item) throw notFound("Item");
  assertCompanyAccess(actor, item.businessUnit.companyId, "Item");

  const [warehouses, sums, entries] = await Promise.all([
    db().warehouse.findMany({
      where: { office: { businessUnitId: item.businessUnitId } },
      select: { id: true, name: true, office: { select: { name: true } } },
      orderBy: [{ office: { name: "asc" } }, { name: "asc" }],
    }),
    db().stockEntry.groupBy({ by: ["warehouseId"], where: { itemId }, _sum: { qty: true } }),
    db().stockEntry.findMany({
      where: { itemId },
      select: { id: true, qty: true, source: true, postingDate: true, remarks: true, createdBy: true, warehouse: { select: { name: true } } },
      orderBy: [{ postingDate: "desc" }, { createdAt: "desc" }],
      take: 50,
    }),
  ]);
  const byWarehouse = new Map(sums.map((row) => [row.warehouseId, round3(row._sum.qty?.toNumber() ?? 0)]));
  return {
    itemId,
    warehouses: warehouses.map((warehouse) => ({
      warehouseId: warehouse.id,
      warehouseName: warehouse.name,
      officeName: warehouse.office.name,
      qty: byWarehouse.get(warehouse.id) ?? 0,
    })),
    entries: entries.map((entry) => ({
      id: entry.id,
      warehouseName: entry.warehouse.name,
      qty: entry.qty.toNumber(),
      source: entry.source,
      postingDate: fromDbDate(entry.postingDate),
      remarks: entry.remarks,
      createdBy: entry.createdBy,
    })),
  };
}
