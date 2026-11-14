import { NextResponse } from "next/server";
import { db } from "@/lib/prisma/client";
import { apiHandler } from "@/lib/api/handler";

async function handlePATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const entityType = String(body?.entityType || "");
    const prisma = db();

    if (entityType === "chequeIssue") {
      const updated = await prisma.chequeIssue.update({
        where: { id },
        data: {
          status: body.status,
          cancellationReason: body.cancellationReason ?? undefined,
        },
      });
      return NextResponse.json({ success: true, data: updated });
    }

    if (entityType === "chequeBook") {
      const updated = await prisma.chequeBook.update({
        where: { id },
        data: {
          bookName: body.bookName ?? undefined,
          status: body.status ?? undefined,
        },
      });
      return NextResponse.json({ success: true, data: updated });
    }

    if (entityType === "receivedCheque") {
      const updated = await prisma.receivedCheque.update({
        where: { id },
        data: {
          depositStatus: body.depositStatus,
          depositDate: body.depositDate ? new Date(body.depositDate) : undefined,
        },
      });
      return NextResponse.json({ success: true, data: updated });
    }

    const updated = await prisma.bankAccount.update({
      where: { id },
      data: {
        reconciliationStatus: body.reconciliationStatus ?? undefined,
        isActive: body.isActive !== undefined ? Boolean(body.isActive) : undefined,
      },
    });
    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error("Failed to update banking record:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update banking record" },
      { status: 500 }
    );
  }
}

export const PATCH = apiHandler("accounts:write", handlePATCH);

