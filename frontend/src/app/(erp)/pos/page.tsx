"use client";

import React, { useState } from "react";
import {
  Calendar as CalendarIcon,
  ChevronDown,
  RefreshCw,
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

const EMPTY_MONTHS_12M = [
  { month: "Nov 25", sales: 0 },
  { month: "Dec 25", sales: 0 },
  { month: "Jan 26", sales: 0 },
  { month: "Feb 26", sales: 0 },
  { month: "Mar 26", sales: 0 },
  { month: "Apr 26", sales: 0 },
  { month: "May 26", sales: 0 },
  { month: "Jun 26", sales: 0 },
  { month: "Jul 26", sales: 0 },
  { month: "Aug 26", sales: 0 },
  { month: "Sep 26", sales: 0 },
  { month: "Oct 26", sales: 0 },
];

export default function PosDashboardPage() {
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [counterMode, setCounterMode] = useState<"freq" | "val">("freq");
  const [paymentMode, setPaymentMode] = useState<"freq" | "val">("freq");
  const [itemMode, setItemMode] = useState<"freq" | "val">("freq");
  const [customerMode, setCustomerMode] = useState<"freq" | "val">("freq");
  const [periodUnit, setPeriodUnit] = useState("Month");
  const [periodYear, setPeriodYear] = useState("2026");

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
              className="h-7 rounded bg-[#0d6efd] hover:bg-[#0b5ed7] px-4 text-[11px] font-semibold text-white shadow-2xs transition-colors cursor-pointer"
            >
              View
            </button>
          </div>
        </div>
      </div>

      {/* 2. Row 1: Counter Wise Sales | Payment Method Wise Sales | Daily Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Counter Wise Sales */}
        <div className="rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-2xs flex flex-col justify-between min-h-[250px]">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-800 dark:text-slate-100">
              Counter Wise Sales
            </h3>
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

          <div className="h-44 w-full my-1 flex items-center justify-center">
            <span className="text-xs text-slate-400">No data available</span>
          </div>
        </div>

        {/* Payment Method Wise Sales */}
        <div className="rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-2xs flex flex-col justify-between min-h-[250px]">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-800 dark:text-slate-100">
              Payment Method Wise Sales
            </h3>
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

          <div className="h-44 w-full my-1 flex items-center justify-center">
            <span className="text-xs text-slate-400">No data available</span>
          </div>
        </div>

        {/* POS Summary List */}
        <div className="rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-2xs flex flex-col justify-between min-h-[250px]">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold text-slate-800 dark:text-slate-100">
                POS Collection Summary
              </h3>
              <button
                type="button"
                title="Refresh"
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <RefreshCw className="size-3.5" />
              </button>
            </div>

            <ul className="space-y-3 text-[11px] text-slate-700 dark:text-slate-300 pl-3 list-disc">
              <li>
                <div className="font-semibold text-slate-800 dark:text-slate-100">
                  Total POS Invoices
                </div>
                <div className="text-[10.5px] text-slate-500 dark:text-slate-400 pl-2">
                  Total Number :{" "}
                  <span className="font-semibold text-slate-700 dark:text-slate-200">
                    0
                  </span>
                </div>
                <div className="text-[10.5px] text-slate-500 dark:text-slate-400 pl-2">
                  Total Amount :{" "}
                  <span className="font-semibold text-slate-700 dark:text-slate-200">
                    0.00 BDT
                  </span>
                </div>
              </li>
              <li>
                <div className="font-semibold text-slate-800 dark:text-slate-100">
                  VAT & Discount Summary
                </div>
                <div className="text-[10.5px] text-slate-500 dark:text-slate-400 pl-2">
                  Total VAT :{" "}
                  <span className="font-semibold text-slate-700 dark:text-slate-200">
                    0.00 BDT
                  </span>
                </div>
                <div className="text-[10.5px] text-slate-500 dark:text-slate-400 pl-2">
                  Total Discount :{" "}
                  <span className="font-semibold text-slate-700 dark:text-slate-200">
                    0.00 BDT
                  </span>
                </div>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* 3. Row 2: POS Sales Trend (Last 12 Months) */}
      <div className="rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-2xs flex flex-col justify-between min-h-[260px]">
        <div className="flex items-start justify-between mb-2">
          <div>
            <h3 className="text-xs font-bold text-slate-800 dark:text-slate-100">
              POS Sales Revenue
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
            <AreaChart
              data={EMPTY_MONTHS_12M}
              margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
            >
              <defs>
                <linearGradient id="posSalesFill" x1="0" y1="0" x2="0" y2="1">
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
                dataKey="sales"
                stroke="#0088ff"
                strokeWidth={2}
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
        <div className="rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-2xs min-h-[120px]">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-bold text-slate-800 dark:text-slate-100">
              Top 10 Selling Items
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

          <p className="text-xs text-slate-400 py-4 text-center">
            No data available
          </p>
        </div>

        {/* Top 10 Customers */}
        <div className="rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-2xs min-h-[120px]">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-bold text-slate-800 dark:text-slate-100">
              Top 10 POS Customers
            </h3>
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

          <p className="text-xs text-slate-400 py-4 text-center">
            No data available
          </p>
        </div>
      </div>
    </div>
  );
}

