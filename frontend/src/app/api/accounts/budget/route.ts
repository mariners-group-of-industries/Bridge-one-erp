import { NextResponse } from "next/server";
import { db } from "@/lib/prisma/client";
import { apiHandler } from "@/lib/api/handler";

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

async function handlePOST(request: Request) {
  try {
    const body = await request.json();
    const prisma = db();

    const allocatedAmount = Number(body.allocatedAmount || body.totalBudgetAmount || 0);

    const created = await prisma.budget.create({
      data: {
        budgetCode: body.budgetCode,
        budgetName: body.budgetName,
        budgetYear: body.budgetYear,
        createDate: body.createDate || null,
        financialPeriod: body.financialPeriod || "Q1-Q4 FY 2026-27",
        officeId: body.officeId || null,
        officeName: body.officeName || "MBBL Corporate HO",
        costCenterId: body.costCenterId || null,
        costCenterName: body.costCenterName || null,
        budgetType: body.budgetType || "Expense",
        accountId: body.accountId || null,
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
        createdBy: body.createdBy || "Admin User",
        items: {
          create: (body.items || []).map((item: any) => ({
            accountCode: item.accountCode,
            accountName: item.accountName,
            costCenterName: item.costCenterName || body.costCenterName || null,
            allocatedAmount: Number(item.allocatedAmount || 0),
            utilizedAmount: Number(item.utilizedAmount || 0),
            remainingAmount: Number(item.remainingAmount || item.allocatedAmount || 0),
            remarks: item.remarks || null,
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
