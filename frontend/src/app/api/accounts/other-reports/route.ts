import { NextResponse } from "next/server";
import { db } from "@/lib/prisma/client";
import { apiHandler } from "@/lib/api/handler";
import { isoDateOrNull } from "@/lib/accounting/ids";

/**
 * Accounts › Other Reports that read other modules' documents:
 *   COLLECTION        customer collections (Sales › Collection), as posted to the ledger;
 *   SUPPLIER_PAYMENT  supplier payments (Purchase › Supplier Payment).
 * GET ?type=COLLECTION|SUPPLIER_PAYMENT&fromDate=yyyy-mm-dd&toDate=yyyy-mm-dd
 */

const num = (v: unknown) => Number(v ?? 0);
const day = (d: Date) => d.toISOString().slice(0, 10);

async function handleGET(request: Request) {
  const params = new URL(request.url).searchParams;
  const from = isoDateOrNull(params.get("fromDate"));
  const to = isoDateOrNull(params.get("toDate"));
  const range = from || to ? { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } : undefined;
  const prisma = db();

  if (params.get("type") === "COLLECTION") {
    const rows = await prisma.salesCollection.findMany({
      where: { status: "SUBMITTED", ...(range ? { collectionDate: range } : {}) },
      select: { number: true, collectionDate: true, customerId: true, officeId: true, method: true, reference: true, amount: true },
      orderBy: [{ collectionDate: "asc" }, { number: "asc" }],
    });
    const [customers, offices] = await Promise.all([
      prisma.customer.findMany({ where: { id: { in: [...new Set(rows.map((r) => r.customerId))] } }, select: { id: true, code: true, name: true } }),
      prisma.office.findMany({ where: { id: { in: [...new Set(rows.map((r) => r.officeId).filter((id): id is string => Boolean(id)))] } }, select: { id: true, name: true } }),
    ]);
    const customer = new Map(customers.map((c) => [c.id, `${c.code} - ${c.name}`]));
    const office = new Map(offices.map((o) => [o.id, o.name]));
    return NextResponse.json({
      success: true,
      data: rows.map((r) => ({
        date: day(r.collectionDate),
        number: r.number,
        party: customer.get(r.customerId) ?? "—",
        office: (r.officeId && office.get(r.officeId)) || "—",
        method: r.method,
        reference: r.reference ?? "",
        amount: num(r.amount),
      })),
    });
  }

  if (params.get("type") === "SUPPLIER_PAYMENT") {
    const rows = await prisma.supplierPayment.findMany({
      where: { status: "PAID", ...(range ? { paymentDate: range } : {}) },
      select: {
        number: true,
        paymentDate: true,
        method: true,
        referenceNumber: true,
        amount: true,
        isAdvance: true,
        supplier: { select: { code: true, name: true } },
        office: { select: { name: true } },
        receipt: { select: { number: true } },
        bill: { select: { number: true } },
      },
      orderBy: [{ paymentDate: "asc" }, { number: "asc" }],
    });
    return NextResponse.json({
      success: true,
      data: rows.map((r) => ({
        date: day(r.paymentDate),
        number: r.number,
        party: `${r.supplier.code} - ${r.supplier.name}`,
        office: r.office?.name ?? "—",
        method: r.method,
        reference: r.referenceNumber ?? "",
        settles: r.bill?.number ?? r.receipt?.number ?? (r.isAdvance ? "Advance" : "On account"),
        amount: num(r.amount),
      })),
    });
  }

  return NextResponse.json({ success: false, error: "Unknown report." }, { status: 400 });
}

export const GET = apiHandler("accounts:read", handleGET);
