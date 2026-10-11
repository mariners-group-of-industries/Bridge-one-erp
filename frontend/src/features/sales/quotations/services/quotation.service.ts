import { Prisma } from "@/generated/prisma/client";
import { badRequest, conflict, notFound } from "@/lib/api/errors";
import { assertCompanyAccess, type Actor } from "@/lib/auth/actor";
import { db } from "@/lib/prisma/client";
import { fromDbDate, toDbDate } from "../../lib/dates";
import { requireOffice, scopedBusinessUnitIds } from "../../lib/scope";
import { formatNumber, nextNumber } from "../../lib/sequence";
import { quotationTotals } from "../lib/totals";
import {
  quotationActionSchema,
  quotationInputSchema,
  quotationUpdateSchema,
  type QuotationDetail,
  type QuotationInput,
  type QuotationListQuery,
  type QuotationListRow,
  type QuotationStatus,
} from "../schemas/quotation.schema";

/** Rows the list returns; narrow the filters to see older records. */
export const LIST_LIMIT = 500;
const DOC_TYPE = "SALES_QUOTATION";
const PREFIX = "SQ";

const detailInclude = {
  office: { select: { name: true } },
  customer: { select: { name: true } },
  businessUnit: { select: { companyId: true } },
  lines: { orderBy: { lineNo: "asc" }, include: { item: { select: { code: true, name: true } } } },
} satisfies Prisma.SalesQuotationInclude;

type QuotationRecord = Prisma.SalesQuotationGetPayload<{ include: typeof detailInclude }>;

function toDetail(record: QuotationRecord): QuotationDetail {
  return {
    id: record.id,
    number: record.number,
    status: record.status,
    businessUnitId: record.businessUnitId,
    officeId: record.officeId,
    officeName: record.office.name,
    customerId: record.customerId,
    customerName: record.customer.name,
    salesPersonId: record.salesPersonId,
    quotationDate: fromDbDate(record.quotationDate),
    validTill: fromDbDate(record.validTill),
    contactMobile: record.contactMobile,
    remarks: record.remarks,
    terms: record.terms,
    totalQty: record.totalQty.toNumber(),
    subTotal: record.subTotal.toNumber(),
    discountAmount: record.discountAmount.toNumber(),
    vatPercent: record.vatPercent.toNumber(),
    vatAmount: record.vatAmount.toNumber(),
    grandTotal: record.grandTotal.toNumber(),
    lostReason: record.lostReason,
    submittedAt: record.submittedAt?.toISOString() ?? null,
    cancelledAt: record.cancelledAt?.toISOString() ?? null,
    createdBy: record.createdBy,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    lines: record.lines.map((line) => ({
      id: line.id,
      lineNo: line.lineNo,
      itemId: line.itemId,
      itemCode: line.item.code,
      itemName: line.item.name,
      description: line.description,
      uom: line.uom,
      qty: line.qty.toNumber(),
      rate: line.rate.toNumber(),
      discountPercent: line.discountPercent.toNumber(),
      amount: line.amount.toNumber(),
    })),
  };
}

// ─── Read ────────────────────────────────────────────────────────────────────

export async function listQuotations(actor: Actor, query: QuotationListQuery): Promise<QuotationListRow[]> {
  const unitIds = await scopedBusinessUnitIds(actor);
  const today = toDbDate(query.today);
  const statusFilter: Prisma.SalesQuotationWhereInput =
    query.status === "EXPIRED"
      ? { status: "SUBMITTED", validTill: { lt: today } }
      : query.status === "SUBMITTED"
        ? { status: "SUBMITTED", validTill: { gte: today } }
        : query.status
          ? { status: query.status }
          : {};

  const rows = await db().salesQuotation.findMany({
    where: {
      businessUnitId: { in: unitIds },
      ...(query.officeId ? { officeId: query.officeId } : {}),
      ...(query.from || query.to
        ? {
            quotationDate: {
              ...(query.from ? { gte: toDbDate(query.from) } : {}),
              ...(query.to ? { lte: toDbDate(query.to) } : {}),
            },
          }
        : {}),
      ...statusFilter,
    },
    select: {
      id: true,
      number: true,
      status: true,
      contactMobile: true,
      quotationDate: true,
      validTill: true,
      grandTotal: true,
      updatedAt: true,
      office: { select: { name: true } },
      customer: { select: { name: true } },
    },
    orderBy: [{ quotationDate: "desc" }, { number: "desc" }],
    take: LIST_LIMIT,
  });

  return rows.map((row) => ({
    id: row.id,
    number: row.number,
    status: row.status,
    officeName: row.office.name,
    customerName: row.customer.name,
    contactMobile: row.contactMobile,
    quotationDate: fromDbDate(row.quotationDate),
    validTill: fromDbDate(row.validTill),
    grandTotal: row.grandTotal.toNumber(),
    updatedAt: row.updatedAt.toISOString(),
  }));
}

async function loadQuotation(actor: Actor, id: string): Promise<QuotationRecord> {
  const record = await db().salesQuotation.findUnique({ where: { id }, include: detailInclude });
  if (!record) throw notFound("Quotation");
  assertCompanyAccess(actor, record.businessUnit.companyId, "Quotation");
  return record;
}

export async function getQuotation(actor: Actor, id: string): Promise<QuotationDetail> {
  return toDetail(await loadQuotation(actor, id));
}

// ─── Write ───────────────────────────────────────────────────────────────────

type ParsedInput = ReturnType<typeof quotationInputSchema.parse>;

/**
 * Checks that the office is accessible and that customer, sales person and
 * items all belong to its business unit; returns the stored header and lines.
 */
async function prepare(actor: Actor, input: ParsedInput) {
  const office = await requireOffice(actor, input.officeId);
  const businessUnitId = office.businessUnitId;
  const itemIds = [...new Set(input.lines.map((line) => line.itemId))];

  const [customer, salesPerson, items] = await Promise.all([
    db().customer.findFirst({ where: { id: input.customerId, businessUnitId }, select: { id: true, isActive: true } }),
    input.salesPersonId
      ? db().salesPerson.findFirst({ where: { id: input.salesPersonId, businessUnitId }, select: { id: true } })
      : null,
    db().item.findMany({ where: { id: { in: itemIds }, businessUnitId }, select: { id: true, uom: true, isActive: true } }),
  ]);
  if (!customer) throw badRequest("Customer does not belong to the office's business unit.");
  if (!customer.isActive) throw badRequest("Customer is disabled.");
  if (input.salesPersonId && !salesPerson) throw badRequest("Sales person does not belong to the office's business unit.");
  const itemById = new Map(items.map((item) => [item.id, item]));
  for (const itemId of itemIds) {
    const item = itemById.get(itemId);
    if (!item) throw badRequest("An item does not belong to the office's business unit.");
    if (!item.isActive) throw badRequest("A selected item is disabled.");
  }

  const totals = quotationTotals(input.lines, input.discountAmount, input.vatPercent);
  return {
    businessUnitId,
    header: {
      officeId: input.officeId,
      customerId: input.customerId,
      salesPersonId: input.salesPersonId ?? null,
      quotationDate: toDbDate(input.quotationDate),
      validTill: toDbDate(input.validTill),
      contactMobile: input.contactMobile,
      remarks: input.remarks,
      terms: input.terms,
      vatPercent: input.vatPercent,
      totalQty: totals.totalQty,
      subTotal: totals.subTotal,
      discountAmount: totals.discountAmount,
      vatAmount: totals.vatAmount,
      grandTotal: totals.grandTotal,
    },
    lines: input.lines.map((line, index) => ({
      lineNo: index + 1,
      itemId: line.itemId,
      description: line.description,
      uom: itemById.get(line.itemId)!.uom,
      qty: line.qty,
      rate: line.rate,
      discountPercent: line.discountPercent,
      amount: totals.lineAmounts[index],
    })),
  };
}

export async function createQuotation(actor: Actor, raw: QuotationInput): Promise<QuotationDetail> {
  const input = quotationInputSchema.parse(raw);
  const { businessUnitId, header, lines } = await prepare(actor, input);
  const year = Number(input.quotationDate.slice(0, 4));

  const created = await db().$transaction(async (tx) => {
    const number = formatNumber(PREFIX, year, await nextNumber(tx, businessUnitId, DOC_TYPE, year));
    return tx.salesQuotation.create({
      data: { ...header, businessUnitId, number, createdBy: actor.id, lines: { create: lines } },
      select: { id: true },
    });
  });
  return getQuotation(actor, created.id);
}

/** Explains why a guarded write matched no row. */
async function staleOrWrongStatus(id: string, allowed: readonly QuotationStatus[], action: string): Promise<never> {
  const current = await db().salesQuotation.findUnique({ where: { id }, select: { status: true } });
  if (!current) throw notFound("Quotation");
  if (!allowed.includes(current.status)) {
    throw conflict(`A ${current.status.toLowerCase()} quotation cannot be ${action}.`, { status: current.status });
  }
  throw conflict("Someone else changed this quotation. Reload it and try again.");
}

export async function updateQuotation(actor: Actor, id: string, raw: unknown): Promise<QuotationDetail> {
  const { version, data } = quotationUpdateSchema.parse(raw);
  const existing = await loadQuotation(actor, id);
  if (existing.status !== "DRAFT") await staleOrWrongStatus(id, ["DRAFT"], "edited");
  const { businessUnitId, header, lines } = await prepare(actor, data);
  if (businessUnitId !== existing.businessUnitId) {
    throw badRequest("The office must stay in the same business unit. Create a new quotation instead.");
  }

  await db().$transaction(async (tx) => {
    // Guarded on status and version so concurrent edits cannot overwrite each other.
    const { count } = await tx.salesQuotation.updateMany({
      where: { id, status: "DRAFT", updatedAt: new Date(version) },
      data: header,
    });
    if (count === 0) await staleOrWrongStatus(id, ["DRAFT"], "edited");
    await tx.salesQuotationLine.deleteMany({ where: { quotationId: id } });
    await tx.salesQuotationLine.createMany({ data: lines.map((line) => ({ ...line, quotationId: id })) });
  });
  return getQuotation(actor, id);
}

export async function deleteQuotation(actor: Actor, id: string): Promise<void> {
  await loadQuotation(actor, id);
  const { count } = await db().salesQuotation.deleteMany({ where: { id, status: "DRAFT" } });
  if (count === 0) await staleOrWrongStatus(id, ["DRAFT"], "deleted");
}

const TRANSITIONS: Record<string, { from: readonly QuotationStatus[]; to: QuotationStatus; verb: string }> = {
  submit: { from: ["DRAFT"], to: "SUBMITTED", verb: "submitted" },
  cancel: { from: ["SUBMITTED", "LOST"], to: "CANCELLED", verb: "cancelled" },
  lost: { from: ["SUBMITTED"], to: "LOST", verb: "marked as lost" },
  reopen: { from: ["LOST"], to: "SUBMITTED", verb: "reopened" },
};

export async function changeQuotationStatus(actor: Actor, id: string, raw: unknown): Promise<QuotationDetail> {
  const { action, version, reason } = quotationActionSchema.parse(raw);
  await loadQuotation(actor, id);
  const transition = TRANSITIONS[action];
  if (action === "lost" && !reason) {
    throw badRequest("Enter why the quotation was lost.");
  }

  const now = new Date();
  const { count } = await db().salesQuotation.updateMany({
    where: { id, status: { in: [...transition.from] }, updatedAt: new Date(version) },
    data: {
      status: transition.to,
      ...(action === "submit" ? { submittedAt: now } : {}),
      ...(action === "cancel" ? { cancelledAt: now } : {}),
      ...(action === "lost" ? { lostReason: reason } : {}),
      ...(action === "reopen" ? { lostReason: null } : {}),
    },
  });
  if (count === 0) await staleOrWrongStatus(id, transition.from, transition.verb);
  return getQuotation(actor, id);
}
