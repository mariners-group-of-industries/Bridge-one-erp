"use client";

import React, { useMemo, useState } from "react";
import Image from "next/image";
import {
  ChevronDown,
  Download,
  FileSpreadsheet,
  FileText,
  Inbox,
  Printer,
  Search,
} from "lucide-react";
import { useAccountingStore } from "@/features/accounts/store/accounting-store";

export default function OtherReportsPage() {
  const vouchers = useAccountingStore((s) => s.vouchers);
  const expenses = useAccountingStore((s) => s.expenses);

  // Filters from Screenshot 4
  const [viewBy, setViewBy] = useState("AIT and Tax Register Report");
  const [fromDate, setFromDate] = useState("2025-07-01");
  const [toDate, setToDate] = useState("2026-10-13");
  const [monthWise, setMonthWise] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  // Active filter state on "View"
  const [activeReport, setActiveReport] = useState({
    viewBy: "AIT and Tax Register Report",
    fromDate: "2025-07-01",
    toDate: "2026-10-13",
    monthWise: false,
    showDetails: false,
  });

  const handleApplyView = () => {
    setActiveReport({
      viewBy,
      fromDate,
      toDate,
      monthWise,
      showDetails,
    });
  };

  // Sample seed tax transactions representing real Bridge One statutory data
  const taxTransactions = useMemo(() => {
    return [
      {
        id: "tax-01",
        date: "2026-09-12",
        voucherNo: "JV-2026-0012",
        beneficiary: "Universal Raw Materials Ltd",
        invoiceAmount: 250000.0,
        taxHead: "AIT on Procurement (Sec 52)",
        rate: 5.0,
        withholdingTax: 12500.0,
        treasuryChallanNo: "TR-NBR-98711",
        challanDate: "2026-09-18",
        status: "DEPOSITED",
      },
      {
        id: "tax-02",
        date: "2026-09-20",
        voucherNo: "JV-2026-0015",
        beneficiary: "TechnoSoft Solutions BD",
        invoiceAmount: 120000.0,
        taxHead: "TDS on Professional IT Services",
        rate: 10.0,
        withholdingTax: 12000.0,
        treasuryChallanNo: "TR-NBR-98845",
        challanDate: "2026-09-25",
        status: "DEPOSITED",
      },
      {
        id: "tax-03",
        date: "2026-10-02",
        voucherNo: "JV-2026-0021",
        beneficiary: "Standard Logistics Express",
        invoiceAmount: 85000.0,
        taxHead: "AIT on Transport & Freight",
        rate: 3.0,
        withholdingTax: 2550.0,
        treasuryChallanNo: "TR-NBR-99042",
        challanDate: "2026-10-08",
        status: "DEPOSITED",
      },
      {
        id: "tax-04",
        date: "2026-10-10",
        voucherNo: "EXP-MG261000105",
        beneficiary: "Al-Madina Printing & Packaging",
        invoiceAmount: 180000.0,
        taxHead: "VDS & AIT on Printing Supply",
        rate: 7.5,
        withholdingTax: 13500.0,
        treasuryChallanNo: "—",
        challanDate: "—",
        status: "PENDING_DEPOSIT",
      },
      {
        id: "tax-05",
        date: "2026-10-12",
        voucherNo: "EXP-MG261000108",
        beneficiary: "Delta Electrical Engineering Works",
        invoiceAmount: 95000.0,
        taxHead: "TDS on Technical Contract",
        rate: 5.0,
        withholdingTax: 4750.0,
        treasuryChallanNo: "—",
        challanDate: "—",
        status: "PENDING_DEPOSIT",
      },
    ];
  }, []);

  const totalInvoice = useMemo(
    () => taxTransactions.reduce((s, t) => s + t.invoiceAmount, 0),
    [taxTransactions],
  );
  const totalTax = useMemo(
    () => taxTransactions.reduce((s, t) => s + t.withholdingTax, 0),
    [taxTransactions],
  );
  const totalDeposited = useMemo(
    () =>
      taxTransactions
        .filter((t) => t.status === "DEPOSITED")
        .reduce((s, t) => s + t.withholdingTax, 0),
    [taxTransactions],
  );
  const totalPending = useMemo(
    () =>
      taxTransactions
        .filter((t) => t.status === "PENDING_DEPOSIT")
        .reduce((s, t) => s + t.withholdingTax, 0),
    [taxTransactions],
  );

  const formatAmount = (val: number) => {
    return val.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const handleExportCSV = () => {
    const headers =
      "SL,Date,Voucher No,Beneficiary,Invoice Amount,Tax Head,Rate %,Withholding Tax,Challan No,Challan Date,Status\n";
    const rows = taxTransactions
      .map(
        (t, idx) =>
          `${idx + 1},"${t.date}","${t.voucherNo}","${t.beneficiary}",${t.invoiceAmount},"${t.taxHead}",${t.rate},${t.withholdingTax},"${t.treasuryChallanNo}","${t.challanDate}","${t.status}"`,
      )
      .join("\n");
    const blob = new Blob([headers + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `tax_register_report_${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-800 font-sans pb-16">
      {/* ------------------------------------------------------------- */}
      {/* 1. TOP HEADER (Other Reports Title + PDF & EXCEL Buttons) */}
      {/* ------------------------------------------------------------- */}
      <div className="bg-white border-b border-slate-200">
        <div className="px-4 py-2.5 flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-800 tracking-tight">Other Reports</h2>

          {/* Top Right Action Buttons from Screenshot 4 */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="h-7 px-3 border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded flex items-center gap-1.5 transition shadow-2xs"
            >
              <Printer className="w-3.5 h-3.5 text-slate-600" />
              <span>PDF</span>
            </button>

            <button
              type="button"
              onClick={handleExportCSV}
              className="h-7 px-3 border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded flex items-center gap-1.5 transition shadow-2xs"
            >
              <Download className="w-3.5 h-3.5 text-slate-600" />
              <span>EXCEL</span>
            </button>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 2. FILTER BAR (Matching Screenshot 4) */}
      {/* ------------------------------------------------------------- */}
      <div className="px-4 py-3 bg-white border-b border-slate-200/90 shadow-2xs space-y-3">
        {/* Row 1: View By * Dropdown */}
        <div>
          <label className="block text-[11px] font-semibold text-slate-700 mb-1">
            View By <span className="text-rose-500 font-bold">*</span>
          </label>
          <div className="relative w-80 max-w-full">
            <select
              value={viewBy}
              onChange={(e) => setViewBy(e.target.value)}
              className="w-full h-8 px-2.5 pr-8 border border-slate-300 rounded text-xs bg-white text-slate-800 appearance-none focus:outline-none focus:ring-1 focus:ring-[#2563eb]"
            >
              <option value="AIT and Tax Register Report">AIT and Tax Register Report</option>
              <option value="VAT Register (NBR Mushak 9.1)">VAT Register (NBR Mushak 9.1)</option>
              <option value="Withholding Tax Deductions (VDS & TDS)">
                Withholding Tax Deductions (VDS & TDS)
              </option>
              <option value="Cheque Disbursement Register">Cheque Disbursement Register</option>
              <option value="Advance Adjustment Report">Advance Adjustment Report</option>
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>

        {/* Row 2: From Date, To Date, Checkboxes, View Button */}
        <div className="flex flex-wrap items-end gap-5 text-xs">
          {/* From Date */}
          <div className="w-40">
            <label className="block text-[11px] font-semibold text-slate-700 mb-1">From Date</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-full h-8 px-2.5 border border-slate-300 rounded text-xs bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#2563eb]"
            />
          </div>

          {/* To Date */}
          <div className="w-40">
            <label className="block text-[11px] font-semibold text-slate-700 mb-1">To Date</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="w-full h-8 px-2.5 border border-slate-300 rounded text-xs bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#2563eb]"
            />
          </div>

          {/* Checkboxes */}
          <div className="flex items-center gap-6 h-8">
            <label className="flex items-center gap-2 cursor-pointer select-none text-slate-700">
              <input
                type="checkbox"
                checked={monthWise}
                onChange={(e) => setMonthWise(e.target.checked)}
                className="w-3.5 h-3.5 rounded border-slate-300 text-[#2563eb] focus:ring-[#2563eb]"
              />
              <span>AIT/TDS Month Wise</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer select-none text-slate-700">
              <input
                type="checkbox"
                checked={showDetails}
                onChange={(e) => setShowDetails(e.target.checked)}
                className="w-3.5 h-3.5 rounded border-slate-300 text-[#2563eb] focus:ring-[#2563eb]"
              />
              <span>AIT/TDS Details</span>
            </label>
          </div>

          {/* View Button */}
          <div>
            <button
              type="button"
              onClick={handleApplyView}
              className="h-8 px-5 bg-[#2563eb] hover:bg-blue-700 text-white font-medium text-xs rounded transition shadow-2xs"
            >
              View
            </button>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 3. REPORT DATA VIEW */}
      {/* ------------------------------------------------------------- */}
      <div className="px-4 mt-3">
        <div className="bg-white border border-slate-200 rounded shadow-2xs p-4 space-y-4">
          {/* Header with Bridge One Official Logo */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-slate-200 pb-3 gap-3">
            <div className="flex items-center gap-3">
              <div className="relative w-28 h-8">
                <Image
                  src="/logo.png"
                  alt="Bridge One ERP"
                  fill
                  className="object-contain"
                  priority
                />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-tight">
                  {activeReport.viewBy}
                </h3>
                <p className="text-[11px] text-slate-500">
                  Tax Assessment Period:{" "}
                  <span className="font-semibold text-slate-700">
                    {activeReport.fromDate} to {activeReport.toDate}
                  </span>{" "}
                  • Standard Compliance: National Board of Revenue (NBR)
                </p>
              </div>
            </div>

            {/* Quick Stat Badges */}
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded bg-slate-100 text-slate-700 font-medium text-xs">
                Total Withheld: <strong className="text-slate-900">৳{formatAmount(totalTax)}</strong>
              </span>
              <span className="px-2.5 py-1 rounded bg-emerald-50 text-emerald-700 font-medium text-xs">
                Deposited: <strong>৳{formatAmount(totalDeposited)}</strong>
              </span>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border border-slate-200">
              <thead className="bg-[#f8fafc] border-b border-slate-200 text-[11px] font-semibold text-slate-700">
                <tr>
                  <th className="px-2.5 py-2 text-center w-12 border-r border-slate-200">SL</th>
                  <th className="px-3 py-2 border-r border-slate-200 w-24">Date</th>
                  <th className="px-3 py-2 border-r border-slate-200 w-32">Voucher No</th>
                  <th className="px-3 py-2 border-r border-slate-200">Beneficiary / Supplier Name</th>
                  <th className="px-3 py-2 text-right border-r border-slate-200 w-28">Invoice Amount (৳)</th>
                  <th className="px-3 py-2 border-r border-slate-200 w-36">Tax Head</th>
                  <th className="px-2.5 py-2 text-center border-r border-slate-200 w-16">Rate (%)</th>
                  <th className="px-3 py-2 text-right border-r border-slate-200 w-28">Withholding Tax (৳)</th>
                  <th className="px-3 py-2 border-r border-slate-200 w-32">Challan No</th>
                  <th className="px-3 py-2 text-center w-28">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {taxTransactions.map((tx, idx) => (
                  <tr key={tx.id} className="hover:bg-slate-50/70">
                    <td className="px-2.5 py-2 text-center text-slate-500 border-r border-slate-200/70">
                      {idx + 1}
                    </td>
                    <td className="px-3 py-2 text-slate-700 border-r border-slate-200/70 whitespace-nowrap">
                      {tx.date}
                    </td>
                    <td className="px-3 py-2 font-mono font-medium text-blue-600 border-r border-slate-200/70 whitespace-nowrap">
                      {tx.voucherNo}
                    </td>
                    <td className="px-3 py-2 font-medium text-slate-800 border-r border-slate-200/70">
                      {tx.beneficiary}
                    </td>
                    <td className="px-3 py-2 text-right font-medium text-slate-900 border-r border-slate-200/70 whitespace-nowrap">
                      {formatAmount(tx.invoiceAmount)}
                    </td>
                    <td className="px-3 py-2 text-slate-600 border-r border-slate-200/70 text-[11px]">
                      {tx.taxHead}
                    </td>
                    <td className="px-2.5 py-2 text-center font-medium text-slate-700 border-r border-slate-200/70">
                      {tx.rate}%
                    </td>
                    <td className="px-3 py-2 text-right font-bold text-slate-900 border-r border-slate-200/70 whitespace-nowrap">
                      {formatAmount(tx.withholdingTax)}
                    </td>
                    <td className="px-3 py-2 font-mono text-[11px] text-slate-600 border-r border-slate-200/70 whitespace-nowrap">
                      {tx.treasuryChallanNo}
                    </td>
                    <td className="px-3 py-2 text-center whitespace-nowrap">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          tx.status === "DEPOSITED"
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : "bg-amber-50 text-amber-700 border border-amber-200"
                        }`}
                      >
                        {tx.status === "DEPOSITED" ? "Deposited" : "Pending"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-50 font-bold border-t-2 border-slate-300 text-slate-900">
                  <td colSpan={4} className="px-3 py-2.5 text-right uppercase text-[11px] tracking-wider">
                    Total:
                  </td>
                  <td className="px-3 py-2.5 text-right border-r border-slate-200">
                    ৳{formatAmount(totalInvoice)}
                  </td>
                  <td colSpan={2} className="border-r border-slate-200"></td>
                  <td className="px-3 py-2.5 text-right border-r border-slate-200 text-blue-700">
                    ৳{formatAmount(totalTax)}
                  </td>
                  <td colSpan={2}></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
