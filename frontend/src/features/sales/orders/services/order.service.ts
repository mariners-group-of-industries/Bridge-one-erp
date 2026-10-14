import type { Prisma } from "@/generated/prisma/client";
import { AppError, badRequest, conflict, notFound } from "@/lib/api/errors";
import { assertCompanyAccess, type Actor } from "@/lib/auth/actor";
import { db } from "@/lib/prisma/client";
import { money } from "../../dashboard/lib/aggregate";
import { fromDbDate, toDbDate } from "../../lib/dates";
import { customerBalances } from "../../lib/receivables";
import { requireOffice, scopedBusinessUnitIds } from "../../lib/scope";
import { formatNumber, nextNumber } from "../../lib/sequence";
import { userNames } from "../../lib/users";
import { openOrderValue } from "../../masters/services/masters.service";
import { orderTotals } from "../lib/order-totals";
import {
  orderActionSchema,
  orderInputSchema,
  orderUpdateSchema,
  type HoldReason,
  type OrderDetail,
  type OrderList,
  type OrderListQuery,
  type OrderStatus,
} from "../schemas/order.schema";

/** Rows the list returns; the total covers every matching order. */
export const ORDER_LIST_LIMIT = 1000;
const DOC_TYPE = "SALES_ORDER";
const PREFIX = "SO";

const num = (value: Prisma.Decimal | null | undefined) => (value ? value.toNumber() : 0);
const optNum = (value: Prisma.Decimal | null | undefined) => (value ? value.toNumber() : null);

// ─── Read ────────────────────────────────────────────────────────────────────

export async function listOrders(actor: Actor, query: OrderListQuery): Promise<OrderList> {
  const unitIds = await scopedBusinessUnitIds(actor);
  const customer: Prisma.CustomerWhereInput = {
    ...(query.customerGroupId ? { customerGroupId: query.customerGroupId } : {}),
    ...(query.zoneId ? { zoneId: query.zoneId } : {}),
    ...(query.territoryId ? { territoryId: query.territoryId } : {}),
    ...(query.routeId ? { routeId: query.routeId } : {}),
    ...(query.sectionId ? { sectionId: query.sectionId } : {}),
  };
  const where: Prisma.SalesOrderWhereInput = {
    businessUnitId: { in: unitIds },
    ...(query.officeId ? { officeId: query.officeId } : {}),
    ...(query.salesPersonId ? { salesPersonId: query.salesPersonId } : {}),
    ...(query.status ? { status: query.status } : {}),
    ...(query.holdReason ? { holdReason: query.holdReason } : {}),
    ...(query.pendingReasonId ? { deliveryPendingReasonId: query.pendingReasonId } : {}),
    ...(query.createdBy ? { createdBy: query.createdBy } : {}),
    ...(query.paymentMethod ? { paymentMethod: query.paymentMethod } : {}),
    ...(query.orderType ? { orderType: query.orderType } : {}),
    ...(query.from || query.to
      ? {
          orderDate: {
            ...(query.from ? { gte: toDbDate(query.from) } : {}),
            ...(query.to ? { lte: toDbDate(query.to) } : {}),
          },
        }
      : {}),
    ...(Object.keys(customer).length ? { customer } : {}),
  };
  const area = { select: { name: true } } as const;

  const [rows, aggregate] = await Promise.all([
    db().salesOrder.findMany({
      where,
      select: {
        id: true,
        number: true,
        status: true,
        holdReason: true,
        orderDate: true,
        expectedDeliveryDate: true,
        refProjectOutlet: true,
        shippingAddress: true,
        refCustomerPo: true,
        refCustomerPoDate: true,
        refCustomerPoAmount: true,
        refInvoice: true,
        salesTotal: true,
        orderType: true,
        paymentMethod: true,
        updatedAt: true,
        office: { select: { name: true } },
        salesPerson: { select: { name: true } },
        deliveryPendingReason: { select: { name: true } },
        customer: {
          select: { code: true, name: true, customerType: true, zone: area, territory: area, route: area, section: area },
        },
      },
      orderBy: [{ orderDate: "desc" }, { number: "desc" }],
      take: ORDER_LIST_LIMIT,
    }),
    db().salesOrder.aggregate({ where, _sum: { salesTotal: true }, _count: true }),
  ]);
  const creatorIds = await db().salesOrder.groupBy({ by: ["createdBy"], where: { businessUnitId: { in: unitIds } } });
  const nameOf = await userNames(creatorIds.map((row) => row.createdBy));

  return {
    totalAmount: num(aggregate._sum.salesTotal),
    totalCount: aggregate._count,
    creators: creatorIds
      .filter((row) => row.createdBy)
      .map((row) => ({ id: row.createdBy!, name: nameOf(row.createdBy)! }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    rows: rows.map((row) => ({
      id: row.id,
      number: row.number,
      status: row.status,
      holdReason: row.holdReason,
      pendingReasonName: row.deliveryPendingReason?.name ?? null,
      orderDate: fromDbDate(row.orderDate),
      expectedDeliveryDate: fromDbDate(row.expectedDeliveryDate),
      officeName: row.office.name,
      customerCode: row.customer.code,
      customerName: row.customer.name,
      customerType: row.customer.customerType,
      refProjectOutlet: row.refProjectOutlet,
      shippingAddress: row.shippingAddress,
      zone: row.customer.zone?.name ?? null,
      territory: row.customer.territory?.name ?? null,
      route: row.customer.route?.name ?? null,
      section: row.customer.section?.name ?? null,
      refCustomerPo: row.refCustomerPo,
      refCustomerPoDate: row.refCustomerPoDate ? fromDbDate(row.refCustomerPoDate) : null,
      refCustomerPoAmount: optNum(row.refCustomerPoAmount),
      refInvoice: row.refInvoice,
      salesTotal: num(row.salesTotal),
      salesPersonName: row.salesPerson?.name ?? null,
      orderType: row.orderType,
      paymentMethod: row.paymentMethod,
      updatedAt: row.updatedAt.toISOString(),
    })),
  };
}

const detailInclude = {
  businessUnit: { select: { companyId: true, company: { select: { name: true } } } },
  office: { select: { name: true, address: true } },
  customer: {
    select: {
      code: true,
      name: true,
      phone: true,
      customerGroup: { select: { name: true } },
      territory: { select: { name: true } },
    },
  },
  salesPerson: { select: { name: true } },
  quotation: { select: { number: true } },
  priceList: { select: { name: true } },
  deliveryPendingReason: { select: { name: true } },
  lines: { orderBy: { lineNo: "asc" }, include: { item: { select: { code: true, name: true } } } },
  events: { orderBy: { createdAt: "asc" } },
} satisfies Prisma.SalesOrderInclude;

type OrderRecord = Prisma.SalesOrderGetPayload<{ include: typeof detailInclude }>;

function toDetail(record: OrderRecord, nameOf: (id: string | null | undefined) => string | null): OrderDetail {
  const closing = [...record.events].reverse().find((event) => event.toStatus === "COMPLETED" || event.toStatus === "CANCELLED");
  return {
    id: record.id,
    number: record.number,
    status: record.status,
    holdReason: record.holdReason,
    businessUnitId: record.businessUnitId,
    companyName: record.businessUnit.company.name,
    officeId: record.officeId,
    officeName: record.office.name,
    officeAddress: record.office.address,
    customerId: record.customerId,
    customerCode: record.customer.code,
    customerName: record.customer.name,
    customerPhone: record.customer.phone,
    customerGroup: record.customer.customerGroup?.name ?? null,
    territory: record.customer.territory?.name ?? null,
    salesPersonId: record.salesPersonId,
    salesPersonName: record.salesPerson?.name ?? null,
    quotationId: record.quotationId,
    quotationNumber: record.quotation?.number ?? null,
    priceListId: record.priceListId,
    priceListName: record.priceList?.name ?? null,
    shipToAddressId: record.shipToAddressId,
    orderType: record.orderType,
    paymentMethod: record.paymentMethod,
    orderDate: fromDbDate(record.orderDate),
    expectedDeliveryDate: fromDbDate(record.expectedDeliveryDate),
    priceIncludesVat: record.priceIncludesVat,
    isForeign: record.isForeign,
    shippingAddress: record.shippingAddress,
    billingAddress: record.billingAddress,
    contactPerson: record.contactPerson,
    referredBy: record.referredBy,
    refCustomerPo: record.refCustomerPo,
    refCustomerPoDate: record.refCustomerPoDate ? fromDbDate(record.refCustomerPoDate) : null,
    refCustomerPoAmount: optNum(record.refCustomerPoAmount),
    refInvoice: record.refInvoice,
    refProjectOutlet: record.refProjectOutlet,
    paymentTermDays: record.paymentTermDays,
    dueLimit: num(record.dueLimit),
    remarks: record.remarks,
    terms: record.terms,
    totalQty: num(record.totalQty),
    itemsTotal: num(record.itemsTotal),
    itemsBase: num(record.itemsBase),
    vatAmount: num(record.vatAmount),
    aitAmount: num(record.aitAmount),
    discountAmount: num(record.discountAmount),
    deliveryCharge: num(record.deliveryCharge),
    unloadingCharge: num(record.unloadingCharge),
    salesTotal: num(record.salesTotal),
    createdBy: record.createdBy,
    updatedBy: record.updatedBy,
    createdByName: nameOf(record.createdBy),
    updatedByName: nameOf(record.updatedBy),
    pendingReasonName: record.deliveryPendingReason?.name ?? null,
    closedRemarks: closing?.remarks ?? null,
    submittedAt: record.submittedAt?.toISOString() ?? null,
    approvedAt: record.approvedAt?.toISOString() ?? null,
    closedAt: record.closedAt?.toISOString() ?? null,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    lines: record.lines.map((line) => ({
      id: line.id,
      lineNo: line.lineNo,
      itemId: line.itemId,
      itemCode: line.item.code,
      itemName: line.item.name,
      uom: line.uom,
      altUom: line.altUom,
      altUomFactor: optNum(line.altUomFactor),
      qty: num(line.qty),
      deliveredQty: num(line.deliveredQty),
      unitPrice: num(line.unitPrice),
      mrp: optNum(line.mrp),
      discountPercent: num(line.discountPercent),
      vatPercent: num(line.vatPercent),
      aitPercent: num(line.aitPercent),
      grossAmount: num(line.grossAmount),
      lineTotal: num(line.lineTotal),
      baseAmount: num(line.baseAmount),
      vatAmount: num(line.vatAmount),
      aitAmount: num(line.aitAmount),
    })),
    events: record.events.map((event) => ({
      id: event.id,
      action: event.action,
      fromStatus: event.fromStatus,
      toStatus: event.toStatus,
      remarks: event.remarks,
      actorId: event.actorId,
      actorName: nameOf(event.actorId),
      createdAt: event.createdAt.toISOString(),
    })),
  };
}

async function loadOrder(actor: Actor, id: string): Promise<OrderRecord> {
  const record = await db().salesOrder.findUnique({ where: { id }, include: detailInclude });
  if (!record) throw notFound("Sales order");
  assertCompanyAccess(actor, record.businessUnit.companyId, "Sales order");
  return record;
}

export async function getOrder(actor: Actor, id: string): Promise<OrderDetail> {
  const record = await loadOrder(actor, id);
  const nameOf = await userNames([record.createdBy, record.updatedBy, ...record.events.map((event) => event.actorId)]);
  return toDetail(record, nameOf);
}

// ─── Write ───────────────────────────────────────────────────────────────────

type ParsedInput = ReturnType<typeof orderInputSchema.parse>;

/**
 * Validates every reference against the office's business unit and returns
 * the stored header and lines (amounts computed here, never trusted from the client).
 */
async function prepare(actor: Actor, input: ParsedInput, currentOrderId?: string) {
  const office = await requireOffice(actor, input.officeId);
  const businessUnitId = office.businessUnitId;
  const itemIds = [...new Set(input.lines.map((line) => line.itemId))];

  const [customer, salesPerson, priceList, shipTo, quotation, items] = await Promise.all([
    db().customer.findFirst({
      where: { id: input.customerId, businessUnitId },
      select: { id: true, isActive: true, address: true },
    }),
    input.salesPersonId ? db().salesPerson.findFirst({ where: { id: input.salesPersonId, businessUnitId }, select: { id: true } }) : null,
    input.priceListId ? db().priceList.findFirst({ where: { id: input.priceListId, businessUnitId }, select: { id: true } }) : null,
    input.shipToAddressId
      ? db().customerAddress.findFirst({ where: { id: input.shipToAddressId, customerId: input.customerId }, select: { address: true } })
      : null,
    input.quotationId
      ? db().salesQuotation.findFirst({
          where: { id: input.quotationId, businessUnitId, customerId: input.customerId },
          select: { id: true, status: true, salesOrders: { where: { status: { not: "CANCELLED" } }, select: { id: true } } },
        })
      : null,
    db().item.findMany({
      where: { id: { in: itemIds }, businessUnitId },
      select: { id: true, uom: true, altUom: true, altUomFactor: true, mrp: true, isActive: true },
    }),
  ]);

  if (!customer) throw badRequest("Customer does not belong to the office's business unit.");
  if (!customer.isActive) throw badRequest("Customer is disabled.");
  if (input.salesPersonId && !salesPerson) throw badRequest("Sales force does not belong to the office's business unit.");
  if (input.priceListId && !priceList) throw badRequest("Price type does not belong to the office's business unit.");
  if (input.shipToAddressId && !shipTo) throw badRequest("Ship-to address does not belong to the customer.");
  if (input.quotationId) {
    if (!quotation) throw badRequest("Quotation not found for this customer.");
    const linkedHere = quotation.salesOrders.some((order) => order.id === currentOrderId);
    if (!linkedHere && quotation.status !== "SUBMITTED") {
      throw conflict("Only a submitted quotation can be turned into a sales order.");
    }
  }
  const itemById = new Map(items.map((item) => [item.id, item]));
  for (const itemId of itemIds) {
    const item = itemById.get(itemId);
    if (!item) throw badRequest("An item does not belong to the office's business unit.");
    if (!item.isActive) throw badRequest("A selected item is disabled.");
  }

  const totals = orderTotals(input.lines, input);
  return {
    businessUnitId,
    header: {
      officeId: input.officeId,
      customerId: input.customerId,
      salesPersonId: input.salesPersonId,
      priceListId: input.priceListId,
      shipToAddressId: input.shipToAddressId,
      orderType: input.orderType,
      paymentMethod: input.paymentMethod,
      orderDate: toDbDate(input.orderDate),
      expectedDeliveryDate: toDbDate(input.expectedDeliveryDate),
      priceIncludesVat: input.priceIncludesVat,
      isForeign: input.isForeign,
      shippingAddress: shipTo?.address ?? input.shippingAddress,
      billingAddress: customer.address,
      contactPerson: input.contactPerson,
      referredBy: input.referredBy,
      refCustomerPo: input.refCustomerPo,
      refCustomerPoDate: input.refCustomerPoDate ? toDbDate(input.refCustomerPoDate) : null,
      refCustomerPoAmount: input.refCustomerPoAmount,
      refInvoice: input.refInvoice,
      refProjectOutlet: input.refProjectOutlet,
      paymentTermDays: input.paymentTermDays,
      dueLimit: input.dueLimit,
      remarks: input.remarks,
      terms: input.terms,
      totalQty: totals.totalQty,
      itemsTotal: totals.itemsTotal,
      itemsBase: totals.itemsBase,
      vatAmount: totals.vatAmount,
      aitAmount: totals.aitAmount,
      discountAmount: totals.discountAmount,
      deliveryCharge: totals.deliveryCharge,
      unloadingCharge: totals.unloadingCharge,
      salesTotal: totals.salesTotal,
    },
    lines: input.lines.map((line, index) => {
      const item = itemById.get(line.itemId)!;
      const amounts = totals.lines[index];
      return {
        lineNo: index + 1,
        itemId: line.itemId,
        uom: item.uom,
        altUom: item.altUom,
        altUomFactor: item.altUomFactor,
        mrp: item.mrp,
        qty: line.qty,
        unitPrice: line.unitPrice,
        discountPercent: line.discountPercent,
        vatPercent: line.vatPercent,
        aitPercent: line.aitPercent,
        grossAmount: amounts.grossAmount,
        lineTotal: amounts.lineTotal,
        baseAmount: amounts.baseAmount,
        vatAmount: amounts.vatAmount,
        aitAmount: amounts.aitAmount,
      };
    }),
  };
}

type Tx = Prisma.TransactionClient;

function logEvent(
  tx: Tx,
  orderId: string,
  actor: Actor,
  action: string,
  fromStatus: OrderStatus | null,
  toStatus: OrderStatus,
  remarks?: string | null,
) {
  return tx.salesOrderEvent.create({
    data: { orderId, action, fromStatus, toStatus, remarks: remarks ?? null, actorId: actor.id },
  });
}

/** A quotation goes back to Submitted when no live order references it any more. */
async function releaseQuotation(tx: Tx, quotationId: string | null, orderId: string) {
  if (!quotationId) return;
  const others = await tx.salesOrder.count({
    where: { quotationId, id: { not: orderId }, status: { not: "CANCELLED" } },
  });
  if (others === 0) await tx.salesQuotation.updateMany({ where: { id: quotationId, status: "ORDERED" }, data: { status: "SUBMITTED" } });
}

export async function createOrder(actor: Actor, raw: unknown): Promise<OrderDetail> {
  const input = orderInputSchema.parse(raw);
  const { businessUnitId, header, lines } = await prepare(actor, input);
  const year = Number(input.orderDate.slice(0, 4));

  const created = await db().$transaction(async (tx) => {
    if (input.quotationId) {
      const { count } = await tx.salesQuotation.updateMany({
        where: { id: input.quotationId, status: "SUBMITTED" },
        data: { status: "ORDERED" },
      });
      if (count === 0) throw conflict("The quotation is no longer open. Reload it and try again.");
    }
    const number = formatNumber(PREFIX, year, await nextNumber(tx, businessUnitId, DOC_TYPE, year));
    const order = await tx.salesOrder.create({
      data: {
        ...header,
        businessUnitId,
        quotationId: input.quotationId,
        number,
        createdBy: actor.id,
        updatedBy: actor.id,
        lines: { create: lines },
      },
      select: { id: true },
    });
    await logEvent(tx, order.id, actor, "CREATED", null, "DRAFT", input.quotationId ? "Created from quotation" : null);
    return order;
  });
  return getOrder(actor, created.id);
}

/** Explains why a guarded write matched no row. */
async function staleOrWrongStatus(id: string, allowed: readonly OrderStatus[], verb: string): Promise<never> {
  const current = await db().salesOrder.findUnique({ where: { id }, select: { status: true } });
  if (!current) throw notFound("Sales order");
  if (!allowed.includes(current.status)) {
    const label = current.status.toLowerCase().replace("_", " ");
    throw conflict(`An order that is ${label} cannot be ${verb}.`, { status: current.status });
  }
  throw conflict("Someone else changed this order. Reload it and try again.");
}

export async function updateOrder(actor: Actor, id: string, raw: unknown): Promise<OrderDetail> {
  const { version, data } = orderUpdateSchema.parse(raw);
  const existing = await loadOrder(actor, id);
  if (existing.status !== "DRAFT") await staleOrWrongStatus(id, ["DRAFT"], "edited");
  // The quotation link is fixed at creation.
  const { businessUnitId, header, lines } = await prepare(actor, { ...data, quotationId: existing.quotationId }, id);
  if (businessUnitId !== existing.businessUnitId) {
    throw badRequest("The office must stay in the same business unit. Create a new order instead.");
  }

  await db().$transaction(async (tx) => {
    const { count } = await tx.salesOrder.updateMany({
      where: { id, status: "DRAFT", updatedAt: new Date(version) },
      data: { ...header, updatedBy: actor.id },
    });
    if (count === 0) await staleOrWrongStatus(id, ["DRAFT"], "edited");
    await tx.salesOrderLine.deleteMany({ where: { orderId: id } });
    await tx.salesOrderLine.createMany({ data: lines.map((line) => ({ ...line, orderId: id })) });
    await logEvent(tx, id, actor, "UPDATED", "DRAFT", "DRAFT");
  });
  return getOrder(actor, id);
}

export async function deleteOrder(actor: Actor, id: string): Promise<void> {
  const existing = await loadOrder(actor, id);
  await db().$transaction(async (tx) => {
    const { count } = await tx.salesOrder.deleteMany({ where: { id, status: "DRAFT" } });
    if (count === 0) await staleOrWrongStatus(id, ["DRAFT"], "deleted");
    await releaseQuotation(tx, existing.quotationId, id);
  });
}

/** Credit rules for a submitted order (cash orders are never held). */
async function holdReasonFor(order: OrderRecord, today: string): Promise<{ reason: HoldReason; message: string } | null> {
  if (order.paymentMethod === "CASH") return null;
  const customer = await db().customer.findUniqueOrThrow({ where: { id: order.customerId }, select: { creditLimit: true } });
  const [balances, openOrders] = await Promise.all([
    customerBalances({ businessUnitIds: [order.businessUnitId], asOf: toDbDate(today), customerIds: [order.customerId] }),
    openOrderValue(order.customerId, order.id),
  ]);
  const balance = balances.get(order.customerId);
  const outstanding = balance?.outstanding ?? 0;
  const limit = customer.creditLimit?.toNumber();
  const exposure = money(outstanding + openOrders + order.salesTotal.toNumber());
  if (limit !== undefined && exposure > limit) {
    return {
      reason: "CREDIT_LIMIT_EXCEEDED",
      message: `Exposure ${exposure.toFixed(2)} (outstanding ${outstanding.toFixed(2)} + open orders ${openOrders.toFixed(2)} + this order) exceeds the credit limit ${limit.toFixed(2)}.`,
    };
  }
  if (balance && balance.overdue > 0) {
    return { reason: "OVERDUE_BALANCE", message: `Customer has ${balance.overdue.toFixed(2)} overdue.` };
  }
  return null;
}

function requireApprover(actor: Actor) {
  if (!actor.permissions.has("sales:approve")) {
    throw new AppError(403, "FORBIDDEN", "You do not have permission to approve sales orders.");
  }
}

export async function changeOrderStatus(actor: Actor, id: string, raw: unknown): Promise<OrderDetail> {
  const { action, version, remarks, today } = orderActionSchema.parse(raw);
  const order = await loadOrder(actor, id);
  const now = new Date();

  // Each case: allowed source statuses, the update, and the event(s) to log.
  const guarded = async (
    from: readonly OrderStatus[],
    verb: string,
    data: Prisma.SalesOrderUpdateManyMutationInput,
    events: { action: string; to: OrderStatus; remarks?: string | null }[],
    after?: (tx: Tx) => Promise<void>,
  ) => {
    await db().$transaction(async (tx) => {
      const { count } = await tx.salesOrder.updateMany({
        where: { id, status: { in: [...from] }, updatedAt: new Date(version) },
        data: { ...data, updatedBy: actor.id },
      });
      if (count === 0) await staleOrWrongStatus(id, from, verb);
      let fromStatus: OrderStatus = order.status;
      for (const event of events) {
        await logEvent(tx, id, actor, event.action, fromStatus, event.to, event.remarks);
        fromStatus = event.to;
      }
      await after?.(tx);
    });
  };

  switch (action) {
    case "submit": {
      if (order.status !== "DRAFT") await staleOrWrongStatus(id, ["DRAFT"], "submitted");
      const hold = await holdReasonFor(order, today);
      const note = (reason: string) => (remarks ? `${reason} ${remarks}` : reason);
      if (hold) {
        await guarded(["DRAFT"], "submitted", { status: "PENDING_APPROVAL", holdReason: hold.reason, submittedAt: now }, [
          { action: "SUBMITTED_FOR_APPROVAL", to: "PENDING_APPROVAL", remarks: note(hold.message) },
        ]);
      } else {
        const reason = order.paymentMethod === "CASH" ? "Cash order: approved automatically." : "Within credit limit: approved automatically.";
        await guarded(["DRAFT"], "submitted", { status: "APPROVED", holdReason: null, submittedAt: now, approvedAt: now }, [
          { action: "SUBMITTED", to: "APPROVED", remarks: note(reason) },
        ]);
      }
      break;
    }
    case "approve":
      requireApprover(actor);
      await guarded(["PENDING_APPROVAL"], "approved", { status: "APPROVED", holdReason: null, approvedAt: now }, [
        { action: "APPROVED", to: "APPROVED", remarks },
      ]);
      break;
    case "reject":
      requireApprover(actor);
      if (!remarks) throw badRequest("Enter why the order is rejected.");
      await guarded(["PENDING_APPROVAL"], "rejected", { status: "DRAFT", holdReason: null, submittedAt: null }, [
        { action: "REJECTED", to: "DRAFT", remarks },
      ]);
      break;
    case "cancel": {
      if (!remarks) throw badRequest("Enter why the order is cancelled.");
      if (order.lines.some((line) => line.deliveredQty.toNumber() > 0)) {
        throw conflict("Part of this order is delivered. Close it instead of cancelling.");
      }
      await guarded(
        ["PENDING_APPROVAL", "APPROVED"],
        "cancelled",
        { status: "CANCELLED", holdReason: null, closedAt: now },
        [{ action: "CANCELLED", to: "CANCELLED", remarks }],
        (tx) => releaseQuotation(tx, order.quotationId, id),
      );
      break;
    }
    case "complete":
      if (!remarks) throw badRequest("Enter why the order is closed before full delivery.");
      await guarded(["APPROVED"], "closed", { status: "COMPLETED", closedAt: now }, [
        { action: "CLOSED", to: "COMPLETED", remarks },
      ]);
      break;
  }
  return getOrder(actor, id);
}
