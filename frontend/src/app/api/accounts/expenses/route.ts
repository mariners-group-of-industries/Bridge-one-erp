import { NextResponse } from "next/server";
import { db } from "@/lib/prisma/client";
import { apiHandler } from "@/lib/api/handler";
import { AppError } from "@/lib/api/errors";
import { createExpenseRecord } from "@/features/accounts/server/expense.service";
import type { Actor } from "@/lib/auth/actor";

async function handleGET(request: Request) {
  try {
    const url = new URL(request.url);
    const kind = url.searchParams.get("kind");
    const prisma = db();
    const rows = await prisma.expenseRecord.findMany({
      where: kind ? { recordKind: kind } : undefined,
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    });
    return NextResponse.json({ success: true, data: rows });
  } catch (error) {
    console.error("Failed to fetch expenses:", error);
    return NextResponse.json({ success: false, error: "Failed to fetch expenses" }, { status: 500 });
  }
}

async function handlePOST(request: Request, _context: unknown, actor: Actor) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Request body must be valid JSON." }, { status: 400 });
  }
  try {
    const created = await createExpenseRecord(actor, body);
    return NextResponse.json({ success: true, data: created }, { status: 201 });
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.status });
    }
    console.error("Failed to create expense record:", error);
    return NextResponse.json({ success: false, error: "Failed to create expense record" }, { status: 500 });
  }
}

export const GET = apiHandler("accounts:read", handleGET);
export const POST = apiHandler("accounts:write", handlePOST);
