"use client";

import { toast } from "@/components/purchase/Toast";
import { Spinner } from "@/components/ui/spinner";
import { usePending } from "@/hooks/use-pending";
import React, { useMemo, useState } from "react";
import {
  ArrowLeft,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Eye,
  FolderOpen,
  Plus,
  Printer,
  RotateCcw,
  Search,
  Trash2,
} from "lucide-react";
import { ModalDialog } from "@/components/purchase/ModalDialog";
import { useAccountingStore } from "@/features/accounts/store/accounting-store";
import { localToday } from "@/features/purchase/lib/client";

/** The next unused leaf of a cheque book: its first number plus the leaves already used, same prefix and width. */
function nextLeaf(book: { startChequeNumber: string; usedLeaves: number } | undefined): string {
  if (!book) return "";
  const match = book.startChequeNumber.match(/^(.*?)(\d+)$/);
  if (!match) return "";
  const [, prefix, digits] = match;
  return `${prefix}${String(Number(digits) + (book.usedLeaves || 0)).padStart(digits.length, "0")}`;
}

import type { ChequeIssueItem, ChequeStatus } from "@/features/accounts/types";
import { useFeaturePermissions, needsPermission } from "@/lib/permissions/useFeaturePermissions";

export default function ChequeIssuePage() {
  const perms = useFeaturePermissions("/accounts/cheque-issue");
  const { pending, run } = usePending();
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
  const [isCardCollapsed, setIsCardCollapsed] = useState(false);
  const [isAcPayeeOnly, setIsAcPayeeOnly] = useState(true);
  const [viewCheque, setViewCheque] = useState<ChequeIssueItem | null>(null);
  const [cancelTarget, setCancelTarget] = useState<ChequeIssueItem | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  // Create Form State
  const blankForm = () => ({
    bankAccountId: "",
    bankName: "",
    chequeBookId: "",
    chequeNumber: "",
    transactionNumber: "",
    payeeName: "",
    issueDate: localToday(),
    chequeDate: localToday(),
    amount: 0,
    purpose: "",
    referenceVoucher: "",
    status: "ISSUED" as ChequeStatus,
  });
  const [form, setForm] = useState(blankForm);
  /** The running cheque book of a bank account. */
  const runningBook = (bankAccountId: string | undefined) =>
    chequeBooks.find((cb) => cb.bankAccountId === bankAccountId && cb.status !== "EXHAUSTED" && cb.status !== "CANCELLED");

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
    const book = runningBook(bank?.id);
    setForm({
      ...form,
      bankAccountId: bank?.id || "",
      bankName: bank?.bankName || bankName,
      chequeBookId: book?.id || "",
      chequeNumber: nextLeaf(book),
    });
  };

  const handleCreateCheque = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMessage("");

    if (!form.payeeName.trim()) {
      setErrorMessage("Payee name is required.");
      return;
    }
    if (form.amount <= 0) {
      setErrorMessage("Cheque amount must be greater than zero.");
      return;
    }

    const bank = bankAccounts.find((b) => b.id === form.bankAccountId) ?? bankAccounts[0];
    if (!bank) {
      setErrorMessage("Add a bank account under Finance & Banking first.");
      return;
    }
    const book = runningBook(bank.id);
    const chequeNo = form.chequeNumber.trim() || nextLeaf(book);
    if (!chequeNo) {
      setErrorMessage("Enter the cheque number.");
      return;
    }

    const res = await run("cheque", () => issueCheque({
      bankAccountId: bank.id,
      bankName: bank.bankName,
      chequeBookId: book?.id ?? "",
      chequeNumber: chequeNo,
      payeeName: form.payeeName.trim(),
      issueDate: form.issueDate,
      chequeDate: form.chequeDate,
      amount: Number(form.amount),
      purpose: form.purpose,
      referenceVoucher: form.referenceVoucher,
      status: form.chequeDate > localToday() ? "POST_DATED" : form.status,
    }));
    if (!res.success) {
      setErrorMessage(res.message);
      return;
    }

    setIsCreateOpen(false);
    setForm(blankForm());
  };

  const handleConfirmCancel = async () => {
    if (!cancelTarget || !cancelReason.trim()) return;
    const ok = await run("cancel", () => updateChequeStatus(cancelTarget.id, "CANCELLED", cancelReason));
    if (!ok) return;
    toast.success("Cheque cancelled.");
    setCancelTarget(null);
    setCancelReason("");
  };

  // -------------------------------------------------------------
  // FULL-PAGE MANAGERIUM VIEW: Create Cheque Issue
  // -------------------------------------------------------------
  if (isCreateOpen) {
    const inputCls =
      "h-8 w-full border border-slate-300 rounded px-2.5 text-xs text-slate-800 bg-white placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500";
    return (
      <div className="min-h-screen bg-[#f8fafc] p-3 md:p-6 text-slate-800">
        {/* Top Header Bar */}
        <div className="bg-white border border-slate-200/90 rounded px-4 py-2.5 flex items-center justify-between shadow-2xs mb-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsCreateOpen(false)}
              className="h-8 w-8 rounded border border-slate-300 flex items-center justify-center text-slate-600 hover:bg-slate-50 transition"
              title="Back"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <h1 className="text-base font-bold text-slate-900 tracking-tight">Create Cheque Issue</h1>
          </div>
          <button
            type="button"
            disabled={pending === "cheque"}
            onClick={() => handleCreateCheque()}
            className="h-8 px-5 bg-[#2563eb] hover:bg-blue-700 text-white font-semibold text-xs rounded transition flex items-center gap-1.5 shadow-2xs disabled:opacity-50"
          >
            {pending === "cheque" && <Spinner className="size-3.5" />}
            Save
          </button>
        </div>

        {errorMessage && (
          <div className="mb-3 p-2.5 rounded bg-rose-50 border border-rose-200 text-rose-700 font-medium text-xs">
            {errorMessage}
          </div>
        )}

        {/* Main Card */}
        <div className="bg-white border border-slate-200/90 rounded shadow-2xs overflow-hidden mb-3">
          <div className="flex items-center justify-between border-b border-slate-200 bg-white px-3 pt-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="px-4 py-2 text-xs font-semibold rounded-t bg-[#e6f2fb] text-blue-700 border-b-2 border-blue-600 transition"
              >
                Details
              </button>
            </div>
            <button
              type="button"
              onClick={() => setIsCardCollapsed(!isCardCollapsed)}
              className="p-1.5 text-slate-400 hover:text-slate-600 rounded transition"
            >
              {isCardCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
            </button>
          </div>

          {!isCardCollapsed && (
            <div className="p-4 space-y-3.5">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    <span className="text-red-500 font-bold mr-0.5">*</span>Bank
                  </label>
                  <select
                    value={form.bankName}
                    onChange={(e) => handleBankSelect(e.target.value)}
                    className={inputCls}
                  >
                    <option value="">Bank</option>
                    {bankAccounts.map((b) => (
                      <option key={b.id} value={b.bankName}>
                        {b.bankName} ({b.branchName})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    <span className="text-red-500 font-bold mr-0.5">*</span>Transaction NO
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Transaction NO"
                    value={form.transactionNumber}
                    onChange={(e) => setForm({ ...form, transactionNumber: e.target.value })}
                    className={inputCls}
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    <span className="text-red-500 font-bold mr-0.5">*</span>Payee
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Payee"
                    value={form.payeeName}
                    onChange={(e) => setForm({ ...form, payeeName: e.target.value })}
                    className={inputCls}
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    <span className="text-red-500 font-bold mr-0.5">*</span>Cheque Date
                  </label>
                  <input
                    type="date"
                    required
                    value={form.chequeDate}
                    onChange={(e) => setForm({ ...form, chequeDate: e.target.value })}
                    className={inputCls}
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    Transaction Date
                  </label>
                  <input
                    type="date"
                    value={form.issueDate}
                    onChange={(e) => setForm({ ...form, issueDate: e.target.value })}
                    className={inputCls}
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    <span className="text-red-500 font-bold mr-0.5">*</span>Amount
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="0.01"
                    required
                    placeholder="Amount"
                    value={form.amount || ""}
                    onChange={(e) => setForm({ ...form, amount: parseFloat(e.target.value) || 0 })}
                    className={`${inputCls} font-mono text-right`}
                  />
                </div>
              </div>

              <div className="pt-2">
                <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isAcPayeeOnly}
                    onChange={(e) => setIsAcPayeeOnly(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span>A/C Payee Only</span>
                </label>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2.5 font-sans bg-canvas flex flex-col md:h-[calc(100dvh-3.5rem)] md:overflow-hidden print:block print:h-auto print:overflow-visible">
      {/* ------------------------------------------------------------- */}
      {/* 1. TOP TAB ROW WITH SEARCH & + CREATE (Matching Screenshot) */}
      {/* ------------------------------------------------------------- */}
      <div className="bg-surface px-4 pt-2 border-b border-line flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs shrink-0">
        {/* Tab */}
        <div className="flex items-center gap-6">
          <button
            type="button"
            className="pb-2.5 text-xs font-bold tracking-wide text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 -mb-[1px] uppercase whitespace-nowrap"
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
              className="w-56 sm:w-64 h-8 pl-3 pr-7 text-xs border border-line-strong rounded focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-surface placeholder:text-ink-faint"
            />
            <Search className="w-3.5 h-3.5 text-ink-faint absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {perms.create && (<button
            type="button"
            onClick={() => {
              handleBankSelect(bankAccounts[0]?.bankName ?? "");
              setIsCreateOpen(true);
            }}
            className="h-8 px-4 bg-[#2563eb] hover:bg-blue-700 text-white font-semibold text-xs rounded flex items-center gap-1.5 shadow-xs transition"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create</span>
          </button>)}
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 2. FILTER TOOLBAR (Matching Screenshot) */}
      {/* ------------------------------------------------------------- */}
      <div className="bg-surface border-t border-b border-line px-4 py-3 flex flex-wrap items-center gap-4 shadow-2xs shrink-0">
        {/* Bank Dropdown */}
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-semibold text-ink-muted">
            <span className="text-red-500 mr-0.5">*</span>Bank
          </label>
          <select
            value={selectedBank}
            onChange={(e) => {
              setSelectedBank(e.target.value);
              setCurrentPage(1);
            }}
            className="h-8 w-60 border border-line-strong rounded px-2.5 text-xs bg-surface text-ink focus:outline-none focus:ring-1 focus:ring-blue-500"
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
          <label className="text-[11px] font-semibold text-ink-muted">Transaction NO</label>
          <select
            value={selectedTransactionNo}
            onChange={(e) => {
              setSelectedTransactionNo(e.target.value);
              setCurrentPage(1);
            }}
            className="h-8 w-60 border border-line-strong rounded px-2.5 text-xs bg-surface text-ink focus:outline-none focus:ring-1 focus:ring-blue-500"
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
              className="h-8 px-3 border border-line hover:bg-canvas text-ink-muted text-xs rounded transition flex items-center gap-1"
              title="Reset Filters"
            >
              <RotateCcw className="w-3 h-3 text-ink-faint" />
              <span>Reset</span>
            </button>
          </div>
        )}
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 3. TABLE / EMPTY STATE (Matching Screenshot Columns Order) */}
      {/* SL | Action | Bank Name | Transaction NO | Payee | Cheque Date | Amount */}
      {/* ------------------------------------------------------------- */}
      <div className="bg-surface border-t border-b border-line overflow-hidden shadow-2xs flex-1 min-h-0 flex flex-col print:block">
        <div className="flex-1 min-h-0 overflow-auto print:overflow-visible [&_thead]:sticky [&_thead]:top-0 [&_thead]:z-10">
          <table className="w-full text-left text-xs">
            <thead className="bg-grid-head border-b border-blue-200/80 dark:border-blue-500/30 text-[11px] font-bold text-ink uppercase tracking-wide">
              <tr>
                <th className="px-3.5 py-2.5 w-12 text-center">SL</th>
                <th className="px-3.5 py-2.5 text-center w-24">Action</th>
                <th className="px-3.5 py-2.5">Bank Name</th>
                <th className="px-3.5 py-2.5 font-mono">Transaction NO</th>
                <th className="px-3.5 py-2.5">Payee</th>
                <th className="px-3.5 py-2.5">Cheque Date</th>
                <th className="px-3.5 py-2.5 text-right font-bold text-ink">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line text-ink-muted">
              {filteredCheques.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-24 text-center">
                    <div className="flex flex-col items-center justify-center text-ink-faint select-none">
                      <div className="w-14 h-14 rounded-lg bg-canvas border border-line/60 flex items-center justify-center mb-2">
                        <FolderOpen className="w-7 h-7 text-slate-300" />
                      </div>
                      <span className="text-xs font-medium text-ink-faint">No data</span>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedCheques.map((c, idx) => (
                  <tr key={c.id} className="hover:bg-blue-50/40 dark:hover:bg-blue-500/10 transition-colors">
                    {/* SL */}
                    <td className="px-3.5 py-2.5 text-center text-ink-faint font-medium">
                      {(currentPage - 1) * rowsPerPage + idx + 1}
                    </td>

                    {/* Action */}
                    <td className="px-3.5 py-2.5 text-center">
                      <div className="row-actions flex items-center justify-center gap-2 text-ink-faint">
                        <button
                          type="button"
                          onClick={() => setViewCheque(c)}
                          className="hover:text-blue-600 dark:hover:text-blue-400 transition"
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
                          className="hover:text-emerald-600 dark:hover:text-emerald-400 transition"
                          title="Print Cheque"
                        >
                          <Printer className="w-3.5 h-3.5" />
                        </button>
                        {c.status !== "CANCELLED" && (
                          <button disabled={!perms.edit}
                            type="button"
                            onClick={() => {
                              setCancelTarget(c);
                              setCancelReason("");
                            }}
                            className="hover:text-rose-600 dark:hover:text-rose-400 transition disabled:opacity-40 disabled:cursor-not-allowed"
                            title={!perms.edit ? needsPermission("edit") : "Cancel Cheque"}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>

                    {/* Bank Name */}
                    <td className="px-3.5 py-2.5 font-semibold text-ink">{c.bankName}</td>

                    {/* Transaction NO */}
                    <td className="px-3.5 py-2.5 font-mono text-ink">{c.transactionNumber}</td>

                    {/* Payee */}
                    <td className="px-3.5 py-2.5 text-ink-muted font-medium">{c.payeeName}</td>

                    {/* Cheque Date */}
                    <td className="px-3.5 py-2.5 text-ink-muted">{c.chequeDate}</td>

                    {/* Amount */}
                    <td className="px-3.5 py-2.5 text-right font-mono font-bold text-ink text-xs">
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
        <div className="px-4 py-2.5 border-t border-line flex flex-wrap items-center justify-between gap-4 text-xs text-ink-faint shrink-0">
          <div className="flex items-center gap-2">
            <span>
              Showing{" "}
              <strong className="text-ink-muted font-semibold">
                {filteredCheques.length === 0 ? "0–0" : `1–${filteredCheques.length}`}
              </strong>{" "}
              of <strong className="text-ink-muted font-semibold">{filteredCheques.length}</strong> Rows
            </span>
            <select
              value={rowsPerPage}
              onChange={(e) => {
                setRowsPerPage(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="border border-line-strong rounded px-2 py-0.5 text-xs bg-surface text-ink-muted focus:outline-none"
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>

          <div className="flex items-center gap-1">
            <button aria-label="Previous page"
              type="button"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
              className="p-1 rounded hover:bg-control disabled:opacity-30 disabled:pointer-events-none text-ink-faint"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="w-6 h-6 flex items-center justify-center rounded bg-blue-600 text-white font-bold text-xs">
              {currentPage}
            </span>
            <button aria-label="Next page"
              type="button"
              onClick={() => setCurrentPage((p) => p + 1)}
              disabled={currentPage * rowsPerPage >= filteredCheques.length}
              className="p-1 rounded hover:bg-control disabled:opacity-30 disabled:pointer-events-none text-ink-faint"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>



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
            <div className="p-6 rounded-lg bg-gradient-to-r from-canvas to-blue-50/50 border-2 border-line-strong/80 shadow-xs text-xs font-sans relative">
              <div className="flex justify-between items-start border-b border-line pb-3 mb-4">
                <div>
                  <h3 className="text-base font-black tracking-tight text-ink">{viewCheque.bankName}</h3>
                  <p className="text-[11px] text-ink-faint font-medium">BridgeOne Corporate Account</p>
                </div>
                <div className="text-right">
                  <span className="text-[11px] text-ink-faint block">Date</span>
                  <span className="font-mono font-bold text-sm text-ink">{viewCheque.chequeDate}</span>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-3 border-b border-line/90 pb-2">
                  <span className="text-ink-faint font-semibold w-16">Pay to:</span>
                  <span className="font-bold text-ink text-sm flex-1">{viewCheque.payeeName}</span>
                  <span className="text-ink-faint font-medium text-[11px]">or Bearer</span>
                </div>

                <div className="flex items-center justify-between border-b border-line/90 pb-2">
                  <div className="flex items-center gap-3 flex-1">
                    <span className="text-ink-faint font-semibold w-16">The sum of:</span>
                    <span className="font-medium text-ink-muted italic">
                      Taka {viewCheque.amount.toLocaleString()} Only
                    </span>
                  </div>
                  <div className="border border-line-strong bg-surface px-3 py-1 rounded font-mono font-black text-base text-blue-700 dark:text-blue-300">
                    ৳{viewCheque.amount.toLocaleString()}/-
                  </div>
                </div>

                <div className="flex items-center gap-3 pt-1 text-[11px] text-ink-faint">
                  <span>Purpose:</span>
                  <span className="font-medium text-ink-muted">{viewCheque.purpose}</span>
                </div>
              </div>

              <div className="flex justify-between items-end pt-8 mt-4 border-t border-line/60">
                <div className="font-mono text-xs text-ink-faint">
                  || {viewCheque.chequeNumber} || 000102 || {viewCheque.transactionNumber} ||
                </div>
                <div className="text-center">
                  <div className="w-40 border-b border-line-strong mb-1" />
                  <span className="text-[10px] text-ink-faint font-bold uppercase tracking-wider">
                    Authorised Signatory
                  </span>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-line">
              <button
                type="button"
                onClick={() => setViewCheque(null)}
                className="px-4 py-2 border border-line-strong text-ink-muted hover:bg-canvas text-xs font-semibold rounded"
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
              <label className="block text-xs font-semibold text-ink-muted mb-1">
                Cancellation Reason <span className="text-red-500">*</span>
              </label>
              <textarea
                required
                rows={3}
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="e.g. Issued with incorrect payee or expired leave"
                className="w-full p-2 border border-line-strong rounded text-xs focus:ring-1 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-line">
              <button
                type="button"
                onClick={() => setCancelTarget(null)}
                className="px-4 py-2 border border-line-strong text-ink-muted hover:bg-canvas text-xs font-semibold rounded"
              >
                Keep Active
              </button>
              <button
                type="button"
                onClick={handleConfirmCancel}
                disabled={!cancelReason.trim() || pending === "cancel"}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded disabled:opacity-50"
              >{pending === "cancel" && <Spinner className="size-3.5" />}
                Confirm Cancel
              </button>
            </div>
          </div>
        </ModalDialog>
      )}
    </div>
  );
}
