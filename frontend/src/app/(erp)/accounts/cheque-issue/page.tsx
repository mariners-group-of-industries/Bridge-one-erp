"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import {
  Banknote,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Eye,
  FileSpreadsheet,
  FolderOpen,
  Pencil,
  Plus,
  Printer,
  RotateCcw,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { ModalDialog } from "@/components/purchase/ModalDialog";
import { useAccountingStore } from "@/features/accounts/store/accounting-store";
import type { ChequeIssueItem, ChequeStatus } from "@/features/accounts/types";

export default function ChequeIssuePage() {
  const cheques = useAccountingStore((s) => s.cheques);
  const chequeBooks = useAccountingStore((s) => s.chequeBooks);
  const bankAccounts = useAccountingStore((s) => s.bankAccounts);
  const issueCheque = useAccountingStore((s) => s.issueCheque);
  const updateChequeStatus = useAccountingStore((s) => s.updateChequeStatus);

  // -------------------------------------------------------------
  // Filter States (Matching Screenshot)
  // -------------------------------------------------------------
  const [selectedBank, setSelectedBank] = useState("All");
  const [selectedTransactionNo, setSelectedTransactionNo] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");

  // Pagination states
  const [rowsPerPage, setRowsPerPage] = useState<number>(50);
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Modal States
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [viewCheque, setViewCheque] = useState<ChequeIssueItem | null>(null);
  const [cancelTarget, setCancelTarget] = useState<ChequeIssueItem | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  // Create Form State
  const [form, setForm] = useState({
    bankAccountId: "ba-1",
    bankName: "PRIME BANK LTD PLC",
    chequeBookId: "cb-1",
    chequeNumber: "",
    transactionNumber: `TXN-CHQ-${Date.now().toString().slice(-6)}`,
    payeeName: "",
    issueDate: new Date().toISOString().split("T")[0],
    chequeDate: new Date().toISOString().split("T")[0],
    amount: 0,
    purpose: "",
    referenceVoucher: "JV-2026-CHQ",
    status: "ISSUED" as ChequeStatus,
  });

  // Extract unique bank names and transaction numbers for filters
  const bankOptions = useMemo(() => {
    const names = Array.from(new Set(bankAccounts.map((b) => b.bankName)));
    return names;
  }, [bankAccounts]);

  const transactionOptions = useMemo(() => {
    const txns = Array.from(new Set(cheques.map((c) => c.transactionNumber)));
    return txns;
  }, [cheques]);

  // Filtered Cheques
  const filteredCheques = useMemo(() => {
    return cheques.filter((c) => {
      if (selectedBank !== "All") {
        if (c.bankName.toLowerCase() !== selectedBank.toLowerCase()) return false;
      }
      if (selectedTransactionNo !== "All") {
        if (c.transactionNumber.toLowerCase() !== selectedTransactionNo.toLowerCase()) return false;
      }
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const m =
          c.bankName.toLowerCase().includes(q) ||
          c.transactionNumber.toLowerCase().includes(q) ||
          c.payeeName.toLowerCase().includes(q) ||
          c.chequeNumber.toLowerCase().includes(q) ||
          c.purpose.toLowerCase().includes(q);
        if (!m) return false;
      }
      return true;
    });
  }, [cheques, selectedBank, selectedTransactionNo, searchQuery]);

  // Paginated records
  const paginatedCheques = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage;
    return filteredCheques.slice(start, start + rowsPerPage);
  }, [filteredCheques, currentPage, rowsPerPage]);

  const handleBankSelect = (bankName: string) => {
    const bank = bankAccounts.find((b) => b.bankName === bankName) || bankAccounts[0];
    const book = chequeBooks.find((cb) => cb.bankAccountId === bank?.id) || chequeBooks[0];
    setForm({
      ...form,
      bankAccountId: bank?.id || "",
      bankName: bank?.bankName || bankName,
      chequeBookId: book?.id || "",
      chequeNumber: book ? `${book.startChequeNumber.slice(0, 3)}${Date.now().toString().slice(-4)}` : "",
    });
  };

  const handleCreateCheque = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");

    if (!form.payeeName.trim()) {
      setErrorMessage("Payee name is required.");
      return;
    }
    if (form.amount <= 0) {
      setErrorMessage("Cheque amount must be greater than zero.");
      return;
    }

    const chequeNo = form.chequeNumber.trim() || `CHQ-${Date.now().toString().slice(-5)}`;

    issueCheque({
      bankAccountId: form.bankAccountId,
      bankName: form.bankName,
      chequeBookId: form.chequeBookId,
      chequeNumber: chequeNo,
      payeeName: form.payeeName.trim(),
      issueDate: form.issueDate,
      chequeDate: form.chequeDate,
      amount: Number(form.amount),
      purpose: form.purpose || "Supplier & vendor settlement",
      referenceVoucher: form.referenceVoucher || "JV-2026-CHQ",
      status: new Date(form.chequeDate) > new Date() ? "POST_DATED" : form.status,
    });

    setIsCreateOpen(false);
    setForm({
      bankAccountId: "ba-1",
      bankName: "PRIME BANK LTD PLC",
      chequeBookId: "cb-1",
      chequeNumber: "",
      transactionNumber: `TXN-CHQ-${Date.now().toString().slice(-6)}`,
      payeeName: "",
      issueDate: new Date().toISOString().split("T")[0],
      chequeDate: new Date().toISOString().split("T")[0],
      amount: 0,
      purpose: "",
      referenceVoucher: "JV-2026-CHQ",
      status: "ISSUED",
    });
  };

  const handleConfirmCancel = () => {
    if (!cancelTarget || !cancelReason.trim()) return;
    updateChequeStatus(cancelTarget.id, "CANCELLED", cancelReason);
    setCancelTarget(null);
    setCancelReason("");
  };

  return (
    <div className="space-y-2.5 font-sans pb-16 bg-[#f8fafc] min-h-screen">
      {/* ------------------------------------------------------------- */}
      {/* 1. TOP TAB ROW WITH SEARCH & + CREATE (Matching Screenshot) */}
      {/* ------------------------------------------------------------- */}
      <div className="bg-white px-4 pt-2 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
        {/* Tab */}
        <div className="flex items-center gap-6">
          <button
            type="button"
            className="pb-2.5 text-xs font-bold tracking-wide text-blue-600 border-b-2 border-blue-600 -mb-[1px] uppercase whitespace-nowrap"
          >
            Cheque Issue
          </button>
        </div>

        {/* Right side search + Create button */}
        <div className="flex items-center gap-2 pb-2 self-end sm:self-auto">
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search bank / transaction / pay..."
              className="w-56 sm:w-64 h-8 pl-3 pr-7 text-xs border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white placeholder-slate-400"
            />
            <Search className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          <button
            type="button"
            onClick={() => {
              handleBankSelect(bankAccounts[0]?.bankName || "PRIME BANK LTD PLC");
              setIsCreateOpen(true);
            }}
            className="h-8 px-4 bg-[#2563eb] hover:bg-blue-700 text-white font-semibold text-xs rounded flex items-center gap-1.5 shadow-xs transition"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create</span>
          </button>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 2. FILTER TOOLBAR (Matching Screenshot) */}
      {/* ------------------------------------------------------------- */}
      <div className="bg-white border-t border-b border-slate-200 px-4 py-3 flex flex-wrap items-center gap-4 shadow-2xs">
        {/* Bank Dropdown */}
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-semibold text-slate-600">
            <span className="text-red-500 mr-0.5">*</span>Bank
          </label>
          <select
            value={selectedBank}
            onChange={(e) => {
              setSelectedBank(e.target.value);
              setCurrentPage(1);
            }}
            className="h-8 w-60 border border-slate-300 rounded px-2.5 text-xs bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="All">All</option>
            {bankOptions.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </div>

        {/* Transaction NO Dropdown */}
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-semibold text-slate-600">Transaction NO</label>
          <select
            value={selectedTransactionNo}
            onChange={(e) => {
              setSelectedTransactionNo(e.target.value);
              setCurrentPage(1);
            }}
            className="h-8 w-60 border border-slate-300 rounded px-2.5 text-xs bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="All">All</option>
            {transactionOptions.map((tx) => (
              <option key={tx} value={tx}>
                {tx}
              </option>
            ))}
          </select>
        </div>

        {/* View Button */}
        <div className="flex items-end self-end">
          <button
            type="button"
            onClick={() => {}}
            className="h-8 px-4 bg-[#2563eb] hover:bg-blue-700 text-white font-semibold text-xs rounded transition shadow-xs"
          >
            View
          </button>
        </div>

        {/* Reset filter button */}
        {(selectedBank !== "All" || selectedTransactionNo !== "All" || searchQuery) && (
          <div className="flex items-end self-end">
            <button
              type="button"
              onClick={() => {
                setSelectedBank("All");
                setSelectedTransactionNo("All");
                setSearchQuery("");
                setCurrentPage(1);
              }}
              className="h-8 px-3 border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs rounded transition flex items-center gap-1"
              title="Reset Filters"
            >
              <RotateCcw className="w-3 h-3 text-slate-400" />
              <span>Reset</span>
            </button>
          </div>
        )}
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 3. TABLE / EMPTY STATE (Matching Screenshot Columns Order) */}
      {/* SL | Action | Bank Name | Transaction NO | Payee | Cheque Date | Amount */}
      {/* ------------------------------------------------------------- */}
      <div className="bg-white border-t border-b border-slate-200 overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#e8f2fe] border-b border-blue-200/80 text-[11px] font-bold text-slate-800 uppercase tracking-wide">
              <tr>
                <th className="px-3.5 py-2.5 w-12 text-center">SL</th>
                <th className="px-3.5 py-2.5 text-center w-24">Action</th>
                <th className="px-3.5 py-2.5">Bank Name</th>
                <th className="px-3.5 py-2.5 font-mono">Transaction NO</th>
                <th className="px-3.5 py-2.5">Payee</th>
                <th className="px-3.5 py-2.5">Cheque Date</th>
                <th className="px-3.5 py-2.5 text-right font-bold text-slate-900">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filteredCheques.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-24 text-center">
                    <div className="flex flex-col items-center justify-center text-slate-400 select-none">
                      <div className="w-14 h-14 rounded-lg bg-slate-50 border border-slate-200/60 flex items-center justify-center mb-2">
                        <FolderOpen className="w-7 h-7 text-slate-300" />
                      </div>
                      <span className="text-xs font-medium text-slate-400">No data</span>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedCheques.map((c, idx) => (
                  <tr key={c.id} className="hover:bg-blue-50/40 transition-colors">
                    {/* SL */}
                    <td className="px-3.5 py-2.5 text-center text-slate-500 font-medium">
                      {(currentPage - 1) * rowsPerPage + idx + 1}
                    </td>

                    {/* Action */}
                    <td className="px-3.5 py-2.5 text-center">
                      <div className="flex items-center justify-center gap-2 text-slate-400">
                        <button
                          type="button"
                          onClick={() => setViewCheque(c)}
                          className="hover:text-blue-600 transition"
                          title="View Cheque Leaf"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setViewCheque(c);
                            setTimeout(() => window.print(), 300);
                          }}
                          className="hover:text-emerald-600 transition"
                          title="Print Cheque"
                        >
                          <Printer className="w-3.5 h-3.5" />
                        </button>
                        {c.status !== "CANCELLED" && (
                          <button
                            type="button"
                            onClick={() => {
                              setCancelTarget(c);
                              setCancelReason("");
                            }}
                            className="hover:text-rose-600 transition"
                            title="Cancel Cheque"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>

                    {/* Bank Name */}
                    <td className="px-3.5 py-2.5 font-semibold text-slate-900">{c.bankName}</td>

                    {/* Transaction NO */}
                    <td className="px-3.5 py-2.5 font-mono text-slate-800">{c.transactionNumber}</td>

                    {/* Payee */}
                    <td className="px-3.5 py-2.5 text-slate-700 font-medium">{c.payeeName}</td>

                    {/* Cheque Date */}
                    <td className="px-3.5 py-2.5 text-slate-600">{c.chequeDate}</td>

                    {/* Amount */}
                    <td className="px-3.5 py-2.5 text-right font-mono font-bold text-slate-900 text-xs">
                      ৳{c.amount.toLocaleString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* ------------------------------------------------------------- */}
        {/* 4. FOOTER PAGINATION (Matching Screenshot) */}
        {/* Showing 0–0 of 0 Rows [50 v] < [1] > */}
        {/* ------------------------------------------------------------- */}
        <div className="px-4 py-2.5 border-t border-slate-200 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <span>
              Showing{" "}
              <strong className="text-slate-700 font-semibold">
                {filteredCheques.length === 0 ? "0–0" : `1–${filteredCheques.length}`}
              </strong>{" "}
              of <strong className="text-slate-700 font-semibold">{filteredCheques.length}</strong> Rows
            </span>
            <select
              value={rowsPerPage}
              onChange={(e) => {
                setRowsPerPage(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="border border-slate-300 rounded px-2 py-0.5 text-xs bg-white text-slate-700 focus:outline-none"
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
              className="p-1 rounded hover:bg-slate-100 disabled:opacity-30 disabled:pointer-events-none text-slate-400"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="w-6 h-6 flex items-center justify-center rounded bg-blue-600 text-white font-bold text-xs">
              {currentPage}
            </span>
            <button
              type="button"
              onClick={() => setCurrentPage((p) => p + 1)}
              disabled={currentPage * rowsPerPage >= filteredCheques.length}
              className="p-1 rounded hover:bg-slate-100 disabled:opacity-30 disabled:pointer-events-none text-slate-400"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* MODAL 1: CREATE CHEQUE ISSUE */}
      {/* ------------------------------------------------------------- */}
      <ModalDialog
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Issue Bank Cheque"
        subtitle="Create and issue corporate bank cheque voucher under BridgeOne ERP"
        maxWidth="lg"
      >
        <form onSubmit={handleCreateCheque} className="space-y-4">
          {errorMessage && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded">
              {errorMessage}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Bank Name <span className="text-red-500">*</span>
              </label>
              <select
                value={form.bankName}
                onChange={(e) => handleBankSelect(e.target.value)}
                className="w-full h-9 px-3 text-xs border border-slate-300 rounded bg-white focus:ring-1 focus:ring-blue-500 focus:outline-none"
              >
                {bankAccounts.map((b) => (
                  <option key={b.id} value={b.bankName}>
                    {b.bankName} ({b.branchName})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Transaction NO <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={form.transactionNumber}
                onChange={(e) => setForm({ ...form, transactionNumber: e.target.value })}
                className="w-full h-9 px-3 text-xs border border-slate-300 rounded font-mono focus:ring-1 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Payee (Party / Vendor) <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={form.payeeName}
                onChange={(e) => setForm({ ...form, payeeName: e.target.value })}
                placeholder="e.g. Padma Oil Company Ltd"
                className="w-full h-9 px-3 text-xs border border-slate-300 rounded focus:ring-1 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Cheque Number</label>
              <input
                type="text"
                value={form.chequeNumber}
                onChange={(e) => setForm({ ...form, chequeNumber: e.target.value })}
                placeholder="e.g. PB-31012"
                className="w-full h-9 px-3 text-xs border border-slate-300 rounded font-mono focus:ring-1 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Cheque Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                required
                value={form.chequeDate}
                onChange={(e) => setForm({ ...form, chequeDate: e.target.value })}
                className="w-full h-9 px-3 text-xs border border-slate-300 rounded focus:ring-1 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Amount (৳) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min="1"
                required
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })}
                className="w-full h-9 px-3 text-xs border border-slate-300 rounded font-mono focus:ring-1 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">Purpose / Narration</label>
              <input
                type="text"
                value={form.purpose}
                onChange={(e) => setForm({ ...form, purpose: e.target.value })}
                placeholder="e.g. Fuel procurement for generator"
                className="w-full h-9 px-3 text-xs border border-slate-300 rounded focus:ring-1 focus:ring-blue-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setIsCreateOpen(false)}
              className="px-4 py-2 border border-slate-300 text-slate-600 hover:bg-slate-50 text-xs font-semibold rounded"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-[#2563eb] hover:bg-blue-700 text-white text-xs font-semibold rounded"
            >
              Issue Cheque
            </button>
          </div>
        </form>
      </ModalDialog>

      {/* ------------------------------------------------------------- */}
      {/* MODAL 2: VIEW / PRINT CHEQUE LEAF */}
      {/* ------------------------------------------------------------- */}
      {viewCheque && (
        <ModalDialog
          isOpen={!!viewCheque}
          onClose={() => setViewCheque(null)}
          title="Bank Cheque Voucher"
          subtitle={`Cheque #${viewCheque.chequeNumber} • ${viewCheque.bankName}`}
          maxWidth="lg"
        >
          <div className="space-y-4">
            {/* Visual Cheque Leaf Design */}
            <div className="p-6 rounded-lg bg-gradient-to-r from-slate-50 to-blue-50/50 border-2 border-slate-300/80 shadow-xs text-xs font-sans relative">
              <div className="flex justify-between items-start border-b border-slate-200 pb-3 mb-4">
                <div>
                  <h3 className="text-base font-black tracking-tight text-slate-900">{viewCheque.bankName}</h3>
                  <p className="text-[11px] text-slate-500 font-medium">BridgeOne Corporate Account</p>
                </div>
                <div className="text-right">
                  <span className="text-[11px] text-slate-400 block">Date</span>
                  <span className="font-mono font-bold text-sm text-slate-800">{viewCheque.chequeDate}</span>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-3 border-b border-slate-200/90 pb-2">
                  <span className="text-slate-400 font-semibold w-16">Pay to:</span>
                  <span className="font-bold text-slate-900 text-sm flex-1">{viewCheque.payeeName}</span>
                  <span className="text-slate-400 font-medium text-[11px]">or Bearer</span>
                </div>

                <div className="flex items-center justify-between border-b border-slate-200/90 pb-2">
                  <div className="flex items-center gap-3 flex-1">
                    <span className="text-slate-400 font-semibold w-16">The sum of:</span>
                    <span className="font-medium text-slate-700 italic">
                      Taka {viewCheque.amount.toLocaleString()} Only
                    </span>
                  </div>
                  <div className="border border-slate-400 bg-white px-3 py-1 rounded font-mono font-black text-base text-blue-700">
                    ৳{viewCheque.amount.toLocaleString()}/-
                  </div>
                </div>

                <div className="flex items-center gap-3 pt-1 text-[11px] text-slate-500">
                  <span>Purpose:</span>
                  <span className="font-medium text-slate-700">{viewCheque.purpose}</span>
                </div>
              </div>

              <div className="flex justify-between items-end pt-8 mt-4 border-t border-slate-200/60">
                <div className="font-mono text-xs text-slate-400">
                  || {viewCheque.chequeNumber} || 000102 || {viewCheque.transactionNumber} ||
                </div>
                <div className="text-center">
                  <div className="w-40 border-b border-slate-400 mb-1" />
                  <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                    Authorised Signatory
                  </span>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setViewCheque(null)}
                className="px-4 py-2 border border-slate-300 text-slate-600 hover:bg-slate-50 text-xs font-semibold rounded"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded flex items-center gap-1.5"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Cheque</span>
              </button>
            </div>
          </div>
        </ModalDialog>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL 3: CANCEL CHEQUE */}
      {/* ------------------------------------------------------------- */}
      {cancelTarget && (
        <ModalDialog
          isOpen={!!cancelTarget}
          onClose={() => setCancelTarget(null)}
          title="Cancel Cheque"
          subtitle={`Are you sure you want to cancel cheque #${cancelTarget.chequeNumber}?`}
          maxWidth="sm"
        >
          <div className="space-y-4 text-xs">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Cancellation Reason <span className="text-red-500">*</span>
              </label>
              <textarea
                required
                rows={3}
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="e.g. Issued with incorrect payee or expired leave"
                className="w-full p-2 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setCancelTarget(null)}
                className="px-4 py-2 border border-slate-300 text-slate-600 hover:bg-slate-50 text-xs font-semibold rounded"
              >
                Keep Active
              </button>
              <button
                type="button"
                onClick={handleConfirmCancel}
                disabled={!cancelReason.trim()}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded disabled:opacity-50"
              >
                Confirm Cancel
              </button>
            </div>
          </div>
        </ModalDialog>
      )}
    </div>
  );
}
