import { NextResponse } from "next/server";
import { db } from "@/lib/prisma/client";
import { apiHandler } from "@/lib/api/handler";
import { createVoucherInTx } from "@/lib/accounting/accounts-service";
import type { Actor } from "@/lib/auth/actor";

async function handlePATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
  actor: Actor
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const action = String(body?.action || "").toUpperCase();
    const prisma = db();

    const existing = await prisma.expenseRecord.findUnique({ where: { id }, include: { lines: { orderBy: { lineNo: "asc" } } } });
    if (!existing) {
      return NextResponse.json({ success: false, error: "Expense record not found" }, { status: 404 });
    }

    const updated = await prisma.$transaction(async (tx) => {
      if (action === "PAY" || action === "DISBURSE" || body.status === "PAID") {
        if (existing.status === "PAID") return existing;

        const targetStatus = existing.recordKind === "ADVANCE" ? "DISBURSED" : "PAID";
        const res = await tx.expenseRecord.update({
          where: { id },
          data: {
            status: targetStatus,
            approvedBy: actor.name,
            paidAt: new Date(),
          },
        });

        const creditAcc =
          (existing.paymentMethod === "CASH"
            ? await tx.account.findFirst({ where: { isGroup: false, code: { in: ["10101001", "1110"] } } })
            : await tx.account.findFirst({
                where: {
                  isGroup: false,
                  OR: [{ accountSubtype: "CASH_AT_BANK" }, { parentCode: "10102" }, { code: "1120" }],
                },
              })) ||
          (await tx.account.findFirst({ where: { isGroup: false, code: { in: ["10101001", "1110"] } } }));
        const debitAcc =
          (existing.accountId && (await tx.account.findUnique({ where: { id: existing.accountId } }))) ||
          (await tx.account.findFirst({ where: { accountType: existing.recordKind === "ADVANCE" ? "ASSET" : "EXPENSE", isGroup: false } }));

        if (debitAcc && creditAcc) {
          await createVoucherInTx(tx, {
            transactionDate: new Date(),
            officeId: existing.officeId,
            officeName: existing.officeName,
            journalType: "PAYMENT",
            narration: `Disbursement/Payment for ${existing.expenseNumber} (${existing.payeeName})`,
            referenceNumber: existing.expenseNumber,
            status: "POSTED",
            createdBy: actor.name || "Accounts User",
            approvedBy: actor.name || "Accounts User",
            lines: [
              // Each expense line is its own debit; without lines the single expense account takes it all.
              ...(existing.lines.length
                ? existing.lines.map((l) => ({ accountId: l.accountId, accountCode: l.accountCode, accountName: l.accountName, debit: Number(l.amount), credit: 0, narration: l.remarks || existing.description }))
                : [{ accountId: debitAcc.id, accountCode: debitAcc.code, accountName: debitAcc.name, debit: Number(existing.amount), credit: 0, narration: existing.description }]),
              { accountId: creditAcc.id, accountCode: creditAcc.code, accountName: creditAcc.name, debit: 0, credit: Number(existing.amount), narration: `Paid via ${existing.paymentMethod}` },
            ],
          });
        }
        return res;
      }

      if (action === "SETTLE") {
        const settleAmt = Number(body.settledAmount ?? existing.amount);
        return tx.expenseRecord.update({
          where: { id },
          data: {
            settledAmount: settleAmt,
            status: "SETTLED",
          },
        });
      }

      return tx.expenseRecord.update({
        where: { id },
        data: {
          status: body.status ?? existing.status,
          approvedBy: body.status === "APPROVED" ? actor.name : existing.approvedBy,
        },
      });
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error("Failed to update expense record:", error);
    return NextResponse.json({ success: false, error: "Failed to update expense record" }, { status: 500 });
  }
}

export const PATCH = apiHandler("accounts:write", handlePATCH);
