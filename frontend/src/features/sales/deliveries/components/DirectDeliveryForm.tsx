"use client";

import { ArrowLeft, Plus, Trash2, UserPlus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useMemo, useState } from "react";
import { PageContainer, PageHead } from "@/components/layout/page";
import { Button, buttonClasses } from "@/components/ui/button";
import { CONTROL, CheckboxField, SelectField, TextField } from "@/components/ui/form-field";
import { Indicator } from "@/components/ui/indicator";
import { Card, EmptyState, ErrorState, LoadingState, Section } from "@/components/ui/section";
import { useToast } from "@/components/ui/toast";
import { useResource } from "@/hooks/use-resource";
import { useSaveShortcut } from "@/hooks/use-save-shortcut";
import { errorMessage } from "@/lib/api/client";
import { cn } from "@/lib/cn";
import { formatAmount } from "../../dashboard/lib/format";
import { issuesToErrors, requiredNumber } from "../../lib/form";
import type { CustomerOption, ItemOption, SalesLookups } from "../../masters/schemas/masters.schema";
import { fetchCustomerCredit, fetchCustomers, fetchItems, fetchSalesLookups, fetchSetupLookups } from "../../masters/services/masters.api";
import { ItemEntry, LinesGrid, type LineValues } from "../../orders/components/OrderFormView";
import { orderTotals } from "../../orders/lib/order-totals";
import { paths } from "../../paths";
import { round2 } from "../../quotations/lib/totals";
import { CustomerDialog } from "../../setup/components/CustomerDialog";
import { directDeliverySchema, exchangeSchema, type DeliveryDetail, type WarehouseOption } from "../schemas/delivery.schema";
import { createDelivery, fetchDelivery, fetchWarehouses, updateDelivery } from "../services/delivery.api";
import { DeliverySummary, TransportSection, blankHeader, headerFromDelivery, headerInput, nowTime, type HeaderValues } from "./DeliveryFormParts";

type Mode = "DIRECT" | "EXCHANGE";

/** Direct delivery (no sales order) or exchange; new or editing. */
export function DirectDeliveryFormView({ mode, deliveryId, today }: { mode: Mode; deliveryId?: string; today: string }) {
  const lookups = useResource("sales-lookups", fetchSalesLookups);
  const warehouses = useResource("warehouses", fetchWarehouses);
  const delivery = useResource(deliveryId ?? null, () => fetchDelivery(deliveryId!));
  const error = lookups.error ?? warehouses.error ?? delivery.error;
  const title = mode === "EXCHANGE" ? "Exchange" : "Direct Delivery";

  if (error) {
    return (
      <PageContainer>
        <PageHead title={title} />
        <Card>
          <ErrorState message={errorMessage(error)} onRetry={lookups.reload} />
        </Card>
      </PageContainer>
    );
  }
  if (!lookups.data || !warehouses.data || (deliveryId && !delivery.data)) {
    return (
      <PageContainer>
        <PageHead title={title} />
        <LoadingState />
      </PageContainer>
    );
  }
  return (
    <DirectEditor
      key={delivery.data?.updatedAt ?? "new"}
      mode={mode}
      today={today}
      lookups={lookups.data}
      warehouses={warehouses.data}
      delivery={delivery.data ?? null}
    />
  );
}

interface ReceivedValues {
  key: string;
  itemId: string;
  qty: string;
  rate: string;
}

const toNumber = (value: string) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};
const newKey = () => crypto.randomUUID();
/** Rate of an item for a price type (falls back to the default rate). */
const rateFor = (item: ItemOption, priceListId: string) => item.prices[priceListId] ?? item.salesRate;

function DirectEditor({
  mode,
  today,
  lookups,
  warehouses,
  delivery,
}: {
  mode: Mode;
  today: string;
  lookups: SalesLookups;
  warehouses: WarehouseOption[];
  delivery: DeliveryDetail | null;
}) {
  const router = useRouter();
  const toast = useToast();

  const [header, setHeader] = useState<HeaderValues>(() => {
    if (delivery) return headerFromDelivery(delivery);
    const office = lookups.offices[0];
    return {
      ...blankHeader(today, nowTime()),
      officeId: office?.id ?? "",
      warehouseId: warehouses.find((warehouse) => warehouse.officeId === office?.id)?.id ?? "",
      terms: office ? (lookups.orderTerms[office.businessUnitId] ?? "") : "",
    };
  });
  const [customerId, setCustomerId] = useState(delivery?.customerId ?? "");
  const [priceIncludesVat, setPriceIncludesVat] = useState(delivery?.priceIncludesVat ?? true);
  const [priceListId, setPriceListId] = useState("");
  const [discount, setDiscount] = useState(String(delivery?.discountAmount ?? 0));
  const [reason, setReason] = useState(delivery?.exchangeReturn?.reason ?? "");
  const [lines, setLines] = useState<LineValues[]>(() =>
    (delivery?.lines ?? []).map((line) => ({
      key: line.id,
      itemId: line.itemId,
      qty: String(line.qty),
      unitPrice: String(line.rate),
      discountPercent: String(line.discountPercent),
      vatPercent: String(line.vatPercent),
      aitPercent: String(line.aitPercent),
    })),
  );
  const [received, setReceived] = useState<ReceivedValues[]>(() =>
    (delivery?.exchangeReturn?.lines ?? []).map((line) => ({ key: line.id, itemId: line.itemId, qty: String(line.qty), rate: String(line.rate) })),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [customerDialog, setCustomerDialog] = useState(false);

  const office = lookups.offices.find((candidate) => candidate.id === header.officeId);
  const businessUnitId = office?.businessUnitId ?? null;
  const masters = useResource(businessUnitId && `delivery-masters:${businessUnitId}`, async () => {
    const [setup, customers, items] = await Promise.all([fetchSetupLookups(businessUnitId!), fetchCustomers(businessUnitId!), fetchItems(businessUnitId!)]);
    return { setup, customers, items };
  });
  const customers = useMemo(() => masters.data?.customers ?? [], [masters.data]);
  const items = useMemo(() => masters.data?.items ?? [], [masters.data]);
  const itemById = useMemo(() => new Map(items.map((item) => [item.id, item])), [items]);
  const customer = customers.find((candidate) => candidate.id === customerId);
  const credit = useResource(customerId ? `credit:${customerId}:${today}` : null, () => fetchCustomerCredit(customerId, today));
  const effectivePriceList = priceListId || masters.data?.setup.priceLists.find((list) => list.isDefault)?.id || "";

  const set = <K extends keyof HeaderValues>(key: K, value: HeaderValues[K]) => setHeader((current) => ({ ...current, [key]: value }));

  const totals = orderTotals(
    lines.map((line) => ({
      qty: toNumber(line.qty),
      unitPrice: toNumber(line.unitPrice),
      discountPercent: toNumber(line.discountPercent),
      vatPercent: toNumber(line.vatPercent),
      aitPercent: toNumber(line.aitPercent),
    })),
    { priceIncludesVat, discountAmount: toNumber(discount), deliveryCharge: toNumber(header.deliveryCharge), unloadingCharge: toNumber(header.unloadingCharge) },
  );
  const returnTotal = round2(received.reduce((sum, line) => sum + toNumber(line.qty) * toNumber(line.rate), 0));

  function selectCustomer(next: CustomerOption | undefined) {
    setCustomerId(next?.id ?? "");
    setHeader((current) => ({
      ...current,
      salesPersonId: next?.salesPersonId ?? current.salesPersonId,
      shipToAddressId: next?.addresses.find((address) => address.isDefault)?.id ?? "",
      contactPerson: next?.contactPerson ?? "",
      paymentTermDays: String(next?.creditDays ?? 0),
      paymentMethod: next && next.creditDays > 0 ? "CREDIT" : current.paymentMethod,
    }));
  }

  function addLine(line: Omit<LineValues, "key">) {
    setLines((current) => {
      const existing = current.find((candidate) => candidate.itemId === line.itemId);
      if (existing) {
        return current.map((candidate) => (candidate.key === existing.key ? { ...candidate, qty: String(toNumber(candidate.qty) + toNumber(line.qty)) } : candidate));
      }
      return [...current, { ...line, key: newKey() }];
    });
  }

  async function save() {
    if (busy) return;
    const common = {
      customerId,
      priceIncludesVat,
      discountAmount: requiredNumber(discount || "0"),
      ...headerInput(header),
      lines: lines.map((line) => ({
        itemId: line.itemId,
        qty: requiredNumber(line.qty),
        unitPrice: requiredNumber(line.unitPrice),
        discountPercent: requiredNumber(line.discountPercent || "0"),
        vatPercent: requiredNumber(line.vatPercent || "0"),
        aitPercent: requiredNumber(line.aitPercent || "0"),
      })),
    };
    const input =
      mode === "EXCHANGE"
        ? {
            deliveryType: "EXCHANGE" as const,
            ...common,
            reason,
            receivedLines: received.map((line) => ({ itemId: line.itemId, qty: requiredNumber(line.qty), rate: requiredNumber(line.rate) })),
          }
        : { deliveryType: "DIRECT" as const, ...common };
    const parsed = mode === "EXCHANGE" ? exchangeSchema.safeParse(input) : directDeliverySchema.safeParse(input);
    if (!parsed.success) {
      const next = issuesToErrors(parsed.error);
      setErrors(next);
      toast.error(Object.values(next)[0] ?? "Please correct the highlighted fields.");
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      const saved = delivery ? await updateDelivery(delivery.id, delivery.updatedAt, input) : await createDelivery(input);
      toast.success(`${saved.number} saved (challan ${saved.challanNo}).`);
      router.replace(paths.delivery(saved.id));
    } catch (error) {
      toast.error(errorMessage(error));
      setBusy(false);
    }
  }

  useSaveShortcut(save, true);

  const title = delivery ? `Edit ${mode === "EXCHANGE" ? "Exchange" : "Delivery"} ${delivery.number}` : mode === "EXCHANGE" ? "Exchange" : "Direct Delivery";

  return (
    <PageContainer className="max-w-none">
      <PageHead
        title={
          <span className="flex items-center gap-2">
            <Link
              href={delivery ? paths.delivery(delivery.id) : paths.deliveryTab(mode === "EXCHANGE" ? "exchanges" : "deliveries")}
              aria-label="Back"
              className={buttonClasses("ghost", "icon")}
            >
              <ArrowLeft />
            </Link>
            {title}
          </span>
        }
        subtitle={mode === "EXCHANGE" ? "Take damaged or expired goods back and give replacements." : "Deliver without a sales order."}
        actions={
          <Button variant="primary" onClick={save} loading={busy}>
            Save
          </Button>
        }
      />

      <div className="flex flex-col gap-4">
        <Card>
          <Section>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
              <CheckboxField label="Price Including VAT" checked={priceIncludesVat} onChange={(event) => setPriceIncludesVat(event.target.checked)} />
              {credit.data && (
                <div className="ml-auto flex flex-wrap gap-1.5">
                  <Indicator color="blue">Cr Lmt: {credit.data.creditLimit === null ? "No limit" : formatAmount(credit.data.creditLimit)}</Indicator>
                  <Indicator color={credit.data.overdue > 0 ? "red" : "blue"}>OD: {formatAmount(credit.data.overdue)}</Indicator>
                  <Indicator color="blue">Balance: {formatAmount(credit.data.outstanding)}</Indicator>
                </div>
              )}
            </div>
            <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="flex items-end gap-1.5 lg:col-span-2">
                <SelectField
                  label="Customer"
                  required
                  className="min-w-0 flex-1"
                  value={customerId}
                  error={errors.customerId}
                  disabled={!businessUnitId || masters.loading}
                  options={[
                    { value: "", label: masters.loading ? "Loading…" : "Select customer" },
                    ...(delivery && !customers.some((candidate) => candidate.id === delivery.customerId) ? [{ value: delivery.customerId, label: delivery.customerName }] : []),
                    ...customers.map((candidate) => ({ value: candidate.id, label: `${candidate.code} - ${candidate.name}${candidate.phone ? ` (${candidate.phone})` : ""}` })),
                  ]}
                  onChange={(event) => selectCustomer(customers.find((candidate) => candidate.id === event.target.value))}
                />
                <Button size="icon" aria-label="New customer" title="New customer" disabled={!masters.data} onClick={() => setCustomerDialog(true)}>
                  <UserPlus />
                </Button>
              </div>
              <SelectField
                label="Price Type"
                value={effectivePriceList}
                options={[{ value: "", label: "Default sales rate" }, ...(masters.data?.setup.priceLists ?? []).map((list) => ({ value: list.id, label: list.name }))]}
                onChange={(event) => setPriceListId(event.target.value)}
              />
              {mode === "EXCHANGE" && <TextField label="Reason" placeholder="Damaged, expired …" value={reason} error={errors.reason} onChange={(event) => setReason(event.target.value)} />}
            </div>
          </Section>
        </Card>

        <Card>
          <Section title="Transportation Details">
            <TransportSection
              values={header}
              errors={errors}
              set={set}
              offices={lookups.offices}
              businessUnitId={delivery?.businessUnitId}
              warehouses={warehouses}
              salesPersons={masters.data?.setup.salesPersons ?? []}
              addresses={customer?.addresses ?? []}
            />
          </Section>
        </Card>

        {mode === "EXCHANGE" && (
          <Card>
            <Section title="Goods Taken Back" description="These go back into the selected warehouse.">
              <ReceivedGrid items={items} rows={received} errors={errors} priceListId={effectivePriceList} onChange={setReceived} />
            </Section>
          </Card>
        )}

        <Card>
          <Section title={mode === "EXCHANGE" ? "Replacement Goods Given" : "Items"}>
            <ItemEntry items={items} setup={masters.data?.setup} priceListId={effectivePriceList} disabled={!businessUnitId || masters.loading} onAdd={addLine} warehouseId={header.warehouseId} />
            <LinesGrid
              lines={lines}
              itemById={itemById}
              storedLines={[]}
              totals={totals}
              errors={errors}
              onChange={(key, patch) => setLines((current) => current.map((line) => (line.key === key ? { ...line, ...patch } : line)))}
              onRemove={(key) => setLines((current) => current.filter((line) => line.key !== key))}
            />
            {errors.lines && <p className="text-xs text-danger">{errors.lines}</p>}
          </Section>
        </Card>

        <div className="grid gap-4 lg:grid-cols-[1fr_24rem]">
          <div />
          <Card>
            <Section title="Summary">
              <DeliverySummary
                values={header}
                errors={errors}
                set={set}
                itemsTotal={totals.itemsTotal}
                itemsBase={totals.itemsBase}
                vatAmount={totals.vatAmount}
                aitAmount={totals.aitAmount}
                discountAmount={totals.discountAmount}
                discountText={discount}
                onDiscountChange={setDiscount}
                returnAmount={mode === "EXCHANGE" ? returnTotal : undefined}
                total={totals.salesTotal}
              />
            </Section>
          </Card>
        </div>
      </div>

      {customerDialog && businessUnitId && masters.data && (
        <CustomerDialog
          open
          businessUnitId={businessUnitId}
          lookups={masters.data.setup}
          customer={null}
          onClose={() => setCustomerDialog(false)}
          onSaved={(saved) => {
            setCustomerDialog(false);
            masters.mutate((data) => ({ ...data!, customers: [...data!.customers, saved].sort((a, b) => a.name.localeCompare(b.name)) }));
            selectCustomer(saved);
          }}
        />
      )}
    </PageContainer>
  );
}

/** Exchange: goods coming back (item, qty, rate). */
function ReceivedGrid({
  items,
  rows,
  errors,
  priceListId,
  onChange,
}: {
  items: ItemOption[];
  rows: ReceivedValues[];
  errors: Record<string, string>;
  priceListId: string;
  onChange: (rows: ReceivedValues[]) => void;
}) {
  const listId = useId();
  const label = (item: ItemOption) => `${item.code} — ${item.name}`;
  const update = (key: string, patch: Partial<ReceivedValues>) => onChange(rows.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  return (
    <div className="flex flex-col gap-2">
      <datalist id={listId}>
        {items.map((item) => (
          <option key={item.id} value={label(item)} />
        ))}
      </datalist>
      {rows.length === 0 ? (
        <EmptyState title="Nothing taken back yet" />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-line">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-canvas text-xs text-ink-muted">
              <tr className="border-b border-line">
                <th scope="col" className="px-2 py-2 text-left font-medium">Item</th>
                <th scope="col" className="w-28 px-2 py-2 text-right font-medium">Quantity</th>
                <th scope="col" className="w-32 px-2 py-2 text-right font-medium">Rate</th>
                <th scope="col" className="w-32 px-2 py-2 text-right font-medium">Amount</th>
                <th scope="col" className="w-10 px-2 py-2"><span className="sr-only">Remove</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((row, index) => {
                const item = items.find((candidate) => candidate.id === row.itemId);
                const rowError = ["itemId", "qty", "rate"].map((field) => errors[`receivedLines.${index}.${field}`]).find(Boolean);
                return (
                  <tr key={row.key} className="align-top">
                    <td className="px-2 py-1.5">
                      <input
                        aria-label={`Item taken back, row ${index + 1}`}
                        list={listId}
                        defaultValue={item ? label(item) : ""}
                        placeholder="Search item"
                        onChange={(event) => {
                          const match = items.find((candidate) => label(candidate) === event.target.value);
                          update(row.key, match ? { itemId: match.id, rate: row.rate || String(rateFor(match, priceListId)) } : { itemId: "" });
                        }}
                        className={cn(CONTROL, "h-7 w-full", rowError && "ring-1 ring-danger")}
                      />
                      {rowError && <p className="mt-0.5 text-xs text-danger">{rowError}</p>}
                    </td>
                    <td className="px-2 py-1.5">
                      <input aria-label={`Quantity, row ${index + 1}`} type="number" min={0} step="any" value={row.qty} onChange={(event) => update(row.key, { qty: event.target.value })} className={cn(CONTROL, "h-7 w-full text-right tabular-nums")} />
                    </td>
                    <td className="px-2 py-1.5">
                      <input aria-label={`Rate, row ${index + 1}`} type="number" min={0} step="any" value={row.rate} onChange={(event) => update(row.key, { rate: event.target.value })} className={cn(CONTROL, "h-7 w-full text-right tabular-nums")} />
                    </td>
                    <td className="px-2 py-1.5 pt-2.5 text-right tabular-nums">{formatAmount(toNumber(row.qty) * toNumber(row.rate))}</td>
                    <td className="px-2 py-1.5">
                      <Button variant="ghost" size="icon" aria-label={`Remove row ${index + 1}`} onClick={() => onChange(rows.filter((candidate) => candidate.key !== row.key))}>
                        <Trash2 />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {errors.receivedLines && <p className="text-xs text-danger">{errors.receivedLines}</p>}
      <div>
        <Button size="sm" onClick={() => onChange([...rows, { key: newKey(), itemId: "", qty: "1", rate: "" }])}>
          <Plus aria-hidden="true" />
          Add Item Taken Back
        </Button>
      </div>
    </div>
  );
}
