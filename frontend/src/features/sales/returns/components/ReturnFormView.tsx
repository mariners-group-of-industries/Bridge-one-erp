"use client";

import { ArrowLeft, Plus, SaveAll, Settings2, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useId, useMemo, useState, type ReactNode } from "react";
import { PageContainer, PageHead } from "@/components/layout/page";
import { Button, buttonClasses } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { CONTROL, CheckboxField, SelectField, TextField } from "@/components/ui/form-field";
import { Card, EmptyState, ErrorState, LoadingState, Section } from "@/components/ui/section";
import { useToast } from "@/components/ui/toast";
import { useResource } from "@/hooks/use-resource";
import { useSaveShortcut } from "@/hooks/use-save-shortcut";
import { errorMessage } from "@/lib/api/client";
import { cn } from "@/lib/cn";
import { formatAmount, formatQty } from "../../dashboard/lib/format";
import type { WarehouseOption } from "../../deliveries/schemas/delivery.schema";
import { fetchWarehouses } from "../../deliveries/services/delivery.api";
import { issuesToErrors, numberText, optionalNumber, requiredNumber } from "../../lib/form";
import { formatDay, useToday } from "../../lib/use-today";
import { CATEGORY_LEVEL_LABELS, type ItemOption, type SalesLookups, type SetupLookups } from "../../masters/schemas/masters.schema";
import { fetchCustomers, fetchItems, fetchSalesLookups, fetchSetupLookups } from "../../masters/services/masters.api";
import { paths } from "../../paths";
import { SearchPick } from "../../components/SearchPick";
import { round2 } from "../../quotations/lib/totals";
import { SimpleMastersPanel } from "../../setup/components/SimpleMastersPanel";
import { discountShare, returnLineAmounts } from "../lib/return-totals";
import {
  RETURN_KINDS,
  RETURN_KIND_LABELS,
  referencedReturnSchema,
  withoutReferenceSchema,
  type DeliveryForReturn,
  type ReturnDetail,
  type ReturnInput,
  type ReturnKind,
} from "../schemas/return.schema";
import { createReturn, fetchDeliveryForReturn, fetchReturn, updateReturn } from "../services/return.api";

const toNumber = (value: string) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};
const newKey = () => crypto.randomUUID();
/** Rate of an item for a price type (falls back to the default sales rate). */
const rateFor = (item: ItemOption, priceListId: string) => item.prices[priceListId] ?? item.salesRate;

// ─── Entry points ────────────────────────────────────────────────────────────

/** /sales/returns/new[?delivery=<id>&mode=full|partial] */
export function NewReturnView() {
  const today = useToday();
  const params = useSearchParams();
  const deliveryId = params.get("delivery");
  const mode = params.get("mode") === "full" ? "FULL" : "PARTIAL";
  if (!today) return <Loading title="Sales Return" />;
  return deliveryId ? <ReferencedReturnForm key={`${deliveryId}:${mode}`} deliveryId={deliveryId} mode={mode} today={today} existing={null} /> : <WithoutReferenceLoader today={today} existing={null} />;
}

export function EditReturnView({ id }: { id: string }) {
  const today = useToday();
  const record = useResource(id, () => fetchReturn(id));
  if (record.error) return <Failed title="Edit Return" message={errorMessage(record.error)} onRetry={record.reload} />;
  if (!today || !record.data) return <Loading title="Edit Return" />;
  const existing = record.data;
  if (existing.status !== "DRAFT" || existing.mode === "EXCHANGE") {
    return (
      <PageContainer>
        <PageHead title={`Edit ${existing.number}`} />
        <Card>
          <EmptyState title="Only pending returns can be edited">
            <Link href={paths.salesReturn(existing.id)} className="text-sm text-ink underline underline-offset-2">
              Back to {existing.number}
            </Link>
          </EmptyState>
        </Card>
      </PageContainer>
    );
  }
  return existing.mode === "WITHOUT_REFERENCE" ? (
    <WithoutReferenceLoader key={existing.updatedAt} today={today} existing={existing} />
  ) : (
    <ReferencedReturnForm key={existing.updatedAt} deliveryId={existing.deliveryId!} mode={existing.mode} today={today} existing={existing} />
  );
}

function Loading({ title }: { title: string }) {
  return (
    <PageContainer>
      <PageHead title={title} />
      <LoadingState />
    </PageContainer>
  );
}

function Failed({ title, message, onRetry }: { title: string; message: string; onRetry: () => void }) {
  return (
    <PageContainer>
      <PageHead title={title} />
      <Card>
        <ErrorState message={message} onRetry={onRetry} />
      </Card>
    </PageContainer>
  );
}

// ─── Shared header ───────────────────────────────────────────────────────────

interface HeaderValues {
  officeId: string;
  warehouseId: string;
  returnDate: string;
  salesPersonId: string;
  reason: string;
  refNo: string;
  refDate: string;
  refAmount: string;
  requestNo: string;
  remarks: string;
}

function headerFrom(existing: ReturnDetail | null, defaults: Partial<HeaderValues> & { returnDate: string }): HeaderValues {
  return {
    officeId: existing?.officeId ?? defaults.officeId ?? "",
    warehouseId: existing?.warehouseId ?? defaults.warehouseId ?? "",
    returnDate: existing?.returnDate ?? defaults.returnDate,
    salesPersonId: existing?.salesPersonId ?? defaults.salesPersonId ?? "",
    reason: existing?.reason ?? "",
    refNo: existing?.refNo ?? "",
    refDate: existing?.refDate ?? "",
    refAmount: numberText(existing?.refAmount),
    requestNo: existing?.requestNo ?? "",
    remarks: existing?.remarks ?? "",
  };
}

function headerInput(values: HeaderValues) {
  return {
    officeId: values.officeId,
    warehouseId: values.warehouseId,
    returnDate: values.returnDate,
    salesPersonId: values.salesPersonId || null,
    reason: values.reason,
    refNo: values.refNo,
    refDate: values.refDate || null,
    refAmount: optionalNumber(values.refAmount),
    requestNo: values.requestNo,
    remarks: values.remarks,
  };
}

/** Return date, warehouse, sales force and the reference fields. */
function HeaderFields({
  values,
  errors,
  set,
  warehouses,
  salesPersons,
  officeField,
  children,
}: {
  values: HeaderValues;
  errors: Record<string, string>;
  set: <K extends keyof HeaderValues>(key: K, value: HeaderValues[K]) => void;
  warehouses: WarehouseOption[];
  salesPersons: SetupLookups["salesPersons"];
  officeField: ReactNode;
  children?: ReactNode;
}) {
  const officeWarehouses = warehouses.filter((warehouse) => warehouse.officeId === values.officeId);
  return (
    <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
      <TextField label="Return Date" type="date" required value={values.returnDate} error={errors.returnDate} onChange={(event) => set("returnDate", event.target.value)} />
      {officeField}
      <SelectField
        label="Warehouse"
        required
        value={values.warehouseId}
        error={errors.warehouseId}
        hint="Returned goods go back into this warehouse."
        options={[{ value: "", label: "Select a warehouse" }, ...officeWarehouses.map((warehouse) => ({ value: warehouse.id, label: warehouse.name }))]}
        onChange={(event) => set("warehouseId", event.target.value)}
      />
      <SelectField
        label="Sales Force"
        value={values.salesPersonId}
        error={errors.salesPersonId}
        options={[{ value: "", label: "None" }, ...salesPersons.map((person) => ({ value: person.id, label: `${person.name}${person.designation ? ` (${person.designation})` : ""}` }))]}
        onChange={(event) => set("salesPersonId", event.target.value)}
      />
      {children}
      <TextField label="Return Reason" placeholder="Good product return, damaged …" value={values.reason} error={errors.reason} onChange={(event) => set("reason", event.target.value)} />
      <TextField label="Return Ref. No" value={values.refNo} error={errors.refNo} onChange={(event) => set("refNo", event.target.value)} />
      <TextField label="Return Ref. Date" type="date" value={values.refDate} error={errors.refDate} onChange={(event) => set("refDate", event.target.value)} />
      <TextField label="Return Ref. Amount" type="number" min={0} step="any" value={values.refAmount} error={errors.refAmount} onChange={(event) => set("refAmount", event.target.value)} />
      <TextField label="Return Req. No" value={values.requestNo} error={errors.requestNo} onChange={(event) => set("requestNo", event.target.value)} />
      <TextField label="Remarks" className="lg:col-span-2" value={values.remarks} error={errors.remarks} onChange={(event) => set("remarks", event.target.value)} />
    </div>
  );
}

/** Return reason picker with a dialog to manage the reason list. */
function ReasonSelect({
  label,
  value,
  reasons,
  onChange,
  onManage,
  className,
}: {
  label: string;
  value: string;
  reasons: { id: string; name: string }[];
  onChange: (value: string) => void;
  onManage?: () => void;
  className?: string;
}) {
  const options = [{ value: "", label: "Select a reason" }, ...reasons.map((reason) => ({ value: reason.name, label: reason.name }))];
  if (value && !reasons.some((reason) => reason.name === value)) options.push({ value, label: value });
  return (
    <div className={cn("flex items-end gap-1.5", className)}>
      <SelectField label={label} className="min-w-0 flex-1" value={value} options={options} onChange={(event) => onChange(event.target.value)} />
      {onManage && (
        <Button size="icon" aria-label="Manage return reasons" title="Add or edit return reasons" onClick={onManage}>
          <Settings2 />
        </Button>
      )}
    </div>
  );
}

function ReasonsDialog({ open, businessUnitId, onClose }: { open: boolean; businessUnitId: string; onClose: () => void }) {
  const setup = useResource(open ? `setup:${businessUnitId}:return-reasons` : null, () => fetchSetupLookups(businessUnitId));
  return (
    <Dialog open={open} size="lg" title="Return Reasons" onClose={onClose}>
      {setup.data ? <SimpleMastersPanel kind="return-reasons" businessUnitId={businessUnitId} lookups={setup.data} onChanged={setup.reload} /> : <LoadingState />}
    </Dialog>
  );
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

function SummaryRow({ label, value, strong }: { label: string; value: number; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className={strong ? "font-semibold text-ink" : "text-ink-muted"}>{label}</dt>
      <dd className={cn("tabular-nums", strong ? "text-base font-semibold text-ink" : "text-ink")}>{formatAmount(value)}</dd>
    </div>
  );
}

function useSaver(existing: ReturnDetail | null) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  async function submit(input: ReturnInput, onSavedNew?: () => void) {
    setBusy(true);
    try {
      const saved = existing ? await updateReturn(existing.id, existing.updatedAt, input) : await createReturn(input);
      toast.success(`${saved.number} saved. It credits the customer once approved.`);
      if (onSavedNew) {
        onSavedNew();
        setBusy(false);
        return;
      }
      router.replace(paths.salesReturn(saved.id));
    } catch (error) {
      toast.error(errorMessage(error));
      setBusy(false);
    }
  }
  return { busy, submit, toast };
}

// ─── Full / partial return of a delivery ─────────────────────────────────────

function ReferencedReturnForm({ deliveryId, mode, today, existing }: { deliveryId: string; mode: "FULL" | "PARTIAL"; today: string; existing: ReturnDetail | null }) {
  const delivery = useResource(`return-delivery:${deliveryId}:${existing?.id ?? ""}`, () => fetchDeliveryForReturn(deliveryId, existing?.id));
  const warehouses = useResource("warehouses", fetchWarehouses);
  const title = mode === "FULL" ? "Full Return" : "Partial Return";
  const error = delivery.error ?? warehouses.error;
  if (error) return <Failed title={title} message={errorMessage(error)} onRetry={delivery.reload} />;
  if (!delivery.data || !warehouses.data) return <Loading title={title} />;
  return <ReferencedEditor mode={mode} today={today} delivery={delivery.data} warehouses={warehouses.data} existing={existing} />;
}

function ReferencedEditor({
  mode,
  today,
  delivery,
  warehouses,
  existing,
}: {
  mode: "FULL" | "PARTIAL";
  today: string;
  delivery: DeliveryForReturn;
  warehouses: WarehouseOption[];
  existing: ReturnDetail | null;
}) {
  const { busy, submit, toast } = useSaver(existing);
  const setup = useResource(`setup:${delivery.businessUnitId}`, () => fetchSetupLookups(delivery.businessUnitId));
  const [header, setHeader] = useState(() =>
    headerFrom(existing, {
      returnDate: today < delivery.deliveryDate ? delivery.deliveryDate : today,
      officeId: delivery.officeId,
      warehouseId: delivery.warehouseId ?? warehouses.find((warehouse) => warehouse.officeId === delivery.officeId)?.id ?? "",
      salesPersonId: delivery.salesPersonId ?? "",
    }),
  );
  const own = new Map((existing?.lines ?? []).map((line) => [line.deliveryLineId, line]));
  const [quantities, setQuantities] = useState<Record<string, string>>(() =>
    Object.fromEntries(delivery.lines.map((line) => [line.deliveryLineId, mode === "FULL" ? String(line.returnable) : numberText(own.get(line.deliveryLineId)?.qty)])),
  );
  const [reasons, setReasons] = useState<Record<string, string>>(() => Object.fromEntries(delivery.lines.map((line) => [line.deliveryLineId, own.get(line.deliveryLineId)?.reason ?? ""])));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [reasonsOpen, setReasonsOpen] = useState(false);
  const set = <K extends keyof HeaderValues>(key: K, value: HeaderValues[K]) => setHeader((current) => ({ ...current, [key]: value }));

  const nothingLeft = delivery.lines.every((line) => line.returnable <= 0);
  const fullBlocked = mode === "FULL" && delivery.lines.some((line) => line.returnedQty > 0);
  const lineValue = (line: DeliveryForReturn["lines"][number]) => (line.deliveredQty > 0 ? round2((line.amount * toNumber(quantities[line.deliveryLineId] ?? "")) / line.deliveredQty) : 0);
  const itemsTotal = round2(delivery.lines.reduce((sum, line) => sum + lineValue(line), 0));
  const discount = discountShare(delivery.discountAmount, delivery.itemsTotal, itemsTotal);
  const totalQty = delivery.lines.reduce((sum, line) => sum + toNumber(quantities[line.deliveryLineId] ?? ""), 0);

  async function save() {
    if (busy) return;
    const chosen = delivery.lines.filter((line) => (quantities[line.deliveryLineId] ?? "").trim() !== "" && toNumber(quantities[line.deliveryLineId]) !== 0);
    const over = chosen.find((line) => toNumber(quantities[line.deliveryLineId]) > line.returnable + 1e-9);
    if (over) {
      setErrors({ [`qty.${over.deliveryLineId}`]: `At most ${formatQty(over.returnable)}.` });
      toast.error(`${over.itemName}: only ${formatQty(over.returnable)} can be returned.`);
      return;
    }
    const input = {
      mode,
      deliveryId: delivery.id,
      ...headerInput(header),
      lines: chosen.map((line) => ({ deliveryLineId: line.deliveryLineId, qty: requiredNumber(quantities[line.deliveryLineId]), reason: reasons[line.deliveryLineId] })),
    };
    const parsed = referencedReturnSchema.safeParse(input);
    if (!parsed.success) {
      const next = issuesToErrors(parsed.error);
      setErrors(next);
      toast.error(Object.values(next)[0] ?? "Please correct the highlighted fields.");
      return;
    }
    setErrors({});
    await submit(input);
  }
  useSaveShortcut(save, !nothingLeft && !fullBlocked);

  const title = existing ? `Edit ${existing.number}` : mode === "FULL" ? "Full Return" : "Partial Return";
  return (
    <PageContainer className="max-w-none">
      <PageHead
        title={<BackTitle href={existing ? paths.salesReturn(existing.id) : paths.returnTab("deliveries")}>{title}</BackTitle>}
        subtitle={`Invoice ${delivery.number}${delivery.challanNo ? ` · Challan ${delivery.challanNo}` : ""} · ${delivery.customerName} · delivered ${formatDay(delivery.deliveryDate)}`}
        actions={
          <Button variant="primary" onClick={save} loading={busy} disabled={nothingLeft || fullBlocked}>
            Save
          </Button>
        }
      />

      {(nothingLeft || fullBlocked) && (
        <p role="alert" className="mb-3 rounded-lg bg-control px-3 py-2 text-sm text-ink">
          {nothingLeft ? "Everything on this delivery is already returned (pending or approved)." : "Part of this delivery is already returned. "}
          {fullBlocked && !nothingLeft && (
            <Link href={paths.returnDelivery(delivery.id, "partial")} className="underline underline-offset-2">
              Make a partial return instead.
            </Link>
          )}
        </p>
      )}

      <div className="flex flex-col gap-4">
        <Card>
          <Section>
            <HeaderFields
              values={header}
              errors={errors}
              set={set}
              warehouses={warehouses}
              salesPersons={setup.data?.salesPersons ?? []}
              officeField={<TextField label="Office" value={delivery.officeName} readOnly tabIndex={-1} />}
            >
              <TextField label="Customer" value={`${delivery.customerCode} - ${delivery.customerName}`} readOnly tabIndex={-1} />
            </HeaderFields>
          </Section>
        </Card>

        <Card>
          <Section
            title="Items"
            description={mode === "FULL" ? "A full return takes back everything delivered." : "Enter the quantity coming back for each item (leave blank to skip)."}
            actions={
              <Button size="sm" onClick={() => setReasonsOpen(true)}>
                <Settings2 aria-hidden="true" />
                Return Reasons
              </Button>
            }
          >
            <div className="overflow-x-auto rounded-lg border border-line">
              <table className="w-full min-w-[1000px] text-sm">
                <thead className="bg-canvas text-xs text-ink-muted">
                  <tr className="border-b border-line">
                    {["Item Code", "Item Name", "UoM", "Delivered", "Returned", "Returnable", "Return Qty", "Price", "VAT %", "Return Reason", "Total"].map((label, index) => (
                      <th key={label} scope="col" className={cn("px-2 py-2 font-medium", index >= 3 && index !== 9 ? "text-right" : "text-left")}>
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {delivery.lines.map((line) => {
                    const error = errors[`qty.${line.deliveryLineId}`];
                    return (
                      <tr key={line.deliveryLineId} className="align-top">
                        <td className="px-2 py-2 whitespace-nowrap text-ink-muted">{line.itemCode}</td>
                        <td className="px-2 py-2 text-ink">{line.itemName}</td>
                        <td className="px-2 py-2 text-ink-muted">{line.uom ?? "—"}</td>
                        <td className="px-2 py-2 text-right tabular-nums">{formatQty(line.deliveredQty)}</td>
                        <td className="px-2 py-2 text-right text-ink-muted tabular-nums">{formatQty(line.returnedQty)}</td>
                        <td className="px-2 py-2 text-right tabular-nums">{formatQty(line.returnable)}</td>
                        <td className="w-28 px-2 py-1.5">
                          <input
                            aria-label={`Return quantity of ${line.itemName}`}
                            type="number"
                            min={0}
                            max={line.returnable}
                            step="any"
                            value={quantities[line.deliveryLineId] ?? ""}
                            readOnly={mode === "FULL"}
                            disabled={line.returnable <= 0}
                            onChange={(event) => setQuantities({ ...quantities, [line.deliveryLineId]: event.target.value })}
                            className={cn(CONTROL, "h-7 w-full text-right tabular-nums", error && "ring-1 ring-danger")}
                          />
                          {error && <p className="mt-0.5 text-xs text-danger">{error}</p>}
                        </td>
                        <td className="px-2 py-2 text-right tabular-nums">{line.rate.toFixed(2)}</td>
                        <td className="px-2 py-2 text-right tabular-nums">{line.vatPercent.toFixed(2)}</td>
                        <td className="w-44 px-2 py-1.5">
                          <select
                            aria-label={`Return reason of ${line.itemName}`}
                            value={reasons[line.deliveryLineId] ?? ""}
                            onChange={(event) => setReasons({ ...reasons, [line.deliveryLineId]: event.target.value })}
                            className={cn(CONTROL, "h-7 w-full")}
                          >
                            <option value="">—</option>
                            {[...new Set([...(setup.data?.returnReasons ?? []).map((reason) => reason.name), reasons[line.deliveryLineId]].filter(Boolean))].map((name) => (
                              <option key={name} value={name}>
                                {name}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-2 py-2 text-right font-medium text-ink tabular-nums">{formatAmount(lineValue(line))}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="border-t border-line-strong bg-canvas font-medium text-ink">
                  <tr>
                    <td colSpan={6} className="px-2 py-2 text-right">
                      Total
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums">{formatQty(Math.round(totalQty * 1000) / 1000)}</td>
                    <td colSpan={3} />
                    <td className="px-2 py-2 text-right tabular-nums">{formatAmount(itemsTotal)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
            {errors.lines && <p className="text-xs text-danger">{errors.lines}</p>}
          </Section>
        </Card>

        <div className="grid gap-4 lg:grid-cols-[1fr_22rem]">
          <p className="text-sm text-ink-muted">
            Prices, discounts and VAT come from the delivery. The return is saved as <span className="font-medium text-ink">Pending</span>; on approval the goods go
            back into the warehouse and the customer is credited.
          </p>
          <Card className="p-4">
            <dl className="flex flex-col gap-1.5 text-sm">
              <SummaryRow label="Item Total" value={itemsTotal} />
              <SummaryRow label="Less: Discount Share" value={discount} />
              <div className="mt-1 border-t border-line pt-2">
                <SummaryRow label="Return Total" value={round2(itemsTotal - discount)} strong />
              </div>
            </dl>
          </Card>
        </div>
      </div>
      <ReasonsDialog open={reasonsOpen} businessUnitId={delivery.businessUnitId} onClose={() => { setReasonsOpen(false); setup.reload(); }} />
    </PageContainer>
  );
}

// ─── Return without reference ────────────────────────────────────────────────

interface LineValues {
  key: string;
  itemId: string;
  qty: string;
  rate: string;
  vatPercent: string;
  reason: string;
}

function WithoutReferenceLoader({ today, existing }: { today: string; existing: ReturnDetail | null }) {
  const lookups = useResource("sales-lookups", fetchSalesLookups);
  const warehouses = useResource("warehouses", fetchWarehouses);
  const title = existing ? `Edit ${existing.number}` : "Create Sales Return Without Ref.";
  const error = lookups.error ?? warehouses.error;
  if (error) return <Failed title={title} message={errorMessage(error)} onRetry={lookups.reload} />;
  if (!lookups.data || !warehouses.data) return <Loading title={title} />;
  return <WithoutReferenceEditor today={today} lookups={lookups.data} warehouses={warehouses.data} existing={existing} />;
}

function WithoutReferenceEditor({ today, lookups, warehouses, existing }: { today: string; lookups: SalesLookups; warehouses: WarehouseOption[]; existing: ReturnDetail | null }) {
  const { busy, submit, toast } = useSaver(existing);
  const [header, setHeader] = useState(() => {
    const office = lookups.offices[0];
    return headerFrom(existing, {
      returnDate: today,
      officeId: office?.id ?? "",
      warehouseId: warehouses.find((warehouse) => warehouse.officeId === office?.id)?.id ?? "",
    });
  });
  const [kind, setKind] = useState<ReturnKind>(existing?.kind ?? "SALES");
  const [customerId, setCustomerId] = useState(existing?.customerId ?? "");
  const [shippingAddress, setShippingAddress] = useState(existing?.shippingAddress ?? "");
  const [priceIncludesVat, setPriceIncludesVat] = useState(existing?.priceIncludesVat ?? true);
  const [withoutInvoice, setWithoutInvoice] = useState(existing?.withoutInvoice ?? false);
  const [lines, setLines] = useState<LineValues[]>(() =>
    (existing?.lines ?? []).map((line) => ({
      key: line.id,
      itemId: line.itemId,
      qty: String(line.qty),
      rate: String(line.rate),
      vatPercent: String(line.vatPercent),
      reason: line.reason ?? "",
    })),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [reasonsOpen, setReasonsOpen] = useState(false);
  /** Reason given to every line at once (and to new lines). */
  const [bulkReason, setBulkReason] = useState("");
  const set = <K extends keyof HeaderValues>(key: K, value: HeaderValues[K]) => setHeader((current) => ({ ...current, [key]: value }));

  const office = lookups.offices.find((candidate) => candidate.id === header.officeId);
  const businessUnitId = office?.businessUnitId ?? null;
  const masters = useResource(businessUnitId && `return-masters:${businessUnitId}`, async () => {
    const [setup, customers, items] = await Promise.all([fetchSetupLookups(businessUnitId!), fetchCustomers(businessUnitId!), fetchItems(businessUnitId!, true)]);
    return { setup, customers, items };
  });
  const customers = useMemo(() => masters.data?.customers ?? [], [masters.data]);
  const items = useMemo(() => masters.data?.items ?? [], [masters.data]);
  const itemById = useMemo(() => new Map(items.map((item) => [item.id, item])), [items]);
  const customer = customers.find((candidate) => candidate.id === customerId);

  const computed = lines.map((line) => {
    const vat = withoutInvoice ? 0 : toNumber(line.vatPercent);
    return { line, vat, ...returnLineAmounts(toNumber(line.qty), toNumber(line.rate), vat, priceIncludesVat) };
  });
  const total = round2(computed.reduce((sum, row) => sum + row.amount, 0));
  const totalVat = round2(computed.reduce((sum, row) => sum + row.vatAmount, 0));
  const totalBase = round2(computed.reduce((sum, row) => sum + row.baseAmount, 0));
  const totalQty = lines.reduce((sum, line) => sum + toNumber(line.qty), 0);

  function changeOffice(officeId: string) {
    const next = lookups.offices.find((candidate) => candidate.id === officeId);
    const sameUnit = next?.businessUnitId === office?.businessUnitId;
    setHeader((current) => ({
      ...current,
      officeId,
      warehouseId: warehouses.find((warehouse) => warehouse.officeId === officeId)?.id ?? "",
      salesPersonId: sameUnit ? current.salesPersonId : "",
    }));
    if (!sameUnit) {
      setCustomerId("");
      setLines([]);
    }
  }

  function selectCustomer(id: string) {
    const next = customers.find((candidate) => candidate.id === id);
    setCustomerId(id);
    setShippingAddress(next?.addresses.find((address) => address.isDefault)?.address ?? next?.address ?? "");
    if (next?.salesPersonId) set("salesPersonId", next.salesPersonId);
  }

  function resetForNext() {
    setHeader((current) => ({ ...current, reason: "", refNo: "", refDate: "", refAmount: "", requestNo: "", remarks: "" }));
    setCustomerId("");
    setShippingAddress("");
    setLines([]);
    setErrors({});
  }

  async function save(next = false) {
    if (busy) return;
    const input = {
      mode: "WITHOUT_REFERENCE" as const,
      kind,
      customerId,
      priceIncludesVat,
      withoutInvoice,
      shippingAddress,
      ...headerInput(header),
      lines: lines.map((line) => ({
        itemId: line.itemId,
        qty: requiredNumber(line.qty),
        rate: requiredNumber(line.rate),
        vatPercent: requiredNumber(line.vatPercent || "0"),
        reason: line.reason,
      })),
    };
    const parsed = withoutReferenceSchema.safeParse(input);
    if (!parsed.success) {
      const next = issuesToErrors(parsed.error);
      setErrors(next);
      toast.error(Object.values(next)[0] ?? "Please correct the highlighted fields.");
      return;
    }
    setErrors({});
    await submit(input, next ? resetForNext : undefined);
  }
  useSaveShortcut(() => save(), true);

  const update = (key: string, patch: Partial<LineValues>) => setLines((current) => current.map((line) => (line.key === key ? { ...line, ...patch } : line)));
  const title = existing ? "Edit Sales Return WithOut Ref." : "Create Sales Return WithOut Ref.";
  const reasonNames = (masters.data?.setup.returnReasons ?? []).map((reason) => reason.name);
  const area = (id: string | null | undefined) => (id ? masters.data?.setup.areas.find((candidate) => candidate.id === id)?.name : undefined);
  const group = customer?.customerGroupId ? masters.data?.setup.customerGroups.find((candidate) => candidate.id === customer.customerGroupId)?.name : undefined;

  return (
    <PageContainer className="max-w-none">
      <PageHead
        title={<BackTitle href={existing ? paths.salesReturn(existing.id) : paths.returnTab("returns")}>{title}</BackTitle>}
        subtitle={existing ? existing.number : undefined}
        actions={
          <>
            <Button variant="accent-soft" onClick={() => save(true)} disabled={busy}>
              <SaveAll aria-hidden="true" />
              Save &amp; New
            </Button>
            <Button variant="primary" onClick={() => save()} loading={busy}>
              SAVE
            </Button>
          </>
        }
      />

      <div className="flex flex-col gap-4">
        <Card>
          <Section>
            {customer && (
              <p className="flex flex-wrap justify-end gap-x-6 text-sm text-ink">
                <span>Customer Group : {group ?? "N/A"}</span>
                <span>Territory Name : {area(customer.territoryId) ?? "N/A"}</span>
              </p>
            )}
            <div className="flex flex-wrap gap-x-6 gap-y-2">
              <CheckboxField label="Price Including VAT" checked={priceIncludesVat} onChange={(event) => setPriceIncludesVat(event.target.checked)} />
              <CheckboxField
                label="Without Invoice"
                hint="The customer has no invoice for these goods: no VAT is credited."
                checked={withoutInvoice}
                onChange={(event) => setWithoutInvoice(event.target.checked)}
              />
            </div>
            <HeaderFields
              values={header}
              errors={errors}
              set={set}
              warehouses={warehouses}
              salesPersons={masters.data?.setup.salesPersons ?? []}
              officeField={
                <SelectField
                  label="Office"
                  required
                  value={header.officeId}
                  error={errors.officeId}
                  disabled={Boolean(existing)}
                  options={[{ value: "", label: "Select an office" }, ...lookups.offices.map((candidate) => ({ value: candidate.id, label: candidate.name }))]}
                  onChange={(event) => changeOffice(event.target.value)}
                />
              }
            >
              <SelectField
                label="Return Type"
                required
                value={kind}
                disabled={Boolean(existing)}
                hint={kind === "MARKET" ? "Stock comes in after the factory receives it and QC passes it." : undefined}
                options={RETURN_KINDS.map((value) => ({ value, label: RETURN_KIND_LABELS[value] }))}
                onChange={(event) => setKind(event.target.value as ReturnKind)}
              />
              <div className="lg:col-span-2">
                <SearchPick
                  key={`${businessUnitId}:${customers.length}`}
                  label="Select Customer"
                  required
                  error={errors.customerId}
                  disabled={!businessUnitId || masters.loading}
                  placeholder={masters.loading ? "Loading…" : "Select Partner (min 3 letters)"}
                  options={[
                    ...(existing && !customers.some((candidate) => candidate.id === existing.customerId) ? [{ id: existing.customerId, label: existing.customerName }] : []),
                    ...customers.map((candidate) => ({ id: candidate.id, label: `${candidate.code}-${candidate.name}${candidate.phone ? ` (${candidate.phone})` : ""}` })),
                  ]}
                  selectedId={customerId}
                  onPick={(id) => selectCustomer(id ?? "")}
                />
              </div>
              <SelectField
                label="Shipping Address"
                value={shippingAddress}
                error={errors.shippingAddress}
                disabled={!customer}
                options={[
                  { value: "", label: "None" },
                  ...[...new Set([...(customer?.addresses ?? []).map((address) => address.address), customer?.address, shippingAddress].filter((value): value is string => Boolean(value)))].map((address) => ({ value: address, label: address })),
                ]}
                onChange={(event) => setShippingAddress(event.target.value)}
              />
            </HeaderFields>
          </Section>
        </Card>

        <Card>
          <Section>
            <ReturnItemEntry
              items={items}
              setup={masters.data?.setup}
              disabled={!businessUnitId || masters.loading}
              withoutInvoice={withoutInvoice}
              onManageReasons={() => setReasonsOpen(true)}
              onAdd={(line) => setLines((current) => [...current, { ...line, reason: line.reason || bulkReason, key: newKey() }])}
            />
            <div className="flex flex-wrap items-end justify-end gap-x-4 gap-y-2 border-t border-line pt-3">
              <div className="flex w-full max-w-md flex-col gap-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-ink-muted">
                    Return Reason{" "}
                    <button type="button" className="ml-2 font-semibold text-success hover:underline" disabled={!businessUnitId} onClick={() => setReasonsOpen(true)}>
                      See All
                    </button>
                  </span>
                  <button type="button" className="font-medium text-accent-strong hover:underline" disabled={!businessUnitId} onClick={() => setReasonsOpen(true)}>
                    <Plus aria-hidden="true" className="inline size-3.5" /> ADD
                  </button>
                </div>
                <select
                  aria-label="Return reason for all items"
                  value={bulkReason}
                  onChange={(event) => {
                    setBulkReason(event.target.value);
                    if (event.target.value) setLines((current) => current.map((line) => ({ ...line, reason: event.target.value })));
                  }}
                  className={cn(CONTROL, "h-8")}
                >
                  <option value="">returnReason</option>
                  {reasonNames.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              </div>
              <p className="text-lg font-semibold text-ink tabular-nums">Total Amount :{formatAmount(total)}</p>
            </div>
            {lines.length === 0 ? (
              <EmptyState title="No items yet" />
            ) : (
              <div className="overflow-x-auto rounded-lg border border-line">
                <table className="w-full min-w-[960px] text-sm">
                  <thead className="bg-accent-soft text-xs text-ink">
                    <tr className="border-b border-line">
                      {["Item Code", "Name", "Return Reason", "Return Qty", "Cost Price (BDT)", "Return Price (BDT)", "VAT %", "VAT", "Total", ""].map((label, index) => (
                        <th key={index} scope="col" className={cn("px-2 py-2 font-semibold", index >= 3 && index < 9 ? "text-right" : "text-left")}>
                          {label || <span className="sr-only">Remove</span>}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {computed.map(({ line, vatAmount, amount }, index) => {
                      const item = itemById.get(line.itemId);
                      const rowError = ["itemId", "qty", "rate", "vatPercent"].map((field) => errors[`lines.${index}.${field}`]).find(Boolean);
                      return (
                        <tr key={line.key} className="align-top">
                          <td className="px-2 py-2 whitespace-nowrap text-ink-muted">{item?.code ?? "—"}</td>
                          <td className="px-2 py-2 text-ink">
                            {item?.name ?? existing?.lines.find((candidate) => candidate.itemId === line.itemId)?.itemName ?? "—"}
                            {rowError && <p className="mt-0.5 text-xs text-danger">{rowError}</p>}
                          </td>
                          <td className="w-44 px-2 py-1.5">
                            <select aria-label={`Return reason, row ${index + 1}`} value={line.reason} onChange={(event) => update(line.key, { reason: event.target.value })} className={cn(CONTROL, "h-7 w-full")}>
                              <option value="">—</option>
                              {[...new Set([...(masters.data?.setup.returnReasons ?? []).map((reason) => reason.name), line.reason].filter(Boolean))].map((name) => (
                                <option key={name} value={name}>
                                  {name}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="w-28 px-2 py-1.5">
                            <input aria-label={`Quantity, row ${index + 1}`} type="number" min={0} step="any" value={line.qty} onChange={(event) => update(line.key, { qty: event.target.value })} className={cn(CONTROL, "h-7 w-full text-right tabular-nums")} />
                          </td>
                          <td className="px-2 py-2 text-right tabular-nums">{item?.costPrice === null || item?.costPrice === undefined ? "—" : formatAmount(item.costPrice)}</td>
                          <td className="w-28 px-2 py-1.5">
                            <input aria-label={`Return price, row ${index + 1}`} type="number" min={0} step="any" value={line.rate} onChange={(event) => update(line.key, { rate: event.target.value })} className={cn(CONTROL, "h-7 w-full text-right tabular-nums")} />
                          </td>
                          <td className="w-24 px-2 py-1.5">
                            <input
                              aria-label={`VAT %, row ${index + 1}`}
                              type="number"
                              min={0}
                              max={100}
                              step="any"
                              value={withoutInvoice ? "0" : line.vatPercent}
                              disabled={withoutInvoice}
                              onChange={(event) => update(line.key, { vatPercent: event.target.value })}
                              className={cn(CONTROL, "h-7 w-full text-right tabular-nums")}
                            />
                          </td>
                          <td className="px-2 py-2 text-right tabular-nums">{formatAmount(vatAmount)}</td>
                          <td className="px-2 py-2 text-right font-medium text-ink tabular-nums">{formatAmount(amount)}</td>
                          <td className="px-2 py-1.5">
                            <Button variant="ghost" size="icon" aria-label={`Remove row ${index + 1}`} onClick={() => setLines((current) => current.filter((candidate) => candidate.key !== line.key))}>
                              <Trash2 />
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="border-t border-line-strong bg-canvas font-medium text-ink">
                    <tr>
                      <td colSpan={3} className="px-2 py-2 text-right">
                        Total
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums">{formatQty(Math.round(totalQty * 1000) / 1000)}</td>
                      <td colSpan={3} />
                      <td className="px-2 py-2 text-right tabular-nums">{formatAmount(totalVat)}</td>
                      <td className="px-2 py-2 text-right tabular-nums">{formatAmount(total)}</td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
            {errors.lines && <p className="text-xs text-danger">{errors.lines}</p>}
          </Section>
        </Card>

        <div className="grid gap-4 lg:grid-cols-[1fr_22rem]">
          <p className="text-sm text-ink-muted">
            The return is saved as <span className="font-medium text-ink">Pending</span>. On approval the customer is credited;{" "}
            {kind === "MARKET" ? "the goods enter stock after factory receipt and QC." : "the goods go back into the warehouse."}
          </p>
          <Card className="p-4">
            <dl className="flex flex-col gap-1.5 text-sm">
              <SummaryRow label="Item Total (Without VAT)" value={totalBase} />
              <SummaryRow label="Total VAT" value={totalVat} />
              <div className="mt-1 border-t border-line pt-2">
                <SummaryRow label="Total Amount" value={total} strong />
              </div>
            </dl>
          </Card>
        </div>
      </div>
      {businessUnitId && (
        <ReasonsDialog
          open={reasonsOpen}
          businessUnitId={businessUnitId}
          onClose={() => {
            setReasonsOpen(false);
            masters.reload();
          }}
        />
      )}
    </PageContainer>
  );
}

/** Category filters, price type, item search and the return price of one item. */
function ReturnItemEntry({
  items,
  setup,
  disabled,
  withoutInvoice,
  onManageReasons,
  onAdd,
}: {
  items: ItemOption[];
  setup: SetupLookups | undefined;
  disabled: boolean;
  withoutInvoice: boolean;
  onManageReasons: () => void;
  onAdd: (line: Omit<LineValues, "key">) => void;
}) {
  const listId = useId();
  const [category, setCategory] = useState<[string, string, string]>(["", "", ""]);
  const [itemType, setItemType] = useState("");
  const [brand, setBrand] = useState("");
  const [priceListId, setPriceListId] = useState("");
  const [itemText, setItemText] = useState("");
  const [entry, setEntry] = useState({ qty: "", rate: "", vatPercent: "", reason: "" });
  const distinct = (values: (string | null)[]) => [...new Set(values.filter((value): value is string => Boolean(value)))].sort();
  const itemTypes = useMemo(() => distinct(items.map((candidate) => candidate.itemType)), [items]);
  const brands = useMemo(() => distinct(items.map((candidate) => candidate.brand)), [items]);
  const [error, setError] = useState<string>();

  const categories = useMemo(() => setup?.categories ?? [], [setup]);
  const effectivePriceList = priceListId || setup?.priceLists.find((list) => list.isDefault)?.id || "";
  const chosen = category[2] || category[1] || category[0];
  const allowed = useMemo(() => {
    if (!chosen) return null;
    const ids = new Set([chosen]);
    let grew = true;
    while (grew) {
      grew = false;
      for (const candidate of categories) {
        if (candidate.parentId && ids.has(candidate.parentId) && !ids.has(candidate.id)) {
          ids.add(candidate.id);
          grew = true;
        }
      }
    }
    return ids;
  }, [chosen, categories]);
  const visible = items.filter(
    (candidate) =>
      (!allowed || (candidate.categoryId && allowed.has(candidate.categoryId))) &&
      (!itemType || candidate.itemType === itemType) &&
      (!brand || candidate.brand === brand),
  );
  // As in Managerium, suggestions start after 3 letters.
  const searching = itemText.trim().length >= 3;
  const label = (item: ItemOption) => `${item.code} — ${item.name}`;
  const item = items.find((candidate) => label(candidate) === itemText);
  const tp = item ? rateFor(item, effectivePriceList) : null;

  function pick(text: string) {
    setItemText(text);
    const match = items.find((candidate) => label(candidate) === text);
    if (match) setEntry((current) => ({ ...current, qty: current.qty || "1", rate: String(rateFor(match, effectivePriceList)), vatPercent: String(match.vatPercent) }));
  }

  function add() {
    if (!item) return setError("Select an item from the list.");
    if (!(toNumber(entry.qty) > 0)) return setError("Quantity must be more than 0.");
    if (entry.rate.trim() === "" || toNumber(entry.rate) < 0) return setError("Enter the return price.");
    onAdd({ itemId: item.id, qty: entry.qty, rate: entry.rate, vatPercent: entry.vatPercent || "0", reason: entry.reason });
    setItemText("");
    setEntry({ qty: "", rate: "", vatPercent: "", reason: entry.reason });
    setError(undefined);
  }

  const level = (depth: 0 | 1 | 2) => {
    const parent = depth === 0 ? null : category[depth - 1];
    const choices = categories.filter((candidate) => candidate.level === depth + 1 && (depth === 0 || candidate.parentId === parent));
    return (
      <SelectField
        label={CATEGORY_LEVEL_LABELS[depth + 1]}
        value={category[depth]}
        disabled={disabled || (depth > 0 && !parent)}
        options={[{ value: "", label: "All" }, ...choices.map((candidate) => ({ value: candidate.id, label: candidate.name }))]}
        onChange={(event) => {
          const next = [...category] as [string, string, string];
          next[depth] = event.target.value;
          for (let index = depth + 1; index < 3; index++) next[index] = "";
          setCategory(next);
        }}
      />
    );
  };

  return (
    <div className="flex flex-col gap-3 rounded-lg bg-canvas p-3">
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <SelectField
          label="Item Type"
          value={itemType}
          disabled={disabled}
          options={[{ value: "", label: "Item Type" }, ...itemTypes.map((value) => ({ value, label: value }))]}
          onChange={(event) => setItemType(event.target.value)}
        />
        {level(0)}
        {level(1)}
        {level(2)}
        <SelectField
          label="Brand"
          value={brand}
          disabled={disabled}
          options={[{ value: "", label: "Brand" }, ...brands.map((value) => ({ value, label: value }))]}
          onChange={(event) => setBrand(event.target.value)}
        />
        <SelectField
          label="Price Type"
          value={effectivePriceList}
          disabled={disabled}
          options={[{ value: "", label: "Default sales rate" }, ...(setup?.priceLists ?? []).map((list) => ({ value: list.id, label: list.name }))]}
          onChange={(event) => setPriceListId(event.target.value)}
        />
      </div>
      <div
        className="grid items-end gap-3 sm:grid-cols-3 lg:grid-cols-[minmax(16rem,2fr)_repeat(6,minmax(5rem,1fr))_minmax(10rem,1.5fr)_auto]"
        onKeyDown={(event) => {
          if (event.key === "Enter" && (event.target as HTMLElement).tagName === "INPUT") {
            event.preventDefault();
            add();
          }
        }}
      >
        <div className="flex flex-col gap-1 sm:col-span-3 lg:col-span-1">
          <label htmlFor={`${listId}-item`} className="text-xs text-ink-muted">
            Select Item <span className="text-danger">*</span>
          </label>
          <input
            id={`${listId}-item`}
            list={listId}
            value={itemText}
            disabled={disabled}
            placeholder={disabled ? "Select an office first" : "Select/Search Item (min 3 letters)"}
            onChange={(event) => pick(event.target.value)}
            className={cn(CONTROL, "h-7")}
          />
          <datalist id={listId}>
            {(searching ? visible : []).map((candidate) => (
              <option key={candidate.id} value={label(candidate)} />
            ))}
          </datalist>
        </div>
        <TextField label="Quantity" required type="number" min={0} step="any" value={entry.qty} disabled={disabled} onChange={(event) => setEntry({ ...entry, qty: event.target.value })} />
        <TextField label="Cost Price (BDT)" value={item?.costPrice === null || !item ? "" : formatAmount(item.costPrice)} readOnly tabIndex={-1} />
        <TextField label="MRP" value={item?.mrp === null || !item ? "" : formatAmount(item.mrp)} readOnly tabIndex={-1} />
        <TextField label="TP" value={tp === null ? "" : formatAmount(tp)} readOnly tabIndex={-1} />
        <TextField label="Return Price (BDT)" required type="number" min={0} step="any" value={entry.rate} disabled={disabled} onChange={(event) => setEntry({ ...entry, rate: event.target.value })} />
        <TextField
          label="VAT (%)"
          type="number"
          min={0}
          max={100}
          step="any"
          value={withoutInvoice ? "0" : entry.vatPercent}
          disabled={disabled || withoutInvoice}
          onChange={(event) => setEntry({ ...entry, vatPercent: event.target.value })}
        />
        <ReasonSelect label="Return Reason" value={entry.reason} reasons={setup?.returnReasons ?? []} onChange={(reason) => setEntry({ ...entry, reason })} onManage={onManageReasons} />
        <Button onClick={add} disabled={disabled}>
          <Plus aria-hidden="true" />
          Add
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
