"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState, type ReactNode } from "react";
import { PageContainer, PageHead } from "@/components/layout/page";
import { Button, buttonClasses } from "@/components/ui/button";
import { CONTROL, Checkbox, SelectField, TextField } from "@/components/ui/form-field";
import { Card, EmptyState, ErrorState, LoadingState, Section } from "@/components/ui/section";
import { useToast } from "@/components/ui/toast";
import { useResource } from "@/hooks/use-resource";
import { useSaveShortcut } from "@/hooks/use-save-shortcut";
import { errorMessage } from "@/lib/api/client";
import { cn } from "@/lib/cn";
import { formatAmount } from "../../dashboard/lib/format";
import { issuesToErrors, requiredNumber } from "../../lib/form";
import { formatDay, useToday } from "../../lib/use-today";
import type { SalesLookups } from "../../masters/schemas/masters.schema";
import { fetchCustomers, fetchSalesLookups, fetchSetupLookups } from "../../masters/services/masters.api";
import { paths } from "../../paths";
import { round2 } from "../../quotations/lib/totals";
import { COLLECTION_METHODS, COLLECTION_METHOD_LABELS, billInputSchema, collectionInputSchema, type CollectionMethod, type DueInvoice } from "../schemas/collection.schema";
import { createBill, createCollection, fetchBill, fetchDueInvoices } from "../services/collection.api";

type Mode = "invoice" | "advance" | "bill";
const TITLES: Record<Mode, string> = { invoice: "Collection By Invoice", advance: "Advance Collection", bill: "Create Bill" };

const toNumber = (value: string) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

/** /sales/collections/new[?customer=&bill=], /sales/collections/advance, /sales/collections/bills/new[?customer=] */
export function CollectionFormView({ mode }: { mode: Mode }) {
  const today = useToday();
  const params = useSearchParams();
  const lookups = useResource("sales-lookups", fetchSalesLookups);
  const billId = mode === "invoice" ? params.get("bill") : null;
  const bill = useResource(billId && today ? `bill:${billId}` : null, () => fetchBill(billId!, today!));
  const error = lookups.error ?? bill.error;
  if (error) {
    return (
      <PageContainer>
        <PageHead title={TITLES[mode]} />
        <Card>
          <ErrorState message={errorMessage(error)} onRetry={lookups.reload} />
        </Card>
      </PageContainer>
    );
  }
  if (!today || !lookups.data || (billId && !bill.data)) {
    return (
      <PageContainer>
        <PageHead title={TITLES[mode]} />
        <LoadingState />
      </PageContainer>
    );
  }
  return (
    <Editor
      mode={mode}
      today={today}
      lookups={lookups.data}
      initialCustomerId={bill.data?.customerId ?? params.get("customer") ?? ""}
      initialOfficeId={bill.data?.officeId}
      billInvoices={bill.data?.lines.map((line) => line.deliveryId) ?? null}
      billNumber={bill.data?.number ?? null}
    />
  );
}

function Editor({
  mode,
  today,
  lookups,
  initialCustomerId,
  initialOfficeId,
  billInvoices,
  billNumber,
}: {
  mode: Mode;
  today: string;
  lookups: SalesLookups;
  initialCustomerId: string;
  initialOfficeId?: string;
  billInvoices: string[] | null;
  billNumber: string | null;
}) {
  const router = useRouter();
  const toast = useToast();
  const [officeId, setOfficeId] = useState(initialOfficeId ?? lookups.offices[0]?.id ?? "");
  const [customerId, setCustomerId] = useState(initialCustomerId);
  const [values, setValues] = useState({ date: today, method: "CASH" as CollectionMethod, reference: "", bankName: "", salesPersonId: "", remarks: "", amount: "" });
  const [picked, setPicked] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof typeof values>(key: K, value: (typeof values)[K]) => setValues((current) => ({ ...current, [key]: value }));

  const office = lookups.offices.find((candidate) => candidate.id === officeId);
  const businessUnitId = office?.businessUnitId ?? null;
  const masters = useResource(businessUnitId && `collection-masters:${businessUnitId}`, async () => {
    const [setup, customers] = await Promise.all([fetchSetupLookups(businessUnitId!), fetchCustomers(businessUnitId!, true)]);
    return { setup, customers };
  });
  const customers = useMemo(() => masters.data?.customers ?? [], [masters.data]);
  const customer = customers.find((candidate) => candidate.id === customerId);
  const invoices = useResource(mode !== "advance" && customerId ? `customer-dues:${customerId}:${mode}` : null, () =>
    fetchDueInvoices({ customerId, asOf: today, ...(mode === "bill" ? { notSubmitted: "true" } : {}) }),
  );

  // Invoices of a bill being collected start ticked with their full due.
  const [seeded, setSeeded] = useState(false);
  if (!seeded && invoices.data && billInvoices) {
    setSeeded(true);
    const fromBill = invoices.data.filter((row) => billInvoices.includes(row.deliveryId));
    setPicked(Object.fromEntries(fromBill.map((row) => [row.deliveryId, String(row.due)])));
    setValues((current) => ({ ...current, amount: String(round2(fromBill.reduce((sum, row) => sum + row.due, 0))) }));
  }

  const rows = invoices.data ?? [];
  const pickedTotal = round2(Object.entries(picked).reduce((sum, [, value]) => sum + toNumber(value), 0));

  function selectCustomer(next: string) {
    setCustomerId(next);
    setPicked({});
    const match = customers.find((candidate) => candidate.id === next);
    if (match?.salesPersonId) set("salesPersonId", match.salesPersonId);
  }

  /** Spreads the received amount over the oldest invoices first. */
  function autoAllocate(amountText: string) {
    set("amount", amountText);
    let left = toNumber(amountText);
    const next: Record<string, string> = {};
    for (const row of rows) {
      if (left <= 0) break;
      const take = round2(Math.min(row.due, left));
      next[row.deliveryId] = String(take);
      left = round2(left - take);
    }
    setPicked(next);
  }

  /** Picked invoices changed by hand: the received amount follows their total. */
  function updatePicked(next: Record<string, string>) {
    setPicked(next);
    if (mode === "invoice") set("amount", String(round2(Object.values(next).reduce((sum, value) => sum + toNumber(value), 0))));
  }

  function toggle(row: DueInvoice, checked: boolean) {
    const next = { ...picked };
    if (checked) next[row.deliveryId] = String(row.due);
    else delete next[row.deliveryId];
    updatePicked(next);
  }

  async function save() {
    if (busy) return;
    let saved: { id: string; number: string };
    try {
      if (mode === "bill") {
        const input = { officeId, customerId, billDate: values.date, remarks: values.remarks, deliveryIds: Object.keys(picked) };
        const parsed = billInputSchema.safeParse(input);
        if (!parsed.success) return fail(issuesToErrors(parsed.error));
        setBusy(true);
        saved = await createBill(input, today);
        toast.success(`Bill ${saved.number} created.`);
        router.replace(paths.bill(saved.id));
        return;
      }
      const common = {
        officeId,
        customerId,
        collectionDate: values.date,
        method: values.method,
        reference: values.reference,
        bankName: values.bankName,
        salesPersonId: values.salesPersonId || null,
        remarks: values.remarks,
      };
      const input =
        mode === "advance"
          ? { kind: "ADVANCE" as const, ...common, amount: requiredNumber(values.amount) }
          : {
              kind: "INVOICE" as const,
              ...common,
              amount: pickedTotal,
              allocations: Object.entries(picked)
                .filter(([, value]) => value.trim() !== "")
                .map(([deliveryId, value]) => ({ deliveryId, amount: requiredNumber(value) })),
            };
      const over = mode === "invoice" ? rows.find((row) => toNumber(picked[row.deliveryId] ?? "0") > row.due + 1e-9) : undefined;
      if (over) return fail({ [`invoice.${over.deliveryId}`]: `At most ${formatAmount(over.due)}.` });
      const parsed = collectionInputSchema.safeParse(input);
      if (!parsed.success) return fail(issuesToErrors(parsed.error));
      setBusy(true);
      saved = await createCollection(input);
      toast.success(`Money receipt ${saved.number} saved.`);
      router.replace(paths.collection(saved.id));
    } catch (error) {
      toast.error(errorMessage(error));
      setBusy(false);
    }
  }

  function fail(next: Record<string, string>) {
    setErrors(next);
    toast.error(Object.values(next)[0] ?? "Please correct the highlighted fields.");
  }

  useSaveShortcut(save, true);

  const persons = masters.data?.setup.salesPersons ?? [];
  const showBank = values.method === "BANK" || values.method === "CHEQUE";

  return (
    <PageContainer className="max-w-none">
      <PageHead
        title={
          <span className="flex items-center gap-2">
            <Link href={paths.collectionTab(mode === "advance" ? "advance" : mode === "bill" ? "bills" : "due")} aria-label="Back" className={buttonClasses("ghost", "icon")}>
              <ArrowLeft />
            </Link>
            {TITLES[mode]}
          </span>
        }
        subtitle={billNumber ? `Collecting bill ${billNumber}` : mode === "advance" ? "Money taken before invoicing; adjust it against invoices later." : undefined}
        actions={
          <Button variant="primary" onClick={save} loading={busy}>
            Save
          </Button>
        }
      />

      <div className="flex flex-col gap-4">
        <Card>
          <Section>
            <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
              <SelectField
                label="Office"
                required
                value={officeId}
                error={errors.officeId}
                options={lookups.offices.map((candidate) => ({ value: candidate.id, label: candidate.name }))}
                onChange={(event) => {
                  setOfficeId(event.target.value);
                  setCustomerId("");
                  setPicked({});
                }}
              />
              <SelectField
                label="Customer"
                required
                className="lg:col-span-2"
                value={customerId}
                error={errors.customerId}
                disabled={!businessUnitId || masters.loading}
                options={[
                  { value: "", label: masters.loading ? "Loading…" : "Select customer" },
                  ...customers.map((candidate) => ({ value: candidate.id, label: `${candidate.code} - ${candidate.name}${candidate.phone ? ` (${candidate.phone})` : ""}` })),
                ]}
                onChange={(event) => selectCustomer(event.target.value)}
              />
              <TextField
                label={mode === "bill" ? "Bill Date" : "Collection Date"}
                type="date"
                required
                value={values.date}
                error={errors.collectionDate ?? errors.billDate}
                onChange={(event) => set("date", event.target.value)}
              />
              {mode !== "bill" && (
                <>
                  <SelectField
                    label="Payment Method"
                    required
                    value={values.method}
                    options={COLLECTION_METHODS.map((method) => ({ value: method, label: COLLECTION_METHOD_LABELS[method] }))}
                    onChange={(event) => set("method", event.target.value as CollectionMethod)}
                  />
                  <TextField
                    label={values.method === "CHEQUE" ? "Cheque No" : values.method === "CASH" ? "Money Receipt No" : "Transaction No"}
                    value={values.reference}
                    error={errors.reference}
                    onChange={(event) => set("reference", event.target.value)}
                  />
                  {showBank && <TextField label="Bank Name" value={values.bankName} error={errors.bankName} onChange={(event) => set("bankName", event.target.value)} />}
                  <SelectField
                    label="Collect By"
                    value={values.salesPersonId}
                    options={[{ value: "", label: "None" }, ...persons.map((person) => ({ value: person.id, label: person.name }))]}
                    onChange={(event) => set("salesPersonId", event.target.value)}
                  />
                </>
              )}
              {mode !== "bill" && (
                <TextField
                  label={mode === "advance" ? "Amount" : "Received Amount"}
                  type="number"
                  min={0}
                  step="any"
                  required={mode === "advance"}
                  hint={mode === "invoice" ? "Spreads over the oldest invoices first." : undefined}
                  value={values.amount}
                  error={errors.amount}
                  disabled={mode === "invoice" && rows.length === 0}
                  onChange={(event) => (mode === "invoice" ? autoAllocate(event.target.value) : set("amount", event.target.value))}
                />
              )}
              <TextField label="Remarks" className="lg:col-span-2" value={values.remarks} error={errors.remarks} onChange={(event) => set("remarks", event.target.value)} />
            </div>
            {customer && (
              <p className="text-xs text-ink-muted">
                {customer.address ?? "No address"} · Credit {customer.creditDays} days
              </p>
            )}
          </Section>
        </Card>

        {mode !== "advance" && (
          <Card>
            <Section title={mode === "bill" ? "Invoices not on a bill" : "Due Invoices"} description={mode === "invoice" ? "Tick invoices and enter how much of each is paid." : "Tick the invoices to put on this bill."}>
              {!customerId ? (
                <EmptyState title="Select a customer" />
              ) : invoices.error ? (
                <ErrorState message={errorMessage(invoices.error)} onRetry={invoices.reload} />
              ) : !invoices.data ? (
                <LoadingState />
              ) : rows.length === 0 ? (
                <EmptyState title={mode === "bill" ? "No unbilled invoices with dues" : "Nothing is due from this customer"}>
                  {mode === "invoice" && (
                    <Link href={paths.newAdvance} className="text-ink underline underline-offset-2">
                      Take an advance instead
                    </Link>
                  )}
                </EmptyState>
              ) : (
                <InvoicePicker rows={rows} picked={picked} errors={errors} editable={mode === "invoice"} onToggle={toggle} onToggleAll={(checked) => updatePicked(checked ? Object.fromEntries(rows.map((row) => [row.deliveryId, String(row.due)])) : {})} onAmount={(id, value) => updatePicked({ ...picked, [id]: value })}>
                  <span className="tabular-nums">{formatAmount(mode === "bill" ? round2(rows.filter((row) => picked[row.deliveryId] !== undefined).reduce((sum, row) => sum + row.due, 0)) : pickedTotal)}</span>
                </InvoicePicker>
              )}
              {(errors.allocations || errors.deliveryIds) && <p className="text-xs text-danger">{errors.allocations ?? errors.deliveryIds}</p>}
            </Section>
          </Card>
        )}
      </div>
    </PageContainer>
  );
}

function InvoicePicker({
  rows,
  picked,
  errors,
  editable,
  onToggle,
  onToggleAll,
  onAmount,
  children,
}: {
  rows: DueInvoice[];
  picked: Record<string, string>;
  errors: Record<string, string>;
  editable: boolean;
  onToggle: (row: DueInvoice, checked: boolean) => void;
  onToggleAll: (checked: boolean) => void;
  onAmount: (deliveryId: string, value: string) => void;
  children: ReactNode;
}) {
  const allPicked = rows.every((row) => picked[row.deliveryId] !== undefined);
  return (
    <div className="overflow-x-auto rounded-lg border border-line">
      <table className="w-full min-w-[900px] text-sm">
        <thead className="bg-canvas text-xs text-ink-muted">
          <tr className="border-b border-line">
            <th scope="col" className="w-10 px-2 py-2">
              <Checkbox aria-label="Select all invoices" checked={allPicked} onChange={(event) => onToggleAll(event.target.checked)} />
            </th>
            {["Invoice No", "Invoice Date", "Due Date", "Overdue Days", "Invoice Amount", "Returned", "Collected", "Due", "Bill No", editable ? "Collect Amount" : ""].map((label, index) => (
              <th key={label || index} scope="col" className={cn("px-2 py-2 font-medium", index >= 3 && index !== 8 ? "text-right" : "text-left")}>
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((row) => {
            const checked = picked[row.deliveryId] !== undefined;
            const error = errors[`invoice.${row.deliveryId}`];
            return (
              <tr key={row.deliveryId} className={checked ? "bg-canvas" : undefined}>
                <td className="px-2 py-1.5">
                  <Checkbox aria-label={`Select ${row.number}`} checked={checked} onChange={(event) => onToggle(row, event.target.checked)} />
                </td>
                <td className="px-2 py-1.5 font-medium whitespace-nowrap text-ink">{row.number}</td>
                <td className="px-2 py-1.5 whitespace-nowrap">{formatDay(row.deliveryDate)}</td>
                <td className="px-2 py-1.5 whitespace-nowrap">{formatDay(row.dueDate)}</td>
                <td className={cn("px-2 py-1.5 text-right tabular-nums", row.overdueDays > 0 && "text-danger")}>{row.overdueDays}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{formatAmount(row.totalAmount)}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{formatAmount(row.returnedAmount)}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{formatAmount(row.collectedAmount)}</td>
                <td className="px-2 py-1.5 text-right font-medium text-ink tabular-nums">{formatAmount(row.due)}</td>
                <td className="px-2 py-1.5 whitespace-nowrap text-ink-muted">{row.billNumber ?? "—"}</td>
                {editable && (
                  <td className="w-36 px-2 py-1">
                    <input
                      aria-label={`Collect amount for ${row.number}`}
                      type="number"
                      min={0}
                      max={row.due}
                      step="any"
                      value={picked[row.deliveryId] ?? ""}
                      disabled={!checked}
                      onChange={(event) => onAmount(row.deliveryId, event.target.value)}
                      className={cn(CONTROL, "h-7 w-full text-right tabular-nums", error && "ring-1 ring-danger")}
                    />
                    {error && <p className="mt-0.5 text-xs text-danger">{error}</p>}
                  </td>
                )}
                {!editable && <td />}
              </tr>
            );
          })}
        </tbody>
        <tfoot className="border-t border-line-strong bg-canvas font-medium text-ink">
          <tr>
            <td colSpan={8} className="px-2 py-2 text-right">
              Total Due
            </td>
            <td className="px-2 py-2 text-right tabular-nums">{formatAmount(round2(rows.reduce((sum, row) => sum + row.due, 0)))}</td>
            <td className="px-2 py-2 text-right">{editable ? "Collecting" : "On bill"}</td>
            <td className="px-2 py-2 text-right">{children}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
