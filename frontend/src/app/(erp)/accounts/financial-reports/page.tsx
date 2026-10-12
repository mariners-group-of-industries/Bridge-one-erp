"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowDownRight,
  ArrowUpRight,
  BookOpen,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Download,
  FileSpreadsheet,
  FileText,
  Filter,
  Layers,
  Printer,
  Scale,
  Search,
  ShieldCheck,
} from "lucide-react";
import { SummaryCard } from "@/components/purchase/SummaryCard";
import { useAccountingStore } from "@/features/accounts/store/accounting-store";

export default function FinancialReportsPage() {
  const [reportType, setReportType] = useState<
    "tb" | "gl" | "pl" | "bs" | "cashbook" | "bankbook" | "ar" | "ap"
  >("tb");
  const [selectedOffice, setSelectedOffice] = useState("all");
  const [selectedAccount, setSelectedAccount] = useState("all");
  const [fromDate, setFromDate] = useState("2026-07-01");
  const [toDate, setToDate] = useState("2027-06-30");
  const [includeZero, setIncludeZero] = useState(false);
  const [withoutDecimal, setWithoutDecimal] = useState(false);

  const accounts = useAccountingStore((s) => s.accounts);
  const getTrialBalance = useAccountingStore((s) => s.getTrialBalance);
  const getProfitAndLoss = useAccountingStore((s) => s.getProfitAndLoss);
  const getBalanceSheet = useAccountingStore((s) => s.getBalanceSheet);
  const getGeneralLedger = useAccountingStore((s) => s.getGeneralLedger);

  const tbData = useMemo(() => getTrialBalance(), [getTrialBalance]);
  const plData = useMemo(() => getProfitAndLoss(fromDate, toDate), [getProfitAndLoss, fromDate, toDate]);
  const bsData = useMemo(() => getBalanceSheet(), [getBalanceSheet]);
  const glData = useMemo(
    () => getGeneralLedger(selectedAccount === "all" ? undefined : selectedAccount, fromDate, toDate),
    [getGeneralLedger, selectedAccount, fromDate, toDate],
  );

  const formatAmount = (val: number) => {
    const formatted = withoutDecimal
      ? Math.round(val).toLocaleString()
      : val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return `৳${formatted}`;
  };

  const handleExportCSV = () => {
    let rows: string[] = [];
    if (reportType === "tb") {
      rows = ["Account Code,Account Name,Account Type,Debit,Credit"].concat(
        tbData.rows.map((r) => `"${r.code}","${r.name}","${r.type}",${r.debit},${r.credit}`),
      );
    } else if (reportType === "gl") {
      rows = ["Date,Voucher No,Type,Account,Narration,Debit,Credit,Running Balance"].concat(
        glData.map(
          (g) =>
            `"${g.date}","${g.voucherNumber}","${g.transactionType}","${g.accountName}","${g.narration}",${g.debit},${g.credit},${g.runningBalance}`,
        ),
      );
    } else if (reportType === "pl") {
      rows = ["Category,Account Name,Amount"]
        .concat(plData.revenues.map((r) => `"Revenue","${r.name}",${r.amount}`))
        .concat(plData.expenses.map((e) => `"Expense","${e.name}",${e.amount}`));
    } else {
      rows = ["Account Class,Account Title,Amount"]
        .concat(bsData.assets.map((a) => `"Asset","${a.name}",${a.amount}`))
        .concat(bsData.liabilities.map((l) => `"Liability","${l.name}",${l.amount}`))
        .concat(bsData.equity.map((e) => `"Equity","${e.name}",${e.amount}`));
    }

    const csvContent = "data:text/csv;charset=utf-8," + rows.join("\n");
    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(csvContent));
    link.setAttribute("download", `${reportType}_report_${new Date().toISOString().split("T")[0]}.csv`);
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
            <span className="text-slate-600 font-medium">Financial Reports</span>
          </nav>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Auditable Financial Statements & Ledgers</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Trial Balance reconciliation, General Ledger audit trail, Profit & Loss, and Balance Sheet statements
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
          title="TB Status"
          value={tbData.isBalanced ? "BALANCED" : "OUT OF BALANCE"}
          subtitle={`Diff: ৳${Math.abs(tbData.totalDebit - tbData.totalCredit).toLocaleString()}`}
          icon={tbData.isBalanced ? CheckCircle2 : Scale}
          variant={tbData.isBalanced ? "success" : "danger"}
        />
        <SummaryCard
          title="Net Profit / Loss"
          value={formatAmount(plData.netProfit)}
          subtitle={`${plData.totalRevenue > 0 ? ((plData.netProfit / plData.totalRevenue) * 100).toFixed(1) : "0"}% margin`}
          icon={plData.netProfit >= 0 ? ArrowUpRight : ArrowDownRight}
          variant={plData.netProfit >= 0 ? "info" : "warning"}
        />
        <SummaryCard
          title="Total Assets"
          value={formatAmount(bsData.totalAssets)}
          subtitle="Fixed + Current Liquid Assets"
          icon={BookOpen}
          variant="info"
        />
        <SummaryCard
          title="Liabilities & Equity"
          value={formatAmount(bsData.totalLiabilities + bsData.totalEquity)}
          subtitle={bsData.isBalanced ? "Accounting Equation Verified" : "Recheck required"}
          icon={ShieldCheck}
          variant="success"
        />
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 3. REPORT SELECTOR TABS */}
      {/* ------------------------------------------------------------- */}
      <div className="bg-white rounded border border-slate-200/90 shadow-2xs">
        <div className="flex items-center gap-1 px-3 border-b border-slate-200 overflow-x-auto text-xs font-medium">
          {[
            { id: "tb", label: "TRIAL BALANCE" },
            { id: "gl", label: "GENERAL LEDGER" },
            { id: "pl", label: "PROFIT & LOSS (INCOME STMT)" },
            { id: "bs", label: "BALANCE SHEET" },
            { id: "cashbook", label: "CASH BOOK" },
            { id: "bankbook", label: "BANK BOOK" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setReportType(tab.id as any)}
              className={`py-2.5 px-3 whitespace-nowrap transition-colors border-b-2 -mb-[1px] ${
                reportType === tab.id
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

            {reportType === "gl" && (
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-semibold text-slate-500 uppercase">Account:</span>
                <select
                  value={selectedAccount}
                  onChange={(e) => setSelectedAccount(e.target.value)}
                  className="h-8 px-2 border border-slate-300 rounded text-xs bg-white focus:ring-1 focus:ring-blue-500"
                >
                  <option value="all">All Chart Accounts</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.code} - {a.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

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

          <div className="flex items-center gap-4 text-slate-700">
            <label className="flex items-center gap-1.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={withoutDecimal}
                onChange={(e) => setWithoutDecimal(e.target.checked)}
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-xs">Round Decimals</span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={includeZero}
                onChange={(e) => setIncludeZero(e.target.checked)}
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-xs">Include Zero Balances</span>
            </label>
          </div>
        </div>

        {/* ------------------------------------------------------------- */}
        {/* 4. FINANCIAL STATEMENT DISPLAY */}
        {/* ------------------------------------------------------------- */}
        <div className="p-4">
          {/* A. TRIAL BALANCE */}
          {reportType === "tb" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b pb-3 border-slate-200">
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Trial Balance Reconciliation</h3>
                  <p className="text-xs text-slate-500">
                    As on {toDate} • General Ledger Debit / Credit equilibrium check
                  </p>
                </div>
                {tbData.isBalanced ? (
                  <span className="px-2.5 py-1 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold">
                    ✓ Balanced
                  </span>
                ) : (
                  <span className="px-2.5 py-1 rounded bg-rose-50 text-rose-700 border border-rose-200 text-xs font-bold">
                    ⚠ Imbalance: ৳{Math.abs(tbData.totalDebit - tbData.totalCredit).toLocaleString()}
                  </span>
                )}
              </div>

              <div className="overflow-x-auto border border-slate-200 rounded">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                    <tr>
                      <th className="px-3.5 py-2.5">Code</th>
                      <th className="px-3.5 py-2.5">Account Title</th>
                      <th className="px-3.5 py-2.5">Classification</th>
                      <th className="px-3.5 py-2.5 text-right">Debit (৳)</th>
                      <th className="px-3.5 py-2.5 text-right">Credit (৳)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {tbData.rows.map((row) => (
                      <tr key={row.code} className="hover:bg-slate-50/70 transition">
                        <td className="px-3.5 py-2 font-mono font-semibold text-blue-600">{row.code}</td>
                        <td className="px-3.5 py-2 font-medium text-slate-900">{row.name}</td>
                        <td className="px-3.5 py-2 text-slate-500">{row.type}</td>
                        <td className="px-3.5 py-2 text-right font-medium text-slate-900">
                          {row.debit > 0 ? formatAmount(row.debit) : "—"}
                        </td>
                        <td className="px-3.5 py-2 text-right font-medium text-slate-900">
                          {row.credit > 0 ? formatAmount(row.credit) : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-slate-100/80 font-bold border-t-2 border-slate-300">
                    <tr>
                      <td colSpan={3} className="px-3.5 py-2.5 text-slate-900 uppercase">
                        Total Sum
                      </td>
                      <td className="px-3.5 py-2.5 text-right text-slate-900">{formatAmount(tbData.totalDebit)}</td>
                      <td className="px-3.5 py-2.5 text-right text-slate-900">{formatAmount(tbData.totalCredit)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* B. GENERAL LEDGER */}
          {reportType === "gl" && (
            <div className="space-y-4">
              <div className="border-b pb-3 border-slate-200">
                <h3 className="font-bold text-slate-900 text-base">General Ledger Detail</h3>
                <p className="text-xs text-slate-500">
                  Transaction entries from {fromDate} to {toDate}
                </p>
              </div>

              <div className="overflow-x-auto border border-slate-200 rounded">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                    <tr>
                      <th className="px-3.5 py-2.5">Date</th>
                      <th className="px-3.5 py-2.5">Voucher #</th>
                      <th className="px-3.5 py-2.5">Type</th>
                      <th className="px-3.5 py-2.5">Account Title</th>
                      <th className="px-3.5 py-2.5">Narration / Description</th>
                      <th className="px-3.5 py-2.5 text-right">Debit (৳)</th>
                      <th className="px-3.5 py-2.5 text-right">Credit (৳)</th>
                      <th className="px-3.5 py-2.5 text-right">Running Balance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {glData.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-8 text-center text-slate-400">
                          No ledger postings found for the selected period.
                        </td>
                      </tr>
                    ) : (
                      glData.map((g, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/70 transition">
                          <td className="px-3.5 py-2 text-slate-600 whitespace-nowrap">{g.date}</td>
                          <td className="px-3.5 py-2 font-mono font-semibold text-blue-600">{g.voucherNumber}</td>
                          <td className="px-3.5 py-2">
                            <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-medium">
                              {g.transactionType}
                            </span>
                          </td>
                          <td className="px-3.5 py-2 font-medium text-slate-900">{g.accountName}</td>
                          <td className="px-3.5 py-2 text-slate-500 max-w-xs truncate" title={g.narration}>
                            {g.narration}
                          </td>
                          <td className="px-3.5 py-2 text-right font-medium text-slate-900">
                            {g.debit > 0 ? formatAmount(g.debit) : "—"}
                          </td>
                          <td className="px-3.5 py-2 text-right font-medium text-slate-900">
                            {g.credit > 0 ? formatAmount(g.credit) : "—"}
                          </td>
                          <td className="px-3.5 py-2 text-right font-bold text-slate-900">
                            {formatAmount(g.runningBalance)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* C. PROFIT & LOSS */}
          {reportType === "pl" && (
            <div className="space-y-4 max-w-4xl">
              <div className="border-b pb-3 border-slate-200">
                <h3 className="font-bold text-slate-900 text-base">Statement of Profit or Loss (Income Statement)</h3>
                <p className="text-xs text-slate-500">
                  For the period: {fromDate} to {toDate}
                </p>
              </div>

              <div className="border border-slate-200 rounded overflow-hidden divide-y divide-slate-200">
                {/* Revenue */}
                <div className="p-3 bg-emerald-50/50">
                  <div className="flex justify-between items-center font-bold text-emerald-900 text-sm">
                    <span>1. Operating Revenue & Sales</span>
                    <span>{formatAmount(plData.totalRevenue)}</span>
                  </div>
                </div>
                <div className="divide-y divide-slate-100">
                  {plData.revenues.map((r, i) => (
                    <div key={i} className="flex justify-between px-6 py-2 text-xs text-slate-700">
                      <span>{r.name}</span>
                      <span className="font-medium">{formatAmount(r.amount)}</span>
                    </div>
                  ))}
                </div>

                {/* Expenses */}
                <div className="p-3 bg-amber-50/50">
                  <div className="flex justify-between items-center font-bold text-amber-900 text-sm">
                    <span>2. Operating Expenses & Overheads</span>
                    <span>{formatAmount(plData.totalExpense)}</span>
                  </div>
                </div>
                <div className="divide-y divide-slate-100">
                  {plData.expenses.map((e, i) => (
                    <div key={i} className="flex justify-between px-6 py-2 text-xs text-slate-700">
                      <span>{e.name}</span>
                      <span className="font-medium">{formatAmount(e.amount)}</span>
                    </div>
                  ))}
                </div>

                {/* Net Income */}
                <div className="p-3.5 bg-slate-900 text-white flex justify-between items-center font-bold text-base">
                  <span>Net Profit / (Loss) for the Period</span>
                  <span className={plData.netProfit >= 0 ? "text-emerald-400" : "text-rose-400"}>
                    {formatAmount(plData.netProfit)}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* D. BALANCE SHEET */}
          {reportType === "bs" && (
            <div className="space-y-4 max-w-4xl">
              <div className="border-b pb-3 border-slate-200">
                <h3 className="font-bold text-slate-900 text-base">Statement of Financial Position (Balance Sheet)</h3>
                <p className="text-xs text-slate-500">As on {toDate}</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Assets Column */}
                <div className="border border-slate-200 rounded overflow-hidden divide-y divide-slate-200">
                  <div className="p-3 bg-blue-50 font-bold text-blue-900 text-sm flex justify-between">
                    <span>ASSETS</span>
                    <span>{formatAmount(bsData.totalAssets)}</span>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {bsData.assets.map((a, i) => (
                      <div key={i} className="flex justify-between px-4 py-2 text-xs text-slate-700">
                        <span>{a.name}</span>
                        <span className="font-medium">{formatAmount(a.amount)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Liabilities & Equity */}
                <div className="space-y-4">
                  <div className="border border-slate-200 rounded overflow-hidden divide-y divide-slate-200">
                    <div className="p-3 bg-rose-50 font-bold text-rose-900 text-sm flex justify-between">
                      <span>LIABILITIES</span>
                      <span>{formatAmount(bsData.totalLiabilities)}</span>
                    </div>
                    <div className="divide-y divide-slate-100">
                      {bsData.liabilities.map((l, i) => (
                        <div key={i} className="flex justify-between px-4 py-2 text-xs text-slate-700">
                          <span>{l.name}</span>
                          <span className="font-medium">{formatAmount(l.amount)}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="border border-slate-200 rounded overflow-hidden divide-y divide-slate-200">
                    <div className="p-3 bg-purple-50 font-bold text-purple-900 text-sm flex justify-between">
                      <span>EQUITY & RESERVES</span>
                      <span>{formatAmount(bsData.totalEquity)}</span>
                    </div>
                    <div className="divide-y divide-slate-100">
                      {bsData.equity.map((e, i) => (
                        <div key={i} className="flex justify-between px-4 py-2 text-xs text-slate-700">
                          <span>{e.name}</span>
                          <span className="font-medium">{formatAmount(e.amount)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* E. CASH / BANK BOOK */}
          {(reportType === "cashbook" || reportType === "bankbook") && (
            <div className="space-y-4">
              <div className="border-b pb-3 border-slate-200">
                <h3 className="font-bold text-slate-900 text-base">
                  {reportType === "cashbook" ? "Cash Book (Petty & Office Cash)" : "Bank Book (Bank Accounts Register)"}
                </h3>
                <p className="text-xs text-slate-500">
                  Receipts, disbursements, and reconciliation balances from {fromDate} to {toDate}
                </p>
              </div>

              <div className="overflow-x-auto border border-slate-200 rounded">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                    <tr>
                      <th className="px-3.5 py-2.5">Date</th>
                      <th className="px-3.5 py-2.5">Voucher / Slip #</th>
                      <th className="px-3.5 py-2.5">Description</th>
                      <th className="px-3.5 py-2.5 text-right">Receipts (Debit ৳)</th>
                      <th className="px-3.5 py-2.5 text-right">Payments (Credit ৳)</th>
                      <th className="px-3.5 py-2.5 text-right">Closing Balance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {glData
                      .filter((g) =>
                        reportType === "cashbook"
                          ? g.accountName.toLowerCase().includes("cash")
                          : g.accountName.toLowerCase().includes("bank"),
                      )
                      .map((g, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/70 transition">
                          <td className="px-3.5 py-2 text-slate-600">{g.date}</td>
                          <td className="px-3.5 py-2 font-mono font-semibold text-blue-600">{g.voucherNumber}</td>
                          <td className="px-3.5 py-2 text-slate-800">{g.narration}</td>
                          <td className="px-3.5 py-2 text-right font-medium text-emerald-700">
                            {g.debit > 0 ? formatAmount(g.debit) : "—"}
                          </td>
                          <td className="px-3.5 py-2 text-right font-medium text-rose-700">
                            {g.credit > 0 ? formatAmount(g.credit) : "—"}
                          </td>
                          <td className="px-3.5 py-2 text-right font-bold text-slate-900">
                            {formatAmount(g.runningBalance)}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
