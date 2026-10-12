"use client";

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  FileText,
  Clock,
  CheckCircle2,
  ShoppingCart,
  PackageOpen,
  CheckCheck,
  AlertCircle,
  TrendingUp,
  ChevronRight,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  Legend,
  AreaChart,
  Area,
  CartesianGrid,
} from "recharts";
import Link from "next/link";
import { PageHeader } from "@/components/purchase/PageHeader";
import { SummaryCard } from "@/components/purchase/SummaryCard";
import { FilterToolbar } from "@/components/purchase/FilterToolbar";
import { StatusBadge } from "@/components/purchase/StatusBadge";
import { fetchApi } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import { DashboardAnalytics, Office } from "@bridgeone/contracts";

const PIE_COLORS = ["#0284c7", "#0ea5e9", "#38bdf8", "#7dd3fc", "#0369a1"];

export default function PurchaseDashboardPage() {
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [selectedOffice, setSelectedOffice] = useState("ALL");

  const { data: offices } = useQuery<Office[]>({
    queryKey: ["offices"],
    queryFn: () => fetchApi("/master/offices"),
  });

  const { data, isLoading, refetch } = useQuery<DashboardAnalytics>({
    queryKey: ["dashboard", fromDate, toDate, selectedOffice],
    queryFn: () => {
      const params = new URLSearchParams();
      if (fromDate) params.append("fromDate", fromDate);
      if (toDate) params.append("toDate", toDate);
      if (selectedOffice && selectedOffice !== "ALL") params.append("officeId", selectedOffice);
      return fetchApi(`/purchase/dashboard?${params.toString()}`);
    },
  });

  const kpis = data?.kpis;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Purchase Dashboard"
      />

      {/* Filter Toolbar */}
      <FilterToolbar
        onApply={() => refetch()}
        onReset={() => {
          setFromDate("");
          setToDate("");
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
            className="border border-slate-200 rounded px-2 py-1 text-xs bg-slate-50 focus:bg-white"
          />
        </div>
        <div className="flex items-center gap-1.5 text-xs text-slate-600">
          <span className="font-medium text-[11px] text-slate-500">To:</span>
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="border border-slate-200 rounded px-2 py-1 text-xs bg-slate-50 focus:bg-white"
          />
        </div>
        <div className="flex items-center gap-1.5 text-xs text-slate-600">
          <span className="font-medium text-[11px] text-slate-500">Office:</span>
          <select
            value={selectedOffice}
            onChange={(e) => setSelectedOffice(e.target.value)}
            className="border border-slate-200 rounded px-2 py-1 text-xs bg-slate-50 focus:bg-white max-w-[200px]"
          >
            <option value="ALL">All Branches & Plants</option>
            {offices?.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </div>
      </FilterToolbar>

      {/* KPI Cards Row 1: Document Lifecycle Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
        <SummaryCard
          title="Requisitions"
          value={kpis?.totalRequisitions ?? "-"}
          subtitle="Total requested"
          icon={FileText}
          variant="info"
        />
        <SummaryCard
          title="Pending Approval"
          value={kpis?.pendingApprovals ?? "-"}
          subtitle="Awaiting action"
          icon={Clock}
          variant="warning"
        />
        <SummaryCard
          title="Approved Reqs"
          value={kpis?.approvedRequisitions ?? "-"}
          subtitle="Ready for PO"
          icon={CheckCircle2}
          variant="success"
        />
        <SummaryCard
          title="Open POs"
          value={kpis?.openPurchaseOrders ?? "-"}
          subtitle="Active with vendor"
          icon={ShoppingCart}
          variant="info"
        />
        <SummaryCard
          title="Partially Received"
          value={kpis?.partiallyReceivedOrders ?? "-"}
          subtitle="Partial delivery"
          icon={PackageOpen}
          variant="warning"
        />
        <SummaryCard
          title="Completed Orders"
          value={kpis?.completedOrders ?? "-"}
          subtitle="Fully delivered"
          icon={CheckCheck}
          variant="success"
        />
        <SummaryCard
          title="Pending Invoices"
          value={kpis?.pendingSupplierInvoices ?? "-"}
          subtitle="Unpaid to vendor"
          icon={AlertCircle}
          variant="danger"
        />
      </div>

      {/* Financial Metrics Summary Banner */}
      <div className="bg-slate-900 text-white rounded p-4 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4 border border-slate-800">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-lg bg-sky-500/20 text-sky-400 border border-sky-500/30">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Total Purchase Expenditure (Active Filter)
            </div>
            <div className="text-2xl font-bold text-white tracking-tight">
              {formatCurrency(kpis?.totalSpendAmount ?? 0)}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-6 divide-x divide-slate-800 text-xs">
          <div className="px-3 text-right">
            <div className="text-slate-400 text-[11px]">Outstanding Dues</div>
            <div className="text-base font-bold text-amber-400">
              {formatCurrency(kpis?.totalOutstandingAmount ?? 0)}
            </div>
          </div>
          <div className="pl-6 text-right">
            <div className="text-slate-400 text-[11px]">Avg. Procurement Cycle</div>
            <div className="text-base font-bold text-sky-400">
              {data?.procurementCycleTimeDays ?? 4.8} Days
            </div>
          </div>
        </div>
      </div>

      {/* Charts Row 1: Expenditure Trends & Type-wise breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Monthly Purchase Expenditure Area Chart */}
        <div className="lg:col-span-2 bg-white p-4 rounded border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2">
            <div>
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                Monthly Purchase Expenditure vs Budget
              </h3>
              <p className="text-[11px] text-slate-400">Past 5 months procurement spend (BDT)</p>
            </div>
            <span className="text-[10px] bg-sky-50 text-sky-700 px-2 py-0.5 rounded font-medium border border-sky-100">
              Recharts Data
            </span>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data?.monthlyExpenditure || []} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorSpend" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0284c7" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#0284c7" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#64748b" }} />
                <YAxis
                  tick={{ fontSize: 11, fill: "#64748b" }}
                  tickFormatter={(val) => `${(val / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  formatter={(val: any) => [formatCurrency(Number(val) || 0), "Expenditure"]}
                  itemStyle={{ color: "#ffffff", fontWeight: 600 }}
                  labelStyle={{ color: "#94a3b8", fontWeight: 700 }}
                  contentStyle={{
                    backgroundColor: "#0f172a",
                    borderColor: "#334155",
                    borderRadius: "6px",
                    color: "#ffffff",
                    fontSize: "12px",
                    boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.35)",
                  }}
                />
                <Area type="monotone" dataKey="expenditure" stroke="#0284c7" strokeWidth={2} fillOpacity={1} fill="url(#colorSpend)" />
                <Area type="monotone" dataKey="budget" stroke="#94a3b8" strokeDasharray="4 4" strokeWidth={1.5} fillOpacity={0} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* PO Status Distribution Donut */}
        <div className="bg-white p-4 rounded border border-slate-200 shadow-xs flex flex-col">
          <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2">
            <div>
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                Order Status Distribution
              </h3>
              <p className="text-[11px] text-slate-400">Breakdown of orders in cycle</p>
            </div>
          </div>
          <div className="h-64 flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data?.poStatusDistribution || []}
                  dataKey="count"
                  nameKey="status"
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={75}
                  paddingAngle={3}
                >
                  {(data?.poStatusDistribution || []).map((_, index) => (
                    <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  itemStyle={{ color: "#ffffff", fontWeight: 600 }}
                  labelStyle={{ color: "#94a3b8", fontWeight: 700 }}
                  contentStyle={{
                    backgroundColor: "#0f172a",
                    borderColor: "#334155",
                    borderRadius: "6px",
                    color: "#ffffff",
                    fontSize: "12px",
                    boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.35)",
                  }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: "11px" }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Charts Row 2: Warehouse-wise & Top Suppliers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Warehouse-wise Spend Bar Chart */}
        <div className="bg-white p-4 rounded border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
              Warehouse-wise Purchase Allocation
            </h3>
            <span className="text-[11px] text-slate-400">Value (BDT)</span>
          </div>
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data?.warehouseWisePurchase || []} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="warehouse" tick={{ fontSize: 10, fill: "#64748b" }} interval={0} angle={-10} textAnchor="end" />
                <YAxis
                  tick={{ fontSize: 11, fill: "#64748b" }}
                  tickFormatter={(val) => `${(val / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  formatter={(val: any) => [formatCurrency(Number(val) || 0), "Spend Amount"]}
                  itemStyle={{ color: "#ffffff", fontWeight: 600 }}
                  labelStyle={{ color: "#94a3b8", fontWeight: 700 }}
                  contentStyle={{
                    backgroundColor: "#0f172a",
                    borderColor: "#334155",
                    borderRadius: "6px",
                    color: "#ffffff",
                    fontSize: "12px",
                    boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.35)",
                  }}
                />
                <Bar dataKey="amount" fill="#0369a1" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top Suppliers Table */}
        <div className="bg-white p-4 rounded border border-slate-200 shadow-xs flex flex-col">
          <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
              Top Suppliers by Expenditure
            </h3>
            <Link href="/purchase/supplier-payments" className="text-[11px] text-sky-600 hover:underline">
              View all payables →
            </Link>
          </div>
          <div className="flex-1 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-400 uppercase text-[10px]">
                  <th className="py-1.5 font-semibold">Supplier Name</th>
                  <th className="py-1.5 font-semibold text-center">Orders</th>
                  <th className="py-1.5 font-semibold text-right">Total Spend</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(data?.topSuppliers || []).map((s, idx) => (
                  <tr key={idx} className="hover:bg-slate-50">
                    <td className="py-2 font-medium text-slate-700">{s.supplier}</td>
                    <td className="py-2 text-center text-slate-500 font-mono">{s.poCount}</td>
                    <td className="py-2 text-right font-semibold text-slate-900 font-mono">
                      {formatCurrency(s.totalSpend)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Pending Items Requiring Action */}
      <div className="bg-white rounded border border-slate-200 shadow-xs overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-500" />
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
              Pending Approvals & Items Awaiting Action
            </h3>
          </div>
          <span className="text-[10px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded font-medium">
            Requires Manager Review
          </span>
        </div>
        <div className="divide-y divide-slate-100">
          {(data?.pendingApprovalItems || []).map((item) => (
            <div key={item.id} className="p-3 flex items-center justify-between hover:bg-slate-50 transition">
              <div className="flex items-center gap-3">
                <span className="text-[10px] font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded border border-slate-200">
                  {item.type}
                </span>
                <div>
                  <div className="text-xs font-semibold text-slate-900">{item.docNumber}</div>
                  <div className="text-[11px] text-slate-400">
                    Requester: {item.requester} • Date: {item.date}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-xs font-bold text-slate-800 font-mono">
                  {formatCurrency(item.amount)}
                </span>
                <StatusBadge status={item.status} />
                <Link
                  href={item.type === "REQUISITION" ? "/purchase/requisitions" : "/purchase/orders"}
                  className="p-1 rounded hover:bg-slate-200 text-slate-500 hover:text-slate-800"
                  title="View document"
                >
                  <ChevronRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
