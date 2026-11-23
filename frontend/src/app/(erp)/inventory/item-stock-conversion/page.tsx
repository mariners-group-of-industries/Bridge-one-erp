"use client";

import React, { useState, useMemo } from "react";
import { useToast } from "@/components/ui/toast";
import { useResource } from "@/hooks/use-resource";
import { errorMessage } from "@/lib/api/client";
import { InventoryTabBar, tabBarButton } from "@/features/inventory/components/InventoryTabBar";
import { InventoryDocumentDialog } from "@/features/inventory/components/InventoryDocumentDialog";
import type { InventoryDocument } from "@/features/inventory/schemas/document.schema";
import { inReview, inventoryApi, monthAgo, today } from "@/features/inventory/services/inventory.api";
import {
  Plus,
  Copy,
  Printer,
  Eye,
  ChevronLeft,
  ChevronRight,
  X,
  FileSpreadsheet,
  CheckCircle2,
  Clock,
  XCircle,
  ArrowRight,
  Upload,
} from "lucide-react";
import { useFeaturePermissions, needsPermission } from "@/lib/permissions/useFeaturePermissions";
import { BulkUploadDialog } from "@/features/configuration/entity-master-data/components/BulkUploadDialog";

// ============================================================================
// TYPES
// ============================================================================
type ConversionTab = "CONVERSION_LIST" | "REPORT";

interface StockConversionRecord {
  sl: number;
  /** Conversion document id (one record per line of it). */
  id: string;
  code: string;
  conversionDate: string;
  office: string;
  warehouse: string;
  conversionType: string;
  sourceItemCode: string;
  sourceItemName: string;
  sourceQty: number;
  sourceUom: string;
  targetItemCode: string;
  targetItemName: string;
  targetQty: number;
  targetUom: string;
  ratio: string;
  wastageQty: number;
  wastageUom: string;
  wastagePercent: number;
  status: "Pending" | "In Review" | "Approved" | "Rejected";
  operator: string;
  remarks: string;
}

/** One record per converted line; stock moves when the conversion is approved. */
function toRecords(docs: InventoryDocument[]): StockConversionRecord[] {
  const round = (n: number, d = 3) => Math.round(n * 10 ** d) / 10 ** d;
  return docs.flatMap((d) =>
    d.lines.map((l, i) => {
      const sameUnit = l.uom === l.toUom;
      const wastage = sameUnit ? Math.max(0, round(l.qty - (l.toQty ?? 0))) : 0;
      return {
        sl: 0,
        id: d.id,
        code: d.lines.length > 1 ? `${d.number}/${i + 1}` : d.number,
        conversionDate: d.docDate,
        office: d.warehouse?.officeName ?? "",
        warehouse: d.warehouse?.name ?? "",
        conversionType: d.subtype ?? "",
        sourceItemCode: l.itemCode,
        sourceItemName: l.itemName,
        sourceQty: l.qty,
        sourceUom: l.uom,
        targetItemCode: l.toItemCode ?? "",
        targetItemName: l.toItemName ?? "",
        targetQty: l.toQty ?? 0,
        targetUom: l.toUom ?? "",
        ratio: l.qty > 0 ? `1:${round((l.toQty ?? 0) / l.qty)}` : "",
        wastageQty: wastage,
        wastageUom: l.uom,
        wastagePercent: sameUnit && l.qty > 0 ? round((wastage / l.qty) * 100, 2) : 0,
        // An approved conversion has posted its stock (iBOS calls it Approved).
        status: d.status === "PENDING" ? (inReview(d) ? "In Review" : "Pending") : d.status === "REJECTED" ? "Rejected" : "Approved",
        operator: d.approvedBy ?? d.createdBy,
        remarks: d.remarks ?? "",
      } satisfies StockConversionRecord;
    }),
  ).map((r, i) => ({ ...r, sl: i + 1 }));
}

const optionsOf = (placeholder: string, all: string, values: string[]) => [
  { value: all, label: placeholder },
  ...[...new Set(values.filter(Boolean))].sort().map((v) => ({ value: v, label: v })),
];

const CONVERSION_TYPE_OPTIONS = [
  { value: "All", label: "Conversion Type" },
  { value: "Stock Transfer", label: "Stock Transfer" },
  { value: "Bundle", label: "Bundle" },
  { value: "Un-Bundle", label: "Un-Bundle" },
  { value: "ONE TO ONE", label: "ONE TO ONE" },
];

const STATUS_OPTIONS = [
  { value: "All", label: "All Status" },
  { value: "Pending", label: "Pending" },
  { value: "Approved", label: "Approved" },
  { value: "Rejected", label: "Rejected" },
  { value: "In Review", label: "In Review" },
];

const VIEW_BY_OPTIONS = [
  { value: "Item Wise", label: "Item Wise" },
  { value: "Warehouse Wise", label: "Warehouse Wise" },
  { value: "Date Wise", label: "Date Wise" },
  { value: "Conversion Type Wise", label: "Conversion Type Wise" },
  { value: "Summary", label: "Summary Overview" },
];

export default function ItemStockConversionPage() {
  const perms = useFeaturePermissions("/inventory/item-stock-conversion");
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<ConversionTab>("CONVERSION_LIST");
  const [searchTerm, setSearchTerm] = useState("");

  // Tab 1 Filters (Exact to Screenshot 1)
  const [officeFilter, setOfficeFilter] = useState("All");
  const [typeFilter, setTypeFilter] = useState("All");
  const [bundledItemFilter, setBundledItemFilter] = useState("All");
  const [fromDate, setFromDate] = useState(monthAgo());
  const [toDate, setToDate] = useState(today());
  const [statusFilter, setStatusFilter] = useState("All");

  // Tab 2 Filters (Exact to Screenshot 2)
  const [reportOffice, setReportOffice] = useState("");
  const masters = useResource("inventory-masters", inventoryApi.masters);
  // Offices of the warehouses the user can see.
  const reportOffices = useMemo(() => [...new Set((masters.data?.warehouses ?? []).map((w) => w.officeName))].sort(), [masters.data]);
  const [reportWarehouse, setReportWarehouse] = useState("");
  const reportWarehouses = useMemo(
    () =>
      reportOffice
        ? [...new Set((masters.data?.warehouses ?? []).filter((w) => w.officeName === reportOffice).map((w) => w.name))].sort()
        : [],
    [masters.data, reportOffice],
  );
  const [reportFromDate, setReportFromDate] = useState(monthAgo());
  const [reportToDate, setReportToDate] = useState(today());
  const [reportViewBy, setReportViewBy] = useState("Item Wise");
  const [reportConversionType, setReportConversionType] = useState("");
  const [includeFromItem, setIncludeFromItem] = useState(true);
  const [includeConvertedItem, setIncludeConvertedItem] = useState(true);
  const [onlyItem, setOnlyItem] = useState(false);

  // Pagination for List
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [page, setPage] = useState(1);

  // Dataset State
  const docs = useResource("item-stock-conversion-all", () => inventoryApi.list("item-stock-conversion"));
  const records = useMemo(() => toRecords(docs.data ?? []), [docs.data]);
  // Offices come from Configuration (offices with warehouses), not only those with conversions.
  const OFFICE_OPTIONS = optionsOf("All", "All", reportOffices);
  const BUNDLED_ITEM_OPTIONS = [
    { value: "All", label: "All Items" },
    ...[...new Map(records.flatMap((r) => [[r.sourceItemCode, r.sourceItemName], [r.targetItemCode, r.targetItemName]] as const)).entries()]
      .filter(([code]) => code)
      .sort()
      .map(([code, name]) => ({ value: code, label: `${code} - ${name}` })),
  ];
  const [approving, setApproving] = useState(false);
  /** Approving posts the conversion: source items out, target items in. */
  const approveConversion = async (record: StockConversionRecord) => {
    setApproving(true);
    try {
      await inventoryApi.review("item-stock-conversion", record.id, "approve");
      toast.success(`${record.code} approved. Stock converted.`);
      setViewRecord(null);
      docs.reload();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setApproving(false);
    }
  };

  // Modals
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [viewRecord, setViewRecord] = useState<StockConversionRecord | null>(null);

  // Filtered rows for Tab 1
  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      if (officeFilter !== "All" && r.office !== officeFilter) return false;
      if (typeFilter !== "All" && r.conversionType !== typeFilter) return false;
      if (bundledItemFilter !== "All") {
        if (
          r.sourceItemCode !== bundledItemFilter &&
          r.targetItemCode !== bundledItemFilter
        ) {
          return false;
        }
      }
      if (statusFilter !== "All" && r.status !== statusFilter) return false;

      // Date range check
      if (fromDate && r.conversionDate < fromDate) return false;
      if (toDate && r.conversionDate > toDate) return false;

      // Text search
      if (searchTerm) {
        const q = searchTerm.toLowerCase();
        return (
          r.code.toLowerCase().includes(q) ||
          r.sourceItemName.toLowerCase().includes(q) ||
          r.targetItemName.toLowerCase().includes(q) ||
          r.office.toLowerCase().includes(q) ||
          r.warehouse.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [
    records,
    officeFilter,
    typeFilter,
    bundledItemFilter,
    statusFilter,
    fromDate,
    toDate,
    searchTerm,
  ]);

  // Filtered rows for Tab 2 (Report)
  const reportRecords = useMemo(() => {
    return records.filter((r) => {
      if (reportOffice && reportOffice !== "All" && r.office !== reportOffice) return false;
      if (reportWarehouse && reportWarehouse !== "All" && r.warehouse !== reportWarehouse) return false;
      if (reportConversionType && reportConversionType !== "All" && r.conversionType !== reportConversionType) return false;
      if (reportFromDate && r.conversionDate < reportFromDate) return false;
      if (reportToDate && r.conversionDate > reportToDate) return false;
      return true;
    });
  }, [
    records,
    reportOffice,
    reportWarehouse,
    reportConversionType,
    reportFromDate,
    reportToDate,
  ]);

  // Report Totals
  const reportTotals = useMemo(() => {
    const totalSource = reportRecords.reduce((sum, r) => sum + r.sourceQty, 0);
    const totalTarget = reportRecords.reduce((sum, r) => sum + r.targetQty, 0);
    const totalWastage = reportRecords.reduce((sum, r) => sum + r.wastageQty, 0);
    const avgYield = totalSource > 0 ? ((totalTarget / totalSource) * 100).toFixed(1) : "100.0";
    return { totalSource, totalTarget, totalWastage, avgYield };
  }, [reportRecords]);

  // Paginated List
  const totalPages = Math.ceil(filteredRecords.length / rowsPerPage) || 1;
  const paginatedRows = useMemo(() => {
    const start = (page - 1) * rowsPerPage;
    return filteredRecords.slice(start, start + rowsPerPage);
  }, [filteredRecords, page, rowsPerPage]);

  // Format Date for report display (DD-MM-YYYY)
  const formatReportDate = (d: string) => {
    if (!d) return "";
    const parts = d.split("-");
    if (parts.length === 3) {
      return `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
    return d;
  };

  // CSV Export for Conversion List
  const handleExportListCSV = () => {
    const headers = [
      "SL",
      "Code",
      "Date",
      "Office",
      "Warehouse",
      "Conversion Type",
      "Source Item",
      "Source Qty",
      "Source UOM",
      "Target Item",
      "Target Qty",
      "Target UOM",
      "Ratio",
      "Wastage Qty",
      "Status",
    ];
    const rows = filteredRecords.map((r, idx) => [
      idx + 1,
      r.code,
      r.conversionDate,
      `"${r.office}"`,
      `"${r.warehouse}"`,
      `"${r.conversionType}"`,
      `"${r.sourceItemCode} - ${r.sourceItemName}"`,
      r.sourceQty,
      r.sourceUom,
      `"${r.targetItemCode} - ${r.targetItemName}"`,
      r.targetQty,
      r.targetUom,
      r.ratio,
      r.wastageQty,
      r.status,
    ]);
    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");

    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(csvContent));
    link.setAttribute(
      "download",
      `item_stock_conversion_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // CSV Export for Report
  const handleExportReportCSV = () => {
    const headers = [
      "SL",
      "Date",
      "Conversion Code",
      "Office",
      "Warehouse",
      "Conversion Type",
      "From Item",
      "From Qty",
      "Converted Item",
      "Converted Qty",
      "Ratio",
      "Wastage",
      "Status",
    ];
    const rows = reportRecords.map((r, idx) => [
      idx + 1,
      r.conversionDate,
      r.code,
      `"${r.office}"`,
      `"${r.warehouse}"`,
      `"${r.conversionType}"`,
      `"${r.sourceItemCode} - ${r.sourceItemName}"`,
      `${r.sourceQty} ${r.sourceUom}`,
      `"${r.targetItemCode} - ${r.targetItemName}"`,
      `${r.targetQty} ${r.targetUom}`,
      r.ratio,
      `${r.wastageQty} ${r.wastageUom}`,
      r.status,
    ]);
    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");

    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(csvContent));
    link.setAttribute(
      "download",
      `item_stock_conversion_report_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-3 p-1 font-sans text-ink flex flex-col md:h-[calc(100dvh-3.5rem)] md:overflow-hidden print:block print:h-auto print:overflow-visible">
      <InventoryTabBar
        title="Item Stock Conversion"
        tabs={[
          { id: "CONVERSION_LIST", label: "ITEM STOCK CONVERSION" },
          { id: "REPORT", label: "REPORT" },
        ]}
        active={activeTab}
        onChange={(id) => {
          setActiveTab(id);
          setPage(1);
        }}
        search={searchTerm}
        onSearch={setSearchTerm}
        actions={
          <>
            <button type="button" onClick={() => setActiveTab("CONVERSION_LIST")} className={tabBarButton}>
              <Copy /> Item Stock Conversion
            </button>
            {perms.import && (<button type="button" onClick={() => setBulkOpen(true)} className={tabBarButton} title="Bulk upload from Excel">
              <Upload /> Bulk Upload
            </button>)}
            {perms.create && (<button type="button" onClick={() => setIsCreateOpen(true)} className={tabBarButton} aria-label="Create Item Stock Conversion">
              <Plus /> Item Stock Conversion
            </button>)}
          </>
        }
      />
      {/* 3. TAB 1: ITEM STOCK CONVERSION LIST VIEW                        */}
      {/* ───────────────────────────────────────────────────────────────── */}
      {activeTab === "CONVERSION_LIST" && (
        <div className="space-y-3 flex-1 min-h-0 flex flex-col print:block">
          {/* Filter Bar (Exact to Screenshot 1) */}
          <div className="bg-surface p-3 rounded border border-line text-xs shrink-0">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-7 gap-3 items-end">
              {/* Office */}
              <div>
                <label className="block text-[11px] text-ink-muted mb-1 font-medium">
                  Office
                </label>
                <div className="relative">
                  <select
                    value={officeFilter}
                    onChange={(e) => setOfficeFilter(e.target.value)}
                    className="w-full border border-line-strong rounded px-2.5 py-1.5 bg-surface text-xs focus:ring-1 focus:ring-blue-500 appearance-none text-ink-muted"
                  >
                    {OFFICE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Conversion Type */}
              <div>
                <label className="block text-[11px] text-ink-muted mb-1 font-medium">
                  Conversion Type
                </label>
                <div className="relative">
                  <select
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value)}
                    className="w-full border border-line-strong rounded px-2.5 py-1.5 bg-surface text-xs focus:ring-1 focus:ring-blue-500 appearance-none text-ink-muted"
                  >
                    <option value="All">All Types</option>
                    <option value="Stock Transfer">Stock Transfer</option>
                    <option value="Repackaging">Repackaging</option>
                    <option value="Unit Conversion">Unit Conversion</option>
                    <option value="Grade Categorization">Grade Categorization</option>
                    <option value="Raw to FG Conversion">Raw to FG Conversion</option>
                  </select>
                </div>
              </div>

              {/* Bundled Item */}
              <div className="md:col-span-2">
                <label className="block text-[11px] text-ink-muted mb-1 font-medium">
                  Bundled Item
                </label>
                <div className="relative">
                  <select
                    value={bundledItemFilter}
                    onChange={(e) => setBundledItemFilter(e.target.value)}
                    className="w-full border border-line-strong rounded px-2.5 py-1.5 bg-surface text-xs focus:ring-1 focus:ring-blue-500 appearance-none text-ink-muted pr-8"
                  >
                    {BUNDLED_ITEM_OPTIONS.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                  {bundledItemFilter !== "All" && (
                    <button
                      type="button"
                      onClick={() => setBundledItemFilter("All")}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-faint hover:text-ink-muted"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* From Date */}
              <div>
                <label className="block text-[11px] text-ink-muted mb-1 font-medium">
                  From Date
                </label>
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="w-full border border-line-strong rounded px-2.5 py-1 bg-surface text-xs focus:ring-1 focus:ring-blue-500 text-ink-muted"
                />
              </div>

              {/* To Date */}
              <div>
                <label className="block text-[11px] text-ink-muted mb-1 font-medium">
                  To Date
                </label>
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="w-full border border-line-strong rounded px-2.5 py-1 bg-surface text-xs focus:ring-1 focus:ring-blue-500 text-ink-muted"
                />
              </div>

              {/* Status & View Button */}
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <label className="block text-[11px] text-ink-muted mb-1 font-medium">
                    Status
                  </label>
                  <div className="relative">
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      className="w-full border border-line-strong rounded px-2 py-1.5 bg-surface text-xs focus:ring-1 focus:ring-blue-500 appearance-none text-ink-muted pr-6"
                    >
                      {STATUS_OPTIONS.map((st) => (
                        <option key={st.value} value={st.value}>
                          {st.label}
                        </option>
                      ))}
                    </select>
                    {statusFilter !== "All" && (
                      <button
                        type="button"
                        onClick={() => setStatusFilter("All")}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-faint hover:text-ink-muted"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setPage(1)}
                  className="h-8 px-4 bg-[#1976d2] hover:bg-[#1565c0] text-white font-semibold text-xs rounded shadow-xs transition"
                >
                  View
                </button>
              </div>
            </div>
          </div>

          {/* Action Header / Export bar */}
          <div className="flex justify-between items-center px-1 shrink-0">
            <div className="text-xs text-ink-faint font-medium">
              Found <span className="font-bold text-ink">{filteredRecords.length}</span> conversion records
            </div>
            <div className="flex items-center gap-2">
              {perms.export && (<button
                type="button"
                onClick={handleExportListCSV}
                className="h-8 px-3 bg-surface border border-line-strong hover:bg-canvas text-ink-muted text-xs font-medium rounded flex items-center gap-1.5 transition"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>Export CSV</span>
              </button>)}
            </div>
          </div>

          {/* Data Table */}
          <div className="bg-surface rounded border border-line overflow-hidden shadow-2xs flex-1 min-h-0 flex flex-col print:block">
            <div className="flex-1 min-h-0 overflow-auto print:overflow-visible [&_thead]:sticky [&_thead]:top-0 [&_thead]:z-10">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="bg-canvas border-b border-line text-ink-muted font-semibold uppercase text-[11px] tracking-wider">
                    <th className="py-2.5 px-3 w-12 text-center">SL</th>
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Conversion Code</th>
                    <th className="py-2.5 px-3">Office</th>
                    <th className="py-2.5 px-3">Warehouse</th>
                    <th className="py-2.5 px-3">Type</th>
                    <th className="py-2.5 px-3">From Item</th>
                    <th className="py-2.5 px-3 text-right">From Qty</th>
                    <th className="py-2.5 px-3">Converted Item</th>
                    <th className="py-2.5 px-3 text-right">Converted Qty</th>
                    <th className="py-2.5 px-3 text-center">Loss / Waste</th>
                    <th className="py-2.5 px-3 text-center">Status</th>
                    <th className="py-2.5 px-3 text-center w-24">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {paginatedRows.length === 0 ? (
                    <tr>
                      <td colSpan={13} className="py-8 text-center text-ink-faint">
                        No conversion records found matching the filters.
                      </td>
                    </tr>
                  ) : (
                    paginatedRows.map((row, idx) => (
                      <tr
                        key={row.code}
                        className="hover:bg-blue-50/40 dark:hover:bg-blue-500/10 transition-colors"
                      >
                        <td className="py-2 px-3 text-center text-ink-faint font-medium">
                          {(page - 1) * rowsPerPage + idx + 1}
                        </td>
                        <td className="py-2 px-3 whitespace-nowrap text-ink-muted">
                          {formatReportDate(row.conversionDate)}
                        </td>
                        <td className="py-2 px-3 font-semibold text-blue-700 dark:text-blue-300 whitespace-nowrap">
                          {row.code}
                        </td>
                        <td className="py-2 px-3 text-ink-muted whitespace-nowrap">
                          {row.office}
                        </td>
                        <td className="py-2 px-3 text-ink-muted whitespace-nowrap">
                          {row.warehouse}
                        </td>
                        <td className="py-2 px-3 text-ink-muted whitespace-nowrap">
                          <span className="px-2 py-0.5 rounded bg-control text-ink-muted border border-line">
                            {row.conversionType}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-ink font-medium max-w-xs truncate" title={row.sourceItemName}>
                          <span className="font-mono text-ink-faint mr-1">[{row.sourceItemCode}]</span>
                          {row.sourceItemName}
                        </td>
                        <td className="py-2 px-3 text-right font-medium text-ink whitespace-nowrap">
                          {row.sourceQty.toFixed(2)} <span className="text-[10px] text-ink-faint">{row.sourceUom}</span>
                        </td>
                        <td className="py-2 px-3 text-ink font-medium max-w-xs truncate" title={row.targetItemName}>
                          <span className="font-mono text-ink-faint mr-1">[{row.targetItemCode}]</span>
                          {row.targetItemName}
                        </td>
                        <td className="py-2 px-3 text-right font-medium text-ink whitespace-nowrap">
                          {row.targetQty.toFixed(2)} <span className="text-[10px] text-ink-faint">{row.targetUom}</span>
                        </td>
                        <td className="py-2 px-3 text-center whitespace-nowrap">
                          {row.wastageQty > 0 ? (
                            <span className="text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-200 dark:border-amber-500/30 text-[11px]">
                              {row.wastageQty} {row.wastageUom} ({row.wastagePercent}%)
                            </span>
                          ) : (
                            <span className="text-ink-faint">0.00</span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-center whitespace-nowrap">
                          {(row.status === "Pending" || row.status === "In Review") && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-500/30">
                              <Clock className="w-3 h-3" /> Pending
                            </span>
                          )}
                          {row.status === "Approved" && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30">
                              <CheckCircle2 className="w-3 h-3" /> Approved
                            </span>
                          )}
                          {row.status === "In Review" && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-500/30">
                              <Clock className="w-3 h-3" /> In Review
                            </span>
                          )}
                          {row.status === "Rejected" && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-500/30">
                              <XCircle className="w-3 h-3" /> Rejected
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-center whitespace-nowrap">
                          <div className="row-actions flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => setViewRecord(row)}
                              title="View Details"
                              className="p-1 text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setViewRecord(row);
                                setTimeout(() => window.print(), 200);
                              }}
                              title="Print Voucher"
                              className="p-1 text-ink-muted hover:text-ink hover:bg-control rounded"
                            >
                              <Printer className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination footer */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-3 py-2.5 bg-canvas border-t border-line text-xs text-ink-muted shrink-0">
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
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
                <span className="ml-2">
                  Showing{" "}
                  <span className="font-semibold text-ink">
                    {filteredRecords.length === 0 ? 0 : (page - 1) * rowsPerPage + 1}
                  </span>{" "}
                  -{" "}
                  <span className="font-semibold text-ink">
                    {Math.min(page * rowsPerPage, filteredRecords.length)}
                  </span>{" "}
                  of <span className="font-semibold text-ink">{filteredRecords.length}</span>
                </span>
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="p-1 rounded border border-line-strong bg-surface hover:bg-control disabled:opacity-40 disabled:hover:bg-surface"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="px-2 text-xs font-medium">
                  Page {page} of {totalPages}
                </span>
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="p-1 rounded border border-line-strong bg-surface hover:bg-control disabled:opacity-40 disabled:hover:bg-surface"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────────── */}
      {/* 4. TAB 2: REPORT VIEW (Exact match to screenshot 2)              */}
      {/* ───────────────────────────────────────────────────────────────── */}
      {activeTab === "REPORT" && (
        <div className="space-y-4 flex-1 min-h-0 flex flex-col print:block">
          {/* Report Filters (Exact 2 rows from screenshot 2) */}
          <div className="bg-surface p-3 rounded border border-line text-xs space-y-3 shrink-0">
            {/* Filter Row 1 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
              {/* Office */}
              <div>
                <select
                  value={reportOffice}
                  onChange={(e) => {
                    setReportOffice(e.target.value);
                    setReportWarehouse("");
                  }}
                  className="w-full border border-line-strong rounded px-2.5 py-1.5 bg-surface text-xs text-ink-muted focus:ring-1 focus:ring-blue-500"
                >
                  <option value="">Office</option>
                  {reportOffices.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              </div>

              {/* Warehouse */}
              <div>
                <select
                  value={reportWarehouse}
                  onChange={(e) => setReportWarehouse(e.target.value)}
                  disabled={!reportOffice}
                  aria-label="Warehouse"
                  className="w-full border border-line-strong rounded px-2.5 py-1.5 bg-surface text-xs text-ink-muted focus:ring-1 focus:ring-blue-500 disabled:bg-control disabled:text-ink-faint disabled:cursor-not-allowed"
                >
                  <option value="">{reportOffice ? "Warehouse" : "Select Office first"}</option>
                  {reportWarehouses.map((w) => (
                    <option key={w} value={w}>
                      {w}
                    </option>
                  ))}
                </select>
              </div>

              {/* From Date */}
              <div>
                <input
                  type="date"
                  value={reportFromDate}
                  onChange={(e) => setReportFromDate(e.target.value)}
                  className="w-full border border-line-strong rounded px-2.5 py-1 bg-surface text-xs text-ink-muted focus:ring-1 focus:ring-blue-500"
                />
              </div>

              {/* To Date */}
              <div>
                <input
                  type="date"
                  value={reportToDate}
                  onChange={(e) => setReportToDate(e.target.value)}
                  className="w-full border border-line-strong rounded px-2.5 py-1 bg-surface text-xs text-ink-muted focus:ring-1 focus:ring-blue-500"
                />
              </div>

              {/* View By * */}
              <div>
                <div className="relative">
                  <select
                    value={reportViewBy}
                    onChange={(e) => setReportViewBy(e.target.value)}
                    className="w-full border border-line-strong rounded px-2.5 py-1.5 bg-surface text-xs text-ink-muted focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="">View By *</option>
                    {VIEW_BY_OPTIONS.map((v) => (
                      <option key={v.value} value={v.value}>
                        {v.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Filter Row 2 */}
            <div className="flex flex-wrap items-center gap-6">
              {/* Conversion Type */}
              <div className="w-56">
                <select
                  value={reportConversionType}
                  onChange={(e) => setReportConversionType(e.target.value)}
                  className="w-full border border-line-strong rounded px-2.5 py-1.5 bg-surface text-xs text-ink-muted focus:ring-1 focus:ring-blue-500"
                >
                  <option value="">Conversion Type</option>
                  <option value="Stock Transfer">Stock Transfer</option>
                  <option value="Repackaging">Repackaging</option>
                  <option value="Unit Conversion">Unit Conversion</option>
                  <option value="Grade Categorization">Grade Categorization</option>
                  <option value="Raw to FG Conversion">Raw to FG Conversion</option>
                </select>
              </div>

              {/* Checkboxes */}
              <label className="flex items-center gap-1.5 cursor-pointer text-ink-muted select-none">
                <input
                  type="checkbox"
                  checked={includeFromItem}
                  onChange={(e) => setIncludeFromItem(e.target.checked)}
                  className="w-4 h-4 rounded border-line-strong text-blue-600 dark:text-blue-400 focus:ring-blue-500"
                />
                <span>From Item</span>
              </label>

              <label className="flex items-center gap-1.5 cursor-pointer text-ink-muted select-none">
                <input
                  type="checkbox"
                  checked={includeConvertedItem}
                  onChange={(e) => setIncludeConvertedItem(e.target.checked)}
                  className="w-4 h-4 rounded border-line-strong text-blue-600 dark:text-blue-400 focus:ring-blue-500"
                />
                <span>Converted Item</span>
              </label>

              <label className="flex items-center gap-1.5 cursor-pointer text-ink-muted select-none">
                <input
                  type="checkbox"
                  checked={onlyItem}
                  onChange={(e) => setOnlyItem(e.target.checked)}
                  className="w-4 h-4 rounded border-line-strong text-blue-600 dark:text-blue-400 focus:ring-blue-500"
                />
                <span>Only Item</span>
              </label>

              {/* View Button */}
              <button
                type="button"
                className="h-8 px-4 bg-[#1976d2] hover:bg-[#1565c0] text-white font-semibold text-xs rounded shadow-xs transition"
              >
                View
              </button>
            </div>
          </div>

          {/* Report Paper View (Exact Header as Screenshot 2) */}
          <div className="bg-surface rounded border border-line p-6 shadow-xs space-y-6 flex-1 min-h-0 flex flex-col print:block">
            {/* Centered Company Header */}
            <div className="text-center space-y-1 shrink-0">
              <h2 className="text-xl font-bold text-ink tracking-tight">
                Item Stock Conversion Report
              </h2>
              <h3 className="text-sm font-semibold text-ink">
                {masters.data?.company?.name}
              </h3>
              <p className="text-xs text-ink-muted">
                {masters.data?.company?.address}
              </p>
              <p className="text-xs font-medium text-ink-muted pt-1">
                From: {formatReportDate(reportFromDate)} &nbsp; To: {formatReportDate(reportToDate)}
              </p>
            </div>

            {/* Print and Export Toolbar */}
            <div className="flex justify-between items-center border-t border-b border-line py-2.5 print:hidden shrink-0">
              <div className="flex items-center gap-3 text-xs text-ink-muted">
                <span>View Mode: <strong className="text-ink">{reportViewBy || "Item Wise"}</strong></span>
                <span>•</span>
                <span>Scope: <strong className="text-ink">{reportOffice || "All Offices"}</strong></span>
                <span>•</span>
                <span>Warehouse: <strong className="text-ink">{reportWarehouse || "All Warehouses"}</strong></span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="h-8 px-3 bg-surface border border-line-strong hover:bg-canvas text-ink-muted text-xs font-medium rounded flex items-center gap-1.5 transition"
                >
                  <Printer className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                  <span>Print Report</span>
                </button>
                {perms.export && (<button
                  type="button"
                  onClick={handleExportReportCSV}
                  className="h-8 px-3 bg-surface border border-line-strong hover:bg-canvas text-ink-muted text-xs font-medium rounded flex items-center gap-1.5 transition"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>Export Excel / CSV</span>
                </button>)}
              </div>
            </div>

            {/* Summary Highlights */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 shrink-0">
              <div className="bg-canvas border border-line rounded p-3 text-center">
                <div className="text-[11px] font-medium text-ink-faint uppercase tracking-wide">
                  Total Input Qty
                </div>
                <div className="text-base font-bold text-ink mt-0.5">
                  {reportTotals.totalSource.toLocaleString()} Units
                </div>
              </div>
              <div className="bg-canvas border border-line rounded p-3 text-center">
                <div className="text-[11px] font-medium text-ink-faint uppercase tracking-wide">
                  Total Converted Qty
                </div>
                <div className="text-base font-bold text-blue-700 dark:text-blue-300 mt-0.5">
                  {reportTotals.totalTarget.toLocaleString()} Units
                </div>
              </div>
              <div className="bg-canvas border border-line rounded p-3 text-center">
                <div className="text-[11px] font-medium text-ink-faint uppercase tracking-wide">
                  Net Wastage / Scrap
                </div>
                <div className="text-base font-bold text-amber-700 dark:text-amber-300 mt-0.5">
                  {reportTotals.totalWastage.toLocaleString()} Units
                </div>
              </div>
              <div className="bg-canvas border border-line rounded p-3 text-center">
                <div className="text-[11px] font-medium text-ink-faint uppercase tracking-wide">
                  Avg Yield Ratio
                </div>
                <div className="text-base font-bold text-emerald-700 dark:text-emerald-300 mt-0.5">
                  {reportTotals.avgYield}%
                </div>
              </div>
            </div>

            {/* Report Table */}
            <div className="border border-line rounded flex-1 min-h-0 overflow-auto print:overflow-visible [&_thead]:sticky [&_thead]:top-0 [&_thead]:z-10">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="bg-control border-b border-line text-ink font-semibold uppercase text-[11px]">
                    <th className="py-2.5 px-3 w-10 text-center">SL</th>
                    {!onlyItem && <th className="py-2.5 px-3">Date</th>}
                    {!onlyItem && <th className="py-2.5 px-3">Code</th>}
                    {!onlyItem && <th className="py-2.5 px-3">Office</th>}
                    {!onlyItem && <th className="py-2.5 px-3">Warehouse</th>}
                    {!onlyItem && <th className="py-2.5 px-3">Type</th>}
                    {includeFromItem && <th className="py-2.5 px-3">From Item</th>}
                    {includeFromItem && <th className="py-2.5 px-3 text-right">From Qty</th>}
                    {includeConvertedItem && <th className="py-2.5 px-3">Converted Item</th>}
                    {includeConvertedItem && <th className="py-2.5 px-3 text-right">Converted Qty</th>}
                    <th className="py-2.5 px-3 text-center">Ratio</th>
                    <th className="py-2.5 px-3 text-right">Wastage</th>
                    <th className="py-2.5 px-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {reportRecords.map((r, i) => (
                    <tr key={r.code} className="hover:bg-canvas">
                      <td className="py-2 px-3 text-center text-ink-faint">{i + 1}</td>
                      {!onlyItem && (
                        <td className="py-2 px-3 whitespace-nowrap text-ink-muted">
                          {formatReportDate(r.conversionDate)}
                        </td>
                      )}
                      {!onlyItem && (
                        <td className="py-2 px-3 font-medium text-ink whitespace-nowrap">
                          {r.code}
                        </td>
                      )}
                      {!onlyItem && <td className="py-2 px-3 text-ink-muted">{r.office}</td>}
                      {!onlyItem && <td className="py-2 px-3 text-ink-muted">{r.warehouse}</td>}
                      {!onlyItem && <td className="py-2 px-3 text-ink-muted">{r.conversionType}</td>}
                      {includeFromItem && (
                        <td className="py-2 px-3 font-medium text-ink">
                          <span className="font-mono text-ink-faint mr-1">[{r.sourceItemCode}]</span>
                          {r.sourceItemName}
                        </td>
                      )}
                      {includeFromItem && (
                        <td className="py-2 px-3 text-right font-medium text-ink">
                          {r.sourceQty.toFixed(2)} {r.sourceUom}
                        </td>
                      )}
                      {includeConvertedItem && (
                        <td className="py-2 px-3 font-medium text-ink">
                          <span className="font-mono text-ink-faint mr-1">[{r.targetItemCode}]</span>
                          {r.targetItemName}
                        </td>
                      )}
                      {includeConvertedItem && (
                        <td className="py-2 px-3 text-right font-medium text-blue-700 dark:text-blue-300">
                          {r.targetQty.toFixed(2)} {r.targetUom}
                        </td>
                      )}
                      <td className="py-2 px-3 text-center text-ink-muted">{r.ratio}</td>
                      <td className="py-2 px-3 text-right text-amber-700 dark:text-amber-300 font-medium">
                        {r.wastageQty.toFixed(2)} {r.wastageUom}
                      </td>
                      <td className="py-2 px-3 text-center">
                        <span className="text-[11px] px-2 py-0.5 rounded font-medium bg-control text-ink-muted">
                          {r.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-control/90 font-bold text-ink border-t-2 border-line-strong">
                    <td colSpan={onlyItem ? 1 : 6} className="py-2.5 px-3 text-right">
                      Total:
                    </td>
                    {includeFromItem && <td className="py-2.5 px-3"></td>}
                    {includeFromItem && (
                      <td className="py-2.5 px-3 text-right text-ink">
                        {reportTotals.totalSource.toFixed(2)}
                      </td>
                    )}
                    {includeConvertedItem && <td className="py-2.5 px-3"></td>}
                    {includeConvertedItem && (
                      <td className="py-2.5 px-3 text-right text-blue-800 dark:text-blue-300">
                        {reportTotals.totalTarget.toFixed(2)}
                      </td>
                    )}
                    <td className="py-2.5 px-3 text-center">-</td>
                    <td className="py-2.5 px-3 text-right text-amber-800 dark:text-amber-300">
                      {reportTotals.totalWastage.toFixed(2)}
                    </td>
                    <td className="py-2.5 px-3 text-center"></td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Signatures for physical printing */}
            <div className="pt-12 grid grid-cols-4 gap-6 text-center text-xs text-ink-muted border-t border-line shrink-0">
              <div>
                <div className="border-t border-dashed border-line-strong pt-1 font-medium">
                  Prepared By
                </div>
              </div>
              <div>
                <div className="border-t border-dashed border-line-strong pt-1 font-medium">
                  Store In-Charge
                </div>
              </div>
              <div>
                <div className="border-t border-dashed border-line-strong pt-1 font-medium">
                  Checked & Verified By
                </div>
              </div>
              <div>
                <div className="border-t border-dashed border-line-strong pt-1 font-medium">
                  Authorised Signatory
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────────── */}
      {/* 5. CREATE NEW STOCK CONVERSION MODAL                              */}
      {/* ───────────────────────────────────────────────────────────────── */}
      <BulkUploadDialog
        open={bulkOpen}
        onClose={() => setBulkOpen(false)}
        onImported={() => docs.reload()}
        noun="item conversions"
        templateUrl={inventoryApi.importTemplateUrl("item-stock-conversion")}
        maxRows={2000}
        matchHint="Warehouse names must match existing warehouses; Item Code and To Item Code must match active items. Rows with the same Ref are saved as one conversion."
        upload={(file) => inventoryApi.importFile("item-stock-conversion", file)}
      />
      <InventoryDocumentDialog
        open={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSaved={() => docs.reload()}
        config={{
          slug: "item-stock-conversion",
          title: "Create Item Conversion",
          dateLabel: "Create Date",
          warehouses: "one",
          offices: true,
          // iBOS: one From Item (Require Qty) converted into one or more items (Qty each).
          conversion: true,
          subtype: { label: "Conversion Type", options: CONVERSION_TYPE_OPTIONS.filter((o) => o.value !== "All").map((o) => o.value) },
        }}
      />

      {viewRecord && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-2xs flex items-center justify-center p-4">
          <div className="bg-surface rounded-lg shadow-xl border border-line max-w-2xl w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between px-5 py-3.5 bg-canvas border-b border-line">
              <div>
                <h3 className="text-sm font-bold text-ink">
                  Stock Conversion Voucher: {viewRecord.code}
                </h3>
                <p className="text-[11px] text-ink-faint">
                  Date: {formatReportDate(viewRecord.conversionDate)} | Office: {viewRecord.office}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setViewRecord(null)}
                className="text-ink-faint hover:text-ink-muted p-1 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3 bg-canvas p-3 rounded border border-line">
                <div>
                  <span className="text-ink-faint">Warehouse:</span>{" "}
                  <strong className="text-ink">{viewRecord.warehouse}</strong>
                </div>
                <div>
                  <span className="text-ink-faint">Conversion Type:</span>{" "}
                  <strong className="text-ink">{viewRecord.conversionType}</strong>
                </div>
                <div>
                  <span className="text-ink-faint">Operator:</span>{" "}
                  <strong className="text-ink">{viewRecord.operator}</strong>
                </div>
                <div>
                  <span className="text-ink-faint">Current Status:</span>{" "}
                  <strong className="text-blue-700 dark:text-blue-300">{viewRecord.status}</strong>
                </div>
              </div>

              {/* Conversion Diagram Card */}
              <div className="border border-line rounded p-4 flex flex-col sm:flex-row items-center justify-between gap-4 bg-canvas/50">
                <div className="flex-1 text-center sm:text-left">
                  <div className="text-[11px] font-semibold text-ink-faint uppercase">Input Material</div>
                  <div className="text-sm font-bold text-ink">{viewRecord.sourceItemName}</div>
                  <div className="text-xs text-ink-muted font-medium">Code: {viewRecord.sourceItemCode}</div>
                  <div className="text-sm font-bold text-ink mt-1">
                    {viewRecord.sourceQty} {viewRecord.sourceUom}
                  </div>
                </div>

                <div className="flex flex-col items-center px-4">
                  <ArrowRight className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                  <span className="text-[10px] font-bold text-blue-700 dark:text-blue-300 mt-0.5">Ratio: {viewRecord.ratio}</span>
                </div>

                <div className="flex-1 text-center sm:text-right">
                  <div className="text-[11px] font-semibold text-ink-faint uppercase">Converted Output</div>
                  <div className="text-sm font-bold text-blue-900 dark:text-blue-300">{viewRecord.targetItemName}</div>
                  <div className="text-xs text-ink-muted font-medium">Code: {viewRecord.targetItemCode}</div>
                  <div className="text-sm font-bold text-blue-800 dark:text-blue-300 mt-1">
                    {viewRecord.targetQty} {viewRecord.targetUom}
                  </div>
                </div>
              </div>

              {/* Wastage & Remarks */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 bg-amber-50/70 dark:bg-amber-500/10 rounded border border-amber-200 dark:border-amber-500/30">
                  <span className="font-semibold text-amber-900 dark:text-amber-300">Recorded Wastage:</span>{" "}
                  <span className="font-bold text-amber-800 dark:text-amber-300">
                    {viewRecord.wastageQty} {viewRecord.wastageUom} ({viewRecord.wastagePercent}%)
                  </span>
                </div>
                <div className="p-3 bg-canvas rounded border border-line">
                  <span className="font-semibold text-ink-muted">Remarks:</span>{" "}
                  <span className="text-ink-muted">{viewRecord.remarks || "N/A"}</span>
                </div>
              </div>

              {/* Modal footer */}
              <div className="flex justify-between items-center pt-3 border-t border-line">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="h-8 px-3 bg-surface border border-line-strong hover:bg-canvas text-ink-muted text-xs font-medium rounded flex items-center gap-1.5 transition"
                >
                  <Printer className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                  <span>Print Slip</span>
                </button>

                <div className="flex items-center gap-2">
                  {(viewRecord.status === "Pending" || viewRecord.status === "In Review") && (
                    <button title={!perms.approve ? needsPermission("approve") : undefined}
                      type="button"
                      disabled={(approving) || !perms.approve}
                      onClick={() => approveConversion(viewRecord)}
                      className="h-8 px-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs rounded transition disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Approve Conversion
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setViewRecord(null)}
                    className="h-8 px-4 bg-control hover:bg-hover text-ink-muted font-medium text-xs rounded transition"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
