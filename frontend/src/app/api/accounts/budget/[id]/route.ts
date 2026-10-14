import { NextResponse } from "next/server";
import { db } from "@/lib/prisma/client";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const prisma = db();

    // Check if this is a revision update
    if (body.revisedAmount !== undefined) {
      const budget = await prisma.budget.findUnique({ where: { id } });
      if (!budget) {
        return NextResponse.json({ success: false, error: "Budget not found" }, { status: 404 });
      }

      const nextVersion = (budget.version || 1) + 1;
      const codeBase = budget.budgetCode.replace(/\s*v\d+$/i, "");
      const newBudgetCode = `${codeBase} v${nextVersion}`;
      const revAmt = Number(body.revisedAmount);

      const updated = await prisma.budget.update({
        where: { id },
        data: {
          budgetCode: newBudgetCode,
          version: nextVersion,
          revisedAmount: revAmt,
          totalBudgetAmount: revAmt,
          allocatedAmount: revAmt,
          remainingAmount: revAmt - Number(budget.utilizedAmount) - Number(budget.committedAmount),
        },
        include: { items: true },
      });

      return NextResponse.json({ success: true, data: updated });
    }

    // Standard update
    const updated = await prisma.budget.update({
      where: { id },
      data: {
        budgetName: body.budgetName,
        budgetYear: body.budgetYear,
        financialPeriod: body.financialPeriod,
        officeName: body.officeName,
        costCenterName: body.costCenterName,
        budgetType: body.budgetType,
        status: body.status,
        approvalStatus: body.approvalStatus,
      },
      include: { items: true },
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error("Failed to update Budget:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update Budget" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const prisma = db();

    await prisma.budget.delete({ where: { id } });
    return NextResponse.json({ success: true, message: "Budget deleted" });
  } catch (error) {
    console.error("Failed to delete Budget:", error);
    return NextResponse.json(
      { success: false, error: "Failed to delete Budget" },
      { status: 500 }
    );
  }
}
