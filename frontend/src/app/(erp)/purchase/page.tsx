"use client";

import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Calendar as CalendarIcon,
  CheckCircle2,
  ChevronDown,
  RefreshCw,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { fetchApi } from "@/lib/api";
import { DashboardAnalytics } from "@bridgeone/contracts";

interface PieSlice {
  name: string;
  freq: number;
  val: number;
  color: string;
}

const TYPE_WISE_DATA: PieSlice[] = [
  { name: "Standard Purchase Order", freq: 93.3, val: 91.2, color: "#ff3b5c" },
  { name: "Environment, Health, and Safety Register", freq: 4.4, val: 5.1, color: "#10b981" },
  { name: "Asset Purchase", freq: 1.5, val: 2.4, color: "#f59e0b" },
  { name: "Raw Material", freq: 0.8, val: 1.3, color: "#06b6d4" },
];

const DEFAULT_WAREHOUSE_DATA = [
  { name: "WH Store", value: 100, color: "#0088ff" },
];

const CYCLE_STEPS = [
  { label: "Order Placement", daysAfter: "0.7 Days" },
  { label: "Confirmation", daysAfter: "5.2 Days" },
  { label: "Delivery", daysAfter: "1.3 Days" },
  { label: "Invoice", daysAfter: "10.4 Days" },
  { label: "Payment", daysAfter: null },
];

const MONTHLY_EXPENDITURE_12M = [
  { month: "Nov 25", expenditure: 45000 },
  { month: "Dec 25", expenditure: 52000 },
  { month: "Jan 26", expenditure: 48000 },
  { month: "Feb 26", expenditure: 61000 },
  { month: "Mar 26", expenditure: 55000 },
  { month: "Apr 26", expenditure: 67000 },
  { month: "May 26", expenditure: 72000 },
  { month: "Jun 26", expenditure: 68000 },
  { month: "Jul 26", expenditure: 74000 },
  { month: "Aug 26", expenditure: 82000 },
  { month: "Sep 26", expenditure: 95000 },
  { month: "Oct 26", expenditure: 845000 },
];

const SUPPLIER_CLASSIFICATION = [
  { name: "Short", count: 130, percent: "16%", color: "#38bdf8", bg: "bg-sky-50 dark:bg-sky-950/40", text: "text-sky-700 dark:text-sky-300" },
  { name: "Medium", count: 380, percent: "49%", color: "#e06655", bg: "bg-rose-50 dark:bg-rose-950/40", text: "text-rose-700 dark:text-rose-300" },
  { name: "Long", count: 280, percent: "35%", color: "#16a34a", bg: "bg-emerald-50 dark:bg-emerald-950/40", text: "text-emerald-700 dark:text-emerald-300" },
];

const DEFAULT_TOP_SUPPLIERS = [
  { name: "Bashundhara Paper Mills Ltd.", freq: 24, val: 1508400 },
  { name: "Bengal Polymer & Plastic Industries", freq: 19, val: 1120500 },
  { name: "Freshpack Packaging Industries Ltd", freq: 15, val: 654268.94 },
  { name: "BridgeOne Technologies Ltd", freq: 12, val: 292556.25 },
  { name: "Apex Commodities International", freq: 10, val: 270000 },
  { name: "Royal Print & Packaging Ltd", freq: 9, val: 246788.94 },
  { name: "Standard Steel & Engineering Works", freq: 8, val: 185250 },
  { name: "Kohinoor Chemicals & Solvents Ltd", freq: 7, val: 146330 },
  { name: "Meghna Industrial Supplies", freq: 5, val: 98400 },
  { name: "Square InformatiX Ltd.", freq: 4, val: 74200 },
];

const DEFAULT_TOP_ITEMS = [
  { name: "Industrial Virgin Kraft Liner", freq: 42, val: 685000 },
  { name: "HDPE Granules (Injection Grade)", freq: 36, val: 540000 },
  { name: "Baking Powder (Food Grade)", freq: 31, val: 312000 },
  { name: " Glycerin Refined USP", freq: 27, val: 265000 },
  { name: "BOPP Laminated Packaging Roll", freq: 24, val: 228400 },
  { name: "Black Pepper Whole Grade-A", freq: 19, val: 184000 },
  { name: "Bearing 6205-2RS SKF", freq: 16, val: 142500 },
  { name: "Stainless Steel Shaft Rod 25mm", freq: 14, val: 118000 },
  { name: "Industrial Safety Helmet & Gloves", freq: 11, val: 89500 },
  { name: "Caustic Soda Flakes 99%", freq: 9, val: 64200 },
];

interface PieLabelProps {
  cx?: number;
  cy?: number;
  midAngle?: number;
  innerRadius?: number;
  outerRadius?: number;
  percent?: number;
}

function renderPiePercentLabel({
  cx = 0,
  cy = 0,
  midAngle = 0,
  innerRadius = 0,
  outerRadius = 0,
  percent = 0,
}: PieLabelProps) {
  if (percent < 0.06) return null;
  const radian = Math.PI / 180;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * radian);
  const y = cy + radius * Math.sin(-midAngle * radian);

  return (
    <text
      x={x}
      y={y}
      fill="#ffffff"
      textAnchor="middle"
      dominantBaseline="central"
      className="pointer-events-none text-[11px] font-bold"
    >
      {`${(percent * 100).toFixed(1)}%`}
    </text>
  );
}

export default function PurchaseDashboardPage() {
  const [fromDate, setFromDate] = useState("2026-10-01");
  const [toDate, setToDate] = useState("2026-10-31");
  const [typeMode, setTypeMode] = useState<"freq" | "val">("freq");
  const [supplierMode, setSupplierMode] = useState<"freq" | "val">("freq");
  const [itemMode, setItemMode] = useState<"freq" | "val">("freq");
  const [periodUnit, setPeriodUnit] = useState("Month");
  const [periodYear, setPeriodYear] = useState("2026");

  const { data, refetch } = useQuery<DashboardAnalytics>({
    queryKey: ["purchaseDashboard", fromDate, toDate],
    queryFn: () => {
      const params = new URLSearchParams();
      if (fromDate) params.append("fromDate", fromDate);
      if (toDate) params.append("toDate", toDate);
      return fetchApi(`/purchase/dashboard?${params.toString()}`);
    },
  });

  const typeChartData = useMemo(
    () =>
      TYPE_WISE_DATA.map((item) => ({
        name: item.name,
        value: typeMode === "freq" ? item.freq : item.val,
        color: item.color,
      })),
    [typeMode],
  );

  const warehouseChartData = useMemo(() => {
    if (data?.warehouseWisePurchase && data.warehouseWisePurchase.length > 0) {
      const palette = ["#0088ff", "#10b981", "#f59e0b", "#ff3b5c"];
      return data.warehouseWisePurchase.map((w, idx) => ({
        name: w.warehouse,
        value: w.amount > 0 ? w.amount : 100,
        color: palette[idx % palette.length],
      }));
    }
    return DEFAULT_WAREHOUSE_DATA;
  }, [data]);

  const topSuppliers = useMemo(() => {
    if (data?.topSuppliers && data.topSuppliers.length > 0) {
      return data.topSuppliers.slice(0, 10).map((s) => ({
        name: s.supplier,
        freq: s.poCount,
        val: s.totalSpend,
      }));
    }
    return DEFAULT_TOP_SUPPLIERS;
  }, [data]);

  const pendingOrdersCount = data?.kpis?.pendingApprovals ?? 0;
  const pendingOrdersAmount = 0;
  const pendingReceiveCount = data?.kpis?.openPurchaseOrders ?? 11;
  const pendingReceiveAmount = data?.kpis?.totalOutstandingAmount ?? 0;

  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-slate-950 p-3 sm:p-5 space-y-4 text-slate-800 dark:text-slate-100">
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

          <div className="sm:col-span-2 flex items-center">
            <button
              type="button"
              onClick={() => refetch()}
              className="h-7 rounded bg-[#0d6efd] hover:bg-[#0b5ed7] px-4 text-[11px] font-semibold text-white shadow-2xs transition-colors cursor-pointer"
            >
              View
            </button>
          </div>
        </div>
      </div>

      {/* 2. Row 1: Type Wise Purchase | Warehouse Wise Purchase | Pending List */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Type Wise Purchase */}
        <div className="rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-2xs flex flex-col justify-between min-h-[270px]">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-800 dark:text-slate-100">
              Type Wise Purchase
            </h3>
            <div className="inline-flex rounded overflow-hidden border border-[#0d6efd]">
              <button
                type="button"
                onClick={() => setTypeMode("freq")}
                className={`px-2.5 py-0.5 text-[10px] font-semibold cursor-pointer transition-colors ${
                  typeMode === "freq"
                    ? "bg-[#0d6efd] text-white"
                    : "bg-white dark:bg-slate-900 text-[#0d6efd]"
                }`}
              >
                Freq.
              </button>
              <button
                type="button"
                onClick={() => setTypeMode("val")}
                className={`px-2.5 py-0.5 text-[10px] font-semibold cursor-pointer transition-colors ${
                  typeMode === "val"
                    ? "bg-[#0d6efd] text-white"
                    : "bg-white dark:bg-slate-900 text-[#0d6efd]"
                }`}
              >
                Val.
              </button>
            </div>
          </div>

          <div className="h-44 w-full my-1">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Tooltip formatter={(val) => [`${val}%`, typeMode === "freq" ? "Frequency" : "Value"]} />
                <Pie
                  data={typeChartData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={72}
                  label={renderPiePercentLabel}
                  labelLine={false}
                >
                  {typeChartData.map((entry, index) => (
                    <Cell key={`type-${index}`} fill={entry.color} stroke="#ffffff" strokeWidth={1} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[10px] text-slate-600 dark:text-slate-400">
            {TYPE_WISE_DATA.map((item) => (
              <span key={item.name} className="inline-flex items-center gap-1">
                <span className="size-2 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                <span>{item.name}</span>
              </span>
            ))}
          </div>
        </div>

        {/* Warehouse Wise Purchase */}
        <div className="rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-2xs flex flex-col justify-between min-h-[270px]">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-800 dark:text-slate-100">
              Warehouse Wise Purchase
            </h3>
          </div>

          <div className="h-44 w-full my-1">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Tooltip />
                <Pie
                  data={warehouseChartData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={72}
                  label={renderPiePercentLabel}
                  labelLine={false}
                >
                  {warehouseChartData.map((entry, index) => (
                    <Cell key={`wh-${index}`} fill={entry.color} stroke="#ffffff" strokeWidth={1} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[10px] text-slate-600 dark:text-slate-400">
            {warehouseChartData.map((item) => (
              <span key={item.name} className="inline-flex items-center gap-1">
                <span className="size-2 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                <span>{item.name}</span>
              </span>
            ))}
          </div>
        </div>

        {/* Pending List */}
        <div className="rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-2xs flex flex-col justify-between min-h-[270px]">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold text-slate-800 dark:text-slate-100">
                Pending List
              </h3>
              <button
                type="button"
                onClick={() => refetch()}
                title="Refresh"
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <RefreshCw className="size-3.5" />
              </button>
            </div>

            <ul className="space-y-3 text-[11px] text-slate-700 dark:text-slate-300 pl-3 list-disc">
              <li>
                <div className="font-semibold text-slate-800 dark:text-slate-100">Pending Order</div>
                <div className="text-[10.5px] text-slate-500 dark:text-slate-400 pl-2">
                  Total Number : <span className="font-semibold text-slate-700 dark:text-slate-200">{pendingOrdersCount}</span>
                </div>
                <div className="text-[10.5px] text-slate-500 dark:text-slate-400 pl-2">
                  Total Amount : <span className="font-semibold text-slate-700 dark:text-slate-200">{pendingOrdersAmount.toFixed(2)} BDT</span>
                </div>
              </li>
              <li>
                <div className="font-semibold text-slate-800 dark:text-slate-100">Receive MRR (Unbilled)</div>
                <div className="text-[10.5px] text-slate-500 dark:text-slate-400 pl-2">
                  Total Order : <span className="font-semibold text-slate-700 dark:text-slate-200">{pendingReceiveCount}</span>
                </div>
                <div className="text-[10.5px] text-slate-500 dark:text-slate-400 pl-2">
                  Total Amount : <span className="font-semibold text-slate-700 dark:text-slate-200">{pendingReceiveAmount.toFixed(2)}</span>
                </div>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* 3. Row 2: On-Time Payment (Rate) | Avg. Procurement Cycle time (in days) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* On-Time Payment (Rate) */}
        <div className="lg:col-span-4 rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-2xs flex flex-col justify-between min-h-[190px]">
          <div>
            <h3 className="text-xs font-bold text-slate-800 dark:text-slate-100 mb-3">
              On-Time Payment (Rate)
            </h3>
            <div className="flex items-center gap-2 my-2">
              <CheckCircle2 className="size-6 text-emerald-500 shrink-0" />
              <span className="text-xl font-extrabold text-slate-800 dark:text-slate-100">
                86.79%
              </span>
            </div>
            <ul className="space-y-1 text-[11px] text-slate-600 dark:text-slate-400 mt-3 pl-3 list-disc">
              <li>On-time payment is : <span className="font-semibold text-slate-800 dark:text-slate-200">112</span></li>
              <li>Delayed Invoice : <span className="font-semibold text-slate-800 dark:text-slate-200">17</span></li>
            </ul>
          </div>
        </div>

        {/* Avg. Procurement Cycle time (in days) */}
        <div className="lg:col-span-8 rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-2xs flex flex-col justify-between min-h-[190px]">
          <h3 className="text-xs font-bold text-slate-800 dark:text-slate-100">
            Avg. Procurement Cycle time (in days)
          </h3>

          <div className="flex items-center justify-center overflow-x-auto py-3">
            <div className="flex items-center min-w-max">
              {CYCLE_STEPS.map((step, index) => (
                <React.Fragment key={step.label}>
                  {/* Small green status node */}
                  <div className="flex flex-col items-center">
                    <div className="flex size-10 items-center justify-center rounded-full bg-slate-200/80 dark:bg-slate-800 p-1.5">
                      <div className="size-6 rounded-full bg-[#00a619]" />
                    </div>
                    <span className="mt-1 text-[10px] font-medium text-slate-600 dark:text-slate-400 max-w-[72px] text-center leading-tight">
                      {step.label}
                    </span>
                  </div>

                  {/* Connecting line + Large Day Circle */}
                  {step.daysAfter && (
                    <>
                      <div className="h-0.5 w-3 sm:w-5 bg-slate-300 dark:bg-slate-700 -mt-4" />
                      <div
                        className="flex size-24 sm:size-28 shrink-0 items-center justify-center rounded-full bg-[#e5e5e5] dark:bg-slate-800 text-slate-800 dark:text-slate-100 shadow-inner -mt-4"
                        title={`Step ${index + 1}`}
                      >
                        <span className="text-sm sm:text-base font-semibold tracking-tight">
                          {step.daysAfter}
                        </span>
                      </div>
                      <div className="h-0.5 w-3 sm:w-5 bg-slate-300 dark:bg-slate-700 -mt-4" />
                    </>
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 4. Row 3: Purchase Expenditure | Avg. Procurement Cost: Smaller Classification */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Purchase Expenditure */}
        <div className="rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-2xs flex flex-col justify-between min-h-[260px]">
          <div className="flex items-start justify-between mb-2">
            <div>
              <h3 className="text-xs font-bold text-slate-800 dark:text-slate-100">
                Purchase Expenditure
              </h3>
              <span className="text-[10px] text-slate-400">Last 12 Months</span>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative flex items-center border-b border-slate-300 dark:border-slate-700 pb-0.5">
                <select
                  value={periodUnit}
                  onChange={(e) => setPeriodUnit(e.target.value)}
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
                  <option value="2026">2026</option>
                  <option value="2025">2025</option>
                </select>
                <ChevronDown className="pointer-events-none absolute right-0 size-3 text-slate-400" />
              </div>
            </div>
          </div>

          <div className="h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={MONTHLY_EXPENDITURE_12M} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="purchaseExpFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0088ff" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#0088ff" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: "#64748b" }} />
                <YAxis tick={{ fontSize: 10, fill: "#64748b" }} />
                <Tooltip />
                <Area
                  type="monotone"
                  dataKey="expenditure"
                  stroke="#0088ff"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#purchaseExpFill)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Avg. Procurement Cost: Smaller Classification */}
        <div className="rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-2xs flex flex-col justify-between min-h-[260px]">
          <div>
            <h3 className="text-xs font-bold text-slate-800 dark:text-slate-100">
              Avg. Procurement Cost: Smaller Classification
            </h3>
            <span className="text-[10px] text-slate-400">No. of Suppliers</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-12 items-center gap-4 my-auto py-2">
            <div className="sm:col-span-6 h-44">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={SUPPLIER_CLASSIFICATION} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#64748b" }} />
                  <YAxis tick={{ fontSize: 10, fill: "#64748b" }} />
                  <Tooltip />
                  <Bar dataKey="count" barSize={28}>
                    {SUPPLIER_CLASSIFICATION.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div className="flex items-center justify-center gap-3 text-[10px] text-slate-500 mt-1">
                {SUPPLIER_CLASSIFICATION.map((item) => (
                  <span key={item.name} className="inline-flex items-center gap-1">
                    <span className="size-2 inline-block" style={{ backgroundColor: item.color }} />
                    {item.name}
                  </span>
                ))}
              </div>
            </div>

            <div className="sm:col-span-6 space-y-2.5">
              {SUPPLIER_CLASSIFICATION.map((item) => (
                <div
                  key={item.name}
                  className={`flex items-center justify-between rounded px-3 py-1.5 text-xs font-medium ${item.bg} ${item.text}`}
                >
                  <span>{item.name}</span>
                  <span className="font-bold">{item.percent}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 5. Row 4: Top 10 Suppliers | Top 10 Items */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Top 10 Suppliers */}
        <div className="rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-2xs">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-bold text-slate-800 dark:text-slate-100">
              Top 10 Suppliers
            </h3>
            <div className="inline-flex rounded overflow-hidden border border-[#0d6efd]">
              <button
                type="button"
                onClick={() => setSupplierMode("freq")}
                className={`px-2.5 py-0.5 text-[10px] font-semibold cursor-pointer transition-colors ${
                  supplierMode === "freq"
                    ? "bg-[#0d6efd] text-white"
                    : "bg-white dark:bg-slate-900 text-[#0d6efd]"
                }`}
              >
                Freq.
              </button>
              <button
                type="button"
                onClick={() => setSupplierMode("val")}
                className={`px-2.5 py-0.5 text-[10px] font-semibold cursor-pointer transition-colors ${
                  supplierMode === "val"
                    ? "bg-[#0d6efd] text-white"
                    : "bg-white dark:bg-slate-900 text-[#0d6efd]"
                }`}
              >
                Val.
              </button>
            </div>
          </div>

          <ol className="space-y-1.5 text-[11px] text-slate-700 dark:text-slate-300">
            {topSuppliers.map((supplier, idx) => (
              <li key={supplier.name} className="flex items-center justify-between gap-2">
                <span className="truncate">
                  {idx + 1}. {supplier.name}
                </span>
                <span className="font-mono text-[10.5px] font-semibold text-slate-500 dark:text-slate-400 shrink-0">
                  {supplierMode === "freq"
                    ? `${supplier.freq} Orders`
                    : `৳${supplier.val.toLocaleString("en-US")}`}
                </span>
              </li>
            ))}
          </ol>
        </div>

        {/* Top 10 Items */}
        <div className="rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-2xs">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-bold text-slate-800 dark:text-slate-100">
              Top 10 Items
            </h3>
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

          <ol className="space-y-1.5 text-[11px] text-slate-700 dark:text-slate-300">
            {DEFAULT_TOP_ITEMS.map((item, idx) => (
              <li key={item.name} className="flex items-center justify-between gap-2">
                <span className="truncate">
                  {idx + 1}. {item.name}
                </span>
                <span className="font-mono text-[10.5px] font-semibold text-slate-500 dark:text-slate-400 shrink-0">
                  {itemMode === "freq"
                    ? `${item.freq} Times`
                    : `৳${item.val.toLocaleString("en-US")}`}
                </span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}
