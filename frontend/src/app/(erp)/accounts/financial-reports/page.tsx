"use client";

import { useMemo, useState } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  BookOpen,
  Calendar,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  FileText,
  Filter,
  Layers,
  Printer,
  Scale,
  Search,
} from "lucide-react";
import { PageContainer, PageHead } from "@/components/layout/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAccountingStore } from "@/features/accounts/store/accounting-store";

export default function FinancialReportsPage() {
  const [reportType, setReportType] = useState<
    "gl" | "tb" | "bs" | "pl" | "cf" | "cashbook" | "bankbook" | "ar" | "ap"
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
    const formatted = withoutDecimal ? Math.round(val).toLocaleString() : val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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
          (g) => `"${g.date}","${g.voucherNumber}","${g.transactionType}","${g.accountName}","${g.narration}",${g.debit},${g.credit},${g.runningBalance}`,
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
    <PageContainer>
      <PageHead
        title="Financial Reports"
        subtitle="Auditable accounting reports, Trial Balance reconciliation, Profit & Loss, and Balance Sheet"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" size="sm" onClick={handleExportCSV}>
              <Download className="mr-1.5 size-3.5" /> Export CSV
            </Button>
            <Button variant="secondary" size="sm" onClick={() => window.print()}>
              <Printer className="mr-1.5 size-3.5" /> Print Layout
            </Button>
          </div>
        }
      />

      {/* Filter Ribbon */}
      <Card className="mt-4 p-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6 text-xs">
          <div>
            <label className="mb-1 block font-medium text-ink">Report Statement *</label>
            <select
              value={reportType}
              onChange={(e) => setReportType(e.target.value as any)}
              className="w-full rounded-lg border border-line bg-surface p-2 text-xs font-semibold text-ink outline-none focus:border-primary"
            >
              <option value="tb">Trial Balance</option>
              <option value="gl">General Ledger</option>
              <option value="pl">Profit & Loss (P&L)</option>
              <option value="bs">Balance Sheet</option>
              <option value="cashbook">Cash Book</option>
              <option value="bankbook">Bank Book</option>
              <option value="ar">Receivables Statement</option>
              <option value="ap">Payables Statement</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block font-medium text-ink">Office Scope</label>
            <select
              value={selectedOffice}
              onChange={(e) => setSelectedOffice(e.target.value)}
              className="w-full rounded-lg border border-line bg-surface p-2 text-xs text-ink outline-none focus:border-primary"
            >
              <option value="all">All Offices & Branches</option>
              <option value="hq">Dhaka Corporate HQ</option>
              <option value="ctg">Chittagong Plant</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block font-medium text-ink">From Date</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-full rounded-lg border border-line bg-surface p-2 text-xs text-ink outline-none focus:border-primary"
            />
          </div>

          <div>
            <label className="mb-1 block font-medium text-ink">To Date</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="w-full rounded-lg border border-line bg-surface p-2 text-xs text-ink outline-none focus:border-primary"
            />
          </div>

          <div>
            <label className="mb-1 block font-medium text-ink">Specific GL Ledger</label>
            <select
              value={selectedAccount}
              onChange={(e) => setSelectedAccount(e.target.value)}
              className="w-full rounded-lg border border-line bg-surface p-2 text-xs text-ink outline-none focus:border-primary"
            >
              <option value="all">All Ledger Accounts</option>
              {accounts
                .filter((a) => !a.isGroup)
                .map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.code} - {a.name}
                  </option>
                ))}
            </select>
          </div>

          <div className="flex flex-col justify-end gap-1.5 pb-1">
            <label className="flex items-center gap-1.5 text-xs text-ink cursor-pointer">
              <input
                type="checkbox"
                checked={withoutDecimal}
                onChange={(e) => setWithoutDecimal(e.target.checked)}
                className="size-3.5 rounded border-line text-primary"
              />
              <span>Without Decimals</span>
            </label>
            <label className="flex items-center gap-1.5 text-xs text-ink cursor-pointer">
              <input
                type="checkbox"
                checked={includeZero}
                onChange={(e) => setIncludeZero(e.target.checked)}
                className="size-3.5 rounded border-line text-primary"
              />
              <span>Zero-Balance</span>
            </label>
          </div>
        </div>
      </Card>

      {/* Report View Body */}
      <Card className="mt-4 p-6">
        {/* Report Header for Print & Display */}
        <div className="border-b border-line pb-4 text-center">
          <h2 className="text-base font-bold text-ink uppercase tracking-wide">
            BridgeOne Industrial Solutions Ltd
          </h2>
          <p className="text-sm font-semibold text-primary">
            {reportType === "tb" && "Trial Balance Statement"}
            {reportType === "gl" && "General Ledger Statement"}
            {reportType === "pl" && "Profit & Loss (Income Statement)"}
            {reportType === "bs" && "Balance Sheet (Statement of Financial Position)"}
            {reportType === "cashbook" && "Cash Book Statement"}
            {reportType === "bankbook" && "Bank Book Statement"}
            {reportType === "ar" && "Accounts Receivable Ledger"}
            {reportType === "ap" && "Accounts Payable Ledger"}
          </p>
          <p className="mt-1 text-xs text-ink-muted">
            For Period: {fromDate} to {toDate} • Currency: BDT
          </p>
        </div>

        {/* 1. Trial Balance */}
        {reportType === "tb" && (
          <div className="mt-6">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-line bg-control/40 font-semibold text-ink">
                  <tr>
                    <th className="px-4 py-2.5">Account Code</th>
                    <th className="px-4 py-2.5">Account Title</th>
                    <th className="px-4 py-2.5">Classification</th>
                    <th className="px-4 py-2.5 text-right">Debit (৳)</th>
                    <th className="px-4 py-2.5 text-right">Credit (৳)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {tbData.rows
                    .filter((r) => includeZero || r.debit > 0 || r.credit > 0)
                    .map((r) => (
                      <tr key={r.code} className="hover:bg-control/30">
                        <td className="px-4 py-2.5 font-mono font-medium text-ink">{r.code}</td>
                        <td className="px-4 py-2.5 font-medium text-ink">{r.name}</td>
                        <td className="px-4 py-2.5">
                          <Badge variant="neutral">{r.type}</Badge>
                        </td>
                        <td className="px-4 py-2.5 text-right font-medium text-ink">
                          {r.debit > 0 ? formatAmount(r.debit) : "—"}
                        </td>
                        <td className="px-4 py-2.5 text-right font-medium text-ink">
                          {r.credit > 0 ? formatAmount(r.credit) : "—"}
                        </td>
                      </tr>
                    ))}
                </tbody>
                <tfoot className="border-t-2 border-ink bg-control/50 text-xs font-bold text-ink">
                  <tr>
                    <td colSpan={3} className="px-4 py-3 text-right">
                      Reconciled Total:
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-ink">{formatAmount(tbData.totalDebit)}</td>
                    <td className="px-4 py-3 text-right font-bold text-ink">{formatAmount(tbData.totalCredit)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <div className="mt-4 flex items-center justify-between border-t border-line pt-3 text-xs">
              <span className="text-ink-muted">Invariance Reconciliation Status:</span>
              {tbData.isBalanced ? (
                <span className="flex items-center gap-1.5 font-semibold text-emerald-600">
                  <CheckCircle2 className="size-4" /> Trial Balance is perfectly in balance (Total Dr = Total Cr)
                </span>
              ) : (
                <span className="font-semibold text-rose-600">
                  Unbalanced Trial Balance: Difference of ৳
                  {Math.abs(tbData.totalDebit - tbData.totalCredit).toFixed(2)}
                </span>
              )}
            </div>
          </div>
        )}

        {/* 2. General Ledger */}
        {(reportType === "gl" || reportType === "cashbook" || reportType === "bankbook" || reportType === "ar" || reportType === "ap") && (
          <div className="mt-6">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-line bg-control/40 font-semibold text-ink">
                  <tr>
                    <th className="px-4 py-2.5">Date</th>
                    <th className="px-4 py-2.5">Voucher #</th>
                    <th className="px-4 py-2.5">Type</th>
                    <th className="px-4 py-2.5">Account / Details</th>
                    <th className="px-4 py-2.5">Narration</th>
                    <th className="px-4 py-2.5 text-right">Debit (৳)</th>
                    <th className="px-4 py-2.5 text-right">Credit (৳)</th>
                    <th className="px-4 py-2.5 text-right">Running Balance (৳)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {glData.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-ink-faint">
                        No general ledger entries recorded for the selected account & date range.
                      </td>
                    </tr>
                  ) : (
                    glData.map((g, idx) => (
                      <tr key={idx} className="hover:bg-control/30">
                        <td className="px-4 py-2.5 text-ink-muted">{g.date}</td>
                        <td className="px-4 py-2.5 font-mono font-medium text-ink">{g.voucherNumber}</td>
                        <td className="px-4 py-2.5">
                          <Badge variant="neutral">{g.transactionType}</Badge>
                        </td>
                        <td className="px-4 py-2.5 font-medium text-ink">{g.accountName}</td>
                        <td className="max-w-xs truncate px-4 py-2.5 text-ink-muted">{g.narration}</td>
                        <td className="px-4 py-2.5 text-right font-medium text-ink">
                          {g.debit > 0 ? formatAmount(g.debit) : "—"}
                        </td>
                        <td className="px-4 py-2.5 text-right font-medium text-ink">
                          {g.credit > 0 ? formatAmount(g.credit) : "—"}
                        </td>
                        <td className="px-4 py-2.5 text-right font-bold text-primary">
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

        {/* 3. Profit & Loss */}
        {reportType === "pl" && (
          <div className="mt-6 space-y-6">
            <div>
              <h4 className="border-b border-line pb-1.5 text-xs font-bold text-emerald-600 uppercase">
                Operating Income / Revenue
              </h4>
              <div className="divide-y divide-line text-xs">
                {plData.revenues.map((r, idx) => (
                  <div key={idx} className="flex justify-between py-2">
                    <span className="font-medium text-ink">{r.name}</span>
                    <span className="font-medium text-ink">{formatAmount(r.amount)}</span>
                  </div>
                ))}
                <div className="flex justify-between py-2.5 font-bold text-emerald-600">
                  <span>Total Operating Revenue (A)</span>
                  <span>{formatAmount(plData.totalRevenue)}</span>
                </div>
              </div>
            </div>

            <div>
              <h4 className="border-b border-line pb-1.5 text-xs font-bold text-rose-600 uppercase">
                Operating & Administrative Expenses
              </h4>
              <div className="divide-y divide-line text-xs">
                {plData.expenses.map((e, idx) => (
                  <div key={idx} className="flex justify-between py-2">
                    <span className="font-medium text-ink">{e.name}</span>
                    <span className="font-medium text-ink">{formatAmount(e.amount)}</span>
                  </div>
                ))}
                <div className="flex justify-between py-2.5 font-bold text-rose-600">
                  <span>Total Operating Expenses (B)</span>
                  <span>{formatAmount(plData.totalExpense)}</span>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-line bg-control/50 p-4">
              <div className="flex items-center justify-between text-sm font-bold text-ink">
                <span>Net Operating Profit / (Loss) for the Period (A - B)</span>
                <span className={plData.netProfit >= 0 ? "text-emerald-600 text-base" : "text-rose-600 text-base"}>
                  {formatAmount(plData.netProfit)}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* 4. Balance Sheet */}
        {reportType === "bs" && (
          <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2">
            {/* Assets */}
            <div>
              <h4 className="border-b border-line pb-1.5 text-xs font-bold text-primary uppercase">
                Assets (Economic Resources)
              </h4>
              <div className="divide-y divide-line text-xs">
                {bsData.assets.map((a, idx) => (
                  <div key={idx} className="flex justify-between py-2">
                    <span className="font-medium text-ink">{a.name}</span>
                    <span className="font-medium text-ink">{formatAmount(a.amount)}</span>
                  </div>
                ))}
                <div className="flex justify-between py-3 font-bold text-primary border-t-2 border-line">
                  <span>Total Assets</span>
                  <span>{formatAmount(bsData.totalAssets)}</span>
                </div>
              </div>
            </div>

            {/* Liabilities & Equity */}
            <div>
              <h4 className="border-b border-line pb-1.5 text-xs font-bold text-amber-600 uppercase">
                Liabilities & Shareholder Equity
              </h4>
              <div className="divide-y divide-line text-xs">
                <div className="py-1 text-[11px] font-semibold text-ink-muted">Liabilities:</div>
                {bsData.liabilities.map((l, idx) => (
                  <div key={idx} className="flex justify-between py-1.5 pl-2">
                    <span className="text-ink">{l.name}</span>
                    <span className="text-ink">{formatAmount(l.amount)}</span>
                  </div>
                ))}
                <div className="flex justify-between py-1.5 font-semibold text-amber-600">
                  <span>Total Liabilities</span>
                  <span>{formatAmount(bsData.totalLiabilities)}</span>
                </div>

                <div className="pt-2 text-[11px] font-semibold text-ink-muted">Equity & Retained Earnings:</div>
                {bsData.equity.map((e, idx) => (
                  <div key={idx} className="flex justify-between py-1.5 pl-2">
                    <span className="text-ink">{e.name}</span>
                    <span className="text-ink">{formatAmount(e.amount)}</span>
                  </div>
                ))}
                <div className="flex justify-between py-1.5 font-semibold text-primary">
                  <span>Total Shareholder Equity</span>
                  <span>{formatAmount(bsData.totalEquity)}</span>
                </div>

                <div className="flex justify-between py-3 font-bold text-ink border-t-2 border-line">
                  <span>Total Liabilities & Equity</span>
                  <span>{formatAmount(bsData.totalLiabilities + bsData.totalEquity)}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </Card>
    </PageContainer>
  );
}
