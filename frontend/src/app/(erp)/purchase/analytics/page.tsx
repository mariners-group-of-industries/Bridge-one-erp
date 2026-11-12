"use client";

import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowDownRight, ArrowUpRight, Clock, DollarSign, Download, Filter, Layers, Package, Percent, Printer, RotateCcw, ShieldCheck } from "lucide-react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Spinner } from "@/components/ui/spinner";
import { fetchApi } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import { downloadCsv, localDate, localToday } from "@/features/purchase/lib/client";
import { usePurchasePermissions } from "@/features/purchase/lib/usePurchasePermissions";
import type { DashboardAnalytics, Office } from "@bridgeone/contracts";

const COLORS = ["#0284c7", "#0ea5e9", "#38bdf8", "#0369a1", "#075985", "#3b82f6", "#6366f1"];

const TOOLTIP_STYLE = {
  itemStyle: { color: "#ffffff", fontWeight: 600 },
  labelStyle: { color: "#94a3b8", fontWeight: 700 },
  contentStyle: { backgroundColor: "#0f172a", borderColor: "#334155", borderRadius: "6px", color: "#ffffff", fontSize: "12px" },
};

const kFormat = (v: number) => (Math.abs(v) >= 1000 ? `${Math.round(v / 1000)}k` : String(v));
const pct = (v: number | null | undefined) => (v === null || v === undefined ? "—" : `${v.toFixed(1)}%`);
const daysText = (v: number | null | undefined) => (v === null || v === undefined ? "—" : `${v} Days`);

const STATUS_LABEL: Record<string, string> = {
  APPROVED: "Open",
  PENDING_APPROVAL: "Pending Approval",
  PARTIALLY_RECEIVED: "Partly Received",
  COMPLETED: "Received",
  CLOSED: "Closed",
};
const PAYMENT_LABEL: Record<string, string> = { PAID: "Paid", PARTIALLY_PAID: "Part Paid", UNPAID: "Unpaid", NOT_RECEIVED: "Not Received" };

function quickRanges() {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const threeMonths = new Date(now.getFullYear(), now.getMonth() - 2, 1);
  const yearStart = new Date(now.getFullYear(), 0, 1);
  const today = localToday();
  return [
    { label: "This Month", from: localDate(monthStart), to: today },
    { label: "Last 3 Months", from: localDate(threeMonths), to: today },
    { label: "This Year", from: localDate(yearStart), to: today },
  ];
}

function KpiCard({ label, value, sub, icon, tone = "text-slate-900" }: { label: string; value: string; sub: React.ReactNode; icon: React.ReactNode; tone?: string }) {
  return (
    <div className="bg-white p-3 rounded border border-slate-200 shadow-2xs min-w-0">
      <div className="flex items-center justify-between gap-2 text-slate-500 text-[11px]">
        <span className="truncate">{label}</span>
        <div className="p-1.5 bg-slate-50 text-slate-600 rounded shrink-0">{icon}</div>
      </div>
      <div className={`text-base font-bold mt-1 font-mono truncate ${tone}`}>{value}</div>
      <div className="text-[10px] text-slate-500 mt-1">{sub}</div>
    </div>
  );
}

export default function PurchaseAnalyticsPage() {
  const perms = usePurchasePermissions();
  const ranges = useMemo(() => quickRanges(), []);
  const [fromDate, setFromDate] = useState(ranges[2].from);
  const [toDate, setToDate] = useState(ranges[2].to);
  const [selectedOffice, setSelectedOffice] = useState("ALL");
  const [selectedCategory, setSelectedCategory] = useState("ALL");

  const { data: offices } = useQuery<Office[]>({ queryKey: ["offices"], queryFn: () => fetchApi("/master/offices") });

  const { data, isFetching, refetch } = useQuery<DashboardAnalytics>({
    queryKey: ["purchaseAnalytics", fromDate, toDate, selectedOffice],
    queryFn: () => {
      const p = new URLSearchParams();
      if (fromDate) p.append("fromDate", fromDate);
      if (toDate) p.append("toDate", toDate);
      if (selectedOffice !== "ALL") p.append("officeId", selectedOffice);
      return fetchApi(`/purchase/analytics?${p.toString()}`);
    },
  });

  const insights = data?.insights;
  const totalSpend = data?.kpis.totalSpendAmount ?? 0;
  const activeOrders = (data?.kpis.openPurchaseOrders ?? 0) + (data?.kpis.partiallyReceivedOrders ?? 0);
  const previous = insights?.previousPeriodSpend ?? null;
  const change = previous !== null && previous > 0 ? ((totalSpend - previous) / previous) * 100 : null;

  const categoryData = useMemo(() => {
    const raw = data?.typeWisePurchase ?? [];
    const total = raw.reduce((s, r) => s + r.amount, 0);
    return [...raw]
      .sort((a, b) => b.amount - a.amount)
      .map((r) => ({ name: r.name, value: r.amount, percent: total > 0 ? `${Math.round((r.amount / total) * 100)}%` : "0%" }));
  }, [data]);

  const register = useMemo(
    () => (insights?.register ?? []).filter((r) => selectedCategory === "ALL" || r.category === selectedCategory),
    [insights, selectedCategory],
  );

  const stages = [
    { label: "Requisition → Approval", value: daysText(insights?.cycle.approvalDays), note: insights?.approvalTurnaroundHours != null ? `${insights.approvalTurnaroundHours} hours on average` : "No approvals in the period" },
    { label: "Approval → Purchase Order", value: daysText(insights?.cycle.orderDays), note: "Orders raised from requisitions" },
    { label: "Order → Goods Received", value: daysText(insights?.cycle.deliveryDays), note: "To the first goods receipt" },
    { label: "Received → Paid", value: daysText(insights?.cycle.paymentDays), note: "To the first supplier payment" },
  ];
  const measuredDays = [insights?.cycle.approvalDays, insights?.cycle.orderDays, insights?.cycle.deliveryDays, insights?.cycle.paymentDays].filter(
    (v): v is number => typeof v === "number",
  );
  const totalCycle = measuredDays.length ? Math.round(measuredDays.reduce((a, b) => a + b, 0) * 10) / 10 : null;

  const handleExport = () => {
    downloadCsv(
      `purchase_analytics_${fromDate || "all"}_${toDate || "all"}.csv`,
      ["SL", "PO Number", "Order Date", "Supplier", "Office", "Warehouse", "Category", "Amount (BDT)", "Status", "Received %", "Payment"],
      register.map((r, i) => [i + 1, r.poNumber, r.orderDate, r.supplierName, r.officeName, r.warehouseName, r.category, r.amount, STATUS_LABEL[r.status] ?? r.status, r.receivedPercent, PAYMENT_LABEL[r.paymentStatus]]),
    );
  };

  const resetFilters = () => {
    setFromDate(ranges[2].from);
    setToDate(ranges[2].to);
    setSelectedOffice("ALL");
    setSelectedCategory("ALL");
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 rounded border border-slate-200/90 shadow-2xs">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Purchase Analytics</h1>
          <p className="text-[11px] text-slate-500">
            {fromDate || "Start"} to {toDate || "today"} · {selectedOffice === "ALL" ? "All offices" : offices?.find((o) => o.id === selectedOffice)?.name}
          </p>
        </div>
        <div className="flex items-center gap-2 print:hidden">
          {perms.analytics.export && (
            <button
              type="button"
              onClick={handleExport}
              disabled={!register.length}
              className="h-9 px-3.5 bg-[#2563eb] hover:bg-blue-700 disabled:opacity-50 text-white font-semibold text-xs rounded flex items-center gap-1.5 shadow-xs transition"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Excel</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => window.print()}
            className="h-9 px-3.5 border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold text-xs rounded flex items-center gap-1.5 shadow-xs transition"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print</span>
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-3 rounded border border-slate-200 shadow-2xs space-y-2.5 print:hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
            <Filter className="w-3.5 h-3.5 text-blue-600" />
            <span>Filters</span>
          </div>
          <div className="flex flex-wrap items-center gap-1 text-[11px]">
            <span className="text-slate-400">Quick range:</span>
            {ranges.map((r) => (
              <button
                key={r.label}
                type="button"
                onClick={() => {
                  setFromDate(r.from);
                  setToDate(r.to);
                }}
                className={`min-h-6 px-2 py-0.5 rounded font-medium transition ${fromDate === r.from && toDate === r.to ? "bg-blue-600 text-white" : "bg-slate-100 hover:bg-slate-200 text-slate-700"}`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs">
          <label className="block">
            <span className="block text-[11px] text-slate-500 mb-1">From Date</span>
            <input type="date" value={fromDate} max={toDate || undefined} onChange={(e) => setFromDate(e.target.value)} className="w-full border border-slate-300 rounded px-2 py-1.5 bg-white text-xs" />
          </label>
          <label className="block">
            <span className="block text-[11px] text-slate-500 mb-1">To Date</span>
            <input type="date" value={toDate} min={fromDate || undefined} onChange={(e) => setToDate(e.target.value)} className="w-full border border-slate-300 rounded px-2 py-1.5 bg-white text-xs" />
          </label>
          <label className="block">
            <span className="block text-[11px] text-slate-500 mb-1">Office</span>
            <select value={selectedOffice} onChange={(e) => setSelectedOffice(e.target.value)} className="w-full border border-slate-300 rounded px-2 py-1.5 bg-white text-xs font-medium text-slate-800">
              <option value="ALL">All Offices</option>
              {offices?.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="block text-[11px] text-slate-500 mb-1">Category (order register)</span>
            <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)} className="w-full border border-slate-300 rounded px-2 py-1.5 bg-white text-xs font-medium text-slate-800">
              <option value="ALL">All Categories</option>
              {(insights?.categories ?? []).map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <div className="flex items-end gap-2">
            <button
              type="button"
              onClick={() => refetch()}
              disabled={isFetching}
              className="flex-1 h-8 bg-[#1976d2] hover:bg-[#1565c0] disabled:opacity-70 text-white font-bold rounded text-xs transition shadow-2xs flex items-center justify-center gap-1.5"
            >
              {isFetching && <Spinner className="size-3.5" />}
              Refresh
            </button>
            <button type="button" onClick={resetFilters} className="h-8 px-3 border border-slate-300 hover:bg-slate-50 text-slate-600 font-bold rounded text-xs transition inline-flex items-center gap-1">
              <RotateCcw className="w-3 h-3" /> Reset
            </button>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
        <KpiCard
          label="Total Spend"
          value={formatCurrency(totalSpend)}
          icon={<DollarSign className="w-3.5 h-3.5" />}
          sub={
            change === null ? (
              <span>{previous === null ? "Pick a date range to compare" : "No spend in the previous period"}</span>
            ) : (
              <span className={`inline-flex items-center gap-0.5 font-semibold ${change >= 0 ? "text-rose-600" : "text-emerald-600"}`}>
                {change >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                {change >= 0 ? "+" : ""}
                {change.toFixed(1)}% vs previous period
              </span>
            )
          }
        />
        <KpiCard
          label="Open Orders"
          value={`${activeOrders} Orders`}
          icon={<Package className="w-3.5 h-3.5" />}
          sub={insights ? `${insights.pendingReceipt.overdueOrders} past expected delivery` : "—"}
        />
        <KpiCard
          label="Goods To Arrive"
          value={formatCurrency(insights?.pendingReceipt.amount ?? 0)}
          icon={<Layers className="w-3.5 h-3.5" />}
          sub="Outstanding quantity × order price"
        />
        <KpiCard
          label="QC Acceptance"
          value={pct(insights?.qc.acceptanceRate)}
          icon={<ShieldCheck className="w-3.5 h-3.5" />}
          sub={insights ? `${insights.qc.rejectedQty.toLocaleString("en-US")} units rejected at receipt` : "—"}
        />
        <KpiCard
          label="Return Rate"
          value={pct(insights?.qc.returnRate)}
          icon={<Percent className="w-3.5 h-3.5" />}
          sub={insights ? `${formatCurrency(insights.qc.returnedAmount)} returned to suppliers` : "—"}
        />
        <KpiCard
          label="Supplier Dues"
          value={formatCurrency(data?.kpis.totalOutstandingAmount ?? 0)}
          tone="text-rose-700"
          icon={<Clock className="w-3.5 h-3.5" />}
          sub={insights ? `${insights.payments.overdue} invoices overdue · on time ${pct(insights.payments.onTimeRate)}` : "—"}
        />
      </div>

      {/* Charts row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white p-4 rounded border border-slate-200 shadow-2xs min-w-0">
          <div className="mb-3 border-b border-slate-100 pb-2">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide">Monthly Purchase Spend</h3>
            <p className="text-[11px] text-slate-400">Purchase order value per month (BDT), cancelled orders excluded</p>
          </div>
          <div className="h-64">
            {(data?.monthlyExpenditure ?? []).length ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data?.monthlyExpenditure}>
                  <defs>
                    <linearGradient id="spendGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#1976d2" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#1976d2" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#64748b" }} />
                  <YAxis tick={{ fontSize: 11, fill: "#64748b" }} tickFormatter={kFormat} />
                  <Tooltip formatter={(v) => [formatCurrency(Number(v) || 0), "Spend"]} {...TOOLTIP_STYLE} />
                  <Area type="monotone" dataKey="expenditure" stroke="#1976d2" fill="url(#spendGradient)" strokeWidth={2.5} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <p className="h-full flex items-center justify-center text-xs text-slate-400">No purchase orders in this period.</p>
            )}
          </div>
        </div>

        <div className="bg-white p-4 rounded border border-slate-200 shadow-2xs flex flex-col min-w-0">
          <div className="mb-3 border-b border-slate-100 pb-2">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide">Spend by Category</h3>
            <p className="text-[11px] text-slate-400">Item category of the order lines</p>
          </div>
          <div className="h-44 flex-1">
            {categoryData.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={categoryData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={46} outerRadius={72} paddingAngle={3}>
                    {categoryData.map((c, index) => (
                      <Cell key={c.name} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => [formatCurrency(Number(v) || 0), "Spend"]} {...TOOLTIP_STYLE} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="h-full flex items-center justify-center text-xs text-slate-400">No data</p>
            )}
          </div>
          <div className="mt-2 space-y-1 text-[11px] border-t border-slate-100 pt-2">
            {categoryData.slice(0, 5).map((c, i) => (
              <div key={c.name} className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                  <span className="text-slate-700 truncate">{c.name}</span>
                </div>
                <span className="font-mono font-semibold text-slate-900">{c.percent}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Charts row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white p-4 rounded border border-slate-200 shadow-2xs min-w-0">
          <div className="mb-3 border-b border-slate-100 pb-2">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide">Top Suppliers by Spend</h3>
            <p className="text-[11px] text-slate-400">Purchase order value per supplier (BDT)</p>
          </div>
          <div className="h-64">
            {(data?.topSuppliers ?? []).length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data?.topSuppliers} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                  <XAxis type="number" tick={{ fontSize: 10, fill: "#64748b" }} tickFormatter={kFormat} />
                  <YAxis dataKey="supplier" type="category" width={130} tick={{ fontSize: 10, fill: "#334155" }} />
                  <Tooltip formatter={(v) => [formatCurrency(Number(v) || 0), "Spend"]} {...TOOLTIP_STYLE} />
                  <Bar dataKey="totalSpend" fill="#0284c7" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="h-full flex items-center justify-center text-xs text-slate-400">No data</p>
            )}
          </div>
        </div>

        <div className="bg-white p-4 rounded border border-slate-200 shadow-2xs min-w-0">
          <div className="mb-3 border-b border-slate-100 pb-2">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide">Spend by Receiving Warehouse</h3>
            <p className="text-[11px] text-slate-400">Purchase order value per warehouse (BDT)</p>
          </div>
          <div className="h-64">
            {(data?.warehouseWisePurchase ?? []).length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data?.warehouseWisePurchase}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="warehouse" tick={{ fontSize: 10, fill: "#64748b" }} />
                  <YAxis tick={{ fontSize: 10, fill: "#64748b" }} tickFormatter={kFormat} />
                  <Tooltip formatter={(v) => [formatCurrency(Number(v) || 0), "Spend"]} {...TOOLTIP_STYLE} />
                  <Bar dataKey="amount" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="h-full flex items-center justify-center text-xs text-slate-400">No data</p>
            )}
          </div>
        </div>
      </div>

      {/* Cycle stages */}
      <div className="bg-white p-4 rounded border border-slate-200 shadow-2xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
          <div>
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide">Purchase Cycle Time</h3>
            <p className="text-[11px] text-slate-400">Average days per stage, measured from the documents of the period</p>
          </div>
          <span className="text-[11px] font-bold text-sky-800 bg-sky-50 px-2 py-0.5 rounded border border-sky-200">
            Measured stages total: {daysText(totalCycle)}
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          {stages.map((s) => (
            <div key={s.label} className="p-3 bg-slate-50 rounded border border-slate-200">
              <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">{s.label}</div>
              <div className="text-sm font-bold text-slate-800 mt-1 font-mono">{s.value}</div>
              <p className="text-[11px] text-slate-500 mt-0.5">{s.note}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Order register */}
      <div className="space-y-2">
        <div>
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide">Largest Purchase Orders ({register.length})</h3>
          <p className="text-[11px] text-slate-400">The period&apos;s 50 largest orders, with delivery and payment progress</p>
        </div>
        <div className="border border-slate-300 bg-white rounded shadow-2xs overflow-x-auto">
          <table className="erp-table w-full text-left text-xs">
            <thead>
              <tr>
                <th className="w-12 text-center">SL</th>
                <th>PO Number</th>
                <th>Order Date</th>
                <th>Supplier</th>
                <th>Office / Warehouse</th>
                <th>Category</th>
                <th className="text-right">Amount (BDT)</th>
                <th className="text-center">Status</th>
                <th className="text-right">Received</th>
                <th className="text-center">Payment</th>
              </tr>
            </thead>
            <tbody>
              {register.length === 0 ? (
                <tr>
                  <td colSpan={10} className="text-center py-10 text-slate-400">
                    {isFetching ? "Loading…" : "No purchase orders match the filters."}
                  </td>
                </tr>
              ) : (
                register.map((row, i) => (
                  <tr key={row.id}>
                    <td className="text-center font-mono text-slate-600">{i + 1}</td>
                    <td className="font-mono font-semibold text-blue-700">{row.poNumber}</td>
                    <td>{row.orderDate}</td>
                    <td className="font-medium text-slate-900">{row.supplierName}</td>
                    <td className="text-slate-700">
                      {row.officeName} · {row.warehouseName}
                    </td>
                    <td>
                      <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[10px] font-medium">{row.category}</span>
                    </td>
                    <td className="text-right font-mono font-bold text-slate-900">{formatCurrency(row.amount)}</td>
                    <td className="text-center text-[11px] font-semibold text-slate-700">{STATUS_LABEL[row.status] ?? row.status}</td>
                    <td className="text-right font-mono">{row.receivedPercent}%</td>
                    <td className="text-center">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                          row.paymentStatus === "PAID"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : row.paymentStatus === "PARTIALLY_PAID"
                              ? "bg-amber-50 text-amber-700 border-amber-200"
                              : row.paymentStatus === "UNPAID"
                                ? "bg-rose-50 text-rose-700 border-rose-200"
                                : "bg-slate-50 text-slate-600 border-slate-200"
                        }`}
                      >
                        {PAYMENT_LABEL[row.paymentStatus]}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {register.length > 0 && (
              <tfoot>
                <tr className="bg-slate-50 font-bold">
                  <td colSpan={6} className="text-right">
                    Total
                  </td>
                  <td className="text-right font-mono text-[#0057b8]">{formatCurrency(register.reduce((s, r) => s + r.amount, 0))}</td>
                  <td colSpan={3} className="text-center text-slate-500 font-normal">
                    {register.length} orders
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}
