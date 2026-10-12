"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  ArrowRightLeft,
  CheckCircle2,
  ChevronRight,
  Clock,
  DollarSign,
  Download,
  Eye,
  Filter,
  Plus,
  Printer,
  RotateCcw,
  Search,
  Send,
  ShieldCheck,
  Truck,
  X,
} from "lucide-react";
import { SummaryCard } from "@/components/purchase/SummaryCard";
import { ModalDialog } from "@/components/purchase/ModalDialog";
import { useAccountingStore } from "@/features/accounts/store/accounting-store";
import type { FundTransferRecord, FundTransferStatus } from "@/features/accounts/types";

export default function FundTransferPage() {
  const transfers = useAccountingStore((s) => s.transfers);
  const accounts = useAccountingStore((s) => s.accounts);
  const createTransfer = useAccountingStore((s) => s.createTransfer);
  const approveTransfer = useAccountingStore((s) => s.approveTransfer);
  const dispatchTransfer = useAccountingStore((s) => s.dispatchTransfer);
  const receiveTransfer = useAccountingStore((s) => s.receiveTransfer);
  const returnTransfer = useAccountingStore((s) => s.returnTransfer);

  const [activeTab, setActiveTab] = useState<
    "ALL" | "REQUESTS" | "DISPATCHED" | "IN_TRANSIT" | "RECEIVED" | "RETURNED"
  >("ALL");
  const [search, setSearch] = useState("");
  const [fromOfficeFilter, setFromOfficeFilter] = useState("ALL");

  const [isNewOpen, setIsNewOpen] = useState(false);
  const [returnTarget, setReturnTarget] = useState<FundTransferRecord | null>(null);
  const [returnReason, setReturnReason] = useState("");

  const [form, setForm] = useState({
    requestDate: new Date().toISOString().split("T")[0],
    expectedDate: new Date(Date.now() + 86400000).toISOString().split("T")[0],
    fromOfficeId: "office-main",
    fromOfficeName: "Dhaka Corporate HQ",
    toOfficeId: "office-ctg",
    toOfficeName: "Chittagong Heavy Plant",
    fromAccountId: "acc-1120",
    fromAccountName: "Cash at Bank - Sonali Bank",
    toAccountId: "acc-1121",
    toAccountName: "Cash at Bank - BRAC Bank",
    requestedAmount: 0,
    responsiblePerson: "Mohammad Arif",
    purpose: "Working capital replenishment for factory payroll",
    referenceNumber: "",
    status: "PENDING_APPROVAL" as FundTransferStatus,
  });

  const filteredTransfers = useMemo(() => {
    return transfers.filter((t) => {
      if (search) {
        const q = search.toLowerCase();
        const m =
          t.transferNumber.toLowerCase().includes(q) ||
          t.requestCode.toLowerCase().includes(q) ||
          t.fromOfficeName.toLowerCase().includes(q) ||
          t.toOfficeName.toLowerCase().includes(q) ||
          t.purpose.toLowerCase().includes(q);
        if (!m) return false;
      }
      if (fromOfficeFilter !== "ALL" && t.fromOfficeId !== fromOfficeFilter) return false;

      if (activeTab === "REQUESTS") return t.status === "DRAFT" || t.status === "SUBMITTED" || t.status === "PENDING_APPROVAL";
      if (activeTab === "DISPATCHED") return t.status === "APPROVED" || t.status === "DISPATCHED";
      if (activeTab === "IN_TRANSIT") return t.status === "IN_TRANSIT";
      if (activeTab === "RECEIVED") return t.status === "RECEIVED";
      if (activeTab === "RETURNED") return t.status === "RETURNED";
      return true;
    });
  }, [transfers, search, fromOfficeFilter, activeTab]);

  const handleSaveTransfer = (e: React.FormEvent) => {
    e.preventDefault();
    if (form.requestedAmount <= 0) return;
    createTransfer(form);
    setIsNewOpen(false);
  };

  const handleConfirmReturn = () => {
    if (!returnTarget) return;
    if (!returnReason.trim()) {
      alert("Please specify the reason for transfer return.");
      return;
    }
    returnTransfer(returnTarget.id, returnReason);
    setReturnTarget(null);
    setReturnReason("");
  };

  const handleExportCSV = () => {
    let csv = "SL,Transfer #,Request Code,Date,From Office,To Office,Source Account,Destination Account,Amount,Status\n";
    filteredTransfers.forEach((t, i) => {
      csv += `"${i + 1}","${t.transferNumber}","${t.requestCode}","${t.requestDate}","${t.fromOfficeName}","${t.toOfficeName}","${t.fromAccountName}","${t.toAccountName}","${t.approvedAmount || t.requestedAmount}","${t.status}"\n`;
    });
    const link = document.createElement("a");
    link.href = encodeURI("data:text/csv;charset=utf-8," + csv);
    link.download = `BridgeOne_Fund_Transfers.csv`;
    link.click();
  };

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
            <span className="text-slate-600 font-medium">Fund Transfer</span>
          </nav>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Fund Transfer Management</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Inter-branch and inter-bank fund transfers with in-transit reconciliation and zero double-counting
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search transfer #, office..."
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
            onClick={() => setIsNewOpen(true)}
            className="h-9 px-4 bg-[#2563eb] hover:bg-blue-700 text-white font-semibold text-xs rounded flex items-center gap-1.5 shadow-xs transition"
          >
            <Plus className="w-4 h-4" />
            <span>New Transfer Request</span>
          </button>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 2. SUMMARY KPI CARDS ROW */}
      {/* ------------------------------------------------------------- */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <SummaryCard
          title="Funds in Transit"
          value={`৳${transfers.filter((t) => t.status === "IN_TRANSIT").reduce((s, t) => s + t.transferredAmount, 0).toLocaleString()}`}
          subtitle={`${transfers.filter((t) => t.status === "IN_TRANSIT").length} shipments in route`}
          icon={Truck}
          variant="warning"
        />
        <SummaryCard
          title="Completed Receipts"
          value={`৳${transfers.filter((t) => t.status === "RECEIVED").reduce((s, t) => s + t.receivedAmount, 0).toLocaleString()}`}
          subtitle={`${transfers.filter((t) => t.status === "RECEIVED").length} settled transfers`}
          icon={CheckCircle2}
          variant="success"
        />
        <SummaryCard
          title="Pending Approval"
          value={transfers.filter((t) => t.status === "PENDING_APPROVAL").length}
          subtitle="Awaiting treasury sign-off"
          icon={Clock}
          variant="info"
        />
        <SummaryCard
          title="Returned Discrepancies"
          value={transfers.filter((t) => t.status === "RETURNED").length}
          subtitle="Reversed to source account"
          icon={AlertTriangle}
          variant="danger"
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
          <span>ALL TRANSFERS ({transfers.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("REQUESTS")}
          className={`pb-2.5 text-xs font-bold tracking-wide transition-colors relative flex items-center gap-2 uppercase whitespace-nowrap ${
            activeTab === "REQUESTS"
              ? "text-blue-600 border-b-2 border-blue-600 -mb-[1px]"
              : "text-slate-500 hover:text-slate-800"
          }`}
        >
          <span>TRANSFER REQUESTS ({transfers.filter((t) => t.status === "PENDING_APPROVAL").length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("DISPATCHED")}
          className={`pb-2.5 text-xs font-bold tracking-wide transition-colors relative flex items-center gap-2 uppercase whitespace-nowrap ${
            activeTab === "DISPATCHED"
              ? "text-blue-600 border-b-2 border-blue-600 -mb-[1px]"
              : "text-slate-500 hover:text-slate-800"
          }`}
        >
          <span>APPROVED OUT ({transfers.filter((t) => t.status === "APPROVED").length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("IN_TRANSIT")}
          className={`pb-2.5 text-xs font-bold tracking-wide transition-colors relative flex items-center gap-2 uppercase whitespace-nowrap ${
            activeTab === "IN_TRANSIT"
              ? "text-blue-600 border-b-2 border-blue-600 -mb-[1px]"
              : "text-slate-500 hover:text-slate-800"
          }`}
        >
          <span>IN TRANSIT ({transfers.filter((t) => t.status === "IN_TRANSIT").length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("RECEIVED")}
          className={`pb-2.5 text-xs font-bold tracking-wide transition-colors relative flex items-center gap-2 uppercase whitespace-nowrap ${
            activeTab === "RECEIVED"
              ? "text-blue-600 border-b-2 border-blue-600 -mb-[1px]"
              : "text-slate-500 hover:text-slate-800"
          }`}
        >
          <span>RECEIVED ({transfers.filter((t) => t.status === "RECEIVED").length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("RETURNED")}
          className={`pb-2.5 text-xs font-bold tracking-wide transition-colors relative flex items-center gap-2 uppercase whitespace-nowrap ${
            activeTab === "RETURNED"
              ? "text-blue-600 border-b-2 border-blue-600 -mb-[1px]"
              : "text-slate-500 hover:text-slate-800"
          }`}
        >
          <span>RETURNED ({transfers.filter((t) => t.status === "RETURNED").length})</span>
        </button>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 4. FILTER TOOLBAR */}
      {/* ------------------------------------------------------------- */}
      <div className="bg-white rounded border border-slate-200/90 p-3 shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 text-xs text-slate-600">
            <span className="font-medium text-[11px] text-slate-500">Source Office:</span>
            <select
              value={fromOfficeFilter}
              onChange={(e) => setFromOfficeFilter(e.target.value)}
              className="border border-slate-200 rounded px-2.5 py-1 text-xs bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="ALL">All Source Branches</option>
              <option value="office-main">Dhaka Corporate HQ</option>
              <option value="office-ctg">Chittagong Heavy Plant</option>
            </select>
          </div>

          <button
            type="button"
            onClick={() => {
              setSearch("");
              setFromOfficeFilter("ALL");
            }}
            className="flex items-center gap-1 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded text-xs font-medium transition"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset</span>
          </button>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 5. FUND TRANSFER REGISTER TABLE */}
      {/* ------------------------------------------------------------- */}
      <div className="bg-white rounded border border-slate-200/90 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-y border-slate-200 text-[11px] font-bold text-slate-700 uppercase tracking-wider">
              <tr>
                <th className="px-3.5 py-2.5">SL</th>
                <th className="px-3.5 py-2.5">Transfer #</th>
                <th className="px-3.5 py-2.5">Date</th>
                <th className="px-3.5 py-2.5">From Branch & Account</th>
                <th className="px-3.5 py-2.5">To Branch & Account</th>
                <th className="px-3.5 py-2.5">Responsible</th>
                <th className="px-3.5 py-2.5 text-right font-bold text-slate-900">Amount (৳)</th>
                <th className="px-3.5 py-2.5 text-center">Status</th>
                <th className="px-3.5 py-2.5 text-center">Workflow Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredTransfers.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-xs text-slate-400">
                    No fund transfers found matching criteria.
                  </td>
                </tr>
              ) : (
                filteredTransfers.map((t, index) => (
                  <tr key={t.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-3.5 py-2.5 font-medium text-slate-500">{index + 1}</td>
                    <td className="px-3.5 py-2.5">
                      <div className="font-mono font-bold text-blue-600">{t.transferNumber}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{t.requestCode}</div>
                    </td>
                    <td className="px-3.5 py-2.5 text-slate-600">{t.requestDate}</td>
                    <td className="px-3.5 py-2.5">
                      <div className="font-semibold text-slate-800">{t.fromOfficeName}</div>
                      <div className="text-[11px] text-slate-500">{t.fromAccountName}</div>
                    </td>
                    <td className="px-3.5 py-2.5">
                      <div className="font-semibold text-slate-800">{t.toOfficeName}</div>
                      <div className="text-[11px] text-slate-500">{t.toAccountName}</div>
                    </td>
                    <td className="px-3.5 py-2.5 text-slate-600">{t.responsiblePerson}</td>
                    <td className="px-3.5 py-2.5 text-right font-mono font-bold text-blue-700 text-sm">
                      ৳{(t.approvedAmount || t.requestedAmount).toLocaleString()}
                    </td>
                    <td className="px-3.5 py-2.5 text-center">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                          t.status === "RECEIVED"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : t.status === "IN_TRANSIT"
                            ? "bg-amber-50 text-amber-700 border-amber-200"
                            : t.status === "RETURNED"
                            ? "bg-rose-50 text-rose-700 border-rose-200"
                            : "bg-blue-50 text-blue-700 border-blue-200"
                        }`}
                      >
                        {t.status}
                      </span>
                    </td>
                    <td className="px-3.5 py-2.5 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        {t.status === "PENDING_APPROVAL" && (
                          <button
                            type="button"
                            onClick={() => approveTransfer(t.id, t.requestedAmount)}
                            className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-600 hover:bg-emerald-700 text-white transition"
                          >
                            Approve
                          </button>
                        )}
                        {t.status === "APPROVED" && (
                          <button
                            type="button"
                            onClick={() => dispatchTransfer(t.id)}
                            className="px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-600 hover:bg-blue-700 text-white transition flex items-center gap-1"
                          >
                            <Send className="w-3 h-3" /> Dispatch
                          </button>
                        )}
                        {t.status === "IN_TRANSIT" && (
                          <>
                            <button
                              type="button"
                              onClick={() => receiveTransfer(t.id)}
                              className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-600 hover:bg-emerald-700 text-white transition"
                            >
                              Confirm Receipt
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setReturnTarget(t);
                                setReturnReason("");
                              }}
                              className="px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-600 hover:bg-rose-700 text-white transition"
                            >
                              Return
                            </button>
                          </>
                        )}
                        {t.status === "RECEIVED" && (
                          <span className="text-[11px] font-medium text-emerald-600 flex items-center gap-1 justify-center">
                            <CheckCircle2 className="w-3 h-3" /> Received
                          </span>
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
      {/* 6. MODAL: CREATE FUND TRANSFER REQUEST */}
      {/* ------------------------------------------------------------- */}
      <ModalDialog
        isOpen={isNewOpen}
        onClose={() => setIsNewOpen(false)}
        title="Create Fund Transfer Request"
        subtitle="Initiate inter-branch cash/bank transfer workflow with automated transit posting"
        maxWidth="xl"
      >
        <form onSubmit={handleSaveTransfer} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Request Date *</label>
              <input
                type="date"
                required
                value={form.requestDate}
                onChange={(e) => setForm({ ...form, requestDate: e.target.value })}
                className="w-full h-8 border border-slate-300 rounded px-2 text-xs"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Expected Delivery Date *</label>
              <input
                type="date"
                required
                value={form.expectedDate}
                onChange={(e) => setForm({ ...form, expectedDate: e.target.value })}
                className="w-full h-8 border border-slate-300 rounded px-2 text-xs"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">From Office (Origin) *</label>
              <select
                value={form.fromOfficeId}
                onChange={(e) =>
                  setForm({
                    ...form,
                    fromOfficeId: e.target.value,
                    fromOfficeName: e.target.value === "office-main" ? "Dhaka Corporate HQ" : "Chittagong Heavy Plant",
                  })
                }
                className="w-full h-8 border border-slate-300 rounded px-2 text-xs bg-white"
              >
                <option value="office-main">Dhaka Corporate HQ</option>
                <option value="office-ctg">Chittagong Heavy Plant</option>
              </select>
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">To Office (Destination) *</label>
              <select
                value={form.toOfficeId}
                onChange={(e) =>
                  setForm({
                    ...form,
                    toOfficeId: e.target.value,
                    toOfficeName: e.target.value === "office-ctg" ? "Chittagong Heavy Plant" : "Dhaka Corporate HQ",
                  })
                }
                className="w-full h-8 border border-slate-300 rounded px-2 text-xs bg-white"
              >
                <option value="office-ctg">Chittagong Heavy Plant</option>
                <option value="office-main">Dhaka Corporate HQ</option>
              </select>
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Source Cash/Bank Account *</label>
              <select
                value={form.fromAccountId}
                onChange={(e) => {
                  const acc = accounts.find((a) => a.id === e.target.value);
                  setForm({ ...form, fromAccountId: e.target.value, fromAccountName: acc?.name || "Bank" });
                }}
                className="w-full h-8 border border-slate-300 rounded px-2 text-xs bg-white"
              >
                {accounts
                  .filter((a) => a.accountSubtype === "Bank" || a.accountSubtype === "Cash")
                  .map((a) => (
                    <option key={a.id} value={a.id}>
                      [{a.code}] {a.name}
                    </option>
                  ))}
              </select>
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Destination Cash/Bank Account *</label>
              <select
                value={form.toAccountId}
                onChange={(e) => {
                  const acc = accounts.find((a) => a.id === e.target.value);
                  setForm({ ...form, toAccountId: e.target.value, toAccountName: acc?.name || "Bank" });
                }}
                className="w-full h-8 border border-slate-300 rounded px-2 text-xs bg-white"
              >
                {accounts
                  .filter((a) => a.accountSubtype === "Bank" || a.accountSubtype === "Cash")
                  .map((a) => (
                    <option key={a.id} value={a.id}>
                      [{a.code}] {a.name}
                    </option>
                  ))}
              </select>
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Transfer Amount (৳) *</label>
              <input
                type="number"
                required
                min="100"
                value={form.requestedAmount || ""}
                onChange={(e) => setForm({ ...form, requestedAmount: parseFloat(e.target.value) || 0 })}
                className="w-full h-8 border border-slate-300 rounded px-2.5 text-xs font-mono text-slate-800"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Responsible Person *</label>
              <input
                type="text"
                required
                value={form.responsiblePerson}
                onChange={(e) => setForm({ ...form, responsiblePerson: e.target.value })}
                className="w-full h-8 border border-slate-300 rounded px-2.5 text-xs text-slate-800"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block font-semibold text-slate-700 mb-1">Business Purpose *</label>
              <input
                type="text"
                required
                value={form.purpose}
                onChange={(e) => setForm({ ...form, purpose: e.target.value })}
                className="w-full h-8 border border-slate-300 rounded px-2.5 text-xs text-slate-800"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setIsNewOpen(false)}
              className="px-3.5 py-1.5 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 bg-[#2563eb] hover:bg-blue-700 text-white rounded text-xs font-semibold shadow-xs"
            >
              Submit Transfer Request
            </button>
          </div>
        </form>
      </ModalDialog>

      {/* ------------------------------------------------------------- */}
      {/* 7. MODAL: RETURN IN-TRANSIT TRANSFER */}
      {/* ------------------------------------------------------------- */}
      <ModalDialog
        isOpen={!!returnTarget}
        onClose={() => setReturnTarget(null)}
        title={`Return In-Transit Transfer — ${returnTarget?.transferNumber}`}
        subtitle="This will reverse the Fund in Transit entry back into the originating source account"
        maxWidth="md"
      >
        <div className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Reason for Return / Discrepancy *</label>
            <textarea
              rows={3}
              required
              placeholder="e.g. Branch courier intercepted, incorrect destination account, rejected by branch controller..."
              value={returnReason}
              onChange={(e) => setReturnReason(e.target.value)}
              className="w-full border border-slate-300 rounded p-2 text-xs text-slate-800"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setReturnTarget(null)}
              className="px-3.5 py-1.5 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirmReturn}
              className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded text-xs font-semibold shadow-xs"
            >
              Confirm Return to Source
            </button>
          </div>
        </div>
      </ModalDialog>
    </div>
  );
}
