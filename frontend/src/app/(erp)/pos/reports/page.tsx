"use client";

import React, { useState, useMemo } from "react";
import {
  ChevronDown,
  Search,
  Calendar as CalendarIcon,
  Download,
  Printer,
  FileSpreadsheet,
  Filter,
  CheckCircle,
} from "lucide-react";

type PosReportTabId =
  | "INVENTORY_REPORT"
  | "POS_SALES_REPORT"
  | "VAT_REPORT"
  | "DISCOUNT_REPORT"
  | "DATA_LOG_REPORT"
  | "MIS_REPORT";

interface PosReportTab {
  id: PosReportTabId;
  tabLabel: string;
  pageTitle: string;
  reportTypes: string[];
}

const POS_REPORT_TABS: PosReportTab[] = [
  {
    id: "INVENTORY_REPORT",
    tabLabel: "INVENTORY REPORT",
    pageTitle: "Inventory Report",
    reportTypes: [
      "Current Stock Summary",
      "Item Wise Stock Ledger",
      "Counter Stock Balance",
      "Low Stock / Reorder Report",
    ],
  },
  {
    id: "POS_SALES_REPORT",
    tabLabel: "POS SALES REPORT",
    pageTitle: "POS Sales Report",
    reportTypes: [
      "Invoice Wise Sales Summary",
      "Item Wise Sales Report",
      "Counter Wise Sales Report",
      "Cashier Wise Collection Report",
    ],
  },
  {
    id: "VAT_REPORT",
    tabLabel: "VAT REPORT",
    pageTitle: "VAT Report",
    reportTypes: [
      "Invoice Wise VAT Register",
      "Item Wise VAT Summary",
      "Monthly VAT Statement",
    ],
  },
  {
    id: "DISCOUNT_REPORT",
    tabLabel: "DISCOUNT REPORT",
    pageTitle: "Discount Report",
    reportTypes: [
      "Promotional Discount Summary",
      "Invoice Wise Discount Report",
      "Offer & Coupon Redemption Report",
    ],
  },
  {
    id: "DATA_LOG_REPORT",
    tabLabel: "DATA LOG REPORT",
    pageTitle: "Data Log Report",
    reportTypes: [
      "Void / Cancelled Invoice Log",
      "Price Override Audit Log",
      "Counter Session Activity Log",
    ],
  },
  {
    id: "MIS_REPORT",
    tabLabel: "MIS REPORT",
    pageTitle: "MIS Report",
    reportTypes: [
      "Daily Outlet Gross Margin Report",
      "Category Wise Profitability",
      "Payment Mode Settlement Summary",
    ],
  },
];

interface ReportRow {
  id: string;
  date: string;
  code: string;
  particulars: string;
  category: string;
  qty: number;
  uom: string;
  unitPrice: number;
  discount: number;
  vat: number;
  amount: number;
  status: string;
}

const MOCK_REPORT_DATA: Record<PosReportTabId, ReportRow[]> = {
  INVENTORY_REPORT: [
    { id: "inv-1", date: "2026-11-01", code: "ITM-STK-001", particulars: "Beef Ribeye Steak (250g)", category: "Main Course", qty: 85, uom: "Pcs", unitPrice: 1400, discount: 0, vat: 0, amount: 119000, status: "Normal" },
    { id: "inv-2", date: "2026-11-01", code: "ITM-PST-002", particulars: "Chicken Alfredo Pasta", category: "Pasta", qty: 140, uom: "Portion", unitPrice: 600, discount: 0, vat: 0, amount: 84000, status: "Normal" },
    { id: "inv-3", date: "2026-11-01", code: "ITM-PIZ-003", particulars: "Margherita Pizza (Large)", category: "Pizza", qty: 65, uom: "Pcs", unitPrice: 700, discount: 0, vat: 0, amount: 45500, status: "Normal" },
    { id: "inv-4", date: "2026-11-01", code: "ITM-SEA-004", particulars: "Grilled Atlantic Salmon", category: "Seafood", qty: 12, uom: "Portion", unitPrice: 1400, discount: 0, vat: 0, amount: 16800, status: "Low Stock" },
    { id: "inv-5", date: "2026-11-01", code: "ITM-APP-005", particulars: "BBQ Chicken Wings (8 pcs)", category: "Appetizers", qty: 190, uom: "Platter", unitPrice: 400, discount: 0, vat: 0, amount: 76000, status: "Normal" },
    { id: "inv-6", date: "2026-11-01", code: "ITM-BEV-006", particulars: "Fresh Lime Mint Soda", category: "Beverages", qty: 240, uom: "Glass", unitPrice: 200, discount: 0, vat: 0, amount: 48000, status: "Normal" },
    { id: "inv-7", date: "2026-11-01", code: "ITM-DES-007", particulars: "Chocolate Lava Cake", category: "Dessert", qty: 18, uom: "Pcs", unitPrice: 350, discount: 0, vat: 0, amount: 6300, status: "Low Stock" },
    { id: "inv-8", date: "2026-11-01", code: "ITM-COF-008", particulars: "Cappuccino / Latte", category: "Coffee", qty: 320, uom: "Cup", unitPrice: 200, discount: 0, vat: 0, amount: 64000, status: "Normal" },
  ],
  POS_SALES_REPORT: [
    { id: "pos-1", date: "2026-11-01", code: "INV-2026-0081", particulars: "Table 4 - ROOF TOP (Cashier: Usuf)", category: "Counter 01", qty: 4, uom: "Items", unitPrice: 850, discount: 340, vat: 229.5, amount: 3289.5, status: "Completed" },
    { id: "pos-2", date: "2026-11-01", code: "INV-2026-0082", particulars: "Table 12 - HALLROOM (Cashier: Mirpur-14)", category: "Counter 02", qty: 6, uom: "Items", unitPrice: 720, discount: 432, vat: 291.6, amount: 4179.6, status: "Completed" },
    { id: "pos-3", date: "2026-11-01", code: "INV-2026-0083", particulars: "VIP Cabin 2 (Cashier: Usuf)", category: "Counter 01", qty: 8, uom: "Items", unitPrice: 1100, discount: 880, vat: 594.0, amount: 8514.0, status: "Completed" },
    { id: "pos-4", date: "2026-11-01", code: "INV-2026-0084", particulars: "Takeaway Order #19 (Cashier: Mirpur-14)", category: "Counter 02", qty: 3, uom: "Items", unitPrice: 550, discount: 0, vat: 123.75, amount: 1773.75, status: "Completed" },
    { id: "pos-5", date: "2026-11-01", code: "INV-2026-0085", particulars: "Outdoor Table 6 (Cashier: Usuf)", category: "Counter 01", qty: 5, uom: "Items", unitPrice: 640, discount: 320, vat: 216.0, amount: 3096.0, status: "Completed" },
    { id: "pos-6", date: "2026-11-01", code: "INV-2026-0086", particulars: "Table 1 - ROOF TOP (Cashier: Usuf)", category: "Counter 01", qty: 2, uom: "Items", unitPrice: 1400, discount: 280, vat: 189.0, amount: 2709.0, status: "Completed" },
  ],
  VAT_REPORT: [
    { id: "vat-1", date: "2026-11-01", code: "VAT-REG-101", particulars: "Mushak 6.3 - INV-2026-0081", category: "Standard 7.5%", qty: 4, uom: "Txn", unitPrice: 3060, discount: 340, vat: 229.5, amount: 3289.5, status: "Reported" },
    { id: "vat-2", date: "2026-11-01", code: "VAT-REG-102", particulars: "Mushak 6.3 - INV-2026-0082", category: "Standard 7.5%", qty: 6, uom: "Txn", unitPrice: 3888, discount: 432, vat: 291.6, amount: 4179.6, status: "Reported" },
    { id: "vat-3", date: "2026-11-01", code: "VAT-REG-103", particulars: "Mushak 6.3 - INV-2026-0083", category: "Standard 7.5%", qty: 8, uom: "Txn", unitPrice: 7920, discount: 880, vat: 594.0, amount: 8514.0, status: "Reported" },
    { id: "vat-4", date: "2026-11-01", code: "VAT-REG-104", particulars: "Mushak 6.3 - INV-2026-0084", category: "Standard 7.5%", qty: 3, uom: "Txn", unitPrice: 1650, discount: 0, vat: 123.75, amount: 1773.75, status: "Reported" },
    { id: "vat-5", date: "2026-11-01", code: "VAT-REG-105", particulars: "Mushak 6.3 - INV-2026-0085", category: "Standard 7.5%", qty: 5, uom: "Txn", unitPrice: 2880, discount: 320, vat: 216.0, amount: 3096.0, status: "Reported" },
  ],
  DISCOUNT_REPORT: [
    { id: "dsc-1", date: "2026-11-01", code: "DISC-OFF-01", particulars: "Happy Hours 10% Off", category: "Special Discount", qty: 28, uom: "Invoices", unitPrice: 2450, discount: 6860, vat: 4630, amount: 61740, status: "Active" },
    { id: "dsc-2", date: "2026-11-01", code: "DISC-OFF-02", particulars: "Steak Special 15% Promotion", category: "Product Discount", qty: 16, uom: "Items", unitPrice: 1400, discount: 3360, vat: 1428, amount: 20468, status: "Active" },
    { id: "dsc-3", date: "2026-11-01", code: "DISC-VOU-03", particulars: "Corporate Gift Voucher (500 BDT)", category: "Voucher Redeem", qty: 10, uom: "Vouchers", unitPrice: 500, discount: 5000, vat: 0, amount: 5000, status: "Redeemed" },
    { id: "dsc-4", date: "2026-11-01", code: "DISC-PNT-04", particulars: "Loyalty Points Redemption", category: "Point Offer", qty: 8, uom: "Txn", unitPrice: 350, discount: 2800, vat: 0, amount: 2800, status: "Settled" },
  ],
  DATA_LOG_REPORT: [
    { id: "log-1", date: "2026-11-01 14:22", code: "LOG-VD-0041", particulars: "Void Item: Beef Steak - Customer changed mind", category: "Item Void", qty: 1, uom: "Pcs", unitPrice: 1400, discount: 0, vat: 105, amount: 1400, status: "Authorized" },
    { id: "log-2", date: "2026-11-01 16:45", code: "LOG-OVR-0012", particulars: "Manual Discount Override: VIP Guest 20%", category: "Price Override", qty: 1, uom: "Txn", unitPrice: 4200, discount: 840, vat: 252, amount: 3612, status: "Manager Approved" },
    { id: "log-3", date: "2026-11-01 11:00", code: "LOG-SES-0001", particulars: "Counter 01 Terminal Shift Open (Float 5000 BDT)", category: "Session Log", qty: 1, uom: "Session", unitPrice: 5000, discount: 0, vat: 0, amount: 5000, status: "Logged" },
    { id: "log-4", date: "2026-11-01 23:30", code: "LOG-SES-0002", particulars: "Counter 01 End of Day Settlement (Usuf Ali)", category: "Z-Report", qty: 1, uom: "Closing", unitPrice: 89500, discount: 4120, vat: 6712, amount: 92092, status: "Balanced" },
  ],
  MIS_REPORT: [
    { id: "mis-1", date: "2026-11-01", code: "MIS-GRP-01", particulars: "Main Course & Steaks Gross Margin (62%)", category: "Outlet Marinozz", qty: 180, uom: "Servings", unitPrice: 1200, discount: 7200, vat: 15660, amount: 224460, status: "High Margin" },
    { id: "mis-2", date: "2026-11-01", code: "MIS-GRP-02", particulars: "Beverages & Coffee Margin (78%)", category: "Outlet Marinozz", qty: 320, uom: "Cups/Glass", unitPrice: 200, discount: 1200, vat: 4710, amount: 67510, status: "High Margin" },
    { id: "mis-3", date: "2026-11-01", code: "MIS-GRP-03", particulars: "Pasta & Pizza Margin (58%)", category: "Outlet Marinozz", qty: 210, uom: "Portions", unitPrice: 650, discount: 5400, vat: 9832, amount: 140932, status: "Healthy" },
    { id: "mis-4", date: "2026-11-01", code: "MIS-GRP-04", particulars: "Desserts & Bakery Margin (65%)", category: "Outlet Marinozz", qty: 95, uom: "Plates", unitPrice: 350, discount: 1100, vat: 2411, amount: 34561, status: "Healthy" },
  ],
};

export default function PosReportsPage() {
  const [activeTab, setActiveTab] = useState<PosReportTabId>("INVENTORY_REPORT");
  const [selectedReportType, setSelectedReportType] = useState("Current Stock Summary");
  const [searchQuery, setSearchQuery] = useState("");
  const [fromDate, setFromDate] = useState("2026-11-01");
  const [toDate, setToDate] = useState("2026-11-30");
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((c) => (c === msg ? null : c));
    }, 3000);
  };

  const currentTab =
    POS_REPORT_TABS.find((t) => t.id === activeTab) ?? POS_REPORT_TABS[0];

  const handleTabChange = (tabId: PosReportTabId) => {
    setActiveTab(tabId);
    const targetTab = POS_REPORT_TABS.find((t) => t.id === tabId);
    setSelectedReportType(targetTab?.reportTypes[0] || "");
  };

  // Filtered Rows
  const filteredRows = useMemo(() => {
    const list = MOCK_REPORT_DATA[activeTab] || [];
    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase().trim();
    return list.filter(
      (r) =>
        r.code.toLowerCase().includes(q) ||
        r.particulars.toLowerCase().includes(q) ||
        r.category.toLowerCase().includes(q) ||
        r.status.toLowerCase().includes(q)
    );
  }, [activeTab, searchQuery]);

  // Aggregate totals
  const totalQty = filteredRows.reduce((acc, r) => acc + r.qty, 0);
  const totalDiscount = filteredRows.reduce((acc, r) => acc + r.discount, 0);
  const totalVat = filteredRows.reduce((acc, r) => acc + r.vat, 0);
  const totalAmount = filteredRows.reduce((acc, r) => acc + r.amount, 0);

  // Export CSV
  const handleExportExcel = () => {
    const headers = ["SL", "Date", "Code", "Particulars", "Category", "Quantity", "UOM", "Unit Price", "Discount", "VAT", "Total Amount", "Status"];
    const rows = filteredRows.map((r, i) => [
      i + 1,
      `"${r.date}"`,
      `"${r.code}"`,
      `"${r.particulars.replace(/"/g, '""')}"`,
      `"${r.category}"`,
      r.qty,
      `"${r.uom}"`,
      r.unitPrice,
      r.discount,
      r.vat,
      r.amount,
      `"${r.status}"`,
    ]);

    const csvContent = "\uFEFF" + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `bridgeone_${activeTab.toLowerCase()}_${new Date().toISOString().split("T")[0]}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast(`Exported ${filteredRows.length} records to CSV successfully`);
  };

  const handlePrint = () => {
    if (typeof window !== "undefined") {
      window.print();
    }
  };

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-white dark:bg-slate-950 p-4 sm:p-6 text-slate-800 dark:text-slate-100 space-y-4">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 flex items-center gap-2 rounded-lg bg-emerald-600 text-white px-4 py-2.5 shadow-lg text-xs font-semibold animate-in fade-in slide-in-from-top-2">
          <CheckCircle className="size-4" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Page Title & Subtitle */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
            {currentTab.pageTitle}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            BridgeOne POS Retail & Restaurant Intelligence Hub
          </p>
        </div>

        {/* Action Buttons (EXCEL | PRINT/PDF) */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={handleExportExcel}
            className="flex items-center gap-1.5 rounded border border-[#0d6efd] bg-white dark:bg-slate-900 hover:bg-blue-50 dark:hover:bg-slate-800 px-3.5 py-1.5 text-xs font-bold text-[#0d6efd] uppercase transition-colors cursor-pointer shadow-2xs"
          >
            <FileSpreadsheet className="size-3.5" />
            <span>EXCEL</span>
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="flex items-center gap-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 px-3.5 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 uppercase transition-colors cursor-pointer shadow-2xs"
          >
            <Printer className="size-3.5" />
            <span>PRINT / PDF</span>
          </button>
        </div>
      </div>

      {/* Horizontal Tabs Bar */}
      <div className="border-b border-slate-200 dark:border-slate-800 overflow-x-auto">
        <div className="flex items-center gap-6 min-w-max">
          {POS_REPORT_TABS.map((tab) => {
            const isActive = tab.id === activeTab;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleTabChange(tab.id)}
                className={`pb-2.5 px-1 text-xs font-semibold tracking-wide uppercase transition-colors cursor-pointer border-b-2 -mb-px ${
                  isActive
                    ? "border-[#0d6efd] text-[#0d6efd]"
                    : "border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                }`}
              >
                {tab.tabLabel}
              </button>
            );
          })}
        </div>
      </div>

      {/* Filter Toolbar: View By, Dates, Search */}
      <div className="rounded border border-slate-200 dark:border-slate-800 bg-[#f8fafc] dark:bg-slate-900/60 p-3.5">
        <div className="grid grid-cols-1 sm:grid-cols-12 items-end gap-3">
          {/* View By Report Type */}
          <div className="sm:col-span-4 flex flex-col gap-1">
            <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
              View By
            </label>
            <div className="relative">
              <select
                value={selectedReportType}
                onChange={(e) => setSelectedReportType(e.target.value)}
                className="w-full appearance-none rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 pr-7 text-xs text-slate-800 dark:text-slate-100 focus:border-[#0d6efd] focus:outline-none cursor-pointer"
              >
                {currentTab.reportTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 size-3.5 text-slate-500" />
            </div>
          </div>

          {/* From Date */}
          <div className="sm:col-span-2 flex flex-col gap-1">
            <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
              From Date
            </label>
            <div className="relative flex items-center">
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="h-8 w-full rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 pr-6 text-xs text-slate-700 dark:text-slate-200 focus:border-[#0d6efd] focus:outline-none"
              />
              <CalendarIcon className="pointer-events-none absolute right-1.5 size-3.5 text-slate-400" />
            </div>
          </div>

          {/* To Date */}
          <div className="sm:col-span-2 flex flex-col gap-1">
            <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
              To Date
            </label>
            <div className="relative flex items-center">
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="h-8 w-full rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 pr-6 text-xs text-slate-700 dark:text-slate-200 focus:border-[#0d6efd] focus:outline-none"
              />
              <CalendarIcon className="pointer-events-none absolute right-1.5 size-3.5 text-slate-400" />
            </div>
          </div>

          {/* Search Query */}
          <div className="sm:col-span-4 flex flex-col gap-1">
            <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
              Search Records
            </label>
            <div className="relative flex items-center">
              <input
                type="text"
                placeholder="Search code, item, cashier, status..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 w-full rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 pl-8 pr-3 text-xs text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:border-[#0d6efd] focus:outline-none"
              />
              <Search className="pointer-events-none absolute left-2.5 size-3.5 text-slate-400" />
            </div>
          </div>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3">
          <p className="text-[11px] font-medium text-slate-500">Total Records</p>
          <p className="text-lg font-bold text-slate-900 dark:text-slate-100 mt-0.5">
            {filteredRows.length}
          </p>
        </div>
        <div className="rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3">
          <p className="text-[11px] font-medium text-slate-500">Total Quantity</p>
          <p className="text-lg font-bold text-blue-600 dark:text-blue-400 mt-0.5">
            {totalQty.toLocaleString()} units
          </p>
        </div>
        <div className="rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3">
          <p className="text-[11px] font-medium text-slate-500">VAT & Discount</p>
          <p className="text-lg font-bold text-slate-800 dark:text-slate-200 mt-0.5">
            +{totalVat.toLocaleString()} / -{totalDiscount.toLocaleString()}
          </p>
        </div>
        <div className="rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3">
          <p className="text-[11px] font-medium text-slate-500">Total Net Amount</p>
          <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
            {totalAmount.toLocaleString()} BDT
          </p>
        </div>
      </div>

      {/* Report Data Table */}
      <div className="rounded border border-slate-200 dark:border-slate-800 overflow-x-auto shadow-2xs">
        <table className="w-full text-left text-xs border-collapse">
          <thead className="bg-[#e8f1fd] dark:bg-slate-800/80 text-slate-800 dark:text-slate-200 border-b border-slate-200 dark:border-slate-800 font-semibold">
            <tr>
              <th className="p-3 w-12 text-center">SL</th>
              <th className="p-3">Date</th>
              <th className="p-3">Code / Ref</th>
              <th className="p-3">Particulars / Description</th>
              <th className="p-3">Category / Counter</th>
              <th className="p-3 text-right">Quantity</th>
              <th className="p-3 text-right">Unit Price</th>
              <th className="p-3 text-right">Discount</th>
              <th className="p-3 text-right">VAT</th>
              <th className="p-3 text-right">Amount (BDT)</th>
              <th className="p-3 text-center">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
            {filteredRows.length > 0 ? (
              filteredRows.map((row, index) => (
                <tr
                  key={row.id}
                  className="hover:bg-blue-50/40 dark:hover:bg-slate-800/40 transition-colors"
                >
                  <td className="p-3 text-center font-medium text-slate-500">
                    {index + 1}
                  </td>
                  <td className="p-3 text-slate-700 dark:text-slate-300 whitespace-nowrap">
                    {row.date}
                  </td>
                  <td className="p-3 font-semibold text-blue-600 dark:text-blue-400 whitespace-nowrap">
                    {row.code}
                  </td>
                  <td className="p-3 font-medium text-slate-900 dark:text-slate-100 max-w-xs truncate">
                    {row.particulars}
                  </td>
                  <td className="p-3 text-slate-600 dark:text-slate-300">
                    {row.category}
                  </td>
                  <td className="p-3 text-right font-medium text-slate-800 dark:text-slate-200">
                    {row.qty} {row.uom}
                  </td>
                  <td className="p-3 text-right text-slate-600 dark:text-slate-400">
                    {row.unitPrice.toLocaleString()}
                  </td>
                  <td className="p-3 text-right text-rose-500">
                    {row.discount > 0 ? `-${row.discount.toLocaleString()}` : "0.00"}
                  </td>
                  <td className="p-3 text-right text-emerald-600">
                    {row.vat > 0 ? `+${row.vat.toLocaleString()}` : "0.00"}
                  </td>
                  <td className="p-3 text-right font-bold text-slate-900 dark:text-slate-100">
                    {row.amount.toLocaleString()}
                  </td>
                  <td className="p-3 text-center">
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                        row.status === "Completed" || row.status === "Normal" || row.status === "Reported" || row.status === "Balanced"
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          : row.status === "Low Stock"
                          ? "bg-rose-50 text-rose-700 border border-rose-200"
                          : row.status === "Active"
                          ? "bg-blue-50 text-blue-700 border border-blue-200"
                          : "bg-slate-100 text-slate-700 border border-slate-200"
                      }`}
                    >
                      {row.status}
                    </span>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={11} className="p-10 text-center text-slate-400 text-xs">
                  No records match your filter criteria.
                </td>
              </tr>
            )}
          </tbody>
          {filteredRows.length > 0 && (
            <tfoot className="bg-slate-50 dark:bg-slate-800/90 font-bold text-slate-900 dark:text-slate-100 border-t border-slate-200 dark:border-slate-700">
              <tr>
                <td colSpan={5} className="p-3 text-right uppercase text-[11px]">
                  Total:
                </td>
                <td className="p-3 text-right text-blue-600">{totalQty.toLocaleString()}</td>
                <td className="p-3 text-right">-</td>
                <td className="p-3 text-right text-rose-500">-{totalDiscount.toLocaleString()}</td>
                <td className="p-3 text-right text-emerald-600">+{totalVat.toLocaleString()}</td>
                <td className="p-3 text-right text-emerald-600 text-sm">
                  {totalAmount.toLocaleString()} BDT
                </td>
                <td className="p-3 text-center">-</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
