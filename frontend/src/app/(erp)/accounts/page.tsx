"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowDownRight,
  ArrowUpRight,
  Banknote,
  BookOpen,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock,
  DollarSign,
  FileSpreadsheet,
  FileText,
  Filter,
  Layers,
  PieChart as PieChartIcon,
  Plus,
  RefreshCw,
  Scale,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { SummaryCard } from "@/components/purchase/SummaryCard";
import { FilterToolbar } from "@/components/purchase/FilterToolbar";
import { useAccountingStore } from "@/features/accounts/store/accounting-store";

const MONTHLY_CASH_FLOW = [
  { month: "May 2026", income: 1450000, expense: 980000, netFlow: 470000 },
  { month: "Jun 2026", income: 1680000, expense: 1120000, netFlow: 560000 },
  { month: "Jul 2026", income: 1520000, expense: 1040000, netFlow: 480000 },
  { month: "Aug 2026", income: 1890000, expense: 1250000, netFlow: 640000 },
  { month: "Sep 2026", income: 1740000, expense: 1180000, netFlow: 560000 },
  { month: "Oct 2026", income: 1980000, expense: 1320000, netFlow: 660000 },
];

export default function AccountDashboardPage() {
  const [fromDate, setFromDate] = useState("2026-07-01");
  const [toDate, setToDate] = useState("2027-06-30");
  const [selectedOffice, setSelectedOffice] = useState("ALL");

  const getDashboardKPIs = useAccountingStore((s) => s.getDashboardKPIs);
  const vouchers = useAccountingStore((s) => s.vouchers);
  const expenses = useAccountingStore((s) => s.expenses);
  const transfers = useAccountingStore((s) => s.transfers);
  const costCenters = useAccountingStore((s) => s.costCenters);

  const kpis = useMemo(() => getDashboardKPIs(), [getDashboardKPIs]);

  // Derived financial ratios
  const currentAssets = kpis.cashInHand + kpis.cashAtBank + kpis.accountsReceivable;
  const currentLiabilities = Math.max(1, kpis.accountsPayable);
  const currentRatio = (currentAssets / currentLiabilities).toFixed(2);
  const quickRatio = ((kpis.cashInHand + kpis.cashAtBank + kpis.accountsReceivable * 0.9) / currentLiabilities).toFixed(2);
  const profitMargin = kpis.totalIncome > 0 ? ((kpis.currentPeriodProfitLoss / kpis.totalIncome) * 100).toFixed(1) : "0.0";

  const recentVouchers = useMemo(() => vouchers.slice(0, 6), [vouchers]);

  const pendingApprovals = useMemo(() => {
    const pendingV = vouchers
      .filter((v) => v.status === "PENDING" || v.status === "DRAFT")
      .map((v) => ({
        id: v.id,
        title: `Voucher ${v.voucherNumber}`,
        subtitle: `${v.journalType} • ${v.officeName}`,
        amount: v.totalDebit,
        href: "/accounts/journal",
        type: "Voucher",
      }));
    const pendingE = expenses
      .filter((e) => e.status === "PENDING")
      .map((e) => ({
        id: e.id,
        title: `Expense ${e.expenseNumber}`,
        subtitle: `${e.expenseType} • ${e.payeeName}`,
        amount: e.amount,
        href: "/accounts/expenses",
        type: "Expense",
      }));
    const pendingT = transfers
      .filter((t) => t.status === "PENDING_APPROVAL" || t.status === "IN_TRANSIT")
      .map((t) => ({
        id: t.id,
        title: `Transfer ${t.transferNumber}`,
        subtitle: `${t.fromOfficeName} → ${t.toOfficeName}`,
        amount: t.requestedAmount,
        href: "/accounts/fund-transfers",
        type: "Transfer",
      }));
    return [...pendingV, ...pendingE, ...pendingT].slice(0, 6);
  }, [vouchers, expenses, transfers]);

  return (
    <div className="space-y-3 font-sans pb-12">
      {/* ------------------------------------------------------------- */}
      {/* 1. TOP HEADER (Exact Managerium / Purchase Layout) */}
      {/* ------------------------------------------------------------- */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 rounded border border-slate-200/90 shadow-2xs">
        <div>
          <nav className="flex items-center gap-1.5 text-[11px] text-slate-400 mb-0.5">
            <Link href="/accounts" className="hover:text-slate-600 transition">
              Account
            </Link>
            <ChevronRight className="w-3 h-3 text-slate-300" />
            <span className="text-slate-600 font-medium">Dashboard</span>
          </nav>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Account Dashboard</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Executive financial status, double-entry ledger KPIs, liquidity analysis, and pending workflows
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Link
            href="/accounts/journal"
            className="h-9 px-4 bg-[#2563eb] hover:bg-blue-700 text-white font-semibold text-xs rounded flex items-center gap-1.5 shadow-xs transition"
          >
            <Plus className="w-4 h-4" />
            <span>New Journal Voucher</span>
          </Link>
          <Link
            href="/accounts/financial-reports"
            className="h-9 px-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded flex items-center gap-1.5 transition"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Financial Statements</span>
          </Link>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 2. FILTER TOOLBAR (Managerium Filter Design) */}
      {/* ------------------------------------------------------------- */}
      <FilterToolbar
        onApply={() => {}}
        onReset={() => {
          setFromDate("2026-07-01");
          setToDate("2027-06-30");
          setSelectedOffice("ALL");
        }}
        showExport={false}
      >
        <div className="flex items-center gap-1.5 text-xs text-slate-600">
          <span className="font-medium text-[11px] text-slate-500">From:</span>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="border border-slate-200 rounded px-2 py-1 text-xs bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <div className="flex items-center gap-1.5 text-xs text-slate-600">
          <span className="font-medium text-[11px] text-slate-500">To:</span>
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="border border-slate-200 rounded px-2 py-1 text-xs bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <div className="flex items-center gap-1.5 text-xs text-slate-600">
          <span className="font-medium text-[11px] text-slate-500">Office / Unit:</span>
          <select
            value={selectedOffice}
            onChange={(e) => setSelectedOffice(e.target.value)}
            className="border border-slate-200 rounded px-2 py-1 text-xs bg-slate-50 focus:bg-white max-w-[200px] focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="ALL">All Branches & Plants</option>
            <option value="office-main">Corporate Head Office (Dhaka)</option>
            <option value="office-ctg">Chittagong Heavy Plant</option>
          </select>
        </div>
      </FilterToolbar>

      {/* ------------------------------------------------------------- */}
      {/* 3. PRIMARY FINANCIAL KPI CARDS ROW (Exact SummaryCard Design) */}
      {/* ------------------------------------------------------------- */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <SummaryCard
          title="Cash in Hand"
          value={`৳${kpis.cashInHand.toLocaleString()}`}
          subtitle="Vault & petty cash"
          icon={Wallet}
          variant="info"
        />
        <SummaryCard
          title="Cash at Bank"
          value={`৳${kpis.cashAtBank.toLocaleString()}`}
          subtitle="Reconciled balances"
          icon={Banknote}
          variant="info"
        />
        <SummaryCard
          title="Accounts Receivable"
          value={`৳${kpis.accountsReceivable.toLocaleString()}`}
          subtitle="Outstanding customer dues"
          icon={TrendingUp}
          variant="success"
        />
        <SummaryCard
          title="Accounts Payable"
          value={`৳${kpis.accountsPayable.toLocaleString()}`}
          subtitle="Outstanding supplier dues"
          icon={TrendingDown}
          variant="danger"
        />
        <SummaryCard
          title="Total Income"
          value={`৳${kpis.totalIncome.toLocaleString()}`}
          subtitle="Gross sales & revenue"
          icon={DollarSign}
          variant="success"
        />
        <SummaryCard
          title="Total Expenses"
          value={`৳${kpis.totalExpenses.toLocaleString()}`}
          subtitle="OpEx & admin charges"
          icon={Clock}
          variant="warning"
        />
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 4. SECONDARY LIQUIDITY & WORKFLOW KPIS */}
      {/* ------------------------------------------------------------- */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <SummaryCard
          title="Opening Cash & Bank"
          value={`৳${kpis.openingCashAndBank.toLocaleString()}`}
          subtitle="Start of fiscal period"
          icon={Scale}
          variant="default"
        />
        <SummaryCard
          title="Closing Cash & Bank"
          value={`৳${kpis.closingCashAndBank.toLocaleString()}`}
          subtitle="Net available liquidity"
          icon={ShieldCheck}
          variant="info"
        />
        <SummaryCard
          title="Net Profit / (Loss)"
          value={`৳${kpis.currentPeriodProfitLoss.toLocaleString()}`}
          subtitle={kpis.currentPeriodProfitLoss >= 0 ? "Operating surplus" : "Net deficit"}
          icon={CheckCircle2}
          variant={kpis.currentPeriodProfitLoss >= 0 ? "success" : "danger"}
        />
        <SummaryCard
          title="Pending Vouchers"
          value={kpis.pendingJournalVouchers}
          subtitle="Awaiting posting"
          icon={BookOpen}
          variant="warning"
        />
        <SummaryCard
          title="Pending Expenses"
          value={kpis.pendingExpenseApprovals}
          subtitle="Awaiting approval"
          icon={Clock}
          variant="warning"
        />
        <SummaryCard
          title="Budget Utilization"
          value={`${kpis.budgetUtilization.toFixed(1)}%`}
          subtitle="CapEx & OpEx pace"
          icon={PieChartIcon}
          variant="info"
        />
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 5. VISUAL CHARTS ROW (Income vs Expense & Monthly Cash Flow) */}
      {/* ------------------------------------------------------------- */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* Cash Flow Area Chart */}
        <div className="bg-white rounded border border-slate-200/90 p-4 shadow-2xs">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900 tracking-tight">Monthly Income vs. Expense Trend</h3>
              <p className="text-[11px] text-slate-500">Historical inflows and operational disbursements</p>
            </div>
            <span className="text-[11px] font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
              FY 2026-27
            </span>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={MONTHLY_CASH_FLOW} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="incomeGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="expenseGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={{ stroke: "#e2e8f0" }} />
                <YAxis
                  tick={{ fontSize: 11, fill: "#64748b" }}
                  axisLine={{ stroke: "#e2e8f0" }}
                  tickFormatter={(v) => `৳${(v / 100000).toFixed(0)}L`}
                />
                <Tooltip
                  formatter={(val: any) => [`৳${Number(val).toLocaleString()}`, ""]}
                  contentStyle={{ backgroundColor: "#ffffff", borderColor: "#cbd5e1", borderRadius: "6px", fontSize: "12px" }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: "12px", paddingTop: "8px" }} />
                <Area type="monotone" dataKey="income" name="Income (৳)" stroke="#10b981" fill="url(#incomeGrad)" strokeWidth={2} />
                <Area type="monotone" dataKey="expense" name="Expense (৳)" stroke="#ef4444" fill="url(#expenseGrad)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Net Cash Flow Bar Chart */}
        <div className="bg-white rounded border border-slate-200/90 p-4 shadow-2xs">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900 tracking-tight">Net Cash Flow Trajectory</h3>
              <p className="text-[11px] text-slate-500">Period net operating surplus / deficit</p>
            </div>
            <span className="text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
              Liquidity
            </span>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={MONTHLY_CASH_FLOW} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={{ stroke: "#e2e8f0" }} />
                <YAxis
                  tick={{ fontSize: 11, fill: "#64748b" }}
                  axisLine={{ stroke: "#e2e8f0" }}
                  tickFormatter={(v) => `৳${(v / 100000).toFixed(0)}L`}
                />
                <Tooltip
                  formatter={(val: any) => [`৳${Number(val).toLocaleString()}`, "Net Flow"]}
                  contentStyle={{ backgroundColor: "#ffffff", borderColor: "#cbd5e1", borderRadius: "6px", fontSize: "12px" }}
                />
                <Bar dataKey="netFlow" name="Net Cash Flow (৳)" fill="#2563eb" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 6. FINANCIAL RATIOS & RECENT TRANSACTIONS */}
      {/* ------------------------------------------------------------- */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {/* Financial Health Ratios Card */}
        <div className="bg-white rounded border border-slate-200/90 p-4 shadow-2xs space-y-3">
          <h3 className="text-sm font-bold text-slate-900 tracking-tight">Financial Health & Ratios</h3>
          <div className="space-y-2.5 text-xs">
            <div className="p-3 bg-slate-50 rounded border border-slate-200 flex items-center justify-between">
              <div>
                <span className="font-semibold text-slate-800 block">Current Ratio</span>
                <span className="text-[11px] text-slate-500">Current Assets / Current Liabilities</span>
              </div>
              <span className="text-base font-extrabold text-blue-600 font-mono">{currentRatio}x</span>
            </div>

            <div className="p-3 bg-slate-50 rounded border border-slate-200 flex items-center justify-between">
              <div>
                <span className="font-semibold text-slate-800 block">Quick / Acid-Test Ratio</span>
                <span className="text-[11px] text-slate-500">Liquid Assets / Current Liabilities</span>
              </div>
              <span className="text-base font-extrabold text-emerald-600 font-mono">{quickRatio}x</span>
            </div>

            <div className="p-3 bg-slate-50 rounded border border-slate-200 flex items-center justify-between">
              <div>
                <span className="font-semibold text-slate-800 block">Net Profit Margin</span>
                <span className="text-[11px] text-slate-500">Net Profit as % of Revenue</span>
              </div>
              <span className="text-base font-extrabold text-slate-800 font-mono">{profitMargin}%</span>
            </div>
          </div>
        </div>

        {/* Recent Journal Vouchers Table */}
        <div className="bg-white rounded border border-slate-200/90 shadow-2xs overflow-hidden lg:col-span-2">
          <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
            <div>
              <h3 className="text-sm font-bold text-slate-900 tracking-tight">Recent General Ledger Vouchers</h3>
              <p className="text-[11px] text-slate-500">Audited double-entry transactions</p>
            </div>
            <Link
              href="/accounts/journal"
              className="text-xs font-semibold text-blue-600 hover:text-blue-800 transition"
            >
              View Journal Register →
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                <tr>
                  <th className="px-3.5 py-2">Voucher #</th>
                  <th className="px-3.5 py-2">Date</th>
                  <th className="px-3.5 py-2">Type</th>
                  <th className="px-3.5 py-2">Office</th>
                  <th className="px-3.5 py-2 text-right">Debit (৳)</th>
                  <th className="px-3.5 py-2 text-right">Credit (৳)</th>
                  <th className="px-3.5 py-2 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recentVouchers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-6 text-center text-slate-400">
                      No journal vouchers recorded yet.
                    </td>
                  </tr>
                ) : (
                  recentVouchers.map((v) => (
                    <tr key={v.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-3.5 py-2 font-mono font-bold text-blue-600">{v.voucherNumber}</td>
                      <td className="px-3.5 py-2 text-slate-600">{v.transactionDate}</td>
                      <td className="px-3.5 py-2">
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700">
                          {v.journalType}
                        </span>
                      </td>
                      <td className="px-3.5 py-2 text-slate-600">{v.officeName}</td>
                      <td className="px-3.5 py-2 text-right font-mono font-semibold text-slate-800">
                        ৳{v.totalDebit.toLocaleString()}
                      </td>
                      <td className="px-3.5 py-2 text-right font-mono font-semibold text-slate-800">
                        ৳{v.totalCredit.toLocaleString()}
                      </td>
                      <td className="px-3.5 py-2 text-center">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                            v.status === "POSTED"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : v.status === "REVERSED"
                              ? "bg-rose-50 text-rose-700 border-rose-200"
                              : "bg-amber-50 text-amber-700 border-amber-200"
                          }`}
                        >
                          {v.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
