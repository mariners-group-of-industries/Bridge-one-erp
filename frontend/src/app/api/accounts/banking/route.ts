import { NextResponse } from "next/server";
import { db } from "@/lib/prisma/client";
import { apiHandler } from "@/lib/api/handler";
import { uuidOrNull } from "@/lib/accounting/ids";


async function handleGET() {
  try {
    const prisma = db();
    const [bankAccounts, chequeBooks, chequeIssues, receivedCheques, facilities] = await Promise.all([
      prisma.bankAccount.findMany({ orderBy: { bankName: "asc" } }),
      prisma.chequeBook.findMany({ orderBy: { createdAt: "desc" } }),
      prisma.chequeIssue.findMany({ orderBy: { issueDate: "desc" } }),
      prisma.receivedCheque.findMany({ orderBy: { receivedDate: "desc" } }),
      prisma.bankFacility.findMany({ orderBy: { createdAt: "desc" } }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        bankAccounts,
        chequeBooks,
        chequeIssues,
        receivedCheques,
        facilities,
      },
    });
  } catch (error) {
    console.error("Failed to fetch banking data:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch banking data" },
      { status: 500 }
    );
  }
}

async function handlePOST(request: Request) {
  try {
    const body = await request.json();
    const prisma = db();

    if (body.entityType === "chequeBook") {
      const start = parseInt(String(body.startChequeNumber || "").replace(/\D/g, ""), 10) || 0;
      const end = parseInt(String(body.endChequeNumber || "").replace(/\D/g, ""), 10) || 0;
      const leaves = body.totalLeaves ? Number(body.totalLeaves) : Math.max(1, end - start + 1);
      const created = await prisma.chequeBook.create({
        data: {
          bookName: body.bookName,
          bankAccountId: uuidOrNull(body.bankAccountId),
          bankName: body.bankName,
          branchName: body.branchName || null,
          accountNumber: body.accountNumber,
          startChequeNumber: body.startChequeNumber,
          endChequeNumber: body.endChequeNumber,
          totalLeaves: leaves,
          usedLeaves: 0,
          remainingLeaves: leaves,
          status: body.status || "Running",
        },
      });
      return NextResponse.json({ success: true, data: created }, { status: 201 });
    }

    if (body.entityType === "chequeIssue") {
      const created = await prisma.$transaction(async (tx) => {
        const issue = await tx.chequeIssue.create({
          data: {
            chequeBookId: uuidOrNull(body.chequeBookId),
            chequeNumber: body.chequeNumber,
            bankAccountId: uuidOrNull(body.bankAccountId),
            bankName: body.bankName,
            transactionNumber: body.transactionNumber || `CHQ-${Date.now().toString().slice(-6)}`,
            payeeName: body.payeeName,
            issueDate: new Date(body.issueDate || Date.now()),
            chequeDate: new Date(body.chequeDate || Date.now()),
            amount: Number(body.amount),
            purpose: body.purpose || "",
            referenceVoucher: body.referenceVoucher || null,
            status: body.status || "ISSUED",
          },
        });

        if (uuidOrNull(body.chequeBookId)) {
          const book = await tx.chequeBook.findUnique({ where: { id: body.chequeBookId } });
          if (book) {
            const nextUsed = book.usedLeaves + 1;
            const nextRemaining = Math.max(0, book.remainingLeaves - 1);
            await tx.chequeBook.update({
              where: { id: book.id },
              data: {
                usedLeaves: nextUsed,
                remainingLeaves: nextRemaining,
                status: nextRemaining <= 0 ? "EXHAUSTED" : book.status,
              },
            });
          }
        }
        return issue;
      });
      return NextResponse.json({ success: true, data: created }, { status: 201 });
    }

    if (body.entityType === "receivedCheque") {
      const created = await prisma.receivedCheque.create({
        data: {
          chequeNumber: body.chequeNumber,
          customerName: body.customerName,
          bankName: body.bankName,
          branchName: body.branchName || null,
          receivedDate: new Date(body.receivedDate || Date.now()),
          chequeDate: new Date(body.chequeDate || Date.now()),
          amount: Number(body.amount),
          depositStatus: body.depositStatus || "NOT_DEPOSITED",
          depositDate: body.depositDate ? new Date(body.depositDate) : null,
          remarks: body.remarks || null,
        },
      });
      return NextResponse.json({ success: true, data: created }, { status: 201 });
    }

    if (body.entityType === "deposit" || body.entityType === "loan" || body.entityType === "loanPartner") {
      const facilityKind =
        body.entityType === "deposit"
          ? "DEPOSIT"
          : body.entityType === "loan"
          ? "LOAN"
          : "PARTNER";
      const prefix = facilityKind === "DEPOSIT" ? "FDR" : facilityKind === "LOAN" ? "LN" : "LP";
      const facilityNumber =
        body.depositNumber ||
        body.loanNumber ||
        body.facilityNumber ||
        `${prefix}-${String(Date.now()).slice(-5)}`;
      const openingDate = body.openingDate || body.disbursementDate;
      const created = await prisma.bankFacility.create({
        data: {
          facilityKind,
          facilityNumber,
          bankAccountId: uuidOrNull(body.bankAccountId),
          officeId: uuidOrNull(body.officeId),
          officeName: body.officeName || null,
          partyName: body.bankName || body.lenderName || body.partnerName || "Financial Partner",
          facilityType: body.depositType || body.loanType || body.accountType || facilityKind,
          category: body.category || null,
          partnerGroup: body.partnerGroup || body.group || null,
          glAccountId: uuidOrNull(body.glAccountId),
          glAccountName: body.glAccountName || null,
          principalAmount: Number(body.principalAmount || body.principalFacility || 0),
          interestRate: Number(body.interestRate || 0),
          openingDate: openingDate ? new Date(openingDate) : null,
          maturityDate: body.maturityDate ? new Date(body.maturityDate) : null,
          maturityValue: Number(body.maturityValue || 0),
          installmentAmount: Number(body.installmentAmount || 0),
          outstandingPrincipal: Number(body.outstandingPrincipal ?? body.outstanding ?? body.principalAmount ?? 0),
          accruedInterest: Number(body.accruedInterest || 0),
          tenureMonths: body.tenureMonths ? Number(body.tenureMonths) : null,
          status: body.status || "ACTIVE",
        },
      });
      return NextResponse.json({ success: true, data: created }, { status: 201 });
    }

    const created = await prisma.bankAccount.create({
      data: {
        accountNumber: body.accountNumber,
        bankName: body.bankName,
        branchName: body.branchName,
        accountHolder: body.accountHolder,
        accountType: body.accountType || "CURRENT",
        currency: body.currency || "BDT",
        glAccountId: uuidOrNull(body.glAccountId),
        glAccountName: body.glAccountName || null,
        openingBalance: body.openingBalance ? Number(body.openingBalance) : 0,
        currentBalance: body.openingBalance ? Number(body.openingBalance) : 0,
        reconciliationStatus: body.reconciliationStatus || "RECONCILED",
        isActive: body.isActive !== undefined ? Boolean(body.isActive) : true,
      },
    });

    return NextResponse.json({ success: true, data: created }, { status: 201 });
  } catch (error) {
    console.error("Failed to create banking record:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create banking record" },
      { status: 500 }
    );
  }
}

export const GET = apiHandler("accounts:read", handleGET);
export const POST = apiHandler("accounts:write", handlePOST);
