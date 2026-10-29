"use client";

import { Check, Download, Pencil, Plus, Settings2, Trash2, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog, Dialog } from "@/components/ui/dialog";
import { ErrorState, LoadingState } from "@/components/ui/section";
import { useToast } from "@/components/ui/toast";
import { useResource } from "@/hooks/use-resource";
import { ApiClientError, apiRequest, errorMessage } from "@/lib/api/client";
import { cn } from "@/lib/cn";
import { Checkbox, EmptyBlock, Field, FormGrid, Input, Notice, Panel, Select, TABLE, TextArea } from "@/features/configuration/entity-master-data/employee/components/kit";
import type { EmployeeOption } from "../../self-service/leave-movement/schemas/leave-movement.schema";
import { EmployeeField, Grid } from "../../self-service/leave-movement/components/shared";
import type { HrOptions } from "../../shared/hr-access";
import { OfficeSelect, formatDate } from "../../shared/hr-ui";
import { POLICY_TAB_DEFS, WEEKDAYS, type PolicyColumn, type PolicyField, type PolicyLine, type PolicyRecordRow, type PolicyTabDef, type PolicyValue } from "../policy-fields";
import type { PolicyTab } from "../types";

const BASE = "/api/hrm/governance/records";
const dash = <span className="text-ink-faint">—</span>;
const tick = (on: boolean) => (on ? <Check aria-label="Yes" className="mx-auto size-4 text-success" /> : <X aria-label="No" className="mx-auto size-3.5 text-ink-faint" />);
/** "09:00" → "9:00 AM" */
const clock = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
};

function columnLabel(def: PolicyTabDef, column: PolicyColumn) {
  if (column.label) return column.label;
  const s = def.scope;
  if (column.key === "@office") return s.officeLabel ?? "Office";
  if (column.key === "@employee") return "Employee";
  if (column.key === "@from") return s.fromLabel ?? "Effective From";
  if (column.key === "@to") return s.toLabel ?? "Effective To";
  return def.fields.find((f) => f.key === column.key)?.label ?? column.key;
}

const isNumeric = (def: PolicyTabDef, column: PolicyColumn) => ["number", "percent"].includes(def.fields.find((f) => f.key === column.key)?.type ?? "");
const isTick = (def: PolicyTabDef, column: PolicyColumn) => column.key.startsWith("days:") || def.fields.find((f) => f.key === column.key)?.type === "checkbox";

function cell(def: PolicyTabDef, column: PolicyColumn, r: PolicyRecordRow) {
  switch (column.key) {
    case "@office":
      return r.officeName ?? "All offices";
    case "@employee":
      return r.employeeLabel ?? dash;
    case "@from":
      return r.effectiveFrom ? formatDate(r.effectiveFrom) : dash;
    case "@to":
      return r.effectiveTo ? formatDate(r.effectiveTo) : dash;
  }
  if (column.key.startsWith("days:")) {
    const days = r.data.days;
    return tick(Array.isArray(days) && (days as string[]).includes(column.key.slice(5)));
  }
  const field = def.fields.find((f) => f.key === column.key);
  const value = r.data[column.key];
  if (!field) return dash;
  if (field.type === "checkbox") return tick(Boolean(value));
  if (value === null || value === undefined || value === "") return dash;
  if (field.type === "time") return clock(String(value));
  if (field.type === "percent") return `${value}%`;
  if (field.type === "lines") return Array.isArray(value) ? `${value.length} day(s)` : dash;
  return String(value);
}

/** Create / edit / delete the setup records of one Settings / Policies tab. */
export function PolicyRecordsPanel({ tab, label, filter, options }: { tab: PolicyTab; label: string; filter: Record<string, string>; options?: HrOptions }) {
  const toast = useToast();
  const def = POLICY_TAB_DEFS[tab];
  const query = new URLSearchParams({ tab, ...filter }).toString();
  const records = useResource(`hrm-policy-records?${query}`, () => apiRequest<PolicyRecordRow[]>(`${BASE}?${query}`));
  const [editing, setEditing] = useState<PolicyRecordRow | "new" | null>(null);
  const [deleting, setDeleting] = useState<PolicyRecordRow | null>(null);
  const [busy, setBusy] = useState(false);

  async function remove() {
    if (!deleting) return;
    setBusy(true);
    try {
      await apiRequest(`${BASE}/${deleting.id}`, { method: "DELETE" });
      toast.success(`The ${def.noun} was deleted.`);
      setDeleting(null);
      records.reload();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function importCalendars() {
    setBusy(true);
    try {
      const result = await apiRequest<{ created: number; skipped: number }>(`${BASE}/import-calendars`, { method: "POST" });
      toast.success(`${result.created} calendar(s) imported${result.skipped ? `; ${result.skipped} already set up or for an unknown office` : ""}.`);
      records.reload();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel
      title={label}
      description={def.description}
      flush
      actions={
        <>
          {tab === "calendar-setup" && (
            <Button onClick={() => void importCalendars()} loading={busy} title="Copy the calendars shown in Calendar Assign › Calendar Info">
              <Download aria-hidden="true" className="size-3.5" />
              Import from Calendar Info
            </Button>
          )}
          <Button variant="primary" onClick={() => setEditing("new")}>
            <Plus aria-hidden="true" className="size-3.5" />
            {def.createLabel}
          </Button>
        </>
      }
    >
      <div className="p-4">
        {records.error ? (
          <ErrorState message={records.error.message} onRetry={records.reload} />
        ) : !records.data ? (
          <LoadingState />
        ) : records.data.length === 0 ? (
          <EmptyBlock icon={<Settings2 />} title={Object.keys(filter).length ? "Nothing matches these filters" : `No ${def.noun} yet`}>
            Use {def.createLabel} to add one.
          </EmptyBlock>
        ) : (
          <Grid headers={["SL", "Action", ...def.columns.map((c) => columnLabel(def, c))]} loading={records.loading}>
            {records.data.map((r, i) => (
              <tr key={r.id} className={TABLE.row}>
                <td className={`${TABLE.td} text-right text-ink-faint tabular-nums`}>{i + 1}</td>
                <td className={`${TABLE.td} px-1 py-1`}>
                  <div className="flex items-center justify-center gap-0.5">
                    <Button variant="ghost" size="icon" className="hover:text-accent-strong" title="Edit" aria-label={`Edit ${def.noun}`} onClick={() => setEditing(r)}>
                      <Pencil />
                    </Button>
                    <Button variant="ghost" size="icon" className="hover:text-danger" title="Delete" aria-label={`Delete ${def.noun}`} onClick={() => setDeleting(r)}>
                      <Trash2 />
                    </Button>
                  </div>
                </td>
                {def.columns.map((c) => (
                  <td key={c.key} className={cn(TABLE.td, isTick(def, c) ? "text-center" : isNumeric(def, c) ? "text-right tabular-nums" : "max-w-72 whitespace-normal", c.key.startsWith("@") && "whitespace-nowrap")}>
                    {cell(def, c, r)}
                  </td>
                ))}
              </tr>
            ))}
          </Grid>
        )}
      </div>

      <RecordDialog
        key={editing === null ? "closed" : editing === "new" ? "new" : editing.id}
        tab={tab}
        value={editing}
        options={options}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          records.reload();
        }}
      />
      <ConfirmDialog
        open={deleting !== null}
        title={`Delete ${def.noun}`}
        message={`Delete this ${def.noun}? This cannot be undone.`}
        busy={busy}
        onConfirm={() => void remove()}
        onClose={() => setDeleting(null)}
      />
    </Panel>
  );
}

const blankLine = (fields: PolicyField[]): PolicyLine => Object.fromEntries(fields.map((f) => [f.key, ""]));

function initialData(fields: PolicyField[], row: PolicyRecordRow | null): Record<string, PolicyValue> {
  return Object.fromEntries(
    fields.map((f) => {
      const value = row?.data[f.key];
      if (f.type === "checkbox") return [f.key, Boolean(value)];
      if (f.type === "weekdays") return [f.key, Array.isArray(value) ? value : []];
      if (f.type === "lines") return [f.key, Array.isArray(value) ? value : []];
      return [f.key, value === null || value === undefined ? "" : String(value)];
    }),
  );
}

function RecordDialog({ tab, value, options, onClose, onSaved }: { tab: PolicyTab; value: PolicyRecordRow | "new" | null; options?: HrOptions; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const def = POLICY_TAB_DEFS[tab];
  const scope = def.scope;
  const row = value && value !== "new" ? value : null;
  const [officeId, setOfficeId] = useState(row?.officeId ?? "");
  const [employee, setEmployee] = useState<EmployeeOption | null>(row?.employeeId ? { id: row.employeeId, code: row.employeeLabel?.split(" — ")[0] ?? "", name: row.employeeLabel?.split(" — ")[1] ?? "" } : null);
  const [effectiveFrom, setEffectiveFrom] = useState(row?.effectiveFrom ?? "");
  const [effectiveTo, setEffectiveTo] = useState(row?.effectiveTo ?? "");
  const [data, setData] = useState(() => initialData(def.fields, row));
  const [failure, setFailure] = useState("");
  const [saving, setSaving] = useState(false);
  const refTabs = [...new Set(def.fields.filter((f) => f.type === "ref").map((f) => f.refTab!))];
  const refs = useResource(value && refTabs.length ? `hrm-policy-refs?${refTabs.join(",")}` : null, async () =>
    Object.fromEntries(await Promise.all(refTabs.map(async (t) => [t, await apiRequest<string[]>(`${BASE}/options?tab=${t}`)] as const))),
  );
  const set = (key: string, next: PolicyValue) => setData((d) => ({ ...d, [key]: next }));
  const required = (setting: boolean | "required" | undefined) => setting === "required";

  async function save() {
    setSaving(true);
    setFailure("");
    try {
      const body = JSON.stringify({ officeId, employeeId: employee?.id ?? "", effectiveFrom, effectiveTo, data });
      if (row) await apiRequest(`${BASE}/${row.id}`, { method: "PUT", body });
      else await apiRequest(`${BASE}?tab=${tab}`, { method: "POST", body });
      toast.success(`The ${def.noun} was saved.`);
      onSaved();
    } catch (error) {
      const first = error instanceof ApiClientError ? Object.values(error.fieldErrors)[0]?.[0] : undefined;
      setFailure(first ?? errorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={value !== null}
      title={row ? `Edit ${def.noun[0].toUpperCase()}${def.noun.slice(1)}` : def.createLabel}
      onClose={saving ? () => undefined : onClose}
      footer={
        <>
          <Button onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button variant="primary" loading={saving} onClick={() => void save()}>
            Save
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        {failure && <Notice tone="error">{failure}</Notice>}
        <FormGrid cols={2}>
          {scope.from && (
            <Field label={scope.fromLabel ?? "Effective From"} required={required(scope.from)}>
              {(id) => <Input id={id} type="date" value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} />}
            </Field>
          )}
          {scope.to && (
            <Field label={scope.toLabel ?? "Effective To"} required={required(scope.to)} hint={required(scope.to) ? undefined : "Leave empty for no end date."}>
              {(id) => <Input id={id} type="date" value={effectiveTo} min={effectiveFrom || undefined} onChange={(e) => setEffectiveTo(e.target.value)} />}
            </Field>
          )}
          {scope.office && (
            <Field label={scope.officeLabel ?? "Office"} required={required(scope.office)} hint={required(scope.office) ? undefined : "Leave empty for all offices."}>
              {(id) => <OfficeSelect id={id} options={options} value={officeId} onChange={setOfficeId} />}
            </Field>
          )}
          {scope.employee && (
            <Field label="Employee" required={required(scope.employee)}>
              {(id) => <EmployeeField id={id} options={{ canManage: true, self: null }} value={employee} onChange={setEmployee} />}
            </Field>
          )}
          {def.fields.map((f) => (
            <Field key={f.key} label={f.label} required={f.required} hint={f.hint} span={["textarea", "weekdays", "lines"].includes(f.type) ? "full" : undefined}>
              {(id) =>
                f.type === "lines" ? (
                  <LinesEditor field={f} lines={(data[f.key] as PolicyLine[]) ?? []} onChange={(next) => set(f.key, next)} />
                ) : (
                  <FieldControl id={id} field={f} value={data[f.key]} onChange={(next) => set(f.key, next)} refOptions={f.refTab ? refs.data?.[f.refTab] : undefined} />
                )
              }
            </Field>
          ))}
        </FormGrid>
      </div>
    </Dialog>
  );
}

function LinesEditor({ field, lines, onChange }: { field: PolicyField; lines: PolicyLine[]; onChange: (lines: PolicyLine[]) => void }) {
  const fields = field.lineFields ?? [];
  const update = (index: number, key: string, value: PolicyValue) => onChange(lines.map((line, i) => (i === index ? { ...line, [key]: value as string } : line)));
  return (
    <div className="flex flex-col gap-2">
      {lines.length > 0 && (
        <div className={TABLE.wrap}>
          <table className={TABLE.table}>
            <thead className={TABLE.head}>
              <tr>
                <th className={TABLE.th}>SL</th>
                {fields.map((f) => (
                  <th key={f.key} className={TABLE.th}>
                    {f.label}
                  </th>
                ))}
                <th className={TABLE.th}>
                  <span className="sr-only">Remove</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line, i) => (
                <tr key={i} className={TABLE.row}>
                  <td className={`${TABLE.td} w-10 text-right text-ink-faint tabular-nums`}>{i + 1}</td>
                  {fields.map((f) => (
                    <td key={f.key} className={`${TABLE.td} p-1`}>
                      <FieldControl id={`${field.key}-${i}-${f.key}`} field={f} value={line[f.key] ?? ""} onChange={(v) => update(i, f.key, v)} />
                    </td>
                  ))}
                  <td className={`${TABLE.td} w-10 p-1 text-center`}>
                    <Button variant="ghost" size="icon" className="hover:text-danger" title="Remove" aria-label={`Remove line ${i + 1}`} onClick={() => onChange(lines.filter((_, j) => j !== i))}>
                      <Trash2 />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div>
        <Button size="sm" onClick={() => onChange([...lines, blankLine(fields)])}>
          <Plus aria-hidden="true" className="size-3.5" />
          Add {field.label === "Holidays" ? "holiday" : "line"}
        </Button>
      </div>
    </div>
  );
}

function FieldControl({ id, field, value, onChange, refOptions }: { id: string; field: PolicyField; value: PolicyValue; onChange: (value: PolicyValue) => void; refOptions?: string[] }) {
  const text = value === null || value === undefined ? "" : String(value);
  switch (field.type) {
    case "textarea":
      return <TextArea id={id} value={text} maxLength={2000} onChange={(e) => onChange(e.target.value)} />;
    case "number":
    case "percent":
      return (
        <Input
          id={id}
          type="number"
          min={field.min ?? 0}
          max={field.type === "percent" ? 100 : field.max}
          step={field.integer ? 1 : "any"}
          value={text}
          onChange={(e) => onChange(e.target.value)}
          className="text-right"
        />
      );
    case "time":
      return <Input id={id} type="time" value={text} onChange={(e) => onChange(e.target.value)} />;
    case "date":
      return <Input id={id} type="date" value={text} onChange={(e) => onChange(e.target.value)} />;
    case "select":
      return <Select id={id} value={text} onChange={(e) => onChange(e.target.value)} options={field.options ?? []} />;
    case "ref":
      return (
        <Select
          id={id}
          value={text}
          onChange={(e) => onChange(e.target.value)}
          placeholder={refOptions && refOptions.length === 0 ? "None set up yet" : "Select…"}
          options={[...new Set([...(refOptions ?? []), ...(text ? [text] : [])])]}
        />
      );
    case "checkbox":
      return <Checkbox id={id} label="Yes" checked={Boolean(value)} onChange={(e) => onChange(e.target.checked)} />;
    case "weekdays": {
      const days = Array.isArray(value) ? (value as string[]) : [];
      return (
        <div id={id} className="flex flex-wrap gap-x-4 gap-y-2 pt-1">
          {WEEKDAYS.map((day) => (
            <Checkbox key={day} label={day} checked={days.includes(day)} onChange={(e) => onChange(e.target.checked ? WEEKDAYS.filter((d) => d === day || days.includes(d)) : days.filter((d) => d !== day))} />
          ))}
        </div>
      );
    }
    default:
      return <Input id={id} value={text} maxLength={150} onChange={(e) => onChange(e.target.value)} />;
  }
}
