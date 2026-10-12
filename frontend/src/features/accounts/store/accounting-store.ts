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
  LoanPartnerItem,
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
  loanPartners: LoanPartnerItem[];
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
  addLoanPartner: (partner: Omit<LoanPartnerItem, "id" | "createdAt">) => void;
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
  { id: "ba-1", accountNumber: "3133131043165", bankName: "PRIME BANK LTD PLC", branchName: "ISLAMI BANKING(MIRPUR)", accountHolder: "Mariners Foodology And Agro Limited", accountType: "Current Account", currency: "BDT", glAccountId: "acc-10102", glAccountName: "Cash At Bank", openingBalance: 2450000, currentBalance: 3120500, reconciliationStatus: "RECONCILED", isActive: true, createdAt: "2026-01-01" },
  { id: "ba-2", accountNumber: "7862141005310248", bankName: "UNITED COMMERCIAL BANK LTD PLC", branchName: "ESKATON", accountHolder: "MOHS Unity Venture Limited", accountType: "Current Account", currency: "BDT", glAccountId: "acc-10102", glAccountName: "Cash At Bank", openingBalance: 1200000, currentBalance: 1480000, reconciliationStatus: "RECONCILED", isActive: true, createdAt: "2026-01-01" },
  { id: "ba-3", accountNumber: "1141100563588", bankName: "DUTCH-BANGLA BANK LTD PLC", branchName: "MOHAKHALI", accountHolder: "MOHS ECO Developments PLC", accountType: "Current Account", currency: "BDT", glAccountId: "acc-10102", glAccountName: "Cash At Bank", openingBalance: 850000, currentBalance: 960000, reconciliationStatus: "RECONCILED", isActive: true, createdAt: "2026-01-01" },
  { id: "ba-4", accountNumber: "7862141005015204", bankName: "UNITED COMMERCIAL BANK LTD PLC", branchName: "ESKATON", accountHolder: "MOHS ECO Developments PLC", accountType: "Current Account", currency: "BDT", glAccountId: "acc-10102", glAccountName: "Cash At Bank", openingBalance: 640000, currentBalance: 810000, reconciliationStatus: "RECONCILED", isActive: true, createdAt: "2026-01-01" },
  { id: "ba-5", accountNumber: "2079624620001", bankName: "BRAC BANK LTD PLC", branchName: "Mohakhali", accountHolder: "MG Ventures PLC", accountType: "Current Account", currency: "BDT", glAccountId: "acc-10102", glAccountName: "Cash At Bank", openingBalance: 1800000, currentBalance: 2450000, reconciliationStatus: "RECONCILED", isActive: true, createdAt: "2026-01-01" },
  { id: "ba-6", accountNumber: "3133132046992", bankName: "PRIME BANK LTD PLC", branchName: "MOHAKHALI", accountHolder: "MG Ventures PLC", accountType: "Current Account", currency: "BDT", glAccountId: "acc-10102", glAccountName: "Cash At Bank", openingBalance: 950000, currentBalance: 1120000, reconciliationStatus: "RECONCILED", isActive: true, createdAt: "2026-01-01" },
  { id: "ba-7", accountNumber: "20501910100371009", bankName: "ISLAMI BANK BANGLADESH LTD PLC", branchName: "MOHAKHALI", accountHolder: "MG Ventures PLC", accountType: "Current Account", currency: "BDT", glAccountId: "acc-10102", glAccountName: "Cash At Bank", openingBalance: 4200000, currentBalance: 4890000, reconciliationStatus: "RECONCILED", isActive: true, createdAt: "2026-01-01" },
  { id: "ba-8", accountNumber: "1141200049009", bankName: "DUTCH-BANGLA BANK LTD PLC", branchName: "MOHAKHALI", accountHolder: "MG Ventures PLC", accountType: "Current Account", currency: "BDT", glAccountId: "acc-10102", glAccountName: "Cash At Bank", openingBalance: 510000, currentBalance: 630000, reconciliationStatus: "RECONCILED", isActive: true, createdAt: "2026-01-01" },
  { id: "ba-9", accountNumber: "1141100508628", bankName: "DUTCH-BANGLA BANK LTD PLC", branchName: "MOHAKHALI", accountHolder: "MG Ventures PLC", accountType: "Current Account", currency: "BDT", glAccountId: "acc-10102", glAccountName: "Cash At Bank", openingBalance: 780000, currentBalance: 910000, reconciliationStatus: "RECONCILED", isActive: true, createdAt: "2026-01-01" },
  { id: "ba-10", accountNumber: "2110110026072", bankName: "PRIME BANK LTD PLC", branchName: "MOHAKHALI", accountHolder: "MARINES BAKERS AND BEVERAGES LTD", accountType: "Current Account", currency: "BDT", glAccountId: "acc-10102", glAccountName: "Cash At Bank", openingBalance: 3200000, currentBalance: 3850000, reconciliationStatus: "RECONCILED", isActive: true, createdAt: "2026-01-01" },
  { id: "ba-11", accountNumber: "2078831880001", bankName: "BRAC BANK LTD PLC", branchName: "Mohakhali", accountHolder: "Marines Bakers and Beverage Ltd", accountType: "Current Account", currency: "BDT", glAccountId: "acc-10102", glAccountName: "Cash At Bank", openingBalance: 1450000, currentBalance: 1620000, reconciliationStatus: "RECONCILED", isActive: true, createdAt: "2026-01-01" },
  { id: "ba-12", accountNumber: "1141100438500", bankName: "DUTCH-BANGLA BANK LTD PLC", branchName: "MOHAKHALI", accountHolder: "MARINES BAKERS AND BEVERAGES LTD", accountType: "Current Account", currency: "BDT", glAccountId: "acc-10102", glAccountName: "Cash At Bank", openingBalance: 670000, currentBalance: 790000, reconciliationStatus: "RECONCILED", isActive: true, createdAt: "2026-01-01" },
  { id: "ba-13", accountNumber: "20503320100203303", bankName: "ISLAMI BANK BANGLADESH LTD PLC", branchName: "MOGHBAZAR", accountHolder: "Merchant Feed Industries Limited", accountType: "Current Account", currency: "BDT", glAccountId: "acc-10102", glAccountName: "Cash At Bank", openingBalance: 5600000, currentBalance: 6150000, reconciliationStatus: "RECONCILED", isActive: true, createdAt: "2026-01-01" },
  { id: "ba-14", accountNumber: "3108131049501", bankName: "PRIME BANK LTD PLC", branchName: "IBB DILKUSHA", accountHolder: "MOHS ECO Developments PLC", accountType: "Current Account", currency: "BDT", glAccountId: "acc-10102", glAccountName: "Cash At Bank", openingBalance: 1100000, currentBalance: 1350000, reconciliationStatus: "RECONCILED", isActive: true, createdAt: "2026-01-01" },
  { id: "ba-15", accountNumber: "3108138047250", bankName: "PRIME BANK LTD PLC", branchName: "IBB DILKUSHA", accountHolder: "MS Marine Officers Business Club", accountType: "Current Account", currency: "BDT", glAccountId: "acc-10102", glAccountName: "Cash At Bank", openingBalance: 450000, currentBalance: 520000, reconciliationStatus: "RECONCILED", isActive: true, createdAt: "2026-01-01" },
  { id: "ba-16", accountNumber: "2321100409685", bankName: "DUTCH-BANGLA BANK LTD PLC", branchName: "SIRAJGANJ", accountHolder: "MARINES BAKERS AND BEVERAGES LTD", accountType: "Current Account", currency: "BDT", glAccountId: "acc-10102", glAccountName: "Cash At Bank", openingBalance: 2900000, currentBalance: 3410000, reconciliationStatus: "RECONCILED", isActive: true, createdAt: "2026-01-01" },
  { id: "ba-17", accountNumber: "7862141000041706", bankName: "UNITED COMMERCIAL BANK LTD PLC", branchName: "ESKATON", accountHolder: "MARINES BAKERS AND BEVERAGES LTD", accountType: "Current Account", currency: "BDT", glAccountId: "acc-10102", glAccountName: "Cash At Bank", openingBalance: 880000, currentBalance: 940000, reconciliationStatus: "RECONCILED", isActive: true, createdAt: "2026-01-01" },
  { id: "ba-18", accountNumber: "2072441840001", bankName: "BRAC BANK LTD PLC", branchName: "MOGHBAZAR", accountHolder: "Mariners Oceanic Housing Settlement Limited", accountType: "Current Account", currency: "BDT", glAccountId: "acc-10102", glAccountName: "Cash At Bank", openingBalance: 1750000, currentBalance: 1980000, reconciliationStatus: "RECONCILED", isActive: true, createdAt: "2026-01-01" },
  { id: "ba-19", accountNumber: "9923", bankName: "DUTCH-BANGLA BANK LTD PLC", branchName: "Moghbazar", accountHolder: "MARINES BAKERS AND BEVERAGES LTD", accountType: "Current Account", currency: "BDT", glAccountId: "acc-10102", glAccountName: "Cash At Bank", openingBalance: 320000, currentBalance: 410000, reconciliationStatus: "RECONCILED", isActive: true, createdAt: "2026-01-01" },
  { id: "ba-20", accountNumber: "3108131047118", bankName: "PRIME BANK LTD PLC", branchName: "IBB DILKUSHA", accountHolder: "Mariners Cosmetics and Toiletries Ltd", accountType: "Current Account", currency: "BDT", glAccountId: "acc-10102", glAccountName: "Cash At Bank", openingBalance: 1250000, currentBalance: 1530000, reconciliationStatus: "RECONCILED", isActive: true, createdAt: "2026-01-01" },
  { id: "ba-21", accountNumber: "3108139047036", bankName: "PRIME BANK LTD PLC", branchName: "IBB DILKUSHA", accountHolder: "Mariners Bakers and Beverages Ltd", accountType: "Current Account", currency: "BDT", glAccountId: "acc-10102", glAccountName: "Cash At Bank", openingBalance: 890000, currentBalance: 1040000, reconciliationStatus: "RECONCILED", isActive: true, createdAt: "2026-01-01" },
  { id: "ba-22", accountNumber: "04933002175", bankName: "BANK ASIA LTD PLC", branchName: "PALTAN", accountHolder: "Mariners Food & Agro Limited", accountType: "Current Account", currency: "BDT", glAccountId: "acc-10102", glAccountName: "Cash At Bank", openingBalance: 2100000, currentBalance: 2650000, reconciliationStatus: "RECONCILED", isActive: true, createdAt: "2026-01-01" },
  { id: "ba-23", accountNumber: "2331100024678", bankName: "DUTCH-BANGLA BANK LTD PLC", branchName: "KASHINATHPUR", accountHolder: "Mariners Food & Agro Limited-Peanut", accountType: "Current Account", currency: "BDT", glAccountId: "acc-10102", glAccountName: "Cash At Bank", openingBalance: 740000, currentBalance: 880000, reconciliationStatus: "RECONCILED", isActive: true, createdAt: "2026-01-01" },
  { id: "ba-24", accountNumber: "3108137046527", bankName: "PRIME BANK LTD PLC", branchName: "NEW ESKATON", accountHolder: "Marinozz PLC", accountType: "Current Account", currency: "BDT", glAccountId: "acc-10102", glAccountName: "Cash At Bank", openingBalance: 1600000, currentBalance: 1950000, reconciliationStatus: "RECONCILED", isActive: true, createdAt: "2026-01-01" },
  { id: "ba-25", accountNumber: "2861100008395", bankName: "DUTCH-BANGLA BANK LTD PLC", branchName: "Moghbazar", accountHolder: "Marinox Trading International", accountType: "Current Account", currency: "BDT", glAccountId: "acc-10102", glAccountName: "Cash At Bank", openingBalance: 430000, currentBalance: 510000, reconciliationStatus: "RECONCILED", isActive: true, createdAt: "2026-01-01" },
  { id: "ba-26", accountNumber: "2861100198707", bankName: "DUTCH-BANGLA BANK LTD PLC", branchName: "Moghbazar", accountHolder: "Mariners Cosmetics and Toiletries Ltd", accountType: "Current Account", currency: "BDT", glAccountId: "acc-10102", glAccountName: "Cash At Bank", openingBalance: 980000, currentBalance: 1150000, reconciliationStatus: "RECONCILED", isActive: true, createdAt: "2026-01-01" },
  { id: "ba-27", accountNumber: "3108132034494", bankName: "PRIME BANK LTD PLC", branchName: "NEW ESKATON", accountHolder: "BLUEWAVE MEDIA & PRESS LIMITED", accountType: "Current Account", currency: "BDT", glAccountId: "acc-10102", glAccountName: "Cash At Bank", openingBalance: 570000, currentBalance: 690000, reconciliationStatus: "RECONCILED", isActive: true, createdAt: "2026-01-01" },
  { id: "ba-28", accountNumber: "2331100320838", bankName: "DUTCH-BANGLA BANK LTD PLC", branchName: "KASHINATHPUR", accountHolder: "MARINES BAKERS AND BEVERAGES LTD", accountType: "Current Account", currency: "BDT", glAccountId: "acc-10102", glAccountName: "Cash At Bank", openingBalance: 1840000, currentBalance: 2190000, reconciliationStatus: "RECONCILED", isActive: true, createdAt: "2026-01-01" },
  { id: "ba-29", accountNumber: "2861100008475", bankName: "DUTCH-BANGLA BANK LTD PLC", branchName: "Moghbazar", accountHolder: "MARINERS FOOD AND AGRO LIMITED", accountType: "Current Account", currency: "BDT", glAccountId: "acc-10102", glAccountName: "Cash At Bank", openingBalance: 2600000, currentBalance: 3050000, reconciliationStatus: "RECONCILED", isActive: true, createdAt: "2026-01-01" },
  { id: "ba-30", accountNumber: "2331100024272", bankName: "DUTCH-BANGLA BANK LTD PLC", branchName: "KASHINATHPUR", accountHolder: "MARINERS FOOD AND AGRO LIMITED", accountType: "Current Account", currency: "BDT", glAccountId: "acc-10102", glAccountName: "Cash At Bank", openingBalance: 920000, currentBalance: 1080000, reconciliationStatus: "RECONCILED", isActive: true, createdAt: "2026-01-01" },
  { id: "ba-31", accountNumber: "2861100007805", bankName: "DUTCH-BANGLA BANK LTD PLC", branchName: "Moghbazar", accountHolder: "MARINES BAKERS AND BEVERAGES LTD", accountType: "Current Account", currency: "BDT", glAccountId: "acc-10102", glAccountName: "Cash At Bank", openingBalance: 1420000, currentBalance: 1710000, reconciliationStatus: "RECONCILED", isActive: true, createdAt: "2026-01-01" },
  { id: "ba-32", accountNumber: "20503320100198701", bankName: "ISLAMI BANK BANGLADESH LTD PLC", branchName: "MOGHBAZAR", accountHolder: "MARINES BAKERS AND BEVERAGES LTD", accountType: "Current Account", currency: "BDT", glAccountId: "acc-10102", glAccountName: "Cash At Bank", openingBalance: 3800000, currentBalance: 4320000, reconciliationStatus: "RECONCILED", isActive: true, createdAt: "2026-01-01" },
  { id: "ba-33", accountNumber: "2861200015657", bankName: "DUTCH-BANGLA BANK LTD PLC", branchName: "Moghbazar", accountHolder: "MARINES BAKERS AND BEVERAGES LTD", accountType: "Current Account", currency: "BDT", glAccountId: "acc-10102", glAccountName: "Cash At Bank", openingBalance: 1150000, currentBalance: 1290000, reconciliationStatus: "RECONCILED", isActive: true, createdAt: "2026-01-01" },
  { id: "ba-34", accountNumber: "3108139098711", bankName: "PRIME BANK LTD PLC", branchName: "MOTIJHEEL", accountHolder: "BridgeOne Industrial Solutions Ltd", accountType: "Current Account", currency: "BDT", glAccountId: "acc-10102", glAccountName: "Cash At Bank", openingBalance: 3500000, currentBalance: 4200000, reconciliationStatus: "RECONCILED", isActive: true, createdAt: "2026-01-01" },
  { id: "ba-35", accountNumber: "2079624629988", bankName: "BRAC BANK LTD PLC", branchName: "GULSHAN", accountHolder: "BridgeOne Technologies Ltd", accountType: "Current Account", currency: "BDT", glAccountId: "acc-10102", glAccountName: "Cash At Bank", openingBalance: 2100000, currentBalance: 2540000, reconciliationStatus: "RECONCILED", isActive: true, createdAt: "2026-01-01" },
  { id: "ba-36", accountNumber: "1041060088912", bankName: "EASTERN BANK LTD PLC", branchName: "PRINCIPAL", accountHolder: "BridgeOne Logistics Ltd", accountType: "Current Account", currency: "BDT", glAccountId: "acc-10102", glAccountName: "Cash At Bank", openingBalance: 1650000, currentBalance: 1920000, reconciliationStatus: "RECONCILED", isActive: true, createdAt: "2026-01-01" },
  { id: "ba-37", accountNumber: "1101982736451", bankName: "CITY BANK LTD PLC", branchName: "DHANMONDI", accountHolder: "BridgeOne Retail Network Ltd", accountType: "Current Account", currency: "BDT", glAccountId: "acc-10102", glAccountName: "Cash At Bank", openingBalance: 1200000, currentBalance: 1430000, reconciliationStatus: "RECONCILED", isActive: true, createdAt: "2026-01-01" },
  { id: "ba-38", accountNumber: "0111928374650", bankName: "STANDARD CHARTERED BANK", branchName: "MOTIJHEEL", accountHolder: "BridgeOne Group Corporate", accountType: "Current Account", currency: "BDT", glAccountId: "acc-10102", glAccountName: "Cash At Bank", openingBalance: 6500000, currentBalance: 7850000, reconciliationStatus: "RECONCILED", isActive: true, createdAt: "2026-01-01" },
  { id: "ba-39", accountNumber: "0045021009871", bankName: "MUTUAL TRUST BANK LTD", branchName: "PANTHAPATH", accountHolder: "BridgeOne Agro Industries Ltd", accountType: "Current Account", currency: "BDT", glAccountId: "acc-10102", glAccountName: "Cash At Bank", openingBalance: 1850000, currentBalance: 2180000, reconciliationStatus: "RECONCILED", isActive: true, createdAt: "2026-01-01" },
  { id: "ba-40", accountNumber: "2151000092837", bankName: "DHAKA BANK LTD", branchName: "BANANI", accountHolder: "BridgeOne Infrastructure Ltd", accountType: "Current Account", currency: "BDT", glAccountId: "acc-10102", glAccountName: "Cash At Bank", openingBalance: 2300000, currentBalance: 2750000, reconciliationStatus: "RECONCILED", isActive: true, createdAt: "2026-01-01" },
];

const initialDeposits: DepositItem[] = [
  { id: "dep-1", depositNumber: "SEC-DEP-001", bankName: "Sonali Bank PLC", depositType: "Security Deposit", officeId: "office-dhaka", officeName: "Dhaka Head Office", principalAmount: 500000, interestRate: 8.5, openingDate: "2026-01-10", maturityDate: "2027-01-10", maturityValue: 542500, interestEarned: 42500, status: "ACTIVE" },
  { id: "dep-2", depositNumber: "SEC-DEP-002", bankName: "Prime Bank LTD PLC", depositType: "Security Deposit", officeId: "office-sirajganj", officeName: "MG Sirajganj Factory", principalAmount: 350000, interestRate: 7.5, openingDate: "2026-02-15", maturityDate: "2027-02-15", maturityValue: 376250, interestEarned: 26250, status: "ACTIVE" },
  { id: "dep-3", depositNumber: "FDR-2026-001", bankName: "Dutch-Bangla Bank LTD PLC", depositType: "Fixed Deposit", officeId: "office-dhaka", officeName: "Dhaka Head Office", principalAmount: 1500000, interestRate: 9.0, openingDate: "2026-03-01", maturityDate: "2027-03-01", maturityValue: 1635000, interestEarned: 135000, status: "ACTIVE" },
  { id: "dep-4", depositNumber: "TDR-2026-002", bankName: "BRAC Bank LTD PLC", depositType: "Term Deposit", officeId: "office-mbbl", officeName: "MBBL-HO", principalAmount: 800000, interestRate: 8.75, openingDate: "2026-04-01", maturityDate: "2026-10-01", maturityValue: 835000, interestEarned: 35000, status: "ACTIVE" },
];

const initialLoans: LoanItem[] = [
  { id: "ln-1", loanNumber: "LN-EBL-2026-001", lenderName: "Eastern Bank PLC", loanType: "Working Capital", category: "BANK", officeId: "office-dhaka", officeName: "Dhaka Head Office", glAccountId: "acc-302", glAccountName: "Short Term Borrowing", principalAmount: 5000000, interestRate: 9.5, disbursementDate: "2026-02-01", maturityDate: "2027-02-01", installmentAmount: 438000, outstandingPrincipal: 3850000, accruedInterest: 32000, tenureMonths: 12, status: "ACTIVE" },
  { id: "ln-2", loanNumber: "LN-DBBL-2026-002", lenderName: "Dutch-Bangla Bank LTD PLC", loanType: "Term Loan", category: "BANK", officeId: "office-sirajganj", officeName: "MG Sirajganj Factory", glAccountId: "acc-303", glAccountName: "Long Term Machinery Loan", principalAmount: 12000000, interestRate: 9.0, disbursementDate: "2026-01-15", maturityDate: "2029-01-15", installmentAmount: 381000, outstandingPrincipal: 10450000, accruedInterest: 78000, tenureMonths: 36, status: "ACTIVE" },
  { id: "ln-3", loanNumber: "LN-PBL-2026-003", lenderName: "Prime Bank LTD PLC", loanType: "Syndicated Credit Facility", category: "BANK", officeId: "office-mgv", officeName: "MGV-PLC", glAccountId: "acc-302", glAccountName: "Short Term Borrowing", principalAmount: 4500000, interestRate: 9.25, disbursementDate: "2026-03-10", maturityDate: "2027-03-10", installmentAmount: 394000, outstandingPrincipal: 3720000, accruedInterest: 28500, tenureMonths: 12, status: "ACTIVE" },
];

const initialFactoring: FactoringItem[] = [
  { id: "fact-1", invoiceReference: "FAC-INV-2026-001", billNumber: "SD-MG261000105", customerName: "Arif Enterprise-Jamalpur", factoringCompany: "IPDC Factoring Finance", accountNo: "3133131043165", invoiceDate: "2026-10-05", eligibleReceivable: 450000, advanceAmount: 360000, feesCharges: 7200, remainingReceivable: 90000, settlementStatus: "SETTLED", isBillWise: true },
  { id: "fact-2", invoiceReference: "FAC-INV-2026-002", billNumber: "SD-MG261000149", customerName: "Choya Dia Enterprise-Magura", factoringCompany: "IDLC Factoring Division", accountNo: "2079624620001", invoiceDate: "2026-10-09", eligibleReceivable: 620000, advanceAmount: 496000, feesCharges: 9920, remainingReceivable: 124000, settlementStatus: "PARTIAL", isBillWise: true },
];

const initialLoanPartners: LoanPartnerItem[] = [
  { id: "lp-1", partnerName: "IDLC Finance PLC", group: "NBFI Corporate Partner", officeId: "office-dhaka", officeName: "Dhaka Head Office", accountType: "Lease Finance Facility", principalFacility: 4000000, interestRate: 10.5, tenureMonths: 36, outstanding: 2850000, status: "ACTIVE", createdAt: "2026-01-15" },
  { id: "lp-2", partnerName: "IPDC Finance Limited", group: "Equipment Credit Partner", officeId: "office-sirajganj", officeName: "MG Sirajganj Factory", accountType: "Industrial Term Loan", principalFacility: 8500000, interestRate: 11.0, tenureMonths: 48, outstanding: 6200000, status: "ACTIVE", createdAt: "2026-02-10" },
  { id: "lp-3", partnerName: "LankaBangla Finance Ltd", group: "Working Capital Partner", officeId: "office-mgv", officeName: "MGV-PLC", accountType: "Revolving Credit Line", principalFacility: 3000000, interestRate: 10.0, tenureMonths: 12, outstanding: 1500000, status: "ACTIVE", createdAt: "2026-03-01" },
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

const initialVouchers: JournalVoucher[] = [
  // Screenshot 1 & 3: Accounting Journal & Voucher Repository (Approved/Posted)
  {
    id: "jv-527",
    voucherNumber: "JV-MG261000527",
    createDate: "12-10-2026",
    transactionDate: "2026-10-12 - 11:33 AM",
    officeId: "office-sirajganj",
    officeName: "MG Sirajganj Factory",
    fiscalYear: "2026-2027",
    journalType: "GENERAL",
    transType: "Sales (Auto)",
    narration: "Sales to M/S Siddik Enterprise Netrokona Sales Invoice :SD-MG261000107, Sales Order:SO-MG260900136",
    preparedBy: "Distribution & Logistics",
    amount: 15961.92,
    totalDebit: 15961.92,
    totalCredit: 15961.92,
    status: "APPROVED",
    createdBy: "Distribution & Logistics",
    approvedBy: "Accounts Manager",
    lines: [
      { id: "l-527-1", accountId: "acc-10201", accountCode: "10201", accountName: "Accounts Receivable", debit: 15961.92, credit: 0, narration: "Invoice SD-MG261000107" },
      { id: "l-527-2", accountId: "acc-601", accountCode: "601", accountName: "Sales Income", debit: 0, credit: 15961.92, narration: "Sales Netrokona" },
    ],
    createdAt: "2026-10-12T05:33:00Z",
  },
  {
    id: "jv-526",
    voucherNumber: "JV-MG261000526",
    createDate: "12-10-2026",
    transactionDate: "2026-10-12 - 11:33 AM",
    officeId: "office-sirajganj",
    officeName: "MG Sirajganj Factory",
    fiscalYear: "2026-2027",
    journalType: "GENERAL",
    transType: "Sales (Auto)",
    narration: "Sales to Mustakim Traders-Kishoreganj Sales Invoice :SD-MG261000106, Sales Order:SO-MG260900140",
    preparedBy: "Distribution & Logistics",
    amount: 21824.28,
    totalDebit: 21824.28,
    totalCredit: 21824.28,
    status: "APPROVED",
    createdBy: "Distribution & Logistics",
    approvedBy: "Accounts Manager",
    lines: [
      { id: "l-526-1", accountId: "acc-10201", accountCode: "10201", accountName: "Accounts Receivable", debit: 21824.28, credit: 0, narration: "Invoice SD-MG261000106" },
      { id: "l-526-2", accountId: "acc-601", accountCode: "601", accountName: "Sales Income", debit: 0, credit: 21824.28, narration: "Sales Kishoreganj" },
    ],
    createdAt: "2026-10-12T05:33:00Z",
  },
  {
    id: "jv-525",
    voucherNumber: "JV-MG261000525",
    createDate: "12-10-2026",
    transactionDate: "2026-10-12 - 11:10 AM",
    officeId: "office-sirajganj",
    officeName: "MG Sirajganj Factory",
    fiscalYear: "2026-2027",
    journalType: "GENERAL",
    transType: "Inventory Movement [Transfer In...]",
    narration: "Inventory Transfer In From PD Biscuit Store To Finished Goods (FG) WH ITO-MG261000039",
    preparedBy: "MD. Tofajjol Hossin",
    amount: 42432.0,
    totalDebit: 42432.0,
    totalCredit: 42432.0,
    status: "APPROVED",
    createdBy: "MD. Tofajjol Hossin",
    approvedBy: "Inventory Controller",
    lines: [
      { id: "l-525-1", accountId: "acc-10302", accountCode: "10302", accountName: "Finished Goods (FG)", debit: 42432.0, credit: 0, narration: "Transfer in to FG WH" },
      { id: "l-525-2", accountId: "acc-10301", accountCode: "10301", accountName: "Raw Materials & Packaging", debit: 0, credit: 42432.0, narration: "Transfer from PD Biscuit" },
    ],
    createdAt: "2026-10-12T05:10:00Z",
  },
  {
    id: "jv-524",
    voucherNumber: "JV-MG261000524",
    createDate: "12-10-2026",
    transactionDate: "2026-10-12 - 11:10 AM",
    officeId: "office-sirajganj",
    officeName: "MG Sirajganj Factory",
    fiscalYear: "2026-2027",
    journalType: "GENERAL",
    transType: "Inventory Movement [Transfer Out...]",
    narration: "Inventory Transfer Out From PD Biscuit Store To Finished Goods (FG) WH - ITO-MG261000039",
    preparedBy: "MD. Tofajjol Hossin",
    amount: 42432.0,
    totalDebit: 42432.0,
    totalCredit: 42432.0,
    status: "APPROVED",
    createdBy: "MD. Tofajjol Hossin",
    approvedBy: "Inventory Controller",
    lines: [
      { id: "l-524-1", accountId: "acc-10302", accountCode: "10302", accountName: "Finished Goods (FG)", debit: 42432.0, credit: 0, narration: "Transfer Out transit" },
      { id: "l-524-2", accountId: "acc-10301", accountCode: "10301", accountName: "Raw Materials & Packaging", debit: 0, credit: 42432.0, narration: "Store credit" },
    ],
    createdAt: "2026-10-12T05:10:00Z",
  },
  {
    id: "jv-523",
    voucherNumber: "JV-MG261000523",
    createDate: "12-10-2026",
    transactionDate: "2026-10-12 - 11:06 AM",
    officeId: "office-sirajganj",
    officeName: "MG Sirajganj Factory",
    fiscalYear: "2026-2027",
    journalType: "GENERAL",
    transType: "Inventory Movement (Auto)",
    narration: "Production for Production Entry: PRE-MG261000032",
    preparedBy: "MD. Tofajjol Hossin",
    amount: 243101.27,
    totalDebit: 243101.27,
    totalCredit: 243101.27,
    status: "APPROVED",
    createdBy: "MD. Tofajjol Hossin",
    approvedBy: "Factory Manager",
    lines: [
      { id: "l-523-1", accountId: "acc-10302", accountCode: "10302", accountName: "Finished Goods (FG)", debit: 243101.27, credit: 0, narration: "Finished production" },
      { id: "l-523-2", accountId: "acc-701", accountCode: "701", accountName: "Cost of Goods Sold (COGS)", debit: 0, credit: 243101.27, narration: "Direct production cost" },
    ],
    createdAt: "2026-10-12T05:06:00Z",
  },
  {
    id: "jv-522",
    voucherNumber: "JV-MG261000522",
    createDate: "12-10-2026",
    transactionDate: "2026-10-11 - 11:03 AM",
    officeId: "office-sirajganj",
    officeName: "MG Sirajganj Factory",
    fiscalYear: "2026-2027",
    journalType: "GENERAL",
    transType: "Inventory Movement (Auto)",
    narration: "Inventory Issue For: INI-MG261000032",
    preparedBy: "MD. Tofajjol Hossin",
    amount: 243095.71,
    totalDebit: 243095.71,
    totalCredit: 243095.71,
    status: "APPROVED",
    createdBy: "MD. Tofajjol Hossin",
    approvedBy: "Factory Manager",
    lines: [
      { id: "l-522-1", accountId: "acc-701", accountCode: "701", accountName: "Cost of Goods Sold (COGS)", debit: 243095.71, credit: 0, narration: "Material issued" },
      { id: "l-522-2", accountId: "acc-10301", accountCode: "10301", accountName: "Raw Materials & Packaging", debit: 0, credit: 243095.71, narration: "Issued for batch" },
    ],
    createdAt: "2026-10-11T05:03:00Z",
  },
  {
    id: "jv-521",
    voucherNumber: "JV-MG261000521",
    createDate: "12-10-2026",
    transactionDate: "2026-10-11 - 11:03 AM",
    officeId: "office-sirajganj",
    officeName: "MG Sirajganj Factory",
    fiscalYear: "2026-2027",
    journalType: "GENERAL",
    transType: "Inventory Movement (Auto)",
    narration: "Production for Production Entry: PRE-MG261000031",
    preparedBy: "MD. Tofajjol Hossin",
    amount: 84321.67,
    totalDebit: 84321.67,
    totalCredit: 84321.67,
    status: "APPROVED",
    createdBy: "MD. Tofajjol Hossin",
    approvedBy: "Factory Manager",
    lines: [
      { id: "l-521-1", accountId: "acc-10302", accountCode: "10302", accountName: "Finished Goods (FG)", debit: 84321.67, credit: 0, narration: "Batch output" },
      { id: "l-521-2", accountId: "acc-701", accountCode: "701", accountName: "Cost of Goods Sold (COGS)", debit: 0, credit: 84321.67, narration: "Factory issue" },
    ],
    createdAt: "2026-10-11T05:03:00Z",
  },
  {
    id: "jv-520",
    voucherNumber: "JV-MG261000520",
    createDate: "12-10-2026",
    transactionDate: "2026-10-11 - 11:03 AM",
    officeId: "office-sirajganj",
    officeName: "MG Sirajganj Factory",
    fiscalYear: "2026-2027",
    journalType: "GENERAL",
    transType: "Inventory Movement (Auto)",
    narration: "Inventory Issue For: INI-MG261000031",
    preparedBy: "MD. Tofajjol Hossin",
    amount: 84321.67,
    totalDebit: 84321.67,
    totalCredit: 84321.67,
    status: "APPROVED",
    createdBy: "MD. Tofajjol Hossin",
    approvedBy: "Factory Manager",
    lines: [
      { id: "l-520-1", accountId: "acc-701", accountCode: "701", accountName: "Cost of Goods Sold (COGS)", debit: 84321.67, credit: 0, narration: "Floor consumption" },
      { id: "l-520-2", accountId: "acc-10301", accountCode: "10301", accountName: "Raw Materials & Packaging", debit: 0, credit: 84321.67, narration: "RM consumption" },
    ],
    createdAt: "2026-10-11T05:03:00Z",
  },
  {
    id: "jv-519",
    voucherNumber: "JV-MG261000519",
    createDate: "12-10-2026",
    transactionDate: "2026-10-11 - 11:02 AM",
    officeId: "office-sirajganj",
    officeName: "MG Sirajganj Factory",
    fiscalYear: "2026-2027",
    journalType: "GENERAL",
    transType: "Inventory Movement [Transfer In...]",
    narration: "Inventory Transfer In From Material WH To PD Snacks Store - ITO-MG261000038",
    preparedBy: "MD. Tofajjol Hossin",
    amount: 188401.32,
    totalDebit: 188401.32,
    totalCredit: 188401.32,
    status: "APPROVED",
    createdBy: "MD. Tofajjol Hossin",
    approvedBy: "Warehouse Head",
    lines: [
      { id: "l-519-1", accountId: "acc-10301", accountCode: "10301", accountName: "Raw Materials & Packaging", debit: 188401.32, credit: 0, narration: "Snacks Store receipt" },
      { id: "l-519-2", accountId: "acc-10301", accountCode: "10301", accountName: "Raw Materials & Packaging", debit: 0, credit: 188401.32, narration: "Material WH out" },
    ],
    createdAt: "2026-10-11T05:02:00Z",
  },
  {
    id: "jv-518",
    voucherNumber: "JV-MG261000518",
    createDate: "12-10-2026",
    transactionDate: "2026-10-11 - 11:02 AM",
    officeId: "office-sirajganj",
    officeName: "MG Sirajganj Factory",
    fiscalYear: "2026-2027",
    journalType: "GENERAL",
    transType: "Inventory Movement [Transfer Out...]",
    narration: "Inventory Transfer Out From Material WH To PD Snacks Store - ITO-MG261000038",
    preparedBy: "MD. Tofajjol Hossin",
    amount: 188401.32,
    totalDebit: 188401.32,
    totalCredit: 188401.32,
    status: "APPROVED",
    createdBy: "MD. Tofajjol Hossin",
    approvedBy: "Warehouse Head",
    lines: [
      { id: "l-518-1", accountId: "acc-10301", accountCode: "10301", accountName: "Raw Materials & Packaging", debit: 188401.32, credit: 0, narration: "Transit Dispatch" },
      { id: "l-518-2", accountId: "acc-10301", accountCode: "10301", accountName: "Raw Materials & Packaging", debit: 0, credit: 188401.32, narration: "Store credit" },
    ],
    createdAt: "2026-10-11T05:02:00Z",
  },
  {
    id: "jv-515",
    voucherNumber: "JV-MG261000515",
    createDate: "11-10-2026",
    transactionDate: "2026-10-11 - 5:38 PM",
    officeId: "office-mgv",
    officeName: "MGV-PLC",
    fiscalYear: "2026-2027",
    journalType: "ADJUSTMENT",
    transType: "Adjustment Journal (Manual)",
    narration: "Adjustment",
    preparedBy: "Md. Roni Mridha",
    amount: 3822.36,
    totalDebit: 3822.36,
    totalCredit: 3822.36,
    status: "APPROVED",
    createdBy: "Md. Roni Mridha",
    approvedBy: "Finance Controller",
    lines: [
      { id: "l-515-1", accountId: "acc-702", accountCode: "702", accountName: "Administrative & Operating Expenses", debit: 3822.36, credit: 0, narration: "Expense adjustment" },
      { id: "l-515-2", accountId: "acc-1461", accountCode: "1461", accountName: "Cash In Hand", debit: 0, credit: 3822.36, narration: "Cash settlement" },
    ],
    createdAt: "2026-10-11T11:38:00Z",
  },
  {
    id: "jv-516",
    voucherNumber: "JV-MG261000516",
    createDate: "11-10-2026",
    transactionDate: "2026-10-11 - 5:39 PM",
    officeId: "office-mgv",
    officeName: "MGV-PLC",
    fiscalYear: "2026-2027",
    journalType: "ADJUSTMENT",
    transType: "Adjustment Journal (Manual)",
    narration: "Adjustment",
    preparedBy: "Md. Roni Mridha",
    amount: 4083.09,
    totalDebit: 4083.09,
    totalCredit: 4083.09,
    status: "APPROVED",
    createdBy: "Md. Roni Mridha",
    approvedBy: "Finance Controller",
    lines: [
      { id: "l-516-1", accountId: "acc-702", accountCode: "702", accountName: "Administrative & Operating Expenses", debit: 4083.09, credit: 0, narration: "Utility adjustment" },
      { id: "l-516-2", accountId: "acc-1461", accountCode: "1461", accountName: "Cash In Hand", debit: 0, credit: 4083.09, narration: "Cash settlement" },
    ],
    createdAt: "2026-10-11T11:39:00Z",
  },
  {
    id: "jv-517",
    voucherNumber: "JV-MG261000517",
    createDate: "11-10-2026",
    transactionDate: "2026-10-11 - 5:43 PM",
    officeId: "office-mgv",
    officeName: "MGV-PLC",
    fiscalYear: "2026-2027",
    journalType: "ADJUSTMENT",
    transType: "Adjustment Journal (Manual)",
    narration: "Adjustment",
    preparedBy: "Md. Roni Mridha",
    amount: 1449.3,
    totalDebit: 1449.3,
    totalCredit: 1449.3,
    status: "APPROVED",
    createdBy: "Md. Roni Mridha",
    approvedBy: "Finance Controller",
    lines: [
      { id: "l-517-1", accountId: "acc-702", accountCode: "702", accountName: "Administrative & Operating Expenses", debit: 1449.3, credit: 0, narration: "Petty adjustment" },
      { id: "l-517-2", accountId: "acc-1461", accountCode: "1461", accountName: "Cash In Hand", debit: 0, credit: 1449.3, narration: "Cash settlement" },
    ],
    createdAt: "2026-10-11T11:43:00Z",
  },
  {
    id: "br-037",
    voucherNumber: "BR-MG261000037",
    createDate: "11-10-2026",
    transactionDate: "2026-10-11 - 12:00 AM",
    officeId: "office-dhaka",
    officeName: "Dhaka Head Office",
    fiscalYear: "2026-2027",
    journalType: "RECEIPT",
    transType: "Other Bank Receive Voucher (Auto)",
    narration: "Bank Receive- BR-MG261000037 02192230272 date-11-10-26",
    preparedBy: "RSM Md. Humayun Kabir",
    amount: 30000.0,
    totalDebit: 30000.0,
    totalCredit: 30000.0,
    status: "APPROVED",
    createdBy: "RSM Md. Humayun Kabir",
    approvedBy: "Treasury Lead",
    lines: [
      { id: "l-br037-1", accountId: "acc-10102", accountCode: "10102", accountName: "Cash At Bank", debit: 30000.0, credit: 0, narration: "Bank credit ref 02192230272" },
      { id: "l-br037-2", accountId: "acc-10201", accountCode: "10201", accountName: "Accounts Receivable", debit: 0, credit: 30000.0, narration: "Party receipt" },
    ],
    createdAt: "2026-10-11T00:00:00Z",
  },
  {
    id: "jv-511",
    voucherNumber: "JV-MG261000511",
    createDate: "11-10-2026",
    transactionDate: "2026-10-11 - 4:58 PM",
    officeId: "office-mgv",
    officeName: "MGV-PLC",
    fiscalYear: "2026-2027",
    journalType: "ADJUSTMENT",
    transType: "Adjustment Journal (Manual)",
    narration: "Adjustment",
    preparedBy: "Md. Roni Mridha",
    amount: 100000.0,
    totalDebit: 100000.0,
    totalCredit: 100000.0,
    status: "APPROVED",
    createdBy: "Md. Roni Mridha",
    approvedBy: "Finance Controller",
    lines: [
      { id: "l-511-1", accountId: "acc-702", accountCode: "702", accountName: "Administrative & Operating Expenses", debit: 100000.0, credit: 0, narration: "Inter-company adjustment" },
      { id: "l-511-2", accountId: "acc-1460", accountCode: "1460", accountName: "Cash Account", debit: 0, credit: 100000.0, narration: "Settled via cash account" },
    ],
    createdAt: "2026-10-11T10:58:00Z",
  },
  {
    id: "jv-512",
    voucherNumber: "JV-MG261000512",
    createDate: "11-10-2026",
    transactionDate: "2026-10-11 - 4:58 PM",
    officeId: "office-mbbl",
    officeName: "MBBL-HO",
    fiscalYear: "2026-2027",
    journalType: "ADJUSTMENT",
    transType: "Adjustment Journal (Manual)",
    narration: "Adjustment",
    preparedBy: "Md. Roni Mridha",
    amount: 2236.0,
    totalDebit: 2236.0,
    totalCredit: 2236.0,
    status: "APPROVED",
    createdBy: "Md. Roni Mridha",
    approvedBy: "Finance Controller",
    lines: [
      { id: "l-512-1", accountId: "acc-702", accountCode: "702", accountName: "Administrative & Operating Expenses", debit: 2236.0, credit: 0, narration: "Operating charge" },
      { id: "l-512-2", accountId: "acc-1461", accountCode: "1461", accountName: "Cash In Hand", debit: 0, credit: 2236.0, narration: "Cash payment" },
    ],
    createdAt: "2026-10-11T10:58:00Z",
  },
  {
    id: "jv-513",
    voucherNumber: "JV-MG261000513",
    createDate: "11-10-2026",
    transactionDate: "2026-10-11 - 5:04 PM",
    officeId: "office-dhaka",
    officeName: "Dhaka Head Office",
    fiscalYear: "2026-2027",
    journalType: "ADJUSTMENT",
    transType: "Adjustment Journal (Manual)",
    narration: "Adjustment",
    preparedBy: "Md. Roni Mridha",
    amount: 30000.0,
    totalDebit: 30000.0,
    totalCredit: 30000.0,
    status: "APPROVED",
    createdBy: "Md. Roni Mridha",
    approvedBy: "Finance Controller",
    lines: [
      { id: "l-513-1", accountId: "acc-702", accountCode: "702", accountName: "Administrative & Operating Expenses", debit: 30000.0, credit: 0, narration: "Head office charge" },
      { id: "l-513-2", accountId: "acc-1460", accountCode: "1460", accountName: "Cash Account", debit: 0, credit: 30000.0, narration: "Settlement" },
    ],
    createdAt: "2026-10-11T11:04:00Z",
  },
  {
    id: "jv-514",
    voucherNumber: "JV-MG261000514",
    createDate: "11-10-2026",
    transactionDate: "2026-10-11 - 5:05 PM",
    officeId: "office-mgv",
    officeName: "MGV-PLC",
    fiscalYear: "2026-2027",
    journalType: "ADJUSTMENT",
    transType: "Adjustment Journal (Manual)",
    narration: "Adjustment",
    preparedBy: "Md. Roni Mridha",
    amount: 10756331.0,
    totalDebit: 10756331.0,
    totalCredit: 10756331.0,
    status: "APPROVED",
    createdBy: "Md. Roni Mridha",
    approvedBy: "Finance Director",
    lines: [
      { id: "l-514-1", accountId: "acc-201", accountCode: "201", accountName: "Property, Plant And Equipment", debit: 10756331.0, credit: 0, narration: "Capital equipment capitalisation" },
      { id: "l-514-2", accountId: "acc-301", accountCode: "301", accountName: "Accounts Payable", debit: 0, credit: 10756331.0, narration: "Machinery supplier liability" },
    ],
    createdAt: "2026-10-11T11:05:00Z",
  },
  {
    id: "jv-505",
    voucherNumber: "JV-MG261000505",
    createDate: "11-10-2026",
    transactionDate: "2026-10-11 - 4:43 PM",
    officeId: "office-mohs",
    officeName: "MOHS-Eco",
    fiscalYear: "2026-2027",
    journalType: "ADJUSTMENT",
    transType: "Adjustment Journal (Manual)",
    narration: "Adjustment",
    preparedBy: "Md. Roni Mridha",
    amount: 3229.0,
    totalDebit: 3229.0,
    totalCredit: 3229.0,
    status: "APPROVED",
    createdBy: "Md. Roni Mridha",
    approvedBy: "Finance Controller",
    lines: [
      { id: "l-505-1", accountId: "acc-702", accountCode: "702", accountName: "Administrative & Operating Expenses", debit: 3229.0, credit: 0, narration: "Local travel & meals" },
      { id: "l-505-2", accountId: "acc-10101004", accountCode: "10101004", accountName: "Cash in Hand - MOHS ECO", debit: 0, credit: 3229.0, narration: "Cash reimbursement" },
    ],
    createdAt: "2026-10-11T10:43:00Z",
  },
  {
    id: "jv-507",
    voucherNumber: "JV-MG261000507",
    createDate: "11-10-2026",
    transactionDate: "2026-10-11 - 4:47 PM",
    officeId: "office-chapai",
    officeName: "CFF-Chapai",
    fiscalYear: "2026-2027",
    journalType: "ADJUSTMENT",
    transType: "Adjustment Journal (Manual)",
    narration: "Adjustment",
    preparedBy: "Md. Roni Mridha",
    amount: 174073.0,
    totalDebit: 174073.0,
    totalCredit: 174073.0,
    status: "APPROVED",
    createdBy: "Md. Roni Mridha",
    approvedBy: "Finance Controller",
    lines: [
      { id: "l-507-1", accountId: "acc-701", accountCode: "701", accountName: "Cost of Goods Sold (COGS)", debit: 174073.0, credit: 0, narration: "Raw material cost adjustment" },
      { id: "l-507-2", accountId: "acc-10301", accountCode: "10301", accountName: "Raw Materials & Packaging", debit: 0, credit: 174073.0, narration: "Chapai inventory write-down" },
    ],
    createdAt: "2026-10-11T10:47:00Z",
  },
  {
    id: "jv-508",
    voucherNumber: "JV-MG261000508",
    createDate: "11-10-2026",
    transactionDate: "2026-10-11 - 4:49 PM",
    officeId: "office-mfil",
    officeName: "MFIL-HO",
    fiscalYear: "2026-2027",
    journalType: "ADJUSTMENT",
    transType: "Adjustment Journal (Manual)",
    narration: "Adjustment",
    preparedBy: "Md. Roni Mridha",
    amount: 350000.0,
    totalDebit: 350000.0,
    totalCredit: 350000.0,
    status: "APPROVED",
    createdBy: "Md. Roni Mridha",
    approvedBy: "Finance Controller",
    lines: [
      { id: "l-508-1", accountId: "acc-702", accountCode: "702", accountName: "Administrative & Operating Expenses", debit: 350000.0, credit: 0, narration: "Corporate advisory fee" },
      { id: "l-508-2", accountId: "acc-10102", accountCode: "10102", accountName: "Cash At Bank", debit: 0, credit: 350000.0, narration: "Bank fund release" },
    ],
    createdAt: "2026-10-11T10:49:00Z",
  },
  {
    id: "jv-509",
    voucherNumber: "JV-MG261000509",
    createDate: "11-10-2026",
    transactionDate: "2026-10-11 - 4:50 PM",
    officeId: "office-mfil",
    officeName: "MFIL-HO",
    fiscalYear: "2026-2027",
    journalType: "ADJUSTMENT",
    transType: "Adjustment Journal (Manual)",
    narration: "Adjustment",
    preparedBy: "Md. Roni Mridha",
    amount: 200000.0,
    totalDebit: 200000.0,
    totalCredit: 200000.0,
    status: "APPROVED",
    createdBy: "Md. Roni Mridha",
    approvedBy: "Finance Controller",
    lines: [
      { id: "l-509-1", accountId: "acc-702", accountCode: "702", accountName: "Administrative & Operating Expenses", debit: 200000.0, credit: 0, narration: "Operational audit fee" },
      { id: "l-509-2", accountId: "acc-10102", accountCode: "10102", accountName: "Cash At Bank", debit: 0, credit: 200000.0, narration: "Bank fund release" },
    ],
    createdAt: "2026-10-11T10:50:00Z",
  },
  {
    id: "jv-510",
    voucherNumber: "JV-MG261000510",
    createDate: "11-10-2026",
    transactionDate: "2026-10-11 - 4:52 PM",
    officeId: "office-mohs",
    officeName: "MOHS-Eco",
    fiscalYear: "2026-2027",
    journalType: "ADJUSTMENT",
    transType: "Adjustment Journal (Manual)",
    narration: "Adjustment",
    preparedBy: "Md. Roni Mridha",
    amount: 915746.0,
    totalDebit: 915746.0,
    totalCredit: 915746.0,
    status: "APPROVED",
    createdBy: "Md. Roni Mridha",
    approvedBy: "Finance Controller",
    lines: [
      { id: "l-510-1", accountId: "acc-10101015", accountCode: "10101015", accountName: "Cash in Hand - MOHS Unity Venture", debit: 915746.0, credit: 0, narration: "Cash remittance" },
      { id: "l-510-2", accountId: "acc-10102", accountCode: "10102", accountName: "Cash At Bank", debit: 0, credit: 915746.0, narration: "Bank debit" },
    ],
    createdAt: "2026-10-11T10:52:00Z",
  },
  {
    id: "jv-497",
    voucherNumber: "JV-MG261000497",
    createDate: "11-10-2026",
    transactionDate: "2026-10-11 - 1:35 PM",
    officeId: "office-sirajganj",
    officeName: "MG Sirajganj Factory",
    fiscalYear: "2026-2027",
    journalType: "GENERAL",
    transType: "Sales (Auto)",
    narration: "Sales to Arif Enterprise-Jamalpur Sales Invoice :SD-MG261000105, Sales Order:SO-MG260900122",
    preparedBy: "Distribution & Logistics",
    amount: 9769.14,
    totalDebit: 9769.14,
    totalCredit: 9769.14,
    status: "APPROVED",
    createdBy: "Distribution & Logistics",
    approvedBy: "Accounts Manager",
    lines: [
      { id: "l-497-1", accountId: "acc-10201", accountCode: "10201", accountName: "Accounts Receivable", debit: 9769.14, credit: 0, narration: "Jamalpur dealer receivable" },
      { id: "l-497-2", accountId: "acc-601", accountCode: "601", accountName: "Sales Income", debit: 0, credit: 9769.14, narration: "Biscuits delivery sales" },
    ],
    createdAt: "2026-10-11T07:35:00Z",
  },
  {
    id: "jv-496",
    voucherNumber: "JV-MG261000496",
    createDate: "11-10-2026",
    transactionDate: "2026-10-11 - 1:28 PM",
    officeId: "office-sirajganj",
    officeName: "MG Sirajganj Factory",
    fiscalYear: "2026-2027",
    journalType: "GENERAL",
    transType: "Sales Return (Auto)",
    narration: "Sales Return to M/S Arif Enterprise-panchagarh with Receive code:SRP-MG261000001 for order:SO-MG260900055",
    preparedBy: "Md. Manik Miah",
    amount: 632.98,
    totalDebit: 632.98,
    totalCredit: 632.98,
    status: "APPROVED",
    createdBy: "Md. Manik Miah",
    approvedBy: "Accounts Manager",
    lines: [
      { id: "l-496-1", accountId: "acc-601", accountCode: "601", accountName: "Sales Income", debit: 632.98, credit: 0, narration: "Sales return deduction" },
      { id: "l-496-2", accountId: "acc-10201", accountCode: "10201", accountName: "Accounts Receivable", debit: 0, credit: 632.98, narration: "Panchagarh dealer credit" },
    ],
    createdAt: "2026-10-11T07:28:00Z",
  },
  {
    id: "jv-495",
    voucherNumber: "JV-MG261000495",
    createDate: "11-10-2026",
    transactionDate: "2026-10-11 - 1:20 PM",
    officeId: "office-sirajganj",
    officeName: "MG Sirajganj Factory",
    fiscalYear: "2026-2027",
    journalType: "GENERAL",
    transType: "Sales Return (Auto)",
    narration: "Sales Return to Choya Dia Enterprise-Magura+Narail with Receive code:SRP-MG261000000 for order:SO-MG260900149",
    preparedBy: "Md. Manik Miah",
    amount: 10965.89,
    totalDebit: 10965.89,
    totalCredit: 10965.89,
    status: "APPROVED",
    createdBy: "Md. Manik Miah",
    approvedBy: "Accounts Manager",
    lines: [
      { id: "l-495-1", accountId: "acc-601", accountCode: "601", accountName: "Sales Income", debit: 10965.89, credit: 0, narration: "Return deduction Magura" },
      { id: "l-495-2", accountId: "acc-10201", accountCode: "10201", accountName: "Accounts Receivable", debit: 0, credit: 10965.89, narration: "Party balance adjustment" },
    ],
    createdAt: "2026-10-11T07:20:00Z",
  },
  {
    id: "jv-494",
    voucherNumber: "JV-MG261000494",
    createDate: "11-10-2026",
    transactionDate: "2026-10-11 - 12:16 PM",
    officeId: "office-mgv",
    officeName: "MGV-PLC",
    fiscalYear: "2026-2027",
    journalType: "ADJUSTMENT",
    transType: "Adjustment Journal (Manual)",
    narration: "Adjustments",
    preparedBy: "Md. Roni Mridha",
    amount: 4659.21,
    totalDebit: 4659.21,
    totalCredit: 4659.21,
    status: "APPROVED",
    createdBy: "Md. Roni Mridha",
    approvedBy: "Finance Controller",
    lines: [
      { id: "l-494-1", accountId: "acc-702", accountCode: "702", accountName: "Administrative & Operating Expenses", debit: 4659.21, credit: 0, narration: "Petty operating adjustment" },
      { id: "l-494-2", accountId: "acc-1461", accountCode: "1461", accountName: "Cash In Hand", debit: 0, credit: 4659.21, narration: "Cash balance adjustment" },
    ],
    createdAt: "2026-10-11T06:16:00Z",
  },
  {
    id: "jv-459",
    voucherNumber: "JV-MG261000459",
    createDate: "11-10-2026",
    transactionDate: "2026-10-11 - 10:59 AM",
    officeId: "office-mbbl",
    officeName: "MBBL-HO",
    fiscalYear: "2026-2027",
    journalType: "ADJUSTMENT",
    transType: "Adjustment Journal (Manual)",
    narration: "Adjustment for bank Reconciliation",
    preparedBy: "Md. Roni Mridha",
    amount: 6486.0,
    totalDebit: 6486.0,
    totalCredit: 6486.0,
    status: "APPROVED",
    createdBy: "Md. Roni Mridha",
    approvedBy: "Finance Controller",
    lines: [
      { id: "l-459-1", accountId: "acc-702", accountCode: "702", accountName: "Administrative & Operating Expenses", debit: 6486.0, credit: 0, narration: "Bank charges reconciliation" },
      { id: "l-459-2", accountId: "acc-10102", accountCode: "10102", accountName: "Cash At Bank", debit: 0, credit: 6486.0, narration: "Sonali Bank ledger adjustment" },
    ],
    createdAt: "2026-10-11T04:59:00Z",
  },

  // Screenshot 2: Pending Voucher Tab
  {
    id: "br-038",
    voucherNumber: "BR-MG261000038",
    createDate: "12-10-2026",
    transactionDate: "2026-10-12",
    officeId: "office-dhaka",
    officeName: "Dhaka Head Office",
    fiscalYear: "2026-2027",
    journalType: "RECEIPT",
    transType: "Other Bank Receive Voucher (Auto)",
    narration: "Bank Receive- BR-MG261000038 521384208 date-11-10-26",
    preparedBy: "RSM Md. Humayun Kabir",
    amount: 20000.0,
    totalDebit: 20000.0,
    totalCredit: 20000.0,
    status: "PENDING",
    createdBy: "RSM Md. Humayun Kabir",
    lines: [
      { id: "l-br038-1", accountId: "acc-10102", accountCode: "10102", accountName: "Cash At Bank", debit: 20000.0, credit: 0, narration: "Direct bank credit" },
      { id: "l-br038-2", accountId: "acc-10201", accountCode: "10201", accountName: "Accounts Receivable", debit: 0, credit: 20000.0, narration: "Dealer collection receipt" },
    ],
    createdAt: "2026-10-12T04:30:00Z",
  },
  {
    id: "jv-360",
    voucherNumber: "JV-MG261000360",
    createDate: "10-10-2026",
    transactionDate: "2026-10-10",
    officeId: "office-mgv",
    officeName: "MGV-PLC",
    fiscalYear: "2026-2027",
    journalType: "ADJUSTMENT",
    transType: "Adjustment Journal (Manual)",
    narration: "Adjustment Entry for Bank Reconciliation",
    preparedBy: "Md. Roni Mridha",
    amount: 5207.0,
    totalDebit: 5207.0,
    totalCredit: 5207.0,
    status: "IN_PROGRESS",
    createdBy: "Md. Roni Mridha",
    lines: [
      { id: "l-360-1", accountId: "acc-702", accountCode: "702", accountName: "Administrative & Operating Expenses", debit: 5207.0, credit: 0, narration: "Bank charges discrepancy" },
      { id: "l-360-2", accountId: "acc-10102", accountCode: "10102", accountName: "Cash At Bank", debit: 0, credit: 5207.0, narration: "BRAC Bank account audit" },
    ],
    createdAt: "2026-10-10T08:15:00Z",
  },
  {
    id: "jv-349",
    voucherNumber: "JV-MG261000349",
    createDate: "07-10-2026",
    transactionDate: "2026-10-07",
    officeId: "office-mbbl",
    officeName: "MBBL-HO",
    fiscalYear: "2026-2027",
    journalType: "ADJUSTMENT",
    transType: "Adjustment Journal (Manual)",
    narration: "Loan Back to Md. Mehedi (Rashida)",
    preparedBy: "Md. Roni Mridha",
    amount: 200000.0,
    totalDebit: 200000.0,
    totalCredit: 200000.0,
    status: "IN_PROGRESS",
    createdBy: "Md. Roni Mridha",
    lines: [
      { id: "l-349-1", accountId: "acc-301", accountCode: "301", accountName: "Accounts Payable", debit: 200000.0, credit: 0, narration: "Short-term director loan repayment" },
      { id: "l-349-2", accountId: "acc-10102", accountCode: "10102", accountName: "Cash At Bank", debit: 0, credit: 200000.0, narration: "Corporate account cheque" },
    ],
    createdAt: "2026-10-07T06:00:00Z",
  },
  {
    id: "cp-033",
    voucherNumber: "CP-MG261000033",
    createDate: "08-10-2026",
    transactionDate: "2026-10-08",
    officeId: "office-mgv",
    officeName: "MGV-PLC",
    fiscalYear: "2026-2027",
    journalType: "PAYMENT",
    transType: "Other Cash Payment Voucher (Manual)",
    narration: "Cash Payment- CP-MG261000033 9685-DBBL Sirajganj Factory A/C",
    preparedBy: "Md. Roni Mridha",
    amount: 470000.0,
    totalDebit: 470000.0,
    totalCredit: 470000.0,
    status: "IN_PROGRESS",
    createdBy: "Md. Roni Mridha",
    lines: [
      { id: "l-cp033-1", accountId: "acc-1460", accountCode: "1460", accountName: "Cash Account", debit: 470000.0, credit: 0, narration: "Factory emergency cash buffer" },
      { id: "l-cp033-2", accountId: "acc-10102", accountCode: "10102", accountName: "Cash At Bank", debit: 0, credit: 470000.0, narration: "Cash withdrawal DBBL Sirajganj" },
    ],
    createdAt: "2026-10-08T09:20:00Z",
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
  | "addLoanPartner"
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

const initialExpenses: ExpenseRecord[] = [
  {
    id: "exp-1",
    expenseNumber: "EXP-MG261000101",
    code: "EXP-MG261000101",
    date: "12/10/2026",
    registrationDate: "12/10/2026",
    transactionDate: "2026-10-12",
    transactionNo: "TXN-EXP-9901",
    registrationCode: "EXP-REG-101",
    officeId: "office-sirajganj",
    officeName: "MG Sirajganj Factory",
    expenseType: "Factory Utilities",
    accountId: "acc-702",
    accountName: "Administrative & Operating Expenses",
    chartOfAccount: "702 - Administrative & Operating Expenses",
    payeeName: "Palli Bidyut Samity - Sirajganj",
    partnerPayee: "Palli Bidyut Samity - Sirajganj",
    description: "Monthly Factory Electricity Bill for Transformer #2",
    amount: 145820.0,
    paymentMethod: "BANK",
    status: "APPROVED",
    createdAt: "2026-10-12T04:00:00Z",
  },
  {
    id: "exp-2",
    expenseNumber: "EXP-MG261000102",
    code: "EXP-MG261000102",
    date: "11/10/2026",
    registrationDate: "11/10/2026",
    transactionDate: "2026-10-11",
    transactionNo: "TXN-EXP-9902",
    registrationCode: "EXP-REG-102",
    officeId: "office-dhaka",
    officeName: "Dhaka Head Office",
    expenseType: "Office Utilities",
    accountId: "acc-702",
    accountName: "Administrative & Operating Expenses",
    chartOfAccount: "702 - Administrative & Operating Expenses",
    payeeName: "DESCO Gulshan",
    partnerPayee: "DESCO Gulshan",
    description: "Corporate Office AC & Power supply billing",
    amount: 62450.0,
    paymentMethod: "BANK",
    status: "APPROVED",
    createdAt: "2026-10-11T05:30:00Z",
  },
  {
    id: "exp-3",
    expenseNumber: "EXP-MG261000103",
    code: "EXP-MG261000103",
    date: "10/10/2026",
    registrationDate: "10/10/2026",
    transactionDate: "2026-10-10",
    transactionNo: "TXN-EXP-9903",
    registrationCode: "EXP-REG-103",
    officeId: "office-mgv",
    officeName: "MGV-PLC",
    expenseType: "Plant Maintenance",
    accountId: "acc-701",
    accountName: "Cost of Goods Sold (COGS)",
    chartOfAccount: "701 - Cost of Goods Sold (COGS)",
    payeeName: "Apex Engineering Works",
    partnerPayee: "Apex Engineering Works",
    description: "Conveyor belt roller replacement and bearing grease",
    amount: 88500.0,
    paymentMethod: "CHEQUE",
    status: "PENDING",
    createdAt: "2026-10-10T08:00:00Z",
  },
  {
    id: "exp-4",
    expenseNumber: "EXP-MG261000104",
    code: "EXP-MG261000104",
    date: "09/10/2026",
    registrationDate: "09/10/2026",
    transactionDate: "2026-10-09",
    transactionNo: "TXN-EXP-9850",
    registrationCode: "EXP-REG-104",
    officeId: "office-mbbl",
    officeName: "MBBL-HO",
    expenseType: "Audit & Professional",
    accountId: "acc-702",
    accountName: "Administrative & Operating Expenses",
    chartOfAccount: "702 - Administrative & Operating Expenses",
    payeeName: "Rahman Rahman Huq (Chartered Accountants)",
    partnerPayee: "Rahman Rahman Huq (Chartered Accountants)",
    description: "Statutory Tax Audit retainer retainer Q3",
    amount: 150000.0,
    paymentMethod: "BANK",
    status: "PAID",
    paidAt: "2026-10-09T14:00:00Z",
    createdAt: "2026-10-09T03:00:00Z",
  },
  {
    id: "exp-5",
    expenseNumber: "EXP-MG261000105",
    code: "EXP-MG261000105",
    date: "08/10/2026",
    registrationDate: "08/10/2026",
    transactionDate: "2026-10-08",
    transactionNo: "TXN-EXP-9840",
    registrationCode: "EXP-REG-105",
    officeId: "office-mohs",
    officeName: "MOHS-Eco",
    expenseType: "Fuel & Transportation",
    accountId: "acc-702",
    accountName: "Administrative & Operating Expenses",
    chartOfAccount: "702 - Administrative & Operating Expenses",
    payeeName: "Padma Oil Distribution Station",
    partnerPayee: "Padma Oil Distribution Station",
    description: "Diesel fuel purchase for distribution delivery covered van",
    amount: 45000.0,
    paymentMethod: "CASH",
    status: "PAID",
    paidAt: "2026-10-08T11:00:00Z",
    createdAt: "2026-10-08T02:00:00Z",
  },
];

const initialAdvances: AdvanceRecord[] = [
  {
    id: "adv-1",
    advanceNumber: "ADV-MG261000045",
    code: "ADV-MG261000045",
    date: "12/10/2026",
    employeeName: "Md. Tofajjol Hossin",
    partnerPayee: "Md. Tofajjol Hossin (Factory Engineer)",
    officeId: "office-sirajganj",
    officeName: "MG Sirajganj Factory",
    purpose: "Raw material procurement local market trip advance",
    chartOfAccounts: "105 - Advance, Deposits & Pre-Payments",
    requestedAmount: 50000.0,
    approvedAmount: 50000.0,
    disbursedAmount: 50000.0,
    settledAmount: 0.0,
    remainingBalance: 50000.0,
    amount: 50000.0,
    status: "APPROVED",
    createdAt: "2026-10-12T05:00:00Z",
  },
  {
    id: "adv-2",
    advanceNumber: "ADV-MG261000046",
    code: "ADV-MG261000046",
    date: "11/10/2026",
    employeeName: "RSM Md. Humayun Kabir",
    partnerPayee: "RSM Md. Humayun Kabir (Sales Head)",
    officeId: "office-dhaka",
    officeName: "Dhaka Head Office",
    purpose: "Regional distributors conference accommodation advance",
    chartOfAccounts: "105 - Advance, Deposits & Pre-Payments",
    requestedAmount: 75000.0,
    approvedAmount: 75000.0,
    disbursedAmount: 0.0,
    settledAmount: 0.0,
    remainingBalance: 75000.0,
    amount: 75000.0,
    status: "PENDING",
    createdAt: "2026-10-11T09:00:00Z",
  },
  {
    id: "adv-3",
    advanceNumber: "ADV-MG261000047",
    code: "ADV-MG261000047",
    date: "09/10/2026",
    employeeName: "Md. Manik Miah",
    partnerPayee: "Md. Manik Miah (Logistics Officer)",
    officeId: "office-mgv",
    officeName: "MGV-PLC",
    purpose: "Vehicle toll charges and inter-district transport fuel advance",
    chartOfAccounts: "105 - Advance, Deposits & Pre-Payments",
    requestedAmount: 30000.0,
    approvedAmount: 30000.0,
    disbursedAmount: 30000.0,
    settledAmount: 30000.0,
    remainingBalance: 0.0,
    amount: 30000.0,
    status: "SETTLED",
    createdAt: "2026-10-09T07:00:00Z",
  },
];

const initialProvisions: ProvisionRecord[] = [
  {
    id: "prv-1",
    provisionNumber: "PRV-MG261000018",
    code: "PRV-MG261000018",
    date: "12/10/2026",
    officeId: "office-sirajganj",
    officeName: "MG Sirajganj Factory",
    expenseType: "Factory Wages Provision",
    accountId: "acc-303",
    accountName: "Payables, Provision And Accruals",
    chartOfAccount: "303 - Payables, Provision And Accruals",
    partnerPayee: "Sirajganj Factory Daily Contract Laborers",
    amount: 320000.0,
    effectivePeriod: "October 2026",
    description: "Accrued provision for weekly contract packaging worker wages",
    status: "POSTED",
    createdAt: "2026-10-12T06:00:00Z",
  },
  {
    id: "prv-2",
    provisionNumber: "PRV-MG261000019",
    code: "PRV-MG261000019",
    date: "11/10/2026",
    officeId: "office-dhaka",
    officeName: "Dhaka Head Office",
    expenseType: "Office Lease Provision",
    accountId: "acc-303",
    accountName: "Payables, Provision And Accruals",
    chartOfAccount: "303 - Payables, Provision And Accruals",
    partnerPayee: "Gulshan Tower Management Co.",
    amount: 250000.0,
    effectivePeriod: "October 2026",
    description: "Accrued provision for corporate floor lease rental liability",
    status: "POSTED",
    createdAt: "2026-10-11T08:00:00Z",
  },
  {
    id: "prv-3",
    provisionNumber: "PRV-MG261000020",
    code: "PRV-MG261000020",
    date: "10/10/2026",
    officeId: "office-mgv",
    officeName: "MGV-PLC",
    expenseType: "Machinery Overhaul Provision",
    accountId: "acc-303",
    accountName: "Payables, Provision And Accruals",
    chartOfAccount: "303 - Payables, Provision And Accruals",
    partnerPayee: "German Machinery Technical Service",
    amount: 180000.0,
    effectivePeriod: "October 2026",
    description: "Annual boiler safety certification & inspection provision",
    status: "PENDING",
    createdAt: "2026-10-10T10:00:00Z",
  },
];

const initialTransfers: FundTransferRecord[] = [
  {
    id: "ft-17",
    transferNumber: "TRF-2026-0017",
    requestCode: "",
    outCode: "FTO-MG260500017",
    requestDate: "2026-05-21",
    expectedDate: "2026-05-24",
    date: "2026-05-21",
    fromOfficeId: "office-mgv",
    fromOfficeName: "MGV-PLC",
    toOfficeId: "office-sirajganj",
    toOfficeName: "MG Sirajganj Factory",
    fromAccountId: "acc-10102",
    fromAccountName: "Cash At Bank",
    toAccountId: "acc-1460",
    toAccountName: "Cash Account",
    requestedAmount: 470000.0,
    approvedAmount: 470000.0,
    transferredAmount: 470000.0,
    receivedAmount: 470000.0,
    sentAmount: 470000.0,
    remainingAmount: 0.0,
    responsiblePerson: "Md. Roni Mridha",
    purpose: "Factory machinery overhaul funding",
    status: "Approved",
    createdAt: "2026-05-21T04:00:00Z",
  },
  {
    id: "ft-16",
    transferNumber: "TRF-2026-0016",
    requestCode: "",
    outCode: "FTO-MG260500016",
    requestDate: "2026-05-19",
    expectedDate: "2026-05-19",
    date: "2026-05-19",
    fromOfficeId: "office-mgv",
    fromOfficeName: "MGV-PLC",
    toOfficeId: "office-mbbl",
    toOfficeName: "MBBL-HO",
    fromAccountId: "acc-10102",
    fromAccountName: "Cash At Bank",
    toAccountId: "acc-10102",
    toAccountName: "Cash At Bank",
    requestedAmount: 517545.0,
    approvedAmount: 517545.0,
    transferredAmount: 517545.0,
    receivedAmount: 517545.0,
    sentAmount: 517545.0,
    remainingAmount: 0.0,
    responsiblePerson: "Md. Roni Mridha",
    purpose: "Inter-company fund adjustment",
    status: "Approved",
    createdAt: "2026-05-19T06:00:00Z",
  },
  {
    id: "ft-15",
    transferNumber: "TRF-2026-0015",
    requestCode: "",
    outCode: "FTO-MG260500015",
    requestDate: "2026-05-17",
    expectedDate: "2026-05-18",
    date: "2026-05-17",
    fromOfficeId: "office-mgv",
    fromOfficeName: "MGV-PLC",
    toOfficeId: "office-mbbl",
    toOfficeName: "MBBL-HO",
    fromAccountId: "acc-10102",
    fromAccountName: "Cash At Bank",
    toAccountId: "acc-10102",
    toAccountName: "Cash At Bank",
    requestedAmount: 500000.0,
    approvedAmount: 500000.0,
    transferredAmount: 500000.0,
    receivedAmount: 500000.0,
    sentAmount: 500000.0,
    remainingAmount: 0.0,
    responsiblePerson: "Md. Roni Mridha",
    purpose: "Operational liquidity support",
    status: "Approved",
    createdAt: "2026-05-17T05:00:00Z",
  },
  {
    id: "ft-14",
    transferNumber: "TRF-2026-0014",
    requestCode: "",
    outCode: "FTO-MG260500014",
    requestDate: "2026-05-17",
    expectedDate: "2026-05-18",
    date: "2026-05-17",
    fromOfficeId: "office-mbbl",
    fromOfficeName: "MBBL-HO",
    toOfficeId: "office-sirajganj",
    toOfficeName: "MG Sirajganj Factory",
    fromAccountId: "acc-10102",
    fromAccountName: "Cash At Bank",
    toAccountId: "acc-1460",
    toAccountName: "Cash Account",
    requestedAmount: 180000.0,
    approvedAmount: 180000.0,
    transferredAmount: 180000.0,
    receivedAmount: 180000.0,
    sentAmount: 180000.0,
    remainingAmount: 0.0,
    responsiblePerson: "Md. Roni Mridha",
    purpose: "Factory operational buffer",
    status: "Approved",
    createdAt: "2026-05-17T05:00:00Z",
  },
  {
    id: "ft-13",
    transferNumber: "TRF-2026-0013",
    requestCode: "",
    outCode: "FTO-MG260500013",
    requestDate: "2026-05-12",
    expectedDate: "2026-05-16",
    date: "2026-05-12",
    fromOfficeId: "office-mgv",
    fromOfficeName: "MGV-PLC",
    toOfficeId: "office-mbbl",
    toOfficeName: "MBBL-HO",
    fromAccountId: "acc-10102",
    fromAccountName: "Cash At Bank",
    toAccountId: "acc-10102",
    toAccountName: "Cash At Bank",
    requestedAmount: 900000.0,
    approvedAmount: 900000.0,
    transferredAmount: 900000.0,
    receivedAmount: 900000.0,
    sentAmount: 900000.0,
    remainingAmount: 0.0,
    responsiblePerson: "Md. Roni Mridha",
    purpose: "Working capital allocation",
    status: "Approved",
    createdAt: "2026-05-12T03:00:00Z",
  },
  {
    id: "ft-12",
    transferNumber: "TRF-2026-0012",
    requestCode: "",
    outCode: "FTO-MG260500012",
    requestDate: "2026-05-13",
    expectedDate: "2026-05-16",
    date: "2026-05-13",
    fromOfficeId: "office-mbbl",
    fromOfficeName: "MBBL-HO",
    toOfficeId: "office-sirajganj",
    toOfficeName: "MG Sirajganj Factory",
    fromAccountId: "acc-10102",
    fromAccountName: "Cash At Bank",
    toAccountId: "acc-1460",
    toAccountName: "Cash Account",
    requestedAmount: 50000.0,
    approvedAmount: 50000.0,
    transferredAmount: 50000.0,
    receivedAmount: 50000.0,
    sentAmount: 50000.0,
    remainingAmount: 0.0,
    responsiblePerson: "Md. Roni Mridha",
    purpose: "Petty cash reload",
    status: "Approved",
    createdAt: "2026-05-13T04:00:00Z",
  },
  {
    id: "ft-11",
    transferNumber: "TRF-2026-0011",
    requestCode: "",
    outCode: "FTO-MG260500011",
    requestDate: "2026-05-14",
    expectedDate: "2026-05-16",
    date: "2026-05-14",
    fromOfficeId: "office-mgv",
    fromOfficeName: "MGV-PLC",
    toOfficeId: "office-mbbl",
    toOfficeName: "MBBL-HO",
    fromAccountId: "acc-10102",
    fromAccountName: "Cash At Bank",
    toAccountId: "acc-10102",
    toAccountName: "Cash At Bank",
    requestedAmount: 550000.0,
    approvedAmount: 550000.0,
    transferredAmount: 550000.0,
    receivedAmount: 550000.0,
    sentAmount: 550000.0,
    remainingAmount: 0.0,
    responsiblePerson: "Md. Roni Mridha",
    purpose: "Commercial trade settlement",
    status: "Approved",
    createdAt: "2026-05-14T05:00:00Z",
  },
  {
    id: "ft-10",
    transferNumber: "TRF-2026-0010",
    requestCode: "",
    outCode: "FTO-MG260500010",
    requestDate: "2026-05-12",
    expectedDate: "2026-05-12",
    date: "2026-05-12",
    fromOfficeId: "office-mgv",
    fromOfficeName: "MGV-PLC",
    toOfficeId: "office-mbbl",
    toOfficeName: "MBBL-HO",
    fromAccountId: "acc-10102",
    fromAccountName: "Cash At Bank",
    toAccountId: "acc-10102",
    toAccountName: "Cash At Bank",
    requestedAmount: 900000.0,
    approvedAmount: 900000.0,
    transferredAmount: 900000.0,
    receivedAmount: 900000.0,
    sentAmount: 900000.0,
    remainingAmount: 0.0,
    responsiblePerson: "Md. Roni Mridha",
    purpose: "Monthly operational advance",
    status: "Approved",
    createdAt: "2026-05-12T04:00:00Z",
  },
  {
    id: "ft-09",
    transferNumber: "TRF-2026-0009",
    requestCode: "",
    outCode: "FTO-MG260500009",
    requestDate: "2026-05-10",
    expectedDate: "2026-05-11",
    date: "2026-05-10",
    fromOfficeId: "office-mbbl",
    fromOfficeName: "MBBL-HO",
    toOfficeId: "office-sirajganj",
    toOfficeName: "MG Sirajganj Factory",
    fromAccountId: "acc-10102",
    fromAccountName: "Cash At Bank",
    toAccountId: "acc-1460",
    toAccountName: "Cash Account",
    requestedAmount: 300000.0,
    approvedAmount: 300000.0,
    transferredAmount: 300000.0,
    receivedAmount: 300000.0,
    sentAmount: 300000.0,
    remainingAmount: 0.0,
    responsiblePerson: "Md. Roni Mridha",
    purpose: "Fuel advance and local supply",
    status: "Approved",
    createdAt: "2026-05-10T02:00:00Z",
  },
  {
    id: "ft-08",
    transferNumber: "TRF-2026-0008",
    requestCode: "",
    outCode: "FTO-MG260500008",
    requestDate: "2026-05-10",
    expectedDate: "2026-05-11",
    date: "2026-05-10",
    fromOfficeId: "office-mgv",
    fromOfficeName: "MGV-PLC",
    toOfficeId: "office-mbbl",
    toOfficeName: "MBBL-HO",
    fromAccountId: "acc-10102",
    fromAccountName: "Cash At Bank",
    toAccountId: "acc-10102",
    toAccountName: "Cash At Bank",
    requestedAmount: 3995000.0,
    approvedAmount: 3995000.0,
    transferredAmount: 3995000.0,
    receivedAmount: 3995000.0,
    sentAmount: 3995000.0,
    remainingAmount: 0.0,
    responsiblePerson: "Md. Roni Mridha",
    purpose: "Raw material bulk procurement fund",
    status: "Approved",
    createdAt: "2026-05-10T01:00:00Z",
  },
  {
    id: "ft-07",
    transferNumber: "TRF-2026-0007",
    requestCode: "",
    outCode: "FTO-MG260500007",
    requestDate: "2026-05-05",
    expectedDate: "2026-05-09",
    date: "2026-05-05",
    fromOfficeId: "office-marinozz",
    fromOfficeName: "Marinozz",
    toOfficeId: "office-mbbl",
    toOfficeName: "MBBL-HO",
    fromAccountId: "acc-10102",
    fromAccountName: "Cash At Bank",
    toAccountId: "acc-10102",
    toAccountName: "Cash At Bank",
    requestedAmount: 400000.0,
    approvedAmount: 400000.0,
    transferredAmount: 400000.0,
    receivedAmount: 400000.0,
    sentAmount: 400000.0,
    remainingAmount: 0.0,
    responsiblePerson: "Md. Roni Mridha",
    purpose: "Quarterly affiliate dividend remittance",
    status: "Approved",
    createdAt: "2026-05-05T03:00:00Z",
  },
  {
    id: "ft-06",
    transferNumber: "TRF-2026-0006",
    requestCode: "",
    outCode: "FTO-MG260500006",
    requestDate: "2026-05-03",
    expectedDate: "2026-05-05",
    date: "2026-05-03",
    fromOfficeId: "office-mbbl",
    fromOfficeName: "MBBL-HO",
    toOfficeId: "office-mgv",
    toOfficeName: "MGV-PLC",
    fromAccountId: "acc-10102",
    fromAccountName: "Cash At Bank",
    toAccountId: "acc-10102",
    toAccountName: "Cash At Bank",
    requestedAmount: 200000.0,
    approvedAmount: 200000.0,
    transferredAmount: 200000.0,
    receivedAmount: 200000.0,
    sentAmount: 200000.0,
    remainingAmount: 0.0,
    responsiblePerson: "Md. Roni Mridha",
    purpose: "Operational expense subsidy",
    status: "Approved",
    createdAt: "2026-05-03T02:00:00Z",
  },
  {
    id: "ft-05",
    transferNumber: "TRF-2026-0005",
    requestCode: "",
    outCode: "FTO-MG260500005",
    requestDate: "2026-05-03",
    expectedDate: "2026-05-04",
    date: "2026-05-03",
    fromOfficeId: "office-mbbl",
    fromOfficeName: "MBBL-HO",
    toOfficeId: "office-sirajganj",
    toOfficeName: "MG Sirajganj Factory",
    fromAccountId: "acc-10102",
    fromAccountName: "Cash At Bank",
    toAccountId: "acc-1460",
    toAccountName: "Cash Account",
    requestedAmount: 320000.0,
    approvedAmount: 320000.0,
    transferredAmount: 320000.0,
    receivedAmount: 320000.0,
    sentAmount: 320000.0,
    remainingAmount: 0.0,
    responsiblePerson: "Md. Roni Mridha",
    purpose: "Production floor overtime fund",
    status: "Approved",
    createdAt: "2026-05-03T01:00:00Z",
  },
  {
    id: "ft-04",
    transferNumber: "TRF-2026-0004",
    requestCode: "",
    outCode: "FTO-MG260500004",
    requestDate: "2026-05-02",
    expectedDate: "2026-05-02",
    date: "2026-05-02",
    fromOfficeId: "office-mbbl",
    fromOfficeName: "MBBL-HO",
    toOfficeId: "office-sirajganj",
    toOfficeName: "MG Sirajganj Factory",
    fromAccountId: "acc-10102",
    fromAccountName: "Cash At Bank",
    toAccountId: "acc-1460",
    toAccountName: "Cash Account",
    requestedAmount: 614216.0,
    approvedAmount: 614216.0,
    transferredAmount: 614216.0,
    receivedAmount: 614216.0,
    sentAmount: 614216.0,
    remainingAmount: 0.0,
    responsiblePerson: "Md. Roni Mridha",
    purpose: "Emergency supplier settlement",
    status: "Approved",
    createdAt: "2026-05-02T01:00:00Z",
  },
  // IN TRANSIT demo record (Screenshot 3)
  {
    id: "ft-03",
    transferNumber: "TRF-2026-0003",
    requestCode: "",
    outCode: "FTO-MG260500003",
    requestDate: "2026-04-13",
    expectedDate: "2026-05-02",
    date: "2026-04-13",
    payDate: "2026-04-13",
    fromOfficeId: "office-mbbl",
    fromOfficeName: "MBBL-HO",
    toOfficeId: "office-mbbl",
    toOfficeName: "MBBL-HO",
    fromAccountId: "acc-10102",
    fromAccountName: "Cash At Bank",
    toAccountId: "acc-10102",
    toAccountName: "Cash At Bank",
    requestedAmount: 11000.0,
    approvedAmount: 11000.0,
    transferredAmount: 11000.0,
    receivedAmount: 0.0,
    sentAmount: 11000.0,
    remainingAmount: 11000.0,
    responsiblePerson: "Md. Roni Mridha",
    purpose: "Branch cash transit transfer",
    status: "IN_TRANSIT",
    createdAt: "2026-04-13T02:00:00Z",
  },
  // RECEIVED demo record (Screenshot 4)
  {
    id: "ft-02",
    transferNumber: "TRF-2026-0002",
    requestCode: "",
    outCode: "FTO-MG260500002",
    receiveCode: "FTR-MG261000001",
    requestDate: "2026-04-13",
    expectedDate: "2026-05-02",
    date: "2026-04-13",
    receiveDate: "10/12/2026",
    fromOfficeId: "office-mbbl",
    fromOfficeName: "MBBL-HO",
    toOfficeId: "office-sirajganj",
    toOfficeName: "MG Sirajganj Factory",
    fromAccountId: "acc-10102",
    fromAccountName: "Cash At Bank",
    toAccountId: "acc-1460",
    toAccountName: "Cash Account",
    requestedAmount: 25000.0,
    approvedAmount: 25000.0,
    transferredAmount: 25000.0,
    receivedAmount: 25000.0,
    receiveAmount: 25000.0,
    responsiblePerson: "Md. Roni Mridha",
    receivedPerson: "MD. Tofajjol Hossin",
    transactionType: "Bank Transfer",
    purpose: "Stationery and utility replenish",
    status: "RECEIVED",
    createdAt: "2026-04-13T01:00:00Z",
  },
  // RETURNED demo record (Screenshot 5)
  {
    id: "ft-01",
    transferNumber: "TRF-2026-0001",
    requestCode: "",
    outCode: "FTO-MG260500001",
    returnCode: "RET-MG261000001",
    requestDate: "2026-04-19",
    expectedDate: "2026-05-02",
    date: "2026-04-19",
    fromOfficeId: "office-mbbl",
    fromOfficeName: "MBBL-HO",
    toOfficeId: "office-sirajganj",
    toOfficeName: "MG Sirajganj Factory",
    fromAccountId: "acc-10102",
    fromAccountName: "Cash At Bank",
    toAccountId: "acc-1460",
    toAccountName: "Cash Account",
    requestedAmount: 10230.0,
    approvedAmount: 10230.0,
    transferredAmount: 10230.0,
    receivedAmount: 0.0,
    responsiblePerson: "Md. Roni Mridha",
    purpose: "Duplicate requisition returned to source",
    status: "RETURNED",
    createdAt: "2026-04-19T01:00:00Z",
  },
];

const STORAGE_KEY = "bridgeone_accounting_v6";

let internalData: StateData = {
  accounts: initialAccounts,
  vouchers: initialVouchers,
  expenses: initialExpenses,
  advances: initialAdvances,
  provisions: initialProvisions,
  transfers: initialTransfers,
  bankAccounts: initialBankAccounts,
  deposits: initialDeposits,
  loans: initialLoans,
  factoring: initialFactoring,
  loanPartners: initialLoanPartners,
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

    addLoanPartner: (partnerData) => {
      const id = `lp-${Date.now()}`;
      updateData((prev) => ({
        ...prev,
        loanPartners: [...prev.loanPartners, { ...partnerData, id, createdAt: new Date().toISOString() }],
      }));
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
