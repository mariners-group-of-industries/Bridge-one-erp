"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  Banknote,
  CheckCircle2,
  ChevronRight,
  Clock,
  Download,
  Filter,
  Plus,
  Printer,
  RotateCcw,
  Search,
  ShieldAlert,
  XCircle,
} from "lucide-react";
import { SummaryCard } from "@/components/purchase/SummaryCard";
import { ModalDialog } from "@/components/purchase/ModalDialog";
import { useAccountingStore } from "@/features/accounts/store/accounting-store";
import type { ChequeIssueItem, ChequeStatus } from "@/features/accounts/types";

export default function ChequeIssuePage() {
  const cheques = useAccountingStore((s) => s.cheques);
  const chequeBooks = useAccountingStore((s) => s.chequeBooks);
  const bankAccounts = useAccountingStore((s) => s.bankAccounts);
  const issueCheque = useAccountingStore((s) => s.issueCheque);
  const updateChequeStatus = useAccountingStore((s) => s.updateChequeStatus);

  const [activeTab, setActiveTab] = useState<"ALL" | "ISSUED" | "POST_DATED" | "CLEARED" | "BOUNCED" | "CANCELLED">("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  const [isIssueOpen, setIsIssueOpen] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<ChequeIssueItem | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  // Printable Cheque preview
  const [printingCheque, setPrintingCheque] = useState<ChequeIssueItem | null>(null);

  const [form, setForm] = useState({
    bankAccountId: "bank-1",
    bankName: "Sonali Bank PLC",
    chequeBookId: "cb-1",
    chequeNumber: "SB-1001",
    payeeName: "",
    issueDate: new Date().toISOString().split("T")[0],
    chequeDate: new Date().toISOString().split("T")[0],
    amount: 0,
    purpose: "",
    referenceVoucher: "",
    status: "ISSUED" as ChequeStatus,
  });

  const filteredCheques = useMemo(() => {
    return cheques.filter((c) => {
      const matchSearch =
        c.chequeNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.payeeName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.bankName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.purpose.toLowerCase().includes(searchQuery.toLowerCase());
      const matchTab = activeTab === "ALL" ? true : c.status === activeTab;
      return matchSearch && matchTab;
    });
  }, [cheques, searchQuery, activeTab]);

  const handleBankChange = (bankId: string) => {
    const bank = bankAccounts.find((b) => b.id === bankId);
    const books = chequeBooks.filter((b) => b.bankAccountId === bankId && b.remainingLeaves > 0);
    const firstBook = books[0] || chequeBooks[0];

    if (bank) {
      setForm({
        ...form,
        bankAccountId: bank.id,
        bankName: bank.bankName,
        chequeBookId: firstBook?.id || "",
        chequeNumber: firstBook ? `${firstBook.startChequeNumber}` : "",
      });
    }
  };

  const handleSaveIssue = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");

    if (!form.payeeName.trim() || form.amount <= 0 || !form.chequeNumber.trim()) {
      setErrorMessage("Payee name, valid cheque number, and amount are required.");
      return;
    }

    issueCheque({
      bankAccountId: form.bankAccountId,
      bankName: form.bankName,
      chequeBookId: form.chequeBookId,
      chequeNumber: form.chequeNumber.trim(),
      payeeName: form.payeeName.trim(),
      issueDate: form.issueDate,
      chequeDate: form.chequeDate,
      amount: form.amount,
      purpose: form.purpose,
      referenceVoucher: form.referenceVoucher || "JV-2026-CHQ",
      status: new Date(form.chequeDate) > new Date() ? "POST_DATED" : "ISSUED",
    });

    setIsIssueOpen(false);
    setForm({
      ...form,
      payeeName: "",
      amount: 0,
      purpose: "",
    });
  };

  const handleConfirmCancel = () => {
    if (!cancelTarget || !cancelReason.trim()) return;
    updateChequeStatus(cancelTarget.id, "CANCELLED", cancelReason);
    setCancelTarget(null);
    setCancelReason("");
  };

  const handleExportCSV = () => {
    const headers = "Cheque No,Bank,Payee,Issue Date,Cheque Date,Amount,Purpose,Status\n";
    const rows = filteredCheques
      .map(
        (c) =>
          `"${c.chequeNumber}","${c.bankName}","${c.payeeName}","${c.issueDate}","${c.chequeDate}",${c.amount},"${c.purpose}","${c.status}"`,
      )
      .join("\n");
    const blob = new Blob([headers + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `cheque_issue_register_${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const issuedTotal = useMemo(
    () => cheques.filter((c) => c.status === "ISSUED").reduce((sum, c) => sum + c.amount, 0),
    [cheques],
  );
  const clearedTotal = useMemo(
    () => cheques.filter((c) => c.status === "CLEARED").reduce((sum, c) => sum + c.amount, 0),
    [cheques],
  );
  const postDatedTotal = useMemo(
    () => cheques.filter((c) => c.status === "POST_DATED").reduce((sum, c) => sum + c.amount, 0),
    [cheques],
  );
  const bouncedTotal = useMemo(
    () => cheques.filter((c) => c.status === "BOUNCED").reduce((sum, c) => sum + c.amount, 0),
    [cheques],
  );

  return (
    <div className="space-y-3 font-sans pb-12">
      {/* ------------------------------------------------------------- */}
      {/* 1. TOP HEADER */}
      {/* ------------------------------------------------------------- */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 rounded border border-slate-200/90 shadow-2xs">
        <div>
          <nav className="flex items-center gap-1.5 text-[11px] text-slate-400 mb-0.5">
            <Link href="/accounts" className="hover:text-slate-600 transition">
              Account
            </Link>
            <ChevronRight className="w-3 h-3 text-slate-300" />
            <span className="text-slate-600 font-medium">Cheque Issue</span>
          </nav>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Cheque Issue & Clearance Register</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Issue bank cheques, monitor post-dated leaves, clearance settlement, and bounce handling
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search cheque #, payee, bank..."
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
              setErrorMessage("");
              setSuccessMessage("");
              setIsIssueOpen(true);
            }}
            className="h-9 px-4 bg-[#2563eb] hover:bg-blue-700 text-white font-semibold text-xs rounded flex items-center gap-1.5 shadow-xs transition"
          >
            <Plus className="w-4 h-4" />
            <span>Issue Cheque</span>
          </button>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 2. SUMMARY KPI CARDS */}
      {/* ------------------------------------------------------------- */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <SummaryCard
          title="Active Issued Cheques"
          value={`৳${issuedTotal.toLocaleString()}`}
          subtitle={`${cheques.filter((c) => c.status === "ISSUED").length} cheques awaiting clearance`}
          icon={Banknote}
          variant="info"
        />
        <SummaryCard
          title="Post-Dated Cheques"
          value={`৳${postDatedTotal.toLocaleString()}`}
          subtitle={`${cheques.filter((c) => c.status === "POST_DATED").length} future maturity leaves`}
          icon={Clock}
          variant="info"
        />
        <SummaryCard
          title="Cleared Disbursements"
          value={`৳${clearedTotal.toLocaleString()}`}
          subtitle={`${cheques.filter((c) => c.status === "CLEARED").length} verified bank debits`}
          icon={CheckCircle2}
          variant="success"
        />
        <SummaryCard
          title="Bounced / Returned"
          value={`৳${bouncedTotal.toLocaleString()}`}
          subtitle={`${cheques.filter((c) => c.status === "BOUNCED").length} dishonored leaves`}
          icon={ShieldAlert}
          variant="danger"
        />
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 3. TABS NAVIGATION */}
      {/* ------------------------------------------------------------- */}
      <div className="bg-white rounded border border-slate-200/90 shadow-2xs">
        <div className="flex items-center gap-1 px-3 border-b border-slate-200 overflow-x-auto text-xs font-medium">
          {[
            { id: "ALL", label: `CHEQUE REGISTER (${cheques.length})` },
            { id: "ISSUED", label: `OUTGOING / ISSUED (${cheques.filter((c) => c.status === "ISSUED").length})` },
            { id: "POST_DATED", label: `POST-DATED (${cheques.filter((c) => c.status === "POST_DATED").length})` },
            { id: "CLEARED", label: `CLEARED (${cheques.filter((c) => c.status === "CLEARED").length})` },
            { id: "BOUNCED", label: `BOUNCED (${cheques.filter((c) => c.status === "BOUNCED").length})` },
            { id: "CANCELLED", label: `CANCELLED (${cheques.filter((c) => c.status === "CANCELLED").length})` },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`py-2.5 px-3 whitespace-nowrap transition-colors border-b-2 -mb-[1px] ${
                activeTab === tab.id
                  ? "text-blue-600 border-blue-600 font-semibold"
                  : "text-slate-500 border-transparent hover:text-slate-700"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ------------------------------------------------------------- */}
        {/* 4. HIGH DENSITY DATA TABLE */}
        {/* ------------------------------------------------------------- */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-700 uppercase tracking-wider">
              <tr>
                <th className="px-3.5 py-2.5">Cheque #</th>
                <th className="px-3.5 py-2.5">Bank Account</th>
                <th className="px-3.5 py-2.5">Payee Beneficiary</th>
                <th className="px-3.5 py-2.5">Issue Date</th>
                <th className="px-3.5 py-2.5">Cheque Date</th>
                <th className="px-3.5 py-2.5 text-right">Amount (৳)</th>
                <th className="px-3.5 py-2.5">Purpose / Ref</th>
                <th className="px-3.5 py-2.5 text-center">Status</th>
                <th className="px-3.5 py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredCheques.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    No cheque records found matching the criteria. Click &quot;Issue Cheque&quot; to disburse a new leaf.
                  </td>
                </tr>
              ) : (
                filteredCheques.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/70 transition">
                    <td className="px-3.5 py-2.5 font-mono font-semibold text-blue-600">{c.chequeNumber}</td>
                    <td className="px-3.5 py-2.5 font-medium text-slate-800">{c.bankName}</td>
                    <td className="px-3.5 py-2.5 font-medium text-slate-900">{c.payeeName}</td>
                    <td className="px-3.5 py-2.5 text-slate-500">{c.issueDate}</td>
                    <td className="px-3.5 py-2.5 text-slate-600 font-medium">{c.chequeDate}</td>
                    <td className="px-3.5 py-2.5 text-right font-bold text-slate-900">৳{c.amount.toLocaleString()}</td>
                    <td className="max-w-xs truncate px-3.5 py-2.5 text-slate-500" title={c.purpose}>
                      {c.purpose || "—"}
                    </td>
                    <td className="px-3.5 py-2.5 text-center">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold ${
                          c.status === "CLEARED"
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : c.status === "POST_DATED"
                            ? "bg-sky-50 text-sky-700 border border-sky-200"
                            : c.status === "BOUNCED" || c.status === "CANCELLED"
                            ? "bg-rose-50 text-rose-700 border border-rose-200"
                            : "bg-amber-50 text-amber-700 border border-amber-200"
                        }`}
                      >
                        {c.status.replace("_", " ")}
                      </span>
                    </td>
                    <td className="px-3.5 py-2.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => setPrintingCheque(c)}
                          title="Print Cheque Layout"
                          className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
                        >
                          <Printer className="w-3.5 h-3.5" />
                        </button>
                        {(c.status === "ISSUED" || c.status === "POST_DATED") && (
                          <>
                            <button
                              type="button"
                              onClick={() => updateChequeStatus(c.id, "CLEARED")}
                              className="px-2 py-1 rounded bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-semibold text-[11px] transition"
                            >
                              Clear
                            </button>
                            <button
                              type="button"
                              onClick={() => updateChequeStatus(c.id, "BOUNCED", "Insufficient funds / signature")}
                              className="px-2 py-1 rounded bg-amber-50 text-amber-700 hover:bg-amber-100 font-semibold text-[11px] transition"
                            >
                              Bounce
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setCancelTarget(c);
                                setCancelReason("");
                              }}
                              className="px-2 py-1 rounded bg-rose-50 text-rose-700 hover:bg-rose-100 font-semibold text-[11px] transition"
                            >
                              Cancel
                            </button>
                          </>
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
      {/* 5. MODALS & DIALOGS */}
      {/* ------------------------------------------------------------- */}
      <ModalDialog
        isOpen={isIssueOpen}
        onClose={() => setIsIssueOpen(false)}
        title="Issue Bank Cheque Leaf"
        maxWidth="lg"
      >
        {errorMessage && (
          <div className="flex items-center gap-2 rounded bg-rose-50 border border-rose-200 p-2 text-xs font-medium text-rose-700 mb-3">
            <AlertCircle className="w-4 h-4 shrink-0" /> {errorMessage}
          </div>
        )}

        <form onSubmit={handleSaveIssue} className="space-y-3 text-xs">
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Bank Account *
            </label>
            <select
              value={form.bankAccountId}
              onChange={(e) => handleBankChange(e.target.value)}
              className="w-full h-8 px-2.5 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
            >
              {bankAccounts.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.bankName} - {b.accountNumber}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Cheque Book *
              </label>
              <select
                value={form.chequeBookId}
                onChange={(e) => setForm({ ...form, chequeBookId: e.target.value })}
                className="w-full h-8 px-2.5 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              >
                {chequeBooks
                  .filter((b) => b.bankAccountId === form.bankAccountId)
                  .map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.bookName} ({b.remainingLeaves} leaves)
                    </option>
                  ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Cheque Number *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. SB-1002"
                value={form.chequeNumber}
                onChange={(e) => setForm({ ...form, chequeNumber: e.target.value })}
                className="w-full h-8 px-2.5 border border-slate-300 rounded text-xs font-mono font-semibold focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Payee Name *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Meghna Petroleum Limited"
              value={form.payeeName}
              onChange={(e) => setForm({ ...form, payeeName: e.target.value })}
              className="w-full h-8 px-2.5 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Amount (৳) *
              </label>
              <input
                type="number"
                required
                min="1"
                value={form.amount || ""}
                onChange={(e) => setForm({ ...form, amount: Number(e.target.value) || 0 })}
                className="w-full h-8 px-2.5 border border-slate-300 rounded text-xs font-bold text-slate-900 focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Cheque Date (Maturity) *
              </label>
              <input
                type="date"
                required
                value={form.chequeDate}
                onChange={(e) => setForm({ ...form, chequeDate: e.target.value })}
                className="w-full h-8 px-2.5 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Purpose & Reference Voucher
            </label>
            <input
              type="text"
              placeholder="e.g. Vendor settlement for Purchase Order PO-2026-004"
              value={form.purpose}
              onChange={(e) => setForm({ ...form, purpose: e.target.value })}
              className="w-full h-8 px-2.5 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setIsIssueOpen(false)}
              className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 bg-[#2563eb] hover:bg-blue-700 text-white font-semibold text-xs rounded transition"
            >
              Issue Cheque Leaf
            </button>
          </div>
        </form>
      </ModalDialog>

      {/* Cheque Cancellation Modal */}
      <ModalDialog
        isOpen={!!cancelTarget}
        onClose={() => setCancelTarget(null)}
        title="Cancel Issued Cheque"
        maxWidth="md"
      >
        <p className="text-xs text-slate-600 mb-3">
          Cancel leaf <span className="font-mono font-bold text-slate-900">{cancelTarget?.chequeNumber}</span> issued to{" "}
          <span className="font-semibold text-slate-900">{cancelTarget?.payeeName}</span>.
        </p>

        <div className="space-y-3 text-xs">
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Cancellation Reason *
            </label>
            <textarea
              required
              rows={3}
              placeholder="e.g. Incorrect amount printed or payee requested electronic bank transfer..."
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              className="w-full p-2.5 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setCancelTarget(null)}
              className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-800"
            >
              Abort
            </button>
            <button
              type="button"
              onClick={handleConfirmCancel}
              className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs rounded transition"
            >
              Confirm Cancellation
            </button>
          </div>
        </div>
      </ModalDialog>

      {/* Realistic Cheque Print Preview */}
      <ModalDialog
        isOpen={!!printingCheque}
        onClose={() => setPrintingCheque(null)}
        title="Cheque Print Preview"
        maxWidth="xl"
      >
        {printingCheque && (
          <div className="space-y-4 text-xs">
            <div className="relative rounded-xl border-2 border-emerald-700/60 bg-emerald-50/50 p-5 shadow-xs">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">{printingCheque.bankName}</h3>
                  <p className="text-[10px] text-slate-500">Principal Corporate Branch, Motijheel C/A</p>
                </div>
                <div className="rounded border border-emerald-300 bg-white px-2 py-0.5 font-mono text-[11px] font-semibold text-slate-900">
                  DATE: {printingCheque.chequeDate}
                </div>
              </div>

              <div className="mt-4 space-y-2 border-b border-dashed border-emerald-300 pb-3">
                <div className="flex items-baseline gap-2">
                  <span className="font-semibold text-slate-500 text-[11px]">PAY TO:</span>
                  <span className="flex-1 border-b border-emerald-400 pb-0.5 font-bold text-slate-900 text-sm">
                    {printingCheque.payeeName}
                  </span>
                  <span className="font-semibold text-slate-400 text-[10px]">OR BEARER</span>
                </div>

                <div className="flex items-baseline gap-2">
                  <span className="font-semibold text-slate-500 text-[11px]">TAKA:</span>
                  <span className="flex-1 border-b border-emerald-400 pb-0.5 font-medium text-slate-800">
                    (Taka {printingCheque.amount.toLocaleString()} Only)
                  </span>
                  <div className="rounded border-2 border-slate-900 bg-white px-3 py-1 font-mono font-bold text-slate-900 text-sm">
                    ৳{printingCheque.amount.toLocaleString()}/=
                  </div>
                </div>
              </div>

              <div className="mt-6 flex items-end justify-between font-mono text-[11px] text-slate-600">
                <span>CHEQUE NO: {printingCheque.chequeNumber}</span>
                <div className="text-right">
                  <p className="border-t border-slate-700 px-6 pt-1 font-sans text-xs font-semibold text-slate-900">
                    Authorised Signature
                  </p>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
              <button
                type="button"
                onClick={() => window.print()}
                className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-xs rounded flex items-center gap-1.5 transition"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Leaf</span>
              </button>
              <button
                type="button"
                onClick={() => setPrintingCheque(null)}
                className="px-4 py-1.5 bg-[#2563eb] hover:bg-blue-700 text-white font-semibold text-xs rounded transition"
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
