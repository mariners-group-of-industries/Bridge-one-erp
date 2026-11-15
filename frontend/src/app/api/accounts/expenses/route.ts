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

    // iBOS Create Expense: one or more GL lines; the expense amount is their total.
    const inputLines: Array<{ date?: string; accountId?: string; subGl?: string; remarks?: string; amount?: number }> = Array.isArray(body.lines) ? body.lines : [];
    const lineAccounts = inputLines.length
      ? await prisma.account.findMany({ where: { id: { in: inputLines.map((l) => uuidOrNull(l.accountId)).filter((x): x is string => Boolean(x)) } }, select: { id: true, code: true, name: true } })
      : [];
    const accountById = new Map(lineAccounts.map((a) => [a.id, a]));
    for (const [i, l] of inputLines.entries()) {
      if (!accountById.has(String(l.accountId))) {
        return NextResponse.json({ success: false, error: `Line ${i + 1}: select the account (GL).` }, { status: 400 });
      }
      if (!(Number(l.amount) > 0)) {
        return NextResponse.json({ success: false, error: `Line ${i + 1}: enter an amount greater than zero.` }, { status: 400 });
      }
    }
    const amount = inputLines.length ? Math.round(inputLines.reduce((s, l) => s + Number(l.amount), 0) * 100) / 100 : Number(body.amount || 0);
    if (!amount || amount <= 0) {
      return NextResponse.json({ success: false, error: "Amount must be greater than zero." }, { status: 400 });
    }
    const text = (value: unknown, max: number) => (typeof value === "string" && value.trim() ? value.trim().slice(0, max) : null);

    const prefix = kind === "ADVANCE" ? "ADV" : kind === "PROVISION" ? "PRV" : "EXP";
    const number = body.expenseNumber || `${prefix}-${new Date().getFullYear()}-${String(Date.now()).slice(-5)}`;
    // yyyy-mm-dd from the form; anything else would be read the wrong way round (dd/mm vs mm/dd).
    const dateVal = isoDateOrNull(body.date) ?? new Date();
    const validDate = Number.isNaN(dateVal.getTime()) ? new Date() : dateVal;

    const created = await prisma.$transaction(async (tx) => {
      // Resolve GL account if present (the first line's account when the expense has lines)
      const firstLineAccount = inputLines.length ? accountById.get(String(inputLines[0].accountId)) : undefined;
      let glAcc = firstLineAccount
        ? await tx.account.findUnique({ where: { id: firstLineAccount.id } })
        : uuidOrNull(body.accountId)
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
        include: { lines: true },
        data: {
          expenseNumber: number,
          recordKind: kind,
          officeId: uuidOrNull(body.officeId),
          officeName: body.officeName || null,
          expenseType: body.expenseType || kind,
          accountId: glAcc?.id ?? null,
          accountCode: glAcc?.code ?? (body.accountCode || null),
          accountName: glAcc?.name || body.accountName || "",
          payeeName: text(body.payeeName, 150) ?? text(body.employeeName, 150) ?? text(body.supplierName, 150) ?? "",
          employeeId: uuidOrNull(body.employeeId),
          employeeName: uuidOrNull(body.employeeId) ? text(body.employeeName, 150) : null,
          department: text(body.department, 100),
          salesOrderId: uuidOrNull(body.salesOrderId),
          salesOrderNo: uuidOrNull(body.salesOrderId) ? text(body.salesOrderNo, 30) : null,
          supplierId: uuidOrNull(body.supplierId),
          supplierName: uuidOrNull(body.supplierId) ? text(body.supplierName, 150) : null,
          attachmentId: uuidOrNull(body.attachmentId),
          lines: inputLines.length
            ? {
                create: inputLines.map((l, i) => {
                  const acc = accountById.get(String(l.accountId))!;
                  return {
                    lineNo: i + 1,
                    date: isoDateOrNull(l.date) ?? validDate,
                    accountId: acc.id,
                    accountCode: acc.code,
                    accountName: acc.name,
                    subGl: text(l.subGl, 150),
                    remarks: text(l.remarks, 500),
                    amount: Math.round(Number(l.amount) * 100) / 100,
                  };
                }),
              }
            : undefined,
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
              // Each expense line is its own debit; without lines the single expense account takes it all.
              ...(inputLines.length
                ? inputLines.map((l) => {
                    const acc = accountById.get(String(l.accountId))!;
                    return { accountId: acc.id, accountCode: acc.code, accountName: acc.name, debit: Math.round(Number(l.amount) * 100) / 100, credit: 0, narration: l.remarks || rec.description };
                  })
                : [{ accountId: expAcc.id, accountCode: expAcc.code, accountName: expAcc.name, debit: amount, credit: 0, narration: rec.description }]),
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
