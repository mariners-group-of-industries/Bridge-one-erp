"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import {
  Calendar,
  CheckCircle2,
  ChevronRight,
  Download,
  FileSpreadsheet,
  FileText,
  Filter,
  Landmark,
  Layers,
  Percent,
  Printer,
  Search,
  ShieldCheck,
} from "lucide-react";
import { SummaryCard } from "@/components/purchase/SummaryCard";
import { useAccountingStore } from "@/features/accounts/store/accounting-store";

export default function OtherReportsPage() {
  const [selectedReport, setSelectedReport] = useState<string>("vat_register");
  const [selectedOffice, setSelectedOffice] = useState("all");
  const [fromDate, setFromDate] = useState("2026-07-01");
  const [toDate, setToDate] = useState("2027-06-30");
  const [taxRate, setTaxRate] = useState("15");

  const accounts = useAccountingStore((s) => s.accounts);
  const vouchers = useAccountingStore((s) => s.vouchers);
  const expenses = useAccountingStore((s) => s.expenses);
  const cheques = useAccountingStore((s) => s.cheques);
  const budgets = useAccountingStore((s) => s.budgets);
  const costCenters = useAccountingStore((s) => s.costCenters);

  // Computed Tax & VAT transactions
  const taxTransactions = useMemo(() => {
    return [
      {
        id: "tax-1",
        date: "2026-09-12",
        voucherNo: "JV-2026-0012",
        beneficiary: "Universal Raw Materials Ltd",
        invoiceAmount: 250000,
        taxType: "VAT",
        rate: 15,
        withholdingAmount: 37500,
        depositStatus: "CHALLAN_DEPOSITED",
        treasuryChallanNo: "TR-NBR-98711",
      },
      {
        id: "tax-2",
        date: "2026-09-20",
        voucherNo: "JV-2026-0015",
        beneficiary: "TechnoSoft Solutions BD",
        invoiceAmount: 120000,
        taxType: "AIT / TDS",
        rate: 10,
        withholdingAmount: 12000,
        depositStatus: "PENDING_DEPOSIT",
        treasuryChallanNo: "—",
      },
      {
        id: "tax-3",
        date: "2026-10-02",
        voucherNo: "JV-2026-0021",
        beneficiary: "Standard Logistics Express",
        invoiceAmount: 85000,
        taxType: "AIT / TDS",
        rate: 5,
        withholdingAmount: 4250,
        depositStatus: "CHALLAN_DEPOSITED",
        treasuryChallanNo: "TR-NBR-99042",
      },
    ];
  }, []);

  const totalWithheld = useMemo(
    () => taxTransactions.reduce((sum, t) => sum + t.withholdingAmount, 0),
    [taxTransactions],
  );
  const totalDeposited = useMemo(
    () =>
      taxTransactions
        .filter((t) => t.depositStatus === "CHALLAN_DEPOSITED")
        .reduce((sum, t) => sum + t.withholdingAmount, 0),
    [taxTransactions],
  );
  const totalPendingDeposit = useMemo(
    () =>
      taxTransactions
        .filter((t) => t.depositStatus === "PENDING_DEPOSIT")
        .reduce((sum, t) => sum + t.withholdingAmount, 0),
    [taxTransactions],
  );

  const handleExportCSV = () => {
    const csvContent =
      "data:text/csv;charset=utf-8," +
      ["Date,Voucher No,Beneficiary,Invoice Amount,Tax Type,Rate %,Withholding Amount,Status,Treasury Challan"]
        .concat(
          taxTransactions.map(
            (t) =>
              `"${t.date}","${t.voucherNo}","${t.beneficiary}",${t.invoiceAmount},"${t.taxType}",${t.rate},${t.withholdingAmount},"${t.depositStatus}","${t.treasuryChallanNo}"`,
          ),
        )
        .join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${selectedReport}_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-3 font-sans pb-12">
      {/* ------------------------------------------------------------- */}
      {/* 1. TOP HEADER */}
      {/* ------------------------------------------------------------- */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 rounded border border-slate-200/90 shadow-2xs">
        <div>
          <nav className="flex items-center gap-1.5 text-[11px] text-slate-400 mb-0.5">
            <Link href="/accounts" className="hover:text-slate-600 transition">
              Account
            </Link>
            <ChevronRight className="w-3 h-3 text-slate-300" />
            <span className="text-slate-600 font-medium">Other Reports</span>
          </nav>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Statutory Tax, VAT & Analytical Reports</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            NBR Mushak 9.1 VAT reports, Advance Income Tax (AIT / TDS) deductions, and cost center variance
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={handleExportCSV}
            className="h-9 px-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded flex items-center gap-1.5 shadow-xs transition"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Excel Export</span>
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            className="h-9 px-3.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-xs rounded flex items-center gap-1.5 shadow-xs transition"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Report</span>
          </button>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 2. SUMMARY KPI CARDS */}
      {/* ------------------------------------------------------------- */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <SummaryCard
          title="Total Tax Withheld"
          value={`৳${totalWithheld.toLocaleString()}`}
          subtitle="VAT + TDS source deductions"
          icon={Percent}
          variant="info"
        />
        <SummaryCard
          title="Treasury Deposited"
          value={`৳${totalDeposited.toLocaleString()}`}
          subtitle="Challan verified with NBR"
          icon={CheckCircle2}
          variant="success"
        />
        <SummaryCard
          title="Pending Government Deposit"
          value={`৳${totalPendingDeposit.toLocaleString()}`}
          subtitle="Payable within 15th of next month"
          icon={Landmark}
          variant="warning"
        />
        <SummaryCard
          title="Active Cost Centers"
          value={costCenters.length}
          subtitle="Analytical reporting dimensions"
          icon={Layers}
          variant="info"
        />
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 3. REPORT SELECTOR TABS & FILTER BAR */}
      {/* ------------------------------------------------------------- */}
      <div className="bg-white rounded border border-slate-200/90 shadow-2xs">
        <div className="flex items-center gap-1 px-3 border-b border-slate-200 overflow-x-auto text-xs font-medium">
          {[
            { id: "vat_register", label: "MUSHAK 9.1 VAT REGISTER" },
            { id: "tds_register", label: "AIT / TDS WITHHOLDING TAX" },
            { id: "jv_register", label: "JOURNAL VOUCHER AUDIT LOG" },
            { id: "cost_center", label: "COST CENTER BREAKDOWN" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSelectedReport(tab.id)}
              className={`py-2.5 px-3 whitespace-nowrap transition-colors border-b-2 -mb-[1px] ${
                selectedReport === tab.id
                  ? "text-blue-600 border-blue-600 font-semibold"
                  : "text-slate-500 border-transparent hover:text-slate-700"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Filter bar */}
        <div className="p-3 bg-slate-50/60 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-semibold text-slate-500 uppercase">From:</span>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="h-8 px-2 border border-slate-300 rounded text-xs bg-white focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-semibold text-slate-500 uppercase">To:</span>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="h-8 px-2 border border-slate-300 rounded text-xs bg-white focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-semibold text-slate-500 uppercase">Office:</span>
              <select
                value={selectedOffice}
                onChange={(e) => setSelectedOffice(e.target.value)}
                className="h-8 px-2 border border-slate-300 rounded text-xs bg-white focus:ring-1 focus:ring-blue-500"
              >
                <option value="all">Consolidated (All Branches)</option>
                <option value="office-main">Dhaka Corporate HQ</option>
                <option value="office-ctg">Chittagong Heavy Plant</option>
              </select>
            </div>
          </div>
        </div>

        {/* ------------------------------------------------------------- */}
        {/* 4. HIGH DENSITY REPORT DATA */}
        {/* ------------------------------------------------------------- */}
        <div className="p-4">
          {/* VAT / TDS Report */}
          {(selectedReport === "vat_register" || selectedReport === "tds_register") && (
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b pb-3 border-slate-200">
                <div>
                  <h3 className="font-bold text-slate-900 text-base">
                    {selectedReport === "vat_register"
                      ? "NBR Mushak 9.1 VAT Withholding Return Register"
                      : "Advance Income Tax (AIT / TDS) Deduction Register"}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Period: {fromDate} to {toDate} • National Board of Revenue Bangladesh Statutory Compliance
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto border border-slate-200 rounded">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                    <tr>
                      <th className="px-3.5 py-2.5">Date</th>
                      <th className="px-3.5 py-2.5">Voucher #</th>
                      <th className="px-3.5 py-2.5">Vendor / Beneficiary</th>
                      <th className="px-3.5 py-2.5 text-right">Invoice Gross (৳)</th>
                      <th className="px-3.5 py-2.5 text-center">Tax Type</th>
                      <th className="px-3.5 py-2.5 text-center">Rate</th>
                      <th className="px-3.5 py-2.5 text-right">Withholding (৳)</th>
                      <th className="px-3.5 py-2.5 text-center">Challan Deposit</th>
                      <th className="px-3.5 py-2.5">Treasury Challan #</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {taxTransactions
                      .filter((t) =>
                        selectedReport === "vat_register" ? t.taxType === "VAT" : t.taxType.includes("AIT"),
                      )
                      .map((t) => (
                        <tr key={t.id} className="hover:bg-slate-50/70 transition">
                          <td className="px-3.5 py-2 text-slate-600">{t.date}</td>
                          <td className="px-3.5 py-2 font-mono font-semibold text-blue-600">{t.voucherNo}</td>
                          <td className="px-3.5 py-2 font-medium text-slate-900">{t.beneficiary}</td>
                          <td className="px-3.5 py-2 text-right font-medium text-slate-800">
                            ৳{t.invoiceAmount.toLocaleString()}
                          </td>
                          <td className="px-3.5 py-2 text-center">
                            <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold text-[10px]">
                              {t.taxType}
                            </span>
                          </td>
                          <td className="px-3.5 py-2 text-center font-bold text-slate-800">{t.rate}%</td>
                          <td className="px-3.5 py-2 text-right font-bold text-rose-700">
                            ৳{t.withholdingAmount.toLocaleString()}
                          </td>
                          <td className="px-3.5 py-2 text-center">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold ${
                                t.depositStatus === "CHALLAN_DEPOSITED"
                                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                  : "bg-amber-50 text-amber-700 border border-amber-200"
                              }`}
                            >
                              {t.depositStatus.replace("_", " ")}
                            </span>
                          </td>
                          <td className="px-3.5 py-2 font-mono text-slate-600">{t.treasuryChallanNo}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* JV Register */}
          {selectedReport === "jv_register" && (
            <div className="space-y-4">
              <div className="border-b pb-3 border-slate-200">
                <h3 className="font-bold text-slate-900 text-base">Journal Voucher Audit Register</h3>
                <p className="text-xs text-slate-500">All posted, pending, and reversed journal vouchers</p>
              </div>

              <div className="overflow-x-auto border border-slate-200 rounded">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                    <tr>
                      <th className="px-3.5 py-2.5">Voucher #</th>
                      <th className="px-3.5 py-2.5">Date</th>
                      <th className="px-3.5 py-2.5">Branch</th>
                      <th className="px-3.5 py-2.5">Narration</th>
                      <th className="px-3.5 py-2.5 text-right">Debit Total (৳)</th>
                      <th className="px-3.5 py-2.5 text-right">Credit Total (৳)</th>
                      <th className="px-3.5 py-2.5 text-center">Status</th>
                      <th className="px-3.5 py-2.5">Created By</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {vouchers.map((v) => (
                      <tr key={v.id} className="hover:bg-slate-50/70 transition">
                        <td className="px-3.5 py-2 font-mono font-semibold text-blue-600">{v.voucherNumber}</td>
                        <td className="px-3.5 py-2 text-slate-600">{v.transactionDate}</td>
                        <td className="px-3.5 py-2 text-slate-800">{v.officeName}</td>
                        <td className="px-3.5 py-2 text-slate-600 max-w-sm truncate" title={v.narration}>
                          {v.narration}
                        </td>
                        <td className="px-3.5 py-2 text-right font-medium text-slate-900">
                          ৳{v.totalDebit.toLocaleString()}
                        </td>
                        <td className="px-3.5 py-2 text-right font-medium text-slate-900">
                          ৳{v.totalCredit.toLocaleString()}
                        </td>
                        <td className="px-3.5 py-2 text-center">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold ${
                              v.status === "POSTED"
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : v.status === "REVERSED"
                                ? "bg-rose-50 text-rose-700 border border-rose-200"
                                : "bg-amber-50 text-amber-700 border border-amber-200"
                            }`}
                          >
                            {v.status}
                          </span>
                        </td>
                        <td className="px-3.5 py-2 text-slate-500">{v.createdBy}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Cost Center Breakdown */}
          {selectedReport === "cost_center" && (
            <div className="space-y-4">
              <div className="border-b pb-3 border-slate-200">
                <h3 className="font-bold text-slate-900 text-base">Cost Center Expenditure & Budget Utilization</h3>
                <p className="text-xs text-slate-500">Consolidated analytics across all business units</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {costCenters.map((cc) => {
                  const ccBudgets = budgets.filter((b) => b.costCenterId === cc.id);
                  const ccAllocated = ccBudgets.reduce((s, b) => s + b.allocatedAmount, 0);
                  const ccSpent = ccBudgets.reduce((s, b) => s + b.utilizedAmount, 0);
                  const pct = ccAllocated > 0 ? (ccSpent / ccAllocated) * 100 : 0;

                  return (
                    <div key={cc.id} className="p-3.5 rounded border border-slate-200 bg-white shadow-2xs space-y-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-bold text-slate-900 text-sm">{cc.name}</div>
                          <div className="text-[11px] text-slate-400">
                            {cc.code} • {cc.type} • {cc.officeName}
                          </div>
                        </div>
                        <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-semibold text-[11px]">
                          {ccBudgets.length} Budget Heads
                        </span>
                      </div>

                      <div className="flex justify-between text-xs pt-1">
                        <span className="text-slate-500">Allocated: ৳{ccAllocated.toLocaleString()}</span>
                        <span className="font-bold text-slate-900">Spent: ৳{ccSpent.toLocaleString()}</span>
                      </div>

                      <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-blue-600 transition-all"
                          style={{ width: `${Math.min(100, pct)}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-[11px] text-slate-400">
                        <span>Utilization</span>
                        <span className="font-semibold text-slate-700">{pct.toFixed(1)}%</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
