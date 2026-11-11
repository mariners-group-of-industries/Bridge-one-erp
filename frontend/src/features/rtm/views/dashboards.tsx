"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { SelectField, TextField } from "@/components/ui/form-field";
import { ErrorState, LoadingState } from "@/components/ui/section";
import { useResource } from "@/hooks/use-resource";
import { distributorDashboard, rtmDashboard, salesExecutiveDashboard } from "../navigation";
import { money, monthStart, qty, rtmApi, thisMonth, today } from "../services/rtm.api";
import { DateRange, FilterBar, Kpi, RtmPage, SimpleTable, options, useLookups } from "../components/kit";

// ── RTM Dashboard ─────────────────────────────────────────────────────────────

interface RtmDashboardData {
  kpis: {
    orders: number;
    orderValue: number;
    sales: number;
    collection: number;
    returns: number;
    outstanding: number;
    activeOutlets: number;
    orderingOutlets: number;
    coverage: number;
    visits: number;
    strikeRate: number;
  };
  distributors: { name: string; sales: number; collection: number; returns: number }[];
  channels: { name: string; sales: number }[];
  items: { name: string; qty: number; value: number }[];
  daily: { day: string; sales: number; collection: number }[];
}

export function RtmDashboardView() {
  const [from, setFrom] = useState(monthStart());
  const [to, setTo] = useState(today());
  const data = useResource(`rtm-dashboard-${from}-${to}`, () =>
    rtmApi.get<RtmDashboardData>("dashboard", { from, to }),
  );

  return (
    <RtmPage page={rtmDashboard}>
      <FilterBar>
        <DateRange from={from} to={to} onChange={(f, t) => { setFrom(f); setTo(t); }} />
      </FilterBar>

      {data.error ? (
        <ErrorState message={data.error.message} onRetry={data.reload} />
      ) : !data.data ? (
        <LoadingState />
      ) : (
        <>
          {/* KPIs row 1 — Sales */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Kpi label="Orders" value={data.data.kpis.orders.toLocaleString()} hint="Booked this period" />
            <Kpi label="Order value" value={money(data.data.kpis.orderValue)} />
            <Kpi label="Sales (delivered)" value={money(data.data.kpis.sales)} tone="success" />
            <Kpi label="Collection" value={money(data.data.kpis.collection)} />
          </div>

          {/* KPIs row 2 — Returns, outstanding, coverage, field */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Kpi label="Returns" value={money(data.data.kpis.returns)} tone={data.data.kpis.returns > 0 ? "warning" : undefined} />
            <Kpi label="Outstanding" value={money(data.data.kpis.outstanding)} tone={data.data.kpis.outstanding > 0 ? "danger" : undefined} />
            <Kpi label="Coverage" value={`${data.data.kpis.coverage}%`} hint={`${data.data.kpis.orderingOutlets} / ${data.data.kpis.activeOutlets} outlets ordered`} />
            <Kpi label="Strike rate" value={`${data.data.kpis.strikeRate}%`} hint={`${data.data.kpis.visits} visits`} />
          </div>

          {/* Distributor and channel tables side by side */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <SimpleTable
              title="Top distributors"
              rows={data.data.distributors}
              empty="No deliveries in this period."
              columns={[
                { header: "Distributor", cell: (d) => d.name },
                { header: "Sales", cell: (d) => money(d.sales), align: "right" },
                { header: "Collection", cell: (d) => money(d.collection), align: "right" },
                { header: "Returns", cell: (d) => (d.returns ? money(d.returns) : "—"), align: "right" },
              ]}
            />
            <SimpleTable
              title="Sales by channel"
              rows={data.data.channels}
              empty="No deliveries in this period."
              columns={[
                { header: "Channel", cell: (c) => c.name },
                { header: "Sales", cell: (c) => money(c.sales), align: "right" },
              ]}
            />
          </div>

          {/* Daily trend */}
          <SimpleTable
            title="Daily trend"
            rows={data.data.daily}
            empty="No data."
            columns={[
              { header: "Date", cell: (d) => d.day },
              { header: "Sales", cell: (d) => money(d.sales), align: "right" },
              { header: "Collection", cell: (d) => money(d.collection), align: "right" },
            ]}
          />

          {/* Top items */}
          <SimpleTable
            title="Top items (by value)"
            rows={data.data.items}
            empty="No items sold."
            columns={[
              { header: "Item", cell: (i) => i.name },
              { header: "Qty", cell: (i) => qty(i.qty), align: "right" },
              { header: "Value", cell: (i) => money(i.value), align: "right" },
            ]}
          />
        </>
      )}
    </RtmPage>
  );
}

// ── Distributor Dashboard ─────────────────────────────────────────────────────

interface DistributorDashboardData {
  distributor: { id: string; name: string; code: string };
  kpis: {
    sales: number;
    collection: number;
    returns: number;
    orders: number;
    outletDue: number;
    stockValue: number;
    outlets: number;
    pendingOrders: number;
  };
  stock: { item: string; uom: string; qty: number; value: number }[];
  pendingOrders: { number: string; date: string; outlet: string; total: number; status: string }[];
  topOutlets: { name: string; sales: number }[];
  dues: { outlet: string; due: number }[];
}

export function DistributorDashboardView() {
  const lookups = useLookups();
  const [distributorId, setDistributorId] = useState("");
  const [from, setFrom] = useState(monthStart());
  const [to, setTo] = useState(today());
  const data = useResource(
    distributorId ? `rtm-dist-dashboard-${distributorId}-${from}-${to}` : null,
    () => rtmApi.get<DistributorDashboardData>("distributor-dashboard", { distributorId, from, to }),
  );

  return (
    <RtmPage page={distributorDashboard}>
      <FilterBar>
        <SelectField
          label="Distributor"
          className="w-64"
          value={distributorId}
          onChange={(e) => setDistributorId(e.target.value)}
          options={options(lookups.data?.distributors, (d) => `${d.code} · ${d.name}`, (d) => d.id, "Select distributor")}
        />
        <DateRange from={from} to={to} onChange={(f, t) => { setFrom(f); setTo(t); }} />
      </FilterBar>

      {!distributorId ? (
        <p className="text-sm text-ink-faint">Select a distributor to see their dashboard.</p>
      ) : data.error ? (
        <ErrorState message={data.error.message} onRetry={data.reload} />
      ) : !data.data ? (
        <LoadingState />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Kpi label="Sales" value={money(data.data.kpis.sales)} tone="success" />
            <Kpi label="Collection" value={money(data.data.kpis.collection)} />
            <Kpi label="Returns" value={money(data.data.kpis.returns)} tone={data.data.kpis.returns > 0 ? "warning" : undefined} />
            <Kpi label="Orders" value={data.data.kpis.orders.toLocaleString()} hint={`${data.data.kpis.pendingOrders} pending`} />
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            <Kpi label="Outlet dues" value={money(data.data.kpis.outletDue)} tone={data.data.kpis.outletDue > 0 ? "danger" : undefined} />
            <Kpi label="Stock value" value={money(data.data.kpis.stockValue)} />
            <Kpi label="Active outlets" value={data.data.kpis.outlets.toLocaleString()} />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <SimpleTable
              title="Current stock"
              rows={data.data.stock}
              empty="No stock on hand."
              columns={[
                { header: "Item", cell: (s) => s.item },
                { header: "UoM", cell: (s) => s.uom },
                { header: "Qty", cell: (s) => qty(s.qty), align: "right" },
                { header: "Value", cell: (s) => money(s.value), align: "right" },
              ]}
            />
            <SimpleTable
              title="Pending orders to deliver"
              rows={data.data.pendingOrders}
              empty="No pending orders."
              columns={[
                { header: "Order", cell: (o) => <span className="font-mono">{o.number}</span> },
                { header: "Date", cell: (o) => o.date },
                { header: "Outlet", cell: (o) => o.outlet },
                { header: "Total", cell: (o) => money(o.total), align: "right" },
                {
                  header: "Status",
                  cell: (o) => (
                    <Badge variant={o.status === "PENDING" ? "warning" : "primary"}>
                      {o.status === "PENDING" ? "Not delivered" : "Partly delivered"}
                    </Badge>
                  ),
                },
              ]}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <SimpleTable
              title="Top outlets (by sales)"
              rows={data.data.topOutlets}
              empty="No sales."
              columns={[
                { header: "Outlet", cell: (o) => o.name },
                { header: "Sales", cell: (o) => money(o.sales), align: "right" },
              ]}
            />
            <SimpleTable
              title="Outlet dues"
              rows={data.data.dues}
              empty="No outstanding dues."
              columns={[
                { header: "Outlet", cell: (o) => o.outlet },
                { header: "Due", cell: (o) => money(o.due), align: "right" },
              ]}
            />
          </div>
        </>
      )}
    </RtmPage>
  );
}

// ── Sales Executive Dashboard ─────────────────────────────────────────────────

interface SeRow {
  employeeId: string;
  employee: string;
  designation: string | null;
  target: number;
  achieved: number;
  achievement: number | null;
  orders: number;
  orderValue: number;
  collection: number;
  visits: number;
  outletsVisited: number;
  visitDays: number;
}

export function SalesExecutiveDashboardView() {
  const [month, setMonth] = useState(thisMonth());
  const data = useResource(`rtm-se-dashboard-${month}`, () =>
    rtmApi.get<SeRow[]>("sales-executive-dashboard", { month }),
  );

  return (
    <RtmPage page={salesExecutiveDashboard}>
      <FilterBar>
        <TextField
          label="Month"
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="w-44"
        />
      </FilterBar>

      {data.error ? (
        <ErrorState message={data.error.message} onRetry={data.reload} />
      ) : !data.data ? (
        <LoadingState />
      ) : (
        <SimpleTable
          title={`Sales executive performance — ${month}`}
          rows={data.data}
          empty="No sales representatives found for this month."
          columns={[
            { header: "Employee", cell: (r) => <span className="font-semibold">{r.employee}</span> },
            { header: "Designation", cell: (r) => r.designation ?? "—" },
            {
              header: "Achievement",
              cell: (r) =>
                r.achievement !== null ? (
                  <Badge
                    variant={
                      r.achievement >= 100
                        ? "success"
                        : r.achievement >= 75
                          ? "primary"
                          : r.achievement >= 50
                            ? "warning"
                            : "danger"
                    }
                  >
                    {r.achievement}%
                  </Badge>
                ) : (
                  <Badge variant="neutral">No target</Badge>
                ),
            },
            { header: "Target", cell: (r) => (r.target > 0 ? money(r.target) : "—"), align: "right" },
            { header: "Achieved", cell: (r) => money(r.achieved), align: "right" },
            { header: "Orders", cell: (r) => r.orders.toLocaleString(), align: "right" },
            { header: "Order value", cell: (r) => money(r.orderValue), align: "right" },
            { header: "Collection", cell: (r) => money(r.collection), align: "right" },
            { header: "Visits", cell: (r) => r.visits.toLocaleString(), align: "right" },
            { header: "Outlets visited", cell: (r) => r.outletsVisited.toLocaleString(), align: "right" },
            { header: "Active days", cell: (r) => r.visitDays.toLocaleString(), align: "right" },
          ]}
        />
      )}
    </RtmPage>
  );
}
