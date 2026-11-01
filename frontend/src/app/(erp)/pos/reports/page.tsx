"use client";

import React, { useState } from "react";
import { ChevronDown } from "lucide-react";

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

export default function PosReportsPage() {
  const [activeTab, setActiveTab] = useState<PosReportTabId>("INVENTORY_REPORT");
  const [selectedReportType, setSelectedReportType] = useState("");

  const currentTab =
    POS_REPORT_TABS.find((t) => t.id === activeTab) ?? POS_REPORT_TABS[0];

  const handleTabChange = (tabId: PosReportTabId) => {
    setActiveTab(tabId);
    setSelectedReportType("");
  };

  const handleExportExcel = () => {
    const csvContent = "data:text/csv;charset=utf-8,SL,Reference,Date,Description,Amount\n";
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `${currentTab.id.toLowerCase()}_${new Date().toISOString().split("T")[0]}.csv`,
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-white dark:bg-slate-950 p-4 sm:p-6">
      {/* Page Title */}
      <h1 className="text-lg font-medium text-slate-800 dark:text-slate-100 mb-4">
        {currentTab.pageTitle}
      </h1>

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

      {/* Action Buttons Row (EXCEL | PRINT/PDF) */}
      <div className="flex justify-end items-center gap-2.5 mt-3">
        <button
          type="button"
          onClick={handleExportExcel}
          className="rounded border border-[#9ec5fe] bg-white dark:bg-slate-900 hover:bg-blue-50 dark:hover:bg-slate-800 px-3.5 py-1.5 text-xs font-semibold text-[#0d6efd] uppercase transition-colors cursor-pointer"
        >
          EXCEL
        </button>
        <button
          type="button"
          onClick={() => window.print()}
          className="rounded border border-[#9ec5fe] bg-white dark:bg-slate-900 hover:bg-blue-50 dark:hover:bg-slate-800 px-3.5 py-1.5 text-xs font-semibold text-[#0d6efd] uppercase transition-colors cursor-pointer"
        >
          PRINT/PDF
        </button>
      </div>

      {/* View By Filter */}
      <div className="mt-2 max-w-xs">
        <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
          View By
        </label>
        <div className="relative">
          <select
            value={selectedReportType}
            onChange={(e) => setSelectedReportType(e.target.value)}
            className={`w-full appearance-none rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 pr-7 text-xs focus:border-[#0d6efd] focus:outline-none cursor-pointer ${
              selectedReportType
                ? "text-slate-800 dark:text-slate-100"
                : "text-slate-400 dark:text-slate-500"
            }`}
          >
            <option value="">Select Report Type</option>
            {currentTab.reportTypes.map((type) => (
              <option
                key={type}
                value={type}
                className="text-slate-800 dark:text-slate-100"
              >
                {type}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 size-3.5 text-slate-600 dark:text-slate-400" />
        </div>
      </div>

      {/* Report Table (shown when a report type is selected, zero demo data) */}
      {selectedReportType && (
        <div className="mt-6 rounded border border-slate-200 dark:border-slate-800 overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="p-2.5 font-semibold w-14">SL</th>
                <th className="p-2.5 font-semibold">Date</th>
                <th className="p-2.5 font-semibold">Reference / Code</th>
                <th className="p-2.5 font-semibold">Particulars</th>
                <th className="p-2.5 font-semibold text-right">Quantity</th>
                <th className="p-2.5 font-semibold text-right">Amount (BDT)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td
                  colSpan={6}
                  className="p-8 text-center text-xs text-slate-400"
                >
                  No records found for {selectedReportType}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

