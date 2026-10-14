import { NextResponse } from "next/server";
import { db } from "@/lib/prisma/client";

export async function GET() {
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

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const prisma = db();

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
          officeId: body.officeId || null,
          officeName: body.officeName || "Corporate HO",
          fiscalYear: body.fiscalYear || "2026-2027",
          narration: body.narration,
          totalDebit,
          totalCredit,
          status: body.status || "POSTED",
          createdBy: body.createdBy || "Admin User",
          approvedBy: body.status === "POSTED" ? (body.approvedBy || body.postedBy || "Admin User") : null,
          postedAt: body.status === "POSTED" ? new Date() : null,
          lines: {
            create: lines.map((l: any) => ({
              accountId: l.accountId || null,
              accountCode: l.accountCode,
              accountName: l.accountName,
              costCenterId: l.costCenterId || null,
              costCenterName: l.costCenterName || null,
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
