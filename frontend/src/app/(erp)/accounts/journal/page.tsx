"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowRightLeft,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  Eye,
  FileSpreadsheet,
  FileText,
  Filter,
  Lock,
  Pencil,
  Plus,
  Printer,
  RotateCcw,
  Search,
  ShieldCheck,
  Trash2,
  X,
} from "lucide-react";
import { ModalDialog } from "@/components/purchase/ModalDialog";
import { useAccountingStore } from "@/features/accounts/store/accounting-store";
import type { JournalLineItem, JournalType, JournalVoucher, VoucherStatus } from "@/features/accounts/types";

export default function AccountingJournalPage() {
  const vouchers = useAccountingStore((s) => s.vouchers);
  const accounts = useAccountingStore((s) => s.accounts);
  const createVoucher = useAccountingStore((s) => s.createVoucher);
  const postVoucher = useAccountingStore((s) => s.postVoucher);

  // Tabs: "ACCOUNTING_JOURNAL" | "PENDING_VOUCHER" | "VOUCHER_REPOSITORY"
  const [activeTab, setActiveTab] = useState<"ACCOUNTING_JOURNAL" | "PENDING_VOUCHER" | "VOUCHER_REPOSITORY">("ACCOUNTING_JOURNAL");

  // Common Filters
  const [search, setSearch] = useState("");
  const [selectedOffice, setSelectedOffice] = useState<string>("ALL");
  const [selectedTransType, setSelectedTransType] = useState<string>("ALL");
  const [fromDate, setFromDate] = useState("2026-10-05");
  const [toDate, setToDate] = useState("2026-10-12");

  // Repository-specific filters
  const [repoStatus, setRepoStatus] = useState<string>("ALL");
  const [prepareBy, setPrepareBy] = useState<string>("ALL");

  // Pagination
  const [rowsPerPage, setRowsPerPage] = useState<number>(50);
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Modals
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");
  const [viewingVoucher, setViewingVoucher] = useState<JournalVoucher | null>(null);
  const [approveConfirmTarget, setApproveConfirmTarget] = useState<JournalVoucher | null>(null);

  // New Voucher Form
  const [newVoucherHeader, setNewVoucherHeader] = useState({
    transactionDate: new Date().toISOString().split("T")[0],
    officeId: "office-sirajganj",
    officeName: "MG Sirajganj Factory",
    fiscalYear: "2026-2027",
    journalType: "GENERAL" as JournalType,
    transType: "Adjustment Journal (Manual)",
    narration: "",
    referenceNumber: "",
    preparedBy: "Md. Roni Mridha",
    status: "APPROVED" as VoucherStatus,
  });

  const [lines, setLines] = useState<JournalLineItem[]>([
    {
      id: "line-1",
      accountId: "acc-10201",
      accountCode: "10201",
      accountName: "Accounts Receivable",
      debit: 25000,
      credit: 0,
      narration: "Receivable adjustment",
    },
    {
      id: "line-2",
      accountId: "acc-601",
      accountCode: "601",
      accountName: "Sales Income",
      debit: 0,
      credit: 25000,
      narration: "Revenue record",
    },
  ]);

  const totalDebit = useMemo(() => lines.reduce((sum, l) => sum + (Number(l.debit) || 0), 0), [lines]);
  const totalCredit = useMemo(() => lines.reduce((sum, l) => sum + (Number(l.credit) || 0), 0), [lines]);
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01 && totalDebit > 0;

  // Office List for Filter
  const officeOptions = [
    { id: "ALL", name: "All Office" },
    { id: "MG Sirajganj Factory", name: "MG Sirajganj Factory" },
    { id: "MGV-PLC", name: "MGV-PLC" },
    { id: "Dhaka Head Office", name: "Dhaka Head Office" },
    { id: "MBBL-HO", name: "MBBL-HO" },
    { id: "MOHS-Eco", name: "MOHS-Eco" },
    { id: "CFF-Chapai", name: "CFF-Chapai" },
    { id: "MFIL-HO", name: "MFIL-HO" },
  ];

  // Transaction Types for Filter
  const transTypeOptions = [
    "Sales (Auto)",
    "Inventory Movement [Transfer In...]",
    "Inventory Movement [Transfer Out...]",
    "Inventory Movement (Auto)",
    "Adjustment Journal (Manual)",
    "Other Bank Receive Voucher (Auto)",
    "Other Cash Payment Voucher (Manual)",
    "Sales Return (Auto)",
  ];

  // Prepare By Options
  const prepareByOptions = [
    "ALL",
    "Distribution & Logistics",
    "MD. Tofajjol Hossin",
    "RSM Md. Humayun Kabir",
    "Md. Roni Mridha",
    "Md. Manik Miah",
  ];

  // Filtered dataset per tab
  const tabVouchers = useMemo(() => {
    return vouchers.filter((v) => {
      // Tab 1: Accounting Journal - only approved/posted records
      if (activeTab === "ACCOUNTING_JOURNAL") {
        if (v.status !== "APPROVED" && v.status !== "POSTED") return false;
      }
      // Tab 2: Pending Voucher - pending or in progress
      else if (activeTab === "PENDING_VOUCHER") {
        if (v.status !== "PENDING" && v.status !== "IN_PROGRESS" && v.status !== "DRAFT") return false;
      }
      // Tab 3: Voucher Repository - shows everything (optionally filtered by repoStatus)
      else if (activeTab === "VOUCHER_REPOSITORY") {
        if (repoStatus !== "ALL") {
          if (repoStatus === "APPROVED" && v.status !== "APPROVED" && v.status !== "POSTED") return false;
          if (repoStatus === "PENDING" && v.status !== "PENDING") return false;
          if (repoStatus === "IN_PROGRESS" && v.status !== "IN_PROGRESS") return false;
        }
        if (prepareBy !== "ALL" && v.preparedBy !== prepareBy) return false;
      }

      // Office Filter
      if (selectedOffice !== "ALL" && v.officeName !== selectedOffice) return false;

      // Transaction Type Filter
      if (selectedTransType !== "ALL" && v.transType !== selectedTransType) return false;

      // Search Query
      if (search.trim()) {
        const q = search.toLowerCase();
        const matches =
          v.voucherNumber.toLowerCase().includes(q) ||
          v.narration.toLowerCase().includes(q) ||
          v.officeName.toLowerCase().includes(q) ||
          (v.transType && v.transType.toLowerCase().includes(q)) ||
          (v.preparedBy && v.preparedBy.toLowerCase().includes(q)) ||
          (v.createDate && v.createDate.toLowerCase().includes(q)) ||
          v.lines.some((l) => l.accountName.toLowerCase().includes(q) || l.accountCode.includes(q));
        if (!matches) return false;
      }

      return true;
    });
  }, [vouchers, activeTab, selectedOffice, selectedTransType, repoStatus, prepareBy, search]);

  // Paginated Slicing
  const totalRows = tabVouchers.length;
  const totalPages = Math.ceil(totalRows / rowsPerPage) || 1;
  const paginatedVouchers = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage;
    return tabVouchers.slice(start, start + rowsPerPage);
  }, [tabVouchers, currentPage, rowsPerPage]);

  const handleAddLine = () => {
    const id = `line-${Date.now()}`;
    setLines([...lines, { id, accountId: "acc-1461", accountCode: "1461", accountName: "Cash In Hand", debit: 0, credit: 0, narration: "" }]);
  };

  const handleRemoveLine = (id: string) => {
    if (lines.length <= 2) return;
    setLines(lines.filter((l) => l.id !== id));
  };

  const handleLineChange = (id: string, updates: Partial<JournalLineItem>) => {
    setLines(
      lines.map((l) => {
        if (l.id !== id) return l;
        if (updates.accountId) {
          const acc = accounts.find((a) => a.id === updates.accountId);
          return {
            ...l,
            ...updates,
            accountCode: acc ? acc.code : l.accountCode,
            accountName: acc ? acc.name : l.accountName,
          };
        }
        return { ...l, ...updates };
      }),
    );
  };

  const handleSubmitVoucher = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    setFormSuccess("");

    if (!isBalanced) {
      setFormError(`Cannot save: Total Debit (৳${totalDebit.toLocaleString()}) must equal Total Credit (৳${totalCredit.toLocaleString()}).`);
      return;
    }

    const res = createVoucher({
      ...newVoucherHeader,
      lines,
      createdBy: newVoucherHeader.preparedBy,
      amount: totalDebit,
      createDate: new Date().toLocaleDateString("en-GB").replace(/\//g, "-"),
    });

    if (!res.success) {
      setFormError(res.message);
      return;
    }

    setFormSuccess(res.message);
    setTimeout(() => {
      setIsCreateOpen(false);
      setFormSuccess("");
    }, 800);
  };

  const handleApproveVoucher = (voucher: JournalVoucher) => {
    setApproveConfirmTarget(voucher);
  };

  const confirmApproval = () => {
    if (!approveConfirmTarget) return;
    postVoucher(approveConfirmTarget.id);
    setApproveConfirmTarget(null);
  };

  const handleExportExcel = () => {
    let csv = "SL,Date,Trans Number,Office Name,Trans. Type,Narration,Prepare By,Amount,Status\n";
    tabVouchers.forEach((v, i) => {
      csv += `"${i + 1}","${v.createDate || v.transactionDate}","${v.voucherNumber}","${v.officeName}","${v.transType || v.journalType}","${(v.narration || "").replace(/"/g, '""')}","${v.preparedBy || v.createdBy}","${v.amount || v.totalDebit}","${v.status}"\n`;
    });
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Accounting_Vouchers_${activeTab}_${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-2.5 font-sans pb-12">
      {/* ------------------------------------------------------------- */}
      {/* 1. TOP BAR: TABS ON LEFT + ACTIONS/SEARCH ON RIGHT */}
      {/* ------------------------------------------------------------- */}
      <div className="bg-white rounded border border-slate-200/90 shadow-2xs p-2.5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* TABS */}
          <div className="flex items-center gap-1.5 border-b md:border-b-0 border-slate-200 pb-2 md:pb-0 overflow-x-auto">
            <button
              onClick={() => {
                setActiveTab("ACCOUNTING_JOURNAL");
                setCurrentPage(1);
              }}
              className={`px-4 py-1.5 text-xs font-semibold rounded transition-colors whitespace-nowrap ${
                activeTab === "ACCOUNTING_JOURNAL"
                  ? "bg-[#e0edff] text-[#1e40af] border border-[#bfdbfe]"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              Accounting Journal
            </button>
            <button
              onClick={() => {
                setActiveTab("PENDING_VOUCHER");
                setCurrentPage(1);
              }}
              className={`px-4 py-1.5 text-xs font-semibold rounded transition-colors whitespace-nowrap ${
                activeTab === "PENDING_VOUCHER"
                  ? "bg-[#e0edff] text-[#1e40af] border border-[#bfdbfe]"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              Pending Voucher
            </button>
            <button
              onClick={() => {
                setActiveTab("VOUCHER_REPOSITORY");
                setCurrentPage(1);
              }}
              className={`px-4 py-1.5 text-xs font-semibold rounded transition-colors whitespace-nowrap ${
                activeTab === "VOUCHER_REPOSITORY"
                  ? "bg-[#e0edff] text-[#1e40af] border border-[#bfdbfe]"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              Voucher Repository
            </button>
          </div>

          {/* TOP RIGHT CONTROLS */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Search Box */}
            <div className="relative min-w-[180px]">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full pl-8 pr-2.5 py-1 text-xs border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
              />
            </div>

            {/* Extra Buttons in Voucher Repository Tab */}
            {activeTab === "VOUCHER_REPOSITORY" && (
              <>
                <button
                  onClick={handleExportExcel}
                  className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-medium transition-colors shadow-2xs"
                >
                  Export to Excel
                </button>
                <button
                  onClick={handlePrint}
                  className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-medium transition-colors shadow-2xs"
                >
                  PDF
                </button>
              </>
            )}

            {/* + Journal Button */}
            <button
              onClick={() => setIsCreateOpen(true)}
              className="inline-flex items-center gap-1 px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-medium transition-colors shadow-2xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Journal</span>
            </button>
          </div>
        </div>

        {/* ------------------------------------------------------------- */}
        {/* 2. FILTER TOOLBAR (Matches Screenshots 1, 2, 3) */}
        {/* ------------------------------------------------------------- */}
        <div className="mt-3 pt-3 border-t border-slate-100">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 lg:grid-cols-6 gap-2.5 items-end">
            {/* Office Filter */}
            <div>
              <label className="block text-[11px] font-medium text-slate-600 mb-0.5">Office</label>
              <select
                value={selectedOffice}
                onChange={(e) => {
                  setSelectedOffice(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full text-xs border border-slate-300 rounded px-2.5 py-1 focus:ring-1 focus:ring-blue-500 bg-white text-slate-700"
              >
                {officeOptions.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Transaction Type Filter */}
            <div>
              <label className="block text-[11px] font-medium text-slate-600 mb-0.5">Transaction Type</label>
              <select
                value={selectedTransType}
                onChange={(e) => {
                  setSelectedTransType(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full text-xs border border-slate-300 rounded px-2.5 py-1 focus:ring-1 focus:ring-blue-500 bg-white text-slate-700 truncate"
              >
                <option value="ALL">Transaction Type (All)</option>
                {transTypeOptions.map((tt) => (
                  <option key={tt} value={tt}>
                    {tt}
                  </option>
                ))}
              </select>
            </div>

            {/* Status Filter (Only on Voucher Repository) */}
            {activeTab === "VOUCHER_REPOSITORY" && (
              <div>
                <label className="block text-[11px] font-medium text-slate-600 mb-0.5">Status</label>
                <select
                  value={repoStatus}
                  onChange={(e) => {
                    setRepoStatus(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full text-xs border border-slate-300 rounded px-2.5 py-1 focus:ring-1 focus:ring-blue-500 bg-white text-slate-700"
                >
                  <option value="ALL">Status (All)</option>
                  <option value="APPROVED">Approved</option>
                  <option value="PENDING">Pending</option>
                  <option value="IN_PROGRESS">In Progress</option>
                </select>
              </div>
            )}

            {/* From Date */}
            <div>
              <label className="block text-[11px] font-medium text-slate-600 mb-0.5">From Date</label>
              <div className="relative">
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="w-full text-xs border border-slate-300 rounded px-2.5 py-1 focus:ring-1 focus:ring-blue-500 bg-white text-slate-700"
                />
              </div>
            </div>

            {/* To Date */}
            <div>
              <label className="block text-[11px] font-medium text-slate-600 mb-0.5">To Date</label>
              <div className="relative">
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="w-full text-xs border border-slate-300 rounded px-2.5 py-1 focus:ring-1 focus:ring-blue-500 bg-white text-slate-700"
                />
              </div>
            </div>

            {/* Prepare By (Only on Voucher Repository) */}
            {activeTab === "VOUCHER_REPOSITORY" && (
              <div>
                <label className="block text-[11px] font-medium text-slate-600 mb-0.5">Prepare By</label>
                <select
                  value={prepareBy}
                  onChange={(e) => {
                    setPrepareBy(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full text-xs border border-slate-300 rounded px-2.5 py-1 focus:ring-1 focus:ring-blue-500 bg-white text-slate-700 truncate"
                >
                  {prepareByOptions.map((pb) => (
                    <option key={pb} value={pb}>
                      {pb === "ALL" ? "Prepare By (All)" : pb}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* View Filter Button */}
            <div>
              <button
                onClick={() => setCurrentPage(1)}
                className="w-full sm:w-auto px-5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-semibold transition-colors shadow-2xs"
              >
                View
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 3. MAIN DATA TABLE (Conditional on Tab) */}
      {/* ------------------------------------------------------------- */}
      <div className="bg-white rounded border border-slate-200/90 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          {/* TAB 1: ACCOUNTING JOURNAL TABLE */}
          {activeTab === "ACCOUNTING_JOURNAL" && (
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#f0f4f8] text-slate-700 font-semibold border-b border-slate-200 uppercase text-[11px] tracking-wider">
                  <th className="py-2 px-3 w-12 text-center">SL</th>
                  <th className="py-2 px-3 text-center w-20">Action</th>
                  <th className="py-2 px-3 w-24">Create Date</th>
                  <th className="py-2 px-3 w-36">Transaction Date</th>
                  <th className="py-2 px-3 w-36">Trans Number</th>
                  <th className="py-2 px-3 w-36">Office Name</th>
                  <th className="py-2 px-3 w-44">Trans. Type</th>
                  <th className="py-2 px-3">Narration</th>
                  <th className="py-2 px-3 text-right w-28">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {paginatedVouchers.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-slate-400">
                      No accounting journal entries found matching criteria.
                    </td>
                  </tr>
                ) : (
                  paginatedVouchers.map((v, index) => {
                    const sl = (currentPage - 1) * rowsPerPage + index + 1;
                    return (
                      <tr key={v.id} className="hover:bg-blue-50/40 transition-colors">
                        <td className="py-2 px-3 text-center text-slate-500">{sl}</td>
                        <td className="py-2 px-3 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => setViewingVoucher(v)}
                              title="View Voucher"
                              className="w-6 h-6 rounded-full bg-slate-100 hover:bg-blue-100 text-slate-600 hover:text-blue-700 flex items-center justify-center transition-colors"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setViewingVoucher(v)}
                              title="Print Voucher"
                              className="w-6 h-6 rounded-full bg-slate-100 hover:bg-blue-100 text-slate-600 hover:text-blue-700 flex items-center justify-center transition-colors"
                            >
                              <Printer className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                        <td className="py-2 px-3 text-slate-600 whitespace-nowrap">{v.createDate || v.transactionDate.split(" - ")[0]}</td>
                        <td className="py-2 px-3 text-slate-600 whitespace-nowrap font-mono text-[11px]">{v.transactionDate}</td>
                        <td className="py-2 px-3">
                          <button
                            onClick={() => setViewingVoucher(v)}
                            className="text-blue-600 hover:underline font-medium font-mono text-left"
                          >
                            {v.voucherNumber}
                          </button>
                        </td>
                        <td className="py-2 px-3 font-medium text-slate-800 whitespace-nowrap">{v.officeName}</td>
                        <td className="py-2 px-3 text-slate-600 whitespace-nowrap">{v.transType || v.journalType}</td>
                        <td className="py-2 px-3 text-slate-700 max-w-md truncate" title={v.narration}>
                          {v.narration}
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-medium text-slate-900 whitespace-nowrap">
                          {(v.amount || v.totalDebit).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          )}

          {/* TAB 2: PENDING VOUCHER TABLE */}
          {activeTab === "PENDING_VOUCHER" && (
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#f0f4f8] text-slate-700 font-semibold border-b border-slate-200 uppercase text-[11px] tracking-wider">
                  <th className="py-2 px-3 w-12 text-center">SL</th>
                  <th className="py-2 px-3 text-center w-24">Action</th>
                  <th className="py-2 px-3 w-28">Date</th>
                  <th className="py-2 px-3 w-36">Trans Number</th>
                  <th className="py-2 px-3 w-36">Office Name</th>
                  <th className="py-2 px-3 w-48">Trans. Type</th>
                  <th className="py-2 px-3">Narration</th>
                  <th className="py-2 px-3 text-right w-28">Amount</th>
                  <th className="py-2 px-3 text-center w-28">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {paginatedVouchers.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-slate-400">
                      No pending vouchers waiting for approval.
                    </td>
                  </tr>
                ) : (
                  paginatedVouchers.map((v, index) => {
                    const sl = (currentPage - 1) * rowsPerPage + index + 1;
                    return (
                      <tr key={v.id} className="hover:bg-blue-50/40 transition-colors">
                        <td className="py-2 px-3 text-center text-slate-500">{sl}</td>
                        <td className="py-2 px-3 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => setViewingVoucher(v)}
                              title="Edit / Review Voucher"
                              className="w-6 h-6 rounded-full bg-slate-100 hover:bg-blue-100 text-slate-600 hover:text-blue-700 flex items-center justify-center transition-colors"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleApproveVoucher(v)}
                              title="Approve Voucher"
                              className="w-6 h-6 rounded-full bg-amber-50 hover:bg-emerald-100 text-amber-600 hover:text-emerald-700 flex items-center justify-center transition-colors"
                            >
                              <ShieldCheck className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                        <td className="py-2 px-3 text-slate-600 whitespace-nowrap">{v.createDate || v.transactionDate}</td>
                        <td className="py-2 px-3">
                          <button
                            onClick={() => setViewingVoucher(v)}
                            className="text-blue-600 hover:underline font-medium font-mono text-left"
                          >
                            {v.voucherNumber}
                          </button>
                        </td>
                        <td className="py-2 px-3 font-medium text-slate-800 whitespace-nowrap">{v.officeName}</td>
                        <td className="py-2 px-3 text-slate-600 whitespace-nowrap">{v.transType || v.journalType}</td>
                        <td className="py-2 px-3 text-slate-700 max-w-md truncate" title={v.narration}>
                          {v.narration}
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-medium text-slate-900 whitespace-nowrap">
                          {(v.amount || v.totalDebit).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="py-2 px-3 text-center whitespace-nowrap">
                          {v.status === "PENDING" ? (
                            <span className="px-2 py-0.5 rounded text-[11px] font-semibold text-amber-700 bg-amber-100 border border-amber-200">
                              Pending
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[11px] font-semibold text-slate-700 bg-slate-100 border border-slate-200">
                              In Progress
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          )}

          {/* TAB 3: VOUCHER REPOSITORY TABLE */}
          {activeTab === "VOUCHER_REPOSITORY" && (
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#f0f4f8] text-slate-700 font-semibold border-b border-slate-200 uppercase text-[11px] tracking-wider">
                  <th className="py-2 px-3 w-12 text-center">SL</th>
                  <th className="py-2 px-3 text-center w-24">Action</th>
                  <th className="py-2 px-3 w-28">Date</th>
                  <th className="py-2 px-3 w-36">Trans Number</th>
                  <th className="py-2 px-3 w-36">Office Name</th>
                  <th className="py-2 px-3 w-40">Trans. Type</th>
                  <th className="py-2 px-3">Narration</th>
                  <th className="py-2 px-3 w-36">Prepare By</th>
                  <th className="py-2 px-3 text-right w-28">Amount</th>
                  <th className="py-2 px-3 text-center w-24">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {paginatedVouchers.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-8 text-center text-slate-400">
                      No vouchers found in repository matching criteria.
                    </td>
                  </tr>
                ) : (
                  paginatedVouchers.map((v, index) => {
                    const sl = (currentPage - 1) * rowsPerPage + index + 1;
                    return (
                      <tr key={v.id} className="hover:bg-blue-50/40 transition-colors">
                        <td className="py-2 px-3 text-center text-slate-500">{sl}</td>
                        <td className="py-2 px-3 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => setViewingVoucher(v)}
                              title="View Voucher"
                              className="w-6 h-6 rounded-full bg-slate-100 hover:bg-blue-100 text-slate-600 hover:text-blue-700 flex items-center justify-center transition-colors"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setViewingVoucher(v)}
                              title="Print Voucher"
                              className="w-6 h-6 rounded-full bg-slate-100 hover:bg-blue-100 text-slate-600 hover:text-blue-700 flex items-center justify-center transition-colors"
                            >
                              <Printer className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                        <td className="py-2 px-3 text-slate-600 whitespace-nowrap">{v.createDate || v.transactionDate.split(" - ")[0]}</td>
                        <td className="py-2 px-3">
                          <button
                            onClick={() => setViewingVoucher(v)}
                            className="text-blue-600 hover:underline font-medium font-mono text-left"
                          >
                            {v.voucherNumber}
                          </button>
                        </td>
                        <td className="py-2 px-3 font-medium text-slate-800 whitespace-nowrap">{v.officeName}</td>
                        <td className="py-2 px-3 text-slate-600 whitespace-nowrap">{v.transType || v.journalType}</td>
                        <td className="py-2 px-3 text-slate-700 max-w-sm truncate" title={v.narration}>
                          {v.narration}
                        </td>
                        <td className="py-2 px-3 text-slate-600 whitespace-nowrap">{v.preparedBy || v.createdBy}</td>
                        <td className="py-2 px-3 text-right font-mono font-medium text-slate-900 whitespace-nowrap">
                          {(v.amount || v.totalDebit).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="py-2 px-3 text-center whitespace-nowrap">
                          {v.status === "APPROVED" || v.status === "POSTED" ? (
                            <span className="px-2 py-0.5 rounded text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200">
                              Approved
                            </span>
                          ) : v.status === "PENDING" ? (
                            <span className="px-2 py-0.5 rounded text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200">
                              Pending
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[11px] font-semibold text-slate-700 bg-slate-100 border border-slate-200">
                              In Progress
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          )}
        </div>

        {/* ------------------------------------------------------------- */}
        {/* 4. TABLE FOOTER / PAGINATION (Matches Screenshot) */}
        {/* ------------------------------------------------------------- */}
        <div className="p-3 border-t border-slate-200 bg-slate-50/50 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
          <div className="flex items-center gap-2">
            <span>
              Showing {totalRows === 0 ? 0 : (currentPage - 1) * rowsPerPage + 1}–
              {Math.min(currentPage * rowsPerPage, totalRows)} of {totalRows} Rows
            </span>
            <span className="text-slate-400">|</span>
            <div className="flex items-center gap-1.5">
              <span>Rows</span>
              <select
                value={rowsPerPage}
                onChange={(e) => {
                  setRowsPerPage(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="text-xs border border-slate-300 rounded px-1.5 py-0.5 bg-white text-slate-700 focus:outline-none"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
              className="w-7 h-7 flex items-center justify-center rounded border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed text-slate-600 transition-colors"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const p = i + 1;
              return (
                <button
                  key={p}
                  onClick={() => setCurrentPage(p)}
                  className={`w-7 h-7 flex items-center justify-center rounded text-xs font-medium transition-colors ${
                    currentPage === p
                      ? "bg-blue-600 text-white font-semibold shadow-2xs"
                      : "border border-slate-200 bg-white hover:bg-slate-100 text-slate-700"
                  }`}
                >
                  {p}
                </button>
              );
            })}
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
              className="w-7 h-7 flex items-center justify-center rounded border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed text-slate-600 transition-colors"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 5. MODAL: CREATE JOURNAL VOUCHER */}
      {/* ------------------------------------------------------------- */}
      <ModalDialog
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Create Journal Voucher"
        maxWidth="4xl"
      >
        <form onSubmit={handleSubmitVoucher} className="space-y-4">
          {formError && (
            <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}
          {formSuccess && (
            <div className="p-2.5 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs rounded flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{formSuccess}</span>
            </div>
          )}

          {/* Voucher Header Information */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 bg-slate-50 p-3 rounded border border-slate-200 text-xs">
            <div>
              <label className="block text-slate-600 font-medium mb-1">Office / Branch *</label>
              <select
                value={newVoucherHeader.officeName}
                onChange={(e) =>
                  setNewVoucherHeader({
                    ...newVoucherHeader,
                    officeName: e.target.value,
                  })
                }
                className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white focus:ring-1 focus:ring-blue-500"
              >
                <option value="MG Sirajganj Factory">MG Sirajganj Factory</option>
                <option value="MGV-PLC">MGV-PLC</option>
                <option value="Dhaka Head Office">Dhaka Head Office</option>
                <option value="MBBL-HO">MBBL-HO</option>
                <option value="MOHS-Eco">MOHS-Eco</option>
                <option value="CFF-Chapai">CFF-Chapai</option>
                <option value="MFIL-HO">MFIL-HO</option>
              </select>
            </div>
            <div>
              <label className="block text-slate-600 font-medium mb-1">Transaction Date *</label>
              <input
                type="date"
                required
                value={newVoucherHeader.transactionDate}
                onChange={(e) => setNewVoucherHeader({ ...newVoucherHeader, transactionDate: e.target.value })}
                className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-slate-600 font-medium mb-1">Trans. Type *</label>
              <select
                value={newVoucherHeader.transType}
                onChange={(e) => setNewVoucherHeader({ ...newVoucherHeader, transType: e.target.value })}
                className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white focus:ring-1 focus:ring-blue-500"
              >
                {transTypeOptions.map((tt) => (
                  <option key={tt} value={tt}>
                    {tt}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-slate-600 font-medium mb-1">Prepared By *</label>
              <input
                type="text"
                required
                value={newVoucherHeader.preparedBy}
                onChange={(e) => setNewVoucherHeader({ ...newVoucherHeader, preparedBy: e.target.value })}
                className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div className="sm:col-span-2 md:col-span-4">
              <label className="block text-slate-600 font-medium mb-1">Narration / Description *</label>
              <input
                type="text"
                required
                placeholder="Enter complete voucher narration..."
                value={newVoucherHeader.narration}
                onChange={(e) => setNewVoucherHeader({ ...newVoucherHeader, narration: e.target.value })}
                className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Double-Entry Debit/Credit Table */}
          <div className="border border-slate-200 rounded overflow-hidden">
            <div className="bg-slate-100 p-2 border-b border-slate-200 flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-800">Double-Entry Account Line Items</span>
              <button
                type="button"
                onClick={handleAddLine}
                className="inline-flex items-center gap-1 text-xs px-2.5 py-1 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded font-medium shadow-2xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Row</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase text-[11px]">
                    <th className="p-2 w-72">GL Account</th>
                    <th className="p-2 w-32 text-right">Debit (৳)</th>
                    <th className="p-2 w-32 text-right">Credit (৳)</th>
                    <th className="p-2">Line Narration</th>
                    <th className="p-2 w-10 text-center"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {lines.map((l) => (
                    <tr key={l.id} className="hover:bg-slate-50/50">
                      <td className="p-2">
                        <select
                          value={l.accountId}
                          onChange={(e) => handleLineChange(l.id, { accountId: e.target.value })}
                          className="w-full border border-slate-300 rounded px-2 py-1 bg-white focus:ring-1 focus:ring-blue-500 text-xs"
                        >
                          {accounts
                            .filter((a) => !a.isGroup)
                            .map((a) => (
                              <option key={a.id} value={a.id}>
                                {a.code} - {a.name}
                              </option>
                            ))}
                        </select>
                      </td>
                      <td className="p-2">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={l.debit || ""}
                          onChange={(e) => handleLineChange(l.id, { debit: parseFloat(e.target.value) || 0 })}
                          placeholder="0.00"
                          className="w-full text-right border border-slate-300 rounded px-2 py-1 font-mono text-xs focus:ring-1 focus:ring-blue-500"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={l.credit || ""}
                          onChange={(e) => handleLineChange(l.id, { credit: parseFloat(e.target.value) || 0 })}
                          placeholder="0.00"
                          className="w-full text-right border border-slate-300 rounded px-2 py-1 font-mono text-xs focus:ring-1 focus:ring-blue-500"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="text"
                          value={l.narration || ""}
                          onChange={(e) => handleLineChange(l.id, { narration: e.target.value })}
                          placeholder="Particulars..."
                          className="w-full border border-slate-300 rounded px-2 py-1 text-xs focus:ring-1 focus:ring-blue-500"
                        />
                      </td>
                      <td className="p-2 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveLine(l.id)}
                          disabled={lines.length <= 2}
                          className="text-slate-400 hover:text-rose-600 disabled:opacity-20 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-50 font-semibold border-t border-slate-200">
                    <td className="p-2 text-right text-slate-700">Total:</td>
                    <td className="p-2 text-right font-mono text-slate-900">৳{totalDebit.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    <td className="p-2 text-right font-mono text-slate-900">৳{totalCredit.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    <td colSpan={2} className="p-2 text-left">
                      {isBalanced ? (
                        <span className="text-emerald-700 text-[11px] font-semibold flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Balanced
                        </span>
                      ) : (
                        <span className="text-rose-700 text-[11px] font-semibold flex items-center gap-1">
                          <AlertCircle className="w-3.5 h-3.5" /> Unbalanced (Diff: ৳{Math.abs(totalDebit - totalCredit).toLocaleString()})
                        </span>
                      )}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsCreateOpen(false)}
              className="px-4 py-1.5 border border-slate-300 rounded text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!isBalanced}
              className="px-5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-2xs"
            >
              Post Voucher
            </button>
          </div>
        </form>
      </ModalDialog>

      {/* ------------------------------------------------------------- */}
      {/* 6. MODAL: VIEW / PRINT VOUCHER */}
      {/* ------------------------------------------------------------- */}
      <ModalDialog
        isOpen={Boolean(viewingVoucher)}
        onClose={() => setViewingVoucher(null)}
        title={viewingVoucher ? `Voucher Details: ${viewingVoucher.voucherNumber}` : ""}
        maxWidth="2xl"
      >
        {viewingVoucher && (
          <div className="space-y-4 text-xs font-sans">
            {/* Header / Company Stamp */}
            <div className="p-3 bg-slate-50 rounded border border-slate-200">
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="font-bold text-sm text-slate-900">BridgeOne Industrial ERP</h4>
                  <p className="text-slate-500 text-[11px]">{viewingVoucher.officeName}</p>
                  <p className="text-slate-500 text-[11px]">Type: {viewingVoucher.transType || viewingVoucher.journalType}</p>
                </div>
                <div className="text-right">
                  <span className="text-xs font-mono font-bold text-blue-600 block">{viewingVoucher.voucherNumber}</span>
                  <span className="text-slate-500 text-[11px]">Date: {viewingVoucher.createDate || viewingVoucher.transactionDate}</span>
                  <span className="block mt-1">
                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                      {viewingVoucher.status}
                    </span>
                  </span>
                </div>
              </div>
              <div className="mt-2.5 pt-2 border-t border-slate-200 text-slate-700">
                <span className="font-semibold text-slate-800">Narration:</span> {viewingVoucher.narration}
              </div>
            </div>

            {/* Line Items Table */}
            <div className="border border-slate-200 rounded overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 uppercase font-semibold text-[11px]">
                    <th className="p-2">Account Code & Name</th>
                    <th className="p-2 text-right">Debit (৳)</th>
                    <th className="p-2 text-right">Credit (৳)</th>
                    <th className="p-2">Particulars</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {viewingVoucher.lines.map((l) => (
                    <tr key={l.id}>
                      <td className="p-2 font-medium text-slate-800">
                        {l.accountCode} - {l.accountName}
                      </td>
                      <td className="p-2 text-right font-mono text-slate-900">
                        {l.debit > 0 ? l.debit.toLocaleString(undefined, { minimumFractionDigits: 2 }) : "-"}
                      </td>
                      <td className="p-2 text-right font-mono text-slate-900">
                        {l.credit > 0 ? l.credit.toLocaleString(undefined, { minimumFractionDigits: 2 }) : "-"}
                      </td>
                      <td className="p-2 text-slate-600">{l.narration || "-"}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-50 font-bold border-t border-slate-200">
                    <td className="p-2 text-right text-slate-800">Total:</td>
                    <td className="p-2 text-right font-mono text-slate-900">
                      ৳{viewingVoucher.totalDebit.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-2 text-right font-mono text-slate-900">
                      ৳{viewingVoucher.totalCredit.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Signatures */}
            <div className="grid grid-cols-3 gap-4 pt-6 text-center text-[11px] text-slate-600">
              <div className="border-t border-slate-300 pt-1">
                <p className="font-semibold">{viewingVoucher.preparedBy || viewingVoucher.createdBy}</p>
                <p className="text-slate-400">Prepared By</p>
              </div>
              <div className="border-t border-slate-300 pt-1">
                <p className="font-semibold">Accounts Officer</p>
                <p className="text-slate-400">Verified By</p>
              </div>
              <div className="border-t border-slate-300 pt-1">
                <p className="font-semibold">{viewingVoucher.approvedBy || "Finance Controller"}</p>
                <p className="text-slate-400">Approved By</p>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setViewingVoucher(null)}
                className="px-4 py-1.5 border border-slate-300 rounded text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                Close
              </button>
              <button
                type="button"
                onClick={handlePrint}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-semibold shadow-2xs"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Voucher</span>
              </button>
            </div>
          </div>
        )}
      </ModalDialog>

      {/* ------------------------------------------------------------- */}
      {/* 7. MODAL: APPROVE PENDING VOUCHER CONFIRMATION */}
      {/* ------------------------------------------------------------- */}
      <ModalDialog
        isOpen={Boolean(approveConfirmTarget)}
        onClose={() => setApproveConfirmTarget(null)}
        title="Approve Voucher"
        maxWidth="sm"
      >
        {approveConfirmTarget && (
          <div className="space-y-3 text-xs">
            <p className="text-slate-600">
              Are you sure you want to approve voucher{" "}
              <strong className="text-blue-600">{approveConfirmTarget.voucherNumber}</strong> for amount{" "}
              <strong>৳{(approveConfirmTarget.amount || approveConfirmTarget.totalDebit).toLocaleString()}</strong>?
            </p>
            <p className="text-slate-500 text-[11px]">
              Upon approval, the voucher will post directly to the General Ledger and move to Accounting Journal.
            </p>
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setApproveConfirmTarget(null)}
                className="px-4 py-1.5 border border-slate-300 rounded text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmApproval}
                className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-semibold shadow-2xs"
              >
                Confirm Approval
              </button>
            </div>
          </div>
        )}
      </ModalDialog>
    </div>
  );
}
