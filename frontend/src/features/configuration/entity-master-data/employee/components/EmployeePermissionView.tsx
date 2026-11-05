"use client";

import { ArrowLeft, CalendarDays, ChevronDown, Phone, Save, Search } from "lucide-react";
import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import { PageContainer, PageHead } from "@/components/layout/page";
import { Button, buttonClasses } from "@/components/ui/button";
import { ErrorState, LoadingState } from "@/components/ui/section";
import { useToast } from "@/components/ui/toast";
import { useResource } from "@/hooks/use-resource";
import { errorMessage } from "@/lib/api/client";
import { useSession } from "@/lib/auth/session";
import { cn } from "@/lib/cn";
import { ACTION_LABELS, permissionFeatures, type PermissionAction, type PermissionFeature } from "@/lib/permissions/registry";
import { TriCheckbox } from "@/features/configuration/security/access/components/PermissionMatrix";
import type { OverrideInput, UserAccessDto } from "@/features/configuration/security/access/schemas/access.schema";
import { userAccessApi } from "@/features/configuration/security/access/services/access.api";
import { entityMasterDataBreadcrumbs } from "../../breadcrumbs";
import { entityMasterDataPaths } from "../../paths";
import type { OrgAccessDto } from "../schemas/personal-info.schema";
import { personalInfoApi } from "../services/personal-info.api";
import { Avatar, CONTROL_CLASS, Notice, Panel, StatusBadge } from "./kit";

/**
 * Employee › Permission: one employee's individual permissions (Allow per page
 * and action, saved as user overrides) and the business units they work in.
 * Permissions from their permission groups still apply and are shown in green.
 */

/** The matrix columns, in this order. */
const ACTIONS = ["view", "create", "edit", "delete", "approve"] as const satisfies readonly PermissionAction[];
type MatrixAction = (typeof ACTIONS)[number];
const isMatrixAction = (a: PermissionAction): a is MatrixAction => (ACTIONS as readonly string[]).includes(a);

type Mode = "feature" | "module";
const MODES: { id: Mode; label: string; hint: string }[] = [
  { id: "feature", label: "Feature Permission", hint: "Choose the actions page by page." },
  { id: "module", label: "Module Master Permission", hint: "Grant an action on every page of a module at once." },
];

const cellKey = (featureKey: string, action: PermissionAction) => `${featureKey}|${action}`;

export function EmployeePermissionView({ employeeId }: { employeeId: string }) {
  const profile = useResource(`personal-info:${employeeId}`, () => personalInfoApi.getPersonalInfo(employeeId));
  const creds = useResource(`credentials:${employeeId}`, () => personalInfoApi.getCredentials(employeeId));
  const name = profile.data?.name ?? "Employee";
  const breadcrumbs = [
    ...entityMasterDataBreadcrumbs(entityMasterDataPaths.employee),
    { label: name, href: entityMasterDataPaths.employeeProfile(employeeId) },
    { label: "Permission", href: entityMasterDataPaths.employeePermissions(employeeId) },
  ];
  const error = profile.error ?? creds.error;

  return (
    <PageContainer full>
      <PageHead
        title="Create Permission"
        subtitle="Individual permissions for this employee, on top of their permission groups."
        breadcrumbs={breadcrumbs}
        actions={
          <Link href={entityMasterDataPaths.employee} className={buttonClasses("secondary", "md")}>
            <ArrowLeft /> All Employees
          </Link>
        }
      />
      {error ? (
        <section className="rounded border border-line bg-surface">
          <ErrorState message={error.message} onRetry={() => (profile.reload(), creds.reload())} />
        </section>
      ) : !profile.data || !creds.data ? (
        <section className="rounded border border-line bg-surface">
          <LoadingState label="Loading employee…" />
        </section>
      ) : (
        <div className="flex flex-col gap-4">
          <EmployeeCard
            name={profile.data.name}
            code={profile.data.employeeCode}
            mobile={creds.data.phone ?? profile.data.mobile}
            joiningDate={profile.data.joiningDate}
            active={!profile.data.terminationDate}
          />
          {creds.data.userId ? (
            <PermissionEditor employeeId={employeeId} userId={creds.data.userId} />
          ) : (
            <Notice tone="error">
              This employee has no ERP login yet, so there is nothing to give permissions to. Create their login in{" "}
              <Link className="font-semibold underline" href={`${entityMasterDataPaths.employeeProfile(employeeId)}?tab=personal-info`}>
                Edit Profile › Personal Info › ERP Access
              </Link>
              , then come back here.
            </Notice>
          )}
        </div>
      )}
    </PageContainer>
  );
}

function EmployeeCard({ name, code, mobile, joiningDate, active }: { name: string; code: string; mobile: string | null; joiningDate: string; active: boolean }) {
  const facts: { label: string; value: ReactNode }[] = [
    { label: "Employee Name", value: name },
    { label: "Mobile Number", value: <span className="inline-flex items-center gap-1 [&_svg]:size-3.5 [&_svg]:text-ink-faint"><Phone />{mobile ?? "—"}</span> },
    { label: "Joining Date", value: <span className="inline-flex items-center gap-1 [&_svg]:size-3.5 [&_svg]:text-ink-faint"><CalendarDays />{joiningDate}</span> },
    { label: "Status", value: <StatusBadge active={active} /> },
  ];
  return (
    <section className="flex flex-col gap-4 rounded border border-line bg-surface px-5 py-4 shadow-[0_1px_2px_rgb(0_0_0/0.04)] lg:flex-row lg:items-center">
      <div className="flex items-center gap-3">
        <Avatar name={name} size="lg" />
        <span className="text-xs text-ink-faint tabular-nums">{code}</span>
      </div>
      <dl className="grid flex-1 grid-cols-2 gap-4 lg:grid-cols-4">
        {facts.map((f) => (
          <div key={f.label} className="flex flex-col gap-0.5">
            <dt className="text-xs text-ink-faint">{f.label}</dt>
            <dd className="text-sm font-semibold text-ink tabular-nums">{f.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function PermissionEditor({ employeeId, userId }: { employeeId: string; userId: string }) {
  const access = useResource(`user-access:${userId}`, () => userAccessApi.get(userId));
  const org = useResource(`org-access:${employeeId}`, () => personalInfoApi.getOrgAccess(employeeId));
  const options = useResource("org-options", personalInfoApi.getOrgOptions);
  const error = access.error ?? org.error ?? options.error;
  if (error) return <ErrorState message={error.message} onRetry={() => (access.reload(), org.reload(), options.reload())} />;
  if (!access.data || !org.data || !options.data) return <LoadingState label="Loading permissions…" />;
  return (
    <PermissionForm
      // A fresh form after every save, so the saved state becomes the new starting point.
      key={`${JSON.stringify(access.data.overrides)}:${org.data.businessUnitIds.join(",")}`}
      employeeId={employeeId}
      access={access.data}
      org={org.data}
      businessUnits={options.data.businessUnits}
      onSaved={() => (access.reload(), org.reload())}
    />
  );
}

function PermissionForm({
  employeeId,
  access,
  org,
  businessUnits,
  onSaved,
}: {
  employeeId: string;
  access: UserAccessDto;
  org: OrgAccessDto;
  businessUnits: { id: string; name: string }[];
  onSaved: () => void;
}) {
  const toast = useToast();
  const { can } = useSession();
  const [mode, setMode] = useState<Mode>("feature");
  const [search, setSearch] = useState("");
  const [moduleFilter, setModuleFilter] = useState("");
  const [allowed, setAllowed] = useState<Set<string>>(
    () => new Set(access.overrides.filter((o) => o.effect === "ALLOW" && isMatrixAction(o.action)).map((o) => cellKey(o.featureKey, o.action))),
  );
  const [businessIds, setBusinessIds] = useState<string[]>(org.businessUnitIds);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const readOnly = !access.editable.access;

  const features = useMemo(() => permissionFeatures().filter((f) => f.actions.some(isMatrixAction)), []);
  const modules = useMemo(() => {
    const byId = new Map<string, { id: string; label: string; features: PermissionFeature[] }>();
    for (const f of features) {
      const m = byId.get(f.moduleId) ?? { id: f.moduleId, label: f.moduleLabel, features: [] };
      m.features.push(f);
      byId.set(f.moduleId, m);
    }
    return [...byId.values()];
  }, [features]);

  // Groups the user is in (active ones grant permissions).
  const activeGroups = access.groups.filter((g) => access.groupIds.includes(g.id) && g.status === "ACTIVE");
  const fromGroups = (f: PermissionFeature, a: PermissionAction) => activeGroups.filter((g) => g.fullAccess || g.grants[f.key]?.includes(a)).map((g) => g.name);
  /** Only permissions the signed-in user holds can be handed out. */
  const holdable = (f: PermissionFeature, a: PermissionAction) => f.actions.includes(a) && can(f.key, a);

  /** Ticks or clears cells; ticking any action also ticks View, clearing View clears the page. */
  function toggle(cells: [PermissionFeature, MatrixAction][], on: boolean) {
    const next = new Set(allowed);
    for (const [f, a] of cells) {
      if (!f.actions.includes(a)) continue;
      if (on) {
        if (!holdable(f, a)) continue;
        next.add(cellKey(f.key, a));
        if (f.actions.includes("view") && holdable(f, "view")) next.add(cellKey(f.key, "view"));
      } else {
        next.delete(cellKey(f.key, a));
        if (a === "view") for (const other of ACTIONS) next.delete(cellKey(f.key, other));
      }
    }
    setAllowed(next);
    setDirty(true);
  }

  const needle = search.trim().toLowerCase();
  const matches = (f: PermissionFeature) => (!moduleFilter || f.moduleId === moduleFilter) && (!needle || `${f.moduleLabel} ${f.submodule ?? ""} ${f.label}`.toLowerCase().includes(needle));
  const visibleFeatures = features.filter(matches);
  const visibleModules = modules.filter((m) => (!moduleFilter || m.id === moduleFilter) && (!needle || m.label.toLowerCase().includes(needle) || m.features.some(matches)));

  async function save() {
    setSaving(true);
    try {
      // Keep Deny overrides (unless now allowed) and overrides for actions not shown here.
      const kept = access.overrides.filter((o) => !isMatrixAction(o.action) || (o.effect === "DENY" && !allowed.has(cellKey(o.featureKey, o.action))));
      const allows: OverrideInput[] = [...allowed].map((key) => {
        const [featureKey, action] = key.split("|") as [string, MatrixAction];
        return { featureKey, action, effect: "ALLOW" };
      });
      await userAccessApi.update(access.user.id, { erpAccess: access.user.erpAccess, status: access.user.status, groupIds: access.groupIds, overrides: [...kept, ...allows] });
      const businessChanged = businessIds.length !== org.businessUnitIds.length || businessIds.some((id) => !org.businessUnitIds.includes(id));
      if (businessChanged) await personalInfoApi.updateOrgAccess(employeeId, { ...org, businessUnitIds: businessIds });
      toast.success("Permissions saved. They apply from the employee's next action.");
      setDirty(false);
      onSaved();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  const head = "px-2 py-2 text-center";
  const columnHeader = (a: MatrixAction, rows: PermissionFeature[]) => {
    const applicable = rows.filter((f) => f.actions.includes(a));
    const on = applicable.filter((f) => allowed.has(cellKey(f.key, a))).length;
    return (
      <th key={a} scope="col" className={cn(head, "w-20")}>
        <span className="flex flex-col items-center gap-1">
          {ACTION_LABELS[a]}
          {mode === "feature" && applicable.length > 0 && (
            <TriCheckbox
              label={`${ACTION_LABELS[a]} on every listed page`}
              checked={on === applicable.length}
              mixed={on > 0 && on < applicable.length}
              disabled={readOnly}
              onChange={(checked) => toggle(applicable.map((f) => [f, a]), checked)}
            />
          )}
        </span>
      </th>
    );
  };

  return (
    <>
      {readOnly && <Notice tone="error">{access.editable.reason ?? "You can view these permissions but not change them."}</Notice>}
      {activeGroups.length > 0 && (
        <p className="text-xs text-ink-muted">
          Permission groups: <span className="font-semibold text-ink">{activeGroups.map((g) => g.name).join(", ")}</span>. What they grant is shaded green and applies even when unticked here.
        </p>
      )}

      <Panel
        title="Permission"
        description={MODES.find((m) => m.id === mode)?.hint}
        flush
        stickyFooter
        footer={
          !readOnly && (
            <>
              <span className="mr-auto text-xs text-ink-faint">{allowed.size} individual permission(s){dirty ? " · unsaved changes" : ""}</span>
              <Button variant="accent" loading={saving} disabled={!dirty} onClick={() => void save()}>
                {!saving && <Save />} Save Permission
              </Button>
            </>
          )
        }
      >
        <div className="flex flex-wrap items-end gap-3 border-b border-line px-5 py-3">
          <div role="radiogroup" aria-label="Permission type" className="inline-flex overflow-hidden rounded border border-line text-sm">
            {MODES.map((m) => (
              <button
                key={m.id}
                type="button"
                role="radio"
                aria-checked={mode === m.id}
                onClick={() => setMode(m.id)}
                className={cn("px-3 py-1.5", mode === m.id ? "bg-accent-soft font-semibold text-accent-strong dark:text-accent" : "bg-surface text-ink-muted hover:bg-control")}
              >
                {m.label}
              </button>
            ))}
          </div>
          <BusinessSelect units={businessUnits} value={businessIds} disabled={readOnly} onChange={(ids) => (setBusinessIds(ids), setDirty(true))} />
          <select aria-label="Module" value={moduleFilter} onChange={(e) => setModuleFilter(e.target.value)} className={cn(CONTROL_CLASS, "w-44")}>
            <option value="">Module: All</option>
            {modules.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
          <label className="relative w-full sm:w-60">
            <span className="sr-only">Search modules and activities</span>
            <Search aria-hidden="true" className="pointer-events-none absolute top-2 left-2.5 size-4 text-ink-faint" />
            <input type="search" value={search} maxLength={100} placeholder="Search module or activity…" onChange={(e) => setSearch(e.target.value)} className={cn(CONTROL_CLASS, "pl-8")} />
          </label>
        </div>

        <div className="max-h-[65vh] overflow-auto">
          <table className="w-full min-w-max border-collapse text-[12px]">
            <thead className="sticky top-0 z-10 border-b-2 border-grid-head-rule bg-grid-head text-[11px] tracking-wide text-grid-head-ink uppercase">
              <tr>
                <th scope="col" className="w-12 px-2 py-2 text-right">SL</th>
                <th scope="col" className="px-2.5 py-2 text-left">Module Name</th>
                <th scope="col" className="px-2.5 py-2 text-left">Activity Name</th>
                {ACTIONS.map((a) => columnHeader(a, visibleFeatures))}
                <th scope="col" className={cn(head, "w-14")}>All</th>
              </tr>
            </thead>
            <tbody>
              {(mode === "feature" ? visibleFeatures.length : visibleModules.length) === 0 && (
                <tr>
                  <td colSpan={ACTIONS.length + 4} className="px-4 py-6 text-center text-sm text-ink-faint">
                    Nothing matches.
                  </td>
                </tr>
              )}
              {mode === "feature"
                ? visibleFeatures.map((f, i) => {
                    const cells = ACTIONS.filter((a) => f.actions.includes(a));
                    const on = cells.filter((a) => allowed.has(cellKey(f.key, a))).length;
                    return (
                      <tr key={f.key} className="border-t border-grid-line hover:bg-grid-hover">
                        <td className="px-2 py-1.5 text-right text-ink-faint tabular-nums">{i + 1}</td>
                        <td className="px-2.5 py-1.5 text-ink-muted">{f.moduleLabel}</td>
                        <td className="px-2.5 py-1.5 font-medium text-ink">
                          {f.submodule && <span className="text-ink-faint">{f.submodule} › </span>}
                          {f.label}
                        </td>
                        {ACTIONS.map((a) => (
                          <td key={a} className="px-2 py-1.5 text-center">
                            {f.actions.includes(a) ? (
                              <Cell
                                label={`${ACTION_LABELS[a]} · ${f.moduleLabel} › ${f.label}`}
                                checked={allowed.has(cellKey(f.key, a))}
                                groups={fromGroups(f, a)}
                                disabled={readOnly || !holdable(f, a)}
                                onChange={(checked) => toggle([[f, a]], checked)}
                              />
                            ) : (
                              <span className="text-ink-faint" aria-hidden="true">—</span>
                            )}
                          </td>
                        ))}
                        <td className="px-2 py-1.5 text-center">
                          <TriCheckbox label={`All actions · ${f.label}`} checked={on === cells.length} mixed={on > 0 && on < cells.length} disabled={readOnly} onChange={(checked) => toggle(cells.map((a) => [f, a]), checked)} />
                        </td>
                      </tr>
                    );
                  })
                : visibleModules.map((m, i) => {
                    const all = m.features.flatMap((f) => ACTIONS.filter((a) => f.actions.includes(a)).map((a) => [f, a] as [PermissionFeature, MatrixAction]));
                    const allOn = all.filter(([f, a]) => allowed.has(cellKey(f.key, a))).length;
                    return (
                      <tr key={m.id} className="border-t border-grid-line hover:bg-grid-hover">
                        <td className="px-2 py-1.5 text-right text-ink-faint tabular-nums">{i + 1}</td>
                        <td className="px-2.5 py-1.5 font-semibold text-ink">{m.label}</td>
                        <td className="px-2.5 py-1.5 text-ink-muted">All activities ({m.features.length})</td>
                        {ACTIONS.map((a) => {
                          const applicable = m.features.filter((f) => f.actions.includes(a));
                          if (applicable.length === 0) return <td key={a} className="px-2 py-1.5 text-center text-ink-faint">—</td>;
                          const on = applicable.filter((f) => allowed.has(cellKey(f.key, a))).length;
                          return (
                            <td key={a} className="px-2 py-1.5 text-center">
                              <TriCheckbox
                                label={`${ACTION_LABELS[a]} on every ${m.label} page`}
                                checked={on === applicable.length}
                                mixed={on > 0 && on < applicable.length}
                                disabled={readOnly}
                                onChange={(checked) => toggle(applicable.map((f) => [f, a]), checked)}
                              />
                            </td>
                          );
                        })}
                        <td className="px-2 py-1.5 text-center">
                          <TriCheckbox label={`Every permission in ${m.label}`} checked={allOn === all.length} mixed={allOn > 0 && allOn < all.length} disabled={readOnly} onChange={(checked) => toggle(all, checked)} />
                        </td>
                      </tr>
                    );
                  })}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  );
}

/** One permission: ticked = allowed individually; green = already granted by a group. */
function Cell({ label, checked, groups, disabled, onChange }: { label: string; checked: boolean; groups: string[]; disabled: boolean; onChange: (on: boolean) => void }) {
  const fromGroup = groups.length > 0;
  const title = disabled && !checked && !fromGroup ? "You do not have this permission yourself, so you cannot grant it." : fromGroup ? `Granted by group: ${groups.join(", ")}` : label;
  return (
    <span className={cn("inline-flex size-6 items-center justify-center rounded", fromGroup && "bg-success/15")} title={title}>
      <input
        type="checkbox"
        aria-label={fromGroup ? `${label} (granted by group ${groups.join(", ")})` : label}
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="size-4 cursor-pointer accent-(--accent-strong) disabled:cursor-not-allowed disabled:opacity-40"
      />
    </span>
  );
}

/** Business units the employee works in (multi-select dropdown). */
function BusinessSelect({ units, value, disabled, onChange }: { units: { id: string; name: string }[]; value: string[]; disabled: boolean; onChange: (ids: string[]) => void }) {
  const summary = value.length === 0 ? "Select business" : value.length === units.length ? "All businesses" : units.filter((u) => value.includes(u.id)).map((u) => u.name).join(", ");
  return (
    <details className="relative w-full sm:w-60">
      <summary
        aria-label="Business"
        className={cn(CONTROL_CLASS, "flex cursor-pointer list-none items-center justify-between gap-2 [&::-webkit-details-marker]:hidden", disabled && "pointer-events-none opacity-60")}
      >
        <span className="truncate">
          <span className="text-ink-faint">Business: </span>
          {summary}
        </span>
        <ChevronDown aria-hidden="true" className="size-3.5 shrink-0 text-ink-faint" />
      </summary>
      <div className="absolute z-20 mt-1 flex max-h-64 w-full flex-col gap-1 overflow-auto rounded border border-line bg-surface p-2 shadow-dropdown">
        {units.length === 0 ? (
          <p className="px-1 py-2 text-xs text-ink-faint">No business units set up.</p>
        ) : (
          <>
            <label className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-sm font-medium hover:bg-control">
              <input type="checkbox" className="size-4 accent-(--accent-strong)" checked={value.length === units.length} onChange={(e) => onChange(e.target.checked ? units.map((u) => u.id) : [])} />
              Select all
            </label>
            {units.map((u) => (
              <label key={u.id} className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-sm hover:bg-control">
                <input
                  type="checkbox"
                  className="size-4 accent-(--accent-strong)"
                  checked={value.includes(u.id)}
                  onChange={(e) => onChange(e.target.checked ? [...value, u.id] : value.filter((id) => id !== u.id))}
                />
                {u.name}
              </label>
            ))}
          </>
        )}
      </div>
    </details>
  );
}
