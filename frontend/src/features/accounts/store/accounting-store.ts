"use client";

import { useSyncExternalStore } from "react";
import type {
  AccountItem,
  AdvanceRecord,
  BankAccountItem,
  BudgetItem,
  ChequeBookItem,
  ChequeIssueItem,
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

  // Actions - COA
  addAccount: (account: Omit<AccountItem, "id" | "currentBalance" | "createdAt" | "updatedAt">) => void;
  updateAccount: (id: string, updates: Partial<AccountItem>) => void;
  toggleAccountStatus: (id: string) => void;

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
  // 1000 Assets
  { id: "acc-1000", code: "1000", name: "Assets", accountType: "ASSET", accountSubtype: "Group", normalBalance: "DEBIT", openingBalance: 0, currentBalance: 0, currency: "BDT", isGroup: true, status: "ACTIVE", createdAt: "2026-01-01", updatedAt: "2026-01-01" },
  { id: "acc-1100", code: "1100", name: "Current Assets", parentCode: "1000", accountType: "ASSET", accountSubtype: "Group", normalBalance: "DEBIT", openingBalance: 0, currentBalance: 0, currency: "BDT", isGroup: true, status: "ACTIVE", createdAt: "2026-01-01", updatedAt: "2026-01-01" },
  { id: "acc-1110", code: "1110", name: "Cash in Hand", parentCode: "1100", accountType: "ASSET", accountSubtype: "Cash", normalBalance: "DEBIT", openingBalance: 150000, currentBalance: 150000, currency: "BDT", isGroup: false, status: "ACTIVE", createdAt: "2026-01-01", updatedAt: "2026-01-01" },
  { id: "acc-1120", code: "1120", name: "Cash at Bank - Sonali Bank", parentCode: "1100", accountType: "ASSET", accountSubtype: "Bank", normalBalance: "DEBIT", openingBalance: 1250000, currentBalance: 1250000, currency: "BDT", isGroup: false, status: "ACTIVE", createdAt: "2026-01-01", updatedAt: "2026-01-01" },
  { id: "acc-1121", code: "1121", name: "Cash at Bank - BRAC Bank", parentCode: "1100", accountType: "ASSET", accountSubtype: "Bank", normalBalance: "DEBIT", openingBalance: 820000, currentBalance: 820000, currency: "BDT", isGroup: false, status: "ACTIVE", createdAt: "2026-01-01", updatedAt: "2026-01-01" },
  { id: "acc-1130", code: "1130", name: "Accounts Receivable", parentCode: "1100", accountType: "ASSET", accountSubtype: "Receivable", normalBalance: "DEBIT", openingBalance: 650000, currentBalance: 650000, currency: "BDT", isGroup: false, status: "ACTIVE", createdAt: "2026-01-01", updatedAt: "2026-01-01" },
  { id: "acc-1140", code: "1140", name: "Advances & Prepayments", parentCode: "1100", accountType: "ASSET", accountSubtype: "Prepayment", normalBalance: "DEBIT", openingBalance: 45000, currentBalance: 45000, currency: "BDT", isGroup: false, status: "ACTIVE", createdAt: "2026-01-01", updatedAt: "2026-01-01" },
  { id: "acc-1150", code: "1150", name: "Fund in Transit", parentCode: "1100", accountType: "ASSET", accountSubtype: "Transit", normalBalance: "DEBIT", openingBalance: 0, currentBalance: 0, currency: "BDT", isGroup: false, status: "ACTIVE", createdAt: "2026-01-01", updatedAt: "2026-01-01" },
  { id: "acc-1200", code: "1200", name: "Non-Current Assets", parentCode: "1000", accountType: "ASSET", accountSubtype: "Group", normalBalance: "DEBIT", openingBalance: 0, currentBalance: 0, currency: "BDT", isGroup: true, status: "ACTIVE", createdAt: "2026-01-01", updatedAt: "2026-01-01" },
  { id: "acc-1210", code: "1210", name: "Office Furniture & Fixtures", parentCode: "1200", accountType: "ASSET", accountSubtype: "Fixed Asset", normalBalance: "DEBIT", openingBalance: 320000, currentBalance: 320000, currency: "BDT", isGroup: false, status: "ACTIVE", createdAt: "2026-01-01", updatedAt: "2026-01-01" },

  // 2000 Liabilities
  { id: "acc-2000", code: "2000", name: "Liabilities", accountType: "LIABILITY", accountSubtype: "Group", normalBalance: "CREDIT", openingBalance: 0, currentBalance: 0, currency: "BDT", isGroup: true, status: "ACTIVE", createdAt: "2026-01-01", updatedAt: "2026-01-01" },
  { id: "acc-2100", code: "2100", name: "Current Liabilities", parentCode: "2000", accountType: "LIABILITY", accountSubtype: "Group", normalBalance: "CREDIT", openingBalance: 0, currentBalance: 0, currency: "BDT", isGroup: true, status: "ACTIVE", createdAt: "2026-01-01", updatedAt: "2026-01-01" },
  { id: "acc-2110", code: "2110", name: "Accounts Payable", parentCode: "2100", accountType: "LIABILITY", accountSubtype: "Payable", normalBalance: "CREDIT", openingBalance: 420000, currentBalance: 420000, currency: "BDT", isGroup: false, status: "ACTIVE", createdAt: "2026-01-01", updatedAt: "2026-01-01" },
  { id: "acc-2120", code: "2120", name: "Accrued Expenses & Provisions", parentCode: "2100", accountType: "LIABILITY", accountSubtype: "Accrual", normalBalance: "CREDIT", openingBalance: 65000, currentBalance: 65000, currency: "BDT", isGroup: false, status: "ACTIVE", createdAt: "2026-01-01", updatedAt: "2026-01-01" },
  { id: "acc-2130", code: "2130", name: "VAT & Tax Withholding Payable", parentCode: "2100", accountType: "LIABILITY", accountSubtype: "Tax Payable", normalBalance: "CREDIT", openingBalance: 50000, currentBalance: 50000, currency: "BDT", isGroup: false, status: "ACTIVE", createdAt: "2026-01-01", updatedAt: "2026-01-01" },

  // 3000 Equity
  { id: "acc-3000", code: "3000", name: "Equity", accountType: "EQUITY", accountSubtype: "Group", normalBalance: "CREDIT", openingBalance: 0, currentBalance: 0, currency: "BDT", isGroup: true, status: "ACTIVE", createdAt: "2026-01-01", updatedAt: "2026-01-01" },
  { id: "acc-3100", code: "3100", name: "Share Capital", parentCode: "3000", accountType: "EQUITY", accountSubtype: "Equity", normalBalance: "CREDIT", openingBalance: 2000000, currentBalance: 2000000, currency: "BDT", isGroup: false, status: "ACTIVE", createdAt: "2026-01-01", updatedAt: "2026-01-01" },
  { id: "acc-3200", code: "3200", name: "Retained Earnings", parentCode: "3000", accountType: "EQUITY", accountSubtype: "Equity", normalBalance: "CREDIT", openingBalance: 700000, currentBalance: 700000, currency: "BDT", isGroup: false, status: "ACTIVE", createdAt: "2026-01-01", updatedAt: "2026-01-01" },

  // 4000 Revenue
  { id: "acc-4000", code: "4000", name: "Revenue", accountType: "REVENUE", accountSubtype: "Group", normalBalance: "CREDIT", openingBalance: 0, currentBalance: 0, currency: "BDT", isGroup: true, status: "ACTIVE", createdAt: "2026-01-01", updatedAt: "2026-01-01" },
  { id: "acc-4100", code: "4100", name: "Sales Income", parentCode: "4000", accountType: "REVENUE", accountSubtype: "Operating Revenue", normalBalance: "CREDIT", openingBalance: 0, currentBalance: 0, currency: "BDT", isGroup: false, status: "ACTIVE", createdAt: "2026-01-01", updatedAt: "2026-01-01" },
  { id: "acc-4200", code: "4200", name: "Service & Consultancy Income", parentCode: "4000", accountType: "REVENUE", accountSubtype: "Operating Revenue", normalBalance: "CREDIT", openingBalance: 0, currentBalance: 0, currency: "BDT", isGroup: false, status: "ACTIVE", createdAt: "2026-01-01", updatedAt: "2026-01-01" },

  // 5000 Expense
  { id: "acc-5000", code: "5000", name: "Expenses", accountType: "EXPENSE", accountSubtype: "Group", normalBalance: "DEBIT", openingBalance: 0, currentBalance: 0, currency: "BDT", isGroup: true, status: "ACTIVE", createdAt: "2026-01-01", updatedAt: "2026-01-01" },
  { id: "acc-5100", code: "5100", name: "Office Rent & Utilities", parentCode: "5000", accountType: "EXPENSE", accountSubtype: "Operating Expense", normalBalance: "DEBIT", openingBalance: 0, currentBalance: 0, currency: "BDT", isGroup: false, status: "ACTIVE", createdAt: "2026-01-01", updatedAt: "2026-01-01" },
  { id: "acc-5200", code: "5200", name: "Salaries & Allowances", parentCode: "5000", accountType: "EXPENSE", accountSubtype: "Payroll", normalBalance: "DEBIT", openingBalance: 0, currentBalance: 0, currency: "BDT", isGroup: false, status: "ACTIVE", createdAt: "2026-01-01", updatedAt: "2026-01-01" },
  { id: "acc-5300", code: "5300", name: "Travelling & Conveyance", parentCode: "5000", accountType: "EXPENSE", accountSubtype: "Travel", normalBalance: "DEBIT", openingBalance: 0, currentBalance: 0, currency: "BDT", isGroup: false, status: "ACTIVE", createdAt: "2026-01-01", updatedAt: "2026-01-01" },
  { id: "acc-5400", code: "5400", name: "Printing, Stationery & Postage", parentCode: "5000", accountType: "EXPENSE", accountSubtype: "General Admin", normalBalance: "DEBIT", openingBalance: 0, currentBalance: 0, currency: "BDT", isGroup: false, status: "ACTIVE", createdAt: "2026-01-01", updatedAt: "2026-01-01" },
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
  | "getDashboardKPIs"
  | "getGeneralLedger"
  | "getTrialBalance"
  | "getProfitAndLoss"
  | "getBalanceSheet"
>;

const STORAGE_KEY = "bridgeone_accounting_v1";

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
  cachedSnapshot = getFullState();
  return cachedSnapshot;
}

const getServerSnapshot = getSnapshot;

export function useAccountingStore<T = AccountingState>(selector?: (state: AccountingState) => T): T {
  const state = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  if (selector) {
    return selector(state);
  }
  return state as unknown as T;
}

useAccountingStore.getState = getSnapshot;
