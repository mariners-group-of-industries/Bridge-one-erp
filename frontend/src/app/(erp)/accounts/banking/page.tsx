"use client";

import { toast } from "@/components/purchase/Toast";
import { Spinner } from "@/components/ui/spinner";
import { usePending } from "@/hooks/use-pending";
import React, { useMemo, useState } from "react";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Download,
  Eye,
  Paperclip,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  Upload,
} from "lucide-react";
import { ModalDialog } from "@/components/purchase/ModalDialog";
import { useAccountingStore } from "@/features/accounts/store/accounting-store";
import { localToday } from "@/features/purchase/lib/client";
import { BANK_NAMES } from "@/features/accounts/banks";

/** Bank account types as iBOS lists them. */
const BANK_ACCOUNT_TYPES = [
  "Savings Account",
  "Current Account",
  "Recurring Deposit Account",
  "Fixed Deposit Account",
  "DEMAT Account",
  "NRI Account",
  "Short Notice Deposit (SND) Account",
  "Bank Overdraft (OD) Account",
  "Payment Against Document (PAD)",
  "SOD against EM",
];
/** Compares types written either way ("CURRENT" and "Current Account" are the same). */
const accountTypeKey = (t: string) => t.toLowerCase().replace(/\baccount\b/g, "").replace(/[^a-z]/g, "");
import type {
  BankAccountItem,
} from "@/features/accounts/types";
import { useFeaturePermissions } from "@/lib/permissions/useFeaturePermissions";
import { NativeDateInput } from "@/components/ui/date-input";

export default function FinanceBankingPage() {
  const perms = useFeaturePermissions("/accounts/banking");
  const { pending, run } = usePending();
  const bankAccounts = useAccountingStore((s) => s.bankAccounts);
  const deposits = useAccountingStore((s) => s.deposits);
  const loans = useAccountingStore((s) => s.loans);
  const factoring = useAccountingStore((s) => s.factoring);
  const loanPartners = useAccountingStore((s) => s.loanPartners);
  const addBankAccount = useAccountingStore((s) => s.addBankAccount);
  const addDeposit = useAccountingStore((s) => s.addDeposit);
  const addLoan = useAccountingStore((s) => s.addLoan);
  const addLoanPartner = useAccountingStore((s) => s.addLoanPartner);
  const offices = useAccountingStore((s) => s.offices);
  const allAccounts = useAccountingStore((s) => s.accounts);
  // Posting accounts (not groups) a bank account or loan can be linked to.
  const assetGlAccounts = useMemo(() => allAccounts.filter((a) => !a.isGroup && a.status === "ACTIVE" && a.accountType === "ASSET"), [allAccounts]);
  const liabilityGlAccounts = useMemo(() => allAccounts.filter((a) => !a.isGroup && a.status === "ACTIVE" && a.accountType === "LIABILITY"), [allAccounts]);
  const firstOffice = offices[0];
  // The iBOS bank list plus any bank already used here (older records may be spelled differently).
  const bankNameOptions = useMemo(
    () => [...new Set<string>([...BANK_NAMES, ...bankAccounts.map((b) => b.bankName).filter(Boolean)])],
    [bankAccounts],
  );

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
  const [page, setPage] = useState(1);
  /** The page shown for a list of n rows (kept in range when filters shrink the list). */
  const pageFor = (n: number) => Math.min(page, Math.max(1, Math.ceil(n / rowsPerPage)));
  const pageRows = <T,>(rows: T[]) => rows.slice((pageFor(rows.length) - 1) * rowsPerPage, pageFor(rows.length) * rowsPerPage);
  const rangeText = (n: number) => (n ? `${(pageFor(n) - 1) * rowsPerPage + 1}–${Math.min(pageFor(n) * rowsPerPage, n)} of ${n}` : "0 of 0");

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
    accountHolder: "",
    accountType: "Current Account",
    accountNumber: "",
    currency: "BDT",
    glAccountId: "",
    glAccountName: "",
    openingBalance: 0,
    reconciliationStatus: "RECONCILED" as const,
    isActive: true,
    shortName: "",
    signatory: "",
  });
  // Branches already used with the chosen bank.
  const knownBranches = useMemo(
    () => [...new Set(bankAccounts.filter((b) => b.bankName === newBankForm.bankName).map((b) => b.branchName).filter(Boolean))],
    [bankAccounts, newBankForm.bankName],
  );

  const blankDepositForm = () => ({
    bankName: "",
    depositType: "Security Deposit",
    officeId: "",
    officeName: "",
    principalAmount: 0,
    interestRate: 0,
    openingDate: localToday(),
    maturityDate: "",
    maturityValue: 0,
    interestEarned: 0,
    status: "ACTIVE",
  });
  const [newDepositForm, setNewDepositForm] = useState(blankDepositForm);

  const blankLoanForm = () => ({
    lenderName: "",
    loanType: "Working Capital",
    category: "BANK" as const,
    officeId: "",
    officeName: "",
    glAccountId: "",
    glAccountName: "",
    partnerGroup: "Corporate Credit",
    principalAmount: 0,
    interestRate: 0,
    disbursementDate: localToday(),
    maturityDate: "",
    installmentAmount: 0,
    outstandingPrincipal: 0,
    accruedInterest: 0,
    tenureMonths: 12,
    status: "ACTIVE",
  });
  const [newLoanForm, setNewLoanForm] = useState(blankLoanForm);

  const blankPartnerForm = () => ({
    partnerName: "",
    group: "NBFI Corporate Partner",
    officeId: "",
    officeName: "",
    accountType: "Lease Finance Facility",
    principalFacility: 0,
    interestRate: 0,
    tenureMonths: 36,
    outstanding: 0,
    status: "ACTIVE" as const,
  });
  const [newPartnerForm, setNewPartnerForm] = useState(blankPartnerForm);

  // Collapsible Card States for Managerium Form Views
  const [isBankCardCollapsed, setIsBankCardCollapsed] = useState(false);
  const [isDepositCardCollapsed, setIsDepositCardCollapsed] = useState(false);
  const [isLoanCardCollapsed, setIsLoanCardCollapsed] = useState(false);
  const [isPartnerCardCollapsed, setIsPartnerCardCollapsed] = useState(false);
  const [isPartnerBankCollapsed, setIsPartnerBankCollapsed] = useState(true);

  // Extra helper states for deposit, loan, partner Managerium fields
  const [depositPoTenderType, setDepositPoTenderType] = useState("Select PO/Tender Type");
  const [depositPoTenderNo, setDepositPoTenderNo] = useState("");
  const [depositLcNo, setDepositLcNo] = useState("");
  const [depositOrgName, setDepositOrgName] = useState("");
  const [depositBranchName, setDepositBranchName] = useState("");
  const [depositAccountNo, setDepositAccountNo] = useState("");
  const [depositRemarks, setDepositRemarks] = useState("");

  const [loanIsFactoring, setLoanIsFactoring] = useState(false);
  const [loanFacility, setLoanFacility] = useState("");
  const [loanLcNo, setLoanLcNo] = useState("");
  const [loanOrgName, setLoanOrgName] = useState("");
  const [loanBranchName, setLoanBranchName] = useState("");
  const [loanAccountNo, setLoanAccountNo] = useState("");
  const [loanLimit, setLoanLimit] = useState("");
  const [createLoanFromDate, setCreateLoanFromDate] = useState("01/11/2026");
  const [createLoanToDate, setCreateLoanToDate] = useState("30/11/2026");
  const [loanTenure, setLoanTenure] = useState("");
  const [loanRefNo, setLoanRefNo] = useState("");
  const [loanRemarks, setLoanRemarks] = useState("");

  const [partnerCode, setPartnerCode] = useState("");
  const [partnerMobile, setPartnerMobile] = useState("");
  const [partnerEmail, setPartnerEmail] = useState("");
  const [partnerSubGroup, setPartnerSubGroup] = useState("");
  const [partnerTcs, setPartnerTcs] = useState("0");
  const [partnerVatReg, setPartnerVatReg] = useState("");
  const [partnerIsAnonymous, setPartnerIsAnonymous] = useState(false);
  const [partnerIsUser, setPartnerIsUser] = useState(false);
  const [partnerAddress, setPartnerAddress] = useState("");
  const [partnerDistrict, setPartnerDistrict] = useState("");
  const [partnerThana, setPartnerThana] = useState("");
  const [partnerContactPerson, setPartnerContactPerson] = useState("");
  const [partnerContactNo, setPartnerContactNo] = useState("");
  const [partnerTaxBracket, setPartnerTaxBracket] = useState("");
  const [partnerRemarks, setPartnerRemarks] = useState("");
  /** The office chosen on a form, or the first office until one is picked. */
  const officeOf = (officeId: string) => offices.find((o) => o.id === officeId) ?? firstOffice;

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
        if (accountTypeKey(b.accountType) !== accountTypeKey(bankAccountTypeFilter)) return false;
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
  const handleSaveBank = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBankForm.bankName || !newBankForm.accountNumber) return;
    const ok = await run("bank", () => addBankAccount(newBankForm));
    if (!ok) return;
    toast.success("Bank account saved.");
    setIsNewBankOpen(false);
    setNewBankForm({
      bankName: "",
      branchName: "",
      accountHolder: "",
      accountType: "Current Account",
      accountNumber: "",
      currency: "BDT",
      glAccountId: "",
      glAccountName: "",
      openingBalance: 0,
      reconciliationStatus: "RECONCILED",
      isActive: true,
      shortName: "",
      signatory: "",
    });
  };

  const handleSaveDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    const office = officeOf(newDepositForm.officeId);
    if (newDepositForm.principalAmount <= 0 || !office) return;
    const ok = await run("deposit", () => addDeposit({ ...newDepositForm, officeId: office.id, officeName: office.name }));
    if (!ok) return;
    toast.success("Deposit saved.");
    setIsNewDepositOpen(false);
    setNewDepositForm(blankDepositForm());
  };

  const handleSaveLoan = async (e: React.FormEvent) => {
    e.preventDefault();
    const office = officeOf(newLoanForm.officeId);
    if (newLoanForm.principalAmount <= 0 || !office) return;
    const ok = await run("loan", () => addLoan({ ...newLoanForm, officeId: office.id, officeName: office.name, outstandingPrincipal: newLoanForm.principalAmount }));
    if (!ok) return;
    toast.success("Loan saved.");
    setIsNewLoanOpen(false);
    setNewLoanForm(blankLoanForm());
  };

  const handleSaveLoanPartner = async (e: React.FormEvent) => {
    e.preventDefault();
    const office = officeOf(newPartnerForm.officeId);
    if (!newPartnerForm.partnerName || !office) return;
    const ok = await run("partner", () => addLoanPartner({ ...newPartnerForm, officeId: office.id, officeName: office.name, outstanding: newPartnerForm.principalFacility }));
    if (!ok) return;
    toast.success("Loan partner saved.");
    setIsNewLoanPartnerOpen(false);
    setNewPartnerForm(blankPartnerForm());
  };

  // -------------------------------------------------------------
  // BRIDGEONE ERP BRANDED EMPTY STATE
  // -------------------------------------------------------------
  const renderBridgeOneEmptyState = (message: string = "No Data Found") => (
    <div className="py-24 flex flex-col items-center justify-center text-center select-none bg-surface">
      <div className="relative mb-4 flex items-center justify-center">
        <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-blue-700 via-indigo-600 to-sky-500 flex items-center justify-center shadow-lg shadow-blue-500/20 text-white font-black text-2xl tracking-tighter">
          B1
        </div>
        <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-emerald-500 border-2 border-surface flex items-center justify-center text-white">
          <Check className="w-3.5 h-3.5 stroke-[3]" />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-2xl font-black tracking-tight text-ink">
          Bridge<span className="text-blue-600 dark:text-blue-400">One</span>
        </span>
        <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-500/30">
          ERP
        </span>
      </div>
      <h3 className="text-base font-bold text-ink mt-2">{message}</h3>
      <p className="text-xs text-ink-faint mt-1 max-w-sm">
        No records found matching the active filter criteria. Adjust the dropdown filters or click View to refresh data.
      </p>
    </div>
  );

  // -------------------------------------------------------------
  // FULL-PAGE MANAGERIUM FORM VIEWS (MATCHING SCREENSHOTS)
  // -------------------------------------------------------------

  // 1. Create Bank Account (Screenshot 1)
  if (isNewBankOpen) {
    const inputCls =
      "h-8 w-full border border-slate-300 rounded px-2.5 text-xs text-slate-800 bg-white placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500";
    return (
      <div className="min-h-screen bg-[#f8fafc] p-3 md:p-6 text-slate-800">
        <div className="bg-white border border-slate-200/90 rounded px-4 py-2.5 flex items-center justify-between shadow-2xs mb-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsNewBankOpen(false)}
              className="h-8 w-8 rounded border border-slate-300 flex items-center justify-center text-slate-600 hover:bg-slate-50 transition"
              title="Back"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <h1 className="text-base font-bold text-slate-900 tracking-tight">Create Bank Account</h1>
          </div>
          <button
            type="submit"
            form="create-bank-form"
            disabled={pending === "bank"}
            className="h-8 px-5 bg-[#2563eb] hover:bg-blue-700 text-white font-semibold text-xs rounded transition flex items-center gap-1.5 shadow-2xs disabled:opacity-50"
          >
            {pending === "bank" && <Spinner className="size-3.5" />}
            Save
          </button>
        </div>

        <div className="bg-white border border-slate-200/90 rounded shadow-2xs overflow-hidden mb-3">
          <div className="flex items-center justify-between border-b border-slate-200 bg-white px-3 pt-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="px-4 py-2 text-xs font-semibold rounded-t bg-[#e6f2fb] text-blue-700 border-b-2 border-blue-600 transition"
              >
                Bank Account
              </button>
            </div>
            <button
              type="button"
              onClick={() => setIsBankCardCollapsed(!isBankCardCollapsed)}
              className="p-1.5 text-slate-400 hover:text-slate-600 rounded transition"
            >
              {isBankCardCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
            </button>
          </div>

          {!isBankCardCollapsed && (
            <form id="create-bank-form" onSubmit={handleSaveBank} className="p-4 space-y-3.5">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    <span className="text-red-500 font-bold mr-0.5">*</span>Account Name
                  </label>
                  <input
                    type="text"
                    required
                    value={newBankForm.accountHolder}
                    onChange={(e) => setNewBankForm({ ...newBankForm, accountHolder: e.target.value })}
                    placeholder="Account Name"
                    className={inputCls}
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    <span className="text-red-500 font-bold mr-0.5">*</span>Bank Name
                  </label>
                  <select
                    required
                    value={newBankForm.bankName}
                    onChange={(e) => setNewBankForm({ ...newBankForm, bankName: e.target.value, branchName: "" })}
                    className={inputCls}
                  >
                    <option value="">Bank Name</option>
                    {bankNameOptions.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <div className="mb-1 flex items-center justify-between">
                    <label className="text-xs font-semibold text-slate-700">
                      <span className="text-red-500 font-bold mr-0.5">*</span>Branch Name
                    </label>
                    <span className="text-[10px] font-semibold text-blue-600">+ ADD NEW</span>
                  </div>
                  <input
                    type="text"
                    required
                    list="bank-branch-options"
                    value={newBankForm.branchName}
                    onChange={(e) => setNewBankForm({ ...newBankForm, branchName: e.target.value })}
                    placeholder="Branch Name"
                    className={inputCls}
                  />
                  <datalist id="bank-branch-options">
                    {knownBranches.map((b) => (
                      <option key={b} value={b} />
                    ))}
                  </datalist>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    <span className="text-red-500 font-bold mr-0.5">*</span>Bank Account Type
                  </label>
                  <select
                    value={newBankForm.accountType}
                    onChange={(e) => setNewBankForm({ ...newBankForm, accountType: e.target.value })}
                    className={inputCls}
                  >
                    {BANK_ACCOUNT_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    <span className="text-red-500 font-bold mr-0.5">*</span>Bank Account Number
                  </label>
                  <input
                    type="text"
                    required
                    value={newBankForm.accountNumber}
                    onChange={(e) => setNewBankForm({ ...newBankForm, accountNumber: e.target.value })}
                    placeholder="Bank Account Number"
                    className={inputCls}
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    <span className="text-red-500 font-bold mr-0.5">*</span>Bank Short Name
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={50}
                    value={newBankForm.shortName}
                    onChange={(e) => setNewBankForm({ ...newBankForm, shortName: e.target.value })}
                    placeholder="Bank Short Name"
                    className={inputCls}
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">Signatory</label>
                <textarea
                  rows={2}
                  maxLength={500}
                  value={newBankForm.signatory}
                  onChange={(e) => setNewBankForm({ ...newBankForm, signatory: e.target.value })}
                  placeholder="Signatory"
                  className="w-full max-w-2xl px-2.5 py-1.5 text-xs border border-slate-300 rounded focus:ring-1 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 max-w-xl pt-1">
                <div>
                  <label className="mb-1 block text-[11px] font-semibold text-slate-700">Opening Balance (৳)</label>
                  <input
                    type="number"
                    min="0"
                    value={newBankForm.openingBalance}
                    onChange={(e) => setNewBankForm({ ...newBankForm, openingBalance: Number(e.target.value) })}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-semibold text-slate-700">GL Account (Chart of A/C)</label>
                  <select
                    value={newBankForm.glAccountId}
                    onChange={(e) => {
                      const acc = assetGlAccounts.find((a) => a.id === e.target.value);
                      setNewBankForm({ ...newBankForm, glAccountId: acc?.id ?? "", glAccountName: acc?.name ?? "" });
                    }}
                    className={inputCls}
                  >
                    <option value="">Not linked</option>
                    {assetGlAccounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.code} - {a.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </form>
          )}
        </div>
      </div>
    );
  }

  // 2. Create Deposits (Screenshot 2)
  if (isNewDepositOpen) {
    const inputCls =
      "h-8 w-full border border-slate-300 rounded px-2.5 text-xs text-slate-800 bg-white placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500";
    return (
      <div className="min-h-screen bg-[#f8fafc] p-3 md:p-6 text-slate-800">
        <div className="bg-white border border-slate-200/90 rounded px-4 py-2.5 flex items-center justify-between shadow-2xs mb-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsNewDepositOpen(false)}
              className="h-8 w-8 rounded border border-slate-300 flex items-center justify-center text-slate-600 hover:bg-slate-50 transition"
              title="Back"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <h1 className="text-base font-bold text-slate-900 tracking-tight">Create Deposits</h1>
          </div>
          <button
            type="submit"
            form="create-deposit-form"
            disabled={pending === "deposit"}
            className="h-8 px-5 bg-[#2563eb] hover:bg-blue-700 text-white font-semibold text-xs rounded transition flex items-center gap-1.5 shadow-2xs disabled:opacity-50"
          >
            {pending === "deposit" && <Spinner className="size-3.5" />}
            Save
          </button>
        </div>

        <div className="bg-white border border-slate-200/90 rounded shadow-2xs overflow-hidden mb-3">
          <div className="flex items-center justify-between border-b border-slate-200 bg-white px-3 pt-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="px-4 py-2 text-xs font-semibold rounded-t bg-[#e6f2fb] text-blue-700 border-b-2 border-blue-600 transition"
              >
                Deposit
              </button>
            </div>
            <button
              type="button"
              onClick={() => setIsDepositCardCollapsed(!isDepositCardCollapsed)}
              className="p-1.5 text-slate-400 hover:text-slate-600 rounded transition"
            >
              {isDepositCardCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
            </button>
          </div>

          {!isDepositCardCollapsed && (
            <form id="create-deposit-form" onSubmit={handleSaveDeposit} className="p-4 space-y-3.5">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    <span className="text-red-500 font-bold mr-0.5">*</span>Date
                  </label>
                  <NativeDateInput
                    type="date"
                    required
                    value={newDepositForm.openingDate}
                    onChange={(e) => setNewDepositForm({ ...newDepositForm, openingDate: e.target.value })}
                    className={inputCls}
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    <span className="text-red-500 font-bold mr-0.5">*</span>Office
                  </label>
                  <select
                    value={officeOf(newDepositForm.officeId)?.id ?? ""}
                    onChange={(e) => setNewDepositForm({ ...newDepositForm, officeId: e.target.value })}
                    className={inputCls}
                  >
                    {offices.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    <span className="text-red-500 font-bold mr-0.5">*</span>Type
                  </label>
                  <select
                    value={newDepositForm.depositType}
                    onChange={(e) => setNewDepositForm({ ...newDepositForm, depositType: e.target.value })}
                    className={inputCls}
                  >
                    <option value="Security Deposit">Security Deposit</option>
                    <option value="Fixed Deposit">Fixed Deposit (FDR)</option>
                    <option value="Term Deposit">Term Deposit (TDR)</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    <span className="text-red-500 font-bold mr-0.5">*</span>PO/Tender Type
                  </label>
                  <select
                    value={depositPoTenderType}
                    onChange={(e) => setDepositPoTenderType(e.target.value)}
                    className={inputCls}
                  >
                    <option value="Select PO/Tender Type">Select PO/Tender Type</option>
                    <option value="PO">Purchase Order (PO)</option>
                    <option value="Tender">Government / Corporate Tender</option>
                    <option value="Direct Contract">Direct Contract</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    <span className="text-red-500 font-bold mr-0.5">*</span>PO/Tender No.
                  </label>
                  <input
                    type="text"
                    value={depositPoTenderNo}
                    onChange={(e) => setDepositPoTenderNo(e.target.value)}
                    placeholder="PO/Tender No"
                    className={inputCls}
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    <span className="text-red-500 font-bold mr-0.5">*</span>LC No
                  </label>
                  <input
                    type="text"
                    value={depositLcNo}
                    onChange={(e) => setDepositLcNo(e.target.value)}
                    placeholder="LC No"
                    className={inputCls}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    <span className="text-red-500 font-bold mr-0.5">*</span>Organization Name
                  </label>
                  <input
                    type="text"
                    value={depositOrgName}
                    onChange={(e) => setDepositOrgName(e.target.value)}
                    placeholder="Organization Name"
                    className={inputCls}
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    <span className="text-red-500 font-bold mr-0.5">*</span>Bank Name
                  </label>
                  <input
                    type="text"
                    required
                    value={newDepositForm.bankName}
                    onChange={(e) => setNewDepositForm({ ...newDepositForm, bankName: e.target.value })}
                    placeholder="Select Bank Name"
                    className={inputCls}
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    <span className="text-red-500 font-bold mr-0.5">*</span>Branch Name
                  </label>
                  <input
                    type="text"
                    value={depositBranchName}
                    onChange={(e) => setDepositBranchName(e.target.value)}
                    placeholder="Select Branch Name"
                    className={inputCls}
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    <span className="text-red-500 font-bold mr-0.5">*</span>Account No
                  </label>
                  <input
                    type="text"
                    value={depositAccountNo}
                    onChange={(e) => setDepositAccountNo(e.target.value)}
                    placeholder="Account No (18 Digits Only)"
                    className={inputCls}
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">Principle Amount</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={newDepositForm.principalAmount || ""}
                    onChange={(e) => setNewDepositForm({ ...newDepositForm, principalAmount: Number(e.target.value) })}
                    placeholder="Principle Amount"
                    className={inputCls}
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">Remarks</label>
                  <input
                    type="text"
                    value={depositRemarks}
                    onChange={(e) => setDepositRemarks(e.target.value)}
                    placeholder="Remarks"
                    className={inputCls}
                  />
                </div>
              </div>
            </form>
          )}
        </div>
      </div>
    );
  }

  // 3. Create Loans (Screenshot 3)
  if (isNewLoanOpen) {
    const inputCls =
      "h-8 w-full border border-slate-300 rounded px-2.5 text-xs text-slate-800 bg-white placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500";
    return (
      <div className="min-h-screen bg-[#f8fafc] p-3 md:p-6 text-slate-800">
        <div className="bg-white border border-slate-200/90 rounded px-4 py-2.5 flex items-center justify-between shadow-2xs mb-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsNewLoanOpen(false)}
              className="h-8 w-8 rounded border border-slate-300 flex items-center justify-center text-slate-600 hover:bg-slate-50 transition"
              title="Back"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <h1 className="text-base font-bold text-slate-900 tracking-tight">Create Loans</h1>
          </div>
          <button
            type="submit"
            form="create-loan-form"
            disabled={pending === "loan"}
            className="h-8 px-5 bg-[#2563eb] hover:bg-blue-700 text-white font-semibold text-xs rounded transition flex items-center gap-1.5 shadow-2xs disabled:opacity-50"
          >
            {pending === "loan" && <Spinner className="size-3.5" />}
            Save
          </button>
        </div>

        <div className="bg-white border border-slate-200/90 rounded shadow-2xs overflow-hidden mb-3">
          <div className="flex items-center justify-between border-b border-slate-200 bg-white px-3 pt-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="px-4 py-2 text-xs font-semibold rounded-t bg-[#e6f2fb] text-blue-700 border-b-2 border-blue-600 transition"
              >
                Loan
              </button>
            </div>
            <button
              type="button"
              onClick={() => setIsLoanCardCollapsed(!isLoanCardCollapsed)}
              className="p-1.5 text-slate-400 hover:text-slate-600 rounded transition"
            >
              {isLoanCardCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
            </button>
          </div>

          {!isLoanCardCollapsed && (
            <form id="create-loan-form" onSubmit={handleSaveLoan} className="p-4 space-y-3.5">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-700 pb-1">
                <input
                  type="checkbox"
                  id="isFactoring"
                  checked={loanIsFactoring}
                  onChange={(e) => setLoanIsFactoring(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-blue-600"
                />
                <label htmlFor="isFactoring" className="cursor-pointer">
                  Is Factoring
                </label>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    <span className="text-red-500 font-bold mr-0.5">*</span>Date
                  </label>
                  <NativeDateInput
                    type="date"
                    required
                    value={newLoanForm.disbursementDate}
                    onChange={(e) => setNewLoanForm({ ...newLoanForm, disbursementDate: e.target.value })}
                    className={inputCls}
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    <span className="text-red-500 font-bold mr-0.5">*</span>Office
                  </label>
                  <select
                    value={officeOf(newLoanForm.officeId)?.id ?? ""}
                    onChange={(e) => setNewLoanForm({ ...newLoanForm, officeId: e.target.value })}
                    className={inputCls}
                  >
                    {offices.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    <span className="text-red-500 font-bold mr-0.5">*</span>Type
                  </label>
                  <select
                    value={newLoanForm.loanType}
                    onChange={(e) => setNewLoanForm({ ...newLoanForm, loanType: e.target.value })}
                    className={inputCls}
                  >
                    <option value="Working Capital">Working Capital</option>
                    <option value="Term Loan">Term Loan</option>
                    <option value="Syndicated Credit Facility">Syndicated Credit Facility</option>
                  </select>
                </div>

                <div>
                  <div className="mb-1 flex items-center justify-between">
                    <label className="text-xs font-semibold text-slate-700">
                      <span className="text-red-500 font-bold mr-0.5">*</span>Loan Facility
                    </label>
                    <span className="text-[10px] font-semibold text-blue-600">+ ADD NEW</span>
                  </div>
                  <input
                    type="text"
                    value={loanFacility}
                    onChange={(e) => setLoanFacility(e.target.value)}
                    placeholder="Select Loan Facility"
                    className={inputCls}
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">Lc No</label>
                  <input
                    type="text"
                    value={loanLcNo}
                    onChange={(e) => setLoanLcNo(e.target.value)}
                    placeholder="Select/Search LcNo"
                    className={inputCls}
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    <span className="text-red-500 font-bold mr-0.5">*</span>Organization Name
                  </label>
                  <input
                    type="text"
                    value={loanOrgName}
                    onChange={(e) => setLoanOrgName(e.target.value)}
                    placeholder="Organization Name"
                    className={inputCls}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    <span className="text-red-500 font-bold mr-0.5">*</span>Bank Name
                  </label>
                  <input
                    type="text"
                    required
                    value={newLoanForm.lenderName}
                    onChange={(e) => setNewLoanForm({ ...newLoanForm, lenderName: e.target.value })}
                    placeholder="Select Bank Name"
                    className={inputCls}
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    <span className="text-red-500 font-bold mr-0.5">*</span>Branch Name
                  </label>
                  <input
                    type="text"
                    value={loanBranchName}
                    onChange={(e) => setLoanBranchName(e.target.value)}
                    placeholder="Select Branch Name"
                    className={inputCls}
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    <span className="text-red-500 font-bold mr-0.5">*</span>Account No
                  </label>
                  <input
                    type="text"
                    value={loanAccountNo}
                    onChange={(e) => setLoanAccountNo(e.target.value)}
                    placeholder="Account No (18 Digits Only)"
                    className={inputCls}
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">Principle Amount</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={newLoanForm.principalAmount || ""}
                    onChange={(e) => setNewLoanForm({ ...newLoanForm, principalAmount: Number(e.target.value) })}
                    placeholder="Principle Amount"
                    className={inputCls}
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">Interest Rate %</label>
                  <input
                    type="number"
                    step="0.1"
                    value={newLoanForm.interestRate || ""}
                    onChange={(e) => setNewLoanForm({ ...newLoanForm, interestRate: Number(e.target.value) })}
                    placeholder="Interest Rate %"
                    className={inputCls}
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">Limit</label>
                  <input
                    type="text"
                    value={loanLimit}
                    onChange={(e) => setLoanLimit(e.target.value)}
                    placeholder="Limit"
                    className={inputCls}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">From Date</label>
                  <NativeDateInput
                    type="date"
                    value={createLoanFromDate}
                    onChange={(e) => setCreateLoanFromDate(e.target.value)}
                    className={inputCls}
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">To Date</label>
                  <NativeDateInput
                    type="date"
                    value={createLoanToDate}
                    onChange={(e) => setCreateLoanToDate(e.target.value)}
                    className={inputCls}
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">Tenure</label>
                  <input
                    type="text"
                    value={loanTenure}
                    onChange={(e) => setLoanTenure(e.target.value)}
                    placeholder="Tenure"
                    className={inputCls}
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    <span className="text-red-500 font-bold mr-0.5">*</span>General Ledger
                  </label>
                  <select
                    value={newLoanForm.glAccountId}
                    onChange={(e) => {
                      const acc = liabilityGlAccounts.find((a) => a.id === e.target.value);
                      setNewLoanForm({ ...newLoanForm, glAccountId: acc?.id ?? "", glAccountName: acc?.name ?? "" });
                    }}
                    className={inputCls}
                  >
                    <option value="">Select General Ledger</option>
                    {liabilityGlAccounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.code} - {a.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    <span className="text-red-500 font-bold mr-0.5">*</span>Maturity Date
                  </label>
                  <NativeDateInput
                    type="date"
                    value={newLoanForm.maturityDate}
                    onChange={(e) => setNewLoanForm({ ...newLoanForm, maturityDate: e.target.value })}
                    className={inputCls}
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">Loan Reference No.</label>
                  <input
                    type="text"
                    value={loanRefNo}
                    onChange={(e) => setLoanRefNo(e.target.value)}
                    placeholder="Loan Reference No."
                    className={inputCls}
                  />
                </div>
              </div>

              <div className="max-w-md">
                <label className="mb-1 block text-xs font-semibold text-slate-700">Remarks</label>
                <input
                  type="text"
                  value={loanRemarks}
                  onChange={(e) => setLoanRemarks(e.target.value)}
                  placeholder="Remarks"
                  className={inputCls}
                />
              </div>
            </form>
          )}
        </div>
      </div>
    );
  }

  // 4. Create Partner (Screenshot 4)
  if (isNewLoanPartnerOpen) {
    const inputCls =
      "h-8 w-full border border-slate-300 rounded px-2.5 text-xs text-slate-800 bg-white placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500";
    return (
      <div className="min-h-screen bg-[#f8fafc] p-3 md:p-6 text-slate-800">
        <div className="bg-white border border-slate-200/90 rounded px-4 py-2.5 flex items-center justify-between shadow-2xs mb-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsNewLoanPartnerOpen(false)}
              className="h-8 w-8 rounded border border-slate-300 flex items-center justify-center text-slate-600 hover:bg-slate-50 transition"
              title="Back"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <h1 className="text-base font-bold text-slate-900 tracking-tight">Create Partner</h1>
          </div>
          <button
            type="submit"
            form="create-partner-form"
            disabled={pending === "partner"}
            className="h-8 px-5 bg-[#2563eb] hover:bg-blue-700 text-white font-semibold text-xs rounded transition flex items-center gap-1.5 shadow-2xs disabled:opacity-50"
          >
            {pending === "partner" && <Spinner className="size-3.5" />}
            SAVE
          </button>
        </div>

        <form id="create-partner-form" onSubmit={handleSaveLoanPartner} className="space-y-3">
          <div className="bg-white border border-slate-200/90 rounded shadow-2xs overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-200 bg-white px-3 py-2">
              <h2 className="text-xs font-bold text-slate-800">Partner Details</h2>
              <button
                type="button"
                onClick={() => setIsPartnerCardCollapsed(!isPartnerCardCollapsed)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded transition"
              >
                {isPartnerCardCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
              </button>
            </div>
            {!isPartnerCardCollapsed && (
              <div className="p-4 space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">
                  <span className="text-red-500 font-bold mr-0.5">*</span>Office
                </label>
                <select
                  value={officeOf(newPartnerForm.officeId)?.id ?? ""}
                  onChange={(e) => setNewPartnerForm({ ...newPartnerForm, officeId: e.target.value })}
                  className={inputCls}
                >
                  {offices.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">
                  <span className="text-red-500 font-bold mr-0.5">*</span>Partner Name
                </label>
                <input
                  type="text"
                  required
                  value={newPartnerForm.partnerName}
                  onChange={(e) => setNewPartnerForm({ ...newPartnerForm, partnerName: e.target.value })}
                  placeholder="Partner Name"
                  className={inputCls}
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">Partner Code</label>
                <input
                  type="text"
                  value={partnerCode}
                  onChange={(e) => setPartnerCode(e.target.value)}
                  placeholder="Partner Code"
                  className={inputCls}
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">
                  <span className="text-red-500 font-bold mr-0.5">*</span>Mobile No
                </label>
                <input
                  type="text"
                  value={partnerMobile}
                  onChange={(e) => setPartnerMobile(e.target.value)}
                  placeholder="Mobile No"
                  className={inputCls}
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">Email</label>
                <input
                  type="email"
                  value={partnerEmail}
                  onChange={(e) => setPartnerEmail(e.target.value)}
                  placeholder="Email"
                  className={inputCls}
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">
                  <span className="text-red-500 font-bold mr-0.5">*</span>Account Type
                </label>
                <select
                  value={newPartnerForm.accountType}
                  onChange={(e) => setNewPartnerForm({ ...newPartnerForm, accountType: e.target.value })}
                  className={inputCls}
                >
                  <option value="Lease Finance Facility">Lease Finance Facility</option>
                  <option value="Corporate Credit Partner">Corporate Credit Partner</option>
                  <option value="NBFI Partner">NBFI Partner</option>
                  <option value="Supplier/Vendor">Supplier/Vendor</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-700">Partner Group</label>
                  <span className="text-[10px] font-semibold text-blue-600">+ ADD NEW</span>
                </div>
                <select
                  value={newPartnerForm.group}
                  onChange={(e) => setNewPartnerForm({ ...newPartnerForm, group: e.target.value })}
                  className={inputCls}
                >
                  <option value="NBFI Corporate Partner">NBFI Corporate Partner</option>
                  <option value="Equipment Credit Partner">Equipment Credit Partner</option>
                  <option value="Working Capital Partner">Working Capital Partner</option>
                </select>
              </div>

              <div>
                <div className="mb-1 flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-700">Sub Group</label>
                  <span className="text-[10px] font-semibold text-blue-600">+ ADD NEW</span>
                </div>
                <input
                  type="text"
                  value={partnerSubGroup}
                  onChange={(e) => setPartnerSubGroup(e.target.value)}
                  placeholder="Partner Sub Group"
                  className={inputCls}
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">Tax Collected at Source (TCS) %</label>
                <input
                  type="number"
                  value={partnerTcs}
                  onChange={(e) => setPartnerTcs(e.target.value)}
                  placeholder="0"
                  className={inputCls}
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">VAT Reg No (Central)</label>
                <input
                  type="text"
                  value={partnerVatReg}
                  onChange={(e) => setPartnerVatReg(e.target.value)}
                  placeholder="VAT Reg No"
                  className={inputCls}
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">Facility Amount (৳)</label>
                <input
                  type="number"
                  min="0"
                  value={newPartnerForm.principalFacility || ""}
                  onChange={(e) => setNewPartnerForm({ ...newPartnerForm, principalFacility: Number(e.target.value) })}
                  placeholder="Facility Amount"
                  className={inputCls}
                />
              </div>
            </div>
            </div>
          )}
          </div>

          <div className="bg-white border border-slate-200/90 rounded shadow-2xs p-4 space-y-2">
            <h2 className="text-xs font-bold text-slate-800">Others Flags</h2>
            <div className="flex items-center gap-6 pt-1">
              <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={partnerIsAnonymous}
                  onChange={(e) => setPartnerIsAnonymous(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-blue-600"
                />
                <span>IsAnonymous</span>
              </label>
              <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={partnerIsUser}
                  onChange={(e) => setPartnerIsUser(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-blue-600"
                />
                <span>User</span>
              </label>
            </div>
          </div>

          <div className="bg-white border border-slate-200/90 rounded shadow-2xs p-4 space-y-3">
            <h2 className="text-xs font-bold text-slate-800">Billing Details</h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">Billing Address</label>
                <input
                  type="text"
                  value={partnerAddress}
                  onChange={(e) => setPartnerAddress(e.target.value)}
                  placeholder="Billing Address"
                  className={inputCls}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">District</label>
                <input
                  type="text"
                  value={partnerDistrict}
                  onChange={(e) => setPartnerDistrict(e.target.value)}
                  placeholder="District"
                  className={inputCls}
                />
              </div>
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-700">Thana</label>
                  <span className="text-[10px] font-semibold text-blue-600">+ ADD NEW</span>
                </div>
                <input
                  type="text"
                  value={partnerThana}
                  onChange={(e) => setPartnerThana(e.target.value)}
                  placeholder="Thana"
                  className={inputCls}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">Contact Person</label>
                <input
                  type="text"
                  value={partnerContactPerson}
                  onChange={(e) => setPartnerContactPerson(e.target.value)}
                  placeholder="Contact Person"
                  className={inputCls}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">Contact No</label>
                <input
                  type="text"
                  value={partnerContactNo}
                  onChange={(e) => setPartnerContactNo(e.target.value)}
                  placeholder="Contact No"
                  className={inputCls}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">Tax Bracket</label>
                <input
                  type="text"
                  value={partnerTaxBracket}
                  onChange={(e) => setPartnerTaxBracket(e.target.value)}
                  placeholder="Tax Bracket"
                  className={inputCls}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 pt-1 max-w-xl">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">Remarks/ Note</label>
                <input
                  type="text"
                  value={partnerRemarks}
                  onChange={(e) => setPartnerRemarks(e.target.value)}
                  placeholder="Remarks/ Note"
                  className={inputCls}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">Attachment</label>
                <button
                  type="button"
                  className="inline-flex h-8 items-center gap-1.5 rounded border border-slate-300 px-2.5 text-xs text-slate-600 hover:bg-slate-50"
                >
                  <Paperclip className="h-3.5 w-3.5" />
                  Attach
                </button>
              </div>
            </div>
          </div>

          <div className="bg-white border border-slate-200/90 rounded shadow-2xs overflow-hidden">
            <button
              type="button"
              onClick={() => setIsPartnerBankCollapsed(!isPartnerBankCollapsed)}
              className="w-full flex items-center justify-between p-4 text-xs font-bold text-slate-800 hover:bg-slate-50 transition"
            >
              <span>Partner Bank Information</span>
              {isPartnerBankCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
            </button>
            {!isPartnerBankCollapsed && (
              <div className="p-4 border-t border-slate-200 text-xs text-slate-500">
                No bank accounts linked to this partner yet.
              </div>
            )}
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="space-y-2.5 font-sans bg-canvas flex flex-col md:h-[calc(100dvh-3.5rem)] md:overflow-hidden print:block print:h-auto print:overflow-visible">
      {/* ------------------------------------------------------------- */}
      {/* 1. TOP BAR: Title & Tab-Specific Action Buttons */}
      {/* ------------------------------------------------------------- */}
      <div className="bg-surface px-4 py-3 rounded-t border-b border-line flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs shrink-0">
        <div>
          <h1 className="text-lg font-bold text-ink tracking-tight">Finance and Banking</h1>
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
                className="w-44 sm:w-56 h-8 pl-3 pr-7 text-xs border border-line-strong rounded focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-surface placeholder:text-ink-faint"
              />
              <Search className="w-3.5 h-3.5 text-ink-faint absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          )}

          {/* TAB 1: + Regular Banking */}
          {activeTab === "REGULAR_BANKING" && (
            (perms.create ? (<button
              type="button"
              onClick={() => setIsNewBankOpen(true)}
              className="h-8 px-3.5 bg-[#2563eb] hover:bg-blue-700 text-white font-semibold text-xs rounded flex items-center gap-1.5 shadow-xs transition"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Regular Banking</span>
            </button>) : null)
          )}

          {/* TAB 2: + Deposits */}
          {activeTab === "DEPOSITS" && (
            (perms.create ? (<button
              type="button"
              onClick={() => setIsNewDepositOpen(true)}
              className="h-8 px-3.5 bg-[#2563eb] hover:bg-blue-700 text-white font-semibold text-xs rounded flex items-center gap-1.5 shadow-xs transition"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Deposits</span>
            </button>) : null)
          )}

          {/* TAB 3: Excel + + Loans */}
          {activeTab === "LOANS_BANK" && (
            <>
              {perms.export && (<button
                type="button"
                onClick={handleExportExcel}
                className="h-8 px-3 bg-[#2563eb] hover:bg-blue-700 text-white font-semibold text-xs rounded flex items-center gap-1.5 shadow-xs transition"
                title="Download Excel Report"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Excel</span>
              </button>)}
              {perms.create && (<button
                type="button"
                onClick={() => setIsNewLoanOpen(true)}
                className="h-8 px-3.5 bg-[#2563eb] hover:bg-blue-700 text-white font-semibold text-xs rounded flex items-center gap-1.5 shadow-xs transition"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Loans</span>
              </button>)}
            </>
          )}

          {/* TAB 4: Print/PDF */}
          {activeTab === "FACTORING_REPORT" && (
            (perms.export ? (<button
              type="button"
              onClick={() => window.print()}
              className="h-8 px-3.5 bg-[#2563eb] hover:bg-blue-700 text-white font-semibold text-xs rounded flex items-center gap-1.5 shadow-xs transition"
            >
              <span>Print/PDF</span>
            </button>) : null)
          )}

          {/* TAB 5: EXCEL + + Bulk Upload + + Loan Partner */}
          {activeTab === "LOAN_OTHERS" && (
            <>
              {perms.export && (<button
                type="button"
                onClick={handleExportExcel}
                className="h-8 px-3 bg-surface border border-line-strong text-ink-muted hover:bg-canvas font-semibold text-xs rounded flex items-center gap-1.5 shadow-2xs transition"
                title="Download Excel Report"
              >
                <Download className="w-3.5 h-3.5 text-ink-faint" />
                <span>EXCEL</span>
              </button>)}
              {perms.create && (<button
                type="button"
                onClick={() => setIsBulkUploadOpen(true)}
                className="h-8 px-3.5 bg-[#2563eb] hover:bg-blue-700 text-white font-semibold text-xs rounded flex items-center gap-1.5 shadow-xs transition"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Bulk Upload</span>
              </button>)}
              {perms.create && (<button
                type="button"
                onClick={() => setIsNewLoanPartnerOpen(true)}
                className="h-8 px-3.5 bg-[#2563eb] hover:bg-blue-700 text-white font-semibold text-xs rounded flex items-center gap-1.5 shadow-xs transition"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Loan Partner</span>
              </button>)}
            </>
          )}
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 2. TABS BAR (Exact 5 tabs from user screenshots) */}
      {/* ------------------------------------------------------------- */}
      <div className="bg-surface border-b border-line px-4 pt-1 flex items-center gap-7 overflow-x-auto select-none shrink-0">
        <button
          type="button"
          onClick={() => setActiveTab("REGULAR_BANKING")}
          className={`pb-2.5 text-xs font-bold tracking-wide transition-colors uppercase whitespace-nowrap ${
            activeTab === "REGULAR_BANKING"
              ? "text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 -mb-[1px]"
              : "text-ink-faint hover:text-ink"
          }`}
        >
          REGULAR BANKING
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("DEPOSITS")}
          className={`pb-2.5 text-xs font-bold tracking-wide transition-colors uppercase whitespace-nowrap ${
            activeTab === "DEPOSITS"
              ? "text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 -mb-[1px]"
              : "text-ink-faint hover:text-ink"
          }`}
        >
          DEPOSITS
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("LOANS_BANK")}
          className={`pb-2.5 text-xs font-bold tracking-wide transition-colors uppercase whitespace-nowrap ${
            activeTab === "LOANS_BANK"
              ? "text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 -mb-[1px]"
              : "text-ink-faint hover:text-ink"
          }`}
        >
          LOANS (BANK)
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("FACTORING_REPORT")}
          className={`pb-2.5 text-xs font-bold tracking-wide transition-colors uppercase whitespace-nowrap ${
            activeTab === "FACTORING_REPORT"
              ? "text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 -mb-[1px]"
              : "text-ink-faint hover:text-ink"
          }`}
        >
          FACTORING REPORT
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("LOAN_OTHERS")}
          className={`pb-2.5 text-xs font-bold tracking-wide transition-colors uppercase whitespace-nowrap ${
            activeTab === "LOAN_OTHERS"
              ? "text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 -mb-[1px]"
              : "text-ink-faint hover:text-ink"
          }`}
        >
          LOAN (OTHERS)
        </button>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 3. TAB 1: REGULAR BANKING (Screenshot 1) */}
      {/* ------------------------------------------------------------- */}
      {activeTab === "REGULAR_BANKING" && (
        <div className="bg-surface border-t border-line flex-1 min-h-0 flex flex-col print:block">
          {/* Filter Bar */}
          <div className="px-4 py-3 border-b border-line/80 flex flex-wrap items-center gap-3 shrink-0">
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-ink-muted">Bank Account Type</label>
              <select
                value={bankAccountTypeFilter}
                onChange={(e) => setBankAccountTypeFilter(e.target.value)}
                className="h-8 w-60 border border-line-strong rounded px-2.5 text-xs bg-surface text-ink focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="ALL">Bank Account Type</option>
                {BANK_ACCOUNT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
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
          <div className="flex-1 min-h-0 overflow-auto print:overflow-visible [&_thead]:sticky [&_thead]:top-0 [&_thead]:z-10">
            <table className="w-full text-left text-xs">
              <thead className="bg-grid-head border-b border-blue-200/80 dark:border-blue-500/30 text-[11px] font-bold text-ink uppercase tracking-wide">
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
              <tbody className="divide-y divide-line text-ink-muted">
                {filteredBankAccounts.length === 0 ? (
                  <tr>
                    <td colSpan={7}>{renderBridgeOneEmptyState("No Bank Accounts Found")}</td>
                  </tr>
                ) : (
                  pageRows(filteredBankAccounts).map((b, idx) => (
                    <tr key={b.id} className="hover:bg-blue-50/40 dark:hover:bg-blue-500/10 transition-colors">
                      <td className="px-3.5 py-2.5 text-center text-ink-faint font-medium">{(pageFor(filteredBankAccounts.length) - 1) * rowsPerPage + idx + 1}</td>
                      <td className="px-3.5 py-2.5 font-semibold text-ink">{b.bankName}</td>
                      <td className="px-3.5 py-2.5 text-ink-muted">{b.branchName}</td>
                      <td className="px-3.5 py-2.5 text-ink-muted font-medium">{b.accountHolder}</td>
                      <td className="px-3.5 py-2.5 text-ink-muted">{b.accountType}</td>
                      <td className="px-3.5 py-2.5 font-mono font-medium text-ink">{b.accountNumber}</td>
                      <td className="px-3.5 py-2.5 text-center">
                        <div className="row-actions flex items-center justify-center gap-2 text-ink-faint">
                          <button
                            type="button"
                            onClick={() => setViewBankDetails(b)}
                            className="hover:text-blue-600 dark:hover:text-blue-400 transition"
                            title="Edit"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setViewBankDetails(b)}
                            className="hover:text-blue-600 dark:hover:text-blue-400 transition"
                            title="View"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setViewBankDetails(b)}
                            className="hover:text-blue-600 dark:hover:text-blue-400 transition"
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
          <div className="px-4 py-2.5 border-t border-line flex items-center justify-end gap-5 text-xs text-ink-faint shrink-0">
            <div className="flex items-center gap-1.5">
              <span>Rows per page:</span>
              <select
                value={rowsPerPage}
                onChange={(e) => {
                  setRowsPerPage(Number(e.target.value));
                  setPage(1);
                }}
                className="border border-line rounded px-1.5 py-0.5 text-xs bg-surface focus:outline-none"
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
            <span>
              {rangeText(filteredBankAccounts.length)}
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                aria-label="Previous page"
                onClick={() => setPage(pageFor(filteredBankAccounts.length) - 1)}
                disabled={pageFor(filteredBankAccounts.length) <= 1}
                className="inline-flex size-7 items-center justify-center rounded hover:bg-control disabled:opacity-40"
              >
                <ChevronLeft className="w-4 h-4 text-ink-faint" />
              </button>
              <button
                type="button"
                aria-label="Next page"
                onClick={() => setPage(pageFor(filteredBankAccounts.length) + 1)}
                disabled={pageFor(filteredBankAccounts.length) * rowsPerPage >= filteredBankAccounts.length}
                className="inline-flex size-7 items-center justify-center rounded hover:bg-control disabled:opacity-40"
              >
                <ChevronRight className="w-4 h-4 text-ink-faint" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 4. TAB 2: DEPOSITS (Screenshot 2) */}
      {/* ------------------------------------------------------------- */}
      {activeTab === "DEPOSITS" && (
        <div className="bg-surface border-t border-line flex-1 min-h-0 flex flex-col print:block">
          {/* Filter Bar */}
          <div className="px-4 py-3 border-b border-line/80 flex flex-wrap items-center gap-4 shrink-0">
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-ink-muted">
                Type <span className="text-red-500">*</span>
              </label>
              <select
                value={depositTypeFilter}
                onChange={(e) => setDepositTypeFilter(e.target.value)}
                className="h-8 w-56 border border-line-strong rounded px-2.5 text-xs bg-surface text-ink focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="Security Deposit">Security Deposit</option>
                <option value="Fixed Deposit">Fixed Deposit (FDR)</option>
                <option value="Term Deposit">Term Deposit (TDR)</option>
                <option value="ALL">All Types</option>
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-ink-muted">Office</label>
              <select
                value={depositOfficeFilter}
                onChange={(e) => setDepositOfficeFilter(e.target.value)}
                className="h-8 w-60 border border-line-strong rounded px-2.5 text-xs bg-surface text-ink focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="All">All</option>
                {offices.map((o) => (
                  <option key={o.id} value={o.name}>
                    {o.name}
                  </option>
                ))}
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
            <div className="flex-1 min-h-0 overflow-auto print:overflow-visible [&_thead]:sticky [&_thead]:top-0 [&_thead]:z-10">
              <table className="w-full text-left text-xs">
                <thead className="bg-grid-head border-b border-blue-200/80 dark:border-blue-500/30 text-[11px] font-bold text-ink uppercase tracking-wide">
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
                <tbody className="divide-y divide-line text-ink-muted">
                  {filteredDeposits.map((d, idx) => (
                    <tr key={d.id} className="hover:bg-blue-50/40 dark:hover:bg-blue-500/10 transition-colors">
                      <td className="px-3.5 py-2.5 text-center text-ink-faint font-medium">{idx + 1}</td>
                      <td className="px-3.5 py-2.5 font-mono font-bold text-blue-600 dark:text-blue-400">{d.depositNumber}</td>
                      <td className="px-3.5 py-2.5 font-semibold text-ink">{d.bankName}</td>
                      <td className="px-3.5 py-2.5">
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-100 dark:border-blue-500/30">
                          {d.depositType}
                        </span>
                      </td>
                      <td className="px-3.5 py-2.5 text-ink-muted">{d.officeName}</td>
                      <td className="px-3.5 py-2.5 text-right font-mono font-bold text-ink">
                        ৳{d.principalAmount.toLocaleString()}
                      </td>
                      <td className="px-3.5 py-2.5 text-right font-mono font-semibold text-ink-muted">
                        {d.interestRate}%
                      </td>
                      <td className="px-3.5 py-2.5 text-ink-muted">{d.openingDate}</td>
                      <td className="px-3.5 py-2.5 text-ink-muted">{d.maturityDate}</td>
                      <td className="px-3.5 py-2.5 text-center">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30">
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
        <div className="bg-surface border-t border-line flex-1 min-h-0 flex flex-col print:block">
          {/* Filter Bar */}
          <div className="px-4 py-3 border-b border-line/80 flex flex-wrap items-center gap-4 shrink-0">
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-ink-muted">
                Type <span className="text-red-500">*</span>
              </label>
              <select
                value={loanTypeFilter}
                onChange={(e) => setLoanTypeFilter(e.target.value)}
                className="h-8 w-52 border border-line-strong rounded px-2.5 text-xs bg-surface text-ink focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="ALL">All Loan Types</option>
                <option value="Working Capital">Working Capital</option>
                <option value="Term Loan">Term Loan</option>
                <option value="Syndicated Credit Facility">Syndicated Credit Facility</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="loan-office" className="block text-xs font-semibold text-ink-muted mb-1">Office</label>
                <select
                  id="loan-office"
                  value={officeOf(newLoanForm.officeId)?.id ?? ""}
                  onChange={(e) => setNewLoanForm({ ...newLoanForm, officeId: e.target.value })}
                  className="w-full h-9 px-3 text-xs border border-line-strong rounded bg-surface focus:ring-1 focus:ring-blue-500 focus:outline-none"
                >
                  {offices.length === 0 && <option value="">No office available</option>}
                  {offices.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="loan-gl-account" className="block text-xs font-semibold text-ink-muted mb-1">GL Account</label>
                <select
                  id="loan-gl-account"
                  value={newLoanForm.glAccountId}
                  onChange={(e) => {
                    const acc = liabilityGlAccounts.find((a) => a.id === e.target.value);
                    setNewLoanForm({ ...newLoanForm, glAccountId: acc?.id ?? "", glAccountName: acc?.name ?? "" });
                  }}
                  className="w-full h-9 px-3 text-xs border border-line-strong rounded bg-surface focus:ring-1 focus:ring-blue-500 focus:outline-none"
                >
                  <option value="">Not linked</option>
                  {liabilityGlAccounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.code} - {a.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-ink-muted">
                GL <span className="text-red-500">*</span>
              </label>
              <select
                value={loanGlFilter}
                onChange={(e) => setLoanGlFilter(e.target.value)}
                className="h-8 w-56 border border-line-strong rounded px-2.5 text-xs bg-surface text-ink focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="ALL">GL Account</option>
                <option value="Short Term Borrowing">Short Term Borrowing</option>
                <option value="Long Term Machinery Loan">Long Term Machinery Loan</option>
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-ink-muted">
                From Date <span className="text-red-500">*</span>
              </label>
              <NativeDateInput
                type="date"
                value={loanFromDate}
                onChange={(e) => setLoanFromDate(e.target.value)}
                className="h-8 w-40 border border-line-strong rounded px-2.5 text-xs bg-surface text-ink focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-ink-muted">
                To Date <span className="text-red-500">*</span>
              </label>
              <NativeDateInput
                type="date"
                value={loanToDate}
                onChange={(e) => setLoanToDate(e.target.value)}
                className="h-8 w-40 border border-line-strong rounded px-2.5 text-xs bg-surface text-ink focus:outline-none focus:ring-1 focus:ring-blue-500"
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
            <div className="flex-1 min-h-0 overflow-auto print:overflow-visible [&_thead]:sticky [&_thead]:top-0 [&_thead]:z-10">
              <table className="w-full text-left text-xs">
                <thead className="bg-grid-head border-b border-blue-200/80 dark:border-blue-500/30 text-[11px] font-bold text-ink uppercase tracking-wide">
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
                    <th className="px-3.5 py-2.5 text-right font-bold text-rose-700 dark:text-rose-300">Outstanding</th>
                    <th className="px-3.5 py-2.5 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line text-ink-muted">
                  {filteredLoans.map((l, idx) => (
                    <tr key={l.id} className="hover:bg-blue-50/40 dark:hover:bg-blue-500/10 transition-colors">
                      <td className="px-3.5 py-2.5 text-center text-ink-faint font-medium">{idx + 1}</td>
                      <td className="px-3.5 py-2.5 font-mono font-bold text-blue-600 dark:text-blue-400">{l.loanNumber}</td>
                      <td className="px-3.5 py-2.5 font-semibold text-ink">{l.lenderName}</td>
                      <td className="px-3.5 py-2.5">
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-50 dark:bg-amber-500/10 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-500/30">
                          {l.loanType}
                        </span>
                      </td>
                      <td className="px-3.5 py-2.5 text-ink-muted">{l.glAccountName}</td>
                      <td className="px-3.5 py-2.5 text-right font-mono font-bold text-ink">
                        ৳{l.principalAmount.toLocaleString()}
                      </td>
                      <td className="px-3.5 py-2.5 text-right font-mono font-semibold text-ink-muted">
                        {l.interestRate}%
                      </td>
                      <td className="px-3.5 py-2.5 text-ink-muted">{l.disbursementDate}</td>
                      <td className="px-3.5 py-2.5 text-ink-muted">{l.maturityDate}</td>
                      <td className="px-3.5 py-2.5 text-right font-mono font-bold text-rose-700 dark:text-rose-300">
                        ৳{l.outstandingPrincipal.toLocaleString()}
                      </td>
                      <td className="px-3.5 py-2.5 text-center">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-500/30">
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
        <div className="bg-surface border-t border-line flex-1 min-h-0 flex flex-col print:block">
          {/* Filter Bar */}
          <div className="px-4 py-3 border-b border-line/80 flex flex-wrap items-center gap-4 shrink-0">
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-ink-muted">
                From Date <span className="text-red-500">*</span>
              </label>
              <NativeDateInput
                type="date"
                value={factoringFromDate}
                onChange={(e) => setFactoringFromDate(e.target.value)}
                className="h-8 w-36 border border-line-strong rounded px-2.5 text-xs bg-surface text-ink focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-ink-muted">
                To Date <span className="text-red-500">*</span>
              </label>
              <NativeDateInput
                type="date"
                value={factoringToDate}
                onChange={(e) => setFactoringToDate(e.target.value)}
                className="h-8 w-36 border border-line-strong rounded px-2.5 text-xs bg-surface text-ink focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-ink-muted">Customer</label>
              <select
                value={factoringCustomer}
                onChange={(e) => setFactoringCustomer(e.target.value)}
                className="h-8 w-52 border border-line-strong rounded px-2.5 text-xs bg-surface text-ink focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="ALL">Select Partner</option>
                <option value="Arif Enterprise-Jamalpur">Arif Enterprise-Jamalpur</option>
                <option value="Choya Dia Enterprise-Magura">Choya Dia Enterprise-Magura</option>
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-ink-muted">Bill</label>
              <input
                type="text"
                value={factoringBillSearch}
                onChange={(e) => setFactoringBillSearch(e.target.value)}
                placeholder="Select/Search Bill (min 3 letters)"
                className="h-8 w-60 border border-line-strong rounded px-2.5 text-xs bg-surface text-ink focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder:text-ink-faint"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-ink-muted">Account No</label>
              <input
                type="text"
                value={factoringAccountSearch}
                onChange={(e) => setFactoringAccountSearch(e.target.value)}
                placeholder="Select/Search Account No (min 3 letters)"
                className="h-8 w-60 border border-line-strong rounded px-2.5 text-xs bg-surface text-ink focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder:text-ink-faint"
              />
            </div>

            <div className="flex items-center gap-1.5 self-end pb-1.5">
              <input
                type="checkbox"
                id="isBillWise"
                checked={isBillWise}
                onChange={(e) => setIsBillWise(e.target.checked)}
                className="w-4 h-4 text-blue-600 dark:text-blue-400 rounded border-line-strong focus:ring-blue-500"
              />
              <label htmlFor="isBillWise" className="text-xs font-semibold text-ink-muted cursor-pointer">
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
            <div className="flex-1 min-h-0 overflow-auto print:overflow-visible [&_thead]:sticky [&_thead]:top-0 [&_thead]:z-10">
              <table className="w-full text-left text-xs">
                <thead className="bg-grid-head border-b border-blue-200/80 dark:border-blue-500/30 text-[11px] font-bold text-ink uppercase tracking-wide">
                  <tr>
                    <th className="px-3.5 py-2.5 w-12 text-center">SL</th>
                    <th className="px-3.5 py-2.5">Bill / Invoice Reference</th>
                    <th className="px-3.5 py-2.5">Customer / Partner</th>
                    <th className="px-3.5 py-2.5">Factoring Company</th>
                    <th className="px-3.5 py-2.5 font-mono">Bank Account No</th>
                    <th className="px-3.5 py-2.5 text-right">Invoice Value</th>
                    <th className="px-3.5 py-2.5 text-right font-bold text-emerald-700 dark:text-emerald-300">Eligible Advance (80%)</th>
                    <th className="px-3.5 py-2.5 text-right text-rose-700 dark:text-rose-300">Fee / Charges</th>
                    <th className="px-3.5 py-2.5 text-right font-bold text-blue-700 dark:text-blue-300">Remaining</th>
                    <th className="px-3.5 py-2.5 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line text-ink-muted">
                  {pageRows(filteredFactoring).map((f, idx) => (
                    <tr key={f.id} className="hover:bg-blue-50/40 dark:hover:bg-blue-500/10 transition-colors">
                      <td className="px-3.5 py-2.5 text-center text-ink-faint font-medium">{(pageFor(filteredFactoring.length) - 1) * rowsPerPage + idx + 1}</td>
                      <td className="px-3.5 py-2.5 font-mono font-bold text-blue-600 dark:text-blue-400">
                        {f.billNumber || f.invoiceReference}
                      </td>
                      <td className="px-3.5 py-2.5 font-semibold text-ink">{f.customerName}</td>
                      <td className="px-3.5 py-2.5 text-ink-muted">{f.factoringCompany}</td>
                      <td className="px-3.5 py-2.5 font-mono text-ink">{f.accountNo}</td>
                      <td className="px-3.5 py-2.5 text-right font-mono font-semibold text-ink">
                        ৳{f.eligibleReceivable.toLocaleString()}
                      </td>
                      <td className="px-3.5 py-2.5 text-right font-mono font-bold text-emerald-700 dark:text-emerald-300">
                        ৳{f.advanceAmount.toLocaleString()}
                      </td>
                      <td className="px-3.5 py-2.5 text-right font-mono text-rose-700 dark:text-rose-300">
                        ৳{f.feesCharges.toLocaleString()}
                      </td>
                      <td className="px-3.5 py-2.5 text-right font-mono font-bold text-blue-700 dark:text-blue-300">
                        ৳{f.remainingReceivable.toLocaleString()}
                      </td>
                      <td className="px-3.5 py-2.5 text-center">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                            f.settlementStatus === "SETTLED"
                              ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/30"
                              : "bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-500/30"
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
          <div className="px-4 py-2.5 border-t border-line flex items-center justify-end gap-5 text-xs text-ink-faint shrink-0">
            <div className="flex items-center gap-1.5">
              <span>Rows per page:</span>
              <select
                value={rowsPerPage}
                onChange={(e) => {
                  setRowsPerPage(Number(e.target.value));
                  setPage(1);
                }}
                className="border border-line rounded px-1.5 py-0.5 text-xs bg-surface focus:outline-none"
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
              </select>
            </div>
            <span>
              {rangeText(filteredFactoring.length)}
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                aria-label="Previous page"
                onClick={() => setPage(pageFor(filteredFactoring.length) - 1)}
                disabled={pageFor(filteredFactoring.length) <= 1}
                className="inline-flex size-7 items-center justify-center rounded hover:bg-control disabled:opacity-40"
              >
                <ChevronLeft className="w-4 h-4 text-ink-faint" />
              </button>
              <button
                type="button"
                aria-label="Next page"
                onClick={() => setPage(pageFor(filteredFactoring.length) + 1)}
                disabled={pageFor(filteredFactoring.length) * rowsPerPage >= filteredFactoring.length}
                className="inline-flex size-7 items-center justify-center rounded hover:bg-control disabled:opacity-40"
              >
                <ChevronRight className="w-4 h-4 text-ink-faint" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 7. TAB 5: LOAN (OTHERS) (Screenshot 5) */}
      {/* ------------------------------------------------------------- */}
      {activeTab === "LOAN_OTHERS" && (
        <div className="bg-surface border-t border-line flex-1 min-h-0 flex flex-col print:block">
          {/* Filter Bar */}
          <div className="px-4 py-3 border-b border-line/80 flex flex-wrap items-center gap-4 shrink-0">
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-ink-muted">Office</label>
              <select
                value={otherOfficeFilter}
                onChange={(e) => setOtherOfficeFilter(e.target.value)}
                className="h-8 w-44 border border-line-strong rounded px-2.5 text-xs bg-surface text-ink focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="ALL">Office</option>
                {offices.map((o) => (
                  <option key={o.id} value={o.name}>
                    {o.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-ink-muted">Group</label>
              <select
                value={otherGroupFilter}
                onChange={(e) => setOtherGroupFilter(e.target.value)}
                className="h-8 w-52 border border-line-strong rounded px-2.5 text-xs bg-surface text-ink focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="ALL">Partner Group</option>
                <option value="NBFI Corporate Partner">NBFI Corporate Partner</option>
                <option value="Equipment Credit Partner">Equipment Credit Partner</option>
                <option value="Working Capital Partner">Working Capital Partner</option>
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-ink-muted">Active/InActive</label>
              <select
                value={otherActiveFilter}
                onChange={(e) => setOtherActiveFilter(e.target.value)}
                className="h-8 w-52 border border-line-strong rounded px-2.5 text-xs bg-surface text-ink focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="ALL">Filter By Active/InActive</option>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">InActive</option>
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-ink-muted">Account Type</label>
              <select
                value={otherAccountTypeFilter}
                onChange={(e) => setOtherAccountTypeFilter(e.target.value)}
                className="h-8 w-52 border border-line-strong rounded px-2.5 text-xs bg-surface text-ink focus:outline-none focus:ring-1 focus:ring-blue-500"
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
            <div className="flex-1 min-h-0 overflow-auto print:overflow-visible [&_thead]:sticky [&_thead]:top-0 [&_thead]:z-10">
              <table className="w-full text-left text-xs">
                <thead className="bg-grid-head border-b border-blue-200/80 dark:border-blue-500/30 text-[11px] font-bold text-ink uppercase tracking-wide">
                  <tr>
                    <th className="px-3.5 py-2.5 w-12 text-center">SL</th>
                    <th className="px-3.5 py-2.5">Loan Partner</th>
                    <th className="px-3.5 py-2.5">Partner Group</th>
                    <th className="px-3.5 py-2.5">Office</th>
                    <th className="px-3.5 py-2.5">Account Type</th>
                    <th className="px-3.5 py-2.5 text-right">Principal Facility</th>
                    <th className="px-3.5 py-2.5 text-right">Interest Rate (%)</th>
                    <th className="px-3.5 py-2.5 text-center">Tenure (Mos)</th>
                    <th className="px-3.5 py-2.5 text-right font-bold text-rose-700 dark:text-rose-300">Outstanding</th>
                    <th className="px-3.5 py-2.5 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line text-ink-muted">
                  {filteredLoanPartners.map((lp, idx) => (
                    <tr key={lp.id} className="hover:bg-blue-50/40 dark:hover:bg-blue-500/10 transition-colors">
                      <td className="px-3.5 py-2.5 text-center text-ink-faint font-medium">{idx + 1}</td>
                      <td className="px-3.5 py-2.5 font-semibold text-ink">{lp.partnerName}</td>
                      <td className="px-3.5 py-2.5 text-ink-muted">{lp.group}</td>
                      <td className="px-3.5 py-2.5 text-ink-muted">{lp.officeName}</td>
                      <td className="px-3.5 py-2.5">
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-100 dark:border-blue-500/30">
                          {lp.accountType}
                        </span>
                      </td>
                      <td className="px-3.5 py-2.5 text-right font-mono font-bold text-ink">
                        ৳{lp.principalFacility.toLocaleString()}
                      </td>
                      <td className="px-3.5 py-2.5 text-right font-mono font-semibold text-ink-muted">
                        {lp.interestRate}%
                      </td>
                      <td className="px-3.5 py-2.5 text-center font-mono text-ink-muted">{lp.tenureMonths}</td>
                      <td className="px-3.5 py-2.5 text-right font-mono font-bold text-rose-700 dark:text-rose-300">
                        ৳{lp.outstanding.toLocaleString()}
                      </td>
                      <td className="px-3.5 py-2.5 text-center">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30">
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
        title="Create Bank Account"
        subtitle="Register a company bank account"
        maxWidth="lg"
      >
        <form onSubmit={handleSaveBank} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="bank-account-name" className="block text-xs font-semibold text-ink-muted mb-1">
                Account Name <span className="text-red-500">*</span>
              </label>
              <input
                id="bank-account-name"
                type="text"
                required
                value={newBankForm.accountHolder}
                onChange={(e) => setNewBankForm({ ...newBankForm, accountHolder: e.target.value })}
                placeholder="Account Name"
                className="w-full h-9 px-3 text-xs border border-line-strong rounded focus:ring-1 focus:ring-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label htmlFor="bank-name" className="block text-xs font-semibold text-ink-muted mb-1">
                Bank Name <span className="text-red-500">*</span>
              </label>
              <select
                id="bank-name"
                required
                value={newBankForm.bankName}
                onChange={(e) => setNewBankForm({ ...newBankForm, bankName: e.target.value, branchName: "" })}
                className="w-full h-9 px-3 text-xs border border-line-strong rounded bg-surface focus:ring-1 focus:ring-blue-500 focus:outline-none"
              >
                <option value="">Bank Name</option>
                {bankNameOptions.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="bank-branch" className="block text-xs font-semibold text-ink-muted mb-1">
                Branch Name <span className="text-red-500">*</span>
              </label>
              {/* Branches already used with this bank are suggested; a new branch is typed in. */}
              <input
                id="bank-branch"
                type="text"
                required
                list="bank-branch-options"
                value={newBankForm.branchName}
                onChange={(e) => setNewBankForm({ ...newBankForm, branchName: e.target.value })}
                placeholder="Branch Name"
                className="w-full h-9 px-3 text-xs border border-line-strong rounded focus:ring-1 focus:ring-blue-500 focus:outline-none"
              />
              <datalist id="bank-branch-options">
                {knownBranches.map((b) => (
                  <option key={b} value={b} />
                ))}
              </datalist>
            </div>
            <div>
              <label className="block text-xs font-semibold text-ink-muted mb-1">Account Type</label>
              <select
                value={newBankForm.accountType}
                onChange={(e) => setNewBankForm({ ...newBankForm, accountType: e.target.value })}
                className="w-full h-9 px-3 text-xs border border-line-strong rounded bg-surface focus:ring-1 focus:ring-blue-500 focus:outline-none"
              >
                {BANK_ACCOUNT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-ink-muted mb-1">
                Account Number <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={newBankForm.accountNumber}
                onChange={(e) => setNewBankForm({ ...newBankForm, accountNumber: e.target.value })}
                placeholder="e.g. 3133131043165"
                className="w-full h-9 px-3 text-xs border border-line-strong rounded font-mono focus:ring-1 focus:ring-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label htmlFor="bank-short-name" className="block text-xs font-semibold text-ink-muted mb-1">
                Bank Short Name <span className="text-red-500">*</span>
              </label>
              <input
                id="bank-short-name"
                type="text"
                required
                maxLength={50}
                value={newBankForm.shortName}
                onChange={(e) => setNewBankForm({ ...newBankForm, shortName: e.target.value })}
                placeholder="Bank Short Name"
                className="w-full h-9 px-3 text-xs border border-line-strong rounded focus:ring-1 focus:ring-blue-500 focus:outline-none"
              />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="bank-signatory" className="block text-xs font-semibold text-ink-muted mb-1">Signatory</label>
              <textarea
                id="bank-signatory"
                rows={2}
                maxLength={500}
                value={newBankForm.signatory}
                onChange={(e) => setNewBankForm({ ...newBankForm, signatory: e.target.value })}
                placeholder="Signatory"
                className="w-full px-3 py-2 text-xs border border-line-strong rounded focus:ring-1 focus:ring-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-ink-muted mb-1">Opening Balance (৳)</label>
              <input
                type="number"
                min="0"
                value={newBankForm.openingBalance}
                onChange={(e) => setNewBankForm({ ...newBankForm, openingBalance: Number(e.target.value) })}
                className="w-full h-9 px-3 text-xs border border-line-strong rounded font-mono focus:ring-1 focus:ring-blue-500 focus:outline-none"
              />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="bank-gl-account" className="block text-xs font-semibold text-ink-muted mb-1">GL Account (Chart of A/C)</label>
              <select
                id="bank-gl-account"
                value={newBankForm.glAccountId}
                onChange={(e) => {
                  const acc = assetGlAccounts.find((a) => a.id === e.target.value);
                  setNewBankForm({ ...newBankForm, glAccountId: acc?.id ?? "", glAccountName: acc?.name ?? "" });
                }}
                className="w-full h-9 px-3 text-xs border border-line-strong rounded bg-surface focus:ring-1 focus:ring-blue-500 focus:outline-none"
              >
                <option value="">Not linked</option>
                {assetGlAccounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.code} - {a.name}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-[11px] text-ink-faint">Payments from this bank post to this account in the ledger.</p>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-line">
            <button
              type="button"
              onClick={() => setIsNewBankOpen(false)}
              className="px-4 py-2 border border-line-strong text-ink-muted hover:bg-canvas text-xs font-semibold rounded"
            >
              Cancel
            </button>
            <button
              type="submit"
 disabled={pending === "bank"}
              className="inline-flex items-center justify-center gap-1.5 disabled:opacity-60 px-4 py-2 bg-[#2563eb] hover:bg-blue-700 text-white text-xs font-semibold rounded"
            >{pending === "bank" && <Spinner className="size-3.5" />}
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
              <label className="block text-xs font-semibold text-ink-muted mb-1">Deposit Type</label>
              <select
                value={newDepositForm.depositType}
                onChange={(e) => setNewDepositForm({ ...newDepositForm, depositType: e.target.value })}
                className="w-full h-9 px-3 text-xs border border-line-strong rounded bg-surface focus:ring-1 focus:ring-blue-500 focus:outline-none"
              >
                <option value="Security Deposit">Security Deposit</option>
                <option value="Fixed Deposit">Fixed Deposit (FDR)</option>
                <option value="Term Deposit">Term Deposit (TDR)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-ink-muted mb-1">Bank Name</label>
              <input
                type="text"
                required
                value={newDepositForm.bankName}
                onChange={(e) => setNewDepositForm({ ...newDepositForm, bankName: e.target.value })}
                className="w-full h-9 px-3 text-xs border border-line-strong rounded focus:ring-1 focus:ring-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-ink-muted mb-1">Office</label>
              <select
                value={officeOf(newDepositForm.officeId)?.id ?? ""}
                onChange={(e) => setNewDepositForm({ ...newDepositForm, officeId: e.target.value })}
                className="w-full h-9 px-3 text-xs border border-line-strong rounded bg-surface focus:ring-1 focus:ring-blue-500 focus:outline-none"
              >
                {offices.length === 0 && <option value="">No office available</option>}
                {offices.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-ink-muted mb-1">Principal Amount (৳)</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={newDepositForm.principalAmount}
                  onChange={(e) => setNewDepositForm({ ...newDepositForm, principalAmount: Number(e.target.value) })}
                  className="w-full h-9 px-3 text-xs border border-line-strong rounded font-mono focus:ring-1 focus:ring-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-ink-muted mb-1">Interest Rate (%)</label>
                <input
                  type="number"
                  step="0.1"
                  value={newDepositForm.interestRate}
                  onChange={(e) => setNewDepositForm({ ...newDepositForm, interestRate: Number(e.target.value) })}
                  className="w-full h-9 px-3 text-xs border border-line-strong rounded font-mono focus:ring-1 focus:ring-blue-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-line">
            <button
              type="button"
              onClick={() => setIsNewDepositOpen(false)}
              className="px-4 py-2 border border-line-strong text-ink-muted hover:bg-canvas text-xs font-semibold rounded"
            >
              Cancel
            </button>
            <button
              type="submit"
 disabled={pending === "deposit"}
              className="inline-flex items-center justify-center gap-1.5 disabled:opacity-60 px-4 py-2 bg-[#2563eb] hover:bg-blue-700 text-white text-xs font-semibold rounded"
            >{pending === "deposit" && <Spinner className="size-3.5" />}
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
              <label className="block text-xs font-semibold text-ink-muted mb-1">Lender Bank</label>
              <input
                type="text"
                required
                value={newLoanForm.lenderName}
                onChange={(e) => setNewLoanForm({ ...newLoanForm, lenderName: e.target.value })}
                className="w-full h-9 px-3 text-xs border border-line-strong rounded focus:ring-1 focus:ring-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-ink-muted mb-1">Facility Type</label>
              <select
                value={newLoanForm.loanType}
                onChange={(e) => setNewLoanForm({ ...newLoanForm, loanType: e.target.value })}
                className="w-full h-9 px-3 text-xs border border-line-strong rounded bg-surface focus:ring-1 focus:ring-blue-500 focus:outline-none"
              >
                <option value="Working Capital">Working Capital</option>
                <option value="Term Loan">Term Loan</option>
                <option value="Syndicated Credit Facility">Syndicated Credit Facility</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="loan-office" className="block text-xs font-semibold text-ink-muted mb-1">Office</label>
                <select
                  id="loan-office"
                  value={officeOf(newLoanForm.officeId)?.id ?? ""}
                  onChange={(e) => setNewLoanForm({ ...newLoanForm, officeId: e.target.value })}
                  className="w-full h-9 px-3 text-xs border border-line-strong rounded bg-surface focus:ring-1 focus:ring-blue-500 focus:outline-none"
                >
                  {offices.length === 0 && <option value="">No office available</option>}
                  {offices.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="loan-gl-account" className="block text-xs font-semibold text-ink-muted mb-1">GL Account</label>
                <select
                  id="loan-gl-account"
                  value={newLoanForm.glAccountId}
                  onChange={(e) => {
                    const acc = liabilityGlAccounts.find((a) => a.id === e.target.value);
                    setNewLoanForm({ ...newLoanForm, glAccountId: acc?.id ?? "", glAccountName: acc?.name ?? "" });
                  }}
                  className="w-full h-9 px-3 text-xs border border-line-strong rounded bg-surface focus:ring-1 focus:ring-blue-500 focus:outline-none"
                >
                  <option value="">Not linked</option>
                  {liabilityGlAccounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.code} - {a.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-ink-muted mb-1">Principal Amount (৳)</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={newLoanForm.principalAmount}
                  onChange={(e) => setNewLoanForm({ ...newLoanForm, principalAmount: Number(e.target.value) })}
                  className="w-full h-9 px-3 text-xs border border-line-strong rounded font-mono focus:ring-1 focus:ring-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-ink-muted mb-1">Interest Rate (%)</label>
                <input
                  type="number"
                  step="0.1"
                  value={newLoanForm.interestRate}
                  onChange={(e) => setNewLoanForm({ ...newLoanForm, interestRate: Number(e.target.value) })}
                  className="w-full h-9 px-3 text-xs border border-line-strong rounded font-mono focus:ring-1 focus:ring-blue-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-line">
            <button
              type="button"
              onClick={() => setIsNewLoanOpen(false)}
              className="px-4 py-2 border border-line-strong text-ink-muted hover:bg-canvas text-xs font-semibold rounded"
            >
              Cancel
            </button>
            <button
              type="submit"
 disabled={pending === "loan"}
              className="inline-flex items-center justify-center gap-1.5 disabled:opacity-60 px-4 py-2 bg-[#2563eb] hover:bg-blue-700 text-white text-xs font-semibold rounded"
            >{pending === "loan" && <Spinner className="size-3.5" />}
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
              <label className="block text-xs font-semibold text-ink-muted mb-1">Partner Name</label>
              <input
                type="text"
                required
                value={newPartnerForm.partnerName}
                onChange={(e) => setNewPartnerForm({ ...newPartnerForm, partnerName: e.target.value })}
                placeholder="e.g. IDLC Finance PLC"
                className="w-full h-9 px-3 text-xs border border-line-strong rounded focus:ring-1 focus:ring-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-ink-muted mb-1">Partner Group</label>
              <select
                value={newPartnerForm.group}
                onChange={(e) => setNewPartnerForm({ ...newPartnerForm, group: e.target.value })}
                className="w-full h-9 px-3 text-xs border border-line-strong rounded bg-surface focus:ring-1 focus:ring-blue-500 focus:outline-none"
              >
                <option value="NBFI Corporate Partner">NBFI Corporate Partner</option>
                <option value="Equipment Credit Partner">Equipment Credit Partner</option>
                <option value="Working Capital Partner">Working Capital Partner</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-ink-muted mb-1">Office</label>
              <select
                value={officeOf(newPartnerForm.officeId)?.id ?? ""}
                onChange={(e) => setNewPartnerForm({ ...newPartnerForm, officeId: e.target.value })}
                className="w-full h-9 px-3 text-xs border border-line-strong rounded bg-surface focus:ring-1 focus:ring-blue-500 focus:outline-none"
              >
                {offices.length === 0 && <option value="">No office available</option>}
                {offices.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-ink-muted mb-1">Facility Amount (৳)</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={newPartnerForm.principalFacility}
                  onChange={(e) => setNewPartnerForm({ ...newPartnerForm, principalFacility: Number(e.target.value) })}
                  className="w-full h-9 px-3 text-xs border border-line-strong rounded font-mono focus:ring-1 focus:ring-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-ink-muted mb-1">Interest Rate (%)</label>
                <input
                  type="number"
                  step="0.1"
                  value={newPartnerForm.interestRate}
                  onChange={(e) => setNewPartnerForm({ ...newPartnerForm, interestRate: Number(e.target.value) })}
                  className="w-full h-9 px-3 text-xs border border-line-strong rounded font-mono focus:ring-1 focus:ring-blue-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-line">
            <button
              type="button"
              onClick={() => setIsNewLoanPartnerOpen(false)}
              className="px-4 py-2 border border-line-strong text-ink-muted hover:bg-canvas text-xs font-semibold rounded"
            >
              Cancel
            </button>
            <button
              type="submit"
 disabled={pending === "partner"}
              className="inline-flex items-center justify-center gap-1.5 disabled:opacity-60 px-4 py-2 bg-[#2563eb] hover:bg-blue-700 text-white text-xs font-semibold rounded"
            >{pending === "partner" && <Spinner className="size-3.5" />}
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
          <div className="border-2 border-dashed border-line-strong rounded-lg p-6 text-center hover:border-blue-500 transition cursor-pointer bg-canvas">
            <Upload className="w-8 h-8 text-blue-600 dark:text-blue-400 mx-auto mb-2" />
            <p className="text-xs font-semibold text-ink">Click to upload or drag and drop</p>
            <p className="text-[11px] text-ink-faint mt-1">Excel (.xlsx) or CSV format up to 10MB</p>
          </div>

          <div className="flex items-center justify-between text-xs bg-blue-50/60 dark:bg-blue-500/10 p-2.5 rounded border border-blue-100 dark:border-blue-500/30">
            <span className="text-ink-muted font-medium">Download sample template file:</span>
            <button
              type="button"
              onClick={handleExportExcel}
              className="text-blue-600 dark:text-blue-400 font-semibold hover:underline flex items-center gap-1"
            >
              <Download className="w-3 h-3" />
              <span>Sample Template.xlsx</span>
            </button>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-line">
            <button
              type="button"
              onClick={() => setIsBulkUploadOpen(false)}
              className="px-4 py-2 border border-line-strong text-ink-muted hover:bg-canvas text-xs font-semibold rounded"
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
            <div className="grid grid-cols-2 gap-3 bg-canvas p-3 rounded border border-line">
              <div>
                <span className="text-ink-faint block text-[11px]">Account Holder:</span>
                <span className="font-semibold text-ink">{viewBankDetails.accountHolder}</span>
              </div>
              <div>
                <span className="text-ink-faint block text-[11px]">Account Type:</span>
                <span className="font-semibold text-ink">{viewBankDetails.accountType}</span>
              </div>
              <div>
                <span className="text-ink-faint block text-[11px]">Branch:</span>
                <span className="font-semibold text-ink">{viewBankDetails.branchName}</span>
              </div>
              <div>
                <span className="text-ink-faint block text-[11px]">Linked GL:</span>
                <span className="font-semibold text-ink">{viewBankDetails.glAccountName}</span>
              </div>
              <div>
                <span className="text-ink-faint block text-[11px]">Reconciliation:</span>
                <span className="inline-flex items-center gap-1 font-semibold text-emerald-600 dark:text-emerald-400">
                  <ShieldCheck className="w-3.5 h-3.5" /> {viewBankDetails.reconciliationStatus}
                </span>
              </div>
              <div>
                <span className="text-ink-faint block text-[11px]">Available Balance:</span>
                <span className="font-bold text-blue-700 dark:text-blue-300 text-sm">৳{viewBankDetails.currentBalance.toLocaleString()}</span>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-line">
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
