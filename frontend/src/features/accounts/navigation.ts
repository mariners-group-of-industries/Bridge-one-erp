import { Landmark } from "lucide-react";
import type { NavLink, Workspace } from "@/lib/navigation/types";
import { paths } from "./paths";

export const accountDashboard: NavLink = {
  label: "Account Dashboard",
  href: paths.dashboard,
  description: "Financial overview, KPIs, cash flow trends, and pending approvals.",
  keywords: ["dashboard", "accounts", "finance", "kpi", "cash flow", "overview"],
};

export const chartOfAccounts: NavLink = {
  label: "Chart of Accounts",
  href: paths.chartOfAccounts,
  description: "Hierarchical classification of Assets, Liabilities, Equity, Income, and Expenses.",
  keywords: ["coa", "chart of accounts", "ledger", "asset", "liability", "equity"],
};

export const accountingJournal: NavLink = {
  label: "Accounting Journal",
  href: paths.journal,
  description: "Double-entry journal vouchers, multi-line transactions, approvals and reversals.",
  keywords: ["journal", "voucher", "debit", "credit", "jv", "double entry"],
};

export const expenseAdvance: NavLink = {
  label: "Expense / Advance",
  href: paths.expenses,
  description: "Operational expense claims, employee advances, provisions, and settlements.",
  keywords: ["expense", "advance", "provision", "petty cash", "claim", "reimbursement"],
};

export const fundTransfer: NavLink = {
  label: "Fund Transfer",
  href: paths.fundTransfers,
  description: "Inter-branch and inter-bank fund transfer requests, transit tracking, and receipts.",
  keywords: ["fund transfer", "in transit", "remittance", "branch transfer"],
};

export const financeBanking: NavLink = {
  label: "Finance & Banking",
  href: paths.banking,
  description: "Bank accounts, fixed deposits, bank loans, factoring reports, and reconciliation.",
  keywords: ["banking", "bank account", "deposit", "loan", "factoring", "reconciliation"],
};

export const chequeSetup: NavLink = {
  label: "Cheque Setup",
  href: paths.chequeSetup,
  description: "Cheque book registration, leaf serial tracking, and inventory status.",
  keywords: ["cheque setup", "cheque book", "leaves", "leaf range"],
};

export const chequeIssue: NavLink = {
  label: "Cheque Issue",
  href: paths.chequeIssue,
  description: "Outgoing cheque issuances, clearance, bouncing, post-dated cheques, and registers.",
  keywords: ["cheque issue", "cheque register", "post dated", "bounced", "cleared"],
};

export const budgetManagement: NavLink = {
  label: "Budget",
  href: paths.budget,
  description: "Department and project budget allocations, utilization tracking, and revisions.",
  keywords: ["budget", "allocation", "cost budget", "capex", "opex", "utilization"],
};

export const centerSetup: NavLink = {
  label: "Center Setup",
  href: paths.centerSetup,
  description: "Profit and cost center masters for project and departmental accounting.",
  keywords: ["center setup", "cost center", "profit center", "department"],
};

export const financialReport: NavLink = {
  label: "Financial Report",
  href: paths.financialReports,
  description: "General Ledger, Trial Balance, Profit & Loss, Balance Sheet, and Cash Flow.",
  keywords: ["financial report", "general ledger", "trial balance", "balance sheet", "p&l"],
};

export const otherReports: NavLink = {
  label: "Other Reports",
  href: paths.otherReports,
  description: "VAT / AIT withholding, tax returns, audit registers, and cost center summaries.",
  keywords: ["other reports", "vat", "ait", "tax", "withholding", "audit"],
};

export const accountWorkspace: Workspace = {
  id: "account",
  label: "Account",
  icon: Landmark,
  href: paths.dashboard,
  description: "Double-entry accounting, journals, chart of accounts, banking, budgets, and reports.",
  status: "active",
  shortcuts: [
    accountDashboard,
    chartOfAccounts,
    accountingJournal,
    expenseAdvance,
    financeBanking,
    financialReport,
  ],
  cards: [
    {
      label: "",
      links: [
        accountDashboard,
        chartOfAccounts,
        accountingJournal,
        expenseAdvance,
        fundTransfer,
        financeBanking,
        chequeSetup,
        chequeIssue,
        budgetManagement,
        centerSetup,
        financialReport,
        otherReports,
      ],
    },
  ],
  routes: [
    { pattern: "/accounts/journal/[voucherId]", label: "Journal Voucher", parent: paths.journal },
    { pattern: "/accounts/expenses/[expenseId]", label: "Expense Record", parent: paths.expenses },
    { pattern: "/accounts/fund-transfers/[transferId]", label: "Transfer Details", parent: paths.fundTransfers },
    { pattern: "/accounts/budget/[budgetId]", label: "Budget Detail", parent: paths.budget },
  ],
};
