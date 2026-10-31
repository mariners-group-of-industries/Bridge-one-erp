import type { Prisma } from "@/generated/prisma/client";
import { AppError, badRequest, conflict, notFound } from "@/lib/api/errors";
import { assertCompanyAccess, type Actor } from "@/lib/auth/actor";
import { db } from "@/lib/prisma/client";
import { money } from "../../dashboard/lib/aggregate";
import { fromDbDate, toDbDate } from "../../lib/dates";
import { requireOffice, scopedBusinessUnitIds } from "../../lib/scope";
import { companyDocumentNumber, formatNumber, nextNumber } from "../../lib/sequence";
import { userNames } from "../../lib/users";
import {
  adjustAdvanceSchema,
  advanceVoucherSchema,
  billInputSchema,
  cancelSchema,
  collectionInputSchema,
  collectionListQuerySchema,
  dueCollectionSchema,
  dueInvoiceQuerySchema,
  dueQuerySchema,
  type AllocationRow,
  type BillDetail,
  type BillRow,
  type CollectionDetail,
  type CollectionList,
  type CollectionRow,
  type CollectionWallet,
  type DueInvoice,
  type DueListRow,
  type GlAccountOption,
  type LedgerRow,
} from "../schemas/collection.schema";

/** Rows a list returns. */
export const COLLECTION_LIST_LIMIT = 2000;
const DAY_MS = 24 * 60 * 60 * 1000;

type Tx = Prisma.TransactionClient;
type Client = Tx | ReturnType<typeof db>;

const num = (value: Prisma.Decimal | null | undefined) => (value ? value.toNumber() : 0);
const LIVE = "SUBMITTED" as const;

function dateRange(from?: string, to?: string) {
  if (!from && !to) return undefined;
  return { ...(from ? { gte: toDbDate(from) } : {}), ...(to ? { lte: toDbDate(to) } : {}) };
}

function requireApprover(actor: Actor) {
  if (!actor.permissions.has("sales:approve")) {
    throw new AppError(403, "FORBIDDEN", "You do not have permission to cancel collections.");
  }
}

/** Serialises collections, advance adjustments and bills of one customer. */
async function lockCustomer(tx: Tx, customerId: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`collect:${customerId}`}))`;
}

// ─── Invoice dues ────────────────────────────────────────────────────────────

const dueSelect = {
  id: true,
  number: true,
  challanNo: true,
  deliveryDate: true,
  dueDate: true,
  totalAmount: true,
  customerId: true,
  officeId: true,
  office: { select: { name: true } },
  salesPerson: { select: { name: true } },
  customer: { select: { code: true, name: true } },
  exchangeReturn: { select: { status: true, totalAmount: true } },
  returns: { where: { status: LIVE }, select: { totalAmount: true } },
  allocations: { where: { collection: { status: LIVE } }, select: { amount: true } },
  billLines: { where: { bill: { status: LIVE } }, select: { bill: { select: { id: true, number: true } } } },
} satisfies Prisma.SalesDeliverySelect;

/**
 * What is still owed on each invoice: its total less approved returns (and
 * goods taken back on an exchange) less collections applied to it.
 */
async function invoiceDues(client: Client, where: Prisma.SalesDeliveryWhereInput, asOf: string): Promise<DueInvoice[]> {
  const asOfTime = toDbDate(asOf).getTime();
  const rows = await client.salesDelivery.findMany({
    where: { ...where, status: LIVE },
    select: dueSelect,
    orderBy: [{ deliveryDate: "asc" }, { number: "asc" }],
    take: COLLECTION_LIST_LIMIT,
  });
  return rows.map((row) => {
    const totalAmount = num(row.totalAmount);
    const returnedAmount = money(
      (row.exchangeReturn?.status === LIVE ? num(row.exchangeReturn.totalAmount) : 0) + row.returns.reduce((sum, item) => sum + num(item.totalAmount), 0),
    );
    const collectedAmount = money(row.allocations.reduce((sum, item) => sum + num(item.amount), 0));
    const bill = row.billLines[0]?.bill ?? null;
    return {
      deliveryId: row.id,
      number: row.number,
      challanNo: row.challanNo,
      deliveryDate: fromDbDate(row.deliveryDate),
      dueDate: fromDbDate(row.dueDate),
      overdueDays: Math.max(0, Math.round((asOfTime - row.dueDate.getTime()) / DAY_MS)),
      officeId: row.officeId ?? "",
      officeName: row.office?.name ?? "",
      customerId: row.customerId,
      customerCode: row.customer.code,
      customerName: row.customer.name,
      salesPersonName: row.salesPerson?.name ?? null,
      totalAmount,
      returnedAmount,
      collectedAmount,
      due: money(Math.max(0, totalAmount - returnedAmount - collectedAmount)),
      billId: bill?.id ?? null,
      billNumber: bill?.number ?? null,
    };
  });
}

/** Signed ledger balance and unapplied money of each customer. */
async function ledgers(unitIds: string[], customerIds?: string[]) {
  const scope = { businessUnitId: { in: unitIds }, status: LIVE, ...(customerIds ? { customerId: { in: customerIds } } : {}) };
  const [delivered, returned, collected, applied] = await Promise.all([
    db().salesDelivery.groupBy({ by: ["customerId"], where: scope, _sum: { totalAmount: true } }),
    db().salesReturn.groupBy({ by: ["customerId"], where: scope, _sum: { totalAmount: true } }),
    db().salesCollection.groupBy({ by: ["customerId"], where: scope, _sum: { amount: true } }),
    db().salesCollectionAllocation.findMany({ where: { collection: scope }, select: { amount: true, collection: { select: { customerId: true } } } }),
  ]);
  const result = new Map<string, { ledger: number; advance: number }>();
  const entry = (id: string) => {
    let value = result.get(id);
    if (!value) result.set(id, (value = { ledger: 0, advance: 0 }));
    return value;
  };
  for (const row of delivered) entry(row.customerId).ledger += num(row._sum.totalAmount);
  for (const row of returned) entry(row.customerId).ledger -= num(row._sum.totalAmount);
  for (const row of collected) {
    entry(row.customerId).ledger -= num(row._sum.amount);
    entry(row.customerId).advance += num(row._sum.amount);
  }
  for (const row of applied) entry(row.collection.customerId).advance -= num(row.amount);
  for (const value of result.values()) {
    value.ledger = money(value.ledger);
    value.advance = money(Math.max(0, value.advance));
  }
  return result;
}

// ─── Reads ───────────────────────────────────────────────────────────────────

/** Due List: one row per customer with something owed. */
export async function listDue(actor: Actor, raw: unknown): Promise<DueListRow[]> {
  const query = dueQuerySchema.parse(raw);
  const unitIds = await scopedBusinessUnitIds(actor);
  const dues = (await invoiceDues(db(), { businessUnitId: { in: unitIds }, ...(query.officeId ? { officeId: query.officeId } : {}) }, query.asOf)).filter((row) => row.due > 0);
  const byCustomer = new Map<string, DueInvoice[]>();
  for (const row of dues) byCustomer.set(row.customerId, [...(byCustomer.get(row.customerId) ?? []), row]);
  const ids = [...byCustomer.keys()];
  const [customers, balances] = await Promise.all([
    db().customer.findMany({
      where: { id: { in: ids } },
      select: { id: true, code: true, name: true, customerGroup: { select: { name: true } }, territory: { select: { name: true } }, salesPerson: { select: { name: true } } },
    }),
    ledgers(unitIds, ids),
  ]);
  return customers
    .map((customer) => {
      const rows = byCustomer.get(customer.id)!;
      return {
        customerId: customer.id,
        customerCode: customer.code,
        customerName: customer.name,
        customerGroup: customer.customerGroup?.name ?? null,
        territory: customer.territory?.name ?? null,
        salesPersonName: customer.salesPerson?.name ?? null,
        invoices: rows.length,
        due: money(rows.reduce((sum, row) => sum + row.due, 0)),
        overdue: money(rows.filter((row) => row.overdueDays > 0).reduce((sum, row) => sum + row.due, 0)),
        advance: balances.get(customer.id)?.advance ?? 0,
        ledger: balances.get(customer.id)?.ledger ?? 0,
      };
    })
    .sort((a, b) => b.due - a.due);
}

/** Due Invoice Report (and the invoices a collection or bill can pick from). */
export async function listDueInvoices(actor: Actor, raw: unknown): Promise<DueInvoice[]> {
  const query = dueInvoiceQuerySchema.parse(raw);
  const unitIds = await scopedBusinessUnitIds(actor);
  const range = dateRange(query.from, query.to);
  const rows = await invoiceDues(
    db(),
    {
      businessUnitId: { in: unitIds },
      officeId: query.officeId ? query.officeId : { not: null },
      ...(query.customerId ? { customerId: query.customerId } : {}),
      ...(query.salesPersonId ? { salesPersonId: query.salesPersonId } : {}),
      ...(range ? { deliveryDate: range } : {}),
    },
    query.asOf,
  );
  return rows.filter((row) => row.due > 0 && (!query.notSubmitted || row.billId === null));
}

/** Customer Sales vs Ledger Balance. */
export async function listLedger(actor: Actor, raw: unknown): Promise<LedgerRow[]> {
  const query = dueQuerySchema.parse(raw);
  const unitIds = await scopedBusinessUnitIds(actor);
  const [dues, balances] = await Promise.all([
    invoiceDues(db(), { businessUnitId: { in: unitIds }, ...(query.officeId ? { officeId: query.officeId } : {}) }, query.asOf),
    ledgers(unitIds),
  ]);
  const salesDue = new Map<string, number>();
  for (const row of dues) salesDue.set(row.customerId, (salesDue.get(row.customerId) ?? 0) + row.due);
  const ids = [...new Set([...salesDue.keys(), ...balances.keys()])];
  const customers = await db().customer.findMany({
    where: { id: { in: ids }, ...(query.officeId ? { deliveries: { some: { officeId: query.officeId } } } : {}) },
    select: { id: true, code: true, name: true, customerGroup: { select: { name: true } } },
    orderBy: { code: "asc" },
  });
  return customers
    .map((customer) => {
      const due = money(salesDue.get(customer.id) ?? 0);
      const ledger = balances.get(customer.id)?.ledger ?? 0;
      return { customerId: customer.id, customerCode: customer.code, customerName: customer.name, customerGroup: customer.customerGroup?.name ?? null, salesDue: due, ledger, diff: money(due - ledger) };
    })
    .filter((row) => row.salesDue !== 0 || row.ledger !== 0);
}

const billInclude = {
  businessUnit: { select: { companyId: true, company: { select: { name: true } } } },
  office: { select: { name: true, address: true } },
  customer: { select: { code: true, name: true, phone: true, address: true } },
  lines: { include: { delivery: { select: { id: true, number: true, challanNo: true, deliveryDate: true, dueDate: true, totalAmount: true } } } },
} satisfies Prisma.SalesBillInclude;
type BillRecord = Prisma.SalesBillGetPayload<{ include: typeof billInclude }>;

async function billRows(records: BillRecord[], asOf: string): Promise<{ record: BillRecord; row: BillRow; dues: Map<string, number> }[]> {
  const ids = [...new Set(records.flatMap((record) => record.lines.map((line) => line.deliveryId)))];
  const dues = new Map((await invoiceDues(db(), { id: { in: ids } }, asOf)).map((row) => [row.deliveryId, row.due]));
  return records.map((record) => {
    const billAmount = num(record.totalAmount);
    const due = money(record.lines.reduce((sum, line) => sum + (dues.get(line.deliveryId) ?? 0), 0));
    return {
      record,
      dues,
      row: {
        id: record.id,
        number: record.number,
        billDate: fromDbDate(record.billDate),
        status: record.status === "CANCELLED" ? "CANCELLED" : "SUBMITTED",
        officeName: record.office.name,
        customerId: record.customerId,
        customerCode: record.customer.code,
        customerName: record.customer.name,
        invoices: record.lines.length,
        billAmount,
        due,
        collected: money(Math.max(0, billAmount - due)),
        updatedAt: record.updatedAt.toISOString(),
      },
    };
  });
}

/** Due Bill: live bills that still have something owed. */
export async function listBills(actor: Actor, raw: unknown): Promise<BillRow[]> {
  const query = dueQuerySchema.parse(raw);
  const unitIds = await scopedBusinessUnitIds(actor);
  const records = await db().salesBill.findMany({
    where: { businessUnitId: { in: unitIds }, status: LIVE, ...(query.officeId ? { officeId: query.officeId } : {}) },
    include: billInclude,
    orderBy: [{ billDate: "desc" }, { number: "desc" }],
    take: COLLECTION_LIST_LIMIT,
  });
  return (await billRows(records, query.asOf)).map(({ row }) => row).filter((row) => row.due > 0);
}

export async function getBill(actor: Actor, id: string, asOf: string): Promise<BillDetail> {
  const record = await db().salesBill.findUnique({ where: { id }, include: billInclude });
  if (!record) throw notFound("Bill");
  assertCompanyAccess(actor, record.businessUnit.companyId, "Bill");
  const [{ row, dues }] = await billRows([record], asOf);
  const nameOf = await userNames([record.createdBy, record.cancelledBy]);
  return {
    ...row,
    billType: record.billType as BillDetail["billType"],
    terms: record.terms,
    businessUnitId: record.businessUnitId,
    companyName: record.businessUnit.company.name,
    officeId: record.officeId,
    officeAddress: record.office.address,
    customerPhone: record.customer.phone,
    customerAddress: record.customer.address,
    remarks: record.remarks,
    createdBy: nameOf(record.createdBy),
    createdAt: record.createdAt.toISOString(),
    cancelledBy: nameOf(record.cancelledBy),
    cancelledAt: record.cancelledAt?.toISOString() ?? null,
    cancelReason: record.cancelReason,
    lines: record.lines
      .map((line) => ({
        deliveryId: line.deliveryId,
        invoiceNumber: line.delivery.number,
        challanNo: line.delivery.challanNo,
        challanManual: line.challanManual,
        grnNumber: line.grnNumber,
        submissionDate: line.submissionDate ? fromDbDate(line.submissionDate) : null,
        invoiceDate: fromDbDate(line.delivery.deliveryDate),
        dueDate: fromDbDate(line.delivery.dueDate),
        invoiceAmount: num(line.delivery.totalAmount),
        billedAmount: num(line.amount),
        due: dues.get(line.deliveryId) ?? 0,
      }))
      .sort((a, b) => a.invoiceDate.localeCompare(b.invoiceDate) || a.invoiceNumber.localeCompare(b.invoiceNumber)),
  };
}

const collectionInclude = {
  businessUnit: { select: { companyId: true, company: { select: { name: true } } } },
  office: { select: { name: true, address: true } },
  customer: { select: { code: true, name: true, phone: true, address: true } },
  salesPerson: { select: { name: true } },
  allocations: { include: { delivery: { select: { number: true, deliveryDate: true, totalAmount: true } } } },
  adjustAccount: { select: { code: true, name: true } },
  cashAccount: { select: { code: true, name: true } },
  salesOrder: { select: { number: true } },
  employee: { select: { name: true } },
  attachments: { select: { id: true, originalName: true, mimeType: true, size: true, createdAt: true }, orderBy: { createdAt: "asc" } },
  deductions: { include: { account: { select: { code: true, name: true } } } },
} satisfies Prisma.SalesCollectionInclude;
type CollectionRecord = Prisma.SalesCollectionGetPayload<{ include: typeof collectionInclude }>;

function toRow(record: CollectionRecord): CollectionRow {
  const amount = num(record.amount);
  const allocated = money(record.allocations.reduce((sum, item) => sum + num(item.amount), 0));
  return {
    id: record.id,
    number: record.number,
    kind: record.kind,
    status: record.status,
    collectionDate: fromDbDate(record.collectionDate),
    officeName: record.office?.name ?? null,
    customerId: record.customerId,
    customerCode: record.customer.code,
    customerName: record.customer.name,
    method: record.method,
    reference: record.reference,
    bankName: record.bankName,
    salesPersonName: record.salesPerson?.name ?? null,
    employeeName: record.employee?.name ?? null,
    attachments: record.attachments.map((file) => ({ ...file, createdAt: file.createdAt.toISOString() })),
    amount,
    allocated,
    unallocated: money(Math.max(0, amount - allocated)),
    invoices: record.allocations.length,
    onDelivery: record.deliveryId !== null,
    updatedAt: record.updatedAt.toISOString(),
  };
}

/** Collected Invoice (kind INVOICE) and Advance Collection (kind ADVANCE) tabs. */
export async function listCollections(actor: Actor, raw: unknown): Promise<CollectionList> {
  const query = collectionListQuerySchema.parse(raw);
  const unitIds = await scopedBusinessUnitIds(actor);
  const range = dateRange(query.from, query.to);
  const where: Prisma.SalesCollectionWhereInput = {
    businessUnitId: { in: unitIds },
    kind: query.kind,
    status: query.cancelled ? "CANCELLED" : LIVE,
    ...(query.officeId ? { officeId: query.officeId } : {}),
    ...(query.customerId ? { customerId: query.customerId } : {}),
    ...(query.salesPersonId ? { salesPersonId: query.salesPersonId } : {}),
    ...(range ? { collectionDate: range } : {}),
  };
  const [records, aggregate] = await Promise.all([
    db().salesCollection.findMany({ where, include: collectionInclude, orderBy: [{ collectionDate: "desc" }, { number: "desc" }], take: COLLECTION_LIST_LIMIT }),
    db().salesCollection.aggregate({ where, _sum: { amount: true }, _count: true }),
  ]);
  const allocations: AllocationRow[] = records.flatMap((record) =>
    record.allocations.map((item) => ({
      collectionId: record.id,
      collectionNumber: record.number,
      collectionDate: fromDbDate(record.collectionDate),
      deliveryId: item.deliveryId,
      invoiceNumber: item.delivery.number,
      invoiceDate: fromDbDate(item.delivery.deliveryDate),
      customerName: record.customer.name,
      amount: num(item.amount),
    })),
  );
  return { rows: records.map(toRow), allocations, totalCount: aggregate._count, totalAmount: num(aggregate._sum.amount) };
}

async function loadCollection(actor: Actor, id: string): Promise<CollectionRecord> {
  const record = await db().salesCollection.findUnique({ where: { id }, include: collectionInclude });
  if (!record) throw notFound("Collection");
  assertCompanyAccess(actor, record.businessUnit.companyId, "Collection");
  return record;
}

export async function getCollection(actor: Actor, id: string): Promise<CollectionDetail> {
  const record = await loadCollection(actor, id);
  const nameOf = await userNames([record.createdBy, record.cancelledBy]);
  const account = (value: { code: string; name: string } | null) => (value ? `${value.code} - ${value.name}` : null);
  return {
    ...toRow(record),
    moneyReceiptNo: record.moneyReceiptNo,
    cashType: record.cashType,
    adjustAccount: account(record.adjustAccount),
    voucherType: (record.voucherType as CollectionDetail["voucherType"]) ?? null,
    cashAccount: account(record.cashAccount),
    cashRemarks: record.cashRemarks,
    project: record.project,
    narration: record.narration,
    controlAmount: record.controlAmount ? num(record.controlAmount) : null,
    adjustmentAmount: num(record.adjustmentAmount),
    salesOrderId: record.salesOrderId,
    salesOrderNumber: record.salesOrder?.number ?? null,
    employeeName: record.employee?.name ?? null,
    deductionAmount: num(record.deductionAmount),
    deductions: record.deductions.map((row) => ({ id: row.id, expense: row.expense, account: account(row.account)!, amount: num(row.amount) })),
    businessUnitId: record.businessUnitId,
    companyName: record.businessUnit.company.name,
    officeId: record.officeId,
    officeAddress: record.office?.address ?? null,
    customerPhone: record.customer.phone,
    customerAddress: record.customer.address,
    deliveryId: record.deliveryId,
    remarks: record.remarks,
    createdBy: nameOf(record.createdBy),
    createdAt: record.createdAt.toISOString(),
    cancelledBy: nameOf(record.cancelledBy),
    cancelledAt: record.cancelledAt?.toISOString() ?? null,
    cancelReason: record.cancelReason,
    allocations: record.allocations
      .map((item) => ({
        deliveryId: item.deliveryId,
        invoiceNumber: item.delivery.number,
        invoiceDate: fromDbDate(item.delivery.deliveryDate),
        invoiceAmount: num(item.delivery.totalAmount),
        amount: num(item.amount),
      }))
      .sort((a, b) => a.invoiceDate.localeCompare(b.invoiceDate) || a.invoiceNumber.localeCompare(b.invoiceNumber)),
  };
}

// ─── Writes ──────────────────────────────────────────────────────────────────

/** Checks each amount against what is still owed on that invoice of the customer. */
async function assertPayable(tx: Tx, customerId: string, rows: { deliveryId: string; amount: number }[], asOf: string) {
  const dues = new Map((await invoiceDues(tx, { id: { in: rows.map((row) => row.deliveryId) }, customerId }, asOf)).map((row) => [row.deliveryId, row]));
  for (const row of rows) {
    const invoice = dues.get(row.deliveryId);
    if (!invoice) throw badRequest("An invoice does not belong to this customer or was deleted.");
    if (row.amount > invoice.due + 1e-9) throw conflict(`${invoice.number}: only ${invoice.due.toFixed(2)} is due.`);
  }
}

async function requireParty(actor: Actor, input: { officeId: string; customerId: string; salesPersonId: string | null }) {
  const office = await requireOffice(actor, input.officeId);
  const customer = await db().customer.findFirst({ where: { id: input.customerId, businessUnitId: office.businessUnitId }, select: { id: true } });
  if (!customer) throw badRequest("Customer does not belong to the office's business unit.");
  if (input.salesPersonId) {
    const person = await db().salesPerson.findFirst({ where: { id: input.salesPersonId, businessUnitId: office.businessUnitId } });
    if (!person) throw badRequest("Collect By does not belong to the office's business unit.");
  }
  return office;
}

/** Collection By Invoice (applied to invoices) or an Advance (on account). */
export async function createCollection(actor: Actor, raw: unknown): Promise<CollectionDetail> {
  const input = collectionInputSchema.parse(raw);
  const office = await requireParty(actor, input);
  const id = await db().$transaction(async (tx) => {
    await lockCustomer(tx, input.customerId);
    if (input.kind === "INVOICE") await assertPayable(tx, input.customerId, input.allocations, input.collectionDate);
    const created = await tx.salesCollection.create({
      data: {
        businessUnitId: office.businessUnitId,
        number: await companyDocumentNumber(tx, office.businessUnitId, "SALES_COLLECTION", "CR-", input.collectionDate),
        kind: input.kind,
        officeId: office.id,
        customerId: input.customerId,
        salesPersonId: input.salesPersonId,
        collectionDate: toDbDate(input.collectionDate),
        method: input.method,
        amount: input.amount,
        reference: input.reference,
        bankName: input.bankName,
        remarks: input.remarks,
        status: LIVE,
        createdBy: actor.id,
        ...(input.kind === "INVOICE" ? { allocations: { create: input.allocations } } : {}),
      },
      select: { id: true },
    });
    return created.id;
  });
  return getCollection(actor, id);
}

/** Leaf GL accounts (Cash Account, Adjust With GL, bank deduction heads). */
export async function listGlAccounts(): Promise<GlAccountOption[]> {
  const rows = await db().account.findMany({
    where: { isGroup: false, status: "ACTIVE" },
    select: { id: true, code: true, name: true, accountType: true },
    orderBy: { code: "asc" },
  });
  return rows;
}

async function requireAccounts(client: Client, ids: (string | null)[]) {
  const wanted = [...new Set(ids.filter((id): id is string => Boolean(id)))];
  if (wanted.length === 0) return;
  const found = await client.account.count({ where: { id: { in: wanted }, isGroup: false } });
  if (found !== wanted.length) throw badRequest("Select an active GL account (not a group).");
}

async function requireCustomers(client: Client, businessUnitId: string, customerIds: string[]) {
  const found = await client.customer.count({ where: { id: { in: customerIds }, businessUnitId } });
  if (found !== new Set(customerIds).size) throw badRequest("A customer does not belong to the office's business unit.");
}

/**
 * Due Collection: settles invoices of one or more customers at once (one money receipt
 * per customer). Bank deductions are kept on the first receipt.
 */
export async function createDueCollection(actor: Actor, raw: unknown): Promise<{ id: string; number: string }[]> {
  const input = dueCollectionSchema.parse(raw);
  const office = await requireOffice(actor, input.officeId);
  await requireCustomers(db(), office.businessUnitId, input.rows.map((row) => row.customerId));
  if (input.salesPersonId) {
    const person = await db().salesPerson.findFirst({ where: { id: input.salesPersonId, businessUnitId: office.businessUnitId } });
    if (!person) throw badRequest("Collect By does not belong to the office's business unit.");
  }
  // Wallet Setup: the wallet names the receipt and gives its bank account's GL.
  if (input.walletId) {
    const wallet = await db().salesWallet.findFirst({
      where: { id: input.walletId, businessUnitId: office.businessUnitId, isActive: true, OR: [{ officeId: null }, { officeId: office.id }] },
      select: { name: true, isReferenceRequired: true, bankAccount: { select: { glAccountId: true } } },
    });
    if (!wallet) throw badRequest("The wallet is not active for this office.");
    if (wallet.isReferenceRequired && !input.reference) throw badRequest(`Enter the transaction / reference no for ${wallet.name}.`);
    input.bankName = wallet.name;
    input.adjustAccountId ??= wallet.bankAccount?.glAccountId ?? null;
  }
  await requireAccounts(db(), [input.adjustAccountId, ...input.deductions.map((row) => row.accountId)]);
  const deductionAmount = money(input.deductions.reduce((sum, row) => sum + row.amount, 0));

  return db().$transaction(async (tx) => {
    const created: { id: string; number: string }[] = [];
    for (const [index, row] of input.rows.entries()) {
      await lockCustomer(tx, row.customerId);
      await assertPayable(tx, row.customerId, row.allocations, input.collectionDate);
      const first = index === 0;
      const record = await tx.salesCollection.create({
        data: {
          businessUnitId: office.businessUnitId,
          number: await companyDocumentNumber(tx, office.businessUnitId, "SALES_COLLECTION", "CR-", input.collectionDate),
          kind: "INVOICE",
          officeId: office.id,
          customerId: row.customerId,
          salesPersonId: input.salesPersonId,
          collectionDate: toDbDate(input.collectionDate),
          method: input.method,
          amount: money(row.allocations.reduce((sum, item) => sum + item.amount, 0)),
          reference: input.reference ?? input.moneyReceiptNo,
          bankName: input.bankName,
          moneyReceiptNo: input.moneyReceiptNo,
          cashType: input.cashType,
          adjustAccountId: input.adjustAccountId,
          remarks: input.remarks,
          status: LIVE,
          createdBy: actor.id,
          deductionAmount: first ? deductionAmount : 0,
          allocations: { create: row.allocations },
          ...(first && input.deductions.length ? { deductions: { create: input.deductions } } : {}),
        },
        select: { id: true, number: true },
      });
      created.push(record);
    }
    return created;
  });
}

/** Advance Collection voucher: one advance receipt per row. */
export async function createAdvanceVoucher(actor: Actor, raw: unknown): Promise<{ id: string; number: string }[]> {
  const input = advanceVoucherSchema.parse(raw);
  const office = await requireOffice(actor, input.officeId);
  await requireCustomers(db(), office.businessUnitId, input.rows.map((row) => row.customerId));
  await requireAccounts(db(), [input.cashAccountId, input.adjustAccountId]);
  if (input.employeeId) {
    const employee = await db().employee.findFirst({ where: { id: input.employeeId, isActive: true, office: { businessUnitId: office.businessUnitId } }, select: { id: true } });
    if (!employee) throw badRequest("Employee must be an active employee of this business unit.");
  }
  for (const row of input.rows) {
    if (!row.salesOrderId) continue;
    const order = await db().salesOrder.findFirst({ where: { id: row.salesOrderId, customerId: row.customerId, status: { not: "CANCELLED" } }, select: { id: true } });
    if (!order) throw badRequest("The SO No does not belong to that partner.");
  }

  return db().$transaction(async (tx) => {
    const created: { id: string; number: string }[] = [];
    for (const row of input.rows) {
      await lockCustomer(tx, row.customerId);
      const record = await tx.salesCollection.create({
        data: {
          businessUnitId: office.businessUnitId,
          number: await companyDocumentNumber(tx, office.businessUnitId, "SALES_COLLECTION", "CR-", input.collectionDate),
          kind: "ADVANCE",
          officeId: office.id,
          customerId: row.customerId,
          collectionDate: toDbDate(input.collectionDate),
          method: input.voucherType === "BANK_RECEIVE" ? "BANK" : "CASH",
          amount: row.amount,
          remarks: row.remarks,
          voucherType: input.voucherType,
          cashAccountId: input.cashAccountId,
          cashRemarks: input.cashRemarks,
          adjustAccountId: input.adjustAccountId,
          project: input.project,
          narration: input.narration,
          controlAmount: input.controlAmount,
          adjustmentAmount: row.adjustmentAmount,
          salesOrderId: row.salesOrderId,
          employeeId: input.employeeId,
          status: LIVE,
          createdBy: actor.id,
        },
        select: { id: true, number: true },
      });
      created.push(record);
    }
    return created;
  });
}

/** Applies (part of) an advance to due invoices. */
export async function adjustAdvance(actor: Actor, id: string, raw: unknown): Promise<CollectionDetail> {
  const { version, allocations } = adjustAdvanceSchema.parse(raw);
  const existing = await loadCollection(actor, id);
  if (existing.kind !== "ADVANCE") throw conflict("Only advance collections are adjusted against invoices.");
  await db().$transaction(async (tx) => {
    const { count } = await tx.salesCollection.updateMany({ where: { id, status: LIVE, updatedAt: new Date(version) }, data: { updatedAt: new Date() } });
    if (count === 0) throw conflict("This collection was cancelled or changed. Reload it and try again.");
    await lockCustomer(tx, existing.customerId);
    const applied = await tx.salesCollectionAllocation.aggregate({ where: { collectionId: id }, _sum: { amount: true } });
    const left = money(num(existing.amount) - num(applied._sum.amount));
    const wanted = money(allocations.reduce((sum, row) => sum + row.amount, 0));
    if (wanted > left + 1e-9) throw conflict(`Only ${left.toFixed(2)} of this advance is left to adjust.`);
    await assertPayable(tx, existing.customerId, allocations, fromDbDate(new Date()));
    for (const row of allocations) {
      await tx.salesCollectionAllocation.upsert({
        where: { collectionId_deliveryId: { collectionId: id, deliveryId: row.deliveryId } },
        create: { collectionId: id, deliveryId: row.deliveryId, amount: row.amount },
        update: { amount: { increment: row.amount } },
      });
    }
  });
  return getCollection(actor, id);
}

/** Cancels a money receipt: its invoices become due again. */
export async function cancelCollection(actor: Actor, id: string, raw: unknown): Promise<CollectionDetail> {
  requireApprover(actor);
  const { version, reason } = cancelSchema.parse(raw);
  const existing = await loadCollection(actor, id);
  if (existing.deliveryId) throw conflict("This money was collected on a delivery. Edit or delete that delivery instead.");
  const { count } = await db().salesCollection.updateMany({
    where: { id, status: LIVE, updatedAt: new Date(version) },
    data: { status: "CANCELLED", cancelledAt: new Date(), cancelledBy: actor.id, cancelReason: reason },
  });
  if (count === 0) throw conflict("This collection was already cancelled or changed. Reload it and try again.");
  return getCollection(actor, id);
}

export async function createBill(actor: Actor, raw: unknown, asOf: string): Promise<BillDetail> {
  const input = billInputSchema.parse(raw);
  const office = await requireParty(actor, { ...input, salesPersonId: null });
  const year = Number(input.billDate.slice(0, 4));
  const id = await db().$transaction(async (tx) => {
    await lockCustomer(tx, input.customerId);
    const dues = new Map((await invoiceDues(tx, { id: { in: input.deliveryIds }, customerId: input.customerId }, input.billDate)).map((row) => [row.deliveryId, row]));
    const lines = input.deliveryIds.map((deliveryId) => {
      const invoice = dues.get(deliveryId);
      if (!invoice) throw badRequest("An invoice does not belong to this customer or was deleted.");
      if (invoice.due <= 0) throw conflict(`${invoice.number} has nothing due.`);
      if (invoice.billNumber) throw conflict(`${invoice.number} is already on bill ${invoice.billNumber}.`);
      const detail = input.details.find((row) => row.deliveryId === deliveryId);
      return {
        deliveryId,
        amount: invoice.due,
        challanManual: detail?.challanManual ?? null,
        grnNumber: detail?.grnNumber ?? null,
        submissionDate: detail?.submissionDate ? toDbDate(detail.submissionDate) : null,
      };
    });
    const created = await tx.salesBill.create({
      data: {
        businessUnitId: office.businessUnitId,
        number: formatNumber("BL", year, await nextNumber(tx, office.businessUnitId, "SALES_BILL", year)),
        officeId: office.id,
        customerId: input.customerId,
        billDate: toDbDate(input.billDate),
        remarks: input.remarks,
        billType: input.billType,
        terms: input.terms,
        totalAmount: money(lines.reduce((sum, line) => sum + line.amount, 0)),
        createdBy: actor.id,
        lines: { create: lines },
      },
      select: { id: true },
    });
    return created.id;
  });
  return getBill(actor, id, asOf);
}

export async function cancelBill(actor: Actor, id: string, raw: unknown, asOf: string): Promise<BillDetail> {
  const { version, reason } = cancelSchema.parse(raw);
  const existing = await db().salesBill.findUnique({ where: { id }, select: { businessUnit: { select: { companyId: true } } } });
  if (!existing) throw notFound("Bill");
  assertCompanyAccess(actor, existing.businessUnit.companyId, "Bill");
  const { count } = await db().salesBill.updateMany({
    where: { id, status: LIVE, updatedAt: new Date(version) },
    data: { status: "CANCELLED", cancelledAt: new Date(), cancelledBy: actor.id, cancelReason: reason },
  });
  if (count === 0) throw conflict("This bill was already cancelled or changed. Reload it and try again.");
  return getBill(actor, id, asOf);
}

/** For deliveries: money from other receipts applied to it, or a live bill, blocks changes. */
export async function deliverySettlements(tx: Tx, deliveryId: string): Promise<{ collections: number; bills: number }> {
  const [collections, bills] = await Promise.all([
    tx.salesCollectionAllocation.count({
      where: { deliveryId, collection: { status: LIVE, OR: [{ deliveryId: null }, { deliveryId: { not: deliveryId } }] } },
    }),
    tx.salesBillLine.count({ where: { deliveryId, bill: { status: LIVE } } }),
  ]);
  return { collections, bills };
}

/** Active Wallet Setup wallets of the office's business unit (all offices or this one). */
export async function collectionWallets(actor: Actor, officeId: string): Promise<CollectionWallet[]> {
  const office = await requireOffice(actor, officeId);
  const wallets = await db().salesWallet.findMany({
    where: { businessUnitId: office.businessUnitId, isActive: true, OR: [{ officeId: null }, { officeId: office.id }] },
    select: { id: true, name: true, commissionPercent: true, isCash: true, isMfs: true, isReferenceRequired: true, bankAccount: { select: { glAccountId: true } } },
    orderBy: { name: "asc" },
  });
  return wallets.map((wallet) => ({
    id: wallet.id,
    name: wallet.name,
    commissionPercent: wallet.commissionPercent.toNumber(),
    isCash: wallet.isCash,
    isMfs: wallet.isMfs,
    isReferenceRequired: wallet.isReferenceRequired,
    glAccountId: wallet.bankAccount?.glAccountId ?? null,
  }));
}
