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

    const transfer = await prisma.fundTransfer.findUnique({ where: { id } });
    if (!transfer) {
      return NextResponse.json({ success: false, error: "Fund transfer not found" }, { status: 404 });
    }

    const updated = await prisma.$transaction(async (tx) => {
      if (action === "APPROVE") {
        return tx.fundTransfer.update({
          where: { id },
          data: {
            approvedAmount: Number(body.approvedAmount ?? transfer.requestedAmount),
            status: "APPROVED",
          },
        });
      }

      if (action === "DISPATCH") {
        const sent = Number(body.transferredAmount || transfer.approvedAmount || transfer.requestedAmount);
        const fromAcc =
          (transfer.fromAccountId && (await tx.account.findUnique({ where: { id: transfer.fromAccountId } }))) ||
          (await tx.account.findFirst({ where: { isGroup: false, code: { in: ["1120", "10101001", "1110"] } } }));
        const transitAcc =
          (await tx.account.findFirst({ where: { code: "1150", isGroup: false } })) ||
          (await tx.account.findFirst({ where: { accountType: "ASSET", isGroup: false } }));

        if (fromAcc && transitAcc) {
          await createVoucherInTx(tx, {
            transactionDate: new Date(),
            officeId: transfer.fromOfficeId,
            officeName: transfer.fromOfficeName,
            journalType: "CONTRA",
            narration: `Fund Transfer Dispatched: ${transfer.transferNumber} (${transfer.fromOfficeName} → ${transfer.toOfficeName})`,
            referenceNumber: transfer.transferNumber,
            status: "POSTED",
            createdBy: actor.name || "Accounts User",
            approvedBy: actor.name || "Accounts User",
            lines: [
              { accountId: transitAcc.id, accountCode: transitAcc.code, accountName: transitAcc.name, debit: sent, credit: 0, narration: "Fund in transit" },
              { accountId: fromAcc.id, accountCode: fromAcc.code, accountName: fromAcc.name, debit: 0, credit: sent, narration: "Dispatched from source" },
            ],
          });
        }

        return tx.fundTransfer.update({
          where: { id },
          data: {
            outCode: `OUT-${transfer.transferNumber}`,
            transferredAmount: sent,
            status: "IN_TRANSIT",
            dispatchedAt: new Date(),
          },
        });
      }

      if (action === "RECEIVE") {
        const received = Number(body.receivedAmount || transfer.transferredAmount || transfer.requestedAmount);
        const toAcc =
          (transfer.toAccountId && (await tx.account.findUnique({ where: { id: transfer.toAccountId } }))) ||
          (await tx.account.findFirst({ where: { isGroup: false, code: { in: ["10101001", "1110", "1120"] } } }));
        const transitAcc =
          (await tx.account.findFirst({ where: { code: "1150", isGroup: false } })) ||
          (await tx.account.findFirst({ where: { accountType: "ASSET", isGroup: false } }));

        if (toAcc && transitAcc) {
          await createVoucherInTx(tx, {
            transactionDate: new Date(),
            officeId: transfer.toOfficeId,
            officeName: transfer.toOfficeName,
            journalType: "CONTRA",
            narration: `Fund Transfer Received: ${transfer.transferNumber} at ${transfer.toOfficeName}`,
            referenceNumber: transfer.transferNumber,
            status: "POSTED",
            createdBy: actor.name || "Accounts User",
            approvedBy: actor.name || "Accounts User",
            lines: [
              { accountId: toAcc.id, accountCode: toAcc.code, accountName: toAcc.name, debit: received, credit: 0, narration: "Received at destination" },
              { accountId: transitAcc.id, accountCode: transitAcc.code, accountName: transitAcc.name, debit: 0, credit: received, narration: "Clear transit balance" },
            ],
          });
        }

        return tx.fundTransfer.update({
          where: { id },
          data: {
            receiveCode: `RCV-${transfer.transferNumber}`,
            receivedAmount: received,
            receivedPerson: actor.name,
            status: "RECEIVED",
            receivedAt: new Date(),
          },
        });
      }

      if (action === "RETURN") {
        const amt = Number(transfer.transferredAmount || transfer.requestedAmount);
        if (transfer.status === "IN_TRANSIT" && amt > 0) {
          const fromAcc =
            (transfer.fromAccountId && (await tx.account.findUnique({ where: { id: transfer.fromAccountId } }))) ||
            (await tx.account.findFirst({ where: { isGroup: false, code: { in: ["1120", "10101001", "1110"] } } }));
          const transitAcc = await tx.account.findFirst({ where: { code: "1150", isGroup: false } });
          if (fromAcc && transitAcc) {
            await createVoucherInTx(tx, {
              transactionDate: new Date(),
              officeId: transfer.fromOfficeId,
              officeName: transfer.fromOfficeName,
              journalType: "REVERSAL",
              narration: `Fund Transfer Returned: ${transfer.transferNumber}. Reason: ${body.reason || "Returned"}`,
              referenceNumber: transfer.transferNumber,
              status: "POSTED",
              createdBy: actor.name || "Accounts User",
              approvedBy: actor.name || "Accounts User",
              lines: [
                { accountId: fromAcc.id, accountCode: fromAcc.code, accountName: fromAcc.name, debit: amt, credit: 0, narration: "Returned to source" },
                { accountId: transitAcc.id, accountCode: transitAcc.code, accountName: transitAcc.name, debit: 0, credit: amt, narration: "Clear transit" },
              ],
            });
          }
        }
        return tx.fundTransfer.update({
          where: { id },
          data: {
            returnCode: `RET-${transfer.transferNumber}`,
            status: "RETURNED",
          },
        });
      }

      return transfer;
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error("Failed to update fund transfer:", error);
    return NextResponse.json({ success: false, error: "Failed to update fund transfer" }, { status: 500 });
  }
}

export const PATCH = apiHandler("accounts:write", handlePATCH);
