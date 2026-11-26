import { db } from "@/lib/prisma/client";
import { AppError } from "@/lib/api/errors";
import { uuidOrNull } from "@/lib/accounting/ids";
import { hasApprovalPipeline } from "@/lib/approval/engine";
import { denyUnless } from "@/lib/permissions/require";
import type { Actor } from "@/lib/auth/actor";

/** Who a line can be for (iBOS Customer/Supplier/Employee column). */
const PARTNER_TYPES = new Set(["CUSTOMER", "SUPPLIER", "EMPLOYEE"]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const text = (value: unknown, max: number) =>
  typeof value === "string" && value.trim() ? value.trim().slice(0, max) : null;

/**
 * Creates a journal voucher (with its lines and the account-balance updates for
 * POSTED vouchers) inside one transaction. Shared by the /api/accounts/journal
 * route and the Excel bulk import. Validation problems throw AppError(400).
 */
export async function createJournalVoucher(actor: Actor, body: Record<string, unknown> & { lines?: any[] }) {
  const prisma = db();
  // Recorded as "prepared by": the signed-in user, never a name sent by the browser.
  const actorName = actor.name ?? actor.id;
  // Without the Approve permission a voucher is saved as Pending, for an approver to post.
  const requested = String(body.status || "POSTED");
  const finalised = ["POSTED", "APPROVED"].includes(requested.toUpperCase());
  const status = finalised && denyUnless(actor, "/accounts/journal", "approve") ? "PENDING" : requested;
  if (!UUID.test(String(body.officeId ?? ""))) {
    throw new AppError(400, "VALIDATION_ERROR", "Select the office.");
  }
  const lines: any[] = Array.isArray(body.lines) ? body.lines : [];
  const badLine = lines.findIndex((l: any) => !UUID.test(String(l?.accountId ?? "")));
  if (badLine >= 0) {
    throw new AppError(400, "VALIDATION_ERROR", `Line ${badLine + 1}: select the GL account.`);
  }

  const totalDebit = lines.reduce((sum: number, l: any) => sum + (Number(l.debit) || 0), 0);
  const totalCredit = lines.reduce((sum: number, l: any) => sum + (Number(l.credit) || 0), 0);

  if (Math.abs(totalDebit - totalCredit) > 0.01) {
    throw new AppError(
      400,
      "VALIDATION_ERROR",
      `Voucher is unbalanced! Total Debit (${totalDebit.toFixed(2)}) must equal Total Credit (${totalCredit.toFixed(2)}).`,
    );
  }

  if (lines.length < 2) {
    throw new AppError(400, "VALIDATION_ERROR", "A double-entry voucher must have at least two lines.");
  }

  const count = await prisma.journalVoucher.count();
  const voucherNumber =
    typeof body.voucherNumber === "string" && body.voucherNumber.trim()
      ? body.voucherNumber.trim()
      : `JV-${new Date().getFullYear()}-${(count + 1).toString().padStart(4, "0")}`;

  return prisma.$transaction(async (tx) => {
    const needsApproval = finalised && (await hasApprovalPipeline(tx, "Journal Voucher"));
    const effectiveStatus = needsApproval ? "PENDING" : status;

    const voucher = await tx.journalVoucher.create({
      data: {
        voucherNumber,
        referenceNumber: text(body.referenceNumber, 100),
        journalType: String(body.journalType || "GENERAL"),
        transactionDate: new Date((body.transactionDate as string) || Date.now()),
        officeId: String(body.officeId),
        officeName: (body.officeName as string) || null,
        fiscalYear: (body.fiscalYear as string) || String(new Date().getFullYear()),
        transType: body.transType ? String(body.transType).slice(0, 50) : null,
        narration: (body.narration as string) || "",
        totalDebit,
        totalCredit,
        amount: totalDebit,
        status: effectiveStatus,
        createdBy: actorName,
        preparedBy: actorName,
        approvedBy: effectiveStatus === "POSTED" ? actorName : null,
        postedAt: effectiveStatus === "POSTED" ? new Date() : null,
        employeeId: uuidOrNull(body.employeeId),
        employeeName: uuidOrNull(body.employeeId) ? text(body.employeeName, 150) : null,
        projectId: uuidOrNull(body.projectId),
        projectName: uuidOrNull(body.projectId) ? text(body.projectName, 150) : null,
        attachmentId: uuidOrNull(body.attachmentId),
        lines: {
          // Lines keep the cost center id only (there is no cost center name column).
          create: lines.map((l: any, idx: number) => {
            const partnerId = PARTNER_TYPES.has(l.partnerType) ? uuidOrNull(l.partnerId) : null;
            return {
              lineNo: idx + 1,
              accountId: l.accountId,
              accountCode: String(l.accountCode ?? ""),
              accountName: String(l.accountName ?? ""),
              costCenterId: uuidOrNull(l.costCenterId),
              narration: l.narration || null,
              debit: Number(l.debit) || 0,
              credit: Number(l.credit) || 0,
              partnerType: partnerId ? l.partnerType : null,
              partnerId,
              partnerName: partnerId ? text(l.partnerName, 150) : null,
            };
          }),
        },
      },
      include: {
        lines: true,
      },
    });

    // If status is POSTED, update account balances
    if (effectiveStatus === "POSTED") {
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
}
