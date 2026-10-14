import { NextResponse } from "next/server";
import { db } from "@/lib/prisma/client";

export async function GET() {
  try {
    const prisma = db();
    const [bankAccounts, chequeBooks, chequeIssues, receivedCheques] = await Promise.all([
      prisma.bankAccount.findMany({ orderBy: { bankName: "asc" } }),
      prisma.chequeBook.findMany({ orderBy: { createdAt: "desc" } }),
      prisma.chequeIssue.findMany({ orderBy: { issueDate: "desc" } }),
      prisma.receivedCheque.findMany({ orderBy: { receivedDate: "desc" } }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        bankAccounts,
        chequeBooks,
        chequeIssues,
        receivedCheques,
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

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const prisma = db();

    // Check entity type: "bankAccount", "chequeBook", "chequeIssue"
    if (body.entityType === "chequeBook") {
      const created = await prisma.chequeBook.create({
        data: {
          bookName: body.bookName,
          bankAccountId: body.bankAccountId || null,
          bankName: body.bankName,
          branchName: body.branchName || null,
          accountNumber: body.accountNumber,
          startChequeNumber: body.startChequeNumber,
          endChequeNumber: body.endChequeNumber,
          totalLeaves: Number(body.totalLeaves || 25),
          usedLeaves: 0,
          remainingLeaves: Number(body.totalLeaves || 25),
          status: body.status || "Running",
        },
      });
      return NextResponse.json({ success: true, data: created }, { status: 201 });
    }

    if (body.entityType === "chequeIssue") {
      const created = await prisma.chequeIssue.create({
        data: {
          chequeBookId: body.chequeBookId || null,
          chequeNumber: body.chequeNumber,
          bankAccountId: body.bankAccountId || null,
          bankName: body.bankName,
          transactionNumber: body.transactionNumber || `CHQ-${Date.now()}`,
          payeeName: body.payeeName,
          issueDate: new Date(body.issueDate || Date.now()),
          chequeDate: new Date(body.chequeDate || Date.now()),
          amount: Number(body.amount),
          purpose: body.purpose || "",
          referenceVoucher: body.referenceVoucher || null,
          status: body.status || "ISSUED",
        },
      });
      return NextResponse.json({ success: true, data: created }, { status: 201 });
    }

    // Default: create BankAccount
    const created = await prisma.bankAccount.create({
      data: {
        accountNumber: body.accountNumber,
        bankName: body.bankName,
        branchName: body.branchName,
        accountHolder: body.accountHolder,
        accountType: body.accountType || "CURRENT",
        currency: body.currency || "BDT",
        glAccountId: body.glAccountId || null,
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
