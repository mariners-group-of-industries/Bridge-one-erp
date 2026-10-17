"use client";

import { ArrowLeft, Download, Paperclip, Save, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PageContainer, PageHead } from "@/components/layout/page";
import { Button, buttonClasses } from "@/components/ui/button";
import { ErrorState, LoadingState } from "@/components/ui/section";
import { Tabs } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast";
import { useResource } from "@/hooks/use-resource";
import { ApiClientError, errorMessage } from "@/lib/api/client";
import { cn } from "@/lib/cn";
import { entityMasterDataBreadcrumbs } from "@/features/configuration/entity-master-data/breadcrumbs";
import { Checkbox, Field, FormGrid, Input, Notice, Panel, PanelSection, SaveState, Select } from "@/features/configuration/entity-master-data/employee/components/kit";
import { salesConfigPaths } from "../../paths";
import { WALLET_FLAGS, walletInputSchema, type WalletDto, type WalletFlag, type WalletFormOptions } from "../schemas/wallet.schema";
import { walletApi } from "../services/wallet.api";

type FormState = Omit<WalletDto, "id" | "isActive" | "attachment">;

const EMPTY: FormState = {
  businessUnitId: "",
  name: "",
  commissionPercent: "",
  isCash: false,
  bankAccountId: "",
  officeId: "",
  referenceCode: "",
  isRounding: false,
  isCoupon: false,
  isWalletCharge: false,
  isReferenceRequired: false,
  isMfs: false,
};

const TABS = [
  { id: "required", label: "Required" },
  { id: "others", label: "Others" },
] as const;
const REQUIRED_FIELDS = new Set(["businessUnitId", "name", "commissionPercent", "isCash", "bankAccountId"]);
const ACCEPT = "application/pdf,image/png,image/jpeg,image/webp";
const MAX_BYTES = 5 * 1024 * 1024;
const PERCENT = /^\d{0,3}(\.\d{0,2})?$/;

export function WalletFormView({ walletId }: { walletId?: string }) {
  const options = useResource("wallet-form-options", walletApi.formOptions);
  const wallet = useResource(walletId ? `wallet:${walletId}` : null, () => walletApi.get(walletId!));
  const title = walletId ? "Edit Wallet" : "Add Wallet";
  const breadcrumbs = [
    ...entityMasterDataBreadcrumbs(salesConfigPaths.walletSetup),
    { label: walletId ? (wallet.data?.name ?? "Wallet") : "Add Wallet", href: walletId ? salesConfigPaths.walletEdit(walletId) : salesConfigPaths.walletNew },
  ];
  const error = options.error ?? wallet.error;
  const ready = options.data && (!walletId || wallet.data);

  return (
    <PageContainer full>
      {error || !ready ? (
        <>
          <PageHead title={title} breadcrumbs={breadcrumbs} />
          <section className="rounded border border-line bg-surface">
            {error ? (
              <ErrorState
                message={error.message}
                onRetry={() => {
                  options.reload();
                  wallet.reload();
                }}
              />
            ) : (
              <LoadingState label="Loading wallet form…" />
            )}
          </section>
        </>
      ) : (
        <WalletEditor key={wallet.data?.id ?? "new"} walletId={walletId} title={title} breadcrumbs={breadcrumbs} saved={wallet.data ?? null} options={options.data!} />
      )}
    </PageContainer>
  );
}

function WalletEditor({
  walletId,
  title,
  breadcrumbs,
  saved,
  options,
}: {
  walletId?: string;
  title: string;
  breadcrumbs: { label: string; href: string }[];
  saved: WalletDto | null;
  options: WalletFormOptions;
}) {
  const router = useRouter();
  const toast = useToast();
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("required");
  const [form, setForm] = useState<FormState>(() => {
    if (saved) {
      const { id: _id, isActive: _active, attachment: _attachment, ...rest } = saved;
      return rest;
    }
    return { ...EMPTY, businessUnitId: options.businessUnits.length === 1 ? options.businessUnits[0].id : "" };
  });
  const [attachment] = useState(saved?.attachment ?? null);
  const [file, setFile] = useState<File | null>(null);
  const [removeFile, setRemoveFile] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const patch = (changes: Partial<FormState>) => {
    setForm((current) => ({ ...current, ...changes }));
    setDirty(true);
    setErrors((current) => {
      const next = { ...current };
      for (const key of Object.keys(changes)) delete next[key];
      return next;
    });
  };
  const err = (key: string) => errors[key];
  const offices = options.offices.filter((o) => o.businessUnitId === form.businessUnitId);

  const save = async () => {
    setFormError(null);
    const parsed = walletInputSchema.safeParse(form);
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) next[issue.path.join(".")] ??= issue.message;
      setErrors(next);
      setFormError("Please correct the highlighted fields.");
      setTab(Object.keys(next).some((key) => REQUIRED_FIELDS.has(key)) ? "required" : "others");
      return;
    }
    setSaving(true);
    try {
      const result = walletId ? await walletApi.update(walletId, form) : await walletApi.create(form);
      // The wallet is saved; the attachment follows.
      try {
        if (file) await walletApi.uploadAttachment(result.id, file);
        else if (removeFile && attachment) await walletApi.removeAttachment(result.id);
      } catch (uploadError) {
        toast.error(`Wallet saved, but the attachment failed: ${errorMessage(uploadError)}`);
        router.push(salesConfigPaths.walletEdit(result.id));
        return;
      }
      toast.success(`Wallet "${result.name}" saved.`);
      router.push(salesConfigPaths.walletSetup);
    } catch (error) {
      if (error instanceof ApiClientError && error.fieldErrors) {
        setErrors(Object.fromEntries(Object.entries(error.fieldErrors).map(([key, list]) => [key, list[0] ?? ""])));
      }
      setFormError(errorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const tabs = TABS.map((t) => ({
    ...t,
    badge: Object.keys(errors).some((key) => (t.id === "required" ? REQUIRED_FIELDS.has(key) : !REQUIRED_FIELDS.has(key))) ? "!" : undefined,
  }));

  return (
    <>
      <PageHead
        title={title}
        subtitle={saved ? saved.name : "Wallet name, commission and where the money settles."}
        breadcrumbs={breadcrumbs}
        actions={
          <Link href={salesConfigPaths.walletSetup} className={buttonClasses("secondary", "md")}>
            <ArrowLeft /> All Wallets
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

        <Panel flush>
          <Tabs tabs={tabs} value={tab} onChange={setTab} label="Wallet sections">
            <div className={cn("px-5 py-4", tab !== "required" && "hidden")}>
              <PanelSection title="Wallet">
                <FormGrid cols={3}>
                  {options.businessUnits.length > 1 && (
                    <Field label="Business Unit" required error={err("businessUnitId")}>
                      {(id) => (
                        <Select
                          id={id}
                          value={form.businessUnitId}
                          placeholder="Select business unit…"
                          options={options.businessUnits.map((u) => ({ value: u.id, label: u.name }))}
                          aria-invalid={!!err("businessUnitId") || undefined}
                          onChange={(e) => patch({ businessUnitId: e.target.value, officeId: "" })}
                        />
                      )}
                    </Field>
                  )}
                  <Field label="Wallet Name" required error={err("name")}>
                    {(id) => <Input id={id} value={form.name} maxLength={100} aria-invalid={!!err("name") || undefined} onChange={(e) => patch({ name: e.target.value })} />}
                  </Field>
                  <Field label="Commission (%)" required error={err("commissionPercent")}>
                    {(id) => (
                      <Input
                        id={id}
                        inputMode="decimal"
                        placeholder="0.00"
                        className="text-right tabular-nums"
                        value={form.commissionPercent}
                        aria-invalid={!!err("commissionPercent") || undefined}
                        onChange={(e) => PERCENT.test(e.target.value) && patch({ commissionPercent: e.target.value })}
                      />
                    )}
                  </Field>
                </FormGrid>
              </PanelSection>
              <PanelSection title="Settlement">
                <FormGrid cols={3}>
                  <fieldset className="flex flex-col gap-1.5">
                    <legend className="mb-1.5 text-xs font-medium text-ink-muted">Is Cash?</legend>
                    <div className="flex items-center gap-4 pt-1">
                      {(
                        [
                          [true, "Yes"],
                          [false, "No"],
                        ] as const
                      ).map(([value, label]) => (
                        <label key={label} className="inline-flex cursor-pointer items-center gap-1.5 text-sm text-ink">
                          <input
                            type="radio"
                            name="isCash"
                            checked={form.isCash === value}
                            onChange={() => patch({ isCash: value, ...(value ? { bankAccountId: "" } : {}) })}
                            className="size-4 accent-(--accent-strong)"
                          />
                          {label}
                        </label>
                      ))}
                    </div>
                  </fieldset>
                  <Field label="Bank Account" required={!form.isCash} error={err("bankAccountId")} hint={form.isCash ? "Cash wallets need no bank account." : undefined} span={2}>
                    {(id) => (
                      <Select
                        id={id}
                        value={form.bankAccountId}
                        disabled={form.isCash}
                        placeholder={options.bankAccounts.length ? "Select bank account…" : "No bank accounts in Accounts yet"}
                        options={options.bankAccounts.map((a) => ({ value: a.id, label: `${a.accountNumber} · ${a.bankName}, ${a.branchName}` }))}
                        aria-invalid={!!err("bankAccountId") || undefined}
                        onChange={(e) => patch({ bankAccountId: e.target.value })}
                      />
                    )}
                  </Field>
                </FormGrid>
              </PanelSection>
            </div>

            <div className={cn("px-5 py-4", tab !== "others" && "hidden")}>
              <PanelSection title="Details">
                <FormGrid cols={3}>
                  <Field label="Office" error={err("officeId")}>
                    {(id) => (
                      <Select
                        id={id}
                        value={form.officeId}
                        disabled={!form.businessUnitId}
                        placeholder="Select office…"
                        options={offices.map((o) => ({ value: o.id, label: o.name }))}
                        onChange={(e) => patch({ officeId: e.target.value })}
                      />
                    )}
                  </Field>
                  <Field label="Reference Code" error={err("referenceCode")}>
                    {(id) => <Input id={id} value={form.referenceCode} maxLength={50} onChange={(e) => patch({ referenceCode: e.target.value })} />}
                  </Field>
                  <Field label="Attachment" hint="PDF, PNG, JPEG or WebP · up to 5 MB">
                    {(id) => (
                      <div className="flex flex-col gap-1.5">
                        {attachment && !removeFile && !file && (
                          <div className="flex items-center gap-1.5 text-sm">
                            <Paperclip aria-hidden="true" className="size-3.5 text-ink-faint" />
                            <a href={walletApi.attachmentUrl(walletId!)} className="min-w-0 truncate text-accent-strong hover:underline dark:text-accent" title="Download">
                              {attachment.name}
                            </a>
                            <Download aria-hidden="true" className="size-3.5 text-ink-faint" />
                            <Button
                              variant="ghost"
                              size="icon"
                              className="ml-auto hover:text-danger"
                              aria-label="Remove attachment"
                              onClick={() => {
                                setRemoveFile(true);
                                setDirty(true);
                              }}
                            >
                              <X />
                            </Button>
                          </div>
                        )}
                        <input
                          id={id}
                          type="file"
                          accept={ACCEPT}
                          className="text-sm text-ink file:mr-2 file:rounded file:border file:border-line file:bg-control file:px-2 file:py-1 file:text-ink"
                          onChange={(e) => {
                            const chosen = e.target.files?.[0] ?? null;
                            if (chosen && chosen.size > MAX_BYTES) {
                              toast.error("Attachments must be 5 MB or smaller.");
                              e.target.value = "";
                              return;
                            }
                            setFile(chosen);
                            setDirty(true);
                          }}
                        />
                      </div>
                    )}
                  </Field>
                </FormGrid>
              </PanelSection>
              <PanelSection title="Options">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
                  {WALLET_FLAGS.map((flag) => (
                    <Checkbox key={flag.key} label={flag.label} checked={form[flag.key as WalletFlag]} onChange={(e) => patch({ [flag.key]: e.target.checked } as Partial<FormState>)} />
                  ))}
                </div>
              </PanelSection>
            </div>
          </Tabs>
        </Panel>

        <div className="sticky bottom-0 z-10 flex flex-wrap items-center justify-end gap-2 rounded border border-line bg-surface/95 px-4 py-2.5 shadow-xs backdrop-blur">
          <SaveState dirty={dirty} />
          <Link href={salesConfigPaths.walletSetup} className={buttonClasses("secondary", "md")}>
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
