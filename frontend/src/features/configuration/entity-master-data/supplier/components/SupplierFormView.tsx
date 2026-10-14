"use client";

import { ArrowLeft, Crosshair, Download, ListPlus, Paperclip, Pencil, Save, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { PageContainer, PageHead } from "@/components/layout/page";
import { Button, buttonClasses } from "@/components/ui/button";
import { ErrorState, LoadingState } from "@/components/ui/section";
import { useToast } from "@/components/ui/toast";
import { useResource } from "@/hooks/use-resource";
import { ApiClientError, errorMessage } from "@/lib/api/client";
import { cn } from "@/lib/cn";
import { entityMasterDataBreadcrumbs } from "../../breadcrumbs";
import {
  Checkbox,
  EmptyBlock,
  Field,
  FormGrid,
  Input,
  Notice,
  Panel,
  PanelSection,
  SaveState,
  Select,
  TextArea,
} from "../../employee/components/kit";
import { entityMasterDataPaths } from "../../paths";
import {
  ALLOWED_SUPPLIER_ATTACHMENT_TYPES,
  MAX_SUPPLIER_ATTACHMENT_BYTES,
  supplierDetailSchema,
  supplierInputSchema,
  type SupplierAttachmentDto,
  type SupplierDetailInput,
  type SupplierDto,
  type SupplierFormOptions,
} from "../schemas/supplier.schema";
import { supplierApi } from "../services/supplier.api";
import { AddableSelect } from "../../components/AddableSelect";

// ─── Form state ───────────────────────────────────────────────────────────────

type Detail = Required<SupplierDetailInput>;

interface FormState {
  officeId: string;
  name: string;
  code: string;
  mobile: string;
  email: string;
  groupId: string;
  subGroupId: string;
  creditDays: string;
  tolerancePercent: string;
  binNumber: string;
  tcsPercent: string;
  vatRegistrationNo: string;
  tinNumber: string;
  tradeLicenseNo: string;
  isMonthly: boolean;
  isForeign: boolean;
  vdsApplicable: boolean;
  vatAccountingNotApplicable: boolean;
  isUser: boolean;
  billingAddress: string;
  districtId: string;
  thanaId: string;
  contactPerson: string;
  contactNo: string;
  taxBracketId: string;
  remarks: string;
  details: Detail[];
}

const EMPTY_DETAIL: Detail = {
  code: "",
  vendorName: "",
  address: "",
  gps: "",
  contactPerson: "",
  contactNumber: "",
  vatRegNo: "",
};

const EMPTY: FormState = {
  officeId: "",
  name: "",
  code: "",
  mobile: "",
  email: "",
  groupId: "",
  subGroupId: "",
  creditDays: "",
  tolerancePercent: "",
  binNumber: "",
  tcsPercent: "",
  vatRegistrationNo: "",
  tinNumber: "",
  tradeLicenseNo: "",
  isMonthly: false,
  isForeign: false,
  vdsApplicable: false,
  vatAccountingNotApplicable: false,
  isUser: false,
  billingAddress: "",
  districtId: "",
  thanaId: "",
  contactPerson: "",
  contactNo: "",
  taxBracketId: "",
  remarks: "",
  details: [],
};

function fromDto(dto: SupplierDto): FormState {
  return {
    ...EMPTY,
    ...dto,
    districtId: dto.districtId === "" ? "" : String(dto.districtId),
    details: dto.details.map((detail) => ({ ...EMPTY_DETAIL, ...detail })),
  };
}

const CHECKLIST = [
  { key: "isMonthly", label: "Is Monthly" },
  { key: "isForeign", label: "Is Foreign Supplier" },
  { key: "vdsApplicable", label: "VDS Applicable" },
  { key: "vatAccountingNotApplicable", label: "Is VAT Accounting Not Applicable" },
  { key: "isUser", label: "User" },
] as const;

const ACCEPT = ALLOWED_SUPPLIER_ATTACHMENT_TYPES.join(",");

const formatSize = (bytes: number) =>
  bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;

// ─── Loader ───────────────────────────────────────────────────────────────────

/** Add Supplier (no id) or edit an existing supplier profile. */
export function SupplierFormView({ supplierId }: { supplierId?: string }) {
  const options = useResource("supplier-form-options", supplierApi.formOptions);
  const supplier = useResource(supplierId ? `supplier:${supplierId}` : null, () => supplierApi.get(supplierId!));
  const title = supplierId ? "Edit Supplier" : "Add Supplier";
  const breadcrumbs = [
    ...entityMasterDataBreadcrumbs(entityMasterDataPaths.supplierProfile),
    {
      label: supplierId ? (supplier.data?.name ?? "Supplier") : "Add Supplier",
      href: supplierId ? entityMasterDataPaths.supplierEdit(supplierId) : entityMasterDataPaths.supplierCreate,
    },
  ];

  const initial = useMemo(() => (supplier.data ? fromDto(supplier.data) : EMPTY), [supplier.data]);
  const error = options.error ?? supplier.error;
  const ready = options.data && (!supplierId || supplier.data);

  return (
    <PageContainer full>
      {error ? (
        <>
          <PageHead title={title} breadcrumbs={breadcrumbs} />
          <section className="rounded border border-line bg-surface">
            <ErrorState
              message={error.message}
              onRetry={() => {
                options.reload();
                supplier.reload();
              }}
            />
          </section>
        </>
      ) : !ready ? (
        <>
          <PageHead title={title} breadcrumbs={breadcrumbs} />
          <section className="rounded border border-line bg-surface">
            <LoadingState label="Loading supplier form…" />
          </section>
        </>
      ) : (
        <SupplierEditor
          key={supplier.data?.id ?? "new"}
          supplierId={supplierId}
          title={title}
          breadcrumbs={breadcrumbs}
          initial={initial}
          attachments={supplier.data?.attachments ?? []}
          options={options.data!}
          onOptionsChange={(update) => options.mutate((current) => update(current!))}
        />
      )}
    </PageContainer>
  );
}

// ─── Editor ───────────────────────────────────────────────────────────────────

interface EditorProps {
  supplierId?: string;
  title: string;
  breadcrumbs: { label: string; href: string }[];
  initial: FormState;
  attachments: SupplierAttachmentDto[];
  options: SupplierFormOptions;
  onOptionsChange: (update: (current: SupplierFormOptions) => SupplierFormOptions) => void;
}

function SupplierEditor({ supplierId, title, breadcrumbs, initial, attachments, options, onOptionsChange }: EditorProps) {
  const router = useRouter();
  const toast = useToast();
  const [form, setForm] = useState<FormState>(initial);
  const [dirty, setDirty] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedAttachments, setSavedAttachments] = useState(attachments);
  const [queued, setQueued] = useState<File[]>([]);

  /** Updates one or more fields and clears their errors. */
  const patch = (changes: Partial<FormState>) => {
    setForm((current) => ({ ...current, ...changes }));
    setDirty(true);
    setErrors((current) => {
      const keys = Object.keys(changes).filter((key) => current[key]);
      if (keys.length === 0) return current;
      const next = { ...current };
      for (const key of keys) delete next[key];
      return next;
    });
  };
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => patch({ [key]: value } as Partial<FormState>);

  // Options depend on the office's business unit and on the chosen district / group.
  const businessUnitId = options.offices.find((office) => office.id === form.officeId)?.businessUnitId;
  const groups = options.groups.filter((group) => !group.parentId && group.businessUnitId === businessUnitId);
  const subGroups = options.groups.filter((group) => form.groupId && group.parentId === form.groupId);
  const thanas = options.thanas.filter((thana) => form.districtId && thana.districtId === Number(form.districtId));
  const taxBrackets = options.taxBrackets.filter((bracket) => bracket.businessUnitId === businessUnitId);

  const changeOffice = (officeId: string) => {
    const nextUnit = options.offices.find((office) => office.id === officeId)?.businessUnitId;
    // Groups and tax brackets belong to a business unit; clear ones that no longer apply.
    patch(nextUnit === businessUnitId ? { officeId } : { officeId, groupId: "", subGroupId: "", taxBracketId: "" });
  };

  // ─── Save ───────────────────────────────────────────────────────────────

  const save = async () => {
    setFormError(null);
    const payload = { ...form, districtId: form.districtId === "" ? ("" as const) : Number(form.districtId) };
    const parsed = supplierInputSchema.safeParse(payload);
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path.join(".");
        next[key] ??= issue.message;
      }
      setErrors(next);
      setFormError("Please correct the highlighted fields.");
      return;
    }

    setSaving(true);
    try {
      const saved = supplierId ? await supplierApi.update(supplierId, payload) : await supplierApi.create(payload);
      const failed: string[] = [];
      for (const file of queued) {
        try {
          await supplierApi.addAttachment(saved.id, file);
        } catch (err) {
          failed.push(`${file.name}: ${errorMessage(err)}`);
        }
      }
      if (failed.length) toast.error(`Saved, but some attachments failed. ${failed.join(" ")}`);
      else toast.success(`Supplier ${saved.code} saved.`);
      router.push(entityMasterDataPaths.supplierProfile);
    } catch (err) {
      if (err instanceof ApiClientError && err.fieldErrors) {
        setErrors(Object.fromEntries(Object.entries(err.fieldErrors).map(([key, list]) => [key, list[0] ?? ""])));
      }
      setFormError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  // ─── "+ Add new" handlers ───────────────────────────────────────────────

  const addGroup = async (name: string, parentId = "") => {
    const created = await supplierApi.addGroup({ officeId: form.officeId, name, parentId });
    onOptionsChange((current) => ({ ...current, groups: [...current.groups, created] }));
    return created.id;
  };
  const addThana = async (name: string) => {
    const created = await supplierApi.addThana({ districtId: Number(form.districtId), name });
    onOptionsChange((current) => ({ ...current, thanas: [...current.thanas, created] }));
    return created.id;
  };
  const addTaxBracket = async (name: string, rate: string) => {
    const created = await supplierApi.addTaxBracket({ officeId: form.officeId, name, ratePercent: rate });
    onOptionsChange((current) => ({ ...current, taxBrackets: [...current.taxBrackets, created] }));
    return created.id;
  };

  // ─── Attachments ────────────────────────────────────────────────────────

  const queueFiles = (files: FileList | null) => {
    if (!files) return;
    const accepted: File[] = [];
    for (const file of Array.from(files)) {
      if (!(ALLOWED_SUPPLIER_ATTACHMENT_TYPES as readonly string[]).includes(file.type)) {
        toast.error(`${file.name}: only PDF, PNG, JPEG or WebP files are allowed.`);
      } else if (file.size > MAX_SUPPLIER_ATTACHMENT_BYTES) {
        toast.error(`${file.name}: files must be 5 MB or smaller.`);
      } else {
        accepted.push(file);
      }
    }
    if (accepted.length) {
      setQueued((current) => [...current, ...accepted]);
      setDirty(true);
    }
  };

  const removeSaved = async (attachment: SupplierAttachmentDto) => {
    if (!supplierId) return;
    try {
      await supplierApi.deleteAttachment(supplierId, attachment.id);
      setSavedAttachments((current) => current.filter((item) => item.id !== attachment.id));
      toast.success(`${attachment.originalName} removed.`);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const err = (key: string) => errors[key];
  const officeMissing = form.officeId ? undefined : "Select an office first.";

  return (
    <>
      <PageHead
        title={title}
        subtitle={supplierId ? `Partner code ${initial.code}` : "Partner, billing and supplier details."}
        breadcrumbs={breadcrumbs}
        actions={
          <Link href={entityMasterDataPaths.supplierProfile} className={buttonClasses("secondary", "md")}>
            <ArrowLeft /> All Suppliers
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

        {/* ─── Partner Details ─────────────────────────────────────────── */}
        <Panel title="Partner Details" description="Who the supplier is and how they are classified.">
          <PanelSection title="Partner">
            <FormGrid cols={4}>
              <Field label="Office" required error={err("officeId")}>
                {(id) => (
                  <Select
                    id={id}
                    value={form.officeId}
                    placeholder="Select office…"
                    options={options.offices.map((office) => ({ value: office.id, label: office.name }))}
                    aria-invalid={!!err("officeId") || undefined}
                    onChange={(event) => changeOffice(event.target.value)}
                  />
                )}
              </Field>
              <Field label="Partner Name" required error={err("name")}>
                {(id) => (
                  <Input id={id} value={form.name} maxLength={150} aria-invalid={!!err("name") || undefined} onChange={(e) => set("name", e.target.value)} />
                )}
              </Field>
              <Field label="Partner Code" error={err("code")} hint={supplierId ? undefined : "Leave empty to generate (SUP-00001…)."}>
                {(id) => <Input id={id} value={form.code} maxLength={30} onChange={(e) => set("code", e.target.value)} />}
              </Field>
              <Field label="Mobile Number" error={err("mobile")}>
                {(id) => <Input id={id} type="tel" value={form.mobile} maxLength={30} onChange={(e) => set("mobile", e.target.value)} />}
              </Field>
              <Field label="Email" error={err("email")}>
                {(id) => (
                  <Input id={id} type="email" value={form.email} maxLength={254} aria-invalid={!!err("email") || undefined} onChange={(e) => set("email", e.target.value)} />
                )}
              </Field>
              <AddableSelect
                label="Partner Group"
                value={form.groupId}
                options={groups.map((group) => ({ value: group.id, label: group.name }))}
                onChange={(value) => patch({ groupId: value, subGroupId: "" })}
                onAdd={(name) => addGroup(name)}
                disabledReason={officeMissing}
                error={err("groupId")}
              />
              <AddableSelect
                label="Sub Group"
                value={form.subGroupId}
                options={subGroups.map((group) => ({ value: group.id, label: group.name }))}
                onChange={(value) => set("subGroupId", value)}
                onAdd={(name) => addGroup(name, form.groupId)}
                disabledReason={officeMissing ?? (form.groupId ? undefined : "Select a partner group first.")}
                error={err("subGroupId")}
              />
              <Field label="Credit Days" error={err("creditDays")}>
                {(id) => (
                  <Input
                    id={id}
                    inputMode="numeric"
                    value={form.creditDays}
                    aria-invalid={!!err("creditDays") || undefined}
                    onChange={(e) => /^\d{0,4}$/.test(e.target.value) && set("creditDays", e.target.value)}
                  />
                )}
              </Field>
            </FormGrid>
          </PanelSection>

          <PanelSection title="Tax & Compliance">
            <FormGrid cols={4}>
              <Field label="Tolerance (%)" error={err("tolerancePercent")}>
                {(id) => (
                  <Input
                    id={id}
                    inputMode="decimal"
                    value={form.tolerancePercent}
                    placeholder="0.00"
                    aria-invalid={!!err("tolerancePercent") || undefined}
                    onChange={(e) => /^\d{0,3}(\.\d{0,2})?$/.test(e.target.value) && set("tolerancePercent", e.target.value)}
                  />
                )}
              </Field>
              <Field label="BIN Number" error={err("binNumber")}>
                {(id) => <Input id={id} value={form.binNumber} maxLength={30} onChange={(e) => set("binNumber", e.target.value)} />}
              </Field>
              <Field label="Tax Collected at Source [TCS] (%)" error={err("tcsPercent")}>
                {(id) => (
                  <Input
                    id={id}
                    inputMode="decimal"
                    value={form.tcsPercent}
                    placeholder="0.00"
                    aria-invalid={!!err("tcsPercent") || undefined}
                    onChange={(e) => /^\d{0,3}(\.\d{0,2})?$/.test(e.target.value) && set("tcsPercent", e.target.value)}
                  />
                )}
              </Field>
              <Field label="VAT Registration Number (Central)" error={err("vatRegistrationNo")}>
                {(id) => <Input id={id} value={form.vatRegistrationNo} maxLength={50} onChange={(e) => set("vatRegistrationNo", e.target.value)} />}
              </Field>
              <Field label="TIN Number" error={err("tinNumber")}>
                {(id) => <Input id={id} value={form.tinNumber} maxLength={50} onChange={(e) => set("tinNumber", e.target.value)} />}
              </Field>
              <Field label="Trade License Number" error={err("tradeLicenseNo")}>
                {(id) => <Input id={id} value={form.tradeLicenseNo} maxLength={50} onChange={(e) => set("tradeLicenseNo", e.target.value)} />}
              </Field>
            </FormGrid>
          </PanelSection>

          <PanelSection title="Checklist">
            <div className="flex flex-wrap gap-x-6 gap-y-3">
              {CHECKLIST.map((item) => (
                <Checkbox key={item.key} label={item.label} checked={form[item.key]} onChange={(e) => set(item.key, e.target.checked)} />
              ))}
            </div>
          </PanelSection>
        </Panel>

        {/* ─── Billing Details ─────────────────────────────────────────── */}
        <Panel title="Billing Details" description="Where invoices go and who to contact.">
          <FormGrid cols={4}>
            <Field label="Billing Address" span={2} error={err("billingAddress")}>
              {(id) => <TextArea id={id} rows={2} value={form.billingAddress} maxLength={500} onChange={(e) => set("billingAddress", e.target.value)} />}
            </Field>
            <Field label="District" error={err("districtId")}>
              {(id) => (
                <Select
                  id={id}
                  value={form.districtId}
                  placeholder="Select district…"
                  options={options.districts.map((district) => ({ value: String(district.id), label: district.name }))}
                  onChange={(e) => patch({ districtId: e.target.value, thanaId: "" })}
                />
              )}
            </Field>
            <AddableSelect
              label="Thana"
              value={form.thanaId}
              options={thanas.map((thana) => ({ value: thana.id, label: thana.name }))}
              onChange={(value) => set("thanaId", value)}
              onAdd={(name) => addThana(name)}
              disabledReason={form.districtId ? undefined : "Select a district first."}
              error={err("thanaId")}
            />
            <Field label="Contact Person" error={err("contactPerson")}>
              {(id) => <Input id={id} value={form.contactPerson} maxLength={150} onChange={(e) => set("contactPerson", e.target.value)} />}
            </Field>
            <Field label="Contact No" error={err("contactNo")}>
              {(id) => <Input id={id} type="tel" value={form.contactNo} maxLength={30} onChange={(e) => set("contactNo", e.target.value)} />}
            </Field>
            <AddableSelect
              label="Tax Bracket"
              value={form.taxBracketId}
              options={taxBrackets.map((bracket) => ({
                value: bracket.id,
                label: bracket.ratePercent ? `${bracket.name} (${bracket.ratePercent}%)` : bracket.name,
              }))}
              onChange={(value) => set("taxBracketId", value)}
              onAdd={addTaxBracket}
              extra={{ placeholder: "Rate %", inputMode: "decimal" }}
              disabledReason={officeMissing}
              error={err("taxBracketId")}
            />
            <Field label="Remarks / Notes" span={2} error={err("remarks")}>
              {(id) => <TextArea id={id} rows={2} value={form.remarks} maxLength={1000} onChange={(e) => set("remarks", e.target.value)} />}
            </Field>
            <Field label="Attachments" span="full" hint="PDF, PNG, JPEG or WebP, up to 5 MB each. Files are uploaded when you save.">
              <div className="flex flex-col gap-2">
                <label className="flex cursor-pointer items-center gap-2 self-start rounded border border-dashed border-line-strong bg-canvas px-3 py-2 text-xs font-semibold text-ink-muted hover:border-accent hover:text-accent-strong">
                  <Paperclip aria-hidden="true" className="size-3.5" /> Choose files
                  <input
                    type="file"
                    multiple
                    accept={ACCEPT}
                    className="sr-only"
                    onChange={(e) => {
                      queueFiles(e.target.files);
                      e.target.value = "";
                    }}
                  />
                </label>
                {(savedAttachments.length > 0 || queued.length > 0) && (
                  <ul className="flex flex-col divide-y divide-line rounded border border-line">
                    {savedAttachments.map((attachment) => (
                      <li key={attachment.id} className="flex items-center gap-2 px-3 py-1.5 text-xs">
                        <Paperclip aria-hidden="true" className="size-3.5 text-ink-faint" />
                        <span className="min-w-0 flex-1 truncate text-ink">{attachment.originalName}</span>
                        <span className="text-ink-faint tabular-nums">{formatSize(attachment.size)}</span>
                        <a
                          href={supplierApi.attachmentUrl(supplierId!, attachment.id)}
                          className={cn(buttonClasses("ghost", "icon"), "hover:text-accent-strong")}
                          aria-label={`Download ${attachment.originalName}`}
                          title="Download"
                        >
                          <Download />
                        </a>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="hover:text-danger"
                          aria-label={`Remove ${attachment.originalName}`}
                          title="Remove"
                          onClick={() => removeSaved(attachment)}
                        >
                          <Trash2 />
                        </Button>
                      </li>
                    ))}
                    {queued.map((file, index) => (
                      <li key={`${file.name}-${index}`} className="flex items-center gap-2 px-3 py-1.5 text-xs">
                        <Paperclip aria-hidden="true" className="size-3.5 text-ink-faint" />
                        <span className="min-w-0 flex-1 truncate text-ink">{file.name}</span>
                        <span className="rounded border border-warning/30 bg-warning/10 px-1.5 text-[10px] font-semibold text-warning uppercase">
                          Not uploaded
                        </span>
                        <span className="text-ink-faint tabular-nums">{formatSize(file.size)}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="hover:text-danger"
                          aria-label={`Remove ${file.name}`}
                          onClick={() => setQueued((current) => current.filter((_, i) => i !== index))}
                        >
                          <X />
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </Field>
          </FormGrid>
        </Panel>

        {/* ─── Supplier Details ────────────────────────────────────────── */}
        <SupplierDetailsPanel
          details={form.details}
          error={err("details")}
          onChange={(details) => set("details", details)}
        />

        {/* ─── Save bar ────────────────────────────────────────────────── */}
        <div className="sticky bottom-0 z-10 flex flex-wrap items-center justify-end gap-2 rounded border border-line bg-surface/95 px-4 py-2.5 shadow-xs backdrop-blur">
          <SaveState dirty={dirty} />
          <Link href={entityMasterDataPaths.supplierProfile} className={buttonClasses("secondary", "md")}>
            Cancel
          </Link>
          <Button type="submit" variant="accent" loading={saving}>
            {!saving && <Save />} Save Supplier
          </Button>
        </div>
      </form>
    </>
  );
}

// ─── Supplier Details list ────────────────────────────────────────────────────

const DETAIL_FIELDS: { key: keyof Detail; label: string; required?: boolean; max: number; placeholder?: string }[] = [
  { key: "code", label: "Code", max: 30 },
  { key: "vendorName", label: "Vendor Name", max: 150 },
  { key: "address", label: "Address", required: true, max: 500 },
  { key: "gps", label: "GPS", max: 100, placeholder: "23.8103, 90.4125" },
  { key: "contactPerson", label: "Contact Person", max: 150 },
  { key: "contactNumber", label: "Contact Number", max: 30 },
  { key: "vatRegNo", label: "VAT Reg No", max: 50 },
];

function SupplierDetailsPanel({
  details,
  error,
  onChange,
}: {
  details: Detail[];
  error?: string;
  onChange: (details: Detail[]) => void;
}) {
  const [draft, setDraft] = useState<Detail>(EMPTY_DETAIL);
  const [editing, setEditing] = useState<number | null>(null);
  const [draftErrors, setDraftErrors] = useState<Partial<Record<keyof Detail, string>>>({});
  const [locating, setLocating] = useState(false);

  const setField = (key: keyof Detail, value: string) => {
    setDraft((current) => ({ ...current, [key]: value }));
    setDraftErrors((current) => ({ ...current, [key]: undefined }));
  };

  const addToList = () => {
    const parsed = supplierDetailSchema.safeParse(draft);
    if (!parsed.success) {
      const next: Partial<Record<keyof Detail, string>> = {};
      for (const issue of parsed.error.issues) next[issue.path[0] as keyof Detail] ??= issue.message;
      setDraftErrors(next);
      return;
    }
    const entry = { ...EMPTY_DETAIL, ...parsed.data };
    onChange(editing === null ? [...details, entry] : details.map((item, index) => (index === editing ? entry : item)));
    setDraft(EMPTY_DETAIL);
    setEditing(null);
  };

  const useMyLocation = () => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setField("gps", `${position.coords.latitude.toFixed(6)}, ${position.coords.longitude.toFixed(6)}`);
        setLocating(false);
      },
      () => setLocating(false),
      { timeout: 10_000 },
    );
  };

  return (
    <Panel
      title="Supplier Details"
      description="Vendor addresses and contacts for this partner. Fill the row and add it to the list."
      actions={
        details.length > 0 && (
          <span className="rounded border border-accent-line bg-accent-soft px-1.5 text-[10px] font-semibold text-accent-strong tabular-nums dark:text-accent">
            {details.length} in list
          </span>
        )
      }
    >
      <div className="flex flex-col gap-4">
        <FormGrid cols={4}>
          {DETAIL_FIELDS.map((field) => (
            <Field key={field.key} label={field.label} required={field.required} error={draftErrors[field.key]} span={field.key === "address" ? 2 : undefined}>
              {(id) =>
                field.key === "gps" ? (
                  <div className="flex gap-1.5">
                    <Input id={id} value={draft.gps} maxLength={field.max} placeholder={field.placeholder} onChange={(e) => setField("gps", e.target.value)} />
                    <Button
                      size="icon"
                      className="size-8"
                      loading={locating}
                      aria-label="Use my current location"
                      title="Use my current location"
                      onClick={useMyLocation}
                    >
                      {!locating && <Crosshair />}
                    </Button>
                  </div>
                ) : (
                  <Input
                    id={id}
                    value={draft[field.key]}
                    maxLength={field.max}
                    placeholder={field.placeholder}
                    aria-invalid={!!draftErrors[field.key] || undefined}
                    onChange={(e) => setField(field.key, e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addToList();
                      }
                    }}
                  />
                )
              }
            </Field>
          ))}
          <div className="flex items-end gap-2">
            <Button variant="accent-soft" onClick={addToList}>
              <ListPlus /> {editing === null ? "Add to List" : "Update Row"}
            </Button>
            {editing !== null && (
              <Button
                variant="ghost"
                onClick={() => {
                  setEditing(null);
                  setDraft(EMPTY_DETAIL);
                  setDraftErrors({});
                }}
              >
                Cancel
              </Button>
            )}
          </div>
        </FormGrid>

        {error && <Notice tone="error">{error}</Notice>}

        {details.length === 0 ? (
          <EmptyBlock title="No supplier details added">Fill the fields above and press “Add to List”.</EmptyBlock>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-grid w-full min-w-max">
              <thead>
                <tr>
                  <th scope="col" className="w-12 px-2.5 py-2 text-left">SL</th>
                  {DETAIL_FIELDS.map((field) => (
                    <th key={field.key} scope="col" className="px-2.5 py-2 text-left">
                      {field.label}
                    </th>
                  ))}
                  <th scope="col" className="w-24 px-2.5 py-2 text-center">Action</th>
                </tr>
              </thead>
              <tbody>
                {details.map((detail, index) => (
                  <tr key={index} className={cn(editing === index && "[&>td]:bg-accent-soft")}>
                    <td className="px-2.5 py-2 text-right text-ink-faint tabular-nums">{index + 1}</td>
                    {DETAIL_FIELDS.map((field) => (
                      <td key={field.key} className={cn("px-2.5 py-2", field.key === "address" ? "max-w-80 whitespace-normal" : "whitespace-nowrap")}>
                        {detail[field.key] || <span className="text-ink-faint">—</span>}
                      </td>
                    ))}
                    <td className="px-1.5 py-1 text-center whitespace-nowrap">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="hover:text-accent-strong"
                        aria-label={`Edit supplier detail ${index + 1}`}
                        onClick={() => {
                          setEditing(index);
                          setDraft(detail);
                          setDraftErrors({});
                        }}
                      >
                        <Pencil />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="hover:text-danger"
                        aria-label={`Remove supplier detail ${index + 1}`}
                        onClick={() => {
                          onChange(details.filter((_, i) => i !== index));
                          if (editing === index) {
                            setEditing(null);
                            setDraft(EMPTY_DETAIL);
                          }
                        }}
                      >
                        <Trash2 />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Panel>
  );
}

