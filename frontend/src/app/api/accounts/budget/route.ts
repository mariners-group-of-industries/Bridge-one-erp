import { NextResponse } from "next/server";
import { db } from "@/lib/prisma/client";
import { apiHandler } from "@/lib/api/handler";
import { isoDateOrNull, uuidOrNull } from "@/lib/accounting/ids";
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
  try {
    const body = await request.json();
    const prisma = db();

    // A line's amount is the sum of its months when months are given (iBOS Create Budget).
    const monthsOf = (item: any): Record<string, number> | null => {
      if (!item?.monthlyAmounts || typeof item.monthlyAmounts !== "object") return null;
      const out: Record<string, number> = {};
      for (const [k, v] of Object.entries(item.monthlyAmounts)) if (/^\d{4}-\d{2}$/.test(k) && Number(v) > 0) out[k] = Math.round(Number(v) * 100) / 100;
      return out;
    };
    const items = (Array.isArray(body.items) ? body.items : []).map((item: any) => {
      const months = monthsOf(item);
      const allocated = months ? Object.values(months).reduce((a, b) => a + b, 0) : Number(item.allocatedAmount || 0);
      return { item, months, allocated: Math.round(allocated * 100) / 100 };
    });
    const itemsTotal = items.reduce((t: number, x: { allocated: number }) => t + x.allocated, 0);
    const allocatedAmount = items.length ? itemsTotal : Number(body.allocatedAmount || body.totalBudgetAmount || 0);
    const fromPeriod = isoDateOrNull(body.fromPeriod);
    const toPeriod = isoDateOrNull(body.toPeriod);
    if (fromPeriod && toPeriod && toPeriod < fromPeriod) {
      return NextResponse.json({ success: false, error: "The To Period cannot be before the From Period." }, { status: 400 });
    }

    // The form does not send a code: number it BGT-YYYYMM-NNN, skipping any code already used.
    let budgetCode = typeof body.budgetCode === "string" && body.budgetCode.trim() ? body.budgetCode.trim().slice(0, 50) : "";
    if (!budgetCode) {
      const now = new Date();
      const prefix = `BGT-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}-`;
      let seq = (await prisma.budget.count({ where: { budgetCode: { startsWith: prefix } } })) + 1;
      while (await prisma.budget.findUnique({ where: { budgetCode: `${prefix}${String(seq).padStart(3, "0")}` }, select: { id: true } })) seq++;
      budgetCode = `${prefix}${String(seq).padStart(3, "0")}`;
    } else if (await prisma.budget.findUnique({ where: { budgetCode }, select: { id: true } })) {
      return NextResponse.json({ success: false, error: `Budget code ${budgetCode} is already used.` }, { status: 409 });
    }
    if (!String(body.budgetName ?? "").trim()) {
      return NextResponse.json({ success: false, error: "Enter the budget name." }, { status: 400 });
    }

    const created = await prisma.budget.create({
      data: {
        budgetCode,
        budgetName: body.budgetName,
        budgetYear: body.budgetYear || "",
        createDate: body.createDate || null,
        financialPeriod: body.financialPeriod || (fromPeriod && toPeriod ? `${body.fromPeriod} to ${body.toPeriod}` : ""),
        fromPeriod,
        toPeriod,
        remarks: typeof body.remarks === "string" && body.remarks.trim() ? body.remarks.trim().slice(0, 500) : null,
        officeId: uuidOrNull(body.officeId),
        officeName: body.officeName || null,
        costCenterId: uuidOrNull(body.costCenterId),
        costCenterName: body.costCenterName || null,
        budgetType: body.budgetType || "Expense",
        accountId: uuidOrNull(body.accountId),
        accountName: body.accountName || null,
        allocatedAmount,
        totalBudgetAmount: allocatedAmount,
        revisedAmount: body.revisedAmount ? Number(body.revisedAmount) : allocatedAmount,
        utilizedAmount: body.utilizedAmount ? Number(body.utilizedAmount) : 0,
        committedAmount: body.committedAmount ? Number(body.committedAmount) : 0,
        remainingAmount: allocatedAmount - (Number(body.utilizedAmount) || 0) - (Number(body.committedAmount) || 0),
        approvalStatus: body.approvalStatus || "Approved",
        status: body.status || "Approved",
        version: Number(body.version || 1),
        // The signed-in user, never a name sent by the browser.
        createdBy: actor.name ?? actor.id,
        items: {
          create: items.map(({ item, months, allocated }: { item: any; months: Record<string, number> | null; allocated: number }) => ({
            accountCode: item.accountCode,
            accountName: item.accountName,
            costCenterName: item.costCenterName || body.costCenterName || null,
            allocatedAmount: allocated,
            utilizedAmount: Number(item.utilizedAmount || 0),
            remainingAmount: allocated - Number(item.utilizedAmount || 0),
            remarks: item.remarks || null,
            headCode: item.headCode || null,
            headName: item.headName || null,
            monthlyAmounts: months ?? undefined,
          })),
        },
      },
      include: {
        items: true,
      },
    });

    return NextResponse.json({ success: true, data: created }, { status: 201 });
  } catch (error) {
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
