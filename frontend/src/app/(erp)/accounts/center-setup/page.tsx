"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  Building,
  CheckCircle2,
  ChevronRight,
  CreditCard,
  Download,
  Filter,
  Layers,
  Plus,
  Printer,
  Search,
} from "lucide-react";
import { SummaryCard } from "@/components/purchase/SummaryCard";
import { ModalDialog } from "@/components/purchase/ModalDialog";
import { useAccountingStore } from "@/features/accounts/store/accounting-store";
import type { CostCenterItem } from "@/features/accounts/types";

export default function CenterSetupPage() {
  const costCenters = useAccountingStore((s) => s.costCenters);
  const addCostCenter = useAccountingStore((s) => s.addCostCenter);

  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<string>("ALL");

  const [isOpen, setIsOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const [form, setForm] = useState({
    code: "",
    name: "",
    type: "DEPARTMENT" as CostCenterItem["type"],
    officeId: "office-main",
    officeName: "Dhaka Corporate HQ",
    description: "",
    effectiveDate: new Date().toISOString().split("T")[0],
    status: "ACTIVE" as const,
  });

  const filteredCenters = useMemo(() => {
    return costCenters.filter((c) => {
      const matchSearch =
        c.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.officeName.toLowerCase().includes(searchQuery.toLowerCase());
      const matchType = filterType === "ALL" ? true : c.type === filterType;
      return matchSearch && matchType;
    });
  }, [costCenters, searchQuery, filterType]);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");

    if (!form.code.trim() || !form.name.trim()) {
      setErrorMessage("Center code and title are required.");
      return;
    }

    const exists = costCenters.some((c) => c.code.toLowerCase() === form.code.trim().toLowerCase());
    if (exists) {
      setErrorMessage(`Center code "${form.code}" already exists.`);
      return;
    }

    addCostCenter({
      ...form,
      code: form.code.trim().toUpperCase(),
      name: form.name.trim(),
    });

    setIsOpen(false);
    setForm({
      code: "",
      name: "",
      type: "DEPARTMENT",
      officeId: "office-main",
      officeName: "Dhaka Corporate HQ",
      description: "",
      effectiveDate: new Date().toISOString().split("T")[0],
      status: "ACTIVE",
    });
  };

  const handleExportCSV = () => {
    const headers = "Code,Name,Type,Office Location,Effective Date,Description,Status\n";
    const rows = filteredCenters
      .map((c) => `"${c.code}","${c.name}","${c.type}","${c.officeName}","${c.effectiveDate}","${c.description}","${c.status}"`)
      .join("\n");
    const blob = new Blob([headers + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `cost_centers_${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const departmentCount = useMemo(() => costCenters.filter((c) => c.type === "DEPARTMENT").length, [costCenters]);
  const projectCount = useMemo(() => costCenters.filter((c) => c.type === "PROJECT").length, [costCenters]);
  const branchCount = useMemo(() => costCenters.filter((c) => c.type === "BRANCH").length, [costCenters]);

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
            <span className="text-slate-600 font-medium">Center Setup</span>
          </nav>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Cost Center & Analytical Dimension Setup</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Configure departmental cost centers, revenue units, project codes, and branch analytical dimensions
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search code, name, office..."
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
              setIsOpen(true);
            }}
            className="h-9 px-4 bg-[#2563eb] hover:bg-blue-700 text-white font-semibold text-xs rounded flex items-center gap-1.5 shadow-xs transition"
          >
            <Plus className="w-4 h-4" />
            <span>Create Cost Center</span>
          </button>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 2. SUMMARY KPI CARDS */}
      {/* ------------------------------------------------------------- */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <SummaryCard
          title="Total Cost Centers"
          value={costCenters.length}
          subtitle="Analytical profit & cost units"
          icon={Layers}
          variant="info"
        />
        <SummaryCard
          title="Departments"
          value={departmentCount}
          subtitle="Corporate functional divisions"
          icon={Building}
          variant="info"
        />
        <SummaryCard
          title="Project Dimensions"
          value={projectCount}
          subtitle="Capital / operational projects"
          icon={CreditCard}
          variant="warning"
        />
        <SummaryCard
          title="Active Branch Units"
          value={branchCount}
          subtitle="Regional offices & factory plants"
          icon={CheckCircle2}
          variant="success"
        />
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 3. TABS NAVIGATION */}
      {/* ------------------------------------------------------------- */}
      <div className="bg-white rounded border border-slate-200/90 shadow-2xs">
        <div className="flex items-center gap-1 px-3 border-b border-slate-200 overflow-x-auto text-xs font-medium">
          {[
            { id: "ALL", label: `ALL CENTERS (${costCenters.length})` },
            { id: "DEPARTMENT", label: `DEPARTMENTS (${departmentCount})` },
            { id: "PROJECT", label: `PROJECTS (${projectCount})` },
            { id: "BRANCH", label: `BRANCHES (${branchCount})` },
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
                <th className="px-3.5 py-2.5">Center Code</th>
                <th className="px-3.5 py-2.5">Center Name</th>
                <th className="px-3.5 py-2.5">Dimension Type</th>
                <th className="px-3.5 py-2.5">Office / Location</th>
                <th className="px-3.5 py-2.5">Effective Date</th>
                <th className="px-3.5 py-2.5">Description</th>
                <th className="px-3.5 py-2.5 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredCenters.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    No cost centers found matching your filter.
                  </td>
                </tr>
              ) : (
                filteredCenters.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/70 transition">
                    <td className="px-3.5 py-2.5 font-mono font-semibold text-blue-600">{c.code}</td>
                    <td className="px-3.5 py-2.5 font-bold text-slate-900">{c.name}</td>
                    <td className="px-3.5 py-2.5">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
                        {c.type}
                      </span>
                    </td>
                    <td className="px-3.5 py-2.5 font-medium text-slate-700">{c.officeName}</td>
                    <td className="px-3.5 py-2.5 text-slate-500">{c.effectiveDate}</td>
                    <td className="px-3.5 py-2.5 text-slate-500 max-w-sm truncate" title={c.description}>
                      {c.description || "—"}
                    </td>
                    <td className="px-3.5 py-2.5 text-center">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        {c.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 5. MODAL */}
      {/* ------------------------------------------------------------- */}
      <ModalDialog
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title="Create New Cost Center / Project Unit"
        maxWidth="lg"
      >
        {errorMessage && (
          <div className="flex items-center gap-2 rounded bg-rose-50 border border-rose-200 p-2 text-xs font-medium text-rose-700 mb-3">
            <AlertCircle className="w-4 h-4 shrink-0" /> {errorMessage}
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-3 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Center Code *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. CC-HR"
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                className="w-full h-8 px-2.5 border border-slate-300 rounded text-xs font-mono font-semibold uppercase focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Dimension Type *
              </label>
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value as any })}
                className="w-full h-8 px-2.5 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="DEPARTMENT">Department</option>
                <option value="PROJECT">Project</option>
                <option value="BRANCH">Branch</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Center Title / Description *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Human Resources & Talent Development"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full h-8 px-2.5 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Office / Location *
              </label>
              <select
                value={form.officeId}
                onChange={(e) =>
                  setForm({
                    ...form,
                    officeId: e.target.value,
                    officeName: e.target.value === "office-main" ? "Dhaka Corporate HQ" : "Chittagong Heavy Plant",
                  })
                }
                className="w-full h-8 px-2.5 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="office-main">Dhaka Corporate HQ</option>
                <option value="office-ctg">Chittagong Heavy Plant</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Effective Date *
              </label>
              <input
                type="date"
                required
                value={form.effectiveDate}
                onChange={(e) => setForm({ ...form, effectiveDate: e.target.value })}
                className="w-full h-8 px-2.5 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Operational Scope / Notes
            </label>
            <textarea
              rows={2}
              placeholder="Analytical allocation rules and management notes..."
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full p-2 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 bg-[#2563eb] hover:bg-blue-700 text-white font-semibold text-xs rounded transition"
            >
              Create Center
            </button>
          </div>
        </form>
      </ModalDialog>
    </div>
  );
}
