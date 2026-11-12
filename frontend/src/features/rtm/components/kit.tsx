"use client";

import { Plus, Trash2 } from "lucide-react";
import { useState, type ReactNode } from "react";
import { PageContainer, PageHead } from "@/components/layout/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { CONTROL, CheckboxField, SelectField, TextAreaField, TextField } from "@/components/ui/form-field";
import { Card } from "@/components/ui/section";
import { useToast } from "@/components/ui/toast";
import { useResource } from "@/hooks/use-resource";
import { errorMessage } from "@/lib/api/client";
import { cn } from "@/lib/cn";
import type { NavLink } from "@/lib/navigation/types";
import { rtmApi, type Lookups } from "../services/rtm.api";

/** Distributors, outlets, channels, routes, SRs and items the user can see. */
export function useLookups() {
  return useResource("rtm-lookups", () => rtmApi.get<Lookups>("lookups"));
}

export const options = <T,>(rows: readonly T[] | undefined, label: (r: T) => string, value: (r: T) => string, placeholder?: string) => [
  ...(placeholder !== undefined ? [{ value: "", label: placeholder }] : []),
  ...(rows ?? []).map((r) => ({ value: value(r), label: label(r) })),
];

/** Page frame for an RTM page: title and description come from its menu link. */
export function RtmPage({ page, actions, children }: { page: NavLink; actions?: ReactNode; children: ReactNode }) {
  return (
    <PageContainer full>
      <PageHead title={page.label} subtitle={page.description} actions={actions} />
      <div className="flex flex-col gap-4">{children}</div>
    </PageContainer>
  );
}

export function FilterBar({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-end gap-3 rounded border border-line bg-surface px-4 py-3">{children}</div>;
}

export function DateRange({ from, to, onChange }: { from: string; to: string; onChange: (from: string, to: string) => void }) {
  return (
    <>
      <TextField label="From" type="date" value={from} max={to} onChange={(e) => onChange(e.target.value, to)} className="w-40" />
      <TextField label="To" type="date" value={to} min={from} onChange={(e) => onChange(from, e.target.value)} className="w-40" />
    </>
  );
}

const STATUS: Record<string, { label: string; variant: "neutral" | "success" | "warning" | "danger" | "primary" }> = {
  PENDING: { label: "Pending", variant: "warning" },
  APPROVED: { label: "Approved", variant: "primary" },
  COMPLETED: { label: "Completed", variant: "success" },
  REJECTED: { label: "Rejected", variant: "danger" },
  CANCELLED: { label: "Cancelled", variant: "neutral" },
};
export function StatusBadge({ status, labels }: { status: string; labels?: Partial<Record<string, string>> }) {
  const s = STATUS[status] ?? { label: status, variant: "neutral" as const };
  return <Badge variant={s.variant}>{labels?.[status] ?? s.label}</Badge>;
}

/** Runs an action, shows the result and reloads. */
export function useAction(reload: () => void) {
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const run = async (key: string, fn: () => Promise<unknown>, success: string) => {
    setBusy(key);
    try {
      await fn();
      toast.success(success);
      reload();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(null);
    }
  };
  return { busy, run };
}

export function Kpi({ label, value, hint, tone }: { label: string; value: ReactNode; hint?: ReactNode; tone?: "success" | "danger" | "warning" }) {
  return (
    <Card>
      <div className="flex flex-col gap-1 p-4">
        <span className="text-xs font-semibold text-ink-muted">{label}</span>
        <span className={cn("text-xl font-bold tabular-nums text-ink", tone === "success" && "text-success", tone === "danger" && "text-danger", tone === "warning" && "text-warning")}>
          {value}
        </span>
        {hint && <span className="text-xs text-ink-faint">{hint}</span>}
      </div>
    </Card>
  );
}

export interface SimpleColumn<T> {
  header: string;
  cell: (row: T) => ReactNode;
  align?: "right";
}

/** A plain table for dashboard sections. */
export function SimpleTable<T>({ title, rows, columns, empty = "Nothing to show." }: { title?: string; rows: readonly T[]; columns: SimpleColumn<T>[]; empty?: string }) {
  return (
    <Card>
      <div className="flex flex-col gap-2 p-4">
        {title && <h2 className="text-sm font-bold text-ink">{title}</h2>}
        {rows.length === 0 ? (
          <p className="text-sm text-ink-faint">{empty}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-ink-muted">
                <tr>
                  {columns.map((c) => (
                    <th key={c.header} className={cn("py-1.5 pr-3 font-semibold", c.align === "right" ? "text-right" : "text-left")}>
                      {c.header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className="border-t border-line">
                    {columns.map((c) => (
                      <td key={c.header} className={cn("py-1.5 pr-3", c.align === "right" && "text-right tabular-nums")}>
                        {c.cell(r)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Card>
  );
}

// ── Form dialog ──────────────────────────────────────────────────────────────

type Values = Record<string, string | boolean>;

export interface FieldDef {
  name: string;
  label: string;
  type?: "text" | "number" | "date" | "month" | "textarea" | "select" | "checkbox";
  required?: boolean;
  options?: readonly { value: string; label: string }[];
  hint?: string;
  /** Shown only when this returns true for the current values. */
  when?: (values: Values) => boolean;
  /** Spans the whole row. */
  wide?: boolean;
}

export interface LinesDef {
  items: Lookups["items"];
  /** Ask for a rate (defaults to the item's rate). */
  rate?: boolean;
  /** Quantities may be negative (stock adjustments). */
  signed?: boolean;
}

interface Line {
  itemId: string;
  qty: string;
  rate: string;
}

/** A create / edit form; with `lines`, also an item grid. Submits the values (and lines) as JSON. */
export function FormDialog({
  open,
  title,
  fields,
  lines: linesDef,
  initial,
  submitLabel = "Save",
  onSubmit,
  onClose,
}: {
  open: boolean;
  title: string;
  fields: FieldDef[];
  lines?: LinesDef;
  initial?: Values;
  submitLabel?: string;
  onSubmit: (payload: Record<string, unknown>) => Promise<unknown>;
  onClose: () => void;
}) {
  return open ? <Form title={title} fields={fields} linesDef={linesDef} initial={initial} submitLabel={submitLabel} onSubmit={onSubmit} onClose={onClose} /> : null;
}

function Form({
  title,
  fields,
  linesDef,
  initial,
  submitLabel,
  onSubmit,
  onClose,
}: {
  title: string;
  fields: FieldDef[];
  linesDef?: LinesDef;
  initial?: Values;
  submitLabel: string;
  onSubmit: (payload: Record<string, unknown>) => Promise<unknown>;
  onClose: () => void;
}) {
  const toast = useToast();
  const [values, setValues] = useState<Values>(() => ({
    ...Object.fromEntries(fields.map((f) => [f.name, f.type === "checkbox" ? true : f.type === "date" ? new Date().toISOString().slice(0, 10) : ""])),
    ...initial,
  }));
  const [lines, setLines] = useState<Line[]>([{ itemId: "", qty: "", rate: "" }]);
  const [saving, setSaving] = useState(false);
  const set = (name: string, value: string | boolean) => setValues((v) => ({ ...v, [name]: value }));
  const setLine = (i: number, patch: Partial<Line>) => setLines((all) => all.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  const items = linesDef?.items ?? [];

  const submit = async () => {
    const payload: Record<string, unknown> = {};
    for (const f of fields) if (!f.when || f.when(values)) payload[f.name] = values[f.name];
    if (linesDef) {
      payload.lines = lines
        .filter((l) => l.itemId)
        .map((l) => ({ itemId: l.itemId, qty: l.qty, ...(linesDef.rate && l.rate !== "" ? { rate: l.rate } : {}) }));
    }
    setSaving(true);
    try {
      await onSubmit(payload);
      toast.success("Saved.");
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
      size={linesDef ? "xl" : "lg"}
      title={title}
      onClose={onClose}
      onSubmit={submit}
      footer={
        <>
          <Button onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={saving}>
            {submitLabel}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {fields
            .filter((f) => !f.when || f.when(values))
            .map((f) => {
              const common = { label: f.label, required: f.required, hint: f.hint, className: f.wide ? "sm:col-span-2" : undefined };
              const v = values[f.name];
              if (f.type === "checkbox") return <CheckboxField key={f.name} label={f.label} hint={f.hint} checked={v === true} onChange={(e) => set(f.name, e.target.checked)} />;
              if (f.type === "select")
                return <SelectField key={f.name} {...common} value={String(v ?? "")} onChange={(e) => set(f.name, e.target.value)} options={f.options ?? []} />;
              if (f.type === "textarea") return <TextAreaField key={f.name} {...common} value={String(v ?? "")} onChange={(e) => set(f.name, e.target.value)} />;
              return (
                <TextField
                  key={f.name}
                  {...common}
                  type={f.type ?? "text"}
                  step={f.type === "number" ? "any" : undefined}
                  value={String(v ?? "")}
                  onChange={(e) => set(f.name, e.target.value)}
                />
              );
            })}
        </div>

        {linesDef && (
          <div className="flex flex-col gap-2">
            <div className="overflow-x-auto rounded border border-line">
              <table className="w-full text-sm">
                <thead className="bg-canvas text-xs text-ink-muted">
                  <tr>
                    <th className="px-2 py-2 text-left font-semibold">Item</th>
                    <th className="w-32 px-2 py-2 text-right font-semibold">{linesDef.signed ? "Qty (+ / −)" : "Qty"}</th>
                    {linesDef.rate && <th className="w-32 px-2 py-2 text-right font-semibold">Rate</th>}
                    {linesDef.rate && <th className="w-32 px-2 py-2 text-right font-semibold">Amount</th>}
                    <th className="w-10" />
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l, i) => {
                    const item = items.find((it) => it.id === l.itemId);
                    const rate = l.rate !== "" ? Number(l.rate) : (item?.rate ?? 0);
                    return (
                      <tr key={i} className="border-t border-line">
                        <td className="px-2 py-1.5">
                          <select aria-label="Item" value={l.itemId} onChange={(e) => setLine(i, { itemId: e.target.value })} className={cn(CONTROL, "h-8")}>
                            <option value="">Select item</option>
                            {items.map((it) => (
                              <option key={it.id} value={it.id}>
                                {it.code} · {it.name} ({it.uom})
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-2 py-1.5">
                          <input
                            aria-label="Quantity"
                            type="number"
                            step="any"
                            min={linesDef.signed ? undefined : 0}
                            value={l.qty}
                            onChange={(e) => setLine(i, { qty: e.target.value })}
                            className={cn(CONTROL, "h-8 text-right")}
                          />
                        </td>
                        {linesDef.rate && (
                          <td className="px-2 py-1.5">
                            <input
                              aria-label="Rate"
                              type="number"
                              step="any"
                              min={0}
                              placeholder={item ? String(item.rate) : ""}
                              value={l.rate}
                              onChange={(e) => setLine(i, { rate: e.target.value })}
                              className={cn(CONTROL, "h-8 text-right")}
                            />
                          </td>
                        )}
                        {linesDef.rate && <td className="px-2 py-1.5 text-right tabular-nums">{((Number(l.qty) || 0) * rate).toFixed(2)}</td>}
                        <td className="px-1 py-1.5 text-center">
                          <Button variant="ghost" size="icon" aria-label="Remove line" onClick={() => setLines(lines.filter((_, j) => j !== i))}>
                            <Trash2 className="size-4" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div>
              <Button size="sm" onClick={() => setLines([...lines, { itemId: "", qty: "", rate: "" }])}>
                <Plus /> Add item
              </Button>
            </div>
          </div>
        )}
      </div>
    </Dialog>
  );
}
