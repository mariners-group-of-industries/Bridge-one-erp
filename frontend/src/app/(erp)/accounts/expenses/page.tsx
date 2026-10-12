"use client";

import React, { useMemo, useState } from "react";
import {
  AlertCircle,
  Banknote,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  DollarSign,
  Download,
  Eye,
  FileSpreadsheet,
  FileText,
  Filter,
  Pencil,
  Plus,
  Printer,
  RotateCcw,
  Search,
  ShieldCheck,
  Trash2,
  Wallet,
  X,
} from "lucide-react";
import { ModalDialog } from "@/components/purchase/ModalDialog";
import { useAccountingStore } from "@/features/accounts/store/accounting-store";
import type { AdvanceRecord, ExpenseRecord, PaymentMethod, ProvisionRecord } from "@/features/accounts/types";

export default function ExpenseAdvancePage() {
  // Main Tabs: "EXPENSE" | "ADVANCE" | "PROVISION" | "PAID"
  const [activeTab, setActiveTab] = useState<"EXPENSE" | "ADVANCE" | "PROVISION" | "PAID">("EXPENSE");

  // Advance Sub-Tabs: "ADVANCE" | "INVOICE_ADVANCE_COLLECTION"
  const [advanceSubTab, setAdvanceSubTab] = useState<"ADVANCE" | "INVOICE_ADVANCE_COLLECTION">("ADVANCE");

  // Store data & actions
  const expenses = useAccountingStore((s) => s.expenses);
  const advances = useAccountingStore((s) => s.advances);
  const provisions = useAccountingStore((s) => s.provisions);
  const accounts = useAccountingStore((s) => s.accounts);
  const createExpense = useAccountingStore((s) => s.createExpense);
  const updateExpenseStatus = useAccountingStore((s) => s.updateExpenseStatus);
  const markExpensePaid = useAccountingStore((s) => s.markExpensePaid);
  const createAdvance = useAccountingStore((s) => s.createAdvance);
  const disburseAdvance = useAccountingStore((s) => s.disburseAdvance);
  const settleAdvance = useAccountingStore((s) => s.settleAdvance);
  const createProvision = useAccountingStore((s) => s.createProvision);

  // Filters
  const [search, setSearch] = useState("");
  const [selectedOffice, setSelectedOffice] = useState("ALL");
  const [fromDate, setFromDate] = useState("2026-09-11");
  const [toDate, setToDate] = useState("2026-10-12");
  const [filterStatus, setFilterStatus] = useState("ALL");
  const [filterExpenseType, setFilterExpenseType] = useState("ALL");
  const [filterAccountHead, setFilterAccountHead] = useState("ALL");

  // Selection Checkboxes
  const [selectedExpenseIds, setSelectedExpenseIds] = useState<string[]>([]);
  const [selectedProvisionIds, setSelectedProvisionIds] = useState<string[]>([]);

  // Modals
  const [isCreateExpenseOpen, setIsCreateExpenseOpen] = useState(false);
  const [isCreateAdvanceOpen, setIsCreateAdvanceOpen] = useState(false);
  const [isCreateProvisionOpen, setIsCreateProvisionOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [viewingRecord, setViewingRecord] = useState<any | null>(null);

  // Forms
  const [expenseForm, setExpenseForm] = useState({
    officeId: "office-sirajganj",
    officeName: "MG Sirajganj Factory",
    expenseType: "Factory Utilities",
    accountId: "acc-702",
    accountName: "Administrative & Operating Expenses",
    payeeName: "",
    amount: 0,
    date: new Date().toLocaleDateString("en-GB").replace(/\//g, "/"),
    paymentMethod: "BANK" as PaymentMethod,
    referenceNumber: "",
    description: "",
  });

  const [advanceForm, setAdvanceForm] = useState({
    employeeName: "",
    partnerPayee: "",
    officeId: "office-sirajganj",
    officeName: "MG Sirajganj Factory",
    purpose: "",
    chartOfAccounts: "105 - Advance, Deposits & Pre-Payments",
    requestedAmount: 0,
    approvedAmount: 0,
    date: new Date().toLocaleDateString("en-GB").replace(/\//g, "/"),
  });

  const [provisionForm, setProvisionForm] = useState({
    officeId: "office-sirajganj",
    officeName: "MG Sirajganj Factory",
    expenseType: "Factory Wages Provision",
    accountId: "acc-303",
    accountName: "Payables, Provision And Accruals",
    partnerPayee: "",
    amount: 0,
    effectivePeriod: "October 2026",
    description: "",
  });

  // Offices list
  const officeList = [
    { id: "ALL", name: "Office (All)" },
    { id: "MG Sirajganj Factory", name: "MG Sirajganj Factory" },
    { id: "MGV-PLC", name: "MGV-PLC" },
    { id: "Dhaka Head Office", name: "Dhaka Head Office" },
    { id: "MBBL-HO", name: "MBBL-HO" },
    { id: "MOHS-Eco", name: "MOHS-Eco" },
    { id: "CFF-Chapai", name: "CFF-Chapai" },
    { id: "MFIL-HO", name: "MFIL-HO" },
  ];

  // Expense Types list
  const expenseTypes = [
    "ALL",
    "Factory Utilities",
    "Office Utilities",
    "Plant Maintenance",
    "Fuel & Transportation",
    "Audit & Professional",
    "Factory Wages Provision",
    "Office Lease Provision",
    "Machinery Overhaul Provision",
  ];

  // Accounts Heads list
  const accountsHeads = [
    { id: "ALL", name: "Accounts Head (All)" },
    { id: "acc-701", name: "701 - Cost of Goods Sold (COGS)" },
    { id: "acc-702", name: "702 - Administrative & Operating Expenses" },
    { id: "acc-105", name: "105 - Advance, Deposits & Pre-Payments" },
    { id: "acc-303", name: "303 - Payables, Provision And Accruals" },
    { id: "acc-1460", name: "1460 - Cash Account" },
    { id: "acc-10102", name: "10102 - Cash At Bank" },
  ];

  // 1. EXPENSES TAB DATA
  const displayedExpenses = useMemo(() => {
    return expenses.filter((e) => {
      if (selectedOffice !== "ALL" && e.officeName !== selectedOffice) return false;
      if (filterExpenseType !== "ALL" && e.expenseType !== filterExpenseType) return false;
      if (filterAccountHead !== "ALL" && e.accountId !== filterAccountHead) return false;
      if (filterStatus !== "ALL" && e.status !== filterStatus) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const m =
          (e.code && e.code.toLowerCase().includes(q)) ||
          e.expenseNumber.toLowerCase().includes(q) ||
          e.officeName.toLowerCase().includes(q) ||
          (e.partnerPayee && e.partnerPayee.toLowerCase().includes(q)) ||
          e.payeeName.toLowerCase().includes(q) ||
          e.description.toLowerCase().includes(q);
        if (!m) return false;
      }
      return true;
    });
  }, [expenses, selectedOffice, filterExpenseType, filterAccountHead, filterStatus, search]);

  // 2. ADVANCES TAB DATA
  const displayedAdvances = useMemo(() => {
    return advances.filter((a) => {
      if (selectedOffice !== "ALL" && a.officeName !== selectedOffice) return false;
      if (filterStatus !== "ALL" && a.status !== filterStatus) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const m =
          (a.code && a.code.toLowerCase().includes(q)) ||
          a.advanceNumber.toLowerCase().includes(q) ||
          a.employeeName.toLowerCase().includes(q) ||
          (a.partnerPayee && a.partnerPayee.toLowerCase().includes(q)) ||
          a.purpose.toLowerCase().includes(q);
        if (!m) return false;
      }
      return true;
    });
  }, [advances, selectedOffice, filterStatus, search]);

  // 3. PROVISIONS TAB DATA
  const displayedProvisions = useMemo(() => {
    return provisions.filter((p) => {
      if (selectedOffice !== "ALL" && p.officeName !== selectedOffice) return false;
      if (filterStatus !== "ALL" && p.status !== filterStatus) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const m =
          (p.code && p.code.toLowerCase().includes(q)) ||
          p.provisionNumber.toLowerCase().includes(q) ||
          p.officeName.toLowerCase().includes(q) ||
          (p.partnerPayee && p.partnerPayee.toLowerCase().includes(q)) ||
          p.description.toLowerCase().includes(q);
        if (!m) return false;
      }
      return true;
    });
  }, [provisions, selectedOffice, filterStatus, search]);

  // 4. PAID TAB DATA (Expenses with status === 'PAID')
  const displayedPaid = useMemo(() => {
    return expenses
      .filter((e) => e.status === "PAID")
      .filter((e) => {
        if (selectedOffice !== "ALL" && e.officeName !== selectedOffice) return false;
        if (filterStatus !== "ALL" && e.status !== filterStatus) return false;
        if (search.trim()) {
          const q = search.toLowerCase();
          const m =
            (e.code && e.code.toLowerCase().includes(q)) ||
            (e.transactionNo && e.transactionNo.toLowerCase().includes(q)) ||
            e.officeName.toLowerCase().includes(q) ||
            e.description.toLowerCase().includes(q);
          if (!m) return false;
        }
        return true;
      });
  }, [expenses, selectedOffice, filterStatus, search]);

  // Calculations for Footer Totals
  const totalExpenseAmount = useMemo(
    () => displayedExpenses.reduce((sum, e) => sum + (e.amount || 0), 0),
    [displayedExpenses],
  );
  const totalAdvanceAmount = useMemo(
    () => displayedAdvances.reduce((sum, a) => sum + (a.amount || a.approvedAmount || 0), 0),
    [displayedAdvances],
  );
  const totalProvisionAmount = useMemo(
    () => displayedProvisions.reduce((sum, p) => sum + (p.amount || 0), 0),
    [displayedProvisions],
  );
  const totalPaidAmount = useMemo(
    () => displayedPaid.reduce((sum, p) => sum + (p.amount || 0), 0),
    [displayedPaid],
  );

  // Checkbox handlers
  const handleToggleSelectExpense = (id: string) => {
    setSelectedExpenseIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  const handleSelectAllExpenses = () => {
    if (selectedExpenseIds.length === displayedExpenses.length) {
      setSelectedExpenseIds([]);
    } else {
      setSelectedExpenseIds(displayedExpenses.map((e) => e.id));
    }
  };

  const handleToggleSelectProvision = (id: string) => {
    setSelectedProvisionIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  const handleSelectAllProvisions = () => {
    if (selectedProvisionIds.length === displayedProvisions.length) {
      setSelectedProvisionIds([]);
    } else {
      setSelectedProvisionIds(displayedProvisions.map((p) => p.id));
    }
  };

  // Create handlers
  const handleCreateExpenseSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (expenseForm.amount <= 0 || !expenseForm.payeeName) return;
    const count = expenses.length + 1;
    const code = `EXP-MG261000${(100 + count).toString()}`;
    createExpense({
      ...expenseForm,
      code,
      partnerPayee: expenseForm.payeeName,
      chartOfAccount: `${accounts.find((a) => a.id === expenseForm.accountId)?.code} - ${expenseForm.accountName}`,
      status: "APPROVED",
    });
    setIsCreateExpenseOpen(false);
  };

  const handleCreateAdvanceSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (advanceForm.requestedAmount <= 0 || !advanceForm.employeeName) return;
    const count = advances.length + 1;
    const code = `ADV-MG261000${(40 + count).toString()}`;
    createAdvance({
      ...advanceForm,
      code,
      partnerPayee: advanceForm.partnerPayee || advanceForm.employeeName,
      amount: advanceForm.requestedAmount,
      approvedAmount: advanceForm.requestedAmount,
      status: "APPROVED",
    });
    setIsCreateAdvanceOpen(false);
  };

  const handleCreateProvisionSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (provisionForm.amount <= 0 || !provisionForm.partnerPayee) return;
    const count = provisions.length + 1;
    const code = `PRV-MG261000${(10 + count).toString()}`;
    createProvision({
      ...provisionForm,
      code,
      chartOfAccount: "303 - Payables, Provision And Accruals",
      status: "POSTED",
    });
    setIsCreateProvisionOpen(false);
  };

  // Convert selected to paid
  const handleMarkSelectedPaid = () => {
    if (selectedExpenseIds.length === 0) {
      alert("Please select at least one expense record to process payment.");
      return;
    }
    selectedExpenseIds.forEach((id) => {
      markExpensePaid(id, "BANK");
    });
    setSelectedExpenseIds([]);
    alert("Selected expenses marked as paid.");
  };

  return (
    <div className="space-y-2.5 font-sans pb-12">
      {/* ------------------------------------------------------------- */}
      {/* 1. TOP HEADER: TITLE + SEARCH + ACTION BUTTON */}
      {/* ------------------------------------------------------------- */}
      <div className="bg-white rounded border border-slate-200/90 shadow-2xs p-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h1 className="text-base font-semibold text-slate-800">Expense/Advance</h1>

          <div className="flex items-center gap-2">
            {/* Search Box */}
            <div className="relative min-w-[200px]">
              <input
                type="text"
                placeholder="Search...."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pr-8 pl-2.5 py-1 text-xs border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
              />
              <Search className="w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            </div>

            {/* Contextual Action Button */}
            {activeTab === "EXPENSE" && (
              <button
                onClick={() => setIsCreateExpenseOpen(true)}
                className="inline-flex items-center gap-1 px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-medium transition-colors shadow-2xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Create Expense</span>
              </button>
            )}

            {activeTab === "ADVANCE" && (
              <button
                onClick={() => setIsCreateAdvanceOpen(true)}
                className="inline-flex items-center gap-1 px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-medium transition-colors shadow-2xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Create Advance</span>
              </button>
            )}

            {activeTab === "PROVISION" && (
              <button
                onClick={() => setIsCreateProvisionOpen(true)}
                className="inline-flex items-center gap-1 px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-medium transition-colors shadow-2xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Create Advance</span>
              </button>
            )}
          </div>
        </div>

        {/* ------------------------------------------------------------- */}
        {/* 2. MAIN TABS: EXPENSE | ADVANCE | PROVISION | PAID */}
        {/* ------------------------------------------------------------- */}
        <div className="flex items-center gap-6 border-b border-slate-200 mt-3 pt-1 text-xs font-medium">
          <button
            onClick={() => setActiveTab("EXPENSE")}
            className={`pb-2 tracking-wide uppercase transition-colors ${
              activeTab === "EXPENSE"
                ? "text-blue-600 border-b-2 border-blue-600 font-semibold"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            EXPENSE
          </button>
          <button
            onClick={() => setActiveTab("ADVANCE")}
            className={`pb-2 tracking-wide uppercase transition-colors ${
              activeTab === "ADVANCE"
                ? "text-blue-600 border-b-2 border-blue-600 font-semibold"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            ADVANCE
          </button>
          <button
            onClick={() => setActiveTab("PROVISION")}
            className={`pb-2 tracking-wide uppercase transition-colors ${
              activeTab === "PROVISION"
                ? "text-blue-600 border-b-2 border-blue-600 font-semibold"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            PROVISION
          </button>
          <button
            onClick={() => setActiveTab("PAID")}
            className={`pb-2 tracking-wide uppercase transition-colors ${
              activeTab === "PAID"
                ? "text-blue-600 border-b-2 border-blue-600 font-semibold"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            PAID
          </button>
        </div>

        {/* ------------------------------------------------------------- */}
        {/* 3. FILTER TOOLBAR PER TAB (Exact Screenshot Layout) */}
        {/* ------------------------------------------------------------- */}
        <div className="mt-3">
          {/* TAB 1: EXPENSE FILTERS */}
          {activeTab === "EXPENSE" && (
            <div className="space-y-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-2.5">
                <div>
                  <label className="block text-[11px] font-medium text-slate-500 mb-0.5">Office</label>
                  <select
                    value={selectedOffice}
                    onChange={(e) => setSelectedOffice(e.target.value)}
                    className="w-full text-xs border border-slate-300 rounded px-2.5 py-1 focus:ring-1 focus:ring-blue-500 bg-white text-slate-700"
                  >
                    {officeList.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-500 mb-0.5">From</label>
                  <input
                    type="date"
                    value={fromDate}
                    onChange={(e) => setFromDate(e.target.value)}
                    className="w-full text-xs border border-slate-300 rounded px-2.5 py-1 focus:ring-1 focus:ring-blue-500 bg-white text-slate-700"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-500 mb-0.5">To</label>
                  <input
                    type="date"
                    value={toDate}
                    onChange={(e) => setToDate(e.target.value)}
                    className="w-full text-xs border border-slate-300 rounded px-2.5 py-1 focus:ring-1 focus:ring-blue-500 bg-white text-slate-700"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-500 mb-0.5">Filter By</label>
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="w-full text-xs border border-slate-300 rounded px-2.5 py-1 focus:ring-1 focus:ring-blue-500 bg-white text-slate-700"
                  >
                    <option value="ALL">Status</option>
                    <option value="APPROVED">Approved</option>
                    <option value="PENDING">Pending</option>
                    <option value="PAID">Paid</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-500 mb-0.5">Expense Type</label>
                  <select
                    value={filterExpenseType}
                    onChange={(e) => setFilterExpenseType(e.target.value)}
                    className="w-full text-xs border border-slate-300 rounded px-2.5 py-1 focus:ring-1 focus:ring-blue-500 bg-white text-slate-700 truncate"
                  >
                    <option value="ALL">Expense Type</option>
                    {expenseTypes.filter((t) => t !== "ALL").map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Row 2 of Expense filter */}
              <div className="flex items-end gap-2.5 max-w-sm">
                <div className="flex-1">
                  <label className="block text-[11px] font-medium text-slate-500 mb-0.5">Accounts Head</label>
                  <select
                    value={filterAccountHead}
                    onChange={(e) => setFilterAccountHead(e.target.value)}
                    className="w-full text-xs border border-slate-300 rounded px-2.5 py-1 focus:ring-1 focus:ring-blue-500 bg-white text-slate-700 truncate"
                  >
                    {accountsHeads.map((ah) => (
                      <option key={ah.id} value={ah.id}>
                        {ah.name}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  type="button"
                  className="px-5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-semibold shadow-2xs transition-colors"
                >
                  View
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: ADVANCE FILTERS & SUB-TABS */}
          {activeTab === "ADVANCE" && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-2.5 items-end">
                <div>
                  <label className="block text-[11px] font-medium text-slate-500 mb-0.5">Office</label>
                  <select
                    value={selectedOffice}
                    onChange={(e) => setSelectedOffice(e.target.value)}
                    className="w-full text-xs border border-slate-300 rounded px-2.5 py-1 focus:ring-1 focus:ring-blue-500 bg-white text-slate-700"
                  >
                    {officeList.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-500 mb-0.5">From</label>
                  <input
                    type="date"
                    value={fromDate}
                    onChange={(e) => setFromDate(e.target.value)}
                    className="w-full text-xs border border-slate-300 rounded px-2.5 py-1 focus:ring-1 focus:ring-blue-500 bg-white text-slate-700"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-500 mb-0.5">To</label>
                  <input
                    type="date"
                    value={toDate}
                    onChange={(e) => setToDate(e.target.value)}
                    className="w-full text-xs border border-slate-300 rounded px-2.5 py-1 focus:ring-1 focus:ring-blue-500 bg-white text-slate-700"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-500 mb-0.5">Filter By</label>
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="w-full text-xs border border-slate-300 rounded px-2.5 py-1 focus:ring-1 focus:ring-blue-500 bg-white text-slate-700"
                  >
                    <option value="ALL">Status</option>
                    <option value="APPROVED">Approved</option>
                    <option value="PENDING">Pending</option>
                    <option value="SETTLED">Settled</option>
                  </select>
                </div>
                <div>
                  <button
                    type="button"
                    className="px-5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-semibold shadow-2xs transition-colors"
                  >
                    View
                  </button>
                </div>
              </div>

              {/* Sub Tabs: ADVANCE | INVOICE ADVANCE COLLECTION */}
              <div className="flex items-center gap-6 border-b border-slate-200 pt-1 text-xs">
                <button
                  onClick={() => setAdvanceSubTab("ADVANCE")}
                  className={`pb-1.5 uppercase font-medium transition-colors ${
                    advanceSubTab === "ADVANCE"
                      ? "text-blue-600 border-b-2 border-blue-600 font-semibold"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  ADVANCE
                </button>
                <button
                  onClick={() => setAdvanceSubTab("INVOICE_ADVANCE_COLLECTION")}
                  className={`pb-1.5 uppercase font-medium transition-colors ${
                    advanceSubTab === "INVOICE_ADVANCE_COLLECTION"
                      ? "text-blue-600 border-b-2 border-blue-600 font-semibold"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  INVOICE ADVANCE COLLECTION
                </button>
              </div>
            </div>
          )}

          {/* TAB 3: PROVISION FILTERS */}
          {activeTab === "PROVISION" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5 items-end">
              <div>
                <label className="block text-[11px] font-medium text-slate-500 mb-0.5">Office</label>
                <select
                  value={selectedOffice}
                  onChange={(e) => setSelectedOffice(e.target.value)}
                  className="w-full text-xs border border-slate-300 rounded px-2.5 py-1 focus:ring-1 focus:ring-blue-500 bg-white text-slate-700"
                >
                  {officeList.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-medium text-slate-500 mb-0.5">From</label>
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="w-full text-xs border border-slate-300 rounded px-2.5 py-1 focus:ring-1 focus:ring-blue-500 bg-white text-slate-700"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-slate-500 mb-0.5">To</label>
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="w-full text-xs border border-slate-300 rounded px-2.5 py-1 focus:ring-1 focus:ring-blue-500 bg-white text-slate-700"
                />
              </div>
              <div>
                <button
                  type="button"
                  className="px-5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-semibold shadow-2xs transition-colors"
                >
                  View
                </button>
              </div>
            </div>
          )}

          {/* TAB 4: PAID FILTERS */}
          {activeTab === "PAID" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-2.5 items-end">
              <div>
                <label className="block text-[11px] font-medium text-slate-500 mb-0.5">Office</label>
                <select
                  value={selectedOffice}
                  onChange={(e) => setSelectedOffice(e.target.value)}
                  className="w-full text-xs border border-slate-300 rounded px-2.5 py-1 focus:ring-1 focus:ring-blue-500 bg-white text-slate-700"
                >
                  {officeList.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-medium text-slate-500 mb-0.5">From</label>
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="w-full text-xs border border-slate-300 rounded px-2.5 py-1 focus:ring-1 focus:ring-blue-500 bg-white text-slate-700"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-slate-500 mb-0.5">To</label>
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="w-full text-xs border border-slate-300 rounded px-2.5 py-1 focus:ring-1 focus:ring-blue-500 bg-white text-slate-700"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-slate-500 mb-0.5">Filter By</label>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="w-full text-xs border border-slate-300 rounded px-2.5 py-1 focus:ring-1 focus:ring-blue-500 bg-white text-slate-700"
                >
                  <option value="ALL">Status</option>
                  <option value="PAID">Paid</option>
                </select>
              </div>
              <div>
                <button
                  type="button"
                  className="px-5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-semibold shadow-2xs transition-colors"
                >
                  View
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 4. TABLE ACTION BUTTONS (PROVISION & PAYMENT) */}
      {/* ------------------------------------------------------------- */}
      {(activeTab === "EXPENSE" || activeTab === "PROVISION") && (
        <div className="flex items-center justify-end gap-2 pr-1">
          {activeTab === "EXPENSE" && (
            <button
              onClick={() => setIsCreateProvisionOpen(true)}
              className="px-3 py-1 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 rounded text-xs font-medium shadow-2xs transition-colors"
            >
              Provision
            </button>
          )}
          <button
            onClick={handleMarkSelectedPaid}
            className="px-3 py-1 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 rounded text-xs font-medium shadow-2xs transition-colors"
          >
            Payment
          </button>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 5. DATA TABLES (Matches Screenshots 1, 2, 3, 4) */}
      {/* ------------------------------------------------------------- */}
      <div className="bg-white rounded border border-slate-200/90 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          {/* TAB 1: EXPENSE TABLE */}
          {activeTab === "EXPENSE" && (
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#f0f4f8] text-slate-700 font-semibold border-b border-slate-200 uppercase text-[11px] tracking-wider">
                  <th className="py-2 px-3 w-8 text-center">
                    <input
                      type="checkbox"
                      checked={
                        displayedExpenses.length > 0 &&
                        selectedExpenseIds.length === displayedExpenses.length
                      }
                      onChange={handleSelectAllExpenses}
                      className="rounded border-slate-300 text-blue-600 focus:ring-0"
                    />
                  </th>
                  <th className="py-2 px-3 w-10 text-center">SL</th>
                  <th className="py-2 px-3 w-24">Date</th>
                  <th className="py-2 px-3 w-32">Code</th>
                  <th className="py-2 px-3 w-36">Office Name</th>
                  <th className="py-2 px-3 w-36">Expense Type</th>
                  <th className="py-2 px-3 w-44">Partner/Payee</th>
                  <th className="py-2 px-3 w-48">Chart Of Account</th>
                  <th className="py-2 px-3">Description</th>
                  <th className="py-2 px-3 text-right w-24">Amount</th>
                  <th className="py-2 px-3 text-center w-24">Status</th>
                  <th className="py-2 px-3 text-center w-20">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {displayedExpenses.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="py-8 text-center text-slate-400">
                      No expense records found.
                    </td>
                  </tr>
                ) : (
                  displayedExpenses.map((e, index) => (
                    <tr key={e.id} className="hover:bg-blue-50/40 transition-colors">
                      <td className="py-2 px-3 text-center">
                        <input
                          type="checkbox"
                          checked={selectedExpenseIds.includes(e.id)}
                          onChange={() => handleToggleSelectExpense(e.id)}
                          className="rounded border-slate-300 text-blue-600 focus:ring-0"
                        />
                      </td>
                      <td className="py-2 px-3 text-center text-slate-500">{index + 1}</td>
                      <td className="py-2 px-3 whitespace-nowrap text-slate-600">{e.date}</td>
                      <td className="py-2 px-3 font-mono text-blue-600 font-medium whitespace-nowrap">
                        {e.code || e.expenseNumber}
                      </td>
                      <td className="py-2 px-3 whitespace-nowrap font-medium text-slate-800">{e.officeName}</td>
                      <td className="py-2 px-3 whitespace-nowrap text-slate-600">{e.expenseType}</td>
                      <td className="py-2 px-3 whitespace-nowrap font-medium text-slate-800">{e.partnerPayee || e.payeeName}</td>
                      <td className="py-2 px-3 whitespace-nowrap text-slate-600 truncate max-w-[180px]" title={e.chartOfAccount || e.accountName}>
                        {e.chartOfAccount || e.accountName}
                      </td>
                      <td className="py-2 px-3 text-slate-600 truncate max-w-[200px]" title={e.description}>
                        {e.description}
                      </td>
                      <td className="py-2 px-3 text-right font-mono font-medium text-slate-900 whitespace-nowrap">
                        {e.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="py-2 px-3 text-center whitespace-nowrap">
                        {e.status === "APPROVED" ? (
                          <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            Approved
                          </span>
                        ) : e.status === "PENDING" ? (
                          <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                            Pending
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                            Paid
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => setViewingRecord(e)}
                            title="View Details"
                            className="w-6 h-6 rounded-full bg-slate-100 hover:bg-blue-100 text-slate-600 hover:text-blue-700 flex items-center justify-center transition-colors"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              <tfoot>
                <tr className="bg-slate-50 font-semibold border-t border-slate-200 text-slate-800">
                  <td colSpan={8} className="py-2 px-3"></td>
                  <td className="py-2 px-3 text-right">Total</td>
                  <td className="py-2 px-3 text-right font-mono text-slate-900">
                    {totalExpenseAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td colSpan={2} className="py-2 px-3"></td>
                </tr>
              </tfoot>
            </table>
          )}

          {/* TAB 2: ADVANCE TABLE */}
          {activeTab === "ADVANCE" && (
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#f0f4f8] text-slate-700 font-semibold border-b border-slate-200 uppercase text-[11px] tracking-wider">
                  <th className="py-2 px-3 w-10 text-center">SL</th>
                  <th className="py-2 px-3 w-24">Date</th>
                  <th className="py-2 px-3 w-32">Code</th>
                  <th className="py-2 px-3 w-36">Office Name</th>
                  <th className="py-2 px-3 w-44">Partner/Payee</th>
                  <th className="py-2 px-3 w-52">Chart Of Accounts</th>
                  <th className="py-2 px-3">Description</th>
                  <th className="py-2 px-3 text-right w-24">Amount</th>
                  <th className="py-2 px-3 text-center w-24">Status</th>
                  <th className="py-2 px-3 text-center w-20">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {displayedAdvances.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-8 text-center text-slate-400">
                      No advance records found.
                    </td>
                  </tr>
                ) : (
                  displayedAdvances.map((a, index) => (
                    <tr key={a.id} className="hover:bg-blue-50/40 transition-colors">
                      <td className="py-2 px-3 text-center text-slate-500">{index + 1}</td>
                      <td className="py-2 px-3 whitespace-nowrap text-slate-600">{a.date}</td>
                      <td className="py-2 px-3 font-mono text-blue-600 font-medium whitespace-nowrap">
                        {a.code || a.advanceNumber}
                      </td>
                      <td className="py-2 px-3 whitespace-nowrap font-medium text-slate-800">{a.officeName}</td>
                      <td className="py-2 px-3 whitespace-nowrap font-medium text-slate-800">{a.partnerPayee || a.employeeName}</td>
                      <td className="py-2 px-3 whitespace-nowrap text-slate-600 truncate max-w-[200px]" title={a.chartOfAccounts}>
                        {a.chartOfAccounts || "105 - Advance, Deposits & Pre-Payments"}
                      </td>
                      <td className="py-2 px-3 text-slate-600 truncate max-w-[220px]" title={a.purpose}>
                        {a.purpose}
                      </td>
                      <td className="py-2 px-3 text-right font-mono font-medium text-slate-900 whitespace-nowrap">
                        {(a.amount || a.approvedAmount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="py-2 px-3 text-center whitespace-nowrap">
                        {a.status === "APPROVED" ? (
                          <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            Approved
                          </span>
                        ) : a.status === "PENDING" ? (
                          <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                            Pending
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                            Settled
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => setViewingRecord(a)}
                            title="View Details"
                            className="w-6 h-6 rounded-full bg-slate-100 hover:bg-blue-100 text-slate-600 hover:text-blue-700 flex items-center justify-center transition-colors"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              <tfoot>
                <tr className="bg-slate-50 font-semibold border-t border-slate-200 text-slate-800">
                  <td colSpan={6} className="py-2 px-3"></td>
                  <td className="py-2 px-3 text-right">Total</td>
                  <td className="py-2 px-3 text-right font-mono text-slate-900">
                    {totalAdvanceAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td colSpan={2} className="py-2 px-3"></td>
                </tr>
              </tfoot>
            </table>
          )}

          {/* TAB 3: PROVISION TABLE */}
          {activeTab === "PROVISION" && (
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#f0f4f8] text-slate-700 font-semibold border-b border-slate-200 uppercase text-[11px] tracking-wider">
                  <th className="py-2 px-3 w-8 text-center">
                    <input
                      type="checkbox"
                      checked={
                        displayedProvisions.length > 0 &&
                        selectedProvisionIds.length === displayedProvisions.length
                      }
                      onChange={handleSelectAllProvisions}
                      className="rounded border-slate-300 text-blue-600 focus:ring-0"
                    />
                  </th>
                  <th className="py-2 px-3 w-10 text-center">SL</th>
                  <th className="py-2 px-3 w-24">Date</th>
                  <th className="py-2 px-3 w-32">Code</th>
                  <th className="py-2 px-3 w-36">Office Name</th>
                  <th className="py-2 px-3 w-36">Expense Type</th>
                  <th className="py-2 px-3 w-44">Partner/Payee</th>
                  <th className="py-2 px-3 w-48">Chart Of Account</th>
                  <th className="py-2 px-3">Description</th>
                  <th className="py-2 px-3 text-right w-24">Amount</th>
                  <th className="py-2 px-3 text-center w-24">Status</th>
                  <th className="py-2 px-3 text-center w-20">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {displayedProvisions.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="py-8 text-center text-slate-400">
                      No provision records found.
                    </td>
                  </tr>
                ) : (
                  displayedProvisions.map((p, index) => (
                    <tr key={p.id} className="hover:bg-blue-50/40 transition-colors">
                      <td className="py-2 px-3 text-center">
                        <input
                          type="checkbox"
                          checked={selectedProvisionIds.includes(p.id)}
                          onChange={() => handleToggleSelectProvision(p.id)}
                          className="rounded border-slate-300 text-blue-600 focus:ring-0"
                        />
                      </td>
                      <td className="py-2 px-3 text-center text-slate-500">{index + 1}</td>
                      <td className="py-2 px-3 whitespace-nowrap text-slate-600">{p.date || "12/10/2026"}</td>
                      <td className="py-2 px-3 font-mono text-blue-600 font-medium whitespace-nowrap">
                        {p.code || p.provisionNumber}
                      </td>
                      <td className="py-2 px-3 whitespace-nowrap font-medium text-slate-800">{p.officeName}</td>
                      <td className="py-2 px-3 whitespace-nowrap text-slate-600">{p.expenseType || "Provision"}</td>
                      <td className="py-2 px-3 whitespace-nowrap font-medium text-slate-800">{p.partnerPayee || "General Provision"}</td>
                      <td className="py-2 px-3 whitespace-nowrap text-slate-600 truncate max-w-[180px]" title={p.chartOfAccount || p.accountName}>
                        {p.chartOfAccount || p.accountName}
                      </td>
                      <td className="py-2 px-3 text-slate-600 truncate max-w-[200px]" title={p.description}>
                        {p.description}
                      </td>
                      <td className="py-2 px-3 text-right font-mono font-medium text-slate-900 whitespace-nowrap">
                        {p.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="py-2 px-3 text-center whitespace-nowrap">
                        {p.status === "POSTED" ? (
                          <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            Posted
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                            Pending
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => setViewingRecord(p)}
                            title="View Details"
                            className="w-6 h-6 rounded-full bg-slate-100 hover:bg-blue-100 text-slate-600 hover:text-blue-700 flex items-center justify-center transition-colors"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              <tfoot>
                <tr className="bg-slate-50 font-semibold border-t border-slate-200 text-slate-800">
                  <td colSpan={8} className="py-2 px-3"></td>
                  <td className="py-2 px-3 text-right">Total</td>
                  <td className="py-2 px-3 text-right font-mono text-slate-900">
                    {totalProvisionAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td colSpan={2} className="py-2 px-3"></td>
                </tr>
              </tfoot>
            </table>
          )}

          {/* TAB 4: PAID TABLE */}
          {activeTab === "PAID" && (
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#f0f4f8] text-slate-700 font-semibold border-b border-slate-200 uppercase text-[11px] tracking-wider">
                  <th className="py-2 px-3 w-10 text-center">SL</th>
                  <th className="py-2 px-3 w-28">Registration Date</th>
                  <th className="py-2 px-3 w-28">Transaction Date</th>
                  <th className="py-2 px-3 w-32">Transaction No</th>
                  <th className="py-2 px-3 w-32">Registration Code</th>
                  <th className="py-2 px-3 w-36">Office Name</th>
                  <th className="py-2 px-3 w-44">Partner/Payee</th>
                  <th className="py-2 px-3">Description</th>
                  <th className="py-2 px-3 text-right w-24">Amount</th>
                  <th className="py-2 px-3 text-center w-24">Status</th>
                  <th className="py-2 px-3 text-center w-20">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {displayedPaid.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="py-8 text-center text-slate-400">
                      No paid transaction records found.
                    </td>
                  </tr>
                ) : (
                  displayedPaid.map((p, index) => (
                    <tr key={p.id} className="hover:bg-blue-50/40 transition-colors">
                      <td className="py-2 px-3 text-center text-slate-500">{index + 1}</td>
                      <td className="py-2 px-3 whitespace-nowrap text-slate-600">{p.registrationDate || p.date}</td>
                      <td className="py-2 px-3 whitespace-nowrap text-slate-600">{p.transactionDate || p.date}</td>
                      <td className="py-2 px-3 font-mono text-blue-600 font-medium whitespace-nowrap">
                        {p.transactionNo || "TXN-EXP-0000"}
                      </td>
                      <td className="py-2 px-3 font-mono text-slate-700 whitespace-nowrap">
                        {p.registrationCode || p.code || p.expenseNumber}
                      </td>
                      <td className="py-2 px-3 whitespace-nowrap font-medium text-slate-800">{p.officeName}</td>
                      <td className="py-2 px-3 whitespace-nowrap font-medium text-slate-800">{p.partnerPayee || p.payeeName}</td>
                      <td className="py-2 px-3 text-slate-600 truncate max-w-[240px]" title={p.description}>
                        {p.description}
                      </td>
                      <td className="py-2 px-3 text-right font-mono font-medium text-slate-900 whitespace-nowrap">
                        {p.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="py-2 px-3 text-center whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          Paid
                        </span>
                      </td>
                      <td className="py-2 px-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => setViewingRecord(p)}
                            title="View Details"
                            className="w-6 h-6 rounded-full bg-slate-100 hover:bg-blue-100 text-slate-600 hover:text-blue-700 flex items-center justify-center transition-colors"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              <tfoot>
                <tr className="bg-slate-50 font-semibold border-t border-slate-200 text-slate-800">
                  <td colSpan={7} className="py-2 px-3"></td>
                  <td className="py-2 px-3 text-right">Total</td>
                  <td className="py-2 px-3 text-right font-mono text-slate-900">
                    {totalPaidAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td colSpan={2} className="py-2 px-3"></td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 6. MODAL: CREATE EXPENSE */}
      {/* ------------------------------------------------------------- */}
      <ModalDialog
        isOpen={isCreateExpenseOpen}
        onClose={() => setIsCreateExpenseOpen(false)}
        title="Create Expense Voucher"
        maxWidth="lg"
      >
        <form onSubmit={handleCreateExpenseSubmit} className="space-y-3.5 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-slate-700 mb-1">Office / Branch *</label>
              <select
                value={expenseForm.officeName}
                onChange={(e) => setExpenseForm({ ...expenseForm, officeName: e.target.value })}
                className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white focus:ring-1 focus:ring-blue-500"
              >
                {officeList.filter((o) => o.id !== "ALL").map((o) => (
                  <option key={o.id} value={o.name}>
                    {o.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">Expense Type *</label>
              <select
                value={expenseForm.expenseType}
                onChange={(e) => setExpenseForm({ ...expenseForm, expenseType: e.target.value })}
                className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white focus:ring-1 focus:ring-blue-500"
              >
                {expenseTypes.filter((t) => t !== "ALL").map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">Partner / Payee Name *</label>
              <input
                type="text"
                required
                placeholder="e.g. Apex Engineering Works"
                value={expenseForm.payeeName}
                onChange={(e) => setExpenseForm({ ...expenseForm, payeeName: e.target.value })}
                className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">Amount (৳) *</label>
              <input
                type="number"
                required
                min="1"
                step="0.01"
                placeholder="0.00"
                value={expenseForm.amount || ""}
                onChange={(e) => setExpenseForm({ ...expenseForm, amount: parseFloat(e.target.value) || 0 })}
                className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white font-mono focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">Chart of Account *</label>
              <select
                value={expenseForm.accountId}
                onChange={(e) => {
                  const acc = accounts.find((a) => a.id === e.target.value);
                  setExpenseForm({
                    ...expenseForm,
                    accountId: e.target.value,
                    accountName: acc ? acc.name : expenseForm.accountName,
                  });
                }}
                className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white focus:ring-1 focus:ring-blue-500"
              >
                {accounts
                  .filter((a) => a.accountType === "EXPENSE" && !a.isGroup)
                  .map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.code} - {a.name}
                    </option>
                  ))}
              </select>
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">Payment Method</label>
              <select
                value={expenseForm.paymentMethod}
                onChange={(e) => setExpenseForm({ ...expenseForm, paymentMethod: e.target.value as PaymentMethod })}
                className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white focus:ring-1 focus:ring-blue-500"
              >
                <option value="BANK">Bank Transfer</option>
                <option value="CHEQUE">Cheque</option>
                <option value="CASH">Cash in Hand</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block font-medium text-slate-700 mb-1">Description / Particulars *</label>
            <textarea
              required
              rows={2}
              placeholder="Enter details of expense voucher..."
              value={expenseForm.description}
              onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })}
              className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsCreateExpenseOpen(false)}
              className="px-4 py-1.5 border border-slate-300 rounded text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-semibold shadow-2xs transition-colors"
            >
              Save Expense
            </button>
          </div>
        </form>
      </ModalDialog>

      {/* ------------------------------------------------------------- */}
      {/* 7. MODAL: CREATE ADVANCE */}
      {/* ------------------------------------------------------------- */}
      <ModalDialog
        isOpen={isCreateAdvanceOpen}
        onClose={() => setIsCreateAdvanceOpen(false)}
        title="Create Advance Request"
        maxWidth="lg"
      >
        <form onSubmit={handleCreateAdvanceSubmit} className="space-y-3.5 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-slate-700 mb-1">Office / Branch *</label>
              <select
                value={advanceForm.officeName}
                onChange={(e) => setAdvanceForm({ ...advanceForm, officeName: e.target.value })}
                className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white focus:ring-1 focus:ring-blue-500"
              >
                {officeList.filter((o) => o.id !== "ALL").map((o) => (
                  <option key={o.id} value={o.name}>
                    {o.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">Employee / Partner Name *</label>
              <input
                type="text"
                required
                placeholder="e.g. Md. Tofajjol Hossin"
                value={advanceForm.employeeName}
                onChange={(e) => setAdvanceForm({ ...advanceForm, employeeName: e.target.value })}
                className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">Requested Amount (৳) *</label>
              <input
                type="number"
                required
                min="1"
                step="0.01"
                placeholder="0.00"
                value={advanceForm.requestedAmount || ""}
                onChange={(e) => setAdvanceForm({ ...advanceForm, requestedAmount: parseFloat(e.target.value) || 0 })}
                className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white font-mono focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">Chart of Accounts</label>
              <input
                type="text"
                disabled
                value={advanceForm.chartOfAccounts}
                className="w-full border border-slate-200 rounded px-2.5 py-1.5 bg-slate-100 text-slate-500"
              />
            </div>
          </div>
          <div>
            <label className="block font-medium text-slate-700 mb-1">Purpose / Description *</label>
            <textarea
              required
              rows={2}
              placeholder="State the purpose for this advance requisition..."
              value={advanceForm.purpose}
              onChange={(e) => setAdvanceForm({ ...advanceForm, purpose: e.target.value })}
              className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsCreateAdvanceOpen(false)}
              className="px-4 py-1.5 border border-slate-300 rounded text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-semibold shadow-2xs transition-colors"
            >
              Save Advance
            </button>
          </div>
        </form>
      </ModalDialog>

      {/* ------------------------------------------------------------- */}
      {/* 8. MODAL: CREATE PROVISION */}
      {/* ------------------------------------------------------------- */}
      <ModalDialog
        isOpen={isCreateProvisionOpen}
        onClose={() => setIsCreateProvisionOpen(false)}
        title="Create Provision Record"
        maxWidth="lg"
      >
        <form onSubmit={handleCreateProvisionSubmit} className="space-y-3.5 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-slate-700 mb-1">Office / Branch *</label>
              <select
                value={provisionForm.officeName}
                onChange={(e) => setProvisionForm({ ...provisionForm, officeName: e.target.value })}
                className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white focus:ring-1 focus:ring-blue-500"
              >
                {officeList.filter((o) => o.id !== "ALL").map((o) => (
                  <option key={o.id} value={o.name}>
                    {o.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">Expense Type *</label>
              <select
                value={provisionForm.expenseType}
                onChange={(e) => setProvisionForm({ ...provisionForm, expenseType: e.target.value })}
                className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white focus:ring-1 focus:ring-blue-500"
              >
                <option value="Factory Wages Provision">Factory Wages Provision</option>
                <option value="Office Lease Provision">Office Lease Provision</option>
                <option value="Machinery Overhaul Provision">Machinery Overhaul Provision</option>
                <option value="Audit & Tax Provision">Audit & Tax Provision</option>
              </select>
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">Partner / Payee *</label>
              <input
                type="text"
                required
                placeholder="e.g. Daily Contract Laborers"
                value={provisionForm.partnerPayee}
                onChange={(e) => setProvisionForm({ ...provisionForm, partnerPayee: e.target.value })}
                className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">Provision Amount (৳) *</label>
              <input
                type="number"
                required
                min="1"
                step="0.01"
                placeholder="0.00"
                value={provisionForm.amount || ""}
                onChange={(e) => setProvisionForm({ ...provisionForm, amount: parseFloat(e.target.value) || 0 })}
                className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white font-mono focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>
          <div>
            <label className="block font-medium text-slate-700 mb-1">Description *</label>
            <textarea
              required
              rows={2}
              placeholder="State details of the accrued liability provision..."
              value={provisionForm.description}
              onChange={(e) => setProvisionForm({ ...provisionForm, description: e.target.value })}
              className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsCreateProvisionOpen(false)}
              className="px-4 py-1.5 border border-slate-300 rounded text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-semibold shadow-2xs transition-colors"
            >
              Save Provision
            </button>
          </div>
        </form>
      </ModalDialog>

      {/* ------------------------------------------------------------- */}
      {/* 9. MODAL: VIEW DETAILS */}
      {/* ------------------------------------------------------------- */}
      <ModalDialog
        isOpen={Boolean(viewingRecord)}
        onClose={() => setViewingRecord(null)}
        title={viewingRecord ? `Details: ${viewingRecord.code || viewingRecord.expenseNumber || viewingRecord.advanceNumber || viewingRecord.provisionNumber}` : ""}
        maxWidth="md"
      >
        {viewingRecord && (
          <div className="space-y-3 text-xs">
            <div className="p-3 bg-slate-50 rounded border border-slate-200 space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-500">Office:</span>
                <span className="font-semibold text-slate-800">{viewingRecord.officeName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Date:</span>
                <span className="font-medium text-slate-800">{viewingRecord.date || viewingRecord.registrationDate}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Partner / Payee:</span>
                <span className="font-medium text-slate-800">{viewingRecord.partnerPayee || viewingRecord.payeeName || viewingRecord.employeeName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Account:</span>
                <span className="text-slate-800">{viewingRecord.chartOfAccount || viewingRecord.chartOfAccounts || viewingRecord.accountName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Status:</span>
                <span className="font-semibold text-blue-600">{viewingRecord.status}</span>
              </div>
              <div className="flex justify-between border-t border-slate-200 pt-1.5">
                <span className="font-semibold text-slate-700">Amount:</span>
                <span className="font-mono font-bold text-slate-900 text-sm">
                  ৳{(viewingRecord.amount || viewingRecord.approvedAmount || 0).toLocaleString()}
                </span>
              </div>
            </div>
            <div>
              <span className="font-semibold text-slate-700 block mb-0.5">Description:</span>
              <p className="p-2 bg-white rounded border border-slate-200 text-slate-600">
                {viewingRecord.description || viewingRecord.purpose}
              </p>
            </div>
            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setViewingRecord(null)}
                className="px-4 py-1.5 border border-slate-300 rounded text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </ModalDialog>
    </div>
  );
}
