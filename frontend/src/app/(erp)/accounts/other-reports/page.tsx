"use client";

import React, { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { ChevronDown, Download, Inbox, Printer } from "lucide-react";
import { useAccountingStore } from "@/features/accounts/store/accounting-store";
import { downloadCsv, localToday } from "@/features/purchase/lib/client";

/** The report choices iBOS lists, in its order. */
const REPORTS = [
  "AIT and Tax Register Report",
  "Daily Summary Report",
  "Expense Report",
  "Collection Report",
  "Budget VS Actual Report",
  "Receive Payment Report",
  "Supplier Payment Report",
  "Transaction Update Report",
  "Cash And Cash Equivalent Report",
  "Cost Center Wise Report",
  "Clear Invoice Report",
  "Advance Report",
  "Tender And Performance Security Report",
  "Tender Report",
  "SMS Report",
  "Bank Advice Sheet",
  "Account Wise Daily Transaction Report",
  "Wallet Wise Ledger Report",
  "Bank Liabilities Position",
] as const;

/** Reports read from other modules through /api/accounts/other-reports. */
const SERVER_REPORTS: Partial<Record<string, "COLLECTION" | "SUPPLIER_PAYMENT">> = {
  "Collection Report": "COLLECTION",
  "Supplier Payment Report": "SUPPLIER_PAYMENT",
};
interface ServerRow {
  date: string;
  number: string;
  party: string;
  office: string;
  method: string;
  reference: string;
  settles?: string;
  amount: number;
}
/** Reports whose records BridgeOne does not keep yet, and why. */
const NOT_RECORDED: Partial<Record<string, string>> = {
  "AIT and Tax Register Report": "AIT/TDS deductions are not recorded in BridgeOne yet, so there is nothing to report. Supplier payments and expenses would need a tax deduction (head, rate, challan) to fill this register.",
  "Transaction Update Report": "BridgeOne does not keep an edit history of vouchers yet, so there are no updates to list.",
  "Clear Invoice Report": "Invoice clearing is not recorded in BridgeOne yet.",
  "Tender And Performance Security Report": "Tenders and performance securities are not recorded in BridgeOne yet.",
  "Tender Report": "Tenders are not recorded in BridgeOne yet.",
  "SMS Report": "BridgeOne does not send SMS from Accounts yet.",
  "Bank Advice Sheet": "Bank advice sheets for salary disbursement are not produced in BridgeOne yet.",
  "Wallet Wise Ledger Report": "Wallet ledgers are not posted to Accounts in BridgeOne yet.",
};
type ReportName = (typeof REPORTS)[number];

type Cell = string | number;
interface Column {
  header: string;
  align?: "left" | "right" | "center";
  /** Summed in the footer. */
  total?: boolean;
}
interface ReportData {
  columns: Column[];
  rows: Cell[][];
  /** Shown instead of the table when the report has no source data in BridgeOne. */
  note?: string;
}

const monthStart = () => `${localToday().slice(0, 8)}01`;
const dayOf = (value: string | undefined) => (value ?? "").slice(0, 10);
const money = (value: number) => value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function OtherReportsPage() {
  const vouchers = useAccountingStore((s) => s.vouchers);
  const accounts = useAccountingStore((s) => s.accounts);
  const expenses = useAccountingStore((s) => s.expenses);
  const advances = useAccountingStore((s) => s.advances);
  const costCenters = useAccountingStore((s) => s.costCenters);

  const loans = useAccountingStore((s) => s.loans);
  const budgets = useAccountingStore((s) => s.budgets);
  const [viewBy, setViewBy] = useState<ReportName>("Daily Summary Report");
  const [fromDate, setFromDate] = useState(monthStart);
  const [toDate, setToDate] = useState(localToday);
  const [monthWise, setMonthWise] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [active, setActive] = useState({ viewBy: "Daily Summary Report" as ReportName, fromDate: monthStart(), toDate: localToday(), monthWise: false, showDetails: false });

  const handleApplyView = () => setActive({ viewBy, fromDate, toDate, monthWise, showDetails });

  // Collection and supplier payment reports come from the server; the result is kept with the request it answers.
  const serverType = SERVER_REPORTS[active.viewBy];
  const serverKey = serverType ? `${serverType}|${active.fromDate}|${active.toDate}` : "";
  const [serverResult, setServerResult] = useState<{ key: string; rows: ServerRow[] | null; error: string }>({ key: "", rows: null, error: "" });
  useEffect(() => {
    if (!serverKey) return;
    let cancelled = false;
    const [type, fromDate, toDate] = serverKey.split("|");
    const q = new URLSearchParams({ type, fromDate, toDate });
    fetch(`/api/accounts/other-reports?${q.toString()}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((json) => {
        if (cancelled) return;
        if (json?.success) setServerResult({ key: serverKey, rows: json.data as ServerRow[], error: "" });
        else setServerResult({ key: serverKey, rows: null, error: typeof json?.error === "string" ? json.error : json?.error?.message ?? "Could not load the report." });
      })
      .catch(() => !cancelled && setServerResult({ key: serverKey, rows: null, error: "Could not load the report." }));
    return () => {
      cancelled = true;
    };
  }, [serverKey]);
  const serverCurrent = serverKey !== "" && serverResult.key === serverKey;
  const serverRows = serverCurrent ? serverResult.rows : null;
  const serverError = serverCurrent ? serverResult.error : "";

  const report = useMemo<ReportData>(() => {
    const inPeriod = (date: string | undefined) => {
      const day = dayOf(date);
      return (!active.fromDate || day >= active.fromDate) && (!active.toDate || day <= active.toDate);
    };
    // Only posted vouchers are in the ledger.
    const posted = vouchers.filter((v) => v.status === "POSTED" || v.status === "APPROVED");

    const notRecorded = NOT_RECORDED[active.viewBy];
    if (notRecorded) return { columns: [], rows: [], note: notRecorded };
    if (SERVER_REPORTS[active.viewBy]) {
      if (serverError) return { columns: [], rows: [], note: serverError };
      if (serverRows === null) return { columns: [], rows: [], note: "Loading…" };
      const supplier = active.viewBy === "Supplier Payment Report";
      return {
        columns: [
          { header: "Date" },
          { header: supplier ? "Payment No" : "Collection No" },
          { header: supplier ? "Supplier" : "Customer" },
          { header: "Office" },
          { header: "Method" },
          { header: "Reference" },
          ...(supplier ? [{ header: "Settles" } as Column] : []),
          { header: "Amount (৳)", align: "right", total: true },
        ],
        rows: (serverRows ?? []).map((r) => [r.date, r.number, r.party, r.office, r.method, r.reference || "—", ...(supplier ? [r.settles ?? "—"] : []), r.amount]),
      };
    }
    const cashBankIds = new Set(accounts.filter((a) => a.accountType === "ASSET" && !a.isGroup && /cash|bank/i.test(`${a.name} ${a.accountSubtype}`)).map((a) => a.id));

    switch (active.viewBy) {
      case "Budget VS Actual Report": {
        // Actual: what was booked on each budget line's account in the period.
        const actualByCode = new Map<string, number>();
        for (const v of posted) {
          if (!inPeriod(v.transactionDate)) continue;
          for (const l of v.lines) actualByCode.set(l.accountCode, (actualByCode.get(l.accountCode) ?? 0) + (l.debit || 0) - (l.credit || 0));
        }
        const rows: Cell[][] = [];
        for (const b of budgets) {
          for (const it of b.items ?? []) {
            const actual = actualByCode.get(it.accountCode) ?? 0;
            const budget = it.allocatedAmount || 0;
            rows.push([b.budgetCode, b.budgetName, `${it.accountCode} - ${it.accountName}`, budget, actual, budget - actual, budget ? `${((actual / budget) * 100).toFixed(1)}%` : "—"]);
          }
        }
        return {
          columns: [
            { header: "Budget Code" },
            { header: "Budget" },
            { header: "Account" },
            { header: "Budget (৳)", align: "right", total: true },
            { header: "Actual (৳)", align: "right", total: true },
            { header: "Variance (৳)", align: "right", total: true },
            { header: "Utilization", align: "right" },
          ],
          rows,
        };
      }
      case "Receive Payment Report": {
        const rows: Cell[][] = [];
        for (const v of [...posted].sort((a, b) => dayOf(a.transactionDate).localeCompare(dayOf(b.transactionDate)))) {
          if (!inPeriod(v.transactionDate)) continue;
          for (const l of v.lines) {
            if (!cashBankIds.has(l.accountId)) continue;
            rows.push([dayOf(v.transactionDate), v.voucherNumber, `${l.accountCode} - ${l.accountName}`, v.narration, l.debit || 0, l.credit || 0]);
          }
        }
        return {
          columns: [
            { header: "Date" },
            { header: "Voucher No" },
            { header: "Cash / Bank" },
            { header: "Narration" },
            { header: "Received (৳)", align: "right", total: true },
            { header: "Paid (৳)", align: "right", total: true },
          ],
          rows,
        };
      }
      case "Account Wise Daily Transaction Report": {
        const byKey = new Map<string, { day: string; account: string; debit: number; credit: number; count: number }>();
        for (const v of posted) {
          if (!inPeriod(v.transactionDate)) continue;
          const day = dayOf(v.transactionDate);
          for (const l of v.lines) {
            const key = `${day}|${l.accountCode}`;
            const row = byKey.get(key) ?? { day, account: `${l.accountCode} - ${l.accountName}`, debit: 0, credit: 0, count: 0 };
            row.debit += l.debit || 0;
            row.credit += l.credit || 0;
            row.count += 1;
            byKey.set(key, row);
          }
        }
        return {
          columns: [{ header: "Date" }, { header: "Account" }, { header: "Entries", align: "right" }, { header: "Debit (৳)", align: "right", total: true }, { header: "Credit (৳)", align: "right", total: true }],
          rows: [...byKey.values()].sort((a, b) => a.day.localeCompare(b.day) || a.account.localeCompare(b.account)).map((r) => [r.day, r.account, String(r.count), r.debit, r.credit]),
        };
      }
      case "Bank Liabilities Position":
        return {
          columns: [
            { header: "Lender" },
            { header: "Facility" },
            { header: "Office" },
            { header: "Disbursed" },
            { header: "Maturity" },
            { header: "Rate", align: "right" },
            { header: "Principal (৳)", align: "right", total: true },
            { header: "Outstanding (৳)", align: "right", total: true },
            { header: "Status", align: "center" },
          ],
          rows: loans
            .filter((l) => l.status !== "PAID_OFF")
            .map((l) => [l.lenderName, l.loanType, l.officeName || "—", dayOf(l.disbursementDate) || "—", dayOf(l.maturityDate) || "—", `${l.interestRate || 0}%`, l.principalAmount || 0, l.outstandingPrincipal || 0, l.status]),
        };
      case "Daily Summary Report": {
        const byDay = new Map<string, { count: number; debit: number }>();
        for (const v of posted) {
          if (!inPeriod(v.transactionDate)) continue;
          const day = dayOf(v.transactionDate);
          const row = byDay.get(day) ?? { count: 0, debit: 0 };
          row.count += 1;
          row.debit += v.totalDebit || 0;
          byDay.set(day, row);
        }
        return {
          columns: [{ header: "Date" }, { header: "Vouchers", align: "right", total: true }, { header: "Total Amount (৳)", align: "right", total: true }],
          rows: [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([day, r]) => [day, r.count, r.debit]),
        };
      }
      case "Expense Report":
        return {
          columns: [
            { header: "Date" },
            { header: "Code" },
            { header: "Office" },
            { header: "Expense Type" },
            { header: "Payee" },
            { header: "Chart of Account" },
            { header: "Amount (৳)", align: "right", total: true },
            { header: "Status", align: "center" },
          ],
          rows: expenses
            .filter((e) => inPeriod(e.date))
            .sort((a, b) => dayOf(a.date).localeCompare(dayOf(b.date)))
            .map((e) => [dayOf(e.date), e.code || e.expenseNumber, e.officeName, e.expenseType, e.partnerPayee || e.payeeName, e.chartOfAccount || e.accountName, e.amount || 0, e.status]),
        };
      case "Advance Report":
        return {
          columns: [
            { header: "Date" },
            { header: "Code" },
            { header: "Employee / Partner" },
            { header: "Office" },
            { header: "Purpose" },
            { header: "Amount (৳)", align: "right", total: true },
            { header: "Adjusted (৳)", align: "right", total: true },
            { header: "Remaining (৳)", align: "right", total: true },
            { header: "Status", align: "center" },
          ],
          rows: advances
            .filter((a) => inPeriod(a.date))
            .sort((a, b) => dayOf(a.date).localeCompare(dayOf(b.date)))
            .map((a) => [dayOf(a.date), a.code || a.advanceNumber, a.employeeName, a.officeName, a.purpose, a.approvedAmount || 0, a.settledAmount || 0, a.remainingBalance || 0, a.status]),
        };
      case "Cash And Cash Equivalent Report": {
        const cashBank = accounts.filter((a) => a.accountType === "ASSET" && !a.isGroup && /cash|bank/i.test(`${a.name} ${a.accountSubtype}`));
        const rows: Cell[][] = [];
        for (const acc of cashBank) {
          let before = 0;
          let receipts = 0;
          let payments = 0;
          for (const v of posted) {
            const day = dayOf(v.transactionDate);
            for (const l of v.lines) {
              if (l.accountId !== acc.id) continue;
              const net = (l.debit || 0) - (l.credit || 0);
              if (active.fromDate && day < active.fromDate) before += net;
              else if (inPeriod(v.transactionDate)) {
                receipts += l.debit || 0;
                payments += l.credit || 0;
              }
            }
          }
          const opening = (acc.openingBalance || 0) + before;
          if (!opening && !receipts && !payments) continue;
          rows.push([acc.code, acc.name, opening, receipts, payments, opening + receipts - payments]);
        }
        return {
          columns: [
            { header: "Code" },
            { header: "Account" },
            { header: "Opening (৳)", align: "right", total: true },
            { header: "Receipts (৳)", align: "right", total: true },
            { header: "Payments (৳)", align: "right", total: true },
            { header: "Closing (৳)", align: "right", total: true },
          ],
          rows,
        };
      }
      case "Cost Center Wise Report": {
        const names = new Map(costCenters.map((c) => [c.id, `${c.code} - ${c.name}`]));
        const byCenter = new Map<string, { debit: number; credit: number }>();
        for (const v of posted) {
          if (!inPeriod(v.transactionDate)) continue;
          for (const l of v.lines) {
            const key = (l.costCenterId && names.get(l.costCenterId)) || "(No cost center)";
            const row = byCenter.get(key) ?? { debit: 0, credit: 0 };
            row.debit += l.debit || 0;
            row.credit += l.credit || 0;
            byCenter.set(key, row);
          }
        }
        return {
          columns: [{ header: "Cost Center" }, { header: "Debit (৳)", align: "right", total: true }, { header: "Credit (৳)", align: "right", total: true }, { header: "Net (৳)", align: "right", total: true }],
          rows: [...byCenter.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([name, r]) => [name, r.debit, r.credit, r.debit - r.credit]),
        };
      }
    }
    // Every choice is handled above; this keeps the compiler sure of a value.
    return { columns: [], rows: [] };
  }, [active, vouchers, accounts, expenses, advances, costCenters, budgets, loans, serverRows, serverError]);

  const totals = report.columns.map((c, i) => (c.total ? report.rows.reduce((sum, r) => sum + (typeof r[i] === "number" ? (r[i] as number) : 0), 0) : null));
  const firstTotal = totals.findIndex((t) => t !== null);
  const isCount = (header: string) => header === "Vouchers" || header === "Entries";
  const show = (value: Cell, column: Column) => (typeof value === "number" ? (isCount(column.header) ? String(value) : money(value)) : value);

  const handleExportCSV = () =>
    downloadCsv(
      `${active.viewBy.replace(/\W+/g, "_")}_${active.fromDate}_${active.toDate}.csv`,
      ["SL", ...report.columns.map((c) => c.header)],
      report.rows.map((r, i) => [i + 1, ...r]),
    );

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-800 font-sans pb-16">
      {/* 1. Title and export buttons */}
      <div className="bg-white border-b border-slate-200">
        <div className="px-4 py-2.5 flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-800 tracking-tight">Other Reports</h2>
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
              disabled={report.rows.length === 0}
              className="h-7 px-3 border border-slate-300 hover:bg-slate-50 disabled:opacity-40 text-slate-700 text-xs font-semibold rounded flex items-center gap-1.5 transition shadow-2xs"
            >
              <Download className="w-3.5 h-3.5 text-slate-600" />
              <span>EXCEL</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Filters */}
      <div className="px-4 py-3 bg-white border-b border-slate-200/90 shadow-2xs space-y-3">
        <div>
          <label htmlFor="report-view-by" className="block text-[11px] font-semibold text-slate-700 mb-1">
            View By <span className="text-rose-500 font-bold">*</span>
          </label>
          <div className="relative w-80 max-w-full">
            <select
              id="report-view-by"
              value={viewBy}
              onChange={(e) => setViewBy(e.target.value as ReportName)}
              className="w-full h-8 px-2.5 pr-8 border border-slate-300 rounded text-xs bg-white text-slate-800 appearance-none focus:outline-none focus:ring-1 focus:ring-[#2563eb]"
            >
              {REPORTS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-5 text-xs">
          <div className="w-40">
            <label htmlFor="report-from" className="block text-[11px] font-semibold text-slate-700 mb-1">From Date</label>
            <input
              id="report-from"
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-full h-8 px-2.5 border border-slate-300 rounded text-xs bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#2563eb]"
            />
          </div>
          <div className="w-40">
            <label htmlFor="report-to" className="block text-[11px] font-semibold text-slate-700 mb-1">To Date</label>
            <input
              id="report-to"
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="w-full h-8 px-2.5 border border-slate-300 rounded text-xs bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#2563eb]"
            />
          </div>

          {viewBy === "AIT and Tax Register Report" && (
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
          )}

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

      {/* 3. Report */}
      <div className="px-4 mt-3">
        <div className="bg-white border border-slate-200 rounded shadow-2xs p-4 space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-slate-200 pb-3 gap-3">
            <div className="flex items-center gap-3">
              <div className="relative w-28 h-8">
                <Image src="/logo.png" alt="Bridge One ERP" fill className="object-contain" priority />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-tight">{active.viewBy}</h3>
                <p className="text-[11px] text-slate-500">
                  Period:{" "}
                  <span className="font-semibold text-slate-700">
                    {active.fromDate} to {active.toDate}
                  </span>
                </p>
              </div>
            </div>
            {!report.note && (
              <span className="px-2.5 py-1 rounded bg-slate-100 text-slate-700 font-medium text-xs">
                Records: <strong className="text-slate-900">{report.rows.length}</strong>
              </span>
            )}
          </div>

          {report.note ? (
            <div className="py-12 flex flex-col items-center gap-2 text-center">
              <Inbox className="w-6 h-6 text-slate-300" aria-hidden />
              <p className="max-w-lg text-xs text-slate-500">{report.note}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border border-slate-200">
                <thead className="bg-[#f8fafc] border-b border-slate-200 text-[11px] font-semibold text-slate-700">
                  <tr>
                    <th className="px-2.5 py-2 text-center w-12 border-r border-slate-200">SL</th>
                    {report.columns.map((c) => (
                      <th key={c.header} className={`px-3 py-2 border-r border-slate-200 last:border-r-0 whitespace-nowrap ${c.align === "right" ? "text-right" : c.align === "center" ? "text-center" : ""}`}>
                        {c.header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {report.rows.length === 0 ? (
                    <tr>
                      <td colSpan={report.columns.length + 1} className="py-12 text-center text-slate-400">
                        No records for the selected period.
                      </td>
                    </tr>
                  ) : (
                    report.rows.map((row, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/70">
                        <td className="px-2.5 py-2 text-center text-slate-500 border-r border-slate-200/70">{idx + 1}</td>
                        {row.map((cell, i) => {
                          const column = report.columns[i];
                          return (
                            <td
                              key={i}
                              className={`px-3 py-2 border-r border-slate-200/70 last:border-r-0 ${typeof cell === "number" ? "whitespace-nowrap font-medium text-slate-900" : "text-slate-700"} ${column.align === "right" ? "text-right" : column.align === "center" ? "text-center" : ""}`}
                            >
                              {show(cell, column)}
                            </td>
                          );
                        })}
                      </tr>
                    ))
                  )}
                </tbody>
                {report.rows.length > 0 && firstTotal >= 0 && (
                  <tfoot>
                    <tr className="bg-slate-50 font-bold border-t-2 border-slate-300 text-slate-900">
                      <td colSpan={firstTotal + 1} className="px-3 py-2.5 text-right uppercase text-[11px] tracking-wider">
                        Total:
                      </td>
                      {report.columns.slice(firstTotal).map((c, j) => {
                        const t = totals[firstTotal + j];
                        return (
                          <td key={c.header} className={`px-3 py-2.5 border-r border-slate-200 last:border-r-0 whitespace-nowrap ${c.align === "right" ? "text-right" : ""}`}>
                            {t === null ? "" : isCount(c.header) ? t : money(t)}
                          </td>
                        );
                      })}
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
