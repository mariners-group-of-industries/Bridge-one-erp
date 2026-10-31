import { NextResponse } from "next/server";
import { db } from "@/lib/prisma/client";
import { apiHandler } from "@/lib/api/handler";

async function handleGET() {
  try {
    const prisma = db();
    const [
      accounts,
      costCenters,
      budgets,
      vouchers,
      bankAccounts,
      chequeBooks,
      chequeIssues,
      receivedCheques,
      expenses,
      fundTransfers,
    ] = await Promise.all([
      prisma.account.findMany({ orderBy: { code: "asc" } }),
      prisma.costCenter.findMany({ orderBy: { code: "asc" } }),
      prisma.budget.findMany({ include: { items: true }, orderBy: { createdAt: "desc" } }),
      prisma.journalVoucher.findMany({ include: { lines: true }, orderBy: { transactionDate: "desc" } }),
      prisma.bankAccount.findMany({ orderBy: { bankName: "asc" } }),
      prisma.chequeBook.findMany({ orderBy: { createdAt: "desc" } }),
      prisma.chequeIssue.findMany({ orderBy: { issueDate: "desc" } }),
      prisma.receivedCheque.findMany({ orderBy: { receivedDate: "desc" } }),
      prisma.expenseRecord.findMany({ orderBy: { date: "desc" } }),
      prisma.fundTransfer.findMany({ orderBy: { requestDate: "desc" } }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        accounts,
        costCenters,
        budgets,
        vouchers,
        bankAccounts,
        chequeBooks,
        chequeIssues,
        receivedCheques,
        expenses,
        fundTransfers,
      },
    });
  } catch (error) {
    console.error("Failed to fetch all accounts data:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch all accounts data" },
      { status: 500 }
    );
  }
}

// Signed-in users with the accounts permission only.
export const GET = apiHandler("accounts:read", handleGET);
