"use client";

import { ArrowLeft, ListChecks, Plus, Save, Search, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { PageContainer, PageHead } from "@/components/layout/page";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { CheckboxField, CONTROL, SelectField, TextField } from "@/components/ui/form-field";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { Card, ErrorState, LoadingState } from "@/components/ui/section";
import { useToast } from "@/components/ui/toast";
import { useResource } from "@/hooks/use-resource";
import { errorMessage } from "@/lib/api/client";
import { cn } from "@/lib/cn";
import type { RichTextNode } from "@/lib/rich-text";
import { CustomerFormView } from "@/features/configuration/entity-master-data/customer/components/CustomerFormView";
import type { CustomerDto } from "@/features/configuration/entity-master-data/customer/schemas/customer.schema";
import { ItemFormView } from "@/features/configuration/entity-master-data/item/components/ItemFormView";
import type { ItemDto } from "@/features/configuration/entity-master-data/item/schemas/item.schema";
import { formatAmount } from "../../dashboard/lib/format";
import { issuesToErrors } from "../../lib/form";
import { addDays, useToday } from "../../lib/use-today";
import type { CustomerOption, SalesLookups } from "../../masters/schemas/masters.schema";
import { fetchCustomers, fetchItems, fetchSalesLookups, fetchSetupLookups } from "../../masters/services/masters.api";
import { paths } from "../../paths";
import { lineFigures, quotationTotals } from "../lib/totals";
import { QUOTATION_TYPES, quotationInputSchema, type QuotationDetail, type QuotationInput, type QuotationTerm } from "../schemas/quotation.schema";
import { createQuotation, fetchQuotation, updateQuotation } from "../services/quotation.api";

/** Days a new quotation stays valid by default. */
const DEFAULT_VALIDITY_DAYS = 30;

// ─── Entry points ────────────────────────────────────────────────────────────

/** New quotation; `copyId` prefills it from an existing one ("Duplicate"). */
export function NewQuotationView({ copyId }: { copyId: string | null }) {
  const today = useToday();
  const lookups = useResource("lookups", fetchSalesLookups);
  const copy = useResource(copyId, () => fetchQuotation(copyId!));
  const error = lookups.error ?? copy.error;
  if (error) return <Failed title="Create Sales Quotation" message={errorMessage(error)} onRetry={() => (lookups.reload(), copy.reload())} />;
  if (!today || !lookups.data || (copyId && !copy.data)) return <Loading title="Create Sales Quotation" />;
  return <QuotationForm today={today} lookups={lookups.data} source={copy.data ?? null} copy />;
}

/** Edit a pending quotation. */
export function EditQuotationView({ id }: { id: string }) {
  const today = useToday();
  const lookups = useResource("lookups", fetchSalesLookups);
  const quotation = useResource(`quotation:${id}`, () => fetchQuotation(id));
  const error = lookups.error ?? quotation.error;
  if (error) return <Failed title="Edit Sales Quotation" message={errorMessage(error)} onRetry={() => (lookups.reload(), quotation.reload())} />;
  if (!today || !lookups.data || !quotation.data) return <Loading title="Edit Sales Quotation" />;
  if (quotation.data.status !== "DRAFT") {
    return (
      <Failed
        title="Edit Sales Quotation"
        message={`${quotation.data.number} is no longer pending: only pending quotations can be edited.`}
        backTo={paths.quotation(id)}
      />
    );
  }
  return <QuotationForm key={quotation.data.updatedAt} today={today} lookups={lookups.data} source={quotation.data} />;
}

function Loading({ title }: { title: string }) {
  return (
    <PageContainer className="max-w-none">
      <PageHead title={title} />
      <LoadingState />
    </PageContainer>
  );
}

function Failed({ title, message, onRetry, backTo }: { title: string; message: string; onRetry?: () => void; backTo?: string }) {
  return (
    <PageContainer className="max-w-none">
      <PageHead title={title} />
      <Card>
        <ErrorState message={message} onRetry={onRetry} />
        {backTo && (
          <p className="px-4 pb-4 text-center text-sm">
            <Link href={backTo} className="text-accent-strong hover:underline">
              Open the quotation
            </Link>
          </p>
        )}
      </Card>
    </PageContainer>
  );
}

// ─── Form state ──────────────────────────────────────────────────────────────

interface LineValues {
  key: string;
  itemId: string;
  code: string;
  name: string;
  uom: string;
  qty: string;
  rate: string;
  discountPercent: string;
  vatPercent: string;
  aitPercent: string;
  warranty: string;
  deliveryDate: string;
}

interface FormValues {
  officeId: string;
  customerId: string;
  customerLabel: string;
  quotationDate: string;
  validTill: string;
  contactMobile: string;
  billingAddress: string;
  billingContactPerson: string;
  billingContactNo: string;
  reference: string;
  subject: string;
  quotationType: string;
  includingVat: boolean;
  remarksBody: RichTextNode | null;
  remarksFooter: RichTextNode | null;
  terms: QuotationTerm[];
  lines: LineValues[];
}

const newKey = () => crypto.randomUUID();
const n = (value: string) => {
  const parsed = Number(value);
  return value.trim() === "" || !Number.isFinite(parsed) ? 0 : parsed;
};
const strict = (value: string) => (value.trim() === "" ? Number.NaN : Number(value));

/** "1. Delivery within 7 days" lines → terms. */
function parseTerms(text: string | undefined): QuotationTerm[] {
  return (text ?? "")
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*\d+[.)]\s*/, "").trim())
    .filter(Boolean)
    .map((line) => ({ text: line, optional: false }));
}

function fromDetail(detail: QuotationDetail, today: string, copy: boolean): FormValues {
  return {
    officeId: detail.officeId,
    customerId: detail.customerId,
    customerLabel: `${detail.customerCode} - ${detail.customerName}`,
    quotationDate: copy ? today : detail.quotationDate,
    validTill: copy ? addDays(today, DEFAULT_VALIDITY_DAYS) : detail.validTill,
    contactMobile: detail.contactMobile ?? "",
    billingAddress: detail.billingAddress ?? "",
    billingContactPerson: detail.billingContactPerson ?? "",
    billingContactNo: detail.billingContactNo ?? "",
    reference: detail.reference ?? "",
    subject: detail.subject ?? "",
    quotationType: detail.quotationType,
    includingVat: detail.includingVat,
    remarksBody: detail.remarksBody,
    remarksFooter: detail.remarksFooter,
    terms: detail.termsList,
    lines: detail.lines.map((line) => ({
      key: newKey(),
      itemId: line.itemId,
      code: line.itemCode,
      name: line.itemName,
      uom: line.uom,
      qty: String(line.qty),
      rate: String(line.rate),
      discountPercent: String(line.discountPercent),
      vatPercent: String(line.vatPercent),
      aitPercent: String(line.aitPercent),
      warranty: line.warranty ?? "",
      deliveryDate: copy ? "" : (line.deliveryDate ?? ""),
    })),
  };
}

function toInput(values: FormValues): QuotationInput {
  return {
    officeId: values.officeId,
    customerId: values.customerId,
    quotationDate: values.quotationDate,
    validTill: values.validTill,
    contactMobile: values.contactMobile,
    billingAddress: values.billingAddress,
    billingContactPerson: values.billingContactPerson,
    billingContactNo: values.billingContactNo,
    reference: values.reference,
    subject: values.subject,
    quotationType: values.quotationType as QuotationInput["quotationType"],
    includingVat: values.includingVat,
    remarksBody: values.remarksBody as QuotationInput["remarksBody"],
    remarksFooter: values.remarksFooter as QuotationInput["remarksFooter"],
    terms: values.terms,
    lines: values.lines.map((line) => ({
      itemId: line.itemId,
      qty: strict(line.qty),
      rate: strict(line.rate),
      discountPercent: n(line.discountPercent),
      vatPercent: n(line.vatPercent),
      aitPercent: n(line.aitPercent),
      warranty: line.warranty,
      deliveryDate: line.deliveryDate || null,
    })),
  };
}

const itemLabel = (item: { code: string; name: string }) => `${item.code} - ${item.name}`;

// ─── Form ────────────────────────────────────────────────────────────────────

interface EntryValues {
  itemType: string;
  categoryId: string;
  subCategoryId: string;
  itemText: string;
  qty: string;
  rate: string;
  discountPercent: string;
  withVat: boolean;
  vatPercent: string;
  aitPercent: string;
  warranty: string;
  deliveryDate: string;
}

const EMPTY_ENTRY: EntryValues = {
  itemType: "",
  categoryId: "",
  subCategoryId: "",
  itemText: "",
  qty: "",
  rate: "",
  discountPercent: "",
  withVat: false,
  vatPercent: "",
  aitPercent: "",
  warranty: "",
  deliveryDate: "",
};

function QuotationForm({ today, lookups, source, copy }: { today: string; lookups: SalesLookups; source: QuotationDetail | null; copy?: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const record = copy ? null : source;
  const initial = useMemo<FormValues>(() => {
    if (source) return fromDetail(source, today, !!copy);
    // The first office is preselected so customers, items and ADD NEW work straight away.
    const office = lookups.offices[0];
    return {
      officeId: office?.id ?? "",
      customerId: "",
      customerLabel: "",
      quotationDate: today,
      validTill: addDays(today, DEFAULT_VALIDITY_DAYS),
      contactMobile: "",
      billingAddress: "",
      billingContactPerson: "",
      billingContactNo: "",
      reference: "",
      subject: "",
      quotationType: "Quotation",
      includingVat: false,
      remarksBody: null,
      remarksFooter: null,
      terms: office ? parseTerms(lookups.quotationTerms[office.businessUnitId]) : [],
      lines: [],
    };
  }, [source, copy, lookups, today]);

  const [values, setValues] = useState<FormValues>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [entry, setEntry] = useState<EntryValues>(EMPTY_ENTRY);
  const [entryError, setEntryError] = useState<Record<string, string>>({});
  const [customerTerm, setCustomerTerm] = useState("");
  const [dialog, setDialog] = useState<"customer" | "item" | "terms" | null>(null);
  const [busy, setBusy] = useState(false);

  const set = (patch: Partial<FormValues>) => setValues((current) => ({ ...current, ...patch }));
  const office = lookups.offices.find((candidate) => candidate.id === values.officeId);
  const businessUnitId = office?.businessUnitId ?? null;

  const masters = useResource(businessUnitId && `quotation-masters:${businessUnitId}`, async () => {
    const [customers, items, setup] = await Promise.all([fetchCustomers(businessUnitId!), fetchItems(businessUnitId!), fetchSetupLookups(businessUnitId!)]);
    return { customers, items, categories: setup.categories };
  });
  const customers = masters.data?.customers ?? [];
  const items = masters.data?.items ?? [];
  const categories = useMemo(() => masters.data?.categories ?? [], [masters.data]);

  // Level-1 / level-2 ancestors of each category, for the Category / Sub Category filters.
  const ancestry = useMemo(() => {
    const byId = new Map(categories.map((category) => [category.id, category]));
    const result = new Map<string, { category: string | null; subCategory: string | null }>();
    for (const category of categories) {
      let level1: string | null = null;
      let level2: string | null = null;
      for (let node = byId.get(category.id), depth = 0; node && depth < 10; depth++) {
        if (node.level === 1) level1 = node.id;
        if (node.level === 2) level2 = node.id;
        node = node.parentId ? byId.get(node.parentId) : undefined;
      }
      result.set(category.id, { category: level1, subCategory: level2 });
    }
    return result;
  }, [categories]);

  const itemTypes = [...new Set(items.map((item) => item.itemType).filter((type): type is string => !!type))].sort();
  const matchingItems = items.filter((item) => {
    const place = item.categoryId ? ancestry.get(item.categoryId) : undefined;
    return (
      (!entry.itemType || item.itemType === entry.itemType) &&
      (!entry.categoryId || place?.category === entry.categoryId) &&
      (!entry.subCategoryId || place?.subCategory === entry.subCategoryId)
    );
  });
  const itemByLabel = new Map(matchingItems.map((item) => [itemLabel(item), item]));
  const pickedItem = itemByLabel.get(entry.itemText.trim());

  const totals = quotationTotals(
    values.lines.map((line) => ({ qty: n(line.qty), rate: n(line.rate), discountPercent: n(line.discountPercent), vatPercent: n(line.vatPercent), aitPercent: n(line.aitPercent) })),
    values.includingVat,
  );

  const term = customerTerm.trim().toLowerCase();
  const customerMatches =
    term.length >= 3
      ? customers.filter((customer) => [customer.name, customer.code, customer.phone ?? ""].some((value) => value.toLowerCase().includes(term))).slice(0, 20)
      : [];

  function changeOffice(officeId: string) {
    const next = lookups.offices.find((candidate) => candidate.id === officeId);
    setValues((current) => {
      if (!next || next.businessUnitId === businessUnitId) return { ...current, officeId };
      // Customers and items belong to a business unit: start over.
      return {
        ...current,
        officeId,
        customerId: "",
        customerLabel: "",
        contactMobile: "",
        terms: current.terms.length ? current.terms : parseTerms(lookups.quotationTerms[next.businessUnitId]),
        lines: [],
      };
    });
  }

  function pickCustomer(customer: Pick<CustomerOption, "id" | "code" | "name" | "phone" | "address" | "contactPerson">) {
    set({
      customerId: customer.id,
      customerLabel: customer.code ? `${customer.code} - ${customer.name}` : customer.name,
      contactMobile: customer.phone ?? "",
      billingAddress: values.billingAddress || customer.address || "",
      billingContactPerson: values.billingContactPerson || customer.contactPerson || "",
      billingContactNo: values.billingContactNo || customer.phone || "",
    });
    setCustomerTerm("");
  }

  /**
   * Moves the quotation to an office of `unitId` when it is in another business unit
   * (customers and items belong to one). Returns false when items would be lost.
   */
  function followUnit(unitId: string, officeId?: string): boolean {
    if (unitId === businessUnitId) return true;
    if (values.lines.length > 0) return false;
    const target = lookups.offices.find((candidate) => candidate.id === officeId && candidate.businessUnitId === unitId) ?? lookups.offices.find((candidate) => candidate.businessUnitId === unitId);
    if (!target) return false;
    changeOffice(target.id);
    return true;
  }

  function customerSaved(customer: CustomerDto) {
    setDialog(null);
    masters.reload();
    const unitId = lookups.offices.find((candidate) => candidate.id === customer.officeId)?.businessUnitId;
    if (!unitId || !followUnit(unitId, customer.officeId)) {
      toast.error(`Customer ${customer.name} was saved for another business unit than this quotation's items; remove the items or choose that unit's office.`);
      return;
    }
    pickCustomer({ id: customer.id, code: customer.code ?? "", name: customer.name, phone: customer.mobile, address: customer.billingAddress ?? null, contactPerson: customer.contactPerson ?? null });
    toast.success(`Customer ${customer.name} added and selected.`);
  }

  function chooseItemText(text: string) {
    const item = itemByLabel.get(text.trim());
    setEntry((current) => ({
      ...current,
      itemText: text,
      ...(item ? { rate: current.rate || String(item.salesRate || ""), vatPercent: item.vatPercent ? String(item.vatPercent) : current.vatPercent, withVat: item.vatPercent > 0 || current.withVat } : {}),
    }));
  }

  function addLine() {
    const errs: Record<string, string> = {};
    if (!pickedItem) errs.item = "Choose the item from the list.";
    else if (values.lines.some((line) => line.itemId === pickedItem.id)) errs.item = "This item is already in the quotation; change its quantity below.";
    if (!(n(entry.qty) > 0)) errs.qty = "Qty must be more than 0.";
    if (!(n(entry.rate) > 0)) errs.rate = "Unit Price must be more than 0.";
    for (const [key, label] of [["discountPercent", "Disc"], ["vatPercent", "VAT"], ["aitPercent", "AIT"]] as const) {
      const value = n(entry[key]);
      if (value < 0 || value > 100) errs[key] = `${label} must be 0 to 100%.`;
    }
    if (entry.deliveryDate && entry.deliveryDate < values.quotationDate) errs.deliveryDate = "Delivery cannot be before the Create Date.";
    setEntryError(errs);
    if (Object.keys(errs).length || !pickedItem) return;
    set({
      lines: [
        ...values.lines,
        {
          key: newKey(),
          itemId: pickedItem.id,
          code: pickedItem.code,
          name: pickedItem.name,
          uom: pickedItem.uom,
          qty: entry.qty,
          rate: entry.rate,
          discountPercent: entry.discountPercent || "0",
          vatPercent: entry.withVat ? entry.vatPercent || "0" : "0",
          aitPercent: entry.aitPercent || "0",
          warranty: entry.warranty,
          deliveryDate: entry.deliveryDate,
        },
      ],
    });
    setEntry({ ...EMPTY_ENTRY, itemType: entry.itemType, categoryId: entry.categoryId, subCategoryId: entry.subCategoryId, withVat: entry.withVat, vatPercent: entry.withVat ? entry.vatPercent : "" });
  }

  const updateLine = (key: string, patch: Partial<LineValues>) => set({ lines: values.lines.map((line) => (line.key === key ? { ...line, ...patch } : line)) });

  async function save() {
    const input = toInput(values);
    const parsed = quotationInputSchema.safeParse(input);
    if (!parsed.success) {
      setErrors(issuesToErrors(parsed.error));
      toast.error(parsed.error.issues[0]?.message ?? "Please correct the highlighted fields.");
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      const saved = record ? await updateQuotation(record.id, record.updatedAt, input) : await createQuotation(input);
      toast.success(`Quotation ${saved.number} ${record ? "updated" : "created"}.`);
      router.push(paths.quotation(saved.id));
    } catch (error) {
      toast.error(errorMessage(error));
      setBusy(false);
    }
  }

  const lineError = (index: number, field: string) => errors[`lines.${index}.${field}`];
  const numberCell = (line: LineValues, index: number, field: "qty" | "rate" | "discountPercent" | "vatPercent" | "aitPercent", label: string, width = "w-20") => (
    <input
      type="number"
      inputMode="decimal"
      step="any"
      min={0}
      aria-label={`${label} of ${line.name}`}
      aria-invalid={!!lineError(index, field) || undefined}
      value={line[field]}
      onChange={(event) => updateLine(line.key, { [field]: event.target.value })}
      className={cn(CONTROL, "h-7 text-right tabular-nums", width, lineError(index, field) && "ring-1 ring-danger")}
    />
  );

  const level1 = categories.filter((category) => category.level === 1);
  const level2 = categories.filter((category) => category.level === 2 && category.parentId === entry.categoryId);

  return (
    <PageContainer className="max-w-none">
      <PageHead
        title={
          <span className="flex items-center gap-2">
            <Link href={record ? paths.quotation(record.id) : paths.quotations} aria-label="Back" className="rounded-md p-1 text-ink-muted hover:bg-control hover:text-ink">
              <ArrowLeft aria-hidden="true" className="size-5" />
            </Link>
            {record ? `Edit Sales Quotation ${record.number}` : "Create Sales Quotation"}
          </span>
        }
        actions={
          <Button variant="primary" onClick={save} loading={busy}>
            <Save aria-hidden="true" />
            SAVE
          </Button>
        }
      />
      <div className="flex flex-col gap-4">
        <Card className="flex flex-col gap-4 p-4">
          <CheckboxField label="Including VAT" hint="Unit prices already include VAT." checked={values.includingVat} onChange={(event) => set({ includingVat: event.target.checked })} />
          <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
            <TextField label="Create Date" required type="date" value={values.quotationDate} error={errors.quotationDate} onChange={(event) => set({ quotationDate: event.target.value })} />
            <SelectField
              label="Office"
              required
              value={values.officeId}
              error={errors.officeId}
              options={[{ value: "", label: "Office" }, ...lookups.offices.map((candidate) => ({ value: candidate.id, label: candidate.name }))]}
              onChange={(event) => changeOffice(event.target.value)}
            />
            <div className="relative">
              <div className="flex items-end justify-between">
                <span className="text-xs text-ink-muted">
                  Customer<span className="ml-0.5 text-danger">*</span>
                </span>
                <button type="button" className="text-xs font-medium text-accent-strong hover:underline" onClick={() => setDialog("customer")}>
                  + ADD NEW
                </button>
              </div>
              {values.customerId ? (
                <span className={cn(CONTROL, "mt-1 flex h-7 items-center gap-2")}>
                  <span className="min-w-0 flex-1 truncate">{values.customerLabel}</span>
                  <button type="button" aria-label="Clear customer" className="text-ink-faint hover:text-ink" onClick={() => set({ customerId: "", customerLabel: "" })}>
                    <X aria-hidden="true" className="size-3.5" />
                  </button>
                </span>
              ) : (
                <input
                  aria-label="Customer"
                  disabled={!businessUnitId}
                  placeholder={businessUnitId ? "Select/Search Customer (min 3 letters)" : "Choose the office first"}
                  value={customerTerm}
                  onChange={(event) => setCustomerTerm(event.target.value)}
                  className={cn(CONTROL, "mt-1 h-7", errors.customerId && "ring-1 ring-danger")}
                />
              )}
              {errors.customerId && <p className="mt-1 text-xs text-danger">{errors.customerId}</p>}
              {!values.customerId && term.length >= 3 && (
                <div role="listbox" aria-label="Matching customers" className="absolute top-14 z-10 max-h-64 w-full overflow-y-auto rounded-md border border-line bg-surface shadow-dropdown">
                  {masters.loading && !masters.data ? (
                    <p className="flex items-center gap-2 px-3 py-2 text-xs text-ink-faint">
                      <Search aria-hidden="true" className="size-3.5" />
                      Loading customers…
                    </p>
                  ) : customerMatches.length === 0 ? (
                    <p className="px-3 py-2 text-xs text-ink-faint">No customer matches. Use + ADD NEW to create one.</p>
                  ) : (
                    customerMatches.map((customer) => (
                      <button key={customer.id} type="button" role="option" aria-selected={false} onClick={() => pickCustomer(customer)} className="block w-full px-3 py-2 text-left text-sm text-ink hover:bg-hover">
                        {customer.code} - {customer.name}
                        {customer.phone && <span className="ml-2 text-xs text-ink-faint">{customer.phone}</span>}
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
            <SelectField
              label="Quotation Type"
              value={values.quotationType}
              options={QUOTATION_TYPES.map((type) => ({ value: type, label: type }))}
              onChange={(event) => set({ quotationType: event.target.value })}
            />
            <TextField label="Billing Address" maxLength={500} placeholder="Billing Address" value={values.billingAddress} error={errors.billingAddress} onChange={(event) => set({ billingAddress: event.target.value })} />
            <TextField label="Billing Contact Person" maxLength={150} placeholder="Billing Contact Person" value={values.billingContactPerson} error={errors.billingContactPerson} onChange={(event) => set({ billingContactPerson: event.target.value })} />
            <TextField label="Billing Contact No" maxLength={30} placeholder="Billing Contact No" value={values.billingContactNo} error={errors.billingContactNo} onChange={(event) => set({ billingContactNo: event.target.value })} />
            <TextField label="Valid Till Date" required type="date" min={values.quotationDate} value={values.validTill} error={errors.validTill} onChange={(event) => set({ validTill: event.target.value })} />
            <TextField label="Reference" maxLength={150} placeholder="Reference" value={values.reference} error={errors.reference} onChange={(event) => set({ reference: event.target.value })} />
            <TextField label="Mobile No." maxLength={30} placeholder="Customer mobile" value={values.contactMobile} error={errors.contactMobile} onChange={(event) => set({ contactMobile: event.target.value })} />
            <TextField label="Subject" className="sm:col-span-2" maxLength={300} placeholder="Subject" value={values.subject} error={errors.subject} onChange={(event) => set({ subject: event.target.value })} />
          </div>
          <RichTextEditor label="Remarks (body)" value={values.remarksBody} error={errors.remarksBody} placeholder="Text shown above the items…" onChange={(value) => set({ remarksBody: value as RichTextNode | null })} />
          <RichTextEditor label="Remarks (footer)" value={values.remarksFooter} error={errors.remarksFooter} placeholder="Text shown below the items…" onChange={(value) => set({ remarksFooter: value as RichTextNode | null })} />
          <div>
            <Button variant="accent" className="rounded-full" onClick={() => setDialog("terms")}>
              <ListChecks aria-hidden="true" />
              Terms &amp; Conditions{values.terms.length ? ` (${values.terms.length})` : ""}
            </Button>
          </div>
        </Card>

        <Card className="flex flex-col gap-4 p-4">
          <div className="grid gap-x-4 gap-y-3 sm:grid-cols-3">
            <SelectField
              label="Item Type"
              value={entry.itemType}
              options={[{ value: "", label: "All" }, ...itemTypes.map((type) => ({ value: type, label: type }))]}
              onChange={(event) => setEntry({ ...entry, itemType: event.target.value, itemText: "" })}
            />
            <SelectField
              label="Category"
              value={entry.categoryId}
              options={[{ value: "", label: "All" }, ...level1.map((category) => ({ value: category.id, label: category.name }))]}
              onChange={(event) => setEntry({ ...entry, categoryId: event.target.value, subCategoryId: "", itemText: "" })}
            />
            <SelectField
              label="Sub Category"
              value={entry.subCategoryId}
              disabled={!entry.categoryId || level2.length === 0}
              options={[{ value: "", label: "All" }, ...level2.map((category) => ({ value: category.id, label: category.name }))]}
              onChange={(event) => setEntry({ ...entry, subCategoryId: event.target.value, itemText: "" })}
            />
          </div>
          <div className="grid items-start gap-x-3 gap-y-3 sm:grid-cols-4 xl:grid-cols-[minmax(0,2.4fr)_repeat(3,minmax(0,1fr))_minmax(0,1.3fr)_repeat(3,minmax(0,1fr))_auto]">
            <div className="flex flex-col gap-1 sm:col-span-2 xl:col-span-1">
              <div className="flex items-end justify-between">
                <span className="text-xs text-ink-muted">
                  Item<span className="ml-0.5 text-danger">*</span>
                </span>
                <button type="button" className="text-xs font-medium text-accent-strong hover:underline" onClick={() => setDialog("item")}>
                  + ADD NEW
                </button>
              </div>
              <input
                aria-label="Item"
                list="quotation-items"
                disabled={!businessUnitId}
                placeholder={businessUnitId ? `Search item (${matchingItems.length})` : "Choose the office first"}
                value={entry.itemText}
                onChange={(event) => chooseItemText(event.target.value)}
                className={cn(CONTROL, "h-7", entryError.item && "ring-1 ring-danger")}
              />
              <datalist id="quotation-items">
                {matchingItems.map((item) => (
                  <option key={item.id} value={itemLabel(item)} />
                ))}
              </datalist>
              {entryError.item && <p className="text-xs text-danger">{entryError.item}</p>}
            </div>
            <TextField label={`Qty${pickedItem ? ` (${pickedItem.uom})` : ""}`} required type="number" min={0} step="any" value={entry.qty} error={entryError.qty} onChange={(event) => setEntry({ ...entry, qty: event.target.value })} />
            <TextField label="Unit Price" required type="number" min={0} step="any" value={entry.rate} error={entryError.rate} onChange={(event) => setEntry({ ...entry, rate: event.target.value })} />
            <TextField label="Disc (%)" type="number" min={0} max={100} step="any" value={entry.discountPercent} error={entryError.discountPercent} onChange={(event) => setEntry({ ...entry, discountPercent: event.target.value })} />
            <div className="flex flex-col gap-1">
              <label className="flex items-center gap-1.5 text-xs text-ink-muted">
                <input type="checkbox" checked={entry.withVat} onChange={(event) => setEntry({ ...entry, withVat: event.target.checked })} className="size-3.5 accent-(--primary)" />
                VAT (%)
              </label>
              <input
                type="number"
                aria-label="VAT (%)"
                min={0}
                max={100}
                step="any"
                disabled={!entry.withVat}
                value={entry.vatPercent}
                onChange={(event) => setEntry({ ...entry, vatPercent: event.target.value })}
                className={cn(CONTROL, "h-7", entryError.vatPercent && "ring-1 ring-danger")}
              />
              {entryError.vatPercent && <p className="text-xs text-danger">{entryError.vatPercent}</p>}
            </div>
            <TextField label="AIT (%)" type="number" min={0} max={100} step="any" value={entry.aitPercent} error={entryError.aitPercent} onChange={(event) => setEntry({ ...entry, aitPercent: event.target.value })} />
            <TextField label="Warranty" maxLength={100} placeholder="e.g. 12 Month" value={entry.warranty} onChange={(event) => setEntry({ ...entry, warranty: event.target.value })} />
            <TextField label="Delivery Date" type="date" min={values.quotationDate} value={entry.deliveryDate} error={entryError.deliveryDate} onChange={(event) => setEntry({ ...entry, deliveryDate: event.target.value })} />
            <Button variant="primary" className="sm:mt-5" onClick={addLine} disabled={!businessUnitId}>
              <Plus aria-hidden="true" />
              Add
            </Button>
          </div>
          {errors.lines && (
            <p role="alert" className="text-sm text-danger">
              {errors.lines}
            </p>
          )}

          <div className="overflow-x-auto rounded-md border border-line">
            <table className="w-full text-sm">
              <thead className="bg-accent-soft text-xs text-ink">
                <tr>
                  {["Code", "Name", "Quantity", "Unit Price", "Discount (%)", "VAT (%)", "AIT (%)", "Total Amount", "Warranty", "Delivery Date", "Action"].map((header) => (
                    <th key={header} scope="col" className={cn("px-2 py-2 font-semibold whitespace-nowrap", ["Code", "Name", "Warranty", "Delivery Date"].includes(header) ? "text-left" : "text-right", header === "Action" && "text-center")}>
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {values.lines.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="px-3 py-6 text-center text-ink-faint">
                      Add the items to quote.
                    </td>
                  </tr>
                ) : (
                  values.lines.map((line, index) => {
                    const figures = lineFigures({ qty: n(line.qty), rate: n(line.rate), discountPercent: n(line.discountPercent), vatPercent: n(line.vatPercent), aitPercent: n(line.aitPercent) }, values.includingVat);
                    return (
                      <tr key={line.key} className="border-t border-line align-middle">
                        <td className="px-2 py-1.5 whitespace-nowrap text-ink-muted">{line.code}</td>
                        <td className="px-2 py-1.5 text-ink">{line.name}</td>
                        <td className="px-2 py-1.5 text-right">
                          <span className="inline-flex items-center gap-1">
                            {numberCell(line, index, "qty", "Quantity")}
                            <span className="text-xs text-ink-faint">{line.uom}</span>
                          </span>
                        </td>
                        <td className="px-2 py-1.5 text-right">{numberCell(line, index, "rate", "Unit price", "w-24")}</td>
                        <td className="px-2 py-1.5 text-right">{numberCell(line, index, "discountPercent", "Discount", "w-16")}</td>
                        <td className="px-2 py-1.5 text-right">{numberCell(line, index, "vatPercent", "VAT", "w-16")}</td>
                        <td className="px-2 py-1.5 text-right">{numberCell(line, index, "aitPercent", "AIT", "w-16")}</td>
                        <td className="px-2 py-1.5 text-right font-medium text-ink tabular-nums">{formatAmount(figures.amount)}</td>
                        <td className="px-2 py-1.5">
                          <input aria-label={`Warranty of ${line.name}`} maxLength={100} value={line.warranty} onChange={(event) => updateLine(line.key, { warranty: event.target.value })} className={cn(CONTROL, "h-7 w-28")} />
                        </td>
                        <td className="px-2 py-1.5">
                          <input
                            type="date"
                            aria-label={`Delivery date of ${line.name}`}
                            min={values.quotationDate}
                            value={line.deliveryDate}
                            onChange={(event) => updateLine(line.key, { deliveryDate: event.target.value })}
                            className={cn(CONTROL, "h-7 w-36")}
                          />
                        </td>
                        <td className="px-2 py-1.5 text-center">
                          <Button size="icon" variant="ghost" className="text-danger" aria-label={`Remove ${line.name}`} onClick={() => set({ lines: values.lines.filter((row) => row.key !== line.key) })}>
                            <Trash2 aria-hidden="true" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          <dl className="ml-auto grid w-full max-w-sm grid-cols-[1fr_auto] gap-x-6 gap-y-1 text-sm">
            <dt className="text-ink-muted">Total Qty</dt>
            <dd className="text-right tabular-nums">{totals.totalQty.toLocaleString("en-US")}</dd>
            <dt className="text-ink-muted">Sub Total</dt>
            <dd className="text-right tabular-nums">{formatAmount(totals.subTotal)}</dd>
            <dt className="text-ink-muted">Discount</dt>
            <dd className="text-right tabular-nums">− {formatAmount(totals.discountAmount)}</dd>
            <dt className="text-ink-muted">VAT{values.includingVat ? " (included)" : ""}</dt>
            <dd className="text-right tabular-nums">{values.includingVat ? "" : "+ "}{formatAmount(totals.vatAmount)}</dd>
            <dt className="text-ink-muted">AIT</dt>
            <dd className="text-right tabular-nums">+ {formatAmount(totals.aitAmount)}</dd>
            <dt className="border-t border-line pt-1 font-semibold text-ink">Grand Total</dt>
            <dd className="border-t border-line pt-1 text-right font-semibold text-ink tabular-nums">{formatAmount(totals.grandTotal)}</dd>
          </dl>
        </Card>
      </div>

      <TermsDialog open={dialog === "terms"} terms={values.terms} onClose={() => setDialog(null)} onDone={(terms) => (set({ terms }), setDialog(null))} />
      <Dialog open={dialog === "customer"} title="Add Customer" size="xl" className="max-w-7xl" onClose={() => setDialog(null)}>
        {dialog === "customer" && (
          <CustomerFormView
            defaultOfficeId={values.officeId}
            embedded={{ defaultOfficeId: values.officeId, onSaved: customerSaved, onCancel: () => setDialog(null) }}
          />
        )}
      </Dialog>
      <Dialog open={dialog === "item"} title="Add Item" size="xl" className="max-w-7xl" onClose={() => setDialog(null)}>
        {dialog === "item" && (
          <ItemFormView
            embedded={{
              businessUnitId: businessUnitId ?? undefined,
              onCancel: () => setDialog(null),
              onSaved: (item: ItemDto) => {
                setDialog(null);
                masters.reload();
                if (!followUnit(item.businessUnitId)) {
                  toast.error(`Item ${item.name} was saved for another business unit than this quotation's items; remove the items or choose that unit's office.`);
                  return;
                }
                // The new item goes into the entry row with its price and VAT.
                const vat = Number(item.vatPercent || 0);
                setEntry({
                  ...EMPTY_ENTRY,
                  itemText: itemLabel(item),
                  rate: item.sellingPrice || "",
                  withVat: vat > 0,
                  vatPercent: vat > 0 ? String(vat) : "",
                });
              },
            }}
          />
        )}
      </Dialog>
    </PageContainer>
  );
}

// ─── Terms & Conditions ──────────────────────────────────────────────────────

function TermsDialog({ open, terms, onClose, onDone }: { open: boolean; terms: QuotationTerm[]; onClose: () => void; onDone: (terms: QuotationTerm[]) => void }) {
  return open ? <TermsEditor terms={terms} onClose={onClose} onDone={onDone} /> : null;
}

function TermsEditor({ terms, onClose, onDone }: { terms: QuotationTerm[]; onClose: () => void; onDone: (terms: QuotationTerm[]) => void }) {
  const [rows, setRows] = useState<(QuotationTerm & { key: string })[]>(() =>
    (terms.length ? terms : [{ text: "", optional: false }]).map((term) => ({ ...term, key: newKey() })),
  );
  const update = (key: string, patch: Partial<QuotationTerm>) => setRows((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  return (
    <Dialog
      open
      title="Add Terms And Conditions"
      size="lg"
      onClose={onClose}
      onSubmit={() => onDone(rows.filter((row) => row.text.trim()).map(({ text, optional }) => ({ text: text.trim(), optional })))}
      footer={
        <>
          <Button variant="ghost" className="text-danger" onClick={onClose}>
            CLOSE
          </Button>
          <Button type="submit" variant="primary">
            DONE
          </Button>
        </>
      }
    >
      <ol className="flex flex-col gap-2">
        {rows.map((row, index) => (
          <li key={row.key} className="flex items-center gap-2">
            <span className="w-6 shrink-0 text-right text-sm text-ink-muted tabular-nums">{index + 1}.</span>
            <input
              aria-label={`Term ${index + 1}`}
              maxLength={1000}
              value={row.text}
              placeholder="Write a term or condition"
              onChange={(event) => update(row.key, { text: event.target.value })}
              className={cn(CONTROL, "h-8 flex-1")}
            />
            <label className="flex shrink-0 items-center gap-1.5 text-xs text-ink-muted">
              <input type="checkbox" checked={row.optional} onChange={(event) => update(row.key, { optional: event.target.checked })} className="size-3.5 accent-(--primary)" />
              Optional
            </label>
            <Button size="icon" variant="ghost" className="text-danger" aria-label={`Remove term ${index + 1}`} onClick={() => setRows((current) => current.filter((item) => item.key !== row.key))}>
              <Trash2 aria-hidden="true" />
            </Button>
          </li>
        ))}
      </ol>
      <Button variant="accent-soft" size="sm" className="mt-3" onClick={() => setRows((current) => [...current, { key: newKey(), text: "", optional: false }])}>
        <Plus aria-hidden="true" />
        Add Term
      </Button>
      <p className="mt-2 text-xs text-ink-faint">Empty lines are left out. Default terms come from Sales Setup.</p>
    </Dialog>
  );
}

