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
  Inbox,
  Pencil,
  Plus,
  Search,
  Upload,
} from "lucide-react";
import { ModalDialog } from "@/components/purchase/ModalDialog";
import { useAccountingStore } from "@/features/accounts/store/accounting-store";
import { BulkUploadDialog } from "@/features/configuration/entity-master-data/components/BulkUploadDialog";
import { uploadAccountImport } from "@/features/accounts/lib/bulk-import-client";
import type { CostCenterItem } from "@/features/accounts/types";
import { localToday } from "@/features/purchase/lib/client";
import { useFeaturePermissions, needsPermission } from "@/lib/permissions/useFeaturePermissions";

export default function CenterSetupPage() {
  const perms = useFeaturePermissions("/accounts/center-setup");
  const { pending, run } = usePending();
  const costCenters = useAccountingStore((s) => s.costCenters);
  const addCostCenter = useAccountingStore((s) => s.addCostCenter);
  const updateCostCenter = useAccountingStore((s) => s.updateCostCenter);
  const offices = useAccountingStore((s) => s.offices);

  // Filters from screenshot
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedOffice, setSelectedOffice] = useState("All");
  const [selectedCenterType, setSelectedCenterType] = useState("");
  // No date limit until the user picks one.
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  // Submitted filter state (triggered on "View" button click)
  const [appliedFilters, setAppliedFilters] = useState({
    office: "All",
    centerType: "",
    fromDate: "",
    toDate: "",
  });

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // Modal dialog states
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [isCardCollapsed, setIsCardCollapsed] = useState(false);
  // The center being edited in the form; null when creating a new one.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [viewTarget, setViewTarget] = useState<CostCenterItem | null>(null);

  // Create Form State
  const [createForm, setCreateForm] = useState({
    code: "",
    name: "",
    type: "Cost Center" as CostCenterItem["type"] | string,
    officeId: "",
    description: "",
    effectiveDate: localToday(),
    status: "ACTIVE" as const,
  });
  // The first office until the user picks one.
  const formOffice = offices.find((o) => o.id === createForm.officeId) ?? offices[0];

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

      const matchOffice = appliedFilters.office === "All" || c.officeId === appliedFilters.office;

      const day = (c.createdAt || "").slice(0, 10);
      const matchDate = (!appliedFilters.fromDate || day >= appliedFilters.fromDate) && (!appliedFilters.toDate || day <= appliedFilters.toDate);

      const matchType =
        !appliedFilters.centerType ||
        c.type.toLowerCase() === appliedFilters.centerType.toLowerCase();

      return matchSearch && matchOffice && matchType && matchDate;
    });
  }, [costCenters, searchQuery, appliedFilters]);

  // Paginated List
  const paginatedCenters = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage;
    return filteredCenters.slice(start, start + rowsPerPage);
  }, [filteredCenters, currentPage, rowsPerPage]);

  const totalPages = Math.max(1, Math.ceil(filteredCenters.length / rowsPerPage));

  const handleSaveCenter = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!createForm.name.trim() || !formOffice) return;

    const generatedCode = createForm.code.trim() || `CC-${createForm.name.slice(0, 3).toUpperCase()}-${Math.floor(100 + Math.random() * 900)}`;

    const values = {
      code: generatedCode.toUpperCase(),
      name: createForm.name.trim(),
      type: createForm.type as CostCenterItem["type"],
      officeId: formOffice.id,
      officeName: formOffice.name,
      description: createForm.description,
      effectiveDate: createForm.effectiveDate,
    };
    const save = () => (editingId ? updateCostCenter(editingId, { ...values, status: createForm.status }) : addCostCenter({ ...values, status: "ACTIVE" }));
    const ok = await run("center", () => save());
    if (!ok) return;
    toast.success("Center saved.");

    setIsCreateOpen(false);
    setEditingId(null);
    setCreateForm({
      code: "",
      name: "",
      type: "Cost Center",
      officeId: "",
      description: "",
      effectiveDate: localToday(),
      status: "ACTIVE",
    });
  };

  const openEdit = (c: CostCenterItem) => {
    setEditingId(c.id);
    setCreateForm({
      code: c.code,
      name: c.name,
      type: c.type,
      officeId: c.officeId,
      description: c.description ?? "",
      effectiveDate: (c.effectiveDate || "").slice(0, 10) || localToday(),
      status: c.status as "ACTIVE",
    });
    setIsCreateOpen(true);
  };
  const closeForm = () => {
    setIsCreateOpen(false);
    setEditingId(null);
  };

  // -------------------------------------------------------------
  // FULL-PAGE MANAGERIUM VIEW: Create Center Setup
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
              onClick={closeForm}
              className="h-8 w-8 rounded border border-slate-300 flex items-center justify-center text-slate-600 hover:bg-slate-50 transition"
              title="Back"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <h1 className="text-base font-bold text-slate-900 tracking-tight">
              {editingId ? "Edit Center Setup" : "Create Center Setup"}
            </h1>
          </div>
          <button
            type="button"
            disabled={pending === "center"}
            onClick={() => handleSaveCenter()}
            className="h-8 px-5 bg-[#2563eb] hover:bg-blue-700 text-white font-semibold text-xs rounded transition flex items-center gap-1.5 shadow-2xs disabled:opacity-50"
          >
            {pending === "center" && <Spinner className="size-3.5" />}
            Save
          </button>
        </div>

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
            <div className="p-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    <span className="text-red-500 font-bold mr-0.5">*</span>Create Date
                  </label>
                  <input
                    type="date"
                    required
                    value={createForm.effectiveDate}
                    onChange={(e) => setCreateForm({ ...createForm, effectiveDate: e.target.value })}
                    className={inputCls}
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    <span className="text-red-500 font-bold mr-0.5">*</span>Office
                  </label>
                  <select
                    value={formOffice?.id ?? ""}
                    onChange={(e) => setCreateForm({ ...createForm, officeId: e.target.value })}
                    className={inputCls}
                  >
                    <option value="">Select Office</option>
                    {offices.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    <span className="text-red-500 font-bold mr-0.5">*</span>Center Type
                  </label>
                  <select
                    value={createForm.type}
                    onChange={(e) => setCreateForm({ ...createForm, type: e.target.value })}
                    className={inputCls}
                  >
                    <option value="">Select Center Type</option>
                    <option value="Cost Center">Cost Center</option>
                    <option value="Profit Center">Profit Center</option>
                    <option value="DEPARTMENT">Department</option>
                    <option value="PROJECT">Project</option>
                    <option value="BRANCH">Branch</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    <span className="text-red-500 font-bold mr-0.5">*</span>Center Name
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Center Name"
                    value={createForm.name}
                    onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                    className={inputCls}
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    Description
                  </label>
                  <input
                    type="text"
                    placeholder="Write Description"
                    value={createForm.description}
                    onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                    className={inputCls}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-canvas text-ink font-sans flex flex-col md:h-[calc(100dvh-3.5rem)] md:overflow-hidden print:block print:h-auto print:overflow-visible">
      {/* ------------------------------------------------------------- */}
      {/* 1. TOP TAB BAR & ACTION BUTTONS */}
      {/* ------------------------------------------------------------- */}
      <div className="bg-surface border-b border-line shrink-0">
        <div className="px-4 py-2.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          {/* Active Tab */}
          <div className="flex items-center">
            <div className="relative pb-2 pt-1 px-4 text-[13px] font-semibold text-primary cursor-pointer">
              Center Setup
              <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#2563eb]" />
            </div>
          </div>

          {/* Search Bar & + Center Setup Button */}
          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-60">
              <Search className="w-3.5 h-3.5 text-ink-faint absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Search center..."
                className="w-full h-8 pl-8 pr-3 text-xs border border-line-strong rounded bg-surface placeholder:text-ink-faint focus:outline-none focus:ring-1 focus:ring-[#2563eb] focus:border-[#2563eb] shadow-2xs"
              />
            </div>

            {perms.import && (<button
              type="button"
              onClick={() => setBulkOpen(true)}
              className="h-8 px-3 border border-line-strong rounded text-ink-muted hover:bg-canvas font-medium text-xs flex items-center gap-1.5 transition whitespace-nowrap"
              title="Bulk upload cost centers from an Excel file"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Bulk Upload</span>
            </button>)}
            {perms.create && (<button
              type="button"
              onClick={() => setIsCreateOpen(true)}
              className="h-8 px-3.5 bg-[#2563eb] hover:bg-blue-700 text-white font-medium text-xs rounded flex items-center gap-1.5 shadow-2xs transition whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>Center Setup</span>
            </button>)}
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 2. FILTER BAR (OFFICE, CENTER TYPE, FROM DATE, TO DATE, VIEW) */}
      {/* ------------------------------------------------------------- */}
      <div className="px-4 py-3 bg-surface border-b border-line/90 shadow-2xs shrink-0">
        <div className="flex flex-wrap items-end gap-3 text-xs">
          {/* Office */}
          <div className="w-44">
            <label className="block text-[11px] font-semibold text-ink-muted mb-1">Office</label>
            <div className="relative">
              <select
                value={selectedOffice}
                onChange={(e) => setSelectedOffice(e.target.value)}
                className="w-full h-8 px-2.5 pr-7 border border-line-strong rounded text-xs bg-surface text-ink appearance-none focus:outline-none focus:ring-1 focus:ring-[#2563eb]"
              >
                <option value="All">All</option>
                {offices.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-ink-faint absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {/* Center Type */}
          <div className="w-44">
            <label className="block text-[11px] font-semibold text-ink-muted mb-1">Center Type</label>
            <div className="relative">
              <select
                value={selectedCenterType}
                onChange={(e) => setSelectedCenterType(e.target.value)}
                className="w-full h-8 px-2.5 pr-7 border border-line-strong rounded text-xs bg-surface text-ink appearance-none focus:outline-none focus:ring-1 focus:ring-[#2563eb]"
              >
                <option value="">Select Center Type</option>
                <option value="Cost Center">Cost Center</option>
                <option value="Profit Center">Profit Center</option>
                <option value="DEPARTMENT">Department</option>
                <option value="PROJECT">Project</option>
                <option value="BRANCH">Branch</option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-ink-faint absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {/* From Date */}
          <div className="w-36">
            <label className="block text-[11px] font-semibold text-ink-muted mb-1">From Date</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-full h-8 px-2.5 border border-line-strong rounded text-xs bg-surface text-ink focus:outline-none focus:ring-1 focus:ring-[#2563eb]"
            />
          </div>

          {/* To Date */}
          <div className="w-36">
            <label className="block text-[11px] font-semibold text-ink-muted mb-1">To Date</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="w-full h-8 px-2.5 border border-line-strong rounded text-xs bg-surface text-ink focus:outline-none focus:ring-1 focus:ring-[#2563eb]"
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
      <div className="px-4 mt-3 flex-1 min-h-0 flex flex-col print:block">
        <div className="bg-surface border border-line rounded shadow-2xs overflow-hidden flex-1 min-h-0 flex flex-col print:block">
          <div className="flex-1 min-h-0 overflow-auto print:overflow-visible [&_thead]:sticky [&_thead]:top-0 [&_thead]:z-10">
            <table className="w-full text-left text-xs border-collapse">
              {/* Table Head */}
              <thead>
                <tr className="bg-canvas border-b border-line text-[11px] font-semibold text-ink-muted">
                  <th className="w-12 px-2.5 py-2.5 text-center border-r border-line">SL</th>
                  <th className="w-20 px-3 py-2.5 text-center border-r border-line">Action</th>
                  <th className="px-3.5 py-2.5 border-r border-line">Create Date</th>
                  <th className="px-3.5 py-2.5 border-r border-line">Office Name</th>
                  <th className="px-3.5 py-2.5 border-r border-line">Type</th>
                  <th className="px-3.5 py-2.5 border-r border-line">Center Code</th>
                  <th className="px-3.5 py-2.5 border-r border-line">Center Name</th>
                  <th className="px-3.5 py-2.5 border-r border-line">Description</th>
                  <th className="px-3.5 py-2.5">Created By</th>
                </tr>
              </thead>

              {/* Table Body */}
              <tbody className="divide-y divide-line">
                {paginatedCenters.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-20 text-center">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <div className="w-12 h-10 rounded border border-dashed border-line-strong flex items-center justify-center bg-canvas text-slate-300">
                          <Inbox className="w-5 h-5 stroke-[1.5]" />
                        </div>
                        <span className="text-xs text-ink-faint font-medium">No data</span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  paginatedCenters.map((c, idx) => {
                    const sl = (currentPage - 1) * rowsPerPage + idx + 1;
                    return (
                      <tr key={c.id} className="hover:bg-canvas/80 transition-colors">
                        <td className="px-2.5 py-2.5 text-center border-r border-line/80 text-ink-muted font-medium">
                          {sl}
                        </td>
                        <td className="px-3 py-2.5 border-r border-line/80">
                          <div className="row-actions flex items-center justify-center gap-1.5 text-ink-faint">
                            <button disabled={!perms.edit}
                              type="button"
                              onClick={() => openEdit(c)}
                              className="p-1 hover:text-primary rounded transition disabled:opacity-40 disabled:cursor-not-allowed"
                              title={!perms.edit ? needsPermission("edit") : "Edit Center"}
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setViewTarget(c)}
                              className="p-1 hover:text-primary rounded transition"
                              title="View Details"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                        <td className="px-3.5 py-2.5 border-r border-line/80 text-ink-muted whitespace-nowrap">
                          {(c.createdAt || c.effectiveDate || "").slice(0, 10) || "—"}
                        </td>
                        <td className="px-3.5 py-2.5 border-r border-line/80 font-medium text-ink">
                          {c.officeName}
                        </td>
                        <td className="px-3.5 py-2.5 border-r border-line/80 text-ink-muted">
                          {c.type}
                        </td>
                        <td className="px-3.5 py-2.5 border-r border-line/80 font-mono font-semibold text-blue-600 dark:text-blue-400">
                          {c.code}
                        </td>
                        <td className="px-3.5 py-2.5 border-r border-line/80 font-medium text-ink">
                          {c.name}
                        </td>
                        <td className="px-3.5 py-2.5 border-r border-line/80 text-ink-faint text-[11px]">
                          {c.description || "—"}
                        </td>
                        {/* Not recorded for cost centers yet. */}
                        <td className="px-3.5 py-2.5 text-ink-faint text-[11px]">—</td>
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
          <div className="px-4 py-2.5 border-t border-line bg-surface flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-ink-muted shrink-0">
            {/* Rows info */}
            <div className="flex items-center gap-4">
              <span>
                Showing{" "}
                <span className="font-semibold text-ink">
                  {filteredCenters.length === 0
                    ? "0–0"
                    : `${(currentPage - 1) * rowsPerPage + 1}–${Math.min(
                        currentPage * rowsPerPage,
                        filteredCenters.length,
                      )}`}
                </span>{" "}
                of <span className="font-semibold text-ink">{filteredCenters.length}</span> Rows
              </span>

              <div className="flex items-center gap-1.5">
                <span className="text-ink-faint text-[11px]">Rows</span>
                <select
                  value={rowsPerPage}
                  onChange={(e) => {
                    setRowsPerPage(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="h-6 px-1.5 border border-line-strong rounded text-xs bg-surface text-ink-muted focus:outline-none focus:ring-1 focus:ring-[#2563eb]"
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
              <button aria-label="Previous page"
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
                className="w-7 h-7 flex items-center justify-center border border-line rounded text-ink-faint hover:text-ink-muted hover:bg-canvas disabled:opacity-40 disabled:pointer-events-none transition"
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
                        : "border border-line text-ink-muted hover:bg-canvas"
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}

              <button aria-label="Next page"
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
                className="w-7 h-7 flex items-center justify-center border border-line rounded text-ink-faint hover:text-ink-muted hover:bg-canvas disabled:opacity-40 disabled:pointer-events-none transition"
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



      {/* View Center Setup */}
      <ModalDialog
        isOpen={Boolean(viewTarget)}
        onClose={() => setViewTarget(null)}
        title="Center Setup Details"
        subtitle={viewTarget ? `${viewTarget.code} · ${viewTarget.name}` : ""}
        maxWidth="md"
      >
        {viewTarget && (
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-xs">
            {[
              ["Center Code", viewTarget.code],
              ["Center Name", viewTarget.name],
              ["Type", viewTarget.type],
              ["Office", viewTarget.officeName || "—"],
              ["Effective Date", (viewTarget.effectiveDate || "").slice(0, 10) || "—"],
              ["Status", viewTarget.status],
              ["Created", (viewTarget.createdAt || "").slice(0, 10) || "—"],
            ].map(([label, value]) => (
              <div key={label}>
                <dt className="text-[11px] text-ink-faint">{label}</dt>
                <dd className="font-medium text-ink">{value}</dd>
              </div>
            ))}
            <div className="col-span-2">
              <dt className="text-[11px] text-ink-faint">Description</dt>
              <dd className="font-medium text-ink">{viewTarget.description || "—"}</dd>
            </div>
          </dl>
        )}
      </ModalDialog>
      <BulkUploadDialog
        open={bulkOpen}
        onClose={() => setBulkOpen(false)}
        onImported={() => { void useAccountingStore.getState().syncDatabase(); }}
        noun="cost centers"
        templateUrl="/api/accounts/cost-centers/import"
        maxRows={2000}
        matchHint="Center Code must be unique; Office must match an office in your access. Type: DEPARTMENT, PROJECT, BRANCH, LOCATION or OTHER."
        upload={(file) => uploadAccountImport("/api/accounts/cost-centers/import", file)}
      />
    </div>
  );
}
