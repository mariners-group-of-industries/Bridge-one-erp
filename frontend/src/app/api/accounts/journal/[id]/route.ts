import { NextResponse } from "next/server";
import { db } from "@/lib/prisma/client";
import { apiHandler } from "@/lib/api/handler";
import { applyVoucherLinesToAccounts, createVoucherInTx } from "@/lib/accounting/accounts-service";
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

    const voucher = await prisma.journalVoucher.findUnique({
      where: { id },
      include: { lines: true },
    });
    if (!voucher) {
      return NextResponse.json({ success: false, error: "Journal voucher not found" }, { status: 404 });
    }

    if (action === "POST") {
      if (voucher.status === "POSTED") {
        return NextResponse.json({ success: true, data: voucher });
      }
      if (voucher.status === "REVERSED") {
        return NextResponse.json({ success: false, error: "Reversed vouchers cannot be posted." }, { status: 400 });
      }

      const updated = await prisma.$transaction(async (tx) => {
        const res = await tx.journalVoucher.update({
          where: { id },
          data: {
            status: "POSTED",
            approvedBy: actor.name || "Admin",
            postedAt: new Date(),
          },
          include: { lines: true },
        });
        await applyVoucherLinesToAccounts(tx, res.lines, 1);
        return res;
      });
      return NextResponse.json({ success: true, data: updated });
    }

    if (action === "REVERSE") {
      if (voucher.status !== "POSTED") {
        return NextResponse.json({ success: false, error: "Only POSTED vouchers can be reversed." }, { status: 400 });
      }
      if (voucher.reversedById) {
        return NextResponse.json({ success: false, error: "Voucher is already reversed." }, { status: 400 });
      }

      const result = await prisma.$transaction(async (tx) => {
        const reversal = await createVoucherInTx(tx, {
          voucherNumber: `REV-${voucher.voucherNumber}`,
          transactionDate: new Date(),
          officeId: voucher.officeId,
          officeName: voucher.officeName,
          fiscalYear: voucher.fiscalYear,
          journalType: "REVERSAL",
          narration: `Reversal of ${voucher.voucherNumber}: ${body.reason || "Adjustment"}`,
          referenceNumber: voucher.voucherNumber,
          status: "POSTED",
          createdBy: actor.name || "Admin",
          approvedBy: actor.name || "Admin",
          lines: voucher.lines.map((l) => ({
            accountId: l.accountId,
            accountCode: l.accountCode,
            accountName: l.accountName,
            debit: Number(l.credit),
            credit: Number(l.debit),
            narration: `Rev: ${l.narration || voucher.voucherNumber}`,
            costCenterId: l.costCenterId,
          })),
        });

        await tx.journalVoucher.update({
          where: { id: reversal.id },
          data: { reversalOfId: voucher.id },
        });
        await tx.journalVoucher.update({
          where: { id: voucher.id },
          data: { status: "REVERSED", reversedById: reversal.id },
        });
        return reversal;
      });

      return NextResponse.json({ success: true, data: result });
    }

    return NextResponse.json({ success: false, error: "Unsupported journal action" }, { status: 400 });
  } catch (error) {
    console.error("Failed to update Journal Voucher:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to update Journal Voucher" },
      { status: 500 }
    );
  }
}

async function handleDELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const prisma = db();
    const voucher = await prisma.journalVoucher.findUnique({ where: { id } });
    if (!voucher) {
      return NextResponse.json({ success: false, error: "Voucher not found" }, { status: 404 });
    }
    if (voucher.status === "POSTED") {
      return NextResponse.json(
        { success: false, error: "Cannot delete a POSTED voucher. Use Reverse instead." },
        { status: 400 }
      );
    }
    await prisma.journalVoucher.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete Journal Voucher:", error);
    return NextResponse.json({ success: false, error: "Failed to delete Journal Voucher" }, { status: 500 });
  }
}

export const PATCH = apiHandler("accounts:write", handlePATCH);
export const DELETE = apiHandler("accounts:write", handleDELETE);

