"use client";

import React, { useMemo, useState } from "react";
import Image from "next/image";
import {
  ChevronDown,
  Download,
  FileSpreadsheet,
  Inbox,
  Printer,
  Search,
} from "lucide-react";
import { useAccountingStore } from "@/features/accounts/store/accounting-store";

export default function FinancialReportsPage() {
  const accounts = useAccountingStore((s) => s.accounts);
  const vouchers = useAccountingStore((s) => s.vouchers);
  const getTrialBalance = useAccountingStore((s) => s.getTrialBalance);
  const getProfitAndLoss = useAccountingStore((s) => s.getProfitAndLoss);
  const getBalanceSheet = useAccountingStore((s) => s.getBalanceSheet);
  const getGeneralLedger = useAccountingStore((s) => s.getGeneralLedger);

  // Filter States from Screenshot 3
  const [reportType, setReportType] = useState<string>("Ledger");
  const [selectedOffice, setSelectedOffice] = useState<string>("ALL");
  const [ledgerType, setLedgerType] = useState<string>("General Ledger");
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");
  const [fromDate, setFromDate] = useState<string>("2026-09-12");
  const [toDate, setToDate] = useState<string>("2026-10-13");
  const [officeWise, setOfficeWise] = useState<boolean>(false);
  const [withoutDecimal, setWithoutDecimal] = useState<boolean>(false);

  // Active view state
  const [hasViewed, setHasViewed] = useState<boolean>(true);
  const [activeReport, setActiveReport] = useState<{
    reportType: string;
    office: string;
    ledgerType: string;
    accountId: string;
    fromDate: string;
    toDate: string;
    officeWise: boolean;
    withoutDecimal: boolean;
  }>({
    reportType: "Ledger",
    office: "ALL",
    ledgerType: "General Ledger",
    accountId: "",
    fromDate: "2026-09-12",
    toDate: "2026-10-13",
    officeWise: false,
    withoutDecimal: false,
  });

  const handleView = () => {
    setActiveReport({
      reportType,
      office: selectedOffice,
      ledgerType,
      accountId: selectedAccountId,
      fromDate,
      toDate,
      officeWise,
      withoutDecimal,
    });
    setHasViewed(true);
  };

  // Format numbers helper
  const formatAmount = (val: number | undefined | null) => {
    if (val === undefined || val === null) return "0.00";
    if (activeReport.withoutDecimal) {
      return Math.round(val).toLocaleString();
    }
    return val.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  // Selected Account details
  const currentAccount = useMemo(() => {
    if (!activeReport.accountId) return null;
    return accounts.find((a) => a.id === activeReport.accountId);
  }, [accounts, activeReport.accountId]);

  // Compute General Ledger Entries
  const ledgerEntries = useMemo(() => {
    const raw = getGeneralLedger(
      activeReport.accountId || undefined,
      activeReport.fromDate,
      activeReport.toDate,
    );

    if (activeReport.office !== "ALL") {
      return raw.filter((r) =>
        r.officeName.toLowerCase().includes(activeReport.office.toLowerCase()),
      );
    }
    return raw;
  }, [getGeneralLedger, activeReport]);

  const totalDebit = useMemo(
    () => ledgerEntries.reduce((sum, r) => sum + r.debit, 0),
    [ledgerEntries],
  );
  const totalCredit = useMemo(
    () => ledgerEntries.reduce((sum, r) => sum + r.credit, 0),
    [ledgerEntries],
  );

  // Trial Balance Data
  const tbData = useMemo(() => getTrialBalance(), [getTrialBalance]);

  // Profit & Loss Data
  const plData = useMemo(
    () => getProfitAndLoss(activeReport.fromDate, activeReport.toDate),
    [getProfitAndLoss, activeReport.fromDate, activeReport.toDate],
  );

  // Balance Sheet Data
  const bsData = useMemo(() => getBalanceSheet(), [getBalanceSheet]);

  const handleExportCSV = () => {
    let rows: string[] = [];
    if (activeReport.reportType === "Ledger") {
      rows = [
        "Date,Voucher No,Transaction Type,Narration,Office,Debit,Credit,Running Balance",
      ].concat(
        ledgerEntries.map(
          (g) =>
            `"${g.date}","${g.voucherNumber}","${g.transactionType}","${g.narration}","${g.officeName}",${g.debit},${g.credit},${g.runningBalance}`,
        ),
      );
    } else if (activeReport.reportType === "Trial Balance") {
      rows = ["Code,Name,Type,Debit,Credit"].concat(
        tbData.rows.map(
          (r) => `"${r.code}","${r.name}","${r.type}",${r.debit},${r.credit}`,
        ),
      );
    } else if (activeReport.reportType === "Profit & Loss") {
      rows = ["Class,Account,Amount"]
        .concat(plData.revenues.map((r) => `"Revenue","${r.name}",${r.amount}`))
        .concat(plData.expenses.map((e) => `"Expense","${e.name}",${e.amount}`));
    } else {
      rows = ["Category,Title,Amount"]
        .concat(bsData.assets.map((a) => `"Asset","${a.name}",${a.amount}`))
        .concat(bsData.liabilities.map((l) => `"Liability","${l.name}",${l.amount}`))
        .concat(bsData.equity.map((e) => `"Equity","${e.name}",${e.amount}`));
    }

    const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${activeReport.reportType.toLowerCase().replace(/\s+/g, "_")}_${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-800 font-sans pb-16">
      {/* ------------------------------------------------------------- */}
      {/* 1. TOP TAB BAR */}
      {/* ------------------------------------------------------------- */}
      <div className="bg-white border-b border-slate-200">
        <div className="px-4 flex items-center">
          <div className="relative pb-2.5 pt-2 px-4 text-[13px] font-semibold text-[#2563eb] cursor-pointer">
            Financial Report
            <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#2563eb]" />
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 2. FILTER BAR (Matching Screenshot 3) */}
      {/* ------------------------------------------------------------- */}
      <div className="px-4 py-3 bg-white border-b border-slate-200/90 shadow-2xs space-y-2.5">
        {/* Top Dropdowns Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-6 gap-2.5 text-xs">
          {/* Report Type */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 mb-1">
              Report Type
            </label>
            <div className="relative">
              <select
                value={reportType}
                onChange={(e) => setReportType(e.target.value)}
                className="w-full h-8 px-2.5 pr-7 border border-slate-300 rounded text-xs bg-white text-slate-800 appearance-none focus:outline-none focus:ring-1 focus:ring-[#2563eb]"
              >
                <option value="Ledger">Ledger</option>
                <option value="Trial Balance">Trial Balance</option>
                <option value="Profit & Loss">Profit & Loss</option>
                <option value="Balance Sheet">Balance Sheet</option>
                <option value="Cash Book">Cash Book</option>
                <option value="Bank Book">Bank Book</option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {/* Office */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 mb-1">Office</label>
            <div className="relative">
              <select
                value={selectedOffice}
                onChange={(e) => setSelectedOffice(e.target.value)}
                className="w-full h-8 px-2.5 pr-7 border border-slate-300 rounded text-xs bg-white text-slate-800 appearance-none focus:outline-none focus:ring-1 focus:ring-[#2563eb]"
              >
                <option value="ALL">ALL</option>
                <option value="MBBL-HO">MBBL-HO</option>
                <option value="MG Sirajganj Factory">MG Sirajganj Factory</option>
                <option value="Corporate Head Office">Corporate Head Office</option>
                <option value="Chattogram Port Depot">Chattogram Port Depot</option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {/* Ledger Type with Red Asterisk */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 mb-1">
              <span className="text-rose-500 font-bold">* </span>Ledger Type
            </label>
            <div className="relative">
              <select
                value={ledgerType}
                onChange={(e) => setLedgerType(e.target.value)}
                className="w-full h-8 px-2.5 pr-7 border border-slate-300 rounded text-xs bg-white text-slate-800 appearance-none focus:outline-none focus:ring-1 focus:ring-[#2563eb]"
              >
                <option value="General Ledger">General Ledger</option>
                <option value="Sub Ledger">Sub Ledger</option>
                <option value="Customer Ledger">Customer Ledger</option>
                <option value="Supplier Ledger">Supplier Ledger</option>
                <option value="Cost Center Ledger">Cost Center Ledger</option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {/* Chart Of Account */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 mb-1">
              Chart Of Account
            </label>
            <div className="relative">
              <select
                value={selectedAccountId}
                onChange={(e) => setSelectedAccountId(e.target.value)}
                className="w-full h-8 px-2.5 pr-7 border border-slate-300 rounded text-xs bg-white text-slate-800 appearance-none focus:outline-none focus:ring-1 focus:ring-[#2563eb]"
              >
                <option value="">Select Chart Of Account</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.code} - {a.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {/* From Date */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 mb-1">From Date</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-full h-8 px-2.5 border border-slate-300 rounded text-xs bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#2563eb]"
            />
          </div>

          {/* To Date */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 mb-1">To Date</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="w-full h-8 px-2.5 border border-slate-300 rounded text-xs bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#2563eb]"
            />
          </div>
        </div>

        {/* Checkboxes & View Button Row */}
        <div className="flex items-center gap-6 pt-1 text-xs">
          <label className="flex items-center gap-2 cursor-pointer select-none text-slate-700">
            <input
              type="checkbox"
              checked={officeWise}
              onChange={(e) => setOfficeWise(e.target.checked)}
              className="w-3.5 h-3.5 rounded border-slate-300 text-[#2563eb] focus:ring-[#2563eb]"
            />
            <span>Office Wise</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer select-none text-slate-700">
            <input
              type="checkbox"
              checked={withoutDecimal}
              onChange={(e) => setWithoutDecimal(e.target.checked)}
              className="w-3.5 h-3.5 rounded border-slate-300 text-[#2563eb] focus:ring-[#2563eb]"
            />
            <span>Without Decimal</span>
          </label>

          <button
            type="button"
            onClick={handleView}
            className="h-7 px-5 bg-[#2563eb] hover:bg-blue-700 text-white font-medium text-xs rounded transition shadow-2xs"
          >
            View
          </button>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 3. REPORT OUTPUT VIEW */}
      {/* ------------------------------------------------------------- */}
      <div className="px-4 mt-3">
        {hasViewed && (
          <div className="bg-white border border-slate-200 rounded shadow-2xs p-4 space-y-4">
            {/* Report Header */}
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
                    {activeReport.reportType} Statement — {activeReport.ledgerType}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Period: <span className="font-medium text-slate-700">{activeReport.fromDate} to {activeReport.toDate}</span> • Office:{" "}
                    <span className="font-medium text-slate-700">{activeReport.office}</span>
                    {currentAccount && (
                      <span> • Account: <span className="font-semibold text-blue-600">{currentAccount.code} - {currentAccount.name}</span></span>
                    )}
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleExportCSV}
                  className="h-8 px-3 border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs rounded flex items-center gap-1.5 transition"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Excel</span>
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="h-8 px-3 bg-slate-800 hover:bg-slate-900 text-white text-xs rounded flex items-center gap-1.5 transition"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print</span>
                </button>
              </div>
            </div>

            {/* A. LEDGER TABLE */}
            {activeReport.reportType === "Ledger" && (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border border-slate-200">
                  <thead className="bg-[#f8fafc] border-b border-slate-200 text-[11px] font-semibold text-slate-700">
                    <tr>
                      <th className="px-2.5 py-2 text-center w-12 border-r border-slate-200">SL</th>
                      <th className="px-3 py-2 border-r border-slate-200 w-24">Date</th>
                      <th className="px-3 py-2 border-r border-slate-200 w-32">Voucher No</th>
                      <th className="px-3 py-2 border-r border-slate-200">Particulars / Narration</th>
                      {activeReport.officeWise && (
                        <th className="px-3 py-2 border-r border-slate-200 w-32">Office</th>
                      )}
                      <th className="px-3 py-2 text-right border-r border-slate-200 w-28">Debit (৳)</th>
                      <th className="px-3 py-2 text-right border-r border-slate-200 w-28">Credit (৳)</th>
                      <th className="px-3 py-2 text-right w-32">Balance (৳)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {ledgerEntries.length === 0 ? (
                      <tr>
                        <td colSpan={activeReport.officeWise ? 8 : 7} className="py-16 text-center text-slate-400">
                          <Inbox className="w-6 h-6 mx-auto mb-1 stroke-[1.5] text-slate-300" />
                          <span>No transaction records found for the selected period.</span>
                        </td>
                      </tr>
                    ) : (
                      ledgerEntries.map((entry, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/70">
                          <td className="px-2.5 py-2 text-center text-slate-500 border-r border-slate-200/70">
                            {idx + 1}
                          </td>
                          <td className="px-3 py-2 text-slate-700 border-r border-slate-200/70 whitespace-nowrap">
                            {entry.date}
                          </td>
                          <td className="px-3 py-2 font-mono font-medium text-blue-600 border-r border-slate-200/70 whitespace-nowrap">
                            {entry.voucherNumber}
                          </td>
                          <td className="px-3 py-2 border-r border-slate-200/70">
                            <div className="font-medium text-slate-800">{entry.narration || "General Journal Entry"}</div>
                            <div className="text-[10px] text-slate-400 font-mono">{entry.accountName}</div>
                          </td>
                          {activeReport.officeWise && (
                            <td className="px-3 py-2 text-slate-600 border-r border-slate-200/70 text-[11px]">
                              {entry.officeName}
                            </td>
                          )}
                          <td className="px-3 py-2 text-right font-medium text-slate-900 border-r border-slate-200/70 whitespace-nowrap">
                            {entry.debit > 0 ? formatAmount(entry.debit) : "—"}
                          </td>
                          <td className="px-3 py-2 text-right font-medium text-slate-900 border-r border-slate-200/70 whitespace-nowrap">
                            {entry.credit > 0 ? formatAmount(entry.credit) : "—"}
                          </td>
                          <td className="px-3 py-2 text-right font-bold text-slate-900 whitespace-nowrap">
                            {formatAmount(entry.runningBalance)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  {ledgerEntries.length > 0 && (
                    <tfoot>
                      <tr className="bg-slate-50 font-bold border-t-2 border-slate-300 text-slate-900">
                        <td
                          colSpan={activeReport.officeWise ? 5 : 4}
                          className="px-3 py-2.5 text-right uppercase text-[11px] tracking-wider"
                        >
                          Period Totals:
                        </td>
                        <td className="px-3 py-2.5 text-right border-r border-slate-200">
                          ৳{formatAmount(totalDebit)}
                        </td>
                        <td className="px-3 py-2.5 text-right border-r border-slate-200">
                          ৳{formatAmount(totalCredit)}
                        </td>
                        <td className="px-3 py-2.5 text-right text-blue-700">
                          ৳{formatAmount(totalDebit - totalCredit)}
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            )}

            {/* B. TRIAL BALANCE TABLE */}
            {activeReport.reportType === "Trial Balance" && (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border border-slate-200">
                  <thead className="bg-[#f8fafc] border-b border-slate-200 text-[11px] font-semibold text-slate-700">
                    <tr>
                      <th className="px-3 py-2 w-28 border-r border-slate-200">Account Code</th>
                      <th className="px-3 py-2 border-r border-slate-200">Account Head</th>
                      <th className="px-3 py-2 border-r border-slate-200 w-32">Classification</th>
                      <th className="px-3 py-2 text-right border-r border-slate-200 w-36">Debit (৳)</th>
                      <th className="px-3 py-2 text-right w-36">Credit (৳)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {tbData.rows.map((row) => (
                      <tr key={row.code} className="hover:bg-slate-50/70">
                        <td className="px-3 py-2 font-mono text-blue-600 font-semibold border-r border-slate-200/70">
                          {row.code}
                        </td>
                        <td className="px-3 py-2 font-medium text-slate-800 border-r border-slate-200/70">
                          {row.name}
                        </td>
                        <td className="px-3 py-2 text-slate-500 border-r border-slate-200/70 text-[11px]">
                          {row.type}
                        </td>
                        <td className="px-3 py-2 text-right font-medium text-slate-900 border-r border-slate-200/70">
                          {row.debit > 0 ? formatAmount(row.debit) : "—"}
                        </td>
                        <td className="px-3 py-2 text-right font-medium text-slate-900">
                          {row.credit > 0 ? formatAmount(row.credit) : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-50 font-bold border-t-2 border-slate-300 text-slate-900">
                      <td colSpan={3} className="px-3 py-2.5 text-right uppercase text-[11px]">
                        Total:
                      </td>
                      <td className="px-3 py-2.5 text-right border-r border-slate-200">
                        ৳{formatAmount(tbData.totalDebit)}
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        ৳{formatAmount(tbData.totalCredit)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}

            {/* C. PROFIT & LOSS / BALANCE SHEET */}
            {(activeReport.reportType === "Profit & Loss" || activeReport.reportType === "Balance Sheet") && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="border border-slate-200 rounded p-3 bg-slate-50/50">
                  <h4 className="font-bold text-xs text-slate-800 border-b border-slate-200 pb-2 mb-2">
                    {activeReport.reportType === "Profit & Loss" ? "Operating Revenues" : "Assets"}
                  </h4>
                  <div className="space-y-1.5 text-xs">
                    {(activeReport.reportType === "Profit & Loss" ? plData.revenues : bsData.assets).map(
                      (item, i) => (
                        <div key={i} className="flex justify-between py-1 border-b border-slate-100">
                          <span className="text-slate-700">{item.name}</span>
                          <span className="font-semibold text-slate-900">৳{formatAmount(item.amount)}</span>
                        </div>
                      ),
                    )}
                  </div>
                </div>

                <div className="border border-slate-200 rounded p-3 bg-slate-50/50">
                  <h4 className="font-bold text-xs text-slate-800 border-b border-slate-200 pb-2 mb-2">
                    {activeReport.reportType === "Profit & Loss" ? "Operating Expenses" : "Liabilities & Equity"}
                  </h4>
                  <div className="space-y-1.5 text-xs">
                    {(activeReport.reportType === "Profit & Loss" ? plData.expenses : [...bsData.liabilities, ...bsData.equity]).map(
                      (item, i) => (
                        <div key={i} className="flex justify-between py-1 border-b border-slate-100">
                          <span className="text-slate-700">{item.name}</span>
                          <span className="font-semibold text-slate-900">৳{formatAmount(item.amount)}</span>
                        </div>
                      ),
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
