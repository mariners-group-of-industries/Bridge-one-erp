"use client";

import React, { useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Edit2,
  Eye,
  FileSpreadsheet,
  Inbox,
  Pencil,
  Plus,
  Printer,
  Search,
  Trash2,
} from "lucide-react";
import { ModalDialog } from "@/components/purchase/ModalDialog";
import { useAccountingStore } from "@/features/accounts/store/accounting-store";
import type { CostCenterItem } from "@/features/accounts/types";

export default function CenterSetupPage() {
  const costCenters = useAccountingStore((s) => s.costCenters);
  const addCostCenter = useAccountingStore((s) => s.addCostCenter);

  // Filters from screenshot
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedOffice, setSelectedOffice] = useState("All");
  const [selectedCenterType, setSelectedCenterType] = useState("");
  const [fromDate, setFromDate] = useState("2026-09-11");
  const [toDate, setToDate] = useState("2026-10-12");

  // Submitted filter state (triggered on "View" button click)
  const [appliedFilters, setAppliedFilters] = useState({
    office: "All",
    centerType: "",
    fromDate: "2026-09-11",
    toDate: "2026-10-12",
  });

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // Modal dialog states
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<CostCenterItem | null>(null);
  const [viewTarget, setViewTarget] = useState<CostCenterItem | null>(null);

  // Create Form State
  const [createForm, setCreateForm] = useState({
    code: "",
    name: "",
    type: "Cost Center" as CostCenterItem["type"] | string,
    officeId: "office-mbbl",
    officeName: "MBBL-HO",
    description: "",
    effectiveDate: "2026-09-11",
    status: "ACTIVE" as const,
    createdBy: "Md. Tanvir Hossain",
  });

  const handleApplyFilter = () => {
    setAppliedFilters({
      office: selectedOffice,
      centerType: selectedCenterType,
      fromDate,
      toDate,
    });
    setCurrentPage(1);
  };

  // Filtered List
  const filteredCenters = useMemo(() => {
    return costCenters.filter((c) => {
      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        c.code.toLowerCase().includes(q) ||
        c.name.toLowerCase().includes(q) ||
        c.officeName.toLowerCase().includes(q) ||
        (c.description && c.description.toLowerCase().includes(q));

      const matchOffice =
        appliedFilters.office === "All" ||
        c.officeName.toLowerCase().includes(appliedFilters.office.toLowerCase());

      const matchType =
        !appliedFilters.centerType ||
        c.type.toLowerCase() === appliedFilters.centerType.toLowerCase();

      return matchSearch && matchOffice && matchType;
    });
  }, [costCenters, searchQuery, appliedFilters]);

  // Paginated List
  const paginatedCenters = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage;
    return filteredCenters.slice(start, start + rowsPerPage);
  }, [filteredCenters, currentPage, rowsPerPage]);

  const totalPages = Math.max(1, Math.ceil(filteredCenters.length / rowsPerPage));

  const handleSaveCenter = (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.code.trim() || !createForm.name.trim()) return;

    addCostCenter({
      code: createForm.code.trim().toUpperCase(),
      name: createForm.name.trim(),
      type: createForm.type as any,
      officeId: createForm.officeId,
      officeName: createForm.officeName,
      description: createForm.description,
      effectiveDate: createForm.effectiveDate,
      status: "ACTIVE",
    });

    setIsCreateOpen(false);
    setCreateForm({
      code: "",
      name: "",
      type: "Cost Center",
      officeId: "office-mbbl",
      officeName: "MBBL-HO",
      description: "",
      effectiveDate: "2026-09-11",
      status: "ACTIVE",
      createdBy: "Md. Tanvir Hossain",
    });
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-800 font-sans pb-16">
      {/* ------------------------------------------------------------- */}
      {/* 1. TOP TAB BAR & ACTION BUTTONS */}
      {/* ------------------------------------------------------------- */}
      <div className="bg-white border-b border-slate-200">
        <div className="px-4 py-2.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          {/* Active Tab */}
          <div className="flex items-center">
            <div className="relative pb-2 pt-1 px-4 text-[13px] font-semibold text-[#2563eb] cursor-pointer">
              Center Setup
              <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#2563eb]" />
            </div>
          </div>

          {/* Search Bar & + Center Setup Button */}
          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-60">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Search center..."
                className="w-full h-8 pl-8 pr-3 text-xs border border-slate-300 rounded bg-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-[#2563eb] focus:border-[#2563eb] shadow-2xs"
              />
            </div>

            <button
              type="button"
              onClick={() => setIsCreateOpen(true)}
              className="h-8 px-3.5 bg-[#2563eb] hover:bg-blue-700 text-white font-medium text-xs rounded flex items-center gap-1.5 shadow-2xs transition whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>Center Setup</span>
            </button>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 2. FILTER BAR (OFFICE, CENTER TYPE, FROM DATE, TO DATE, VIEW) */}
      {/* ------------------------------------------------------------- */}
      <div className="px-4 py-3 bg-white border-b border-slate-200/90 shadow-2xs">
        <div className="flex flex-wrap items-end gap-3 text-xs">
          {/* Office */}
          <div className="w-44">
            <label className="block text-[11px] font-semibold text-slate-700 mb-1">Office</label>
            <div className="relative">
              <select
                value={selectedOffice}
                onChange={(e) => setSelectedOffice(e.target.value)}
                className="w-full h-8 px-2.5 pr-7 border border-slate-300 rounded text-xs bg-white text-slate-800 appearance-none focus:outline-none focus:ring-1 focus:ring-[#2563eb]"
              >
                <option value="All">All</option>
                <option value="MBBL-HO">MBBL-HO</option>
                <option value="MG Sirajganj Factory">MG Sirajganj Factory</option>
                <option value="Dhaka Corporate HQ">Dhaka Corporate HQ</option>
                <option value="Chattogram Port Depot">Chattogram Port Depot</option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {/* Center Type */}
          <div className="w-44">
            <label className="block text-[11px] font-semibold text-slate-700 mb-1">Center Type</label>
            <div className="relative">
              <select
                value={selectedCenterType}
                onChange={(e) => setSelectedCenterType(e.target.value)}
                className="w-full h-8 px-2.5 pr-7 border border-slate-300 rounded text-xs bg-white text-slate-800 appearance-none focus:outline-none focus:ring-1 focus:ring-[#2563eb]"
              >
                <option value="">Select Center Type</option>
                <option value="Cost Center">Cost Center</option>
                <option value="Profit Center">Profit Center</option>
                <option value="DEPARTMENT">Department</option>
                <option value="PROJECT">Project</option>
                <option value="BRANCH">Branch</option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {/* From Date */}
          <div className="w-36">
            <label className="block text-[11px] font-semibold text-slate-700 mb-1">From Date</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-full h-8 px-2.5 border border-slate-300 rounded text-xs bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#2563eb]"
            />
          </div>

          {/* To Date */}
          <div className="w-36">
            <label className="block text-[11px] font-semibold text-slate-700 mb-1">To Date</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="w-full h-8 px-2.5 border border-slate-300 rounded text-xs bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#2563eb]"
            />
          </div>

          {/* View Button */}
          <div>
            <button
              type="button"
              onClick={handleApplyFilter}
              className="h-8 px-5 bg-[#2563eb] hover:bg-blue-700 text-white font-medium text-xs rounded transition shadow-2xs"
            >
              View
            </button>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 3. MAIN DATA TABLE */}
      {/* ------------------------------------------------------------- */}
      <div className="px-4 mt-3">
        <div className="bg-white border border-slate-200 rounded shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              {/* Table Head */}
              <thead>
                <tr className="bg-[#f8fafc] border-b border-slate-200 text-[11px] font-semibold text-slate-700">
                  <th className="w-12 px-2.5 py-2.5 text-center border-r border-slate-200">SL</th>
                  <th className="w-20 px-3 py-2.5 text-center border-r border-slate-200">Action</th>
                  <th className="px-3.5 py-2.5 border-r border-slate-200">Create Date</th>
                  <th className="px-3.5 py-2.5 border-r border-slate-200">Office Name</th>
                  <th className="px-3.5 py-2.5 border-r border-slate-200">Type</th>
                  <th className="px-3.5 py-2.5 border-r border-slate-200">Center Code</th>
                  <th className="px-3.5 py-2.5 border-r border-slate-200">Center Name</th>
                  <th className="px-3.5 py-2.5 border-r border-slate-200">Description</th>
                  <th className="px-3.5 py-2.5">Created By</th>
                </tr>
              </thead>

              {/* Table Body */}
              <tbody className="divide-y divide-slate-100">
                {paginatedCenters.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-20 text-center">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <div className="w-12 h-10 rounded border border-dashed border-slate-300 flex items-center justify-center bg-slate-50 text-slate-300">
                          <Inbox className="w-5 h-5 stroke-[1.5]" />
                        </div>
                        <span className="text-xs text-slate-400 font-medium">No data</span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  paginatedCenters.map((c, idx) => {
                    const sl = (currentPage - 1) * rowsPerPage + idx + 1;
                    return (
                      <tr key={c.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-2.5 py-2.5 text-center border-r border-slate-200/80 text-slate-700 font-medium">
                          {sl}
                        </td>
                        <td className="px-3 py-2.5 border-r border-slate-200/80">
                          <div className="flex items-center justify-center gap-1.5 text-slate-500">
                            <button
                              type="button"
                              onClick={() => setEditTarget(c)}
                              className="p-1 hover:text-[#2563eb] rounded transition"
                              title="Edit Center"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setViewTarget(c)}
                              className="p-1 hover:text-[#2563eb] rounded transition"
                              title="View Details"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                        <td className="px-3.5 py-2.5 border-r border-slate-200/80 text-slate-700 whitespace-nowrap">
                          {c.effectiveDate || "11/09/2026"}
                        </td>
                        <td className="px-3.5 py-2.5 border-r border-slate-200/80 font-medium text-slate-800">
                          {c.officeName}
                        </td>
                        <td className="px-3.5 py-2.5 border-r border-slate-200/80 text-slate-700">
                          {c.type}
                        </td>
                        <td className="px-3.5 py-2.5 border-r border-slate-200/80 font-mono font-semibold text-blue-600">
                          {c.code}
                        </td>
                        <td className="px-3.5 py-2.5 border-r border-slate-200/80 font-medium text-slate-900">
                          {c.name}
                        </td>
                        <td className="px-3.5 py-2.5 border-r border-slate-200/80 text-slate-500 text-[11px]">
                          {c.description || "—"}
                        </td>
                        <td className="px-3.5 py-2.5 text-slate-600 text-[11px]">
                          Md. Tanvir Hossain
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* ------------------------------------------------------------- */}
          {/* 4. FOOTER PAGINATION */}
          {/* ------------------------------------------------------------- */}
          <div className="px-4 py-2.5 border-t border-slate-200 bg-white flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
            {/* Rows info */}
            <div className="flex items-center gap-4">
              <span>
                Showing{" "}
                <span className="font-semibold text-slate-800">
                  {filteredCenters.length === 0
                    ? "0–0"
                    : `${(currentPage - 1) * rowsPerPage + 1}–${Math.min(
                        currentPage * rowsPerPage,
                        filteredCenters.length,
                      )}`}
                </span>{" "}
                of <span className="font-semibold text-slate-800">{filteredCenters.length}</span> Rows
              </span>

              <div className="flex items-center gap-1.5">
                <span className="text-slate-500 text-[11px]">Rows</span>
                <select
                  value={rowsPerPage}
                  onChange={(e) => {
                    setRowsPerPage(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="h-6 px-1.5 border border-slate-300 rounded text-xs bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#2563eb]"
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>
            </div>

            {/* Pagination buttons */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
                className="w-7 h-7 flex items-center justify-center border border-slate-200 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none transition"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>

              {Array.from({ length: totalPages }).map((_, i) => {
                const pageNum = i + 1;
                const isActive = pageNum === currentPage;
                return (
                  <button
                    key={pageNum}
                    type="button"
                    onClick={() => setCurrentPage(pageNum)}
                    className={`w-7 h-7 flex items-center justify-center rounded text-xs font-semibold transition ${
                      isActive
                        ? "bg-[#2563eb] text-white shadow-2xs"
                        : "border border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}

              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
                className="w-7 h-7 flex items-center justify-center border border-slate-200 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none transition"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 5. MODALS */}
      {/* ------------------------------------------------------------- */}

      {/* Create Center Setup Modal */}
      <ModalDialog
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="New Center Setup"
        subtitle="Configure cost center or analytical dimension"
        maxWidth="lg"
      >
        <form onSubmit={handleSaveCenter} className="space-y-3.5 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Office Location *
              </label>
              <select
                value={createForm.officeName}
                onChange={(e) =>
                  setCreateForm({
                    ...createForm,
                    officeName: e.target.value,
                    officeId: e.target.value === "MBBL-HO" ? "office-mbbl" : "office-main",
                  })
                }
                className="w-full h-8 px-2.5 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-[#2563eb]"
              >
                <option value="MBBL-HO">MBBL-HO</option>
                <option value="MG Sirajganj Factory">MG Sirajganj Factory</option>
                <option value="Dhaka Corporate HQ">Dhaka Corporate HQ</option>
                <option value="Chattogram Port Depot">Chattogram Port Depot</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Center Type *
              </label>
              <select
                value={createForm.type}
                onChange={(e) => setCreateForm({ ...createForm, type: e.target.value })}
                className="w-full h-8 px-2.5 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-[#2563eb]"
              >
                <option value="Cost Center">Cost Center</option>
                <option value="Profit Center">Profit Center</option>
                <option value="DEPARTMENT">Department</option>
                <option value="PROJECT">Project</option>
                <option value="BRANCH">Branch</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Center Code *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. CC-MBBL-001"
                value={createForm.code}
                onChange={(e) => setCreateForm({ ...createForm, code: e.target.value })}
                className="w-full h-8 px-2.5 border border-slate-300 rounded text-xs font-mono uppercase focus:ring-1 focus:ring-[#2563eb]"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Center Name *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Raw Material Processing Unit"
                value={createForm.name}
                onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                className="w-full h-8 px-2.5 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-[#2563eb]"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-700 mb-1">
              Description / Purpose
            </label>
            <input
              type="text"
              placeholder="e.g. Dedicated production overhead allocation center"
              value={createForm.description}
              onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
              className="w-full h-8 px-2.5 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-[#2563eb]"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-700 mb-1">
              Effective Date
            </label>
            <input
              type="date"
              value={createForm.effectiveDate}
              onChange={(e) => setCreateForm({ ...createForm, effectiveDate: e.target.value })}
              className="w-full h-8 px-2.5 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-[#2563eb]"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setIsCreateOpen(false)}
              className="px-3.5 py-1.5 text-xs text-slate-600 hover:text-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 bg-[#2563eb] hover:bg-blue-700 text-white font-semibold text-xs rounded transition shadow-2xs"
            >
              Save Center Setup
            </button>
          </div>
        </form>
      </ModalDialog>
    </div>
  );
}
