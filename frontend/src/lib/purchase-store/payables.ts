import type { SupplierInvoiceItem, SupplierPaymentRecord } from "@bridgeone/contracts";
import { AppError, badRequest, notFound } from "@/lib/api/errors";
import { recordApproval } from "@/lib/approval/engine";
import type { Actor } from "@/lib/auth/actor";
import { db } from "@/lib/prisma/client";

/**
 * Supplier payables. What is owed comes from documents: goods receipts (less the
 * returns made against them) and ad-hoc supplier bills. Payments and returns
 * without a receipt are credits. A payment linked to a receipt or bill settles
 * that document first; everything else settles the oldest open document, and
 * what is left over is the supplier's advance.
 */

export interface PayableDocument {
  /** "R:<receiptId>" or "B:<billId>" (ad-hoc bill). */
  key: string;
  supplierId: string;
  date: Date;
  amount: number;
}

export interface PayableCredit {
  supplierId: string;
  amount: number;
  /** Document this credit settles first; null = oldest open document. */
  documentKey: string | null;
}

export interface Allocation {
  paidByDocument: Map<string, number>;
  /** Credit not used by any document, per supplier (advance). */
  unappliedBySupplier: Map<string, number>;
}

const round2 = (value: number) => Math.round(value * 100) / 100;

export function allocateCredits(documents: PayableDocument[], credits: PayableCredit[]): Allocation {
  const paidByDocument = new Map<string, number>(documents.map((d) => [d.key, 0]));
  const amountOf = new Map(documents.map((d) => [d.key, d.amount]));
  const open = (key: string) => Math.max(0, (amountOf.get(key) ?? 0) - (paidByDocument.get(key) ?? 0));
  const pool = new Map<string, number>();
  const addToPool = (supplierId: string, amount: number) => pool.set(supplierId, (pool.get(supplierId) ?? 0) + amount);

  for (const credit of credits) {
    if (credit.documentKey && amountOf.has(credit.documentKey)) {
      const applied = Math.min(credit.amount, open(credit.documentKey));
      paidByDocument.set(credit.documentKey, (paidByDocument.get(credit.documentKey) ?? 0) + applied);
      if (credit.amount > applied) addToPool(credit.supplierId, credit.amount - applied);
    } else {
      addToPool(credit.supplierId, credit.amount);
    }
  }

  const oldestFirst = [...documents].sort((a, b) => a.date.getTime() - b.date.getTime() || a.key.localeCompare(b.key));
  for (const doc of oldestFirst) {
    const available = pool.get(doc.supplierId) ?? 0;
    if (available <= 0) continue;
    const applied = Math.min(available, open(doc.key));
    paidByDocument.set(doc.key, (paidByDocument.get(doc.key) ?? 0) + applied);
    pool.set(doc.supplierId, available - applied);
  }

  for (const [key, paid] of paidByDocument) paidByDocument.set(key, round2(paid));
  for (const [supplierId, left] of pool) pool.set(supplierId, round2(left));
  return { paidByDocument, unappliedBySupplier: pool };
}

const num = (value: unknown) => Number(value ?? 0);
const dateStr = (d: Date) => d.toISOString().split("T")[0];

function paymentStatus(amount: number, paid: number): SupplierInvoiceItem["status"] {
  if (amount - paid <= 0.005) return "PAID";
  return paid > 0 ? "PARTIALLY_PAID" : "UNPAID";
}

/** Everything payables reports read, with the allocation applied. */
async function loadPayables() {
  const prisma = db();
  const [suppliers, receipts, returns, bills, payments] = await Promise.all([
    prisma.supplier.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    prisma.goodsReceipt.findMany({
      where: { status: { not: "CANCELLED" } },
      select: {
        id: true, supplierId: true, number: true, receiveDate: true, totalAmount: true, challanNumber: true,
        order: { select: { number: true } },
        bill: { select: { id: true, number: true, status: true, dueDate: true } },
      },
    }),
    prisma.purchaseReturn.findMany({ where: { status: { not: "CANCELLED" } }, select: { supplierId: true, receiptId: true, totalAmount: true } }),
    prisma.supplierBill.findMany({ where: { receiptId: null, status: { not: "CANCELLED" } } }),
    prisma.supplierPayment.findMany({ where: { status: "PAID" }, select: { supplierId: true, amount: true, receiptId: true, billId: true, isAdvance: true, paymentDate: true } }),
  ]);

  const returnedByReceipt = new Map<string, number>();
  for (const r of returns) if (r.receiptId) returnedByReceipt.set(r.receiptId, (returnedByReceipt.get(r.receiptId) ?? 0) + num(r.totalAmount));

  const documents: PayableDocument[] = [
    ...receipts.map((g) => ({ key: `R:${g.id}`, supplierId: g.supplierId, date: g.receiveDate, amount: Math.max(0, num(g.totalAmount) - (returnedByReceipt.get(g.id) ?? 0)) })),
    ...bills.map((b) => ({ key: `B:${b.id}`, supplierId: b.supplierId, date: b.billDate, amount: num(b.amount) })),
  ];
  // A bill booked against a receipt is the same debt as the receipt.
  const receiptOfBill = new Map(receipts.filter((g) => g.bill).map((g) => [g.bill!.id, g.id]));
  const credits: PayableCredit[] = [
    ...payments.map((p) => ({
      supplierId: p.supplierId,
      amount: num(p.amount),
      documentKey: p.receiptId ? `R:${p.receiptId}` : p.billId ? (receiptOfBill.has(p.billId) ? `R:${receiptOfBill.get(p.billId)}` : `B:${p.billId}`) : null,
    })),
    ...returns.filter((r) => !r.receiptId).map((r) => ({ supplierId: r.supplierId, amount: num(r.totalAmount), documentKey: null })),
  ];
  const allocation = allocateCredits(documents, credits);
  return { suppliers, receipts, returns, bills, payments, documents, allocation };
}

export async function listSupplierPayables(): Promise<SupplierPaymentRecord[]> {
  const { suppliers, receipts, returns, bills, payments, allocation } = await loadPayables();
  const sumBy = <T extends { supplierId: string }>(rows: T[], supplierId: string, value: (row: T) => number) =>
    rows.filter((r) => r.supplierId === supplierId).reduce((total, r) => total + value(r), 0);

  return suppliers.map((s) => {
    const totalPurchasedAmount = round2(sumBy(receipts, s.id, (g) => num(g.totalAmount)) + sumBy(bills, s.id, (b) => num(b.amount)));
    const returnedAmount = round2(sumBy(returns, s.id, (r) => num(r.totalAmount)));
    const own = payments.filter((p) => p.supplierId === s.id);
    const paidAmount = round2(own.reduce((total, p) => total + num(p.amount), 0));
    const dueAmount = round2(Math.max(0, totalPurchasedAmount - returnedAmount - paidAmount));
    const last = own.reduce<Date | null>((max, p) => (!max || p.paymentDate > max ? p.paymentDate : max), null);
    return {
      id: s.id,
      supplierId: s.id,
      supplierCode: s.code,
      supplierName: s.name,
      category: s.type === "FOREIGN" ? ("FOREIGN" as const) : ("LOCAL" as const),
      mobileNumber: s.phone || "",
      totalPurchasedAmount,
      returnedAmount,
      paidAmount,
      dueAmount,
      lastPaymentDate: last ? dateStr(last) : undefined,
      paymentStatus: paymentStatus(totalPurchasedAmount - returnedAmount, paidAmount),
      openInvoicesCount: receipts.filter((g) => g.supplierId === s.id).length + bills.filter((b) => b.supplierId === s.id).length,
      currency: "BDT",
      ledgerBalance: round2(num(s.balance)),
      advanceBalance: allocation.unappliedBySupplier.get(s.id) ?? 0,
    };
  });
}

/** One row per receipt and ad-hoc bill, with what is still due on it. */
export async function listSupplierInvoices(): Promise<SupplierInvoiceItem[]> {
  const { suppliers, receipts, bills, documents, allocation } = await loadPayables();
  const supplier = new Map(suppliers.map((s) => [s.id, s]));
  const amount = new Map(documents.map((d) => [d.key, d.amount]));
  const row = (key: string, base: Omit<SupplierInvoiceItem, "totalAmount" | "paidAmount" | "dueAmount" | "status" | "type" | "supplierName" | "supplierCode">) => {
    const total = amount.get(key) ?? 0;
    const paid = allocation.paidByDocument.get(key) ?? 0;
    const s = supplier.get(base.supplierId ?? "");
    return {
      ...base,
      supplierName: s?.name ?? "Supplier",
      supplierCode: s?.code,
      type: s?.type === "FOREIGN" ? ("FOREIGN" as const) : ("LOCAL" as const),
      totalAmount: total,
      paidAmount: paid,
      dueAmount: round2(Math.max(0, total - paid)),
      status: paymentStatus(total, paid),
    };
  };
  return [
    ...receipts.map((g) =>
      row(`R:${g.id}`, {
        id: g.id,
        invoiceNumber: g.bill?.number ?? g.challanNumber ?? g.number,
        poNumber: g.order?.number ?? "",
        grnNumber: g.number,
        invoiceDate: dateStr(g.receiveDate),
        dueDate: dateStr(g.bill?.dueDate ?? g.receiveDate),
        supplierId: g.supplierId,
        receiptId: g.id,
        billId: g.bill?.id,
        billNumber: g.bill?.number,
        billStatus: g.bill?.status,
      }),
    ),
    ...bills.map((b) =>
      row(`B:${b.id}`, {
        id: b.id,
        invoiceNumber: b.number,
        poNumber: "",
        invoiceDate: dateStr(b.billDate),
        dueDate: dateStr(b.dueDate),
        supplierId: b.supplierId,
        billId: b.id,
        billNumber: b.number,
        billStatus: b.status,
      }),
    ),
  ].sort((a, b) => b.invoiceDate.localeCompare(a.invoiceDate));
}

/** Booked bills (against a receipt or ad-hoc), newest first. */
export async function listSupplierBills() {
  const invoices = await listSupplierInvoices();
  return invoices.filter((inv) => inv.billId);
}

export async function createSupplierBill(input: Record<string, unknown>, actorName: string) {
  const prisma = db();
  const supplierId = String(input.supplierId ?? "");
  const receiptId = input.receiptId ? String(input.receiptId) : null;
  const number = String(input.number ?? "").trim();
  if (!number) throw badRequest("Enter the supplier's bill / invoice number.");
  const supplier = await prisma.supplier.findUnique({ where: { id: supplierId }, select: { id: true, businessUnitId: true } }).catch(() => null);
  if (!supplier) throw badRequest("Select the supplier.");

  let amount = Number(input.amount);
  if (receiptId) {
    const receipt = await prisma.goodsReceipt.findUnique({ where: { id: receiptId }, select: { supplierId: true, totalAmount: true, bill: { select: { id: true } } } }).catch(() => null);
    if (!receipt || receipt.supplierId !== supplierId) throw badRequest("The goods receipt does not belong to this supplier.");
    if (receipt.bill) throw badRequest("A bill is already booked for this goods receipt.");
    // The receipt already made its value payable; the bill records the invoice for it.
    amount = num(receipt.totalAmount);
  }
  if (!(amount > 0)) throw badRequest("Enter a bill amount greater than 0.");
  const billDate = new Date(String(input.billDate || dateStr(new Date())));
  const dueDate = new Date(String(input.dueDate || input.billDate || dateStr(new Date())));
  if (dueDate < billDate) throw badRequest("The due date is before the bill date.");

  return prisma.$transaction(async (tx) => {
    const bill = await tx.supplierBill.create({
      data: {
        businessUnitId: supplier.businessUnitId,
        supplierId,
        receiptId,
        number,
        billDate,
        dueDate,
        amount,
        remarks: input.remarks ? String(input.remarks).slice(0, 500) : null,
        createdBy: actorName,
      },
    });
    // Ad-hoc bills (services, utilities) add to what is owed.
    if (!receiptId) await tx.supplier.update({ where: { id: supplierId }, data: { balance: { increment: amount } } });
    return bill;
  });
}

const BILL_FEATURE = "Payment Approval";
const billTarget = (bill: { id: string; businessUnitId: string; amount: { toString(): string } }) => ({
  feature: BILL_FEATURE,
  documentId: bill.id,
  businessUnitId: bill.businessUnitId,
  amount: Number(bill.amount.toString()),
});

/** Approves a bill; with an `actor`, through the multilayer approval pipeline (stays PENDING until the last stage). */
export async function approveSupplierBill(id: string, actorName: string, actor?: Actor) {
  const bill = await db().supplierBill.findUnique({ where: { id } }).catch(() => null);
  if (!bill) throw notFound("Bill");
  if (bill.status !== "PENDING") throw badRequest(`Bill ${bill.number} is already ${bill.status.toLowerCase()}.`);
  return db().$transaction(async (tx) => {
    if (actor && !(await recordApproval(tx, actor, billTarget(bill))).final) return tx.supplierBill.findUniqueOrThrow({ where: { id } });
    return tx.supplierBill.update({ where: { id }, data: { status: "APPROVED", approvedBy: actorName, approvedAt: new Date() } });
  });
}

/**
 * Approves every pending bill. With an `actor`, each bill goes through its
 * pipeline; bills where the actor is not the current stage's approver are skipped.
 */
export async function approvePendingSupplierBills(actorName: string, actor?: Actor) {
  if (!actor) {
    const result = await db().supplierBill.updateMany({ where: { status: "PENDING" }, data: { status: "APPROVED", approvedBy: actorName, approvedAt: new Date() } });
    return { approved: result.count };
  }
  const pending = await db().supplierBill.findMany({ where: { status: "PENDING" }, select: { id: true, businessUnitId: true, amount: true } });
  let approved = 0;
  let advanced = 0;
  let skipped = 0;
  for (const bill of pending) {
    try {
      await db().$transaction(async (tx) => {
        const gate = await recordApproval(tx, actor, billTarget(bill));
        if (!gate.final) {
          advanced += 1;
          return;
        }
        await tx.supplierBill.update({ where: { id: bill.id }, data: { status: "APPROVED", approvedBy: actorName, approvedAt: new Date() } });
        approved += 1;
      });
    } catch (error) {
      if (error instanceof AppError && error.status === 403) skipped += 1;
      else throw error;
    }
  }
  return { approved, advanced, skipped };
}

/** Posted payments, newest first, with what each settled. */
export async function listPaymentHistory() {
  const rows = await db().supplierPayment.findMany({
    where: { status: "PAID" },
    include: { supplier: { select: { name: true, code: true } }, receipt: { select: { number: true } }, bill: { select: { number: true } } },
    orderBy: [{ paymentDate: "desc" }, { createdAt: "desc" }],
  });
  return rows.map((p) => ({
    id: p.id,
    number: p.number,
    paymentDate: dateStr(p.paymentDate),
    supplierName: p.supplier.name,
    supplierCode: p.supplier.code,
    settles: p.bill?.number ?? p.receipt?.number ?? (p.isAdvance ? "Advance" : "On account"),
    method: p.method,
    referenceNumber: p.referenceNumber ?? "",
    remarks: p.remarks ?? "",
    amount: num(p.amount),
    createdBy: p.createdBy ?? "",
  }));
}

/** Advances per supplier: paid as advance, and what is still unused. */
export async function listSupplierAdvances() {
  const { suppliers, payments, allocation } = await loadPayables();
  return suppliers
    .map((s) => {
      const advanceAmount = round2(payments.filter((p) => p.supplierId === s.id && p.isAdvance).reduce((t, p) => t + num(p.amount), 0));
      const remainingAdvance = Math.min(advanceAmount, allocation.unappliedBySupplier.get(s.id) ?? 0);
      return { supplierId: s.id, supplierCode: s.code, supplierName: s.name, advanceAmount, adjustAmount: round2(advanceAmount - remainingAdvance), remainingAdvance };
    })
    .filter((a) => a.advanceAmount > 0);
}

/** Checks a payment's link and amount before it is posted. */
export async function validatePaymentLink(supplierId: string, receiptId: string | null, billId: string | null, amount: number) {
  if (!receiptId && !billId) return;
  const invoices = await listSupplierInvoices();
  const target = invoices.find((inv) => (receiptId ? inv.receiptId === receiptId : inv.billId === billId));
  if (!target || target.supplierId !== supplierId) throw badRequest("The invoice does not belong to this supplier.");
  if (amount > target.dueAmount + 0.005) throw badRequest(`Only ${target.dueAmount.toFixed(2)} is due on ${target.invoiceNumber}.`);
}
