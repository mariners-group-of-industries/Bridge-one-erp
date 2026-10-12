"use client";

import { useSyncExternalStore } from "react";
import type {
  AccountItem,
  AdvanceRecord,
  BankAccountItem,
  BudgetItem,
  ChequeBookItem,
  ChequeIssueItem,
  CoaPermissionItem,
  CostCenterItem,
  DepositItem,
  ExpenseRecord,
  FactoringItem,
  FundTransferRecord,
  GeneralLedgerEntry,
  JournalVoucher,
  LoanItem,
  ProvisionRecord,
} from "../types";

export interface AccountDashboardKPIs {
  accountsReceivable: number;
  accountsPayable: number;
  cashInHand: number;
  cashAtBank: number;
  totalIncome: number;
  totalExpenses: number;
  openingCashAndBank: number;
  totalReceipts: number;
  totalPayments: number;
  closingCashAndBank: number;
  currentPeriodProfitLoss: number;
  pendingJournalVouchers: number;
  pendingExpenseApprovals: number;
  pendingFundTransfers: number;
  outstandingCheques: number;
  budgetUtilization: number;
}

export type BankDepositItem = DepositItem;
export type BankLoanItem = LoanItem;

export interface AccountingState {
  accounts: AccountItem[];
  vouchers: JournalVoucher[];
  expenses: ExpenseRecord[];
  advances: AdvanceRecord[];
  provisions: ProvisionRecord[];
  transfers: FundTransferRecord[];
  bankAccounts: BankAccountItem[];
  deposits: BankDepositItem[];
  loans: BankLoanItem[];
  factoring: FactoringItem[];
  chequeBooks: ChequeBookItem[];
  cheques: ChequeIssueItem[];
  budgets: BudgetItem[];
  costCenters: CostCenterItem[];
  coaPermissions: CoaPermissionItem[];

  // Actions - COA
  addAccount: (account: Omit<AccountItem, "id" | "currentBalance" | "createdAt" | "updatedAt">) => void;
  updateAccount: (id: string, updates: Partial<AccountItem>) => void;
  toggleAccountStatus: (id: string) => void;
  addCoaPermission: (perm: Omit<CoaPermissionItem, "id" | "createdAt">) => void;
  deleteCoaPermission: (id: string) => void;
  toggleCoaPermission: (id: string) => void;

  // Actions - Vouchers
  createVoucher: (voucher: Omit<JournalVoucher, "id" | "voucherNumber" | "totalDebit" | "totalCredit" | "createdAt">) => { success: boolean; message: string; voucher?: JournalVoucher };
  postVoucher: (id: string) => { success: boolean; message: string };
  reverseVoucher: (id: string, reason: string) => { success: boolean; message: string };

  // Actions - Expenses & Advances
  createExpense: (expense: Omit<ExpenseRecord, "id" | "expenseNumber" | "createdAt">) => void;
  updateExpenseStatus: (id: string, status: ExpenseRecord["status"], approvedBy?: string) => void;
  markExpensePaid: (id: string, paymentMethod: ExpenseRecord["paymentMethod"]) => void;
  createAdvance: (advance: Omit<AdvanceRecord, "id" | "advanceNumber" | "disbursedAmount" | "settledAmount" | "remainingBalance" | "createdAt">) => void;
  disburseAdvance: (id: string, amount: number) => void;
  settleAdvance: (id: string, amount: number) => void;
  createProvision: (provision: Omit<ProvisionRecord, "id" | "provisionNumber" | "createdAt">) => void;

  // Actions - Transfers
  createTransfer: (transfer: Omit<FundTransferRecord, "id" | "transferNumber" | "requestCode" | "approvedAmount" | "transferredAmount" | "receivedAmount" | "createdAt">) => void;
  approveTransfer: (id: string, approvedAmount: number) => void;
  dispatchTransfer: (id: string) => void;
  receiveTransfer: (id: string) => void;
  returnTransfer: (id: string, reason: string) => void;

  // Actions - Banking & Cheques
  addBankAccount: (account: Omit<BankAccountItem, "id" | "currentBalance" | "createdAt">) => void;
  addDeposit: (deposit: Omit<BankDepositItem, "id" | "depositNumber">) => void;
  addLoan: (loan: Omit<BankLoanItem, "id" | "loanNumber">) => void;
  addChequeBook: (book: Omit<ChequeBookItem, "id" | "usedLeaves" | "remainingLeaves" | "createdAt">) => { success: boolean; message: string };
  issueCheque: (cheque: Omit<ChequeIssueItem, "id" | "transactionNumber" | "createdAt">) => { success: boolean; message: string };
  updateChequeStatus: (id: string, status: ChequeIssueItem["status"], reason?: string) => void;

  // Actions - Budgets & Centers
  createBudget: (budget: Omit<BudgetItem, "id" | "budgetCode" | "revisedAmount" | "utilizedAmount" | "committedAmount" | "remainingAmount" | "createdAt">) => void;
  updateBudgetRevision: (id: string, revisedAmount: number) => void;
  addCostCenter: (center: Omit<CostCenterItem, "id" | "createdAt">) => void;

  // Analytics & Reports Helpers
  getDashboardKPIs: () => AccountDashboardKPIs;
  getGeneralLedger: (accountId?: string, fromDate?: string, toDate?: string) => GeneralLedgerEntry[];
  getTrialBalance: () => { rows: Array<{ code: string; name: string; type: string; debit: number; credit: number }>; totalDebit: number; totalCredit: number; isBalanced: boolean };
  getProfitAndLoss: (fromDate?: string, toDate?: string) => { revenues: Array<{ name: string; amount: number }>; expenses: Array<{ name: string; amount: number }>; totalRevenue: number; totalExpense: number; netProfit: number };
  getBalanceSheet: () => { assets: Array<{ name: string; amount: number }>; liabilities: Array<{ name: string; amount: number }>; equity: Array<{ name: string; amount: number }>; totalAssets: number; totalLiabilities: number; totalEquity: number; isBalanced: boolean };
}

const initialAccounts: AccountItem[] = [
  // 1: Current Assets (Group)
  { id: "acc-1", code: "1", name: "Current Assets", accountType: "ASSET", accountSubtype: "Group", tierLevel: "Group", normalBalance: "DEBIT", openingBalance: 30364410.09, currentBalance: 30364410.09, currency: "BDT", isGroup: true, status: "ACTIVE", createdAt: "2026-01-01", updatedAt: "2026-01-01" },

  // 1450: Cash And Cash Equivalent (Class)
  { id: "acc-1450", code: "1450", name: "Cash And Cash Equivalent", parentCode: "1", accountType: "ASSET", accountSubtype: "Class", tierLevel: "Class", normalBalance: "DEBIT", openingBalance: 2978453.04, currentBalance: 2978453.04, currency: "BDT", isGroup: true, status: "ACTIVE", createdAt: "2026-01-01", updatedAt: "2026-01-01" },

  // 1460: Cash Account (Category)
  { id: "acc-1460", code: "1460", name: "Cash Account", parentCode: "1450", accountType: "ASSET", accountSubtype: "Category", tierLevel: "Category", normalBalance: "DEBIT", openingBalance: 2128852.08, currentBalance: 2128852.08, currency: "BDT", isGroup: true, status: "ACTIVE", createdAt: "2026-01-01", updatedAt: "2026-01-01" },

  // GL Accounts under Cash Account
  { id: "acc-1461", code: "1461", name: "Cash In Hand", parentCode: "1460", accountType: "ASSET", accountSubtype: "GL", tierLevel: "GL", normalBalance: "DEBIT", openingBalance: 0, currentBalance: 0, currency: "BDT", isGroup: false, status: "ACTIVE", createdAt: "2026-01-01", updatedAt: "2026-01-01" },
  { id: "acc-10101003", code: "10101003", name: "Cash in Hand - Marinozz PLC", parentCode: "1460", accountType: "ASSET", accountSubtype: "GL", tierLevel: "GL", normalBalance: "DEBIT", openingBalance: 0, currentBalance: 0, currency: "BDT", isGroup: false, status: "ACTIVE", createdAt: "2026-01-01", updatedAt: "2026-01-01" },
  { id: "acc-10101004", code: "10101004", name: "Cash in Hand - MOHS ECO", parentCode: "1460", accountType: "ASSET", accountSubtype: "GL", tierLevel: "GL", normalBalance: "DEBIT", openingBalance: 3229, currentBalance: 3229, currency: "BDT", isGroup: false, status: "ACTIVE", createdAt: "2026-01-01", updatedAt: "2026-01-01" },
  { id: "acc-10101005", code: "10101005", name: "Cash in Hand - Factory", parentCode: "1460", accountType: "ASSET", accountSubtype: "GL", tierLevel: "GL", normalBalance: "DEBIT", openingBalance: 890631, currentBalance: 890631, currency: "BDT", isGroup: false, status: "ACTIVE", createdAt: "2026-01-01", updatedAt: "2026-01-01" },
  { id: "acc-10101006", code: "10101006", name: "Cash in Hand - MGV PLC", parentCode: "1460", accountType: "ASSET", accountSubtype: "GL", tierLevel: "GL", normalBalance: "DEBIT", openingBalance: 2062, currentBalance: 2062, currency: "BDT", isGroup: false, status: "ACTIVE", createdAt: "2026-01-01", updatedAt: "2026-01-01" },
  { id: "acc-10101007", code: "10101007", name: "Cash in Hand - MBBL", parentCode: "1460", accountType: "ASSET", accountSubtype: "GL", tierLevel: "GL", normalBalance: "DEBIT", openingBalance: 0, currentBalance: 0, currency: "BDT", isGroup: false, status: "ACTIVE", createdAt: "2026-01-01", updatedAt: "2026-01-01" },
  { id: "acc-10101010", code: "10101010", name: "Cash in Hand - CFF HO", parentCode: "1460", accountType: "ASSET", accountSubtype: "GL", tierLevel: "GL", normalBalance: "DEBIT", openingBalance: 0, currentBalance: 0, currency: "BDT", isGroup: false, status: "ACTIVE", createdAt: "2026-01-01", updatedAt: "2026-01-01" },
  { id: "acc-10101011", code: "10101011", name: "Cash in Hand - CFF Chapai", parentCode: "1460", accountType: "ASSET", accountSubtype: "GL", tierLevel: "GL", normalBalance: "DEBIT", openingBalance: 0, currentBalance: 0, currency: "BDT", isGroup: false, status: "ACTIVE", createdAt: "2026-01-01", updatedAt: "2026-01-01" },
  { id: "acc-10101013", code: "10101013", name: "Cash in Hand - MFIL HO", parentCode: "1460", accountType: "ASSET", accountSubtype: "GL", tierLevel: "GL", normalBalance: "DEBIT", openingBalance: 19184, currentBalance: 19184, currency: "BDT", isGroup: false, status: "ACTIVE", createdAt: "2026-01-01", updatedAt: "2026-01-01" },
  { id: "acc-10101014", code: "10101014", name: "Cash in Hand - CAT Chapai", parentCode: "1460", accountType: "ASSET", accountSubtype: "GL", tierLevel: "GL", normalBalance: "DEBIT", openingBalance: 0, currentBalance: 0, currency: "BDT", isGroup: false, status: "ACTIVE", createdAt: "2026-01-01", updatedAt: "2026-01-01" },
  { id: "acc-10101015", code: "10101015", name: "Cash in Hand - MOHS Unity Venture", parentCode: "1460", accountType: "ASSET", accountSubtype: "GL", tierLevel: "GL", normalBalance: "DEBIT", openingBalance: 1205746, currentBalance: 1205746, currency: "BDT", isGroup: false, status: "ACTIVE", createdAt: "2026-01-01", updatedAt: "2026-01-01" },

  // 10102: Cash At Bank (Category)
  { id: "acc-10102", code: "10102", name: "Cash At Bank", parentCode: "1450", accountType: "ASSET", accountSubtype: "Category", tierLevel: "Category", normalBalance: "DEBIT", openingBalance: 849600.96, currentBalance: 849600.96, currency: "BDT", isGroup: true, status: "ACTIVE", createdAt: "2026-01-01", updatedAt: "2026-01-01" },

  // GL Accounts under Cash At Bank
  { id: "acc-00001", code: "00001", name: "UCBL PABNA: 1872101000001011", parentCode: "10102", accountType: "ASSET", accountSubtype: "GL", tierLevel: "GL", normalBalance: "DEBIT", openingBalance: 0, currentBalance: 0, currency: "BDT", isGroup: false, status: "ACTIVE", createdAt: "2026-01-01", updatedAt: "2026-01-01" },
  { id: "acc-b2", code: "2", name: "DBBLMFAL P: 2331100024316", parentCode: "10102", accountType: "ASSET", accountSubtype: "GL", tierLevel: "GL", normalBalance: "DEBIT", openingBalance: 0, currentBalance: 0, currency: "BDT", isGroup: false, status: "ACTIVE", createdAt: "2026-01-01", updatedAt: "2026-01-01" },
  { id: "acc-b3", code: "3", name: "IBBLMFAMO: 20501450100552413", parentCode: "10102", accountType: "ASSET", accountSubtype: "GL", tierLevel: "GL", normalBalance: "DEBIT", openingBalance: 0, currentBalance: 0, currency: "BDT", isGroup: false, status: "ACTIVE", createdAt: "2026-01-01", updatedAt: "2026-01-01" },
  { id: "acc-b4", code: "4", name: "DBBL: 2861200000492", parentCode: "10102", accountType: "ASSET", accountSubtype: "GL", tierLevel: "GL", normalBalance: "DEBIT", openingBalance: 0, currentBalance: 0, currency: "BDT", isGroup: false, status: "ACTIVE", createdAt: "2026-01-01", updatedAt: "2026-01-01" },
  { id: "acc-b5", code: "5", name: "Feed DBBL: 2861100073676", parentCode: "10102", accountType: "ASSET", accountSubtype: "GL", tierLevel: "GL", normalBalance: "DEBIT", openingBalance: 26016, currentBalance: 26016, currency: "BDT", isGroup: false, status: "ACTIVE", createdAt: "2026-01-01", updatedAt: "2026-01-01" },
  { id: "acc-b6", code: "6", name: "MOHS DBBL: 2861100088709", parentCode: "10102", accountType: "ASSET", accountSubtype: "GL", tierLevel: "GL", normalBalance: "DEBIT", openingBalance: 1998, currentBalance: 1998, currency: "BDT", isGroup: false, status: "ACTIVE", createdAt: "2026-01-01", updatedAt: "2026-01-01" },
  { id: "acc-b7", code: "7", name: "BlueWave DBBL: 2861100028682", parentCode: "10102", accountType: "ASSET", accountSubtype: "GL", tierLevel: "GL", normalBalance: "DEBIT", openingBalance: 7042, currentBalance: 7042, currency: "BDT", isGroup: false, status: "ACTIVE", createdAt: "2026-01-01", updatedAt: "2026-01-01" },
  { id: "acc-b8", code: "8", name: "MBBL DBBL: 2861200015657", parentCode: "10102", accountType: "ASSET", accountSubtype: "GL", tierLevel: "GL", normalBalance: "DEBIT", openingBalance: 4083.09, currentBalance: 4083.09, currency: "BDT", isGroup: false, status: "ACTIVE", createdAt: "2026-01-01", updatedAt: "2026-01-01" },

  // 102: Receivables (Class)
  { id: "acc-102", code: "102", name: "Receivables", parentCode: "1", accountType: "ASSET", accountSubtype: "Class", tierLevel: "Class", normalBalance: "DEBIT", openingBalance: 14850220, currentBalance: 14850220, currency: "BDT", isGroup: true, status: "ACTIVE", createdAt: "2026-01-01", updatedAt: "2026-01-01" },
  { id: "acc-10201", code: "10201", name: "Accounts Receivable", parentCode: "102", accountType: "ASSET", accountSubtype: "GL", tierLevel: "GL", normalBalance: "DEBIT", openingBalance: 14850220, currentBalance: 14850220, currency: "BDT", isGroup: false, status: "ACTIVE", createdAt: "2026-01-01", updatedAt: "2026-01-01" },

  // 103: Inventory (Class)
  { id: "acc-103", code: "103", name: "Inventory", parentCode: "1", accountType: "ASSET", accountSubtype: "Class", tierLevel: "Class", normalBalance: "DEBIT", openingBalance: 8535737.05, currentBalance: 8535737.05, currency: "BDT", isGroup: true, status: "ACTIVE", createdAt: "2026-01-01", updatedAt: "2026-01-01" },
  { id: "acc-10301", code: "10301", name: "Raw Materials Inventory", parentCode: "103", accountType: "ASSET", accountSubtype: "GL", tierLevel: "GL", normalBalance: "DEBIT", openingBalance: 5240000, currentBalance: 5240000, currency: "BDT", isGroup: false, status: "ACTIVE", createdAt: "2026-01-01", updatedAt: "2026-01-01" },
  { id: "acc-10302", code: "10302", name: "Finished Goods Inventory", parentCode: "103", accountType: "ASSET", accountSubtype: "GL", tierLevel: "GL", normalBalance: "DEBIT", openingBalance: 3295737.05, currentBalance: 3295737.05, currency: "BDT", isGroup: false, status: "ACTIVE", createdAt: "2026-01-01", updatedAt: "2026-01-01" },

  // 104 - 108: Current Assets classes
  { id: "acc-104", code: "104", name: "Other Current Assets", parentCode: "1", accountType: "ASSET", accountSubtype: "Class", tierLevel: "Class", normalBalance: "DEBIT", openingBalance: 1500000, currentBalance: 1500000, currency: "BDT", isGroup: false, status: "ACTIVE", createdAt: "2026-01-01", updatedAt: "2026-01-01" },
  { id: "acc-105", code: "105", name: "Advance, Deposits & Pre-Payments", parentCode: "1", accountType: "ASSET", accountSubtype: "Class", tierLevel: "Class", normalBalance: "DEBIT", openingBalance: 2500000, currentBalance: 2500000, currency: "BDT", isGroup: false, status: "ACTIVE", createdAt: "2026-01-01", updatedAt: "2026-01-01" },
  { id: "acc-106", code: "106", name: "Income Tax Assets", parentCode: "1", accountType: "ASSET", accountSubtype: "Class", tierLevel: "Class", normalBalance: "DEBIT", openingBalance: 0, currentBalance: 0, currency: "BDT", isGroup: false, status: "ACTIVE", createdAt: "2026-01-01", updatedAt: "2026-01-01" },
  { id: "acc-107", code: "107", name: "Investment And Financial Receivable", parentCode: "1", accountType: "ASSET", accountSubtype: "Class", tierLevel: "Class", normalBalance: "DEBIT", openingBalance: 0, currentBalance: 0, currency: "BDT", isGroup: false, status: "ACTIVE", createdAt: "2026-01-01", updatedAt: "2026-01-01" },
  { id: "acc-108", code: "108", name: "Equipment", parentCode: "1", accountType: "ASSET", accountSubtype: "Class", tierLevel: "Class", normalBalance: "DEBIT", openingBalance: 0, currentBalance: 0, currency: "BDT", isGroup: false, status: "ACTIVE", createdAt: "2026-01-01", updatedAt: "2026-01-01" },

  // 2: Non-Current Assets (Group)
  { id: "acc-2", code: "2", name: "Non-Current Assets", accountType: "ASSET", accountSubtype: "Group", tierLevel: "Group", normalBalance: "DEBIT", openingBalance: 45200000, currentBalance: 45200000, currency: "BDT", isGroup: true, status: "ACTIVE", createdAt: "2026-01-01", updatedAt: "2026-01-01" },
  { id: "acc-201", code: "201", name: "Property, Plant And Equipment", parentCode: "2", accountType: "ASSET", accountSubtype: "Class", tierLevel: "Class", normalBalance: "DEBIT", openingBalance: 38000000, currentBalance: 38000000, currency: "BDT", isGroup: false, status: "ACTIVE", createdAt: "2026-01-01", updatedAt: "2026-01-01" },
  { id: "acc-202", code: "202", name: "Goodwill", parentCode: "2", accountType: "ASSET", accountSubtype: "Class", tierLevel: "Class", normalBalance: "DEBIT", openingBalance: 2000000, currentBalance: 2000000, currency: "BDT", isGroup: false, status: "ACTIVE", createdAt: "2026-01-01", updatedAt: "2026-01-01" },
  { id: "acc-203", code: "203", name: "Advance For Capital Assets", parentCode: "2", accountType: "ASSET", accountSubtype: "Class", tierLevel: "Class", normalBalance: "DEBIT", openingBalance: 3500000, currentBalance: 3500000, currency: "BDT", isGroup: false, status: "ACTIVE", createdAt: "2026-01-01", updatedAt: "2026-01-01" },
  { id: "acc-204", code: "204", name: "Intangible Assets", parentCode: "2", accountType: "ASSET", accountSubtype: "Class", tierLevel: "Class", normalBalance: "DEBIT", openingBalance: 1700000, currentBalance: 1700000, currency: "BDT", isGroup: false, status: "ACTIVE", createdAt: "2026-01-01", updatedAt: "2026-01-01" },
  { id: "acc-205", code: "205", name: "Long Term Investments", parentCode: "2", accountType: "ASSET", accountSubtype: "Class", tierLevel: "Class", normalBalance: "DEBIT", openingBalance: 0, currentBalance: 0, currency: "BDT", isGroup: false, status: "ACTIVE", createdAt: "2026-01-01", updatedAt: "2026-01-01" },
  { id: "acc-206", code: "206", name: "Other Non Current Assets", parentCode: "2", accountType: "ASSET", accountSubtype: "Class", tierLevel: "Class", normalBalance: "DEBIT", openingBalance: 0, currentBalance: 0, currency: "BDT", isGroup: false, status: "ACTIVE", createdAt: "2026-01-01", updatedAt: "2026-01-01" },
  { id: "acc-207", code: "207", name: "Deffered Tax Assets", parentCode: "2", accountType: "ASSET", accountSubtype: "Class", tierLevel: "Class", normalBalance: "DEBIT", openingBalance: 0, currentBalance: 0, currency: "BDT", isGroup: false, status: "ACTIVE", createdAt: "2026-01-01", updatedAt: "2026-01-01" },

  // 3: Current Liabilities (Group)
  { id: "acc-3", code: "3", name: "Current Liabilities", accountType: "LIABILITY", accountSubtype: "Group", tierLevel: "Group", normalBalance: "CREDIT", openingBalance: 18450000, currentBalance: 18450000, currency: "BDT", isGroup: true, status: "ACTIVE", createdAt: "2026-01-01", updatedAt: "2026-01-01" },
  { id: "acc-301", code: "301", name: "Accounts Payable", parentCode: "3", accountType: "LIABILITY", accountSubtype: "Class", tierLevel: "Class", normalBalance: "CREDIT", openingBalance: 12300000, currentBalance: 12300000, currency: "BDT", isGroup: false, status: "ACTIVE", createdAt: "2026-01-01", updatedAt: "2026-01-01" },
  { id: "acc-302", code: "302", name: "Other Current Liabilities", parentCode: "3", accountType: "LIABILITY", accountSubtype: "Class", tierLevel: "Class", normalBalance: "CREDIT", openingBalance: 3150000, currentBalance: 3150000, currency: "BDT", isGroup: false, status: "ACTIVE", createdAt: "2026-01-01", updatedAt: "2026-01-01" },
  { id: "acc-303", code: "303", name: "Payables, Provision And Accruals", parentCode: "3", accountType: "LIABILITY", accountSubtype: "Class", tierLevel: "Class", normalBalance: "CREDIT", openingBalance: 3000000, currentBalance: 3000000, currency: "BDT", isGroup: false, status: "ACTIVE", createdAt: "2026-01-01", updatedAt: "2026-01-01" },

  // 4: Non-Current Liabilities (Group)
  { id: "acc-4", code: "4", name: "Non-Current Liabilities", accountType: "LIABILITY", accountSubtype: "Group", tierLevel: "Group", normalBalance: "CREDIT", openingBalance: 15000000, currentBalance: 15000000, currency: "BDT", isGroup: true, status: "ACTIVE", createdAt: "2026-01-01", updatedAt: "2026-01-01" },
  { id: "acc-401", code: "401", name: "Long Term Bank Borrowings", parentCode: "4", accountType: "LIABILITY", accountSubtype: "Class", tierLevel: "Class", normalBalance: "CREDIT", openingBalance: 15000000, currentBalance: 15000000, currency: "BDT", isGroup: false, status: "ACTIVE", createdAt: "2026-01-01", updatedAt: "2026-01-01" },

  // 5: Equity (Group)
  { id: "acc-5", code: "5", name: "Equity", accountType: "EQUITY", accountSubtype: "Group", tierLevel: "Group", normalBalance: "CREDIT", openingBalance: 42114410.09, currentBalance: 42114410.09, currency: "BDT", isGroup: true, status: "ACTIVE", createdAt: "2026-01-01", updatedAt: "2026-01-01" },
  { id: "acc-501", code: "501", name: "Paid-Up Share Capital", parentCode: "5", accountType: "EQUITY", accountSubtype: "Class", tierLevel: "Class", normalBalance: "CREDIT", openingBalance: 30000000, currentBalance: 30000000, currency: "BDT", isGroup: false, status: "ACTIVE", createdAt: "2026-01-01", updatedAt: "2026-01-01" },
  { id: "acc-502", code: "502", name: "Retained Earnings", parentCode: "5", accountType: "EQUITY", accountSubtype: "Class", tierLevel: "Class", normalBalance: "CREDIT", openingBalance: 12114410.09, currentBalance: 12114410.09, currency: "BDT", isGroup: false, status: "ACTIVE", createdAt: "2026-01-01", updatedAt: "2026-01-01" },

  // 6: Revenue
  { id: "acc-6", code: "6", name: "Revenue / Operating Income", accountType: "REVENUE", accountSubtype: "Group", tierLevel: "Group", normalBalance: "CREDIT", openingBalance: 65000000, currentBalance: 65000000, currency: "BDT", isGroup: true, status: "ACTIVE", createdAt: "2026-01-01", updatedAt: "2026-01-01" },
  { id: "acc-601", code: "601", name: "Sales Income", parentCode: "6", accountType: "REVENUE", accountSubtype: "Class", tierLevel: "Class", normalBalance: "CREDIT", openingBalance: 62000000, currentBalance: 62000000, currency: "BDT", isGroup: false, status: "ACTIVE", createdAt: "2026-01-01", updatedAt: "2026-01-01" },
  { id: "acc-602", code: "602", name: "Service & Consultancy Income", parentCode: "6", accountType: "REVENUE", accountSubtype: "Class", tierLevel: "Class", normalBalance: "CREDIT", openingBalance: 3000000, currentBalance: 3000000, currency: "BDT", isGroup: false, status: "ACTIVE", createdAt: "2026-01-01", updatedAt: "2026-01-01" },

  // 7: Expenses
  { id: "acc-7", code: "7", name: "Expenses", accountType: "EXPENSE", accountSubtype: "Group", tierLevel: "Group", normalBalance: "DEBIT", openingBalance: 48000000, currentBalance: 48000000, currency: "BDT", isGroup: true, status: "ACTIVE", createdAt: "2026-01-01", updatedAt: "2026-01-01" },
  { id: "acc-701", code: "701", name: "Cost of Goods Sold (COGS)", parentCode: "7", accountType: "EXPENSE", accountSubtype: "Class", tierLevel: "Class", normalBalance: "DEBIT", openingBalance: 35000000, currentBalance: 35000000, currency: "BDT", isGroup: false, status: "ACTIVE", createdAt: "2026-01-01", updatedAt: "2026-01-01" },
  { id: "acc-702", code: "702", name: "Administrative & Operating Expenses", parentCode: "7", accountType: "EXPENSE", accountSubtype: "Class", tierLevel: "Class", normalBalance: "DEBIT", openingBalance: 13000000, currentBalance: 13000000, currency: "BDT", isGroup: false, status: "ACTIVE", createdAt: "2026-01-01", updatedAt: "2026-01-01" },
];

const initialCoaPermissions: CoaPermissionItem[] = [
  { id: "perm-1", employeeName: "Mohammad Arif", employeeId: "EMP-101", voucherType: "Payment", accountHeadCode: "10101005", accountHeadName: "Cash in Hand - Factory", status: "ACTIVE", createdAt: "2026-02-01" },
  { id: "perm-2", employeeName: "Tanvir Ahmed", employeeId: "EMP-102", voucherType: "General", accountHeadCode: "301", accountHeadName: "Accounts Payable", status: "ACTIVE", createdAt: "2026-02-10" },
  { id: "perm-3", employeeName: "Nasir Hossain", employeeId: "EMP-103", voucherType: "Receipt", accountHeadCode: "10102", accountHeadName: "Cash At Bank", status: "ACTIVE", createdAt: "2026-02-15" },
  { id: "perm-4", employeeName: "Kamrul Islam", employeeId: "EMP-104", voucherType: "Adjustment", accountHeadCode: "702", accountHeadName: "Administrative & Operating Expenses", status: "ACTIVE", createdAt: "2026-03-01" },
];

const initialBankAccounts: BankAccountItem[] = [
  {
    id: "bank-1",
    accountNumber: "2050123456789",
    bankName: "Sonali Bank PLC",
    branchName: "Principal Branch, Motijheel",
    accountHolder: "BridgeOne Industrial Solutions Ltd",
    accountType: "CURRENT",
    currency: "BDT",
    glAccountId: "acc-1120",
    glAccountName: "Cash at Bank - Sonali Bank",
    openingBalance: 1250000,
    currentBalance: 1250000,
    reconciliationStatus: "RECONCILED",
    isActive: true,
    createdAt: "2026-01-01",
  },
  {
    id: "bank-2",
    accountNumber: "1501209876543",
    bankName: "BRAC Bank PLC",
    branchName: "Gulshan Corporate Branch",
    accountHolder: "BridgeOne Industrial Solutions Ltd",
    accountType: "CURRENT",
    currency: "BDT",
    glAccountId: "acc-1121",
    glAccountName: "Cash at Bank - BRAC Bank",
    openingBalance: 820000,
    currentBalance: 820000,
    reconciliationStatus: "RECONCILED",
    isActive: true,
    createdAt: "2026-01-01",
  },
];

const initialChequeBooks: ChequeBookItem[] = [
  {
    id: "cb-1",
    bookName: "Sonali-Main-01",
    bankAccountId: "bank-1",
    bankName: "Sonali Bank PLC",
    accountNumber: "2050123456789",
    startChequeNumber: "SB-1001",
    endChequeNumber: "SB-1050",
    totalLeaves: 50,
    usedLeaves: 0,
    remainingLeaves: 50,
    status: "ACTIVE",
    createdAt: "2026-01-01",
  },
];

const initialCostCenters: CostCenterItem[] = [
  {
    id: "cc-1",
    code: "CC-DHK-HQ",
    name: "Dhaka Head Office",
    type: "DEPARTMENT",
    officeId: "office-main",
    officeName: "Corporate HQ",
    description: "Administrative & Executive Head Office",
    effectiveDate: "2026-01-01",
    status: "ACTIVE",
    createdAt: "2026-01-01",
  },
  {
    id: "cc-2",
    code: "CC-CTG-PLANT",
    name: "Chittagong Manufacturing Plant",
    type: "PROJECT",
    officeId: "office-ctg",
    officeName: "Chittagong Factory",
    description: "Production & Heavy Engineering Facility",
    effectiveDate: "2026-01-01",
    status: "ACTIVE",
    createdAt: "2026-01-01",
  },
];

type StateData = Omit<
  AccountingState,
  | "addAccount"
  | "updateAccount"
  | "toggleAccountStatus"
  | "createVoucher"
  | "postVoucher"
  | "reverseVoucher"
  | "createExpense"
  | "updateExpenseStatus"
  | "markExpensePaid"
  | "createAdvance"
  | "disburseAdvance"
  | "settleAdvance"
  | "createProvision"
  | "createTransfer"
  | "approveTransfer"
  | "dispatchTransfer"
  | "receiveTransfer"
  | "returnTransfer"
  | "addBankAccount"
  | "addDeposit"
  | "addLoan"
  | "addChequeBook"
  | "issueCheque"
  | "updateChequeStatus"
  | "createBudget"
  | "updateBudgetRevision"
  | "addCostCenter"
  | "addCoaPermission"
  | "deleteCoaPermission"
  | "toggleCoaPermission"
  | "getDashboardKPIs"
  | "getGeneralLedger"
  | "getTrialBalance"
  | "getProfitAndLoss"
  | "getBalanceSheet"
>;

const STORAGE_KEY = "bridgeone_accounting_v2";

let internalData: StateData = {
  accounts: initialAccounts,
  vouchers: [],
  expenses: [],
  advances: [],
  provisions: [],
  transfers: [],
  bankAccounts: initialBankAccounts,
  deposits: [],
  loans: [],
  factoring: [],
  chequeBooks: initialChequeBooks,
  cheques: [],
  budgets: [],
  costCenters: initialCostCenters,
  coaPermissions: initialCoaPermissions,
};

// Try loading persisted data on client
if (typeof window !== "undefined") {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      internalData = { ...internalData, ...parsed };
    }
  } catch {
    // ignore
  }
}

const listeners = new Set<() => void>();

function notify() {
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(internalData));
    } catch {
      // ignore
    }
  }
  listeners.forEach((listener) => listener());
}

function updateData(updater: (prev: StateData) => StateData) {
  internalData = updater(internalData);
  cachedSnapshot = getFullState();
  notify();
}

// Build complete state
function getFullState(): AccountingState {
  return {
    ...internalData,

    addAccount: (accountData) => {
      const id = `acc-${Date.now()}`;
      const newAccount: AccountItem = {
        ...accountData,
        id,
        currentBalance: accountData.openingBalance || 0,
        createdAt: new Date().toISOString().split("T")[0],
        updatedAt: new Date().toISOString().split("T")[0],
      };
      updateData((prev) => ({ ...prev, accounts: [...prev.accounts, newAccount] }));
    },

    updateAccount: (id, updates) => {
      updateData((prev) => ({
        ...prev,
        accounts: prev.accounts.map((acc) =>
          acc.id === id ? { ...acc, ...updates, updatedAt: new Date().toISOString().split("T")[0] } : acc,
        ),
      }));
    },

    toggleAccountStatus: (id) => {
      updateData((prev) => ({
        ...prev,
        accounts: prev.accounts.map((acc) =>
          acc.id === id ? { ...acc, status: acc.status === "ACTIVE" ? "INACTIVE" : "ACTIVE" } : acc,
        ),
      }));
    },

    addCoaPermission: (perm) => {
      const id = `perm-${Date.now()}`;
      const newPerm: CoaPermissionItem = {
        ...perm,
        id,
        createdAt: new Date().toISOString().split("T")[0],
      };
      updateData((prev) => ({ ...prev, coaPermissions: [...prev.coaPermissions, newPerm] }));
    },

    deleteCoaPermission: (id) => {
      updateData((prev) => ({
        ...prev,
        coaPermissions: prev.coaPermissions.filter((p) => p.id !== id),
      }));
    },

    toggleCoaPermission: (id) => {
      updateData((prev) => ({
        ...prev,
        coaPermissions: prev.coaPermissions.map((p) =>
          p.id === id ? { ...p, status: p.status === "ACTIVE" ? "INACTIVE" : "ACTIVE" } : p,
        ),
      }));
    },

    createVoucher: (voucherData) => {
      const totalDebit = voucherData.lines.reduce((sum, l) => sum + (Number(l.debit) || 0), 0);
      const totalCredit = voucherData.lines.reduce((sum, l) => sum + (Number(l.credit) || 0), 0);

      if (Math.abs(totalDebit - totalCredit) > 0.01) {
        return {
          success: false,
          message: `Voucher is unbalanced! Total Debit (৳${totalDebit.toFixed(2)}) must equal Total Credit (৳${totalCredit.toFixed(2)}).`,
        };
      }
      if (voucherData.lines.length < 2) {
        return { success: false, message: "A double-entry voucher must have at least one debit and one credit line." };
      }

      const count = internalData.vouchers.length + 1;
      const voucherNumber = `JV-${new Date().getFullYear()}-${count.toString().padStart(4, "0")}`;
      const id = `jv-${Date.now()}`;

      const newVoucher: JournalVoucher = {
        ...voucherData,
        id,
        voucherNumber,
        totalDebit,
        totalCredit,
        createdAt: new Date().toISOString(),
      };

      if (newVoucher.status === "POSTED") {
        const accountsMap = new Map(internalData.accounts.map((a) => [a.id, a.currentBalance]));
        for (const line of newVoucher.lines) {
          const current = accountsMap.get(line.accountId) || 0;
          const acc = internalData.accounts.find((a) => a.id === line.accountId);
          if (acc) {
            if (acc.normalBalance === "DEBIT") {
              accountsMap.set(line.accountId, current + (line.debit - line.credit));
            } else {
              accountsMap.set(line.accountId, current + (line.credit - line.debit));
            }
          }
        }
        updateData((prev) => ({
          ...prev,
          vouchers: [newVoucher, ...prev.vouchers],
          accounts: prev.accounts.map((acc) =>
            accountsMap.has(acc.id) ? { ...acc, currentBalance: accountsMap.get(acc.id)! } : acc,
          ),
        }));
      } else {
        updateData((prev) => ({ ...prev, vouchers: [newVoucher, ...prev.vouchers] }));
      }

      return { success: true, message: `Voucher ${voucherNumber} successfully recorded.`, voucher: newVoucher };
    },

    postVoucher: (id) => {
      const v = internalData.vouchers.find((item) => item.id === id);
      if (!v) return { success: false, message: "Voucher not found." };
      if (v.status === "POSTED") return { success: false, message: "Voucher is already posted." };

      const accountsMap = new Map(internalData.accounts.map((a) => [a.id, a.currentBalance]));
      for (const line of v.lines) {
        const current = accountsMap.get(line.accountId) || 0;
        const acc = internalData.accounts.find((a) => a.id === line.accountId);
        if (acc) {
          if (acc.normalBalance === "DEBIT") {
            accountsMap.set(line.accountId, current + (line.debit - line.credit));
          } else {
            accountsMap.set(line.accountId, current + (line.credit - line.debit));
          }
        }
      }

      updateData((prev) => ({
        ...prev,
        vouchers: prev.vouchers.map((item) =>
          item.id === id
            ? { ...item, status: "POSTED", postedAt: new Date().toISOString(), approvedBy: "Finance Controller" }
            : item,
        ),
        accounts: prev.accounts.map((acc) =>
          accountsMap.has(acc.id) ? { ...acc, currentBalance: accountsMap.get(acc.id)! } : acc,
        ),
      }));

      return { success: true, message: `Voucher ${v.voucherNumber} posted to General Ledger.` };
    },

    reverseVoucher: (id, reason) => {
      const original = internalData.vouchers.find((item) => item.id === id);
      if (!original) return { success: false, message: "Voucher not found." };
      if (original.status !== "POSTED") return { success: false, message: "Only posted vouchers can be reversed." };

      const reversedLines = original.lines.map((l) => ({
        ...l,
        id: `line-${Date.now()}-${Math.random()}`,
        debit: l.credit,
        credit: l.debit,
        narration: `Reversal of ${original.voucherNumber}: ${l.narration || ""}`,
      }));

      const count = internalData.vouchers.length + 1;
      const revVoucherNumber = `REV-${new Date().getFullYear()}-${count.toString().padStart(4, "0")}`;
      const revId = `rev-${Date.now()}`;

      const reversingVoucher: JournalVoucher = {
        id: revId,
        voucherNumber: revVoucherNumber,
        transactionDate: new Date().toISOString().split("T")[0],
        officeId: original.officeId,
        officeName: original.officeName,
        fiscalYear: original.fiscalYear,
        journalType: "REVERSAL",
        narration: `Reversal of voucher ${original.voucherNumber}. Reason: ${reason}`,
        referenceNumber: original.voucherNumber,
        lines: reversedLines,
        totalDebit: original.totalCredit,
        totalCredit: original.totalDebit,
        status: "POSTED",
        reversalOfId: original.id,
        createdBy: "System",
        approvedBy: "Finance Auditor",
        postedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      };

      const accountsMap = new Map(internalData.accounts.map((a) => [a.id, a.currentBalance]));
      for (const line of reversedLines) {
        const current = accountsMap.get(line.accountId) || 0;
        const acc = internalData.accounts.find((a) => a.id === line.accountId);
        if (acc) {
          if (acc.normalBalance === "DEBIT") {
            accountsMap.set(line.accountId, current + (line.debit - line.credit));
          } else {
            accountsMap.set(line.accountId, current + (line.credit - line.debit));
          }
        }
      }

      updateData((prev) => ({
        ...prev,
        vouchers: [
          reversingVoucher,
          ...prev.vouchers.map((item) =>
            item.id === id ? { ...item, status: "REVERSED" as const, reversedById: revId } : item,
          ),
        ],
        accounts: prev.accounts.map((acc) =>
          accountsMap.has(acc.id) ? { ...acc, currentBalance: accountsMap.get(acc.id)! } : acc,
        ),
      }));

      return { success: true, message: `Voucher ${original.voucherNumber} reversed by ${revVoucherNumber}.` };
    },

    createExpense: (expenseData) => {
      const id = `exp-${Date.now()}`;
      const count = internalData.expenses.length + 1;
      const expenseNumber = `EXP-${new Date().getFullYear()}-${count.toString().padStart(4, "0")}`;
      const newExpense: ExpenseRecord = {
        ...expenseData,
        id,
        expenseNumber,
        createdAt: new Date().toISOString(),
      };
      updateData((prev) => ({ ...prev, expenses: [newExpense, ...prev.expenses] }));
    },

    updateExpenseStatus: (id, status, approvedBy) => {
      updateData((prev) => ({
        ...prev,
        expenses: prev.expenses.map((e) =>
          e.id === id ? { ...e, status, approvedBy: approvedBy || e.approvedBy } : e,
        ),
      }));
    },

    markExpensePaid: (id, paymentMethod) => {
      const exp = internalData.expenses.find((e) => e.id === id);
      if (!exp) return;

      const bankOrCashAccountId = paymentMethod === "CASH" ? "acc-1110" : "acc-1120";
      const bankOrCashAccount = internalData.accounts.find((a) => a.id === bankOrCashAccountId);

      getFullState().createVoucher({
        transactionDate: new Date().toISOString().split("T")[0],
        officeId: exp.officeId,
        officeName: exp.officeName,
        fiscalYear: "2026-2027",
        journalType: "PAYMENT",
        narration: `Payment for expense ${exp.expenseNumber} (${exp.expenseType}) to ${exp.payeeName}`,
        referenceNumber: exp.expenseNumber,
        lines: [
          {
            id: `line-${Date.now()}-1`,
            accountId: exp.accountId,
            accountCode: "5000",
            accountName: exp.accountName,
            debit: exp.amount,
            credit: 0,
            narration: exp.description,
          },
          {
            id: `line-${Date.now()}-2`,
            accountId: bankOrCashAccountId,
            accountCode: bankOrCashAccount?.code || "1110",
            accountName: bankOrCashAccount?.name || "Cash/Bank",
            debit: 0,
            credit: exp.amount,
            narration: `Settled via ${paymentMethod}`,
          },
        ],
        status: "POSTED",
        createdBy: "Finance Payment Desk",
      });

      updateData((prev) => ({
        ...prev,
        expenses: prev.expenses.map((e) =>
          e.id === id ? { ...e, status: "PAID", paidAt: new Date().toISOString(), paymentMethod } : e,
        ),
      }));
    },

    createAdvance: (advanceData) => {
      const id = `adv-${Date.now()}`;
      const count = internalData.advances.length + 1;
      const advanceNumber = `ADV-${new Date().getFullYear()}-${count.toString().padStart(4, "0")}`;
      const newAdvance: AdvanceRecord = {
        ...advanceData,
        id,
        advanceNumber,
        disbursedAmount: 0,
        settledAmount: 0,
        remainingBalance: advanceData.approvedAmount || advanceData.requestedAmount,
        createdAt: new Date().toISOString(),
      };
      updateData((prev) => ({ ...prev, advances: [newAdvance, ...prev.advances] }));
    },

    disburseAdvance: (id, amount) => {
      updateData((prev) => ({
        ...prev,
        advances: prev.advances.map((a) =>
          a.id === id
            ? {
                ...a,
                disbursedAmount: a.disbursedAmount + amount,
                remainingBalance: a.remainingBalance + amount,
                status: "DISBURSED",
              }
            : a,
        ),
      }));
    },

    settleAdvance: (id, amount) => {
      updateData((prev) => ({
        ...prev,
        advances: prev.advances.map((a) => {
          if (a.id !== id) return a;
          const newSettled = a.settledAmount + amount;
          const remaining = Math.max(0, a.disbursedAmount - newSettled);
          return {
            ...a,
            settledAmount: newSettled,
            remainingBalance: remaining,
            status: remaining <= 0 ? "SETTLED" : "PARTIAL",
          };
        }),
      }));
    },

    createProvision: (provisionData) => {
      const id = `prov-${Date.now()}`;
      const count = internalData.provisions.length + 1;
      const provisionNumber = `PRV-${new Date().getFullYear()}-${count.toString().padStart(4, "0")}`;
      const newProvision: ProvisionRecord = {
        ...provisionData,
        id,
        provisionNumber,
        createdAt: new Date().toISOString(),
      };
      updateData((prev) => ({ ...prev, provisions: [newProvision, ...prev.provisions] }));
    },

    createTransfer: (transferData) => {
      const id = `ft-${Date.now()}`;
      const count = internalData.transfers.length + 1;
      const transferNumber = `TRF-${new Date().getFullYear()}-${count.toString().padStart(4, "0")}`;
      const requestCode = `REQ-FT-${count.toString().padStart(4, "0")}`;
      const newTransfer: FundTransferRecord = {
        ...transferData,
        id,
        transferNumber,
        requestCode,
        approvedAmount: transferData.requestedAmount,
        transferredAmount: 0,
        receivedAmount: 0,
        createdAt: new Date().toISOString(),
      };
      updateData((prev) => ({ ...prev, transfers: [newTransfer, ...prev.transfers] }));
    },

    approveTransfer: (id, approvedAmount) => {
      updateData((prev) => ({
        ...prev,
        transfers: prev.transfers.map((t) =>
          t.id === id ? { ...t, status: "APPROVED", approvedAmount } : t,
        ),
      }));
    },

    dispatchTransfer: (id) => {
      const t = internalData.transfers.find((tr) => tr.id === id);
      if (!t) return;

      getFullState().createVoucher({
        transactionDate: new Date().toISOString().split("T")[0],
        officeId: t.fromOfficeId,
        officeName: t.fromOfficeName,
        fiscalYear: "2026-2027",
        journalType: "CONTRA",
        narration: `Fund Transfer Dispatch: ${t.fromOfficeName} -> ${t.toOfficeName} (${t.transferNumber})`,
        referenceNumber: t.transferNumber,
        lines: [
          {
            id: `line-${Date.now()}-1`,
            accountId: "acc-1150",
            accountCode: "1150",
            accountName: "Fund in Transit",
            debit: t.approvedAmount,
            credit: 0,
            narration: `In transit to ${t.toOfficeName}`,
          },
          {
            id: `line-${Date.now()}-2`,
            accountId: t.fromAccountId,
            accountCode: "1120",
            accountName: t.fromAccountName,
            debit: 0,
            credit: t.approvedAmount,
            narration: `Dispatched from ${t.fromAccountName}`,
          },
        ],
        status: "POSTED",
        createdBy: "Transfer Dispatch Desk",
      });

      updateData((prev) => ({
        ...prev,
        transfers: prev.transfers.map((item) =>
          item.id === id
            ? {
                ...item,
                status: "IN_TRANSIT",
                transferredAmount: item.approvedAmount,
                dispatchedAt: new Date().toISOString(),
              }
            : item,
        ),
      }));
    },

    receiveTransfer: (id) => {
      const t = internalData.transfers.find((tr) => tr.id === id);
      if (!t) return;

      getFullState().createVoucher({
        transactionDate: new Date().toISOString().split("T")[0],
        officeId: t.toOfficeId,
        officeName: t.toOfficeName,
        fiscalYear: "2026-2027",
        journalType: "CONTRA",
        narration: `Fund Transfer Received: ${t.fromOfficeName} -> ${t.toOfficeName} (${t.transferNumber})`,
        referenceNumber: t.transferNumber,
        lines: [
          {
            id: `line-${Date.now()}-1`,
            accountId: t.toAccountId,
            accountCode: "1120",
            accountName: t.toAccountName,
            debit: t.transferredAmount,
            credit: 0,
            narration: `Received into ${t.toAccountName}`,
          },
          {
            id: `line-${Date.now()}-2`,
            accountId: "acc-1150",
            accountCode: "1150",
            accountName: "Fund in Transit",
            debit: 0,
            credit: t.transferredAmount,
            narration: "Clear fund in transit",
          },
        ],
        status: "POSTED",
        createdBy: "Receiving Branch Officer",
      });

      updateData((prev) => ({
        ...prev,
        transfers: prev.transfers.map((item) =>
          item.id === id
            ? {
                ...item,
                status: "RECEIVED",
                receivedAmount: item.transferredAmount,
                receivedAt: new Date().toISOString(),
              }
            : item,
        ),
      }));
    },

    returnTransfer: (id, reason) => {
      const t = internalData.transfers.find((tr) => tr.id === id);
      if (!t) return;

      if (t.status === "IN_TRANSIT") {
        getFullState().createVoucher({
          transactionDate: new Date().toISOString().split("T")[0],
          officeId: t.fromOfficeId,
          officeName: t.fromOfficeName,
          fiscalYear: "2026-2027",
          journalType: "REVERSAL",
          narration: `Fund Transfer Returned: ${t.transferNumber}. Reason: ${reason}`,
          referenceNumber: t.transferNumber,
          lines: [
            {
              id: `line-${Date.now()}-1`,
              accountId: t.fromAccountId,
              accountCode: "1120",
              accountName: t.fromAccountName,
              debit: t.transferredAmount,
              credit: 0,
              narration: "Returned to source",
            },
            {
              id: `line-${Date.now()}-2`,
              accountId: "acc-1150",
              accountCode: "1150",
              accountName: "Fund in Transit",
              debit: 0,
              credit: t.transferredAmount,
              narration: "Clear returned transit balance",
            },
          ],
          status: "POSTED",
          createdBy: "Transfer Control",
        });
      }

      updateData((prev) => ({
        ...prev,
        transfers: prev.transfers.map((item) =>
          item.id === id ? { ...item, status: "RETURNED" } : item,
        ),
      }));
    },

    addBankAccount: (bankData) => {
      const id = `bank-${Date.now()}`;
      const newBank: BankAccountItem = {
        ...bankData,
        id,
        currentBalance: bankData.openingBalance || 0,
        createdAt: new Date().toISOString(),
      };
      updateData((prev) => ({ ...prev, bankAccounts: [...prev.bankAccounts, newBank] }));
    },

    addDeposit: (depositData) => {
      const id = `dep-${Date.now()}`;
      const count = internalData.deposits.length + 1;
      const depositNumber = `FDR-${count.toString().padStart(3, "0")}`;
      updateData((prev) => ({ ...prev, deposits: [...prev.deposits, { ...depositData, id, depositNumber }] }));
    },

    addLoan: (loanData) => {
      const id = `loan-${Date.now()}`;
      const count = internalData.loans.length + 1;
      const loanNumber = `LN-${count.toString().padStart(3, "0")}`;
      updateData((prev) => ({ ...prev, loans: [...prev.loans, { ...loanData, id, loanNumber }] }));
    },

    addChequeBook: (bookData) => {
      const start = parseInt(bookData.startChequeNumber.replace(/\D/g, "")) || 0;
      const end = parseInt(bookData.endChequeNumber.replace(/\D/g, "")) || 0;
      if (start >= end) {
        return { success: false, message: "End cheque number must be strictly greater than start cheque number." };
      }
      const totalLeaves = end - start + 1;
      const id = `cb-${Date.now()}`;
      const newBook: ChequeBookItem = {
        ...bookData,
        id,
        totalLeaves,
        usedLeaves: 0,
        remainingLeaves: totalLeaves,
        createdAt: new Date().toISOString(),
      };
      updateData((prev) => ({ ...prev, chequeBooks: [...prev.chequeBooks, newBook] }));
      return { success: true, message: `Cheque book ${bookData.bookName} registered with ${totalLeaves} leaves.` };
    },

    issueCheque: (chequeData) => {
      const exists = internalData.cheques.some(
        (c) => c.bankAccountId === chequeData.bankAccountId && c.chequeNumber === chequeData.chequeNumber,
      );
      if (exists) {
        return { success: false, message: `Cheque number ${chequeData.chequeNumber} has already been issued for this bank account!` };
      }

      const id = `chq-${Date.now()}`;
      const transactionNumber = `TXN-CHQ-${Date.now().toString().slice(-6)}`;
      const newCheque: ChequeIssueItem = {
        ...chequeData,
        id,
        transactionNumber,
        createdAt: new Date().toISOString(),
      };

      updateData((prev) => ({
        ...prev,
        cheques: [newCheque, ...prev.cheques],
        chequeBooks: prev.chequeBooks.map((b) =>
          b.id === chequeData.chequeBookId
            ? {
                ...b,
                usedLeaves: b.usedLeaves + 1,
                remainingLeaves: Math.max(0, b.remainingLeaves - 1),
                status: b.remainingLeaves - 1 <= 0 ? "EXHAUSTED" : "ACTIVE",
              }
            : b,
        ),
      }));

      return { success: true, message: `Cheque ${chequeData.chequeNumber} issued successfully to ${chequeData.payeeName}.` };
    },

    updateChequeStatus: (id, status, reason) => {
      updateData((prev) => ({
        ...prev,
        cheques: prev.cheques.map((c) =>
          c.id === id ? { ...c, status, cancellationReason: reason || c.cancellationReason } : c,
        ),
      }));
    },

    createBudget: (budgetData) => {
      const id = `bg-${Date.now()}`;
      const count = internalData.budgets.length + 1;
      const budgetCode = `BG-${budgetData.budgetYear}-${count.toString().padStart(3, "0")}`;
      const newBudget: BudgetItem = {
        ...budgetData,
        id,
        budgetCode,
        revisedAmount: budgetData.allocatedAmount,
        utilizedAmount: 0,
        committedAmount: 0,
        remainingAmount: budgetData.allocatedAmount,
        createdAt: new Date().toISOString(),
      };
      updateData((prev) => ({ ...prev, budgets: [...prev.budgets, newBudget] }));
    },

    updateBudgetRevision: (id, revisedAmount) => {
      updateData((prev) => ({
        ...prev,
        budgets: prev.budgets.map((b) =>
          b.id === id
            ? {
                ...b,
                revisedAmount,
                remainingAmount: revisedAmount - b.utilizedAmount - b.committedAmount,
              }
            : b,
        ),
      }));
    },

    addCostCenter: (centerData) => {
      const id = `cc-${Date.now()}`;
      const newCenter: CostCenterItem = {
        ...centerData,
        id,
        createdAt: new Date().toISOString(),
      };
      updateData((prev) => ({ ...prev, costCenters: [...prev.costCenters, newCenter] }));
    },

    getDashboardKPIs: () => {
      const accounts = internalData.accounts;
      const vouchers = internalData.vouchers;
      const expenses = internalData.expenses;
      const transfers = internalData.transfers;
      const cheques = internalData.cheques;
      const budgets = internalData.budgets;

      const arAccount = accounts.find((a) => a.code === "1130");
      const apAccount = accounts.find((a) => a.code === "2110");
      const cashAccount = accounts.find((a) => a.code === "1110");
      const bankAccountsList = accounts.filter((a) => a.accountSubtype === "Bank");

      const accountsReceivable = arAccount?.currentBalance || 0;
      const accountsPayable = apAccount?.currentBalance || 0;
      const cashInHand = cashAccount?.currentBalance || 0;
      const cashAtBank = bankAccountsList.reduce((sum, b) => sum + b.currentBalance, 0);

      const incomeAccounts = accounts.filter((a) => a.accountType === "REVENUE");
      const expenseAccounts = accounts.filter((a) => a.accountType === "EXPENSE");
      const totalIncome = incomeAccounts.reduce((sum, i) => sum + i.currentBalance, 0);
      const totalExpenses = expenseAccounts.reduce((sum, e) => sum + e.currentBalance, 0);

      const openingCashAndBank = (cashAccount?.openingBalance || 0) + bankAccountsList.reduce((sum, b) => sum + b.openingBalance, 0);
      const closingCashAndBank = cashInHand + cashAtBank;

      const postedVouchers = vouchers.filter((v) => v.status === "POSTED");
      let totalReceipts = 0;
      let totalPayments = 0;
      for (const v of postedVouchers) {
        for (const l of v.lines) {
          if (l.accountId === "acc-1110" || l.accountId.startsWith("acc-112")) {
            if (l.debit > 0) totalReceipts += l.debit;
            if (l.credit > 0) totalPayments += l.credit;
          }
        }
      }

      const currentPeriodProfitLoss = totalIncome - totalExpenses;
      const pendingJournalVouchers = vouchers.filter((v) => v.status === "PENDING" || v.status === "DRAFT").length;
      const pendingExpenseApprovals = expenses.filter((e) => e.status === "PENDING").length;
      const pendingFundTransfers = transfers.filter((t) => t.status === "PENDING_APPROVAL" || t.status === "IN_TRANSIT").length;
      const outstandingCheques = cheques.filter((c) => c.status === "ISSUED" || c.status === "POST_DATED").length;

      const totalAllocatedBudget = budgets.reduce((sum, b) => sum + (b.revisedAmount || b.allocatedAmount), 0);
      const totalUtilizedBudget = budgets.reduce((sum, b) => sum + b.utilizedAmount, 0);
      const budgetUtilization = totalAllocatedBudget > 0 ? (totalUtilizedBudget / totalAllocatedBudget) * 100 : 0;

      return {
        accountsReceivable,
        accountsPayable,
        cashInHand,
        cashAtBank,
        totalIncome,
        totalExpenses,
        openingCashAndBank,
        totalReceipts,
        totalPayments,
        closingCashAndBank,
        currentPeriodProfitLoss,
        pendingJournalVouchers,
        pendingExpenseApprovals,
        pendingFundTransfers,
        outstandingCheques,
        budgetUtilization,
      };
    },

    getGeneralLedger: (accountId, fromDate, toDate) => {
      const vouchers = internalData.vouchers.filter((v) => v.status === "POSTED");
      const entries: GeneralLedgerEntry[] = [];
      let runningBalance = 0;

      const sortedVouchers = [...vouchers].sort(
        (a, b) => new Date(a.transactionDate).getTime() - new Date(b.transactionDate).getTime(),
      );

      for (const v of sortedVouchers) {
        if (fromDate && v.transactionDate < fromDate) continue;
        if (toDate && v.transactionDate > toDate) continue;

        for (const line of v.lines) {
          if (accountId && line.accountId !== accountId) continue;
          runningBalance += line.debit - line.credit;
          entries.push({
            date: v.transactionDate,
            voucherNumber: v.voucherNumber,
            transactionType: v.journalType,
            narration: line.narration || v.narration,
            debit: line.debit,
            credit: line.credit,
            runningBalance,
            accountCode: line.accountCode,
            accountName: line.accountName,
            officeName: v.officeName,
          });
        }
      }
      return entries;
    },

    getTrialBalance: () => {
      const accounts = internalData.accounts.filter((a) => !a.isGroup);
      const rows: Array<{ code: string; name: string; type: string; debit: number; credit: number }> = [];
      let totalDebit = 0;
      let totalCredit = 0;

      for (const a of accounts) {
        const bal = a.currentBalance;
        let debit = 0;
        let credit = 0;
        if (a.normalBalance === "DEBIT") {
          if (bal >= 0) debit = bal;
          else credit = Math.abs(bal);
        } else {
          if (bal >= 0) credit = bal;
          else debit = Math.abs(bal);
        }
        totalDebit += debit;
        totalCredit += credit;
        rows.push({
          code: a.code,
          name: a.name,
          type: a.accountType,
          debit,
          credit,
        });
      }

      const isBalanced = Math.abs(totalDebit - totalCredit) < 0.05;
      return { rows, totalDebit, totalCredit, isBalanced };
    },

    getProfitAndLoss: () => {
      const incomeAccounts = internalData.accounts.filter((a) => a.accountType === "REVENUE" && !a.isGroup);
      const expenseAccounts = internalData.accounts.filter((a) => a.accountType === "EXPENSE" && !a.isGroup);

      const revenues = incomeAccounts.map((a) => ({ name: a.name, amount: a.currentBalance }));
      const expenses = expenseAccounts.map((a) => ({ name: a.name, amount: a.currentBalance }));

      const totalRevenue = revenues.reduce((sum, r) => sum + r.amount, 0);
      const totalExpense = expenses.reduce((sum, e) => sum + e.amount, 0);
      const netProfit = totalRevenue - totalExpense;

      return { revenues, expenses, totalRevenue, totalExpense, netProfit };
    },

    getBalanceSheet: () => {
      const assetAccounts = internalData.accounts.filter((a) => a.accountType === "ASSET" && !a.isGroup);
      const liabilityAccounts = internalData.accounts.filter((a) => a.accountType === "LIABILITY" && !a.isGroup);
      const equityAccounts = internalData.accounts.filter((a) => a.accountType === "EQUITY" && !a.isGroup);

      const assets = assetAccounts.map((a) => ({ name: a.name, amount: a.currentBalance }));
      const liabilities = liabilityAccounts.map((a) => ({ name: a.name, amount: a.currentBalance }));
      const equity = equityAccounts.map((a) => ({ name: a.name, amount: a.currentBalance }));

      const totalAssets = assets.reduce((sum, a) => sum + a.amount, 0);
      const totalLiabilities = liabilities.reduce((sum, l) => sum + l.amount, 0);
      const totalEquity = equity.reduce((sum, e) => sum + e.amount, 0);

      const { netProfit } = getFullState().getProfitAndLoss();
      const totalLiabilitiesAndEquity = totalLiabilities + totalEquity + netProfit;
      const isBalanced = Math.abs(totalAssets - totalLiabilitiesAndEquity) < 1;

      return {
        assets,
        liabilities,
        equity: [...equity, { name: "Current Period Profit / (Loss)", amount: netProfit }],
        totalAssets,
        totalLiabilities,
        totalEquity: totalEquity + netProfit,
        isBalanced,
      };
    },
  };
}

let cachedSnapshot = getFullState();

function subscribe(callback: () => void) {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}

function getSnapshot(): AccountingState {
  return cachedSnapshot;
}

const getServerSnapshot = () => cachedSnapshot;

export function useAccountingStore<T = AccountingState>(selector?: (state: AccountingState) => T): T {
  const state = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  if (selector) {
    return selector(state);
  }
  return state as unknown as T;
}

useAccountingStore.getState = getSnapshot;
