import { NextResponse } from "next/server";
import { db } from "@/lib/prisma/client";
import { apiHandler } from "@/lib/api/handler";
import { isoDateOrNull, isUuid } from "@/lib/accounting/ids";

/**
 * Supplier and customer ledgers for Accounts › Financial Report (Ledger Type
 * Supplier / Customer). Built from the documents themselves, counted the way the
 * general ledger posts them (src/lib/accounting/posting.service.ts):
 *   supplier: receipts and ad-hoc bills are credits; returns and payments are debits;
 *   customer: sales invoices are debits; returns and collections are credits.
 *
 * GET ?list=SUPPLIER|CUSTOMER                         → the parties to choose from
 * GET ?type=SUPPLIER|CUSTOMER&partyId=&fromDate=&toDate= → opening balance and entries
 */

type PartyType = "SUPPLIER" | "CUSTOMER";
interface Entry {
  date: Date;
  number: string;
  particulars: string;
  debit: number;
  credit: number;
}

const num = (v: unknown) => Number(v ?? 0);
const day = (d: Date) => d.toISOString().slice(0, 10);

async function supplierEntries(partyId: string): Promise<Entry[]> {
  const prisma = db();
  const [receipts, returns, payments, bills] = await Promise.all([
    prisma.goodsReceipt.findMany({ where: { supplierId: partyId, status: { not: "CANCELLED" } }, select: { number: true, receiveDate: true, totalAmount: true } }),
    prisma.purchaseReturn.findMany({ where: { supplierId: partyId, status: { not: "CANCELLED" } }, select: { number: true, returnDate: true, totalAmount: true } }),
    prisma.supplierPayment.findMany({ where: { supplierId: partyId, status: "PAID" }, select: { number: true, paymentDate: true, amount: true, method: true } }),
    prisma.supplierBill.findMany({ where: { supplierId: partyId, receiptId: null, status: { not: "CANCELLED" } }, select: { number: true, billDate: true, amount: true } }),
  ]);
  return [
    ...receipts.map((g) => ({ date: g.receiveDate, number: g.number, particulars: "Goods receipt", debit: 0, credit: num(g.totalAmount) })),
    ...bills.map((b) => ({ date: b.billDate, number: b.number, particulars: "Supplier bill", debit: 0, credit: num(b.amount) })),
    ...returns.map((r) => ({ date: r.returnDate, number: r.number, particulars: "Purchase return", debit: num(r.totalAmount), credit: 0 })),
    ...payments.map((p) => ({ date: p.paymentDate, number: p.number, particulars: `Payment (${p.method.toLowerCase()})`, debit: num(p.amount), credit: 0 })),
  ];
}

async function customerEntries(partyId: string): Promise<Entry[]> {
  const prisma = db();
  const [deliveries, returns, collections] = await Promise.all([
    prisma.salesDelivery.findMany({ where: { customerId: partyId, status: "SUBMITTED" }, select: { number: true, deliveryDate: true, totalAmount: true } }),
    prisma.salesReturn.findMany({ where: { customerId: partyId, status: "SUBMITTED" }, select: { number: true, returnDate: true, totalAmount: true } }),
    prisma.salesCollection.findMany({ where: { customerId: partyId, status: "SUBMITTED" }, select: { number: true, collectionDate: true, amount: true } }),
  ]);
  return [
    ...deliveries.map((d) => ({ date: d.deliveryDate, number: d.number, particulars: "Sales invoice", debit: num(d.totalAmount), credit: 0 })),
    ...returns.map((r) => ({ date: r.returnDate, number: r.number, particulars: "Sales return", debit: 0, credit: num(r.totalAmount) })),
    ...collections.map((c) => ({ date: c.collectionDate, number: c.number, particulars: "Collection", debit: 0, credit: num(c.amount) })),
  ];
}

async function handleGET(request: Request) {
  const params = new URL(request.url).searchParams;
  const list = params.get("list");
  if (list === "SUPPLIER" || list === "CUSTOMER") {
    const select = { id: true, code: true, name: true } as const;
    const data =
      list === "SUPPLIER"
        ? await db().supplier.findMany({ select, orderBy: { name: "asc" } })
        : await db().customer.findMany({ select, orderBy: { name: "asc" } });
    return NextResponse.json({ success: true, data });
  }

  const type = params.get("type") as PartyType | null;
  const partyId = params.get("partyId");
  if ((type !== "SUPPLIER" && type !== "CUSTOMER") || !isUuid(partyId)) {
    return NextResponse.json({ success: false, error: "Select the supplier or customer." }, { status: 400 });
  }
  const from = isoDateOrNull(params.get("fromDate"));
  const to = isoDateOrNull(params.get("toDate"));

  const all = (type === "SUPPLIER" ? await supplierEntries(partyId) : await customerEntries(partyId)).sort(
    (a, b) => a.date.getTime() - b.date.getTime() || a.number.localeCompare(b.number),
  );
  // Balance is debit minus credit: positive means the party owes us (Dr), negative that we owe them (Cr).
  let opening = 0;
  for (const e of all) if (from && e.date < from) opening += e.debit - e.credit;
  let balance = opening;
  const entries = all
    .filter((e) => (!from || e.date >= from) && (!to || e.date <= to))
    .map((e) => {
      balance += e.debit - e.credit;
      return { date: day(e.date), voucherNumber: e.number, particulars: e.particulars, debit: e.debit, credit: e.credit, balance: Math.round(balance * 100) / 100 };
    });
  return NextResponse.json({ success: true, data: { opening: Math.round(opening * 100) / 100, entries, closing: Math.round(balance * 100) / 100 } });
}

export const GET = apiHandler("accounts:read", handleGET);
