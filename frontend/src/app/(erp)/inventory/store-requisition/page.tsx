"use client";

import React, { useState, useMemo } from "react";
import { useToast } from "@/components/ui/toast";
import { useResource } from "@/hooks/use-resource";
import { errorMessage } from "@/lib/api/client";
import { InventoryTabBar, tabBarButton } from "@/features/inventory/components/InventoryTabBar";
import { InventoryDocumentDialog } from "@/features/inventory/components/InventoryDocumentDialog";
import { useInventoryOffices } from "@/features/inventory/components/OfficeFilter";
import { dmy, inventoryApi, today } from "@/features/inventory/services/inventory.api";
import {
  Plus,
  Printer,
  Eye,
  X,
  FileSpreadsheet,
  Upload,
} from "lucide-react";
import { useFeaturePermissions, needsPermission } from "@/lib/permissions/useFeaturePermissions";
import { BulkUploadDialog } from "@/features/configuration/entity-master-data/components/BulkUploadDialog";
import { NativeDateInput } from "@/components/ui/date-input";

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

export default function StoreRequisitionPage() {
  const perms = useFeaturePermissions("/inventory/store-requisition");
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
  // Offices come from Configuration (offices with warehouses), not only those with documents.
  const offices = useInventoryOffices();
  const OFFICE_OPTIONS = useMemo(() => [{ value: "All", label: "All" }, ...offices.map((o) => ({ value: o, label: o }))], [offices]);
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
  const [bulkOpen, setBulkOpen] = useState(false);


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
        return <span className="text-emerald-600 dark:text-emerald-400 font-semibold text-[11px]">Approved</span>;
      case "Completed":
        return <span className="text-blue-600 dark:text-blue-400 font-semibold text-[11px]">Completed</span>;
      case "Closed":
        return <span className="text-ink-muted font-semibold text-[11px]">Closed</span>;
      case "Pending":
        return <span className="text-amber-600 dark:text-amber-400 font-semibold text-[11px]">Pending</span>;
      default:
        return <span className="text-ink-faint font-semibold text-[11px]">{status}</span>;
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
    <div className="space-y-3 p-1 flex flex-col md:h-[calc(100dvh-3.5rem)] md:overflow-hidden print:block print:h-auto print:overflow-visible">
      <InventoryTabBar
        title="Store Requisition"
        tabs={[
          { id: "REQUISITION_LIST", label: "Requisition List" },
          { id: "REQUISITION_SUMMARY", label: "Store Requisition Summary" },
        ]}
        active={activeTab}
        onChange={setActiveTab}
        search={searchTerm}
        onSearch={setSearchTerm}
        actions={
          <>
            {perms.import && (<button type="button" onClick={() => setBulkOpen(true)} className={tabBarButton} title="Bulk upload from Excel">
              <Upload /> Bulk Upload
            </button>)}
            {perms.create ? (<button type="button" onClick={() => setIsModalOpen(true)} className={tabBarButton}>
            <Plus /> Requisition
          </button>) : null}
          </>
        }
      />
      {/* 2. SUMMARY FILTER BAR (When on SUMMARY TAB)        */}
      {/* ─────────────────────────────────────────────────── */}
      {activeTab === "REQUISITION_SUMMARY" && (
        <div className="flex flex-wrap items-end gap-3 text-xs bg-canvas/70 p-3 rounded border border-line shrink-0">
          {/* Office */}
          <div className="min-w-[180px]">
            <label className="block text-[11px] text-ink-muted mb-1 font-semibold">
              Office <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <select
                value={summaryOffice}
                onChange={(e) => setSummaryOffice(e.target.value)}
                className="w-full border border-line-strong rounded px-2.5 py-1.5 bg-surface text-xs focus:ring-1 focus:ring-blue-500 appearance-none pr-7"
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
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-faint hover:text-ink-muted"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          {/* From Date */}
          <div>
            <label className="block text-[11px] text-ink-muted mb-1 font-semibold">
              From Date <span className="text-red-500">*</span>
            </label>
            <NativeDateInput
              type="date"
              value={summaryFromDate}
              onChange={(e) => setSummaryFromDate(e.target.value)}
              className="border border-line-strong rounded px-2.5 py-1.5 bg-surface text-xs focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* To Date */}
          <div>
            <label className="block text-[11px] text-ink-muted mb-1 font-semibold">
              To Date <span className="text-red-500">*</span>
            </label>
            <NativeDateInput
              type="date"
              value={summaryToDate}
              onChange={(e) => setSummaryToDate(e.target.value)}
              className="border border-line-strong rounded px-2.5 py-1.5 bg-surface text-xs focus:ring-1 focus:ring-blue-500"
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
            {perms.export && (<button
              type="button"
              onClick={handleExportCSV}
              className="px-5 py-1.5 bg-[#2563eb] hover:bg-blue-700 text-white font-semibold text-xs rounded shadow-xs transition"
            >
              Excel
            </button>)}
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────── */}
      {/* 4. TAB 1: REQUISITION LIST TABLE                   */}
      {/* ─────────────────────────────────────────────────── */}
      {activeTab === "REQUISITION_LIST" && (
        <div className="space-y-2 flex-1 min-h-0 flex flex-col print:block">
          <div className="border border-line-strong bg-surface rounded shadow-2xs flex-1 min-h-0 overflow-auto print:overflow-visible [&_thead]:sticky [&_thead]:top-0 [&_thead]:z-10">
            <table className="erp-table w-full text-left text-xs border-collapse">
              <thead className="bg-blue-100/70 dark:bg-blue-500/15 text-ink font-semibold text-xs select-none">
                <tr>
                  <th className="px-2.5 py-2 border-b border-line w-12 text-center">SL</th>
                  <th className="px-2.5 py-2 border-b border-line w-20 text-center">Action</th>
                  <th className="px-2.5 py-2 border-b border-line w-36">Requisition Code</th>
                  <th className="px-2.5 py-2 border-b border-line w-24">Date</th>
                  <th className="px-2.5 py-2 border-b border-line w-24">User Type</th>
                  <th className="px-2.5 py-2 border-b border-line w-24">User</th>
                  <th className="px-2.5 py-2 border-b border-line">Remarks</th>
                  <th className="px-2.5 py-2 border-b border-line w-24 text-center">Status</th>
                  <th className="px-2.5 py-2 border-b border-line w-32">Review Comment</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line text-[11px] text-ink">
                {filteredRequisitions.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-12 text-center text-ink-faint">
                      <div className="flex flex-col items-center gap-2">
                        <FileSpreadsheet className="w-8 h-8 stroke-[1.5] text-slate-300" />
                        <span className="text-sm font-medium">No store requisitions found.</span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredRequisitions.map((row) => (
                    <tr key={row.id} className="hover:bg-canvas/80 transition-colors">
                      <td className="px-2.5 py-2 border-b border-line text-center font-mono text-ink-muted">
                        {row.sl}
                      </td>
                      <td className="px-2.5 py-2 border-b border-line text-center">
                        <div className="row-actions flex items-center justify-center gap-1 text-ink-muted">
                          {row.status === "Pending" && (
                            <>
                              <button title={!perms.approve ? needsPermission("approve") : undefined}
                                type="button"
                                disabled={(busyId === row.id) || !perms.approve}
                                onClick={() => review(row, "approve")}
                                className="px-1.5 py-0.5 rounded bg-emerald-600 text-white text-[10px] font-semibold disabled:opacity-50"
                              >
                                Approve
                              </button>
                              <button title={!perms.approve ? needsPermission("approve") : undefined}
                                type="button"
                                disabled={(busyId === row.id) || !perms.approve}
                                onClick={() => review(row, "reject")}
                                className="px-1.5 py-0.5 rounded border border-red-300 dark:border-red-500/30 text-red-600 dark:text-red-400 text-[10px] font-semibold disabled:opacity-50"
                              >
                                Reject
                              </button>
                            </>
                          )}
                          <button
                            type="button"
                            className="p-1 hover:text-blue-600 dark:hover:text-blue-400"
                            title="Print"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            className="p-1 hover:text-blue-600 dark:hover:text-blue-400"
                            title="View"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                      <td className="px-2.5 py-2 border-b border-line font-mono font-medium text-ink whitespace-nowrap">
                        {row.reqCode}
                      </td>
                      <td className="px-2.5 py-2 border-b border-line whitespace-nowrap text-ink-muted">
                        {row.date}
                      </td>
                      <td className="px-2.5 py-2 border-b border-line text-ink-muted">
                        {row.userType}
                      </td>
                      <td className="px-2.5 py-2 border-b border-line text-ink-muted">
                        {row.user}
                      </td>
                      <td className="px-2.5 py-2 border-b border-line text-ink">
                        {row.remarks}
                      </td>
                      <td className="px-2.5 py-2 border-b border-line text-center">
                        {renderStatus(row.status)}
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
        </div>
      )}

      {/* ─────────────────────────────────────────────────── */}
      {/* 5. TAB 2: STORE REQUISITION SUMMARY TABLE          */}
      {/* ─────────────────────────────────────────────────── */}
      {activeTab === "REQUISITION_SUMMARY" && (
        <div className="space-y-2 flex-1 min-h-0 flex flex-col print:block">
          <div className="border border-line-strong bg-surface rounded shadow-2xs flex-1 min-h-0 overflow-auto print:overflow-visible [&_thead]:sticky [&_thead]:top-0 [&_thead]:z-10">
            <table className="erp-table w-full text-left text-xs border-collapse">
              <thead className="bg-blue-100/70 dark:bg-blue-500/15 text-ink font-semibold text-xs select-none">
                <tr>
                  <th className="px-2.5 py-2 border-b border-line w-12 text-center">SL</th>
                  <th className="px-2.5 py-2 border-b border-line w-32">Item Code</th>
                  <th className="px-2.5 py-2 border-b border-line">Item Name</th>
                  <th className="px-2.5 py-2 border-b border-line">Item Category</th>
                  <th className="px-2.5 py-2 border-b border-line w-20 text-center">UOM</th>
                  <th className="px-2.5 py-2 border-b border-line w-28 text-right">Total Req. Qty</th>
                  <th className="px-2.5 py-2 border-b border-line w-28 text-right">Issued Qty</th>
                  <th className="px-2.5 py-2 border-b border-line w-28 text-right">Pending Qty</th>
                  <th className="px-2.5 py-2 border-b border-line w-20 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line text-[11px] text-ink">
                {filteredSummary.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-12 text-center text-ink-faint">
                      <div className="flex flex-col items-center gap-2">
                        <FileSpreadsheet className="w-8 h-8 stroke-[1.5] text-slate-300" />
                        <span className="text-sm font-medium">No summary data found.</span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredSummary.map((row) => (
                    <tr key={row.sl} className="hover:bg-canvas/80 transition-colors">
                      <td className="px-2.5 py-2 border-b border-line text-center font-mono text-ink-muted">
                        {row.sl}
                      </td>
                      <td className="px-2.5 py-2 border-b border-line font-mono font-medium text-ink">
                        {row.itemCode}
                      </td>
                      <td className="px-2.5 py-2 border-b border-line font-medium text-ink">
                        {row.itemName}
                      </td>
                      <td className="px-2.5 py-2 border-b border-line text-ink-muted">
                        {row.itemCategory}
                      </td>
                      <td className="px-2.5 py-2 border-b border-line text-center text-ink-muted">
                        {row.uom}
                      </td>
                      <td className="px-2.5 py-2 border-b border-line text-right font-mono font-medium">
                        {row.totalReqQty.toFixed(2)}
                      </td>
                      <td className="px-2.5 py-2 border-b border-line text-right font-mono">
                        {row.issuedQty.toFixed(2)}
                      </td>
                      <td className="px-2.5 py-2 border-b border-line text-right font-mono text-amber-700 dark:text-amber-300 font-medium">
                        {row.pendingQty.toFixed(2)}
                      </td>
                      <td className="px-2.5 py-2 border-b border-line text-center">
                        <button
                          type="button"
                          className="p-1 hover:text-blue-600 dark:hover:text-blue-400 text-ink-muted"
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

      <BulkUploadDialog
        open={bulkOpen}
        onClose={() => setBulkOpen(false)}
        onImported={() => docs.reload()}
        noun="store requisitions"
        templateUrl={inventoryApi.importTemplateUrl("store-requisition")}
        maxRows={2000}
        matchHint="Warehouse names must match existing warehouses; Item Code must match an active item; Party / For is the employee, department or project. Rows with the same Ref are saved as one document."
        upload={(file) => inventoryApi.importFile("store-requisition", file)}
      />
      {/* ─────────────────────────────────────────────────── */}
      {/* 6. + REQUISITION MODAL                              */}
      {/* ─────────────────────────────────────────────────── */}
      <InventoryDocumentDialog
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSaved={() => docs.reload()}
        config={{
          slug: "store-requisition",
          title: "Create Store Requisition",
          warehouses: "one",
          offices: true,
          dateLabel: "Create Date",
          expectedDateLabel: "Expected Date",
          // iBOS: Employee / Department / Project, then that one person, department or project.
          subtype: { label: "User Type", options: ["Employee", "Department", "Project"], radio: true },
          fields: [
            { key: "employee", label: "Employee", kind: "employee", required: true, saveAs: "partyName", when: ["Employee"] },
            { key: "department", label: "Department", kind: "department", required: true, saveAs: "partyName", when: ["Department"] },
            { key: "project", label: "Project", kind: "project", required: true, saveAs: "partyName", when: ["Project"] },
          ],
          columns: ["code", "name", "uom", "qty"],
          columnLabels: { code: "Code", name: "Item", qty: "Quantity" },
          qtyLabel: "Request Quantity",
        }}
      />
    </div>
  );
}
