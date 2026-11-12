"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeftRight,
  BarChart2,
  CircleDollarSign,
  Landmark,
  Scale,
  Wallet,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { DashboardResponseData } from "@/lib/accounting/accounts-service";
import { useAccountingStore } from "@/features/accounts/store/accounting-store";

function fmtMoney(n: number | undefined | null): string {
  const num = Number(n || 0);
  return num.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function fmtDmy(iso: string): string {
  if (!iso || !iso.includes("-")) return iso;
  const [y, m, d] = iso.split("-");
  return `${d}-${m}-${y}`;
}

export default function AccountsDashboardPage() {
  const officesFromStore = useAccountingStore((s) => s.offices);

  const today = useMemo(() => new Date(), []);
  const defaultFrom = useMemo(() => {
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, "0");
    return `${y}-${m}-01`;
  }, [today]);
  const defaultTo = useMemo(() => {
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, "0");
    const d = String(today.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }, [today]);

  const [officeId, setOfficeId] = useState("ALL");
  const [fromDate, setFromDate] = useState(defaultFrom);
  const [toDate, setToDate] = useState(defaultTo);
  const [chartYear, setChartYear] = useState<number>(today.getFullYear());

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DashboardResponseData | null>(null);

  const fetchDashboardData = useCallback(
    async (opts: { office: string; from: string; to: string; year: number }) => {
      const params = new URLSearchParams({
        officeId: opts.office,
        fromDate: opts.from,
        toDate: opts.to,
        year: String(opts.year),
      });
      const res = await fetch(`/api/accounts/dashboard?${params.toString()}`, {
        cache: "no-store",
      });
      if (!res.ok) return null;
      const json = await res.json();
      return json.success && json.data ? (json.data as DashboardResponseData) : null;
    },
    []
  );

  const loadDashboard = useCallback(
    async (opts?: { office?: string; from?: string; to?: string; year?: number }) => {
      setLoading(true);
      try {
        const result = await fetchDashboardData({
          office: opts?.office ?? officeId,
          from: opts?.from ?? fromDate,
          to: opts?.to ?? toDate,
          year: opts?.year ?? chartYear,
        });
        if (result) setData(result);
      } finally {
        setLoading(false);
      }
    },
    [fetchDashboardData, officeId, fromDate, toDate, chartYear]
  );

  useEffect(() => {
    let cancelled = false;
    void fetchDashboardData({
      office: "ALL",
      from: defaultFrom,
      to: defaultTo,
      year: today.getFullYear(),
    }).then((result) => {
      if (cancelled) return;
      if (result) setData(result);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [fetchDashboardData, defaultFrom, defaultTo, today]);

  const offices = useMemo(() => {
    if (data?.filters?.offices && data.filters.offices.length > 0) {
      return data.filters.offices;
    }
    return officesFromStore;
  }, [data, officesFromStore]);

  const yearOptions = useMemo(() => {
    const curr = today.getFullYear();
    return [curr + 1, curr, curr - 1, curr - 2, curr - 3];
  }, [today]);

  const handleViewClick = (e: React.FormEvent) => {
    e.preventDefault();
    void loadDashboard({ office: officeId, from: fromDate, to: toDate, year: chartYear });
  };

  const chartData = data?.monthlyStatistics ?? [];

  return (
    <div className="min-h-screen bg-[#f4f7fb] p-4 space-y-4">
      {/* Top Filter Row */}
      <form
        onSubmit={handleViewClick}
        className="flex flex-wrap items-end gap-3"
      >
        <div className="w-56">
          <label className="block text-[11px] text-slate-500 font-medium mb-1">
            Office
          </label>
          <select
            value={officeId}
            onChange={(e) => setOfficeId(e.target.value)}
            className="w-full h-9 px-3 rounded border border-slate-300 bg-white text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="ALL">All</option>
            {offices.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </div>

        <div className="w-44">
          <label className="block text-[11px] text-slate-500 font-medium mb-1">
            From Date
          </label>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="w-full h-9 px-3 rounded border border-slate-300 bg-white text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <div className="w-44">
          <label className="block text-[11px] text-slate-500 font-medium mb-1">
            To Date
          </label>
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="w-full h-9 px-3 rounded border border-slate-300 bg-white text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="h-9 px-5 bg-[#2563eb] hover:bg-blue-700 disabled:opacity-60 text-white text-xs font-medium rounded shadow-xs transition cursor-pointer"
        >
          {loading ? "Loading..." : "View"}
        </button>
      </form>

      {/* Row 1: Account Balance + Income & Expense */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {/* Account Balance Card */}
        <div className="bg-white rounded-md border border-slate-200 border-t-[3px] border-t-[#3b82f6] p-4 shadow-2xs">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 rounded-md bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
              <Wallet className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-900 leading-tight">
                Account Balance
              </h2>
              <p className="text-[11px] text-slate-400">As on Till Date</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-[#f8fafc] rounded-md px-4 py-3.5">
              <div className="text-sm font-bold text-slate-900 tabular-nums">
                {fmtMoney(data?.accountBalance.accountsPayable)}
              </div>
              <div className="text-[11px] text-slate-400 mt-1">
                Accounts Payable
              </div>
            </div>
            <div className="bg-[#f8fafc] rounded-md px-4 py-3.5">
              <div className="text-sm font-bold text-slate-900 tabular-nums">
                {fmtMoney(data?.accountBalance.accountsReceivable)}
              </div>
              <div className="text-[11px] text-slate-400 mt-1">
                Accounts Receivable
              </div>
            </div>
          </div>
        </div>

        {/* Income & Expense Card */}
        <div className="bg-white rounded-md border border-slate-200 border-t-[3px] border-t-[#10b981] p-4 shadow-2xs">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 rounded-md bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
              <CircleDollarSign className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-900 leading-tight">
                Income &amp; Expense
              </h2>
              <p className="text-[11px] text-slate-400">
                {data?.filters.fromDate || fromDate} to {data?.filters.toDate || toDate}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-[#f8fafc] rounded-md px-3.5 py-3.5">
              <div className="text-sm font-bold text-slate-900 tabular-nums">
                {fmtMoney(data?.incomeAndExpense.cashInHand)}
              </div>
              <div className="text-[11px] text-slate-400 mt-1">Cash In Hand</div>
            </div>
            <div className="bg-[#f8fafc] rounded-md px-3.5 py-3.5">
              <div className="text-sm font-bold text-slate-900 tabular-nums">
                {fmtMoney(data?.incomeAndExpense.income)}
              </div>
              <div className="text-[11px] text-slate-400 mt-1">Income</div>
            </div>
            <div className="bg-[#f8fafc] rounded-md px-3.5 py-3.5">
              <div className="text-sm font-bold text-slate-900 tabular-nums">
                {fmtMoney(data?.incomeAndExpense.cashAtBank)}
              </div>
              <div className="text-[11px] text-slate-400 mt-1">Cash At Bank</div>
            </div>
            <div className="bg-[#f8fafc] rounded-md px-3.5 py-3.5">
              <div className="text-sm font-bold text-slate-900 tabular-nums">
                {fmtMoney(data?.incomeAndExpense.totalExpense)}
              </div>
              <div className="text-[11px] text-slate-400 mt-1">Total Expense</div>
            </div>
          </div>
        </div>
      </div>

      {/* Row 2: Cash & Equivalent + Cashflow */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {/* Cash & Equivalent Card */}
        <div className="bg-white rounded-md border border-slate-200 border-t-[3px] border-t-[#f59e0b] p-4 shadow-2xs">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 rounded-md bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
              <Landmark className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-900 leading-tight">
                Cash &amp; Equivalent
              </h2>
              <p className="text-[11px] text-slate-400">As on Till Date</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-[#f8fafc] rounded-md px-4 py-3.5">
              <div className="text-sm font-bold text-slate-900 tabular-nums">
                {fmtMoney(data?.cashAndEquivalent.cashInHand)}
              </div>
              <div className="text-[11px] text-slate-400 mt-1">Cash In Hand</div>
            </div>
            <div className="bg-[#f8fafc] rounded-md px-4 py-3.5">
              <div className="text-sm font-bold text-slate-900 tabular-nums">
                {fmtMoney(data?.cashAndEquivalent.cashAtBank)}
              </div>
              <div className="text-[11px] text-slate-400 mt-1">Cash At Bank</div>
            </div>
          </div>
        </div>

        {/* Cashflow Card */}
        <div className="bg-white rounded-md border border-slate-200 border-t-[3px] border-t-[#3b82f6] p-4 shadow-2xs">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 rounded-md bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
              <ArrowLeftRight className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-900 leading-tight">
                Cashflow
              </h2>
              <p className="text-[11px] text-slate-400">
                {data?.filters.fromDate || fromDate} to {data?.filters.toDate || toDate}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-[#f8fafc] rounded-md px-3.5 py-3.5">
              <div className="text-sm font-bold text-slate-900 tabular-nums">
                {fmtMoney(data?.cashflow.opening)}
              </div>
              <div className="text-[11px] text-slate-400 mt-1">Opening</div>
            </div>
            <div className="bg-[#f8fafc] rounded-md px-3.5 py-3.5">
              <div className="text-sm font-bold text-slate-900 tabular-nums">
                {fmtMoney(data?.cashflow.closing)}
              </div>
              <div className="text-[11px] text-slate-400 mt-1">Closing</div>
            </div>
            <div className="bg-[#f8fafc] rounded-md px-3.5 py-3.5">
              <div className="text-sm font-bold text-slate-900 tabular-nums">
                {fmtMoney(data?.cashflow.receive)}
              </div>
              <div className="text-[11px] text-slate-400 mt-1">Receive</div>
            </div>
            <div className="bg-[#f8fafc] rounded-md px-3.5 py-3.5">
              <div className="text-sm font-bold text-slate-900 tabular-nums">
                {fmtMoney(data?.cashflow.payments)}
              </div>
              <div className="text-[11px] text-slate-400 mt-1">Payments</div>
            </div>
          </div>
        </div>
      </div>

      {/* Row 3: Financial Ratio Analysis + Monthly Statistics */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {/* Financial Ratio Analysis */}
        <div className="bg-white rounded-md border border-slate-200 border-t-[3px] border-t-[#f59e0b] p-4 shadow-2xs">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-md bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
              <Scale className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-900 leading-tight">
                Financial Ratio Analysis
              </h2>
              <p className="text-[11px] text-slate-400">{fmtDmy(toDate)}</p>
            </div>
          </div>

          <div className="border border-slate-200 rounded overflow-hidden">
            <div className="max-h-[340px] overflow-y-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="sticky top-0 bg-[#d8ebfc] text-slate-800 text-[11px] font-bold border-b border-slate-200">
                  <tr>
                    <th className="px-2.5 py-2 w-14 border-r border-slate-200/80">SL</th>
                    <th className="px-2.5 py-2 border-r border-slate-200/80">Ratio Name</th>
                    <th className="px-2.5 py-2 w-24 border-r border-slate-200/80">Std Ratio</th>
                    <th className="px-2.5 py-2 w-24 border-r border-slate-200/80">Act Ratio</th>
                    <th className="px-2.5 py-2 w-20">Matric</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(data?.ratios ?? []).map((row) => (
                    <tr
                      key={row.sl}
                      className={
                        row.isSectionHeader
                          ? "bg-slate-50/70 font-medium text-slate-800"
                          : "hover:bg-slate-50 text-slate-700"
                      }
                    >
                      <td className="px-2.5 py-1.5 border-r border-slate-100 tabular-nums">
                        {row.sl}
                      </td>
                      <td className="px-2.5 py-1.5 border-r border-slate-100">
                        {row.ratioName}
                      </td>
                      <td className="px-2.5 py-1.5 border-r border-slate-100 tabular-nums">
                        {row.stdRatio}
                      </td>
                      <td className="px-2.5 py-1.5 border-r border-slate-100 tabular-nums">
                        {row.actRatio}
                      </td>
                      <td className="px-2.5 py-1.5">{row.metric}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Monthly Statistics */}
        <div className="bg-white rounded-md border border-slate-200 p-4 shadow-2xs flex flex-col">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-md bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                <BarChart2 className="w-4 h-4" />
              </div>
              <h2 className="text-sm font-semibold text-slate-900">
                Monthly Statistics
              </h2>
            </div>

            <select
              value={chartYear}
              onChange={(e) => {
                const y = Number(e.target.value);
                setChartYear(y);
                void loadDashboard({ office: officeId, from: fromDate, to: toDate, year: y });
              }}
              className="h-8 w-24 px-2 rounded border border-slate-300 bg-white text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              {yearOptions.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>

          <div className="flex-1 min-h-[300px] w-full">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart
                data={chartData}
                stackOffset="sign"
                margin={{ top: 10, right: 12, left: 10, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 11, fill: "#64748b" }}
                  axisLine={{ stroke: "#cbd5e1" }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "#64748b" }}
                  axisLine={false}
                  tickLine={false}
                  width={78}
                  tickFormatter={(v) => Number(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                />
                <ReferenceLine y={0} stroke="#cbd5e1" />
                <Tooltip
                  formatter={(value: unknown, name: unknown) => {
                    const num = Math.abs(Number(value || 0));
                    const label = name === "income" ? "Income" : "Expense";
                    return [fmtMoney(num), label];
                  }}
                />
                <Bar
                  dataKey="income"
                  name="income"
                  stackId="stack"
                  fill="#f48fb1"
                  barSize={16}
                  radius={[2, 2, 0, 0]}
                />
                <Bar
                  dataKey="negativeExpense"
                  name="expense"
                  stackId="stack"
                  fill="#3b82f6"
                  barSize={16}
                  radius={[0, 0, 2, 2]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="flex items-center justify-center gap-6 pt-2 text-[11px] text-slate-500">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-2.5 rounded-2xs inline-block bg-[#f48fb1]" />
              <span>Income</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-2.5 rounded-2xs inline-block bg-[#3b82f6]" />
              <span>Expense</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
