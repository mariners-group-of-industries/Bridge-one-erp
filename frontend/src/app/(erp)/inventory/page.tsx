"use client";

import React, { useState } from "react";
import {
  Calendar as CalendarIcon,
  Wallet,
  Package,
  PackageOpen,
  ChevronDown,
  TrendingUp,
  BarChart3,
  Layers,
  ArrowRight,
  ArrowUpRight,
} from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import { useInventoryStore } from "@/features/inventory/store/inventory-store";
import type {
  ValuationCategory,
  MovingFrequencyItem,
  TransactionValueItem,
  TurnoverRatioItem,
} from "@/features/inventory/types";

export default function InventoryDashboardPage() {
  const {
    kpis,
    valuationData,
    topTransactions,
    movingFrequencies,
    turnoverRatios,
  } = useInventoryStore();

  const [fromDate, setFromDate] = useState("10/01/2026");
  const [toDate, setToDate] = useState("10/13/2026");
  const [warehouse1, setWarehouse1] = useState("");
  const [warehouse2, setWarehouse2] = useState("");
  const [itemCategory, setItemCategory] = useState("Item Category");
  const [showCoverageSample, setShowCoverageSample] = useState(false);

  // Daily coverage sample data if user toggles view
  const sampleCoverageData = [
    { day: "Oct 01", days: 38 },
    { day: "Oct 03", days: 42 },
    { day: "Oct 05", days: 35 },
    { day: "Oct 07", days: 40 },
    { day: "Oct 09", days: 44 },
    { day: "Oct 11", days: 39 },
    { day: "Oct 13", days: 41 },
  ];

  // Custom label renderer to match screenshot's on-slice percentage labels
  const renderValuationLabel = ({
    cx,
    cy,
    midAngle,
    innerRadius,
    outerRadius,
    percent,
  }: any) => {
    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    // If slice is very small (like Asset 0.1%), skip on-slice text to prevent crowding
    if (percent < 0.05) return null;

    return (
      <text
        x={x}
        y={y}
        fill="#ffffff"
        textAnchor="middle"
        dominantBaseline="central"
        className="font-bold text-[13px] tracking-tight pointer-events-none drop-shadow-xs"
      >
        {`${(percent * 100).toFixed(1)}%`}
      </text>
    );
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-slate-950 p-4 sm:p-6 space-y-5 text-slate-800 dark:text-slate-100">
      {/* ------------------------------------------------------------- */}
      {/* 1. DATE FILTER ROW */}
      {/* ------------------------------------------------------------- */}
      <div className="flex flex-wrap items-end gap-3 sm:gap-4">
        {/* From Date */}
        <div className="flex flex-col gap-1">
          <label className="text-[12px] font-medium text-slate-500 dark:text-slate-400">
            From Date
          </label>
          <div className="relative flex items-center">
            <input
              type="text"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="h-8 w-36 sm:w-44 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 pr-8 text-xs text-slate-700 dark:text-slate-200 shadow-2xs focus:border-blue-500 focus:outline-none"
            />
            <CalendarIcon className="pointer-events-none absolute right-2.5 size-3.5 text-slate-400" />
          </div>
        </div>

        {/* To Date */}
        <div className="flex flex-col gap-1">
          <label className="text-[12px] font-medium text-slate-500 dark:text-slate-400">
            To Date
          </label>
          <div className="relative flex items-center">
            <input
              type="text"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="h-8 w-36 sm:w-44 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 pr-8 text-xs text-slate-700 dark:text-slate-200 shadow-2xs focus:border-blue-500 focus:outline-none"
            />
            <CalendarIcon className="pointer-events-none absolute right-2.5 size-3.5 text-slate-400" />
          </div>
        </div>

        {/* View Button */}
        <div>
          <button
            type="button"
            className="h-8 rounded bg-[#1877f2] hover:bg-[#166fe5] px-5 text-xs font-semibold text-white shadow-2xs transition-colors flex items-center justify-center cursor-pointer active:scale-98"
          >
            View
          </button>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 2. TOP KPI CARDS (4 Cards) */}
      {/* ------------------------------------------------------------- */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Balance */}
        <div className="flex items-center gap-4 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 shadow-2xs">
          <div className="flex size-13 shrink-0 items-center justify-center rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-500">
            <Wallet className="size-6 stroke-[1.8]" />
          </div>
          <div className="flex flex-col">
            <span className="text-xl sm:text-2xl font-bold tracking-tight text-slate-800 dark:text-slate-100">
              ৳{kpis.totalBalance.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span className="text-xs font-medium text-slate-400 dark:text-slate-400">
              Total Balance
            </span>
          </div>
        </div>

        {/* Opening Balance */}
        <div className="flex items-center gap-4 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 shadow-2xs">
          <div className="flex size-13 shrink-0 items-center justify-center rounded-full bg-purple-50 dark:bg-purple-950/60 text-[#a855f7]">
            <Wallet className="size-6 stroke-[1.8]" />
          </div>
          <div className="flex flex-col">
            <span className="text-xl sm:text-2xl font-bold tracking-tight text-slate-800 dark:text-slate-100">
              ৳{kpis.openingBalance.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span className="text-xs font-medium text-slate-400 dark:text-slate-400">
              Opening Balance
            </span>
          </div>
        </div>

        {/* Inventory OUT */}
        <div className="flex items-center gap-4 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 shadow-2xs">
          <div className="flex size-13 shrink-0 items-center justify-center rounded-full bg-orange-50 dark:bg-orange-950/60 text-[#f97316]">
            <Package className="size-6 stroke-[1.8]" />
          </div>
          <div className="flex flex-col">
            <span className="text-xl sm:text-2xl font-bold tracking-tight text-slate-800 dark:text-slate-100">
              ৳{kpis.inventoryOut.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span className="text-xs font-medium text-slate-400 dark:text-slate-400">
              Inventory OUT
            </span>
          </div>
        </div>

        {/* Inventory In */}
        <div className="flex items-center gap-4 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 shadow-2xs">
          <div className="flex size-13 shrink-0 items-center justify-center rounded-full bg-amber-50 dark:bg-amber-950/60 text-[#eab308]">
            <PackageOpen className="size-6 stroke-[1.8]" />
          </div>
          <div className="flex flex-col">
            <span className="text-xl sm:text-2xl font-bold tracking-tight text-slate-800 dark:text-slate-100">
              ৳{kpis.inventoryIn.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span className="text-xs font-medium text-slate-400 dark:text-slate-400">
              Inventory In
            </span>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 3. MIDDLE SECTION (Valuation & Coverage Days) */}
      {/* ------------------------------------------------------------- */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Valuation Donut Card (5 cols) */}
        <div className="lg:col-span-5 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-2xs flex flex-col justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">
              Valuation
            </h2>
            {/* Filter Dropdowns below header */}
            <div className="flex items-center gap-6 mt-3">
              <div className="relative flex items-center border-b border-slate-200 dark:border-slate-700 pb-1">
                <select
                  value={warehouse1}
                  onChange={(e) => setWarehouse1(e.target.value)}
                  className="appearance-none bg-transparent pr-5 text-xs text-slate-400 dark:text-slate-400 focus:outline-none cursor-pointer"
                >
                  <option value="">Select...</option>
                  <option value="Central Store">Central Store</option>
                  <option value="Raw Material Store">Raw Material Store</option>
                  <option value="Finished Goods Store">Finished Goods Store</option>
                </select>
                <ChevronDown className="pointer-events-none absolute right-0 size-3 text-slate-400" />
              </div>

              <div className="relative flex items-center border-b border-slate-200 dark:border-slate-700 pb-1">
                <select
                  value={warehouse2}
                  onChange={(e) => setWarehouse2(e.target.value)}
                  className="appearance-none bg-transparent pr-5 text-xs text-slate-400 dark:text-slate-400 focus:outline-none cursor-pointer"
                >
                  <option value="">Select...</option>
                  <option value="FIFO">FIFO Valuation</option>
                  <option value="Weighted Avg">Weighted Avg</option>
                  <option value="Standard">Standard Cost</option>
                </select>
                <ChevronDown className="pointer-events-none absolute right-0 size-3 text-slate-400" />
              </div>
            </div>
          </div>

          {/* Donut Chart */}
          <div className="h-64 sm:h-72 w-full my-3 flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Tooltip
                  formatter={(val: any) => [`${val}%`, "Share"]}
                  contentStyle={{
                    backgroundColor: "#ffffff",
                    borderColor: "#e2e8f0",
                    borderRadius: "8px",
                    fontSize: "12px",
                    boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                  }}
                />
                <Pie
                  data={valuationData}
                  cx="50%"
                  cy="50%"
                  innerRadius={65}
                  outerRadius={105}
                  paddingAngle={1}
                  dataKey="value"
                  label={renderValuationLabel}
                  labelLine={false}
                >
                  {valuationData.map((entry: ValuationCategory, index: number) => (
                    <Cell key={`cell-${index}`} fill={entry.color} stroke="#ffffff" strokeWidth={1.5} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Legend Matching Screenshot */}
          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-300">
            <div className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-full bg-[#b939e5]" />
              <span className="font-medium text-[11px] sm:text-xs">MRO</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-full bg-[#facc15]" />
              <span className="font-medium text-[11px] sm:text-xs">Asset</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-full bg-[#38effe]" />
              <span className="font-medium text-[11px] sm:text-xs">Raw</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-full bg-[#3b82f6]" />
              <span className="font-medium text-[11px] sm:text-xs">Finished Goods</span>
            </div>
          </div>
        </div>

        {/* Coverage Days Card (7 cols) */}
        <div className="lg:col-span-7 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-2xs flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">
                Coverage Days
              </h2>
              <span className="text-[11px] text-slate-400 dark:text-slate-400">
                Daily
              </span>
            </div>

            {/* Item Category Dropdown */}
            <div className="relative flex items-center border border-slate-200 dark:border-slate-700 rounded px-2.5 py-1 bg-white dark:bg-slate-900">
              <select
                value={itemCategory}
                onChange={(e) => setItemCategory(e.target.value)}
                className="appearance-none bg-transparent pr-5 text-xs text-slate-500 dark:text-slate-300 focus:outline-none cursor-pointer"
              >
                <option value="Item Category">Item Category</option>
                <option value="Raw Materials">Raw Materials</option>
                <option value="Yarn & Fabric">Yarn & Fabric</option>
                <option value="Dyes & Chemicals">Dyes & Chemicals</option>
                <option value="Packaging">Packaging</option>
                <option value="MRO & Spares">MRO & Spares</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-2 size-3 text-slate-400" />
            </div>
          </div>

          {/* Body Content */}
          <div className="min-h-64 sm:min-h-72 flex flex-col items-center justify-center p-6">
            {!showCoverageSample ? (
              <div className="text-center space-y-2">
                <p className="text-xl sm:text-2xl font-bold tracking-tight text-slate-700 dark:text-slate-300">
                  No Data Found !
                </p>
                <button
                  type="button"
                  onClick={() => setShowCoverageSample(true)}
                  className="text-[11px] text-blue-500 hover:text-blue-600 underline cursor-pointer mt-1"
                >
                  Preview daily coverage chart
                </button>
              </div>
            ) : (
              <div className="w-full h-64">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-slate-500">Days of Inventory Outstanding</span>
                  <button
                    type="button"
                    onClick={() => setShowCoverageSample(false)}
                    className="text-[11px] text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    Reset to Empty View
                  </button>
                </div>
                <ResponsiveContainer width="100%" height="90%">
                  <BarChart data={sampleCoverageData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="day" tick={{ fontSize: 11, fill: "#64748b" }} />
                    <YAxis tick={{ fontSize: 11, fill: "#64748b" }} />
                    <Tooltip
                      formatter={(val: any) => [`${val} Days`, "Coverage"]}
                      contentStyle={{ backgroundColor: "#ffffff", borderColor: "#cbd5e1", borderRadius: "6px" }}
                    />
                    <Bar dataKey="days" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Empty spacer / status bar */}
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-400">
            Stock coverage calculation based on average daily consumption rate.
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 4. BOTTOM SECTION (3 Cards) */}
      {/* ------------------------------------------------------------- */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Card 1: Item Moving Frequency */}
        <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="mb-3">
              <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">
                Item Moving Frequency
              </h2>
              <span className="text-[11px] text-slate-400 dark:text-slate-400">
                Top 05
              </span>
            </div>

            <div className="space-y-3 mt-4">
              {movingFrequencies.map((item: MovingFrequencyItem) => (
                <div key={item.id} className="flex flex-col gap-1 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-slate-700 dark:text-slate-200">
                      {item.rank}. {item.name}
                    </span>
                    <span className="text-slate-500 font-semibold tabular-nums">
                      {item.frequency.toLocaleString()} {item.unit}
                    </span>
                  </div>
                  {/* Frequency Progress Bar */}
                  <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 rounded-full"
                      style={{ width: `${Math.min(100, (item.frequency / 1500) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-3 mt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
            <span>Fast-moving materials ranking</span>
            <span className="text-blue-500 font-medium">Monthly Audit</span>
          </div>
        </div>

        {/* Card 2: Transaction Value (Matching Screenshot numbers) */}
        <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="mb-3">
              <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">
                Transaction Value
              </h2>
              <span className="text-[11px] text-slate-400 dark:text-slate-400">
                Top 05
              </span>
            </div>

            <div className="space-y-3.5 mt-4 text-[12px] sm:text-[13px]">
              {topTransactions.map((tx: TransactionValueItem) => (
                <div key={tx.id} className="flex items-center justify-between">
                  <span className="text-slate-700 dark:text-slate-200">
                    {tx.rank}. {tx.name}
                  </span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
                    ৳{tx.amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-3 mt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
            <span>Aggregated transaction throughput</span>
            <span className="text-emerald-500 font-medium">Reconciled</span>
          </div>
        </div>

        {/* Card 3: Inventory Turn Over Ratio */}
        <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="mb-3">
              <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">
                Inventory Turn Over Ratio
              </h2>
              <span className="text-[11px] text-slate-400 dark:text-slate-400">
                Performance Benchmark
              </span>
            </div>

            {/* Ratio Hero Metric */}
            <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between mt-3">
              <div>
                <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 block">
                  Overall Annualized Turnover
                </span>
                <span className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                  8.4x
                </span>
              </div>
              <div className="text-right">
                <span className="text-[10px] uppercase font-semibold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-200/60">
                  Healthy Velocity
                </span>
                <span className="text-[11px] text-slate-400 block mt-1">
                  Avg Velocity: 43.5 Days
                </span>
              </div>
            </div>

            {/* Category Turnover Breakdown */}
            <div className="space-y-2 mt-3.5 text-xs">
              {turnoverRatios.map((item: TurnoverRatioItem) => (
                <div key={item.category} className="flex items-center justify-between text-slate-600 dark:text-slate-300">
                  <span>{item.category}</span>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{item.ratio}x</span>
                    <span className="text-[11px] text-slate-400">({item.coverageDays}d)</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-3 mt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
            <span>Formula: COGS / Average Stock Value</span>
            <span className="text-blue-500 font-medium">Standard</span>
          </div>
        </div>
      </div>
    </div>
  );
}
