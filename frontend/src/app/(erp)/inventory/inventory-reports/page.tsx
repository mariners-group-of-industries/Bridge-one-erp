"use client";

import React, { useState, useMemo } from "react";
import { useResource } from "@/hooks/use-resource";
import { inventoryApi, monthAgo, today } from "@/features/inventory/services/inventory.api";
import {
  Search,
  Download,
  Printer,
  ChevronLeft,
  ChevronRight,
  X,
} from "lucide-react";

// ============================================================================
// TYPES
// ============================================================================
interface InventoryReportItem {
  sl: number;
  itemCode: string;
  itemName: string;
  itemType: string;
  category: string;
  subCategory: string;
  warehouse: string;
  office: string;
  supplier: string;
  openingQty: number;
  inQty: number;
  outQty: number;
  closingQty: number;
  uom: string;
  netWeightKg: number;
  unitRate: number;
  totalValuation: number;
  status: "In Stock" | "Low Stock" | "Reorder Required";
}

const distinct = (placeholder: string, values: string[]) => [placeholder, ...[...new Set(values.filter(Boolean))].sort()];

export default function InventoryReportPage() {
  // View By selector
  const [viewBy, setViewBy] = useState("Inventory Report");

  // Top Filter state
  const [searchTerm, setSearchTerm] = useState("");
  const [office, setOffice] = useState("All");
  const [warehouse, setWarehouse] = useState("All");
  const [itemType, setItemType] = useState("All");
  const [itemCategory, setItemCategory] = useState("Item Category");
  const [subCategory, setSubCategory] = useState("Select Sub Category");
  const [minorCategory, setMinorCategory] = useState("Select Minor Category");
  const [supplier, setSupplier] = useState("Select/Search Supplier");
  const [fromDate, setFromDate] = useState(monthAgo());
  const [toDate, setToDate] = useState(today());
  // Opening / in / out / closing from the stock ledger for the period applied with View.
  const [period, setPeriod] = useState({ from: fromDate, to: toDate });
  const report = useResource(`inventory-report-${period.from}-${period.to}`, () => inventoryApi.inventoryReport(period));
  const items = useMemo<InventoryReportItem[]>(
    () =>
      (report.data ?? []).map((r, i) => ({
        sl: i + 1,
        itemCode: r.itemCode,
        itemName: r.itemName,
        itemType: r.itemType,
        category: r.category,
        subCategory: "",
        warehouse: r.warehouse,
        office: r.office,
        supplier: "",
        openingQty: r.openingQty,
        inQty: r.inQty,
        outQty: r.outQty,
        closingQty: r.closingQty,
        uom: r.uom,
        netWeightKg: Math.round(r.netWeight * r.closingQty * 1000) / 1000,
        unitRate: r.rate,
        totalValuation: r.value,
        status: r.closingQty <= 0 ? "Reorder Required" : "In Stock",
      })),
    [report.data],
  );
  const OFFICE_LIST = distinct("All", items.map((i) => i.office));
  const WAREHOUSE_LIST = distinct("All", items.map((i) => i.warehouse));
  const ITEM_TYPES = distinct("All", items.map((i) => i.itemType));
  const ITEM_CATEGORIES = distinct("Item Category", items.map((i) => i.category));
  const SUB_CATEGORIES = ["Select Sub Category"];
  const MINOR_CATEGORIES = ["Select Minor Category"];
  const SUPPLIERS = ["Select/Search Supplier"];
  const [showNetWeight, setShowNetWeight] = useState(false);

  // Pagination
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(25);

  // Filtered dataset
  const filteredData = useMemo(() => {
    return items.filter((item) => {
      if (office !== "All" && item.office !== office) return false;
      if (warehouse !== "All" && item.warehouse !== warehouse) return false;
      if (itemType !== "All" && item.itemType !== itemType) return false;
      if (itemCategory !== "Item Category" && item.category !== itemCategory) return false;
      if (subCategory !== "Select Sub Category" && item.subCategory !== subCategory) return false;
      if (supplier !== "Select/Search Supplier" && item.supplier !== supplier) return false;

      if (searchTerm) {
        const q = searchTerm.toLowerCase();
        return (
          item.itemCode.toLowerCase().includes(q) ||
          item.itemName.toLowerCase().includes(q) ||
          item.category.toLowerCase().includes(q) ||
          item.warehouse.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [items, office, warehouse, itemType, itemCategory, subCategory, supplier, searchTerm]);

  // Aggregated Totals
  const totals = useMemo(() => {
    const totalClosingValuation = filteredData.reduce((acc, i) => acc + i.totalValuation, 0);
    const totalInQty = filteredData.reduce((acc, i) => acc + i.inQty, 0);
    const totalOutQty = filteredData.reduce((acc, i) => acc + i.outQty, 0);
    const totalClosingQty = filteredData.reduce((acc, i) => acc + i.closingQty, 0);
    const totalWeightKg = filteredData.reduce((acc, i) => acc + i.netWeightKg, 0);
    return {
      totalClosingValuation,
      totalInQty,
      totalOutQty,
      totalClosingQty,
      totalWeightKg,
    };
  }, [filteredData]);

  // Paginated Rows
  const totalPages = Math.ceil(filteredData.length / rowsPerPage) || 1;
  const paginatedRows = useMemo(() => {
    const start = (page - 1) * rowsPerPage;
    return filteredData.slice(start, start + rowsPerPage);
  }, [filteredData, page, rowsPerPage]);

  // Format Date for report
  const formatDateDisplay = (d: string) => {
    if (!d) return "";
    const p = d.split("-");
    if (p.length === 3) {
      return `${p[2]}-${p[1]}-${p[0]}`;
    }
    return d;
  };

  // CSV Export
  const handleExportCSV = () => {
    const headers = [
      "SL",
      "Item Code",
      "Item Name",
      "Item Type",
      "Category",
      "Warehouse",
      "Opening Qty",
      "In Qty",
      "Out Qty",
      "Closing Qty",
      "UOM",
      ...(showNetWeight ? ["Net Weight (Kg)"] : []),
      "Unit Rate (BDT)",
      "Total Valuation (BDT)",
      "Status",
    ];

    const rows = filteredData.map((item, idx) => [
      idx + 1,
      item.itemCode,
      `"${item.itemName.replace(/"/g, '""')}"`,
      `"${item.itemType}"`,
      `"${item.category}"`,
      `"${item.warehouse}"`,
      item.openingQty,
      item.inQty,
      item.outQty,
      item.closingQty,
      item.uom,
      ...(showNetWeight ? [item.netWeightKg] : []),
      item.unitRate,
      item.totalValuation,
      item.status,
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");

    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(csvContent));
    link.setAttribute(
      "download",
      `inventory_report_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-3 p-1 font-sans text-slate-800">
      {/* ───────────────────────────────────────────────────────────────── */}
      {/* 1. TOP HEADER (Exact to Screenshot 1)                            */}
      {/* ───────────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 rounded border border-slate-200/90 shadow-2xs">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            Inventory Report
          </h1>
        </div>

        <div className="flex items-center gap-2">
          {/* Search bar */}
          <div className="relative">
            <input
              type="text"
              placeholder="Search...."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-56 sm:w-64 h-9 pl-3 pr-8 text-xs border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white placeholder-slate-400"
            />
            <Search className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {/* EXCEL Button */}
          <button
            type="button"
            onClick={handleExportCSV}
            className="h-9 px-3.5 bg-white hover:bg-slate-50 text-[#1976d2] border border-[#1976d2] font-semibold text-xs rounded flex items-center gap-1.5 shadow-2xs transition"
          >
            <Download className="w-3.5 h-3.5" />
            <span>EXCEL</span>
          </button>

          {/* PRINT/PDF Button */}
          <button
            type="button"
            onClick={() => window.print()}
            className="h-9 px-3.5 bg-white hover:bg-slate-50 text-[#1976d2] border border-[#1976d2] font-semibold text-xs rounded flex items-center gap-1.5 shadow-2xs transition"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>PRINT/PDF</span>
          </button>
        </div>
      </div>

      {/* ───────────────────────────────────────────────────────────────── */}
      {/* 2. FILTER CONTROLS (Exact layout to Screenshot 1)                */}
      {/* ───────────────────────────────────────────────────────────────── */}
      <div className="bg-white p-3 rounded border border-slate-200 space-y-3 text-xs">
        {/* Row 1: View By * */}
        <div>
          <label className="block text-[11px] font-semibold text-slate-700 mb-1">
            View By <span className="text-rose-500 font-bold">*</span>
          </label>
          <select
            value={viewBy}
            onChange={(e) => setViewBy(e.target.value)}
            className="w-full sm:w-80 border border-slate-300 rounded px-2.5 py-1.5 bg-white text-xs text-slate-700 focus:ring-1 focus:ring-blue-500"
          >
            <option value="Inventory Report">Inventory Report</option>
            <option value="Stock Ledger Summary">Stock Ledger Summary</option>
            <option value="Item Aging Analysis">Item Aging Analysis</option>
            <option value="Reorder & Low Stock Report">Reorder & Low Stock Report</option>
            <option value="Warehouse Valuation Report">Warehouse Valuation Report</option>
          </select>
        </div>

        {/* Row 2: Office, Warehouse, Item Type, Item Category, Sub Category, Minor Category */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-6 gap-2.5">
          {/* Office */}
          <div>
            <label className="block text-[11px] text-slate-600 mb-1 font-medium">
              Office
            </label>
            <div className="relative flex items-center border border-slate-300 rounded bg-white px-2 py-1">
              <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded text-[10px] mr-1">
                {office}
                {office !== "All" && (
                  <button type="button" onClick={() => setOffice("All")}>
                    <X className="w-2.5 h-2.5 text-slate-400 hover:text-slate-600" />
                  </button>
                )}
              </span>
              <select
                value={office}
                onChange={(e) => setOffice(e.target.value)}
                className="w-full bg-transparent text-xs text-slate-700 focus:outline-none opacity-0 absolute inset-0 cursor-pointer"
              >
                {OFFICE_LIST.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Warehouse (Location) */}
          <div>
            <label className="block text-[11px] text-slate-600 mb-1 font-medium">
              Warehouse (Location)
            </label>
            <div className="relative flex items-center border border-slate-300 rounded bg-white px-2 py-1">
              <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded text-[10px] mr-1">
                {warehouse}
                {warehouse !== "All" && (
                  <button type="button" onClick={() => setWarehouse("All")}>
                    <X className="w-2.5 h-2.5 text-slate-400 hover:text-slate-600" />
                  </button>
                )}
              </span>
              <select
                value={warehouse}
                onChange={(e) => setWarehouse(e.target.value)}
                className="w-full bg-transparent text-xs text-slate-700 focus:outline-none opacity-0 absolute inset-0 cursor-pointer"
              >
                {WAREHOUSE_LIST.map((w) => (
                  <option key={w} value={w}>
                    {w}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Item Type */}
          <div>
            <label className="block text-[11px] text-slate-600 mb-1 font-medium">
              Item Type
            </label>
            <div className="relative flex items-center border border-slate-300 rounded bg-white px-2 py-1">
              <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded text-[10px] mr-1">
                {itemType}
                {itemType !== "All" && (
                  <button type="button" onClick={() => setItemType("All")}>
                    <X className="w-2.5 h-2.5 text-slate-400 hover:text-slate-600" />
                  </button>
                )}
              </span>
              <select
                value={itemType}
                onChange={(e) => setItemType(e.target.value)}
                className="w-full bg-transparent text-xs text-slate-700 focus:outline-none opacity-0 absolute inset-0 cursor-pointer"
              >
                {ITEM_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Item Category */}
          <div>
            <label className="block text-[11px] text-slate-600 mb-1 font-medium">
              Item Category
            </label>
            <select
              value={itemCategory}
              onChange={(e) => setItemCategory(e.target.value)}
              className="w-full border border-slate-300 rounded px-2 py-1.5 bg-white text-xs text-slate-600 focus:ring-1 focus:ring-blue-500"
            >
              {ITEM_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {/* Sub Category */}
          <div>
            <label className="block text-[11px] text-slate-600 mb-1 font-medium">
              Sub Category
            </label>
            <select
              value={subCategory}
              onChange={(e) => setSubCategory(e.target.value)}
              className="w-full border border-slate-300 rounded px-2 py-1.5 bg-white text-xs text-slate-600 focus:ring-1 focus:ring-blue-500"
            >
              {SUB_CATEGORIES.map((sc) => (
                <option key={sc} value={sc}>
                  {sc}
                </option>
              ))}
            </select>
          </div>

          {/* Minor Category */}
          <div>
            <label className="block text-[11px] text-slate-600 mb-1 font-medium">
              Minor Category
            </label>
            <select
              value={minorCategory}
              onChange={(e) => setMinorCategory(e.target.value)}
              className="w-full border border-slate-300 rounded px-2 py-1.5 bg-white text-xs text-slate-600 focus:ring-1 focus:ring-blue-500"
            >
              {MINOR_CATEGORIES.map((mc) => (
                <option key={mc} value={mc}>
                  {mc}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Row 3: Supplier, From Date, To Date, Net Weight, View Button */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-6 gap-2.5 items-end">
          {/* Supplier */}
          <div className="md:col-span-2">
            <label className="block text-[11px] text-slate-600 mb-1 font-medium">
              Supplier
            </label>
            <select
              value={supplier}
              onChange={(e) => setSupplier(e.target.value)}
              className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white text-xs text-slate-600 focus:ring-1 focus:ring-blue-500"
            >
              {SUPPLIERS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
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
              className="w-full border border-slate-300 rounded px-2.5 py-1 bg-white text-xs text-slate-700 focus:ring-1 focus:ring-blue-500"
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
              className="w-full border border-slate-300 rounded px-2.5 py-1 bg-white text-xs text-slate-700 focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Net Weight Checkbox */}
          <div className="flex items-center pb-2">
            <label className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showNetWeight}
                onChange={(e) => setShowNetWeight(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <span>Net Weight</span>
            </label>
          </div>

          {/* View Button */}
          <div>
            <button
              type="button"
              onClick={() => {
                setPeriod({ from: fromDate, to: toDate });
                setPage(1);
              }}
              disabled={!fromDate || !toDate || fromDate > toDate}
              className="h-8 w-24 bg-[#1976d2] hover:bg-[#1565c0] text-white font-semibold text-xs rounded shadow-xs transition"
            >
              {report.loading ? "Loading…" : "View"}
            </button>
          </div>
        </div>
      </div>

      {/* ───────────────────────────────────────────────────────────────── */}
      {/* 3. REPORT DOCUMENT AREA (Mariners Group Layout)                  */}
      {/* ───────────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded border border-slate-200 p-6 shadow-xs space-y-6">
        {/* Centered Organization Header */}
        <div className="text-center space-y-1">
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            {viewBy}
          </h2>
          <h3 className="text-sm font-semibold text-slate-800">
            Mariners Group
          </h3>
          <p className="text-xs text-slate-600">
            10th Floor, MG SAM Center, 12 Bir Uttam A. K. Khandakar Road, Mohakhali C/A, Dhaka-1212, Bangladesh
          </p>
          <p className="text-xs font-medium text-slate-700 pt-1">
            From: {formatDateDisplay(fromDate)} &nbsp; To: {formatDateDisplay(toDate)}
          </p>
        </div>

        {/* Highlight KPI Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 print:hidden">
          <div className="bg-slate-50 border border-slate-200 rounded p-3 text-center">
            <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">
              Total Stock Valuation
            </div>
            <div className="text-base font-bold text-slate-900 mt-0.5">
              ৳ {totals.totalClosingValuation.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </div>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded p-3 text-center">
            <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">
              Total Inward Stock
            </div>
            <div className="text-base font-bold text-blue-700 mt-0.5">
              {totals.totalInQty.toLocaleString()} Units
            </div>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded p-3 text-center">
            <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">
              Total Outward Stock
            </div>
            <div className="text-base font-bold text-amber-700 mt-0.5">
              {totals.totalOutQty.toLocaleString()} Units
            </div>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded p-3 text-center">
            <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">
              Filtered Item Lines
            </div>
            <div className="text-base font-bold text-emerald-700 mt-0.5">
              {filteredData.length} Items
            </div>
          </div>
        </div>

        {/* Data Table */}
        <div className="border border-slate-200 rounded overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-200 text-slate-800 font-semibold uppercase text-[11px]">
                  <th className="py-2.5 px-3 w-10 text-center">SL</th>
                  <th className="py-2.5 px-3">Item Code</th>
                  <th className="py-2.5 px-3">Item Description</th>
                  <th className="py-2.5 px-3">Warehouse</th>
                  <th className="py-2.5 px-3 text-right">Opening</th>
                  <th className="py-2.5 px-3 text-right">Receive / In</th>
                  <th className="py-2.5 px-3 text-right">Issue / Out</th>
                  <th className="py-2.5 px-3 text-right">Closing</th>
                  <th className="py-2.5 px-2 text-center">UOM</th>
                  {showNetWeight && (
                    <th className="py-2.5 px-3 text-right">Net Wt (Kg)</th>
                  )}
                  <th className="py-2.5 px-3 text-right">Avg Rate (৳)</th>
                  <th className="py-2.5 px-3 text-right">Total Valuation (৳)</th>
                  <th className="py-2.5 px-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {paginatedRows.length === 0 ? (
                  <tr>
                    <td colSpan={showNetWeight ? 14 : 13} className="py-8 text-center text-slate-400">
                      No inventory records found for the selected filters.
                    </td>
                  </tr>
                ) : (
                  paginatedRows.map((r, i) => (
                    <tr key={r.itemCode} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-2 px-3 text-center text-slate-500 font-medium">
                        {(page - 1) * rowsPerPage + i + 1}
                      </td>
                      <td className="py-2 px-3 font-mono font-semibold text-blue-700 whitespace-nowrap">
                        {r.itemCode}
                      </td>
                      <td className="py-2 px-3 font-medium text-slate-900 max-w-xs">
                        <div>{r.itemName}</div>
                        <div className="text-[10px] text-slate-500 font-normal">
                          {r.category} • {r.supplier}
                        </div>
                      </td>
                      <td className="py-2 px-3 text-slate-700 whitespace-nowrap">
                        {r.warehouse}
                      </td>
                      <td className="py-2 px-3 text-right text-slate-700">
                        {r.openingQty.toLocaleString(undefined, { minimumFractionDigits: 1 })}
                      </td>
                      <td className="py-2 px-3 text-right text-emerald-700 font-medium">
                        +{r.inQty.toLocaleString(undefined, { minimumFractionDigits: 1 })}
                      </td>
                      <td className="py-2 px-3 text-right text-rose-700 font-medium">
                        -{r.outQty.toLocaleString(undefined, { minimumFractionDigits: 1 })}
                      </td>
                      <td className="py-2 px-3 text-right font-bold text-slate-900">
                        {r.closingQty.toLocaleString(undefined, { minimumFractionDigits: 1 })}
                      </td>
                      <td className="py-2 px-2 text-center text-slate-500 font-medium">
                        {r.uom}
                      </td>
                      {showNetWeight && (
                        <td className="py-2 px-3 text-right text-slate-700">
                          {r.netWeightKg.toLocaleString(undefined, { minimumFractionDigits: 1 })}
                        </td>
                      )}
                      <td className="py-2 px-3 text-right text-slate-700">
                        {r.unitRate.toFixed(2)}
                      </td>
                      <td className="py-2 px-3 text-right font-bold text-blue-800 whitespace-nowrap">
                        {r.totalValuation.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-2 px-3 text-center whitespace-nowrap">
                        {r.status === "In Stock" && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            In Stock
                          </span>
                        )}
                        {r.status === "Low Stock" && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                            Low Stock
                          </span>
                        )}
                        {r.status === "Reorder Required" && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                            Reorder
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              <tfoot>
                <tr className="bg-slate-100 font-bold text-slate-900 border-t-2 border-slate-300">
                  <td colSpan={4} className="py-2.5 px-3 text-right">
                    Grand Total:
                  </td>
                  <td className="py-2.5 px-3 text-right text-slate-700">-</td>
                  <td className="py-2.5 px-3 text-right text-emerald-800">
                    +{totals.totalInQty.toLocaleString(undefined, { minimumFractionDigits: 1 })}
                  </td>
                  <td className="py-2.5 px-3 text-right text-rose-800">
                    -{totals.totalOutQty.toLocaleString(undefined, { minimumFractionDigits: 1 })}
                  </td>
                  <td className="py-2.5 px-3 text-right text-slate-900">
                    {totals.totalClosingQty.toLocaleString(undefined, { minimumFractionDigits: 1 })}
                  </td>
                  <td className="py-2.5 px-2 text-center">-</td>
                  {showNetWeight && (
                    <td className="py-2.5 px-3 text-right text-slate-800">
                      {totals.totalWeightKg.toLocaleString(undefined, { minimumFractionDigits: 1 })}
                    </td>
                  )}
                  <td className="py-2.5 px-3 text-right">-</td>
                  <td className="py-2.5 px-3 text-right text-blue-900 font-extrabold whitespace-nowrap">
                    ৳ {totals.totalClosingValuation.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </td>
                  <td className="py-2.5 px-3 text-center">-</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-3 py-2 bg-slate-50 border-t border-slate-200 text-xs text-slate-600 print:hidden">
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
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
              <span className="ml-2">
                Showing {filteredData.length === 0 ? 0 : (page - 1) * rowsPerPage + 1} -{" "}
                {Math.min(page * rowsPerPage, filteredData.length)} of {filteredData.length}
              </span>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="p-1 rounded border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40"
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
                className="p-1 rounded border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Print Signatures Block */}
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
              Internal Audit / Accounts
            </div>
          </div>
          <div>
            <div className="border-t border-dashed border-slate-400 pt-1 font-medium">
              Head of Supply Chain
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
