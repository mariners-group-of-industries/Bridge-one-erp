"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowRightLeft,
  BookOpen,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock,
  Download,
  Eye,
  FileSpreadsheet,
  FileText,
  Filter,
  Plus,
  Printer,
  RotateCcw,
  Search,
  ShieldCheck,
  Trash2,
  X,
} from "lucide-react";
import { SummaryCard } from "@/components/purchase/SummaryCard";
import { ModalDialog } from "@/components/purchase/ModalDialog";
import { useAccountingStore } from "@/features/accounts/store/accounting-store";
import type { JournalLineItem, JournalType, JournalVoucher, VoucherStatus } from "@/features/accounts/types";

export default function AccountingJournalPage() {
  const vouchers = useAccountingStore((s) => s.vouchers);
  const accounts = useAccountingStore((s) => s.accounts);
  const costCenters = useAccountingStore((s) => s.costCenters);
  const createVoucher = useAccountingStore((s) => s.createVoucher);
  const postVoucher = useAccountingStore((s) => s.postVoucher);
  const reverseVoucher = useAccountingStore((s) => s.reverseVoucher);

  const [activeTab, setActiveTab] = useState<"ALL" | "POSTED" | "PENDING" | "REVERSED">("ALL");
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<string>("ALL");
  const [selectedOffice, setSelectedOffice] = useState<string>("ALL");

  // Create Modal State
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");

  // Reversal Modal State
  const [reversalTarget, setReversalTarget] = useState<JournalVoucher | null>(null);
  const [reversalReason, setReversalReason] = useState("");

  // View / Print Modal
  const [viewingVoucher, setViewingVoucher] = useState<JournalVoucher | null>(null);

  const [newVoucherHeader, setNewVoucherHeader] = useState({
    transactionDate: new Date().toISOString().split("T")[0],
    officeId: "office-main",
    officeName: "Dhaka Corporate HQ",
    fiscalYear: "2026-2027",
    journalType: "GENERAL" as JournalType,
    narration: "",
    referenceNumber: "",
    status: "POSTED" as VoucherStatus,
  });

  const [lines, setLines] = useState<JournalLineItem[]>([
    {
      id: "line-1",
      accountId: "acc-5100",
      accountCode: "5100",
      accountName: "Office Rent & Utilities",
      debit: 50000,
      credit: 0,
      narration: "Office rent for Current Month",
    },
    {
      id: "line-2",
      accountId: "acc-1120",
      accountCode: "1120",
      accountName: "Cash at Bank - Sonali Bank",
      debit: 0,
      credit: 50000,
      narration: "Payment via Cheque / Online Transfer",
    },
  ]);

  const totalDebit = useMemo(() => lines.reduce((sum, l) => sum + (Number(l.debit) || 0), 0), [lines]);
  const totalCredit = useMemo(() => lines.reduce((sum, l) => sum + (Number(l.credit) || 0), 0), [lines]);
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01 && totalDebit > 0;

  const filteredVouchers = useMemo(() => {
    return vouchers.filter((v) => {
      if (search) {
        const q = search.toLowerCase();
        const m =
          v.voucherNumber.toLowerCase().includes(q) ||
          v.narration.toLowerCase().includes(q) ||
          v.officeName.toLowerCase().includes(q) ||
          (v.referenceNumber && v.referenceNumber.toLowerCase().includes(q)) ||
          v.lines.some((l) => l.accountName.toLowerCase().includes(q) || l.accountCode.includes(q));
        if (!m) return false;
      }
      if (activeTab === "POSTED" && v.status !== "POSTED") return false;
      if (activeTab === "PENDING" && v.status !== "PENDING" && v.status !== "DRAFT") return false;
      if (activeTab === "REVERSED" && v.status !== "REVERSED") return false;
      if (filterType !== "ALL" && v.journalType !== filterType) return false;
      if (selectedOffice !== "ALL" && v.officeId !== selectedOffice) return false;
      return true;
    });
  }, [vouchers, search, activeTab, filterType, selectedOffice]);

  const handleAddLine = () => {
    const id = `line-${Date.now()}`;
    setLines([...lines, { id, accountId: "acc-1110", accountCode: "1110", accountName: "Cash in Hand", debit: 0, credit: 0, narration: "" }]);
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
      createdBy: "Finance Officer",
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

  const handleConfirmReversal = () => {
    if (!reversalTarget) return;
    if (!reversalReason.trim()) {
      alert("Please provide a reason for reversal.");
      return;
    }
    const res = reverseVoucher(reversalTarget.id, reversalReason.trim());
    if (res.success) {
      setReversalTarget(null);
      setReversalReason("");
    } else {
      alert(res.message);
    }
  };

  const handleExportCSV = () => {
    let csv = "SL,Voucher #,Date,Type,Office,Narration,Total Debit,Total Credit,Status\n";
    filteredVouchers.forEach((v, i) => {
      csv += `"${i + 1}","${v.voucherNumber}","${v.transactionDate}","${v.journalType}","${v.officeName}","${v.narration.replace(/"/g, '""')}","${v.totalDebit}","${v.totalCredit}","${v.status}"\n`;
    });
    const link = document.createElement("a");
    link.href = encodeURI("data:text/csv;charset=utf-8," + csv);
    link.download = `BridgeOne_Journal_Vouchers.csv`;
    link.click();
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
            <span className="text-slate-600 font-medium">Accounting Journal</span>
          </nav>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Accounting Journal</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Double-entry journal vouchers, multi-line ledger postings, approvals, and immutable audit trails
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Quick search */}
          <div className="relative">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search voucher #, narration..."
              className="w-56 sm:w-64 h-9 pl-3 pr-8 text-xs border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white placeholder-slate-400"
            />
            <Search className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          <button
            type="button"
            onClick={handleExportCSV}
            className="h-9 px-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded flex items-center gap-1.5 shadow-xs transition"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Excel</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setFormError("");
              setFormSuccess("");
              setIsCreateOpen(true);
            }}
            className="h-9 px-4 bg-[#2563eb] hover:bg-blue-700 text-white font-semibold text-xs rounded flex items-center gap-1.5 shadow-xs transition"
          >
            <Plus className="w-4 h-4" />
            <span>Create Journal Voucher</span>
          </button>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 2. SUMMARY KPI CARDS ROW */}
      {/* ------------------------------------------------------------- */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <SummaryCard
          title="Total Posted Vouchers"
          value={vouchers.filter((v) => v.status === "POSTED").length}
          subtitle={`৳${vouchers.filter((v) => v.status === "POSTED").reduce((sum, v) => sum + v.totalDebit, 0).toLocaleString()} volume`}
          icon={BookOpen}
          variant="info"
        />
        <SummaryCard
          title="Pending Posting"
          value={vouchers.filter((v) => v.status === "PENDING" || v.status === "DRAFT").length}
          subtitle="Draft & pending approval"
          icon={Clock}
          variant="warning"
        />
        <SummaryCard
          title="Reversed Vouchers"
          value={vouchers.filter((v) => v.status === "REVERSED").length}
          subtitle="Corrected & void transactions"
          icon={ArrowRightLeft}
          variant="danger"
        />
        <SummaryCard
          title="Ledger Invariant"
          value="100% BALANCED"
          subtitle="Debit equals Credit across all entries"
          icon={ShieldCheck}
          variant="success"
        />
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 3. NAVIGATION TABS */}
      {/* ------------------------------------------------------------- */}
      <div className="flex items-center gap-8 border-b border-slate-200 mb-3 bg-white px-3 pt-2 rounded-t border-t border-x border-slate-200/90 overflow-x-auto select-none">
        <button
          type="button"
          onClick={() => setActiveTab("ALL")}
          className={`pb-2.5 text-xs font-bold tracking-wide transition-colors relative flex items-center gap-2 uppercase whitespace-nowrap ${
            activeTab === "ALL"
              ? "text-blue-600 border-b-2 border-blue-600 -mb-[1px]"
              : "text-slate-500 hover:text-slate-800"
          }`}
        >
          <span>ALL VOUCHERS ({vouchers.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("POSTED")}
          className={`pb-2.5 text-xs font-bold tracking-wide transition-colors relative flex items-center gap-2 uppercase whitespace-nowrap ${
            activeTab === "POSTED"
              ? "text-blue-600 border-b-2 border-blue-600 -mb-[1px]"
              : "text-slate-500 hover:text-slate-800"
          }`}
        >
          <span>POSTED TO LEDGER ({vouchers.filter((v) => v.status === "POSTED").length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("PENDING")}
          className={`pb-2.5 text-xs font-bold tracking-wide transition-colors relative flex items-center gap-2 uppercase whitespace-nowrap ${
            activeTab === "PENDING"
              ? "text-blue-600 border-b-2 border-blue-600 -mb-[1px]"
              : "text-slate-500 hover:text-slate-800"
          }`}
        >
          <span>PENDING / DRAFT ({vouchers.filter((v) => v.status === "PENDING" || v.status === "DRAFT").length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("REVERSED")}
          className={`pb-2.5 text-xs font-bold tracking-wide transition-colors relative flex items-center gap-2 uppercase whitespace-nowrap ${
            activeTab === "REVERSED"
              ? "text-blue-600 border-b-2 border-blue-600 -mb-[1px]"
              : "text-slate-500 hover:text-slate-800"
          }`}
        >
          <span>REVERSED ({vouchers.filter((v) => v.status === "REVERSED").length})</span>
        </button>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 4. FILTER TOOLBAR */}
      {/* ------------------------------------------------------------- */}
      <div className="bg-white rounded border border-slate-200/90 p-3 shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3 flex-1 min-w-0">
            <div className="flex items-center gap-1.5 text-xs text-slate-600">
              <span className="font-medium text-[11px] text-slate-500">Journal Type:</span>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="border border-slate-200 rounded px-2.5 py-1 text-xs bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="ALL">All Journal Types</option>
                <option value="GENERAL">General Journal</option>
                <option value="PAYMENT">Payment Voucher</option>
                <option value="RECEIPT">Receipt Voucher</option>
                <option value="CONTRA">Contra Voucher</option>
                <option value="ADJUSTMENT">Adjustment Voucher</option>
                <option value="REVERSAL">Reversal Voucher</option>
              </select>
            </div>

            <div className="flex items-center gap-1.5 text-xs text-slate-600">
              <span className="font-medium text-[11px] text-slate-500">Office:</span>
              <select
                value={selectedOffice}
                onChange={(e) => setSelectedOffice(e.target.value)}
                className="border border-slate-200 rounded px-2.5 py-1 text-xs bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="ALL">All Offices & Plants</option>
                <option value="office-main">Dhaka Corporate HQ</option>
                <option value="office-ctg">Chittagong Heavy Plant</option>
              </select>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              setSearch("");
              setFilterType("ALL");
              setSelectedOffice("ALL");
            }}
            className="flex items-center gap-1 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded text-xs font-medium transition"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset</span>
          </button>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 5. VOUCHER REGISTER TABLE */}
      {/* ------------------------------------------------------------- */}
      <div className="bg-white rounded border border-slate-200/90 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-y border-slate-200 text-[11px] font-bold text-slate-700 uppercase tracking-wider">
              <tr>
                <th className="px-3.5 py-2.5">SL</th>
                <th className="px-3.5 py-2.5">Voucher #</th>
                <th className="px-3.5 py-2.5">Date</th>
                <th className="px-3.5 py-2.5">Type</th>
                <th className="px-3.5 py-2.5">Office / Branch</th>
                <th className="px-3.5 py-2.5">Narration & Accounts</th>
                <th className="px-3.5 py-2.5 text-right">Debit (৳)</th>
                <th className="px-3.5 py-2.5 text-right">Credit (৳)</th>
                <th className="px-3.5 py-2.5 text-center">Status</th>
                <th className="px-3.5 py-2.5 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredVouchers.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-xs text-slate-400">
                    No journal vouchers found matching filter criteria.
                  </td>
                </tr>
              ) : (
                filteredVouchers.map((v, index) => (
                  <tr key={v.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-3.5 py-2.5 font-medium text-slate-500">{index + 1}</td>
                    <td className="px-3.5 py-2.5 font-mono font-bold text-blue-600">{v.voucherNumber}</td>
                    <td className="px-3.5 py-2.5 text-slate-600">{v.transactionDate}</td>
                    <td className="px-3.5 py-2.5">
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                        {v.journalType}
                      </span>
                    </td>
                    <td className="px-3.5 py-2.5 text-slate-700 font-medium">{v.officeName}</td>
                    <td className="px-3.5 py-2.5 max-w-xs">
                      <div className="font-medium text-slate-900 truncate">{v.narration}</div>
                      <div className="text-[11px] text-slate-400 truncate">
                        {v.lines.map((l) => l.accountName).join(" • ")}
                      </div>
                    </td>
                    <td className="px-3.5 py-2.5 text-right font-mono font-semibold text-slate-800">
                      ৳{v.totalDebit.toLocaleString()}
                    </td>
                    <td className="px-3.5 py-2.5 text-right font-mono font-semibold text-slate-800">
                      ৳{v.totalCredit.toLocaleString()}
                    </td>
                    <td className="px-3.5 py-2.5 text-center">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                          v.status === "POSTED"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : v.status === "REVERSED"
                            ? "bg-rose-50 text-rose-700 border-rose-200"
                            : "bg-amber-50 text-amber-700 border-amber-200"
                        }`}
                      >
                        {v.status}
                      </span>
                    </td>
                    <td className="px-3.5 py-2.5 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setViewingVoucher(v)}
                          className="p-1 rounded text-slate-500 hover:text-blue-600 hover:bg-slate-100 transition"
                          title="View Voucher Slip & Print"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        {v.status === "POSTED" && (
                          <button
                            type="button"
                            onClick={() => {
                              setReversalTarget(v);
                              setReversalReason("");
                            }}
                            className="p-1 rounded text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition"
                            title="Reverse Posted Voucher"
                          >
                            <ArrowRightLeft className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {(v.status === "PENDING" || v.status === "DRAFT") && (
                          <button
                            type="button"
                            onClick={() => postVoucher(v.id)}
                            className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-600 hover:bg-emerald-700 text-white transition"
                          >
                            Post
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 6. MODAL: CREATE JOURNAL VOUCHER */}
      {/* ------------------------------------------------------------- */}
      <ModalDialog
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Create Double-Entry Journal Voucher"
        subtitle="Post a balanced general ledger transaction across multiple debit and credit lines"
        maxWidth="4xl"
      >
        <form onSubmit={handleSubmitVoucher} className="space-y-4 text-xs">
          {formError && (
            <div className="p-2.5 rounded bg-rose-50 border border-rose-200 text-rose-700 font-medium flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}
          {formSuccess && (
            <div className="p-2.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-700 font-medium flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{formSuccess}</span>
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-3 rounded border border-slate-200">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Transaction Date *</label>
              <input
                type="date"
                required
                value={newVoucherHeader.transactionDate}
                onChange={(e) => setNewVoucherHeader({ ...newVoucherHeader, transactionDate: e.target.value })}
                className="w-full h-8 border border-slate-300 rounded px-2 text-xs bg-white"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Office / Branch *</label>
              <select
                value={newVoucherHeader.officeId}
                onChange={(e) =>
                  setNewVoucherHeader({
                    ...newVoucherHeader,
                    officeId: e.target.value,
                    officeName: e.target.value === "office-main" ? "Dhaka Corporate HQ" : "Chittagong Heavy Plant",
                  })
                }
                className="w-full h-8 border border-slate-300 rounded px-2 text-xs bg-white"
              >
                <option value="office-main">Dhaka Corporate HQ</option>
                <option value="office-ctg">Chittagong Heavy Plant</option>
              </select>
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Journal Type</label>
              <select
                value={newVoucherHeader.journalType}
                onChange={(e) => setNewVoucherHeader({ ...newVoucherHeader, journalType: e.target.value as any })}
                className="w-full h-8 border border-slate-300 rounded px-2 text-xs bg-white"
              >
                <option value="GENERAL">General Journal</option>
                <option value="PAYMENT">Payment Voucher</option>
                <option value="RECEIPT">Receipt Voucher</option>
                <option value="CONTRA">Contra Voucher</option>
                <option value="ADJUSTMENT">Adjustment Voucher</option>
              </select>
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Status</label>
              <select
                value={newVoucherHeader.status}
                onChange={(e) => setNewVoucherHeader({ ...newVoucherHeader, status: e.target.value as any })}
                className="w-full h-8 border border-slate-300 rounded px-2 text-xs bg-white"
              >
                <option value="POSTED">Post to Ledger Directly</option>
                <option value="DRAFT">Save as Draft</option>
                <option value="PENDING">Submit for Approval</option>
              </select>
            </div>
            <div className="col-span-2 sm:col-span-4">
              <label className="block font-semibold text-slate-700 mb-1">General Narration / Remarks *</label>
              <input
                type="text"
                required
                placeholder="Provide clear business context for this voucher"
                value={newVoucherHeader.narration}
                onChange={(e) => setNewVoucherHeader({ ...newVoucherHeader, narration: e.target.value })}
                className="w-full h-8 border border-slate-300 rounded px-2.5 text-xs bg-white"
              />
            </div>
          </div>

          {/* Line items table */}
          <div className="border rounded border-slate-200 overflow-hidden">
            <div className="bg-slate-100 px-3.5 py-2 flex items-center justify-between border-b border-slate-200">
              <span className="font-bold text-[11px] text-slate-700 uppercase tracking-wide">Journal Lines (Debits & Credits)</span>
              <button
                type="button"
                onClick={handleAddLine}
                className="px-2 py-0.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-[11px] font-semibold flex items-center gap-1"
              >
                <Plus className="w-3 h-3" /> Add Line
              </button>
            </div>

            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-semibold">
                <tr>
                  <th className="px-3 py-2">Account Ledger *</th>
                  <th className="px-3 py-2">Line Narration</th>
                  <th className="px-3 py-2 w-32 text-right">Debit (৳)</th>
                  <th className="px-3 py-2 w-32 text-right">Credit (৳)</th>
                  <th className="px-2 py-2 w-8 text-center"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {lines.map((l) => (
                  <tr key={l.id}>
                    <td className="p-2">
                      <select
                        value={l.accountId}
                        onChange={(e) => handleLineChange(l.id, { accountId: e.target.value })}
                        className="w-full h-7 border border-slate-300 rounded px-2 text-xs bg-white"
                      >
                        {accounts
                          .filter((a) => !a.isGroup)
                          .map((a) => (
                            <option key={a.id} value={a.id}>
                              [{a.code}] {a.name} ({a.normalBalance})
                            </option>
                          ))}
                      </select>
                    </td>
                    <td className="p-2">
                      <input
                        type="text"
                        placeholder="Narration"
                        value={l.narration || ""}
                        onChange={(e) => handleLineChange(l.id, { narration: e.target.value })}
                        className="w-full h-7 border border-slate-300 rounded px-2 text-xs"
                      />
                    </td>
                    <td className="p-2">
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={l.debit || ""}
                        onChange={(e) => handleLineChange(l.id, { debit: parseFloat(e.target.value) || 0, credit: 0 })}
                        className="w-full h-7 border border-slate-300 rounded px-2 text-right font-mono text-xs"
                        placeholder="0.00"
                      />
                    </td>
                    <td className="p-2">
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={l.credit || ""}
                        onChange={(e) => handleLineChange(l.id, { credit: parseFloat(e.target.value) || 0, debit: 0 })}
                        className="w-full h-7 border border-slate-300 rounded px-2 text-right font-mono text-xs"
                        placeholder="0.00"
                      />
                    </td>
                    <td className="p-2 text-center">
                      <button
                        type="button"
                        onClick={() => handleRemoveLine(l.id)}
                        disabled={lines.length <= 2}
                        className="text-slate-400 hover:text-rose-600 disabled:opacity-30 transition"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-100 font-bold border-t border-slate-200">
                <tr>
                  <td colSpan={2} className="px-3 py-2 text-right text-slate-700">
                    Totals:
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-slate-900">৳{totalDebit.toLocaleString()}</td>
                  <td className="px-3 py-2 text-right font-mono text-slate-900">৳{totalCredit.toLocaleString()}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Invariant validation bar */}
          <div
            className={`p-2.5 rounded border text-xs flex items-center justify-between ${
              isBalanced ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-amber-50 border-amber-200 text-amber-800"
            }`}
          >
            <div className="flex items-center gap-1.5 font-semibold">
              {isBalanced ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <AlertCircle className="w-4 h-4 text-amber-600" />}
              <span>{isBalanced ? "Voucher is balanced and ready to post" : "Voucher is unbalanced (Debits must equal Credits)"}</span>
            </div>
            <span className="font-mono font-bold">
              Difference: ৳{Math.abs(totalDebit - totalCredit).toLocaleString()}
            </span>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setIsCreateOpen(false)}
              className="px-3.5 py-1.5 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!isBalanced}
              className="px-4 py-1.5 bg-[#2563eb] hover:bg-blue-700 disabled:bg-slate-300 text-white rounded text-xs font-semibold shadow-xs"
            >
              Save & Post Voucher
            </button>
          </div>
        </form>
      </ModalDialog>

      {/* ------------------------------------------------------------- */}
      {/* 7. MODAL: VIEW / PRINT VOUCHER SLIP */}
      {/* ------------------------------------------------------------- */}
      <ModalDialog
        isOpen={!!viewingVoucher}
        onClose={() => setViewingVoucher(null)}
        title={`Journal Voucher Slip — ${viewingVoucher?.voucherNumber}`}
        subtitle={`Transaction Date: ${viewingVoucher?.transactionDate} | Type: ${viewingVoucher?.journalType}`}
        maxWidth="2xl"
      >
        <div className="space-y-4 text-xs">
          <div className="p-3 bg-slate-50 rounded border border-slate-200 flex justify-between">
            <div>
              <p className="text-slate-500 text-[11px]">Office / Plant</p>
              <p className="font-semibold text-slate-800">{viewingVoucher?.officeName}</p>
            </div>
            <div>
              <p className="text-slate-500 text-[11px]">Posted At</p>
              <p className="font-semibold text-slate-800">{viewingVoucher?.postedAt || viewingVoucher?.createdAt}</p>
            </div>
            <div>
              <p className="text-slate-500 text-[11px]">Status</p>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                {viewingVoucher?.status}
              </span>
            </div>
          </div>

          <div className="border rounded border-slate-200 overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-semibold">
                <tr>
                  <th className="px-3 py-2">Code</th>
                  <th className="px-3 py-2">Account Name</th>
                  <th className="px-3 py-2">Narration</th>
                  <th className="px-3 py-2 text-right">Debit (৳)</th>
                  <th className="px-3 py-2 text-right">Credit (৳)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {viewingVoucher?.lines.map((l, i) => (
                  <tr key={i}>
                    <td className="px-3 py-2 font-mono text-blue-600">{l.accountCode}</td>
                    <td className="px-3 py-2 font-semibold text-slate-900">{l.accountName}</td>
                    <td className="px-3 py-2 text-slate-500">{l.narration || "-"}</td>
                    <td className="px-3 py-2 text-right font-mono font-medium text-slate-800">
                      {l.debit > 0 ? `৳${l.debit.toLocaleString()}` : "-"}
                    </td>
                    <td className="px-3 py-2 text-right font-mono font-medium text-slate-800">
                      {l.credit > 0 ? `৳${l.credit.toLocaleString()}` : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-100 font-bold border-t border-slate-200">
                <tr>
                  <td colSpan={3} className="px-3 py-2 text-right">
                    Total:
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-blue-700">
                    ৳{viewingVoucher?.totalDebit.toLocaleString()}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-blue-700">
                    ৳{viewingVoucher?.totalCredit.toLocaleString()}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={() => window.print()}
              className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-semibold flex items-center gap-1.5"
            >
              <Printer className="w-3.5 h-3.5" /> Print Voucher Slip
            </button>
            <button
              type="button"
              onClick={() => setViewingVoucher(null)}
              className="px-3.5 py-1.5 bg-[#2563eb] hover:bg-blue-700 text-white rounded text-xs font-semibold shadow-xs"
            >
              Close
            </button>
          </div>
        </div>
      </ModalDialog>

      {/* ------------------------------------------------------------- */}
      {/* 8. MODAL: REVERSE VOUCHER */}
      {/* ------------------------------------------------------------- */}
      <ModalDialog
        isOpen={!!reversalTarget}
        onClose={() => setReversalTarget(null)}
        title={`Reverse Posted Voucher — ${reversalTarget?.voucherNumber}`}
        subtitle="This will atomically generate an inverse reversal voucher and restore general ledger balances"
        maxWidth="md"
      >
        <div className="space-y-4 text-xs">
          <div className="p-3 bg-rose-50 border border-rose-200 rounded text-rose-800">
            Warning: Reversing this voucher will post an exact mirror entry (swapping debits and credits) and mark this voucher as REVERSED.
          </div>
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Reason for Reversal *</label>
            <textarea
              rows={3}
              required
              placeholder="e.g. Inadvertent duplicate entry, incorrect ledger mapping, audit adjustment..."
              value={reversalReason}
              onChange={(e) => setReversalReason(e.target.value)}
              className="w-full border border-slate-300 rounded p-2 text-xs text-slate-800"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setReversalTarget(null)}
              className="px-3.5 py-1.5 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirmReversal}
              className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded text-xs font-semibold shadow-xs"
            >
              Confirm Reversal
            </button>
          </div>
        </div>
      </ModalDialog>
    </div>
  );
}
