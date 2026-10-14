"use client";

import React, { useState, useMemo } from "react";
import {
  Search,
  Plus,
  Printer,
  Eye,
  ChevronLeft,
  ChevronRight,
  X,
  FileSpreadsheet,
} from "lucide-react";

// ============================================================================
// TYPES
// ============================================================================
interface StockUpdateRow {
  sl: number;
  code: string;
  remarks: string;
  officeName: string;
  warehouse: string;
  createdDate: string;
  entryDate: string;
  actionBy: string;
  status: "Approved" | "Pending" | "Rejected";
  reviewComment: string;
}

// ============================================================================
// SAMPLE DATA (Directly matched to user's ERP screenshot)
// ============================================================================
const MOCK_STOCK_UPDATE_LIST: StockUpdateRow[] = [
  {
    sl: 1,
    code: "IA-MG261007024",
    remarks: "stock adjust",
    officeName: "MG Sirajganj Factory",
    warehouse: "PD Biscuit Store",
    createdDate: "07-10-2026",
    entryDate: "07-10-2026",
    actionBy: "MD. Tofajjol Hossin",
    status: "Approved",
    reviewComment: "",
  },
  {
    sl: 2,
    code: "IA-MG261007023",
    remarks: "stock adjust",
    officeName: "MG Sirajganj Factory",
    warehouse: "PD Biscuit Store",
    createdDate: "07-10-2026",
    entryDate: "07-10-2026",
    actionBy: "MD. Tofajjol Hossin",
    status: "Approved",
    reviewComment: "",
  },
  {
    sl: 3,
    code: "IA-MG261007022",
    remarks: "stock adjust",
    officeName: "MG Sirajganj Factory",
    warehouse: "PD Snacks Store",
    createdDate: "07-10-2026",
    entryDate: "07-10-2026",
    actionBy: "MD. Tofajjol Hossin",
    status: "Approved",
    reviewComment: "",
  },
  {
    sl: 4,
    code: "IA-MG260924027",
    remarks: "Stock Adjustment",
    officeName: "MG Sirajganj Factory",
    warehouse: "PD Snacks Store",
    createdDate: "24-09-2026",
    entryDate: "24-09-2026",
    actionBy: "MD. Tofajjol Hossin",
    status: "Approved",
    reviewComment: "",
  },
  {
    sl: 5,
    code: "IA-MG260920026",
    remarks: "Stock Adjust",
    officeName: "MG Sirajganj Factory",
    warehouse: "PD Biscuit Store",
    createdDate: "20-09-2026",
    entryDate: "20-09-2026",
    actionBy: "MD. Tofajjol Hossin",
    status: "Approved",
    reviewComment: "",
  },
  {
    sl: 6,
    code: "IA-MG260919025",
    remarks: "stock adjust",
    officeName: "MG Sirajganj Factory",
    warehouse: "PD Snacks Store",
    createdDate: "19-09-2026",
    entryDate: "19-09-2026",
    actionBy: "MD. Tofajjol Hossin",
    status: "Approved",
    reviewComment: "",
  },
  {
    sl: 7,
    code: "IA-MG260919024",
    remarks: "stock adjustment",
    officeName: "MG Sirajganj Factory",
    warehouse: "PD Biscuit Store",
    createdDate: "19-09-2026",
    entryDate: "19-09-2026",
    actionBy: "MD. Tofajjol Hossin",
    status: "Approved",
    reviewComment: "",
  },
  {
    sl: 8,
    code: "IA-MG260919023",
    remarks: "Adjust",
    officeName: "MG Sirajganj Factory",
    warehouse: "PD Snacks Store",
    createdDate: "19-09-2026",
    entryDate: "19-09-2026",
    actionBy: "MD. Tofajjol Hossin",
    status: "Approved",
    reviewComment: "",
  },
  {
    sl: 9,
    code: "IA-MG260913022",
    remarks: "Stock Adjustment",
    officeName: "MG Sirajganj Factory",
    warehouse: "PD Snacks Store",
    createdDate: "13-09-2026",
    entryDate: "13-09-2026",
    actionBy: "MD. Tofajjol Hossin",
    status: "Approved",
    reviewComment: "",
  },
];

const OFFICE_OPTIONS = [
  { value: "All", label: "All" },
  { value: "MG Sirajganj Factory", label: "MG Sirajganj Factory" },
  { value: "Dhaka Head Office", label: "Dhaka Head Office" },
  { value: "Marinozz", label: "Marinozz" },
  { value: "MOHS Eco", label: "MOHS Eco" },
];

const TYPE_OPTIONS = [
  { value: "All", label: "All" },
  { value: "Stock Increase", label: "Stock Increase" },
  { value: "Stock Decrease", label: "Stock Decrease" },
  { value: "Damage / Expiry", label: "Damage / Expiry" },
  { value: "Audit Reconciliation", label: "Audit Reconciliation" },
];

const STATUS_OPTIONS = [
  { value: "All", label: "All" },
  { value: "Approved", label: "Approved" },
  { value: "Pending", label: "Pending" },
  { value: "Rejected", label: "Rejected" },
];

export default function StockUpdatePage() {
  const [searchTerm, setSearchTerm] = useState("");

  // Filters matching screenshot
  const [office, setOffice] = useState("All");
  const [type, setType] = useState("All");
  const [status, setStatus] = useState("All");
  const [fromDate, setFromDate] = useState("2026-09-13");
  const [toDate, setToDate] = useState("2026-10-14");

  // Pagination
  const [rowsPerPage, setRowsPerPage] = useState(50);
  const [page, setPage] = useState(1);

  // + Create Modal State
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    office: "MG Sirajganj Factory",
    warehouse: "PD Biscuit Store",
    type: "Audit Reconciliation",
    entryDate: new Date().toISOString().slice(0, 10),
    remarks: "",
  });

  // Filtered rows
  const filteredRows = useMemo(() => {
    return MOCK_STOCK_UPDATE_LIST.filter((row) => {
      if (office !== "All" && row.officeName !== office) return false;
      if (status !== "All" && row.status !== status) return false;
      if (searchTerm) {
        const s = searchTerm.toLowerCase();
        return (
          row.code.toLowerCase().includes(s) ||
          row.remarks.toLowerCase().includes(s) ||
          row.warehouse.toLowerCase().includes(s) ||
          row.actionBy.toLowerCase().includes(s)
        );
      }
      return true;
    });
  }, [office, status, searchTerm]);

  const totalPages = Math.ceil(filteredRows.length / rowsPerPage) || 1;
  const paginatedRows = useMemo(() => {
    const start = (page - 1) * rowsPerPage;
    return filteredRows.slice(start, start + rowsPerPage);
  }, [filteredRows, page, rowsPerPage]);

  // Export CSV / Excel
  const handleExportCSV = () => {
    const headers = [
      "SL",
      "Code",
      "Remarks",
      "Office Name",
      "Warehouse",
      "Created Date",
      "Entry Date",
      "Action By",
      "Status",
      "Review Comment",
    ];
    const rows = filteredRows.map((r) => [
      r.sl,
      r.code,
      `"${r.remarks.replace(/"/g, '""')}"`,
      `"${r.officeName}"`,
      `"${r.warehouse}"`,
      r.createdDate,
      r.entryDate,
      `"${r.actionBy}"`,
      r.status,
      `"${r.reviewComment}"`,
    ]);
    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");

    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(csvContent));
    link.setAttribute(
      "download",
      `stock_update_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-3 p-1">
      {/* ─────────────────────────────────────────────────── */}
      {/* 1. TOP HEADER                                      */}
      {/* ─────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 rounded border border-slate-200/90 shadow-2xs">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            Stock Update
          </h1>
        </div>

        <div className="flex items-center gap-2">
          {/* Search */}
          <div className="relative">
            <input
              type="text"
              placeholder="Search...."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-56 sm:w-64 h-9 pl-3 pr-8 text-xs border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white placeholder-slate-400"
            />
            <Search className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {/* + Create Button */}
          <button
            type="button"
            onClick={() => setIsCreateOpen(true)}
            className="h-9 px-4 bg-[#2563eb] hover:bg-blue-700 text-white font-semibold text-xs rounded flex items-center gap-1.5 shadow-xs transition"
          >
            <Plus className="w-4 h-4" />
            <span>Create</span>
          </button>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────── */}
      {/* 2. FILTER BAR                                       */}
      {/* ─────────────────────────────────────────────────── */}
      <div className="bg-slate-50/70 p-3 rounded border border-slate-200 space-y-3 text-xs">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          {/* Office */}
          <div>
            <label className="block text-[11px] text-slate-600 mb-1 font-medium">Office</label>
            <div className="relative">
              <select
                value={office}
                onChange={(e) => setOffice(e.target.value)}
                className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white text-xs focus:ring-1 focus:ring-blue-500 appearance-none pr-7"
              >
                {OFFICE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              {office && office !== "All" && (
                <button
                  type="button"
                  onClick={() => setOffice("All")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          {/* Type */}
          <div>
            <label className="block text-[11px] text-slate-600 mb-1 font-medium">Type</label>
            <div className="relative">
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white text-xs focus:ring-1 focus:ring-blue-500 appearance-none pr-7"
              >
                {TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              {type && type !== "All" && (
                <button
                  type="button"
                  onClick={() => setType("All")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          {/* From Date */}
          <div>
            <label className="block text-[11px] text-slate-600 mb-1 font-medium">From Date</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white text-xs focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* To Date */}
          <div>
            <label className="block text-[11px] text-slate-600 mb-1 font-medium">To Date</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white text-xs focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Second Filter Row */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
          {/* Status */}
          <div>
            <label className="block text-[11px] text-slate-600 mb-1 font-medium">Status</label>
            <div className="relative">
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white text-xs focus:ring-1 focus:ring-blue-500 appearance-none pr-7"
              >
                {STATUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              {status && status !== "All" && (
                <button
                  type="button"
                  onClick={() => setStatus("All")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          {/* View Button */}
          <div>
            <button
              type="button"
              className="px-6 py-1.5 bg-[#2563eb] hover:bg-blue-700 text-white font-bold text-xs rounded shadow-xs transition"
            >
              View
            </button>
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────── */}
      {/* 3. EXCEL BUTTON                                     */}
      {/* ─────────────────────────────────────────────────── */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleExportCSV}
          className="px-4 py-1.5 bg-[#2563eb] hover:bg-blue-700 text-white font-semibold text-xs rounded shadow-xs transition"
        >
          Excel
        </button>
      </div>

      {/* ─────────────────────────────────────────────────── */}
      {/* 4. TABLE                                            */}
      {/* ─────────────────────────────────────────────────── */}
      <div className="border border-slate-300 bg-white rounded shadow-2xs overflow-x-auto">
        <table className="erp-table w-full text-left text-xs border-collapse">
          <thead className="bg-[#e6f2fb] text-slate-800 font-semibold text-[11px] border-b border-slate-300 select-none">
            <tr>
              <th className="p-2 border border-slate-300 w-12 text-center">SL</th>
              <th className="p-2 border border-slate-300 w-36">Code</th>
              <th className="p-2 border border-slate-300">Remarks</th>
              <th className="p-2 border border-slate-300">Office Name</th>
              <th className="p-2 border border-slate-300">Warehouse</th>
              <th className="p-2 border border-slate-300 w-24">Created Date</th>
              <th className="p-2 border border-slate-300 w-24">Entry Date</th>
              <th className="p-2 border border-slate-300">Action By</th>
              <th className="p-2 border border-slate-300 w-24 text-center">Status</th>
              <th className="p-2 border border-slate-300 w-32">Review Comment</th>
              <th className="p-2 border border-slate-300 w-16 text-center">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 text-[11px] text-slate-800">
            {paginatedRows.length === 0 ? (
              <tr>
                <td colSpan={11} className="p-12 text-center text-slate-400">
                  <div className="flex flex-col items-center gap-2">
                    <FileSpreadsheet className="w-8 h-8 stroke-[1.5] text-slate-300" />
                    <span className="text-sm font-medium">No stock update records found.</span>
                  </div>
                </td>
              </tr>
            ) : (
              paginatedRows.map((row) => (
                <tr key={row.sl} className="hover:bg-slate-50/80 transition-colors">
                  <td className="p-2 border border-slate-300 text-center font-mono text-slate-600">
                    {row.sl}
                  </td>
                  <td className="p-2 border border-slate-300 font-mono font-medium text-slate-900 whitespace-nowrap">
                    {row.code}
                  </td>
                  <td className="p-2 border border-slate-300 text-slate-800">
                    {row.remarks}
                  </td>
                  <td className="p-2 border border-slate-300 text-slate-700">
                    {row.officeName}
                  </td>
                  <td className="p-2 border border-slate-300 text-slate-700">
                    {row.warehouse}
                  </td>
                  <td className="p-2 border border-slate-300 whitespace-nowrap text-slate-700">
                    {row.createdDate}
                  </td>
                  <td className="p-2 border border-slate-300 whitespace-nowrap text-slate-700">
                    {row.entryDate}
                  </td>
                  <td className="p-2 border border-slate-300 text-slate-700">
                    {row.actionBy}
                  </td>
                  <td className="p-2 border border-slate-300 text-center">
                    <span className="text-emerald-600 font-semibold text-[11px]">
                      {row.status}
                    </span>
                  </td>
                  <td className="p-2 border border-slate-300 text-slate-600">
                    {row.reviewComment}
                  </td>
                  <td className="p-2 border border-slate-300 text-center">
                    <div className="flex items-center justify-center gap-1.5 text-slate-600">
                      <button
                        type="button"
                        className="p-1 hover:text-blue-600"
                        title="View"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        className="p-1 hover:text-blue-600"
                        title="Print"
                      >
                        <Printer className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ─────────────────────────────────────────────────── */}
      {/* 5. PAGINATION                                       */}
      {/* ─────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-center justify-end gap-6 text-xs text-slate-600 pt-1 pb-4">
        <div className="flex items-center gap-2">
          <span>Rows per page:</span>
          <select
            value={rowsPerPage}
            onChange={(e) => {
              setRowsPerPage(Number(e.target.value));
              setPage(1);
            }}
            className="border border-slate-300 rounded px-1.5 py-0.5 bg-white text-xs"
          >
            <option value={20}>20</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </div>
        <div className="flex items-center gap-4">
          <span>
            {filteredRows.length === 0
              ? "0-0 of 0"
              : `${(page - 1) * rowsPerPage + 1}-${Math.min(page * rowsPerPage, filteredRows.length)} of ${filteredRows.length}`}
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="p-1 border border-slate-200 rounded text-slate-400 hover:text-slate-700 disabled:opacity-40"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="p-1 border border-slate-200 rounded text-slate-400 hover:text-slate-700 disabled:opacity-40"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────── */}
      {/* 6. + CREATE MODAL                                   */}
      {/* ─────────────────────────────────────────────────── */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-slate-50">
              <h2 className="text-sm font-bold text-slate-900">
                New Stock Update
              </h2>
              <button
                type="button"
                onClick={() => setIsCreateOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-3 text-xs">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Office / Factory <span className="text-red-500">*</span>
                </label>
                <select
                  value={createForm.office}
                  onChange={(e) =>
                    setCreateForm({ ...createForm, office: e.target.value })
                  }
                  className="w-full border border-slate-300 rounded px-2.5 py-1.5 focus:ring-1 focus:ring-blue-500"
                >
                  {OFFICE_OPTIONS.filter((o) => o.value !== "All").map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Warehouse <span className="text-red-500">*</span>
                </label>
                <select
                  value={createForm.warehouse}
                  onChange={(e) =>
                    setCreateForm({ ...createForm, warehouse: e.target.value })
                  }
                  className="w-full border border-slate-300 rounded px-2.5 py-1.5 focus:ring-1 focus:ring-blue-500"
                >
                  <option value="PD Biscuit Store">PD Biscuit Store</option>
                  <option value="PD Snacks Store">PD Snacks Store</option>
                  <option value="Material WH">Material WH</option>
                  <option value="Central RM Warehouse">Central RM Warehouse</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Adjustment Type <span className="text-red-500">*</span>
                </label>
                <select
                  value={createForm.type}
                  onChange={(e) =>
                    setCreateForm({ ...createForm, type: e.target.value })
                  }
                  className="w-full border border-slate-300 rounded px-2.5 py-1.5 focus:ring-1 focus:ring-blue-500"
                >
                  {TYPE_OPTIONS.filter((o) => o.value !== "All").map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Entry Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={createForm.entryDate}
                  onChange={(e) =>
                    setCreateForm({ ...createForm, entryDate: e.target.value })
                  }
                  className="w-full border border-slate-300 rounded px-2.5 py-1.5 focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Remarks / Reason
                </label>
                <textarea
                  rows={3}
                  placeholder="e.g. Stock adjustment against audit variance..."
                  value={createForm.remarks}
                  onChange={(e) =>
                    setCreateForm({ ...createForm, remarks: e.target.value })
                  }
                  className="w-full border border-slate-300 rounded p-2 focus:ring-1 focus:ring-blue-500 placeholder-slate-400"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-slate-200 bg-slate-50">
              <button
                type="button"
                onClick={() => setIsCreateOpen(false)}
                className="px-3.5 py-1.5 text-xs text-slate-600 hover:text-slate-800 font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  alert("Stock Update record created successfully!");
                  setIsCreateOpen(false);
                }}
                className="px-4 py-1.5 bg-[#2563eb] hover:bg-blue-700 text-white font-semibold text-xs rounded shadow-xs transition"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
