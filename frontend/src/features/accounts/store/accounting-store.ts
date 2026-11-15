"use client";

import { useSyncExternalStore } from "react";
import { toast } from "@/components/purchase/Toast";
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
  ReceivedChequeItem,
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

export interface AccountingOfficeOption {
  id: string;
  name: string;
}

export interface AccountingEmployeeOption {
  id: string;
  employeeCode: string;
  name: string;
  designation?: string | null;
  department?: string | null;
  officeId: string;
}

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
  receivedCheques: ReceivedChequeItem[];
  budgets: BudgetItem[];
  costCenters: CostCenterItem[];
  coaPermissions: CoaPermissionItem[];
  offices: AccountingOfficeOption[];
  employees: AccountingEmployeeOption[];
  isHydrated: boolean;

  // Actions - COA
  addAccount: (account: Omit<AccountItem, "id" | "currentBalance" | "createdAt" | "updatedAt">) => void;
  addAccountAsync: (account: Omit<AccountItem, "id" | "currentBalance" | "createdAt" | "updatedAt">) => Promise<{ success: boolean; error?: string }>;
  updateAccount: (id: string, updates: Partial<AccountItem>) => void;
  updateAccountAsync: (id: string, updates: Partial<AccountItem>) => Promise<{ success: boolean; error?: string }>;
  deleteAccountAsync: (id: string) => Promise<{ success: boolean; error?: string }>;
  toggleAccountStatus: (id: string) => void;
  seedStandardCoaAsync: () => Promise<{ success: boolean; error?: string }>;
  bulkUploadAccountsAsync: (items: Array<Partial<AccountItem>>) => Promise<{ success: boolean; error?: string }>;

  // Actions - COA Permissions
  addCoaPermission: (perm: Omit<CoaPermissionItem, "id" | "createdAt">) => void;
  saveCoaPermissionsBatchAsync: (
    perms: Array<Omit<CoaPermissionItem, "id" | "createdAt"> & { employeeUuid?: string; accountId?: string }>
  ) => Promise<{ success: boolean; error?: string }>;
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
  addChequeBook: (book: Omit<ChequeBookItem, "id" | "usedLeaves" | "remainingLeaves" | "createdAt" | "totalLeaves"> & { totalLeaves?: number }) => { success: boolean; message: string };
  updateChequeBook: (id: string, updates: Partial<ChequeBookItem>) => { success: boolean; message: string };
  issueCheque: (cheque: Omit<ChequeIssueItem, "id" | "transactionNumber" | "createdAt">) => { success: boolean; message: string };
  updateChequeStatus: (id: string, status: ChequeIssueItem["status"], reason?: string) => void;
  addReceivedCheque: (chq: Omit<ReceivedChequeItem, "id" | "createdAt">) => { success: boolean; message: string };
  updateReceivedChequeStatus: (id: string, depositStatus: "DEPOSITED" | "NOT_DEPOSITED", depositDate?: string) => void;

  // Actions - Budgets & Centers
  createBudget: (budget: Partial<BudgetItem> & { budgetName: string; budgetYear: string; budgetType: string; allocatedAmount: number }) => void;
  updateBudget: (id: string, updates: Partial<BudgetItem>) => void;
  updateBudgetRevision: (id: string, revisedAmount: number) => void;
  deleteBudget: (id: string) => void;
  addCostCenter: (center: Omit<CostCenterItem, "id" | "createdAt">) => void;
  updateCostCenter: (id: string, updates: Partial<Omit<CostCenterItem, "id" | "createdAt">>) => void;

  // Analytics & Reports Helpers
  getDashboardKPIs: () => AccountDashboardKPIs;
  getGeneralLedger: (accountId?: string, fromDate?: string, toDate?: string) => GeneralLedgerEntry[];
  getTrialBalance: () => { rows: Array<{ code: string; name: string; type: string; debit: number; credit: number }>; totalDebit: number; totalCredit: number; isBalanced: boolean };
  getProfitAndLoss: (fromDate?: string, toDate?: string) => { revenues: Array<{ name: string; amount: number }>; expenses: Array<{ name: string; amount: number }>; totalRevenue: number; totalExpense: number; netProfit: number };
  getBalanceSheet: () => { assets: Array<{ name: string; amount: number }>; liabilities: Array<{ name: string; amount: number }>; equity: Array<{ name: string; amount: number }>; totalAssets: number; totalLiabilities: number; totalEquity: number; isBalanced: boolean };

  // Database Sync
  syncDatabase: () => Promise<void>;
}

type StateData = {
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
  receivedCheques: ReceivedChequeItem[];
  budgets: BudgetItem[];
  costCenters: CostCenterItem[];
  coaPermissions: CoaPermissionItem[];
  offices: AccountingOfficeOption[];
  employees: AccountingEmployeeOption[];
  isHydrated: boolean;
};

let internalData: StateData = {
  accounts: [],
  vouchers: [],
  expenses: [],
  advances: [],
  provisions: [],
  transfers: [],
  bankAccounts: [],
  deposits: [],
  loans: [],
  factoring: [],
  loanPartners: [],
  chequeBooks: [],
  cheques: [],
  receivedCheques: [],
  budgets: [],
  costCenters: [],
  coaPermissions: [],
  offices: [],
  employees: [],
  isHydrated: false,
};

function toDateStr(d: unknown): string {
  if (!d) return "";
  try {
    return new Date(String(d)).toISOString().split("T")[0];
  } catch {
    return "";
  }
}

let inFlightSync: Promise<void> | null = null;

async function syncFromDatabase(): Promise<void> {
  if (typeof window === "undefined") return;
  if (inFlightSync) return inFlightSync;

  inFlightSync = (async () => {
    try {
      const res = await fetch("/api/accounts/all-data", { cache: "no-store" });
      if (!res.ok) return;
      const json = await res.json();
      if (!json.success || !json.data) return;

      const {
        accounts = [],
        costCenters = [],
        budgets = [],
        vouchers = [],
        coaPermissions = [],
        bankAccounts = [],
        facilities = [],
        chequeBooks = [],
        chequeIssues = [],
        receivedCheques = [],
        expenses = [],
        fundTransfers = [],
        offices = [],
        employees = [],
      } = json.data;

      const mappedExpenses: ExpenseRecord[] = [];
      const mappedAdvances: AdvanceRecord[] = [];
      const mappedProvisions: ProvisionRecord[] = [];

      for (const e of expenses as any[]) {
        const kind = String(e.recordKind || "EXPENSE").toUpperCase();
        const amount = Number(e.amount || 0);
        const settled = Number(e.settledAmount || 0);
        if (kind === "ADVANCE") {
          mappedAdvances.push({
            id: e.id,
            advanceNumber: e.expenseNumber,
            employeeName: e.payeeName,
            officeId: e.officeId || "",
            officeName: e.officeName || "Corporate HO",
            purpose: e.description || e.expenseType,
            requestedAmount: amount,
            approvedAmount: amount,
            disbursedAmount: e.status === "DISBURSED" || e.status === "PARTIAL" || e.status === "SETTLED" ? amount : 0,
            settledAmount: settled,
            remainingBalance: Math.max(0, amount - settled),
            date: toDateStr(e.date),
            status: e.status || "PENDING",
            createdAt: toDateStr(e.createdAt),
          });
        } else if (kind === "PROVISION") {
          mappedProvisions.push({
            id: e.id,
            provisionNumber: e.expenseNumber,
            officeId: e.officeId || "",
            officeName: e.officeName || "Corporate HO",
            expenseType: e.expenseType,
            accountId: e.accountId || "",
            accountName: e.accountName,
            amount,
            effectivePeriod: e.effectivePeriod || "",
            description: e.description || "",
            status: e.status || "ACTIVE",
            createdAt: toDateStr(e.createdAt),
          });
        } else {
          mappedExpenses.push({
            ...e,
            amount,
            date: toDateStr(e.date),
            createdAt: toDateStr(e.createdAt),
            lines: (e.lines || []).map((l: any) => ({ ...l, date: toDateStr(l.date), amount: Number(l.amount || 0) })),
          });
        }
      }

      const mappedDeposits: BankDepositItem[] = [];
      const mappedLoans: BankLoanItem[] = [];
      const mappedPartners: LoanPartnerItem[] = [];

      for (const f of facilities as any[]) {
        if (f.facilityKind === "DEPOSIT") {
          mappedDeposits.push({
            id: f.id,
            depositNumber: f.facilityNumber,
            bankAccountId: f.bankAccountId || undefined,
            bankName: f.partyName,
            depositType: f.facilityType,
            officeId: f.officeId || undefined,
            officeName: f.officeName || undefined,
            principalAmount: Number(f.principalAmount || 0),
            interestRate: Number(f.interestRate || 0),
            openingDate: toDateStr(f.openingDate),
            maturityDate: toDateStr(f.maturityDate),
            maturityValue: Number(f.maturityValue || 0),
            interestEarned: Number(f.accruedInterest || 0),
            status: f.status || "ACTIVE",
          });
        } else if (f.facilityKind === "LOAN") {
          mappedLoans.push({
            id: f.id,
            loanNumber: f.facilityNumber,
            lenderName: f.partyName,
            loanType: f.facilityType,
            category: f.category || "BANK",
            officeId: f.officeId || undefined,
            officeName: f.officeName || undefined,
            glAccountId: f.glAccountId || undefined,
            glAccountName: f.glAccountName || undefined,
            partnerGroup: f.partnerGroup || undefined,
            principalAmount: Number(f.principalAmount || 0),
            interestRate: Number(f.interestRate || 0),
            disbursementDate: toDateStr(f.openingDate),
            maturityDate: toDateStr(f.maturityDate),
            installmentAmount: Number(f.installmentAmount || 0),
            outstandingPrincipal: Number(f.outstandingPrincipal || 0),
            accruedInterest: Number(f.accruedInterest || 0),
            tenureMonths: f.tenureMonths || undefined,
            status: f.status || "ACTIVE",
          });
        } else if (f.facilityKind === "PARTNER") {
          mappedPartners.push({
            id: f.id,
            partnerName: f.partyName,
            group: f.partnerGroup || "Corporate",
            officeId: f.officeId || "",
            officeName: f.officeName || "",
            accountType: f.facilityType,
            principalFacility: Number(f.principalAmount || 0),
            interestRate: Number(f.interestRate || 0),
            tenureMonths: f.tenureMonths || 12,
            outstanding: Number(f.outstandingPrincipal || 0),
            status: f.status === "INACTIVE" ? "INACTIVE" : "ACTIVE",
            createdAt: toDateStr(f.createdAt),
          });
        }
      }

      updateData((prev) => ({
        ...prev,
        isHydrated: true,
        offices,
        employees,
        accounts: accounts.map((a: any) => ({
          ...a,
          openingBalance: Number(a.openingBalance || 0),
          currentBalance: Number(a.currentBalance || 0),
          createdAt: toDateStr(a.createdAt),
          updatedAt: toDateStr(a.updatedAt),
        })),
        costCenters: costCenters.map((c: any) => ({
          ...c,
          createdAt: toDateStr(c.createdAt),
        })),
        budgets: budgets.map((b: any) => ({
          ...b,
          allocatedAmount: Number(b.allocatedAmount || 0),
          totalBudgetAmount: Number(b.totalBudgetAmount || b.allocatedAmount || 0),
          revisedAmount: Number(b.revisedAmount || 0),
          utilizedAmount: Number(b.utilizedAmount || 0),
          committedAmount: Number(b.committedAmount || 0),
          remainingAmount: Number(b.remainingAmount || 0),
          items: (b.items || []).map((item: any) => ({
            ...item,
            allocatedAmount: Number(item.allocatedAmount || 0),
            utilizedAmount: Number(item.utilizedAmount || 0),
            remainingAmount: Number(item.remainingAmount || 0),
          })),
        })),
        vouchers: vouchers.map((v: any) => ({
          ...v,
          transactionDate: toDateStr(v.transactionDate),
          totalDebit: Number(v.totalDebit || 0),
          totalCredit: Number(v.totalCredit || 0),
          lines: (v.lines || []).map((l: any) => ({
            ...l,
            debit: Number(l.debit || 0),
            credit: Number(l.credit || 0),
          })),
        })),
        coaPermissions: coaPermissions.map((p: any) => ({
          ...p,
          createdAt: toDateStr(p.createdAt),
        })),
        bankAccounts: bankAccounts.map((b: any) => ({
          ...b,
          openingBalance: Number(b.openingBalance || 0),
          currentBalance: Number(b.currentBalance || 0),
          createdAt: toDateStr(b.createdAt),
        })),
        deposits: mappedDeposits,
        loans: mappedLoans,
        loanPartners: mappedPartners,
        chequeBooks: chequeBooks.map((b: any) => ({
          ...b,
          totalLeaves: Number(b.totalLeaves || 25),
          usedLeaves: Number(b.usedLeaves || 0),
          remainingLeaves: Number(b.remainingLeaves || 25),
          createdAt: toDateStr(b.createdAt),
        })),
        cheques: chequeIssues.map((ci: any) => ({
          ...ci,
          amount: Number(ci.amount || 0),
          issueDate: toDateStr(ci.issueDate),
          chequeDate: toDateStr(ci.chequeDate),
          createdAt: toDateStr(ci.createdAt),
        })),
        receivedCheques: receivedCheques.map((rc: any) => ({
          ...rc,
          amount: Number(rc.amount || 0),
          receivedDate: toDateStr(rc.receivedDate),
          chequeDate: toDateStr(rc.chequeDate),
          depositDate: rc.depositDate ? toDateStr(rc.depositDate) : undefined,
          createdAt: toDateStr(rc.createdAt),
        })),
        expenses: mappedExpenses,
        advances: mappedAdvances,
        provisions: mappedProvisions,
        transfers: fundTransfers.map((ft: any) => ({
          ...ft,
          requestDate: toDateStr(ft.requestDate),
          expectedDate: toDateStr(ft.expectedDate),
          requestedAmount: Number(ft.requestedAmount || 0),
          approvedAmount: Number(ft.approvedAmount || 0),
          transferredAmount: Number(ft.transferredAmount || 0),
          receivedAmount: Number(ft.receivedAmount || 0),
          createdAt: toDateStr(ft.createdAt),
        })),
      }));
    } catch (err) {
      console.warn("Accounts DB sync warning:", err);
    } finally {
      inFlightSync = null;
    }
  })();

  return inFlightSync;
}

if (typeof window !== "undefined") {
  setTimeout(() => {
    void syncFromDatabase();
  }, 20);
}

const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((listener) => listener());
}

function updateData(updater: (prev: StateData) => StateData) {
  internalData = updater(internalData);
  cachedSnapshot = getFullState();
  notify();
}

/**
 * Calls an accounts API. Most store actions fire their save and return at once, so
 * a save the server refuses is reported here: the user sees why it was not saved
 * and the screen is reloaded from the database.
 */
async function apiJson(url: string, init: RequestInit, quiet = false): Promise<{ success: boolean; data?: any; error?: string }> {
  let result: { success: boolean; data?: any; error?: string };
  try {
    const res = await fetch(url, {
      ...init,
      headers: { "Content-Type": "application/json", ...(init.headers || {}) },
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json.success === false) {
      // Routes answer either { error: "text" } or { error: { message } }.
      const message = typeof json.error === "string" ? json.error : json.error?.message;
      result = { success: false, error: message || `Request failed (${res.status})` };
    } else {
      result = { success: true, data: json.data };
    }
  } catch (err) {
    result = { success: false, error: err instanceof Error ? err.message : "Network error" };
  }
  const method = (init.method || "GET").toUpperCase();
  if (!result.success && method !== "GET" && !quiet) {
    toast.error(result.error ?? "The change was not saved.", { title: "Not saved" });
    void syncFromDatabase();
  }
  return result;
}

/** For actions that hand the error back to the screen, which shows it itself. */
const apiJsonQuiet = (url: string, init: RequestInit) => apiJson(url, init, true);

function getFullState(): AccountingState {
  return {
    ...internalData,

    syncDatabase: async () => {
      await syncFromDatabase();
    },

    addAccountAsync: async (accountData) => {
      const res = await apiJsonQuiet("/api/accounts/chart-of-accounts", {
        method: "POST",
        body: JSON.stringify(accountData),
      });
      if (res.success) await syncFromDatabase();
      return { success: res.success, error: res.error };
    },

    addAccount: (accountData) => {
      void getFullState().addAccountAsync(accountData);
    },

    updateAccountAsync: async (id, updates) => {
      const res = await apiJsonQuiet(`/api/accounts/chart-of-accounts/${id}`, {
        method: "PATCH",
        body: JSON.stringify(updates),
      });
      if (res.success) await syncFromDatabase();
      return { success: res.success, error: res.error };
    },

    updateAccount: (id, updates) => {
      updateData((prev) => ({
        ...prev,
        accounts: prev.accounts.map((acc) =>
          acc.id === id ? { ...acc, ...updates, updatedAt: toDateStr(new Date()) } : acc
        ),
      }));
      void apiJson(`/api/accounts/chart-of-accounts/${id}`, {
        method: "PATCH",
        body: JSON.stringify(updates),
      }).then((r) => {
        if (r.success) void syncFromDatabase();
      });
    },

    deleteAccountAsync: async (id) => {
      const res = await apiJsonQuiet(`/api/accounts/chart-of-accounts/${id}`, {
        method: "DELETE",
      });
      if (res.success) await syncFromDatabase();
      return { success: res.success, error: res.error };
    },

    toggleAccountStatus: (id) => {
      const target = internalData.accounts.find((a) => a.id === id);
      const nextStatus = target?.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
      updateData((prev) => ({
        ...prev,
        accounts: prev.accounts.map((acc) =>
          acc.id === id ? { ...acc, status: nextStatus } : acc
        ),
      }));
      void apiJson(`/api/accounts/chart-of-accounts/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: nextStatus }),
      }).then((r) => {
        if (r.success) void syncFromDatabase();
      });
    },

    seedStandardCoaAsync: async () => {
      const res = await apiJsonQuiet("/api/accounts/chart-of-accounts", {
        method: "POST",
        body: JSON.stringify({ action: "seedStandard" }),
      });
      if (res.success) await syncFromDatabase();
      return { success: res.success, error: res.error };
    },

    bulkUploadAccountsAsync: async (items) => {
      const res = await apiJsonQuiet("/api/accounts/chart-of-accounts", {
        method: "POST",
        body: JSON.stringify({ items }),
      });
      if (res.success) await syncFromDatabase();
      return { success: res.success, error: res.error };
    },

    saveCoaPermissionsBatchAsync: async (perms) => {
      const res = await apiJsonQuiet("/api/accounts/coa-permissions", {
        method: "POST",
        body: JSON.stringify({ items: perms }),
      });
      if (res.success) await syncFromDatabase();
      return { success: res.success, error: res.error };
    },

    addCoaPermission: (perm) => {
      void getFullState().saveCoaPermissionsBatchAsync([perm]);
    },

    deleteCoaPermission: (id) => {
      updateData((prev) => ({
        ...prev,
        coaPermissions: prev.coaPermissions.filter((p) => p.id !== id),
      }));
      void apiJson(`/api/accounts/coa-permissions/${id}`, { method: "DELETE" }).then((r) => {
        if (r.success) void syncFromDatabase();
      });
    },

    toggleCoaPermission: (id) => {
      const target = internalData.coaPermissions.find((p) => p.id === id);
      const nextStatus = target?.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
      updateData((prev) => ({
        ...prev,
        coaPermissions: prev.coaPermissions.map((p) =>
          p.id === id ? { ...p, status: nextStatus } : p
        ),
      }));
      void apiJson(`/api/accounts/coa-permissions/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: nextStatus }),
      }).then((r) => {
        if (r.success) void syncFromDatabase();
      });
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
        return { success: false, message: "A double-entry voucher must have at least two lines." };
      }

      const optimisticVoucher: JournalVoucher = {
        ...voucherData,
        id: `jv-${Date.now()}`,
        voucherNumber: `JV-${new Date().getFullYear()}-${String(internalData.vouchers.length + 1).padStart(4, "0")}`,
        totalDebit,
        totalCredit,
        createdAt: toDateStr(new Date()),
      };

      void apiJson("/api/accounts/journal", {
        method: "POST",
        body: JSON.stringify(voucherData),
      }).then((r) => {
        if (r.success) void syncFromDatabase();
      });

      return { success: true, message: "Journal voucher submitted to database.", voucher: optimisticVoucher };
    },

    postVoucher: (id) => {
      const v = internalData.vouchers.find((item) => item.id === id);
      if (!v) return { success: false, message: "Voucher not found." };
      if (v.status === "POSTED") return { success: false, message: "Voucher is already posted." };

      void apiJson(`/api/accounts/journal/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ action: "POST" }),
      }).then((r) => {
        if (r.success) void syncFromDatabase();
      });

      return { success: true, message: `Voucher ${v.voucherNumber} posted to General Ledger.` };
    },

    reverseVoucher: (id, reason) => {
      const original = internalData.vouchers.find((item) => item.id === id);
      if (!original) return { success: false, message: "Voucher not found." };
      if (original.status !== "POSTED") return { success: false, message: "Only posted vouchers can be reversed." };

      void apiJson(`/api/accounts/journal/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ action: "REVERSE", reason }),
      }).then((r) => {
        if (r.success) void syncFromDatabase();
      });

      return { success: true, message: `Reversal triggered for ${original.voucherNumber}.` };
    },

    createExpense: (expenseData) => {
      void apiJson("/api/accounts/expenses", {
        method: "POST",
        body: JSON.stringify({ ...expenseData, recordKind: "EXPENSE" }),
      }).then((r) => {
        if (r.success) void syncFromDatabase();
      });
    },

    updateExpenseStatus: (id, status, approvedBy) => {
      void apiJson(`/api/accounts/expenses/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status, approvedBy }),
      }).then((r) => {
        if (r.success) void syncFromDatabase();
      });
    },

    markExpensePaid: (id, paymentMethod) => {
      void apiJson(`/api/accounts/expenses/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ action: "PAY", paymentMethod }),
      }).then((r) => {
        if (r.success) void syncFromDatabase();
      });
    },

    createAdvance: (advanceData) => {
      void apiJson("/api/accounts/expenses", {
        method: "POST",
        body: JSON.stringify({
          recordKind: "ADVANCE",
          officeId: advanceData.officeId,
          officeName: advanceData.officeName,
          expenseType: "Employee/Supplier Advance",
          accountName: "Employee & Supplier Advances",
          payeeName: advanceData.employeeName,
          amount: advanceData.requestedAmount,
          date: advanceData.date,
          description: advanceData.purpose,
          status: advanceData.status || "PENDING",
        }),
      }).then((r) => {
        if (r.success) void syncFromDatabase();
      });
    },

    disburseAdvance: (id, amount) => {
      void apiJson(`/api/accounts/expenses/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ action: "DISBURSE", amount }),
      }).then((r) => {
        if (r.success) void syncFromDatabase();
      });
    },

    settleAdvance: (id, amount) => {
      void apiJson(`/api/accounts/expenses/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ action: "SETTLE", settledAmount: amount }),
      }).then((r) => {
        if (r.success) void syncFromDatabase();
      });
    },

    createProvision: (provisionData) => {
      void apiJson("/api/accounts/expenses", {
        method: "POST",
        body: JSON.stringify({
          recordKind: "PROVISION",
          officeId: provisionData.officeId,
          officeName: provisionData.officeName,
          expenseType: provisionData.expenseType,
          accountId: provisionData.accountId,
          accountName: provisionData.accountName,
          payeeName: provisionData.officeName || "Provision",
          amount: provisionData.amount,
          effectivePeriod: provisionData.effectivePeriod,
          description: provisionData.description,
          status: provisionData.status || "ACTIVE",
        }),
      }).then((r) => {
        if (r.success) void syncFromDatabase();
      });
    },

    createTransfer: (transferData) => {
      void apiJson("/api/accounts/fund-transfers", {
        method: "POST",
        body: JSON.stringify(transferData),
      }).then((r) => {
        if (r.success) void syncFromDatabase();
      });
    },

    approveTransfer: (id, approvedAmount) => {
      void apiJson(`/api/accounts/fund-transfers/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ action: "APPROVE", approvedAmount }),
      }).then((r) => {
        if (r.success) void syncFromDatabase();
      });
    },

    dispatchTransfer: (id) => {
      void apiJson(`/api/accounts/fund-transfers/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ action: "DISPATCH" }),
      }).then((r) => {
        if (r.success) void syncFromDatabase();
      });
    },

    receiveTransfer: (id) => {
      void apiJson(`/api/accounts/fund-transfers/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ action: "RECEIVE" }),
      }).then((r) => {
        if (r.success) void syncFromDatabase();
      });
    },

    returnTransfer: (id, reason) => {
      void apiJson(`/api/accounts/fund-transfers/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ action: "RETURN", reason }),
      }).then((r) => {
        if (r.success) void syncFromDatabase();
      });
    },

    addBankAccount: (bankData) => {
      void apiJson("/api/accounts/banking", {
        method: "POST",
        body: JSON.stringify(bankData),
      }).then((r) => {
        if (r.success) void syncFromDatabase();
      });
    },

    addDeposit: (depositData) => {
      void apiJson("/api/accounts/banking", {
        method: "POST",
        body: JSON.stringify({ ...depositData, entityType: "deposit" }),
      }).then((r) => {
        if (r.success) void syncFromDatabase();
      });
    },

    addLoan: (loanData) => {
      void apiJson("/api/accounts/banking", {
        method: "POST",
        body: JSON.stringify({ ...loanData, entityType: "loan" }),
      }).then((r) => {
        if (r.success) void syncFromDatabase();
      });
    },

    addLoanPartner: (partnerData) => {
      void apiJson("/api/accounts/banking", {
        method: "POST",
        body: JSON.stringify({ ...partnerData, entityType: "loanPartner" }),
      }).then((r) => {
        if (r.success) void syncFromDatabase();
      });
    },

    addChequeBook: (bookData) => {
      const start = parseInt(bookData.startChequeNumber.replace(/\D/g, ""), 10) || 0;
      const end = parseInt(bookData.endChequeNumber.replace(/\D/g, ""), 10) || 0;
      if (start >= end) {
        return { success: false, message: "End cheque number must be strictly greater than start cheque number." };
      }
      const totalLeaves = end - start + 1;
      void apiJson("/api/accounts/banking", {
        method: "POST",
        body: JSON.stringify({ ...bookData, totalLeaves, entityType: "chequeBook" }),
      }).then((r) => {
        if (r.success) void syncFromDatabase();
      });
      return { success: true, message: `Cheque book ${bookData.bookName} registered with ${totalLeaves} leaves.` };
    },

    updateChequeBook: (id, updates) => {
      void apiJson(`/api/accounts/banking/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ ...updates, entityType: "chequeBook" }),
      }).then((r) => {
        if (r.success) void syncFromDatabase();
      });
      return { success: true, message: "Cheque book updated." };
    },

    issueCheque: (chequeData) => {
      const exists = internalData.cheques.some(
        (c) => c.bankAccountId === chequeData.bankAccountId && c.chequeNumber === chequeData.chequeNumber
      );
      if (exists) {
        return { success: false, message: `Cheque number ${chequeData.chequeNumber} has already been issued for this bank account!` };
      }
      void apiJson("/api/accounts/banking", {
        method: "POST",
        body: JSON.stringify({ ...chequeData, entityType: "chequeIssue" }),
      }).then((r) => {
        if (r.success) void syncFromDatabase();
      });
      return { success: true, message: `Cheque ${chequeData.chequeNumber} issued successfully to ${chequeData.payeeName}.` };
    },

    updateChequeStatus: (id, status, reason) => {
      void apiJson(`/api/accounts/banking/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status, cancellationReason: reason, entityType: "chequeIssue" }),
      }).then((r) => {
        if (r.success) void syncFromDatabase();
      });
    },

    addReceivedCheque: (chqData) => {
      void apiJson("/api/accounts/banking", {
        method: "POST",
        body: JSON.stringify({ ...chqData, entityType: "receivedCheque" }),
      }).then((r) => {
        if (r.success) void syncFromDatabase();
      });
      return { success: true, message: `Cheque ${chqData.chequeNumber} recorded.` };
    },

    updateReceivedChequeStatus: (id, depositStatus, depositDate) => {
      void apiJson(`/api/accounts/banking/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ depositStatus, depositDate, entityType: "receivedCheque" }),
      }).then((r) => {
        if (r.success) void syncFromDatabase();
      });
    },

    createBudget: (budgetData) => {
      void apiJson("/api/accounts/budget", {
        method: "POST",
        body: JSON.stringify(budgetData),
      }).then((r) => {
        if (r.success) void syncFromDatabase();
      });
    },

    updateBudget: (id, updates) => {
      void apiJson(`/api/accounts/budget/${id}`, {
        method: "PUT",
        body: JSON.stringify(updates),
      }).then((r) => {
        if (r.success) void syncFromDatabase();
      });
    },

    updateBudgetRevision: (id, revisedAmount) => {
      void apiJson(`/api/accounts/budget/${id}`, {
        method: "PUT",
        body: JSON.stringify({ revisedAmount }),
      }).then((r) => {
        if (r.success) void syncFromDatabase();
      });
    },

    deleteBudget: (id) => {
      void apiJson(`/api/accounts/budget/${id}`, {
        method: "DELETE",
      }).then((r) => {
        if (r.success) void syncFromDatabase();
      });
    },

    addCostCenter: (centerData) => {
      void apiJson("/api/accounts/cost-centers", {
        method: "POST",
        body: JSON.stringify(centerData),
      }).then((r) => {
        if (r.success) void syncFromDatabase();
      });
    },

    updateCostCenter: (id, updates) => {
      void apiJson(`/api/accounts/cost-centers/${id}`, {
        method: "PATCH",
        body: JSON.stringify(updates),
      }).then((r) => {
        if (r.success) void syncFromDatabase();
      });
    },

    getDashboardKPIs: () => {
      const accounts = internalData.accounts.filter((a) => !a.isGroup);
      const vouchers = internalData.vouchers;
      const expenses = internalData.expenses;
      const transfers = internalData.transfers;
      const cheques = internalData.cheques;
      const budgets = internalData.budgets;

      const sumMatch = (fn: (a: AccountItem) => boolean) =>
        accounts.filter(fn).reduce((sum, a) => sum + Number(a.currentBalance || 0), 0);

      const accountsReceivable = sumMatch(
        (a) => a.accountType === "ASSET" && (a.code === "1210" || a.code.startsWith("102") || a.name.toLowerCase().includes("receivable"))
      );
      const accountsPayable = sumMatch(
        (a) => a.accountType === "LIABILITY" && (a.code === "2110" || a.code.startsWith("301") || a.name.toLowerCase().includes("payable"))
      );
      const cashInHand = sumMatch(
        (a) => a.accountType === "ASSET" && (a.code === "1110" || a.code.startsWith("10101") || a.name.toLowerCase().includes("cash in hand"))
      );
      const cashAtBank = sumMatch(
        (a) => a.accountType === "ASSET" && (a.code === "1120" || a.code.startsWith("10102") || a.name.toLowerCase().includes("bank"))
      );

      const totalIncome = sumMatch((a) => a.accountType === "REVENUE");
      const totalExpenses = sumMatch((a) => a.accountType === "EXPENSE");

      const openingCashAndBank = accounts
        .filter((a) => a.accountType === "ASSET" && (a.code === "1110" || a.code === "1120" || a.code.startsWith("101")))
        .reduce((sum, a) => sum + Number(a.openingBalance || 0), 0);

      const closingCashAndBank = cashInHand + cashAtBank;
      const postedVouchers = vouchers.filter((v) => v.status === "POSTED");
      let totalReceipts = 0;
      let totalPayments = 0;
      const cashAccountIds = new Set(
        accounts
          .filter((a) => a.accountType === "ASSET" && (a.code === "1110" || a.code === "1120" || a.code.startsWith("101")))
          .map((a) => a.id)
      );

      for (const v of postedVouchers) {
        for (const l of v.lines) {
          if (cashAccountIds.has(l.accountId)) {
            if (l.debit > 0) totalReceipts += l.debit;
            if (l.credit > 0) totalPayments += l.credit;
          }
        }
      }

      const totalAllocatedBudget = budgets.reduce((sum, b) => sum + (b.revisedAmount || b.allocatedAmount), 0);
      const totalUtilizedBudget = budgets.reduce((sum, b) => sum + b.utilizedAmount, 0);

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
        currentPeriodProfitLoss: totalIncome - totalExpenses,
        pendingJournalVouchers: vouchers.filter((v) => v.status === "PENDING" || v.status === "DRAFT").length,
        pendingExpenseApprovals: expenses.filter((e) => e.status === "PENDING").length,
        pendingFundTransfers: transfers.filter((t) => t.status === "PENDING_APPROVAL" || t.status === "IN_TRANSIT").length,
        outstandingCheques: cheques.filter((c) => c.status === "ISSUED" || c.status === "POST_DATED").length,
        budgetUtilization: totalAllocatedBudget > 0 ? (totalUtilizedBudget / totalAllocatedBudget) * 100 : 0,
      };
    },

    getGeneralLedger: (accountId, fromDate, toDate) => {
      const vouchers = internalData.vouchers.filter((v) => v.status === "POSTED");
      const entries: GeneralLedgerEntry[] = [];
      let runningBalance = 0;

      const sortedVouchers = [...vouchers].sort(
        (a, b) => new Date(a.transactionDate).getTime() - new Date(b.transactionDate).getTime()
      );

      for (const v of sortedVouchers) {
        if (fromDate && v.transactionDate < fromDate) continue;
        if (toDate && v.transactionDate > toDate) continue;

        for (const line of v.lines) {
          if (accountId && line.accountId !== accountId && line.accountCode !== accountId) continue;
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
        const bal = Number(a.currentBalance || 0);
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
        rows.push({ code: a.code, name: a.name, type: a.accountType, debit, credit });
      }

      return { rows, totalDebit, totalCredit, isBalanced: Math.abs(totalDebit - totalCredit) < 0.05 };
    },

    getProfitAndLoss: () => {
      const revenues = internalData.accounts
        .filter((a) => a.accountType === "REVENUE" && !a.isGroup)
        .map((a) => ({ name: a.name, amount: Number(a.currentBalance || 0) }));
      const expenses = internalData.accounts
        .filter((a) => a.accountType === "EXPENSE" && !a.isGroup)
        .map((a) => ({ name: a.name, amount: Number(a.currentBalance || 0) }));

      const totalRevenue = revenues.reduce((sum, r) => sum + r.amount, 0);
      const totalExpense = expenses.reduce((sum, e) => sum + e.amount, 0);
      return { revenues, expenses, totalRevenue, totalExpense, netProfit: totalRevenue - totalExpense };
    },

    getBalanceSheet: () => {
      const assets = internalData.accounts
        .filter((a) => a.accountType === "ASSET" && !a.isGroup)
        .map((a) => ({ name: a.name, amount: Number(a.currentBalance || 0) }));
      const liabilities = internalData.accounts
        .filter((a) => a.accountType === "LIABILITY" && !a.isGroup)
        .map((a) => ({ name: a.name, amount: Number(a.currentBalance || 0) }));
      const equity = internalData.accounts
        .filter((a) => a.accountType === "EQUITY" && !a.isGroup)
        .map((a) => ({ name: a.name, amount: Number(a.currentBalance || 0) }));

      const totalAssets = assets.reduce((sum, a) => sum + a.amount, 0);
      const totalLiabilities = liabilities.reduce((sum, l) => sum + l.amount, 0);
      const totalEquity = equity.reduce((sum, e) => sum + e.amount, 0);
      const { netProfit } = getFullState().getProfitAndLoss();
      const totalLiabilitiesAndEquity = totalLiabilities + totalEquity + netProfit;

      return {
        assets,
        liabilities,
        equity: [...equity, { name: "Current Period Profit / (Loss)", amount: netProfit }],
        totalAssets,
        totalLiabilities,
        totalEquity: totalEquity + netProfit,
        isBalanced: Math.abs(totalAssets - totalLiabilitiesAndEquity) < 1,
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
  if (selector) return selector(state);
  return state as unknown as T;
}

useAccountingStore.getState = getSnapshot;
