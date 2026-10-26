import { Prisma } from "@/generated/prisma/client";
import { AppError, badRequest, conflict, notFound } from "@/lib/api/errors";
import type { Actor } from "@/lib/auth/actor";
import { db } from "@/lib/prisma/client";
import { stockLevels } from "@/features/sales/deliveries/services/stock.service";
import { fromDbDate, toDbDate } from "@/features/sales/lib/dates";
import { requireOffice, scopedBusinessUnitIds } from "@/features/sales/lib/scope";
import { userNames } from "@/features/sales/lib/users";
import { round2, round4 } from "../../bom/lib/bom-totals";
import { productionNumber } from "../../lib/numbering";
import {
  ORDER_APPROVAL_FEATURE,
  customerSearchSchema,
  orderActionSchema,
  orderInputSchema,
  orderListQuerySchema,
  orderPreviewQuerySchema,
  orderUpdateSchema,
  type CustomerOption,
  type OrderAction,
  type OrderDetail,
  type OrderLookups,
  type OrderPreview,
  type OrderRow,
  type ParsedOrderInput,
  type SalesOrderOption,
} from "../schemas/order.schema";

type Tx = Prisma.TransactionClient;
type Client = Tx | ReturnType<typeof db>;

/** Rows a list returns. */
export const ORDER_LIST_LIMIT = 2000;
const STALE = "Someone else changed this production order. Reload and try again.";

const num = (value: Prisma.Decimal | null | undefined) => (value ? value.toNumber() : 0);

// ─── BOM explosion ───────────────────────────────────────────────────────────

/**
 * The active BOM's materials scaled to `quantity` of one of its production items:
 * required = BOM quantity (wastage included) × quantity ÷ the item's lot size.
 */
async function explode(client: Client, businessUnitId: string, bomId: string, itemId: string, quantity: number) {
  const bom = await client.productionBom.findFirst({
    where: { id: bomId, businessUnitId },
    include: {
      outputs: { select: { itemId: true, lotSizeQty: true, costPercent: true } },
      materials: { include: { item: { select: { code: true, name: true } } }, orderBy: { lineNo: "asc" } },
    },
  });
  if (!bom) throw badRequest("Choose a bill of material of this business unit.");
  if (!bom.isActive) throw badRequest(`Bill of material ${bom.name} is inactive.`);
  const output = bom.outputs.find((line) => line.itemId === itemId);
  if (!output) throw badRequest(`${bom.name} does not produce the chosen item.`);
  const lotSize = num(output.lotSizeQty);
  const factor = quantity / lotSize;
  const unitCost = round4((num(bom.totalCost) * num(output.costPercent)) / 100 / lotSize);
  return {
    bomName: bom.name,
    lotSize,
    factor: round4(factor),
    unitCost,
    totalCost: round2(unitCost * quantity),
    materials: bom.materials.map((line) => ({
      itemId: line.itemId,
      code: line.item.code,
      name: line.item.name,
      uom: line.uom,
      bomQty: num(line.totalQty),
      requiredQty: round4(num(line.totalQty) * factor),
    })),
  };
}

export async function previewOrder(actor: Actor, raw: unknown): Promise<OrderPreview> {
  const query = orderPreviewQuerySchema.parse(raw);
  const unitIds = await scopedBusinessUnitIds(actor);
  const bom = await db().productionBom.findFirst({ where: { id: query.bomId, businessUnitId: { in: unitIds } }, select: { businessUnitId: true } });
  if (!bom) throw notFound("Bill of material");
  const exploded = await explode(db(), bom.businessUnitId, query.bomId, query.itemId, query.quantity);
  let stock: Map<string, number> | null = null;
  if (query.warehouseId) {
    const warehouse = await db().warehouse.findFirst({ where: { id: query.warehouseId, office: { businessUnitId: bom.businessUnitId } }, select: { id: true } });
    if (!warehouse) throw notFound("Warehouse");
    stock = await stockLevels(warehouse.id, exploded.materials.map((line) => line.itemId));
  }
  return { ...exploded, materials: exploded.materials.map((line) => ({ ...line, stock: stock ? (stock.get(line.itemId) ?? 0) : null })) };
}

// ─── Approval ────────────────────────────────────────────────────────────────

/** Approval stages copied from the "Production Order" pipeline, or one "Any_Person" stage without a pipeline. */
async function approvalStages(tx: Tx, businessUnitId: string) {
  const pipeline = await tx.approvalPipeline.findFirst({
    where: { feature: ORDER_APPROVAL_FEATURE },
    orderBy: { updatedAt: "desc" },
    include: {
      superApproverEmployee: { select: { userId: true } },
      stages: {
        orderBy: { stageNo: "asc" },
        include: { approvers: { orderBy: { sortOrder: "asc" }, include: { employee: { select: { userId: true } } } } },
      },
    },
  });
  if (!pipeline || pipeline.stages.length === 0) {
    return {
      superApproverUserId: null,
      stages: [{ stageNo: 1, stageName: "Production Order Approval", approvalOrder: "ANY", requiredCount: 1, approverUserIds: [] as string[] }],
    };
  }
  return {
    superApproverUserId: pipeline.superApproverUserId ?? pipeline.superApproverEmployee?.userId ?? null,
    stages: pipeline.stages.map((stage, index) => {
      const ids = stage.approvers
        .filter((approver) => !approver.businessUnitId || approver.businessUnitId === businessUnitId)
        .map((approver) => (approver.userType === "EMPLOYEE" ? approver.employee?.userId : approver.userId))
        .filter((id): id is string => !!id);
      const approverUserIds = [...new Set(ids)];
      return {
        stageNo: index + 1,
        stageName: stage.name,
        approvalOrder: stage.approvalOrder === "SEQUENTIAL" ? "SEQUENTIAL" : "ANY",
        requiredCount: approverUserIds.length ? Math.min(stage.requiredCount, approverUserIds.length) : 1,
        approverUserIds,
      };
    }),
  };
}

interface StageState {
  approvalOrder: string;
  approverUserIds: string[];
  approvedUserIds: string[];
}

/** Whether the actor may approve / reject this stage now. */
function canActOnStage(actor: Actor, stage: StageState, superApproverUserId: string | null): boolean {
  if (superApproverUserId && actor.id === superApproverUserId) return true;
  if (stage.approverUserIds.length === 0) return actor.permissions.has("production:approve");
  if (stage.approvedUserIds.includes(actor.id)) return false;
  if (stage.approvalOrder === "SEQUENTIAL") return stage.approverUserIds[stage.approvedUserIds.length] === actor.id;
  return stage.approverUserIds.includes(actor.id);
}

function allowedActions(
  actor: Actor,
  order: { status: string; superApproverUserId: string | null },
  stages: (StageState & { status: string })[],
): OrderAction[] {
  const actions: OrderAction[] = [];
  const write = actor.permissions.has("production:write");
  const current = stages.find((stage) => stage.status === "PENDING");
  if (order.status === "PENDING_APPROVAL" && current && canActOnStage(actor, current, order.superApproverUserId)) actions.push("approve", "reject");
  if (write && order.status === "APPROVED") actions.push("start");
  if (write && (order.status === "APPROVED" || order.status === "IN_PROGRESS")) actions.push("close");
  if (write && (order.status === "PENDING_APPROVAL" || order.status === "APPROVED")) actions.push("cancel");
  return actions;
}

// ─── Read ────────────────────────────────────────────────────────────────────

const ROW_INCLUDE = {
  item: { select: { code: true, name: true, uom: true } },
  bom: { select: { name: true } },
  office: { select: { name: true } },
} satisfies Prisma.ProductionOrderInclude;

type RowRecord = Prisma.ProductionOrderGetPayload<{ include: typeof ROW_INCLUDE }>;

function toRow(record: RowRecord): OrderRow {
  const orderQty = num(record.orderQty);
  const producedQty = num(record.producedQty);
  return {
    id: record.id,
    number: record.number,
    orderDate: fromDbDate(record.orderDate),
    productionDate: fromDbDate(record.productionDate),
    itemId: record.itemId,
    itemCode: record.item.code,
    itemName: record.item.name,
    uom: record.item.uom,
    bomId: record.bomId,
    bomName: record.bom.name,
    orderQty,
    producedQty,
    remainingQty: Math.max(round4(orderQty - producedQty), 0),
    producedValue: round2(producedQty * num(record.unitCost)),
    status: record.status,
    officeName: record.office.name,
    updatedAt: record.updatedAt.toISOString(),
  };
}

export async function listOrders(actor: Actor, raw: unknown): Promise<OrderRow[]> {
  const query = orderListQuerySchema.parse(raw);
  const unitIds = await scopedBusinessUnitIds(actor);
  const search = query.search ? { contains: query.search, mode: "insensitive" as const } : undefined;
  const records = await db().productionOrder.findMany({
    where: {
      businessUnitId: { in: unitIds },
      ...(query.from || query.to ? { orderDate: { ...(query.from ? { gte: toDbDate(query.from) } : {}), ...(query.to ? { lte: toDbDate(query.to) } : {}) } } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.bomId ? { bomId: query.bomId } : {}),
      ...(search ? { OR: [{ number: search }, { item: { OR: [{ name: search }, { code: search }] } }, { bom: { name: search } }] } : {}),
    },
    include: ROW_INCLUDE,
    orderBy: [{ orderDate: "desc" }, { number: "desc" }],
    take: ORDER_LIST_LIMIT,
  });
  return records.map(toRow);
}

async function findInScope(actor: Actor, id: string, client: Client = db()) {
  const unitIds = await scopedBusinessUnitIds(actor);
  const record = await client.productionOrder.findFirst({
    where: { id, businessUnitId: { in: unitIds } },
    include: {
      ...ROW_INCLUDE,
      customer: { select: { name: true, code: true } },
      salesOrder: { select: { number: true } },
      warehouse: { select: { name: true } },
      workCenter: { select: { code: true, name: true } },
      materials: { include: { item: { select: { code: true, name: true } } }, orderBy: { lineNo: "asc" } },
      approvals: { orderBy: { stageNo: "asc" } },
    },
  });
  if (!record) throw notFound("Production order");
  return record;
}

export async function getOrder(actor: Actor, id: string): Promise<OrderDetail> {
  const record = await findInScope(actor, id);
  const nameOf = await userNames([
    record.createdBy,
    ...record.approvals.flatMap((stage) => [...stage.approverUserIds, ...stage.approvedUserIds, stage.actedBy]),
  ]);
  const name = (userId: string | null) => nameOf(userId) ?? "";
  const actions = allowedActions(actor, record, record.approvals);
  return {
    ...toRow(record),
    businessUnitId: record.businessUnitId,
    customerId: record.customerId,
    customerName: record.customer ? `${record.customer.code} - ${record.customer.name}` : null,
    salesOrderId: record.salesOrderId,
    salesOrderNumber: record.salesOrder?.number ?? null,
    customerPoNo: record.customerPoNo,
    officeId: record.officeId,
    warehouseId: record.warehouseId,
    warehouseName: record.warehouse.name,
    workCenterId: record.workCenterId,
    workCenterName: record.workCenter ? `${record.workCenter.code} - ${record.workCenter.name}` : null,
    machineName: record.machineName,
    narration: record.narration,
    bomLotSize: num(record.bomLotSize),
    unitCost: num(record.unitCost),
    statusReason: record.statusReason,
    createdByName: name(record.createdBy),
    createdAt: record.createdAt.toISOString(),
    materials: record.materials.map((line) => ({
      itemId: line.itemId,
      code: line.item.code,
      name: line.item.name,
      uom: line.uom,
      bomQty: num(line.bomQty),
      requiredQty: num(line.requiredQty),
      issueQty: num(line.issueQty),
      usedQty: num(line.usedQty),
      remainingQty: Math.max(round4(num(line.requiredQty) - num(line.usedQty)), 0),
      returnQty: num(line.returnQty),
    })),
    approvals: record.approvals.map((stage) => ({
      stageNo: stage.stageNo,
      stageName: stage.stageName,
      approvalOrder: stage.approvalOrder,
      requiredCount: stage.requiredCount,
      approverNames: stage.approverUserIds.map(name),
      approvedNames: stage.approvedUserIds.map(name),
      status: stage.status,
      actedByName: stage.actedBy ? name(stage.actedBy) : null,
      comment: stage.comment,
      actedAt: stage.actedAt?.toISOString() ?? null,
    })),
    allowedActions: actions,
    canEdit:
      actor.permissions.has("production:write") &&
      record.status === "PENDING_APPROVAL" &&
      record.approvals.every((stage) => stage.approvedUserIds.length === 0 && stage.status === "PENDING"),
  };
}

// ─── Write ───────────────────────────────────────────────────────────────────

/** Checks the warehouse, work center, customer and sales order against the office's business unit. */
async function checkReferences(tx: Tx, office: { id: string; businessUnitId: string }, input: ParsedOrderInput) {
  const businessUnitId = office.businessUnitId;
  const [warehouse, workCenter, customer, salesOrder] = await Promise.all([
    tx.warehouse.findFirst({ where: { id: input.warehouseId, officeId: office.id }, select: { id: true } }),
    input.workCenterId ? tx.productionWorkCenter.findFirst({ where: { id: input.workCenterId, businessUnitId }, select: { isActive: true, name: true } }) : null,
    input.customerId ? tx.customer.findFirst({ where: { id: input.customerId, businessUnitId }, select: { id: true } }) : null,
    input.salesOrderId
      ? tx.salesOrder.findFirst({ where: { id: input.salesOrderId, businessUnitId }, select: { customerId: true, status: true, number: true } })
      : null,
  ]);
  if (!warehouse) throw badRequest("Choose a warehouse of the chosen office.");
  if (input.workCenterId && !workCenter) throw badRequest("Choose a work center of this business unit.");
  if (workCenter && !workCenter.isActive) throw badRequest(`Work center ${workCenter.name} is inactive.`);
  if (input.customerId && !customer) throw badRequest("Choose a customer of this business unit.");
  if (input.salesOrderId) {
    if (!salesOrder || salesOrder.customerId !== input.customerId) throw badRequest("The sales order does not belong to the chosen customer.");
    if (salesOrder.status === "CANCELLED" || salesOrder.status === "DRAFT") throw badRequest(`Sales order ${salesOrder.number} is not confirmed.`);
  }
  return businessUnitId;
}

function header(input: ParsedOrderInput, exploded: Awaited<ReturnType<typeof explode>>) {
  return {
    orderDate: toDbDate(input.orderDate),
    productionDate: toDbDate(input.productionDate),
    customerId: input.customerId ?? null,
    salesOrderId: input.salesOrderId ?? null,
    customerPoNo: input.customerPoNo || null,
    itemId: input.itemId,
    bomId: input.bomId,
    bomLotSize: exploded.lotSize,
    unitCost: exploded.unitCost,
    orderQty: input.quantity,
    officeId: input.officeId,
    warehouseId: input.warehouseId,
    workCenterId: input.workCenterId ?? null,
    machineName: input.machineName || null,
    narration: input.narration || null,
  };
}

const materialRows = (exploded: Awaited<ReturnType<typeof explode>>) =>
  exploded.materials.map((line, index) => ({ lineNo: index + 1, itemId: line.itemId, uom: line.uom, bomQty: line.bomQty, requiredQty: line.requiredQty }));

export async function createOrder(actor: Actor, raw: unknown): Promise<OrderDetail> {
  const input = orderInputSchema.parse(raw);
  const office = await requireOffice(actor, input.officeId);
  const id = await db().$transaction(async (tx) => {
    const businessUnitId = await checkReferences(tx, office, input);
    const exploded = await explode(tx, businessUnitId, input.bomId, input.itemId, input.quantity);
    const approval = await approvalStages(tx, businessUnitId);
    const created = await tx.productionOrder.create({
      data: {
        businessUnitId,
        number: await productionNumber(tx, businessUnitId, "PRODUCTION_ORDER", "PRO-", input.orderDate),
        ...header(input, exploded),
        superApproverUserId: approval.superApproverUserId,
        createdBy: actor.id,
        materials: { create: materialRows(exploded) },
        approvals: { create: approval.stages },
      },
      select: { id: true },
    });
    return created.id;
  });
  return getOrder(actor, id);
}

/** Edits an order nobody has approved yet; materials are exploded again and approval starts over. */
export async function updateOrder(actor: Actor, id: string, raw: unknown): Promise<OrderDetail> {
  const { version, data } = orderUpdateSchema.parse(raw);
  const current = await findInScope(actor, id);
  const office = await requireOffice(actor, data.officeId);
  await db().$transaction(async (tx) => {
    const businessUnitId = await checkReferences(tx, office, data);
    if (businessUnitId !== current.businessUnitId) throw badRequest("An order cannot move to another business unit.");
    const exploded = await explode(tx, businessUnitId, data.bomId, data.itemId, data.quantity);
    const approvals = await tx.productionOrderApproval.findMany({ where: { orderId: id }, select: { status: true, approvedUserIds: true } });
    if (approvals.some((stage) => stage.status !== "PENDING" || stage.approvedUserIds.length > 0)) {
      throw conflict("This order is already being approved and can no longer be edited.");
    }
    const { count } = await tx.productionOrder.updateMany({
      where: { id, updatedAt: new Date(version), status: "PENDING_APPROVAL" },
      data: header(data, exploded),
    });
    if (count === 0) throw conflict(STALE);
    const approval = await approvalStages(tx, businessUnitId);
    await tx.productionOrderMaterial.deleteMany({ where: { orderId: id } });
    await tx.productionOrderMaterial.createMany({ data: materialRows(exploded).map((row) => ({ ...row, orderId: id })) });
    await tx.productionOrderApproval.deleteMany({ where: { orderId: id } });
    await tx.productionOrderApproval.createMany({ data: approval.stages.map((stage) => ({ ...stage, orderId: id })) });
    await tx.productionOrder.update({ where: { id }, data: { superApproverUserId: approval.superApproverUserId } });
  });
  return getOrder(actor, id);
}

/** Approve / reject the current stage, or start, close or cancel the order. */
export async function actOnOrder(actor: Actor, id: string, raw: unknown): Promise<OrderDetail> {
  const { version, action, comment } = orderActionSchema.parse(raw);
  const order = await findInScope(actor, id);
  if (order.updatedAt.toISOString() !== version) throw conflict(STALE);
  if (!allowedActions(actor, order, order.approvals).includes(action)) {
    throw new AppError(403, "FORBIDDEN", `You cannot ${action} this production order now.`);
  }
  await db().$transaction(async (tx) => {
    const now = new Date();
    const claim = async (status: Prisma.ProductionOrderUpdateManyMutationInput["status"], extra: Prisma.ProductionOrderUpdateManyMutationInput = {}) => {
      const { count } = await tx.productionOrder.updateMany({ where: { id, updatedAt: order.updatedAt, status: order.status }, data: { status, ...extra } });
      if (count === 0) throw conflict(STALE);
    };

    if (action === "approve" || action === "reject") {
      const stage = order.approvals.find((item) => item.status === "PENDING")!;
      const superApprover = !!order.superApproverUserId && actor.id === order.superApproverUserId;
      const approvedUserIds = action === "approve" && !stage.approvedUserIds.includes(actor.id) ? [...stage.approvedUserIds, actor.id] : stage.approvedUserIds;
      const stageDone = action === "approve" && (superApprover || approvedUserIds.length >= stage.requiredCount);
      const lastStage = !order.approvals.some((item) => item.stageNo > stage.stageNo && item.status === "PENDING");
      if (action === "reject") await claim("REJECTED", { statusReason: comment ?? null });
      else if (stageDone && lastStage) await claim("APPROVED");
      else await claim("PENDING_APPROVAL");
      const { count } = await tx.productionOrderApproval.updateMany({
        where: { id: stage.id, status: "PENDING", approvedUserIds: { equals: stage.approvedUserIds } },
        data: {
          approvedUserIds,
          status: action === "reject" ? "REJECTED" : stageDone ? "APPROVED" : "PENDING",
          actedBy: actor.id,
          comment: comment || null,
          actedAt: now,
        },
      });
      if (count === 0) throw conflict(STALE);
      return;
    }
    if (action === "start") return claim("IN_PROGRESS");
    if (action === "close") return claim("CLOSED", { statusReason: comment || null });
    return claim("CANCELLED", { statusReason: comment ?? null });
  });
  return getOrder(actor, id);
}

// ─── Lookups ─────────────────────────────────────────────────────────────────

export async function orderLookups(actor: Actor): Promise<OrderLookups> {
  const unitIds = await scopedBusinessUnitIds(actor);
  const inUnits = { businessUnitId: { in: unitIds } };
  const [offices, warehouses, workCenters, outputs, boms] = await Promise.all([
    db().office.findMany({ where: inUnits, select: { id: true, name: true, businessUnitId: true }, orderBy: { name: "asc" } }),
    db().warehouse.findMany({ where: { office: inUnits }, select: { id: true, name: true, officeId: true }, orderBy: { name: "asc" } }),
    db().productionWorkCenter.findMany({ where: { ...inUnits, isActive: true }, select: { id: true, code: true, name: true, businessUnitId: true, officeId: true }, orderBy: { code: "asc" } }),
    db().productionBomOutput.findMany({
      where: { bom: { ...inUnits, isActive: true } },
      select: { lotSizeQty: true, item: { select: { id: true, businessUnitId: true, code: true, name: true, uom: true } }, bom: { select: { id: true, name: true } } },
      orderBy: { item: { code: "asc" } },
    }),
    db().productionBom.findMany({ where: inUnits, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  const items = new Map<string, OrderLookups["items"][number]>();
  for (const output of outputs) {
    const entry = items.get(output.item.id) ?? {
      itemId: output.item.id,
      businessUnitId: output.item.businessUnitId,
      code: output.item.code,
      name: output.item.name,
      uom: output.item.uom,
      boms: [],
    };
    entry.boms.push({ id: output.bom.id, name: output.bom.name, lotSize: num(output.lotSizeQty) });
    items.set(output.item.id, entry);
  }
  return { offices, warehouses, workCenters, items: [...items.values()], boms, canApprove: actor.permissions.has("production:approve") };
}

export async function searchCustomers(actor: Actor, raw: unknown): Promise<CustomerOption[]> {
  const { search } = customerSearchSchema.parse(raw);
  const unitIds = await scopedBusinessUnitIds(actor);
  const text = { contains: search, mode: "insensitive" as const };
  return db().customer.findMany({
    where: { businessUnitId: { in: unitIds }, isActive: true, OR: [{ name: text }, { code: text }] },
    select: { id: true, code: true, name: true },
    orderBy: { name: "asc" },
    take: 20,
  });
}

/** Confirmed sales orders of a customer, newest first. */
export async function customerSalesOrders(actor: Actor, customerId: string): Promise<SalesOrderOption[]> {
  const unitIds = await scopedBusinessUnitIds(actor);
  const orders = await db().salesOrder.findMany({
    where: { customerId, businessUnitId: { in: unitIds }, status: { in: ["PENDING_APPROVAL", "APPROVED", "COMPLETED"] } },
    select: { id: true, number: true, orderDate: true, status: true, lines: { select: { itemId: true, qty: true } } },
    orderBy: { orderDate: "desc" },
    take: 100,
  });
  return orders.map((order) => ({
    id: order.id,
    number: order.number,
    orderDate: fromDbDate(order.orderDate),
    status: order.status,
    lines: order.lines.map((line) => ({ itemId: line.itemId, qty: num(line.qty) })),
  }));
}
