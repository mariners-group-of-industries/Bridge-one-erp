"use client";

import { ArrowLeft, Crosshair, Download, ListPlus, Paperclip, Pencil, Save, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, type ReactNode } from "react";
import { PageContainer, PageHead } from "@/components/layout/page";
import { Button, buttonClasses } from "@/components/ui/button";
import { ErrorState, LoadingState } from "@/components/ui/section";
import { useToast } from "@/components/ui/toast";
import { useResource } from "@/hooks/use-resource";
import { ApiClientError, errorMessage } from "@/lib/api/client";
import { cn } from "@/lib/cn";
import { entityMasterDataBreadcrumbs } from "../../breadcrumbs";
import { AddableSelect } from "../../components/AddableSelect";
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
  ALLOWED_SUPPLIER_ATTACHMENT_TYPES as ALLOWED_TYPES,
  MAX_SUPPLIER_ATTACHMENT_BYTES as MAX_BYTES,
} from "../../supplier/schemas/supplier.schema";
import {
  CUSTOMER_FLAGS,
  customerInputSchema,
  GENDERS,
  MARITAL_STATUSES,
  shippingSchema,
  type CustomerAttachmentDto,
  type CustomerDto,
  type CustomerFlag,
  type CustomerFormOptions,
  type CustomerInput,
} from "../schemas/customer.schema";
import { customerApi } from "../services/customer.api";

// ─── Form state (all strings for inputs; districts as strings in selects) ─────

interface ShippingRow {
  id: string;
  code: string;
  outlet: string;
  address: string;
  gps: string;
  contactPerson: string;
  contactNo: string;
  vatRegNo: string;
  districtId: string;
  thanaId: string;
  sectionId: string;
}

type FormState = {
  officeId: string;
  name: string;
  code: string;
  mobile: string;
  email: string;
  groupId: string;
  subGroupId: string;
  creditDays: string;
  creditLimit: string;
  territoryId: string;
  salesPersonId: string;
  tolerancePercent: string;
  binNumber: string;
  priceListId: string;
  tcsPercent: string;
  vatRegistrationNo: string;
  tinNumber: string;
  tradeLicenseNo: string;
  maritalStatus: string;
  marriageDate: string;
  birthDate: string;
  gender: string;
  nidNumber: string;
  billingName: string;
  billingAddress: string;
  districtId: string;
  thanaId: string;
  contactPerson: string;
  contactNo: string;
  taxBracketId: string;
  remarks: string;
  bankType: string;
  bankAccountNo: string;
  bankBranch: string;
  bankName: string;
  bankRoutingNo: string;
  shipping: ShippingRow[];
} & Record<CustomerFlag, boolean>;

const EMPTY_ROW: ShippingRow = {
  id: "",
  code: "",
  outlet: "",
  address: "",
  gps: "",
  contactPerson: "",
  contactNo: "",
  vatRegNo: "",
  districtId: "",
  thanaId: "",
  sectionId: "",
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
  creditLimit: "",
  territoryId: "",
  salesPersonId: "",
  tolerancePercent: "",
  binNumber: "",
  priceListId: "",
  tcsPercent: "",
  vatRegistrationNo: "",
  tinNumber: "",
  tradeLicenseNo: "",
  maritalStatus: "",
  marriageDate: "",
  birthDate: "",
  gender: "",
  nidNumber: "",
  billingName: "",
  billingAddress: "",
  districtId: "",
  thanaId: "",
  contactPerson: "",
  contactNo: "",
  taxBracketId: "",
  remarks: "",
  bankType: "",
  bankAccountNo: "",
  bankBranch: "",
  bankName: "",
  bankRoutingNo: "",
  shipping: [],
  ...(Object.fromEntries(CUSTOMER_FLAGS.map((flag) => [flag.key, false])) as Record<CustomerFlag, boolean>),
};

const districtText = (value: number | "") => (value === "" ? "" : String(value));
const districtValue = (value: string) => (value === "" ? ("" as const) : Number(value));

function fromDto(dto: CustomerDto): FormState {
  const { attachments: _attachments, id: _id, ...rest } = dto;
  return {
    ...EMPTY,
    ...rest,
    // Customers saved before the billing name was required fall back to the partner name.
    billingName: dto.billingName || dto.name,
    districtId: districtText(dto.districtId),
    shipping: dto.shipping.map((row) => ({ ...EMPTY_ROW, ...row, districtId: districtText(row.districtId) })),
  };
}

function toPayload(form: FormState): CustomerInput {
  // Selects only offer valid marital status / gender values, so the casts are safe.
  return {
    ...form,
    districtId: districtValue(form.districtId),
    shipping: form.shipping.map((row) => ({ ...row, districtId: districtValue(row.districtId) })),
  } as CustomerInput;
}

const formatSize = (bytes: number) =>
  bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;

// ─── Loader ───────────────────────────────────────────────────────────────────

export interface EmbeddedCustomerForm {
  defaultOfficeId?: string;
  onSaved: (customer: CustomerDto) => void;
  onCancel: () => void;
}

/** Add Customer (no id) or edit an existing customer profile. */
export function CustomerFormView({
  customerId,
  defaultOfficeId,
  embedded,
}: {
  customerId?: string;
  defaultOfficeId?: string;
  embedded?: EmbeddedCustomerForm;
}) {
  const options = useResource("customer-form-options", customerApi.formOptions);
  const customer = useResource(customerId ? `customer:${customerId}` : null, () => customerApi.get(customerId!));
  const title = customerId ? "Edit Customer" : "Add Customer";
  const breadcrumbs = [
    ...entityMasterDataBreadcrumbs(entityMasterDataPaths.customerProfile),
    {
      label: customerId ? (customer.data?.name ?? "Customer") : "Add Customer",
      href: customerId ? entityMasterDataPaths.customerEdit(customerId) : entityMasterDataPaths.customerCreate,
    },
  ];
  const effectiveOfficeId = defaultOfficeId ?? embedded?.defaultOfficeId ?? "";
  const initial = useMemo(
    () => (customer.data ? fromDto(customer.data) : { ...EMPTY, officeId: effectiveOfficeId }),
    [customer.data, effectiveOfficeId],
  );
  const error = options.error ?? customer.error;
  const ready = options.data && (!customerId || customer.data);

  const Shell = embedded ? EmbeddedShell : FullPageShell;
  return (
    <Shell>
      {error || !ready ? (
        <>
          {!embedded && <PageHead title={title} breadcrumbs={breadcrumbs} />}
          <section className="rounded border border-line bg-surface">
            {error ? (
              <ErrorState
                message={error.message}
                onRetry={() => {
                  options.reload();
                  customer.reload();
                }}
              />
            ) : (
              <LoadingState label="Loading customer form…" />
            )}
          </section>
        </>
      ) : (
        <CustomerEditor
          key={customer.data?.id ?? "new"}
          customerId={customerId}
          title={title}
          breadcrumbs={breadcrumbs}
          initial={initial}
          attachments={customer.data?.attachments ?? []}
          options={options.data!}
          onOptionsChange={(update) => options.mutate((current) => update(current!))}
          embedded={embedded}
        />
      )}
    </Shell>
  );
}

const FullPageShell = ({ children }: { children: ReactNode }) => <PageContainer full>{children}</PageContainer>;
const EmbeddedShell = ({ children }: { children: ReactNode }) => <div className="flex flex-col gap-4">{children}</div>;

// ─── Editor ───────────────────────────────────────────────────────────────────

interface EditorProps {
  customerId?: string;
  title: string;
  breadcrumbs: { label: string; href: string }[];
  initial: FormState;
  attachments: CustomerAttachmentDto[];
  options: CustomerFormOptions;
  onOptionsChange: (update: (current: CustomerFormOptions) => CustomerFormOptions) => void;
  embedded?: EmbeddedCustomerForm;
}

function CustomerEditor({ customerId, title, breadcrumbs, initial, attachments, options, onOptionsChange, embedded }: EditorProps) {
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
  const text = (key: keyof FormState) => (event: { target: { value: string } }) => set(key, event.target.value as never);

  const unit = options.offices.find((office) => office.id === form.officeId)?.businessUnitId;
  const ofUnit = <T extends { businessUnitId: string }>(list: T[]) => list.filter((item) => item.businessUnitId === unit);
  const toOptions = (list: { id: string; name: string }[]) => list.map((item) => ({ value: item.id, label: item.name }));
  const groups = ofUnit(options.groups).filter((group) => !group.parentId);
  const subGroups = options.groups.filter((group) => form.groupId && group.parentId === form.groupId);
  const officeMissing = form.officeId ? undefined : "Select an office first.";

  const changeOffice = (officeId: string) => {
    const nextUnit = options.offices.find((office) => office.id === officeId)?.businessUnitId;
    // Business-unit options no longer apply once the unit changes.
    patch(
      nextUnit === unit
        ? { officeId }
        : {
            officeId,
            groupId: "",
            subGroupId: "",
            territoryId: "",
            salesPersonId: "",
            priceListId: "",
            taxBracketId: "",
            shipping: form.shipping.map((row) => ({ ...row, sectionId: "" })),
          },
    );
  };

  // ─── "+ Add new" ────────────────────────────────────────────────────────

  const addGroup = async (name: string, parentId = "") => {
    const created = await customerApi.addGroup({ officeId: form.officeId, name, parentId });
    onOptionsChange((current) => ({ ...current, groups: [...current.groups, created] }));
    return created.id;
  };
  const addThana = async (districtId: string, name: string) => {
    const created = await customerApi.addThana({ districtId: Number(districtId), name });
    onOptionsChange((current) => ({ ...current, thanas: [...current.thanas, created] }));
    return created.id;
  };
  const addTaxBracket = async (name: string, rate: string) => {
    const created = await customerApi.addTaxBracket({ officeId: form.officeId, name, ratePercent: rate });
    onOptionsChange((current) => ({ ...current, taxBrackets: [...current.taxBrackets, created] }));
    return created.id;
  };
  const addSection = async (name: string) => {
    const created = await customerApi.addSection({ officeId: form.officeId, name });
    onOptionsChange((current) => ({ ...current, sections: [...current.sections, created] }));
    return created.id;
  };

  // ─── Save ───────────────────────────────────────────────────────────────

  const save = async () => {
    setFormError(null);
    const payload = toPayload(form);
    const parsed = customerInputSchema.safeParse(payload);
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) next[issue.path.join(".")] ??= issue.message;
      setErrors(next);
      setFormError("Please correct the highlighted fields.");
      return;
    }
    setSaving(true);
    try {
      const saved = customerId ? await customerApi.update(customerId, payload) : await customerApi.create(payload);
      const failed: string[] = [];
      for (const file of queued) {
        try {
          await customerApi.addAttachment(saved.id, file);
        } catch (err) {
          failed.push(`${file.name}: ${errorMessage(err)}`);
        }
      }
      if (failed.length) toast.error(`Saved, but some attachments failed. ${failed.join(" ")}`);
      else toast.success(`Customer ${saved.code} saved.`);
      if (embedded) embedded.onSaved(saved);
      else router.push(entityMasterDataPaths.customerProfile);
    } catch (err) {
      if (err instanceof ApiClientError && err.fieldErrors) {
        setErrors(Object.fromEntries(Object.entries(err.fieldErrors).map(([key, list]) => [key, list[0] ?? ""])));
      }
      setFormError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  // ─── Attachments ────────────────────────────────────────────────────────

  const queueFiles = (files: FileList | null) => {
    const accepted = Array.from(files ?? []).filter((file) => {
      if (!(ALLOWED_TYPES as readonly string[]).includes(file.type)) {
        toast.error(`${file.name}: only PDF, PNG, JPEG or WebP files are allowed.`);
        return false;
      }
      if (file.size > MAX_BYTES) {
        toast.error(`${file.name}: files must be 5 MB or smaller.`);
        return false;
      }
      return true;
    });
    if (accepted.length) {
      setQueued((current) => [...current, ...accepted]);
      setDirty(true);
    }
  };

  const removeSaved = async (attachment: CustomerAttachmentDto) => {
    if (!customerId) return;
    try {
      await customerApi.deleteAttachment(customerId, attachment.id);
      setSavedAttachments((current) => current.filter((item) => item.id !== attachment.id));
      toast.success(`${attachment.originalName} removed.`);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const err = (key: string) => errors[key];
  const invalid = (key: string) => !!errors[key] || undefined;
  const decimal = (key: keyof FormState, pattern: RegExp) => (event: { target: { value: string } }) =>
    pattern.test(event.target.value) && set(key, event.target.value as never);
  const PERCENT = /^\d{0,3}(\.\d{0,2})?$/;

  return (
    <>
      {!embedded && (
      <PageHead
        title={title}
        subtitle={customerId ? `Partner code ${initial.code}` : "Partner, billing and shipping details."}
        breadcrumbs={breadcrumbs}
        actions={
          <Link href={entityMasterDataPaths.customerProfile} className={buttonClasses("secondary", "md")}>
            <ArrowLeft /> All Customers
          </Link>
        }
      />
      )}

      <form
        noValidate
        className="flex flex-col gap-4 pb-6"
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        {formError && <Notice tone="error">{formError}</Notice>}

        {/* ─── 1. Partner Details ──────────────────────────────────────── */}
        <Panel title="Partner Details" description="Who the customer is, how they are grouped and their credit terms.">
          <PanelSection title="Partner">
            <FormGrid cols={4}>
              <Field label="Office" required error={err("officeId")}>
                {(id) => (
                  <Select
                    id={id}
                    value={form.officeId}
                    placeholder="Select office…"
                    options={toOptions(options.offices)}
                    aria-invalid={invalid("officeId")}
                    onChange={(e) => changeOffice(e.target.value)}
                  />
                )}
              </Field>
              <Field label="Partner Name" required error={err("name")}>
                {(id) => (
                  <Input
                    id={id}
                    value={form.name}
                    maxLength={150}
                    aria-invalid={invalid("name")}
                    // The billing name follows the partner name until it is edited separately.
                    onChange={(e) => patch({ name: e.target.value, ...(form.billingName === form.name ? { billingName: e.target.value } : {}) })}
                  />
                )}
              </Field>
              <Field label="Partner Billing Name" required error={err("billingName")} hint="Name printed on invoices.">
                {(id) => <Input id={id} value={form.billingName} maxLength={150} aria-invalid={invalid("billingName")} onChange={text("billingName")} />}
              </Field>
              <Field label="Partner Code" error={err("code")} hint={customerId ? undefined : "Leave empty to generate (CUST-00001…)."}>
                {(id) => <Input id={id} value={form.code} maxLength={30} onChange={text("code")} />}
              </Field>
              <Field label="Mobile Number" required error={err("mobile")}>
                {(id) => <Input id={id} type="tel" value={form.mobile} maxLength={30} aria-invalid={invalid("mobile")} onChange={text("mobile")} />}
              </Field>
              <Field label="Email" error={err("email")}>
                {(id) => <Input id={id} type="email" value={form.email} maxLength={254} aria-invalid={invalid("email")} onChange={text("email")} />}
              </Field>
              <AddableSelect
                label="Partner Group"
                value={form.groupId}
                options={toOptions(groups)}
                onChange={(value) => patch({ groupId: value, subGroupId: "" })}
                onAdd={(name) => addGroup(name)}
                disabledReason={officeMissing}
                error={err("groupId")}
              />
              <AddableSelect
                label="Sub Group"
                value={form.subGroupId}
                options={toOptions(subGroups)}
                onChange={(value) => set("subGroupId", value)}
                onAdd={(name) => addGroup(name, form.groupId)}
                disabledReason={officeMissing ?? (form.groupId ? undefined : "Select a partner group first.")}
                error={err("subGroupId")}
              />
              <Field label="Credit Days" error={err("creditDays")}>
                {(id) => (
                  <Input id={id} inputMode="numeric" value={form.creditDays} aria-invalid={invalid("creditDays")} onChange={decimal("creditDays", /^\d{0,4}$/)} />
                )}
              </Field>
              <Field label="Credit Limit" error={err("creditLimit")}>
                {(id) => (
                  <Input
                    id={id}
                    inputMode="decimal"
                    placeholder="0.00"
                    className="text-right tabular-nums"
                    value={form.creditLimit}
                    aria-invalid={invalid("creditLimit")}
                    onChange={decimal("creditLimit", /^\d{0,12}(\.\d{0,2})?$/)}
                  />
                )}
              </Field>
              <Field label="Territory" required error={err("territoryId")} hint={officeMissing}>
                {(id) => (
                  <Select
                    id={id}
                    value={form.territoryId}
                    disabled={!unit}
                    options={toOptions(ofUnit(options.territories))}
                    aria-invalid={invalid("territoryId")}
                    onChange={text("territoryId")}
                  />
                )}
              </Field>
              <Field label="Default Sales Representative" error={err("salesPersonId")} hint={officeMissing}>
                {(id) => (
                  <Select
                    id={id}
                    value={form.salesPersonId}
                    disabled={!unit}
                    options={ofUnit(options.salesPersons).map((person) => ({ value: person.id, label: `${person.name} (${person.code})` }))}
                    onChange={text("salesPersonId")}
                  />
                )}
              </Field>
            </FormGrid>
          </PanelSection>

          <PanelSection title="Tax & Pricing">
            <FormGrid cols={4}>
              <Field label="Tolerance (%)" error={err("tolerancePercent")}>
                {(id) => <Input id={id} inputMode="decimal" placeholder="0.00" value={form.tolerancePercent} aria-invalid={invalid("tolerancePercent")} onChange={decimal("tolerancePercent", PERCENT)} />}
              </Field>
              <Field label="BIN Number" error={err("binNumber")}>
                {(id) => <Input id={id} value={form.binNumber} maxLength={30} onChange={text("binNumber")} />}
              </Field>
              <Field label="Price Type" error={err("priceListId")} hint={officeMissing}>
                {(id) => <Select id={id} value={form.priceListId} disabled={!unit} options={toOptions(ofUnit(options.priceLists))} onChange={text("priceListId")} />}
              </Field>
              <Field label="Tax Collected at Source [TCS] (%)" error={err("tcsPercent")}>
                {(id) => <Input id={id} inputMode="decimal" placeholder="0.00" value={form.tcsPercent} aria-invalid={invalid("tcsPercent")} onChange={decimal("tcsPercent", PERCENT)} />}
              </Field>
              <Field label="VAT Reg No (Central)" error={err("vatRegistrationNo")}>
                {(id) => <Input id={id} value={form.vatRegistrationNo} maxLength={50} onChange={text("vatRegistrationNo")} />}
              </Field>
              <Field label="TIN Number" error={err("tinNumber")}>
                {(id) => <Input id={id} value={form.tinNumber} maxLength={50} onChange={text("tinNumber")} />}
              </Field>
              <Field label="Trade License Number" error={err("tradeLicenseNo")}>
                {(id) => <Input id={id} value={form.tradeLicenseNo} maxLength={50} onChange={text("tradeLicenseNo")} />}
              </Field>
            </FormGrid>
          </PanelSection>

          <PanelSection title="Personal">
            <FormGrid cols={4}>
              <Field label="Marital Status" error={err("maritalStatus")}>
                {(id) => <Select id={id} value={form.maritalStatus} options={MARITAL_STATUSES} onChange={text("maritalStatus")} />}
              </Field>
              <Field label="Marriage Date" error={err("marriageDate")}>
                {(id) => <Input id={id} type="date" value={form.marriageDate} aria-invalid={invalid("marriageDate")} onChange={text("marriageDate")} />}
              </Field>
              <Field label="Birth Date" error={err("birthDate")}>
                {(id) => <Input id={id} type="date" value={form.birthDate} onChange={text("birthDate")} />}
              </Field>
              <Field label="Gender" error={err("gender")}>
                {(id) => <Select id={id} value={form.gender} options={GENDERS} onChange={text("gender")} />}
              </Field>
              <Field label="NID Number" error={err("nidNumber")}>
                {(id) => <Input id={id} value={form.nidNumber} maxLength={30} onChange={text("nidNumber")} />}
              </Field>
            </FormGrid>
          </PanelSection>
        </Panel>

        {/* ─── 2. Other Flags ──────────────────────────────────────────── */}
        <Panel title="Other Flags">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
            {CUSTOMER_FLAGS.map((flag) => (
              <Checkbox key={flag.key} label={flag.label} checked={form[flag.key]} onChange={(e) => set(flag.key, e.target.checked)} />
            ))}
          </div>
        </Panel>

        {/* ─── 3. Billing Details ──────────────────────────────────────── */}
        <Panel title="Billing Details" description="Where invoices go and who to contact.">
          <FormGrid cols={4}>
            <Field label="Billing Address" span={2} error={err("billingAddress")}>
              {(id) => <TextArea id={id} rows={2} value={form.billingAddress} maxLength={500} onChange={text("billingAddress")} />}
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
              options={toOptions(options.thanas.filter((thana) => form.districtId && thana.districtId === Number(form.districtId)))}
              onChange={(value) => set("thanaId", value)}
              onAdd={(name) => addThana(form.districtId, name)}
              disabledReason={form.districtId ? undefined : "Select a district first."}
              error={err("thanaId")}
            />
            <Field label="Contact Person" error={err("contactPerson")}>
              {(id) => <Input id={id} value={form.contactPerson} maxLength={150} onChange={text("contactPerson")} />}
            </Field>
            <Field label="Contact No" error={err("contactNo")}>
              {(id) => <Input id={id} type="tel" value={form.contactNo} maxLength={30} onChange={text("contactNo")} />}
            </Field>
            <AddableSelect
              label="Tax Bracket"
              value={form.taxBracketId}
              options={ofUnit(options.taxBrackets).map((bracket) => ({
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
              {(id) => <TextArea id={id} rows={2} value={form.remarks} maxLength={1000} onChange={text("remarks")} />}
            </Field>
            <Field label="Attachments" span="full" hint="PDF, PNG, JPEG or WebP, up to 5 MB each. Files are uploaded when you save.">
              <div className="flex flex-col gap-2">
                <label className="flex cursor-pointer items-center gap-2 self-start rounded border border-dashed border-line-strong bg-canvas px-3 py-2 text-xs font-semibold text-ink-muted hover:border-accent hover:text-accent-strong">
                  <Paperclip aria-hidden="true" className="size-3.5" /> Choose files
                  <input
                    type="file"
                    multiple
                    accept={ALLOWED_TYPES.join(",")}
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
                          href={customerApi.attachmentUrl(customerId!, attachment.id)}
                          className={cn(buttonClasses("ghost", "icon"), "hover:text-accent-strong")}
                          aria-label={`Download ${attachment.originalName}`}
                          title="Download"
                        >
                          <Download />
                        </a>
                        <Button variant="ghost" size="icon" className="hover:text-danger" aria-label={`Remove ${attachment.originalName}`} onClick={() => removeSaved(attachment)}>
                          <Trash2 />
                        </Button>
                      </li>
                    ))}
                    {queued.map((file, index) => (
                      <li key={`${file.name}-${index}`} className="flex items-center gap-2 px-3 py-1.5 text-xs">
                        <Paperclip aria-hidden="true" className="size-3.5 text-ink-faint" />
                        <span className="min-w-0 flex-1 truncate text-ink">{file.name}</span>
                        <span className="rounded border border-warning/30 bg-warning/10 px-1.5 text-[10px] font-semibold text-warning uppercase">Not uploaded</span>
                        <span className="text-ink-faint tabular-nums">{formatSize(file.size)}</span>
                        <Button variant="ghost" size="icon" className="hover:text-danger" aria-label={`Remove ${file.name}`} onClick={() => setQueued((current) => current.filter((_, i) => i !== index))}>
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

        {/* ─── 4. Shipping Details ─────────────────────────────────────── */}
        <ShippingPanel
          rows={form.shipping}
          error={err("shipping")}
          options={options}
          unit={unit}
          officeMissing={officeMissing}
          onChange={(shipping) => set("shipping", shipping)}
          onAddThana={addThana}
          onAddSection={addSection}
        />

        {/* ─── 5. Partner Bank Information ─────────────────────────────── */}
        <Panel title="Partner Bank Information">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
            <Field label="Type" error={err("bankType")}>
              {(id) => <Input id={id} placeholder="Type" value={form.bankType} maxLength={50} onChange={text("bankType")} />}
            </Field>
            <Field label="Account No" error={err("bankAccountNo")}>
              {(id) => <Input id={id} placeholder="Account No" value={form.bankAccountNo} maxLength={50} onChange={text("bankAccountNo")} />}
            </Field>
            <Field label="Branch" error={err("bankBranch")}>
              {(id) => <Input id={id} placeholder="Branch" value={form.bankBranch} maxLength={100} onChange={text("bankBranch")} />}
            </Field>
            <Field label="Bank" error={err("bankName")}>
              {(id) => <Input id={id} placeholder="Bank" value={form.bankName} maxLength={100} onChange={text("bankName")} />}
            </Field>
            <Field label="Routing No" error={err("bankRoutingNo")}>
              {(id) => <Input id={id} placeholder="Routing No" value={form.bankRoutingNo} maxLength={30} onChange={text("bankRoutingNo")} />}
            </Field>
          </div>
        </Panel>

        <div className="sticky bottom-0 z-10 flex flex-wrap items-center justify-end gap-2 rounded border border-line bg-surface/95 px-4 py-2.5 shadow-xs backdrop-blur">
          <SaveState dirty={dirty} />
          {embedded ? (
            <Button variant="ghost" className="text-danger" onClick={embedded.onCancel} disabled={saving}>
              CLOSE
            </Button>
          ) : (
            <Link href={entityMasterDataPaths.customerProfile} className={buttonClasses("secondary", "md")}>
              Cancel
            </Link>
          )}
          <Button type="submit" variant="accent" loading={saving}>
            {!saving && <Save />} Save Customer
          </Button>
        </div>
      </form>
    </>
  );
}

// ─── Shipping Details list ────────────────────────────────────────────────────

const TEXT_FIELDS: { key: Exclude<keyof ShippingRow, "id" | "districtId" | "thanaId" | "sectionId">; label: string; max: number; required?: boolean; span?: 2 }[] = [
  { key: "code", label: "Code", max: 30 },
  { key: "outlet", label: "Ref / Outlet", max: 60 },
  { key: "address", label: "Address", max: 500, required: true, span: 2 },
  { key: "gps", label: "GPS", max: 100 },
  { key: "contactPerson", label: "Contact Person", max: 150 },
  { key: "contactNo", label: "Contact No", max: 30 },
  { key: "vatRegNo", label: "VAT Reg No", max: 50 },
];

function ShippingPanel({
  rows,
  error,
  options,
  unit,
  officeMissing,
  onChange,
  onAddThana,
  onAddSection,
}: {
  rows: ShippingRow[];
  error?: string;
  options: CustomerFormOptions;
  unit?: string;
  officeMissing?: string;
  onChange: (rows: ShippingRow[]) => void;
  onAddThana: (districtId: string, name: string) => Promise<string>;
  onAddSection: (name: string) => Promise<string>;
}) {
  const [draft, setDraft] = useState<ShippingRow>(EMPTY_ROW);
  const [editing, setEditing] = useState<number | null>(null);
  const [draftErrors, setDraftErrors] = useState<Partial<Record<keyof ShippingRow, string>>>({});
  const [locating, setLocating] = useState(false);

  const setField = (changes: Partial<ShippingRow>) => {
    setDraft((current) => ({ ...current, ...changes }));
    setDraftErrors((current) => {
      const next = { ...current };
      for (const key of Object.keys(changes)) delete next[key as keyof ShippingRow];
      return next;
    });
  };

  const districtName = (id: string) => options.districts.find((d) => String(d.id) === id)?.name;
  const thanaName = (id: string) => options.thanas.find((t) => t.id === id)?.name;
  const sectionName = (id: string) => options.sections.find((s) => s.id === id)?.name;

  const addToList = () => {
    const parsed = shippingSchema.safeParse({ ...draft, districtId: districtValue(draft.districtId) });
    if (!parsed.success) {
      const next: Partial<Record<keyof ShippingRow, string>> = {};
      for (const issue of parsed.error.issues) next[issue.path[0] as keyof ShippingRow] ??= issue.message;
      setDraftErrors(next);
      return;
    }
    const entry = { ...draft, ...Object.fromEntries(Object.entries(draft).map(([k, v]) => [k, typeof v === "string" ? v.trim() : v])) };
    onChange(editing === null ? [...rows, entry] : rows.map((row, index) => (index === editing ? entry : row)));
    setDraft(EMPTY_ROW);
    setEditing(null);
  };

  const useMyLocation = () => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setField({ gps: `${position.coords.latitude.toFixed(6)}, ${position.coords.longitude.toFixed(6)}` });
        setLocating(false);
      },
      () => setLocating(false),
      { timeout: 10_000 },
    );
  };

  return (
    <Panel
      title="Shipping Details"
      description="Delivery outlets for this customer. The first row is the default address in Sales."
      actions={
        rows.length > 0 && (
          <span className="rounded border border-accent-line bg-accent-soft px-1.5 text-[10px] font-semibold text-accent-strong tabular-nums dark:text-accent">
            {rows.length} in list
          </span>
        )
      }
    >
      <div className="flex flex-col gap-4">
        <FormGrid cols={4}>
          {TEXT_FIELDS.map((field) => (
            <Field key={field.key} label={field.label} required={field.required} error={draftErrors[field.key]} span={field.span}>
              {(id) =>
                field.key === "gps" ? (
                  <div className="flex gap-1.5">
                    <Input id={id} value={draft.gps} maxLength={field.max} placeholder="23.8103, 90.4125" onChange={(e) => setField({ gps: e.target.value })} />
                    <Button size="icon" className="size-8" loading={locating} aria-label="Use my current location" title="Use my current location" onClick={useMyLocation}>
                      {!locating && <Crosshair />}
                    </Button>
                  </div>
                ) : (
                  <Input
                    id={id}
                    value={draft[field.key]}
                    maxLength={field.max}
                    aria-invalid={!!draftErrors[field.key] || undefined}
                    onChange={(e) => setField({ [field.key]: e.target.value })}
                  />
                )
              }
            </Field>
          ))}
          <Field label="District" error={draftErrors.districtId}>
            {(id) => (
              <Select
                id={id}
                value={draft.districtId}
                placeholder="Select district…"
                options={options.districts.map((district) => ({ value: String(district.id), label: district.name }))}
                onChange={(e) => setField({ districtId: e.target.value, thanaId: "" })}
              />
            )}
          </Field>
          <AddableSelect
            label="Thana"
            value={draft.thanaId}
            options={options.thanas.filter((thana) => draft.districtId && thana.districtId === Number(draft.districtId)).map((t) => ({ value: t.id, label: t.name }))}
            onChange={(value) => setField({ thanaId: value })}
            onAdd={(name) => onAddThana(draft.districtId, name)}
            disabledReason={draft.districtId ? undefined : "Select a district first."}
            error={draftErrors.thanaId}
          />
          <AddableSelect
            label="Section"
            value={draft.sectionId}
            options={options.sections.filter((section) => section.businessUnitId === unit).map((s) => ({ value: s.id, label: s.name }))}
            onChange={(value) => setField({ sectionId: value })}
            onAdd={onAddSection}
            disabledReason={officeMissing}
            error={draftErrors.sectionId}
          />
          <div className="flex items-end gap-2">
            <Button variant="accent-soft" onClick={addToList}>
              <ListPlus /> {editing === null ? "Add to List" : "Update Row"}
            </Button>
            {editing !== null && (
              <Button
                variant="ghost"
                onClick={() => {
                  setEditing(null);
                  setDraft(EMPTY_ROW);
                  setDraftErrors({});
                }}
              >
                Cancel
              </Button>
            )}
          </div>
        </FormGrid>

        {error && <Notice tone="error">{error}</Notice>}

        {rows.length === 0 ? (
          <EmptyBlock title="No shipping details added">Fill the fields above and press “Add to List”.</EmptyBlock>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-grid w-full min-w-max">
              <thead>
                <tr>
                  {["SL", "Code", "Ref / Outlet", "Address", "GPS", "Contact Person", "Contact No", "VAT Reg No", "District", "Thana", "Section", "Action"].map((header) => (
                    <th key={header} scope="col" className="px-2.5 py-2 text-left">
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr key={row.id || `new-${index}`} className={cn(editing === index && "[&>td]:bg-accent-soft")}>
                    <td className="px-2.5 py-2 text-right text-ink-faint tabular-nums">
                      {index + 1}
                      {index === 0 && <span className="sr-only"> (default)</span>}
                    </td>
                    {[row.code, row.outlet].map((value, i) => (
                      <td key={i} className="px-2.5 py-2 whitespace-nowrap">{value || <span className="text-ink-faint">—</span>}</td>
                    ))}
                    <td className="max-w-80 px-2.5 py-2 whitespace-normal">{row.address}</td>
                    {[row.gps, row.contactPerson, row.contactNo, row.vatRegNo, districtName(row.districtId), thanaName(row.thanaId), sectionName(row.sectionId)].map((value, i) => (
                      <td key={i} className="px-2.5 py-2 whitespace-nowrap">{value || <span className="text-ink-faint">—</span>}</td>
                    ))}
                    <td className="px-1.5 py-1 text-center whitespace-nowrap">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="hover:text-accent-strong"
                        aria-label={`Edit shipping row ${index + 1}`}
                        onClick={() => {
                          setEditing(index);
                          setDraft(row);
                          setDraftErrors({});
                        }}
                      >
                        <Pencil />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="hover:text-danger"
                        aria-label={`Remove shipping row ${index + 1}`}
                        onClick={() => {
                          onChange(rows.filter((_, i) => i !== index));
                          if (editing === index) {
                            setEditing(null);
                            setDraft(EMPTY_ROW);
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
