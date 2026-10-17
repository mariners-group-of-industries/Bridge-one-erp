"use client";

import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  FileSpreadsheet,
  Download,
  Printer,
  Filter,
  RotateCcw,
  Building,
  Calendar,
  Layers,
  TrendingUp,
  FileText,
  DollarSign,
  Package,
  ShieldCheck,
  CheckCircle2,
  Clock,
  AlertCircle,
} from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { toast } from "@/components/ui/Toast";
import { fetchApi } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import { ReportResult, Office, Supplier } from "@bridgeone/contracts";

const REPORT_CATEGORIES = [
  {
    group: "Procurement Pipeline",
    reports: [
      { value: "REQUISITION_REPORT", label: "Purchase Requisition Report", desc: "Indent requests, approval statuses, and department allocations" },
      { value: "PURCHASE_ORDER_REPORT", label: "Purchase Order (PO) Report", desc: "Issued purchase contracts, committed values, and lead times" },
    ],
  },
  {
    group: "Inward & Material Receipts",
    reports: [
      { value: "GOODS_RECEIPT_REPORT", label: "Purchase Receive / GRN Report", desc: "Warehouse receipts, QC inspection, and received amounts" },
      { value: "PURCHASE_RETURN_REPORT", label: "Purchase Return (PRN) Report", desc: "Rejected batches, debit notes, and replacement tracking" },
    ],
  },
  {
    group: "Vendor & Financial Ledgers",
    reports: [
      { value: "SUPPLIER_PAYMENT_STATUS_REPORT", label: "Supplier Payment Status Report", desc: "Aging dues, paid amounts, returns, and payment balance" },
      { value: "SUPPLIER_PURCHASE_REPORT", label: "Supplier Purchase Ledger", desc: "Vendor-wise procurement volume, order totals, and outstanding dues" },
      { value: "EXPENDITURE_SUMMARY_REPORT", label: "Purchase Expenditure Summary", desc: "Monthly fiscal procurement commitment vs disbursement variance" },
    ],
  },
  {
    group: "Items & Location Dimensions",
    reports: [
      { value: "ITEM_PURCHASE_REPORT", label: "Item Purchase & Consumption Report", desc: "Material unit economics, purchase frequency, and total outlay" },
      { value: "OFFICE_WAREHOUSE_PURCHASE_REPORT", label: "Office & Warehouse Report", desc: "Branch-wise demand distribution and central warehouse intake" },
    ],
  },
];

const ALL_REPORTS = REPORT_CATEGORIES.flatMap((c) => c.reports);

export default function PurchaseReportsPage() {
  const [reportType, setReportType] = useState("REQUISITION_REPORT");
  const [selectedOffice, setSelectedOffice] = useState("ALL");
  const [selectedSupplier, setSelectedSupplier] = useState("ALL");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [isSummary, setIsSummary] = useState(false);

  const { data: offices } = useQuery<Office[]>({
    queryKey: ["offices"],
    queryFn: () => fetchApi("/master/offices"),
  });

  const { data: suppliers } = useQuery<Supplier[]>({
    queryKey: ["suppliers"],
    queryFn: () => fetchApi("/master/suppliers"),
  });

  const { data: reportData, isLoading, refetch } = useQuery<ReportResult>({
    queryKey: ["report", reportType, selectedOffice, selectedSupplier, fromDate, toDate, isSummary],
    queryFn: () => {
      const p = new URLSearchParams();
      p.append("reportType", reportType);
      if (selectedOffice !== "ALL") p.append("officeId", selectedOffice);
      if (selectedSupplier !== "ALL") p.append("supplierId", selectedSupplier);
      if (fromDate) p.append("fromDate", fromDate);
      if (toDate) p.append("toDate", toDate);
      if (isSummary) p.append("isSummary", "true");
      return fetchApi(`/purchase/reports?${p.toString()}`);
    },
  });

  const currentReportMeta = useMemo(() => {
    return ALL_REPORTS.find((r) => r.value === reportType) || ALL_REPORTS[0];
  }, [reportType]);

  // Robust Client-side CSV download that works instantly
  const handleClientExportCsv = () => {
    if (!reportData || !reportData.rows || reportData.rows.length === 0) {
      toast.info("No report data available to export.");
      return;
    }

    const columns = reportData.columns;
    const rows = reportData.rows.map((row) =>
      columns
        .map((col) => {
          const val = row[col] !== undefined && row[col] !== null ? String(row[col]) : "";
          return `"${val.replace(/"/g, '""')}"`;
        })
        .join(",")
    );

    const csvContent = "\uFEFF" + [columns.join(","), ...rows].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `BridgeOne_${reportType}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Report data exported to CSV successfully!");
  };

  // Status Badge Helper
  const renderStatusBadge = (val: string) => {
    const s = String(val).toUpperCase();
    if (s.includes("APPROVED") || s.includes("COMPLETED") || s.includes("RECEIVED") || s.includes("PAID")) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
          <span>{val}</span>
        </span>
      );
    }
    if (s.includes("PENDING") || s.includes("SUBMITTED") || s.includes("PARTIAL")) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
          <Clock className="w-3 h-3 text-amber-600" />
          <span>{val}</span>
        </span>
      );
    }
    if (s.includes("REJECTED") || s.includes("CANCELLED") || s.includes("DUE") || s.includes("OVERDUE")) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
          <AlertCircle className="w-3 h-3 text-rose-600" />
          <span>{val}</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-700">
        {val}
      </span>
    );
  };

  // Primary Financial Total Computation
  const primaryFinancialTotal = useMemo(() => {
    if (!reportData?.summary) return null;
    const entries = Object.entries(reportData.summary);
    const found = entries.find(([k]) => k.toLowerCase().includes("bdt") || k.toLowerCase().includes("value") || k.toLowerCase().includes("spend") || k.toLowerCase().includes("commitment") || k.toLowerCase().includes("due"));
    if (found) {
      return { label: found[0], value: found[1] };
    }
    return entries[0] ? { label: entries[0][0], value: entries[0][1] } : null;
  }, [reportData]);

  const columnCount = (reportData as any)?.columns?.length || 8;

  return (
    <div className="space-y-4">
      {/* Printable Corporate Letterhead (visible only on print) */}
      <div className="hidden print:block border-b-2 border-slate-900 pb-3 mb-4">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-xl font-black text-slate-900 tracking-tight">BRIDGEONE TECHNOLOGIES LTD.</h1>
            <p className="text-xs text-slate-600">Enterprise Procurement & Supply Chain Ledger</p>
            <p className="text-[11px] text-slate-500">Corporate Headquarters, Tejgaon C/A, Dhaka-1208, Bangladesh</p>
          </div>
          <div className="text-right text-xs">
            <p className="font-bold text-slate-800">{currentReportMeta.label}</p>
            <p className="text-slate-500">Generated: {new Date().toLocaleString("en-GB")}</p>
            <p className="text-slate-500">Status: Official Audit Record</p>
          </div>
        </div>
      </div>

      {/* Screen Header */}
      <div className="print:hidden">
        <PageHeader
          title="Procurement Reports & Corporate Ledgers"
          subtitle="Generate verifiable audit trails, operational metrics, and financial reconciliations"
          breadcrumbs={[{ label: "Purchase Reports" }]}
          actions={
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleClientExportCsv}
                className="h-9 px-3.5 bg-[#2563eb] hover:bg-blue-700 text-white font-semibold text-xs rounded flex items-center gap-1.5 shadow-xs transition"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Excel</span>
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="h-9 px-3.5 border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold text-xs rounded flex items-center gap-1.5 shadow-xs transition"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print</span>
              </button>
            </div>
          }
        />
      </div>

      {/* Executive Quick Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 print:hidden">
        <div className="bg-white p-3 rounded border border-slate-200/90 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Active Report</span>
            <span className="text-xs font-bold text-slate-800 line-clamp-1" title={currentReportMeta.label}>
              {currentReportMeta.label}
            </span>
            <span className="text-[10px] text-sky-600 font-medium">9 Enterprise Ledgers</span>
          </div>
          <div className="w-9 h-9 rounded bg-sky-50 border border-sky-100 flex items-center justify-center text-sky-600">
            <FileSpreadsheet className="w-4 h-4" />
          </div>
        </div>

        <div className="bg-white p-3 rounded border border-slate-200/90 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Total Ledger Entries</span>
            <span className="text-base font-extrabold text-slate-800 font-mono">
              {isLoading ? "..." : reportData?.totalRecords ?? 0}
            </span>
            <span className="text-[10px] text-emerald-600 font-medium block">Audited & Verified</span>
          </div>
          <div className="w-9 h-9 rounded bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
            <Layers className="w-4 h-4" />
          </div>
        </div>

        <div className="bg-white p-3 rounded border border-slate-200/90 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
              {primaryFinancialTotal?.label || "Report Financial Volume"}
            </span>
            <span className="text-base font-extrabold text-sky-700 font-mono">
              {isLoading
                ? "..."
                : typeof primaryFinancialTotal?.value === "number"
                ? formatCurrency(primaryFinancialTotal.value)
                : primaryFinancialTotal?.value ?? "0.00"}
            </span>
            <span className="text-[10px] text-slate-400 font-medium block">Corporate Value</span>
          </div>
          <div className="w-9 h-9 rounded bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
            <DollarSign className="w-4 h-4" />
          </div>
        </div>

        <div className="bg-white p-3 rounded border border-slate-200/90 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Ledger Generation</span>
            <span className="text-xs font-semibold text-slate-800">
              {reportData?.generatedAt ? new Date(reportData.generatedAt).toLocaleDateString("en-GB") : new Date().toLocaleDateString("en-GB")}
            </span>
            <span className="text-[10px] text-slate-400 block font-mono">BridgeOne ERP v2.4</span>
          </div>
          <div className="w-9 h-9 rounded bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
            <ShieldCheck className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white p-3.5 rounded border border-slate-200/90 shadow-xs space-y-3 print:hidden">
        {/* Quick Report Category Selector */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
          <div className="md:col-span-2">
            <label className="block text-[11px] font-bold text-slate-700 mb-1 flex items-center gap-1.5">
              <FileSpreadsheet className="w-3.5 h-3.5 text-sky-600" />
              <span>Select Ledger / Report Dimension *</span>
            </label>
            <select
              value={reportType}
              onChange={(e) => setReportType(e.target.value)}
              className="w-full border border-sky-300 rounded px-2.5 py-1.5 bg-sky-50/40 font-semibold text-slate-800 focus:bg-white text-xs focus:ring-1 focus:ring-sky-500 outline-none"
            >
              {REPORT_CATEGORIES.map((cat) => (
                <optgroup key={cat.group} label={cat.group}>
                  {cat.reports.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            <p className="text-[10px] text-slate-500 mt-0.5 italic">{currentReportMeta.desc}</p>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1 flex items-center gap-1">
              <Building className="w-3 h-3 text-slate-400" />
              <span>Branch / Facility</span>
            </label>
            <select
              value={selectedOffice}
              onChange={(e) => setSelectedOffice(e.target.value)}
              className="w-full border border-slate-300 rounded px-2 py-1.5 bg-slate-50 focus:bg-white text-xs outline-none"
            >
              <option value="ALL">All Branches & Facilities</option>
              {offices?.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1 flex items-center gap-1">
              <Package className="w-3 h-3 text-slate-400" />
              <span>Supplier Partner</span>
            </label>
            <select
              value={selectedSupplier}
              onChange={(e) => setSelectedSupplier(e.target.value)}
              className="w-full border border-slate-300 rounded px-2 py-1.5 bg-slate-50 focus:bg-white text-xs outline-none"
            >
              <option value="ALL">All Registered Suppliers</option>
              {suppliers?.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Date Range and Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs text-slate-600">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-[11px] font-medium text-slate-500">From:</span>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="border border-slate-300 rounded px-2 py-1 bg-slate-50 text-xs outline-none"
              />
              <span className="text-[11px] font-medium text-slate-500">To:</span>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="border border-slate-300 rounded px-2 py-1 bg-slate-50 text-xs outline-none"
              />
            </div>

            <label className="flex items-center gap-1.5 cursor-pointer text-xs text-slate-700 ml-2">
              <input
                type="checkbox"
                checked={isSummary}
                onChange={(e) => setIsSummary(e.target.checked)}
                className="rounded text-sky-600 focus:ring-sky-500 w-3.5 h-3.5"
              />
              <span className="font-semibold text-slate-700">Group Summary Mode</span>
            </label>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => refetch()}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1976d2] hover:bg-[#1565c0] text-white rounded text-xs font-semibold shadow-2xs transition"
            >
              <Filter className="w-3.5 h-3.5" />
              <span>Generate Ledger</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setSelectedOffice("ALL");
                setSelectedSupplier("ALL");
                setFromDate("");
                setToDate("");
                setIsSummary(false);
              }}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded text-xs transition"
              title="Reset Filters"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>

            <button
              type="button"
              onClick={handleClientExportCsv}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-semibold shadow-2xs transition"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>

            <button
              type="button"
              onClick={() => window.print()}
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded text-xs font-medium transition"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Ledger</span>
            </button>
          </div>
        </div>
      </div>

      {/* Summary KPI Banner if Available */}
      {reportData?.summary && Object.keys(reportData.summary).length > 0 && (
        <div className="bg-slate-900 text-white rounded p-3 flex flex-wrap items-center justify-between gap-4 text-xs shadow-xs">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span className="text-[11px] font-bold text-sky-400 uppercase tracking-wider">
              {currentReportMeta.label} Summary Totals:
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-6">
            {Object.entries(reportData.summary).map(([k, v]) => (
              <div key={k} className="flex items-center gap-2">
                <span className="text-slate-400 text-[11px]">{k}:</span>
                <span className="font-bold font-mono text-white text-xs">
                  {typeof v === "number" && (k.toLowerCase().includes("bdt") || k.toLowerCase().includes("value") || k.toLowerCase().includes("spend") || k.toLowerCase().includes("amount") || k.toLowerCase().includes("balance") || k.toLowerCase().includes("disbursement"))
                    ? formatCurrency(v)
                    : String(v)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Report Table (.erp-table all-borders styling) */}
      <div className="bg-white rounded border border-slate-300 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="erp-table w-full text-xs text-left border-collapse">
            <thead>
              <tr className="bg-slate-100 text-slate-800 font-bold border-b border-slate-300">
                {(reportData?.columns || []).map((col, idx) => (
                  <th
                    key={idx}
                    className={`p-2 border border-slate-300 whitespace-nowrap text-[11px] uppercase tracking-wider ${
                      col.toLowerCase().includes("amount") ||
                      col.toLowerCase().includes("spend") ||
                      col.toLowerCase().includes("value") ||
                      col.toLowerCase().includes("dues") ||
                      col.toLowerCase().includes("price") ||
                      col.toLowerCase().includes("balance") ||
                      col.toLowerCase().includes("receipts") ||
                      col.toLowerCase().includes("disbursements") ||
                      col.toLowerCase().includes("committed")
                        ? "text-right"
                        : col.toLowerCase() === "sl"
                        ? "text-center w-12"
                        : "text-left"
                    }`}
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={columnCount} className="text-center py-12 text-slate-400">
                    <div className="inline-flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-sky-600 border-t-transparent rounded-full animate-spin"></span>
                      <span>Compiling BridgeOne ERP report records...</span>
                    </div>
                  </td>
                </tr>
              ) : !reportData || reportData.rows.length === 0 ? (
                <tr>
                  <td colSpan={columnCount} className="text-center py-12 text-slate-400">
                    <div className="max-w-xs mx-auto text-center space-y-1">
                      <p className="text-xs font-semibold text-slate-600">No Records Found</p>
                      <p className="text-[11px] text-slate-400">No matching transactions found for the selected filter criteria.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                reportData.rows.map((row, rIdx) => (
                  <tr key={rIdx} className="hover:bg-sky-50/40 transition-colors border-b border-slate-200">
                    {reportData.columns.map((col, cIdx) => {
                      const val = row[col];
                      const colLower = col.toLowerCase();
                      const isMoney =
                        colLower.includes("amount") ||
                        colLower.includes("spend") ||
                        colLower.includes("value") ||
                        colLower.includes("dues") ||
                        colLower.includes("price") ||
                        colLower.includes("balance") ||
                        colLower.includes("receipts") ||
                        colLower.includes("disbursements") ||
                        colLower.includes("committed");

                      return (
                        <td
                          key={cIdx}
                          className={`p-2 border border-slate-200 whitespace-nowrap text-slate-700 ${
                            isMoney
                              ? "text-right font-mono font-medium text-slate-900"
                              : colLower === "sl"
                              ? "text-center font-mono text-slate-500"
                              : "text-left"
                          }`}
                        >
                          {colLower === "status" ? (
                            renderStatusBadge(val)
                          ) : isMoney && typeof val === "number" ? (
                            formatCurrency(val)
                          ) : colLower.includes("date") ? (
                            <span className="font-mono text-slate-600">{val ?? "-"}</span>
                          ) : colLower.includes("number") || colLower.includes("code") ? (
                            <span className="font-mono font-semibold text-slate-800">{val ?? "-"}</span>
                          ) : (
                            val ?? "-"
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))
              )}
            </tbody>

            {/* Column Total Footer */}
            {reportData && reportData.rows && reportData.rows.length > 0 && (
              <tfoot>
                <tr className="bg-slate-100/90 font-bold border-t-2 border-slate-300 text-slate-900">
                  {reportData.columns.map((col, cIdx) => {
                    const colLower = col.toLowerCase();
                    const isMoney =
                      colLower.includes("amount") ||
                      colLower.includes("spend") ||
                      colLower.includes("value") ||
                      colLower.includes("dues") ||
                      colLower.includes("price") ||
                      colLower.includes("balance") ||
                      colLower.includes("receipts") ||
                      colLower.includes("disbursements") ||
                      colLower.includes("committed");

                    if (cIdx === 0) {
                      return (
                        <td key={cIdx} className="p-2 border border-slate-300 text-center font-bold text-xs uppercase" colSpan={1}>
                          Total
                        </td>
                      );
                    }

                    if (isMoney) {
                      const totalVal = reportData.rows.reduce((sum, r) => {
                        const v = r[col];
                        return sum + (typeof v === "number" ? v : 0);
                      }, 0);
                      return (
                        <td key={cIdx} className="p-2 border border-slate-300 text-right font-mono font-extrabold text-sky-900 text-xs">
                          {formatCurrency(totalVal)}
                        </td>
                      );
                    }

                    return (
                      <td key={cIdx} className="p-2 border border-slate-300 text-slate-400 text-center">
                        -
                      </td>
                    );
                  })}
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {/* Record count footer */}
        <div className="p-2.5 bg-slate-50 border-t border-slate-300 flex items-center justify-between text-xs text-slate-500">
          <span>
            Displaying <strong className="text-slate-800">{reportData?.rows?.length ?? 0}</strong> record(s) in this ledger view.
          </span>
          <span className="text-[11px] text-slate-400 font-mono">
            BridgeOne ERP Ledger &bull; Confirmed &bull; Confidential
          </span>
        </div>
      </div>
    </div>
  );
}
