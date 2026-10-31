import { Prisma } from "@/generated/prisma/client";
import { AppError, badRequest, conflict, notFound } from "@/lib/api/errors";
import type { Actor } from "@/lib/auth/actor";
import { db } from "@/lib/prisma/client";
import { assertStockAvailable, lockWarehouse, stockLevels } from "@/features/sales/deliveries/services/stock.service";
import { fromDbDate, toDbDate } from "@/features/sales/lib/dates";
import { scopedBusinessUnitIds } from "@/features/sales/lib/scope";
import { userNames } from "@/features/sales/lib/users";
import { round2, round4 } from "../../bom/lib/bom-totals";
import { productionNumber } from "../../lib/numbering";
import { WASTAGE_INCLUDE, toWastageLine } from "./wastage.service";
import {
  entryCancelSchema,
  entryInputSchema,
  entryListQuerySchema,
  queueQuerySchema,
  type EntryDetail,
  type EntryForm,
  type EntryRow,
  type QueueRow,
} from "../schemas/entry.schema";

type Tx = Prisma.TransactionClient;

/** Rows a list returns. */
export const ENTRY_LIST_LIMIT = 2000;
const OPEN_STATUSES = ["APPROVED", "IN_PROGRESS"] as const;
const STALE = "Someone else changed this production entry. Reload and try again.";

const num = (value: Prisma.Decimal | null | undefined) => (value ? value.toNumber() : 0);
/** Stock is kept to 3 decimals; consumption is rounded the same so entry and stock agree. */
const round3 = (value: number) => Math.round(value * 1000) / 1000;

/** Serialises entries of one production order (produced quantity and status). */
async function lockOrder(tx: Tx, orderId: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`porder:${orderId}`}))`;
}

/** Locks warehouses in a fixed order so two entries cannot deadlock. */
async function lockWarehouses(tx: Tx, ids: string[]) {
  for (const id of [...new Set(ids)].sort()) await lockWarehouse(tx, id);
}

// ─── Queue: orders open for entries ──────────────────────────────────────────

const ORDER_INCLUDE = {
  item: { select: { code: true, name: true, uom: true } },
  bom: { select: { name: true } },
  office: { select: { name: true } },
  _count: { select: { entries: { where: { status: "POSTED" } } } },
} satisfies Prisma.ProductionOrderInclude;

function toQueueRow(order: Prisma.ProductionOrderGetPayload<{ include: typeof ORDER_INCLUDE }>): QueueRow {
  const orderQty = num(order.orderQty);
  const producedQty = num(order.producedQty);
  return {
    id: order.id,
    number: order.number,
    orderDate: fromDbDate(order.orderDate),
    itemCode: order.item.code,
    itemName: order.item.name,
    uom: order.item.uom,
    bomName: order.bom.name,
    orderQty,
    producedQty,
    remainingQty: Math.max(round4(orderQty - producedQty), 0),
    status: order.status,
    officeName: order.office.name,
    entryCount: order._count.entries,
  };
}

/** Approved / in-progress orders that still have quantity to produce. */
export async function listQueue(actor: Actor, raw: unknown): Promise<QueueRow[]> {
  const query = queueQuerySchema.parse(raw);
  const unitIds = await scopedBusinessUnitIds(actor);
  const search = query.search ? { contains: query.search, mode: "insensitive" as const } : undefined;
  const orders = await db().productionOrder.findMany({
    where: {
      businessUnitId: { in: unitIds },
      status: { in: [...OPEN_STATUSES] },
      ...(search ? { OR: [{ number: search }, { item: { OR: [{ name: search }, { code: search }] } }, { bom: { name: search } }] } : {}),
    },
    include: ORDER_INCLUDE,
    orderBy: [{ productionDate: "asc" }, { number: "asc" }],
    take: ENTRY_LIST_LIMIT,
  });
  return orders.map(toQueueRow).filter((row) => row.remainingQty > 0);
}

async function openOrder(actor: Actor, orderId: string) {
  const unitIds = await scopedBusinessUnitIds(actor);
  const order = await db().productionOrder.findFirst({
    where: { id: orderId, businessUnitId: { in: unitIds } },
    include: {
      ...ORDER_INCLUDE,
      warehouse: { select: { name: true } },
      salesOrder: { select: { number: true } },
      materials: { include: { item: { select: { code: true, name: true } } }, orderBy: { lineNo: "asc" } },
      bom: { select: { name: true, outputs: { select: { itemId: true, netWeight: true } }, materials: { select: { itemId: true, rate: true } } } },
    },
  });
  if (!order) throw notFound("Production order");
  if (!(OPEN_STATUSES as readonly string[]).includes(order.status)) {
    throw badRequest(`Production order ${order.number} is not open for production (it is ${order.status.toLowerCase().replace("_", " ")}).`);
  }
  return order;
}

export async function entryForm(actor: Actor, orderId: string): Promise<EntryForm> {
  const order = await openOrder(actor, orderId);
  const inUnit = { businessUnitId: order.businessUnitId };
  const lotSize = num(order.bomLotSize);
  const rateOf = new Map(order.bom.materials.map((line) => [line.itemId, num(line.rate)]));
  const [stock, workCenters, departments, sections, warehouses] = await Promise.all([
    stockLevels(order.warehouseId, order.materials.map((line) => line.itemId)),
    db().productionWorkCenter.findMany({
      where: { ...inUnit, isActive: true, OR: [{ officeId: null }, { officeId: order.officeId }] },
      select: { id: true, code: true, name: true, departmentId: true, departmentSectionId: true },
      orderBy: { code: "asc" },
    }),
    db().productionDepartment.findMany({ where: inUnit, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    db().productionDepartmentSection.findMany({ where: { department: inUnit }, select: { id: true, name: true, departmentId: true }, orderBy: { name: "asc" } }),
    db().warehouse.findMany({ where: { office: inUnit }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  return {
    order: {
      ...toQueueRow(order),
      officeId: order.officeId,
      sourceWarehouseId: order.warehouseId,
      sourceWarehouseName: order.warehouse.name,
      workCenterId: order.workCenterId,
      salesOrderNumber: order.salesOrder?.number ?? null,
      netWeightPerUnit: num(order.bom.outputs.find((line) => line.itemId === order.itemId)?.netWeight),
    },
    materials: order.materials.map((line) => ({
      itemId: line.itemId,
      code: line.item.code,
      name: line.item.name,
      uom: line.uom,
      perUnit: round4(num(line.bomQty) / lotSize),
      rate: rateOf.get(line.itemId) ?? 0,
      stock: stock.get(line.itemId) ?? 0,
    })),
    workCenters,
    departments,
    sections,
    warehouses,
  };
}

// ─── Entries ─────────────────────────────────────────────────────────────────

const CATEGORY = { select: { name: true, level: true, parent: { select: { name: true, level: true, parent: { select: { name: true, level: true } } } } } } as const;

const ENTRY_INCLUDE = {
  order: { select: { number: true, salesOrder: { select: { number: true } } } },
  department: { select: { name: true } },
  departmentSection: { select: { name: true } },
  workCenter: { select: { code: true, name: true } },
  item: { select: { code: true, name: true, uom: true, category: CATEGORY } },
} satisfies Prisma.ProductionEntryInclude;

type EntryRecord = Prisma.ProductionEntryGetPayload<{ include: typeof ENTRY_INCLUDE }>;

/** Level-1 (category) and level-2 (sub category) names of an item's category. */
function categoryNames(category: EntryRecord["item"]["category"]) {
  const chain = [category, category?.parent, category?.parent?.parent].filter((node): node is NonNullable<typeof node> => !!node);
  return { categoryName: chain.find((node) => node.level === 1)?.name ?? null, subCategoryName: chain.find((node) => node.level === 2)?.name ?? null };
}

function toRow(record: EntryRecord, nameOf: (id: string | null | undefined) => string | null): EntryRow {
  return {
    id: record.id,
    number: record.number,
    entryDate: fromDbDate(record.productionDate),
    orderId: record.orderId,
    orderNumber: record.order.number,
    salesOrderNumber: record.order.salesOrder?.number ?? null,
    departmentName: record.department?.name ?? null,
    sectionName: record.departmentSection?.name ?? null,
    workCenterName: record.workCenter ? `${record.workCenter.code} - ${record.workCenter.name}` : null,
    shift: record.shift,
    itemCode: record.item.code,
    itemName: record.item.name,
    uom: record.item.uom,
    ...categoryNames(record.item.category),
    totalQty: num(record.qty),
    rejectQty: num(record.rejectQty),
    excessQty: num(record.excessQty),
    netQty: num(record.netQty),
    variance: num(record.variance),
    netWeight: num(record.netWeight),
    hours: num(record.hours),
    status: record.status,
    createdByName: nameOf(record.createdBy) ?? "",
    updatedAt: record.updatedAt.toISOString(),
  };
}

export async function listEntries(actor: Actor, raw: unknown): Promise<EntryRow[]> {
  const query = entryListQuerySchema.parse(raw);
  const unitIds = await scopedBusinessUnitIds(actor);
  const search = query.search ? { contains: query.search, mode: "insensitive" as const } : undefined;
  const records = await db().productionEntry.findMany({
    where: {
      businessUnitId: { in: unitIds },
      ...(query.from || query.to
        ? { productionDate: { ...(query.from ? { gte: toDbDate(query.from) } : {}), ...(query.to ? { lte: toDbDate(query.to) } : {}) } }
        : {}),
      ...(query.departmentId ? { departmentId: query.departmentId } : {}),
      ...(query.departmentSectionId ? { departmentSectionId: query.departmentSectionId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(search ? { OR: [{ number: search }, { order: { number: search } }, { item: { OR: [{ name: search }, { code: search }] } }] } : {}),
    },
    include: ENTRY_INCLUDE,
    orderBy: [{ productionDate: "desc" }, { number: "desc" }],
    take: ENTRY_LIST_LIMIT,
  });
  const nameOf = await userNames(records.map((record) => record.createdBy));
  return records.map((record) => toRow(record, nameOf));
}

export async function getEntry(actor: Actor, id: string): Promise<EntryDetail> {
  const unitIds = await scopedBusinessUnitIds(actor);
  const record = await db().productionEntry.findFirst({
    where: { id, businessUnitId: { in: unitIds } },
    include: {
      ...ENTRY_INCLUDE,
      office: { select: { name: true } },
      sourceWarehouse: { select: { name: true } },
      outputWarehouse: { select: { name: true } },
      // Order date, BOM and machine ("Equipment") of the order; operators tagged on the work center.
      order: { select: { number: true, orderDate: true, machineName: true, salesOrder: { select: { number: true } }, bom: { select: { name: true } } } },
      workCenter: { select: { code: true, name: true, operators: { select: { employee: { select: { name: true } } }, orderBy: { createdAt: "asc" } } } },
      materials: { include: { item: { select: { code: true, name: true, category: CATEGORY } } }, orderBy: { lineNo: "asc" } },
      wastages: { include: WASTAGE_INCLUDE, orderBy: { lineNo: "asc" } },
    },
  });
  if (!record) throw notFound("Production entry");
  const nameOf = await userNames([record.createdBy, record.cancelledBy]);
  const netQty = num(record.netQty);
  return {
    ...toRow(record, nameOf),
    orderDate: fromDbDate(record.order.orderDate),
    bomName: record.order.bom.name,
    equipment: record.order.machineName,
    operatorNames: record.workCenter?.operators.map((operator) => operator.employee.name) ?? [],
    unitCost: netQty > 0 ? round4(num(record.actualCost) / netQty) : 0,
    officeName: record.office.name,
    sourceWarehouseName: record.sourceWarehouse.name,
    outputWarehouseName: record.outputWarehouse.name,
    standardCost: num(record.standardCost),
    actualCost: num(record.actualCost),
    remarks: record.remarks,
    cancelReason: record.cancelReason,
    cancelledByName: nameOf(record.cancelledBy),
    cancelledAt: record.cancelledAt?.toISOString() ?? null,
    createdAt: record.createdAt.toISOString(),
    materials: record.materials.map((line) => ({
      itemId: line.itemId,
      code: line.item.code,
      name: line.item.name,
      ...categoryNames(line.item.category),
      uom: line.uom,
      standardQty: num(line.standardQty),
      actualQty: num(line.actualQty),
      wastageQty: num(line.wastageQty),
      scrapQty: num(line.scrapQty),
      varianceQty: round4(num(line.actualQty) - num(line.standardQty)),
      rate: num(line.rate),
    })),
    wastages: record.wastages.map(toWastageLine),
    canCancel: record.status === "POSTED" && actor.permissions.has("production:write"),
  };
}

/**
 * Books production against an order in one transaction: materials leave the order's
 * warehouse (stock checked), good output enters the output warehouse, and the order's
 * produced quantity, material usage and status move on (closed once fully produced).
 */
export async function createEntry(actor: Actor, raw: unknown): Promise<EntryDetail> {
  const input = entryInputSchema.parse(raw);
  const order = await openOrder(actor, input.orderId);
  const businessUnitId = order.businessUnitId;
  if (input.entryDate < fromDbDate(order.orderDate)) throw badRequest("Production Entry Date cannot be before the order date.");

  const orderMaterialIds = order.materials.map((line) => line.itemId).sort();
  const inputIds = input.materials.map((line) => line.itemId).sort();
  if (orderMaterialIds.length !== inputIds.length || orderMaterialIds.some((id, index) => id !== inputIds[index])) {
    throw badRequest("Enter the consumption of exactly the materials of the production order.");
  }

  const [workCenter, department, section, outputWarehouse] = await Promise.all([
    input.workCenterId ? db().productionWorkCenter.findFirst({ where: { id: input.workCenterId, businessUnitId }, select: { isActive: true, name: true } }) : null,
    input.departmentId ? db().productionDepartment.findFirst({ where: { id: input.departmentId, businessUnitId }, select: { id: true } }) : null,
    input.departmentSectionId ? db().productionDepartmentSection.findFirst({ where: { id: input.departmentSectionId }, select: { departmentId: true } }) : null,
    db().warehouse.findFirst({ where: { id: input.outputWarehouseId, office: { businessUnitId } }, select: { id: true } }),
  ]);
  if (input.workCenterId && !workCenter) throw badRequest("Choose a work center of this business unit.");
  if (workCenter && !workCenter.isActive) throw badRequest(`Work center ${workCenter.name} is inactive.`);
  if (input.departmentId && !department) throw badRequest("Choose a department of this business unit.");
  if (input.departmentSectionId && section?.departmentId !== input.departmentId) throw badRequest("The section does not belong to the chosen department.");
  if (!outputWarehouse) throw badRequest("Choose a warehouse of this business unit for the finished goods.");

  const lotSize = num(order.bomLotSize);
  const rateOf = new Map(order.bom.materials.map((line) => [line.itemId, num(line.rate)]));
  const orderLine = new Map(order.materials.map((line) => [line.itemId, line]));
  const netQty = round4(input.totalQty - input.rejectQty);
  const materials = input.materials.map((line, index) => {
    const base = orderLine.get(line.itemId)!;
    return {
      lineNo: index + 1,
      itemId: line.itemId,
      uom: base.uom,
      standardQty: round4((num(base.bomQty) / lotSize) * input.totalQty),
      actualQty: round3(line.actualQty),
      wastageQty: round3(line.wastageQty),
      scrapQty: round3(line.scrapQty),
      rate: rateOf.get(line.itemId) ?? 0,
    };
  });
  const standardCost = round2(materials.reduce((sum, line) => sum + line.standardQty * line.rate, 0));
  const actualCost = round2(materials.reduce((sum, line) => sum + line.actualQty * line.rate, 0));
  const netWeightPerUnit = num(order.bom.outputs.find((line) => line.itemId === order.itemId)?.netWeight);

  const id = await db().$transaction(async (tx) => {
    await lockOrder(tx, order.id);
    await lockWarehouses(tx, [order.warehouseId, outputWarehouse.id]);
    const current = await tx.productionOrder.findUniqueOrThrow({ where: { id: order.id }, select: { status: true, orderQty: true, producedQty: true } });
    if (!(OPEN_STATUSES as readonly string[]).includes(current.status)) throw conflict(`Production order ${order.number} was closed meanwhile.`);
    const remaining = Math.max(round4(num(current.orderQty) - num(current.producedQty)), 0);
    const producedAfter = round4(num(current.producedQty) + netQty);

    const needs = new Map(materials.filter((line) => line.actualQty > 0).map((line) => [line.itemId, line.actualQty]));
    await assertStockAvailable(tx, order.warehouseId, needs, new Map(order.materials.map((line) => [line.itemId, `${line.item.code} - ${line.item.name}`])));

    const entry = await tx.productionEntry.create({
      data: {
        businessUnitId,
        number: await productionNumber(tx, businessUnitId, "PRODUCTION_ENTRY", "PE-", input.entryDate),
        orderId: order.id,
        officeId: order.officeId,
        workCenterId: input.workCenterId ?? null,
        departmentId: input.departmentId ?? null,
        departmentSectionId: input.departmentSectionId ?? null,
        itemId: order.itemId,
        sourceWarehouseId: order.warehouseId,
        outputWarehouseId: outputWarehouse.id,
        productionDate: toDbDate(input.entryDate),
        shift: input.shift,
        qty: input.totalQty,
        rejectQty: input.rejectQty,
        netQty,
        excessQty: Math.max(round4(netQty - remaining), 0),
        netWeight: round4(netQty * netWeightPerUnit),
        standardCost,
        actualCost,
        variance: round2(actualCost - standardCost),
        hours: input.hours,
        remarks: input.remarks || null,
        createdBy: actor.id,
        materials: { create: materials },
      },
      select: { id: true, number: true },
    });

    const postingDate = toDbDate(input.entryDate);
    await tx.stockEntry.createMany({
      data: [
        ...materials
          .filter((line) => line.actualQty > 0)
          .map((line) => ({
            businessUnitId,
            warehouseId: order.warehouseId,
            itemId: line.itemId,
            qty: -line.actualQty,
            source: "PRODUCTION_CONSUMPTION" as const,
            sourceId: entry.id,
            postingDate,
            remarks: `Production entry ${entry.number}`,
            createdBy: actor.id,
          })),
        ...(netQty > 0
          ? [
              {
                businessUnitId,
                warehouseId: outputWarehouse.id,
                itemId: order.itemId,
                qty: netQty,
                source: "PRODUCTION_OUTPUT" as const,
                sourceId: entry.id,
                postingDate,
                remarks: `Production entry ${entry.number}`,
                createdBy: actor.id,
              },
            ]
          : []),
      ],
    });

    await tx.productionOrder.update({
      where: { id: order.id },
      data: { producedQty: producedAfter, status: producedAfter >= num(current.orderQty) ? "CLOSED" : "IN_PROGRESS" },
    });
    for (const line of materials) {
      await tx.productionOrderMaterial.update({
        where: { id: orderLine.get(line.itemId)!.id },
        data: { issueQty: { increment: line.actualQty }, usedQty: { increment: line.actualQty } },
      });
    }
    return entry.id;
  });
  return getEntry(actor, id);
}

/** Reverses a posted entry: stock and the order's quantities go back; a closed order reopens. */
export async function cancelEntry(actor: Actor, id: string, raw: unknown): Promise<EntryDetail> {
  const { version, reason } = entryCancelSchema.parse(raw);
  if (!actor.permissions.has("production:write")) throw new AppError(403, "FORBIDDEN", "You cannot cancel production entries.");
  const unitIds = await scopedBusinessUnitIds(actor);
  const entry = await db().productionEntry.findFirst({
    where: { id, businessUnitId: { in: unitIds } },
    include: { materials: true, item: { select: { code: true, name: true } }, order: { select: { number: true, materials: { select: { id: true, itemId: true } } } } },
  });
  if (!entry) throw notFound("Production entry");
  if (entry.status !== "POSTED") throw badRequest(`Production entry ${entry.number} is already cancelled.`);
  if (entry.updatedAt.toISOString() !== version) throw conflict(STALE);

  await db().$transaction(async (tx) => {
    await lockOrder(tx, entry.orderId);
    await lockWarehouses(tx, [entry.sourceWarehouseId, entry.outputWarehouseId]);
    const netQty = num(entry.netQty);
    if (netQty > 0) {
      await assertStockAvailable(tx, entry.outputWarehouseId, new Map([[entry.itemId, netQty]]), new Map([[entry.itemId, `${entry.item.code} - ${entry.item.name}`]]));
    }
    const { count } = await tx.productionEntry.updateMany({
      where: { id, status: "POSTED", updatedAt: entry.updatedAt },
      data: { status: "CANCELLED", cancelReason: reason, cancelledBy: actor.id, cancelledAt: new Date() },
    });
    if (count === 0) throw conflict(STALE);

    const postingDate = new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`);
    const remarks = `Cancelled production entry ${entry.number}`;
    await tx.stockEntry.createMany({
      data: [
        ...entry.materials
          .filter((line) => num(line.actualQty) > 0)
          .map((line) => ({
            businessUnitId: entry.businessUnitId,
            warehouseId: entry.sourceWarehouseId,
            itemId: line.itemId,
            qty: num(line.actualQty),
            source: "PRODUCTION_CONSUMPTION" as const,
            sourceId: entry.id,
            postingDate,
            remarks,
            createdBy: actor.id,
          })),
        ...(netQty > 0
          ? [
              {
                businessUnitId: entry.businessUnitId,
                warehouseId: entry.outputWarehouseId,
                itemId: entry.itemId,
                qty: -netQty,
                source: "PRODUCTION_OUTPUT" as const,
                sourceId: entry.id,
                postingDate,
                remarks,
                createdBy: actor.id,
              },
            ]
          : []),
      ],
    });

    const order = await tx.productionOrder.findUniqueOrThrow({ where: { id: entry.orderId }, select: { status: true, orderQty: true, producedQty: true } });
    const producedAfter = Math.max(round4(num(order.producedQty) - netQty), 0);
    await tx.productionOrder.update({
      where: { id: entry.orderId },
      data: { producedQty: producedAfter, ...(order.status === "CLOSED" && producedAfter < num(order.orderQty) ? { status: "IN_PROGRESS" } : {}) },
    });
    const orderLine = new Map(entry.order.materials.map((line) => [line.itemId, line.id]));
    for (const line of entry.materials) {
      const lineId = orderLine.get(line.itemId);
      if (!lineId) continue;
      await tx.productionOrderMaterial.update({
        where: { id: lineId },
        data: { issueQty: { decrement: num(line.actualQty) }, usedQty: { decrement: num(line.actualQty) } },
      });
    }
  });
  return getEntry(actor, id);
}
