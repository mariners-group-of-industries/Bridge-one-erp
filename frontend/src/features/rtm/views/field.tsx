"use client";

import { CalendarRange, Check, Eraser, Eye, Filter, MapPin, Plus, Search, X } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Dialog } from "@/components/ui/dialog";
import { CONTROL, SelectField, TextField } from "@/components/ui/form-field";
import { Card, EmptyState, ErrorState, LoadingState } from "@/components/ui/section";
import { Tabs } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast";
import { useResource } from "@/hooks/use-resource";
import { errorMessage } from "@/lib/api/client";
import { cn } from "@/lib/cn";
import { formatDateTime } from "@/lib/format";
import { useFeaturePermissions } from "@/lib/permissions/useFeaturePermissions";
import { rtmPaths } from "../paths";
import { employeeTracking, outletTracking, salesLayerTransfer, srCalendarSetup, tourPlanSetup } from "../navigation";
import { monthStart, qty, rtmApi, today, type Lookups } from "../services/rtm.api";
import { DateRange, FilterBar, RtmPage, SimpleTable, StatusBadge, options, useAction, useLookups } from "../components/kit";
import { LayerFields, deepestNode, useTerritory } from "../components/sales-filters";
import { RouteMap, STATUS_COLORS, STATUS_LABELS, formatClock, type MapOutlet, type OutletDayStatus, type RoutePoint } from "../components/route-map";

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

interface Tsm {
  id: string;
  code: string;
  name: string;
  designation: string | null;
  territories: string[];
}

interface PlanDay {
  date: string;
  dayType: string | null;
  dayRemarks: string | null;
  plan: { id: string; priority: string | null; activity: string | null; pointNodeId: string | null; point: string | null; startTime: string | null; endTime: string | null; remarks: string | null; status: string; approvedBy: string | null } | null;
}

interface PlanMonth {
  days: PlanDay[];
  points: { id: string; name: string; layer: string; level: number }[];
}

interface PlanRow {
  date: string;
  priority: string;
  activity: string;
  pointNodeId: string;
  startTime: string;
  endTime: string;
  remarks: string;
}

const PRIORITIES = [
  { value: "", label: "—" },
  { value: "HIGH", label: "High" },
  { value: "MEDIUM", label: "Medium" },
  { value: "LOW", label: "Low" },
];
const ACTIVITIES = ["Market visit", "Outlet visit", "Distributor visit", "Route ride", "Market survey", "Meeting", "Training", "Office work", "Leave", "Holiday"];
const TOUR_LABELS = { PENDING: "Pending approval", APPROVED: "Approved", REJECTED: "Rejected" };
const WEEKDAY = (date: string) => new Date(`${date}T00:00:00Z`).toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" });
const OFF_DAY: Record<string, string> = { WEEKEND: "Weekend", HOLIDAY: "Holiday", LEAVE: "Leave" };
const emptyRow = (d: PlanDay): PlanRow => ({
  date: d.date,
  priority: d.plan?.priority ?? "",
  activity: d.plan?.activity ?? (d.dayType && OFF_DAY[d.dayType] ? (d.dayType === "LEAVE" ? "Leave" : "Holiday") : ""),
  pointNodeId: d.plan?.pointNodeId ?? "",
  startTime: d.plan?.startTime ?? (d.dayType && OFF_DAY[d.dayType] ? "" : "09:00"),
  endTime: d.plan?.endTime ?? (d.dayType && OFF_DAY[d.dayType] ? "" : "17:00"),
  remarks: d.plan?.remarks ?? "",
});

/**
 * A TSM's monthly tour plan: pick the TSM and month, Generate the month (one row
 * per day, weekends / holidays / leave from the SR calendar marked), fill each
 * day and save. Saved days wait for approval; approved days are locked.
 */
export function TourPlanSetupView() {
  const toast = useToast();
  const tsms = useResource("rtm-tour-tsms", () => rtmApi.get<Tsm[]>("tour-plan-setup/tsms"));
  const can = useFeaturePermissions(rtmPaths.tourPlanSetup);
  const now = new Date();
  const [employeeId, setEmployeeId] = useState("");
  const [year, setYear] = useState(String(now.getFullYear()));
  const [month, setMonth] = useState(String(now.getMonth() + 1));
  const [target, setTarget] = useState<{ employeeId: string; year: string; month: string } | null>(null);
  const data = useResource(target ? `rtm-tour-month-${target.employeeId}-${target.year}-${target.month}` : null, () => rtmApi.get<PlanMonth>("tour-plan-setup/month", target!));
  const [rows, setRows] = useState<Record<string, PlanRow>>({});
  const [loadedKey, setLoadedKey] = useState("");
  const [saving, setSaving] = useState(false);
  const { busy, run } = useAction(data.reload);
  const dataKey = data.data ? `${target?.employeeId}-${target?.year}-${target?.month}-${JSON.stringify(data.data.days.map((d) => d.plan?.id ?? ""))}` : "";
  // Fill the grid from what was loaded (once per load, so edits are kept while typing).
  if (data.data && dataKey !== loadedKey) {
    setLoadedKey(dataKey);
    setRows(Object.fromEntries(data.data.days.map((d) => [d.date, emptyRow(d)])));
  }
  const generate = () => {
    if (!employeeId) {
      toast.error("Choose the employee.");
      return;
    }
    const next = { employeeId, year, month };
    if (target && JSON.stringify(target) === JSON.stringify(next)) {
      setLoadedKey("");
      data.reload();
    } else setTarget(next);
  };
  const locked = (d: PlanDay) => d.plan?.status === "APPROVED" || d.plan?.status === "COMPLETED";
  const setRow = (date: string, patch: Partial<PlanRow>) => setRows((r) => ({ ...r, [date]: { ...r[date], ...patch } }));
  const save = async () => {
    if (!target || !data.data) return;
    const days = data.data.days.filter((d) => !locked(d)).map((d) => rows[d.date]).filter((r) => r && r.activity);
    const bad = days.find((r) => r.startTime && r.endTime && r.endTime <= r.startTime);
    if (bad) {
      toast.error(`${bad.date}: the end time must be after the start time.`);
      return;
    }
    setSaving(true);
    try {
      await rtmApi.post("tour-plan-setup/month", { ...target, days });
      toast.success(`Tour plan saved: ${days.length} day(s) sent for approval.`);
      setLoadedKey("");
      data.reload();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSaving(false);
    }
  };
  const tsm = tsms.data?.find((t) => t.id === target?.employeeId);
  const points = data.data?.points ?? [];
  const editable = can.create || can.edit;
  const days = data.data?.days ?? [];

  return (
    <RtmPage
      page={tourPlanSetup}
      actions={
        data.data &&
        editable && (
          <Button variant="primary" onClick={save} loading={saving}>
            Save tour plan
          </Button>
        )
      }
    >
      <FilterBar>
        <SelectField
          label="Employee"
          className="w-72"
          value={employeeId}
          onChange={(e) => setEmployeeId(e.target.value)}
          options={options(tsms.data, (t) => `${t.code} · ${t.name}${t.territories.length ? ` (${t.territories.join(", ")})` : ""}`, (t) => t.id, tsms.loading ? "Loading TSMs…" : tsms.data?.length ? "Select TSM" : "No TSMs found")}
          hint={tsms.data && !tsms.data.length ? "TSMs are employees with a TSM designation or assigned on the Territory layer." : undefined}
        />
        <SelectField label="Month" className="w-40" value={month} onChange={(e) => setMonth(e.target.value)} options={["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"].map((m, i) => ({ value: String(i + 1), label: m }))} />
        <SelectField label="Year" className="w-28" value={year} onChange={(e) => setYear(e.target.value)} options={[-1, 0, 1].map((o) => String(now.getFullYear() + o)).map((y) => ({ value: y, label: y }))} />
        <Button variant="primary" onClick={generate} loading={data.loading} className="mb-px">
          {!data.loading && <CalendarRange />} Generate tour plan
        </Button>
      </FilterBar>

      {!target ? (
        <EmptyState title="Generate a tour plan">Choose a TSM, the month and year, then Generate tour plan.</EmptyState>
      ) : data.error ? (
        <ErrorState message={data.error.message} onRetry={data.reload} />
      ) : !data.data ? (
        <LoadingState />
      ) : (
        <Card>
          <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-2.5">
            <h2 className="mr-auto text-sm font-semibold text-ink">
              {tsm ? `${tsm.code} · ${tsm.name}` : "Tour plan"} <span className="ml-1 text-xs font-medium text-ink-muted">{new Date(Date.UTC(Number(target.year), Number(target.month) - 1, 1)).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" })}</span>
            </h2>
            <span className="text-xs text-ink-muted">{days.filter((d) => d.plan).length} of {days.length} days saved</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[12px]">
              <thead className="bg-grid-head text-xs text-grid-head-ink">
                <tr className="border-y border-grid-head-line">
                  {["SL", "Date", "Day", "Priority", "Activity", "Point", "Start Time", "End Time", "Remarks", "Action"].map((h) => (
                    <th key={h} scope="col" className={cn("border-r border-grid-head-line px-2 py-2 text-left font-bold whitespace-nowrap first:border-l", h === "SL" && "text-right")}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {days.map((d, i) => {
                  const r = rows[d.date] ?? emptyRow(d);
                  const off = d.dayType ? OFF_DAY[d.dayType] : undefined;
                  const ro = locked(d) || !editable;
                  return (
                    <tr key={d.date} className={cn("border-b border-line align-middle", off && "bg-canvas")}>
                      <td className="px-2 py-1 text-right tabular-nums">{i + 1}</td>
                      <td className="px-2 py-1 whitespace-nowrap tabular-nums">{d.date}</td>
                      <td className="px-2 py-1 whitespace-nowrap">
                        {WEEKDAY(d.date)}
                        {off && <span className="ml-1 text-[11px] font-semibold text-warning">{off}</span>}
                      </td>
                      <td className="px-2 py-1">
                        <select aria-label={`Priority on ${d.date}`} disabled={ro} value={r.priority} onChange={(e) => setRow(d.date, { priority: e.target.value })} className={cn(CONTROL, "h-7 w-24")}>
                          {PRIORITIES.map((p) => (
                            <option key={p.value} value={p.value}>{p.label}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-2 py-1">
                        <select aria-label={`Activity on ${d.date}`} disabled={ro} value={r.activity} onChange={(e) => setRow(d.date, { activity: e.target.value })} className={cn(CONTROL, "h-7 w-36")}>
                          <option value="">—</option>
                          {[...new Set([...ACTIVITIES, ...(r.activity ? [r.activity] : [])])].map((a) => (
                            <option key={a} value={a}>{a}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-2 py-1">
                        <select aria-label={`Point on ${d.date}`} disabled={ro} value={r.pointNodeId} onChange={(e) => setRow(d.date, { pointNodeId: e.target.value })} className={cn(CONTROL, "h-7 w-44")}>
                          <option value="">—</option>
                          {points.map((p) => (
                            <option key={p.id} value={p.id}>{p.name} ({p.layer})</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-2 py-1">
                        <input aria-label={`Start time on ${d.date}`} type="time" disabled={ro} value={r.startTime} onChange={(e) => setRow(d.date, { startTime: e.target.value })} className={cn(CONTROL, "h-7 w-28")} />
                      </td>
                      <td className="px-2 py-1">
                        <input aria-label={`End time on ${d.date}`} type="time" disabled={ro} value={r.endTime} min={r.startTime || undefined} onChange={(e) => setRow(d.date, { endTime: e.target.value })} className={cn(CONTROL, "h-7 w-28", r.startTime && r.endTime && r.endTime <= r.startTime && "border-danger")} />
                      </td>
                      <td className="px-2 py-1">
                        <input aria-label={`Remarks on ${d.date}`} disabled={ro} value={r.remarks} maxLength={300} placeholder={d.dayRemarks ?? ""} onChange={(e) => setRow(d.date, { remarks: e.target.value })} className={cn(CONTROL, "h-7 min-w-40")} />
                      </td>
                      <td className="px-2 py-1">
                        <div className="flex items-center gap-0.5 whitespace-nowrap">
                          {d.plan && <StatusBadge status={d.plan.status} labels={TOUR_LABELS} />}
                          {can.approve && d.plan?.status === "PENDING" && (
                            <>
                              <Button variant="ghost" size="icon" aria-label={`Approve ${d.date}`} title="Approve" className="hover:text-success" loading={busy === `a-${d.plan.id}`} onClick={() => run(`a-${d.plan!.id}`, () => rtmApi.post(`tour-plan-setup/${d.plan!.id}/approve`), `${d.date} approved.`)}>
                                {busy !== `a-${d.plan.id}` && <Check />}
                              </Button>
                              <Button variant="ghost" size="icon" aria-label={`Reject ${d.date}`} title="Reject" className="hover:text-danger" loading={busy === `r-${d.plan.id}`} onClick={() => run(`r-${d.plan!.id}`, () => rtmApi.post(`tour-plan-setup/${d.plan!.id}/reject`), `${d.date} rejected.`)}>
                                {busy !== `r-${d.plan.id}` && <X />}
                              </Button>
                            </>
                          )}
                          {!ro && (r.activity || r.priority || r.pointNodeId || r.remarks) && (
                            <Button variant="ghost" size="icon" aria-label={`Clear ${d.date}`} title="Clear the day (saved on Save)" onClick={() => setRow(d.date, { priority: "", activity: "", pointNodeId: "", remarks: "" })}>
                              <Eraser />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {editable && (
            <div className="flex justify-end border-t border-line px-4 py-2.5">
              <Button variant="primary" onClick={save} loading={saving}>
                Save tour plan
              </Button>
            </div>
          )}
        </Card>
      )}
    </RtmPage>
  );
}

// ── Sales Layer Transfer ─────────────────────────────────────────────────────

interface LayerNode {
  id: string;
  code: string;
  name: string;
  layerId: string;
  layer: string;
  level: number;
  parentId: string | null;
  parent: string | null;
  children: number;
  employees: { id: string; code: string; name: string; channel: string | null }[];
}

interface LayerTransfer {
  id: string;
  number: string;
  transferDate: string;
  type: "EMPLOYEE" | "AREA";
  layer: string;
  source: { code: string; name: string; parent: string | null };
  destination: { code: string; name: string; parent: string | null };
  employee: string | null;
  remarks: string | null;
  status: string;
  requestedBy: string;
  approvedBy: string | null;
  appliedAt: string | null;
  updatedAt: string;
}

const LAYER_TRANSFER_TYPES = [
  { value: "EMPLOYEE", label: "Employee transfer" },
  { value: "AREA", label: "Area transfer" },
];
const typeLabel = (t: string) => LAYER_TRANSFER_TYPES.find((x) => x.value === t)?.label ?? t;
const LAYER_STATUS_LABELS = { PENDING: "Pending approval", COMPLETED: "Applied", REJECTED: "Rejected" };
const LAYER_STATUSES = [
  { value: "", label: "All statuses" },
  { value: "PENDING", label: "Pending approval" },
  { value: "COMPLETED", label: "Applied" },
  { value: "REJECTED", label: "Rejected" },
];

/** Layers present in the tree, by level (several business units' layers of a level show once). */
const layersOf = (nodes: LayerNode[]) => [...new Map(nodes.map((n) => [n.level, { level: n.level, name: n.layer }])).values()].sort((a, b) => a.level - b.level);
const nodeText = (n: { code?: string; name: string; parent: string | null }) => (n.parent ? `${n.name} (${n.parent})` : n.name);

export function SalesLayerTransferView() {
  const nodes = useResource("rtm-sales-layer-nodes", () => rtmApi.get<LayerNode[]>("sales-layer-transfer/nodes"));
  const can = useFeaturePermissions(rtmPaths.salesLayerTransfer);
  const [draft, setDraft] = useState({ status: "", layerLevel: "", type: "", from: monthStart(), to: today() });
  const [applied, setApplied] = useState(draft);
  const key = JSON.stringify(applied);
  const list = useResource(`rtm-layer-transfers-${key}`, () => rtmApi.get<LayerTransfer[]>("sales-layer-transfer", applied));
  const [creating, setCreating] = useState(false);
  const [viewing, setViewing] = useState<LayerTransfer | null>(null);
  const { busy, run } = useAction(() => {
    list.reload();
    nodes.reload();
  });
  const layers = layersOf(nodes.data ?? []);
  const set = (patch: Partial<typeof draft>) => setDraft((d) => ({ ...d, ...patch }));
  const view = () => (JSON.stringify(draft) === key ? list.reload() : setApplied(draft));
  const columns: Column<LayerTransfer>[] = [
    { id: "sl", header: "SL", cell: (_t, i) => i + 1, className: "w-12 text-right tabular-nums" },
    {
      id: "action",
      header: "Action",
      cell: (t) => (
        <div className="flex items-center gap-0.5">
          <Button variant="ghost" size="icon" aria-label={`View ${t.number}`} title="View" onClick={() => setViewing(t)}>
            <Eye />
          </Button>
          {can.approve && t.status === "PENDING" && (
            <>
              <Button variant="ghost" size="icon" aria-label={`Approve ${t.number}`} title="Approve" className="hover:text-success" loading={busy === `a-${t.id}`} onClick={() => run(`a-${t.id}`, () => rtmApi.post(`sales-layer-transfer/${t.id}/approve`), `${t.number} approved.`)}>
                {busy !== `a-${t.id}` && <Check />}
              </Button>
              <Button variant="ghost" size="icon" aria-label={`Reject ${t.number}`} title="Reject" className="hover:text-danger" loading={busy === `r-${t.id}`} onClick={() => run(`r-${t.id}`, () => rtmApi.post(`sales-layer-transfer/${t.id}/reject`), `${t.number} rejected.`)}>
                {busy !== `r-${t.id}` && <X />}
              </Button>
            </>
          )}
        </div>
      ),
      className: "w-28",
    },
    { id: "number", header: "Transfer ID", cell: (t) => <span className="font-mono text-xs font-semibold">{t.number}</span>, sortValue: (t) => t.number },
    { id: "type", header: "Transfer Type", cell: (t) => (t.employee ? <span className="flex flex-col"><span>{typeLabel(t.type)}</span><span className="text-[11px] text-ink-faint">{t.employee}</span></span> : typeLabel(t.type)) },
    { id: "source", header: "Source", cell: (t) => <span className="flex flex-col"><span>{t.source.name}</span><span className="text-[11px] text-ink-faint">{t.layer}{t.source.parent ? ` · ${t.source.parent}` : ""}</span></span> },
    { id: "destination", header: "Destination", cell: (t) => <span className="flex flex-col"><span>{t.destination.name}</span><span className="text-[11px] text-ink-faint">{t.layer}{t.destination.parent ? ` · ${t.destination.parent}` : ""}</span></span> },
    { id: "status", header: "Status", cell: (t) => <StatusBadge status={t.status} labels={LAYER_STATUS_LABELS} /> },
  ];
  return (
    <RtmPage page={salesLayerTransfer} actions={can.create && <Button variant="primary" onClick={() => setCreating(true)}><Plus /> Sales Layer Transfer</Button>}>
      <FilterBar>
        <SelectField label="Status" className="w-40" value={draft.status} onChange={(e) => set({ status: e.target.value })} options={LAYER_STATUSES} />
        <SelectField label="Layer" className="w-44" value={draft.layerLevel} onChange={(e) => set({ layerLevel: e.target.value })} options={[{ value: "", label: "All layers" }, ...layers.map((l) => ({ value: String(l.level), label: l.name }))]} />
        <SelectField label="Transfer Type" className="w-44" value={draft.type} onChange={(e) => set({ type: e.target.value })} options={[{ value: "", label: "All types" }, ...LAYER_TRANSFER_TYPES]} />
        <DateRange from={draft.from} to={draft.to} onChange={(from, to) => set({ from, to })} />
        <Button variant="primary" loading={list.loading} onClick={view} className="mb-px">
          {!list.loading && <Eye />} View
        </Button>
      </FilterBar>
      {list.error ? (
        <ErrorState message={list.error.message} onRetry={list.reload} />
      ) : !list.data ? (
        <LoadingState />
      ) : (
        <Card>
          <DataTable sheet rows={list.data} columns={columns} getRowId={(t) => t.id} getRowLabel={(t) => t.number} emptyState={<EmptyState title="No transfers">Nothing was transferred for these filters.</EmptyState>} />
        </Card>
      )}
      {creating && <LayerTransferDialog nodes={nodes.data ?? []} onClose={() => setCreating(false)} onDone={list.reload} />}
      {viewing && (
        <Dialog open size="lg" title={`Sales Layer Transfer ${viewing.number}`} description={`${typeLabel(viewing.type)} · ${viewing.layer}`} onClose={() => setViewing(null)} footer={<Button onClick={() => setViewing(null)}>Close</Button>}>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-[13px]">
            {(
              [
                ["Date", viewing.transferDate],
                ["Status", <StatusBadge key="s" status={viewing.status} labels={LAYER_STATUS_LABELS} />],
                ["Source", nodeText(viewing.source)],
                ["Destination", nodeText(viewing.destination)],
                ["Employee", viewing.employee],
                ["Requested by", viewing.requestedBy],
                ["Approved by", viewing.approvedBy],
                ["Applied", viewing.appliedAt ? formatDateTime(viewing.appliedAt) : null],
                ["Remarks", viewing.remarks],
              ] as [string, ReactNode][]
            ).map(([label, value]) => (
              <div key={label} className="flex flex-col">
                <dt className="text-xs font-medium text-ink-muted">{label}</dt>
                <dd className="text-ink">{value || "—"}</dd>
              </div>
            ))}
          </dl>
        </Dialog>
      )}
    </RtmPage>
  );
}

function LayerTransferDialog({ nodes, onClose, onDone }: { nodes: LayerNode[]; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const layers = layersOf(nodes);
  const [level, setLevel] = useState("");
  const [type, setType] = useState<"EMPLOYEE" | "AREA">("EMPLOYEE");
  const [sourceId, setSourceId] = useState("");
  const [destinationId, setDestinationId] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [remarks, setRemarks] = useState("");
  const [saving, setSaving] = useState(false);
  const onLayer = nodes.filter((n) => String(n.level) === level);
  const source = nodes.find((n) => n.id === sourceId);
  // Same layer and business unit (the layer id is per business unit).
  const destinations = onLayer.filter((n) => n.id !== sourceId && (!source || n.layerId === source.layerId));
  const sources = onLayer.filter((n) => (type === "EMPLOYEE" ? n.employees.length > 0 : n.children > 0));
  const nodeOptions = (list: LayerNode[], placeholder: string) => [{ value: "", label: placeholder }, ...list.map((n) => ({ value: n.id, label: `${nodeText(n)}${type === "AREA" ? ` · ${n.children} under it` : ""}` }))];
  const submit = async () => {
    const problem = !level ? "Choose the layer." : !sourceId ? "Choose the source." : !destinationId ? "Choose the destination." : type === "EMPLOYEE" && !employeeId ? "Choose the employee to move." : null;
    if (problem) {
      toast.error(problem);
      return;
    }
    setSaving(true);
    try {
      await rtmApi.post("sales-layer-transfer", { type, sourceNodeId: sourceId, destinationNodeId: destinationId, employeeId: type === "EMPLOYEE" ? employeeId : undefined, remarks });
      toast.success("Transfer sent for approval. It applies once approved.");
      onDone();
      onClose();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSaving(false);
    }
  };
  return (
    <Dialog
      open
      size="xl"
      title="Sales Layer Transfer"
      onClose={onClose}
      onSubmit={submit}
      footer={
        <>
          <Button onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="submit" variant="primary" loading={saving}>Save</Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <section className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold text-ink">Effective</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <SelectField
              label="Layer"
              required
              value={level}
              onChange={(e) => {
                setLevel(e.target.value);
                setSourceId("");
                setDestinationId("");
                setEmployeeId("");
              }}
              options={[{ value: "", label: "Select layer" }, ...layers.map((l) => ({ value: String(l.level), label: l.name }))]}
            />
            <SelectField
              label="Transfer type"
              required
              value={type}
              onChange={(e) => {
                setType(e.target.value as "EMPLOYEE" | "AREA");
                setSourceId("");
                setEmployeeId("");
              }}
              options={LAYER_TRANSFER_TYPES}
              hint={type === "EMPLOYEE" ? "One sales person moves to another node of this layer." : "Everything under the source (child areas and their people) moves to the destination."}
            />
          </div>
        </section>
        <section className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold text-ink">Layer</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <SelectField
              label="From source layer"
              required
              disabled={!level}
              value={sourceId}
              onChange={(e) => {
                setSourceId(e.target.value);
                setEmployeeId("");
                if (e.target.value === destinationId) setDestinationId("");
              }}
              options={nodeOptions(sources, level && !sources.length ? (type === "EMPLOYEE" ? "No node has employees" : "No node has areas under it") : "Select source")}
            />
            <SelectField label="To destination layer" required disabled={!sourceId} value={destinationId} onChange={(e) => setDestinationId(e.target.value)} options={nodeOptions(destinations, "Select destination")} />
            {type === "EMPLOYEE" && (
              <SelectField label="Employee" required disabled={!source} value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} options={[{ value: "", label: "Select employee" }, ...(source?.employees ?? []).map((e) => ({ value: e.id, label: `${e.code} · ${e.name}` }))]} />
            )}
            <TextField label="Remarks" value={remarks} maxLength={500} onChange={(e) => setRemarks(e.target.value)} className={type === "EMPLOYEE" ? undefined : "sm:col-span-2"} />
          </div>
        </section>
      </div>
    </Dialog>
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

interface EmployeeActivityRow {
  employeeId: string;
  code: string;
  name: string;
  designation: string | null;
  lastActivityAt: string | null;
  lastActivity: string | null;
  location: { latitude: number; longitude: number; at: string; outlet: string | null } | null;
}

interface AreaActivityRow {
  nodeId: string;
  code: string;
  name: string;
  layer: string;
  parent: string | null;
  salesForce: number;
  activeToday: number;
  lastActivityAt: string | null;
  lastBy: string | null;
  location: { latitude: number; longitude: number; outlet: string | null } | null;
}

const mapUrl = (l: { latitude: number; longitude: number }) => `https://www.google.com/maps?q=${l.latitude},${l.longitude}`;

export function EmployeeTrackingView() {
  const territory = useTerritory();
  const [layers, setLayers] = useState<Record<string, string>>({});
  const [srId, setSrId] = useState("");
  const [applied, setApplied] = useState({ nodeId: "", srId: "" });
  const [tab, setTab] = useState<"employee" | "area">("employee");
  const appliedKey = `${applied.nodeId}-${applied.srId}`;
  const list = useResource(tab === "employee" ? `rtm-emp-activity-${appliedKey}` : null, () => rtmApi.get<EmployeeActivityRow[]>("employee-tracking/employees", applied));
  const areas = useResource(tab === "area" ? `rtm-area-activity-${appliedKey}` : null, () => rtmApi.get<AreaActivityRow[]>("employee-tracking/areas", applied));
  const active = tab === "employee" ? list : areas;
  const [query, setQuery] = useState("");
  const [viewing, setViewing] = useState<EmployeeActivityRow | null>(null);
  const filter = () => {
    const next = { nodeId: deepestNode(territory.data, layers), srId };
    if (next.nodeId === applied.nodeId && next.srId === applied.srId) active.reload();
    else setApplied(next);
  };
  /** Area wise › View: the area's people, with the filters set to that area. */
  const drill = (nodeId: string) => {
    const all = territory.data?.layers ?? [];
    const node = all.flatMap((l) => l.nodes).find((n) => n.id === nodeId);
    const next: Record<string, string> = {};
    for (const id of node?.path ?? []) {
      const layer = all.find((l) => l.nodes.some((n) => n.id === id));
      if (layer) next[layer.id] = id;
    }
    setLayers(next);
    setApplied({ nodeId, srId });
    setTab("employee");
  };
  const areaColumns: Column<AreaActivityRow>[] = [
    { id: "sl", header: "SL", cell: (_r, i) => i + 1, className: "w-12 text-right tabular-nums" },
    {
      id: "area",
      header: "Area",
      cell: (a) => (
        <span className="flex flex-col">
          <span className="font-semibold text-ink">{a.name}</span>
          <span className="text-[11px] text-ink-faint">{a.layer}{a.parent ? ` · ${a.parent}` : ""}</span>
        </span>
      ),
      sortValue: (a) => a.name,
    },
    { id: "force", header: "Sales Force", cell: (a) => a.salesForce, sortValue: (a) => a.salesForce, className: "text-right tabular-nums" },
    {
      id: "active",
      header: "Active Today",
      cell: (a) => <span className={cn(a.salesForce > 0 && a.activeToday < a.salesForce && "text-warning")}>{a.activeToday} / {a.salesForce}</span>,
      sortValue: (a) => a.activeToday,
      className: "text-right tabular-nums",
    },
    {
      id: "last",
      header: "Last Activity Date Time",
      cell: (a) =>
        a.lastActivityAt ? (
          <span className="flex flex-col">
            <span className="tabular-nums">{formatDateTime(a.lastActivityAt)}</span>
            <span className="text-[11px] text-ink-faint">{a.lastBy}</span>
          </span>
        ) : (
          <span className="text-ink-faint">No activity yet</span>
        ),
      sortValue: (a) => a.lastActivityAt ?? "",
    },
    {
      id: "location",
      header: "Last Update Location",
      cell: (a) =>
        a.location ? (
          <a href={mapUrl(a.location)} target="_blank" rel="noreferrer" className="inline-flex flex-col hover:underline" title="Open in Google Maps">
            <span className="inline-flex items-center gap-1 text-xs tabular-nums">
              <MapPin aria-hidden="true" className="size-3.5 text-ink-faint" />
              {a.location.latitude.toFixed(5)}, {a.location.longitude.toFixed(5)}
            </span>
            {a.location.outlet && <span className="text-[11px] text-ink-faint">{a.location.outlet}</span>}
          </a>
        ) : (
          <span className="text-ink-faint">—</span>
        ),
    },
    {
      id: "action",
      header: "Action",
      cell: (a) => (
        <Button variant="ghost" size="icon" aria-label={`View the sales force of ${a.name}`} title="View its sales force" onClick={() => drill(a.nodeId)}>
          <Eye />
        </Button>
      ),
      className: "w-16",
    },
  ];
  const q = query.trim().toLowerCase();
  const rows = (list.data ?? []).filter((r) => !q || `${r.code} ${r.name} ${r.designation ?? ""}`.toLowerCase().includes(q));
  const columns: Column<EmployeeActivityRow>[] = [
    { id: "sl", header: "SL", cell: (_r, i) => i + 1, className: "w-12 text-right tabular-nums" },
    { id: "code", header: "Code", cell: (r) => <span className="font-mono text-xs font-semibold">{r.code}</span>, sortValue: (r) => r.code },
    { id: "name", header: "Name", cell: (r) => <span className="font-semibold text-ink">{r.name}</span>, sortValue: (r) => r.name },
    { id: "designation", header: "Designation", cell: (r) => r.designation ?? "—" },
    {
      id: "last",
      header: "Last Activity Date Time",
      cell: (r) =>
        r.lastActivityAt ? (
          <span className="flex flex-col">
            <span className="tabular-nums">{formatDateTime(r.lastActivityAt)}</span>
            <span className="text-[11px] text-ink-faint">{KIND_LABELS[r.lastActivity ?? ""] ?? r.lastActivity}</span>
          </span>
        ) : (
          <span className="text-ink-faint">No activity yet</span>
        ),
      sortValue: (r) => r.lastActivityAt ?? "",
    },
    {
      id: "location",
      header: "Last Update Location",
      cell: (r) =>
        r.location ? (
          <a href={mapUrl(r.location)} target="_blank" rel="noreferrer" className="inline-flex flex-col hover:underline" title="Open in Google Maps">
            <span className="inline-flex items-center gap-1 text-xs tabular-nums">
              <MapPin aria-hidden="true" className="size-3.5 text-ink-faint" />
              {r.location.latitude.toFixed(5)}, {r.location.longitude.toFixed(5)}
            </span>
            <span className="text-[11px] text-ink-faint">{r.location.outlet ?? formatDateTime(r.location.at)}</span>
          </a>
        ) : (
          <span className="text-ink-faint">—</span>
        ),
    },
    {
      id: "action",
      header: "Action",
      cell: (r) => (
        <Button variant="ghost" size="icon" aria-label={`View ${r.name}'s day`} title="View the day's trail" disabled={!r.lastActivityAt} onClick={() => setViewing(r)}>
          <Eye />
        </Button>
      ),
      className: "w-16",
    },
  ];
  return (
    <RtmPage page={employeeTracking}>
      <FilterBar>
        <LayerFields
          value={layers}
          srId={srId}
          territory={territory.data}
          onChange={(l, sr) => {
            setLayers(l);
            setSrId(sr);
          }}
        />
        <Button variant="primary" loading={active.loading} onClick={filter} className="mb-px">
          {!active.loading && <Filter />} Filter
        </Button>
      </FilterBar>
      <Tabs label="Employee tracking" value={tab} onChange={setTab} tabs={[{ id: "employee", label: "Employee wise" }, { id: "area", label: "Area wise" }]}>
      {tab === "area" ? (
        areas.error ? (
          <ErrorState message={areas.error.message} onRetry={areas.reload} />
        ) : !areas.data ? (
          <LoadingState />
        ) : (
          <Card>
            <DataTable sheet rows={areas.data} columns={areaColumns} getRowId={(a) => a.nodeId} getRowLabel={(a) => a.name} emptyState={<EmptyState title="No areas">Set up the Sales Territory tree in Configuration › Sales Setup.</EmptyState>} />
          </Card>
        )
      ) : list.error ? (
        <ErrorState message={list.error.message} onRetry={list.reload} />
      ) : !list.data ? (
        <LoadingState />
      ) : (
        <Card>
          <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-2.5">
            <h2 className="mr-auto text-sm font-semibold text-ink">
              Employee wise <span className="ml-1 text-xs font-medium text-ink-muted tabular-nums">{rows.length}</span>
            </h2>
            <label className="relative w-full sm:w-64">
              <span className="sr-only">Search employee</span>
              <Search aria-hidden="true" className="pointer-events-none absolute top-2 left-2 size-4 text-ink-faint" />
              <input type="search" value={query} placeholder="Search code, name…" onChange={(e) => setQuery(e.target.value)} className={cn(CONTROL, "h-8 pl-7")} />
            </label>
          </div>
          <DataTable sheet rows={rows} columns={columns} getRowId={(r) => r.employeeId} getRowLabel={(r) => r.name} emptyState={<EmptyState title="No sales force here">No one is assigned to this part of the sales territory.</EmptyState>} />
        </Card>
      )}
      </Tabs>
      {viewing?.lastActivityAt && <DayTrail employee={viewing} date={viewing.lastActivityAt.slice(0, 10)} onClose={() => setViewing(null)} />}
    </RtmPage>
  );
}

/** One employee's field day: check-in, visits and check-out. */
function DayTrail({ employee, date: initial, onClose }: { employee: EmployeeActivityRow; date: string; onClose: () => void }) {
  const [date, setDate] = useState(initial);
  const data = useResource(`rtm-emp-trail-${employee.employeeId}-${date}`, () => rtmApi.get<TrackingData>("employee-tracking", { date, employeeId: employee.employeeId }));
  const day = data.data?.summary[0];
  return (
    <Dialog open size="xl" title={`${employee.code} · ${employee.name}`} description={employee.designation ?? undefined} onClose={onClose} footer={<Button onClick={onClose}>Close</Button>}>
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end gap-4">
          <TextField label="Date" type="date" value={date} max={today()} onChange={(e) => setDate(e.target.value)} className="w-44" />
          {day && (
            <dl className="flex flex-wrap gap-x-6 gap-y-1 text-[13px]">
              <div><dt className="text-xs text-ink-muted">Check-in</dt><dd className={cn("tabular-nums", day.late && "text-warning")}>{day.checkIn ?? "—"}{day.late && " (Late)"}</dd></div>
              <div><dt className="text-xs text-ink-muted">Check-out</dt><dd className="tabular-nums">{day.checkOut ?? "—"}</dd></div>
              <div><dt className="text-xs text-ink-muted">Visits</dt><dd className="tabular-nums">{day.visits}</dd></div>
              <div><dt className="text-xs text-ink-muted">Outlets</dt><dd className="tabular-nums">{day.outletsVisited}</dd></div>
            </dl>
          )}
        </div>
        {data.error ? (
          <ErrorState message={data.error.message} onRetry={data.reload} />
        ) : !data.data ? (
          <LoadingState />
        ) : (
          <SimpleTable
            rows={data.data.visits}
            empty="No activity recorded on this day."
            columns={[
              { header: "Time", cell: (v) => <span className="tabular-nums">{v.time}</span> },
              { header: "Type", cell: (v) => <Badge variant={v.kind === "CHECK_IN" ? "primary" : v.kind === "CHECK_OUT" ? "neutral" : "success"}>{KIND_LABELS[v.kind] ?? v.kind}</Badge> },
              { header: "Outlet", cell: (v) => v.outlet ?? "—" },
              {
                header: "Location",
                cell: (v) =>
                  v.latitude !== null && v.longitude !== null ? (
                    <a href={mapUrl({ latitude: v.latitude, longitude: v.longitude })} target="_blank" rel="noreferrer" className="text-xs tabular-nums hover:underline">
                      {v.latitude.toFixed(5)}, {v.longitude.toFixed(5)}
                    </a>
                  ) : (
                    "—"
                  ),
              },
              { header: "Remarks", cell: (v) => v.remarks ?? "—" },
            ]}
          />
        )}
      </div>
    </Dialog>
  );
}

// ── Outlet Tracking ──────────────────────────────────────────────────────────

interface OutletTrackingData {
  sr: { id: string; name: string };
  date: string;
  start: { at: string; latitude: number; longitude: number; label: string } | null;
  totalKm: number | null;
  counts: { visited: number; order: number; noOrder: number; pending: number; total: number };
  activity: { id: string; kind: string; at: string; outlet: string | null; status: OutletDayStatus | null; latitude: number | null; longitude: number | null; remarks: string | null }[];
  path: RoutePoint[];
  outlets: (MapOutlet & { orderValue: number })[];
}

/** A small coloured dot for the legend and lists. */
function Dot({ color }: { color: string }) {
  return <span aria-hidden="true" className="inline-block size-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />;
}

function CountChip({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded border px-2 py-0.5 text-[11px] font-semibold tracking-wide tabular-nums" style={{ borderColor: color, color }}>
      {label}: {value}
    </span>
  );
}

export function OutletTrackingView() {
  const territory = useTerritory();
  const [date, setDate] = useState(today());
  const [layers, setLayers] = useState<Record<string, string>>({});
  const [srId, setSrId] = useState("");
  const [applied, setApplied] = useState<{ date: string; srId: string; nodeId: string } | null>(null);
  const [srError, setSrError] = useState<string | undefined>();
  const key = applied ? `rtm-outlet-tracking-${applied.date}-${applied.srId}-${applied.nodeId}` : null;
  const data = useResource(key, () => rtmApi.get<OutletTrackingData>("outlet-tracking", applied ?? {}));

  const track = () => {
    if (!srId) {
      setSrError("Select a sales representative.");
      return;
    }
    setSrError(undefined);
    const next = { date, srId, nodeId: deepestNode(territory.data, layers) };
    if (applied && next.date === applied.date && next.srId === applied.srId && next.nodeId === applied.nodeId) data.reload();
    else setApplied(next);
  };

  const day = data.data;
  const counts = day?.counts ?? { visited: 0, order: 0, noOrder: 0, pending: 0, total: 0 };
  const pending = (day?.outlets ?? []).filter((o) => o.status === "PENDING");
  const isToday = applied?.date === today();

  return (
    <RtmPage page={outletTracking}>
      <FilterBar>
        <TextField label="Select Schedule Date" type="date" value={date} max={today()} onChange={(e) => setDate(e.target.value)} className="w-44" />
        <LayerFields
          value={layers}
          srId={srId}
          territory={territory.data}
          withSr={false}
          onChange={(l, sr) => {
            setLayers(l);
            setSrId(sr);
          }}
        />
        <SelectField
          label="Sales Representative"
          required
          className="w-64"
          value={srId}
          error={srError}
          onChange={(e) => {
            setSrId(e.target.value);
            if (e.target.value) setSrError(undefined);
          }}
          options={options(
            (territory.data?.salesForce ?? []).filter((s) => {
              const node = deepestNode(territory.data, layers);
              return !node || s.nodeIds.includes(node);
            }),
            (s) => `${s.name} (${s.code})`,
            (s) => s.id,
            "Select…",
          )}
        />
        <Button variant="primary" loading={data.loading} onClick={track} className="mb-px">
          {!data.loading && <Search />} Track
        </Button>
      </FilterBar>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {isToday && <Badge variant="danger">Live tracking</Badge>}
        <h2 className="text-sm font-semibold tracking-wide text-ink uppercase">Actual travel route (GPS tracked path)</h2>
        <div className="flex flex-wrap gap-1.5">
          <CountChip label="Visited" value={counts.visited} color="#475569" />
          <CountChip label="Order" value={counts.order} color={STATUS_COLORS.ORDER} />
          <CountChip label="No Order" value={counts.noOrder} color={STATUS_COLORS.NO_ORDER} />
          <CountChip label="Pending" value={counts.pending} color={STATUS_COLORS.PENDING} />
          <CountChip label="Total Outlet" value={counts.total} color="#475569" />
        </div>
        <ul className="ml-auto flex flex-wrap gap-x-4 gap-y-1 text-xs font-medium text-ink-muted" aria-label="Map legend">
          <li className="flex items-center gap-1.5"><Dot color={STATUS_COLORS.START} /> Start Point</li>
          <li className="flex items-center gap-1.5"><Dot color={STATUS_COLORS.ORDER} /> Order</li>
          <li className="flex items-center gap-1.5"><Dot color={STATUS_COLORS.NO_ORDER} /> No Order</li>
          <li className="flex items-center gap-1.5"><Dot color={STATUS_COLORS.PENDING} /> Pending Visit</li>
        </ul>
      </div>

      {data.error && <ErrorState message={data.error.message} onRetry={data.reload} />}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="relative">
          <RouteMap path={day?.path ?? EMPTY_PATH} outlets={day?.outlets ?? EMPTY_OUTLETS} />
          {!applied && (
            <p className="pointer-events-none absolute inset-x-0 top-4 mx-auto w-fit rounded border border-line bg-surface/95 px-3 py-1.5 text-xs font-medium text-ink-muted shadow-xs">
              Pick a sales representative and press Track.
            </p>
          )}
        </div>

        <aside className="flex flex-col gap-4">
          <Card className="grid grid-cols-[1fr_auto] divide-x divide-line bg-blue-500/5">
            <div className="px-4 py-3">
              <p className="text-[11px] font-semibold tracking-wide text-ink-muted uppercase">Starting point</p>
              <p className="mt-1 text-sm font-semibold text-ink">{day?.start?.label ?? "N/A"}</p>
              <p className="mt-1 text-xs text-blue-700 tabular-nums">Time: {day?.start ? formatClock(new Date(day.start.at).getTime()) : "N/A"}</p>
            </div>
            <div className="px-4 py-3 text-right">
              <p className="text-[11px] font-semibold tracking-wide text-ink-muted uppercase">Total kilometer</p>
              <p className="mt-1 text-sm font-semibold text-ink tabular-nums">{day?.totalKm != null ? `${day.totalKm.toLocaleString("en-US", { maximumFractionDigits: 2 })} km` : "-"}</p>
            </div>
          </Card>

          <section aria-labelledby="ot-activity">
            <h3 id="ot-activity" className="mb-2 text-xs font-semibold tracking-wide text-ink-muted uppercase">Activity</h3>
            {data.loading && !day ? (
              <LoadingState />
            ) : !day?.activity.length ? (
              <p className="text-[13px] text-ink-muted">No activity recorded yet.</p>
            ) : (
              <ol className="flex max-h-72 flex-col gap-1.5 overflow-y-auto pr-1">
                {day.activity.map((a) => (
                  <li key={a.id} className="flex items-start gap-2 rounded border border-line bg-surface px-3 py-2 text-[13px]">
                    <Dot color={a.status ? STATUS_COLORS[a.status] : STATUS_COLORS.START} />
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate font-semibold text-ink">{a.outlet ?? KIND_LABELS[a.kind] ?? a.kind}</span>
                      <span className="text-[11px] text-ink-faint">
                        {KIND_LABELS[a.kind] ?? a.kind}
                        {a.status ? ` · ${STATUS_LABELS[a.status]}` : ""}
                        {a.latitude === null ? " · no location" : ""}
                      </span>
                    </span>
                    <span className="shrink-0 text-xs text-ink-muted tabular-nums">{formatClock(new Date(a.at).getTime())}</span>
                  </li>
                ))}
              </ol>
            )}
          </section>

          <section aria-labelledby="ot-pending">
            <h3 id="ot-pending" className="mb-2 text-xs font-semibold tracking-wide text-ink-muted uppercase">
              Pending outlets {pending.length > 0 && <span className="tabular-nums">({pending.length})</span>}
            </h3>
            {!pending.length ? (
              <p className="text-[13px] text-ink-muted">No pending outlets for this day.</p>
            ) : (
              <ul className="flex max-h-72 flex-col gap-1.5 overflow-y-auto pr-1">
                {pending.map((o) => (
                  <li key={o.id} className="flex items-start gap-2 rounded border border-line bg-surface px-3 py-2 text-[13px]">
                    <Dot color={STATUS_COLORS.PENDING} />
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate font-semibold text-ink">{o.code} · {o.name}</span>
                      {o.address && <span className="truncate text-[11px] text-ink-faint">{o.address}</span>}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>
      </div>
    </RtmPage>
  );
}

const EMPTY_PATH: RoutePoint[] = [];
const EMPTY_OUTLETS: MapOutlet[] = [];
