import { NextResponse } from "next/server";
import { db } from "@/lib/prisma/client";
import { apiHandler } from "@/lib/api/handler";
import { AppError } from "@/lib/api/errors";
import { createJournalVoucher } from "@/features/accounts/server/journal.service";

async function handleGET() {
  try {
    const prisma = db();
    const vouchers = await prisma.journalVoucher.findMany({
      include: {
        lines: true,
      },
      orderBy: [{ transactionDate: "desc" }, { createdAt: "desc" }],
    });
    return NextResponse.json({ success: true, data: vouchers });
  } catch (error) {
    console.error("Failed to fetch Journal Vouchers:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch Journal Vouchers" },
      { status: 500 }
    );
  }
}

async function handlePOST(request: Request, _context: unknown, actor: Parameters<typeof createJournalVoucher>[0]) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Request body must be valid JSON." }, { status: 400 });
  }
  try {
    const result = await createJournalVoucher(actor, body);
    return NextResponse.json({ success: true, data: result }, { status: 201 });
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.status });
    }
    console.error("Failed to create Journal Voucher:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create Journal Voucher" },
      { status: 500 }
    );
  }
}

// Signed-in users with the accounts permission only.
export const GET = apiHandler("accounts:read", handleGET);
export const POST = apiHandler("accounts:write", handlePOST);
