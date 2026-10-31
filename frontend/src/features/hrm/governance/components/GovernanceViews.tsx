"use client";

import { Check, ClipboardCheck, Settings2, X } from "lucide-react";
import { useState } from "react";
import { PageContainer, PageHead } from "@/components/layout/page";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/form-field";
import { ConfirmDialog } from "@/components/ui/dialog";
import { ErrorState, LoadingState } from "@/components/ui/section";
import { Tabs } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast";
import { useResource } from "@/hooks/use-resource";
import { apiRequest, errorMessage } from "@/lib/api/client";
import { cn } from "@/lib/cn";
import { resolveBreadcrumbs } from "@/lib/navigation/registry";
import { EmptyBlock, Input, Panel, Select, TABLE } from "@/features/configuration/entity-master-data/employee/components/kit";
import type { EmployeeOption } from "../../self-service/leave-movement/schemas/leave-movement.schema";
import { EmployeeField, Grid } from "../../self-service/leave-movement/components/shared";
import { hrmPaths } from "../../paths";
import { FilterBar, FilterField, OfficeSelect, useHrOptions } from "../../shared/hr-ui";
import { PolicyRecordsPanel } from "./PolicyRecordsPanel";
import { CHECKLIST_FLAGS, PENDING_KINDS, POLICY_TABS, type ChecklistFlag, type ChecklistRow, type GridColumn, type PendingKind, type PendingList, type PolicyGrid, type PolicyTab } from "../types";

function DataRows({ columns, rows, numbered = true }: { columns: GridColumn[]; rows: Record<string, string | number>[]; numbered?: boolean }) {
  return rows.map((row, i) => (
    <tr key={i} className={TABLE.row}>
      {numbered && <td className={`${TABLE.td} text-right text-ink-faint tabular-nums`}>{i + 1}</td>}
      {columns.map((c) => (
        <td key={c.key} className={cn(TABLE.td, c.align === "right" ? "text-right tabular-nums" : "whitespace-nowrap")}>
          {typeof row[c.key] === "number" && c.align === "right" ? Number(row[c.key]).toLocaleString("en-IN", { maximumFractionDigits: 2 }) : row[c.key]}
        </td>
      ))}
    </tr>
  ));
}

// ─── Settings / Policies ──────────────────────────────────────────────────────

const EMPTY_FILTER = { officeId: "", fromDate: "", toDate: "" };

export function PolicySettingsView() {
  const options = useHrOptions();
  const [tab, setTab] = useState<PolicyTab>("attendance-process");
  const [filter, setFilter] = useState(EMPTY_FILTER);
  const [employee, setEmployee] = useState<EmployeeOption | null>(null);
  const [applied, setApplied] = useState<Record<string, string>>({});
  const query = new URLSearchParams({ tab, ...applied }).toString();
  const grid = useResource(`hrm-policies?${query}`, () => apiRequest<PolicyGrid>(`/api/hrm/governance/policies?${query}`));
  const set = (key: keyof typeof EMPTY_FILTER) => (value: string) => setFilter((f) => ({ ...f, [key]: value }));

  return (
    <PageContainer full>
      <PageHead title="Settings / Policies" subtitle="HR settings and policies, narrowed by office, dates and employee." breadcrumbs={resolveBreadcrumbs(hrmPaths.policySettings).slice(1)} />
      <section className="rounded border border-line bg-surface shadow-xs">
        <Tabs tabs={POLICY_TABS} value={tab} onChange={setTab} label="HR settings and policies">
          <div className="flex flex-col gap-3 p-4">
            <FilterBar buttonLabel="Apply" busy={grid.loading} onSubmit={() => setApplied(Object.fromEntries(Object.entries({ ...filter, employeeId: employee?.id ?? "" }).filter(([, v]) => v)))}>
              <FilterField label="Office" width="w-64">
                {(id) => <OfficeSelect id={id} options={options.data} value={filter.officeId} onChange={set("officeId")} />}
              </FilterField>
              <FilterField label="From" width="w-40">
                {(id) => <Input id={id} type="date" value={filter.fromDate} onChange={(e) => set("fromDate")(e.target.value)} />}
              </FilterField>
              <FilterField label="To" width="w-40">
                {(id) => <Input id={id} type="date" value={filter.toDate} min={filter.fromDate || undefined} onChange={(e) => set("toDate")(e.target.value)} />}
              </FilterField>
              <FilterField label="Employee" width="w-72">
                {(id) => <EmployeeField id={id} options={{ canManage: true, self: null }} value={employee} onChange={setEmployee} />}
              </FilterField>
            </FilterBar>

            <PolicyRecordsPanel key={tab} tab={tab} label={POLICY_TABS.find((t) => t.id === tab)!.label} filter={applied} options={options.data} />

            {tab === "employee-assign" && <EmployeeChecklist filter={applied} />}

            {/* Tabs backed by employee records also show what is stored there. */}
            {grid.error ? (
              <ErrorState message={grid.error.message} onRetry={grid.reload} />
            ) : !grid.data ? (
              <LoadingState />
            ) : (
              grid.data.configured && (
                <Panel title="From employee records" description={grid.data.note} flush>
                  <div className="p-4">
                    {grid.data.rows.length === 0 ? (
                      <EmptyBlock icon={<Settings2 />} title="Nothing matches these filters" />
                    ) : (
                      <Grid headers={["SL", ...grid.data.columns.map((c) => c.label)]} loading={grid.loading}>
                        <DataRows columns={grid.data.columns} rows={grid.data.rows} />
                      </Grid>
                    )}
                  </div>
                </Panel>
              )
            )}
          </div>
        </Tabs>
      </section>
    </PageContainer>
  );
}

// ─── Employee Assign › checklist ──────────────────────────────────────────────

/** OverTime / PF / Hold Salary per employee; each tick is saved at once. */
function EmployeeChecklist({ filter }: { filter: Record<string, string> }) {
  const toast = useToast();
  const query = new URLSearchParams(Object.fromEntries(Object.entries(filter).filter(([k]) => k === "officeId" || k === "employeeId"))).toString();
  const list = useResource(`hrm-checklist?${query}`, () => apiRequest<ChecklistRow[]>(`/api/hrm/governance/checklist?${query}`));
  const [saving, setSaving] = useState<string | null>(null);

  async function toggle(row: ChecklistRow, flag: ChecklistFlag) {
    const value = !row[flag];
    const apply = (v: boolean) => list.mutate((rows) => (rows ?? []).map((r) => (r.id === row.id ? { ...r, [flag]: v } : r)));
    apply(value);
    setSaving(`${row.id}:${flag}`);
    try {
      await apiRequest(`/api/hrm/governance/checklist/${row.id}`, { method: "PATCH", body: JSON.stringify({ flag, value }) });
    } catch (error) {
      apply(!value);
      toast.error(errorMessage(error));
    } finally {
      setSaving(null);
    }
  }

  return (
    <Panel title="Employee Checklist" description="Tick OverTime, PF or Hold Salary for each employee; changes are saved immediately." flush>
      <div className="p-4">
        {list.error ? (
          <ErrorState message={list.error.message} onRetry={list.reload} />
        ) : !list.data ? (
          <LoadingState />
        ) : list.data.length === 0 ? (
          <EmptyBlock icon={<Settings2 />} title="No employees match these filters" />
        ) : (
          <Grid
            headers={["SL", "Employee Id", "Employee Name", "Designation", "Joining Date", "Department", "Policy No", "Service Length (Days)", ...CHECKLIST_FLAGS.map((f) => f.label)]}
            loading={list.loading}
          >
            {list.data.map((row, i) => (
              <tr key={row.id} className={TABLE.row}>
                <td className={`${TABLE.td} text-right text-ink-faint tabular-nums`}>{i + 1}</td>
                <td className={`${TABLE.td} whitespace-nowrap`}>{row.code}</td>
                <td className={`${TABLE.td} whitespace-nowrap`}>{row.name}</td>
                <td className={`${TABLE.td} whitespace-nowrap`}>{row.designation}</td>
                <td className={`${TABLE.td} whitespace-nowrap tabular-nums`}>{row.joiningDate}</td>
                <td className={`${TABLE.td} whitespace-nowrap`}>{row.department}</td>
                <td className={`${TABLE.td} whitespace-nowrap`}>{row.policy}</td>
                <td className={`${TABLE.td} text-right tabular-nums`}>{row.serviceDays.toLocaleString("en-IN")}</td>
                {CHECKLIST_FLAGS.map(({ key, label }) => {
                  const needsSalary = key !== "holdSalary" && !row.hasSalary;
                  return (
                    <td key={key} className={`${TABLE.td} text-center`}>
                      <Checkbox
                        tone="accent"
                        checked={row[key]}
                        disabled={needsSalary || saving === `${row.id}:${key}`}
                        title={needsSalary ? "Set up this employee's salary in Employee › Salary first." : undefined}
                        aria-label={`${label} for ${row.name}`}
                        onChange={() => void toggle(row, key)}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </Grid>
        )}
      </div>
    </Panel>
  );
}

// ─── Pending approval ─────────────────────────────────────────────────────────

export function PendingApprovalView() {
  const toast = useToast();
  const [kind, setKind] = useState<PendingKind>("leave");
  const [applied, setApplied] = useState<PendingKind>("leave");
  const list = useResource(`hrm-pending?${applied}`, () => apiRequest<PendingList>(`/api/hrm/governance/pending?kind=${applied}`));
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const label = PENDING_KINDS.find((k) => k.id === applied)!.label.toLowerCase();

  async function decide(id: string, decision: "approve" | "reject") {
    setBusy(true);
    try {
      await apiRequest(`/api/hrm/governance/pending/${applied}/${id}/${decision}`, { method: "POST" });
      toast.success(decision === "approve" ? "Approved." : "Rejected.");
      setRejecting(null);
      list.reload();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <PageContainer full>
      <PageHead title="Pending Approval" subtitle="Applications waiting for HR's decision." breadcrumbs={resolveBreadcrumbs(hrmPaths.pendingApproval).slice(1)} />
      <div className="flex flex-col gap-3">
        <FilterBar onSubmit={() => setApplied(kind)} busy={list.loading}>
          <FilterField label="View By">
            {(id) => <Select id={id} value={kind} onChange={(e) => setKind(e.target.value as PendingKind)} placeholder={false} options={PENDING_KINDS.map((k) => ({ value: k.id, label: k.label }))} />}
          </FilterField>
        </FilterBar>
        <section className="rounded border border-line bg-surface p-4 shadow-xs">
          {list.error ? (
            <ErrorState message={list.error.message} onRetry={list.reload} />
          ) : !list.data ? (
            <LoadingState />
          ) : list.data.rows.length === 0 ? (
            <EmptyBlock icon={<ClipboardCheck />} title={`No pending ${label} applications`} />
          ) : (
            <Grid headers={["SL", "Action", ...list.data.columns.map((c) => c.label)]} loading={list.loading}>
              {list.data.rows.map((row, i) => (
                <tr key={row.id} className={TABLE.row}>
                  <td className={`${TABLE.td} text-right text-ink-faint tabular-nums`}>{i + 1}</td>
                  <td className={`${TABLE.td} px-1 py-1`}>
                    <div className="flex items-center justify-center gap-0.5">
                      <Button variant="ghost" size="icon" className="hover:text-success" title="Approve" aria-label="Approve" disabled={busy} onClick={() => void decide(row.id, "approve")}>
                        <Check />
                      </Button>
                      <Button variant="ghost" size="icon" className="hover:text-danger" title="Reject" aria-label="Reject" disabled={busy} onClick={() => setRejecting(row.id)}>
                        <X />
                      </Button>
                    </div>
                  </td>
                  {list.data!.columns.map((c) => (
                    <td key={c.key} className={cn(TABLE.td, c.align === "right" ? "text-right tabular-nums" : c.key === "reason" ? "max-w-72 whitespace-normal" : "whitespace-nowrap")}>
                      {row[c.key]}
                    </td>
                  ))}
                </tr>
              ))}
            </Grid>
          )}
        </section>
      </div>
      <ConfirmDialog
        open={rejecting !== null}
        title="Reject application"
        message={`Reject this ${label} application?`}
        confirmLabel="Reject"
        busy={busy}
        onConfirm={() => rejecting && void decide(rejecting, "reject")}
        onClose={() => setRejecting(null)}
      />
    </PageContainer>
  );
}
