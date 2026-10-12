"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Calculator,
  CheckCircle2,
  ChevronRight,
  DollarSign,
  Download,
  Filter,
  PieChart,
  Plus,
  Printer,
  RotateCcw,
  Search,
  TrendingUp,
} from "lucide-react";
import { SummaryCard } from "@/components/purchase/SummaryCard";
import { ModalDialog } from "@/components/purchase/ModalDialog";
import { useAccountingStore } from "@/features/accounts/store/accounting-store";
import type { BudgetItem } from "@/features/accounts/types";

export default function BudgetManagementPage() {
  const budgets = useAccountingStore((s) => s.budgets);
  const accounts = useAccountingStore((s) => s.accounts);
  const costCenters = useAccountingStore((s) => s.costCenters);
  const createBudget = useAccountingStore((s) => s.createBudget);
  const updateBudgetRevision = useAccountingStore((s) => s.updateBudgetRevision);

  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<string>("ALL");

  const [isNewOpen, setIsNewOpen] = useState(false);
  const [revisionTarget, setRevisionTarget] = useState<BudgetItem | null>(null);
  const [newRevisionAmount, setNewRevisionAmount] = useState<number>(0);

  const [form, setForm] = useState({
    budgetName: "",
    budgetYear: "2026-2027",
    financialPeriod: "Full Fiscal Year",
    officeId: "office-main",
    officeName: "Dhaka Corporate HQ",
    costCenterId: "cc-1",
    costCenterName: "Dhaka Head Office",
    budgetType: "OPERATING" as BudgetItem["budgetType"],
    accountId: "acc-5100",
    accountName: "Office Rent & Utilities",
    allocatedAmount: 600000,
    approvalStatus: "APPROVED" as const,
    createdBy: "Finance Controller",
  });

  const filteredBudgets = useMemo(() => {
    return budgets.filter((b) => {
      const matchSearch =
        b.budgetCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
        b.budgetName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        b.accountName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        b.costCenterName.toLowerCase().includes(searchQuery.toLowerCase());
      const matchType = filterType === "ALL" ? true : b.budgetType === filterType;
      return matchSearch && matchType;
    });
  }, [budgets, searchQuery, filterType]);

  const handleSaveBudget = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.budgetName.trim() || form.allocatedAmount <= 0) return;
    createBudget(form);
    setIsNewOpen(false);
    setForm({
      ...form,
      budgetName: "",
      allocatedAmount: 600000,
    });
  };

  const handleSaveRevision = () => {
    if (!revisionTarget || newRevisionAmount <= 0) return;
    updateBudgetRevision(revisionTarget.id, newRevisionAmount);
    setRevisionTarget(null);
  };

  const totalAllocated = useMemo(() => budgets.reduce((sum, b) => sum + b.allocatedAmount, 0), [budgets]);
  const totalUtilized = useMemo(() => budgets.reduce((sum, b) => sum + b.utilizedAmount, 0), [budgets]);
  const totalCommitted = useMemo(() => budgets.reduce((sum, b) => sum + b.committedAmount, 0), [budgets]);
  const totalRemaining = useMemo(() => budgets.reduce((sum, b) => sum + b.remainingAmount, 0), [budgets]);

  const handleExportCSV = () => {
    const headers = "Budget Code,Budget Name,Year,Cost Center,GL Account,Type,Allocated,Utilized,Committed,Remaining,Utilization %\n";
    const rows = filteredBudgets
      .map((b) => {
        const uPct = b.allocatedAmount > 0 ? ((b.utilizedAmount / b.allocatedAmount) * 100).toFixed(1) : "0";
        return `"${b.budgetCode}","${b.budgetName}","${b.budgetYear}","${b.costCenterName}","${b.accountName}","${b.budgetType}",${b.allocatedAmount},${b.utilizedAmount},${b.committedAmount},${b.remainingAmount},${uPct}%`;
      })
      .join("\n");
    const blob = new Blob([headers + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `budget_allocations_${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
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
            <span className="text-slate-600 font-medium">Budget</span>
          </nav>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Department & Project Budget Allocation</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Cost-center budget ceilings, purchase order commitments, and actual variance monitoring
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search budget, account, center..."
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
            <span>Allocate Budget</span>
          </button>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 2. SUMMARY KPI CARDS */}
      {/* ------------------------------------------------------------- */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <SummaryCard
          title="Total Budget Allocated"
          value={`৳${totalAllocated.toLocaleString()}`}
          subtitle="FY 2026-2027 fiscal allocation"
          icon={Calculator}
          variant="info"
        />
        <SummaryCard
          title="Utilized / Disbursed"
          value={`৳${totalUtilized.toLocaleString()}`}
          subtitle={`${((totalUtilized / (totalAllocated || 1)) * 100).toFixed(1)}% spent to date`}
          icon={CheckCircle2}
          variant="warning"
        />
        <SummaryCard
          title="Committed (In POs)"
          value={`৳${totalCommitted.toLocaleString()}`}
          subtitle="Locked by active purchase orders"
          icon={TrendingUp}
          variant="info"
        />
        <SummaryCard
          title="Available Uncommitted"
          value={`৳${totalRemaining.toLocaleString()}`}
          subtitle="Remaining operational balance"
          icon={PieChart}
          variant="success"
        />
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 3. TABS & FILTER TOOLBAR */}
      {/* ------------------------------------------------------------- */}
      <div className="bg-white rounded border border-slate-200/90 shadow-2xs">
        <div className="flex items-center gap-1 px-3 border-b border-slate-200 overflow-x-auto text-xs font-medium">
          {[
            { id: "ALL", label: `ALL BUDGET HEADS (${budgets.length})` },
            { id: "OPERATING", label: `OPEX / OPERATING (${budgets.filter((b) => b.budgetType === "OPERATING").length})` },
            { id: "CAPITAL", label: `CAPEX / CAPITAL (${budgets.filter((b) => b.budgetType === "CAPITAL").length})` },
            { id: "DEPARTMENT", label: `DEPARTMENTAL (${budgets.filter((b) => b.budgetType === "DEPARTMENT").length})` },
            { id: "PROJECT", label: `PROJECT (${budgets.filter((b) => b.budgetType === "PROJECT").length})` },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilterType(tab.id)}
              className={`py-2.5 px-3 whitespace-nowrap transition-colors border-b-2 -mb-[1px] ${
                filterType === tab.id
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
                <th className="px-3.5 py-2.5">Budget Code</th>
                <th className="px-3.5 py-2.5">Budget Head / Purpose</th>
                <th className="px-3.5 py-2.5">Cost Center</th>
                <th className="px-3.5 py-2.5">Target Account</th>
                <th className="px-3.5 py-2.5 text-right">Allocated (৳)</th>
                <th className="px-3.5 py-2.5 text-right">Utilized (৳)</th>
                <th className="px-3.5 py-2.5 text-right">Remaining (৳)</th>
                <th className="px-3.5 py-2.5">Utilization %</th>
                <th className="px-3.5 py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredBudgets.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    No budget allocations found. Click &quot;Allocate Budget&quot; to establish spending limits.
                  </td>
                </tr>
              ) : (
                filteredBudgets.map((b) => {
                  const rawPct = b.allocatedAmount > 0 ? (b.utilizedAmount / b.allocatedAmount) * 100 : 0;
                  const pct = Math.min(100, rawPct);
                  return (
                    <tr key={b.id} className="hover:bg-slate-50/70 transition">
                      <td className="px-3.5 py-2.5 font-mono font-semibold text-blue-600">{b.budgetCode}</td>
                      <td className="px-3.5 py-2.5">
                        <div className="font-semibold text-slate-900">{b.budgetName}</div>
                        <div className="text-[11px] text-slate-400">
                          {b.budgetYear} • {b.budgetType}
                        </div>
                      </td>
                      <td className="px-3.5 py-2.5 font-medium text-slate-800">{b.costCenterName}</td>
                      <td className="px-3.5 py-2.5 text-slate-600">{b.accountName}</td>
                      <td className="px-3.5 py-2.5 text-right font-bold text-slate-900">
                        ৳{b.allocatedAmount.toLocaleString()}
                      </td>
                      <td className="px-3.5 py-2.5 text-right font-medium text-amber-700">
                        ৳{b.utilizedAmount.toLocaleString()}
                      </td>
                      <td className="px-3.5 py-2.5 text-right font-bold text-emerald-700">
                        ৳{b.remainingAmount.toLocaleString()}
                      </td>
                      <td className="px-3.5 py-2.5 w-44">
                        <div className="flex items-center gap-2">
                          <div className="h-2 flex-1 rounded-full bg-slate-100 overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${
                                pct > 85 ? "bg-rose-500" : pct > 60 ? "bg-amber-500" : "bg-emerald-500"
                              }`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span
                            className={`text-[11px] font-bold w-10 text-right ${
                              pct > 85 ? "text-rose-600" : pct > 60 ? "text-amber-600" : "text-emerald-600"
                            }`}
                          >
                            {rawPct.toFixed(0)}%
                          </span>
                        </div>
                      </td>
                      <td className="px-3.5 py-2.5 text-right">
                        <button
                          type="button"
                          onClick={() => {
                            setRevisionTarget(b);
                            setNewRevisionAmount(b.allocatedAmount);
                          }}
                          className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-[11px] transition"
                        >
                          Revise Limit
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 5. MODALS */}
      {/* ------------------------------------------------------------- */}
      {/* Allocate Budget Modal */}
      <ModalDialog
        isOpen={isNewOpen}
        onClose={() => setIsNewOpen(false)}
        title="Allocate New Budget Ceiling"
        maxWidth="lg"
      >
        <form onSubmit={handleSaveBudget} className="space-y-3 text-xs">
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Budget Head Title *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. IT Cloud Infrastructure & Server License"
              value={form.budgetName}
              onChange={(e) => setForm({ ...form, budgetName: e.target.value })}
              className="w-full h-8 px-2.5 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Budget Type *
              </label>
              <select
                value={form.budgetType}
                onChange={(e) => setForm({ ...form, budgetType: e.target.value as any })}
                className="w-full h-8 px-2.5 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="OPERATING">Operating (OPEX)</option>
                <option value="CAPITAL">Capital (CAPEX)</option>
                <option value="DEPARTMENT">Departmental</option>
                <option value="PROJECT">Project-Based</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Fiscal Year *
              </label>
              <input
                type="text"
                required
                value={form.budgetYear}
                onChange={(e) => setForm({ ...form, budgetYear: e.target.value })}
                className="w-full h-8 px-2.5 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Cost Center *
              </label>
              <select
                value={form.costCenterId}
                onChange={(e) => {
                  const cc = costCenters.find((c) => c.id === e.target.value);
                  setForm({ ...form, costCenterId: e.target.value, costCenterName: cc?.name || "" });
                }}
                className="w-full h-8 px-2.5 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              >
                {costCenters.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code} - {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1">
                GL Account Code *
              </label>
              <select
                value={form.accountId}
                onChange={(e) => {
                  const a = accounts.find((acc) => acc.id === e.target.value);
                  setForm({ ...form, accountId: e.target.value, accountName: a?.name || "" });
                }}
                className="w-full h-8 px-2.5 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              >
                {accounts
                  .filter((a) => a.accountType === "EXPENSE" || a.accountType === "ASSET")
                  .map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.code} - {a.name}
                    </option>
                  ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Allocated Amount (৳) *
            </label>
            <input
              type="number"
              required
              min="1000"
              value={form.allocatedAmount || ""}
              onChange={(e) => setForm({ ...form, allocatedAmount: Number(e.target.value) || 0 })}
              className="w-full h-8 px-2.5 border border-slate-300 rounded text-xs font-bold text-slate-900 focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setIsNewOpen(false)}
              className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 bg-[#2563eb] hover:bg-blue-700 text-white font-semibold text-xs rounded transition"
            >
              Allocate Budget
            </button>
          </div>
        </form>
      </ModalDialog>

      {/* Revise Budget Modal */}
      <ModalDialog
        isOpen={!!revisionTarget}
        onClose={() => setRevisionTarget(null)}
        title="Revise Budget Allocation Ceiling"
        maxWidth="md"
      >
        {revisionTarget && (
          <div className="space-y-3 text-xs">
            <div className="rounded bg-slate-50 border border-slate-200 p-2.5">
              <div className="font-semibold text-slate-900">{revisionTarget.budgetName}</div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                Current limit: ৳{revisionTarget.allocatedAmount.toLocaleString()} • Spent: ৳
                {revisionTarget.utilizedAmount.toLocaleString()}
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1">
                New Allocated Ceiling (৳) *
              </label>
              <input
                type="number"
                min={revisionTarget.utilizedAmount}
                value={newRevisionAmount || ""}
                onChange={(e) => setNewRevisionAmount(Number(e.target.value) || 0)}
                className="w-full h-8 px-2.5 border border-slate-300 rounded text-xs font-bold text-slate-900 focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">
                Must be at least ৳{revisionTarget.utilizedAmount.toLocaleString()} (already utilized amount).
              </span>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setRevisionTarget(null)}
                className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveRevision}
                className="px-4 py-1.5 bg-[#2563eb] hover:bg-blue-700 text-white font-semibold text-xs rounded transition"
              >
                Save Revision
              </button>
            </div>
          </div>
        )}
      </ModalDialog>
    </div>
  );
}
