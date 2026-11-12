"use client";

import { Check, Clock, Plus, Send, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { PageContainer, PageHead } from "@/components/layout/page";
import { Button } from "@/components/ui/button";
import { ConfirmDialog, Dialog } from "@/components/ui/dialog";
import { ErrorState, LoadingState } from "@/components/ui/section";
import { Tabs } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast";
import { useResource } from "@/hooks/use-resource";
import { apiRequest, errorMessage } from "@/lib/api/client";
import { cn } from "@/lib/cn";
import { resolveBreadcrumbs } from "@/lib/navigation/registry";
import { EmptyBlock, Field, FormGrid, Input, Notice, Select, TABLE } from "@/features/configuration/entity-master-data/employee/components/kit";
import { ApplicationStatusBadge, Grid } from "../../self-service/leave-movement/components/shared";
import { hrmPaths } from "../../paths";
import { FilterBar, FilterField, MonthSelect, OfficeSelect, YearSelect, currentPeriod, formatDate, formatMoney, monthLabel, useHrOptions } from "../../shared/hr-ui";
import {
  OVERTIME_STATUSES,
  formatMinutes,
  parseDuration,
  type CalculatedDay,
  type CalculationResult,
  type EntryInput,
  type EntryRow,
  type OvertimeRule,
  type SummaryResult,
} from "../types";

const TABS = [
  { id: "calculate", label: "OT Calculation" },
  { id: "approval", label: "OT Approval" },
  { id: "summary", label: "Monthly OT Summary" },
] as const;
type TabId = (typeof TABS)[number]["id"];

const td = TABLE.td;
const num = `${TABLE.td} text-right tabular-nums`;
const pad = (n: number) => String(n).padStart(2, "0");
const localDay = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const thisMonthStart = () => `${localDay(new Date()).slice(0, 8)}01`;
const query = (params: Record<string, string>) => new URLSearchParams(Object.entries(params).filter(([, v]) => v)).toString();

export function OvertimeView() {
  const [tab, setTab] = useState<TabId>("calculate");
  const [refresh, setRefresh] = useState(0);
  return (
    <PageContainer full>
      <PageHead
        title="Overtime"
        subtitle="Overtime from attendance punches, its approval, and the monthly OT amount per employee."
        breadcrumbs={resolveBreadcrumbs(hrmPaths.overtime).slice(1)}
      />
      <section className="rounded border border-line bg-surface shadow-xs">
        <Tabs tabs={TABS} value={tab} onChange={setTab} label="Overtime">
          <div className="flex flex-col gap-3 p-4">
            {tab === "calculate" && <CalculateTab refresh={refresh} onSubmitted={() => setRefresh((r) => r + 1)} />}
            {tab === "approval" && <ApprovalTab refresh={refresh} onChanged={() => setRefresh((r) => r + 1)} />}
            {tab === "summary" && <SummaryTab refresh={refresh} />}
          </div>
        </Tabs>
      </section>
    </PageContainer>
  );
}

/** How the office's rule works, in one line. */
function RuleNote({ rule }: { rule: OvertimeRule }) {
  const caps = [rule.minMinutes ? `min. ${rule.minMinutes} min` : "", rule.maxHoursPerDay ? `max. ${rule.maxHoursPerDay} h/day` : "", rule.maxHoursPerMonth ? `max. ${rule.maxHoursPerMonth} h/month` : ""].filter(Boolean);
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded border border-line bg-canvas px-3 py-2 text-xs text-ink-muted">
      <span>
        <strong className="text-ink">OT</strong> = time beyond {rule.hoursPerDay} h a day (all of Friday)
        {caps.length ? ` · ${caps.join(" · ")}` : ""}
      </span>
      <span>
        <strong className="text-ink">Rate</strong> = {rule.basis} ÷ ({rule.daysPerMonth} days × {rule.hoursPerDay} h) × {rule.multiplier}
      </span>
      {!rule.configured && (
        <span className="text-warning">
          No Overtime Setup for this office — Labour Act default.{" "}
          <Link href={hrmPaths.policySettings} className="underline">
            Set it up
          </Link>
        </span>
      )}
    </div>
  );
}

// ─── OT Calculation ──────────────────────────────────────────────────────────

const keyOf = (d: { employeeId: string; date: string }) => `${d.employeeId}:${d.date}`;

function CalculateTab({ refresh, onSubmitted }: { refresh: number; onSubmitted: () => void }) {
  const toast = useToast();
  const options = useHrOptions();
  const [filters, setFilters] = useState({ officeId: "", from: thisMonthStart(), to: localDay(new Date()) });
  const [applied, setApplied] = useState<typeof filters | null>(null);
  const [failure, setFailure] = useState("");
  const result = useResource(applied ? `hrm-ot-calc:${query(applied)}:${refresh}` : null, () => apiRequest<CalculationResult>(`/api/hrm/overtime/calculate?${query(applied!)}`));
  /** Edited OT per row ("2:30"), and the rows chosen for submission. */
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);

  const days = useMemo(() => result.data?.days ?? [], [result.data]);
  const minutesOf = (d: CalculatedDay) => {
    const text = edits[keyOf(d)];
    return text === undefined ? d.overtimeMinutes : parseDuration(text);
  };
  const selectable = days.filter((d) => !d.entry && (minutesOf(d) ?? 0) > 0);
  const allSelected = selectable.length > 0 && selectable.every((d) => selected.has(keyOf(d)));

  function view() {
    if (!filters.officeId) return setFailure("Select an office.");
    if (filters.from > filters.to) return setFailure("From date must be on or before To date.");
    setFailure("");
    setEdits({});
    setSelected(new Set());
    setApplied({ ...filters });
  }

  async function submit() {
    const chosen = days.filter((d) => selected.has(keyOf(d)) && !d.entry);
    const invalid = chosen.find((d) => !((minutesOf(d) ?? 0) > 0));
    if (invalid) return toast.error(`Enter the overtime for ${invalid.employeeName} on ${formatDate(invalid.date)} (e.g. 2:30).`);
    const input: EntryInput = {
      entries: chosen.map((d) => ({
        employeeId: d.employeeId,
        date: d.date,
        minutes: minutesOf(d)!,
        source: "Attendance",
        inTime: d.inTime,
        outTime: d.outTime ?? undefined,
        workedMinutes: d.workedMinutes,
      })),
    };
    setSubmitting(true);
    try {
      const { created } = await apiRequest<{ created: number }>("/api/hrm/overtime", { method: "POST", body: JSON.stringify(input) });
      toast.success(`${created} overtime day${created === 1 ? "" : "s"} sent for approval.`);
      setSelected(new Set());
      onSubmitted();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <FilterBar onSubmit={view} busy={result.loading}>
        <FilterField label="Office *" width="w-60">
          {(id) => <OfficeSelect id={id} options={options.data} value={filters.officeId} allLabel="Select office" onChange={(officeId) => setFilters((f) => ({ ...f, officeId }))} />}
        </FilterField>
        <FilterField label="From Date">{(id) => <Input id={id} type="date" value={filters.from} onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))} />}</FilterField>
        <FilterField label="To Date">{(id) => <Input id={id} type="date" value={filters.to} onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))} />}</FilterField>
      </FilterBar>
      {failure && <Notice tone="error">{failure}</Notice>}

      {!applied ? (
        <EmptyBlock icon={<Clock />} title="Calculate overtime from attendance">
          Choose an office and dates, then View. Overtime is worked out from each OT-eligible employee&apos;s first and last punch of the day.
        </EmptyBlock>
      ) : result.error ? (
        <ErrorState message={result.error.message} onRetry={result.reload} />
      ) : !result.data ? (
        <LoadingState label="Calculating overtime…" />
      ) : (
        <>
          <RuleNote rule={result.data.rule} />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-ink-muted">
              {days.length} attendance day{days.length === 1 ? "" : "s"} · {days.filter((d) => d.overtimeMinutes > 0).length} with overtime
              {result.data.notEligible > 0 && ` · ${result.data.notEligible} employee(s) with punches are not eligible for overtime (Employee › Salary)`}
            </p>
            <div className="flex items-center gap-2">
              <Button onClick={() => setManualOpen(true)} disabled={!result.data.employees.length}>
                <Plus aria-hidden="true" className="size-3.5" />
                Add Manual OT
              </Button>
              <Button variant="primary" loading={submitting} disabled={selected.size === 0} onClick={() => void submit()}>
                <Send aria-hidden="true" className="size-3.5" />
                Submit for Approval ({selected.size})
              </Button>
            </div>
          </div>

          {days.length === 0 ? (
            <EmptyBlock icon={<Clock />} title="No attendance in this range">
              None of this office&apos;s OT-eligible employees has punches between these dates.
            </EmptyBlock>
          ) : (
            <div className={cn(TABLE.wrap, "transition-opacity", result.loading && "opacity-60")}>
              <table className={cn(TABLE.table, "min-w-max")}>
                <thead className={TABLE.head}>
                  <tr>
                    <th scope="col" className={cn(TABLE.th, "w-9 text-center")}>
                      <input
                        type="checkbox"
                        aria-label="Select every day with overtime"
                        checked={allSelected}
                        disabled={selectable.length === 0}
                        onChange={() => setSelected(allSelected ? new Set() : new Set(selectable.map(keyOf)))}
                        className="size-3.5 accent-(--accent-strong)"
                      />
                    </th>
                    {["Date", "Day", "Code", "Employee", "Designation", "In", "Out", "Worked", "Standard", "Overtime", "Status"].map((h) => (
                      <th key={h} scope="col" className={TABLE.th}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {days.map((d) => {
                    const key = keyOf(d);
                    const minutes = minutesOf(d);
                    const canPick = !d.entry && (minutes ?? 0) > 0;
                    return (
                      <tr key={key} className={cn(TABLE.row, selected.has(key) && "bg-accent-soft/40")}>
                        <td className={cn(td, "text-center")}>
                          <input
                            type="checkbox"
                            aria-label={`Select ${d.employeeName} on ${formatDate(d.date)}`}
                            checked={selected.has(key)}
                            disabled={!canPick}
                            onChange={() =>
                              setSelected((current) => {
                                const next = new Set(current);
                                if (next.has(key)) next.delete(key);
                                else next.add(key);
                                return next;
                              })
                            }
                            className="size-3.5 accent-(--accent-strong)"
                          />
                        </td>
                        <td className={cn(td, "tabular-nums whitespace-nowrap")}>{formatDate(d.date)}</td>
                        <td className={cn(td, d.offDay && "font-semibold text-danger")}>{d.day}</td>
                        <td className={cn(td, "tabular-nums")}>{d.employeeCode}</td>
                        <td className={cn(td, "whitespace-nowrap font-medium")}>{d.employeeName}</td>
                        <td className={cn(td, "whitespace-nowrap text-ink-muted")}>{d.designation || "—"}</td>
                        <td className={num}>{d.inTime}</td>
                        <td className={num}>{d.outTime ?? <span className="text-ink-faint" title="Only one punch">—</span>}</td>
                        <td className={num}>{formatMinutes(d.workedMinutes)}</td>
                        <td className={num}>{d.offDay ? <span className="text-ink-faint">Off day</span> : formatMinutes(d.standardMinutes)}</td>
                        <td className={cn(td, "w-24 py-1")}>
                          {d.entry ? (
                            <span className="block text-right font-semibold tabular-nums">{formatMinutes(d.entry.minutes)}</span>
                          ) : (
                            <input
                              aria-label={`Overtime for ${d.employeeName} on ${formatDate(d.date)} (hours:minutes)`}
                              value={edits[key] ?? formatMinutes(d.overtimeMinutes)}
                              onChange={(e) => setEdits((current) => ({ ...current, [key]: e.target.value }))}
                              className={cn(
                                "h-7 w-full rounded border bg-control px-2 text-right text-xs font-semibold tabular-nums focus:border-accent focus:outline-none",
                                minutes === null ? "border-danger" : "border-line-strong",
                                (minutes ?? 0) > 0 ? "text-ink" : "text-ink-faint",
                              )}
                            />
                          )}
                        </td>
                        <td className={td}>{d.entry ? <ApplicationStatusBadge status={d.entry.status} /> : <span className="text-ink-faint">Not submitted</span>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <ManualDialog open={manualOpen} employees={result.data.employees} onClose={() => setManualOpen(false)} onSaved={() => { setManualOpen(false); onSubmitted(); }} />
        </>
      )}
    </>
  );
}

const EMPTY_MANUAL = { employeeId: "", date: "", hours: "", reason: "" };

function ManualDialog({ open, employees, onClose, onSaved }: { open: boolean; employees: CalculationResult["employees"]; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [form, setForm] = useState(EMPTY_MANUAL);
  const [failure, setFailure] = useState("");
  const [saving, setSaving] = useState(false);
  const set = (key: keyof typeof EMPTY_MANUAL) => (value: string) => setForm((f) => ({ ...f, [key]: value }));

  async function save() {
    const minutes = parseDuration(form.hours);
    if (!form.employeeId || !form.date || !minutes || minutes <= 0) return setFailure("Choose the employee and date, and enter the overtime (e.g. 2:30 or 2.5).");
    if (!form.reason.trim()) return setFailure("Enter the reason for this overtime.");
    setSaving(true);
    setFailure("");
    try {
      const input: EntryInput = { entries: [{ employeeId: form.employeeId, date: form.date, minutes, source: "Manual", reason: form.reason.trim() }] };
      await apiRequest("/api/hrm/overtime", { method: "POST", body: JSON.stringify(input) });
      toast.success("Overtime sent for approval.");
      setForm(EMPTY_MANUAL);
      onSaved();
    } catch (error) {
      setFailure(errorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      title="Add Manual Overtime"
      description="For overtime the device did not record (outside work, a missed punch). It goes for approval like the rest."
      onClose={saving ? () => undefined : onClose}
      footer={
        <>
          <Button onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button variant="primary" loading={saving} onClick={() => void save()}>
            Submit for Approval
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        {failure && <Notice tone="error">{failure}</Notice>}
        <FormGrid cols={2}>
          <Field label="Employee" required span={2}>
            {(id) => (
              <Select id={id} value={form.employeeId} placeholder="Select employee" onChange={(e) => set("employeeId")(e.target.value)} options={employees.map((e) => ({ value: e.id, label: `${e.name} (${e.code})${e.designation ? ` · ${e.designation}` : ""}` }))} />
            )}
          </Field>
          <Field label="Date" required>
            {(id) => <Input id={id} type="date" value={form.date} onChange={(e) => set("date")(e.target.value)} />}
          </Field>
          <Field label="Overtime" required hint="Hours:minutes (2:30) or hours (2.5).">
            {(id) => <Input id={id} value={form.hours} placeholder="2:30" onChange={(e) => set("hours")(e.target.value)} className="text-right" />}
          </Field>
          <Field label="Reason" required span={2}>
            {(id) => <Input id={id} value={form.reason} maxLength={500} placeholder="e.g. Year-end stock count" onChange={(e) => set("reason")(e.target.value)} />}
          </Field>
        </FormGrid>
      </div>
    </Dialog>
  );
}

// ─── OT Approval ─────────────────────────────────────────────────────────────

function ApprovalTab({ refresh, onChanged }: { refresh: number; onChanged: () => void }) {
  const toast = useToast();
  const options = useHrOptions();
  const [filters, setFilters] = useState({ officeId: "", from: thisMonthStart(), to: localDay(new Date()), status: "Pending" });
  const [applied, setApplied] = useState(filters);
  const list = useResource(`hrm-ot-entries:${query(applied)}:${refresh}`, () => apiRequest<EntryRow[]>(`/api/hrm/overtime?${query(applied)}`));
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<{ action: "reject" | "delete"; ids: string[] } | null>(null);

  const rows = list.data ?? [];
  const pending = rows.filter((r) => r.status === "Pending");
  const chosen = pending.filter((r) => selected.has(r.id)).map((r) => r.id);
  const allSelected = pending.length > 0 && pending.every((r) => selected.has(r.id));

  async function act(action: "approve" | "reject" | "delete", ids: string[]) {
    setBusy(true);
    try {
      if (action === "delete") {
        await apiRequest(`/api/hrm/overtime/${ids[0]}`, { method: "DELETE" });
        toast.success("Overtime deleted.");
      } else {
        const { updated } = await apiRequest<{ updated: number }>(`/api/hrm/overtime/${action}`, { method: "POST", body: JSON.stringify({ ids }) });
        toast.success(`${updated} entr${updated === 1 ? "y" : "ies"} ${action === "approve" ? "approved" : "rejected"}.`);
      }
      setSelected(new Set());
      setConfirm(null);
      onChanged();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <FilterBar
        onSubmit={() => {
          setSelected(new Set());
          setApplied({ ...filters });
        }}
        busy={list.loading}
      >
        <FilterField label="Office" width="w-60">{(id) => <OfficeSelect id={id} options={options.data} value={filters.officeId} onChange={(officeId) => setFilters((f) => ({ ...f, officeId }))} />}</FilterField>
        <FilterField label="From Date">{(id) => <Input id={id} type="date" value={filters.from} onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))} />}</FilterField>
        <FilterField label="To Date">{(id) => <Input id={id} type="date" value={filters.to} onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))} />}</FilterField>
        <FilterField label="Status" width="w-36">
          {(id) => <Select id={id} value={filters.status} placeholder="All statuses" onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))} options={OVERTIME_STATUSES} />}
        </FilterField>
      </FilterBar>

      {list.error ? (
        <ErrorState message={list.error.message} onRetry={list.reload} />
      ) : !list.data ? (
        <LoadingState label="Loading overtime…" />
      ) : rows.length === 0 ? (
        <EmptyBlock icon={<Clock />} title="No overtime here">
          Overtime appears here once it is submitted from OT Calculation.
        </EmptyBlock>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-ink-muted">
              {rows.length} entr{rows.length === 1 ? "y" : "ies"} · total {formatMinutes(rows.reduce((t, r) => t + r.minutes, 0))} h
            </p>
            <div className="flex items-center gap-2">
              <Button disabled={busy || chosen.length === 0} className="text-danger" onClick={() => setConfirm({ action: "reject", ids: chosen })}>
                <X aria-hidden="true" className="size-3.5" />
                Reject ({chosen.length})
              </Button>
              <Button variant="primary" loading={busy && !confirm} disabled={busy || chosen.length === 0} onClick={() => void act("approve", chosen)}>
                <Check aria-hidden="true" className="size-3.5" />
                Approve ({chosen.length})
              </Button>
            </div>
          </div>
          <div className={cn(TABLE.wrap, "transition-opacity", list.loading && "opacity-60")}>
            <table className={cn(TABLE.table, "min-w-max")}>
              <thead className={TABLE.head}>
                <tr>
                  <th scope="col" className={cn(TABLE.th, "w-9 text-center")}>
                    <input
                      type="checkbox"
                      aria-label="Select every pending entry"
                      checked={allSelected}
                      disabled={pending.length === 0}
                      onChange={() => setSelected(allSelected ? new Set() : new Set(pending.map((r) => r.id)))}
                      className="size-3.5 accent-(--accent-strong)"
                    />
                  </th>
                  {["Date", "Code", "Employee", "Office", "Source", "In – Out", "Worked", "Overtime", "Reason", "Status", "Submitted By", "Action"].map((h) => (
                    <th key={h} scope="col" className={TABLE.th}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className={cn(TABLE.row, selected.has(r.id) && "bg-accent-soft/40")}>
                    <td className={cn(td, "text-center")}>
                      <input
                        type="checkbox"
                        aria-label={`Select ${r.employeeName} on ${formatDate(r.date)}`}
                        checked={selected.has(r.id)}
                        disabled={r.status !== "Pending"}
                        onChange={() =>
                          setSelected((current) => {
                            const next = new Set(current);
                            if (next.has(r.id)) next.delete(r.id);
                            else next.add(r.id);
                            return next;
                          })
                        }
                        className="size-3.5 accent-(--accent-strong)"
                      />
                    </td>
                    <td className={cn(td, "tabular-nums whitespace-nowrap")}>{formatDate(r.date)}</td>
                    <td className={cn(td, "tabular-nums")}>{r.employeeCode}</td>
                    <td className={cn(td, "whitespace-nowrap font-medium")}>
                      {r.employeeName}
                      {r.designation && <span className="block text-[11px] font-normal text-ink-faint">{r.designation}</span>}
                    </td>
                    <td className={cn(td, "whitespace-nowrap")}>{r.officeName}</td>
                    <td className={td}>{r.source}</td>
                    <td className={cn(td, "tabular-nums whitespace-nowrap")}>{r.inTime ? `${r.inTime} – ${r.outTime ?? "?"}` : "—"}</td>
                    <td className={num}>{formatMinutes(r.workedMinutes)}</td>
                    <td className={cn(num, "font-semibold")}>{formatMinutes(r.minutes)}</td>
                    <td className={cn(td, "max-w-56 truncate")} title={r.reason ?? undefined}>
                      {r.reason ?? "—"}
                    </td>
                    <td className={td} title={r.decidedByName ? `${r.status} by ${r.decidedByName}` : undefined}>
                      <ApplicationStatusBadge status={r.status} />
                    </td>
                    <td className={cn(td, "whitespace-nowrap")}>{r.createdByName ?? "—"}</td>
                    <td className={cn(td, "px-1 py-1")}>
                      {r.status === "Pending" ? (
                        <div className="flex items-center justify-center gap-0.5">
                          <Button variant="ghost" size="icon" className="hover:text-success" title="Approve" aria-label={`Approve ${r.employeeName} on ${formatDate(r.date)}`} disabled={busy} onClick={() => void act("approve", [r.id])}>
                            <Check />
                          </Button>
                          <Button variant="ghost" size="icon" className="hover:text-danger" title="Reject" aria-label={`Reject ${r.employeeName} on ${formatDate(r.date)}`} disabled={busy} onClick={() => setConfirm({ action: "reject", ids: [r.id] })}>
                            <X />
                          </Button>
                          <Button variant="ghost" size="icon" className="hover:text-danger" title="Delete" aria-label={`Delete ${r.employeeName} on ${formatDate(r.date)}`} disabled={busy} onClick={() => setConfirm({ action: "delete", ids: [r.id] })}>
                            <Trash2 />
                          </Button>
                        </div>
                      ) : (
                        <span className="block text-center text-ink-faint">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      <ConfirmDialog
        open={confirm !== null}
        title={confirm?.action === "delete" ? "Delete overtime" : "Reject overtime"}
        message={confirm && (confirm.action === "delete" ? "Delete this pending overtime? It can be submitted again from OT Calculation." : `Reject ${confirm.ids.length} overtime entr${confirm.ids.length === 1 ? "y" : "ies"}? Rejected overtime is not paid.`)}
        confirmLabel={confirm?.action === "delete" ? "Delete" : "Reject"}
        busy={busy}
        onConfirm={() => confirm && void act(confirm.action, confirm.ids)}
        onClose={() => setConfirm(null)}
      />
    </>
  );
}

// ─── Monthly OT Summary ──────────────────────────────────────────────────────

function SummaryTab({ refresh }: { refresh: number }) {
  const options = useHrOptions();
  const [filters, setFilters] = useState({ officeId: "", ...currentPeriod() });
  const [applied, setApplied] = useState<{ officeId: string; month: string } | null>(null);
  const [failure, setFailure] = useState("");
  const summary = useResource(applied ? `hrm-ot-summary:${query(applied)}:${refresh}` : null, () => apiRequest<SummaryResult>(`/api/hrm/overtime/summary?${query(applied!)}`));
  const data = summary.data;

  return (
    <>
      <FilterBar
        onSubmit={() => {
          if (!filters.officeId) return setFailure("Select an office.");
          setFailure("");
          setApplied({ officeId: filters.officeId, month: `${filters.year}-${filters.month}` });
        }}
        busy={summary.loading}
      >
        <FilterField label="Office *" width="w-60">
          {(id) => <OfficeSelect id={id} options={options.data} value={filters.officeId} allLabel="Select office" onChange={(officeId) => setFilters((f) => ({ ...f, officeId }))} />}
        </FilterField>
        <FilterField label="Month" width="w-36">{(id) => <MonthSelect id={id} value={filters.month} onChange={(month) => setFilters((f) => ({ ...f, month }))} />}</FilterField>
        <FilterField label="Year" width="w-28">{(id) => <YearSelect id={id} value={filters.year} onChange={(year) => setFilters((f) => ({ ...f, year }))} />}</FilterField>
      </FilterBar>
      {failure && <Notice tone="error">{failure}</Notice>}

      {!applied ? (
        <EmptyBlock icon={<Clock />} title="Monthly overtime amount">
          Choose an office and month, then View. Only approved overtime is paid.
        </EmptyBlock>
      ) : summary.error ? (
        <ErrorState message={summary.error.message} onRetry={summary.reload} />
      ) : !data ? (
        <LoadingState label="Loading summary…" />
      ) : (
        <>
          <RuleNote rule={data.rule} />
          {data.pendingCount > 0 && (
            <p className="text-xs text-warning">
              {data.pendingCount} overtime entr{data.pendingCount === 1 ? "y is" : "ies are"} still pending approval for {monthLabel(data.month)} and not included.
            </p>
          )}
          {data.rows.length === 0 ? (
            <EmptyBlock icon={<Clock />} title={`No approved overtime in ${monthLabel(data.month)}`} />
          ) : (
            <Grid headers={["SL", "Code", "Employee", "Designation", "Rate Basis", "Monthly Salary", "Hourly Rate", "Approved OT", "Payable OT", "Multiplier", "OT Amount"]} loading={summary.loading}>
              {data.rows.map((r, i) => (
                <tr key={r.employeeId} className={TABLE.row}>
                  <td className={cn(num, "text-ink-faint")}>{i + 1}</td>
                  <td className={cn(td, "tabular-nums")}>{r.employeeCode}</td>
                  <td className={cn(td, "whitespace-nowrap font-medium")}>{r.employeeName}</td>
                  <td className={cn(td, "whitespace-nowrap text-ink-muted")}>{r.designation || "—"}</td>
                  <td className={td} title={r.basicMissing ? "No basic salary is set, so the rate uses gross." : undefined}>
                    {r.rateBasis}
                    {r.basicMissing && <span className="ml-1 text-[11px] text-warning">(no basic)</span>}
                  </td>
                  <td className={num}>{formatMoney(r.rateSalary)}</td>
                  <td className={num}>{formatMoney(r.hourlyRate)}</td>
                  <td className={num}>{formatMinutes(r.approvedMinutes)}</td>
                  <td className={cn(num, r.payableMinutes < r.approvedMinutes && "text-warning")} title={r.payableMinutes < r.approvedMinutes ? "Capped at the monthly maximum" : undefined}>
                    {formatMinutes(r.payableMinutes)}
                  </td>
                  <td className={num}>×{data.rule.multiplier}</td>
                  <td className={cn(num, "font-semibold")}>{formatMoney(r.amount)}</td>
                </tr>
              ))}
              <tr className="border-t-2 border-grid-head-rule bg-canvas font-semibold">
                <td className={td} colSpan={7}>
                  Total ({data.rows.length} employee{data.rows.length === 1 ? "" : "s"})
                </td>
                <td className={num}>{formatMinutes(data.totals.approvedMinutes)}</td>
                <td className={num}>{formatMinutes(data.totals.payableMinutes)}</td>
                <td className={td} />
                <td className={num}>{formatMoney(data.totals.amount)}</td>
              </tr>
            </Grid>
          )}
        </>
      )}
    </>
  );
}
