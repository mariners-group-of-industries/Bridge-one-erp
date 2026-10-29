import { Prisma } from "@/generated/prisma/client";
import { AppError, badRequest, conflict, notFound } from "@/lib/api/errors";
import { assertCompanyAccess, type Actor } from "@/lib/auth/actor";
import { db } from "@/lib/prisma/client";
import { richTextToPlain, type RichTextNode } from "@/lib/rich-text";
import { fromDbDate, toDbDate } from "../../lib/dates";
import { requireOffice, scopedBusinessUnitIds } from "../../lib/scope";
import { companyDocumentNumber } from "../../lib/sequence";
import { quotationTotals } from "../lib/totals";
import {
  quotationActionSchema,
  quotationInputSchema,
  quotationUpdateSchema,
  termSchema,
  termsText,
  type QuotationDetail,
  type QuotationInput,
  type QuotationListQuery,
  type QuotationListRow,
  type QuotationStatus,
  type QuotationTerm,
} from "../schemas/quotation.schema";

/** Rows the list returns; narrow the filters to see older records. */
export const LIST_LIMIT = 500;
const DOC_TYPE = "SALES_QUOTATION";
const PREFIX = "SQ-";

const detailInclude = {
  office: { select: { name: true } },
  customer: { select: { name: true, code: true } },
  businessUnit: { select: { companyId: true } },
  lines: { orderBy: { lineNo: "asc" }, include: { item: { select: { code: true, name: true } } } },
} satisfies Prisma.SalesQuotationInclude;

type QuotationRecord = Prisma.SalesQuotationGetPayload<{ include: typeof detailInclude }>;

const num = (value: Prisma.Decimal) => value.toNumber();
const richText = (value: Prisma.JsonValue | null) => (value && typeof value === "object" && !Array.isArray(value) ? (value as unknown as RichTextNode) : null);

/** Stored terms, keeping only well-formed entries. */
function storedTerms(value: Prisma.JsonValue | null): QuotationTerm[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    const parsed = termSchema.safeParse(entry);
    return parsed.success ? [parsed.data] : [];
  });
}

function toDetail(record: QuotationRecord): QuotationDetail {
  const remarksBody = richText(record.remarksBody);
  const termsList = storedTerms(record.termsList);
  return {
    id: record.id,
    number: record.number,
    status: record.status,
    businessUnitId: record.businessUnitId,
    officeId: record.officeId,
    officeName: record.office.name,
    customerId: record.customerId,
    customerName: record.customer.name,
    customerCode: record.customer.code,
    salesPersonId: record.salesPersonId,
    quotationDate: fromDbDate(record.quotationDate),
    validTill: fromDbDate(record.validTill),
    contactMobile: record.contactMobile,
    billingAddress: record.billingAddress,
    billingContactPerson: record.billingContactPerson,
    billingContactNo: record.billingContactNo,
    reference: record.reference,
    subject: record.subject,
    quotationType: record.quotationType,
    includingVat: record.includingVat,
    remarksBody,
    remarksFooter: richText(record.remarksFooter),
    termsList,
    remarks: richTextToPlain(remarksBody) || null,
    terms: termsText(termsList),
    totalQty: num(record.totalQty),
    subTotal: num(record.subTotal),
    discountAmount: num(record.discountAmount),
    vatAmount: num(record.vatAmount),
    aitAmount: num(record.aitAmount),
    grandTotal: num(record.grandTotal),
    lostReason: record.lostReason,
    approvedBy: record.approvedBy,
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
      qty: num(line.qty),
      rate: num(line.rate),
      discountPercent: num(line.discountPercent),
      discountAmount: num(line.discountAmount),
      vatPercent: num(line.vatPercent),
      vatAmount: num(line.vatAmount),
      aitPercent: num(line.aitPercent),
      aitAmount: num(line.aitAmount),
      amount: num(line.amount),
      warranty: line.warranty,
      deliveryDate: line.deliveryDate ? fromDbDate(line.deliveryDate) : null,
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
  const text = query.search ? { contains: query.search, mode: "insensitive" as const } : undefined;

  const rows = await db().salesQuotation.findMany({
    where: {
      businessUnitId: { in: unitIds },
      ...(query.officeId ? { officeId: query.officeId } : {}),
      ...(query.from || query.to
        ? { quotationDate: { ...(query.from ? { gte: toDbDate(query.from) } : {}), ...(query.to ? { lte: toDbDate(query.to) } : {}) } }
        : {}),
      ...statusFilter,
      ...(text ? { OR: [{ number: text }, { contactMobile: text }, { subject: text }, { customer: { OR: [{ name: text }, { code: text }] } }] } : {}),
    },
    select: {
      id: true,
      number: true,
      status: true,
      contactMobile: true,
      customerId: true,
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
    customerId: row.customerId,
    customerName: row.customer.name,
    contactMobile: row.contactMobile,
    quotationDate: fromDbDate(row.quotationDate),
    validTill: fromDbDate(row.validTill),
    grandTotal: num(row.grandTotal),
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

const jsonOrNull = (value: RichTextNode | null | undefined) => (value ? (value as unknown as Prisma.InputJsonValue) : Prisma.DbNull);

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
    input.salesPersonId ? db().salesPerson.findFirst({ where: { id: input.salesPersonId, businessUnitId }, select: { id: true } }) : null,
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

  const totals = quotationTotals(input.lines, input.includingVat);
  return {
    businessUnitId,
    header: {
      officeId: input.officeId,
      customerId: input.customerId,
      salesPersonId: input.salesPersonId ?? null,
      quotationDate: toDbDate(input.quotationDate),
      validTill: toDbDate(input.validTill),
      contactMobile: input.contactMobile,
      billingAddress: input.billingAddress,
      billingContactPerson: input.billingContactPerson,
      billingContactNo: input.billingContactNo,
      reference: input.reference,
      subject: input.subject,
      quotationType: input.quotationType,
      includingVat: input.includingVat,
      remarksBody: jsonOrNull(input.remarksBody),
      remarksFooter: jsonOrNull(input.remarksFooter),
      termsList: input.terms.length ? (input.terms as unknown as Prisma.InputJsonValue) : Prisma.DbNull,
      totalQty: totals.totalQty,
      subTotal: totals.subTotal,
      discountAmount: totals.discountAmount,
      vatAmount: totals.vatAmount,
      aitAmount: totals.aitAmount,
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
      discountAmount: totals.lines[index].discountAmount,
      vatPercent: line.vatPercent,
      vatAmount: totals.lines[index].vatAmount,
      aitPercent: line.aitPercent,
      aitAmount: totals.lines[index].aitAmount,
      amount: totals.lines[index].amount,
      warranty: line.warranty,
      deliveryDate: line.deliveryDate ? toDbDate(line.deliveryDate) : null,
    })),
  };
}

export async function createQuotation(actor: Actor, raw: QuotationInput | unknown): Promise<QuotationDetail> {
  const input = quotationInputSchema.parse(raw);
  const { businessUnitId, header, lines } = await prepare(actor, input);

  const created = await db().$transaction(async (tx) => {
    const number = await companyDocumentNumber(tx, businessUnitId, DOC_TYPE, PREFIX, input.quotationDate);
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
    throw conflict(`This quotation is ${current.status === "DRAFT" ? "pending" : current.status === "SUBMITTED" ? "approved" : current.status.toLowerCase()} and cannot be ${action}.`, {
      status: current.status,
    });
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
    const { count } = await tx.salesQuotation.updateMany({ where: { id, status: "DRAFT", updatedAt: new Date(version) }, data: header });
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

const TRANSITIONS: Record<string, { from: readonly QuotationStatus[]; to: QuotationStatus; verb: string; approver?: boolean }> = {
  approve: { from: ["DRAFT"], to: "SUBMITTED", verb: "approved", approver: true },
  reject: { from: ["DRAFT", "SUBMITTED"], to: "LOST", verb: "rejected", approver: true },
  cancel: { from: ["SUBMITTED", "LOST"], to: "CANCELLED", verb: "cancelled" },
  reopen: { from: ["LOST"], to: "DRAFT", verb: "reopened" },
};

export async function changeQuotationStatus(actor: Actor, id: string, raw: unknown): Promise<QuotationDetail> {
  const { action, version, reason } = quotationActionSchema.parse(raw);
  await loadQuotation(actor, id);
  const transition = TRANSITIONS[action];
  if (transition.approver && !actor.permissions.has("sales:approve")) {
    throw new AppError(403, "FORBIDDEN", "You do not have permission to approve or reject quotations.");
  }
  if (action === "reject" && !reason) throw badRequest("Enter why the quotation is rejected.");

  const now = new Date();
  const { count } = await db().salesQuotation.updateMany({
    where: { id, status: { in: [...transition.from] }, updatedAt: new Date(version) },
    data: {
      status: transition.to,
      ...(action === "approve" ? { submittedAt: now, approvedBy: actor.id } : {}),
      ...(action === "cancel" ? { cancelledAt: now } : {}),
      ...(action === "reject" ? { lostReason: reason } : {}),
      ...(action === "reopen" ? { lostReason: null, submittedAt: null, approvedBy: null } : {}),
    },
  });
  if (count === 0) await staleOrWrongStatus(id, transition.from, transition.verb);
  return getQuotation(actor, id);
}
