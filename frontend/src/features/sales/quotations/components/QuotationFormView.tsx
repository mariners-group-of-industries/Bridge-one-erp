"use client";

import { Ban, Copy, Ellipsis, Plus, RefreshCw, RotateCcw, Send, ShoppingCart, ThumbsDown, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { RecordMeta } from "@/components/layout/record-meta";
import { PageContainer, PageHead } from "@/components/layout/page";
import { Button, buttonClasses } from "@/components/ui/button";
import { ConfirmDialog, Dialog } from "@/components/ui/dialog";
import { DropdownMenu, type MenuItem } from "@/components/ui/dropdown-menu";
import { CONTROL, ReadOnlyField, SelectField, TextAreaField, TextField } from "@/components/ui/form-field";
import { Indicator } from "@/components/ui/indicator";
import { Card, ErrorState, FieldGrid, LoadingState, Section } from "@/components/ui/section";
import { Tabs } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast";
import { useResource } from "@/hooks/use-resource";
import { useSaveShortcut } from "@/hooks/use-save-shortcut";
import { errorMessage } from "@/lib/api/client";
import { cn } from "@/lib/cn";
import { formatAmount } from "../../dashboard/lib/format";
import { addDays, useToday } from "../../lib/use-today";
import { CustomerQuickEntry, ItemQuickEntry, SalesPersonQuickEntry } from "../../masters/components/QuickEntryDialogs";
import type { CustomerOption, ItemOption, SalesLookups, SalesPersonOption } from "../../masters/schemas/masters.schema";
import { fetchCustomers, fetchItems, fetchSalesLookups, fetchSalesPersons } from "../../masters/services/masters.api";
import { paths } from "../../paths";
import { quotationTotals } from "../lib/totals";
import {
  displayStatus,
  quotationInputSchema,
  type QuotationAction,
  type QuotationDetail,
  type QuotationInput,
} from "../schemas/quotation.schema";
import {
  changeQuotationStatus,
  createQuotation,
  deleteQuotation,
  fetchQuotation,
  updateQuotation,
} from "../services/quotation.api";
import { QuotationStatusIndicator } from "./QuotationStatusIndicator";

/** Days a new quotation stays valid by default. */
const DEFAULT_VALIDITY_DAYS = 15;

// ─── Entry points ────────────────────────────────────────────────────────────

export function QuotationFormView({ id }: { id: string }) {
  const today = useToday();
  const quotation = useResource(id, () => fetchQuotation(id));
  const lookups = useResource("lookups", fetchSalesLookups);
  const error = quotation.error ?? lookups.error;

  if (error) {
    return (
      <PageContainer>
        <PageHead title="Sales Quotation" />
        <Card>
          <ErrorState
            message={errorMessage(error)}
            onRetry={() => {
              quotation.reload();
              lookups.reload();
            }}
          />
        </Card>
      </PageContainer>
    );
  }
  if (!today || !quotation.data || !lookups.data) {
    return (
      <PageContainer>
        <PageHead title={quotation.data?.number ?? "Sales Quotation"} />
        <LoadingState />
      </PageContainer>
    );
  }
  return (
    <QuotationEditor
      key={quotation.data.updatedAt}
      today={today}
      lookups={lookups.data}
      detail={quotation.data}
      onSaved={(detail) => quotation.mutate(() => detail)}
      onReload={quotation.reload}
    />
  );
}

/** New quotation; `copyId` prefills it from an existing one ("Duplicate"). */
export function NewQuotationView({ copyId }: { copyId: string | null }) {
  const today = useToday();
  const lookups = useResource("lookups", fetchSalesLookups);
  const copy = useResource(copyId, () => fetchQuotation(copyId!));
  const error = lookups.error ?? copy.error;

  if (error) {
    return (
      <PageContainer>
        <PageHead title="New Sales Quotation" />
        <Card>
          <ErrorState message={errorMessage(error)} onRetry={lookups.reload} />
        </Card>
      </PageContainer>
    );
  }
  if (!today || !lookups.data || (copyId && !copy.data)) {
    return (
      <PageContainer>
        <PageHead title="New Sales Quotation" />
        <LoadingState />
      </PageContainer>
    );
  }
  return <QuotationEditor today={today} lookups={lookups.data} detail={null} copyFrom={copy.data} />;
}

// ─── Form state ──────────────────────────────────────────────────────────────

interface LineValues {
  key: string;
  itemId: string;
  description: string;
  qty: string;
  rate: string;
  discountPercent: string;
}

interface FormValues {
  officeId: string;
  customerId: string;
  salesPersonId: string;
  quotationDate: string;
  validTill: string;
  contactMobile: string;
  remarks: string;
  terms: string;
  discountAmount: string;
  vatPercent: string;
  lines: LineValues[];
}

const newKey = () => crypto.randomUUID();
const emptyLine = (): LineValues => ({ key: newKey(), itemId: "", description: "", qty: "1", rate: "", discountPercent: "0" });

function fromDetail(detail: QuotationDetail, dates?: { quotationDate: string; validTill: string }): FormValues {
  return {
    officeId: detail.officeId,
    customerId: detail.customerId,
    salesPersonId: detail.salesPersonId ?? "",
    quotationDate: dates?.quotationDate ?? detail.quotationDate,
    validTill: dates?.validTill ?? detail.validTill,
    contactMobile: detail.contactMobile ?? "",
    remarks: detail.remarks ?? "",
    terms: detail.terms ?? "",
    discountAmount: String(detail.discountAmount),
    vatPercent: String(detail.vatPercent),
    lines: detail.lines.map((line) => ({
      key: line.id,
      itemId: line.itemId,
      description: line.description ?? "",
      qty: String(line.qty),
      rate: String(line.rate),
      discountPercent: String(line.discountPercent),
    })),
  };
}

/** Empty strings become NaN for required numbers so validation reports them. */
const toNumber = (value: string) => (value.trim() === "" ? Number.NaN : Number(value));
const orZero = (value: number) => (Number.isFinite(value) ? value : 0);

function toInput(values: FormValues): QuotationInput {
  return {
    officeId: values.officeId,
    customerId: values.customerId,
    salesPersonId: values.salesPersonId || null,
    quotationDate: values.quotationDate,
    validTill: values.validTill,
    contactMobile: values.contactMobile,
    remarks: values.remarks,
    terms: values.terms,
    discountAmount: values.discountAmount.trim() === "" ? 0 : Number(values.discountAmount),
    vatPercent: values.vatPercent.trim() === "" ? 0 : Number(values.vatPercent),
    lines: values.lines.map((line) => ({
      itemId: line.itemId,
      description: line.description,
      qty: toNumber(line.qty),
      rate: toNumber(line.rate),
      discountPercent: line.discountPercent.trim() === "" ? 0 : Number(line.discountPercent),
    })),
  };
}

/** Form state without the React row keys, for "Not Saved" detection. */
const withoutKeys = (values: FormValues) => JSON.stringify(values, (name, value) => (name === "key" ? undefined : value));

// ─── Editor ──────────────────────────────────────────────────────────────────

interface EditorProps {
  today: string;
  lookups: SalesLookups;
  detail: QuotationDetail | null;
  copyFrom?: QuotationDetail;
  onSaved?: (detail: QuotationDetail) => void;
  onReload?: () => void;
}

type Tab = "details" | "terms";
type Dialogs = "customer" | "item" | "salesPerson" | "delete" | "cancel" | "lost" | null;

function QuotationEditor({ today, lookups, detail, copyFrom, onSaved, onReload }: EditorProps) {
  const router = useRouter();
  const toast = useToast();

  const initial = useMemo<FormValues>(() => {
    if (detail) return fromDetail(detail);
    if (copyFrom) {
      const copied = fromDetail(copyFrom, { quotationDate: today, validTill: addDays(today, DEFAULT_VALIDITY_DAYS) });
      return { ...copied, lines: copied.lines.map((line) => ({ ...line, key: newKey() })) };
    }
    const office = lookups.offices[0];
    return {
      officeId: office?.id ?? "",
      customerId: "",
      salesPersonId: "",
      quotationDate: today,
      validTill: addDays(today, DEFAULT_VALIDITY_DAYS),
      contactMobile: "",
      remarks: "",
      terms: office ? (lookups.quotationTerms[office.businessUnitId] ?? "") : "",
      discountAmount: "0",
      vatPercent: "0",
      lines: [emptyLine()],
    };
  }, [detail, copyFrom, lookups, today]);

  const [values, setValues] = useState<FormValues>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [tab, setTab] = useState<Tab>("details");
  const [dialog, setDialog] = useState<Dialogs>(null);
  const [itemLineKey, setItemLineKey] = useState<string | null>(null);
  const [lostReason, setLostReason] = useState("");
  const [busy, setBusy] = useState(false);
  const initialJson = useMemo(() => withoutKeys(initial), [initial]);

  const isNew = detail === null;
  const editable = isNew || detail.status === "DRAFT";
  const dirty = isNew || withoutKeys(values) !== initialJson;
  const office = lookups.offices.find((candidate) => candidate.id === values.officeId);
  const businessUnitId = office?.businessUnitId ?? null;

  const masters = useResource(businessUnitId && `masters:${businessUnitId}`, async () => {
    const [customers, items, salesPersons] = await Promise.all([
      fetchCustomers(businessUnitId!),
      fetchItems(businessUnitId!),
      fetchSalesPersons(businessUnitId!),
    ]);
    return { customers, items, salesPersons };
  });
  const customers = masters.data?.customers ?? [];
  const items = masters.data?.items ?? [];
  const salesPersons = masters.data?.salesPersons ?? [];

  const totals = quotationTotals(
    values.lines.map((line) => ({
      qty: orZero(Number(line.qty)),
      rate: orZero(Number(line.rate)),
      discountPercent: orZero(Number(line.discountPercent)),
    })),
    orZero(Number(values.discountAmount)),
    orZero(Number(values.vatPercent)),
  );

  // ── Field updates ──

  const set = <K extends keyof FormValues>(key: K, value: FormValues[K]) => setValues((current) => ({ ...current, [key]: value }));
  const setLine = (key: string, patch: Partial<LineValues>) =>
    setValues((current) => ({
      ...current,
      lines: current.lines.map((line) => (line.key === key ? { ...line, ...patch } : line)),
    }));

  function changeOffice(officeId: string) {
    const next = lookups.offices.find((candidate) => candidate.id === officeId);
    setValues((current) => {
      if (!next || next.businessUnitId === businessUnitId) return { ...current, officeId };
      // Customers, sales persons and items belong to a business unit: start over.
      return {
        ...current,
        officeId,
        customerId: "",
        salesPersonId: "",
        contactMobile: "",
        terms: current.terms || (lookups.quotationTerms[next.businessUnitId] ?? ""),
        lines: [emptyLine()],
      };
    });
  }

  function selectCustomer(customer: CustomerOption | undefined) {
    setValues((current) => {
      const previous = customers.find((candidate) => candidate.id === current.customerId);
      const mobileWasDefault = !current.contactMobile || current.contactMobile === previous?.phone;
      return {
        ...current,
        customerId: customer?.id ?? "",
        contactMobile: mobileWasDefault ? (customer?.phone ?? "") : current.contactMobile,
        salesPersonId: current.salesPersonId || customer?.salesPersonId || "",
      };
    });
  }

  function selectItem(key: string, item: ItemOption | undefined) {
    setLine(key, { itemId: item?.id ?? "", ...(item ? { rate: String(item.salesRate) } : {}) });
  }

  function addCreated<K extends "customers" | "items" | "salesPersons">(
    key: K,
    record: K extends "customers" ? CustomerOption : K extends "items" ? ItemOption : SalesPersonOption,
  ) {
    masters.mutate((data) => {
      const current = data ?? { customers: [], items: [], salesPersons: [] };
      const list = [...current[key], record] as { name: string }[];
      return { ...current, [key]: list.sort((a, b) => a.name.localeCompare(b.name)) };
    });
  }

  // ── Save & actions ──

  async function save() {
    if (!editable || busy) return;
    const input = toInput(values);
    const parsed = quotationInputSchema.safeParse(input);
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const path = issue.path.join(".");
        next[path] ??= issue.message;
      }
      setErrors(next);
      setTab(next.terms || next.remarks ? "terms" : "details");
      toast.error("Please correct the highlighted fields.");
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      if (isNew) {
        const created = await createQuotation(input);
        toast.success(`${created.number} saved as draft.`);
        router.replace(paths.quotation(created.id));
      } else {
        const updated = await updateQuotation(detail.id, detail.updatedAt, input);
        toast.success(`${updated.number} saved.`);
        onSaved?.(updated);
      }
    } catch (error) {
      toast.error(errorMessage(error));
      setBusy(false);
    }
  }

  async function act(action: QuotationAction, reason?: string) {
    if (!detail) return;
    setBusy(true);
    try {
      const updated = await changeQuotationStatus(detail.id, action, detail.updatedAt, reason);
      const verbs: Record<QuotationAction, string> = {
        submit: "submitted",
        cancel: "cancelled",
        lost: "marked as lost",
        reopen: "reopened",
      };
      toast.success(`${updated.number} ${verbs[action]}.`);
      setDialog(null);
      onSaved?.(updated);
    } catch (error) {
      toast.error(errorMessage(error));
      setBusy(false);
    }
  }

  async function remove() {
    if (!detail) return;
    setBusy(true);
    try {
      await deleteQuotation(detail.id);
      toast.success(`${detail.number} deleted.`);
      router.replace(paths.quotations);
    } catch (error) {
      toast.error(errorMessage(error));
      setBusy(false);
      setDialog(null);
    }
  }

  useSaveShortcut(save, editable && dirty);

  // ── Head ──

  const status = detail ? displayStatus(detail.status, detail.validTill, today) : null;
  const menu: MenuItem[] = [
    ...(onReload ? [{ label: "Reload", icon: <RefreshCw />, onSelect: onReload }] : []),
    ...(detail ? [{ label: "Duplicate", icon: <Copy />, href: `${paths.newQuotation}?copy=${detail.id}` }] : []),
    ...(detail?.status === "SUBMITTED"
      ? [
          { label: "Create Sales Order", icon: <ShoppingCart />, href: `${paths.newOrder}?quotation=${detail.id}` },
          { label: "Mark as Lost", icon: <ThumbsDown />, onSelect: () => setDialog("lost") },
        ]
      : []),
    ...(detail?.status === "LOST" ? [{ label: "Reopen", icon: <RotateCcw />, onSelect: () => act("reopen") }] : []),
    ...(detail && (detail.status === "SUBMITTED" || detail.status === "LOST")
      ? (["separator", { label: "Cancel Quotation", icon: <Ban />, danger: true, onSelect: () => setDialog("cancel") }] as MenuItem[])
      : []),
    ...(detail?.status === "DRAFT"
      ? (["separator", { label: "Delete", icon: <Trash2 />, danger: true, onSelect: () => setDialog("delete") }] as MenuItem[])
      : []),
  ];

  const primary = !editable ? null : dirty ? (
    <Button variant="primary" onClick={save} loading={busy}>
      Save
    </Button>
  ) : (
    <Button variant="primary" onClick={() => act("submit")} loading={busy}>
      <Send aria-hidden="true" />
      Submit
    </Button>
  );

  const err = (path: string) => errors[path];
  const customerName = customers.find((customer) => customer.id === values.customerId)?.name;

  return (
    <PageContainer>
      <PageHead
        title={detail?.number ?? "New Sales Quotation"}
        indicator={dirty && editable ? <Indicator color="orange">Not Saved</Indicator> : status && <QuotationStatusIndicator status={status} />}
        subtitle={detail ? `${detail.customerName} · ${detail.officeName}` : customerName}
        actions={
          <>
            {menu.length > 0 && (
              <DropdownMenu trigger={<Ellipsis />} triggerLabel="More actions" triggerClassName={buttonClasses("secondary", "icon")} items={menu} />
            )}
            {primary}
          </>
        }
      />

      {detail?.status === "LOST" && detail.lostReason && (
        <p role="note" className="mb-3 rounded bg-control px-3 py-2 text-sm text-ink-muted">
          Lost reason: {detail.lostReason}
        </p>
      )}

      <Card>
        <Tabs<Tab>
          label="Quotation sections"
          tabs={[
            { id: "details", label: "Details" },
            { id: "terms", label: "Terms & Remarks" },
          ]}
          value={tab}
          onChange={setTab}
        >
          {tab === "details" ? (
            <>
              <Section id="customer" title="Customer">
                <FieldGrid>
                  <SelectField
                    label="Office"
                    required
                    value={values.officeId}
                    disabled={!editable}
                    error={err("officeId")}
                    options={[
                      { value: "", label: "Select office" },
                      ...lookups.offices
                        // An existing quotation keeps its business unit (its number belongs to it).
                        .filter((candidate) => isNew || candidate.businessUnitId === detail.businessUnitId)
                        .map((candidate) => ({
                          value: candidate.id,
                          label:
                            new Set(lookups.offices.map((o) => o.businessUnitId)).size > 1
                              ? `${candidate.name} (${candidate.businessUnitName})`
                              : candidate.name,
                        })),
                    ]}
                    onChange={(event) => changeOffice(event.target.value)}
                  />
                  <div className="flex items-end gap-2">
                    <SelectField
                      label="Customer"
                      required
                      className="flex-1"
                      value={values.customerId}
                      disabled={!editable || !businessUnitId || masters.loading}
                      error={err("customerId")}
                      options={[
                        { value: "", label: masters.loading ? "Loading…" : "Select customer" },
                        // Keep the stored customer visible even if it was disabled later.
                        ...(detail && !customers.some((customer) => customer.id === detail.customerId)
                          ? [{ value: detail.customerId, label: detail.customerName }]
                          : []),
                        ...customers.map((customer) => ({
                          value: customer.id,
                          label: `${customer.name} (${customer.code})`,
                        })),
                      ]}
                      onChange={(event) => selectCustomer(customers.find((customer) => customer.id === event.target.value))}
                    />
                    {editable && (
                      <Button
                        size="icon"
                        aria-label="New customer"
                        title="New customer"
                        className={cn(err("customerId") && "mb-5")}
                        disabled={!businessUnitId}
                        onClick={() => setDialog("customer")}
                      >
                        <Plus />
                      </Button>
                    )}
                  </div>
                  <TextField
                    label="Mobile No."
                    type="tel"
                    value={values.contactMobile}
                    disabled={!editable}
                    error={err("contactMobile")}
                    onChange={(event) => set("contactMobile", event.target.value)}
                  />
                  <div className="flex items-end gap-2">
                    <SelectField
                      label="Sales Person"
                      className="flex-1"
                      value={values.salesPersonId}
                      disabled={!editable || !businessUnitId || masters.loading}
                      error={err("salesPersonId")}
                      options={[
                        { value: "", label: "None" },
                        ...salesPersons.map((person) => ({
                          value: person.id,
                          label: person.designation ? `${person.name} (${person.designation})` : person.name,
                        })),
                      ]}
                      onChange={(event) => set("salesPersonId", event.target.value)}
                    />
                    {editable && (
                      <Button
                        size="icon"
                        aria-label="New sales person"
                        title="New sales person"
                        disabled={!businessUnitId}
                        onClick={() => setDialog("salesPerson")}
                      >
                        <Plus />
                      </Button>
                    )}
                  </div>
                  <TextField
                    label="Quotation Date"
                    type="date"
                    required
                    value={values.quotationDate}
                    disabled={!editable}
                    error={err("quotationDate")}
                    onChange={(event) => set("quotationDate", event.target.value)}
                  />
                  <TextField
                    label="Valid Till Date"
                    type="date"
                    required
                    min={values.quotationDate}
                    value={values.validTill}
                    disabled={!editable}
                    error={err("validTill")}
                    onChange={(event) => set("validTill", event.target.value)}
                  />
                </FieldGrid>
              </Section>

              <Section
                id="items"
                title="Items"
                actions={
                  editable && (
                    <Button
                      size="sm"
                      disabled={!businessUnitId}
                      onClick={() => {
                        setItemLineKey(null);
                        setDialog("item");
                      }}
                    >
                      <Plus aria-hidden="true" />
                      New Item
                    </Button>
                  )
                }
              >
                <ItemsGrid
                  lines={values.lines}
                  items={items}
                  storedLines={detail?.lines ?? []}
                  amounts={totals.lineAmounts}
                  editable={editable}
                  loading={masters.loading}
                  errors={errors}
                  onChange={setLine}
                  onSelectItem={selectItem}
                  onRemove={(key) => set("lines", values.lines.filter((line) => line.key !== key))}
                  onAdd={() => set("lines", [...values.lines, emptyLine()])}
                />
                {err("lines") && (
                  <p role="alert" className="text-xs text-danger">
                    {err("lines")}
                  </p>
                )}
              </Section>

              <Section id="totals" title="Totals">
                <FieldGrid>
                  <div className="flex flex-col gap-4">
                    <TextField
                      label="Discount Amount"
                      type="number"
                      inputMode="decimal"
                      step="any"
                      min={0}
                      value={values.discountAmount}
                      disabled={!editable}
                      error={err("discountAmount")}
                      onChange={(event) => set("discountAmount", event.target.value)}
                    />
                    <TextField
                      label="VAT %"
                      type="number"
                      inputMode="decimal"
                      step="any"
                      min={0}
                      max={100}
                      value={values.vatPercent}
                      disabled={!editable}
                      error={err("vatPercent")}
                      onChange={(event) => set("vatPercent", event.target.value)}
                    />
                  </div>
                  <dl className="flex flex-col gap-1.5 rounded bg-canvas p-3 text-sm">
                    <TotalRow label="Total Qty" value={totals.totalQty.toLocaleString("en-US")} />
                    <TotalRow label="Subtotal" value={formatAmount(totals.subTotal)} />
                    <TotalRow label="Discount" value={`− ${formatAmount(totals.discountAmount)}`} />
                    <TotalRow label={`VAT (${orZero(Number(values.vatPercent))}%)`} value={formatAmount(totals.vatAmount)} />
                    <div className="mt-1 border-t border-line pt-2">
                      <TotalRow label="Grand Total" value={formatAmount(totals.grandTotal)} strong />
                    </div>
                  </dl>
                </FieldGrid>
              </Section>
            </>
          ) : (
            <Section id="terms-section">
              <TextAreaField
                label="Terms and Conditions"
                rows={8}
                value={values.terms}
                disabled={!editable}
                error={err("terms")}
                hint={editable && businessUnitId && lookups.quotationTerms[businessUnitId] ? undefined : "Default terms come from Configuration › Business Units."}
                onChange={(event) => set("terms", event.target.value)}
              />
              <TextAreaField
                label="Remarks"
                rows={3}
                value={values.remarks}
                disabled={!editable}
                error={err("remarks")}
                onChange={(event) => set("remarks", event.target.value)}
              />
            </Section>
          )}
        </Tabs>
      </Card>
      {detail && <RecordMeta updatedAt={detail.updatedAt} />}

      {businessUnitId && (
        <>
          <CustomerQuickEntry
            open={dialog === "customer"}
            businessUnitId={businessUnitId}
            salesPersonId={values.salesPersonId || null}
            onClose={() => setDialog(null)}
            onCreated={(customer) => {
              addCreated("customers", customer);
              setDialog(null);
              setValues((current) => ({
                ...current,
                customerId: customer.id,
                contactMobile: customer.phone ?? current.contactMobile,
              }));
            }}
          />
          <ItemQuickEntry
            open={dialog === "item"}
            businessUnitId={businessUnitId}
            onClose={() => setDialog(null)}
            onCreated={(item) => {
              addCreated("items", item);
              setDialog(null);
              // Fill the row that asked for it, else the first empty row, else a new row.
              setValues((current) => {
                const target =
                  current.lines.find((line) => line.key === itemLineKey) ?? current.lines.find((line) => !line.itemId);
                const filled = { itemId: item.id, rate: String(item.salesRate) };
                return {
                  ...current,
                  lines: target
                    ? current.lines.map((line) => (line.key === target.key ? { ...line, ...filled } : line))
                    : [...current.lines, { ...emptyLine(), ...filled }],
                };
              });
            }}
          />
          <SalesPersonQuickEntry
            open={dialog === "salesPerson"}
            businessUnitId={businessUnitId}
            onClose={() => setDialog(null)}
            onCreated={(person) => {
              addCreated("salesPersons", person);
              setDialog(null);
              set("salesPersonId", person.id);
            }}
          />
        </>
      )}

      <ConfirmDialog
        open={dialog === "delete"}
        title={`Delete ${detail?.number ?? "quotation"}?`}
        message="This draft will be removed permanently."
        busy={busy}
        onConfirm={remove}
        onClose={() => setDialog(null)}
      />
      <ConfirmDialog
        open={dialog === "cancel"}
        title={`Cancel ${detail?.number ?? "quotation"}?`}
        message="A cancelled quotation cannot be reopened. Use Duplicate to start a new one from it."
        confirmLabel="Cancel Quotation"
        busy={busy}
        onConfirm={() => act("cancel")}
        onClose={() => setDialog(null)}
      />
      <Dialog
        open={dialog === "lost"}
        title="Mark as Lost"
        onClose={busy ? () => undefined : () => setDialog(null)}
        onSubmit={() => act("lost", lostReason)}
        footer={
          <>
            <Button onClick={() => setDialog(null)} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={busy} disabled={!lostReason.trim()}>
              Mark as Lost
            </Button>
          </>
        }
      >
        <TextAreaField
          label="Reason"
          required
          rows={3}
          value={lostReason}
          placeholder="Price too high, bought from a competitor …"
          onChange={(event) => setLostReason(event.target.value)}
        />
      </Dialog>
    </PageContainer>
  );
}

function TotalRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className={strong ? "font-semibold text-ink" : "text-ink-muted"}>{label}</dt>
      <dd className={cn("tabular-nums", strong ? "text-base font-semibold text-ink" : "text-ink")}>{value}</dd>
    </div>
  );
}

// ─── Items grid ──────────────────────────────────────────────────────────────

interface ItemsGridProps {
  lines: LineValues[];
  items: ItemOption[];
  storedLines: QuotationDetail["lines"];
  amounts: number[];
  editable: boolean;
  loading: boolean;
  errors: Record<string, string>;
  onChange: (key: string, patch: Partial<LineValues>) => void;
  onSelectItem: (key: string, item: ItemOption | undefined) => void;
  onRemove: (key: string) => void;
  onAdd: () => void;
}

const CELL_INPUT = cn(CONTROL, "h-7 min-w-0");
const NUM_INPUT = cn(CELL_INPUT, "text-right tabular-nums");

function ItemsGrid({ lines, items, storedLines, amounts, editable, loading, errors, onChange, onSelectItem, onRemove, onAdd }: ItemsGridProps) {
  const itemById = new Map(items.map((item) => [item.id, item]));
  const storedById = new Map(storedLines.map((line) => [line.itemId, line]));

  return (
    <div className="flex flex-col gap-2">
      <div className="overflow-x-auto rounded border border-line">
        <table className="data-grid w-full min-w-[760px]">
          <thead className="bg-canvas text-xs text-ink-muted">
            <tr className="border-b border-line">
              <th scope="col" className="w-10 px-2 py-2 text-left font-medium">No.</th>
              <th scope="col" className="px-2 py-2 text-left font-medium">Item *</th>
              <th scope="col" className="px-2 py-2 text-left font-medium">Description</th>
              <th scope="col" className="w-16 px-2 py-2 text-left font-medium">Unit</th>
              <th scope="col" className="w-24 px-2 py-2 text-right font-medium">Qty *</th>
              <th scope="col" className="w-28 px-2 py-2 text-right font-medium">Rate *</th>
              <th scope="col" className="w-20 px-2 py-2 text-right font-medium">Disc %</th>
              <th scope="col" className="w-32 px-2 py-2 text-right font-medium">Amount</th>
              {editable && <th scope="col" className="w-10 px-2 py-2"><span className="sr-only">Remove</span></th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {lines.map((line, index) => {
              const item = itemById.get(line.itemId);
              const stored = storedById.get(line.itemId);
              const rowError = (field: string) => errors[`lines.${index}.${field}`];
              const invalid = (field: string) => (rowError(field) ? "ring-1 ring-danger" : undefined);
              const messages = ["itemId", "qty", "rate", "discountPercent", "description"].map(rowError).filter(Boolean);
              return (
                <tr key={line.key} className="align-top">
                  <td className="px-2 py-1.5 text-ink-faint tabular-nums">{index + 1}</td>
                  <td className="px-2 py-1.5">
                    <select
                      aria-label={`Item, row ${index + 1}`}
                      value={line.itemId}
                      disabled={!editable || loading}
                      onChange={(event) => onSelectItem(line.key, itemById.get(event.target.value))}
                      className={cn(CELL_INPUT, "w-full", invalid("itemId"))}
                    >
                      <option value="">{loading ? "Loading…" : "Select item"}</option>
                      {stored && !item && <option value={stored.itemId}>{stored.itemName}</option>}
                      {items.map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.name} ({option.code})
                        </option>
                      ))}
                    </select>
                    {messages.length > 0 && (
                      <p role="alert" className="mt-1 text-xs text-danger">
                        {messages[0]}
                      </p>
                    )}
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      aria-label={`Description, row ${index + 1}`}
                      value={line.description}
                      disabled={!editable}
                      maxLength={500}
                      onChange={(event) => onChange(line.key, { description: event.target.value })}
                      className={cn(CELL_INPUT, "w-full")}
                    />
                  </td>
                  <td className="px-2 py-1.5 pt-2.5 text-ink-muted">{item?.uom ?? stored?.uom ?? "—"}</td>
                  <td className="px-2 py-1.5">
                    <input
                      aria-label={`Qty, row ${index + 1}`}
                      type="number"
                      inputMode="decimal"
                      step="any"
                      min={0}
                      value={line.qty}
                      disabled={!editable}
                      onChange={(event) => onChange(line.key, { qty: event.target.value })}
                      className={cn(NUM_INPUT, "w-full", invalid("qty"))}
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      aria-label={`Rate, row ${index + 1}`}
                      type="number"
                      inputMode="decimal"
                      step="any"
                      min={0}
                      value={line.rate}
                      disabled={!editable}
                      onChange={(event) => onChange(line.key, { rate: event.target.value })}
                      className={cn(NUM_INPUT, "w-full", invalid("rate"))}
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      aria-label={`Discount percent, row ${index + 1}`}
                      type="number"
                      inputMode="decimal"
                      step="any"
                      min={0}
                      max={100}
                      value={line.discountPercent}
                      disabled={!editable}
                      onChange={(event) => onChange(line.key, { discountPercent: event.target.value })}
                      className={cn(NUM_INPUT, "w-full", invalid("discountPercent"))}
                    />
                  </td>
                  <td className="px-2 py-1.5 pt-2.5 text-right text-ink tabular-nums">{formatAmount(amounts[index] ?? 0)}</td>
                  {editable && (
                    <td className="px-2 py-1.5">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Remove row ${index + 1}`}
                        disabled={lines.length === 1}
                        onClick={() => onRemove(line.key)}
                      >
                        <X />
                      </Button>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {editable && (
        <div>
          <Button size="sm" onClick={onAdd}>
            <Plus aria-hidden="true" />
            Add Row
          </Button>
        </div>
      )}
      {!editable && lines.length === 0 && <ReadOnlyField label="Items" value="No items" />}
    </div>
  );
}
