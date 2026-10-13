"use client";

import { Plus, X } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { ErrorState, LoadingState } from "@/components/ui/section";
import { useToast } from "@/components/ui/toast";
import { useResource } from "@/hooks/use-resource";
import { errorMessage } from "@/lib/api/client";
import type {
  CredentialsDto,
  OrgAccessDto,
  OrgOptionsDto,
  RoleDto,
  UpdateCredentialsInput,
} from "../schemas/personal-info.schema";
import { personalInfoApi } from "../services/personal-info.api";
import { AddRoleDialog } from "./AddRoleDialog";
import { CONTROL_CLASS, Field, FormGrid, Input, Panel, Select, StatusBadge } from "./kit";

// ─── Multi-select (chips + add) ───────────────────────────────────────────────

function MultiSelect({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: { id: string; name: string }[];
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  const id = useId();
  const add = (value: string) => {
    if (value && !selected.includes(value)) onChange([...selected, value]);
  };
  const remove = (value: string) => onChange(selected.filter((s) => s !== value));
  const chosen = options.filter((o) => selected.includes(o.id));
  const available = options.filter((o) => !selected.includes(o.id));

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-xs font-medium text-ink-muted">
        {label}
        <span className="ml-1 font-normal text-ink-faint">({chosen.length})</span>
      </label>
      <select
        id={id}
        value=""
        disabled={available.length === 0}
        onChange={(e) => add(e.target.value)}
        className={CONTROL_CLASS}
      >
        <option value="">{available.length ? `Add ${label.toLowerCase()}…` : "All added"}</option>
        {available.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>
      <ul className="flex min-h-7 flex-wrap gap-1.5 pt-1">
        {chosen.length === 0 && <li className="text-xs text-ink-faint">None selected</li>}
        {chosen.map((item) => (
          <li
            key={item.id}
            className="inline-flex h-6 items-center gap-1 rounded-full border border-accent-line bg-accent-soft pr-1 pl-2.5 text-xs font-medium text-accent-strong dark:text-accent"
          >
            {item.name}
            <button
              type="button"
              aria-label={`Remove ${item.name}`}
              onClick={() => remove(item.id)}
              className="flex size-4 items-center justify-center rounded-full hover:bg-accent-line hover:text-danger"
            >
              <X className="size-3" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

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

// ─── Organisational access ────────────────────────────────────────────────────

function OrgAccessPanel({
  employeeId,
  access,
  options,
  onSaved,
}: {
  employeeId: string;
  access: OrgAccessDto;
  options: OrgOptionsDto;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [buIds, setBuIds] = useState<string[]>(access.businessUnitIds);
  const [officeIds, setOfficeIds] = useState<string[]>(access.officeIds);
  const [warehouseIds, setWarehouseIds] = useState<string[]>(access.warehouseIds);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await personalInfoApi.updateOrgAccess(employeeId, { businessUnitIds: buIds, officeIds, warehouseIds });
      toast.success("Organisational access saved.");
      onSaved();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Panel
      title="Data Access"
      description="Business units, offices and warehouses this user may work with."
      footer={
        <Button variant="accent" loading={saving} onClick={handleSave}>
          Save Access
        </Button>
      }
    >
      <FormGrid cols={3}>
        <MultiSelect label="Business Units" options={options.businessUnits} selected={buIds} onChange={setBuIds} />
        <MultiSelect label="Offices" options={options.offices} selected={officeIds} onChange={setOfficeIds} />
        <MultiSelect label="Warehouses" options={options.warehouses} selected={warehouseIds} onChange={setWarehouseIds} />
      </FormGrid>
    </Panel>
  );
}

// ─── Section ──────────────────────────────────────────────────────────────────

export function ErpAccessSection({ employeeId }: { employeeId: string }) {
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

  return (
    <>
      <CredentialsPanel
        employeeId={employeeId}
        creds={creds.data}
        roles={roles}
        onRolesChange={setRoles}
        onSaved={creds.reload}
      />
      {creds.data.hasAccount && (
        <OrgAccessPanel employeeId={employeeId} access={access.data} options={options.data} onSaved={access.reload} />
      )}
    </>
  );
}
