"use client";

import { Save, ShieldCheck } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Indicator } from "@/components/ui/indicator";
import { ErrorState, LoadingState } from "@/components/ui/section";
import { Tabs } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast";
import { useResource } from "@/hooks/use-resource";
import { errorMessage } from "@/lib/api/client";
import { useSession } from "@/lib/auth/session";
import { PERMISSION_ADMIN_FEATURE, permissionKey, type PermissionAction } from "@/lib/permissions/registry";
import { explainPermissions, groupFromGrants } from "@/lib/permissions/resolve";
import { Field, FormGrid, Notice, Panel, ReadValue, SaveState, Select } from "@/features/configuration/entity-master-data/employee/components/kit";
import { USER_STATUSES, type EffectivePermissionRow, type UserAccessDto, type UserStatus } from "../schemas/access.schema";
import { userAccessApi } from "../services/access.api";
import { overrideKey, PermissionMatrix, type OverrideMap } from "./PermissionMatrix";

type Tab = "access" | "groups" | "individual" | "effective";
const STATUS_LABEL: Record<UserStatus, string> = { ACTIVE: "Active", INACTIVE: "Inactive", SUSPENDED: "Suspended" };

/**
 * Edit Profile › ERP Access: whether the account may sign in, its permission
 * groups, individual Allow / Deny and the resulting effective permissions.
 */
export function UserAccessPanel({ userId }: { userId: string }) {
  const access = useResource(`user-access:${userId}`, () => userAccessApi.get(userId));
  if (access.error) {
    return (
      <Panel title="ERP Access & Permissions">
        <ErrorState message={access.error.message} onRetry={access.reload} />
      </Panel>
    );
  }
  if (!access.data) {
    return (
      <Panel title="ERP Access & Permissions">
        <LoadingState label="Loading access…" />
      </Panel>
    );
  }
  return <Editor key={JSON.stringify([access.data.user, access.data.groupIds, access.data.overrides])} saved={access.data} userId={userId} onSaved={access.reload} />;
}

const toOverrideMap = (rows: UserAccessDto["overrides"]): OverrideMap => Object.fromEntries(rows.map((o) => [overrideKey(o.featureKey, o.action), o.effect]));

function Editor({ saved, userId, onSaved }: { saved: UserAccessDto; userId: string; onSaved: () => void }) {
  const toast = useToast();
  const { user: me } = useSession();
  const [tab, setTab] = useState<Tab>("access");
  const [erpAccess, setErpAccess] = useState(saved.user.erpAccess);
  const [status, setStatus] = useState<UserStatus>(saved.user.status);
  const [isMaster, setIsMaster] = useState(saved.user.isMaster);
  const [groupIds, setGroupIds] = useState<string[]>(saved.groupIds);
  const [overrides, setOverrides] = useState<OverrideMap>(() => toOverrideMap(saved.overrides));
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState<string | null>(null);
  const editable = saved.editable.access;
  const touch = () => setDirty(true);

  // What the user would have with the current (unsaved) choices — the same rules the server applies.
  const selectedGroups = useMemo(() => saved.groups.filter((g) => groupIds.includes(g.id)), [saved.groups, groupIds]);
  const inheritedKeys = useMemo(() => {
    const rows = explainPermissions(selectedGroups.map(groupFromGrants), []);
    return new Set(rows.filter((r) => r.granted).map((r) => permissionKey(r.featureKey, r.action)));
  }, [selectedGroups]);
  const blockedReason = isMaster ? null : status === "SUSPENDED" ? "The account is suspended." : status === "INACTIVE" ? "The account is inactive." : !erpAccess ? "ERP access is not enabled." : null;
  const effective: EffectivePermissionRow[] = useMemo(() => {
    const overrideRows = Object.entries(overrides).map(([k, effect]) => {
      const [featureKey, action] = k.split("|");
      return { activityKey: featureKey, action, effect };
    });
    return explainPermissions(selectedGroups.map(groupFromGrants), overrideRows).map((r) => ({
      featureKey: r.featureKey,
      action: r.action,
      granted: isMaster || (blockedReason === null && r.granted),
      source: isMaster ? "master" : r.source,
      groups: r.groups,
    }));
  }, [selectedGroups, overrides, isMaster, blockedReason]);

  function reset() {
    setErpAccess(saved.user.erpAccess);
    setStatus(saved.user.status);
    setIsMaster(saved.user.isMaster);
    setGroupIds(saved.groupIds);
    setOverrides(toOverrideMap(saved.overrides));
    setDirty(false);
  }

  function requestSave() {
    const reasons: string[] = [];
    if (saved.user.erpAccess && !erpAccess) reasons.push("ERP access will be turned off: the user is signed out at once.");
    if (saved.user.status === "ACTIVE" && status !== "ACTIVE") reasons.push(`The account will be ${STATUS_LABEL[status].toLowerCase()}: the user is signed out at once.`);
    if (!saved.user.isMaster && isMaster) reasons.push("This account becomes a master account with full, unrestricted access.");
    if (saved.user.isMaster && !isMaster) reasons.push("This account loses master access.");
    const admin = (["manage", "assign"] as PermissionAction[]).some((a) => effective.find((r) => r.featureKey === PERMISSION_ADMIN_FEATURE && r.action === a)?.granted);
    const wasAdmin = saved.groups.some((g) => saved.groupIds.includes(g.id) && (g.fullAccess || (g.grants[PERMISSION_ADMIN_FEATURE] ?? []).some((a) => a === "manage")));
    if (admin && !wasAdmin) reasons.push("The user will be able to change other people's access.");
    if (reasons.length) setConfirming(reasons.join(" "));
    else void save();
  }

  async function save() {
    setConfirming(null);
    setSaving(true);
    try {
      await userAccessApi.update(userId, {
        erpAccess,
        status,
        ...(saved.editable.master ? { isMaster } : {}),
        groupIds,
        overrides: Object.entries(overrides).map(([k, effect]) => {
          const [featureKey, action] = k.split("|");
          return { featureKey, action: action as PermissionAction, effect };
        }),
      });
      toast.success("Access saved. It applies from the user's next action.");
      setDirty(false);
      onSaved();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  const grantedCount = effective.filter((r) => r.granted).length;
  const overrideCount = Object.keys(overrides).length;

  return (
    <Panel
      title="ERP Access & Permissions"
      description="Who may sign in, and what they may do. New accounts start with no access."
      actions={
        <span className="flex flex-wrap items-center gap-1.5">
          {saved.user.isMaster && <Indicator color="blue">Master account</Indicator>}
          <Indicator color={blockedReason ? "red" : "green"}>{blockedReason ? "Cannot sign in" : "Can sign in"}</Indicator>
        </span>
      }
      flush
    >
      {!editable && (
        <div className="px-5 pt-4">
          <Notice tone="error">{saved.editable.reason}</Notice>
        </div>
      )}
      <Tabs
        tabs={[
          { id: "access", label: "ERP Access" },
          { id: "groups", label: "Permission Groups", badge: groupIds.length },
          { id: "individual", label: "Individual Permissions", badge: overrideCount || undefined },
          { id: "effective", label: "Effective Permissions", badge: isMaster ? "All" : grantedCount },
        ]}
        value={tab}
        onChange={setTab}
        label="Access"
      >
        <div className="p-5">
          {tab === "access" && (
            <FormGrid cols={4}>
              <ReadValue label="Account Type" value="User (has an ERP login)" />
              <Field label="ERP Access Enabled">
                {(id) => (
                  <Select
                    id={id}
                    value={erpAccess ? "yes" : "no"}
                    placeholder={false}
                    disabled={!editable}
                    options={[
                      { value: "yes", label: "Yes" },
                      { value: "no", label: "No" },
                    ]}
                    onChange={(e) => (setErpAccess(e.target.value === "yes"), touch())}
                  />
                )}
              </Field>
              <Field label="Account Status">
                {(id) => <Select id={id} value={status} placeholder={false} disabled={!editable} options={USER_STATUSES.map((s) => ({ value: s, label: STATUS_LABEL[s] }))} onChange={(e) => (setStatus(e.target.value as UserStatus), touch())} />}
              </Field>
              <ReadValue label="Last Sign-in" value={saved.user.lastLoginAt ? new Date(saved.user.lastLoginAt).toLocaleString("en-GB") : "Never"} />
              <Field label="Master Administrator" hint={saved.editable.master ? "Full, unrestricted access. Only the master account can change this." : "Only the master account can change this."}>
                {(id) => (
                  <Select
                    id={id}
                    value={isMaster ? "yes" : "no"}
                    placeholder={false}
                    disabled={!saved.editable.master}
                    options={[
                      { value: "no", label: "No" },
                      { value: "yes", label: "Yes" },
                    ]}
                    onChange={(e) => (setIsMaster(e.target.value === "yes"), touch())}
                  />
                )}
              </Field>
            </FormGrid>
          )}

          {tab === "groups" && (
            <div className="flex flex-col gap-2">
              {isMaster && <Notice tone="success">Master accounts have every permission; groups do not change that.</Notice>}
              {saved.groups.length === 0 && <p className="text-sm text-ink-muted">No permission groups exist yet. Create them in Identity & Security › Permission Group.</p>}
              <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {saved.groups.map((g) => {
                  const checked = groupIds.includes(g.id);
                  const lockedOn = !g.assignable && !checked;
                  return (
                    <li key={g.id}>
                      <label className={`flex h-full cursor-pointer items-start gap-2.5 rounded border px-3 py-2.5 ${checked ? "border-accent-line bg-accent-soft/50" : "border-line bg-surface"} ${!editable || lockedOn ? "cursor-not-allowed opacity-60" : ""}`}>
                        <input
                          type="checkbox"
                          className="mt-0.5 size-4 accent-(--accent-strong)"
                          checked={checked}
                          disabled={!editable || lockedOn}
                          title={lockedOn ? "You can only assign groups whose permissions you have yourself." : undefined}
                          onChange={(e) => (setGroupIds(e.target.checked ? [...groupIds, g.id] : groupIds.filter((x) => x !== g.id)), touch())}
                        />
                        <span className="flex min-w-0 flex-col gap-0.5">
                          <span className="text-sm font-medium text-ink">{g.name}</span>
                          <span className="font-mono text-[11px] text-ink-faint">{g.code}</span>
                          <span className="flex flex-wrap gap-1">
                            {g.status === "INACTIVE" && <Indicator color="gray">Inactive — grants nothing</Indicator>}
                            {g.fullAccess && <Indicator color="orange">Full access</Indicator>}
                            {!g.fullAccess && <span className="text-xs text-ink-muted">{Object.values(g.grants).reduce((n, a) => n + a.length, 0)} permissions</span>}
                          </span>
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {tab === "individual" && (
            <PermissionMatrix
              mode="override"
              overrides={overrides}
              inherited={(f, a) => inheritedKeys.has(permissionKey(f, a))}
              readOnly={!editable}
              holdable={(f, a) => me?.isMaster === true || (me?.permissions ?? []).includes("*") || (me?.permissions ?? []).includes(permissionKey(f, a))}
              onChange={(next) => (setOverrides(next), touch())}
            />
          )}

          {tab === "effective" && (
            <div className="flex flex-col gap-3">
              <p className="flex items-center gap-2 text-sm text-ink-muted">
                <ShieldCheck className="size-4 text-accent-strong" />
                {dirty ? "Preview including your unsaved changes." : "What this user can do right now."}{" "}
                {isMaster ? "Master account: everything." : blockedReason ? `${blockedReason} The user cannot sign in, so nothing below applies.` : `${grantedCount} permission(s) granted.`}
              </p>
              <PermissionMatrix mode="effective" rows={effective} />
            </div>
          )}
        </div>
      </Tabs>

      {editable && (
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line px-5 py-3">
          <SaveState dirty={dirty} />
          <Button variant="secondary" disabled={!dirty} onClick={reset}>
            Cancel
          </Button>
          <Button variant="accent" loading={saving} disabled={!dirty} onClick={requestSave}>
            {!saving && <Save />} Save Access
          </Button>
        </div>
      )}

      <ConfirmDialog open={confirming !== null} title="Confirm access change" message={confirming ?? ""} confirmLabel="Save anyway" busy={saving} onConfirm={() => void save()} onClose={() => setConfirming(null)} />
    </Panel>
  );
}
