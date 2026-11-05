"use client";

import React, { useState, useMemo } from "react";
import { useToast } from "@/components/ui/toast";
import { useResource } from "@/hooks/use-resource";
import { errorMessage } from "@/lib/api/client";
import { InventoryDocumentDialog } from "@/features/inventory/components/InventoryDocumentDialog";
import type { InventoryDocument } from "@/features/inventory/schemas/document.schema";
import { inventoryApi, monthAgo, today } from "@/features/inventory/services/inventory.api";
import {
  Search,
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
} from "lucide-react";

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
  status: "Pending" | "Approved" | "Completed" | "Rejected";
  operator: string;
  remarks: string;
}

// ============================================================================
// INITIAL MOCK DATA (matches user's real Mariners Group ERP screenshot)
// ============================================================================
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
        status: d.status === "PENDING" ? "Pending" : d.status === "REJECTED" ? "Rejected" : "Completed",
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
  { value: "Repackaging", label: "Repackaging" },
  { value: "Unit Conversion", label: "Unit Conversion" },
  { value: "Grade Categorization", label: "Grade Categorization" },
  { value: "Raw to FG Conversion", label: "Raw to FG Conversion" },
];

const STATUS_OPTIONS = [
  { value: "All", label: "All Status" },
  { value: "Pending", label: "Pending" },
  { value: "Approved", label: "Approved" },
  { value: "Completed", label: "Completed" },
  { value: "Rejected", label: "Rejected" },
];

const VIEW_BY_OPTIONS = [
  { value: "Item Wise", label: "Item Wise" },
  { value: "Warehouse Wise", label: "Warehouse Wise" },
  { value: "Date Wise", label: "Date Wise" },
  { value: "Conversion Type Wise", label: "Conversion Type Wise" },
  { value: "Summary", label: "Summary Overview" },
];

export default function ItemStockConversionPage() {
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
  const [reportWarehouse, setReportWarehouse] = useState("");
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
  const OFFICE_OPTIONS = optionsOf("All", "All", records.map((r) => r.office));
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
    <div className="space-y-3 p-1 font-sans text-slate-800">
      {/* ───────────────────────────────────────────────────────────────── */}
      {/* 1. TOP HEADER (Exact match to screenshot 1 & 2)                  */}
      {/* ───────────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 rounded border border-slate-200/90 shadow-2xs">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            Item Stock Conversion
          </h1>
        </div>

        <div className="flex items-center gap-2">
          {/* Search bar */}
          <div className="relative">
            <input
              type="text"
              placeholder="Search code, item, office, warehouse..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-64 sm:w-80 h-9 pl-3 pr-8 text-xs border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white placeholder-slate-400"
            />
            <Search className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {/* Button 1: Item Stock Conversion (Layers / Clone icon) */}
          <button
            type="button"
            onClick={() => setActiveTab("CONVERSION_LIST")}
            className="h-9 px-3.5 bg-[#1976d2] hover:bg-[#1565c0] text-white font-medium text-xs rounded flex items-center gap-1.5 shadow-xs transition whitespace-nowrap"
          >
            <Copy className="w-3.5 h-3.5" />
            <span>Item Stock Conversion</span>
          </button>

          {/* Button 2: + Item Stock Conversion */}
          <button
            type="button"
            onClick={() => setIsCreateOpen(true)}
            className="h-9 px-3.5 bg-[#1976d2] hover:bg-[#1565c0] text-white font-medium text-xs rounded flex items-center gap-1.5 shadow-xs transition whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ Item Stock Conversion</span>
          </button>
        </div>
      </div>

      {/* ───────────────────────────────────────────────────────────────── */}
      {/* 2. TABS NAVIGATION (ITEM STOCK CONVERSION | REPORT)               */}
      {/* ───────────────────────────────────────────────────────────────── */}
      <div className="flex border-b border-slate-200 gap-8 text-xs font-bold uppercase tracking-wider bg-white px-3 pt-2">
        <button
          type="button"
          onClick={() => {
            setActiveTab("CONVERSION_LIST");
            setPage(1);
          }}
          className={`pb-2 whitespace-nowrap transition cursor-pointer ${
            activeTab === "CONVERSION_LIST"
              ? "border-b-2 border-blue-600 text-blue-600 font-extrabold"
              : "text-slate-500 hover:text-slate-800"
          }`}
        >
          ITEM STOCK CONVERSION
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab("REPORT");
            setPage(1);
          }}
          className={`pb-2 whitespace-nowrap transition cursor-pointer ${
            activeTab === "REPORT"
              ? "border-b-2 border-blue-600 text-blue-600 font-extrabold"
              : "text-slate-500 hover:text-slate-800"
          }`}
        >
          REPORT
        </button>
      </div>

      {/* ───────────────────────────────────────────────────────────────── */}
      {/* 3. TAB 1: ITEM STOCK CONVERSION LIST VIEW                        */}
      {/* ───────────────────────────────────────────────────────────────── */}
      {activeTab === "CONVERSION_LIST" && (
        <div className="space-y-3">
          {/* Filter Bar (Exact to Screenshot 1) */}
          <div className="bg-white p-3 rounded border border-slate-200 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-7 gap-3 items-end">
              {/* Office */}
              <div>
                <label className="block text-[11px] text-slate-600 mb-1 font-medium">
                  Office
                </label>
                <div className="relative">
                  <select
                    value={officeFilter}
                    onChange={(e) => setOfficeFilter(e.target.value)}
                    className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white text-xs focus:ring-1 focus:ring-blue-500 appearance-none text-slate-700"
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
                <label className="block text-[11px] text-slate-600 mb-1 font-medium">
                  Conversion Type
                </label>
                <div className="relative">
                  <select
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value)}
                    className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white text-xs focus:ring-1 focus:ring-blue-500 appearance-none text-slate-700"
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
                <label className="block text-[11px] text-slate-600 mb-1 font-medium">
                  Bundled Item
                </label>
                <div className="relative">
                  <select
                    value={bundledItemFilter}
                    onChange={(e) => setBundledItemFilter(e.target.value)}
                    className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white text-xs focus:ring-1 focus:ring-blue-500 appearance-none text-slate-700 pr-8"
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
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* From Date */}
              <div>
                <label className="block text-[11px] text-slate-600 mb-1 font-medium">
                  From Date
                </label>
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="w-full border border-slate-300 rounded px-2.5 py-1 bg-white text-xs focus:ring-1 focus:ring-blue-500 text-slate-700"
                />
              </div>

              {/* To Date */}
              <div>
                <label className="block text-[11px] text-slate-600 mb-1 font-medium">
                  To Date
                </label>
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="w-full border border-slate-300 rounded px-2.5 py-1 bg-white text-xs focus:ring-1 focus:ring-blue-500 text-slate-700"
                />
              </div>

              {/* Status & View Button */}
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <label className="block text-[11px] text-slate-600 mb-1 font-medium">
                    Status
                  </label>
                  <div className="relative">
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      className="w-full border border-slate-300 rounded px-2 py-1.5 bg-white text-xs focus:ring-1 focus:ring-blue-500 appearance-none text-slate-700 pr-6"
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
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
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
          <div className="flex justify-between items-center px-1">
            <div className="text-xs text-slate-500 font-medium">
              Found <span className="font-bold text-slate-800">{filteredRecords.length}</span> conversion records
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleExportListCSV}
                className="h-8 px-3 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-medium rounded flex items-center gap-1.5 transition"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                <span>Export CSV</span>
              </button>
            </div>
          </div>

          {/* Data Table */}
          <div className="bg-white rounded border border-slate-200 overflow-hidden shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 font-semibold uppercase text-[11px] tracking-wider">
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
                <tbody className="divide-y divide-slate-100">
                  {paginatedRows.length === 0 ? (
                    <tr>
                      <td colSpan={13} className="py-8 text-center text-slate-400">
                        No conversion records found matching the filters.
                      </td>
                    </tr>
                  ) : (
                    paginatedRows.map((row, idx) => (
                      <tr
                        key={row.code}
                        className="hover:bg-blue-50/40 transition-colors"
                      >
                        <td className="py-2 px-3 text-center text-slate-500 font-medium">
                          {(page - 1) * rowsPerPage + idx + 1}
                        </td>
                        <td className="py-2 px-3 whitespace-nowrap text-slate-600">
                          {formatReportDate(row.conversionDate)}
                        </td>
                        <td className="py-2 px-3 font-semibold text-blue-700 whitespace-nowrap">
                          {row.code}
                        </td>
                        <td className="py-2 px-3 text-slate-700 whitespace-nowrap">
                          {row.office}
                        </td>
                        <td className="py-2 px-3 text-slate-700 whitespace-nowrap">
                          {row.warehouse}
                        </td>
                        <td className="py-2 px-3 text-slate-600 whitespace-nowrap">
                          <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                            {row.conversionType}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-slate-900 font-medium max-w-xs truncate" title={row.sourceItemName}>
                          <span className="font-mono text-slate-500 mr-1">[{row.sourceItemCode}]</span>
                          {row.sourceItemName}
                        </td>
                        <td className="py-2 px-3 text-right font-medium text-slate-900 whitespace-nowrap">
                          {row.sourceQty.toFixed(2)} <span className="text-[10px] text-slate-500">{row.sourceUom}</span>
                        </td>
                        <td className="py-2 px-3 text-slate-900 font-medium max-w-xs truncate" title={row.targetItemName}>
                          <span className="font-mono text-slate-500 mr-1">[{row.targetItemCode}]</span>
                          {row.targetItemName}
                        </td>
                        <td className="py-2 px-3 text-right font-medium text-slate-900 whitespace-nowrap">
                          {row.targetQty.toFixed(2)} <span className="text-[10px] text-slate-500">{row.targetUom}</span>
                        </td>
                        <td className="py-2 px-3 text-center whitespace-nowrap">
                          {row.wastageQty > 0 ? (
                            <span className="text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 text-[11px]">
                              {row.wastageQty} {row.wastageUom} ({row.wastagePercent}%)
                            </span>
                          ) : (
                            <span className="text-slate-400">0.00</span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-center whitespace-nowrap">
                          {row.status === "Pending" && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                              <Clock className="w-3 h-3" /> Pending
                            </span>
                          )}
                          {row.status === "Approved" && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3" /> Approved
                            </span>
                          )}
                          {row.status === "Completed" && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                              <CheckCircle2 className="w-3 h-3" /> Completed
                            </span>
                          )}
                          {row.status === "Rejected" && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                              <XCircle className="w-3 h-3" /> Rejected
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => setViewRecord(row)}
                              title="View Details"
                              className="p-1 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded"
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
                              className="p-1 text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded"
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
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-3 py-2.5 bg-slate-50 border-t border-slate-200 text-xs text-slate-600">
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
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
                <span className="ml-2">
                  Showing{" "}
                  <span className="font-semibold text-slate-800">
                    {filteredRecords.length === 0 ? 0 : (page - 1) * rowsPerPage + 1}
                  </span>{" "}
                  -{" "}
                  <span className="font-semibold text-slate-800">
                    {Math.min(page * rowsPerPage, filteredRecords.length)}
                  </span>{" "}
                  of <span className="font-semibold text-slate-800">{filteredRecords.length}</span>
                </span>
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="p-1 rounded border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-white"
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
                  className="p-1 rounded border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-white"
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
        <div className="space-y-4">
          {/* Report Filters (Exact 2 rows from screenshot 2) */}
          <div className="bg-white p-3 rounded border border-slate-200 text-xs space-y-3">
            {/* Filter Row 1 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
              {/* Office */}
              <div>
                <select
                  value={reportOffice}
                  onChange={(e) => setReportOffice(e.target.value)}
                  className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white text-xs text-slate-600 focus:ring-1 focus:ring-blue-500"
                >
                  <option value="">Office</option>
                  <option value="MG Sirajganj Factory">MG Sirajganj Factory</option>
                  <option value="Dhaka Head Office">Dhaka Head Office</option>
                  <option value="Marinozz">Marinozz</option>
                  <option value="MOHS Eco">MOHS Eco</option>
                </select>
              </div>

              {/* Warehouse */}
              <div>
                <select
                  value={reportWarehouse}
                  onChange={(e) => setReportWarehouse(e.target.value)}
                  className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white text-xs text-slate-600 focus:ring-1 focus:ring-blue-500"
                >
                  <option value="">Warehouse</option>
                  <option value="Material WH">Material WH</option>
                  <option value="PD Biscuit Store">PD Biscuit Store</option>
                  <option value="PD Snacks Store">PD Snacks Store</option>
                  <option value="Finished Goods (FG) WH">Finished Goods (FG) WH</option>
                </select>
              </div>

              {/* From Date */}
              <div>
                <input
                  type="date"
                  value={reportFromDate}
                  onChange={(e) => setReportFromDate(e.target.value)}
                  className="w-full border border-slate-300 rounded px-2.5 py-1 bg-white text-xs text-slate-700 focus:ring-1 focus:ring-blue-500"
                />
              </div>

              {/* To Date */}
              <div>
                <input
                  type="date"
                  value={reportToDate}
                  onChange={(e) => setReportToDate(e.target.value)}
                  className="w-full border border-slate-300 rounded px-2.5 py-1 bg-white text-xs text-slate-700 focus:ring-1 focus:ring-blue-500"
                />
              </div>

              {/* View By * */}
              <div>
                <div className="relative">
                  <select
                    value={reportViewBy}
                    onChange={(e) => setReportViewBy(e.target.value)}
                    className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white text-xs text-slate-700 focus:ring-1 focus:ring-blue-500"
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
                  className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white text-xs text-slate-600 focus:ring-1 focus:ring-blue-500"
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
              <label className="flex items-center gap-1.5 cursor-pointer text-slate-700 select-none">
                <input
                  type="checkbox"
                  checked={includeFromItem}
                  onChange={(e) => setIncludeFromItem(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span>From Item</span>
              </label>

              <label className="flex items-center gap-1.5 cursor-pointer text-slate-700 select-none">
                <input
                  type="checkbox"
                  checked={includeConvertedItem}
                  onChange={(e) => setIncludeConvertedItem(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span>Converted Item</span>
              </label>

              <label className="flex items-center gap-1.5 cursor-pointer text-slate-700 select-none">
                <input
                  type="checkbox"
                  checked={onlyItem}
                  onChange={(e) => setOnlyItem(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
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
          <div className="bg-white rounded border border-slate-200 p-6 shadow-xs space-y-6">
            {/* Centered Company Header */}
            <div className="text-center space-y-1">
              <h2 className="text-xl font-bold text-slate-900 tracking-tight">
                Item Stock Conversion Report
              </h2>
              <h3 className="text-sm font-semibold text-slate-800">
                Mariners Group
              </h3>
              <p className="text-xs text-slate-600">
                10th Floor, MG SAM Center, 12 Bir Uttam A. K. Khandakar Road, Mohakhali C/A, Dhaka-1212, Bangladesh
              </p>
              <p className="text-xs font-medium text-slate-700 pt-1">
                From: {formatReportDate(reportFromDate)} &nbsp; To: {formatReportDate(reportToDate)}
              </p>
            </div>

            {/* Print and Export Toolbar */}
            <div className="flex justify-between items-center border-t border-b border-slate-200 py-2.5 print:hidden">
              <div className="flex items-center gap-3 text-xs text-slate-600">
                <span>View Mode: <strong className="text-slate-900">{reportViewBy || "Item Wise"}</strong></span>
                <span>•</span>
                <span>Scope: <strong className="text-slate-900">{reportOffice || "All Offices"}</strong></span>
                <span>•</span>
                <span>Warehouse: <strong className="text-slate-900">{reportWarehouse || "All Warehouses"}</strong></span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="h-8 px-3 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-medium rounded flex items-center gap-1.5 transition"
                >
                  <Printer className="w-3.5 h-3.5 text-blue-600" />
                  <span>Print Report</span>
                </button>
                <button
                  type="button"
                  onClick={handleExportReportCSV}
                  className="h-8 px-3 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-medium rounded flex items-center gap-1.5 transition"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Export Excel / CSV</span>
                </button>
              </div>
            </div>

            {/* Summary Highlights */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-slate-50 border border-slate-200 rounded p-3 text-center">
                <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">
                  Total Input Qty
                </div>
                <div className="text-base font-bold text-slate-900 mt-0.5">
                  {reportTotals.totalSource.toLocaleString()} Units
                </div>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded p-3 text-center">
                <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">
                  Total Converted Qty
                </div>
                <div className="text-base font-bold text-blue-700 mt-0.5">
                  {reportTotals.totalTarget.toLocaleString()} Units
                </div>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded p-3 text-center">
                <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">
                  Net Wastage / Scrap
                </div>
                <div className="text-base font-bold text-amber-700 mt-0.5">
                  {reportTotals.totalWastage.toLocaleString()} Units
                </div>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded p-3 text-center">
                <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">
                  Avg Yield Ratio
                </div>
                <div className="text-base font-bold text-emerald-700 mt-0.5">
                  {reportTotals.avgYield}%
                </div>
              </div>
            </div>

            {/* Report Table */}
            <div className="border border-slate-200 rounded overflow-hidden">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-200 text-slate-800 font-semibold uppercase text-[11px]">
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
                <tbody className="divide-y divide-slate-200">
                  {reportRecords.map((r, i) => (
                    <tr key={r.code} className="hover:bg-slate-50">
                      <td className="py-2 px-3 text-center text-slate-500">{i + 1}</td>
                      {!onlyItem && (
                        <td className="py-2 px-3 whitespace-nowrap text-slate-600">
                          {formatReportDate(r.conversionDate)}
                        </td>
                      )}
                      {!onlyItem && (
                        <td className="py-2 px-3 font-medium text-slate-900 whitespace-nowrap">
                          {r.code}
                        </td>
                      )}
                      {!onlyItem && <td className="py-2 px-3 text-slate-700">{r.office}</td>}
                      {!onlyItem && <td className="py-2 px-3 text-slate-700">{r.warehouse}</td>}
                      {!onlyItem && <td className="py-2 px-3 text-slate-600">{r.conversionType}</td>}
                      {includeFromItem && (
                        <td className="py-2 px-3 font-medium text-slate-900">
                          <span className="font-mono text-slate-500 mr-1">[{r.sourceItemCode}]</span>
                          {r.sourceItemName}
                        </td>
                      )}
                      {includeFromItem && (
                        <td className="py-2 px-3 text-right font-medium text-slate-900">
                          {r.sourceQty.toFixed(2)} {r.sourceUom}
                        </td>
                      )}
                      {includeConvertedItem && (
                        <td className="py-2 px-3 font-medium text-slate-900">
                          <span className="font-mono text-slate-500 mr-1">[{r.targetItemCode}]</span>
                          {r.targetItemName}
                        </td>
                      )}
                      {includeConvertedItem && (
                        <td className="py-2 px-3 text-right font-medium text-blue-700">
                          {r.targetQty.toFixed(2)} {r.targetUom}
                        </td>
                      )}
                      <td className="py-2 px-3 text-center text-slate-600">{r.ratio}</td>
                      <td className="py-2 px-3 text-right text-amber-700 font-medium">
                        {r.wastageQty.toFixed(2)} {r.wastageUom}
                      </td>
                      <td className="py-2 px-3 text-center">
                        <span className="text-[11px] px-2 py-0.5 rounded font-medium bg-slate-100 text-slate-700">
                          {r.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-100/90 font-bold text-slate-900 border-t-2 border-slate-300">
                    <td colSpan={onlyItem ? 1 : 6} className="py-2.5 px-3 text-right">
                      Total:
                    </td>
                    {includeFromItem && <td className="py-2.5 px-3"></td>}
                    {includeFromItem && (
                      <td className="py-2.5 px-3 text-right text-slate-900">
                        {reportTotals.totalSource.toFixed(2)}
                      </td>
                    )}
                    {includeConvertedItem && <td className="py-2.5 px-3"></td>}
                    {includeConvertedItem && (
                      <td className="py-2.5 px-3 text-right text-blue-800">
                        {reportTotals.totalTarget.toFixed(2)}
                      </td>
                    )}
                    <td className="py-2.5 px-3 text-center">-</td>
                    <td className="py-2.5 px-3 text-right text-amber-800">
                      {reportTotals.totalWastage.toFixed(2)}
                    </td>
                    <td className="py-2.5 px-3 text-center"></td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Signatures for physical printing */}
            <div className="pt-12 grid grid-cols-4 gap-6 text-center text-xs text-slate-600 border-t border-slate-200">
              <div>
                <div className="border-t border-dashed border-slate-400 pt-1 font-medium">
                  Prepared By
                </div>
              </div>
              <div>
                <div className="border-t border-dashed border-slate-400 pt-1 font-medium">
                  Store In-Charge
                </div>
              </div>
              <div>
                <div className="border-t border-dashed border-slate-400 pt-1 font-medium">
                  Checked & Verified By
                </div>
              </div>
              <div>
                <div className="border-t border-dashed border-slate-400 pt-1 font-medium">
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
      <InventoryDocumentDialog
        open={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSaved={() => docs.reload()}
        config={{
          slug: "item-stock-conversion",
          title: "New Item Stock Conversion",
          warehouses: "one",
          conversion: true,
          subtype: { label: "Conversion type", options: CONVERSION_TYPE_OPTIONS.filter((o) => o.value !== "All").map((o) => o.value) },
        }}
      />

      {viewRecord && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-2xs flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl border border-slate-200 max-w-2xl w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between px-5 py-3.5 bg-slate-50 border-b border-slate-200">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Stock Conversion Voucher: {viewRecord.code}
                </h3>
                <p className="text-[11px] text-slate-500">
                  Date: {formatReportDate(viewRecord.conversionDate)} | Office: {viewRecord.office}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setViewRecord(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded border border-slate-200">
                <div>
                  <span className="text-slate-500">Warehouse:</span>{" "}
                  <strong className="text-slate-800">{viewRecord.warehouse}</strong>
                </div>
                <div>
                  <span className="text-slate-500">Conversion Type:</span>{" "}
                  <strong className="text-slate-800">{viewRecord.conversionType}</strong>
                </div>
                <div>
                  <span className="text-slate-500">Operator:</span>{" "}
                  <strong className="text-slate-800">{viewRecord.operator}</strong>
                </div>
                <div>
                  <span className="text-slate-500">Current Status:</span>{" "}
                  <strong className="text-blue-700">{viewRecord.status}</strong>
                </div>
              </div>

              {/* Conversion Diagram Card */}
              <div className="border border-slate-200 rounded p-4 flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-50/50">
                <div className="flex-1 text-center sm:text-left">
                  <div className="text-[11px] font-semibold text-slate-500 uppercase">Input Material</div>
                  <div className="text-sm font-bold text-slate-900">{viewRecord.sourceItemName}</div>
                  <div className="text-xs text-slate-600 font-medium">Code: {viewRecord.sourceItemCode}</div>
                  <div className="text-sm font-bold text-slate-800 mt-1">
                    {viewRecord.sourceQty} {viewRecord.sourceUom}
                  </div>
                </div>

                <div className="flex flex-col items-center px-4">
                  <ArrowRight className="w-6 h-6 text-blue-600" />
                  <span className="text-[10px] font-bold text-blue-700 mt-0.5">Ratio: {viewRecord.ratio}</span>
                </div>

                <div className="flex-1 text-center sm:text-right">
                  <div className="text-[11px] font-semibold text-slate-500 uppercase">Converted Output</div>
                  <div className="text-sm font-bold text-blue-900">{viewRecord.targetItemName}</div>
                  <div className="text-xs text-slate-600 font-medium">Code: {viewRecord.targetItemCode}</div>
                  <div className="text-sm font-bold text-blue-800 mt-1">
                    {viewRecord.targetQty} {viewRecord.targetUom}
                  </div>
                </div>
              </div>

              {/* Wastage & Remarks */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 bg-amber-50/70 rounded border border-amber-200">
                  <span className="font-semibold text-amber-900">Recorded Wastage:</span>{" "}
                  <span className="font-bold text-amber-800">
                    {viewRecord.wastageQty} {viewRecord.wastageUom} ({viewRecord.wastagePercent}%)
                  </span>
                </div>
                <div className="p-3 bg-slate-50 rounded border border-slate-200">
                  <span className="font-semibold text-slate-700">Remarks:</span>{" "}
                  <span className="text-slate-600">{viewRecord.remarks || "N/A"}</span>
                </div>
              </div>

              {/* Modal footer */}
              <div className="flex justify-between items-center pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="h-8 px-3 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-medium rounded flex items-center gap-1.5 transition"
                >
                  <Printer className="w-3.5 h-3.5 text-blue-600" />
                  <span>Print Slip</span>
                </button>

                <div className="flex items-center gap-2">
                  {viewRecord.status === "Pending" && (
                    <button
                      type="button"
                      disabled={approving}
                      onClick={() => approveConversion(viewRecord)}
                      className="h-8 px-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs rounded transition"
                    >
                      Approve Conversion
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setViewRecord(null)}
                    className="h-8 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-xs rounded transition"
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
