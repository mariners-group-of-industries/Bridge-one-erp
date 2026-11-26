"use client";

import React, { useState, useMemo } from "react";
import { useToast } from "@/components/ui/toast";
import { useResource } from "@/hooks/use-resource";
import { errorMessage } from "@/lib/api/client";
import { InventoryTabBar, tabBarButton } from "@/features/inventory/components/InventoryTabBar";
import { InventoryDocumentDialog } from "@/features/inventory/components/InventoryDocumentDialog";
import type { InventoryDocument } from "@/features/inventory/schemas/document.schema";
import { dmy, inReview, inventoryApi } from "@/features/inventory/services/inventory.api";
import {
  Download,
  Plus,
  ChevronLeft,
  ChevronRight,
  X,
  Eye,
  Printer,
  FileSpreadsheet,
  Upload,
} from "lucide-react";
import { useFeaturePermissions, needsPermission } from "@/lib/permissions/useFeaturePermissions";
import { BulkUploadDialog } from "@/features/configuration/entity-master-data/components/BulkUploadDialog";
import { NativeDateInput } from "@/components/ui/date-input";

// ============================================================================
// TYPES
// ============================================================================
type TabId = "REQUEST_LIST" | "REQUEST_SUMMARY" | "REQUEST_DETAILS";

interface TransferRequestRow {
  sl: number;
  id: string;
  reqDate: string;
  exptDate: string;
  reqCode: string;
  salesOrderNo: string;
  reqOffice: string;
  reqWarehouse: string;
  reqQty: number;
  outQty: number;
  inQty: number;
  remainingQty: number;
  status: "Pending" | "In Progress" | "Approved" | "Review" | "Rejected" | "Closed";
  actionBy: string;
  requestTo: string;
}

interface SummaryRow {
  sl: number;
  itemCode: string;
  itemType: string;
  itemCategory: string;
  itemName: string;
  uom: string;
  requestQty: number;
  productionQty: number;
}

interface DetailRow {
  itemCode: string;
  itemCategory: string;
  itemName: string;
  uom: string;
  totalQty: number;
}

/** Request rows: quantity requested, sent by transfers, and received. */
function toRequestRows(docs: InventoryDocument[]): TransferRequestRow[] {
  return docs.map((d, i) => {
    const outQty = d.processedQty;
    const inQty = d.fulfilments.reduce((t, f) => t + f.receivedQty, 0);
    const status: TransferRequestRow["status"] =
      d.status === "PENDING"
        ? inReview(d)
          ? "Review"
          : "Pending"
        : d.status === "REJECTED"
          ? "Rejected"
          : d.status === "COMPLETED" || d.status === "CANCELLED"
            ? "Closed"
            : outQty > 0
              ? "In Progress"
              : "Approved";
    return {
      sl: i + 1,
      id: d.id,
      reqDate: dmy(d.docDate),
      exptDate: dmy(d.expectedDate),
      reqCode: d.number,
      salesOrderNo: d.reference ?? "",
      reqOffice: d.toWarehouse?.officeName ?? "",
      reqWarehouse: d.toWarehouse?.name ?? "",
      reqQty: d.totalQty,
      outQty,
      inQty,
      remainingQty: Math.max(0, Math.round((d.totalQty - outQty) * 1000) / 1000),
      status,
      actionBy: d.createdBy,
      // iBOS "Request To" is the person asked; older requests named the supplying warehouse.
      requestTo: d.meta?.requestTo ?? d.warehouse?.name ?? "",
    };
  });
}

/** Requested items added up (summary tab). */
function toSummaryRows(docs: InventoryDocument[]): SummaryRow[] {
  const byItem = new Map<string, SummaryRow>();
  for (const d of docs) {
    if (d.status === "REJECTED") continue;
    for (const l of d.lines) {
      const row = byItem.get(l.itemId) ?? { sl: 0, itemCode: l.itemCode, itemType: "", itemCategory: l.category, itemName: l.itemName, uom: l.uom, requestQty: 0, productionQty: 0 };
      row.requestQty += l.qty;
      row.productionQty += l.processedQty;
      byItem.set(l.itemId, row);
    }
  }
  return [...byItem.values()].map((r, i) => ({ ...r, sl: i + 1 }));
}

/** Requested items for one office / warehouse (details tab). */
function toDetailRows(docs: InventoryDocument[], office: string, warehouse: string, expFrom: string, expTo: string): DetailRow[] {
  const byItem = new Map<string, DetailRow>();
  for (const d of docs) {
    if (d.status === "REJECTED") continue;
    if (office && d.toWarehouse?.officeName !== office) continue;
    if (warehouse && d.toWarehouse?.name !== warehouse) continue;
    if (d.expectedDate && ((expFrom && d.expectedDate < expFrom) || (expTo && d.expectedDate > expTo))) continue;
    for (const l of d.lines) {
      const row = byItem.get(l.itemId) ?? { itemCode: l.itemCode, itemCategory: l.category, itemName: l.itemName, uom: l.uom, totalQty: 0 };
      row.totalQty += l.qty;
      byItem.set(l.itemId, row);
    }
  }
  return [...byItem.values()];
}

// iBOS: In Progress = partly sent, Review = some approval stages signed, Closed = fully sent.
const STATUS_OPTIONS = [
  { value: "", label: "All Status" },
  { value: "Pending", label: "Pending" },
  { value: "In Progress", label: "In Progress" },
  { value: "Approved", label: "Approved" },
  { value: "Review", label: "Review" },
  { value: "Rejected", label: "Rejected" },
  { value: "Closed", label: "Closed" },
];

// ============================================================================
// HELPERS
// ============================================================================
function getDefaultFrom() {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return d.toISOString().split("T")[0];
}

function getDefaultTo() {
  return new Date().toISOString().split("T")[0];
}


function statusBadge(status: TransferRequestRow["status"]) {
  const map: Record<string, string> = {
    Pending: "bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-500/30",
    Approved: "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/30",
    "In Progress": "bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-500/30",
    Review: "bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-500/30",
    Closed: "bg-control text-ink-muted border-line",
    Rejected: "bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-300 border-red-200 dark:border-red-500/30",
  };
  return (
    <span
      className={`inline-block px-2 py-0.5 text-[10px] font-semibold rounded border ${map[status] || "bg-canvas text-ink-muted border-line"}`}
    >
      {status}
    </span>
  );
}

// ============================================================================
// MAIN PAGE COMPONENT
// ============================================================================
export default function TransferRequestPage() {
  const perms = useFeaturePermissions("/inventory/transfer-request");
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<TabId>("REQUEST_LIST");
  const [searchTerm, setSearchTerm] = useState("");

  // ── REQUEST LIST filters ──
  const [listFromDate, setListFromDate] = useState(getDefaultFrom());
  const [listToDate, setListToDate] = useState(getDefaultTo());
  const [listStatus, setListStatus] = useState("Pending");
  const [listPerson, setListPerson] = useState("");
  const [listRowsPerPage, setListRowsPerPage] = useState(50);
  const [listPage, setListPage] = useState(1);
  const [listPeriod, setListPeriod] = useState({ from: listFromDate, to: listToDate });
  const listDocs = useResource(`transfer-request-${listPeriod.from}-${listPeriod.to}`, () => inventoryApi.list("transfer-request", listPeriod));
  const requestList = useMemo(() => toRequestRows(listDocs.data ?? []), [listDocs.data]);
  const PERSON_OPTIONS = useMemo(
    () => [{ value: "", label: "All Persons" }, ...[...new Set(requestList.map((r) => r.actionBy))].sort().map((p) => ({ value: p, label: p }))],
    [requestList],
  );
  const [busyId, setBusyId] = useState<string | null>(null);
  const review = async (row: TransferRequestRow, decision: "approve" | "reject") => {
    const comment = window.prompt(decision === "approve" ? "Approval comment (optional)" : "Why is it rejected?") ?? undefined;
    if (decision === "reject" && comment === undefined) return;
    setBusyId(row.id);
    try {
      await inventoryApi.review("transfer-request", row.id, decision, comment || undefined);
      toast.success(`${row.reqCode} ${decision === "approve" ? "approved. It can now be transferred." : "rejected."}`);
      listDocs.reload();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusyId(null);
    }
  };

  // ── REQUEST SUMMARY filters ──
  const [summaryFromDate, setSummaryFromDate] = useState(getDefaultFrom());
  const [summaryToDate, setSummaryToDate] = useState(getDefaultTo());
  const [summaryRowsPerPage, setSummaryRowsPerPage] = useState(50);
  const [summaryPage, setSummaryPage] = useState(1);
  const [summaryPeriod, setSummaryPeriod] = useState({ from: summaryFromDate, to: summaryToDate });
  const summaryDocs = useResource(`transfer-request-summary-${summaryPeriod.from}-${summaryPeriod.to}`, () => inventoryApi.list("transfer-request", summaryPeriod));
  const summaryList = useMemo(() => toSummaryRows(summaryDocs.data ?? []), [summaryDocs.data]);

  // ── REQUEST DETAILS filters ──
  const [detailOffice, setDetailOffice] = useState("");
  const [detailWarehouse, setDetailWarehouse] = useState("");
  const [detailFromReqDate, setDetailFromReqDate] = useState(getDefaultFrom());
  const [detailToReqDate, setDetailToReqDate] = useState(getDefaultTo());
  const [detailFromExpDate, setDetailFromExpDate] = useState(getDefaultFrom());
  const [detailToExpDate, setDetailToExpDate] = useState(getDefaultTo());
  const [detailQuery, setDetailQuery] = useState({ from: detailFromReqDate, to: detailToReqDate, expFrom: detailFromExpDate, expTo: detailToExpDate, office: "", warehouse: "" });
  const detailDocs = useResource(`transfer-request-detail-${detailQuery.from}-${detailQuery.to}`, () =>
    inventoryApi.list("transfer-request", { from: detailQuery.from, to: detailQuery.to }),
  );
  const detailList = useMemo(
    () => toDetailRows(detailDocs.data ?? [], detailQuery.office, detailQuery.warehouse, detailQuery.expFrom, detailQuery.expTo),
    [detailDocs.data, detailQuery],
  );
  // Offices and warehouses come from Configuration (Business Units › Offices / Warehouses).
  const masters = useResource("inventory-masters", inventoryApi.masters);
  const configuredWarehouses = useMemo(() => masters.data?.warehouses ?? [], [masters.data]);
  const OFFICE_OPTIONS = useMemo(
    () => [{ value: "", label: "Office" }, ...[...new Set(configuredWarehouses.map((w) => w.officeName))].filter(Boolean).sort().map((o) => ({ value: o, label: o }))],
    [configuredWarehouses],
  );
  const WAREHOUSE_OPTIONS = useMemo(
    () =>
      detailOffice
        ? [
            { value: "", label: "Warehouse" },
            ...[...new Set(configuredWarehouses.filter((w) => w.officeName === detailOffice).map((w) => w.name))]
              .filter(Boolean)
              .sort()
              .map((w) => ({ value: w, label: w })),
          ]
        : [{ value: "", label: "Select Office first" }],
    [configuredWarehouses, detailOffice],
  );

  // ── + Request modal ──
  const [isNewRequestOpen, setIsNewRequestOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);

  // ── Filtered REQUEST LIST ──
  const filteredList = useMemo(() => {
    return requestList.filter((row) => {
      if (listStatus && row.status !== listStatus) return false;
      if (listPerson && row.actionBy !== listPerson) return false;
      if (searchTerm) {
        const s = searchTerm.toLowerCase();
        const match =
          row.reqCode.toLowerCase().includes(s) ||
          row.reqOffice.toLowerCase().includes(s) ||
          row.reqWarehouse.toLowerCase().includes(s) ||
          row.salesOrderNo.toLowerCase().includes(s) ||
          row.actionBy.toLowerCase().includes(s) ||
          row.requestTo.toLowerCase().includes(s);
        if (!match) return false;
      }
      return true;
    });
  }, [requestList, listStatus, listPerson, searchTerm]);

  const totalListPages = Math.ceil(filteredList.length / listRowsPerPage) || 1;
  const paginatedList = useMemo(() => {
    const start = (listPage - 1) * listRowsPerPage;
    return filteredList.slice(start, start + listRowsPerPage);
  }, [filteredList, listPage, listRowsPerPage]);

  // ── Filtered SUMMARY ──
  const filteredSummary = useMemo(() => {
    if (!searchTerm) return summaryList;
    const s = searchTerm.toLowerCase();
    return summaryList.filter(
      (row) =>
        row.itemCode.toLowerCase().includes(s) ||
        row.itemName.toLowerCase().includes(s) ||
        row.itemCategory.toLowerCase().includes(s)
    );
  }, [summaryList, searchTerm]);

  const totalSummaryPages = Math.ceil(filteredSummary.length / summaryRowsPerPage) || 1;
  const paginatedSummary = useMemo(() => {
    const start = (summaryPage - 1) * summaryRowsPerPage;
    return filteredSummary.slice(start, start + summaryRowsPerPage);
  }, [filteredSummary, summaryPage, summaryRowsPerPage]);

  // ── Export CSV ──
  const handleExportCSV = () => {
    let csvContent = "";
    if (activeTab === "REQUEST_LIST") {
      const headers = ["SL", "Req. Date", "Expt. Date", "Req. Code", "Sales Order No", "Req. Office", "Req. Warehouse", "Req. Qty", "Out Qty", "In Qty", "Remaining Qty", "Status", "Action By", "Request To"];
      const rows = filteredList.map((r, i) => [
        i + 1, r.reqDate, r.exptDate, r.reqCode, r.salesOrderNo, `"${r.reqOffice}"`, `"${r.reqWarehouse}"`,
        r.reqQty, r.outQty, r.inQty, r.remainingQty, r.status, `"${r.actionBy}"`, `"${r.requestTo}"`,
      ]);
      csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    } else if (activeTab === "REQUEST_SUMMARY") {
      const headers = ["SL", "Item Code", "Item Type", "Item Category", "Item Name", "UOM", "Request Qty", "Transferred Qty"];
      const rows = filteredSummary.map((r, i) => [
        i + 1, r.itemCode, r.itemType, `"${r.itemCategory}"`, `"${r.itemName}"`, r.uom, r.requestQty, r.productionQty,
      ]);
      csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    } else {
      const headers = ["Item Code", "Item Category", "Item Name", "UOM", "Total Qty"];
      const rows = detailList.map((r) => [r.itemCode, `"${r.itemCategory}"`, `"${r.itemName}"`, r.uom, r.totalQty]);
      csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    }
    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(csvContent));
    link.setAttribute("download", `transfer_request_${activeTab.toLowerCase()}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const tabs: { id: TabId; label: string }[] = [
    { id: "REQUEST_LIST", label: "Request List" },
    { id: "REQUEST_SUMMARY", label: "Request Summary" },
    { id: "REQUEST_DETAILS", label: "Request Details" },
  ];

  return (
    <div className="bg-surface space-y-2 p-3 flex flex-col md:h-[calc(100dvh-3.5rem)] md:overflow-hidden print:block print:h-auto print:overflow-visible">
      <InventoryTabBar
        title="Transfer Request"
        tabs={tabs}
        active={activeTab}
        onChange={setActiveTab}
        search={searchTerm}
        onSearch={setSearchTerm}
        actions={
          <>
            {(activeTab === "REQUEST_SUMMARY" || activeTab === "REQUEST_DETAILS") && (
              (perms.export ? (<button type="button" onClick={handleExportCSV} className={tabBarButton}>
                <Download /> Excel
              </button>) : null)
            )}
            {perms.import && (<button type="button" onClick={() => setBulkOpen(true)} className={tabBarButton} title="Bulk upload from Excel">
              <Upload /> Bulk Upload
            </button>)}
            {perms.create && (<button type="button" onClick={() => setIsNewRequestOpen(true)} className={tabBarButton}>
              <Plus /> Request
            </button>)}
          </>
        }
      />

      {/* ============================================================= */}
      {/* TAB 1: REQUEST LIST                                            */}
      {/* ============================================================= */}
      {activeTab === "REQUEST_LIST" && (
        <div className="space-y-2 flex-1 min-h-0 flex flex-col print:block">
          {/* Filter Row */}
          <div className="bg-canvas/60 p-3 rounded border border-line grid grid-cols-2 sm:grid-cols-6 gap-3 items-end text-xs shrink-0">
            {/* From Date */}
            <div>
              <label className="block text-[11px] text-ink-muted mb-1 font-medium">
                From Date
              </label>
              <NativeDateInput
                type="date"
                value={listFromDate}
                onChange={(e) => setListFromDate(e.target.value)}
                className="w-full border border-line-strong rounded px-2.5 py-1.5 bg-surface text-xs focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {/* To Date */}
            <div>
              <label className="block text-[11px] text-ink-muted mb-1 font-medium">
                To Date
              </label>
              <NativeDateInput
                type="date"
                value={listToDate}
                onChange={(e) => setListToDate(e.target.value)}
                className="w-full border border-line-strong rounded px-2.5 py-1.5 bg-surface text-xs focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {/* Status */}
            <div>
              <label className="block text-[11px] text-ink-muted mb-1 font-medium">
                Status
              </label>
              <div className="relative">
                <select
                  value={listStatus}
                  onChange={(e) => setListStatus(e.target.value)}
                  className="w-full border border-line-strong rounded px-2.5 py-1.5 bg-surface text-xs focus:ring-1 focus:ring-blue-500 appearance-none pr-7"
                >
                  {STATUS_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
                {listStatus && (
                  <button
                    type="button"
                    onClick={() => setListStatus("")}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 text-ink-faint hover:text-ink-muted"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>

            {/* Person */}
            <div className="col-span-2">
              <label className="block text-[11px] text-ink-muted mb-1 font-medium">
                Requesting Person
              </label>
              <div className="relative">
                <select
                  value={listPerson}
                  onChange={(e) => setListPerson(e.target.value)}
                  className="w-full border border-line-strong rounded px-2.5 py-1.5 bg-surface text-xs focus:ring-1 focus:ring-blue-500 appearance-none pr-7"
                >
                  {PERSON_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
                {listPerson && (
                  <button
                    type="button"
                    onClick={() => setListPerson("")}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 text-ink-faint hover:text-ink-muted"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>

            {/* View */}
            <div>
              <button
                type="button"
                onClick={() => { setListPeriod({ from: listFromDate, to: listToDate }); setListPage(1); }}
                className="px-6 py-1.5 bg-[#1976d2] hover:bg-[#1565c0] text-white text-xs font-bold rounded shadow-xs transition"
              >
                View
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="border border-line-strong bg-surface rounded shadow-2xs flex-1 min-h-0 overflow-auto print:overflow-visible [&_thead]:sticky [&_thead]:top-0 [&_thead]:z-10">
            <table className="erp-table w-full text-left text-xs border-collapse">
              <thead className="bg-blue-100/70 dark:bg-blue-500/15 text-ink font-semibold text-xs select-none">
                <tr>
                  <th className="px-2.5 py-2 border-b border-line w-10 text-center">SL</th>
                  <th className="px-2.5 py-2 border-b border-line w-20 text-center">Action</th>
                  <th className="px-2.5 py-2 border-b border-line w-24">Req. Date</th>
                  <th className="px-2.5 py-2 border-b border-line w-24">Expt. Date</th>
                  <th className="px-2.5 py-2 border-b border-line w-32">Req. Code</th>
                  <th className="px-2.5 py-2 border-b border-line w-32">Sales Order No</th>
                  <th className="px-2.5 py-2 border-b border-line">Req. Office</th>
                  <th className="px-2.5 py-2 border-b border-line">Req. Warehouse</th>
                  <th className="px-2.5 py-2 border-b border-line w-20 text-right">Req. Qty</th>
                  <th className="px-2.5 py-2 border-b border-line w-20 text-right">Out Qty</th>
                  <th className="px-2.5 py-2 border-b border-line w-20 text-right">In Qty</th>
                  <th className="px-2.5 py-2 border-b border-line w-24 text-right">Remaining Qty</th>
                  <th className="px-2.5 py-2 border-b border-line w-24 text-center">Status</th>
                  <th className="px-2.5 py-2 border-b border-line">Action By</th>
                  <th className="px-2.5 py-2 border-b border-line">Request To</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line text-[11px] text-ink">
                {paginatedList.length === 0 ? (
                  <tr>
                    <td colSpan={15} className="p-12 text-center text-ink-faint">
                      <div className="flex flex-col items-center gap-2">
                        <FileSpreadsheet className="w-8 h-8 stroke-[1.5] text-slate-300" />
                        <span className="text-sm font-medium">No transfer requests found for the selected criteria.</span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  paginatedList.map((row, idx) => {
                    const serialNo = (listPage - 1) * listRowsPerPage + idx + 1;
                    return (
                      <tr key={row.sl || idx} className="hover:bg-canvas/80 transition-colors">
                        <td className="px-2.5 py-2 border-b border-line text-center font-mono text-ink-muted">
                          {serialNo}
                        </td>
                        <td className="px-2.5 py-2 border-b border-line text-center">
                          <div className="row-actions flex items-center justify-center gap-1.5 text-ink-muted">
                            {(row.status === "Pending" || row.status === "Review") && (
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
                            <button type="button" className="p-0.5 hover:text-blue-600 dark:hover:text-blue-400" title="View">
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            <button type="button" className="p-0.5 hover:text-blue-600 dark:hover:text-blue-400" title="Print">
                              <Printer className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                        <td className="px-2.5 py-2 border-b border-line whitespace-nowrap text-ink-muted">
                          {row.reqDate}
                        </td>
                        <td className="px-2.5 py-2 border-b border-line whitespace-nowrap text-ink-muted">
                          {row.exptDate}
                        </td>
                        <td className="px-2.5 py-2 border-b border-line font-mono text-ink whitespace-nowrap font-medium">
                          {row.reqCode}
                        </td>
                        <td className="px-2.5 py-2 border-b border-line font-mono text-ink whitespace-nowrap">
                          {row.salesOrderNo}
                        </td>
                        <td className="px-2.5 py-2 border-b border-line text-ink-muted">
                          {row.reqOffice}
                        </td>
                        <td className="px-2.5 py-2 border-b border-line text-ink-muted">
                          {row.reqWarehouse}
                        </td>
                        <td className="px-2.5 py-2 border-b border-line text-right font-mono">
                          {row.reqQty}
                        </td>
                        <td className="px-2.5 py-2 border-b border-line text-right font-mono">
                          {row.outQty}
                        </td>
                        <td className="px-2.5 py-2 border-b border-line text-right font-mono">
                          {row.inQty}
                        </td>
                        <td className="px-2.5 py-2 border-b border-line text-right font-mono">
                          {row.remainingQty}
                        </td>
                        <td className="px-2.5 py-2 border-b border-line text-center">
                          {statusBadge(row.status)}
                        </td>
                        <td className="px-2.5 py-2 border-b border-line text-ink-muted">
                          {row.actionBy}
                        </td>
                        <td className="px-2.5 py-2 border-b border-line text-ink-muted">
                          {row.requestTo}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex flex-col sm:flex-row items-center justify-end gap-6 text-xs text-ink-muted pt-1 shrink-0">
            <div className="flex items-center gap-2">
              <span>Rows per page:</span>
              <select
                value={listRowsPerPage}
                onChange={(e) => {
                  setListRowsPerPage(Number(e.target.value));
                  setListPage(1);
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
                {filteredList.length === 0
                  ? "0-0 of 0"
                  : `${(listPage - 1) * listRowsPerPage + 1}-${Math.min(listPage * listRowsPerPage, filteredList.length)} of ${filteredList.length}`}
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={listPage <= 1}
                  onClick={() => setListPage((p) => Math.max(1, p - 1))}
                  className="p-1 border border-line rounded text-ink-faint hover:text-ink-muted disabled:opacity-40"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  disabled={listPage >= totalListPages}
                  onClick={() => setListPage((p) => Math.min(totalListPages, p + 1))}
                  className="p-1 border border-line rounded text-ink-faint hover:text-ink-muted disabled:opacity-40"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================= */}
      {/* TAB 2: REQUEST SUMMARY                                         */}
      {/* ============================================================= */}
      {activeTab === "REQUEST_SUMMARY" && (
        <div className="space-y-2 flex-1 min-h-0 flex flex-col print:block">
          {/* Filter Row */}
          <div className="bg-canvas/60 p-3 rounded border border-line grid grid-cols-2 sm:grid-cols-4 gap-3 items-end text-xs shrink-0">
            {/* From Date */}
            <div>
              <label className="block text-[11px] text-ink-muted mb-1 font-medium">
                From Date
              </label>
              <NativeDateInput
                type="date"
                value={summaryFromDate}
                onChange={(e) => setSummaryFromDate(e.target.value)}
                className="w-full border border-line-strong rounded px-2.5 py-1.5 bg-surface text-xs focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {/* To Date */}
            <div>
              <label className="block text-[11px] text-ink-muted mb-1 font-medium">
                To Date
              </label>
              <NativeDateInput
                type="date"
                value={summaryToDate}
                onChange={(e) => setSummaryToDate(e.target.value)}
                className="w-full border border-line-strong rounded px-2.5 py-1.5 bg-surface text-xs focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {/* View */}
            <div>
              <button
                type="button"
                onClick={() => { setSummaryPeriod({ from: summaryFromDate, to: summaryToDate }); setSummaryPage(1); }}
                className="px-6 py-1.5 bg-[#1976d2] hover:bg-[#1565c0] text-white text-xs font-bold rounded shadow-xs transition"
              >
                View
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="border border-line-strong bg-surface rounded shadow-2xs flex-1 min-h-0 overflow-auto print:overflow-visible [&_thead]:sticky [&_thead]:top-0 [&_thead]:z-10">
            <table className="erp-table w-full text-left text-xs border-collapse">
              <thead className="bg-blue-100/70 dark:bg-blue-500/15 text-ink font-semibold text-xs select-none">
                <tr>
                  <th className="px-2.5 py-2 border-b border-line w-10 text-center">SL</th>
                  <th className="px-2.5 py-2 border-b border-line w-28">Item Code</th>
                  <th className="px-2.5 py-2 border-b border-line w-28">Item Type</th>
                  <th className="px-2.5 py-2 border-b border-line">Item Category</th>
                  <th className="px-2.5 py-2 border-b border-line">Item Name</th>
                  <th className="px-2.5 py-2 border-b border-line w-20 text-center">UOM</th>
                  <th className="px-2.5 py-2 border-b border-line w-28 text-right">Request Qty</th>
                  <th className="px-2.5 py-2 border-b border-line w-28 text-right">Transferred Qty</th>
                  <th className="px-2.5 py-2 border-b border-line w-20 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line text-[11px] text-ink">
                {paginatedSummary.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-12 text-center text-ink-faint">
                      <div className="flex flex-col items-center gap-2">
                        <FileSpreadsheet className="w-8 h-8 stroke-[1.5] text-slate-300" />
                        <span className="text-sm font-medium">No summary data found for the selected date range.</span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  paginatedSummary.map((row, idx) => {
                    const serialNo = (summaryPage - 1) * summaryRowsPerPage + idx + 1;
                    return (
                      <tr key={row.sl || idx} className="hover:bg-canvas/80 transition-colors">
                        <td className="px-2.5 py-2 border-b border-line text-center font-mono text-ink-muted">
                          {serialNo}
                        </td>
                        <td className="px-2.5 py-2 border-b border-line font-mono text-ink font-medium">
                          {row.itemCode}
                        </td>
                        <td className="px-2.5 py-2 border-b border-line text-ink-muted">
                          {row.itemType}
                        </td>
                        <td className="px-2.5 py-2 border-b border-line text-ink-muted">
                          {row.itemCategory}
                        </td>
                        <td className="px-2.5 py-2 border-b border-line text-ink font-medium">
                          {row.itemName}
                        </td>
                        <td className="px-2.5 py-2 border-b border-line text-center text-ink-muted">
                          {row.uom}
                        </td>
                        <td className="px-2.5 py-2 border-b border-line text-right font-mono">
                          {row.requestQty}
                        </td>
                        <td className="px-2.5 py-2 border-b border-line text-right font-mono">
                          {row.productionQty}
                        </td>
                        <td className="px-2.5 py-2 border-b border-line text-center">
                          <button type="button" className="p-0.5 hover:text-blue-600 dark:hover:text-blue-400 text-ink-muted" title="View">
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex flex-col sm:flex-row items-center justify-end gap-6 text-xs text-ink-muted pt-1 shrink-0">
            <div className="flex items-center gap-2">
              <span>Rows per page:</span>
              <select
                value={summaryRowsPerPage}
                onChange={(e) => {
                  setSummaryRowsPerPage(Number(e.target.value));
                  setSummaryPage(1);
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
                {filteredSummary.length === 0
                  ? "0-0 of 0"
                  : `${(summaryPage - 1) * summaryRowsPerPage + 1}-${Math.min(summaryPage * summaryRowsPerPage, filteredSummary.length)} of ${filteredSummary.length}`}
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={summaryPage <= 1}
                  onClick={() => setSummaryPage((p) => Math.max(1, p - 1))}
                  className="p-1 border border-line rounded text-ink-faint hover:text-ink-muted disabled:opacity-40"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  disabled={summaryPage >= totalSummaryPages}
                  onClick={() => setSummaryPage((p) => Math.min(totalSummaryPages, p + 1))}
                  className="p-1 border border-line rounded text-ink-faint hover:text-ink-muted disabled:opacity-40"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================= */}
      {/* TAB 3: REQUEST DETAILS                                         */}
      {/* ============================================================= */}
      {activeTab === "REQUEST_DETAILS" && (
        <div className="space-y-2 flex-1 min-h-0 flex flex-col print:block">
          {/* Filter Row */}
          <div className="bg-canvas/60 p-3 rounded border border-line grid grid-cols-2 sm:grid-cols-7 gap-3 items-end text-xs shrink-0">
            {/* Office */}
            <div>
              <label className="block text-[11px] text-ink-muted mb-1 font-medium">
                Office
              </label>
              <select
                value={detailOffice}
                onChange={(e) => {
                  setDetailOffice(e.target.value);
                  setDetailWarehouse("");
                }}
                className="w-full border border-line-strong rounded px-2.5 py-1.5 bg-surface text-xs focus:ring-1 focus:ring-blue-500"
              >
                {OFFICE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Warehouse */}
            <div>
              <label className="block text-[11px] text-ink-muted mb-1 font-medium">
                Warehouse
              </label>
              <select
                value={detailWarehouse}
                onChange={(e) => setDetailWarehouse(e.target.value)}
                disabled={!detailOffice}
                className="w-full border border-line-strong rounded px-2.5 py-1.5 bg-surface text-xs focus:ring-1 focus:ring-blue-500 disabled:bg-control disabled:text-ink-faint disabled:cursor-not-allowed"
              >
                {WAREHOUSE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>

            {/* From Request Date */}
            <div>
              <label className="block text-[11px] text-ink-muted mb-1 font-medium">
                From Request Date
              </label>
              <NativeDateInput
                type="date"
                value={detailFromReqDate}
                onChange={(e) => setDetailFromReqDate(e.target.value)}
                className="w-full border border-line-strong rounded px-2.5 py-1.5 bg-surface text-xs focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {/* To Request Date */}
            <div>
              <label className="block text-[11px] text-ink-muted mb-1 font-medium">
                To Request Date
              </label>
              <NativeDateInput
                type="date"
                value={detailToReqDate}
                onChange={(e) => setDetailToReqDate(e.target.value)}
                className="w-full border border-line-strong rounded px-2.5 py-1.5 bg-surface text-xs focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {/* From Exp. Date */}
            <div>
              <label className="block text-[11px] text-ink-muted mb-1 font-medium">
                From Exp. Date
              </label>
              <NativeDateInput
                type="date"
                value={detailFromExpDate}
                onChange={(e) => setDetailFromExpDate(e.target.value)}
                className="w-full border border-line-strong rounded px-2.5 py-1.5 bg-surface text-xs focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {/* To Exp. Date */}
            <div>
              <label className="block text-[11px] text-ink-muted mb-1 font-medium">
                To Exp. Date
              </label>
              <NativeDateInput
                type="date"
                value={detailToExpDate}
                onChange={(e) => setDetailToExpDate(e.target.value)}
                className="w-full border border-line-strong rounded px-2.5 py-1.5 bg-surface text-xs focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* View Button below filters */}
          <div className="shrink-0">
            <button
              type="button"
              onClick={() => setDetailQuery({ from: detailFromReqDate, to: detailToReqDate, expFrom: detailFromExpDate, expTo: detailToExpDate, office: detailOffice, warehouse: detailWarehouse })}
              className="px-6 py-1.5 bg-[#1976d2] hover:bg-[#1565c0] text-white text-xs font-bold rounded shadow-xs transition"
            >
              View
            </button>
          </div>

          {/* Item Request Details Section */}
          <div className="pt-2 flex-1 min-h-0 flex flex-col print:block">
            <h3 className="text-sm font-bold text-ink mb-2 shrink-0">
              Item Request Details
            </h3>
            <div className="border border-line-strong bg-surface rounded shadow-2xs flex-1 min-h-0 overflow-auto print:overflow-visible [&_thead]:sticky [&_thead]:top-0 [&_thead]:z-10">
              <table className="erp-table w-full text-left text-xs border-collapse">
                <thead className="bg-blue-100/70 dark:bg-blue-500/15 text-ink font-semibold text-xs select-none">
                  <tr>
                    <th className="px-2.5 py-2 border-b border-line w-28">Item Code</th>
                    <th className="px-2.5 py-2 border-b border-line">Item Category</th>
                    <th className="px-2.5 py-2 border-b border-line">Item Name</th>
                    <th className="px-2.5 py-2 border-b border-line w-20 text-center">UOM</th>
                    <th className="px-2.5 py-2 border-b border-line w-28 text-center">
                      Total
                      <br />
                      Qty
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line text-[11px] text-ink">
                  {detailList.length === 0 ? (
                    <>
                      <tr>
                        <td colSpan={5} className="p-8 text-center text-ink-faint">
                          <div className="flex flex-col items-center gap-2">
                            <FileSpreadsheet className="w-8 h-8 stroke-[1.5] text-slate-300" />
                            <span className="text-sm font-medium">
                              Select filters and click View to load item details.
                            </span>
                          </div>
                        </td>
                      </tr>
                      <tr className="bg-canvas">
                        <td className="px-2.5 py-2 border-b border-line font-bold text-ink-muted">
                          Total
                        </td>
                        <td className="px-2.5 py-2 border-b border-line" />
                        <td className="px-2.5 py-2 border-b border-line" />
                        <td className="px-2.5 py-2 border-b border-line" />
                        <td className="px-2.5 py-2 border-b border-line" />
                      </tr>
                    </>
                  ) : (
                    <>
                      {detailList.map((row, idx) => (
                        <tr key={idx} className="hover:bg-canvas/80 transition-colors">
                          <td className="px-2.5 py-2 border-b border-line font-mono text-ink font-medium">
                            {row.itemCode}
                          </td>
                          <td className="px-2.5 py-2 border-b border-line text-ink-muted">
                            {row.itemCategory}
                          </td>
                          <td className="px-2.5 py-2 border-b border-line text-ink font-medium">
                            {row.itemName}
                          </td>
                          <td className="px-2.5 py-2 border-b border-line text-center text-ink-muted">
                            {row.uom}
                          </td>
                          <td className="px-2.5 py-2 border-b border-line text-center font-mono">
                            {row.totalQty}
                          </td>
                        </tr>
                      ))}
                      <tr className="bg-canvas font-bold">
                        <td className="px-2.5 py-2 border-b border-line text-ink-muted">
                          Total
                        </td>
                        <td className="px-2.5 py-2 border-b border-line" />
                        <td className="px-2.5 py-2 border-b border-line" />
                        <td className="px-2.5 py-2 border-b border-line" />
                        <td className="px-2.5 py-2 border-b border-line text-center font-mono">
                          {detailList.reduce((sum, r) => sum + r.totalQty, 0)}
                        </td>
                      </tr>
                    </>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================= */}
      {/* NEW REQUEST MODAL                                              */}
      {/* ============================================================= */}
      <BulkUploadDialog
        open={bulkOpen}
        onClose={() => setBulkOpen(false)}
        onImported={() => listDocs.reload()}
        noun="transfer requests"
        templateUrl={inventoryApi.importTemplateUrl("transfer-request")}
        maxRows={2000}
        matchHint="Requesting warehouse name must match an existing warehouse; Item Code must match an active item. Rows with the same Ref are saved as one request."
        upload={(file) => inventoryApi.importFile("transfer-request", file)}
      />
      <InventoryDocumentDialog
        open={isNewRequestOpen}
        onClose={() => setIsNewRequestOpen(false)}
        onSaved={() => listDocs.reload()}
        config={{
          slug: "transfer-request",
          title: "Create Transfer Request",
          // iBOS: only the requesting side; the sending warehouse is chosen when the stock is sent out.
          warehouses: "target",
          offices: true,
          toOfficeLabel: "To/Requesting Office",
          toWarehouseLabel: "To/Requesting Warehouse",
          dateLabel: "Request Date",
          expectedDateLabel: "Expected Date",
          fields: [
            { key: "requestTo", label: "Request To", kind: "employee" },
            { key: "itemType", label: "Item Type", kind: "select", options: ["Inventory Item", "Asset Item"], required: true },
            { key: "salesOrder", label: "Sales Order", kind: "salesOrder", saveAs: "reference" },
          ],
          // iBOS picker: Supplier → Category → Sub → Minor → Item.
          picker: "supplier",
          columns: ["code", "category", "name", "cost", "trade", "mrp", "stock", "altQty", "qty"],
          stockOf: "target",
          stockLabel: "Req. Warehouse Stock",
          qtyLabel: "Request Quantity",
        }}
      />
    </div>
  );
}
