"use client";

import React, { useState, useMemo } from "react";
import { useResource } from "@/hooks/use-resource";
import { posApi } from "@/features/pos/services/pos.api";
import {
  Calendar as CalendarIcon,
  ChevronDown,
  RefreshCw,
  TrendingUp,
  ShoppingBag,
  Users,
  CheckCircle,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface CounterStat {
  code: string;
  name: string;
  floor: string;
  freq: number;
  val: number;
  color: string;
}

interface PaymentStat {
  name: string;
  freq: number;
  val: number;
  color: string;
  badge: string;
}

interface ItemStat {
  rank: number;
  name: string;
  category: string;
  freq: number;
  val: number;
}

interface CustomerStat {
  rank: number;
  name: string;
  mobile: string;
  freq: number;
  val: number;
  tier: "Platinum" | "Gold" | "Silver";
}

const money = (n: number) => `${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} BDT`;
const THIS_YEAR = new Date().getFullYear();
const YEARS = [String(THIS_YEAR), String(THIS_YEAR - 1)];

export default function PosDashboardPage() {
  const [fromDate, setFromDate] = useState(`${new Date().toISOString().slice(0, 7)}-01`);
  const [toDate, setToDate] = useState(new Date().toISOString().slice(0, 10));
  const [counterMode, setCounterMode] = useState<"freq" | "val">("val");
  const [paymentMode, setPaymentMode] = useState<"freq" | "val">("val");
  const [itemMode, setItemMode] = useState<"freq" | "val">("val");
  const [customerMode, setCustomerMode] = useState<"freq" | "val">("val");
  const [periodUnit, setPeriodUnit] = useState<"Month" | "Quarter">("Month");
  const [periodYear, setPeriodYear] = useState(YEARS[0]);
  // Figures come from POS sales (completed, not voided) for the period applied with View.
  const [period, setPeriod] = useState({ from: fromDate, to: toDate });
  const dashboard = useResource(`pos-dashboard-${period.from}-${period.to}-${periodYear}`, () =>
    posApi.dashboard({ ...period, year: Number(periodYear) }),
  );
  const data = dashboard.data;
  const COUNTER_STATS: CounterStat[] = data?.counters ?? [];
  const PAYMENT_STATS: PaymentStat[] = data?.payments ?? [];
  const TOP_ITEMS: ItemStat[] = data?.topItems ?? [];
  const TOP_CUSTOMERS: CustomerStat[] = data?.topCustomers ?? [];
  const summary = data?.summary ?? { invoices: 0, gross: 0, vat: 0, discount: 0, net: 0 };

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((c) => (c === msg ? null : c));
    }, 3000);
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    dashboard.reload();
    setTimeout(() => setIsRefreshing(false), 400);
  };

  const handleApplyFilter = () => {
    if (!fromDate || !toDate || fromDate > toDate) {
      showToast("Choose a valid date range");
      return;
    }
    setPeriod({ from: fromDate, to: toDate });
  };

  // Chart data selection
  const chartData = useMemo(() => {
    return (periodUnit === "Quarter" ? data?.quarterly : data?.monthly) ?? [];
  }, [periodUnit, data]);

  // Aggregations
  // "|| 1" keeps the percentages at 0 instead of NaN when there are no sales.
  const totalCounterVal = COUNTER_STATS.reduce((acc, c) => acc + c.val, 0) || 1;
  const totalCounterFreq = COUNTER_STATS.reduce((acc, c) => acc + c.freq, 0) || 1;

  const totalPaymentVal = PAYMENT_STATS.reduce((acc, p) => acc + p.val, 0) || 1;
  const totalPaymentFreq = PAYMENT_STATS.reduce((acc, p) => acc + p.freq, 0) || 1;

  const maxItemVal = Math.max(1, ...TOP_ITEMS.map((i) => i.val));
  const maxItemFreq = Math.max(1, ...TOP_ITEMS.map((i) => i.freq));

  const maxCustVal = Math.max(1, ...TOP_CUSTOMERS.map((c) => c.val));
  const maxCustFreq = Math.max(1, ...TOP_CUSTOMERS.map((c) => c.freq));

  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-slate-950 p-3 sm:p-5 space-y-4 text-slate-800 dark:text-slate-100">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 flex items-center gap-2 rounded-lg bg-emerald-600 text-white px-4 py-2.5 shadow-lg text-xs font-semibold animate-in fade-in slide-in-from-top-2">
          <CheckCircle className="size-4" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* 1. Top Date Filter Bar */}
      <div className="rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3 shadow-2xs">
        <div className="grid grid-cols-1 sm:grid-cols-12 items-end gap-3">
          <div className="sm:col-span-5 flex flex-col gap-1">
            <label className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
              From Date
            </label>
            <div className="relative flex items-center">
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="h-8 w-full border-b border-slate-300 dark:border-slate-700 bg-transparent px-1 pr-6 text-xs text-slate-700 dark:text-slate-200 focus:border-blue-600 focus:outline-none"
              />
              <CalendarIcon className="pointer-events-none absolute right-1.5 size-3.5 text-slate-400" />
            </div>
          </div>

          <div className="sm:col-span-5 flex flex-col gap-1">
            <label className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
              To Date
            </label>
            <div className="relative flex items-center">
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="h-8 w-full border-b border-slate-300 dark:border-slate-700 bg-transparent px-1 pr-6 text-xs text-slate-700 dark:text-slate-200 focus:border-blue-600 focus:outline-none"
              />
              <CalendarIcon className="pointer-events-none absolute right-1.5 size-3.5 text-slate-400" />
            </div>
          </div>

          <div className="sm:col-span-2 flex items-center gap-2">
            <button
              type="button"
              onClick={handleApplyFilter}
              className="h-8 rounded bg-[#0d6efd] hover:bg-[#0b5ed7] px-5 text-xs font-semibold text-white shadow-2xs transition-colors cursor-pointer"
            >
              View
            </button>
            <button
              type="button"
              onClick={handleRefresh}
              title="Refresh Dashboard"
              className="h-8 w-8 flex items-center justify-center rounded border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
            >
              <RefreshCw className={`size-3.5 ${isRefreshing ? "animate-spin text-blue-600" : ""}`} />
            </button>
          </div>
        </div>
      </div>

      {/* 2. Row 1: Counter Wise Sales | Payment Method Wise Sales | Collection Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Counter Wise Sales */}
        <div className="rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-2xs flex flex-col justify-between min-h-[270px]">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-xs font-bold text-slate-800 dark:text-slate-100">
                  Counter Wise Sales
                </h3>
                <span className="text-[10px] text-slate-400">Terminal performance overview</span>
              </div>
              <div className="inline-flex rounded overflow-hidden border border-[#0d6efd]">
                <button
                  type="button"
                  onClick={() => setCounterMode("freq")}
                  className={`px-2.5 py-0.5 text-[10px] font-semibold cursor-pointer transition-colors ${
                    counterMode === "freq"
                      ? "bg-[#0d6efd] text-white"
                      : "bg-white dark:bg-slate-900 text-[#0d6efd]"
                  }`}
                >
                  Freq.
                </button>
                <button
                  type="button"
                  onClick={() => setCounterMode("val")}
                  className={`px-2.5 py-0.5 text-[10px] font-semibold cursor-pointer transition-colors ${
                    counterMode === "val"
                      ? "bg-[#0d6efd] text-white"
                      : "bg-white dark:bg-slate-900 text-[#0d6efd]"
                  }`}
                >
                  Val.
                </button>
              </div>
            </div>

            <div className="space-y-3 pt-1">
              {COUNTER_STATS.map((c) => {
                const percent =
                  counterMode === "val"
                    ? Math.round((c.val / totalCounterVal) * 100)
                    : Math.round((c.freq / totalCounterFreq) * 100);
                return (
                  <div key={c.code} className="space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <div className="flex items-center gap-1.5 font-semibold text-slate-800 dark:text-slate-200">
                        <span>{c.name}</span>
                        <span className="text-[10px] font-normal text-slate-400">({c.floor})</span>
                      </div>
                      <span className="font-bold text-slate-700 dark:text-slate-300">
                        {counterMode === "val"
                          ? `${c.val.toLocaleString()} BDT (${percent}%)`
                          : `${c.freq} orders (${percent}%)`}
                      </span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${c.color} rounded-full transition-all duration-500`}
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="pt-3 mt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
            <span>Total Across {COUNTER_STATS.length} Counters</span>
            <span className="font-bold text-slate-900 dark:text-slate-100">
              {counterMode === "val"
                ? `${totalCounterVal.toLocaleString()} BDT`
                : `${totalCounterFreq} orders`}
            </span>
          </div>
        </div>

        {/* Payment Method Wise Sales */}
        <div className="rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-2xs flex flex-col justify-between min-h-[270px]">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-xs font-bold text-slate-800 dark:text-slate-100">
                  Payment Method Wise Sales
                </h3>
                <span className="text-[10px] text-slate-400">Tender breakdown</span>
              </div>
              <div className="inline-flex rounded overflow-hidden border border-[#0d6efd]">
                <button
                  type="button"
                  onClick={() => setPaymentMode("freq")}
                  className={`px-2.5 py-0.5 text-[10px] font-semibold cursor-pointer transition-colors ${
                    paymentMode === "freq"
                      ? "bg-[#0d6efd] text-white"
                      : "bg-white dark:bg-slate-900 text-[#0d6efd]"
                  }`}
                >
                  Freq.
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMode("val")}
                  className={`px-2.5 py-0.5 text-[10px] font-semibold cursor-pointer transition-colors ${
                    paymentMode === "val"
                      ? "bg-[#0d6efd] text-white"
                      : "bg-white dark:bg-slate-900 text-[#0d6efd]"
                  }`}
                >
                  Val.
                </button>
              </div>
            </div>

            <div className="space-y-3 pt-1">
              {PAYMENT_STATS.map((p) => {
                const percent =
                  paymentMode === "val"
                    ? Math.round((p.val / totalPaymentVal) * 100)
                    : Math.round((p.freq / totalPaymentFreq) * 100);
                return (
                  <div key={p.name} className="space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {p.name}
                      </span>
                      <span className="font-bold text-slate-700 dark:text-slate-300">
                        {paymentMode === "val"
                          ? `${p.val.toLocaleString()} BDT (${percent}%)`
                          : `${p.freq} txns (${percent}%)`}
                      </span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${p.color} rounded-full transition-all duration-500`}
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="pt-3 mt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
            <span>Total Collected</span>
            <span className="font-bold text-slate-900 dark:text-slate-100">
              {paymentMode === "val"
                ? `${totalPaymentVal.toLocaleString()} BDT`
                : `${totalPaymentFreq} transactions`}
            </span>
          </div>
        </div>

        {/* POS Collection Summary */}
        <div className="rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-2xs flex flex-col justify-between min-h-[270px]">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold text-slate-800 dark:text-slate-100">
                POS Collection Summary
              </h3>
              <button
                type="button"
                onClick={handleRefresh}
                title="Refresh summary"
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <RefreshCw className={`size-3.5 ${isRefreshing ? "animate-spin text-blue-600" : ""}`} />
              </button>
            </div>

            <ul className="space-y-3.5 text-[11px] text-slate-700 dark:text-slate-300 pl-3 list-disc">
              <li>
                <div className="font-semibold text-slate-800 dark:text-slate-100">
                  Total POS Invoices
                </div>
                <div className="text-[10.5px] text-slate-500 dark:text-slate-400 pl-2 mt-0.5">
                  Total Number :{" "}
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {summary.invoices}
                  </span>
                </div>
                <div className="text-[10.5px] text-slate-500 dark:text-slate-400 pl-2">
                  Total Amount :{" "}
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {money(summary.gross)}
                  </span>
                </div>
              </li>
              <li>
                <div className="font-semibold text-slate-800 dark:text-slate-100">
                  VAT & Discount Summary
                </div>
                <div className="text-[10.5px] text-slate-500 dark:text-slate-400 pl-2 mt-0.5">
                  Total VAT :{" "}
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                    +{money(summary.vat)}
                  </span>
                </div>
                <div className="text-[10.5px] text-slate-500 dark:text-slate-400 pl-2">
                  Total Discount :{" "}
                  <span className="font-semibold text-rose-500 dark:text-rose-400">
                    -{money(summary.discount)}
                  </span>
                </div>
              </li>
            </ul>
          </div>

          <div className="pt-3 mt-3 border-t border-slate-100 dark:border-slate-800 bg-blue-50/50 dark:bg-blue-950/20 -mx-4 -mb-4 p-3 rounded-b flex items-center justify-between text-xs">
            <span className="font-medium text-blue-900 dark:text-blue-300">Net Sales Realized</span>
            <span className="font-bold text-blue-700 dark:text-blue-400 text-sm">
              {money(summary.net)}
            </span>
          </div>
        </div>
      </div>

      {/* 3. Row 2: POS Sales Trend (Last 12 Months) */}
      <div className="rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-2xs flex flex-col justify-between min-h-[290px]">
        <div className="flex items-start justify-between mb-2">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-bold text-slate-800 dark:text-slate-100">
                POS Sales Revenue
              </h3>
              <span className="inline-flex items-center gap-1 rounded bg-emerald-50 dark:bg-emerald-950/30 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                <TrendingUp className="size-3" />
                {money((data?.monthly ?? []).reduce((t, m) => t + m.sales, 0))} in {periodYear}
              </span>
            </div>
            <span className="text-[10px] text-slate-400">
              {periodUnit === "Quarter" ? "Quarterly breakdown" : "Monthly revenue trend"} ({periodYear})
            </span>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative flex items-center border-b border-slate-300 dark:border-slate-700 pb-0.5">
              <select
                value={periodUnit}
                onChange={(e) => setPeriodUnit(e.target.value as "Month" | "Quarter")}
                className="appearance-none bg-transparent pr-4 text-[11px] text-slate-600 dark:text-slate-300 focus:outline-none cursor-pointer"
              >
                <option value="Month">Month</option>
                <option value="Quarter">Quarter</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-0 size-3 text-slate-400" />
            </div>

            <div className="relative flex items-center border-b border-slate-300 dark:border-slate-700 pb-0.5">
              <select
                value={periodYear}
                onChange={(e) => setPeriodYear(e.target.value)}
                className="appearance-none bg-transparent pr-4 text-[11px] text-slate-600 dark:text-slate-300 focus:outline-none cursor-pointer"
              >
                {YEARS.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-0 size-3 text-slate-400" />
            </div>
          </div>
        </div>

        <div className="h-52 w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={chartData}
              margin={{ top: 10, right: 10, left: 10, bottom: 0 }}
            >
              <defs>
                <linearGradient id="posSalesFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#0d6efd" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#0d6efd" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="month" tick={{ fontSize: 10, fill: "#64748b" }} />
              <YAxis
                tick={{ fontSize: 10, fill: "#64748b" }}
                tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
              />
              <Tooltip
                formatter={(val) => [`${Number(val).toLocaleString()} BDT`, "Revenue"]}
                labelStyle={{ fontWeight: 600, color: "#0f172a" }}
                contentStyle={{
                  backgroundColor: "rgba(255, 255, 255, 0.96)",
                  borderRadius: 6,
                  border: "1px solid #e2e8f0",
                  fontSize: 11,
                }}
              />
              <Area
                type="monotone"
                dataKey="sales"
                stroke="#0d6efd"
                strokeWidth={2.2}
                fillOpacity={1}
                fill="url(#posSalesFill)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 4. Row 3: Top 10 Selling Items | Top 10 Customers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top 10 Items */}
        <div className="rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-2xs">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-1.5">
              <ShoppingBag className="size-3.5 text-blue-600" />
              <h3 className="text-xs font-bold text-slate-800 dark:text-slate-100">
                Top 10 Selling Items
              </h3>
            </div>
            <div className="inline-flex rounded overflow-hidden border border-[#0d6efd]">
              <button
                type="button"
                onClick={() => setItemMode("freq")}
                className={`px-2.5 py-0.5 text-[10px] font-semibold cursor-pointer transition-colors ${
                  itemMode === "freq"
                    ? "bg-[#0d6efd] text-white"
                    : "bg-white dark:bg-slate-900 text-[#0d6efd]"
                }`}
              >
                Freq.
              </button>
              <button
                type="button"
                onClick={() => setItemMode("val")}
                className={`px-2.5 py-0.5 text-[10px] font-semibold cursor-pointer transition-colors ${
                  itemMode === "val"
                    ? "bg-[#0d6efd] text-white"
                    : "bg-white dark:bg-slate-900 text-[#0d6efd]"
                }`}
              >
                Val.
              </button>
            </div>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {TOP_ITEMS.map((item) => {
              const barWidth =
                itemMode === "val"
                  ? Math.round((item.val / maxItemVal) * 100)
                  : Math.round((item.freq / maxItemFreq) * 100);
              return (
                <div key={item.rank} className="py-2 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 text-[10px] font-bold text-slate-600 dark:text-slate-300">
                      {item.rank}
                    </span>
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-800 dark:text-slate-100 truncate">
                        {item.name}
                      </p>
                      <p className="text-[10px] text-slate-400 truncate">{item.category}</p>
                    </div>
                  </div>

                  <div className="flex flex-col items-end shrink-0 ml-3">
                    <span className="font-bold text-slate-800 dark:text-slate-100">
                      {itemMode === "val" ? `${item.val.toLocaleString()} BDT` : `${item.freq} sold`}
                    </span>
                    <div className="w-20 h-1 bg-slate-100 dark:bg-slate-800 rounded-full mt-1 overflow-hidden">
                      <div
                        className="h-full bg-blue-600 rounded-full"
                        style={{ width: `${barWidth}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Top 10 Customers */}
        <div className="rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-2xs">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-1.5">
              <Users className="size-3.5 text-blue-600" />
              <h3 className="text-xs font-bold text-slate-800 dark:text-slate-100">
                Top 10 POS Customers
              </h3>
            </div>
            <div className="inline-flex rounded overflow-hidden border border-[#0d6efd]">
              <button
                type="button"
                onClick={() => setCustomerMode("freq")}
                className={`px-2.5 py-0.5 text-[10px] font-semibold cursor-pointer transition-colors ${
                  customerMode === "freq"
                    ? "bg-[#0d6efd] text-white"
                    : "bg-white dark:bg-slate-900 text-[#0d6efd]"
                }`}
              >
                Freq.
              </button>
              <button
                type="button"
                onClick={() => setCustomerMode("val")}
                className={`px-2.5 py-0.5 text-[10px] font-semibold cursor-pointer transition-colors ${
                  customerMode === "val"
                    ? "bg-[#0d6efd] text-white"
                    : "bg-white dark:bg-slate-900 text-[#0d6efd]"
                }`}
              >
                Val.
              </button>
            </div>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {TOP_CUSTOMERS.map((cust) => {
              const barWidth =
                customerMode === "val"
                  ? Math.round((cust.val / maxCustVal) * 100)
                  : Math.round((cust.freq / maxCustFreq) * 100);
              return (
                <div key={cust.rank} className="py-2 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 text-[10px] font-bold text-slate-600 dark:text-slate-300">
                      {cust.rank}
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="font-semibold text-slate-800 dark:text-slate-100 truncate">
                          {cust.name}
                        </p>
                        <span
                          className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${
                            cust.tier === "Platinum"
                              ? "bg-purple-50 text-purple-700 border-purple-200"
                              : cust.tier === "Gold"
                              ? "bg-amber-50 text-amber-700 border-amber-200"
                              : "bg-slate-50 text-slate-600 border-slate-200"
                          }`}
                        >
                          {cust.tier}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400 truncate">{cust.mobile}</p>
                    </div>
                  </div>

                  <div className="flex flex-col items-end shrink-0 ml-3">
                    <span className="font-bold text-slate-800 dark:text-slate-100">
                      {customerMode === "val"
                        ? `${cust.val.toLocaleString()} BDT`
                        : `${cust.freq} visits`}
                    </span>
                    <div className="w-20 h-1 bg-slate-100 dark:bg-slate-800 rounded-full mt-1 overflow-hidden">
                      <div
                        className="h-full bg-emerald-600 rounded-full"
                        style={{ width: `${barWidth}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
