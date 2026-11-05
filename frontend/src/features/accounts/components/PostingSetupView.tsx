"use client";

import { RefreshCw, Save } from "lucide-react";
import { useState } from "react";
import { PageContainer, PageHead } from "@/components/layout/page";
import { Button } from "@/components/ui/button";
import { CONTROL } from "@/components/ui/form-field";
import { Card, ErrorState, LoadingState } from "@/components/ui/section";
import { useToast } from "@/components/ui/toast";
import { useResource } from "@/hooks/use-resource";
import { apiRequest, errorMessage } from "@/lib/api/client";
import { cn } from "@/lib/cn";

interface PostingStatus {
  roles: { key: string; label: string; accountId: string | null }[];
  accounts: { id: string; code: string; name: string; accountType: string }[];
  sources: { type: string; label: string; waiting: number; posted: number }[];
}

interface PostingRun {
  posted: Record<string, number>;
  missing: { key: string; label: string }[];
  failed: number;
}

const load = () => apiRequest<PostingStatus>("/api/accounts/posting-setup");

/**
 * Maps posting roles to GL accounts. Sales, purchase, POS, inventory and payroll
 * documents post to the ledger automatically after each save; a document waits
 * here while a role it needs has no account.
 */
export function PostingSetupView() {
  const status = useResource("accounts-posting-setup", load);
  return (
    <PageContainer>
      <PageHead
        title="Posting Setup"
        subtitle="GL accounts for automatic journals from Sales, Purchase, POS, Inventory and Payroll."
      />
      {status.error ? (
        <ErrorState message={status.error.message} onRetry={status.reload} />
      ) : !status.data ? (
        <LoadingState />
      ) : (
        <PostingForm key={status.data.roles.map((r) => r.accountId).join()} status={status.data} onChanged={status.reload} />
      )}
    </PageContainer>
  );
}

function PostingForm({ status, onChanged }: { status: PostingStatus; onChanged: () => void }) {
  const toast = useToast();
  const [roles, setRoles] = useState<Record<string, string>>(Object.fromEntries(status.roles.map((r) => [r.key, r.accountId ?? ""])));
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [lastRun, setLastRun] = useState<PostingRun | null>(null);
  const changed = status.roles.some((r) => (r.accountId ?? "") !== roles[r.key]);
  const waiting = status.sources.reduce((t, s) => t + s.waiting, 0);

  const save = async () => {
    setSaving(true);
    try {
      await apiRequest("/api/accounts/posting-setup", {
        method: "PUT",
        body: JSON.stringify(Object.fromEntries(Object.entries(roles).map(([k, v]) => [k, v || null]))),
      });
      toast.success("Posting accounts saved.");
      onChanged();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const run = async () => {
    setRunning(true);
    try {
      const result = await apiRequest<PostingRun>("/api/accounts/posting-setup/run", { method: "POST", body: "{}" });
      setLastRun(result);
      const total = Object.values(result.posted).reduce((t, n) => t + n, 0);
      toast.success(total ? `${total} documents posted to the ledger.` : "Nothing new to post.");
      onChanged();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <div className="flex flex-col gap-3 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-bold text-ink">Posting roles</h2>
            <Button variant="primary" loading={saving} disabled={!changed} onClick={save}>
              <Save /> Save
            </Button>
          </div>
          <div className="grid grid-cols-1 gap-x-6 gap-y-2 md:grid-cols-2">
            {status.roles.map((role) => (
              <label key={role.key} className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-ink-muted">{role.label}</span>
                <select
                  value={roles[role.key]}
                  onChange={(e) => setRoles({ ...roles, [role.key]: e.target.value })}
                  className={cn(CONTROL, "h-8", !roles[role.key] && "border-warning")}
                >
                  <option value="">Not set</option>
                  {status.accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.code} · {a.name} ({a.accountType})
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
          {status.accounts.length === 0 && <p className="text-sm text-warning">Add ledger accounts in Chart of Accounts first.</p>}
        </div>
      </Card>

      <Card>
        <div className="flex flex-col gap-3 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-bold text-ink">Documents</h2>
              <p className="text-xs text-ink-faint">Posted automatically after each save. Run it by hand after changing the accounts above.</p>
            </div>
            <Button loading={running} disabled={changed} onClick={run} title={changed ? "Save the accounts first" : undefined}>
              <RefreshCw /> Post {waiting ? `${waiting} waiting` : "now"}
            </Button>
          </div>
          <table className="w-full text-sm">
            <thead className="text-xs text-ink-muted">
              <tr>
                <th className="py-1 text-left font-semibold">Document</th>
                <th className="w-28 py-1 text-right font-semibold">Posted</th>
                <th className="w-28 py-1 text-right font-semibold">Waiting</th>
              </tr>
            </thead>
            <tbody>
              {status.sources.map((s) => (
                <tr key={s.type} className="border-t border-line">
                  <td className="py-1.5">{s.label}</td>
                  <td className="py-1.5 text-right tabular-nums">{s.posted}</td>
                  <td className={cn("py-1.5 text-right tabular-nums", s.waiting > 0 && "font-semibold text-warning")}>{s.waiting}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {lastRun && lastRun.missing.length > 0 && (
            <p className="text-sm text-warning">Still waiting for an account for: {lastRun.missing.map((m) => m.label).join(", ")}.</p>
          )}
          {lastRun && lastRun.failed > 0 && <p className="text-sm text-danger">{lastRun.failed} documents could not be posted; see the server log.</p>}
        </div>
      </Card>
    </div>
  );
}
