import { NextResponse } from "next/server";
import { db } from "@/lib/prisma/client";
import { apiHandler } from "@/lib/api/handler";
import { isoDateOrNull, uuidOrNull } from "@/lib/accounting/ids";
import { createVoucherInTx } from "@/lib/accounting/accounts-service";
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
  try {
    const body = await request.json();
    const prisma = db();

    const kind = String(body.recordKind || "EXPENSE").toUpperCase();
    const amount = Number(body.amount || 0);
    if (!amount || amount <= 0) {
      return NextResponse.json({ success: false, error: "Amount must be greater than zero." }, { status: 400 });
    }

    const prefix = kind === "ADVANCE" ? "ADV" : kind === "PROVISION" ? "PRV" : "EXP";
    const number = body.expenseNumber || `${prefix}-${new Date().getFullYear()}-${String(Date.now()).slice(-5)}`;
    // yyyy-mm-dd from the form; anything else would be read the wrong way round (dd/mm vs mm/dd).
    const dateVal = isoDateOrNull(body.date) ?? new Date();
    const validDate = Number.isNaN(dateVal.getTime()) ? new Date() : dateVal;

    const created = await prisma.$transaction(async (tx) => {
      // Resolve GL account if present
      let glAcc = uuidOrNull(body.accountId)
        ? await tx.account.findUnique({ where: { id: uuidOrNull(body.accountId)! } })
        : body.accountCode
        ? await tx.account.findUnique({ where: { code: body.accountCode } })
        : null;

      if (!glAcc && kind === "ADVANCE") {
        glAcc = await tx.account.findFirst({ where: { code: { in: ["10501", "105"] }, isGroup: false } });
      } else if (!glAcc && kind === "PROVISION") {
        glAcc = await tx.account.findFirst({ where: { code: { in: ["30301", "303"] }, isGroup: false } });
      }

      const rec = await tx.expenseRecord.create({
        data: {
          expenseNumber: number,
          recordKind: kind,
          officeId: uuidOrNull(body.officeId),
          officeName: body.officeName || "Corporate HO",
          expenseType: body.expenseType || kind,
          accountId: glAcc?.id ?? null,
          accountCode: glAcc?.code ?? (body.accountCode || null),
          accountName: glAcc?.name || body.accountName || "General Expense",
          payeeName: body.payeeName || "Unspecified Payee",
          amount,
          settledAmount: Number(body.settledAmount || 0),
          effectivePeriod: body.effectivePeriod || null,
          date: validDate,
          paymentMethod: body.paymentMethod || "BANK",
          referenceNumber: body.referenceNumber || null,
          description: body.description || null,
          status: body.status || (kind === "PROVISION" ? "ACTIVE" : "APPROVED"),
          approvedBy: body.status === "PAID" || kind === "PROVISION" ? actor.name : null,
          paidAt: body.status === "PAID" ? new Date() : null,
        },
      });

      // Automatically post JV if created directly as PAID or PROVISION
      if (rec.status === "PAID" || kind === "PROVISION") {
        const cashOrBank =
          (body.paymentMethod === "CASH"
            ? await tx.account.findFirst({ where: { isGroup: false, code: { in: ["10101001", "1110"] } } })
            : await tx.account.findFirst({
                where: {
                  isGroup: false,
                  OR: [{ accountSubtype: "CASH_AT_BANK" }, { parentCode: "10102" }, { code: "1120" }],
                },
              })) ||
          (await tx.account.findFirst({ where: { isGroup: false, code: { in: ["10101001", "1110"] } } }));
        const expAcc = glAcc || (await tx.account.findFirst({ where: { accountType: "EXPENSE", isGroup: false } }));
        if (expAcc && cashOrBank) {
          await createVoucherInTx(tx, {
            transactionDate: validDate,
            officeId: rec.officeId,
            officeName: rec.officeName,
            journalType: kind === "PROVISION" ? "ADJUSTMENT" : "PAYMENT",
            narration: `${rec.expenseNumber}: ${rec.expenseType} - ${rec.payeeName}`,
            referenceNumber: rec.expenseNumber,
            status: "POSTED",
            createdBy: actor.name || "Accounts User",
            approvedBy: actor.name || "Accounts User",
            lines: [
              { accountId: expAcc.id, accountCode: expAcc.code, accountName: expAcc.name, debit: amount, credit: 0, narration: rec.description },
              { accountId: cashOrBank.id, accountCode: cashOrBank.code, accountName: cashOrBank.name, debit: 0, credit: amount, narration: `Settlement via ${rec.paymentMethod}` },
            ],
          });
        }
      }

      return rec;
    });

    return NextResponse.json({ success: true, data: created }, { status: 201 });
  } catch (error) {
    console.error("Failed to create expense record:", error);
    return NextResponse.json({ success: false, error: "Failed to create expense record" }, { status: 500 });
  }
}

export const GET = apiHandler("accounts:read", handleGET);
export const POST = apiHandler("accounts:write", handlePOST);
