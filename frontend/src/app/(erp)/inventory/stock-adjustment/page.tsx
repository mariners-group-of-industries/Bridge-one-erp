"use client";

import React, { useState, useMemo } from "react";
import { useToast } from "@/components/ui/toast";
import { useResource } from "@/hooks/use-resource";
import { errorMessage } from "@/lib/api/client";
import { InventoryTabBar, tabBarButton } from "@/features/inventory/components/InventoryTabBar";
import { InventoryDocumentDialog } from "@/features/inventory/components/InventoryDocumentDialog";
import { useInventoryOffices } from "@/features/inventory/components/OfficeFilter";
import { dmy, inReview, inventoryApi, monthAgo, today } from "@/features/inventory/services/inventory.api";
import {
  Plus,
  Printer,
  Eye,
  ChevronLeft,
  ChevronRight,
  X,
  FileSpreadsheet,
  Upload,
} from "lucide-react";
import { useFeaturePermissions, needsPermission } from "@/lib/permissions/useFeaturePermissions";
import { BulkUploadDialog } from "@/features/configuration/entity-master-data/components/BulkUploadDialog";

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
  status: "Approved" | "In Review" | "Pending" | "Closed" | "Rejected";
  reviewComment: string;
}

const TYPE_OPTIONS = [
  { value: "All", label: "All" },
  { value: "Stock Audit", label: "Stock Audit" },
  { value: "Stock Adjustment", label: "Stock Adjustment" },
  { value: "Damage", label: "Damage" },
];

// iBOS statuses, plus Rejected (a reviewer can refuse an update here).
const STATUS_OPTIONS = [
  { value: "All", label: "All" },
  { value: "Approved", label: "Approved" },
  { value: "In Review", label: "In Review" },
  { value: "Pending", label: "Pending" },
  { value: "Closed", label: "Closed" },
  { value: "Rejected", label: "Rejected" },
];

export default function StockUpdatePage() {
  const perms = useFeaturePermissions("/inventory/stock-adjustment");
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
        status:
          d.status === "COMPLETED" || d.status === "APPROVED"
            ? "Approved"
            : d.status === "REJECTED"
              ? "Rejected"
              : d.status === "CANCELLED"
                ? "Closed"
                : inReview(d)
                  ? "In Review"
                  : "Pending",
        reviewComment: d.reviewComment ?? "",
      })),
    [docs.data],
  );
  // Offices come from Configuration (offices with warehouses), not only those with documents.
  const offices = useInventoryOffices();
  const OFFICE_OPTIONS = useMemo(() => [{ value: "All", label: "All" }, ...offices.map((o) => ({ value: o, label: o }))], [offices]);
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
  const [bulkOpen, setBulkOpen] = useState(false);

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
    <div className="space-y-3 p-1 flex flex-col md:h-[calc(100dvh-3.5rem)] md:overflow-hidden print:block print:h-auto print:overflow-visible">
      <InventoryTabBar
        title="Stock Update"
        tabs={[{ id: "STOCK_UPDATE", label: "Stock Update" }]}
        active="STOCK_UPDATE"
        onChange={() => {}}
        search={searchTerm}
        onSearch={setSearchTerm}
        actions={
          <>
            {perms.import && (<button type="button" onClick={() => setBulkOpen(true)} className={tabBarButton} title="Bulk upload from Excel">
              <Upload /> Bulk Upload
            </button>)}
            {perms.create ? (<button type="button" onClick={() => setIsCreateOpen(true)} className={tabBarButton}>
            <Plus /> Create
          </button>) : null}
          </>
        }
      />
      {/* 2. FILTER BAR                                       */}
      {/* ─────────────────────────────────────────────────── */}
      <div className="bg-canvas/70 p-3 rounded border border-line space-y-3 text-xs shrink-0">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          {/* Office */}
          <div>
            <label className="block text-[11px] text-ink-muted mb-1 font-medium">Office</label>
            <div className="relative">
              <select
                value={office}
                onChange={(e) => setOffice(e.target.value)}
                className="w-full border border-line-strong rounded px-2.5 py-1.5 bg-surface text-xs focus:ring-1 focus:ring-blue-500 appearance-none pr-7"
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
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-faint hover:text-ink-muted"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          {/* Type */}
          <div>
            <label className="block text-[11px] text-ink-muted mb-1 font-medium">Type</label>
            <div className="relative">
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="w-full border border-line-strong rounded px-2.5 py-1.5 bg-surface text-xs focus:ring-1 focus:ring-blue-500 appearance-none pr-7"
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
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-faint hover:text-ink-muted"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          {/* From Date */}
          <div>
            <label className="block text-[11px] text-ink-muted mb-1 font-medium">From Date</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-full border border-line-strong rounded px-2.5 py-1.5 bg-surface text-xs focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* To Date */}
          <div>
            <label className="block text-[11px] text-ink-muted mb-1 font-medium">To Date</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="w-full border border-line-strong rounded px-2.5 py-1.5 bg-surface text-xs focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Second Filter Row */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
          {/* Status */}
          <div>
            <label className="block text-[11px] text-ink-muted mb-1 font-medium">Status</label>
            <div className="relative">
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full border border-line-strong rounded px-2.5 py-1.5 bg-surface text-xs focus:ring-1 focus:ring-blue-500 appearance-none pr-7"
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
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-faint hover:text-ink-muted"
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
      <div className="flex justify-end shrink-0">
        {perms.export && (<button
          type="button"
          onClick={handleExportCSV}
          className="px-4 py-1.5 bg-[#2563eb] hover:bg-blue-700 text-white font-semibold text-xs rounded shadow-xs transition"
        >
          Excel
        </button>)}
      </div>

      {/* ─────────────────────────────────────────────────── */}
      {/* 4. TABLE                                            */}
      {/* ─────────────────────────────────────────────────── */}
      <div className="border border-line-strong bg-surface rounded shadow-2xs flex-1 min-h-0 overflow-auto print:overflow-visible [&_thead]:sticky [&_thead]:top-0 [&_thead]:z-10">
        <table className="erp-table w-full text-left text-xs border-collapse">
          <thead className="bg-blue-100/70 dark:bg-blue-500/15 text-ink font-semibold text-xs select-none">
            <tr>
              <th className="px-2.5 py-2 border-b border-line w-12 text-center">SL</th>
              <th className="px-2.5 py-2 border-b border-line w-16 text-center">Action</th>
              <th className="px-2.5 py-2 border-b border-line w-36">Code</th>
              <th className="px-2.5 py-2 border-b border-line">Remarks</th>
              <th className="px-2.5 py-2 border-b border-line">Office Name</th>
              <th className="px-2.5 py-2 border-b border-line">Warehouse</th>
              <th className="px-2.5 py-2 border-b border-line w-24">Created Date</th>
              <th className="px-2.5 py-2 border-b border-line w-24">Entry Date</th>
              <th className="px-2.5 py-2 border-b border-line">Action By</th>
              <th className="px-2.5 py-2 border-b border-line w-24 text-center">Status</th>
              <th className="px-2.5 py-2 border-b border-line w-32">Review Comment</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line text-[11px] text-ink">
            {paginatedRows.length === 0 ? (
              <tr>
                <td colSpan={11} className="p-12 text-center text-ink-faint">
                  <div className="flex flex-col items-center gap-2">
                    <FileSpreadsheet className="w-8 h-8 stroke-[1.5] text-slate-300" />
                    <span className="text-sm font-medium">No stock update records found.</span>
                  </div>
                </td>
              </tr>
            ) : (
              paginatedRows.map((row) => (
                <tr key={row.id} className="hover:bg-canvas/80 transition-colors">
                  <td className="px-2.5 py-2 border-b border-line text-center font-mono text-ink-muted">
                    {row.sl}
                  </td>
                  <td className="px-2.5 py-2 border-b border-line text-center">
                    <div className="row-actions flex items-center justify-center gap-1.5 text-ink-muted">
                      {(row.status === "Pending" || row.status === "In Review") && (
                        <>
                          <button
                            type="button"
                            disabled={(busyId === row.id) || !perms.approve}
                            onClick={() => review(row, "approve")}
                            className="px-1.5 py-0.5 rounded bg-emerald-600 text-white text-[10px] font-semibold disabled:opacity-50"
                            title={!perms.approve ? needsPermission("approve") : "Approve and post to stock"}
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            disabled={(busyId === row.id) || !perms.approve}
                            onClick={() => review(row, "reject")}
                            className="px-1.5 py-0.5 rounded border border-red-300 dark:border-red-500/30 text-red-600 dark:text-red-400 text-[10px] font-semibold disabled:opacity-50"
                            title={!perms.approve ? needsPermission("approve") : "Reject"}
                          >
                            Reject
                          </button>
                        </>
                      )}
                      <button
                        type="button"
                        className="p-1 hover:text-blue-600 dark:hover:text-blue-400"
                        title="View"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        className="p-1 hover:text-blue-600 dark:hover:text-blue-400"
                        title="Print"
                      >
                        <Printer className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                  <td className="px-2.5 py-2 border-b border-line font-mono font-medium text-ink whitespace-nowrap">
                    {row.code}
                  </td>
                  <td className="px-2.5 py-2 border-b border-line text-ink">
                    {row.remarks}
                  </td>
                  <td className="px-2.5 py-2 border-b border-line text-ink-muted">
                    {row.officeName}
                  </td>
                  <td className="px-2.5 py-2 border-b border-line text-ink-muted">
                    {row.warehouse}
                  </td>
                  <td className="px-2.5 py-2 border-b border-line whitespace-nowrap text-ink-muted">
                    {row.createdDate}
                  </td>
                  <td className="px-2.5 py-2 border-b border-line whitespace-nowrap text-ink-muted">
                    {row.entryDate}
                  </td>
                  <td className="px-2.5 py-2 border-b border-line text-ink-muted">
                    {row.actionBy}
                  </td>
                  <td className="px-2.5 py-2 border-b border-line text-center">
                    <span
                      className={
                        row.status === "Approved"
                          ? "text-emerald-600 dark:text-emerald-400 font-semibold text-[11px]"
                          : row.status === "Rejected"
                            ? "text-red-600 dark:text-red-400 font-semibold text-[11px]"
                            : "text-amber-600 dark:text-amber-400 font-semibold text-[11px]"
                      }
                    >
                      {row.status}
                    </span>
                  </td>
                  <td className="px-2.5 py-2 border-b border-line text-ink-muted">
                    {row.reviewComment}
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
      <div className="flex flex-col sm:flex-row items-center justify-end gap-6 text-xs text-ink-muted pt-1 shrink-0">
        <div className="flex items-center gap-2">
          <span>Rows per page:</span>
          <select
            value={rowsPerPage}
            onChange={(e) => {
              setRowsPerPage(Number(e.target.value));
              setPage(1);
            }}
            className="border border-line-strong rounded px-1.5 py-0.5 bg-surface text-xs"
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
              className="p-1 border border-line rounded text-ink-faint hover:text-ink-muted disabled:opacity-40"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="p-1 border border-line rounded text-ink-faint hover:text-ink-muted disabled:opacity-40"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────── */}
      {/* 6. + CREATE MODAL                                   */}
      {/* ─────────────────────────────────────────────────── */}
      <BulkUploadDialog
        open={bulkOpen}
        onClose={() => setBulkOpen(false)}
        onImported={() => docs.reload()}
        noun="stock updates"
        templateUrl={inventoryApi.importTemplateUrl("stock-adjustment")}
        maxRows={2000}
        matchHint="Warehouse names must match existing warehouses exactly; Item Code must match an active item. Rows with the same Ref are saved as one document."
        upload={(file) => inventoryApi.importFile("stock-adjustment", file)}
      />
      <InventoryDocumentDialog
        open={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSaved={() => docs.reload()}
        config={{
          slug: "stock-adjustment",
          title: "Create Stock Adjustment",
          warehouses: "one",
          offices: true,
          signed: true,
          subtype: { label: "Type", options: TYPE_OPTIONS.filter((o) => o.value !== "All").map((o) => o.value) },
          columns: ["code", "category", "name", "uom", "stock", "cost", "qty", "remarks"],
          qtyLabel: "Adjust Qty (+/−)",
        }}
      />
    </div>
  );
}
