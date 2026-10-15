"use client";

import { ArrowLeft, Save, Search } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { PageContainer, PageHead } from "@/components/layout/page";
import { Button, buttonClasses } from "@/components/ui/button";
import { ErrorState, LoadingState } from "@/components/ui/section";
import { useToast } from "@/components/ui/toast";
import { useResource } from "@/hooks/use-resource";
import { errorMessage } from "@/lib/api/client";
import { cn } from "@/lib/cn";
import { entityMasterDataBreadcrumbs } from "@/features/configuration/entity-master-data/breadcrumbs";
import { CONTROL_CLASS, Field, FormGrid, Input, Notice, Panel, SaveState } from "@/features/configuration/entity-master-data/employee/components/kit";
import { securityPaths } from "../../paths";
import { permissionActivities } from "../activities";
import { PERMISSION_ACTIONS, permissionGroupInputSchema, type PermissionAction, type PermissionEntry, type PermissionGroupDto } from "../schemas/groups.schema";
import { permissionGroupApi } from "../services/groups.api";

type Grants = Record<string, Record<PermissionAction, boolean>>;
const NONE: Record<PermissionAction, boolean> = { canCreate: false, canEdit: false, canView: false, canDelete: false, canApprove: false };

export function PermissionGroupFormView({ groupId }: { groupId?: string }) {
  const group = useResource(groupId ? `permission-group:${groupId}` : null, () => permissionGroupApi.get(groupId!));
  const title = groupId ? "Edit Permission Group" : "Add Permission Group";
  const breadcrumbs = [
    ...entityMasterDataBreadcrumbs(securityPaths.permissionGroup),
    { label: groupId ? (group.data?.name ?? "Permission Group") : "Add Permission Group", href: groupId ? securityPaths.permissionGroupEdit(groupId) : securityPaths.permissionGroupNew },
  ];

  return (
    <PageContainer full>
      {group.error || (groupId && !group.data) ? (
        <>
          <PageHead title={title} breadcrumbs={breadcrumbs} />
          <section className="rounded border border-line bg-surface">
            {group.error ? <ErrorState message={group.error.message} onRetry={group.reload} /> : <LoadingState label="Loading permission group…" />}
          </section>
        </>
      ) : (
        <Editor key={group.data?.id ?? "new"} groupId={groupId} title={title} breadcrumbs={breadcrumbs} saved={group.data ?? null} />
      )}
    </PageContainer>
  );
}

function Editor({ groupId, title, breadcrumbs, saved }: { groupId?: string; title: string; breadcrumbs: { label: string; href: string }[]; saved: PermissionGroupDto | null }) {
  const router = useRouter();
  const toast = useToast();
  const activities = useMemo(() => permissionActivities(), []);
  const [name, setName] = useState(saved?.name ?? "");
  const [grants, setGrants] = useState<Grants>(() => Object.fromEntries((saved?.entries ?? []).map(({ activityKey, ...rest }: PermissionEntry) => [activityKey, rest])));
  const [filter, setFilter] = useState("");
  const [dirty, setDirty] = useState(false);
  const [nameError, setNameError] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const needle = filter.trim().toLowerCase();
  const visible = needle ? activities.filter((a) => a.moduleName.toLowerCase().includes(needle) || a.activityName.toLowerCase().includes(needle)) : activities;
  const grant = (key: string) => grants[key] ?? NONE;

  const set = (keys: string[], action: PermissionAction | "all", value: boolean) => {
    setGrants((current) => {
      const next = { ...current };
      for (const key of keys) {
        const row = { ...(next[key] ?? NONE) };
        for (const a of action === "all" ? PERMISSION_ACTIONS.map((p) => p.key) : [action]) row[a] = value;
        next[key] = row;
      }
      return next;
    });
    setDirty(true);
  };
  const allOn = (keys: string[], action: PermissionAction) => keys.length > 0 && keys.every((k) => grant(k)[action]);
  const granted = activities.filter((a) => PERMISSION_ACTIONS.some((p) => grant(a.key)[p.key])).length;

  const save = async () => {
    setFormError(null);
    const input = { name, entries: Object.entries(grants).map(([activityKey, row]) => ({ activityKey, ...row })) };
    const parsed = permissionGroupInputSchema.safeParse(input);
    if (!parsed.success) {
      setNameError(parsed.error.issues.find((i) => i.path[0] === "name")?.message);
      setFormError(parsed.error.issues[0].message);
      return;
    }
    setSaving(true);
    try {
      const result = groupId ? await permissionGroupApi.update(groupId, input) : await permissionGroupApi.create(input);
      toast.success(`Permission group "${result.name}" saved.`);
      router.push(securityPaths.permissionGroup);
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const visibleKeys = visible.map((a) => a.key);

  return (
    <>
      <PageHead
        title={title}
        subtitle={saved ? saved.name : "Group name and what it may do on each page."}
        breadcrumbs={breadcrumbs}
        actions={
          <Link href={securityPaths.permissionGroup} className={buttonClasses("secondary", "md")}>
            <ArrowLeft /> All Permission Groups
          </Link>
        }
      />
      <form
        noValidate
        className="flex flex-col gap-4 pb-6"
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        {formError && <Notice tone="error">{formError}</Notice>}
        <Panel title="Permission Group">
          <FormGrid cols={3}>
            <Field label="Group Name" required error={nameError}>
              {(id) => (
                <Input
                  id={id}
                  value={name}
                  maxLength={150}
                  aria-invalid={!!nameError || undefined}
                  onChange={(e) => {
                    setName(e.target.value);
                    setDirty(true);
                    setNameError(undefined);
                  }}
                />
              )}
            </Field>
          </FormGrid>
        </Panel>

        <Panel
          flush
          title="Permission Matrix"
          description={`${granted} of ${activities.length} activities granted.`}
          actions={
            <label className="relative w-56">
              <span className="sr-only">Filter activities</span>
              <Search aria-hidden="true" className="pointer-events-none absolute top-2 left-2.5 size-4 text-ink-faint" />
              <input type="search" value={filter} maxLength={100} placeholder="Filter module or activity…" onChange={(e) => setFilter(e.target.value)} className={cn(CONTROL_CLASS, "pl-8")} />
            </label>
          }
        >
          <div className="overflow-x-auto">
            <table className="data-grid w-full min-w-max">
              <thead>
                <tr>
                  <th scope="col" className="w-12 px-2.5 py-2 text-left">
                    SL
                  </th>
                  <th scope="col" className="px-2.5 py-2 text-left">
                    Module Name
                  </th>
                  <th scope="col" className="px-2.5 py-2 text-left">
                    Activity Name
                  </th>
                  {PERMISSION_ACTIONS.map((action) => (
                    <th key={action.key} scope="col" className="w-24 px-2.5 py-2 text-center">
                      <label className="inline-flex cursor-pointer flex-col items-center gap-1">
                        {action.label}
                        <input
                          type="checkbox"
                          aria-label={`${action.label} on every listed activity`}
                          title="Tick every listed row"
                          checked={allOn(visibleKeys, action.key)}
                          onChange={(e) => set(visibleKeys, action.key, e.target.checked)}
                          className="size-4 accent-(--accent-strong)"
                        />
                      </label>
                    </th>
                  ))}
                  <th scope="col" className="w-16 px-2.5 py-2 text-center">
                    All
                  </th>
                </tr>
              </thead>
              <tbody>
                {visible.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-4 py-6 text-center text-sm text-ink-faint">
                      No activities match “{filter}”.
                    </td>
                  </tr>
                )}
                {visible.map((activity, index) => {
                  const row = grant(activity.key);
                  const every = PERMISSION_ACTIONS.every((p) => row[p.key]);
                  return (
                    <tr key={activity.key}>
                      <td className="px-2.5 py-2 text-right text-ink-faint tabular-nums">{index + 1}</td>
                      <td className="px-2.5 py-2 whitespace-nowrap">{activity.moduleName}</td>
                      <td className="px-2.5 py-2 font-medium whitespace-nowrap">{activity.activityName}</td>
                      {PERMISSION_ACTIONS.map((action) => (
                        <td key={action.key} className="px-2.5 py-2 text-center">
                          <input
                            type="checkbox"
                            aria-label={`${action.label} · ${activity.activityName}`}
                            checked={row[action.key]}
                            onChange={(e) => set([activity.key], action.key, e.target.checked)}
                            className="size-4 cursor-pointer accent-(--accent-strong)"
                          />
                        </td>
                      ))}
                      <td className="px-2.5 py-2 text-center">
                        <input
                          type="checkbox"
                          aria-label={`Everything · ${activity.activityName}`}
                          checked={every}
                          onChange={(e) => set([activity.key], "all", e.target.checked)}
                          className="size-4 cursor-pointer accent-(--accent-strong)"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>

        <div className="sticky bottom-0 z-10 flex flex-wrap items-center justify-end gap-2 rounded border border-line bg-surface/95 px-4 py-2.5 shadow-xs backdrop-blur">
          <SaveState dirty={dirty} />
          <Link href={securityPaths.permissionGroup} className={buttonClasses("secondary", "md")}>
            Cancel
          </Link>
          <Button type="submit" variant="accent" loading={saving}>
            {!saving && <Save />} Save
          </Button>
        </div>
      </form>
    </>
  );
}
