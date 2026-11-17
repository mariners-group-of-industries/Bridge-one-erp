import { NextResponse } from "next/server";
import { db } from "@/lib/prisma/client";
import { apiHandler } from "@/lib/api/handler";
import { AppError } from "@/lib/api/errors";
import { createBudget } from "@/features/accounts/server/budget.service";
import type { Actor } from "@/lib/auth/actor";

async function handleGET() {
  try {
    const prisma = db();
    const budgets = await prisma.budget.findMany({
      include: {
        items: true,
      },
      orderBy: [{ createdAt: "desc" }],
    });
    return NextResponse.json({ success: true, data: budgets });
  } catch (error) {
    console.error("Failed to fetch Budgets:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch Budgets" },
      { status: 500 }
    );
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
    const created = await createBudget(actor, body);
    return NextResponse.json({ success: true, data: created }, { status: 201 });
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.status });
    }
    console.error("Failed to create Budget:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create Budget" },
      { status: 500 }
    );
  }
}

// Signed-in users with the accounts permission only.
export const GET = apiHandler("accounts:read", handleGET);
export const POST = apiHandler("accounts:write", handlePOST);
