"use client";

import React, { useState, useMemo } from "react";
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

// 12-Month Sales History (2025 - 2026)
const MONTHLY_SALES_2026 = [
  { month: "Jan 26", sales: 175400, orders: 132 },
  { month: "Feb 26", sales: 189200, orders: 144 },
  { month: "Mar 26", sales: 210500, orders: 158 },
  { month: "Apr 26", sales: 235000, orders: 176 },
  { month: "May 26", sales: 220800, orders: 165 },
  { month: "Jun 26", sales: 245300, orders: 182 },
  { month: "Jul 26", sales: 260100, orders: 195 },
  { month: "Aug 26", sales: 250900, orders: 188 },
  { month: "Sep 26", sales: 275600, orders: 204 },
  { month: "Oct 26", sales: 290400, orders: 218 },
  { month: "Nov 26", sales: 194250, orders: 148 },
  { month: "Dec 26", sales: 310000, orders: 230 },
];

const MONTHLY_SALES_2025 = [
  { month: "Jan 25", sales: 145000, orders: 110 },
  { month: "Feb 25", sales: 152000, orders: 118 },
  { month: "Mar 25", sales: 168000, orders: 126 },
  { month: "Apr 25", sales: 180000, orders: 135 },
  { month: "May 25", sales: 172000, orders: 130 },
  { month: "Jun 25", sales: 195000, orders: 145 },
  { month: "Jul 25", sales: 205000, orders: 152 },
  { month: "Aug 25", sales: 198000, orders: 148 },
  { month: "Sep 25", sales: 215000, orders: 160 },
  { month: "Oct 25", sales: 228000, orders: 172 },
  { month: "Nov 25", sales: 235000, orders: 178 },
  { month: "Dec 25", sales: 260000, orders: 195 },
];

const QUARTERLY_SALES_2026 = [
  { month: "Q1 2026", sales: 575100, orders: 434 },
  { month: "Q2 2026", sales: 701100, orders: 523 },
  { month: "Q3 2026", sales: 786600, orders: 587 },
  { month: "Q4 2026 (Est)", sales: 794650, orders: 596 },
];

const QUARTERLY_SALES_2025 = [
  { month: "Q1 2025", sales: 465000, orders: 354 },
  { month: "Q2 2025", sales: 547000, orders: 410 },
  { month: "Q3 2025", sales: 618000, orders: 460 },
  { month: "Q4 2025", sales: 723000, orders: 545 },
];

interface CounterStat {
  code: string;
  name: string;
  floor: string;
  freq: number;
  val: number;
  color: string;
}

const COUNTER_STATS: CounterStat[] = [
  { code: "11", name: "Counter 01", floor: "HALLROOM", freq: 68, val: 89500, color: "bg-blue-600" },
  { code: "12", name: "Counter 02", floor: "ROOF TOP", freq: 42, val: 54200, color: "bg-emerald-600" },
  { code: "13", name: "Counter 03", floor: "VIP LOUNGE", freq: 24, val: 31450, color: "bg-amber-600" },
  { code: "14", name: "Counter 04", floor: "OUTDOOR", freq: 14, val: 19100, color: "bg-purple-600" },
];

interface PaymentStat {
  name: string;
  freq: number;
  val: number;
  color: string;
  badge: string;
}

const PAYMENT_STATS: PaymentStat[] = [
  { name: "Cash", freq: 72, val: 88400, color: "bg-emerald-500", badge: "text-emerald-700 bg-emerald-50 border-emerald-200" },
  { name: "Card (POS Terminal)", freq: 46, val: 64550, color: "bg-blue-500", badge: "text-blue-700 bg-blue-50 border-blue-200" },
  { name: "MFS (bKash/Nagad)", freq: 25, val: 35300, color: "bg-pink-500", badge: "text-pink-700 bg-pink-50 border-pink-200" },
  { name: "Gift Voucher / Points", freq: 5, val: 6000, color: "bg-purple-500", badge: "text-purple-700 bg-purple-50 border-purple-200" },
];

interface ItemStat {
  rank: number;
  name: string;
  category: string;
  freq: number;
  val: number;
}

const TOP_ITEMS: ItemStat[] = [
  { rank: 1, name: "Beef Ribeye Steak (250g)", category: "Main Course", freq: 78, val: 109200 },
  { rank: 2, name: "Chicken Alfredo Pasta", category: "Pasta", freq: 112, val: 67200 },
  { rank: 3, name: "Margherita Pizza (Large)", category: "Pizza", freq: 95, val: 66500 },
  { rank: 4, name: "Grilled Atlantic Salmon", category: "Seafood", freq: 42, val: 58800 },
  { rank: 5, name: "BBQ Chicken Wings (8 pcs)", category: "Appetizers", freq: 124, val: 49600 },
  { rank: 6, name: "Seafood Fried Rice", category: "Rice & Platters", freq: 88, val: 39600 },
  { rank: 7, name: "Fresh Lime Mint Soda", category: "Beverages", freq: 180, val: 36000 },
  { rank: 8, name: "Chocolate Lava Cake", category: "Dessert", freq: 92, val: 32200 },
  { rank: 9, name: "Caesar Salad with Chicken", category: "Salads", freq: 64, val: 28800 },
  { rank: 10, name: "Vanilla Latte / Cappuccino", category: "Coffee", freq: 145, val: 29000 },
];

interface CustomerStat {
  rank: number;
  name: string;
  mobile: string;
  freq: number;
  val: number;
  tier: "Platinum" | "Gold" | "Silver";
}

const TOP_CUSTOMERS: CustomerStat[] = [
  { rank: 1, name: "Dr. Farhan Ahmed", mobile: "01711-234567", freq: 18, val: 28450, tier: "Platinum" },
  { rank: 2, name: "Sabrina Yasmin", mobile: "01819-345678", freq: 14, val: 22800, tier: "Platinum" },
  { rank: 3, name: "Tanvir Hasan", mobile: "01912-456789", freq: 12, val: 19400, tier: "Gold" },
  { rank: 4, name: "Nusrat Jahan", mobile: "01755-567890", freq: 11, val: 17250, tier: "Gold" },
  { rank: 5, name: "Kazi Mahmud", mobile: "01678-678901", freq: 9, val: 15900, tier: "Gold" },
  { rank: 6, name: "Afroza Begum", mobile: "01844-789012", freq: 8, val: 13600, tier: "Silver" },
  { rank: 7, name: "Rafiqul Islam", mobile: "01722-890123", freq: 7, val: 12100, tier: "Silver" },
  { rank: 8, name: "Mehnaz Tabassum", mobile: "01933-901234", freq: 6, val: 10850, tier: "Silver" },
  { rank: 9, name: "Shafiul Alam", mobile: "01555-012345", freq: 6, val: 9900, tier: "Silver" },
  { rank: 10, name: "Parveen Akter", mobile: "01733-123456", freq: 5, val: 8750, tier: "Silver" },
];

export default function PosDashboardPage() {
  const [fromDate, setFromDate] = useState("2026-11-01");
  const [toDate, setToDate] = useState("2026-11-30");
  const [counterMode, setCounterMode] = useState<"freq" | "val">("val");
  const [paymentMode, setPaymentMode] = useState<"freq" | "val">("val");
  const [itemMode, setItemMode] = useState<"freq" | "val">("val");
  const [customerMode, setCustomerMode] = useState<"freq" | "val">("val");
  const [periodUnit, setPeriodUnit] = useState<"Month" | "Quarter">("Month");
  const [periodYear, setPeriodYear] = useState<"2026" | "2025">("2026");

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
    setTimeout(() => {
      setIsRefreshing(false);
      showToast("POS Dashboard metrics refreshed successfully");
    }, 400);
  };

  const handleApplyFilter = () => {
    showToast(`Filtering POS data for ${fromDate || "Start"} to ${toDate || "Present"}`);
  };

  // Chart data selection
  const chartData = useMemo(() => {
    if (periodUnit === "Quarter") {
      return periodYear === "2026" ? QUARTERLY_SALES_2026 : QUARTERLY_SALES_2025;
    }
    return periodYear === "2026" ? MONTHLY_SALES_2026 : MONTHLY_SALES_2025;
  }, [periodUnit, periodYear]);

  // Aggregations
  const totalCounterVal = COUNTER_STATS.reduce((acc, c) => acc + c.val, 0);
  const totalCounterFreq = COUNTER_STATS.reduce((acc, c) => acc + c.freq, 0);

  const totalPaymentVal = PAYMENT_STATS.reduce((acc, p) => acc + p.val, 0);
  const totalPaymentFreq = PAYMENT_STATS.reduce((acc, p) => acc + p.freq, 0);

  const maxItemVal = Math.max(...TOP_ITEMS.map((i) => i.val));
  const maxItemFreq = Math.max(...TOP_ITEMS.map((i) => i.freq));

  const maxCustVal = Math.max(...TOP_CUSTOMERS.map((c) => c.val));
  const maxCustFreq = Math.max(...TOP_CUSTOMERS.map((c) => c.freq));

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
            <span>Total Across 4 Counters</span>
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
                    148
                  </span>
                </div>
                <div className="text-[10.5px] text-slate-500 dark:text-slate-400 pl-2">
                  Total Amount :{" "}
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    194,250.00 BDT
                  </span>
                </div>
              </li>
              <li>
                <div className="font-semibold text-slate-800 dark:text-slate-100">
                  VAT & Discount Summary
                </div>
                <div className="text-[10.5px] text-slate-500 dark:text-slate-400 pl-2 mt-0.5">
                  Total VAT (7.5%) :{" "}
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                    +14,568.75 BDT
                  </span>
                </div>
                <div className="text-[10.5px] text-slate-500 dark:text-slate-400 pl-2">
                  Total Discount :{" "}
                  <span className="font-semibold text-rose-500 dark:text-rose-400">
                    -9,820.00 BDT
                  </span>
                </div>
              </li>
            </ul>
          </div>

          <div className="pt-3 mt-3 border-t border-slate-100 dark:border-slate-800 bg-blue-50/50 dark:bg-blue-950/20 -mx-4 -mb-4 p-3 rounded-b flex items-center justify-between text-xs">
            <span className="font-medium text-blue-900 dark:text-blue-300">Net Sales Realized</span>
            <span className="font-bold text-blue-700 dark:text-blue-400 text-sm">
              198,998.75 BDT
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
                +14.8% YoY
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
                onChange={(e) => setPeriodYear(e.target.value as "2026" | "2025")}
                className="appearance-none bg-transparent pr-4 text-[11px] text-slate-600 dark:text-slate-300 focus:outline-none cursor-pointer"
              >
                <option value="2026">2026</option>
                <option value="2025">2025</option>
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
