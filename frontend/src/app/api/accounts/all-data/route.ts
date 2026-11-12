import { NextResponse } from "next/server";
import { db } from "@/lib/prisma/client";
import { apiHandler } from "@/lib/api/handler";
import { can, type Actor } from "@/lib/auth/actor";

/** The accounts overview and reports read everything; other pages only their own data. */
const REPORTS = ["/accounts", "/accounts/financial-reports", "/accounts/other-reports"];

/** Pages that may load each section of the shared accounting store. */
const SECTION_PAGES = {
  budgets: ["/accounts/budget"],
  vouchers: ["/accounts/journal", "/accounts/chart-of-accounts"],
  coaPermissions: ["/accounts/chart-of-accounts"],
  bankAccounts: ["/accounts/banking", "/accounts/cheque-setup", "/accounts/cheque-issue", "/accounts/fund-transfers", "/accounts/expenses"],
  facilities: ["/accounts/banking"],
  chequeBooks: ["/accounts/banking", "/accounts/cheque-setup", "/accounts/cheque-issue"],
  chequeIssues: ["/accounts/banking", "/accounts/cheque-issue"],
  receivedCheques: ["/accounts/banking", "/accounts/cheque-issue"],
  expenses: ["/accounts/expenses"],
  fundTransfers: ["/accounts/fund-transfers"],
} as const;

async function handleGET(_request: Request, _context: unknown, actor: Actor) {
  try {
    const prisma = db();
    const may = (section: keyof typeof SECTION_PAGES) =>
      [...REPORTS, ...SECTION_PAGES[section]].some((page) => can(actor, page));
    const none = Promise.resolve([]);

    const [
      accounts,
      costCenters,
      budgets,
      vouchers,
      coaPermissions,
      bankAccounts,
      facilities,
      chequeBooks,
      chequeIssues,
      receivedCheques,
      expenses,
      fundTransfers,
      offices,
      employees,
    ] = await Promise.all([
      prisma.account.findMany({ orderBy: { code: "asc" } }),
      prisma.costCenter.findMany({ orderBy: { code: "asc" } }),
      may("budgets") ? prisma.budget.findMany({ include: { items: true }, orderBy: { createdAt: "desc" } }) : none,
      may("vouchers") ? prisma.journalVoucher.findMany({ include: { lines: true }, orderBy: [{ transactionDate: "desc" }, { createdAt: "desc" }] }) : none,
      may("coaPermissions") ? prisma.coaPermission.findMany({ orderBy: [{ employeeName: "asc" }, { accountHeadCode: "asc" }] }) : none,
      may("bankAccounts") ? prisma.bankAccount.findMany({ orderBy: { bankName: "asc" } }) : none,
      may("facilities") ? prisma.bankFacility.findMany({ orderBy: { createdAt: "desc" } }) : none,
      may("chequeBooks") ? prisma.chequeBook.findMany({ orderBy: { createdAt: "desc" } }) : none,
      may("chequeIssues") ? prisma.chequeIssue.findMany({ orderBy: { issueDate: "desc" } }) : none,
      may("receivedCheques") ? prisma.receivedCheque.findMany({ orderBy: { receivedDate: "desc" } }) : none,
      may("expenses") ? prisma.expenseRecord.findMany({ orderBy: [{ date: "desc" }, { createdAt: "desc" }] }) : none,
      may("fundTransfers") ? prisma.fundTransfer.findMany({ orderBy: [{ requestDate: "desc" }, { createdAt: "desc" }] }) : none,
      prisma.office.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
      prisma.employee.findMany({
        where: { isActive: true },
        select: { id: true, employeeCode: true, name: true, designation: true, officeId: true },
        orderBy: { name: "asc" },
      }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        accounts,
        costCenters,
        budgets,
        vouchers,
        coaPermissions,
        bankAccounts,
        facilities,
        chequeBooks,
        chequeIssues,
        receivedCheques,
        expenses,
        fundTransfers,
        offices,
        employees,
      },
    });
  } catch (error) {
    console.error("Failed to fetch all accounts data:", error);
    return NextResponse.json({ success: false, error: "Failed to fetch all accounts data" }, { status: 500 });
  }
}

export const GET = apiHandler("accounts:read", handleGET);
