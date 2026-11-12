"use client";

import { Check, Plus, X } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/ui/data-table";
import { SelectField, TextField } from "@/components/ui/form-field";
import { Card, ErrorState, LoadingState } from "@/components/ui/section";
import { useResource } from "@/hooks/use-resource";
import { cn } from "@/lib/cn";
import { employeeTracking, outletTracking, salesLayerTransfer, srCalendarSetup, tourPlanSetup } from "../navigation";
import { money, monthStart, qty, rtmApi, today, type Lookups } from "../services/rtm.api";
import { DateRange, FilterBar, FormDialog, RtmPage, SimpleTable, StatusBadge, options, useAction, useLookups, type FieldDef } from "../components/kit";

// ── SR Calendar Setup ────────────────────────────────────────────────────────

const DAY_TYPE_OPTIONS = [
  { value: "WORKING", label: "Working" },
  { value: "WEEKEND", label: "Weekend" },
  { value: "HOLIDAY", label: "Holiday" },
  { value: "LEAVE", label: "Leave" },
];

const DAY_TYPE_CLASSES: Record<string, string> = {
  WORKING: "bg-success/10 text-success border-success/30",
  WEEKEND: "bg-warning/10 text-warning border-warning/30",
  HOLIDAY: "bg-danger/10 text-danger border-danger/30",
  LEAVE: "bg-primary/10 text-primary border-primary/30",
};

interface CalendarDay {
  day: string;
  weekday: string;
  dayType: string;
  remarks: string;
  saved: boolean;
}

export function SrCalendarSetupView() {
  const lookups = useLookups();
  const [employeeId, setEmployeeId] = useState("");
  const [month, setMonth] = useState(today().slice(0, 7));
  const calendar = useResource(
    employeeId ? `rtm-calendar-${employeeId}-${month}` : null,
    () => rtmApi.get<CalendarDay[]>("sr-calendar-setup", { employeeId, month }),
  );
  const [editing, setEditing] = useState<Record<string, { dayType: string; remarks: string }>>({});
  const [saving, setSaving] = useState(false);

  const days = calendar.data ?? [];
  const getDay = (d: CalendarDay) => editing[d.day] ?? { dayType: d.dayType, remarks: d.remarks };
  const patch = (day: string, patch: Partial<{ dayType: string; remarks: string }>) =>
    setEditing((e) => ({ ...e, [day]: { ...(e[day] ?? { dayType: "", remarks: "" }), ...patch } }));

  const save = async () => {
    setSaving(true);
    try {
      const changed = days.filter((d) => editing[d.day]);
      const updatedDays = changed.map((d) => ({ day: d.day, ...getDay(d) }));
      await rtmApi.put("sr-calendar-setup", { employeeId, month, days: updatedDays });
      setEditing({});
      calendar.reload();
    } finally {
      setSaving(false);
    }
  };

  return (
    <RtmPage page={srCalendarSetup}>
      <FilterBar>
        <SelectField
          label="Sales representative"
          className="w-72"
          value={employeeId}
          onChange={(e) => { setEmployeeId(e.target.value); setEditing({}); }}
          options={options(lookups.data?.srs, (s) => `${s.code} · ${s.name}`, (s) => s.id, "Select SR")}
        />
        <TextField
          label="Month"
          type="month"
          value={month}
          onChange={(e) => { setMonth(e.target.value); setEditing({}); }}
          className="w-44"
        />
      </FilterBar>

      {!employeeId ? (
        <p className="text-sm text-ink-faint">Select a sales representative to view their calendar.</p>
      ) : calendar.error ? (
        <ErrorState message={calendar.error.message} onRetry={calendar.reload} />
      ) : !calendar.data ? (
        <LoadingState />
      ) : (
        <Card>
          <div className="flex flex-col gap-4 p-4">
            {/* Legend */}
            <div className="flex flex-wrap gap-3">
              {DAY_TYPE_OPTIONS.map((dt) => (
                <span key={dt.value} className={cn("rounded border px-2 py-0.5 text-xs font-medium", DAY_TYPE_CLASSES[dt.value])}>
                  {dt.label}
                </span>
              ))}
            </div>

            {/* Calendar grid */}
            <div className="grid grid-cols-7 gap-1.5">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                <div key={d} className="py-1 text-center text-xs font-semibold text-ink-muted">{d}</div>
              ))}
              {/* Offset blank cells for first day of month */}
              {Array.from({ length: new Date(`${days[0]?.day}T00:00:00Z`).getUTCDay() }).map((_, i) => (
                <div key={`blank-${i}`} />
              ))}
              {days.map((d) => {
                const cur = getDay(d);
                const changed = !!editing[d.day];
                return (
                  <div
                    key={d.day}
                    className={cn(
                      "flex flex-col gap-0.5 rounded border p-1.5 text-xs",
                      DAY_TYPE_CLASSES[cur.dayType] ?? "border-line bg-surface",
                      changed && "ring-1 ring-primary",
                    )}
                  >
                    <span className="font-semibold">{d.day.slice(8)}</span>
                    <select
                      aria-label={`Day type for ${d.day}`}
                      value={cur.dayType}
                      onChange={(e) => patch(d.day, { dayType: e.target.value })}
                      className="mt-0.5 w-full rounded bg-transparent text-[10px] outline-none"
                    >
                      {DAY_TYPE_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center gap-3">
              <Button
                variant="primary"
                loading={saving}
                disabled={Object.keys(editing).length === 0}
                onClick={save}
              >
                Save changes
              </Button>
              {Object.keys(editing).length > 0 && (
                <span className="text-xs text-ink-muted">{Object.keys(editing).length} day(s) changed</span>
              )}
            </div>
          </div>
        </Card>
      )}
    </RtmPage>
  );
}

// ── Tour Plan Setup ──────────────────────────────────────────────────────────

interface TourPlan {
  id: string;
  planDate: string;
  employeeId: string;
  employee: string;
  route: string | null;
  distributor: string | null;
  purpose: string | null;
  status: string;
  createdBy: string;
  approvedBy: string | null;
  updatedAt: string;
}

const TOUR_LABELS = {
  PENDING: "Pending",
  APPROVED: "Approved",
  REJECTED: "Rejected",
};

export function TourPlanSetupView() {
  const [from, setFrom] = useState(monthStart());
  const [to, setTo] = useState(today());
  const [employeeId, setEmployeeId] = useState("");
  const lookups = useLookups();
  const list = useResource(`rtm-tourplans-${from}-${to}-${employeeId}`, () =>
    rtmApi.get<TourPlan[]>("tour-plan-setup", { from, to, employeeId: employeeId || undefined }),
  );
  const [open, setOpen] = useState(false);
  const { busy, run } = useAction(list.reload);

  const l = lookups.data;
  const fields: FieldDef[] = [
    { name: "employeeId", label: "Sales representative", type: "select", required: true, options: options(l?.srs, (s) => `${s.code} · ${s.name}`, (s) => s.id, "Select SR") },
    { name: "planDate", label: "Date", type: "date", required: true },
    { name: "routeId", label: "Route", type: "select", options: options(l?.routes, (r) => r.name, (r) => r.id, "None") },
    { name: "distributorId", label: "Distributor", type: "select", options: options(l?.distributors, (d) => `${d.code} · ${d.name}`, (d) => d.id, "None") },
    { name: "purpose", label: "Purpose", type: "textarea", wide: true },
  ];

  const columns: Column<TourPlan>[] = [
    { id: "date", header: "Date", cell: (t) => t.planDate, sortValue: (t) => t.planDate },
    { id: "employee", header: "SR", cell: (t) => t.employee, sortValue: (t) => t.employee },
    { id: "route", header: "Route", cell: (t) => t.route ?? "—" },
    { id: "distributor", header: "Distributor", cell: (t) => t.distributor ?? "—", hideBelow: "md" },
    { id: "purpose", header: "Purpose", cell: (t) => t.purpose ?? "—", hideBelow: "lg" },
    { id: "createdBy", header: "Created by", cell: (t) => t.createdBy, hideBelow: "lg" },
    { id: "approvedBy", header: "Approved by", cell: (t) => t.approvedBy ?? "—", hideBelow: "lg" },
    { id: "status", header: "Status", cell: (t) => <StatusBadge status={t.status} labels={TOUR_LABELS} /> },
    {
      id: "actions",
      header: "",
      cell: (t) =>
        t.status === "PENDING" ? (
          <div className="flex gap-1">
            <Button
              size="sm"
              variant="primary"
              disabled={busy === `approve-${t.id}`}
              onClick={() => run(`approve-${t.id}`, () => rtmApi.post(`tour-plan-setup/${t.id}/approve`), "Tour plan approved.")}
            >
              <Check /> Approve
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={busy === `reject-${t.id}`}
              onClick={() => run(`reject-${t.id}`, () => rtmApi.post(`tour-plan-setup/${t.id}/reject`), "Tour plan rejected.")}
            >
              <X /> Reject
            </Button>
          </div>
        ) : null,
    },
  ];

  return (
    <RtmPage
      page={tourPlanSetup}
      actions={
        <Button variant="primary" onClick={() => setOpen(true)}>
          <Plus /> New Tour Plan
        </Button>
      }
    >
      <FilterBar>
        <DateRange from={from} to={to} onChange={(f, t) => { setFrom(f); setTo(t); }} />
        <SelectField
          label="Sales representative"
          className="w-56"
          value={employeeId}
          onChange={(e) => setEmployeeId(e.target.value)}
          options={options(l?.srs, (s) => `${s.code} · ${s.name}`, (s) => s.id, "All SRs")}
        />
      </FilterBar>
      {list.error ? (
        <ErrorState message={list.error.message} onRetry={list.reload} />
      ) : !list.data ? (
        <LoadingState />
      ) : (
        <Card>
          <DataTable
            rows={list.data}
            columns={columns}
            getRowId={(t) => t.id}
            getRowLabel={(t) => `${t.employee} · ${t.planDate}`}
            modifiedAt={(t) => t.updatedAt}
            search={{
              placeholder: "Search SR, route, date…",
              match: (t, q) => `${t.employee} ${t.route ?? ""} ${t.planDate}`.toLowerCase().includes(q),
            }}
          />
        </Card>
      )}
      <FormDialog
        open={open}
        title="New Tour Plan"
        fields={fields}
        onClose={() => setOpen(false)}
        onSubmit={async (body) => {
          await rtmApi.post("tour-plan-setup", body);
          list.reload();
        }}
      />
    </RtmPage>
  );
}

// ── Sales Layer Transfer ─────────────────────────────────────────────────────

interface LayerNode {
  id: string;
  code: string;
  name: string;
  layer: string;
  level: number;
  parent: string | null;
  employees: { id: string; code: string; name: string; channel: string | null }[];
}

export function SalesLayerTransferView() {
  const lookups = useLookups();
  const layers = useResource("rtm-sales-layers", () => rtmApi.get<LayerNode[]>("sales-layer-transfer"));
  const [kind, setKind] = useState<"employee" | "outlets">("employee");

  // Employee transfer state
  const [empId, setEmpId] = useState("");
  const [fromNodeId, setFromNodeId] = useState("");
  const [toNodeId, setToNodeId] = useState("");

  // Outlet transfer state
  const [outletIds, setOutletIds] = useState<string[]>([]);
  const [routeId, setRouteId] = useState("");
  const [distId, setDistId] = useState("");
  const [saving, setSaving] = useState(false);

  const { run } = useAction(layers.reload);

  const nodeOptions = (nodes: LayerNode[] | undefined) =>
    options(nodes, (n) => `${n.layer}: ${n.name}`, (n) => n.id, "Select node");

  const submit = async () => {
    setSaving(true);
    try {
      if (kind === "employee") {
        await rtmApi.post("sales-layer-transfer", { kind: "employee", employeeId: empId, fromNodeId, toNodeId });
      } else {
        await rtmApi.post("sales-layer-transfer", { kind: "outlets", outletIds, routeId, distributorId: distId || undefined });
      }
      layers.reload();
      setEmpId(""); setFromNodeId(""); setToNodeId("");
      setOutletIds([]); setRouteId(""); setDistId("");
    } finally {
      setSaving(false);
    }
  };

  const nodes = layers.data ?? [];
  const groupedByLayer = nodes.reduce<Record<string, LayerNode[]>>((acc, n) => {
    (acc[n.layer] = acc[n.layer] ?? []).push(n);
    return acc;
  }, {});

  return (
    <RtmPage page={salesLayerTransfer}>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Territory tree */}
        <div className="lg:col-span-2 flex flex-col gap-3">
          {layers.error ? (
            <ErrorState message={layers.error.message} onRetry={layers.reload} />
          ) : !layers.data ? (
            <LoadingState />
          ) : (
            Object.entries(groupedByLayer)
              .sort(([, a], [, b]) => (a[0]?.level ?? 0) - (b[0]?.level ?? 0))
              .map(([layer, layerNodes]) => (
                <SimpleTable
                  key={layer}
                  title={`${layer} (Level ${layerNodes[0]?.level ?? ""})`}
                  rows={layerNodes}
                  columns={[
                    { header: "Node", cell: (n) => <span className="font-semibold">{n.name}</span> },
                    { header: "Code", cell: (n) => <span className="font-mono text-xs">{n.code}</span> },
                    { header: "Parent", cell: (n) => n.parent ?? "—" },
                    {
                      header: "Employees",
                      cell: (n) =>
                        n.employees.length === 0 ? (
                          <span className="text-ink-faint">None</span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {n.employees.map((e) => (
                              <Badge key={e.id} variant="neutral">
                                {e.code} · {e.name}
                              </Badge>
                            ))}
                          </div>
                        ),
                    },
                  ]}
                />
              ))
          )}
        </div>

        {/* Transfer panel */}
        <Card>
          <div className="flex flex-col gap-4 p-4">
            <h2 className="text-sm font-bold text-ink">Transfer</h2>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant={kind === "employee" ? "primary" : "secondary"}
                onClick={() => setKind("employee")}
              >
                Employee
              </Button>
              <Button
                size="sm"
                variant={kind === "outlets" ? "primary" : "secondary"}
                onClick={() => setKind("outlets")}
              >
                Outlets
              </Button>
            </div>

            {kind === "employee" ? (
              <div className="flex flex-col gap-3">
                <SelectField
                  label="Employee"
                  value={empId}
                  onChange={(e) => setEmpId(e.target.value)}
                  options={options(lookups.data?.srs, (s) => `${s.code} · ${s.name}`, (s) => s.id, "Select employee")}
                />
                <SelectField
                  label="From node"
                  value={fromNodeId}
                  onChange={(e) => setFromNodeId(e.target.value)}
                  options={nodeOptions(layers.data)}
                />
                <SelectField
                  label="To node"
                  value={toNodeId}
                  onChange={(e) => setToNodeId(e.target.value)}
                  options={nodeOptions(layers.data)}
                />
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <p className="text-xs text-ink-faint">
                  Select outlet IDs to move (comma-separated) and the target route.
                </p>
                <SelectField
                  label="Outlet"
                  value={outletIds[0] ?? ""}
                  onChange={(e) => setOutletIds(e.target.value ? [e.target.value] : [])}
                  options={options(lookups.data?.outlets, (o) => `${o.code} · ${o.name}`, (o) => o.id, "Select outlet")}
                />
                <SelectField
                  label="Target route"
                  value={routeId}
                  onChange={(e) => setRouteId(e.target.value)}
                  options={options(lookups.data?.routes, (r) => r.name, (r) => r.id, "Select route")}
                />
                <SelectField
                  label="Target distributor (optional)"
                  value={distId}
                  onChange={(e) => setDistId(e.target.value)}
                  options={options(lookups.data?.distributors, (d) => `${d.code} · ${d.name}`, (d) => d.id, "Keep current")}
                />
              </div>
            )}

            <Button
              variant="primary"
              loading={saving}
              disabled={
                kind === "employee"
                  ? !empId || !fromNodeId || !toNodeId
                  : outletIds.length === 0 || !routeId
              }
              onClick={submit}
            >
              Transfer
            </Button>
          </div>
        </Card>
      </div>
    </RtmPage>
  );
}

// ── Employee Tracking ────────────────────────────────────────────────────────

interface VisitRow {
  id: string;
  employee: string;
  kind: string;
  time: string;
  outlet: string | null;
  latitude: number | null;
  longitude: number | null;
  remarks: string | null;
}

interface TrackingSummaryRow {
  employeeId: string;
  employee: string;
  checkIn: string | null;
  checkOut: string | null;
  late: boolean;
  visits: number;
  outletsVisited: number;
  lastLocation: { latitude: number; longitude: number; at: string } | null;
}

interface TrackingData {
  summary: TrackingSummaryRow[];
  visits: VisitRow[];
}

const KIND_LABELS: Record<string, string> = {
  CHECK_IN: "Check-in",
  CHECK_OUT: "Check-out",
  VISIT: "Outlet visit",
};

export function EmployeeTrackingView() {
  const lookups = useLookups();
  const [date, setDate] = useState(today());
  const [employeeId, setEmployeeId] = useState("");
  const data = useResource(`rtm-emp-tracking-${date}-${employeeId}`, () =>
    rtmApi.get<TrackingData>("employee-tracking", { date, employeeId: employeeId || undefined }),
  );

  const summaryColumns: Column<TrackingSummaryRow>[] = [
    { id: "employee", header: "Employee", cell: (r) => <span className="font-semibold">{r.employee}</span>, sortValue: (r) => r.employee },
    {
      id: "checkIn",
      header: "Check-in",
      cell: (r) => (
        <span className={cn("tabular-nums", r.late && "font-medium text-warning")}>
          {r.checkIn ?? <span className="text-ink-faint">—</span>}
          {r.late && <span className="ml-1 text-xs">(Late)</span>}
        </span>
      ),
    },
    { id: "checkOut", header: "Check-out", cell: (r) => r.checkOut ?? <span className="text-ink-faint">—</span> },
    { id: "visits", header: "Visits", cell: (r) => r.visits.toLocaleString(), className: "text-right" },
    { id: "outlets", header: "Outlets visited", cell: (r) => r.outletsVisited.toLocaleString(), className: "text-right" },
    {
      id: "location",
      header: "Last location",
      cell: (r) =>
        r.lastLocation ? (
          <span className="text-xs tabular-nums text-ink-muted">
            {r.lastLocation.latitude.toFixed(5)}, {r.lastLocation.longitude.toFixed(5)}
            <span className="ml-1">@ {r.lastLocation.at}</span>
          </span>
        ) : (
          <span className="text-ink-faint">—</span>
        ),
      hideBelow: "lg",
    },
  ];

  return (
    <RtmPage page={employeeTracking}>
      <FilterBar>
        <TextField
          label="Date"
          type="date"
          value={date}
          max={today()}
          onChange={(e) => setDate(e.target.value)}
          className="w-44"
        />
        <SelectField
          label="Employee"
          className="w-64"
          value={employeeId}
          onChange={(e) => setEmployeeId(e.target.value)}
          options={options(lookups.data?.srs, (s) => `${s.code} · ${s.name}`, (s) => s.id, "All employees")}
        />
      </FilterBar>

      {data.error ? (
        <ErrorState message={data.error.message} onRetry={data.reload} />
      ) : !data.data ? (
        <LoadingState />
      ) : (
        <>
          <Card>
            <DataTable
              rows={data.data.summary}
              columns={summaryColumns}
              getRowId={(r) => r.employeeId}
              getRowLabel={(r) => r.employee}
              search={{
                placeholder: "Search employee…",
                match: (r, q) => r.employee.toLowerCase().includes(q),
              }}
            />
          </Card>

          <SimpleTable
            title="Visit trail"
            rows={data.data.visits}
            empty="No visits recorded for this day."
            columns={[
              { header: "Employee", cell: (v) => v.employee },
              { header: "Time", cell: (v) => <span className="tabular-nums">{v.time}</span> },
              {
                header: "Type",
                cell: (v) => (
                  <Badge variant={v.kind === "CHECK_IN" ? "primary" : v.kind === "CHECK_OUT" ? "neutral" : "success"}>
                    {KIND_LABELS[v.kind] ?? v.kind}
                  </Badge>
                ),
              },
              { header: "Outlet", cell: (v) => v.outlet ?? <span className="text-ink-faint">—</span> },
              {
                header: "Location",
                cell: (v) =>
                  v.latitude !== null ? (
                    <span className="text-xs text-ink-muted">
                      {v.latitude.toFixed(5)}, {v.longitude?.toFixed(5)}
                    </span>
                  ) : (
                    <span className="text-ink-faint">—</span>
                  ),
              },
              { header: "Remarks", cell: (v) => v.remarks ?? "—" },
            ]}
          />
        </>
      )}
    </RtmPage>
  );
}

// ── Outlet Tracking ──────────────────────────────────────────────────────────

interface OutletCoverageRow {
  id: string;
  outlet: string;
  distributor: string;
  route: string | null;
  latitude: number | null;
  longitude: number | null;
  visits: number;
  lastVisit: string | null;
  orders: number;
  orderValue: number;
  lastOrder: string | null;
}

export function OutletTrackingView() {
  const [from, setFrom] = useState(monthStart());
  const [to, setTo] = useState(today());
  const data = useResource(`rtm-outlet-tracking-${from}-${to}`, () =>
    rtmApi.get<OutletCoverageRow[]>("outlet-tracking", { from, to }),
  );

  const columns: Column<OutletCoverageRow>[] = [
    { id: "outlet", header: "Outlet", cell: (r) => r.outlet, sortValue: (r) => r.outlet },
    { id: "distributor", header: "Distributor", cell: (r) => r.distributor, hideBelow: "md" },
    { id: "route", header: "Route", cell: (r) => r.route ?? "—", hideBelow: "lg" },
    { id: "visits", header: "Visits", cell: (r) => r.visits.toLocaleString(), sortValue: (r) => r.visits, className: "text-right" },
    { id: "lastVisit", header: "Last visit", cell: (r) => r.lastVisit ?? <span className="text-ink-faint">—</span>, sortValue: (r) => r.lastVisit ?? "", hideBelow: "md" },
    { id: "orders", header: "Orders", cell: (r) => r.orders.toLocaleString(), sortValue: (r) => r.orders, className: "text-right" },
    { id: "orderValue", header: "Order value", cell: (r) => money(r.orderValue), sortValue: (r) => r.orderValue, className: "text-right" },
    { id: "lastOrder", header: "Last order", cell: (r) => r.lastOrder ?? <span className="text-ink-faint">—</span>, sortValue: (r) => r.lastOrder ?? "", hideBelow: "lg" },
    {
      id: "covered",
      header: "Covered",
      cell: (r) => (
        <Badge variant={r.visits > 0 ? "success" : "neutral"}>
          {r.visits > 0 ? "Visited" : "Not visited"}
        </Badge>
      ),
    },
  ];

  const covered = data.data?.filter((r) => r.visits > 0).length ?? 0;
  const total = data.data?.length ?? 0;

  return (
    <RtmPage page={outletTracking}>
      <FilterBar>
        <DateRange from={from} to={to} onChange={(f, t) => { setFrom(f); setTo(t); }} />
      </FilterBar>

      {data.error ? (
        <ErrorState message={data.error.message} onRetry={data.reload} />
      ) : !data.data ? (
        <LoadingState />
      ) : (
        <>
          {total > 0 && (
            <div className="flex items-center gap-2 rounded border border-line bg-surface px-4 py-2 text-sm">
              <span className="font-semibold text-ink">{covered}</span>
              <span className="text-ink-muted">of</span>
              <span className="font-semibold text-ink">{total}</span>
              <span className="text-ink-muted">active outlets visited</span>
              <Badge variant={covered / total >= 0.8 ? "success" : covered / total >= 0.5 ? "warning" : "danger"}>
                {total > 0 ? Math.round((covered / total) * 100) : 0}% coverage
              </Badge>
            </div>
          )}
          <Card>
            <DataTable
              rows={data.data}
              columns={columns}
              getRowId={(r) => r.id}
              getRowLabel={(r) => r.outlet}
              search={{
                placeholder: "Search outlet, distributor, route…",
                match: (r, q) => `${r.outlet} ${r.distributor} ${r.route ?? ""}`.toLowerCase().includes(q),
              }}
            />
          </Card>
        </>
      )}
    </RtmPage>
  );
}
