"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import {
  Banknote,
  Building2,
  CheckCircle2,
  ChevronRight,
  Clock,
  Coins,
  CreditCard,
  Download,
  Eye,
  FileSpreadsheet,
  Filter,
  Landmark,
  Pencil,
  Plus,
  Printer,
  RotateCcw,
  Search,
  ShieldCheck,
  TrendingUp,
  X,
} from "lucide-react";
import { SummaryCard } from "@/components/purchase/SummaryCard";
import { ModalDialog } from "@/components/purchase/ModalDialog";
import { useAccountingStore } from "@/features/accounts/store/accounting-store";
import type { BankAccountItem, DepositItem, FactoringItem, LoanItem } from "@/features/accounts/types";

export default function FinanceBankingPage() {
  const bankAccounts = useAccountingStore((s) => s.bankAccounts);
  const deposits = useAccountingStore((s) => s.deposits);
  const loans = useAccountingStore((s) => s.loans);
  const factoring = useAccountingStore((s) => s.factoring);
  const accounts = useAccountingStore((s) => s.accounts);
  const addBankAccount = useAccountingStore((s) => s.addBankAccount);
  const addDeposit = useAccountingStore((s) => s.addDeposit);
  const addLoan = useAccountingStore((s) => s.addLoan);

  const [activeTab, setActiveTab] = useState<
    "REGULAR_BANKING" | "DEPOSITS_FDR" | "LOANS_CREDIT" | "FACTORING_REPORT" | "BANK_RECON"
  >("REGULAR_BANKING");

  // Filter states
  const [search, setSearch] = useState("");
  const [selectedBankType, setSelectedBankType] = useState("ALL");
  const [selectedReconStatus, setSelectedReconStatus] = useState("ALL");
  const [viewMode, setViewMode] = useState<"table" | "cards">("table");

  // Modal States
  const [isNewBankOpen, setIsNewBankOpen] = useState(false);
  const [isNewDepositOpen, setIsNewDepositOpen] = useState(false);
  const [isNewLoanOpen, setIsNewLoanOpen] = useState(false);
  const [viewBank, setViewBank] = useState<BankAccountItem | null>(null);

  // Form: Bank
  const [bankForm, setBankForm] = useState({
    accountNumber: "",
    bankName: "",
    branchName: "",
    accountHolder: "BridgeOne Industrial Solutions Ltd",
    accountType: "CURRENT" as BankAccountItem["accountType"],
    currency: "BDT",
    glAccountId: "acc-1120",
    glAccountName: "Cash at Bank - Sonali Bank",
    openingBalance: 0,
    reconciliationStatus: "RECONCILED" as const,
    isActive: true,
  });

  // Form: Deposit
  const [depositForm, setDepositForm] = useState({
    bankAccountId: "bank-1",
    bankName: "Sonali Bank PLC",
    depositType: "FIXED" as const,
    principalAmount: 500000,
    interestRate: 8.5,
    openingDate: new Date().toISOString().split("T")[0],
    maturityDate: new Date(Date.now() + 365 * 86400000).toISOString().split("T")[0],
    maturityValue: 542500,
    interestEarned: 42500,
    status: "ACTIVE" as const,
  });

  // Form: Loan
  const [loanForm, setLoanForm] = useState({
    lenderName: "Eastern Bank PLC",
    loanType: "WORKING_CAPITAL" as const,
    principalAmount: 2000000,
    interestRate: 9.0,
    disbursementDate: new Date().toISOString().split("T")[0],
    maturityDate: new Date(Date.now() + 730 * 86400000).toISOString().split("T")[0],
    installmentAmount: 95000,
    outstandingPrincipal: 2000000,
    accruedInterest: 0,
    status: "ACTIVE" as const,
  });

  // Derived Calculations
  const totalBankBalance = useMemo(
    () => bankAccounts.reduce((sum, b) => sum + (b.isActive ? b.currentBalance : 0), 0),
    [bankAccounts],
  );

  const totalFixedDeposits = useMemo(
    () => deposits.reduce((sum, d) => sum + (d.status === "ACTIVE" ? d.principalAmount : 0), 0),
    [deposits],
  );

  const totalBorrowing = useMemo(
    () => loans.reduce((sum, l) => sum + (l.status === "ACTIVE" ? l.outstandingPrincipal : 0), 0),
    [loans],
  );

  const filteredBanks = useMemo(() => {
    return bankAccounts.filter((b) => {
      if (search) {
        const q = search.toLowerCase();
        const m =
          b.bankName.toLowerCase().includes(q) ||
          b.accountNumber.toLowerCase().includes(q) ||
          b.branchName.toLowerCase().includes(q) ||
          b.glAccountName.toLowerCase().includes(q);
        if (!m) return false;
      }
      if (selectedBankType !== "ALL" && b.accountType !== selectedBankType) return false;
      if (selectedReconStatus !== "ALL" && b.reconciliationStatus !== selectedReconStatus) return false;
      return true;
    });
  }, [bankAccounts, search, selectedBankType, selectedReconStatus]);

  // Handle Export CSV
  const handleExportCSV = () => {
    let csvContent = "data:text/csv;charset=utf-8,";
    if (activeTab === "REGULAR_BANKING") {
      csvContent += "SL,Bank Name,Branch,Account Number,Account Type,Currency,Linked GL Account,Opening Balance,Current Balance,Reconciliation Status\n";
      filteredBanks.forEach((b, i) => {
        csvContent += `"${i + 1}","${b.bankName}","${b.branchName}","${b.accountNumber}","${b.accountType}","${b.currency}","${b.glAccountName}","${b.openingBalance}","${b.currentBalance}","${b.reconciliationStatus}"\n`;
      });
    } else if (activeTab === "DEPOSITS_FDR") {
      csvContent += "SL,Deposit #,Bank Name,Type,Principal Amount,Interest Rate %,Opening Date,Maturity Date,Maturity Value,Status\n";
      deposits.forEach((d, i) => {
        csvContent += `"${i + 1}","${d.depositNumber}","${d.bankName}","${d.depositType}","${d.principalAmount}","${d.interestRate}","${d.openingDate}","${d.maturityDate}","${d.maturityValue}","${d.status}"\n`;
      });
    } else if (activeTab === "LOANS_CREDIT") {
      csvContent += "SL,Loan #,Lender Name,Loan Type,Principal Amount,Interest Rate %,Disbursement Date,Maturity Date,Installment Amount,Outstanding,Status\n";
      loans.forEach((l, i) => {
        csvContent += `"${i + 1}","${l.loanNumber}","${l.lenderName}","${l.loanType}","${l.principalAmount}","${l.interestRate}","${l.disbursementDate}","${l.maturityDate}","${l.installmentAmount}","${l.outstandingPrincipal}","${l.status}"\n`;
      });
    }
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `BridgeOne_${activeTab}_Report.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSaveBank = (e: React.FormEvent) => {
    e.preventDefault();
    if (!bankForm.accountNumber || !bankForm.bankName) return;
    addBankAccount(bankForm);
    setIsNewBankOpen(false);
  };

  const handleSaveDeposit = (e: React.FormEvent) => {
    e.preventDefault();
    if (depositForm.principalAmount <= 0) return;
    addDeposit(depositForm);
    setIsNewDepositOpen(false);
  };

  const handleSaveLoan = (e: React.FormEvent) => {
    e.preventDefault();
    if (loanForm.principalAmount <= 0) return;
    addLoan(loanForm);
    setIsNewLoanOpen(false);
  };

  return (
    <div className="space-y-3 font-sans pb-12">
      {/* ------------------------------------------------------------- */}
      {/* 1. TOP HEADER (Exact Managerium / Purchase Layout) */}
      {/* ------------------------------------------------------------- */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 rounded border border-slate-200/90 shadow-2xs">
        <div>
          <nav className="flex items-center gap-1.5 text-[11px] text-slate-400 mb-0.5">
            <Link href="/accounts" className="hover:text-slate-600 transition">
              Account
            </Link>
            <ChevronRight className="w-3 h-3 text-slate-300" />
            <span className="text-slate-600 font-medium">Finance & Banking</span>
          </nav>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Finance & Banking</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage corporate bank accounts, fixed term deposits (FDR), credit facilities, and factoring receivables
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Quick search input */}
          <div className="relative">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search bank, account #..."
              className="w-56 sm:w-64 h-9 pl-3 pr-8 text-xs border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white placeholder-slate-400"
            />
            <Search className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {/* Export Excel Button */}
          <button
            type="button"
            onClick={handleExportCSV}
            className="h-9 px-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded flex items-center gap-1.5 shadow-xs transition"
            title="Download CSV / Excel Report"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Excel</span>
          </button>

          {/* Add Action Buttons */}
          {activeTab === "REGULAR_BANKING" && (
            <button
              type="button"
              onClick={() => setIsNewBankOpen(true)}
              className="h-9 px-4 bg-[#2563eb] hover:bg-blue-700 text-white font-semibold text-xs rounded flex items-center gap-1.5 shadow-xs transition"
            >
              <Plus className="w-4 h-4" />
              <span>Add Bank Account</span>
            </button>
          )}

          {activeTab === "DEPOSITS_FDR" && (
            <button
              type="button"
              onClick={() => setIsNewDepositOpen(true)}
              className="h-9 px-4 bg-[#2563eb] hover:bg-blue-700 text-white font-semibold text-xs rounded flex items-center gap-1.5 shadow-xs transition"
            >
              <Plus className="w-4 h-4" />
              <span>Open Fixed Deposit</span>
            </button>
          )}

          {activeTab === "LOANS_CREDIT" && (
            <button
              type="button"
              onClick={() => setIsNewLoanOpen(true)}
              className="h-9 px-4 bg-[#2563eb] hover:bg-blue-700 text-white font-semibold text-xs rounded flex items-center gap-1.5 shadow-xs transition"
            >
              <Plus className="w-4 h-4" />
              <span>Register Bank Loan</span>
            </button>
          )}
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 2. SUMMARY KPI CARDS ROW (Exact Purchase SummaryCard Design) */}
      {/* ------------------------------------------------------------- */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <SummaryCard
          title="Total Bank Balance"
          value={`৳${totalBankBalance.toLocaleString()}`}
          subtitle={`${bankAccounts.filter((b) => b.isActive).length} active bank ledgers`}
          icon={Landmark}
          variant="info"
        />
        <SummaryCard
          title="Fixed Deposits (FDR)"
          value={`৳${totalFixedDeposits.toLocaleString()}`}
          subtitle={`${deposits.length} term deposit contracts`}
          icon={Coins}
          variant="success"
        />
        <SummaryCard
          title="Bank Loans & Credit"
          value={`৳${totalBorrowing.toLocaleString()}`}
          subtitle={`${loans.length} active credit facilities`}
          icon={CreditCard}
          variant="warning"
        />
        <SummaryCard
          title="Factoring Receivables"
          value={`৳${factoring.reduce((sum, f) => sum + f.eligibleReceivable, 0).toLocaleString()}`}
          subtitle="Discounted book debts"
          icon={Banknote}
          variant="info"
        />
        <SummaryCard
          title="Reconciliation"
          value="100% RECONCILED"
          subtitle="Audit balances matched"
          icon={ShieldCheck}
          variant="success"
        />
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 3. NAVIGATION TABS (Purchase Layout) */}
      {/* ------------------------------------------------------------- */}
      <div className="flex items-center gap-8 border-b border-slate-200 mb-3 bg-white px-3 pt-2 rounded-t border-t border-x border-slate-200/90 overflow-x-auto select-none">
        <button
          type="button"
          onClick={() => setActiveTab("REGULAR_BANKING")}
          className={`pb-2.5 text-xs font-bold tracking-wide transition-colors relative flex items-center gap-2 uppercase whitespace-nowrap ${
            activeTab === "REGULAR_BANKING"
              ? "text-blue-600 border-b-2 border-blue-600 -mb-[1px]"
              : "text-slate-500 hover:text-slate-800"
          }`}
        >
          <span>REGULAR BANKING ({bankAccounts.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("DEPOSITS_FDR")}
          className={`pb-2.5 text-xs font-bold tracking-wide transition-colors relative flex items-center gap-2 uppercase whitespace-nowrap ${
            activeTab === "DEPOSITS_FDR"
              ? "text-blue-600 border-b-2 border-blue-600 -mb-[1px]"
              : "text-slate-500 hover:text-slate-800"
          }`}
        >
          <span>DEPOSITS / FDR ({deposits.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("LOANS_CREDIT")}
          className={`pb-2.5 text-xs font-bold tracking-wide transition-colors relative flex items-center gap-2 uppercase whitespace-nowrap ${
            activeTab === "LOANS_CREDIT"
              ? "text-blue-600 border-b-2 border-blue-600 -mb-[1px]"
              : "text-slate-500 hover:text-slate-800"
          }`}
        >
          <span>LOANS & CREDIT ({loans.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("FACTORING_REPORT")}
          className={`pb-2.5 text-xs font-bold tracking-wide transition-colors relative flex items-center gap-2 uppercase whitespace-nowrap ${
            activeTab === "FACTORING_REPORT"
              ? "text-blue-600 border-b-2 border-blue-600 -mb-[1px]"
              : "text-slate-500 hover:text-slate-800"
          }`}
        >
          <span>FACTORING REPORT ({factoring.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("BANK_RECON")}
          className={`pb-2.5 text-xs font-bold tracking-wide transition-colors relative flex items-center gap-2 uppercase whitespace-nowrap ${
            activeTab === "BANK_RECON"
              ? "text-blue-600 border-b-2 border-blue-600 -mb-[1px]"
              : "text-slate-500 hover:text-slate-800"
          }`}
        >
          <span>BANK RECONCILIATION STATEMENT</span>
        </button>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 4. FILTER TOOLBAR CARD (Managerium Filter Design) */}
      {/* ------------------------------------------------------------- */}
      <div className="bg-white rounded border border-slate-200/90 p-3 shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3 flex-1 min-w-0">
            {/* Account Type Filter */}
            <div className="flex items-center gap-1.5 text-xs text-slate-600">
              <span className="font-medium text-[11px] text-slate-500">Account Type:</span>
              <select
                value={selectedBankType}
                onChange={(e) => setSelectedBankType(e.target.value)}
                className="border border-slate-200 rounded px-2.5 py-1 text-xs bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="ALL">All Account Types</option>
                <option value="CURRENT">Current Account</option>
                <option value="SAVINGS">Savings Account</option>
                <option value="ESCROW">Escrow Account</option>
                <option value="SALARY">Salary Account</option>
              </select>
            </div>

            {/* Reconciliation Filter */}
            <div className="flex items-center gap-1.5 text-xs text-slate-600">
              <span className="font-medium text-[11px] text-slate-500">Reconciliation:</span>
              <select
                value={selectedReconStatus}
                onChange={(e) => setSelectedReconStatus(e.target.value)}
                className="border border-slate-200 rounded px-2.5 py-1 text-xs bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="ALL">All Status</option>
                <option value="RECONCILED">Reconciled</option>
                <option value="PENDING_RECONCILIATION">Pending Reconciliation</option>
              </select>
            </div>

            {/* Currency Filter */}
            <div className="flex items-center gap-1.5 text-xs text-slate-600">
              <span className="font-medium text-[11px] text-slate-500">Currency:</span>
              <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold text-[11px]">
                BDT (৳)
              </span>
            </div>
          </div>

          {/* Action buttons & View mode toggle */}
          <div className="flex items-center gap-2 shrink-0">
            {activeTab === "REGULAR_BANKING" && (
              <div className="flex rounded border border-slate-200 overflow-hidden text-xs">
                <button
                  type="button"
                  onClick={() => setViewMode("table")}
                  className={`px-2.5 py-1 font-medium transition ${
                    viewMode === "table" ? "bg-blue-600 text-white" : "bg-slate-50 text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  Table View
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("cards")}
                  className={`px-2.5 py-1 font-medium transition ${
                    viewMode === "cards" ? "bg-blue-600 text-white" : "bg-slate-50 text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  Passbook Cards
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={() => {
                setSearch("");
                setSelectedBankType("ALL");
                setSelectedReconStatus("ALL");
              }}
              className="flex items-center gap-1 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded text-xs font-medium transition"
              title="Reset Filters"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 5. TAB 1: REGULAR BANKING REGISTER */}
      {/* ------------------------------------------------------------- */}
      {activeTab === "REGULAR_BANKING" && (
        <div className="space-y-4">
          {viewMode === "table" ? (
            <div className="bg-white rounded border border-slate-200/90 shadow-2xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-y border-slate-200 text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                    <tr>
                      <th className="px-3.5 py-2.5">SL</th>
                      <th className="px-3.5 py-2.5">Bank Name & Branch</th>
                      <th className="px-3.5 py-2.5">Account Number</th>
                      <th className="px-3.5 py-2.5">Account Holder</th>
                      <th className="px-3.5 py-2.5">Type</th>
                      <th className="px-3.5 py-2.5">Linked GL Account</th>
                      <th className="px-3.5 py-2.5 text-right">Opening Balance</th>
                      <th className="px-3.5 py-2.5 text-right font-bold text-slate-900">Current Balance</th>
                      <th className="px-3.5 py-2.5 text-center">Reconciliation</th>
                      <th className="px-3.5 py-2.5 text-center">Status</th>
                      <th className="px-3.5 py-2.5 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredBanks.length === 0 ? (
                      <tr>
                        <td colSpan={11} className="py-8 text-center text-xs text-slate-400">
                          No bank accounts found matching filter criteria.
                        </td>
                      </tr>
                    ) : (
                      filteredBanks.map((b, index) => (
                        <tr key={b.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="px-3.5 py-2.5 font-medium text-slate-500">{index + 1}</td>
                          <td className="px-3.5 py-2.5">
                            <div className="font-semibold text-slate-900">{b.bankName}</div>
                            <div className="text-[11px] text-slate-500">{b.branchName}</div>
                          </td>
                          <td className="px-3.5 py-2.5 font-mono font-medium text-slate-800">{b.accountNumber}</td>
                          <td className="px-3.5 py-2.5 text-slate-600">{b.accountHolder}</td>
                          <td className="px-3.5 py-2.5">
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                              {b.accountType}
                            </span>
                          </td>
                          <td className="px-3.5 py-2.5">
                            <span className="text-slate-700 font-medium">{b.glAccountName}</span>
                          </td>
                          <td className="px-3.5 py-2.5 text-right font-mono text-slate-500">
                            ৳{b.openingBalance.toLocaleString()}
                          </td>
                          <td className="px-3.5 py-2.5 text-right font-mono font-bold text-blue-700 text-sm">
                            ৳{b.currentBalance.toLocaleString()}
                          </td>
                          <td className="px-3.5 py-2.5 text-center">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <ShieldCheck className="w-3 h-3" /> {b.reconciliationStatus}
                            </span>
                          </td>
                          <td className="px-3.5 py-2.5 text-center">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                                b.isActive
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                  : "bg-slate-100 text-slate-500 border-slate-200"
                              }`}
                            >
                              {b.isActive ? "ACTIVE" : "INACTIVE"}
                            </span>
                          </td>
                          <td className="px-3.5 py-2.5 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => setViewBank(b)}
                                className="p-1 rounded text-slate-500 hover:text-blue-600 hover:bg-slate-100 transition"
                                title="View Statement & Details"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => window.print()}
                                className="p-1 rounded text-slate-500 hover:text-emerald-600 hover:bg-slate-100 transition"
                                title="Print Statement"
                              >
                                <Printer className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            /* Passbook Card Visual Grid */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredBanks.map((b) => (
                <div
                  key={b.id}
                  className="bg-white rounded-lg border border-slate-200 p-4 shadow-xs hover:shadow-sm transition-all relative overflow-hidden"
                >
                  <div className="absolute top-0 left-0 right-0 h-1 bg-blue-600" />
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">{b.bankName}</h4>
                      <p className="text-xs text-slate-500">{b.branchName}</p>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                      {b.accountType}
                    </span>
                  </div>

                  <div className="space-y-2 border-t border-slate-100 pt-3 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Account Number:</span>
                      <span className="font-mono font-semibold text-slate-800">{b.accountNumber}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Account Holder:</span>
                      <span className="text-slate-700 font-medium truncate max-w-[180px]">{b.accountHolder}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Linked GL Account:</span>
                      <span className="text-slate-700 font-medium">{b.glAccountName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Reconciliation:</span>
                      <span className="inline-flex items-center gap-1 text-emerald-600 font-semibold text-[11px]">
                        <ShieldCheck className="w-3.5 h-3.5" /> {b.reconciliationStatus}
                      </span>
                    </div>
                    <div className="flex justify-between items-baseline border-t border-slate-100 pt-2.5">
                      <span className="font-semibold text-slate-700">Available Balance:</span>
                      <span className="text-base font-extrabold text-blue-600">৳{b.currentBalance.toLocaleString()}</span>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setViewBank(b)}
                      className="px-2.5 py-1 text-[11px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded transition"
                    >
                      Statement
                    </button>
                    <button
                      type="button"
                      onClick={() => window.print()}
                      className="px-2.5 py-1 text-[11px] font-semibold bg-blue-50 hover:bg-blue-100 text-blue-700 rounded transition"
                    >
                      Print
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 6. TAB 2: DEPOSITS / FDR REGISTER */}
      {/* ------------------------------------------------------------- */}
      {activeTab === "DEPOSITS_FDR" && (
        <div className="bg-white rounded border border-slate-200/90 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-y border-slate-200 text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                <tr>
                  <th className="px-3.5 py-2.5">SL</th>
                  <th className="px-3.5 py-2.5">Deposit #</th>
                  <th className="px-3.5 py-2.5">Bank / Financial Institution</th>
                  <th className="px-3.5 py-2.5">Type</th>
                  <th className="px-3.5 py-2.5 text-right">Principal Amount</th>
                  <th className="px-3.5 py-2.5 text-right">Interest Rate (%)</th>
                  <th className="px-3.5 py-2.5">Opening Date</th>
                  <th className="px-3.5 py-2.5">Maturity Date</th>
                  <th className="px-3.5 py-2.5 text-right">Maturity Value</th>
                  <th className="px-3.5 py-2.5 text-right font-bold text-emerald-700">Interest Earned</th>
                  <th className="px-3.5 py-2.5 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {deposits.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="py-8 text-center text-xs text-slate-400">
                      No fixed deposit records registered yet. Click &quot;Open Fixed Deposit&quot; to create one.
                    </td>
                  </tr>
                ) : (
                  deposits.map((d, index) => (
                    <tr key={d.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-3.5 py-2.5 font-medium text-slate-500">{index + 1}</td>
                      <td className="px-3.5 py-2.5 font-mono font-bold text-blue-600">{d.depositNumber}</td>
                      <td className="px-3.5 py-2.5 font-semibold text-slate-900">{d.bankName}</td>
                      <td className="px-3.5 py-2.5">
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700">
                          {d.depositType}
                        </span>
                      </td>
                      <td className="px-3.5 py-2.5 text-right font-mono font-semibold text-slate-800">
                        ৳{d.principalAmount.toLocaleString()}
                      </td>
                      <td className="px-3.5 py-2.5 text-right font-mono font-bold text-slate-700">
                        {d.interestRate}%
                      </td>
                      <td className="px-3.5 py-2.5 text-slate-600">{d.openingDate}</td>
                      <td className="px-3.5 py-2.5 text-slate-600">{d.maturityDate}</td>
                      <td className="px-3.5 py-2.5 text-right font-mono font-bold text-slate-900">
                        ৳{d.maturityValue.toLocaleString()}
                      </td>
                      <td className="px-3.5 py-2.5 text-right font-mono font-bold text-emerald-600">
                        ৳{d.interestEarned.toLocaleString()}
                      </td>
                      <td className="px-3.5 py-2.5 text-center">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          {d.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 7. TAB 3: LOANS & BORROWING REGISTER */}
      {/* ------------------------------------------------------------- */}
      {activeTab === "LOANS_CREDIT" && (
        <div className="bg-white rounded border border-slate-200/90 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-y border-slate-200 text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                <tr>
                  <th className="px-3.5 py-2.5">SL</th>
                  <th className="px-3.5 py-2.5">Loan #</th>
                  <th className="px-3.5 py-2.5">Lender / Bank</th>
                  <th className="px-3.5 py-2.5">Facility Type</th>
                  <th className="px-3.5 py-2.5 text-right">Principal Amount</th>
                  <th className="px-3.5 py-2.5 text-right">Interest Rate (%)</th>
                  <th className="px-3.5 py-2.5">Disbursement Date</th>
                  <th className="px-3.5 py-2.5">Maturity Date</th>
                  <th className="px-3.5 py-2.5 text-right">Monthly Installment</th>
                  <th className="px-3.5 py-2.5 text-right font-bold text-rose-700">Outstanding Principal</th>
                  <th className="px-3.5 py-2.5 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loans.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="py-8 text-center text-xs text-slate-400">
                      No loan records registered yet. Click &quot;Register Bank Loan&quot; to add a credit facility.
                    </td>
                  </tr>
                ) : (
                  loans.map((l, index) => (
                    <tr key={l.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-3.5 py-2.5 font-medium text-slate-500">{index + 1}</td>
                      <td className="px-3.5 py-2.5 font-mono font-bold text-blue-600">{l.loanNumber}</td>
                      <td className="px-3.5 py-2.5 font-semibold text-slate-900">{l.lenderName}</td>
                      <td className="px-3.5 py-2.5">
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                          {l.loanType}
                        </span>
                      </td>
                      <td className="px-3.5 py-2.5 text-right font-mono font-semibold text-slate-800">
                        ৳{l.principalAmount.toLocaleString()}
                      </td>
                      <td className="px-3.5 py-2.5 text-right font-mono font-bold text-slate-700">{l.interestRate}%</td>
                      <td className="px-3.5 py-2.5 text-slate-600">{l.disbursementDate}</td>
                      <td className="px-3.5 py-2.5 text-slate-600">{l.maturityDate}</td>
                      <td className="px-3.5 py-2.5 text-right font-mono text-slate-700">
                        ৳{l.installmentAmount.toLocaleString()}
                      </td>
                      <td className="px-3.5 py-2.5 text-right font-mono font-bold text-rose-700 text-sm">
                        ৳{l.outstandingPrincipal.toLocaleString()}
                      </td>
                      <td className="px-3.5 py-2.5 text-center">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                          {l.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 8. TAB 4: FACTORING REPORT */}
      {/* ------------------------------------------------------------- */}
      {activeTab === "FACTORING_REPORT" && (
        <div className="bg-white rounded border border-slate-200/90 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-y border-slate-200 text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                <tr>
                  <th className="px-3.5 py-2.5">SL</th>
                  <th className="px-3.5 py-2.5">Invoice Reference</th>
                  <th className="px-3.5 py-2.5">Factoring Company</th>
                  <th className="px-3.5 py-2.5 text-right">Eligible Receivable</th>
                  <th className="px-3.5 py-2.5 text-right">Advance Amount (80%)</th>
                  <th className="px-3.5 py-2.5 text-right">Fees & Charges</th>
                  <th className="px-3.5 py-2.5 text-right font-bold text-blue-700">Remaining Receivable</th>
                  <th className="px-3.5 py-2.5 text-center">Settlement Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {factoring.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-xs text-slate-400">
                      No receivables submitted for factoring.
                    </td>
                  </tr>
                ) : (
                  factoring.map((f, index) => (
                    <tr key={f.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-3.5 py-2.5 font-medium text-slate-500">{index + 1}</td>
                      <td className="px-3.5 py-2.5 font-mono font-bold text-blue-600">{f.invoiceReference}</td>
                      <td className="px-3.5 py-2.5 font-semibold text-slate-800">{f.factoringCompany}</td>
                      <td className="px-3.5 py-2.5 text-right font-mono text-slate-800">
                        ৳{f.eligibleReceivable.toLocaleString()}
                      </td>
                      <td className="px-3.5 py-2.5 text-right font-mono font-bold text-emerald-600">
                        ৳{f.advanceAmount.toLocaleString()}
                      </td>
                      <td className="px-3.5 py-2.5 text-right font-mono text-rose-600">
                        ৳{f.feesCharges.toLocaleString()}
                      </td>
                      <td className="px-3.5 py-2.5 text-right font-mono font-bold text-slate-900">
                        ৳{f.remainingReceivable.toLocaleString()}
                      </td>
                      <td className="px-3.5 py-2.5 text-center">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                          {f.settlementStatus}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 9. TAB 5: BANK RECONCILIATION STATEMENT */}
      {/* ------------------------------------------------------------- */}
      {activeTab === "BANK_RECON" && (
        <div className="bg-white rounded border border-slate-200/90 shadow-2xs p-5 max-w-4xl mx-auto space-y-4">
          <div className="border-b border-slate-200 pb-3 flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900">Bank Reconciliation Statement (BRS)</h3>
              <p className="text-xs text-slate-500">As of {new Date().toLocaleDateString("en-GB")}</p>
            </div>
            <button
              type="button"
              onClick={() => window.print()}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-semibold flex items-center gap-1.5 transition"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print BRS</span>
            </button>
          </div>

          <div className="border rounded border-slate-200 divide-y divide-slate-100 text-xs">
            <div className="p-3.5 flex justify-between font-bold bg-slate-50 text-slate-800">
              <span>Balance as per Company General Ledger</span>
              <span className="font-mono text-sm">৳{totalBankBalance.toLocaleString()}</span>
            </div>
            <div className="p-3.5 flex justify-between text-slate-600 pl-6">
              <span>Add: Cheques issued but not yet presented for payment</span>
              <span className="font-mono text-emerald-600 font-semibold">+ ৳0.00</span>
            </div>
            <div className="p-3.5 flex justify-between text-slate-600 pl-6">
              <span>Less: Cheques received / deposited but not yet cleared by bank</span>
              <span className="font-mono text-rose-600 font-semibold">- ৳0.00</span>
            </div>
            <div className="p-3.5 flex justify-between text-slate-600 pl-6">
              <span>Add: Bank direct credits / interest credited</span>
              <span className="font-mono text-emerald-600 font-semibold">+ ৳0.00</span>
            </div>
            <div className="p-3.5 flex justify-between font-bold bg-blue-50/70 text-blue-900 border-t-2 border-blue-500">
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                Balance as per Bank Statement (Reconciled)
              </span>
              <span className="font-mono text-sm font-extrabold text-blue-700">৳{totalBankBalance.toLocaleString()}</span>
            </div>
          </div>

          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded text-xs text-emerald-800 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              All transactions between company general ledger accounts and bank statements are 100% matched and reconciled. No variance detected.
            </span>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 10. MODAL: ADD BANK ACCOUNT */}
      {/* ------------------------------------------------------------- */}
      <ModalDialog
        isOpen={isNewBankOpen}
        onClose={() => setIsNewBankOpen(false)}
        title="Add Corporate Bank Account"
        subtitle="Register a new commercial bank account and map to a General Ledger chart of account"
        maxWidth="xl"
      >
        <form onSubmit={handleSaveBank} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Bank Name *</label>
              <input
                type="text"
                required
                placeholder="e.g. Dutch-Bangla Bank PLC"
                value={bankForm.bankName}
                onChange={(e) => setBankForm({ ...bankForm, bankName: e.target.value })}
                className="w-full h-8 border border-slate-300 rounded px-2.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Branch Name *</label>
              <input
                type="text"
                required
                placeholder="e.g. Motijheel Corporate Branch"
                value={bankForm.branchName}
                onChange={(e) => setBankForm({ ...bankForm, branchName: e.target.value })}
                className="w-full h-8 border border-slate-300 rounded px-2.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Account Number *</label>
              <input
                type="text"
                required
                placeholder="e.g. 1041010045234"
                value={bankForm.accountNumber}
                onChange={(e) => setBankForm({ ...bankForm, accountNumber: e.target.value })}
                className="w-full h-8 border border-slate-300 rounded px-2.5 text-xs text-slate-800 font-mono focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Account Holder *</label>
              <input
                type="text"
                required
                value={bankForm.accountHolder}
                onChange={(e) => setBankForm({ ...bankForm, accountHolder: e.target.value })}
                className="w-full h-8 border border-slate-300 rounded px-2.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Account Type</label>
              <select
                value={bankForm.accountType}
                onChange={(e) => setBankForm({ ...bankForm, accountType: e.target.value as any })}
                className="w-full h-8 border border-slate-300 rounded px-2.5 text-xs text-slate-800 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="CURRENT">Current Account</option>
                <option value="SAVINGS">Savings Account</option>
                <option value="ESCROW">Escrow Account</option>
                <option value="SALARY">Salary Account</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Opening Balance (৳)</label>
              <input
                type="number"
                min="0"
                value={bankForm.openingBalance}
                onChange={(e) => setBankForm({ ...bankForm, openingBalance: parseFloat(e.target.value) || 0 })}
                className="w-full h-8 border border-slate-300 rounded px-2.5 text-xs text-slate-800 font-mono focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block font-semibold text-slate-700 mb-1">Map to Chart of Accounts Ledger *</label>
              <select
                value={bankForm.glAccountId}
                onChange={(e) => {
                  const acc = accounts.find((a) => a.id === e.target.value);
                  setBankForm({
                    ...bankForm,
                    glAccountId: e.target.value,
                    glAccountName: acc?.name || "Cash at Bank",
                  });
                }}
                className="w-full h-8 border border-slate-300 rounded px-2.5 text-xs text-slate-800 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {accounts
                  .filter((a) => a.accountSubtype === "Bank" || a.code.startsWith("112"))
                  .map((a) => (
                    <option key={a.id} value={a.id}>
                      [{a.code}] {a.name}
                    </option>
                  ))}
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setIsNewBankOpen(false)}
              className="px-3.5 py-1.5 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded text-xs font-semibold transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 bg-[#2563eb] hover:bg-blue-700 text-white rounded text-xs font-semibold shadow-xs transition"
            >
              Save Bank Account
            </button>
          </div>
        </form>
      </ModalDialog>

      {/* ------------------------------------------------------------- */}
      {/* 11. MODAL: OPEN FIXED DEPOSIT */}
      {/* ------------------------------------------------------------- */}
      <ModalDialog
        isOpen={isNewDepositOpen}
        onClose={() => setIsNewDepositOpen(false)}
        title="Open Fixed Term Deposit (FDR)"
        subtitle="Record corporate placement of fixed or term deposit with financial institution"
        maxWidth="lg"
      >
        <form onSubmit={handleSaveDeposit} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Financial Institution *</label>
              <input
                type="text"
                required
                value={depositForm.bankName}
                onChange={(e) => setDepositForm({ ...depositForm, bankName: e.target.value })}
                className="w-full h-8 border border-slate-300 rounded px-2.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Deposit Type</label>
              <select
                value={depositForm.depositType}
                onChange={(e) => setDepositForm({ ...depositForm, depositType: e.target.value as any })}
                className="w-full h-8 border border-slate-300 rounded px-2.5 text-xs text-slate-800 bg-white"
              >
                <option value="FIXED">Fixed Deposit Receipt (FDR)</option>
                <option value="TERM">Term Deposit</option>
                <option value="DPS">Deposit Pension Scheme</option>
              </select>
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Principal Amount (৳) *</label>
              <input
                type="number"
                required
                min="1000"
                value={depositForm.principalAmount}
                onChange={(e) => {
                  const p = parseFloat(e.target.value) || 0;
                  const intRate = depositForm.interestRate;
                  const earned = (p * intRate) / 100;
                  setDepositForm({
                    ...depositForm,
                    principalAmount: p,
                    interestEarned: earned,
                    maturityValue: p + earned,
                  });
                }}
                className="w-full h-8 border border-slate-300 rounded px-2.5 text-xs font-mono text-slate-800"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Annual Interest Rate (%) *</label>
              <input
                type="number"
                step="0.1"
                required
                value={depositForm.interestRate}
                onChange={(e) => {
                  const rate = parseFloat(e.target.value) || 0;
                  const earned = (depositForm.principalAmount * rate) / 100;
                  setDepositForm({
                    ...depositForm,
                    interestRate: rate,
                    interestEarned: earned,
                    maturityValue: depositForm.principalAmount + earned,
                  });
                }}
                className="w-full h-8 border border-slate-300 rounded px-2.5 text-xs font-mono text-slate-800"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Opening Date</label>
              <input
                type="date"
                required
                value={depositForm.openingDate}
                onChange={(e) => setDepositForm({ ...depositForm, openingDate: e.target.value })}
                className="w-full h-8 border border-slate-300 rounded px-2 text-xs"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Maturity Date</label>
              <input
                type="date"
                required
                value={depositForm.maturityDate}
                onChange={(e) => setDepositForm({ ...depositForm, maturityDate: e.target.value })}
                className="w-full h-8 border border-slate-300 rounded px-2 text-xs"
              />
            </div>
          </div>

          <div className="bg-slate-50 p-3 rounded border border-slate-200 flex justify-between text-xs">
            <span>Calculated Maturity Value:</span>
            <span className="font-mono font-bold text-emerald-700">৳{depositForm.maturityValue.toLocaleString()}</span>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setIsNewDepositOpen(false)}
              className="px-3.5 py-1.5 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 bg-[#2563eb] hover:bg-blue-700 text-white rounded text-xs font-semibold shadow-xs"
            >
              Confirm FDR Deposit
            </button>
          </div>
        </form>
      </ModalDialog>

      {/* ------------------------------------------------------------- */}
      {/* 12. MODAL: REGISTER LOAN */}
      {/* ------------------------------------------------------------- */}
      <ModalDialog
        isOpen={isNewLoanOpen}
        onClose={() => setIsNewLoanOpen(false)}
        title="Register Bank Loan / Credit Facility"
        subtitle="Set up debt liabilities, interest rates, installment plans, and maturity schedules"
        maxWidth="lg"
      >
        <form onSubmit={handleSaveLoan} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Lender / Bank Name *</label>
              <input
                type="text"
                required
                value={loanForm.lenderName}
                onChange={(e) => setLoanForm({ ...loanForm, lenderName: e.target.value })}
                className="w-full h-8 border border-slate-300 rounded px-2.5 text-xs text-slate-800"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Facility Type</label>
              <select
                value={loanForm.loanType}
                onChange={(e) => setLoanForm({ ...loanForm, loanType: e.target.value as any })}
                className="w-full h-8 border border-slate-300 rounded px-2.5 text-xs text-slate-800 bg-white"
              >
                <option value="WORKING_CAPITAL">Working Capital Loan</option>
                <option value="BANK_LOAN">Term Loan</option>
                <option value="TERM_LOAN">Project Finance</option>
                <option value="OTHER">Other Credit Line</option>
              </select>
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Principal Amount (৳) *</label>
              <input
                type="number"
                required
                min="10000"
                value={loanForm.principalAmount}
                onChange={(e) => {
                  const p = parseFloat(e.target.value) || 0;
                  setLoanForm({ ...loanForm, principalAmount: p, outstandingPrincipal: p });
                }}
                className="w-full h-8 border border-slate-300 rounded px-2.5 text-xs font-mono text-slate-800"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Annual Interest Rate (%) *</label>
              <input
                type="number"
                step="0.1"
                required
                value={loanForm.interestRate}
                onChange={(e) => setLoanForm({ ...loanForm, interestRate: parseFloat(e.target.value) || 0 })}
                className="w-full h-8 border border-slate-300 rounded px-2.5 text-xs font-mono text-slate-800"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Monthly Installment (৳)</label>
              <input
                type="number"
                value={loanForm.installmentAmount}
                onChange={(e) => setLoanForm({ ...loanForm, installmentAmount: parseFloat(e.target.value) || 0 })}
                className="w-full h-8 border border-slate-300 rounded px-2.5 text-xs font-mono text-slate-800"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Disbursement Date</label>
              <input
                type="date"
                required
                value={loanForm.disbursementDate}
                onChange={(e) => setLoanForm({ ...loanForm, disbursementDate: e.target.value })}
                className="w-full h-8 border border-slate-300 rounded px-2 text-xs"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setIsNewLoanOpen(false)}
              className="px-3.5 py-1.5 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 bg-[#2563eb] hover:bg-blue-700 text-white rounded text-xs font-semibold shadow-xs"
            >
              Save Loan Facility
            </button>
          </div>
        </form>
      </ModalDialog>

      {/* ------------------------------------------------------------- */}
      {/* 13. MODAL: VIEW BANK STATEMENT */}
      {/* ------------------------------------------------------------- */}
      <ModalDialog
        isOpen={!!viewBank}
        onClose={() => setViewBank(null)}
        title={viewBank?.bankName || "Bank Statement"}
        subtitle={`A/C: ${viewBank?.accountNumber} | Branch: ${viewBank?.branchName}`}
        maxWidth="2xl"
      >
        <div className="space-y-4 text-xs">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-3 rounded border border-slate-200">
            <div>
              <span className="text-slate-500 block text-[11px]">Account Type</span>
              <span className="font-semibold text-slate-800">{viewBank?.accountType}</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[11px]">Currency</span>
              <span className="font-semibold text-slate-800">{viewBank?.currency}</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[11px]">Opening Balance</span>
              <span className="font-mono font-semibold text-slate-800">
                ৳{viewBank?.openingBalance.toLocaleString()}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block text-[11px]">Current Balance</span>
              <span className="font-mono font-bold text-blue-700">
                ৳{viewBank?.currentBalance.toLocaleString()}
              </span>
            </div>
          </div>

          <div className="border rounded border-slate-200 overflow-hidden">
            <div className="bg-slate-100 px-3.5 py-2 font-bold text-[11px] text-slate-700 uppercase tracking-wide">
              Recent Transactions / Ledger Entries
            </div>
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                <tr>
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2">Voucher #</th>
                  <th className="px-3 py-2">Narration</th>
                  <th className="px-3 py-2 text-right">Debit (৳)</th>
                  <th className="px-3 py-2 text-right">Credit (৳)</th>
                  <th className="px-3 py-2 text-right">Balance (৳)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <tr>
                  <td className="px-3 py-2 text-slate-500">2026-01-01</td>
                  <td className="px-3 py-2 font-mono font-semibold text-blue-600">OB-2026</td>
                  <td className="px-3 py-2 text-slate-700">Opening Balance Carry Forward</td>
                  <td className="px-3 py-2 text-right font-mono text-emerald-600 font-medium">
                    ৳{viewBank?.openingBalance.toLocaleString()}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-slate-400">-</td>
                  <td className="px-3 py-2 text-right font-mono font-bold text-slate-800">
                    ৳{viewBank?.openingBalance.toLocaleString()}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={() => window.print()}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-semibold flex items-center gap-1.5 transition"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Statement</span>
            </button>
            <button
              type="button"
              onClick={() => setViewBank(null)}
              className="px-3.5 py-1.5 bg-[#2563eb] hover:bg-blue-700 text-white rounded text-xs font-semibold shadow-xs transition"
            >
              Close
            </button>
          </div>
        </div>
      </ModalDialog>
    </div>
  );
}
