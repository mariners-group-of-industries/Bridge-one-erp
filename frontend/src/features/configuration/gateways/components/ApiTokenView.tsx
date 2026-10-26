"use client";

import { Ban, Check, Copy, KeyRound, Plus, Trash2, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { PageContainer, PageHead } from "@/components/layout/page";
import { Button } from "@/components/ui/button";
import { ConfirmDialog, Dialog } from "@/components/ui/dialog";
import { ErrorState, LoadingState } from "@/components/ui/section";
import { useToast } from "@/components/ui/toast";
import { useResource } from "@/hooks/use-resource";
import { errorMessage } from "@/lib/api/client";
import { cn } from "@/lib/cn";
import { entityMasterDataBreadcrumbs } from "@/features/configuration/entity-master-data/breadcrumbs";
import { EmptyBlock, Field, FormGrid, Input, Notice, Select } from "@/features/configuration/entity-master-data/employee/components/kit";
import { gatewaysPaths } from "../paths";
import { generateTokenSchema, TOKEN_ACCESS, TOKEN_EXPIRY, type ApiTokenRow, type GeneratedToken, type GenerateTokenInput } from "../schemas/api-token.schema";
import { apiTokenApi } from "../services/api-token.api";

const BREADCRUMBS = entityMasterDataBreadcrumbs(gatewaysPaths.apiConfiguration);
const HEADERS = ["SL", "Action", "Name", "Token", "Access", "Status", "Created By", "Created", "Expires", "Last Used"];
const dateTime = (iso: string | null) => (iso ? new Date(iso).toLocaleString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true }) : "—");

const STATUS_STYLE = {
  ACTIVE: "border-success/40 bg-success/10 text-success",
  EXPIRED: "border-warning/40 bg-warning/10 text-warning",
  REVOKED: "border-line bg-control text-ink-faint",
} as const;

export function ApiTokenView() {
  const toast = useToast();
  const tokens = useResource("api-tokens", apiTokenApi.list);
  const [generating, setGenerating] = useState(false);
  const [confirm, setConfirm] = useState<{ kind: "revoke" | "delete"; row: ApiTokenRow } | null>(null);
  const [busy, setBusy] = useState(false);
  const origin = typeof window === "undefined" ? "" : window.location.origin;

  return (
    <PageContainer full>
      <PageHead
        title="API Configuration"
        subtitle="Tokens that let other systems call the BridgeOne API."
        breadcrumbs={BREADCRUMBS}
        actions={
          <Button variant="accent" onClick={() => setGenerating(true)}>
            <Plus /> Generate New Token
          </Button>
        }
      />

      <section aria-label="How to use a token" className="rounded border border-line bg-surface p-4 shadow-xs">
        <h2 className="text-sm font-semibold text-ink">Using a token</h2>
        <p className="mt-1 text-xs text-ink-faint">
          Send it in the Authorization header of every request. Read-only tokens can only make GET requests. Revoke a token as soon as it is no longer needed.
        </p>
        <pre className="mt-3 overflow-x-auto rounded border border-line bg-canvas px-3 py-2 text-xs text-ink">
          <code>{`curl -H "Authorization: Bearer <your token>" ${origin || "https://your-domain"}/api/configuration/entity-master-data/items`}</code>
        </pre>
      </section>

      <section aria-label="API tokens" className="rounded border border-line bg-surface shadow-xs">
        {tokens.error ? (
          <ErrorState message={tokens.error.message} onRetry={tokens.reload} />
        ) : !tokens.data ? (
          <LoadingState label="Loading tokens…" />
        ) : tokens.data.length === 0 ? (
          <div className="p-5">
            <EmptyBlock icon={<KeyRound />} title="No API tokens yet">
              <Button variant="accent" size="sm" className="mt-3" onClick={() => setGenerating(true)}>
                <Plus /> Generate New Token
              </Button>
            </EmptyBlock>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-grid w-full min-w-max">
              <thead>
                <tr>
                  {HEADERS.map((h) => (
                    <th key={h} scope="col" className="px-2.5 py-2 text-left whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tokens.data.map((row, index) => (
                  <tr key={row.id}>
                    <td className="w-12 px-2.5 py-2 text-right text-ink-faint tabular-nums">{index + 1}</td>
                    <td className="w-24 px-1.5 py-1">
                      <div className="flex items-center justify-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="hover:text-warning"
                          aria-label={`Revoke ${row.name}`}
                          title="Revoke"
                          disabled={row.status === "REVOKED"}
                          onClick={() => setConfirm({ kind: "revoke", row })}
                        >
                          <Ban />
                        </Button>
                        <Button variant="ghost" size="icon" className="hover:text-danger" aria-label={`Delete ${row.name}`} title="Delete" onClick={() => setConfirm({ kind: "delete", row })}>
                          <Trash2 />
                        </Button>
                      </div>
                    </td>
                    <td className="px-2.5 py-2 font-medium whitespace-nowrap">{row.name}</td>
                    <td className="px-2.5 py-2 font-mono text-xs whitespace-nowrap text-ink-muted">{row.tokenPrefix}…</td>
                    <td className="px-2.5 py-2 whitespace-nowrap">{TOKEN_ACCESS.find((a) => a.value === row.access)?.label}</td>
                    <td className="px-2.5 py-2">
                      <span className={cn("inline-flex rounded border px-1.5 text-xs font-medium", STATUS_STYLE[row.status])}>{row.status.charAt(0) + row.status.slice(1).toLowerCase()}</span>
                    </td>
                    <td className="px-2.5 py-2 whitespace-nowrap">{row.createdByName ?? "—"}</td>
                    <td className="px-2.5 py-2 whitespace-nowrap tabular-nums">{dateTime(row.createdAt)}</td>
                    <td className="px-2.5 py-2 whitespace-nowrap tabular-nums">{row.expiresAt ? dateTime(row.expiresAt) : "Never"}</td>
                    <td className="px-2.5 py-2 whitespace-nowrap tabular-nums">{row.lastUsedAt ? dateTime(row.lastUsedAt) : "Never used"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <GenerateDialog open={generating} onClose={() => setGenerating(false)} onGenerated={(row) => tokens.mutate((current) => [row, ...(current ?? [])])} />
      <ConfirmDialog
        open={confirm !== null}
        title={confirm?.kind === "revoke" ? "Revoke token?" : "Delete token?"}
        message={
          confirm
            ? confirm.kind === "revoke"
              ? `"${confirm.row.name}" stops working immediately. Systems using it will get 401 errors.`
              : `Delete "${confirm.row.name}"? It stops working immediately and is removed from this list.`
            : ""
        }
        busy={busy}
        onClose={() => setConfirm(null)}
        onConfirm={async () => {
          if (!confirm) return;
          setBusy(true);
          try {
            if (confirm.kind === "revoke") await apiTokenApi.revoke(confirm.row.id);
            else await apiTokenApi.remove(confirm.row.id);
            toast.success(confirm.kind === "revoke" ? `"${confirm.row.name}" revoked.` : `"${confirm.row.name}" deleted.`);
            setConfirm(null);
            tokens.reload();
          } catch (err) {
            toast.error(errorMessage(err));
          } finally {
            setBusy(false);
          }
        }}
      />
    </PageContainer>
  );
}

const EMPTY: GenerateTokenInput = { name: "", access: "READ", expiry: "90" };

/** Asks for name, access and expiry; then shows the token once with a copy button. */
function GenerateDialog({ open, onClose, onGenerated }: { open: boolean; onClose: () => void; onGenerated: (row: ApiTokenRow) => void }) {
  const [form, setForm] = useState<GenerateTokenInput>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState<GeneratedToken | null>(null);
  const [copied, setCopied] = useState(false);

  const close = () => {
    setForm(EMPTY);
    setErrors({});
    setFormError(null);
    setCreated(null);
    setCopied(false);
    onClose();
  };

  const generate = async () => {
    const parsed = generateTokenSchema.safeParse(form);
    if (!parsed.success) {
      setErrors(Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])));
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const result = await apiTokenApi.generate(form);
      setCreated(result);
      const { token: _token, ...row } = result;
      onGenerated(row);
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  if (created) {
    return (
      <Dialog
        open={open}
        size="lg"
        title="Token generated"
        onClose={close}
        footer={
          <Button variant="accent" onClick={close}>
            Done
          </Button>
        }
      >
        <div className="flex flex-col gap-3">
          <div role="alert" className="flex items-start gap-2 rounded border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-ink">
            <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-warning" />
            Copy this token now and store it safely. It will not be shown again.
          </div>
          <div className="flex items-center gap-2">
            <code className="min-w-0 flex-1 overflow-x-auto rounded border border-line bg-canvas px-3 py-2 font-mono text-xs break-all text-ink select-all">{created.token}</code>
            <Button
              onClick={async () => {
                await navigator.clipboard.writeText(created.token).catch(() => undefined);
                setCopied(true);
              }}
            >
              {copied ? <Check /> : <Copy />} {copied ? "Copied" : "Copy"}
            </Button>
          </div>
          <p className="text-xs text-ink-faint">
            {created.name} · {TOKEN_ACCESS.find((a) => a.value === created.access)?.label} · {created.expiresAt ? `expires ${dateTime(created.expiresAt)}` : "never expires"}
          </p>
        </div>
      </Dialog>
    );
  }

  return (
    <Dialog
      open={open}
      title="Generate New Token"
      onClose={close}
      onSubmit={(event) => {
        event.preventDefault();
        void generate();
      }}
      footer={
        <>
          <Button onClick={close} disabled={saving}>
            Close
          </Button>
          <Button type="submit" variant="accent" loading={saving}>
            {!saving && <KeyRound />} Generate
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        {formError && <Notice tone="error">{formError}</Notice>}
        <FormGrid cols={1}>
          <Field label="Token Name" required error={errors.name} hint="Where it is used, e.g. “Distributor app”.">
            {(id) => <Input id={id} autoFocus value={form.name} maxLength={100} aria-invalid={!!errors.name || undefined} onChange={(e) => setForm({ ...form, name: e.target.value })} />}
          </Field>
          <Field label="Access" required error={errors.access}>
            {(id) => (
              <Select
                id={id}
                value={form.access}
                placeholder={false}
                options={TOKEN_ACCESS.map((a) => ({ value: a.value, label: a.label }))}
                onChange={(e) => setForm({ ...form, access: e.target.value as GenerateTokenInput["access"] })}
              />
            )}
          </Field>
          <Field label="Expires In" required error={errors.expiry}>
            {(id) => (
              <Select
                id={id}
                value={form.expiry}
                placeholder={false}
                options={TOKEN_EXPIRY.map((x) => ({ value: x.value, label: x.label }))}
                onChange={(e) => setForm({ ...form, expiry: e.target.value as GenerateTokenInput["expiry"] })}
              />
            )}
          </Field>
        </FormGrid>
      </div>
    </Dialog>
  );
}
