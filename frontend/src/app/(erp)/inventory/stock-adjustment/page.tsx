"use client";

import React, { useState, useMemo } from "react";
import { useToast } from "@/components/ui/toast";
import { useResource } from "@/hooks/use-resource";
import { errorMessage } from "@/lib/api/client";
import { InventoryDocumentDialog } from "@/features/inventory/components/InventoryDocumentDialog";
import { dmy, inventoryApi, monthAgo, STATUS_LABEL, today } from "@/features/inventory/services/inventory.api";
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
  id: string;
  type: string;
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
  const toast = useToast();
  const [searchTerm, setSearchTerm] = useState("");

  // Filters matching screenshot
  const [office, setOffice] = useState("All");
  const [type, setType] = useState("All");
  const [status, setStatus] = useState("All");
  const [fromDate, setFromDate] = useState(monthAgo());
  const [toDate, setToDate] = useState(today());
  // The period the list was loaded for (View applies the dates).
  const [period, setPeriod] = useState({ from: fromDate, to: toDate });
  const docs = useResource(`stock-adjustment-${period.from}-${period.to}`, () => inventoryApi.list("stock-adjustment", period));
  const [busyId, setBusyId] = useState<string | null>(null);
  const rowsAll = useMemo<StockUpdateRow[]>(
    () =>
      (docs.data ?? []).map((d, i) => ({
        sl: i + 1,
        id: d.id,
        type: d.subtype ?? "",
        code: d.number,
        remarks: d.remarks ?? "",
        officeName: d.warehouse?.officeName ?? "",
        warehouse: d.warehouse?.name ?? "",
        createdDate: dmy(d.createdAt.slice(0, 10)),
        entryDate: dmy(d.docDate),
        actionBy: d.approvedBy ?? d.createdBy,
        status: d.status === "COMPLETED" ? "Approved" : (STATUS_LABEL[d.status] as StockUpdateRow["status"]),
        reviewComment: d.reviewComment ?? "",
      })),
    [docs.data],
  );
  const OFFICE_OPTIONS = useMemo(
    () => [{ value: "All", label: "All" }, ...[...new Set(rowsAll.map((r) => r.officeName))].sort().map((o) => ({ value: o, label: o }))],
    [rowsAll],
  );
  /** Approve posts the update to the stock ledger; reject leaves stock as it is. */
  const review = async (row: StockUpdateRow, decision: "approve" | "reject") => {
    const comment = window.prompt(decision === "approve" ? "Approval comment (optional)" : "Why is it rejected?") ?? undefined;
    if (decision === "reject" && comment === undefined) return;
    setBusyId(row.id);
    try {
      await inventoryApi.review("stock-adjustment", row.id, decision, comment || undefined);
      toast.success(`${row.code} ${decision === "approve" ? "approved and posted to stock" : "rejected"}.`);
      docs.reload();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusyId(null);
    }
  };

  // Pagination
  const [rowsPerPage, setRowsPerPage] = useState(50);
  const [page, setPage] = useState(1);

  // + Create Modal State
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  // Filtered rows
  const filteredRows = useMemo(() => {
    return rowsAll.filter((row) => {
      if (office !== "All" && row.officeName !== office) return false;
      if (type !== "All" && row.type !== type) return false;
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
  }, [rowsAll, office, type, status, searchTerm]);

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
              onClick={() => {
                setPeriod({ from: fromDate, to: toDate });
                setPage(1);
              }}
              className="px-6 py-1.5 bg-[#2563eb] hover:bg-blue-700 text-white font-bold text-xs rounded shadow-xs transition"
            >
              {docs.loading ? "Loading…" : "View"}
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
                <tr key={row.id} className="hover:bg-slate-50/80 transition-colors">
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
                    <span
                      className={
                        row.status === "Approved"
                          ? "text-emerald-600 font-semibold text-[11px]"
                          : row.status === "Rejected"
                            ? "text-red-600 font-semibold text-[11px]"
                            : "text-amber-600 font-semibold text-[11px]"
                      }
                    >
                      {row.status}
                    </span>
                  </td>
                  <td className="p-2 border border-slate-300 text-slate-600">
                    {row.reviewComment}
                  </td>
                  <td className="p-2 border border-slate-300 text-center">
                    <div className="flex items-center justify-center gap-1.5 text-slate-600">
                      {row.status === "Pending" && (
                        <>
                          <button
                            type="button"
                            disabled={busyId === row.id}
                            onClick={() => review(row, "approve")}
                            className="px-1.5 py-0.5 rounded bg-emerald-600 text-white text-[10px] font-semibold disabled:opacity-50"
                            title="Approve and post to stock"
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            disabled={busyId === row.id}
                            onClick={() => review(row, "reject")}
                            className="px-1.5 py-0.5 rounded border border-red-300 text-red-600 text-[10px] font-semibold disabled:opacity-50"
                            title="Reject"
                          >
                            Reject
                          </button>
                        </>
                      )}
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
      <InventoryDocumentDialog
        open={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSaved={() => docs.reload()}
        config={{
          slug: "stock-adjustment",
          title: "New Stock Update",
          warehouses: "one",
          signed: true,
          subtype: { label: "Adjustment Type", options: TYPE_OPTIONS.filter((o) => o.value !== "All").map((o) => o.value) },
        }}
      />
    </div>
  );
}
