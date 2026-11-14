import { NextResponse } from "next/server";
import { db } from "@/lib/prisma/client";
import { apiHandler } from "@/lib/api/handler";
import type { Actor } from "@/lib/auth/actor";
import { uuidOrNull } from "@/lib/accounting/ids";

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

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function handlePOST(request: Request, _context: unknown, actor: Actor) {
  try {
    const body = await request.json();
    const prisma = db();
    // Recorded as "prepared by": the signed-in user, never a name sent by the browser.
    const actorName = actor.name ?? actor.id;
    if (!UUID.test(String(body.officeId ?? ""))) {
      return NextResponse.json({ success: false, error: "Select the office." }, { status: 400 });
    }
    const badLine = (body.lines || []).findIndex((l: any) => !UUID.test(String(l?.accountId ?? "")));
    if (badLine >= 0) {
      return NextResponse.json({ success: false, error: `Line ${badLine + 1}: select the GL account.` }, { status: 400 });
    }

    const lines = body.lines || [];
    const totalDebit = lines.reduce((sum: number, l: any) => sum + (Number(l.debit) || 0), 0);
    const totalCredit = lines.reduce((sum: number, l: any) => sum + (Number(l.credit) || 0), 0);

    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      return NextResponse.json(
        {
          success: false,
          error: `Voucher is unbalanced! Total Debit (${totalDebit.toFixed(2)}) must equal Total Credit (${totalCredit.toFixed(2)}).`,
        },
        { status: 400 }
      );
    }

    if (lines.length < 2) {
      return NextResponse.json(
        { success: false, error: "A double-entry voucher must have at least two lines." },
        { status: 400 }
      );
    }

    const count = await prisma.journalVoucher.count();
    const voucherNumber = body.voucherNumber || `JV-${new Date().getFullYear()}-${(count + 1).toString().padStart(4, "0")}`;

    const result = await prisma.$transaction(async (tx) => {
      const voucher = await tx.journalVoucher.create({
        data: {
          voucherNumber,
          referenceNumber: body.referenceNumber || null,
          journalType: body.journalType || "GENERAL",
          transactionDate: new Date(body.transactionDate || Date.now()),
          officeId: body.officeId,
          officeName: body.officeName || null,
          fiscalYear: body.fiscalYear || String(new Date().getFullYear()),
          transType: body.transType ? String(body.transType).slice(0, 50) : null,
          narration: body.narration,
          totalDebit,
          totalCredit,
          amount: totalDebit,
          status: body.status || "POSTED",
          createdBy: actorName,
          preparedBy: actorName,
          approvedBy: body.status === "POSTED" ? actorName : null,
          postedAt: body.status === "POSTED" ? new Date() : null,
          lines: {
            // Lines keep the cost center id only (there is no cost center name column).
            create: lines.map((l: any, idx: number) => ({
              lineNo: idx + 1,
              accountId: l.accountId,
              accountCode: String(l.accountCode ?? ""),
              accountName: String(l.accountName ?? ""),
              costCenterId: uuidOrNull(l.costCenterId),
              narration: l.narration || null,
              debit: Number(l.debit) || 0,
              credit: Number(l.credit) || 0,
            })),
          },
        },
        include: {
          lines: true,
        },
      });

      // If status is POSTED, update account balances
      if (body.status === "POSTED") {
        for (const l of lines) {
          if (l.accountId) {
            const acc = await tx.account.findUnique({ where: { id: l.accountId } });
            if (acc) {
              const netChange =
                acc.normalBalance === "DEBIT"
                  ? Number(l.debit || 0) - Number(l.credit || 0)
                  : Number(l.credit || 0) - Number(l.debit || 0);

              await tx.account.update({
                where: { id: l.accountId },
                data: {
                  currentBalance: Number(acc.currentBalance) + netChange,
                },
              });
            }
          }
        }
      }

      return voucher;
    });

    return NextResponse.json({ success: true, data: result }, { status: 201 });
  } catch (error) {
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
