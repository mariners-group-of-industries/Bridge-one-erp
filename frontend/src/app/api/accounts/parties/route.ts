import { NextResponse } from "next/server";
import { db } from "@/lib/prisma/client";
import { apiHandler } from "@/lib/api/handler";

/**
 * Choices for the accounts forms (iBOS Journal "Customer/Supplier/Employee" and
 * Expense "Supplier/Principle" / "Sales Order No"): names and codes only.
 * GET ?type=CUSTOMER|SUPPLIER|SALES_ORDER
 */
async function handleGET(request: Request) {
  const type = new URL(request.url).searchParams.get("type");
  const prisma = db();
  if (type === "SUPPLIER") {
    const data = await prisma.supplier.findMany({ where: { isActive: true }, select: { id: true, code: true, name: true }, orderBy: { name: "asc" } });
    return NextResponse.json({ success: true, data });
  }
  if (type === "CUSTOMER") {
    const data = await prisma.customer.findMany({ where: { isActive: true }, select: { id: true, code: true, name: true }, orderBy: { name: "asc" } });
    return NextResponse.json({ success: true, data });
  }
  if (type === "SALES_ORDER") {
    // The latest orders, as iBOS offers them on Create Expense.
    const rows = await prisma.salesOrder.findMany({ select: { id: true, number: true }, orderBy: { createdAt: "desc" }, take: 200 });
    return NextResponse.json({ success: true, data: rows.map((r) => ({ id: r.id, code: r.number, name: r.number })) });
  }
  return NextResponse.json({ success: false, error: "Unknown list." }, { status: 400 });
}

export const GET = apiHandler("accounts:read", handleGET);
