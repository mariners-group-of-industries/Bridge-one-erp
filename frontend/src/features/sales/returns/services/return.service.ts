import { Prisma } from "@/generated/prisma/client";
import { AppError, badRequest, conflict, notFound } from "@/lib/api/errors";
import { assertCompanyAccess, type Actor } from "@/lib/auth/actor";
import { db } from "@/lib/prisma/client";
import { money } from "../../dashboard/lib/aggregate";
import { assertStockAvailable, lockWarehouse, requireWarehouse } from "../../deliveries/services/stock.service";
import { fromDbDate, toDbDate } from "../../lib/dates";
import { requireOffice, scopedBusinessUnitIds } from "../../lib/scope";
import { territoryCustomerWhere } from "../../lib/territory";
import { companyDocumentNumber } from "../../lib/sequence";
import { userNames } from "../../lib/users";
import { round2 } from "../../quotations/lib/totals";
import { discountShare, returnLineAmounts } from "../lib/return-totals";
import {
  factoryReceiveSchema,
  returnableDeliveryQuerySchema,
  returnDeleteSchema,
  returnInputSchema,
  returnListQuerySchema,
  returnUpdateSchema,
  returnVersionSchema,
  type DeliveryForReturn,
  type MarketStage,
  type ReturnableDeliveryRow,
  type ReturnDetail,
  type ReturnList,
} from "../schemas/return.schema";

/** Rows a list returns; totals cover every match. */
export const RETURN_LIST_LIMIT = 1000;

/** Managerium's return numbers: RWF- without reference, SRF- / SRP- full / partial, SRE- exchange, MRT- market. */
const RETURN_PREFIXES: Record<"FULL" | "PARTIAL" | "WITHOUT_REFERENCE" | "EXCHANGE", string> = {
  FULL: "SRF-",
  PARTIAL: "SRP-",
  WITHOUT_REFERENCE: "RWF-",
  EXCHANGE: "SRE-",
};

/** Next return number, e.g. "RWF-MG260000001" (prefix + company initials + year + serial). */
export function returnNumber(tx: Tx, businessUnitId: string, kind: "SALES" | "MARKET", mode: keyof typeof RETURN_PREFIXES, date: string) {
  const prefix = kind === "MARKET" ? "MRT-" : RETURN_PREFIXES[mode];
  return companyDocumentNumber(tx, businessUnitId, `SALES_RETURN_${prefix.slice(0, -1)}`, prefix, date);
}

type Tx = Prisma.TransactionClient;
type Client = Tx | ReturnType<typeof db>;
type ParsedInput = ReturnType<typeof returnInputSchema.parse>;

const num = (value: Prisma.Decimal | null | undefined) => (value ? value.toNumber() : 0);
const optNum = (value: Prisma.Decimal | null | undefined) => (value ? value.toNumber() : null);
const round3 = (value: number) => Math.round(value * 1000) / 1000;
/** Pending and approved returns both hold their quantities. */
const LIVE = { not: "CANCELLED" } as const;

function dateRange(from?: string, to?: string) {
  if (!from && !to) return undefined;
  return { ...(from ? { gte: toDbDate(from) } : {}), ...(to ? { lte: toDbDate(to) } : {}) };
}

function requireApprover(actor: Actor) {
  if (!actor.permissions.has("sales:approve")) {
    throw new AppError(403, "FORBIDDEN", "You do not have permission to approve or remove approved sales returns.");
  }
}

/**
 * Serialises returns of one delivery (and changes to that delivery), so two
 * returns cannot both take the last returnable units.
 */
export async function lockDeliveryReturns(tx: Tx, deliveryId: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`return:${deliveryId}`}))`;
}

/** Quantity on live returns per delivery line, leaving out one return (the one being edited). */
async function returnedByLine(client: Client, deliveryId: string, excludeReturnId?: string | null): Promise<Map<string, number>> {
  const rows = await client.salesReturnLine.groupBy({
    by: ["deliveryLineId"],
    where: {
      deliveryLine: { deliveryId },
      salesReturn: { status: LIVE, ...(excludeReturnId ? { id: { not: excludeReturnId } } : {}) },
    },
    _sum: { qty: true },
  });
  return new Map(rows.filter((row) => row.deliveryLineId).map((row) => [row.deliveryLineId!, round3(num(row._sum.qty))]));
}

function marketStage(record: { status: string; factoryReceivedAt: Date | null; qcAt: Date | null }): MarketStage {
  if (record.status === "CANCELLED") return "DELETED";
  if (record.status === "DRAFT") return "PENDING";
  if (record.qcAt) return "QC_DONE";
  if (record.factoryReceivedAt) return "FACTORY_RECEIVED";
  return "APPROVED";
}

// ─── Delivery List tab ───────────────────────────────────────────────────────

export async function listReturnableDeliveries(actor: Actor, raw: unknown): Promise<ReturnableDeliveryRow[]> {
  const query = returnableDeliveryQuerySchema.parse(raw);
  const unitIds = await scopedBusinessUnitIds(actor);
  const range = dateRange(query.from, query.to);
  const deliveries = await db().salesDelivery.findMany({
    where: {
      businessUnitId: { in: unitIds },
      status: "SUBMITTED",
      officeId: query.officeId ? query.officeId : { not: null },
      ...(query.customerId ? { customerId: query.customerId } : {}),
      ...(range ? { deliveryDate: range } : {}),
      ...(query.search
        ? {
            OR: [
              { number: { contains: query.search, mode: "insensitive" } },
              { challanNo: { contains: query.search, mode: "insensitive" } },
              { salesOrder: { number: { contains: query.search, mode: "insensitive" } } },
              { customer: { name: { contains: query.search, mode: "insensitive" } } },
              { customer: { code: { contains: query.search, mode: "insensitive" } } },
            ],
          }
        : {}),
    },
    select: {
      id: true,
      number: true,
      challanNo: true,
      deliveryType: true,
      deliveryDate: true,
      totalQty: true,
      totalAmount: true,
      salesOrder: { select: { number: true } },
      salesPerson: { select: { name: true } },
      customer: { select: { code: true, name: true } },
    },
    orderBy: [{ deliveryDate: "desc" }, { number: "desc" }],
    take: RETURN_LIST_LIMIT,
  });
  const returned = await db().salesReturn.groupBy({
    by: ["deliveryId"],
    where: { deliveryId: { in: deliveries.map((delivery) => delivery.id) }, status: LIVE },
    _sum: { totalQty: true },
  });
  const returnedById = new Map(returned.map((row) => [row.deliveryId, round3(num(row._sum.totalQty))]));
  return deliveries.map((delivery) => ({
    id: delivery.id,
    number: delivery.number,
    challanNo: delivery.challanNo,
    deliveryType: delivery.deliveryType,
    deliveryDate: fromDbDate(delivery.deliveryDate),
    orderNumber: delivery.salesOrder?.number ?? null,
    customerCode: delivery.customer.code,
    customerName: delivery.customer.name,
    salesPersonName: delivery.salesPerson?.name ?? null,
    deliveredQty: num(delivery.totalQty),
    returnedQty: returnedById.get(delivery.id) ?? 0,
    totalAmount: num(delivery.totalAmount),
  }));
}

/** A delivery with what can still be returned per line. Editing a return: pass its id so its own quantities count as returnable. */
export async function getDeliveryForReturn(actor: Actor, deliveryId: string, editingReturnId?: string): Promise<DeliveryForReturn> {
  const delivery = await db().salesDelivery.findUnique({
    where: { id: deliveryId },
    include: {
      businessUnit: { select: { companyId: true } },
      office: { select: { name: true } },
      customer: { select: { code: true, name: true, phone: true, customerGroup: { select: { name: true } }, territory: { select: { name: true } } } },
      salesPerson: { select: { name: true } },
      lines: { orderBy: { lineNo: "asc" }, include: { item: { select: { code: true, name: true } } } },
    },
  });
  if (!delivery || !delivery.officeId || !delivery.office) throw notFound("Delivery");
  assertCompanyAccess(actor, delivery.businessUnit.companyId, "Delivery");
  if (delivery.status !== "SUBMITTED") throw conflict("This delivery was deleted and cannot be returned.");

  const returned = await returnedByLine(db(), delivery.id, editingReturnId);
  return {
    id: delivery.id,
    number: delivery.number,
    challanNo: delivery.challanNo,
    deliveryDate: fromDbDate(delivery.deliveryDate),
    businessUnitId: delivery.businessUnitId,
    officeId: delivery.officeId,
    officeName: delivery.office.name,
    warehouseId: delivery.warehouseId,
    customerId: delivery.customerId,
    customerCode: delivery.customer.code,
    customerName: delivery.customer.name,
    customerPhone: delivery.customer.phone,
    customerGroup: delivery.customer.customerGroup?.name ?? null,
    territory: delivery.customer.territory?.name ?? null,
    salesPersonId: delivery.salesPersonId,
    salesPersonName: delivery.salesPerson?.name ?? null,
    priceIncludesVat: delivery.priceIncludesVat,
    refProjectOutlet: delivery.refProjectOutlet,
    remarks: delivery.remarks,
    totalAmount: num(delivery.totalAmount),
    itemsTotal: num(delivery.itemsTotal),
    discountAmount: num(delivery.discountAmount),
    lines: delivery.lines.map((line) => {
      const deliveredQty = num(line.qty);
      const returnedQty = returned.get(line.id) ?? 0;
      return {
        deliveryLineId: line.id,
        itemId: line.itemId,
        itemCode: line.item.code,
        itemName: line.item.name,
        uom: line.uom,
        deliveredQty,
        returnedQty,
        returnable: round3(Math.max(0, deliveredQty - returnedQty)),
        rate: num(line.rate),
        vatPercent: num(line.vatPercent),
        amount: num(line.amount),
      };
    }),
  };
}

// ─── Return lists ────────────────────────────────────────────────────────────

export async function listReturns(actor: Actor, raw: unknown): Promise<ReturnList> {
  const query = returnListQuerySchema.parse(raw);
  const unitIds = await scopedBusinessUnitIds(actor);
  const range = dateRange(query.from, query.to);
  const customer: Prisma.CustomerWhereInput = {
    ...(query.customerGroupId ? { customerGroupId: query.customerGroupId } : {}),
    ...(await territoryCustomerWhere(query.territoryId)),
  };
  const where: Prisma.SalesReturnWhereInput = {
    businessUnitId: { in: unitIds },
    status: query.status ?? LIVE,
    ...(query.kind ? { kind: query.kind } : {}),
    ...(query.mode ? { mode: query.mode } : {}),
    ...(query.officeId ? { officeId: query.officeId } : {}),
    ...(query.salesPersonId ? { salesPersonId: query.salesPersonId } : {}),
    ...(range ? { returnDate: range } : {}),
    ...(Object.keys(customer).length ? { customer } : {}),
    ...(query.search
      ? {
          OR: [
            { number: { contains: query.search, mode: "insensitive" } },
            { refNo: { contains: query.search, mode: "insensitive" } },
            { requestNo: { contains: query.search, mode: "insensitive" } },
            { delivery: { number: { contains: query.search, mode: "insensitive" } } },
            { customer: { name: { contains: query.search, mode: "insensitive" } } },
            { customer: { code: { contains: query.search, mode: "insensitive" } } },
          ],
        }
      : {}),
  };

  const [rows, aggregate] = await Promise.all([
    db().salesReturn.findMany({
      where,
      select: {
        id: true,
        number: true,
        kind: true,
        mode: true,
        status: true,
        returnDate: true,
        deliveryId: true,
        refProjectOutlet: true,
        refNo: true,
        requestNo: true,
        totalQty: true,
        totalAmount: true,
        factoryReceivedAt: true,
        qcAt: true,
        updatedAt: true,
        delivery: { select: { number: true } },
        office: { select: { name: true } },
        salesPerson: { select: { name: true } },
        customer: { select: { code: true, name: true, territory: { select: { name: true } } } },
        lines: { select: { receivedQty: true, qcQty: true } },
      },
      orderBy: [{ returnDate: "desc" }, { number: "desc" }],
      skip: query.page ? (query.page - 1) * (query.pageSize ?? 50) : 0,
      take: query.page ? (query.pageSize ?? 50) : RETURN_LIST_LIMIT,
    }),
    db().salesReturn.aggregate({ where, _sum: { totalQty: true, totalAmount: true }, _count: true }),
  ]);

  return {
    rows: rows.map((row) => ({
      id: row.id,
      number: row.number,
      kind: row.kind,
      mode: row.mode,
      status: row.status,
      marketStage: marketStage(row),
      returnDate: fromDbDate(row.returnDate),
      deliveryId: row.deliveryId,
      deliveryNumber: row.delivery?.number ?? null,
      officeName: row.office?.name ?? null,
      customerCode: row.customer.code,
      customerName: row.customer.name,
      refProjectOutlet: row.refProjectOutlet,
      refNo: row.refNo,
      requestNo: row.requestNo,
      totalQty: num(row.totalQty),
      receivedQty: round3(row.lines.reduce((sum, line) => sum + num(line.receivedQty), 0)),
      qcQty: round3(row.lines.reduce((sum, line) => sum + num(line.qcQty), 0)),
      totalAmount: num(row.totalAmount),
      salesPersonName: row.salesPerson?.name ?? null,
      territory: row.customer.territory?.name ?? null,
      updatedAt: row.updatedAt.toISOString(),
    })),
    totalCount: aggregate._count,
    totalQty: round3(num(aggregate._sum.totalQty)),
    totalAmount: num(aggregate._sum.totalAmount),
  };
}

// ─── Detail ──────────────────────────────────────────────────────────────────

const areaSelect = { select: { name: true } } as const;
const detailInclude = {
  businessUnit: { select: { companyId: true, company: { select: { name: true } } } },
  office: { select: { name: true, address: true } },
  warehouse: { select: { name: true } },
  delivery: { select: { number: true, challanNo: true } },
  exchangeDelivery: { select: { id: true } },
  salesPerson: { select: { name: true } },
  customer: { select: { code: true, name: true, phone: true, address: true, customerGroup: areaSelect, territory: areaSelect } },
  lines: { orderBy: { lineNo: "asc" }, include: { item: { select: { code: true, name: true } } } },
} satisfies Prisma.SalesReturnInclude;

type ReturnRecord = Prisma.SalesReturnGetPayload<{ include: typeof detailInclude }>;

function toDetail(record: ReturnRecord): ReturnDetail {
  return {
    id: record.id,
    number: record.number,
    kind: record.kind,
    mode: record.mode,
    status: record.status,
    marketStage: marketStage(record),
    businessUnitId: record.businessUnitId,
    companyName: record.businessUnit.company.name,
    officeId: record.officeId,
    officeName: record.office?.name ?? null,
    officeAddress: record.office?.address ?? null,
    warehouseId: record.warehouseId,
    warehouseName: record.warehouse?.name ?? null,
    deliveryId: record.deliveryId,
    deliveryNumber: record.delivery?.number ?? null,
    challanNo: record.delivery?.challanNo ?? null,
    exchangeDeliveryId: record.exchangeDelivery?.id ?? null,
    customerId: record.customerId,
    customerCode: record.customer.code,
    customerName: record.customer.name,
    customerPhone: record.customer.phone,
    customerAddress: record.customer.address,
    customerGroup: record.customer.customerGroup?.name ?? null,
    territory: record.customer.territory?.name ?? null,
    salesPersonId: record.salesPersonId,
    salesPersonName: record.salesPerson?.name ?? null,
    returnDate: fromDbDate(record.returnDate),
    priceIncludesVat: record.priceIncludesVat,
    withoutInvoice: record.withoutInvoice,
    shippingAddress: record.shippingAddress,
    refProjectOutlet: record.refProjectOutlet,
    refNo: record.refNo,
    refDate: record.refDate ? fromDbDate(record.refDate) : null,
    refAmount: optNum(record.refAmount),
    requestNo: record.requestNo,
    reason: record.reason,
    remarks: record.remarks,
    totalQty: num(record.totalQty),
    itemsTotal: num(record.itemsTotal),
    itemsBase: num(record.itemsBase),
    vatAmount: num(record.vatAmount),
    aitAmount: num(record.aitAmount),
    discountAmount: num(record.discountAmount),
    totalAmount: num(record.totalAmount),
    createdBy: record.createdBy,
    createdAt: record.createdAt.toISOString(),
    updatedBy: record.updatedBy,
    updatedAt: record.updatedAt.toISOString(),
    approvedBy: record.approvedBy,
    approvedAt: record.approvedAt?.toISOString() ?? null,
    factoryReceivedBy: record.factoryReceivedBy,
    factoryReceivedAt: record.factoryReceivedAt?.toISOString() ?? null,
    qcBy: record.qcBy,
    qcAt: record.qcAt?.toISOString() ?? null,
    deletedBy: record.deletedBy,
    deletedAt: record.deletedAt?.toISOString() ?? null,
    deleteReason: record.deleteReason,
    lines: record.lines.map((line) => ({
      id: line.id,
      lineNo: line.lineNo,
      itemId: line.itemId,
      itemCode: line.item.code,
      itemName: line.item.name,
      deliveryLineId: line.deliveryLineId,
      uom: line.uom,
      qty: num(line.qty),
      rate: num(line.rate),
      vatPercent: num(line.vatPercent),
      baseAmount: num(line.baseAmount),
      vatAmount: num(line.vatAmount),
      aitAmount: num(line.aitAmount),
      amount: num(line.amount),
      reason: line.reason,
      receivedQty: optNum(line.receivedQty),
      qcQty: optNum(line.qcQty),
    })),
  };
}

async function loadReturn(actor: Actor, id: string): Promise<ReturnRecord> {
  const record = await db().salesReturn.findUnique({ where: { id }, include: detailInclude });
  if (!record) throw notFound("Sales return");
  assertCompanyAccess(actor, record.businessUnit.companyId, "Sales return");
  return record;
}

export async function getReturn(actor: Actor, id: string): Promise<ReturnDetail> {
  const detail = toDetail(await loadReturn(actor, id));
  // Show who did what by name, not by user id.
  const nameOf = await userNames([detail.createdBy, detail.updatedBy, detail.approvedBy, detail.factoryReceivedBy, detail.qcBy, detail.deletedBy]);
  return {
    ...detail,
    createdBy: nameOf(detail.createdBy),
    updatedBy: nameOf(detail.updatedBy),
    approvedBy: nameOf(detail.approvedBy),
    factoryReceivedBy: nameOf(detail.factoryReceivedBy),
    qcBy: nameOf(detail.qcBy),
    deletedBy: nameOf(detail.deletedBy),
  };
}

// ─── Plan: validate input and price every line ───────────────────────────────

interface PlannedLine {
  lineNo: number;
  itemId: string;
  deliveryLineId: string | null;
  uom: string | null;
  qty: number;
  rate: number;
  vatPercent: number;
  baseAmount: number;
  vatAmount: number;
  aitAmount: number;
  amount: number;
  reason: string | null;
}

interface Plan {
  businessUnitId: string;
  header: Omit<Prisma.SalesReturnUncheckedCreateInput, "businessUnitId" | "number" | "lines">;
  lines: PlannedLine[];
  /** FULL / PARTIAL: every line of the delivery, to check what is left to return. */
  delivery: { id: string; mode: "FULL" | "PARTIAL"; lines: { id: string; qty: number; itemName: string }[] } | null;
}

async function plan(actor: Actor, input: ParsedInput): Promise<Plan> {
  const office = await requireOffice(actor, input.officeId);
  const warehouse = await requireWarehouse(actor, input.warehouseId);
  if (warehouse.officeId !== office.id) throw badRequest("The warehouse belongs to another office.");
  const businessUnitId = office.businessUnitId;
  if (input.salesPersonId) {
    const person = await db().salesPerson.findFirst({ where: { id: input.salesPersonId, businessUnitId } });
    if (!person) throw badRequest("Sales force does not belong to the office's business unit.");
  }

  const common = {
    officeId: office.id,
    warehouseId: warehouse.id,
    returnDate: toDbDate(input.returnDate),
    reason: input.reason,
    refNo: input.refNo,
    refDate: input.refDate ? toDbDate(input.refDate) : null,
    refAmount: input.refAmount,
    requestNo: input.requestNo,
    remarks: input.remarks,
  };

  if (input.mode === "WITHOUT_REFERENCE") {
    const customer = await db().customer.findFirst({ where: { id: input.customerId, businessUnitId }, select: { isActive: true } });
    if (!customer) throw badRequest("Customer does not belong to the office's business unit.");
    if (!customer.isActive) throw badRequest("Customer is disabled.");
    const itemIds = [...new Set(input.lines.map((line) => line.itemId))];
    const items = await db().item.findMany({ where: { id: { in: itemIds }, businessUnitId }, select: { id: true, uom: true } });
    if (items.length !== itemIds.length) throw badRequest("An item does not belong to the office's business unit.");
    const uomById = new Map(items.map((item) => [item.id, item.uom]));

    const lines = input.lines.map((line, index) => {
      // No invoice, no VAT to give back.
      const vatPercent = input.withoutInvoice ? 0 : line.vatPercent;
      return {
        lineNo: index + 1,
        itemId: line.itemId,
        deliveryLineId: null,
        uom: uomById.get(line.itemId) ?? null,
        qty: line.qty,
        rate: round2(line.rate),
        vatPercent,
        ...returnLineAmounts(line.qty, line.rate, vatPercent, input.priceIncludesVat),
        aitAmount: 0,
        reason: line.reason,
      };
    });
    return {
      businessUnitId,
      delivery: null,
      lines,
      header: {
        ...common,
        ...totalsOf(lines, 0),
        kind: input.kind,
        mode: "WITHOUT_REFERENCE",
        customerId: input.customerId,
        salesPersonId: input.salesPersonId,
        deliveryId: null,
        priceIncludesVat: input.priceIncludesVat,
        withoutInvoice: input.withoutInvoice,
        shippingAddress: input.shippingAddress,
        refProjectOutlet: null,
      },
    };
  }

  const delivery = await db().salesDelivery.findFirst({
    where: { id: input.deliveryId, businessUnitId },
    include: { lines: { include: { item: { select: { name: true } } } } },
  });
  if (!delivery) throw badRequest("Delivery not found in the office's business unit.");
  const byId = new Map(delivery.lines.map((line) => [line.id, line]));
  const seen = new Set<string>();
  const lines = input.lines.map((entry, index) => {
    const line = byId.get(entry.deliveryLineId);
    if (!line) throw badRequest("A return line does not belong to this delivery.");
    if (seen.has(line.id)) throw badRequest("A delivery line appears twice.");
    seen.add(line.id);
    // Credit what the customer paid for these units: the delivery line's own amounts, pro rata.
    const share = entry.qty / num(line.qty);
    const baseAmount = round2(num(line.baseAmount) * share);
    const vatAmount = round2(num(line.vatAmount) * share);
    const aitAmount = round2(num(line.aitAmount) * share);
    return {
      lineNo: index + 1,
      itemId: line.itemId,
      deliveryLineId: line.id,
      uom: line.uom,
      qty: entry.qty,
      rate: round2(num(line.rate)),
      vatPercent: num(line.vatPercent),
      baseAmount,
      vatAmount,
      aitAmount,
      amount: round2(baseAmount + vatAmount + aitAmount),
      reason: entry.reason,
    };
  });
  // The delivery's header discount is given back in proportion to the value returned.
  const itemsTotal = round2(lines.reduce((sum, line) => sum + line.amount, 0));
  const discount = discountShare(num(delivery.discountAmount), num(delivery.itemsTotal), itemsTotal);
  return {
    businessUnitId,
    delivery: {
      id: delivery.id,
      mode: input.mode,
      lines: delivery.lines.map((line) => ({ id: line.id, qty: num(line.qty), itemName: line.item.name })),
    },
    lines,
    header: {
      ...common,
      ...totalsOf(lines, discount),
      kind: input.kind,
      mode: input.mode,
      customerId: delivery.customerId,
      salesPersonId: input.salesPersonId ?? delivery.salesPersonId,
      deliveryId: delivery.id,
      priceIncludesVat: delivery.priceIncludesVat,
      withoutInvoice: false,
      shippingAddress: delivery.shippingAddress,
      refProjectOutlet: delivery.refProjectOutlet,
    },
  };
}

function totalsOf(lines: PlannedLine[], discountAmount: number) {
  const itemsTotal = round2(lines.reduce((sum, line) => sum + line.amount, 0));
  return {
    totalQty: round3(lines.reduce((sum, line) => sum + line.qty, 0)),
    itemsTotal,
    itemsBase: round2(lines.reduce((sum, line) => sum + line.baseAmount, 0)),
    vatAmount: round2(lines.reduce((sum, line) => sum + line.vatAmount, 0)),
    aitAmount: round2(lines.reduce((sum, line) => sum + line.aitAmount, 0)),
    discountAmount: discountAmount,
    totalAmount: money(itemsTotal - discountAmount),
  };
}

/** Inside the transaction: the delivery is still live and nothing is returned twice. */
async function assertReturnable(tx: Tx, p: Plan, excludeReturnId: string | null) {
  if (!p.delivery) return;
  await lockDeliveryReturns(tx, p.delivery.id);
  const delivery = await tx.salesDelivery.findUniqueOrThrow({ where: { id: p.delivery.id }, select: { status: true } });
  if (delivery.status !== "SUBMITTED") throw conflict("This delivery was deleted and cannot be returned.");

  const returned = await returnedByLine(tx, p.delivery.id, excludeReturnId);
  const requested = new Map(p.lines.map((line) => [line.deliveryLineId!, line.qty]));
  for (const line of p.delivery.lines) {
    const left = round3(line.qty - (returned.get(line.id) ?? 0));
    const want = requested.get(line.id) ?? 0;
    if (want > left + 1e-9) throw conflict(`${line.itemName}: only ${Math.max(0, left)} can still be returned.`);
  }
  if (p.delivery.mode === "FULL") {
    if ([...returned.values()].some((qty) => qty > 0)) throw conflict("Part of this delivery was already returned. Use a partial return.");
    const short = p.delivery.lines.find((line) => Math.abs((requested.get(line.id) ?? 0) - line.qty) > 1e-9);
    if (short) throw badRequest(`A full return takes back everything delivered (${short.itemName}: ${short.qty}).`);
  }
}

// ─── Effects ─────────────────────────────────────────────────────────────────

/** Goods back into the warehouse. */
async function stockIn(tx: Tx, actor: Actor, record: { id: string; number: string; businessUnitId: string; warehouseId: string | null; returnDate: Date }, lines: { itemId: string; qty: number }[]) {
  const moving = lines.filter((line) => line.qty > 0);
  if (!moving.length) return;
  if (!record.warehouseId) throw conflict("This return has no warehouse.");
  await lockWarehouse(tx, record.warehouseId);
  await tx.stockEntry.createMany({
    data: moving.map((line) => ({
      businessUnitId: record.businessUnitId,
      warehouseId: record.warehouseId!,
      itemId: line.itemId,
      qty: line.qty,
      source: "SALES_RETURN" as const,
      sourceId: record.id,
      postingDate: record.returnDate,
      remarks: record.number,
      createdBy: actor.id,
    })),
  });
}

/** Takes the returned goods out of stock again (only if they are still there). */
async function reverseStock(tx: Tx, returnId: string) {
  const entries = await tx.stockEntry.findMany({
    where: { source: "SALES_RETURN", sourceId: returnId },
    select: { warehouseId: true, itemId: true, qty: true, item: { select: { name: true } } },
  });
  const warehouses = [...new Set(entries.map((entry) => entry.warehouseId))];
  for (const warehouseId of warehouses) {
    await lockWarehouse(tx, warehouseId);
    const needs = new Map<string, number>();
    const names = new Map<string, string>();
    for (const entry of entries.filter((candidate) => candidate.warehouseId === warehouseId)) {
      needs.set(entry.itemId, (needs.get(entry.itemId) ?? 0) + num(entry.qty));
      names.set(entry.itemId, entry.item.name);
    }
    await assertStockAvailable(tx, warehouseId, needs, names);
  }
  await tx.stockEntry.deleteMany({ where: { source: "SALES_RETURN", sourceId: returnId } });
}

/**
 * Optimistic lock: claims the return if it still has `version` and matches `where`;
 * otherwise explains why not.
 */
async function claim(tx: Tx, actor: Actor, id: string, version: string, where: Prisma.SalesReturnWhereInput, explain: (current: { status: string; kind: string; factoryReceivedAt: Date | null; qcAt: Date | null }) => string | null) {
  const { count } = await tx.salesReturn.updateMany({ where: { id, updatedAt: new Date(version), ...where }, data: { updatedBy: actor.id } });
  if (count > 0) return;
  const current = await tx.salesReturn.findUnique({ where: { id }, select: { status: true, kind: true, factoryReceivedAt: true, qcAt: true, updatedAt: true } });
  if (!current) throw notFound("Sales return");
  const reason = explain(current);
  throw conflict(reason ?? "Someone else changed this return. Reload it and try again.");
}

const STATUS_WORDS: Record<string, string> = { DRAFT: "a pending", SUBMITTED: "an approved", CANCELLED: "a deleted" };
const onlyStatus = (allowed: string[], verb: string) => (current: { status: string }) =>
  allowed.includes(current.status) ? null : `This is ${STATUS_WORDS[current.status]} return; it cannot be ${verb}.`;

// ─── Write ───────────────────────────────────────────────────────────────────

export async function createReturn(actor: Actor, raw: unknown): Promise<ReturnDetail> {
  const input = returnInputSchema.parse(raw);
  const p = await plan(actor, input);
  const id = await db().$transaction(async (tx) => {
    await assertReturnable(tx, p, null);
    const created = await tx.salesReturn.create({
      data: {
        ...p.header,
        businessUnitId: p.businessUnitId,
        number: await returnNumber(tx, p.businessUnitId, p.header.kind ?? "SALES", input.mode, input.returnDate),
        status: "DRAFT",
        createdBy: actor.id,
        updatedBy: actor.id,
        lines: { create: p.lines },
      },
      select: { id: true },
    });
    return created.id;
  });
  return getReturn(actor, id);
}

export async function updateReturn(actor: Actor, id: string, raw: unknown): Promise<ReturnDetail> {
  const { version, data } = returnUpdateSchema.parse(raw);
  const existing = await loadReturn(actor, id);
  if (existing.mode === "EXCHANGE") throw conflict("An exchange return is changed from its exchange delivery.");
  if (data.mode === "WITHOUT_REFERENCE" ? existing.mode !== "WITHOUT_REFERENCE" : existing.mode === "WITHOUT_REFERENCE") {
    throw badRequest("A return against a delivery cannot become a return without reference, or the other way round.");
  }
  if (data.mode !== "WITHOUT_REFERENCE" && data.deliveryId !== existing.deliveryId) throw badRequest("The delivery of a return cannot change.");
  if ((data.kind ?? "SALES") !== existing.kind) throw badRequest("A sales return cannot become a market return, or the other way round.");
  const p = await plan(actor, data);
  if (p.businessUnitId !== existing.businessUnitId) throw badRequest("The office must stay in the same business unit.");

  await db().$transaction(async (tx) => {
    await claim(tx, actor, id, version, { status: "DRAFT" }, onlyStatus(["DRAFT"], "edited"));
    await assertReturnable(tx, p, id);
    await tx.salesReturnLine.deleteMany({ where: { returnId: id } });
    await tx.salesReturn.update({ where: { id }, data: { ...p.header, updatedBy: actor.id, lines: { create: p.lines } } });
  });
  return getReturn(actor, id);
}

export async function approveReturn(actor: Actor, id: string, raw: unknown): Promise<ReturnDetail> {
  requireApprover(actor);
  const { version } = returnVersionSchema.parse(raw);
  const existing = await loadReturn(actor, id);
  await db().$transaction(async (tx) => {
    await claim(tx, actor, id, version, { status: "DRAFT" }, onlyStatus(["DRAFT"], "approved"));
    const approved = await tx.salesReturn.update({
      where: { id },
      data: { status: "SUBMITTED", approvedAt: new Date(), approvedBy: actor.id },
      select: { id: true, number: true, businessUnitId: true, warehouseId: true, returnDate: true },
    });
    // Market returns reach stock only after the factory receives them and QC passes them.
    if (existing.kind === "SALES") {
      await stockIn(tx, actor, approved, existing.lines.map((line) => ({ itemId: line.itemId, qty: num(line.qty) })));
    }
  });
  return getReturn(actor, id);
}

export async function deleteReturn(actor: Actor, id: string, raw: unknown): Promise<void> {
  const { version, reason } = returnDeleteSchema.parse(raw);
  const existing = await loadReturn(actor, id);
  if (existing.mode === "EXCHANGE") throw conflict("An exchange return is removed by deleting its exchange delivery.");
  if (existing.status === "SUBMITTED") requireApprover(actor);
  await db().$transaction(async (tx) => {
    await claim(tx, actor, id, version, { status: { in: ["DRAFT", "SUBMITTED"] } }, onlyStatus(["DRAFT", "SUBMITTED"], "deleted"));
    if (existing.status === "SUBMITTED") await reverseStock(tx, id);
    await tx.salesReturn.update({
      where: { id },
      data: { status: "CANCELLED", deletedAt: new Date(), deletedBy: actor.id, deleteReason: reason },
    });
  });
}

/** Per-line quantities for every line of the return, each at most `limit(line)`. */
function lineQuantities(record: ReturnRecord, entries: { lineId: string; qty: number }[], limit: (line: ReturnRecord["lines"][number]) => number, label: string) {
  const byId = new Map(entries.map((entry) => [entry.lineId, entry.qty]));
  if (byId.size !== entries.length) throw badRequest("A return line appears twice.");
  if (entries.some((entry) => !record.lines.some((line) => line.id === entry.lineId))) throw badRequest("A line does not belong to this return.");
  return record.lines.map((line) => {
    const qty = round3(byId.get(line.id) ?? 0);
    const max = limit(line);
    if (qty > max + 1e-9) throw badRequest(`${line.item.name}: ${label} cannot be more than ${max}.`);
    return { line, qty };
  });
}

/** Market return: what reached the factory. */
export async function receiveMarketReturn(actor: Actor, id: string, raw: unknown): Promise<ReturnDetail> {
  const { version, lines } = factoryReceiveSchema.parse(raw);
  const existing = await loadReturn(actor, id);
  if (existing.kind !== "MARKET") throw conflict("Only market returns are received at the factory.");
  if (existing.status !== "SUBMITTED") throw conflict("Approve the return before the factory receives it.");
  if (existing.factoryReceivedAt) throw conflict("The factory already received this return.");
  const quantities = lineQuantities(existing, lines, (line) => num(line.qty), "received quantity");
  await db().$transaction(async (tx) => {
    await claim(tx, actor, id, version, { status: "SUBMITTED", factoryReceivedAt: null }, (current) =>
      current.status !== "SUBMITTED" ? "Approve the return before the factory receives it." : current.factoryReceivedAt ? "The factory already received this return." : null,
    );
    for (const { line, qty } of quantities) await tx.salesReturnLine.update({ where: { id: line.id }, data: { receivedQty: qty } });
    await tx.salesReturn.update({ where: { id }, data: { factoryReceivedAt: new Date(), factoryReceivedBy: actor.id } });
  });
  return getReturn(actor, id);
}

/** Market return: what passed QC goes into stock. */
export async function qcMarketReturn(actor: Actor, id: string, raw: unknown): Promise<ReturnDetail> {
  const { version, lines } = factoryReceiveSchema.parse(raw);
  const existing = await loadReturn(actor, id);
  if (existing.kind !== "MARKET") throw conflict("Only market returns go through QC.");
  if (existing.status !== "SUBMITTED" || !existing.factoryReceivedAt) throw conflict("The factory must receive the return before QC.");
  if (existing.qcAt) throw conflict("QC is already done for this return.");
  const quantities = lineQuantities(existing, lines, (line) => num(line.receivedQty), "QC quantity");
  await db().$transaction(async (tx) => {
    await claim(tx, actor, id, version, { status: "SUBMITTED", factoryReceivedAt: { not: null }, qcAt: null }, (current) =>
      current.status !== "SUBMITTED" || !current.factoryReceivedAt ? "The factory must receive the return before QC." : current.qcAt ? "QC is already done for this return." : null,
    );
    for (const { line, qty } of quantities) await tx.salesReturnLine.update({ where: { id: line.id }, data: { qcQty: qty } });
    const done = await tx.salesReturn.update({
      where: { id },
      data: { qcAt: new Date(), qcBy: actor.id },
      select: { id: true, number: true, businessUnitId: true, warehouseId: true, returnDate: true },
    });
    await stockIn(tx, actor, done, quantities.map(({ line, qty }) => ({ itemId: line.itemId, qty })));
  });
  return getReturn(actor, id);
}
