"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import {
  Banknote,
  Building2,
  Calendar,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Coins,
  CreditCard,
  Download,
  Eye,
  FileSpreadsheet,
  FileText,
  Filter,
  Landmark,
  Layers,
  Pencil,
  Plus,
  Printer,
  RotateCcw,
  Search,
  ShieldCheck,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { ModalDialog } from "@/components/purchase/ModalDialog";
import { useAccountingStore } from "@/features/accounts/store/accounting-store";
import type {
  BankAccountItem,
  DepositItem,
  FactoringItem,
  LoanItem,
  LoanPartnerItem,
} from "@/features/accounts/types";

export default function FinanceBankingPage() {
  const bankAccounts = useAccountingStore((s) => s.bankAccounts);
  const deposits = useAccountingStore((s) => s.deposits);
  const loans = useAccountingStore((s) => s.loans);
  const factoring = useAccountingStore((s) => s.factoring);
  const loanPartners = useAccountingStore((s) => s.loanPartners);
  const accounts = useAccountingStore((s) => s.accounts);
  const addBankAccount = useAccountingStore((s) => s.addBankAccount);
  const addDeposit = useAccountingStore((s) => s.addDeposit);
  const addLoan = useAccountingStore((s) => s.addLoan);
  const addLoanPartner = useAccountingStore((s) => s.addLoanPartner);

  // -------------------------------------------------------------
  // TABS: Exact 5 tabs from user screenshots
  // 1. REGULAR BANKING
  // 2. DEPOSITS
  // 3. LOANS (BANK)
  // 4. FACTORING REPORT
  // 5. LOAN (OTHERS)
  // -------------------------------------------------------------
  const [activeTab, setActiveTab] = useState<
    "REGULAR_BANKING" | "DEPOSITS" | "LOANS_BANK" | "FACTORING_REPORT" | "LOAN_OTHERS"
  >("REGULAR_BANKING");

  // Global search input in top right
  const [globalSearch, setGlobalSearch] = useState("");

  // Pagination states
  const [rowsPerPage, setRowsPerPage] = useState<number>(50);
  const [currentPage, setCurrentPage] = useState<number>(1);

  // -------------------------------------------------------------
  // TAB 1: REGULAR BANKING FILTER STATES
  // -------------------------------------------------------------
  const [bankAccountTypeFilter, setBankAccountTypeFilter] = useState("ALL");

  // -------------------------------------------------------------
  // TAB 2: DEPOSITS FILTER STATES (Screenshot 2)
  // -------------------------------------------------------------
  const [depositTypeFilter, setDepositTypeFilter] = useState("Security Deposit");
  const [depositOfficeFilter, setDepositOfficeFilter] = useState("All");

  // -------------------------------------------------------------
  // TAB 3: LOANS (BANK) FILTER STATES (Screenshot 3)
  // -------------------------------------------------------------
  const [loanTypeFilter, setLoanTypeFilter] = useState("ALL");
  const [loanGlFilter, setLoanGlFilter] = useState("ALL");
  const [loanFromDate, setLoanFromDate] = useState("2026-10-01");
  const [loanToDate, setLoanToDate] = useState("2026-10-31");

  // -------------------------------------------------------------
  // TAB 4: FACTORING REPORT FILTER STATES (Screenshot 4)
  // -------------------------------------------------------------
  const [factoringFromDate, setFactoringFromDate] = useState("2026-10-01");
  const [factoringToDate, setFactoringToDate] = useState("2026-10-31");
  const [factoringCustomer, setFactoringCustomer] = useState("ALL");
  const [factoringBillSearch, setFactoringBillSearch] = useState("");
  const [factoringAccountSearch, setFactoringAccountSearch] = useState("");
  const [isBillWise, setIsBillWise] = useState(true);

  // -------------------------------------------------------------
  // TAB 5: LOAN (OTHERS) FILTER STATES (Screenshot 5)
  // -------------------------------------------------------------
  const [otherOfficeFilter, setOtherOfficeFilter] = useState("ALL");
  const [otherGroupFilter, setOtherGroupFilter] = useState("ALL");
  const [otherActiveFilter, setOtherActiveFilter] = useState("ALL");
  const [otherAccountTypeFilter, setOtherAccountTypeFilter] = useState("ALL");

  // -------------------------------------------------------------
  // MODAL STATES
  // -------------------------------------------------------------
  const [isNewBankOpen, setIsNewBankOpen] = useState(false);
  const [isNewDepositOpen, setIsNewDepositOpen] = useState(false);
  const [isNewLoanOpen, setIsNewLoanOpen] = useState(false);
  const [isNewLoanPartnerOpen, setIsNewLoanPartnerOpen] = useState(false);
  const [isBulkUploadOpen, setIsBulkUploadOpen] = useState(false);
  const [viewBankDetails, setViewBankDetails] = useState<BankAccountItem | null>(null);

  // Forms
  const [newBankForm, setNewBankForm] = useState({
    bankName: "",
    branchName: "",
    accountHolder: "BridgeOne Industrial Solutions Ltd",
    accountType: "Current Account",
    accountNumber: "",
    currency: "BDT",
    glAccountId: "acc-10102",
    glAccountName: "Cash At Bank",
    openingBalance: 0,
    reconciliationStatus: "RECONCILED" as const,
    isActive: true,
  });

  const [newDepositForm, setNewDepositForm] = useState({
    bankName: "Sonali Bank PLC",
    depositType: "Security Deposit",
    officeId: "office-dhaka",
    officeName: "Dhaka Head Office",
    principalAmount: 500000,
    interestRate: 8.5,
    openingDate: "2026-10-12",
    maturityDate: "2027-10-12",
    maturityValue: 542500,
    interestEarned: 42500,
    status: "ACTIVE",
  });

  const [newLoanForm, setNewLoanForm] = useState({
    lenderName: "Eastern Bank PLC",
    loanType: "Working Capital",
    category: "BANK" as const,
    officeId: "office-dhaka",
    officeName: "Dhaka Head Office",
    glAccountId: "acc-302",
    glAccountName: "Short Term Borrowing",
    partnerGroup: "Corporate Credit",
    principalAmount: 5000000,
    interestRate: 9.5,
    disbursementDate: "2026-10-01",
    maturityDate: "2027-10-01",
    installmentAmount: 438000,
    outstandingPrincipal: 5000000,
    accruedInterest: 0,
    tenureMonths: 12,
    status: "ACTIVE",
  });

  const [newPartnerForm, setNewPartnerForm] = useState({
    partnerName: "",
    group: "NBFI Corporate Partner",
    officeId: "office-dhaka",
    officeName: "Dhaka Head Office",
    accountType: "Lease Finance Facility",
    principalFacility: 3000000,
    interestRate: 10.0,
    tenureMonths: 36,
    outstanding: 3000000,
    status: "ACTIVE" as const,
  });

  // -------------------------------------------------------------
  // FILTERED DATASETS
  // -------------------------------------------------------------

  // 1. Regular Banking
  const filteredBankAccounts = useMemo(() => {
    return bankAccounts.filter((b) => {
      if (globalSearch) {
        const q = globalSearch.toLowerCase();
        const m =
          b.bankName.toLowerCase().includes(q) ||
          b.branchName.toLowerCase().includes(q) ||
          b.accountHolder.toLowerCase().includes(q) ||
          b.accountNumber.toLowerCase().includes(q);
        if (!m) return false;
      }
      if (bankAccountTypeFilter !== "ALL") {
        if (b.accountType.toLowerCase() !== bankAccountTypeFilter.toLowerCase()) return false;
      }
      return true;
    });
  }, [bankAccounts, globalSearch, bankAccountTypeFilter]);

  // 2. Deposits
  const filteredDeposits = useMemo(() => {
    return deposits.filter((d) => {
      if (globalSearch) {
        const q = globalSearch.toLowerCase();
        const m =
          d.depositNumber.toLowerCase().includes(q) ||
          d.bankName.toLowerCase().includes(q) ||
          d.depositType.toLowerCase().includes(q);
        if (!m) return false;
      }
      if (depositTypeFilter && depositTypeFilter !== "ALL") {
        if (d.depositType.toLowerCase() !== depositTypeFilter.toLowerCase()) return false;
      }
      if (depositOfficeFilter && depositOfficeFilter !== "All" && depositOfficeFilter !== "ALL") {
        if (d.officeName?.toLowerCase() !== depositOfficeFilter.toLowerCase()) return false;
      }
      return true;
    });
  }, [deposits, globalSearch, depositTypeFilter, depositOfficeFilter]);

  // 3. Loans (Bank)
  const filteredLoans = useMemo(() => {
    return loans.filter((l) => {
      if (globalSearch) {
        const q = globalSearch.toLowerCase();
        const m =
          l.loanNumber.toLowerCase().includes(q) ||
          l.lenderName.toLowerCase().includes(q) ||
          l.loanType.toLowerCase().includes(q);
        if (!m) return false;
      }
      if (loanTypeFilter !== "ALL") {
        if (l.loanType.toLowerCase() !== loanTypeFilter.toLowerCase()) return false;
      }
      if (loanGlFilter !== "ALL") {
        if (l.glAccountName?.toLowerCase() !== loanGlFilter.toLowerCase()) return false;
      }
      return true;
    });
  }, [loans, globalSearch, loanTypeFilter, loanGlFilter]);

  // 4. Factoring Report
  const filteredFactoring = useMemo(() => {
    return factoring.filter((f) => {
      if (factoringCustomer !== "ALL") {
        if (f.customerName?.toLowerCase() !== factoringCustomer.toLowerCase()) return false;
      }
      if (factoringBillSearch && factoringBillSearch.trim().length >= 2) {
        const q = factoringBillSearch.toLowerCase();
        const m =
          f.billNumber?.toLowerCase().includes(q) ||
          f.invoiceReference.toLowerCase().includes(q);
        if (!m) return false;
      }
      if (factoringAccountSearch && factoringAccountSearch.trim().length >= 2) {
        const q = factoringAccountSearch.toLowerCase();
        if (!f.accountNo?.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [factoring, factoringCustomer, factoringBillSearch, factoringAccountSearch]);

  // 5. Loan Others
  const filteredLoanPartners = useMemo(() => {
    return loanPartners.filter((lp) => {
      if (globalSearch) {
        const q = globalSearch.toLowerCase();
        const m =
          lp.partnerName.toLowerCase().includes(q) ||
          lp.group.toLowerCase().includes(q) ||
          lp.accountType.toLowerCase().includes(q);
        if (!m) return false;
      }
      if (otherOfficeFilter !== "ALL") {
        if (lp.officeName.toLowerCase() !== otherOfficeFilter.toLowerCase()) return false;
      }
      if (otherGroupFilter !== "ALL") {
        if (lp.group.toLowerCase() !== otherGroupFilter.toLowerCase()) return false;
      }
      if (otherActiveFilter !== "ALL") {
        if (lp.status !== otherActiveFilter) return false;
      }
      if (otherAccountTypeFilter !== "ALL") {
        if (lp.accountType.toLowerCase() !== otherAccountTypeFilter.toLowerCase()) return false;
      }
      return true;
    });
  }, [loanPartners, globalSearch, otherOfficeFilter, otherGroupFilter, otherActiveFilter, otherAccountTypeFilter]);

  // -------------------------------------------------------------
  // EXPORT TO EXCEL / CSV HELPER
  // -------------------------------------------------------------
  const handleExportExcel = () => {
    let csv = "data:text/csv;charset=utf-8,";
    if (activeTab === "REGULAR_BANKING") {
      csv += "SL,Bank Name,Branch Name,Account Holder,Account Type,Account No,Status\n";
      filteredBankAccounts.forEach((b, i) => {
        csv += `"${i + 1}","${b.bankName}","${b.branchName}","${b.accountHolder}","${b.accountType}","${b.accountNumber}","${b.isActive ? "ACTIVE" : "INACTIVE"}"\n`;
      });
    } else if (activeTab === "DEPOSITS") {
      csv += "SL,Deposit #,Bank Name,Type,Office,Principal,Interest Rate,Opening Date,Maturity Date,Status\n";
      filteredDeposits.forEach((d, i) => {
        csv += `"${i + 1}","${d.depositNumber}","${d.bankName}","${d.depositType}","${d.officeName || ""}","${d.principalAmount}","${d.interestRate}%","${d.openingDate}","${d.maturityDate}","${d.status}"\n`;
      });
    } else if (activeTab === "LOANS_BANK") {
      csv += "SL,Loan #,Lender Name,Loan Type,GL Account,Principal Amount,Interest Rate,Disbursement Date,Maturity Date,Outstanding,Status\n";
      filteredLoans.forEach((l, i) => {
        csv += `"${i + 1}","${l.loanNumber}","${l.lenderName}","${l.loanType}","${l.glAccountName || ""}","${l.principalAmount}","${l.interestRate}%","${l.disbursementDate}","${l.maturityDate}","${l.outstandingPrincipal}","${l.status}"\n`;
      });
    } else if (activeTab === "FACTORING_REPORT") {
      csv += "SL,Bill / Invoice,Customer,Bank Account,Invoice Date,Invoice Value,Eligible Advance,Factoring Fee,Remaining,Status\n";
      filteredFactoring.forEach((f, i) => {
        csv += `"${i + 1}","${f.billNumber || f.invoiceReference}","${f.customerName || ""}","${f.accountNo || ""}","${f.invoiceDate || ""}","${f.eligibleReceivable}","${f.advanceAmount}","${f.feesCharges}","${f.remainingReceivable}","${f.settlementStatus}"\n`;
      });
    } else if (activeTab === "LOAN_OTHERS") {
      csv += "SL,Loan Partner,Group,Office,Account Type,Principal Facility,Interest Rate %,Tenure (Months),Outstanding,Status\n";
      filteredLoanPartners.forEach((lp, i) => {
        csv += `"${i + 1}","${lp.partnerName}","${lp.group}","${lp.officeName}","${lp.accountType}","${lp.principalFacility}","${lp.interestRate}%","${lp.tenureMonths}","${lp.outstanding}","${lp.status}"\n`;
      });
    }
    const encoded = encodeURI(csv);
    const link = document.createElement("a");
    link.setAttribute("href", encoded);
    link.setAttribute("download", `BridgeOne_${activeTab}_Export.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // -------------------------------------------------------------
  // SAVE HANDLERS
  // -------------------------------------------------------------
  const handleSaveBank = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBankForm.bankName || !newBankForm.accountNumber) return;
    addBankAccount(newBankForm);
    setIsNewBankOpen(false);
    setNewBankForm({
      bankName: "",
      branchName: "",
      accountHolder: "BridgeOne Industrial Solutions Ltd",
      accountType: "Current Account",
      accountNumber: "",
      currency: "BDT",
      glAccountId: "acc-10102",
      glAccountName: "Cash At Bank",
      openingBalance: 0,
      reconciliationStatus: "RECONCILED",
      isActive: true,
    });
  };

  const handleSaveDeposit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newDepositForm.principalAmount <= 0) return;
    addDeposit(newDepositForm);
    setIsNewDepositOpen(false);
  };

  const handleSaveLoan = (e: React.FormEvent) => {
    e.preventDefault();
    if (newLoanForm.principalAmount <= 0) return;
    addLoan(newLoanForm);
    setIsNewLoanOpen(false);
  };

  const handleSaveLoanPartner = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPartnerForm.partnerName) return;
    addLoanPartner(newPartnerForm);
    setIsNewLoanPartnerOpen(false);
  };

  // -------------------------------------------------------------
  // BRIDGEONE ERP BRANDED EMPTY STATE
  // -------------------------------------------------------------
  const renderBridgeOneEmptyState = (message: string = "No Data Found") => (
    <div className="py-24 flex flex-col items-center justify-center text-center select-none bg-white">
      <div className="relative mb-4 flex items-center justify-center">
        <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-blue-700 via-indigo-600 to-sky-500 flex items-center justify-center shadow-lg shadow-blue-500/20 text-white font-black text-2xl tracking-tighter">
          B1
        </div>
        <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-emerald-500 border-2 border-white flex items-center justify-center text-white">
          <Check className="w-3.5 h-3.5 stroke-[3]" />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-2xl font-black tracking-tight text-[#0f2d59]">
          Bridge<span className="text-blue-600">One</span>
        </span>
        <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
          ERP
        </span>
      </div>
      <h3 className="text-base font-bold text-slate-800 mt-2">{message}</h3>
      <p className="text-xs text-slate-400 mt-1 max-w-sm">
        No records found matching the active filter criteria. Adjust the dropdown filters or click View to refresh data.
      </p>
    </div>
  );

  return (
    <div className="space-y-2.5 font-sans pb-16 bg-[#f8fafc] min-h-screen">
      {/* ------------------------------------------------------------- */}
      {/* 1. TOP BAR: Title & Tab-Specific Action Buttons */}
      {/* ------------------------------------------------------------- */}
      <div className="bg-white px-4 py-3 rounded-t border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
        <div>
          <h1 className="text-lg font-bold text-slate-900 tracking-tight">Finance and Banking</h1>
        </div>

        <div className="flex items-center gap-2 flex-wrap justify-end">
          {/* Search box (shown on tabs 1, 3, 5) */}
          {(activeTab === "REGULAR_BANKING" ||
            activeTab === "DEPOSITS" ||
            activeTab === "LOANS_BANK" ||
            activeTab === "LOAN_OTHERS") && (
            <div className="relative">
              <input
                type="text"
                value={globalSearch}
                onChange={(e) => setGlobalSearch(e.target.value)}
                placeholder="Search..."
                className="w-44 sm:w-56 h-8 pl-3 pr-7 text-xs border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white placeholder-slate-400"
              />
              <Search className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          )}

          {/* TAB 1: + Regular Banking */}
          {activeTab === "REGULAR_BANKING" && (
            <button
              type="button"
              onClick={() => setIsNewBankOpen(true)}
              className="h-8 px-3.5 bg-[#2563eb] hover:bg-blue-700 text-white font-semibold text-xs rounded flex items-center gap-1.5 shadow-xs transition"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Regular Banking</span>
            </button>
          )}

          {/* TAB 2: + Deposits */}
          {activeTab === "DEPOSITS" && (
            <button
              type="button"
              onClick={() => setIsNewDepositOpen(true)}
              className="h-8 px-3.5 bg-[#2563eb] hover:bg-blue-700 text-white font-semibold text-xs rounded flex items-center gap-1.5 shadow-xs transition"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Deposits</span>
            </button>
          )}

          {/* TAB 3: Excel + + Loans */}
          {activeTab === "LOANS_BANK" && (
            <>
              <button
                type="button"
                onClick={handleExportExcel}
                className="h-8 px-3 bg-[#2563eb] hover:bg-blue-700 text-white font-semibold text-xs rounded flex items-center gap-1.5 shadow-xs transition"
                title="Download Excel Report"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Excel</span>
              </button>
              <button
                type="button"
                onClick={() => setIsNewLoanOpen(true)}
                className="h-8 px-3.5 bg-[#2563eb] hover:bg-blue-700 text-white font-semibold text-xs rounded flex items-center gap-1.5 shadow-xs transition"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Loans</span>
              </button>
            </>
          )}

          {/* TAB 4: Print/PDF */}
          {activeTab === "FACTORING_REPORT" && (
            <button
              type="button"
              onClick={() => window.print()}
              className="h-8 px-3.5 bg-[#2563eb] hover:bg-blue-700 text-white font-semibold text-xs rounded flex items-center gap-1.5 shadow-xs transition"
            >
              <span>Print/PDF</span>
            </button>
          )}

          {/* TAB 5: EXCEL + + Bulk Upload + + Loan Partner */}
          {activeTab === "LOAN_OTHERS" && (
            <>
              <button
                type="button"
                onClick={handleExportExcel}
                className="h-8 px-3 bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 font-semibold text-xs rounded flex items-center gap-1.5 shadow-2xs transition"
                title="Download Excel Report"
              >
                <Download className="w-3.5 h-3.5 text-slate-500" />
                <span>EXCEL</span>
              </button>
              <button
                type="button"
                onClick={() => setIsBulkUploadOpen(true)}
                className="h-8 px-3.5 bg-[#2563eb] hover:bg-blue-700 text-white font-semibold text-xs rounded flex items-center gap-1.5 shadow-xs transition"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Bulk Upload</span>
              </button>
              <button
                type="button"
                onClick={() => setIsNewLoanPartnerOpen(true)}
                className="h-8 px-3.5 bg-[#2563eb] hover:bg-blue-700 text-white font-semibold text-xs rounded flex items-center gap-1.5 shadow-xs transition"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Loan Partner</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 2. TABS BAR (Exact 5 tabs from user screenshots) */}
      {/* ------------------------------------------------------------- */}
      <div className="bg-white border-b border-slate-200 px-4 pt-1 flex items-center gap-7 overflow-x-auto select-none">
        <button
          type="button"
          onClick={() => setActiveTab("REGULAR_BANKING")}
          className={`pb-2.5 text-xs font-bold tracking-wide transition-colors uppercase whitespace-nowrap ${
            activeTab === "REGULAR_BANKING"
              ? "text-blue-600 border-b-2 border-blue-600 -mb-[1px]"
              : "text-slate-500 hover:text-slate-800"
          }`}
        >
          REGULAR BANKING
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("DEPOSITS")}
          className={`pb-2.5 text-xs font-bold tracking-wide transition-colors uppercase whitespace-nowrap ${
            activeTab === "DEPOSITS"
              ? "text-blue-600 border-b-2 border-blue-600 -mb-[1px]"
              : "text-slate-500 hover:text-slate-800"
          }`}
        >
          DEPOSITS
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("LOANS_BANK")}
          className={`pb-2.5 text-xs font-bold tracking-wide transition-colors uppercase whitespace-nowrap ${
            activeTab === "LOANS_BANK"
              ? "text-blue-600 border-b-2 border-blue-600 -mb-[1px]"
              : "text-slate-500 hover:text-slate-800"
          }`}
        >
          LOANS (BANK)
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("FACTORING_REPORT")}
          className={`pb-2.5 text-xs font-bold tracking-wide transition-colors uppercase whitespace-nowrap ${
            activeTab === "FACTORING_REPORT"
              ? "text-blue-600 border-b-2 border-blue-600 -mb-[1px]"
              : "text-slate-500 hover:text-slate-800"
          }`}
        >
          FACTORING REPORT
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("LOAN_OTHERS")}
          className={`pb-2.5 text-xs font-bold tracking-wide transition-colors uppercase whitespace-nowrap ${
            activeTab === "LOAN_OTHERS"
              ? "text-blue-600 border-b-2 border-blue-600 -mb-[1px]"
              : "text-slate-500 hover:text-slate-800"
          }`}
        >
          LOAN (OTHERS)
        </button>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 3. TAB 1: REGULAR BANKING (Screenshot 1) */}
      {/* ------------------------------------------------------------- */}
      {activeTab === "REGULAR_BANKING" && (
        <div className="bg-white border-t border-slate-200">
          {/* Filter Bar */}
          <div className="px-4 py-3 border-b border-slate-200/80 flex flex-wrap items-center gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-slate-600">Bank Account Type</label>
              <select
                value={bankAccountTypeFilter}
                onChange={(e) => setBankAccountTypeFilter(e.target.value)}
                className="h-8 w-60 border border-slate-300 rounded px-2.5 text-xs bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="ALL">Bank Account Type</option>
                <option value="Current Account">Current Account</option>
                <option value="Savings Account">Savings Account</option>
                <option value="Escrow Account">Escrow Account</option>
                <option value="Salary Account">Salary Account</option>
              </select>
            </div>

            <div className="flex items-end self-end">
              <button
                type="button"
                onClick={() => {}}
                className="h-8 px-4 bg-[#2563eb] hover:bg-blue-700 text-white font-semibold text-xs rounded transition shadow-xs"
              >
                View
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#e8f2fe] border-b border-blue-200/80 text-[11px] font-bold text-slate-800 uppercase tracking-wide">
                <tr>
                  <th className="px-3.5 py-2.5 w-12 text-center">SL</th>
                  <th className="px-3.5 py-2.5">Bank Name</th>
                  <th className="px-3.5 py-2.5">Branch Name</th>
                  <th className="px-3.5 py-2.5">Account Holder</th>
                  <th className="px-3.5 py-2.5">Account Type</th>
                  <th className="px-3.5 py-2.5 font-mono">Account No</th>
                  <th className="px-3.5 py-2.5 text-center w-24">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredBankAccounts.length === 0 ? (
                  <tr>
                    <td colSpan={7}>{renderBridgeOneEmptyState("No Bank Accounts Found")}</td>
                  </tr>
                ) : (
                  filteredBankAccounts.map((b, idx) => (
                    <tr key={b.id} className="hover:bg-blue-50/40 transition-colors">
                      <td className="px-3.5 py-2.5 text-center text-slate-500 font-medium">{idx + 1}</td>
                      <td className="px-3.5 py-2.5 font-semibold text-slate-900">{b.bankName}</td>
                      <td className="px-3.5 py-2.5 text-slate-600">{b.branchName}</td>
                      <td className="px-3.5 py-2.5 text-slate-700 font-medium">{b.accountHolder}</td>
                      <td className="px-3.5 py-2.5 text-slate-600">{b.accountType}</td>
                      <td className="px-3.5 py-2.5 font-mono font-medium text-slate-900">{b.accountNumber}</td>
                      <td className="px-3.5 py-2.5 text-center">
                        <div className="flex items-center justify-center gap-2 text-slate-400">
                          <button
                            type="button"
                            onClick={() => setViewBankDetails(b)}
                            className="hover:text-blue-600 transition"
                            title="Edit"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setViewBankDetails(b)}
                            className="hover:text-blue-600 transition"
                            title="View"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setViewBankDetails(b)}
                            className="hover:text-blue-600 transition"
                            title="Details / Link"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Footer Pagination */}
          <div className="px-4 py-2.5 border-t border-slate-200 flex items-center justify-end gap-5 text-xs text-slate-500">
            <div className="flex items-center gap-1.5">
              <span>Rows per page:</span>
              <select
                value={rowsPerPage}
                onChange={(e) => setRowsPerPage(Number(e.target.value))}
                className="border border-slate-200 rounded px-1.5 py-0.5 text-xs bg-white focus:outline-none"
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
            <span>
              1–{filteredBankAccounts.length} of {filteredBankAccounts.length}
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                className="p-1 rounded hover:bg-slate-100 disabled:opacity-40"
                disabled
              >
                <ChevronLeft className="w-4 h-4 text-slate-400" />
              </button>
              <button
                type="button"
                className="p-1 rounded hover:bg-slate-100 disabled:opacity-40"
                disabled
              >
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 4. TAB 2: DEPOSITS (Screenshot 2) */}
      {/* ------------------------------------------------------------- */}
      {activeTab === "DEPOSITS" && (
        <div className="bg-white border-t border-slate-200">
          {/* Filter Bar */}
          <div className="px-4 py-3 border-b border-slate-200/80 flex flex-wrap items-center gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-slate-600">
                Type <span className="text-red-500">*</span>
              </label>
              <select
                value={depositTypeFilter}
                onChange={(e) => setDepositTypeFilter(e.target.value)}
                className="h-8 w-56 border border-slate-300 rounded px-2.5 text-xs bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="Security Deposit">Security Deposit</option>
                <option value="Fixed Deposit">Fixed Deposit (FDR)</option>
                <option value="Term Deposit">Term Deposit (TDR)</option>
                <option value="ALL">All Types</option>
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-slate-600">Office</label>
              <select
                value={depositOfficeFilter}
                onChange={(e) => setDepositOfficeFilter(e.target.value)}
                className="h-8 w-60 border border-slate-300 rounded px-2.5 text-xs bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="All">All</option>
                <option value="Dhaka Head Office">Dhaka Head Office</option>
                <option value="MG Sirajganj Factory">MG Sirajganj Factory</option>
                <option value="MBBL-HO">MBBL-HO</option>
                <option value="MGV-PLC">MGV-PLC</option>
                <option value="MOHS-Eco">MOHS-Eco</option>
              </select>
            </div>

            <div className="flex items-end self-end">
              <button
                type="button"
                onClick={() => {}}
                className="h-8 px-4 bg-[#2563eb] hover:bg-blue-700 text-white font-semibold text-xs rounded transition shadow-xs"
              >
                View
              </button>
            </div>
          </div>

          {/* Table or Branded Empty State */}
          {filteredDeposits.length === 0 ? (
            renderBridgeOneEmptyState("No Deposits Found")
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#e8f2fe] border-b border-blue-200/80 text-[11px] font-bold text-slate-800 uppercase tracking-wide">
                  <tr>
                    <th className="px-3.5 py-2.5 w-12 text-center">SL</th>
                    <th className="px-3.5 py-2.5">Deposit #</th>
                    <th className="px-3.5 py-2.5">Bank / Institution</th>
                    <th className="px-3.5 py-2.5">Type</th>
                    <th className="px-3.5 py-2.5">Office</th>
                    <th className="px-3.5 py-2.5 text-right">Principal Amount</th>
                    <th className="px-3.5 py-2.5 text-right">Interest Rate (%)</th>
                    <th className="px-3.5 py-2.5">Opening Date</th>
                    <th className="px-3.5 py-2.5">Maturity Date</th>
                    <th className="px-3.5 py-2.5 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {filteredDeposits.map((d, idx) => (
                    <tr key={d.id} className="hover:bg-blue-50/40 transition-colors">
                      <td className="px-3.5 py-2.5 text-center text-slate-500 font-medium">{idx + 1}</td>
                      <td className="px-3.5 py-2.5 font-mono font-bold text-blue-600">{d.depositNumber}</td>
                      <td className="px-3.5 py-2.5 font-semibold text-slate-900">{d.bankName}</td>
                      <td className="px-3.5 py-2.5">
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-100">
                          {d.depositType}
                        </span>
                      </td>
                      <td className="px-3.5 py-2.5 text-slate-600">{d.officeName}</td>
                      <td className="px-3.5 py-2.5 text-right font-mono font-bold text-slate-900">
                        ৳{d.principalAmount.toLocaleString()}
                      </td>
                      <td className="px-3.5 py-2.5 text-right font-mono font-semibold text-slate-700">
                        {d.interestRate}%
                      </td>
                      <td className="px-3.5 py-2.5 text-slate-600">{d.openingDate}</td>
                      <td className="px-3.5 py-2.5 text-slate-600">{d.maturityDate}</td>
                      <td className="px-3.5 py-2.5 text-center">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          {d.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 5. TAB 3: LOANS (BANK) (Screenshot 3) */}
      {/* ------------------------------------------------------------- */}
      {activeTab === "LOANS_BANK" && (
        <div className="bg-white border-t border-slate-200">
          {/* Filter Bar */}
          <div className="px-4 py-3 border-b border-slate-200/80 flex flex-wrap items-center gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-slate-600">
                Type <span className="text-red-500">*</span>
              </label>
              <select
                value={loanTypeFilter}
                onChange={(e) => setLoanTypeFilter(e.target.value)}
                className="h-8 w-52 border border-slate-300 rounded px-2.5 text-xs bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="ALL">All Loan Types</option>
                <option value="Working Capital">Working Capital</option>
                <option value="Term Loan">Term Loan</option>
                <option value="Syndicated Credit Facility">Syndicated Credit Facility</option>
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-slate-600">
                GL <span className="text-red-500">*</span>
              </label>
              <select
                value={loanGlFilter}
                onChange={(e) => setLoanGlFilter(e.target.value)}
                className="h-8 w-56 border border-slate-300 rounded px-2.5 text-xs bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="ALL">GL Account</option>
                <option value="Short Term Borrowing">Short Term Borrowing</option>
                <option value="Long Term Machinery Loan">Long Term Machinery Loan</option>
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-slate-600">
                From Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={loanFromDate}
                onChange={(e) => setLoanFromDate(e.target.value)}
                className="h-8 w-40 border border-slate-300 rounded px-2.5 text-xs bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-slate-600">
                To Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={loanToDate}
                onChange={(e) => setLoanToDate(e.target.value)}
                className="h-8 w-40 border border-slate-300 rounded px-2.5 text-xs bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div className="flex items-end self-end">
              <button
                type="button"
                onClick={() => {}}
                className="h-8 px-4 bg-[#2563eb] hover:bg-blue-700 text-white font-semibold text-xs rounded transition shadow-xs"
              >
                View
              </button>
            </div>
          </div>

          {/* Table or Branded Empty State */}
          {filteredLoans.length === 0 ? (
            renderBridgeOneEmptyState("No Bank Loans Found")
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#e8f2fe] border-b border-blue-200/80 text-[11px] font-bold text-slate-800 uppercase tracking-wide">
                  <tr>
                    <th className="px-3.5 py-2.5 w-12 text-center">SL</th>
                    <th className="px-3.5 py-2.5">Loan #</th>
                    <th className="px-3.5 py-2.5">Lender Bank</th>
                    <th className="px-3.5 py-2.5">Facility Type</th>
                    <th className="px-3.5 py-2.5">GL Account</th>
                    <th className="px-3.5 py-2.5 text-right">Principal Amount</th>
                    <th className="px-3.5 py-2.5 text-right">Interest Rate (%)</th>
                    <th className="px-3.5 py-2.5">Disbursement Date</th>
                    <th className="px-3.5 py-2.5">Maturity Date</th>
                    <th className="px-3.5 py-2.5 text-right font-bold text-rose-700">Outstanding</th>
                    <th className="px-3.5 py-2.5 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {filteredLoans.map((l, idx) => (
                    <tr key={l.id} className="hover:bg-blue-50/40 transition-colors">
                      <td className="px-3.5 py-2.5 text-center text-slate-500 font-medium">{idx + 1}</td>
                      <td className="px-3.5 py-2.5 font-mono font-bold text-blue-600">{l.loanNumber}</td>
                      <td className="px-3.5 py-2.5 font-semibold text-slate-900">{l.lenderName}</td>
                      <td className="px-3.5 py-2.5">
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                          {l.loanType}
                        </span>
                      </td>
                      <td className="px-3.5 py-2.5 text-slate-600">{l.glAccountName}</td>
                      <td className="px-3.5 py-2.5 text-right font-mono font-bold text-slate-900">
                        ৳{l.principalAmount.toLocaleString()}
                      </td>
                      <td className="px-3.5 py-2.5 text-right font-mono font-semibold text-slate-700">
                        {l.interestRate}%
                      </td>
                      <td className="px-3.5 py-2.5 text-slate-600">{l.disbursementDate}</td>
                      <td className="px-3.5 py-2.5 text-slate-600">{l.maturityDate}</td>
                      <td className="px-3.5 py-2.5 text-right font-mono font-bold text-rose-700">
                        ৳{l.outstandingPrincipal.toLocaleString()}
                      </td>
                      <td className="px-3.5 py-2.5 text-center">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                          {l.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 6. TAB 4: FACTORING REPORT (Screenshot 4) */}
      {/* ------------------------------------------------------------- */}
      {activeTab === "FACTORING_REPORT" && (
        <div className="bg-white border-t border-slate-200">
          {/* Filter Bar */}
          <div className="px-4 py-3 border-b border-slate-200/80 flex flex-wrap items-center gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-slate-600">
                From Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={factoringFromDate}
                onChange={(e) => setFactoringFromDate(e.target.value)}
                className="h-8 w-36 border border-slate-300 rounded px-2.5 text-xs bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-slate-600">
                To Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={factoringToDate}
                onChange={(e) => setFactoringToDate(e.target.value)}
                className="h-8 w-36 border border-slate-300 rounded px-2.5 text-xs bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-slate-600">Customer</label>
              <select
                value={factoringCustomer}
                onChange={(e) => setFactoringCustomer(e.target.value)}
                className="h-8 w-52 border border-slate-300 rounded px-2.5 text-xs bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="ALL">Select Partner</option>
                <option value="Arif Enterprise-Jamalpur">Arif Enterprise-Jamalpur</option>
                <option value="Choya Dia Enterprise-Magura">Choya Dia Enterprise-Magura</option>
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-slate-600">Bill</label>
              <input
                type="text"
                value={factoringBillSearch}
                onChange={(e) => setFactoringBillSearch(e.target.value)}
                placeholder="Select/Search Bill (min 3 letters)"
                className="h-8 w-60 border border-slate-300 rounded px-2.5 text-xs bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder-slate-400"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-slate-600">Account No</label>
              <input
                type="text"
                value={factoringAccountSearch}
                onChange={(e) => setFactoringAccountSearch(e.target.value)}
                placeholder="Select/Search Account No (min 3 letters)"
                className="h-8 w-60 border border-slate-300 rounded px-2.5 text-xs bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder-slate-400"
              />
            </div>

            <div className="flex items-center gap-1.5 self-end pb-1.5">
              <input
                type="checkbox"
                id="isBillWise"
                checked={isBillWise}
                onChange={(e) => setIsBillWise(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
              />
              <label htmlFor="isBillWise" className="text-xs font-semibold text-slate-600 cursor-pointer">
                Is Bill Wise
              </label>
            </div>

            <div className="flex items-end self-end">
              <button
                type="button"
                onClick={() => {}}
                className="h-8 px-4 bg-[#2563eb] hover:bg-blue-700 text-white font-semibold text-xs rounded transition shadow-xs"
              >
                View
              </button>
            </div>
          </div>

          {/* Table or Branded Empty State */}
          {filteredFactoring.length === 0 ? (
            renderBridgeOneEmptyState("No Factoring Records Found")
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#e8f2fe] border-b border-blue-200/80 text-[11px] font-bold text-slate-800 uppercase tracking-wide">
                  <tr>
                    <th className="px-3.5 py-2.5 w-12 text-center">SL</th>
                    <th className="px-3.5 py-2.5">Bill / Invoice Reference</th>
                    <th className="px-3.5 py-2.5">Customer / Partner</th>
                    <th className="px-3.5 py-2.5">Factoring Company</th>
                    <th className="px-3.5 py-2.5 font-mono">Bank Account No</th>
                    <th className="px-3.5 py-2.5 text-right">Invoice Value</th>
                    <th className="px-3.5 py-2.5 text-right font-bold text-emerald-700">Eligible Advance (80%)</th>
                    <th className="px-3.5 py-2.5 text-right text-rose-700">Fee / Charges</th>
                    <th className="px-3.5 py-2.5 text-right font-bold text-blue-700">Remaining</th>
                    <th className="px-3.5 py-2.5 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {filteredFactoring.map((f, idx) => (
                    <tr key={f.id} className="hover:bg-blue-50/40 transition-colors">
                      <td className="px-3.5 py-2.5 text-center text-slate-500 font-medium">{idx + 1}</td>
                      <td className="px-3.5 py-2.5 font-mono font-bold text-blue-600">
                        {f.billNumber || f.invoiceReference}
                      </td>
                      <td className="px-3.5 py-2.5 font-semibold text-slate-900">{f.customerName}</td>
                      <td className="px-3.5 py-2.5 text-slate-600">{f.factoringCompany}</td>
                      <td className="px-3.5 py-2.5 font-mono text-slate-800">{f.accountNo}</td>
                      <td className="px-3.5 py-2.5 text-right font-mono font-semibold text-slate-900">
                        ৳{f.eligibleReceivable.toLocaleString()}
                      </td>
                      <td className="px-3.5 py-2.5 text-right font-mono font-bold text-emerald-700">
                        ৳{f.advanceAmount.toLocaleString()}
                      </td>
                      <td className="px-3.5 py-2.5 text-right font-mono text-rose-700">
                        ৳{f.feesCharges.toLocaleString()}
                      </td>
                      <td className="px-3.5 py-2.5 text-right font-mono font-bold text-blue-700">
                        ৳{f.remainingReceivable.toLocaleString()}
                      </td>
                      <td className="px-3.5 py-2.5 text-center">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                            f.settlementStatus === "SETTLED"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : "bg-amber-50 text-amber-700 border-amber-200"
                          }`}
                        >
                          {f.settlementStatus}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Footer Pagination */}
          <div className="px-4 py-2.5 border-t border-slate-200 flex items-center justify-end gap-5 text-xs text-slate-500">
            <div className="flex items-center gap-1.5">
              <span>Rows per page:</span>
              <select
                value={rowsPerPage}
                onChange={(e) => setRowsPerPage(Number(e.target.value))}
                className="border border-slate-200 rounded px-1.5 py-0.5 text-xs bg-white focus:outline-none"
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
              </select>
            </div>
            <span>
              1–{filteredFactoring.length} of {filteredFactoring.length}
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                className="p-1 rounded hover:bg-slate-100 disabled:opacity-40"
                disabled
              >
                <ChevronLeft className="w-4 h-4 text-slate-400" />
              </button>
              <button
                type="button"
                className="p-1 rounded hover:bg-slate-100 disabled:opacity-40"
                disabled
              >
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 7. TAB 5: LOAN (OTHERS) (Screenshot 5) */}
      {/* ------------------------------------------------------------- */}
      {activeTab === "LOAN_OTHERS" && (
        <div className="bg-white border-t border-slate-200">
          {/* Filter Bar */}
          <div className="px-4 py-3 border-b border-slate-200/80 flex flex-wrap items-center gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-slate-600">Office</label>
              <select
                value={otherOfficeFilter}
                onChange={(e) => setOtherOfficeFilter(e.target.value)}
                className="h-8 w-44 border border-slate-300 rounded px-2.5 text-xs bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="ALL">Office</option>
                <option value="Dhaka Head Office">Dhaka Head Office</option>
                <option value="MG Sirajganj Factory">MG Sirajganj Factory</option>
                <option value="MGV-PLC">MGV-PLC</option>
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-slate-600">Group</label>
              <select
                value={otherGroupFilter}
                onChange={(e) => setOtherGroupFilter(e.target.value)}
                className="h-8 w-52 border border-slate-300 rounded px-2.5 text-xs bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="ALL">Partner Group</option>
                <option value="NBFI Corporate Partner">NBFI Corporate Partner</option>
                <option value="Equipment Credit Partner">Equipment Credit Partner</option>
                <option value="Working Capital Partner">Working Capital Partner</option>
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-slate-600">Active/InActive</label>
              <select
                value={otherActiveFilter}
                onChange={(e) => setOtherActiveFilter(e.target.value)}
                className="h-8 w-52 border border-slate-300 rounded px-2.5 text-xs bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="ALL">Filter By Active/InActive</option>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">InActive</option>
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-slate-600">Account Type</label>
              <select
                value={otherAccountTypeFilter}
                onChange={(e) => setOtherAccountTypeFilter(e.target.value)}
                className="h-8 w-52 border border-slate-300 rounded px-2.5 text-xs bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="ALL">Select Account Type</option>
                <option value="Lease Finance Facility">Lease Finance Facility</option>
                <option value="Industrial Term Loan">Industrial Term Loan</option>
                <option value="Revolving Credit Line">Revolving Credit Line</option>
              </select>
            </div>

            <div className="flex items-end self-end">
              <button
                type="button"
                onClick={() => {}}
                className="h-8 px-4 bg-[#2563eb] hover:bg-blue-700 text-white font-semibold text-xs rounded transition shadow-xs"
              >
                View
              </button>
            </div>
          </div>

          {/* Table or Branded Empty State */}
          {filteredLoanPartners.length === 0 ? (
            renderBridgeOneEmptyState("No Loan Partners Found")
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#e8f2fe] border-b border-blue-200/80 text-[11px] font-bold text-slate-800 uppercase tracking-wide">
                  <tr>
                    <th className="px-3.5 py-2.5 w-12 text-center">SL</th>
                    <th className="px-3.5 py-2.5">Loan Partner</th>
                    <th className="px-3.5 py-2.5">Partner Group</th>
                    <th className="px-3.5 py-2.5">Office</th>
                    <th className="px-3.5 py-2.5">Account Type</th>
                    <th className="px-3.5 py-2.5 text-right">Principal Facility</th>
                    <th className="px-3.5 py-2.5 text-right">Interest Rate (%)</th>
                    <th className="px-3.5 py-2.5 text-center">Tenure (Mos)</th>
                    <th className="px-3.5 py-2.5 text-right font-bold text-rose-700">Outstanding</th>
                    <th className="px-3.5 py-2.5 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {filteredLoanPartners.map((lp, idx) => (
                    <tr key={lp.id} className="hover:bg-blue-50/40 transition-colors">
                      <td className="px-3.5 py-2.5 text-center text-slate-500 font-medium">{idx + 1}</td>
                      <td className="px-3.5 py-2.5 font-semibold text-slate-900">{lp.partnerName}</td>
                      <td className="px-3.5 py-2.5 text-slate-600">{lp.group}</td>
                      <td className="px-3.5 py-2.5 text-slate-600">{lp.officeName}</td>
                      <td className="px-3.5 py-2.5">
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-100">
                          {lp.accountType}
                        </span>
                      </td>
                      <td className="px-3.5 py-2.5 text-right font-mono font-bold text-slate-900">
                        ৳{lp.principalFacility.toLocaleString()}
                      </td>
                      <td className="px-3.5 py-2.5 text-right font-mono font-semibold text-slate-700">
                        {lp.interestRate}%
                      </td>
                      <td className="px-3.5 py-2.5 text-center font-mono text-slate-600">{lp.tenureMonths}</td>
                      <td className="px-3.5 py-2.5 text-right font-mono font-bold text-rose-700">
                        ৳{lp.outstanding.toLocaleString()}
                      </td>
                      <td className="px-3.5 py-2.5 text-center">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          {lp.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL 1: ADD REGULAR BANKING ACCOUNT */}
      {/* ------------------------------------------------------------- */}
      <ModalDialog
        isOpen={isNewBankOpen}
        onClose={() => setIsNewBankOpen(false)}
        title="Add Regular Bank Account"
        subtitle="Register corporate bank ledger for BridgeOne Group of Industries"
        maxWidth="lg"
      >
        <form onSubmit={handleSaveBank} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Bank Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={newBankForm.bankName}
                onChange={(e) => setNewBankForm({ ...newBankForm, bankName: e.target.value })}
                placeholder="e.g. PRIME BANK LTD PLC"
                className="w-full h-9 px-3 text-xs border border-slate-300 rounded focus:ring-1 focus:ring-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Branch Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={newBankForm.branchName}
                onChange={(e) => setNewBankForm({ ...newBankForm, branchName: e.target.value })}
                placeholder="e.g. ISLAMI BANKING(MIRPUR)"
                className="w-full h-9 px-3 text-xs border border-slate-300 rounded focus:ring-1 focus:ring-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Account Holder <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={newBankForm.accountHolder}
                onChange={(e) => setNewBankForm({ ...newBankForm, accountHolder: e.target.value })}
                placeholder="e.g. BridgeOne Industrial Solutions Ltd"
                className="w-full h-9 px-3 text-xs border border-slate-300 rounded focus:ring-1 focus:ring-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Account Type</label>
              <select
                value={newBankForm.accountType}
                onChange={(e) => setNewBankForm({ ...newBankForm, accountType: e.target.value })}
                className="w-full h-9 px-3 text-xs border border-slate-300 rounded bg-white focus:ring-1 focus:ring-blue-500 focus:outline-none"
              >
                <option value="Current Account">Current Account</option>
                <option value="Savings Account">Savings Account</option>
                <option value="Escrow Account">Escrow Account</option>
                <option value="Salary Account">Salary Account</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Account Number <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={newBankForm.accountNumber}
                onChange={(e) => setNewBankForm({ ...newBankForm, accountNumber: e.target.value })}
                placeholder="e.g. 3133131043165"
                className="w-full h-9 px-3 text-xs border border-slate-300 rounded font-mono focus:ring-1 focus:ring-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Opening Balance (৳)</label>
              <input
                type="number"
                min="0"
                value={newBankForm.openingBalance}
                onChange={(e) => setNewBankForm({ ...newBankForm, openingBalance: Number(e.target.value) })}
                className="w-full h-9 px-3 text-xs border border-slate-300 rounded font-mono focus:ring-1 focus:ring-blue-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setIsNewBankOpen(false)}
              className="px-4 py-2 border border-slate-300 text-slate-600 hover:bg-slate-50 text-xs font-semibold rounded"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-[#2563eb] hover:bg-blue-700 text-white text-xs font-semibold rounded"
            >
              Save Account
            </button>
          </div>
        </form>
      </ModalDialog>

      {/* ------------------------------------------------------------- */}
      {/* MODAL 2: ADD DEPOSIT */}
      {/* ------------------------------------------------------------- */}
      <ModalDialog
        isOpen={isNewDepositOpen}
        onClose={() => setIsNewDepositOpen(false)}
        title="Open Term / Security Deposit"
        subtitle="Register new deposit contract under BridgeOne ERP"
        maxWidth="md"
      >
        <form onSubmit={handleSaveDeposit} className="space-y-4">
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Deposit Type</label>
              <select
                value={newDepositForm.depositType}
                onChange={(e) => setNewDepositForm({ ...newDepositForm, depositType: e.target.value })}
                className="w-full h-9 px-3 text-xs border border-slate-300 rounded bg-white focus:ring-1 focus:ring-blue-500 focus:outline-none"
              >
                <option value="Security Deposit">Security Deposit</option>
                <option value="Fixed Deposit">Fixed Deposit (FDR)</option>
                <option value="Term Deposit">Term Deposit (TDR)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Bank Name</label>
              <input
                type="text"
                required
                value={newDepositForm.bankName}
                onChange={(e) => setNewDepositForm({ ...newDepositForm, bankName: e.target.value })}
                className="w-full h-9 px-3 text-xs border border-slate-300 rounded focus:ring-1 focus:ring-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Office</label>
              <select
                value={newDepositForm.officeName}
                onChange={(e) => setNewDepositForm({ ...newDepositForm, officeName: e.target.value })}
                className="w-full h-9 px-3 text-xs border border-slate-300 rounded bg-white focus:ring-1 focus:ring-blue-500 focus:outline-none"
              >
                <option value="Dhaka Head Office">Dhaka Head Office</option>
                <option value="MG Sirajganj Factory">MG Sirajganj Factory</option>
                <option value="MBBL-HO">MBBL-HO</option>
                <option value="MGV-PLC">MGV-PLC</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Principal Amount (৳)</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={newDepositForm.principalAmount}
                  onChange={(e) => setNewDepositForm({ ...newDepositForm, principalAmount: Number(e.target.value) })}
                  className="w-full h-9 px-3 text-xs border border-slate-300 rounded font-mono focus:ring-1 focus:ring-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Interest Rate (%)</label>
                <input
                  type="number"
                  step="0.1"
                  value={newDepositForm.interestRate}
                  onChange={(e) => setNewDepositForm({ ...newDepositForm, interestRate: Number(e.target.value) })}
                  className="w-full h-9 px-3 text-xs border border-slate-300 rounded font-mono focus:ring-1 focus:ring-blue-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setIsNewDepositOpen(false)}
              className="px-4 py-2 border border-slate-300 text-slate-600 hover:bg-slate-50 text-xs font-semibold rounded"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-[#2563eb] hover:bg-blue-700 text-white text-xs font-semibold rounded"
            >
              Save Deposit
            </button>
          </div>
        </form>
      </ModalDialog>

      {/* ------------------------------------------------------------- */}
      {/* MODAL 3: ADD BANK LOAN */}
      {/* ------------------------------------------------------------- */}
      <ModalDialog
        isOpen={isNewLoanOpen}
        onClose={() => setIsNewLoanOpen(false)}
        title="Register Bank Loan Facility"
        subtitle="Credit line agreement for BridgeOne Group"
        maxWidth="md"
      >
        <form onSubmit={handleSaveLoan} className="space-y-4">
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Lender Bank</label>
              <input
                type="text"
                required
                value={newLoanForm.lenderName}
                onChange={(e) => setNewLoanForm({ ...newLoanForm, lenderName: e.target.value })}
                className="w-full h-9 px-3 text-xs border border-slate-300 rounded focus:ring-1 focus:ring-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Facility Type</label>
              <select
                value={newLoanForm.loanType}
                onChange={(e) => setNewLoanForm({ ...newLoanForm, loanType: e.target.value })}
                className="w-full h-9 px-3 text-xs border border-slate-300 rounded bg-white focus:ring-1 focus:ring-blue-500 focus:outline-none"
              >
                <option value="Working Capital">Working Capital</option>
                <option value="Term Loan">Term Loan</option>
                <option value="Syndicated Credit Facility">Syndicated Credit Facility</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Principal Amount (৳)</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={newLoanForm.principalAmount}
                  onChange={(e) => setNewLoanForm({ ...newLoanForm, principalAmount: Number(e.target.value) })}
                  className="w-full h-9 px-3 text-xs border border-slate-300 rounded font-mono focus:ring-1 focus:ring-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Interest Rate (%)</label>
                <input
                  type="number"
                  step="0.1"
                  value={newLoanForm.interestRate}
                  onChange={(e) => setNewLoanForm({ ...newLoanForm, interestRate: Number(e.target.value) })}
                  className="w-full h-9 px-3 text-xs border border-slate-300 rounded font-mono focus:ring-1 focus:ring-blue-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setIsNewLoanOpen(false)}
              className="px-4 py-2 border border-slate-300 text-slate-600 hover:bg-slate-50 text-xs font-semibold rounded"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-[#2563eb] hover:bg-blue-700 text-white text-xs font-semibold rounded"
            >
              Save Loan
            </button>
          </div>
        </form>
      </ModalDialog>

      {/* ------------------------------------------------------------- */}
      {/* MODAL 4: ADD LOAN PARTNER */}
      {/* ------------------------------------------------------------- */}
      <ModalDialog
        isOpen={isNewLoanPartnerOpen}
        onClose={() => setIsNewLoanPartnerOpen(false)}
        title="Add Loan Partner"
        subtitle="Register NBFI or Financial Partner"
        maxWidth="md"
      >
        <form onSubmit={handleSaveLoanPartner} className="space-y-4">
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Partner Name</label>
              <input
                type="text"
                required
                value={newPartnerForm.partnerName}
                onChange={(e) => setNewPartnerForm({ ...newPartnerForm, partnerName: e.target.value })}
                placeholder="e.g. IDLC Finance PLC"
                className="w-full h-9 px-3 text-xs border border-slate-300 rounded focus:ring-1 focus:ring-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Partner Group</label>
              <select
                value={newPartnerForm.group}
                onChange={(e) => setNewPartnerForm({ ...newPartnerForm, group: e.target.value })}
                className="w-full h-9 px-3 text-xs border border-slate-300 rounded bg-white focus:ring-1 focus:ring-blue-500 focus:outline-none"
              >
                <option value="NBFI Corporate Partner">NBFI Corporate Partner</option>
                <option value="Equipment Credit Partner">Equipment Credit Partner</option>
                <option value="Working Capital Partner">Working Capital Partner</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Office</label>
              <select
                value={newPartnerForm.officeName}
                onChange={(e) => setNewPartnerForm({ ...newPartnerForm, officeName: e.target.value })}
                className="w-full h-9 px-3 text-xs border border-slate-300 rounded bg-white focus:ring-1 focus:ring-blue-500 focus:outline-none"
              >
                <option value="Dhaka Head Office">Dhaka Head Office</option>
                <option value="MG Sirajganj Factory">MG Sirajganj Factory</option>
                <option value="MGV-PLC">MGV-PLC</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Facility Amount (৳)</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={newPartnerForm.principalFacility}
                  onChange={(e) => setNewPartnerForm({ ...newPartnerForm, principalFacility: Number(e.target.value) })}
                  className="w-full h-9 px-3 text-xs border border-slate-300 rounded font-mono focus:ring-1 focus:ring-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Interest Rate (%)</label>
                <input
                  type="number"
                  step="0.1"
                  value={newPartnerForm.interestRate}
                  onChange={(e) => setNewPartnerForm({ ...newPartnerForm, interestRate: Number(e.target.value) })}
                  className="w-full h-9 px-3 text-xs border border-slate-300 rounded font-mono focus:ring-1 focus:ring-blue-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setIsNewLoanPartnerOpen(false)}
              className="px-4 py-2 border border-slate-300 text-slate-600 hover:bg-slate-50 text-xs font-semibold rounded"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-[#2563eb] hover:bg-blue-700 text-white text-xs font-semibold rounded"
            >
              Save Partner
            </button>
          </div>
        </form>
      </ModalDialog>

      {/* ------------------------------------------------------------- */}
      {/* MODAL 5: BULK UPLOAD */}
      {/* ------------------------------------------------------------- */}
      <ModalDialog
        isOpen={isBulkUploadOpen}
        onClose={() => setIsBulkUploadOpen(false)}
        title="Bulk Upload Loan Partners"
        subtitle="Import multiple loan facilities via Excel spreadsheet (.xlsx, .csv)"
        maxWidth="md"
      >
        <div className="space-y-4">
          <div className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center hover:border-blue-500 transition cursor-pointer bg-slate-50">
            <Upload className="w-8 h-8 text-blue-600 mx-auto mb-2" />
            <p className="text-xs font-semibold text-slate-800">Click to upload or drag and drop</p>
            <p className="text-[11px] text-slate-400 mt-1">Excel (.xlsx) or CSV format up to 10MB</p>
          </div>

          <div className="flex items-center justify-between text-xs bg-blue-50/60 p-2.5 rounded border border-blue-100">
            <span className="text-slate-700 font-medium">Download sample template file:</span>
            <button
              type="button"
              onClick={handleExportExcel}
              className="text-blue-600 font-semibold hover:underline flex items-center gap-1"
            >
              <Download className="w-3 h-3" />
              <span>Sample Template.xlsx</span>
            </button>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setIsBulkUploadOpen(false)}
              className="px-4 py-2 border border-slate-300 text-slate-600 hover:bg-slate-50 text-xs font-semibold rounded"
            >
              Close
            </button>
          </div>
        </div>
      </ModalDialog>

      {/* ------------------------------------------------------------- */}
      {/* MODAL 6: VIEW BANK DETAILS */}
      {/* ------------------------------------------------------------- */}
      {viewBankDetails && (
        <ModalDialog
          isOpen={!!viewBankDetails}
          onClose={() => setViewBankDetails(null)}
          title={viewBankDetails.bankName}
          subtitle={`Account No: ${viewBankDetails.accountNumber} • Branch: ${viewBankDetails.branchName}`}
          maxWidth="md"
        >
          <div className="space-y-3 text-xs">
            <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded border border-slate-200">
              <div>
                <span className="text-slate-400 block text-[11px]">Account Holder:</span>
                <span className="font-semibold text-slate-800">{viewBankDetails.accountHolder}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Account Type:</span>
                <span className="font-semibold text-slate-800">{viewBankDetails.accountType}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Branch:</span>
                <span className="font-semibold text-slate-800">{viewBankDetails.branchName}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Linked GL:</span>
                <span className="font-semibold text-slate-800">{viewBankDetails.glAccountName}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Reconciliation:</span>
                <span className="inline-flex items-center gap-1 font-semibold text-emerald-600">
                  <ShieldCheck className="w-3.5 h-3.5" /> {viewBankDetails.reconciliationStatus}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Available Balance:</span>
                <span className="font-bold text-blue-700 text-sm">৳{viewBankDetails.currentBalance.toLocaleString()}</span>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setViewBankDetails(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold rounded"
              >
                Close
              </button>
            </div>
          </div>
        </ModalDialog>
      )}
    </div>
  );
}
