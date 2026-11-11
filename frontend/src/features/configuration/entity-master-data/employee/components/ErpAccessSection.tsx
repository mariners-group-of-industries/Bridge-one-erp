"use client";

import { Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ErrorState, LoadingState } from "@/components/ui/section";
import { useToast } from "@/components/ui/toast";
import { useResource } from "@/hooks/use-resource";
import { useSession } from "@/lib/auth/session";
import { PERMISSION_ADMIN_FEATURE } from "@/lib/permissions/registry";
import { UserAccessPanel } from "@/features/configuration/security/access/components/UserAccessPanel";
import { errorMessage } from "@/lib/api/client";
import type {
  CredentialsDto,
  RoleDto,
  UpdateCredentialsInput,
} from "../schemas/personal-info.schema";
import { personalInfoApi } from "../services/personal-info.api";
import { AddRoleDialog } from "./AddRoleDialog";
import { UserPermissionSection } from "./UserPermissionSection";
import { Field, FormGrid, Input, Panel, Select, StatusBadge } from "./kit";

// ─── Credentials ──────────────────────────────────────────────────────────────

function CredentialsPanel({
  employeeId,
  creds,
  roles,
  onRolesChange,
  onSaved,
}: {
  employeeId: string;
  creds: CredentialsDto;
  roles: RoleDto[];
  onRolesChange: (roles: RoleDto[]) => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [phone, setPhone] = useState(creds.phone ?? "");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [roleId, setRoleId] = useState(creds.roleId ?? "");
  const [errors, setErrors] = useState<Partial<Record<keyof UpdateCredentialsInput, string>>>({});
  const [saving, setSaving] = useState(false);
  const [addRoleOpen, setAddRoleOpen] = useState(false);

  const validate = (): UpdateCredentialsInput | null => {
    const e: typeof errors = {};
    if (!phone.trim()) e.phone = "Phone number is required.";
    if (password) {
      if (password.length < 8) e.password = "At least 8 characters required.";
      else if (!/[A-Z]/.test(password)) e.password = "Must contain an uppercase letter.";
      else if (!/[0-9]/.test(password)) e.password = "Must contain a number.";
      else if (!/[^A-Za-z0-9]/.test(password)) e.password = "Must contain a special character.";
      if (password !== confirmPassword) e.confirmPassword = "Passwords do not match.";
    }
    setErrors(e);
    return Object.keys(e).length
      ? null
      : { phone: phone.trim(), password: password || undefined, confirmPassword, roleId: roleId || undefined };
  };

  const handleSave = async () => {
    const input = validate();
    if (!input) return;
    setSaving(true);
    try {
      await personalInfoApi.updateCredentials(employeeId, input);
      setPassword("");
      setConfirmPassword("");
      toast.success("Login credentials saved.");
      onSaved();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Panel
      title="ERP Login"
      description={
        creds.hasAccount ? "Login credentials and role for this employee." : "This employee has no ERP login yet."
      }
      actions={
        creds.hasAccount && (
          <span className="flex items-center gap-2 text-xs text-ink-faint">
            <StatusBadge active={creds.isActive ?? false} />
            {creds.userSystemRole && <span>System role: <span className="font-medium text-ink">{creds.userSystemRole}</span></span>}
          </span>
        )
      }
      footer={
        <Button variant="accent" loading={saving} onClick={handleSave}>
          {creds.hasAccount ? "Update Login" : "Create Login"}
        </Button>
      }
    >
      <FormGrid>
        <Field label="Phone / Login ID" required error={errors.phone}>
          {(id) => (
            <Input
              id={id}
              value={phone}
              aria-invalid={!!errors.phone}
              placeholder="01XXXXXXXXX"
              onChange={(e) => {
                setPhone(e.target.value);
                setErrors((p) => ({ ...p, phone: undefined }));
              }}
            />
          )}
        </Field>
        <Field label="User Role">
          {(id) => (
            <div className="flex gap-2">
              <Select id={id} value={roleId} onChange={(e) => setRoleId(e.target.value)} placeholder="No role" options={roles.map((r) => ({ value: r.id, label: r.name }))} />
              <Button variant="accent-soft" size="icon" className="size-8" aria-label="Add role" title="Add role" onClick={() => setAddRoleOpen(true)}>
                <Plus />
              </Button>
            </div>
          )}
        </Field>
        <Field label="New Password" error={errors.password} hint={creds.hasAccount ? "Leave blank to keep the current password." : undefined}>
          {(id) => (
            <Input
              id={id}
              type="password"
              autoComplete="new-password"
              value={password}
              aria-invalid={!!errors.password}
              placeholder={creds.hasAccount ? "••••••••" : "Set a password"}
              onChange={(e) => {
                setPassword(e.target.value);
                setErrors((p) => ({ ...p, password: undefined }));
              }}
            />
          )}
        </Field>
        <Field label="Confirm Password" error={errors.confirmPassword}>
          {(id) => (
            <Input
              id={id}
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              aria-invalid={!!errors.confirmPassword}
              placeholder="Re-enter the new password"
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                setErrors((p) => ({ ...p, confirmPassword: undefined }));
              }}
            />
          )}
        </Field>
      </FormGrid>

      <AddRoleDialog
        open={addRoleOpen}
        onClose={() => setAddRoleOpen(false)}
        onCreated={(role) => {
          onRolesChange([...roles, role].sort((a, b) => a.name.localeCompare(b.name)));
          setRoleId(role.id);
        }}
      />
    </Panel>
  );
}

// ─── Section ──────────────────────────────────────────────────────────────────


/** Logins, data access and permissions decide who can sign in and what they see: permission administrators only. */
export function ErpAccessSection({ employeeId }: { employeeId: string }) {
  const { can } = useSession();
  if (!can(PERMISSION_ADMIN_FEATURE, "manage")) {
    return (
      <Panel title="ERP Login">
        <p className="text-sm text-ink-muted">Only users with Manage Permissions (Identity & Security › Permission Group) can set up logins and access.</p>
      </Panel>
    );
  }
  return <ErpAccessEditor employeeId={employeeId} />;
}

function ErpAccessEditor({ employeeId }: { employeeId: string }) {
  const [roles, setRoles] = useState<RoleDto[]>([]);

  const creds = useResource(`creds:${employeeId}`, () => personalInfoApi.getCredentials(employeeId));
  const access = useResource(`access:${employeeId}`, () => personalInfoApi.getOrgAccess(employeeId));
  const options = useResource("org-options", () => personalInfoApi.getOrgOptions());

  useEffect(() => {
    personalInfoApi.listRoles().then(setRoles).catch(() => null);
  }, []);

  const error = creds.error ?? access.error ?? options.error;
  if (error) {
    return (
      <Panel title="ERP Login">
        <ErrorState message={error.message} onRetry={() => { creds.reload(); access.reload(); }} />
      </Panel>
    );
  }
  if (!creds.data || !access.data || !options.data) {
    return (
      <Panel title="ERP Login">
        <LoadingState />
      </Panel>
    );
  }

  const orgAccess = access.data;
  const orgOptions = options.data;

  return (
    <>
      <CredentialsPanel
        employeeId={employeeId}
        creds={creds.data}
        roles={roles}
        onRolesChange={setRoles}
        onSaved={creds.reload}
      />
      {creds.data.userId && <UserAccessPanel userId={creds.data.userId} />}
      {creds.data.userId && (
        <UserPermissionSection
          // Restart from the stored values after every save.
          key={JSON.stringify(orgAccess)}
          employeeId={employeeId}
          saved={orgAccess}
          options={orgOptions}
          onSaved={access.reload}
        />
      )}
    </>
  );
}
