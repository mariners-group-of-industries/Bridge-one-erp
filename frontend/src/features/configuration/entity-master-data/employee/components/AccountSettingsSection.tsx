"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ErrorState, LoadingState } from "@/components/ui/section";
import { useToast } from "@/components/ui/toast";
import { useResource } from "@/hooks/use-resource";
import { errorMessage } from "@/lib/api/client";
import { cn } from "@/lib/cn";
import type { AccountSettingsDto } from "../schemas/personal-info.schema";
import { personalInfoApi } from "../services/personal-info.api";
import { Panel, SaveState } from "./kit";

const CHECKBOXES: { key: keyof AccountSettingsDto; label: string }[] = [
  { key: "holdSalary", label: "Hold Salary" },
  { key: "departmentApproval", label: "Department Approval" },
  { key: "isService", label: "Is Service" },
  { key: "holdPayment", label: "Hold Payment" },
  { key: "isReseller", label: "Reseller" },
  { key: "isUser", label: "User" },
  { key: "isMasterUser", label: "Master User" },
  { key: "loginWithEmployeeId", label: "Login With Employee ID" },
  { key: "isAllCustomerView", label: "All Customer View" },
  { key: "isSR", label: "Is SR" },
];

export function AccountSettingsSection({ employeeId }: { employeeId: string }) {
  const toast = useToast();
  const { data, error, reload } = useResource(`settings:${employeeId}`, () => personalInfoApi.getSettings(employeeId));
  const [local, setLocal] = useState<AccountSettingsDto | null>(null);
  const [saving, setSaving] = useState(false);

  const values = local ?? data;
  const dirty = local !== null;

  const toggle = (key: keyof AccountSettingsDto) => {
    if (!values) return;
    setLocal({ ...values, [key]: !values[key] });
  };

  const handleSave = async () => {
    if (!values) return;
    setSaving(true);
    try {
      await personalInfoApi.updateSettings(employeeId, values);
      setLocal(null);
      reload();
      toast.success("Account settings saved.");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Panel
      title="Account Settings"
      description="Payroll and access flags for this employee."
      footer={
        values && (
          <>
            <SaveState dirty={dirty} />
            <Button onClick={() => setLocal(null)} disabled={!dirty || saving}>
              Discard
            </Button>
            <Button variant="accent" loading={saving} onClick={handleSave} disabled={!dirty}>
              Save Settings
            </Button>
          </>
        )
      }
    >
      {error ? (
        <ErrorState message={error.message} onRetry={reload} />
      ) : !values ? (
        <LoadingState />
      ) : (
        <fieldset>
          <legend className="sr-only">Account settings</legend>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-5">
            {CHECKBOXES.map(({ key, label }) => {
              const checked = values[key];
              return (
                <label
                  key={key}
                  className={cn(
                    "flex cursor-pointer items-center gap-2.5 rounded border px-3 py-2 text-sm transition-colors select-none",
                    checked
                      ? "border-accent-line bg-accent-soft font-medium text-accent-strong dark:text-accent"
                      : "border-line text-ink hover:border-line-strong hover:bg-canvas",
                  )}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(key)}
                    className="size-4 shrink-0 accent-(--accent-strong)"
                  />
                  {label}
                </label>
              );
            })}
          </div>
        </fieldset>
      )}
    </Panel>
  );
}
