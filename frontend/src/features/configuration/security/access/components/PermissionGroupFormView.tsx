"use client";

import { ArrowLeft, Save, UserPlus, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PageContainer, PageHead } from "@/components/layout/page";
import { Button, buttonClasses } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Indicator } from "@/components/ui/indicator";
import { ErrorState, LoadingState } from "@/components/ui/section";
import { Tabs } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast";
import { useResource } from "@/hooks/use-resource";
import { ApiClientError, errorMessage } from "@/lib/api/client";
import { useSession } from "@/lib/auth/session";
import { PERMISSION_ADMIN_FEATURE, permissionFeatures } from "@/lib/permissions/registry";
import { entityMasterDataBreadcrumbs } from "@/features/configuration/entity-master-data/breadcrumbs";
import { CONTROL_CLASS, Field, FormGrid, Input, Notice, Panel, SaveState, Select, TextArea } from "@/features/configuration/entity-master-data/employee/components/kit";
import { securityPaths } from "../../paths";
import type { AccessUser, GrantMap, PermissionGroupDto } from "../schemas/access.schema";
import { permissionGroupApi } from "../services/access.api";
import { PermissionMatrix } from "./PermissionMatrix";

export function PermissionGroupFormView({ groupId }: { groupId?: string }) {
  const group = useResource(groupId ? `permission-group:${groupId}` : null, () => permissionGroupApi.get(groupId!));
  const title = groupId ? (group.data?.name ?? "Permission Group") : "Add Permission Group";
  const breadcrumbs = [...entityMasterDataBreadcrumbs(securityPaths.permissionGroup), { label: title, href: groupId ? securityPaths.permissionGroupEdit(groupId) : securityPaths.permissionGroupNew }];
  return (
    <PageContainer full>
      {group.error || (groupId && !group.data) ? (
        <>
          <PageHead title={title} breadcrumbs={breadcrumbs} />
          <section className="rounded border border-line bg-surface">{group.error ? <ErrorState message={group.error.message} onRetry={group.reload} /> : <LoadingState label="Loading permission group…" />}</section>
        </>
      ) : (
        <Editor key={group.data?.id ?? "new"} saved={group.data ?? null} title={title} breadcrumbs={breadcrumbs} onSaved={group.reload} />
      )}
    </PageContainer>
  );
}

const STATUS = [
  { value: "ACTIVE", label: "Active" },
  { value: "INACTIVE", label: "Inactive" },
];
type Tab = "permissions" | "users";

/** Every permission ticked: how a full-access group is shown. */
const allGrants = (): GrantMap => Object.fromEntries(permissionFeatures().map((f) => [f.key, [...f.actions]]));

/** Permissions that let someone hand out access: granting them needs a second look. */
const isCritical = (grants: GrantMap) => (grants[PERMISSION_ADMIN_FEATURE] ?? []).some((a) => a === "manage" || a === "assign");

function Editor({ saved, title, breadcrumbs, onSaved }: { saved: PermissionGroupDto | null; title: string; breadcrumbs: { label: string; href: string }[]; onSaved: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const { can } = useSession();
  const [tab, setTab] = useState<Tab>("permissions");
  const [name, setName] = useState(saved?.name ?? "");
  const [code, setCode] = useState(saved?.code ?? "");
  const [description, setDescription] = useState(saved?.description ?? "");
  const [status, setStatus] = useState<"ACTIVE" | "INACTIVE">(saved?.status ?? "ACTIVE");
  const [grants, setGrants] = useState<GrantMap>(saved?.grants ?? {});
  const [dirty, setDirty] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState<string | null>(null);
  const readOnly = !can(PERMISSION_ADMIN_FEATURE, saved ? "edit" : "create");
  const touch = () => setDirty(true);

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = "Enter the group name.";
    if (!/^[A-Za-z0-9_-]{2,60}$/.test(code.trim())) e.code = "2–60 letters, numbers, - or _.";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function requestSave() {
    if (!validate()) return;
    const reasons: string[] = [];
    if (isCritical(grants) && !isCritical(saved?.grants ?? {})) reasons.push("This group will let its users change other people's access (Manage Permissions / Assign).");
    if (saved && saved.userCount > 0 && Object.keys(grants).length === 0 && !saved.fullAccess) reasons.push(`All permissions will be removed from ${saved.userCount} user(s) of this group.`);
    if (saved && saved.status === "ACTIVE" && status === "INACTIVE" && saved.userCount > 0) reasons.push(`${saved.userCount} user(s) lose this group's permissions while it is inactive.`);
    if (reasons.length) setConfirming(reasons.join(" "));
    else void save();
  }

  async function save() {
    setConfirming(null);
    setSaving(true);
    setFormError(null);
    try {
      const input = { name: name.trim(), code: code.trim(), description: description.trim(), status, grants };
      const result = saved ? await permissionGroupApi.update(saved.id, input) : await permissionGroupApi.create(input);
      toast.success(saved ? "Permission group saved. Its users have the new permissions from their next action." : "Permission group created.");
      setDirty(false);
      if (saved) onSaved();
      else router.replace(securityPaths.permissionGroupEdit(result.id));
    } catch (err) {
      if (err instanceof ApiClientError && Object.keys(err.fieldErrors).length) setErrors(Object.fromEntries(Object.entries(err.fieldErrors).map(([k, v]) => [k, v[0]])));
      setFormError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PageHead
        title={title}
        breadcrumbs={breadcrumbs}
        subtitle={saved ? `${saved.code} · ${saved.userCount} user(s) · ${saved.permissionCount} permission(s)` : "Name the group, then tick what it grants."}
        actions={
          <Link href={securityPaths.permissionGroup} className={buttonClasses("secondary", "md")}>
            <ArrowLeft /> Back
          </Link>
        }
      />
      <section className="rounded border border-line bg-surface shadow-xs">
        <Tabs
          tabs={[
            { id: "permissions", label: "Details & Permissions" },
            { id: "users", label: "Users", badge: saved?.userCount },
          ]}
          value={tab}
          onChange={setTab}
          label="Permission group"
        >
          {tab === "permissions" ? (
            <form
              className="flex flex-col gap-4 p-4"
              onSubmit={(e) => {
                e.preventDefault();
                requestSave();
              }}
            >
              {formError && <Notice tone="error">{formError}</Notice>}
              {readOnly && <Notice tone="error">You can view this group but not change it.</Notice>}
              <Panel title="Group">
                <FormGrid cols={4}>
                  <Field label="Group Name" required error={errors.name}>
                    {(id) => <Input id={id} value={name} maxLength={150} disabled={readOnly} onChange={(e) => (setName(e.target.value), touch())} />}
                  </Field>
                  <Field label="Group Code" required error={errors.code} hint="Unique, e.g. SALES_MANAGER.">
                    {(id) => <Input id={id} value={code} maxLength={60} disabled={readOnly} className="font-mono uppercase" onChange={(e) => (setCode(e.target.value.toUpperCase()), touch())} />}
                  </Field>
                  <Field label="Status">
                    {(id) => <Select id={id} value={status} placeholder={false} options={STATUS} disabled={readOnly} onChange={(e) => (setStatus(e.target.value as "ACTIVE" | "INACTIVE"), touch())} />}
                  </Field>
                  <Field label="Description" span="full">
                    {(id) => <TextArea id={id} rows={2} value={description} maxLength={500} disabled={readOnly} onChange={(e) => (setDescription(e.target.value), touch())} />}
                  </Field>
                </FormGrid>
              </Panel>

              <Panel title="Permission Matrix" description="Ticking any action also ticks View, so the page appears in the menu. Greyed-out boxes are permissions you do not hold yourself.">
                {saved?.fullAccess ? (
                  <div className="flex flex-col gap-3">
                    <p className="text-sm text-ink-muted">
                      <Indicator color="orange">Full access</Indicator> This group grants every permission in the ERP and cannot be edited. It was created by the permissions migration so existing users kept their access: assign proper groups to its users, then remove them from this group.
                    </p>
                    <PermissionMatrix mode="grant" value={allGrants()} readOnly onChange={() => undefined} />
                  </div>
                ) : (
                  <PermissionMatrix mode="grant" value={grants} readOnly={readOnly} holdable={(f, a) => can(f, a)} onChange={(next) => (setGrants(next), touch())} />
                )}
              </Panel>

              {!readOnly && (
                <div className="sticky bottom-0 z-10 flex flex-wrap items-center justify-end gap-2 rounded border border-line bg-surface/95 px-4 py-2.5 shadow-xs backdrop-blur">
                  <SaveState dirty={dirty} />
                  <Link href={securityPaths.permissionGroup} className={buttonClasses("secondary", "md")}>
                    Cancel
                  </Link>
                  <Button type="submit" variant="accent" loading={saving} disabled={!dirty && !!saved}>
                    {!saving && <Save />} Save
                  </Button>
                </div>
              )}
            </form>
          ) : saved ? (
            <GroupUsers group={saved} onSaved={onSaved} />
          ) : (
            <p className="p-6 text-sm text-ink-muted">Save the group first, then assign users.</p>
          )}
        </Tabs>
      </section>

      <ConfirmDialog open={confirming !== null} title="Confirm permission change" message={confirming ?? ""} confirmLabel="Save anyway" busy={saving} onConfirm={() => void save()} onClose={() => setConfirming(null)} />
    </>
  );
}

/** Assign users to the group (replaces its members on save). */
function GroupUsers({ group, onSaved }: { group: PermissionGroupDto; onSaved: () => void }) {
  const toast = useToast();
  const { can, user: me } = useSession();
  const data = useResource(`permission-group-users:${group.id}`, () => permissionGroupApi.users(group.id));
  const [selected, setSelected] = useState<string[] | null>(null);
  const [saving, setSaving] = useState(false);
  const mayAssign = can(PERMISSION_ADMIN_FEATURE, "assign");
  if (data.error) return <ErrorState message={data.error.message} onRetry={data.reload} />;
  if (!data.data) return <LoadingState label="Loading users…" />;
  const ids = selected ?? data.data.userIds;
  const byId = new Map(data.data.users.map((u) => [u.id, u]));
  const blocked = (u: AccessUser) => (u.isMaster && !me?.isMaster) || u.id === me?.id;
  const available = data.data.users.filter((u) => !ids.includes(u.id) && !blocked(u));

  async function save() {
    setSaving(true);
    try {
      await permissionGroupApi.setUsers(group.id, ids);
      toast.success("Group members saved.");
      setSelected(null);
      data.reload();
      onSaved();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      {group.status === "INACTIVE" && <Notice tone="error">This group is inactive: its users get none of its permissions until it is activated.</Notice>}
      {mayAssign && (
        <label className="flex max-w-md flex-col gap-1 text-xs font-medium text-ink-muted">
          Add user
          <select
            className={CONTROL_CLASS}
            value=""
            disabled={available.length === 0}
            onChange={(e) => e.target.value && setSelected([...ids, e.target.value])}
          >
            <option value="">{available.length ? "Select a user…" : "Everyone is already in this group"}</option>
            {available.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
                {u.employeeCode ? ` (${u.employeeCode})` : ""} · {u.phone}
              </option>
            ))}
          </select>
        </label>
      )}
      <div className="overflow-x-auto rounded border border-grid-line">
        <table className="data-grid w-full min-w-max">
          <thead>
            <tr>
              {["SL", "Name", "Employee Code", "Phone", ""].map((h) => (
                <th key={h} scope="col" className="px-2.5 py-2 text-left">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ids.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-sm text-ink-faint">
                  No users in this group.
                </td>
              </tr>
            )}
            {ids.map((id, i) => {
              const u = byId.get(id);
              return (
                <tr key={id}>
                  <td className="w-12 px-2.5 py-2 text-right text-ink-faint tabular-nums">{i + 1}</td>
                  <td className="px-2.5 py-2 font-medium">
                    {u?.name ?? "Unknown user"} {u?.isMaster && <Indicator color="blue">Master</Indicator>}
                  </td>
                  <td className="px-2.5 py-2">{u?.employeeCode ?? "—"}</td>
                  <td className="px-2.5 py-2 tabular-nums">{u?.phone ?? "—"}</td>
                  <td className="w-12 px-1.5 py-1 text-center">
                    {mayAssign && u && !blocked(u) && (
                      <Button variant="ghost" size="icon" className="hover:text-danger" aria-label={`Remove ${u.name}`} title="Remove from group" onClick={() => setSelected(ids.filter((x) => x !== id))}>
                        <X />
                      </Button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {mayAssign && (
        <div className="flex items-center justify-end gap-2">
          <SaveState dirty={selected !== null} />
          <Button variant="secondary" disabled={selected === null} onClick={() => setSelected(null)}>
            Cancel
          </Button>
          <Button variant="accent" loading={saving} disabled={selected === null} onClick={() => void save()}>
            {!saving && <UserPlus />} Save Members
          </Button>
        </div>
      )}
    </div>
  );
}
