"use client";

import { Ban, Check, ChevronDown, ChevronRight, Circle, Search } from "lucide-react";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { CONTROL_CLASS } from "@/features/configuration/entity-master-data/employee/components/kit";
import { ACTION_LABELS, PERMISSION_ACTIONS, permissionModules, type PermissionAction, type PermissionFeature } from "@/lib/permissions/registry";
import type { EffectivePermissionRow, GrantMap } from "../schemas/access.schema";

/**
 * The permission matrix: modules › submodules (menu cards) › pages, one column
 * per action. Three uses:
 *  - "grant": tick what a permission group grants;
 *  - "override": Inherit / Allow / Deny per permission for one user;
 *  - "effective": read-only resolved permissions with where each comes from.
 */

/** Individual overrides keyed `${featureKey}|${action}`. */
export type OverrideMap = Record<string, "ALLOW" | "DENY">;
export const overrideKey = (featureKey: string, action: PermissionAction) => `${featureKey}|${action}`;

type Holdable = (featureKey: string, action: PermissionAction) => boolean;

type Props =
  | { mode: "grant"; value: GrantMap; onChange: (next: GrantMap) => void; holdable?: Holdable; readOnly?: boolean }
  | { mode: "override"; overrides: OverrideMap; inherited: (featureKey: string, action: PermissionAction) => boolean; onChange: (next: OverrideMap) => void; holdable?: Holdable; readOnly?: boolean }
  | { mode: "effective"; rows: EffectivePermissionRow[] };

type Filter = "all" | "allowed" | "denied";

/** A checkbox that can show "some" (indeterminate). */
function TriCheckbox({ checked, mixed, disabled, label, onChange }: { checked: boolean; mixed: boolean; disabled?: boolean; label: string; onChange: (on: boolean) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = mixed;
  }, [mixed]);
  return (
    <input
      ref={ref}
      type="checkbox"
      aria-label={label}
      title={label}
      checked={checked}
      disabled={disabled}
      aria-checked={mixed ? "mixed" : checked}
      onChange={(e) => onChange(e.target.checked)}
      className="size-4 cursor-pointer accent-(--accent-strong) disabled:cursor-not-allowed disabled:opacity-40"
    />
  );
}

const SOURCE_TEXT = { group: "From group", allow: "Allowed individually", deny: "Denied individually", none: "Not granted", master: "Master account" } as const;

export function PermissionMatrix(props: Props) {
  const modules = useMemo(() => permissionModules(), []);
  const columns = useMemo(() => PERMISSION_ACTIONS.filter((a) => modules.some((m) => m.features.some((f) => f.actions.includes(a)))), [modules]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const readOnly = props.mode === "effective" || !!props.readOnly;
  const effective = useMemo(() => (props.mode === "effective" ? new Map(props.rows.map((r) => [overrideKey(r.featureKey, r.action), r])) : null), [props]);

  const granted = (f: PermissionFeature, a: PermissionAction): boolean => {
    if (props.mode === "grant") return !!props.value[f.key]?.includes(a);
    if (props.mode === "override") {
      const o = props.overrides[overrideKey(f.key, a)];
      return o === "ALLOW" ? true : o === "DENY" ? false : props.inherited(f.key, a);
    }
    return !!effective?.get(overrideKey(f.key, a))?.granted;
  };
  const can = (f: PermissionFeature, a: PermissionAction) => props.mode === "effective" || !props.holdable || props.holdable(f.key, a);

  const needle = search.trim().toLowerCase();
  const visibleModules = modules
    .map((m) => ({
      ...m,
      features: m.features.filter((f) => {
        const text = `${m.label} ${f.submodule ?? ""} ${f.label}`.toLowerCase();
        if (needle && !text.includes(needle)) return false;
        if (filter === "allowed") return f.actions.some((a) => granted(f, a));
        if (filter === "denied") return f.actions.some((a) => !granted(f, a));
        return true;
      }),
    }))
    .filter((m) => m.features.length > 0);

  // ── Changes ──
  /** Grant mode: other actions need View (so the page shows in the menu); removing View removes them all. */
  function setGrant(features: PermissionFeature[], action: PermissionAction | "all", on: boolean) {
    if (props.mode !== "grant") return;
    const next: GrantMap = { ...props.value };
    for (const f of features) {
      const current = new Set(next[f.key] ?? []);
      const actions = action === "all" ? f.actions : f.actions.includes(action) ? [action] : [];
      for (const a of actions) {
        if (!can(f, a)) continue;
        if (on) current.add(a);
        else current.delete(a);
      }
      if (on && current.size > 0 && f.actions.includes("view") && can(f, "view")) current.add("view");
      if (!on && (action === "view" || action === "all")) current.clear();
      const ordered = f.actions.filter((a) => current.has(a));
      if (ordered.length) next[f.key] = ordered;
      else delete next[f.key];
    }
    props.onChange(next);
  }

  /** Override mode: Inherit → Allow → Deny → Inherit. */
  function cycleOverride(f: PermissionFeature, a: PermissionAction) {
    if (props.mode !== "override") return;
    const key = overrideKey(f.key, a);
    const next = { ...props.overrides };
    const current = next[key];
    if (!current) next[key] = can(f, a) ? "ALLOW" : "DENY";
    else if (current === "ALLOW") next[key] = "DENY";
    else delete next[key];
    props.onChange(next);
  }

  function resetModule(features: PermissionFeature[]) {
    if (props.mode !== "override") return;
    const keys = new Set(features.flatMap((f) => f.actions.map((a) => overrideKey(f.key, a))));
    props.onChange(Object.fromEntries(Object.entries(props.overrides).filter(([k]) => !keys.has(k))));
  }

  const toggleModule = (id: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  // ── Cells ──
  function renderCell(f: PermissionFeature, a: PermissionAction) {
    if (!f.actions.includes(a)) return <span className="text-ink-faint" aria-hidden="true">—</span>;
    const label = `${ACTION_LABELS[a]} · ${f.moduleLabel} › ${f.label}`;
    if (props.mode === "grant") {
      const allowed = can(f, a);
      return (
        <input
          type="checkbox"
          aria-label={label}
          title={allowed ? label : "You do not have this permission yourself, so you cannot grant it."}
          checked={granted(f, a)}
          disabled={readOnly || !allowed}
          onChange={(e) => setGrant([f], a, e.target.checked)}
          className="size-4 cursor-pointer accent-(--accent-strong) disabled:cursor-not-allowed disabled:opacity-40"
        />
      );
    }
    if (props.mode === "override") {
      const o = props.overrides[overrideKey(f.key, a)];
      const inherited = props.inherited(f.key, a);
      const text = o === "ALLOW" ? "Allowed for this user" : o === "DENY" ? "Denied for this user" : inherited ? "Inherited from groups: allowed" : "Inherited from groups: not granted";
      return (
        <button
          type="button"
          disabled={readOnly}
          aria-label={`${label}: ${text}. Click to change.`}
          title={`${text} — click: Inherit → Allow → Deny`}
          onClick={() => cycleOverride(f, a)}
          className={cn(
            "inline-flex size-6 items-center justify-center rounded border text-[11px] font-bold transition-colors disabled:cursor-not-allowed [&_svg]:size-3.5",
            o === "ALLOW" && "border-success/40 bg-success/10 text-success",
            o === "DENY" && "border-danger/40 bg-danger/10 text-danger",
            !o && (inherited ? "border-line bg-control text-ink-muted" : "border-line bg-surface text-ink-faint"),
          )}
        >
          {o === "ALLOW" ? <Check /> : o === "DENY" ? <Ban /> : inherited ? <Check className="opacity-50" /> : <Circle className="size-2.5!" />}
        </button>
      );
    }
    const row = effective?.get(overrideKey(f.key, a));
    const source = row?.source ?? "none";
    const text = source === "group" ? `${SOURCE_TEXT.group}: ${row?.groups.join(", ")}` : SOURCE_TEXT[source];
    return (
      <span
        role="img"
        aria-label={`${label}: ${row?.granted ? "allowed" : "denied"} (${text})`}
        title={text}
        className={cn(
          "inline-flex size-6 items-center justify-center rounded [&_svg]:size-3.5",
          row?.granted ? (source === "allow" ? "bg-accent-soft text-accent-strong" : "bg-success/10 text-success") : source === "deny" ? "bg-danger/10 text-danger" : "text-ink-faint",
        )}
      >
        {row?.granted ? <Check /> : source === "deny" ? <Ban /> : "—"}
      </span>
    );
  }

  const total = modules.reduce((n, m) => n + m.features.reduce((k, f) => k + f.actions.length, 0), 0);
  const grantedCount = modules.reduce((n, m) => n + m.features.reduce((k, f) => k + f.actions.filter((a) => granted(f, a)).length, 0), 0);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <label className="relative w-full sm:w-64">
          <span className="sr-only">Search modules and pages</span>
          <Search aria-hidden="true" className="pointer-events-none absolute top-2 left-2.5 size-4 text-ink-faint" />
          <input type="search" value={search} maxLength={100} placeholder="Search modules or pages…" onChange={(e) => setSearch(e.target.value)} className={cn(CONTROL_CLASS, "pl-8")} />
        </label>
        <div role="radiogroup" aria-label="Show" className="inline-flex overflow-hidden rounded border border-line text-xs">
          {(["all", "allowed", "denied"] as const).map((f) => (
            <button
              key={f}
              type="button"
              role="radio"
              aria-checked={filter === f}
              onClick={() => setFilter(f)}
              className={cn("px-3 py-1.5 capitalize", filter === f ? "bg-accent-soft font-semibold text-accent-strong dark:text-accent" : "bg-surface text-ink-muted hover:bg-control")}
            >
              {f}
            </button>
          ))}
        </div>
        <Button size="sm" variant="ghost" onClick={() => setCollapsed(new Set())}>
          Expand all
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setCollapsed(new Set(modules.map((m) => m.id)))}>
          Collapse all
        </Button>
        <span className="ml-auto text-xs text-ink-faint">
          {grantedCount} of {total} permissions {props.mode === "effective" ? "granted" : "allowed"}
        </span>
      </div>

      {props.mode === "override" && (
        <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-muted">
          <span className="inline-flex items-center gap-1">
            <Check className="size-3.5 opacity-50" /> Inherited (allowed by a group)
          </span>
          <span className="inline-flex items-center gap-1">
            <Circle className="size-2.5" /> Inherited (not granted)
          </span>
          <span className="inline-flex items-center gap-1 text-success">
            <Check className="size-3.5" /> Allow
          </span>
          <span className="inline-flex items-center gap-1 text-danger">
            <Ban className="size-3.5" /> Deny (wins over groups)
          </span>
        </p>
      )}
      {props.mode === "effective" && (
        <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-muted">
          <span className="inline-flex items-center gap-1 text-success">
            <Check className="size-3.5" /> From a group
          </span>
          <span className="inline-flex items-center gap-1 text-accent-strong dark:text-accent">
            <Check className="size-3.5" /> Allowed individually
          </span>
          <span className="inline-flex items-center gap-1 text-danger">
            <Ban className="size-3.5" /> Denied individually
          </span>
          <span>Hover a cell for details.</span>
        </p>
      )}

      <div className="overflow-x-auto rounded border border-grid-line">
        <table className="w-full min-w-max border-collapse text-[12px]">
          <thead className="border-b-2 border-grid-head-rule bg-grid-head text-[11px] tracking-wide text-grid-head-ink uppercase">
            <tr>
              <th scope="col" className="sticky left-0 z-10 min-w-64 bg-grid-head px-2.5 py-2 text-left">
                Module / Page
              </th>
              {columns.map((a) => (
                <th key={a} scope="col" className="w-20 px-1.5 py-2 text-center">
                  {ACTION_LABELS[a]}
                </th>
              ))}
              {props.mode === "grant" && (
                <th scope="col" className="w-14 px-1.5 py-2 text-center">
                  All
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {visibleModules.length === 0 && (
              <tr>
                <td colSpan={columns.length + 2} className="px-4 py-6 text-center text-sm text-ink-faint">
                  Nothing matches.
                </td>
              </tr>
            )}
            {visibleModules.map((m) => {
              const open = !collapsed.has(m.id) || !!needle;
              const all = m.features.flatMap((f) => f.actions.map((a) => granted(f, a)));
              const submodules = [...new Set(m.features.map((f) => f.submodule))];
              return (
                <Fragment key={m.id}>
                  <tr className="border-t border-grid-line bg-control/60">
                    <th scope="rowgroup" className="sticky left-0 z-10 bg-control px-2.5 py-1.5 text-left">
                      <button type="button" onClick={() => toggleModule(m.id)} aria-expanded={open} className="inline-flex items-center gap-1.5 text-[12.5px] font-bold text-ink">
                        {open ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                        {m.label}
                        <span className="font-normal text-ink-faint">
                          ({all.filter(Boolean).length}/{all.length})
                        </span>
                      </button>
                      {props.mode === "override" && !readOnly && (
                        <button type="button" onClick={() => resetModule(m.features)} className="ml-3 text-[11px] font-normal text-accent-strong hover:underline dark:text-accent">
                          Reset to inherit
                        </button>
                      )}
                    </th>
                    {columns.map((a) => {
                      const applicable = m.features.filter((f) => f.actions.includes(a));
                      if (props.mode !== "grant" || applicable.length === 0) return <td key={a} />;
                      const on = applicable.filter((f) => granted(f, a)).length;
                      return (
                        <td key={a} className="px-1.5 py-1.5 text-center">
                          <TriCheckbox
                            label={`${ACTION_LABELS[a]} on every ${m.label} page`}
                            checked={on === applicable.length}
                            mixed={on > 0 && on < applicable.length}
                            disabled={readOnly}
                            onChange={(checked) => setGrant(applicable, a, checked)}
                          />
                        </td>
                      );
                    })}
                    {props.mode === "grant" && (
                      <td className="px-1.5 py-1.5 text-center">
                        <TriCheckbox
                          label={`Select all ${m.label} permissions`}
                          checked={all.every(Boolean)}
                          mixed={all.some(Boolean) && !all.every(Boolean)}
                          disabled={readOnly}
                          onChange={(checked) => setGrant(m.features, "all", checked)}
                        />
                      </td>
                    )}
                  </tr>
                  {open &&
                    submodules.map((sub) => (
                      <Fragment key={`${m.id}:${sub ?? ""}`}>
                        {sub && (
                          <tr className="border-t border-grid-line">
                            <th scope="rowgroup" colSpan={columns.length + 2} className="sticky left-0 bg-surface py-1 pl-8 text-left text-[11px] font-semibold tracking-wide text-accent-strong uppercase dark:text-accent">
                              {sub}
                            </th>
                          </tr>
                        )}
                        {m.features
                          .filter((f) => f.submodule === sub)
                          .map((f) => {
                            const every = f.actions.every((a) => granted(f, a));
                            const some = f.actions.some((a) => granted(f, a));
                            return (
                              <tr key={f.key} className="border-t border-grid-line hover:bg-grid-hover">
                                <th scope="row" className={cn("sticky left-0 bg-surface py-1.5 pr-2.5 text-left font-medium text-ink", sub ? "pl-12" : "pl-8")}>
                                  <span className="text-ink-faint">↳ </span>
                                  {f.label}
                                </th>
                                {columns.map((a) => (
                                  <td key={a} className="px-1.5 py-1.5 text-center">
                                    {renderCell(f, a)}
                                  </td>
                                ))}
                                {props.mode === "grant" && (
                                  <td className="px-1.5 py-1.5 text-center">
                                    <TriCheckbox label={`All permissions · ${f.label}`} checked={every} mixed={some && !every} disabled={readOnly} onChange={(checked) => setGrant([f], "all", checked)} />
                                  </td>
                                )}
                              </tr>
                            );
                          })}
                      </Fragment>
                    ))}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
