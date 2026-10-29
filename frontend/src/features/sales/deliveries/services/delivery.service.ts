import { Prisma } from "@/generated/prisma/client";
import { badRequest, conflict, notFound } from "@/lib/api/errors";
import { assertCompanyAccess, type Actor } from "@/lib/auth/actor";
import { db } from "@/lib/prisma/client";
import { money } from "../../dashboard/lib/aggregate";
import { fromDbDate, toDbDate } from "../../lib/dates";
import { customerLedger } from "../../lib/receivables";
import { requireOffice, scopedBusinessUnitIds } from "../../lib/scope";
import { territoryCustomerWhere } from "../../lib/territory";
import { companyDocumentNumber } from "../../lib/sequence";
import { userNames } from "../../lib/users";
import { orderLineAmounts, orderTotals } from "../../orders/lib/order-totals";
import { round2 } from "../../quotations/lib/totals";
import {
  approvedOrderQuerySchema,
  deliveryConfirmSchema,
  deliveryDeleteSchema,
  deliveryInputSchema,
  deliveryListQuerySchema,
  deliveryReferenceSchema,
  deliveryUpdateSchema,
  pendingNoteSchema,
  pendingReasonSchema,
  type ApprovedOrderQuery,
  type ApprovedOrderRow,
  type DeliveryDetail,
  type DeliveryList,
  type OrderForDelivery,
  type PendingNote,
} from "../schemas/delivery.schema";
import { deliverySettlements } from "../../collections/services/collection.service";
import { approveReturn, createReturn, lockDeliveryReturns, returnNumber } from "../../returns/services/return.service";
import { assertStockAvailable, lockWarehouse, requireWarehouse, stockLevels } from "./stock.service";
import { requireDriver } from "./vehicle.service";

/** Rows a list returns; totals cover every match. */
export const DELIVERY_LIST_LIMIT = 1000;
/** Delivery times are entered and shown in Bangladesh time (UTC+6, no DST). */
const LOCAL_OFFSET = "+06:00";

type Tx = Prisma.TransactionClient;
type ParsedInput = ReturnType<typeof deliveryInputSchema.parse>;

const num = (value: Prisma.Decimal | null | undefined) => (value ? value.toNumber() : 0);
const optNum = (value: Prisma.Decimal | null | undefined) => (value ? value.toNumber() : null);
const round3 = (value: number) => Math.round(value * 1000) / 1000;
const isUnique = (error: unknown) => error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";

function deliveredAt(date: string, time: string | null): Date | null {
  return time ? new Date(`${date}T${time}:00${LOCAL_OFFSET}`) : null;
}

/** UTC instant → "HH:MM" in Bangladesh time. */
function localTime(value: Date | null): string | null {
  if (!value) return null;
  const shifted = new Date(value.getTime() + 6 * 60 * 60 * 1000);
  return shifted.toISOString().slice(11, 16);
}

function addDaysToDate(date: string, days: number): Date {
  const value = toDbDate(date);
  value.setUTCDate(value.getUTCDate() + days);
  return value;
}

const areaSelect = { select: { name: true } } as const;

function customerFilter(query: {
  customerGroupId?: string;
  zoneId?: string;
  territoryId?: string;
  /** The Territory filter resolved over the Sales Setup tree. */
  territory?: Prisma.CustomerWhereInput;
  routeId?: string;
  sectionId?: string;
}): Prisma.CustomerWhereInput | undefined {
  const filter: Prisma.CustomerWhereInput = {
    ...(query.customerGroupId ? { customerGroupId: query.customerGroupId } : {}),
    ...(query.zoneId ? { zoneId: query.zoneId } : {}),
    ...(query.territory ?? (query.territoryId ? { territoryId: query.territoryId } : {})),
    ...(query.routeId ? { routeId: query.routeId } : {}),
    ...(query.sectionId ? { sectionId: query.sectionId } : {}),
  };
  return Object.keys(filter).length ? filter : undefined;
}

function dateRange(from?: string, to?: string) {
  if (!from && !to) return undefined;
  return { ...(from ? { gte: toDbDate(from) } : {}), ...(to ? { lte: toDbDate(to) } : {}) };
}

// ─── Approved SO tab ─────────────────────────────────────────────────────────

export async function listApprovedOrders(actor: Actor, raw: unknown): Promise<ApprovedOrderRow[]> {
  const query: ApprovedOrderQuery = approvedOrderQuerySchema.parse(raw);
  const unitIds = await scopedBusinessUnitIds(actor);
  const customer = customerFilter({ ...query, territory: await territoryCustomerWhere(query.territoryId) });
  const orders = await db().salesOrder.findMany({
    where: {
      businessUnitId: { in: unitIds },
      status: "APPROVED",
      ...(query.officeId ? { officeId: query.officeId } : {}),
      ...(query.customerId ? { customerId: query.customerId } : {}),
      ...(query.salesPersonId ? { salesPersonId: query.salesPersonId } : {}),
      ...(dateRange(query.from, query.to) ? { orderDate: dateRange(query.from, query.to) } : {}),
      ...(query.search
        ? {
            OR: [
              { number: { contains: query.search, mode: "insensitive" } },
              { refCustomerPo: { contains: query.search, mode: "insensitive" } },
              { customer: { name: { contains: query.search, mode: "insensitive" } } },
              { customer: { code: { contains: query.search, mode: "insensitive" } } },
            ],
          }
        : {}),
      ...(customer ? { customer } : {}),
      ...(query.status === "PARTIALLY_DELIVERED"
        ? { lines: { some: { deliveredQty: { gt: 0 } } } }
        : query.status === "APPROVED"
          ? { lines: { none: { deliveredQty: { gt: 0 } } } }
          : {}),
    },
    select: {
      id: true,
      number: true,
      businessUnitId: true,
      orderDate: true,
      expectedDeliveryDate: true,
      shippingAddress: true,
      refCustomerPo: true,
      orderType: true,
      salesTotal: true,
      deliveryPendingReasonId: true,
      deliveryPendingReason: { select: { name: true } },
      updatedAt: true,
      office: { select: { name: true } },
      salesPerson: { select: { name: true } },
      customer: { select: { code: true, name: true, zone: areaSelect, territory: areaSelect, route: areaSelect, section: areaSelect } },
      lines: { select: { qty: true, deliveredQty: true } },
    },
    orderBy: [{ expectedDeliveryDate: "asc" }, { number: "asc" }],
    take: DELIVERY_LIST_LIMIT,
  });

  return orders.map((order) => {
    const ordered = order.lines.reduce((sum, line) => sum + num(line.qty), 0);
    const delivered = order.lines.reduce((sum, line) => sum + num(line.deliveredQty), 0);
    return {
      id: order.id,
      number: order.number,
      status: delivered > 0 ? "PARTIALLY_DELIVERED" : "APPROVED",
      orderDate: fromDbDate(order.orderDate),
      expectedDeliveryDate: fromDbDate(order.expectedDeliveryDate),
      officeName: order.office.name,
      customerCode: order.customer.code,
      customerName: order.customer.name,
      shippingAddress: order.shippingAddress,
      zone: order.customer.zone?.name ?? null,
      territory: order.customer.territory?.name ?? null,
      route: order.customer.route?.name ?? null,
      section: order.customer.section?.name ?? null,
      refCustomerPo: order.refCustomerPo,
      salesPersonName: order.salesPerson?.name ?? null,
      orderType: order.orderType,
      pendingReasonId: order.deliveryPendingReasonId,
      pendingReasonName: order.deliveryPendingReason?.name ?? null,
      salesTotal: num(order.salesTotal),
      deliveredPercent: ordered > 0 ? Math.round((delivered / ordered) * 100) : 0,
      businessUnitId: order.businessUnitId,
      updatedAt: order.updatedAt.toISOString(),
    };
  });
}

async function loadOrderForAccess(actor: Actor, orderId: string) {
  const order = await db().salesOrder.findUnique({
    where: { id: orderId },
    select: { businessUnitId: true, businessUnit: { select: { companyId: true } } },
  });
  if (!order) throw notFound("Sales order");
  assertCompanyAccess(actor, order.businessUnit.companyId, "Sales order");
  return order;
}

/** Previous Pending Reason of an order, oldest first. */
export async function listPendingNotes(actor: Actor, orderId: string): Promise<PendingNote[]> {
  await loadOrderForAccess(actor, orderId);
  const notes = await db().salesOrderPendingNote.findMany({ where: { orderId }, orderBy: { createdAt: "asc" } });
  const nameOf = await userNames(notes.map((note) => note.createdBy));
  return notes.map((note) => ({ id: note.id, reason: note.reason, createdByName: nameOf(note.createdBy), createdAt: note.createdAt.toISOString() }));
}

/**
 * Records why an approved order waits: the text is kept in the order's history and
 * becomes its current pending reason (a reusable reason of the business unit).
 */
export async function addPendingNote(actor: Actor, orderId: string, raw: unknown): Promise<PendingNote[]> {
  const { reason } = pendingNoteSchema.parse(raw);
  const order = await loadOrderForAccess(actor, orderId);
  await db().$transaction(async (tx) => {
    const existing = await tx.deliveryPendingReason.findFirst({
      where: { businessUnitId: order.businessUnitId, name: { equals: reason, mode: "insensitive" } },
      select: { id: true },
    });
    const master = existing ?? (await tx.deliveryPendingReason.create({ data: { businessUnitId: order.businessUnitId, name: reason }, select: { id: true } }));
    const { count } = await tx.salesOrder.updateMany({ where: { id: orderId, status: "APPROVED" }, data: { deliveryPendingReasonId: master.id } });
    if (count === 0) throw conflict("Only approved orders waiting for delivery can have a pending reason.");
    await tx.salesOrderPendingNote.create({ data: { orderId, reason, createdBy: actor.id } });
  });
  return listPendingNotes(actor, orderId);
}

export async function setOrderPendingReason(actor: Actor, orderId: string, raw: unknown): Promise<void> {
  const { reasonId } = pendingReasonSchema.parse(raw);
  const order = await loadOrderForAccess(actor, orderId);
  if (reasonId) {
    const reason = await db().deliveryPendingReason.findFirst({ where: { id: reasonId, businessUnitId: order.businessUnitId } });
    if (!reason) throw badRequest("Pending reason not found in this business unit.");
  }
  const { count } = await db().salesOrder.updateMany({
    where: { id: orderId, status: "APPROVED" },
    data: { deliveryPendingReasonId: reasonId },
  });
  if (count === 0) throw conflict("Only approved orders waiting for delivery can have a pending reason.");
}

/**
 * Approved order with what is left to deliver, for the "Delivery For SO" form.
 * When editing a delivery, pass its id: its own quantities count as not yet delivered.
 */
export async function getOrderForDelivery(actor: Actor, orderId: string, asOf: string, editingDeliveryId?: string): Promise<OrderForDelivery> {
  await loadOrderForAccess(actor, orderId);
  const order = await db().salesOrder.findUniqueOrThrow({
    where: { id: orderId },
    include: {
      office: { select: { name: true } },
      salesPerson: { select: { name: true } },
      priceList: { select: { name: true } },
      customer: {
        select: {
          code: true,
          name: true,
          phone: true,
          creditLimit: true,
          addresses: { select: { id: true, label: true, address: true }, orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }] },
        },
      },
      lines: { orderBy: { lineNo: "asc" }, include: { item: { select: { code: true, name: true, deliveryTolerancePercent: true } } } },
      events: { where: { action: { in: ["APPROVED", "SUBMITTED"] } }, orderBy: { createdAt: "desc" }, take: 1 },
      deliveries: { where: { status: "SUBMITTED" }, select: { deliveryCharge: true, unloadingCharge: true } },
    },
  });
  const own = new Map<string, number>();
  if (editingDeliveryId) {
    const lines = await db().salesDeliveryLine.findMany({
      where: { deliveryId: editingDeliveryId, delivery: { salesOrderId: orderId, status: "SUBMITTED" } },
      select: { orderLineId: true, qty: true },
    });
    for (const line of lines) if (line.orderLineId) own.set(line.orderLineId, num(line.qty));
  }
  const reopenedByEdit = order.status === "COMPLETED" && own.size > 0;
  if (order.status !== "APPROVED" && !reopenedByEdit) throw conflict("Only approved orders can be delivered.");

  // Signed, as on Managerium: an advance shows as a negative balance instead of 0.
  const ledgers = await customerLedger({ businessUnitIds: [order.businessUnitId], asOf: toDbDate(asOf), customerIds: [order.customerId] });
  const delivered = order.lines.some((line) => num(line.deliveredQty) > 0);

  return {
    id: order.id,
    number: order.number,
    status: delivered ? "PARTIALLY_DELIVERED" : "APPROVED",
    businessUnitId: order.businessUnitId,
    officeId: order.officeId,
    officeName: order.office.name,
    customerId: order.customerId,
    customerCode: order.customer.code,
    customerName: order.customer.name,
    customerPhone: order.customer.phone,
    billingAddress: order.billingAddress,
    shippingAddress: order.shippingAddress,
    shipToAddressId: order.shipToAddressId,
    addresses: order.customer.addresses,
    salesPersonId: order.salesPersonId,
    salesPersonName: order.salesPerson?.name ?? null,
    priceListName: order.priceList?.name ?? null,
    refProjectOutlet: order.refProjectOutlet,
    refCustomerPo: order.refCustomerPo,
    refCustomerPoDate: order.refCustomerPoDate ? fromDbDate(order.refCustomerPoDate) : null,
    refCustomerPoAmount: optNum(order.refCustomerPoAmount),
    refInvoice: order.refInvoice,
    orderDate: fromDbDate(order.orderDate),
    expectedDeliveryDate: fromDbDate(order.expectedDeliveryDate),
    approvedBy: (await userNames([order.events[0]?.actorId]))(order.events[0]?.actorId),
    remarks: order.remarks,
    terms: order.terms,
    paymentMethod: order.paymentMethod,
    paymentTermDays: order.paymentTermDays,
    priceIncludesVat: order.priceIncludesVat,
    discountAmount: num(order.discountAmount),
    itemsTotal: num(order.itemsTotal),
    deliveryCharge: num(order.deliveryCharge),
    unloadingCharge: num(order.unloadingCharge),
    ledgerBalance: ledgers.get(order.customerId) ?? 0,
    creditLimit: optNum(order.customer.creditLimit),
    chargesBilled: order.deliveries.some((delivery) => num(delivery.deliveryCharge) + num(delivery.unloadingCharge) > 0),
    lines: order.lines.map((line) => {
      const qty = num(line.qty);
      const deliveredQty = round3(num(line.deliveredQty) - (own.get(line.id) ?? 0));
      const tolerancePercent = num(line.item.deliveryTolerancePercent);
      return {
        orderLineId: line.id,
        itemId: line.itemId,
        itemCode: line.item.code,
        itemName: line.item.name,
        uom: line.uom,
        altUom: line.altUom,
        altUomFactor: optNum(line.altUomFactor),
        qty,
        deliveredQty,
        remaining: round3(Math.max(0, qty - deliveredQty)),
        tolerancePercent,
        maxQty: round3(Math.max(0, qty * (1 + tolerancePercent / 100) - deliveredQty)),
        unitPrice: num(line.unitPrice),
        discountPercent: num(line.discountPercent),
        vatPercent: num(line.vatPercent),
        aitPercent: num(line.aitPercent),
      };
    }),
  };
}

// ─── Delivery list ───────────────────────────────────────────────────────────

export async function listDeliveries(actor: Actor, raw: unknown): Promise<DeliveryList> {
  const query = deliveryListQuerySchema.parse(raw);
  const unitIds = await scopedBusinessUnitIds(actor);
  const customer = customerFilter({ ...query, territory: await territoryCustomerWhere(query.territoryId) });
  const where: Prisma.SalesDeliveryWhereInput = {
    businessUnitId: { in: unitIds },
    officeId: query.officeId ? query.officeId : { not: null },
    status: query.deleted ? "CANCELLED" : "SUBMITTED",
    ...(query.deliveryType ? { deliveryType: query.deliveryType } : {}),
    ...(query.confirmation ? { confirmation: query.confirmation } : {}),
    ...(query.paymentMethod ? { paymentMethod: query.paymentMethod } : {}),
    ...(query.vehicleNo ? { vehicleNo: { contains: query.vehicleNo, mode: "insensitive" } } : {}),
    ...(query.customerId ? { customerId: query.customerId } : {}),
    ...(dateRange(query.from, query.to) ? { deliveryDate: dateRange(query.from, query.to) } : {}),
    ...(query.search
      ? {
          OR: [
            { number: { contains: query.search, mode: "insensitive" } },
            { challanNo: { contains: query.search, mode: "insensitive" } },
            { buyerName: { contains: query.search, mode: "insensitive" } },
            { salesOrder: { number: { contains: query.search, mode: "insensitive" } } },
            { customer: { name: { contains: query.search, mode: "insensitive" } } },
            { customer: { code: { contains: query.search, mode: "insensitive" } } },
          ],
        }
      : {}),
    ...(customer ? { customer } : {}),
  };

  const [rows, aggregate] = await Promise.all([
    db().salesDelivery.findMany({
      where,
      select: {
        id: true,
        number: true,
        challanNo: true,
        vatChallanNo: true,
        deliveryType: true,
        confirmation: true,
        status: true,
        deliveryDate: true,
        salesOrderId: true,
        vehicleNo: true,
        refProjectOutlet: true,
        shippingAddress: true,
        refCustomerPo: true,
        refCustomerPoDate: true,
        refInvoice: true,
        paymentMethod: true,
        totalAmount: true,
        paidAmount: true,
        updatedAt: true,
        office: { select: { name: true } },
        salesOrder: { select: { number: true, orderDate: true } },
        salesPerson: { select: { name: true } },
        exchangeReturn: { select: { totalAmount: true } },
        returns: { where: { status: "SUBMITTED" }, select: { totalAmount: true } },
        customer: {
          select: { code: true, name: true, customerGroup: areaSelect, zone: areaSelect, route: areaSelect, section: areaSelect },
        },
      },
      orderBy: [{ deliveryDate: "desc" }, { number: "desc" }],
      skip: query.page ? (query.page - 1) * (query.pageSize ?? 50) : 0,
      take: query.page ? (query.pageSize ?? 50) : DELIVERY_LIST_LIMIT,
    }),
    db().salesDelivery.aggregate({ where, _sum: { totalAmount: true }, _count: true }),
  ]);

  const mapped = rows.map((row) => {
    const totalAmount = num(row.totalAmount);
    const paidAmount = num(row.paidAmount);
    // Goods taken back on the exchange plus approved sales returns of this delivery.
    const returnAmount = money(num(row.exchangeReturn?.totalAmount) + row.returns.reduce((sum, item) => sum + num(item.totalAmount), 0));
    return {
      id: row.id,
      number: row.number,
      challanNo: row.challanNo,
      vatChallanNo: row.vatChallanNo,
      deliveryType: row.deliveryType,
      confirmation: row.confirmation,
      deleted: row.status === "CANCELLED",
      deliveryDate: fromDbDate(row.deliveryDate),
      orderDate: row.salesOrder ? fromDbDate(row.salesOrder.orderDate) : null,
      orderNumber: row.salesOrder?.number ?? null,
      salesOrderId: row.salesOrderId,
      officeName: row.office?.name ?? null,
      salesPersonName: row.salesPerson?.name ?? null,
      vehicleNo: row.vehicleNo,
      customerGroup: row.customer.customerGroup?.name ?? null,
      customerCode: row.customer.code,
      customerName: row.customer.name,
      refProjectOutlet: row.refProjectOutlet,
      shippingAddress: row.shippingAddress,
      zone: row.customer.zone?.name ?? null,
      route: row.customer.route?.name ?? null,
      section: row.customer.section?.name ?? null,
      refCustomerPo: row.refCustomerPo,
      refCustomerPoDate: row.refCustomerPoDate ? fromDbDate(row.refCustomerPoDate) : null,
      refInvoice: row.refInvoice,
      paymentMethod: row.paymentMethod,
      totalAmount,
      paidAmount,
      returnAmount,
      pendingAmount: money(Math.max(0, totalAmount - returnAmount - paidAmount)),
      updatedAt: row.updatedAt.toISOString(),
    };
  });

  return {
    rows: mapped,
    totalCount: aggregate._count,
    totalAmount: num(aggregate._sum.totalAmount),
    pendingAmount: money(mapped.reduce((sum, row) => sum + row.pendingAmount, 0)),
  };
}

// ─── Detail ──────────────────────────────────────────────────────────────────

const detailInclude = {
  businessUnit: { select: { companyId: true, company: { select: { name: true } } } },
  office: { select: { name: true, address: true, binNumber: true } },
  warehouse: { select: { name: true } },
  salesOrder: { select: { number: true, orderDate: true, expectedDeliveryDate: true, lines: { select: { qty: true, deliveredQty: true } } } },
  salesPerson: { select: { name: true } },
  driver: { select: { name: true } },
  vehicle: { select: { vehicleSize: true } },
  customer: {
    select: { code: true, name: true, phone: true, binNumber: true, customerGroup: areaSelect, territory: areaSelect },
  },
  lines: {
    orderBy: { lineNo: "asc" },
    include: {
      item: { select: { code: true, name: true } },
      returnLines: { where: { salesReturn: { status: "SUBMITTED" } }, select: { qty: true } },
    },
  },
  returns: { where: { status: "SUBMITTED" }, select: { totalAmount: true } },
  exchangeReturn: {
    select: {
      id: true,
      number: true,
      reason: true,
      totalAmount: true,
      lines: { orderBy: { lineNo: "asc" }, include: { item: { select: { code: true, name: true, uom: true } } } },
    },
  },
} satisfies Prisma.SalesDeliveryInclude;

type DeliveryRecord = Prisma.SalesDeliveryGetPayload<{ include: typeof detailInclude }>;

function toDetail(record: DeliveryRecord): DeliveryDetail {
  const totalAmount = num(record.totalAmount);
  const paidAmount = num(record.paidAmount);
  return {
    id: record.id,
    number: record.number,
    challanNo: record.challanNo,
    vatChallanNo: record.vatChallanNo,
    deliveryType: record.deliveryType,
    confirmation: record.confirmation,
    status: record.status,
    businessUnitId: record.businessUnitId,
    companyName: record.businessUnit.company.name,
    officeId: record.officeId,
    officeName: record.office?.name ?? null,
    officeAddress: record.office?.address ?? null,
    officeBin: record.office?.binNumber ?? null,
    warehouseId: record.warehouseId,
    warehouseName: record.warehouse?.name ?? null,
    salesOrderId: record.salesOrderId,
    orderNumber: record.salesOrder?.number ?? null,
    orderDate: record.salesOrder ? fromDbDate(record.salesOrder.orderDate) : null,
    expectedDeliveryDate: record.salesOrder ? fromDbDate(record.salesOrder.expectedDeliveryDate) : null,
    customerId: record.customerId,
    customerCode: record.customer.code,
    customerName: record.customer.name,
    customerPhone: record.customer.phone,
    customerBin: record.customer.binNumber,
    customerGroup: record.customer.customerGroup?.name ?? null,
    territory: record.customer.territory?.name ?? null,
    salesPersonId: record.salesPersonId,
    salesPersonName: record.salesPerson?.name ?? null,
    deliveryDate: fromDbDate(record.deliveryDate),
    deliveryTime: localTime(record.deliveredAt),
    dueDate: fromDbDate(record.dueDate),
    shipToAddressId: record.shipToAddressId,
    shippingAddress: record.shippingAddress,
    billingAddress: record.billingAddress,
    contactPerson: record.contactPerson,
    refCustomerPo: record.refCustomerPo,
    refCustomerPoDate: record.refCustomerPoDate ? fromDbDate(record.refCustomerPoDate) : null,
    refInvoice: record.refInvoice,
    refProjectOutlet: record.refProjectOutlet,
    paymentMethod: record.paymentMethod,
    paymentTermDays: record.paymentTermDays,
    priceIncludesVat: record.priceIncludesVat,
    vehicleNo: record.vehicleNo,
    driverName: record.driverName,
    driverPhone: record.driverPhone,
    transporterName: record.transporterName,
    vehicleId: record.vehicleId,
    driverEmployeeId: record.driverEmployeeId,
    driverEmployeeName: record.driver?.name ?? null,
    vehicleSize: record.vehicle?.vehicleSize ?? null,
    securityCode: record.securityCode,
    referredBy: record.referredBy,
    buyerName: record.buyerName,
    buyerMobile: record.buyerMobile,
    salesType: record.salesType,
    totalQty: num(record.totalQty),
    itemsTotal: num(record.itemsTotal),
    itemsBase: num(record.itemsBase),
    vatAmount: num(record.vatAmount),
    aitAmount: num(record.aitAmount),
    discountAmount: num(record.discountAmount),
    deliveryCharge: num(record.deliveryCharge),
    unloadingCharge: num(record.unloadingCharge),
    totalAmount,
    paidAmount,
    returnAmount: money(num(record.exchangeReturn?.totalAmount) + record.returns.reduce((sum, item) => sum + num(item.totalAmount), 0)),
    pendingAmount: money(Math.max(0, totalAmount - paidAmount - num(record.exchangeReturn?.totalAmount) - record.returns.reduce((sum, item) => sum + num(item.totalAmount), 0))),
    invoiceType: paidAmount >= totalAmount && totalAmount > 0 ? "Paid" : "Due",
    orderFullyDelivered: record.salesOrder
      ? record.salesOrder.lines.every((line) => num(line.deliveredQty) >= num(line.qty))
      : null,
    terms: record.terms,
    remarks: record.remarks,
    actualDeliveryDate: record.actualDeliveryDate ? fromDbDate(record.actualDeliveryDate) : null,
    confirmedAt: record.confirmedAt?.toISOString() ?? null,
    confirmedBy: record.confirmedBy,
    deletedAt: record.deletedAt?.toISOString() ?? null,
    deletedBy: record.deletedBy,
    deleteReason: record.deleteReason,
    createdBy: record.createdBy,
    updatedBy: record.updatedBy,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    lines: record.lines.map((line) => ({
      id: line.id,
      lineNo: line.lineNo,
      itemId: line.itemId,
      itemCode: line.item.code,
      itemName: line.item.name,
      orderLineId: line.orderLineId,
      uom: line.uom,
      altUom: line.altUom,
      altUomFactor: optNum(line.altUomFactor),
      qty: num(line.qty),
      rate: num(line.rate),
      discountPercent: num(line.discountPercent),
      vatPercent: num(line.vatPercent),
      aitPercent: num(line.aitPercent),
      grossAmount: num(line.grossAmount),
      baseAmount: num(line.baseAmount),
      vatAmount: num(line.vatAmount),
      aitAmount: num(line.aitAmount),
      amount: num(line.amount),
      returnedQty: round3(line.returnLines.reduce((sum, returned) => sum + num(returned.qty), 0)),
      stock: null,
    })),
    exchangeReturn: record.exchangeReturn
      ? {
          id: record.exchangeReturn.id,
          number: record.exchangeReturn.number,
          reason: record.exchangeReturn.reason,
          totalAmount: num(record.exchangeReturn.totalAmount),
          lines: record.exchangeReturn.lines.map((line) => ({
            id: line.id,
            itemId: line.itemId,
            itemCode: line.item.code,
            itemName: line.item.name,
            uom: line.item.uom,
            qty: num(line.qty),
            rate: num(line.rate),
            amount: num(line.amount),
          })),
        }
      : null,
  };
}

async function loadDelivery(actor: Actor, id: string): Promise<DeliveryRecord> {
  const record = await db().salesDelivery.findUnique({ where: { id }, include: detailInclude });
  if (!record || !record.officeId) throw notFound("Delivery");
  assertCompanyAccess(actor, record.businessUnit.companyId, "Delivery");
  return record;
}

export async function getDelivery(actor: Actor, id: string): Promise<DeliveryDetail> {
  const detail = toDetail(await loadDelivery(actor, id));
  if (detail.warehouseId) {
    const levels = await stockLevels(detail.warehouseId, [...new Set(detail.lines.map((line) => line.itemId))]);
    for (const line of detail.lines) line.stock = levels.get(line.itemId) ?? 0;
  }
  // Show who did what by name, not by user id.
  const nameOf = await userNames([detail.createdBy, detail.updatedBy, detail.confirmedBy, detail.deletedBy]);
  return { ...detail, createdBy: nameOf(detail.createdBy), updatedBy: nameOf(detail.updatedBy), confirmedBy: nameOf(detail.confirmedBy), deletedBy: nameOf(detail.deletedBy) };
}

// ─── Plan: validate input and price every line ───────────────────────────────

interface PlannedLine {
  lineNo: number;
  itemId: string;
  orderLineId: string | null;
  uom: string;
  altUom: string | null;
  altUomFactor: Prisma.Decimal | null;
  qty: number;
  rate: number;
  discountPercent: number;
  vatPercent: number;
  aitPercent: number;
  grossAmount: number;
  baseAmount: number;
  vatAmount: number;
  aitAmount: number;
  amount: number;
}

interface Plan {
  businessUnitId: string;
  salesOrderId: string | null;
  header: Omit<Prisma.SalesDeliveryUncheckedCreateInput, "businessUnitId" | "number" | "lines" | "challanNo"> & { challanNo: string | null };
  lines: PlannedLine[];
  /** Exchange: goods taken back. */
  received: { lineNo: number; itemId: string; qty: number; rate: number; amount: number }[];
  returnTotal: number;
  reason: string | null;
  itemNames: Map<string, string>;
}

async function plan(actor: Actor, input: ParsedInput): Promise<Plan> {
  const office = await requireOffice(actor, input.officeId);
  const warehouse = await requireWarehouse(actor, input.warehouseId);
  if (warehouse.officeId !== office.id) throw badRequest("The warehouse belongs to another office.");
  const businessUnitId = office.businessUnitId;

  let customerId: string;
  let salesOrderId: string | null = null;
  /** For order deliveries: ship-to, sales force and contact default to the order. */
  let orderDefaults: { shipToAddressId: string | null; shippingAddress: string | null; salesPersonId: string | null; contactPerson: string | null } | null = null;
  let priceIncludesVat: boolean;
  let lines: PlannedLine[];
  let discountAmount: number;
  const itemNames = new Map<string, string>();

  if (input.deliveryType === "SALES_ORDER") {
    const order = await db().salesOrder.findFirst({
      where: { id: input.salesOrderId, businessUnitId },
      include: { lines: { include: { item: { select: { name: true, uom: true } } } } },
    });
    if (!order) throw badRequest("Sales order not found in the office's business unit.");
    customerId = order.customerId;
    salesOrderId = order.id;
    orderDefaults = {
      shipToAddressId: order.shipToAddressId,
      shippingAddress: order.shippingAddress,
      salesPersonId: order.salesPersonId,
      contactPerson: order.contactPerson,
    };
    priceIncludesVat = order.priceIncludesVat;
    const orderLines = new Map(order.lines.map((line) => [line.id, line]));
    const seen = new Set<string>();
    lines = input.lines.map((entry, index) => {
      const line = orderLines.get(entry.orderLineId);
      if (!line) throw badRequest("A delivery line does not belong to this order.");
      if (seen.has(line.id)) throw badRequest("An order line appears twice.");
      seen.add(line.id);
      itemNames.set(line.itemId, line.item.name);
      const amounts = orderLineAmounts(
        {
          qty: entry.qty,
          unitPrice: num(line.unitPrice),
          discountPercent: num(line.discountPercent),
          vatPercent: num(line.vatPercent),
          aitPercent: num(line.aitPercent),
        },
        priceIncludesVat,
      );
      return {
        lineNo: index + 1,
        itemId: line.itemId,
        orderLineId: line.id,
        uom: line.uom,
        altUom: line.altUom,
        altUomFactor: line.altUomFactor,
        qty: entry.qty,
        rate: num(line.unitPrice),
        discountPercent: num(line.discountPercent),
        vatPercent: num(line.vatPercent),
        aitPercent: num(line.aitPercent),
        grossAmount: amounts.grossAmount,
        baseAmount: amounts.baseAmount,
        vatAmount: amounts.vatAmount,
        aitAmount: amounts.aitAmount,
        amount: amounts.lineTotal,
      };
    });
    // The order's header discount is shared out by delivered value.
    const deliveredValue = lines.reduce((sum, line) => sum + line.amount, 0);
    discountAmount = num(order.itemsTotal) > 0 ? round2((num(order.discountAmount) * deliveredValue) / num(order.itemsTotal)) : 0;
  } else {
    customerId = input.customerId;
    priceIncludesVat = input.priceIncludesVat;
    discountAmount = input.discountAmount;
    const itemIds = [...new Set(input.lines.map((line) => line.itemId))];
    const items = await db().item.findMany({
      where: { id: { in: itemIds }, businessUnitId },
      select: { id: true, name: true, uom: true, altUom: true, altUomFactor: true, isActive: true },
    });
    const itemById = new Map(items.map((item) => [item.id, item]));
    for (const itemId of itemIds) {
      const item = itemById.get(itemId);
      if (!item) throw badRequest("An item does not belong to the office's business unit.");
      if (!item.isActive) throw badRequest(`${item.name} is disabled.`);
      itemNames.set(item.id, item.name);
    }
    lines = input.lines.map((line, index) => {
      const item = itemById.get(line.itemId)!;
      const amounts = orderLineAmounts(line, priceIncludesVat);
      return {
        lineNo: index + 1,
        itemId: line.itemId,
        orderLineId: null,
        uom: item.uom,
        altUom: item.altUom,
        altUomFactor: item.altUomFactor,
        qty: line.qty,
        rate: line.unitPrice,
        discountPercent: line.discountPercent,
        vatPercent: line.vatPercent,
        aitPercent: line.aitPercent,
        grossAmount: amounts.grossAmount,
        baseAmount: amounts.baseAmount,
        vatAmount: amounts.vatAmount,
        aitAmount: amounts.aitAmount,
        amount: amounts.lineTotal,
      };
    });
  }

  const customer = await db().customer.findFirst({
    where: { id: customerId, businessUnitId },
    select: { isActive: true, address: true },
  });
  if (!customer) throw badRequest("Customer does not belong to the office's business unit.");
  if (!customer.isActive && input.deliveryType !== "SALES_ORDER") throw badRequest("Customer is disabled.");
  const salesPersonId = input.salesPersonId ?? orderDefaults?.salesPersonId ?? null;
  const contactPerson = input.contactPerson ?? orderDefaults?.contactPerson ?? null;
  if (input.salesPersonId) {
    const person = await db().salesPerson.findFirst({ where: { id: input.salesPersonId, businessUnitId } });
    if (!person) throw badRequest("Sales force does not belong to the office's business unit.");
  }
  let vehicleNo = input.vehicleNo;
  if (input.vehicleId) {
    const vehicle = await db().vehicle.findFirst({ where: { id: input.vehicleId, businessUnitId, isActive: true }, select: { vehicleNumber: true } });
    if (!vehicle) throw badRequest("Vehicle does not belong to the office's business unit.");
    vehicleNo = vehicle.vehicleNumber;
  }
  if (input.driverEmployeeId) await requireDriver(businessUnitId, input.driverEmployeeId);
  const useOrderAddress = !input.shipToAddressId && !input.shippingAddress && orderDefaults !== null;
  const shipToAddressId = useOrderAddress ? orderDefaults!.shipToAddressId : input.shipToAddressId;
  let shippingAddress = useOrderAddress ? orderDefaults!.shippingAddress : input.shippingAddress;
  if (input.shipToAddressId) {
    const address = await db().customerAddress.findFirst({ where: { id: input.shipToAddressId, customerId }, select: { address: true } });
    if (!address) throw badRequest("Ship-to address does not belong to the customer.");
    shippingAddress = address.address;
  }

  let received: Plan["received"] = [];
  let returnTotal = 0;
  if (input.deliveryType === "EXCHANGE") {
    const ids = [...new Set(input.receivedLines.map((line) => line.itemId))];
    const items = await db().item.findMany({ where: { id: { in: ids }, businessUnitId }, select: { id: true, name: true } });
    if (items.length !== ids.length) throw badRequest("An item taken back does not belong to the office's business unit.");
    for (const item of items) itemNames.set(item.id, item.name);
    received = input.receivedLines.map((line, index) => ({
      lineNo: index + 1,
      itemId: line.itemId,
      qty: line.qty,
      rate: line.rate,
      amount: round2(line.qty * line.rate),
    }));
    returnTotal = round2(received.reduce((sum, line) => sum + line.amount, 0));
  }

  const totals = orderTotals(
    lines.map((line) => ({
      qty: line.qty,
      unitPrice: line.rate,
      discountPercent: line.discountPercent,
      vatPercent: line.vatPercent,
      aitPercent: line.aitPercent,
    })),
    { priceIncludesVat, discountAmount, deliveryCharge: input.deliveryCharge, unloadingCharge: input.unloadingCharge },
  );
  const collectable = input.deliveryType === "EXCHANGE" ? Math.max(0, totals.salesTotal - returnTotal) : totals.salesTotal;
  if (input.paidAmount > collectable + 1e-9) {
    throw badRequest(`Payment amount cannot be more than ${collectable.toFixed(2)}.`);
  }

  return {
    businessUnitId,
    salesOrderId,
    itemNames,
    received,
    returnTotal,
    reason: input.deliveryType === "EXCHANGE" ? input.reason : null,
    lines,
    header: {
      officeId: office.id,
      warehouseId: warehouse.id,
      salesOrderId,
      customerId,
      salesPersonId,
      deliveryType: input.deliveryType,
      deliveryDate: toDbDate(input.deliveryDate),
      deliveredAt: deliveredAt(input.deliveryDate, input.deliveryTime),
      dueDate: addDaysToDate(input.deliveryDate, input.paymentTermDays),
      status: "SUBMITTED",
      challanNo: input.challanNo,
      vatChallanNo: input.vatChallanNo,
      shipToAddressId,
      shippingAddress,
      billingAddress: customer.address,
      contactPerson,
      refCustomerPo: input.refCustomerPo,
      refCustomerPoDate: input.refCustomerPoDate ? toDbDate(input.refCustomerPoDate) : null,
      refInvoice: input.refInvoice,
      refProjectOutlet: input.refProjectOutlet,
      paymentMethod: input.paymentMethod,
      paymentTermDays: input.paymentTermDays,
      priceIncludesVat,
      vehicleNo,
      driverName: input.driverName,
      driverPhone: input.driverPhone,
      transporterName: input.transporterName,
      vehicleId: input.vehicleId,
      driverEmployeeId: input.driverEmployeeId,
      securityCode: input.securityCode,
      referredBy: input.referredBy,
      buyerName: input.buyerName,
      buyerMobile: input.buyerMobile,
      salesType: input.salesType,
      totalQty: totals.totalQty,
      itemsTotal: totals.itemsTotal,
      itemsBase: totals.itemsBase,
      vatAmount: totals.vatAmount,
      aitAmount: totals.aitAmount,
      discountAmount: totals.discountAmount,
      deliveryCharge: totals.deliveryCharge,
      unloadingCharge: totals.unloadingCharge,
      totalAmount: totals.salesTotal,
      paidAmount: round2(input.paidAmount),
      terms: input.terms,
      remarks: input.remarks,
    },
  };
}

// ─── Effects: stock, order quantities, collection ────────────────────────────

const COLLECTION_METHOD = { CASH: "CASH", CREDIT: "CASH", BANK: "BANK", CHEQUE: "CHEQUE", MOBILE_BANKING: "MOBILE_BANKING" } as const;

async function applyEffects(tx: Tx, actor: Actor, deliveryId: string, number: string, p: Plan, returnId: string | null) {
  const warehouseId = p.header.warehouseId!;
  const postingDate = p.header.deliveryDate as Date;
  await lockWarehouse(tx, warehouseId);

  // Stock out (net of anything taken back into the same warehouse in this exchange).
  const needs = new Map<string, number>();
  for (const line of p.lines) needs.set(line.itemId, (needs.get(line.itemId) ?? 0) + line.qty);
  const incoming = new Map<string, number>();
  for (const line of p.received) incoming.set(line.itemId, (incoming.get(line.itemId) ?? 0) + line.qty);
  const netNeeds = new Map([...needs].map(([itemId, qty]) => [itemId, qty - (incoming.get(itemId) ?? 0)]).filter(([, qty]) => (qty as number) > 0) as [string, number][]);
  await assertStockAvailable(tx, warehouseId, netNeeds, p.itemNames);

  const entries: Prisma.StockEntryCreateManyInput[] = [
    ...p.lines.map((line) => ({
      businessUnitId: p.businessUnitId,
      warehouseId,
      itemId: line.itemId,
      qty: -line.qty,
      source: "SALES_DELIVERY" as const,
      sourceId: deliveryId,
      postingDate,
      remarks: number,
      createdBy: actor.id,
    })),
    ...p.received.map((line) => ({
      businessUnitId: p.businessUnitId,
      warehouseId,
      itemId: line.itemId,
      qty: line.qty,
      source: "SALES_RETURN" as const,
      sourceId: returnId,
      postingDate,
      remarks: `Exchange ${number}`,
      createdBy: actor.id,
    })),
  ];
  await tx.stockEntry.createMany({ data: entries });

  // Sales order quantities.
  if (p.salesOrderId) {
    const order = await tx.salesOrder.findUniqueOrThrow({ where: { id: p.salesOrderId }, select: { status: true } });
    if (order.status !== "APPROVED") throw conflict("The sales order is no longer open for delivery.");
    const orderLines = await tx.salesOrderLine.findMany({
      where: { orderId: p.salesOrderId },
      select: { id: true, qty: true, deliveredQty: true, item: { select: { name: true, deliveryTolerancePercent: true } } },
    });
    const byId = new Map(orderLines.map((line) => [line.id, line]));
    for (const line of p.lines) {
      const orderLine = byId.get(line.orderLineId!)!;
      const limit = num(orderLine.qty) * (1 + num(orderLine.item.deliveryTolerancePercent) / 100);
      // Guarded increment: one UPDATE, so concurrent deliveries cannot over-deliver.
      const { count } = await tx.salesOrderLine.updateMany({
        where: { id: orderLine.id, deliveredQty: { lte: round3(limit - line.qty) } },
        data: { deliveredQty: { increment: line.qty } },
      });
      if (count === 0) {
        const left = Math.max(0, round3(limit - num(orderLine.deliveredQty)));
        throw conflict(`${orderLine.item.name}: only ${left} can still be delivered on this order.`);
      }
    }
    const after = await tx.salesOrderLine.findMany({ where: { orderId: p.salesOrderId }, select: { qty: true, deliveredQty: true } });
    const complete = after.every((line) => num(line.deliveredQty) >= num(line.qty));
    if (complete) {
      await tx.salesOrder.update({
        where: { id: p.salesOrderId },
        data: { status: "COMPLETED", closedAt: new Date(), deliveryPendingReasonId: null, updatedBy: actor.id },
      });
    }
    await tx.salesOrderEvent.create({
      data: {
        orderId: p.salesOrderId,
        action: complete ? "DELIVERED" : "PARTIALLY_DELIVERED",
        fromStatus: "APPROVED",
        toStatus: complete ? "COMPLETED" : "APPROVED",
        remarks: `Delivery ${number}`,
        actorId: actor.id,
      },
    });
  }

  // Money collected on delivery.
  if (Number(p.header.paidAmount) > 0) {
    await tx.salesCollection.create({
      data: {
        businessUnitId: p.businessUnitId,
        number: await companyDocumentNumber(tx, p.businessUnitId, "SALES_COLLECTION", "CR-", fromDbDate(postingDate)),
        customerId: p.header.customerId,
        salesPersonId: p.header.salesPersonId ?? null,
        collectionDate: postingDate,
        method: COLLECTION_METHOD[p.header.paymentMethod as keyof typeof COLLECTION_METHOD],
        amount: p.header.paidAmount!,
        reference: number,
        status: "SUBMITTED",
        remarks: "Collected on delivery",
        deliveryId,
        kind: "INVOICE",
        officeId: p.header.officeId,
        createdBy: actor.id,
        // The money settles this invoice.
        allocations: { create: [{ deliveryId, amount: p.header.paidAmount! }] },
      },
    });
  }
}

/** Undoes stock, order quantities and the delivery collection of a saved delivery. */
async function revertEffects(tx: Tx, actor: Actor, delivery: { id: string; number: string; salesOrderId: string | null; exchangeReturnId: string | null; warehouseId: string | null }, collections: "delete" | "cancel") {
  if (delivery.warehouseId) await lockWarehouse(tx, delivery.warehouseId);
  await tx.stockEntry.deleteMany({
    where: { sourceId: { in: [delivery.id, ...(delivery.exchangeReturnId ? [delivery.exchangeReturnId] : [])] } },
  });
  if (collections === "delete") await tx.salesCollection.deleteMany({ where: { deliveryId: delivery.id } });
  else await tx.salesCollection.updateMany({ where: { deliveryId: delivery.id }, data: { status: "CANCELLED" } });

  if (delivery.salesOrderId) {
    const lines = await tx.salesDeliveryLine.findMany({ where: { deliveryId: delivery.id }, select: { orderLineId: true, qty: true } });
    for (const line of lines) {
      if (!line.orderLineId) continue;
      await tx.salesOrderLine.update({ where: { id: line.orderLineId }, data: { deliveredQty: { decrement: line.qty } } });
    }
    const order = await tx.salesOrder.findUniqueOrThrow({
      where: { id: delivery.salesOrderId },
      select: { status: true, events: { where: { toStatus: "COMPLETED" }, orderBy: { createdAt: "desc" }, take: 1, select: { action: true } } },
    });
    // Re-open only orders that the deliveries completed (not ones closed by hand).
    const reopen = order.status === "COMPLETED" && order.events[0]?.action === "DELIVERED";
    if (reopen) {
      await tx.salesOrder.update({ where: { id: delivery.salesOrderId }, data: { status: "APPROVED", closedAt: null, updatedBy: actor.id } });
    }
    await tx.salesOrderEvent.create({
      data: {
        orderId: delivery.salesOrderId,
        action: "DELIVERY_REVERSED",
        fromStatus: order.status,
        toStatus: reopen ? "APPROVED" : order.status,
        remarks: `Delivery ${delivery.number} changed or deleted`,
        actorId: actor.id,
      },
    });
  }
}

// ─── Write ───────────────────────────────────────────────────────────────────

export async function createDelivery(actor: Actor, raw: unknown): Promise<DeliveryDetail> {
  const input = deliveryInputSchema.parse(raw);
  const p = await plan(actor, input);

  try {
    const id = await db().$transaction(async (tx) => {
      // e.g. "SD-MG261000153" / "CH-MG261000153": prefix + company initials + 2-digit year + 7-digit serial.
      const number = await companyDocumentNumber(tx, p.businessUnitId, "SALES_DELIVERY", "SD-", input.deliveryDate);
      const challanNo = p.header.challanNo ?? (await companyDocumentNumber(tx, p.businessUnitId, "DELIVERY_CHALLAN", "CH-", input.deliveryDate));
      let returnId: string | null = null;
      if (input.deliveryType === "EXCHANGE") {
        const salesReturn = await tx.salesReturn.create({
          data: {
            businessUnitId: p.businessUnitId,
            number: await returnNumber(tx, p.businessUnitId, "SALES", "EXCHANGE", input.deliveryDate),
            mode: "EXCHANGE",
            customerId: p.header.customerId,
            salesPersonId: p.header.salesPersonId ?? null,
            officeId: p.header.officeId,
            warehouseId: p.header.warehouseId,
            returnDate: p.header.deliveryDate,
            status: "SUBMITTED",
            totalQty: round3(p.received.reduce((sum, line) => sum + line.qty, 0)),
            totalAmount: p.returnTotal,
            reason: p.reason ?? "Exchange",
            createdBy: actor.id,
            lines: { create: p.received },
          },
          select: { id: true },
        });
        returnId = salesReturn.id;
      }
      const delivery = await tx.salesDelivery.create({
        data: {
          ...p.header,
          businessUnitId: p.businessUnitId,
          number,
          challanNo,
          exchangeReturnId: returnId,
          createdBy: actor.id,
          updatedBy: actor.id,
          lines: { create: p.lines },
        },
        select: { id: true },
      });
      await applyEffects(tx, actor, delivery.id, number, p, returnId);
      return delivery.id;
    });
    return getDelivery(actor, id);
  } catch (error) {
    if (isUnique(error)) throw conflict("This challan number is already used. Leave it blank to generate one.");
    throw error;
  }
}

/** A delivery with live returns, applied collections or a live bill cannot change. */
async function assertUnsettled(tx: Tx, id: string, verb: string) {
  await lockDeliveryReturns(tx, id);
  const live = await tx.salesReturn.count({ where: { deliveryId: id, status: { not: "CANCELLED" } } });
  if (live > 0) throw conflict(`This delivery has sales returns and cannot be ${verb}. Delete the returns first.`);
  const settled = await deliverySettlements(tx, id);
  if (settled.collections > 0) throw conflict(`Collections are applied to this invoice, so it cannot be ${verb}. Cancel those collections first.`);
  if (settled.bills > 0) throw conflict(`This invoice is on a bill, so it cannot be ${verb}. Cancel the bill first.`);
}

async function guardEditable(tx: Tx, id: string, version: string, actor: Actor, verb: string) {
  const { count } = await tx.salesDelivery.updateMany({
    where: { id, status: "SUBMITTED", confirmation: "PENDING", updatedAt: new Date(version) },
    data: { updatedBy: actor.id },
  });
  if (count === 0) {
    const current = await tx.salesDelivery.findUnique({ where: { id }, select: { status: true, confirmation: true } });
    if (!current) throw notFound("Delivery");
    if (current.status !== "SUBMITTED") throw conflict(`A deleted delivery cannot be ${verb}.`);
    if (current.confirmation !== "PENDING") throw conflict(`A confirmed delivery cannot be ${verb}.`);
    throw conflict("Someone else changed this delivery. Reload it and try again.");
  }
}

export async function updateDelivery(actor: Actor, id: string, raw: unknown): Promise<DeliveryDetail> {
  const { version, data } = deliveryUpdateSchema.parse(raw);
  const existing = await loadDelivery(actor, id);
  if (data.deliveryType !== existing.deliveryType) throw badRequest("The delivery type cannot change.");
  if (data.deliveryType === "SALES_ORDER" && data.salesOrderId !== existing.salesOrderId) {
    throw badRequest("The sales order of a delivery cannot change.");
  }
  const p = await plan(actor, data);
  if (p.businessUnitId !== existing.businessUnitId) throw badRequest("The office must stay in the same business unit.");

  try {
    await db().$transaction(async (tx) => {
      await guardEditable(tx, id, version, actor, "edited");
      await assertUnsettled(tx, id, "edited");
      await revertEffects(tx, actor, existing, "delete");
      // Deleted returns keep their lines; detach them from the lines being replaced.
      await tx.salesReturnLine.updateMany({ where: { deliveryLine: { deliveryId: id } }, data: { deliveryLineId: null } });
      await tx.salesDeliveryLine.deleteMany({ where: { deliveryId: id } });
      if (existing.exchangeReturnId) {
        await tx.salesReturnLine.deleteMany({ where: { returnId: existing.exchangeReturnId } });
        await tx.salesReturn.update({
          where: { id: existing.exchangeReturnId },
          data: {
            customerId: p.header.customerId,
            salesPersonId: p.header.salesPersonId ?? null,
            officeId: p.header.officeId,
            warehouseId: p.header.warehouseId,
            returnDate: p.header.deliveryDate,
            totalQty: round3(p.received.reduce((sum, line) => sum + line.qty, 0)),
            totalAmount: p.returnTotal,
            reason: p.reason ?? "Exchange",
            lines: { create: p.received },
          },
        });
      }
      await tx.salesDelivery.update({
        where: { id },
        data: {
          ...p.header,
          challanNo: p.header.challanNo ?? existing.challanNo,
          updatedBy: actor.id,
          lines: { create: p.lines },
        },
      });
      await applyEffects(tx, actor, id, existing.number, p, existing.exchangeReturnId);
    });
  } catch (error) {
    if (isUnique(error)) throw conflict("This challan number is already used.");
    throw error;
  }
  return getDelivery(actor, id);
}

export async function deleteDelivery(actor: Actor, id: string, raw: unknown): Promise<void> {
  const { version, reason } = deliveryDeleteSchema.parse(raw);
  const existing = await loadDelivery(actor, id);
  await db().$transaction(async (tx) => {
    await guardEditable(tx, id, version, actor, "deleted");
    await assertUnsettled(tx, id, "deleted");
    await revertEffects(tx, actor, existing, "cancel");
    await tx.salesDelivery.update({
      where: { id },
      data: { status: "CANCELLED", deletedAt: new Date(), deletedBy: actor.id, deleteReason: reason },
    });
    if (existing.exchangeReturnId) {
      await tx.salesReturn.update({ where: { id: existing.exchangeReturnId }, data: { status: "CANCELLED" } });
    }
  });
}

/** Delivery Details: VAT challan, customer PO, invoice ref and remarks of an unconfirmed delivery. */
export async function updateDeliveryReferences(actor: Actor, id: string, raw: unknown): Promise<DeliveryDetail> {
  const { version, ...references } = deliveryReferenceSchema.parse(raw);
  await loadDelivery(actor, id);
  await db().$transaction(async (tx) => {
    await guardEditable(tx, id, version, actor, "edited");
    await tx.salesDelivery.update({
      where: { id },
      data: { ...references, refCustomerPoDate: references.refCustomerPoDate ? toDbDate(references.refCustomerPoDate) : null, updatedBy: actor.id },
    });
  });
  return getDelivery(actor, id);
}

export async function confirmDelivery(actor: Actor, id: string, raw: unknown): Promise<DeliveryDetail> {
  const { version, actualDeliveryDate, returns } = deliveryConfirmSchema.parse(raw);
  const existing = await loadDelivery(actor, id);
  if (actualDeliveryDate < fromDbDate(existing.deliveryDate)) {
    throw badRequest("Actual delivery date cannot be before the delivery date.");
  }
  if (returns.length > 0 && existing.deliveryType === "EXCHANGE") throw badRequest("Goods of an exchange are not returned on confirmation.");
  // Return QTY: a partial return of this delivery, dated the actual delivery date.
  // Made first so its checks (quantities, stock, status) run before anything changes.
  const salesReturn =
    returns.length > 0
      ? await createReturn(actor, {
          mode: "PARTIAL",
          deliveryId: id,
          officeId: existing.officeId,
          warehouseId: existing.warehouseId,
          returnDate: actualDeliveryDate,
          reason: "Returned on delivery confirmation",
          lines: returns.map((row) => ({ deliveryLineId: row.deliveryLineId, qty: row.qty, reason: "Returned on delivery" })),
        })
      : null;
  try {
    await db().$transaction(async (tx) => {
      await guardEditable(tx, id, version, actor, "confirmed");
      await tx.salesDelivery.update({
        where: { id },
        data: { confirmation: "CONFIRMED", actualDeliveryDate: toDbDate(actualDeliveryDate), confirmedAt: new Date(), confirmedBy: actor.id },
      });
    });
  } catch (error) {
    // Nothing is confirmed: drop the draft return again.
    if (salesReturn) await db().salesReturn.delete({ where: { id: salesReturn.id } });
    throw error;
  }
  // Approvers settle it at once (stock back, due reduced); otherwise it waits on Sales Return.
  if (salesReturn && actor.permissions.has("sales:approve")) await approveReturn(actor, salesReturn.id, { version: salesReturn.updatedAt });
  return getDelivery(actor, id);
}
