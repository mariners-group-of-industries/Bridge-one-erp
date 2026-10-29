"use client";

import { ArrowLeft, ChevronDown, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState, type ReactNode } from "react";
import { PageContainer, PageHead } from "@/components/layout/page";
import { Button, buttonClasses } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { CONTROL, Checkbox, SelectField, TextAreaField, TextField } from "@/components/ui/form-field";
import { Card, EmptyState, ErrorState, LoadingState, Section } from "@/components/ui/section";
import { useToast } from "@/components/ui/toast";
import { useResource } from "@/hooks/use-resource";
import { useSaveShortcut } from "@/hooks/use-save-shortcut";
import { errorMessage } from "@/lib/api/client";
import { cn } from "@/lib/cn";
import { SearchPick } from "../../components/SearchPick";
import { formatAmount } from "../../dashboard/lib/format";
import { issuesToErrors, requiredNumber } from "../../lib/form";
import { formatDay, useToday } from "../../lib/use-today";
import type { SalesLookups } from "../../masters/schemas/masters.schema";
import { fetchCustomers, fetchSalesLookups, fetchSetupLookups } from "../../masters/services/masters.api";
import { paths } from "../../paths";
import { round2 } from "../../quotations/lib/totals";
import {
  CASH_TYPES,
  COLLECTION_METHODS,
  COLLECTION_METHOD_LABELS,
  billInputSchema,
  deductionSchema,
  dueCollectionSchema,
  type BillDetail,
  type BillType,
  type CollectionMethod,
  type DueInvoice,
  type GlAccountOption,
} from "../schemas/collection.schema";
import { createBill, createDueCollection, fetchBill, fetchDueInvoices, fetchGlAccounts } from "../services/collection.api";
import { AdvanceCollectionForm } from "./AdvanceCollectionForm";

type Mode = "invoice" | "advance" | "bill";
const TITLES: Record<Mode, string> = { invoice: "Due Collection", advance: "Advance Collection", bill: "Bill Create" };

const toNumber = (value: string) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};
const accountLabel = (account: GlAccountOption) => `${account.code} - ${account.name}`;

/** /sales/collections/new[?customer=&bill=], /sales/collections/advance, /sales/collections/bills/new[?customer=] */
export function CollectionFormView({ mode }: { mode: Mode }) {
  const today = useToday();
  const params = useSearchParams();
  const lookups = useResource("sales-lookups", fetchSalesLookups);
  const accounts = useResource(mode === "bill" ? null : "gl-accounts", fetchGlAccounts);
  const billId = mode === "invoice" ? params.get("bill") : null;
  const bill = useResource(billId && today ? `bill:${billId}` : null, () => fetchBill(billId!, today!));
  const error = lookups.error ?? bill.error ?? accounts.error;
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
  if (!today || !lookups.data || (billId && !bill.data) || (mode !== "bill" && !accounts.data)) {
    return (
      <PageContainer>
        <PageHead title={TITLES[mode]} />
        <LoadingState />
      </PageContainer>
    );
  }
  if (mode === "advance") {
    return (
      <PageContainer className="max-w-none">
        <PageHead title={<BackTitle href={paths.collectionTab("advance")}>Advance Collection</BackTitle>} />
        <Card className="p-4">
          <AdvanceCollectionForm today={today} lookups={lookups.data} accounts={accounts.data!} onCancel={() => history.back()} onSaved={() => undefined} />
        </Card>
      </PageContainer>
    );
  }
  if (mode === "bill") return <BillCreate today={today} lookups={lookups.data} initialCustomerId={params.get("customer") ?? ""} />;
  return <DueCollection today={today} lookups={lookups.data} accounts={accounts.data!} initialCustomerId={params.get("customer") ?? ""} bill={bill.data ?? null} />;
}

function BackTitle({ href, children }: { href: string; children: ReactNode }) {
  return (
    <span className="flex items-center gap-2">
      <Link href={href} aria-label="Back" className={buttonClasses("ghost", "icon")}>
        <ArrowLeft />
      </Link>
      {children}
    </span>
  );
}

/** Customers (and their sales force) of the office's business unit. */
function useUnitMasters(lookups: SalesLookups, officeId: string) {
  const businessUnitId = lookups.offices.find((office) => office.id === officeId)?.businessUnitId ?? null;
  const masters = useResource(businessUnitId && `collection-masters:${businessUnitId}`, async () => {
    const [setup, customers] = await Promise.all([fetchSetupLookups(businessUnitId!), fetchCustomers(businessUnitId!, true)]);
    return { setup, customers };
  });
  return { businessUnitId, masters };
}

// ─── Due Collection ──────────────────────────────────────────────────────────

interface CollectRow {
  key: string;
  customerId: string;
  customerName: string;
  invoice: DueInvoice;
  amount: string;
}

interface DeductionRow {
  key: string;
  expense: string;
  accountId: string;
  amount: number;
}

function DueCollection({
  today,
  lookups,
  accounts,
  initialCustomerId,
  bill,
}: {
  today: string;
  lookups: SalesLookups;
  accounts: GlAccountOption[];
  initialCustomerId: string;
  bill: BillDetail | null;
}) {
  const router = useRouter();
  const toast = useToast();
  const [header, setHeader] = useState({
    method: "CASH" as CollectionMethod,
    salesPersonId: "",
    collectionDate: today,
    officeId: bill?.officeId ?? lookups.offices[0]?.id ?? "",
    cashType: "",
    adjustAccountId: "",
    moneyReceiptNo: "",
    remarks: "",
    bankName: "",
    reference: "",
  });
  const [customerId, setCustomerId] = useState(bill?.customerId ?? initialCustomerId);
  const [picked, setPicked] = useState<string[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [entryAmount, setEntryAmount] = useState("");
  const [rows, setRows] = useState<CollectRow[]>([]);
  const [deductions, setDeductions] = useState<DeductionRow[]>([]);
  const [deductionOpen, setDeductionOpen] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [entryError, setEntryError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const set = (key: keyof typeof header, value: string) => setHeader((current) => ({ ...current, [key]: value }));

  const { masters } = useUnitMasters(lookups, header.officeId);
  const customers = useMemo(() => masters.data?.customers ?? [], [masters.data]);
  const customer = customers.find((candidate) => candidate.id === customerId);
  const invoices = useResource(customerId ? `customer-dues:${customerId}:${today}` : null, () => fetchDueInvoices({ customerId, asOf: today }));
  // Invoices not yet in the table.
  const available = (invoices.data ?? []).filter((invoice) => invoice.due > 0 && !rows.some((row) => row.invoice.deliveryId === invoice.deliveryId));
  const pickedDue = round2(available.filter((invoice) => picked.includes(invoice.deliveryId)).reduce((sum, invoice) => sum + invoice.due, 0));

  // A bill being collected starts with its invoices in the table.
  const [seeded, setSeeded] = useState(false);
  if (!seeded && bill && invoices.data) {
    setSeeded(true);
    const onBill = invoices.data.filter((invoice) => invoice.due > 0 && bill.lines.some((line) => line.deliveryId === invoice.deliveryId));
    setRows(onBill.map((invoice) => ({ key: crypto.randomUUID(), customerId: bill.customerId, customerName: bill.customerName, invoice, amount: String(invoice.due) })));
  }

  const total = round2(rows.reduce((sum, row) => sum + toNumber(row.amount), 0));
  const deductionTotal = round2(deductions.reduce((sum, row) => sum + row.amount, 0));
  const accountOptions = accounts.map((account) => ({ id: account.id, label: accountLabel(account) }));
  const showBank = header.method === "BANK" || header.method === "CHEQUE";

  function selectCustomer(id: string) {
    setCustomerId(id);
    setPicked([]);
    setEntryAmount("");
    const match = customers.find((candidate) => candidate.id === id);
    if (match?.salesPersonId && !header.salesPersonId) set("salesPersonId", match.salesPersonId);
  }

  function togglePick(deliveryId: string, checked: boolean) {
    const next = checked ? [...picked, deliveryId] : picked.filter((id) => id !== deliveryId);
    setPicked(next);
    setEntryAmount(String(round2(available.filter((invoice) => next.includes(invoice.deliveryId)).reduce((sum, invoice) => sum + invoice.due, 0))));
  }

  /** Adds the picked invoices; a smaller amount is spread over the oldest first. */
  function add() {
    const chosen = available.filter((invoice) => picked.includes(invoice.deliveryId)).sort((a, b) => a.deliveryDate.localeCompare(b.deliveryDate));
    if (!customer || chosen.length === 0) return setEntryError("Select a customer and at least one invoice.");
    let left = entryAmount.trim() ? toNumber(entryAmount) : pickedDue;
    if (!(left > 0)) return setEntryError("Collection amount must be more than 0.");
    if (left > pickedDue + 1e-9) return setEntryError(`At most ${formatAmount(pickedDue)} is due on the selected invoices.`);
    const added: CollectRow[] = [];
    for (const invoice of chosen) {
      if (left <= 0) break;
      const take = round2(Math.min(invoice.due, left));
      added.push({ key: crypto.randomUUID(), customerId: customer.id, customerName: customer.name, invoice, amount: String(take) });
      left = round2(left - take);
    }
    setRows((current) => [...current, ...added]);
    setPicked([]);
    setEntryAmount("");
    setEntryError(undefined);
    setPickerOpen(false);
  }

  async function save() {
    if (busy) return;
    const byCustomer = new Map<string, { deliveryId: string; amount: number }[]>();
    for (const row of rows) byCustomer.set(row.customerId, [...(byCustomer.get(row.customerId) ?? []), { deliveryId: row.invoice.deliveryId, amount: requiredNumber(row.amount) }]);
    const over = rows.find((row) => toNumber(row.amount) > row.invoice.due + 1e-9);
    if (over) return toast.error(`${over.invoice.number}: at most ${formatAmount(over.invoice.due)} is due.`);
    if (header.method === "CASH" && !header.cashType) {
      setErrors({ cashType: "Select the cash type." });
      return toast.error("Select the cash type.");
    }
    const input = {
      officeId: header.officeId,
      collectionDate: header.collectionDate,
      method: header.method,
      cashType: header.method === "CASH" ? header.cashType : null,
      salesPersonId: header.salesPersonId || null,
      adjustAccountId: header.adjustAccountId || null,
      moneyReceiptNo: header.moneyReceiptNo,
      bankName: showBank ? header.bankName : null,
      reference: showBank ? header.reference : null,
      remarks: header.remarks,
      deductions: deductions.map(({ expense, accountId, amount }) => ({ expense, accountId, amount })),
      rows: [...byCustomer].map(([id, allocations]) => ({ customerId: id, allocations })),
    };
    const parsed = dueCollectionSchema.safeParse(input);
    if (!parsed.success) {
      const next = issuesToErrors(parsed.error);
      setErrors(next);
      return toast.error(Object.values(next)[0] ?? "Please correct the highlighted fields.");
    }
    setErrors({});
    setBusy(true);
    try {
      const saved = await createDueCollection(input);
      toast.success(`Money receipt ${saved.map((row) => row.number).join(", ")} saved.`);
      router.replace(saved.length === 1 ? paths.collection(saved[0].id) : paths.collectionTab("collected"));
    } catch (error) {
      toast.error(errorMessage(error));
      setBusy(false);
    }
  }
  useSaveShortcut(save, rows.length > 0);

  const persons = masters.data?.setup.salesPersons ?? [];
  return (
    <PageContainer className="max-w-none">
      <PageHead
        title={<BackTitle href={paths.collectionTab("due")}>Due Collection</BackTitle>}
        subtitle={bill ? `Collecting bill ${bill.number}` : undefined}
        actions={
          <Button variant="primary" onClick={save} loading={busy} disabled={rows.length === 0}>
            SAVE
          </Button>
        }
      />
      <div className="flex flex-col gap-4">
        <Card>
          <Section>
            <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
              <SelectField
                label="Collection Type"
                required
                value={header.method}
                options={COLLECTION_METHODS.map((value) => ({ value, label: COLLECTION_METHOD_LABELS[value] }))}
                onChange={(event) => set("method", event.target.value)}
              />
              <SelectField
                label="Collect By"
                value={header.salesPersonId}
                error={errors.salesPersonId}
                options={[{ value: "", label: "Collect By" }, ...persons.map((person) => ({ value: person.id, label: person.name }))]}
                onChange={(event) => set("salesPersonId", event.target.value)}
              />
              <TextField label="Date" type="date" required value={header.collectionDate} error={errors.collectionDate} onChange={(event) => set("collectionDate", event.target.value)} />
              <SelectField
                label="Office"
                required
                value={header.officeId}
                error={errors.officeId}
                disabled={rows.length > 0}
                hint={rows.length > 0 ? "Remove the invoices to change the office." : undefined}
                options={[{ value: "", label: "Office" }, ...lookups.offices.map((office) => ({ value: office.id, label: office.name }))]}
                onChange={(event) => {
                  set("officeId", event.target.value);
                  setCustomerId("");
                }}
              />
              {header.method === "CASH" ? (
                <SelectField
                  label="Cash Type"
                  required
                  value={header.cashType}
                  error={errors.cashType}
                  options={[{ value: "", label: "Cash Type" }, ...CASH_TYPES.map((value) => ({ value, label: value }))]}
                  onChange={(event) => set("cashType", event.target.value)}
                />
              ) : (
                <TextField label="Bank Name" value={header.bankName} error={errors.bankName} onChange={(event) => set("bankName", event.target.value)} />
              )}
              <SearchPick
                label="Adjust With GL"
                placeholder="Adjust With GL (min 3 letters)"
                options={accountOptions}
                selectedId={header.adjustAccountId}
                onPick={(id) => set("adjustAccountId", id ?? "")}
              />
              <TextField label="Money Receipt No" placeholder="Money Receipt No" value={header.moneyReceiptNo} error={errors.moneyReceiptNo} onChange={(event) => set("moneyReceiptNo", event.target.value)} />
              <TextField label="Remarks" placeholder="Remarks" value={header.remarks} error={errors.remarks} onChange={(event) => set("remarks", event.target.value)} />
              {showBank && (
                <TextField
                  label={header.method === "CHEQUE" ? "Cheque No" : "Transaction / Ref No"}
                  value={header.reference}
                  error={errors.reference}
                  onChange={(event) => set("reference", event.target.value)}
                />
              )}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="primary" size="sm" onClick={() => setDeductionOpen(true)}>
                Bank Deduction
              </Button>
              {deductions.length > 0 && (
                <span className="text-xs text-ink-muted">
                  {deductions.length} deduction{deductions.length > 1 ? "s" : ""} · {formatAmount(deductionTotal)}
                </span>
              )}
              {errors.deductions && <span className="text-xs text-danger">{errors.deductions}</span>}
            </div>
          </Section>
        </Card>

        <Card>
          <Section>
            <div className="grid items-end gap-3 lg:grid-cols-[1fr_1fr_10rem_auto]">
              <SearchPick
                key={customers.length}
                label="Customer"
                disabled={!header.officeId || masters.loading}
                placeholder="Select/Search Customer (min 3 letters)"
                options={customers.map((candidate) => ({ id: candidate.id, label: `${candidate.name} (${candidate.code})` }))}
                selectedId={customerId}
                onPick={(id) => selectCustomer(id ?? "")}
              />
              <div className="relative flex flex-col gap-1">
                <div className="flex items-center justify-between text-xs text-ink-muted">
                  <span>
                    Invoice <span className="text-danger">*</span> {picked.length}
                  </span>
                  <label className="flex items-center gap-1">
                    All
                    <Checkbox
                      aria-label="Select all invoices"
                      checked={available.length > 0 && picked.length === available.length}
                      disabled={available.length === 0}
                      onChange={(event) => {
                        const next = event.target.checked ? available.map((invoice) => invoice.deliveryId) : [];
                        setPicked(next);
                        setEntryAmount(event.target.checked ? String(round2(available.reduce((sum, invoice) => sum + invoice.due, 0))) : "");
                      }}
                    />
                  </label>
                </div>
                <button
                  type="button"
                  aria-expanded={pickerOpen}
                  disabled={!customerId}
                  onClick={() => setPickerOpen((value) => !value)}
                  className={cn(CONTROL, "flex h-7 items-center justify-between text-left")}
                >
                  <span className={picked.length ? "text-ink" : "text-ink-faint"}>
                    {picked.length ? `${picked.length} invoice${picked.length > 1 ? "s" : ""} · ${formatAmount(pickedDue)}` : "Select/Search Invoice"}
                  </span>
                  <ChevronDown aria-hidden="true" className="size-3.5" />
                </button>
                {pickerOpen && (
                  <div className="absolute top-full right-0 left-0 z-20 mt-1 max-h-72 overflow-auto rounded border border-line bg-surface shadow-lg">
                    {invoices.loading ? (
                      <LoadingState />
                    ) : available.length === 0 ? (
                      <p className="p-3 text-xs text-ink-muted">Nothing is due from this customer.</p>
                    ) : (
                      available.map((invoice) => (
                        <label key={invoice.deliveryId} className="flex cursor-pointer items-center gap-2 border-b border-line px-3 py-1.5 text-xs last:border-0 hover:bg-canvas">
                          <Checkbox checked={picked.includes(invoice.deliveryId)} onChange={(event) => togglePick(invoice.deliveryId, event.target.checked)} />
                          <span className="flex-1 text-ink">
                            {invoice.number} <span className="text-ink-faint">· {formatDay(invoice.deliveryDate)}</span>
                          </span>
                          <span className="tabular-nums text-ink">{formatAmount(invoice.due)}</span>
                        </label>
                      ))
                    )}
                  </div>
                )}
              </div>
              <TextField label="Collection Amount" type="number" min={0} step="any" value={entryAmount} onChange={(event) => setEntryAmount(event.target.value)} />
              <Button variant="primary" onClick={add} disabled={!customerId}>
                Add
              </Button>
            </div>
            {entryError && (
              <p role="alert" className="text-xs text-danger">
                {entryError}
              </p>
            )}
          </Section>
          {rows.length === 0 ? (
            <EmptyState title="No Data Found">Pick a customer and invoices, then Add.</EmptyState>
          ) : (
            <div className="overflow-x-auto border-t border-line">
              <table className="w-full min-w-[900px] text-xs">
                <thead className="bg-accent-soft font-semibold text-ink">
                  <tr>
                    {["SL", "Customer", "Invoice No", "Invoice Date", "Due Date", "Invoice Amount", "Due Amount", "Collection Amount", "Action"].map((label, index) => (
                      <th key={label} scope="col" className={cn("px-3 py-2", index >= 5 && index <= 7 ? "text-right" : "text-left")}>
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {rows.map((row, index) => (
                    <tr key={row.key}>
                      <td className="px-3 py-1.5 tabular-nums">{index + 1}</td>
                      <td className="px-3 py-1.5 text-ink">{row.customerName}</td>
                      <td className="px-3 py-1.5 whitespace-nowrap">{row.invoice.number}</td>
                      <td className="px-3 py-1.5 whitespace-nowrap">{formatDay(row.invoice.deliveryDate)}</td>
                      <td className="px-3 py-1.5 whitespace-nowrap">{formatDay(row.invoice.dueDate)}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{formatAmount(row.invoice.totalAmount)}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{formatAmount(row.invoice.due)}</td>
                      <td className="w-36 px-3 py-1">
                        <input
                          aria-label={`Collection amount for ${row.invoice.number}`}
                          type="number"
                          min={0}
                          max={row.invoice.due}
                          step="any"
                          value={row.amount}
                          onChange={(event) => setRows((current) => current.map((candidate) => (candidate.key === row.key ? { ...candidate, amount: event.target.value } : candidate)))}
                          className={cn(CONTROL, "h-7 text-right tabular-nums", toNumber(row.amount) > row.invoice.due + 1e-9 && "ring-1 ring-danger")}
                        />
                      </td>
                      <td className="px-3 py-1">
                        <Button variant="ghost" size="icon" aria-label={`Remove ${row.invoice.number}`} onClick={() => setRows((current) => current.filter((candidate) => candidate.key !== row.key))}>
                          <Trash2 />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t border-line-strong bg-canvas font-semibold text-ink">
                  <tr>
                    <td colSpan={7} className="px-3 py-2 text-right">
                      Total Collection
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatAmount(total)}</td>
                    <td />
                  </tr>
                  {deductionTotal > 0 && (
                    <>
                      <tr>
                        <td colSpan={7} className="px-3 py-1 text-right font-normal text-ink-muted">
                          Less: Bank Deduction
                        </td>
                        <td className="px-3 py-1 text-right font-normal tabular-nums">{formatAmount(deductionTotal)}</td>
                        <td />
                      </tr>
                      <tr>
                        <td colSpan={7} className="px-3 py-1 text-right">
                          Net Received
                        </td>
                        <td className="px-3 py-1 text-right tabular-nums">{formatAmount(round2(total - deductionTotal))}</td>
                        <td />
                      </tr>
                    </>
                  )}
                </tfoot>
              </table>
            </div>
          )}
        </Card>
      </div>
      {deductionOpen && (
        <BankDeductionDialog accounts={accounts} rows={deductions} onChange={setDeductions} onClose={() => setDeductionOpen(false)} />
      )}
    </PageContainer>
  );
}

/** Bank Deduction Details: expense, GL head and amount the bank kept. */
function BankDeductionDialog({ accounts, rows, onChange, onClose }: { accounts: GlAccountOption[]; rows: DeductionRow[]; onChange: (rows: DeductionRow[]) => void; onClose: () => void }) {
  const [draft, setDraft] = useState({ expense: "", accountId: "", amount: "" });
  const [error, setError] = useState<string>();
  const accountName = (id: string) => {
    const account = accounts.find((candidate) => candidate.id === id);
    return account ? accountLabel(account) : "";
  };

  function add() {
    const parsed = deductionSchema.safeParse({ ...draft, amount: requiredNumber(draft.amount) });
    if (!parsed.success) return setError(parsed.error.issues[0]?.message);
    onChange([...rows, { key: crypto.randomUUID(), ...parsed.data }]);
    setDraft({ expense: "", accountId: "", amount: "" });
    setError(undefined);
  }

  return (
    <Dialog
      open
      title="Bank Deduction Details"
      size="lg"
      onClose={onClose}
      footer={
        <Button variant="ghost" className="text-danger" onClick={onClose}>
          CLOSE
        </Button>
      }
    >
      <div className="flex flex-col gap-3">
        <div className="grid items-end gap-3 rounded-lg border border-line p-3 sm:grid-cols-[1fr_1fr_8rem_auto]">
          <TextField label="Expenses" required placeholder="Expenses" value={draft.expense} onChange={(event) => setDraft({ ...draft, expense: event.target.value })} />
          <SearchPick
            key={rows.length}
            label="Account Head (GL)"
            required
            placeholder="Account Head (GL)"
            options={accounts.map((account) => ({ id: account.id, label: accountLabel(account) }))}
            selectedId={draft.accountId}
            onPick={(id) => setDraft((current) => ({ ...current, accountId: id ?? "" }))}
          />
          <TextField label="Amount" required type="number" min={0} step="any" placeholder="Amount" value={draft.amount} onChange={(event) => setDraft({ ...draft, amount: event.target.value })} />
          <Button variant="primary" onClick={add}>
            <Plus aria-hidden="true" />
            Add
          </Button>
        </div>
        {error && (
          <p role="alert" className="text-xs text-danger">
            {error}
          </p>
        )}
        {rows.length > 0 && (
          <table className="w-full text-xs">
            <thead className="bg-accent-soft font-semibold text-ink">
              <tr>
                <th scope="col" className="px-2 py-1.5 text-left">Expenses</th>
                <th scope="col" className="px-2 py-1.5 text-left">Account Head (GL)</th>
                <th scope="col" className="px-2 py-1.5 text-right">Amount</th>
                <th scope="col" className="w-10 px-2 py-1.5"><span className="sr-only">Remove</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((row) => (
                <tr key={row.key}>
                  <td className="px-2 py-1.5">{row.expense}</td>
                  <td className="px-2 py-1.5">{accountName(row.accountId)}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{formatAmount(row.amount)}</td>
                  <td className="px-2 py-1">
                    <Button variant="ghost" size="icon" aria-label={`Remove ${row.expense}`} onClick={() => onChange(rows.filter((candidate) => candidate.key !== row.key))}>
                      <Trash2 />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </Dialog>
  );
}

// ─── Bill Create ─────────────────────────────────────────────────────────────

interface BillLineValues {
  challanManual: string;
  grnNumber: string;
  submissionDate: string;
}

function BillCreate({ today, lookups, initialCustomerId }: { today: string; lookups: SalesLookups; initialCustomerId: string }) {
  const router = useRouter();
  const toast = useToast();
  const [officeId, setOfficeId] = useState(lookups.offices[0]?.id ?? "");
  const [customerId, setCustomerId] = useState(initialCustomerId);
  const [filters, setFilters] = useState({ invoiceId: "", from: "", to: "", viewBy: "deliveryDate" as "deliveryDate" | "dueDate" });
  const [applied, setApplied] = useState(filters);
  const [picked, setPicked] = useState<string[]>([]);
  const [lines, setLines] = useState<Record<string, BillLineValues>>({});
  const [terms, setTerms] = useState("");
  const [termsOpen, setTermsOpen] = useState(false);
  const [busy, setBusy] = useState<BillType | null>(null);

  const { masters } = useUnitMasters(lookups, officeId);
  const customers = useMemo(() => masters.data?.customers ?? [], [masters.data]);
  const invoices = useResource(customerId ? `bill-dues:${customerId}:${today}` : null, () => fetchDueInvoices({ customerId, asOf: today, notSubmitted: "true" }));
  const rows = (invoices.data ?? []).filter((invoice) => {
    if (invoice.due <= 0) return false;
    if (applied.invoiceId && invoice.deliveryId !== applied.invoiceId) return false;
    const date = applied.viewBy === "dueDate" ? invoice.dueDate : invoice.deliveryDate;
    return (!applied.from || date >= applied.from) && (!applied.to || date <= applied.to);
  });
  const chosen = rows.filter((row) => picked.includes(row.deliveryId));
  const total = round2(chosen.reduce((sum, row) => sum + row.due, 0));
  const line = (row: DueInvoice): BillLineValues => lines[row.deliveryId] ?? { challanManual: row.challanNo ?? "", grnNumber: "", submissionDate: "" };
  const setLine = (row: DueInvoice, patch: Partial<BillLineValues>) => setLines((current) => ({ ...current, [row.deliveryId]: { ...line(row), ...patch } }));

  async function save(billType: BillType) {
    if (busy) return;
    const input = {
      officeId,
      customerId,
      billDate: today,
      billType,
      terms,
      deliveryIds: chosen.map((row) => row.deliveryId),
      details: chosen.map((row) => ({ deliveryId: row.deliveryId, ...line(row), submissionDate: line(row).submissionDate || null })),
    };
    const parsed = billInputSchema.safeParse(input);
    if (!parsed.success) return toast.error(parsed.error.issues[0]?.message ?? "Select at least one invoice.");
    setBusy(billType);
    try {
      const saved = await createBill(input, today);
      toast.success(`${billType === "FACTORING" ? "Factoring bill" : "Bill"} ${saved.number} created.`);
      router.replace(paths.bill(saved.id));
    } catch (error) {
      toast.error(errorMessage(error));
      setBusy(null);
    }
  }

  const allPicked = rows.length > 0 && rows.every((row) => picked.includes(row.deliveryId));
  return (
    <PageContainer className="max-w-none">
      <PageHead title={<BackTitle href={paths.collectionTab("bills")}>Bill Create</BackTitle>} />
      <div className="flex flex-col gap-4">
        <Card>
          <Section>
            <div className="grid items-end gap-x-4 gap-y-3 sm:grid-cols-2 lg:grid-cols-[1.5fr_1.5fr_1fr_1fr_1fr]">
              <SelectField
                label="Office"
                value={officeId}
                options={[{ value: "", label: "Office" }, ...lookups.offices.map((office) => ({ value: office.id, label: office.name }))]}
                onChange={(event) => {
                  setOfficeId(event.target.value);
                  setCustomerId("");
                  setPicked([]);
                }}
              />
              <SearchPick
                key={customers.length}
                label="Customer"
                required
                disabled={!officeId || masters.loading}
                placeholder="Select/Search Customer (min 3 letters)"
                options={customers.map((candidate) => ({ id: candidate.id, label: `${candidate.name} (${candidate.code})` }))}
                selectedId={customerId}
                onPick={(id) => {
                  setCustomerId(id ?? "");
                  setPicked([]);
                  setFilters((current) => ({ ...current, invoiceId: "" }));
                }}
              />
              <SelectField
                label="Invoice"
                value={filters.invoiceId}
                disabled={!customerId}
                options={[{ value: "", label: "Select/Search Invoice" }, ...(invoices.data ?? []).filter((row) => row.due > 0).map((row) => ({ value: row.deliveryId, label: row.number }))]}
                onChange={(event) => setFilters({ ...filters, invoiceId: event.target.value })}
              />
              <TextField label="From Date" type="date" value={filters.from} onChange={(event) => setFilters({ ...filters, from: event.target.value })} />
              <TextField label="To Date" type="date" value={filters.to} onChange={(event) => setFilters({ ...filters, to: event.target.value })} />
              <SelectField
                label="View By"
                value={filters.viewBy}
                options={[
                  { value: "deliveryDate", label: "Delivery Date" },
                  { value: "dueDate", label: "Due Date" },
                ]}
                onChange={(event) => setFilters({ ...filters, viewBy: event.target.value as "deliveryDate" | "dueDate" })}
              />
              <div className="flex gap-3">
                <Button variant="primary" onClick={() => setApplied(filters)} disabled={!customerId}>
                  View
                </Button>
                <Button variant="primary" onClick={() => setTermsOpen(true)}>
                  Terms &amp; Conditions
                </Button>
              </div>
            </div>
          </Section>
        </Card>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-3">
            <Button variant="primary" className="rounded-full" onClick={() => save("NORMAL")} loading={busy === "NORMAL"} disabled={busy !== null || chosen.length === 0}>
              <Plus aria-hidden="true" />
              Create Bill
            </Button>
            <Button variant="primary" className="rounded-full" onClick={() => save("FACTORING")} loading={busy === "FACTORING"} disabled={busy !== null || chosen.length === 0}>
              <Plus aria-hidden="true" />
              Factoring Bill
            </Button>
          </div>
          <p className="text-base font-semibold text-ink">
            Total Amount: <span className="tabular-nums">{formatAmount(total)}</span>
          </p>
        </div>

        <Card>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] text-xs">
              <thead className="bg-accent-soft font-semibold text-ink">
                <tr>
                  <th scope="col" className="w-8 px-2 py-2">
                    <Checkbox aria-label="Select all invoices" checked={allPicked} disabled={rows.length === 0} onChange={(event) => setPicked(event.target.checked ? rows.map((row) => row.deliveryId) : [])} />
                  </th>
                  {["Invoice No", "Challan (Manual)", "Total Amount", "Receive Amount/Adjust", "Due Amount", "GRN Number", "Delivery Date", "Submission Date"].map((label, index) => (
                    <th key={label} scope="col" className={cn("px-2 py-2", index >= 2 && index <= 4 ? "text-right" : "text-left")}>
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {!customerId ? (
                  <tr>
                    <td colSpan={9}>
                      <EmptyState title="Select a customer" />
                    </td>
                  </tr>
                ) : invoices.loading && !invoices.data ? (
                  <tr>
                    <td colSpan={9}>
                      <LoadingState />
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={9}>
                      <EmptyState title="No unbilled invoices with dues" />
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => {
                    const values = line(row);
                    return (
                      <tr key={row.deliveryId}>
                        <td className="px-2 py-1.5">
                          <Checkbox
                            aria-label={`Bill ${row.number}`}
                            checked={picked.includes(row.deliveryId)}
                            onChange={(event) => setPicked((current) => (event.target.checked ? [...current, row.deliveryId] : current.filter((id) => id !== row.deliveryId)))}
                          />
                        </td>
                        <td className="px-2 py-1.5 whitespace-nowrap">{row.number}</td>
                        <td className="w-40 px-2 py-1">
                          <input aria-label={`Challan for ${row.number}`} value={values.challanManual} onChange={(event) => setLine(row, { challanManual: event.target.value })} className={cn(CONTROL, "h-7")} />
                        </td>
                        <td className="px-2 py-1.5 text-right tabular-nums">{formatAmount(row.totalAmount)}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums">{formatAmount(round2(row.collectedAmount + row.returnedAmount))}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums">{formatAmount(row.due)}</td>
                        <td className="w-36 px-2 py-1">
                          <input aria-label={`GRN number for ${row.number}`} value={values.grnNumber} onChange={(event) => setLine(row, { grnNumber: event.target.value })} className={cn(CONTROL, "h-7")} />
                        </td>
                        <td className="px-2 py-1.5 whitespace-nowrap">{formatDay(row.deliveryDate)}</td>
                        <td className="w-40 px-2 py-1">
                          <input aria-label={`Submission date for ${row.number}`} type="date" value={values.submissionDate} onChange={(event) => setLine(row, { submissionDate: event.target.value })} className={cn(CONTROL, "h-7")} />
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <Dialog
        open={termsOpen}
        title="Terms & Conditions"
        size="lg"
        onClose={() => setTermsOpen(false)}
        footer={
          <Button variant="primary" onClick={() => setTermsOpen(false)}>
            DONE
          </Button>
        }
      >
        <TextAreaField label="Terms & Conditions" rows={10} maxLength={4000} value={terms} onChange={(event) => setTerms(event.target.value)} />
      </Dialog>
    </PageContainer>
  );
}
