"use client";

import React, { useState, useMemo } from "react";
import { useToast } from "@/components/ui/toast";
import { useResource } from "@/hooks/use-resource";
import { errorMessage } from "@/lib/api/client";
import { InventoryDocumentDialog } from "@/features/inventory/components/InventoryDocumentDialog";
import { dmy, inventoryApi, today } from "@/features/inventory/services/inventory.api";
import {
  Search,
  Plus,
  Edit,
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
type StoreRequisitionTab = "REQUISITION_LIST" | "REQUISITION_SUMMARY";

interface RequisitionRow {
  sl: number;
  id: string;
  reqCode: string;
  date: string;
  userType: string;
  user: string;
  remarks: string;
  status: "Approved" | "Completed" | "Pending" | "Closed" | "Rejected";
  reviewComment: string;
}

interface SummaryRow {
  sl: number;
  itemCode: string;
  itemName: string;
  itemCategory: string;
  uom: string;
  totalReqQty: number;
  issuedQty: number;
  pendingQty: number;
}

/** Who a requisition can be for; issues against it record the same user type. */
const REQUISITION_USER_TYPES = ["Department", "Production", "Employee", "Maintenance", "Other"] as const;

export default function StoreRequisitionPage() {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<StoreRequisitionTab>("REQUISITION_LIST");
  const docs = useResource("store-requisition-all", () => inventoryApi.list("store-requisition"));
  const allRequisitions = useMemo(() => docs.data ?? [], [docs.data]);
  const requisitionRows = useMemo<RequisitionRow[]>(
    () =>
      allRequisitions.map((d, i) => ({
        sl: i + 1,
        id: d.id,
        reqCode: d.number,
        date: dmy(d.docDate),
        userType: d.subtype ?? "",
        user: d.partyName ?? "",
        remarks: d.remarks ?? "",
        status: d.status === "PENDING" ? "Pending" : d.status === "APPROVED" ? "Approved" : d.status === "COMPLETED" ? "Completed" : d.status === "REJECTED" ? "Rejected" : "Closed",
        reviewComment: d.reviewComment ?? "",
      })),
    [allRequisitions],
  );
  const OFFICE_OPTIONS = useMemo(
    () => [{ value: "All", label: "All" }, ...[...new Set(allRequisitions.map((d) => d.warehouse?.officeName ?? ""))].filter(Boolean).sort().map((o) => ({ value: o, label: o }))],
    [allRequisitions],
  );
  const [busyId, setBusyId] = useState<string | null>(null);
  const review = async (row: RequisitionRow, decision: "approve" | "reject") => {
    const comment = window.prompt(decision === "approve" ? "Approval comment (optional)" : "Why is it rejected?") ?? undefined;
    if (decision === "reject" && comment === undefined) return;
    setBusyId(row.id);
    try {
      await inventoryApi.review("store-requisition", row.id, decision, comment || undefined);
      toast.success(`${row.reqCode} ${decision === "approve" ? "approved. The store can now issue it." : "rejected."}`);
      docs.reload();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusyId(null);
    }
  };
  const [searchTerm, setSearchTerm] = useState("");

  // Summary tab filters
  const [summaryOffice, setSummaryOffice] = useState("All");
  const [summaryFromDate, setSummaryFromDate] = useState(today());
  const [summaryToDate, setSummaryToDate] = useState(today());

  // Modal for new requisition
  const [isModalOpen, setIsModalOpen] = useState(false);


  // Filtered requisition list
  const filteredRequisitions = useMemo(() => {
    if (!searchTerm) return requisitionRows;
    const s = searchTerm.toLowerCase();
    return requisitionRows.filter(
      (r) =>
        r.reqCode.toLowerCase().includes(s) ||
        r.remarks.toLowerCase().includes(s) ||
        r.status.toLowerCase().includes(s)
    );
  }, [requisitionRows, searchTerm]);

  // Filtered summary list
  // Requested vs issued per item, for the office and dates chosen.
  const summaryList = useMemo<SummaryRow[]>(() => {
    const byItem = new Map<string, SummaryRow>();
    for (const d of allRequisitions) {
      if (d.status === "REJECTED") continue;
      if (summaryOffice && summaryOffice !== "All" && d.warehouse?.officeName !== summaryOffice) continue;
      if ((summaryFromDate && d.docDate < summaryFromDate) || (summaryToDate && d.docDate > summaryToDate)) continue;
      for (const l of d.lines) {
        const row = byItem.get(l.itemId) ?? { sl: 0, itemCode: l.itemCode, itemName: l.itemName, itemCategory: l.category, uom: l.uom, totalReqQty: 0, issuedQty: 0, pendingQty: 0 };
        row.totalReqQty += l.qty;
        row.issuedQty += l.processedQty;
        row.pendingQty = Math.max(0, row.totalReqQty - row.issuedQty);
        byItem.set(l.itemId, row);
      }
    }
    return [...byItem.values()].map((r, i) => ({ ...r, sl: i + 1 }));
  }, [allRequisitions, summaryOffice, summaryFromDate, summaryToDate]);
  const filteredSummary = useMemo(() => {
    if (!searchTerm) return summaryList;
    const s = searchTerm.toLowerCase();
    return summaryList.filter(
      (r) =>
        r.itemCode.toLowerCase().includes(s) ||
        r.itemName.toLowerCase().includes(s) ||
        r.itemCategory.toLowerCase().includes(s)
    );
  }, [summaryList, searchTerm]);

  // Status badge styling
  const renderStatus = (status: RequisitionRow["status"]) => {
    switch (status) {
      case "Approved":
        return <span className="text-emerald-600 font-semibold text-[11px]">Approved</span>;
      case "Completed":
        return <span className="text-blue-600 font-semibold text-[11px]">Completed</span>;
      case "Closed":
        return <span className="text-slate-700 font-semibold text-[11px]">Closed</span>;
      case "Pending":
        return <span className="text-amber-600 font-semibold text-[11px]">Pending</span>;
      default:
        return <span className="text-slate-500 font-semibold text-[11px]">{status}</span>;
    }
  };

  // CSV / Excel Export
  const handleExportCSV = () => {
    let csvContent = "";
    if (activeTab === "REQUISITION_LIST") {
      const headers = [
        "SL",
        "Requisition Code",
        "Date",
        "User Type",
        "User",
        "Remarks",
        "Status",
        "Review Comment",
      ];
      const rows = filteredRequisitions.map((r) => [
        r.sl,
        r.reqCode,
        r.date,
        r.userType,
        `"${r.user}"`,
        `"${r.remarks.replace(/"/g, '""')}"`,
        r.status,
        `"${r.reviewComment}"`,
      ]);
      csvContent =
        "data:text/csv;charset=utf-8," +
        [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    } else {
      const headers = [
        "SL",
        "Item Code",
        "Item Name",
        "Item Category",
        "UOM",
        "Total Req Qty",
        "Issued Qty",
        "Pending Qty",
      ];
      const rows = filteredSummary.map((r) => [
        r.sl,
        r.itemCode,
        `"${r.itemName}"`,
        `"${r.itemCategory}"`,
        r.uom,
        r.totalReqQty,
        r.issuedQty,
        r.pendingQty,
      ]);
      csvContent =
        "data:text/csv;charset=utf-8," +
        [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    }

    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(csvContent));
    link.setAttribute(
      "download",
      `store_requisition_${activeTab.toLowerCase()}_${new Date().toISOString().slice(0, 10)}.csv`
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
            Store Requisition
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

          {/* + Requisition Button */}
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="h-9 px-4 bg-[#2563eb] hover:bg-blue-700 text-white font-semibold text-xs rounded flex items-center gap-1.5 shadow-xs transition"
          >
            <Plus className="w-4 h-4" />
            <span>Requisition</span>
          </button>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────── */}
      {/* 2. SUMMARY FILTER BAR (When on SUMMARY TAB)        */}
      {/* ─────────────────────────────────────────────────── */}
      {activeTab === "REQUISITION_SUMMARY" && (
        <div className="flex flex-wrap items-end gap-3 text-xs bg-slate-50/70 p-3 rounded border border-slate-200">
          {/* Office */}
          <div className="min-w-[180px]">
            <label className="block text-[11px] text-slate-700 mb-1 font-semibold">
              Office <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <select
                value={summaryOffice}
                onChange={(e) => setSummaryOffice(e.target.value)}
                className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white text-xs focus:ring-1 focus:ring-blue-500 appearance-none pr-7"
              >
                {OFFICE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              {summaryOffice && (
                <button
                  type="button"
                  onClick={() => setSummaryOffice("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          {/* From Date */}
          <div>
            <label className="block text-[11px] text-slate-700 mb-1 font-semibold">
              From Date <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={summaryFromDate}
              onChange={(e) => setSummaryFromDate(e.target.value)}
              className="border border-slate-300 rounded px-2.5 py-1.5 bg-white text-xs focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* To Date */}
          <div>
            <label className="block text-[11px] text-slate-700 mb-1 font-semibold">
              To Date <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={summaryToDate}
              onChange={(e) => setSummaryToDate(e.target.value)}
              className="border border-slate-300 rounded px-2.5 py-1.5 bg-white text-xs focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Buttons: View, Print, Excel */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="px-5 py-1.5 bg-[#2563eb] hover:bg-blue-700 text-white font-semibold text-xs rounded shadow-xs transition"
            >
              View
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="px-5 py-1.5 bg-[#2563eb] hover:bg-blue-700 text-white font-semibold text-xs rounded shadow-xs transition"
            >
              Print
            </button>
            <button
              type="button"
              onClick={handleExportCSV}
              className="px-5 py-1.5 bg-[#2563eb] hover:bg-blue-700 text-white font-semibold text-xs rounded shadow-xs transition"
            >
              Excel
            </button>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────── */}
      {/* 3. TABS NAVIGATION                                 */}
      {/* ─────────────────────────────────────────────────── */}
      <div className="flex border-b border-slate-200 gap-8 text-xs font-bold uppercase tracking-wider">
        <button
          type="button"
          onClick={() => setActiveTab("REQUISITION_LIST")}
          className={`pb-2 transition ${
            activeTab === "REQUISITION_LIST"
              ? "border-b-2 border-blue-600 text-blue-600 font-extrabold"
              : "text-slate-500 hover:text-slate-800"
          }`}
        >
          REQUISITION LIST
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("REQUISITION_SUMMARY")}
          className={`pb-2 transition ${
            activeTab === "REQUISITION_SUMMARY"
              ? "border-b-2 border-blue-600 text-blue-600 font-extrabold"
              : "text-slate-500 hover:text-slate-800"
          }`}
        >
          STORE REQUISITION SUMMARY
        </button>
      </div>

      {/* ─────────────────────────────────────────────────── */}
      {/* 4. TAB 1: REQUISITION LIST TABLE                   */}
      {/* ─────────────────────────────────────────────────── */}
      {activeTab === "REQUISITION_LIST" && (
        <div className="space-y-2">
          <div className="border border-slate-300 bg-white rounded shadow-2xs overflow-x-auto">
            <table className="erp-table w-full text-left text-xs border-collapse">
              <thead className="bg-[#e6f2fb] text-slate-800 font-semibold text-[11px] border-b border-slate-300 select-none">
                <tr>
                  <th className="p-2 border border-slate-300 w-12 text-center">SL</th>
                  <th className="p-2 border border-slate-300 w-36">Requisition Code</th>
                  <th className="p-2 border border-slate-300 w-24">Date</th>
                  <th className="p-2 border border-slate-300 w-24">User Type</th>
                  <th className="p-2 border border-slate-300 w-24">User</th>
                  <th className="p-2 border border-slate-300">Remarks</th>
                  <th className="p-2 border border-slate-300 w-24 text-center">Status</th>
                  <th className="p-2 border border-slate-300 w-32">Review Comment</th>
                  <th className="p-2 border border-slate-300 w-20 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-[11px] text-slate-800">
                {filteredRequisitions.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-12 text-center text-slate-400">
                      <div className="flex flex-col items-center gap-2">
                        <FileSpreadsheet className="w-8 h-8 stroke-[1.5] text-slate-300" />
                        <span className="text-sm font-medium">No store requisitions found.</span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredRequisitions.map((row) => (
                    <tr key={row.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-2 border border-slate-300 text-center font-mono text-slate-600">
                        {row.sl}
                      </td>
                      <td className="p-2 border border-slate-300 font-mono font-medium text-slate-900 whitespace-nowrap">
                        {row.reqCode}
                      </td>
                      <td className="p-2 border border-slate-300 whitespace-nowrap text-slate-700">
                        {row.date}
                      </td>
                      <td className="p-2 border border-slate-300 text-slate-700">
                        {row.userType}
                      </td>
                      <td className="p-2 border border-slate-300 text-slate-700">
                        {row.user}
                      </td>
                      <td className="p-2 border border-slate-300 text-slate-800">
                        {row.remarks}
                      </td>
                      <td className="p-2 border border-slate-300 text-center">
                        {renderStatus(row.status)}
                      </td>
                      <td className="p-2 border border-slate-300 text-slate-600">
                        {row.reviewComment}
                      </td>
                      <td className="p-2 border border-slate-300 text-center">
                        <div className="flex items-center justify-center gap-1 text-slate-600">
                          {row.status === "Pending" && (
                            <>
                              <button
                                type="button"
                                disabled={busyId === row.id}
                                onClick={() => review(row, "approve")}
                                className="px-1.5 py-0.5 rounded bg-emerald-600 text-white text-[10px] font-semibold disabled:opacity-50"
                              >
                                Approve
                              </button>
                              <button
                                type="button"
                                disabled={busyId === row.id}
                                onClick={() => review(row, "reject")}
                                className="px-1.5 py-0.5 rounded border border-red-300 text-red-600 text-[10px] font-semibold disabled:opacity-50"
                              >
                                Reject
                              </button>
                            </>
                          )}
                          <button
                            type="button"
                            className="p-1 hover:text-blue-600"
                            title="Print"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            className="p-1 hover:text-blue-600"
                            title="View"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────── */}
      {/* 5. TAB 2: STORE REQUISITION SUMMARY TABLE          */}
      {/* ─────────────────────────────────────────────────── */}
      {activeTab === "REQUISITION_SUMMARY" && (
        <div className="space-y-2">
          <div className="border border-slate-300 bg-white rounded shadow-2xs overflow-x-auto">
            <table className="erp-table w-full text-left text-xs border-collapse">
              <thead className="bg-[#e6f2fb] text-slate-800 font-semibold text-[11px] border-b border-slate-300 select-none">
                <tr>
                  <th className="p-2 border border-slate-300 w-12 text-center">SL</th>
                  <th className="p-2 border border-slate-300 w-32">Item Code</th>
                  <th className="p-2 border border-slate-300">Item Name</th>
                  <th className="p-2 border border-slate-300">Item Category</th>
                  <th className="p-2 border border-slate-300 w-20 text-center">UOM</th>
                  <th className="p-2 border border-slate-300 w-28 text-right">Total Req. Qty</th>
                  <th className="p-2 border border-slate-300 w-28 text-right">Issued Qty</th>
                  <th className="p-2 border border-slate-300 w-28 text-right">Pending Qty</th>
                  <th className="p-2 border border-slate-300 w-20 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-[11px] text-slate-800">
                {filteredSummary.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-12 text-center text-slate-400">
                      <div className="flex flex-col items-center gap-2">
                        <FileSpreadsheet className="w-8 h-8 stroke-[1.5] text-slate-300" />
                        <span className="text-sm font-medium">No summary data found.</span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredSummary.map((row) => (
                    <tr key={row.sl} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-2 border border-slate-300 text-center font-mono text-slate-600">
                        {row.sl}
                      </td>
                      <td className="p-2 border border-slate-300 font-mono font-medium text-slate-900">
                        {row.itemCode}
                      </td>
                      <td className="p-2 border border-slate-300 font-medium text-slate-900">
                        {row.itemName}
                      </td>
                      <td className="p-2 border border-slate-300 text-slate-700">
                        {row.itemCategory}
                      </td>
                      <td className="p-2 border border-slate-300 text-center text-slate-700">
                        {row.uom}
                      </td>
                      <td className="p-2 border border-slate-300 text-right font-mono font-medium">
                        {row.totalReqQty.toFixed(2)}
                      </td>
                      <td className="p-2 border border-slate-300 text-right font-mono">
                        {row.issuedQty.toFixed(2)}
                      </td>
                      <td className="p-2 border border-slate-300 text-right font-mono text-amber-700 font-medium">
                        {row.pendingQty.toFixed(2)}
                      </td>
                      <td className="p-2 border border-slate-300 text-center">
                        <button
                          type="button"
                          className="p-1 hover:text-blue-600 text-slate-600"
                          title="View"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────── */}
      {/* 6. + REQUISITION MODAL                              */}
      {/* ─────────────────────────────────────────────────── */}
      <InventoryDocumentDialog
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSaved={() => docs.reload()}
        config={{
          slug: "store-requisition",
          title: "New Store Requisition",
          warehouses: "one",
          warehouseLabel: "Store (warehouse)",
          subtype: { label: "User type", options: REQUISITION_USER_TYPES },
          partyLabel: "Requested for (user / department)",
        }}
      />
    </div>
  );
}
