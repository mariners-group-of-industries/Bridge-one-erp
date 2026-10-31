"use client";

import { ArrowLeft, FileText, Plus, Printer, SaveAll, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useMemo, useState } from "react";
import { PageContainer, PageHead } from "@/components/layout/page";
import { Button, buttonClasses } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { CONTROL, CheckboxField, SelectField, TextAreaField, TextField } from "@/components/ui/form-field";
import { Indicator } from "@/components/ui/indicator";
import { Card, ErrorState, LoadingState, Section } from "@/components/ui/section";
import { EmptyState } from "@/features/sales/components/EmptyState";
import { useToast } from "@/components/ui/toast";
import { useResource } from "@/hooks/use-resource";
import { useSaveShortcut } from "@/hooks/use-save-shortcut";
import { errorMessage } from "@/lib/api/client";
import { cn } from "@/lib/cn";
import { CustomerFormView } from "@/features/configuration/entity-master-data/customer/components/CustomerFormView";
import type { CustomerDto } from "@/features/configuration/entity-master-data/customer/schemas/customer.schema";
import { SearchPick } from "../../components/SearchPick";
import { formatAmount } from "../../dashboard/lib/format";
import { issuesToErrors, requiredNumber } from "../../lib/form";
import type { CustomerOption, ItemOption, SalesLookups } from "../../masters/schemas/masters.schema";
import { fetchCustomerCredit, fetchCustomers, fetchItems, fetchSalesLookups, fetchSetupLookups } from "../../masters/services/masters.api";
import { ItemEntry, LinesGrid, type LineValues } from "../../orders/components/OrderFormView";
import { orderTotals } from "../../orders/lib/order-totals";
import { ORDER_TYPES, ORDER_TYPE_LABELS, type OrderType } from "../../orders/schemas/order.schema";
import { paths } from "../../paths";
import { round2 } from "../../quotations/lib/totals";
import { directDeliverySchema, exchangeSchema, type DeliveryDetail, type WarehouseOption } from "../schemas/delivery.schema";
import { createDelivery, fetchDelivery, fetchVehicles, fetchWarehouses, updateDelivery } from "../services/delivery.api";
import { DeliverySummary, blankHeader, headerFromDelivery, headerInput, nowTime, type HeaderValues } from "./DeliveryFormParts";
import { VehicleSection } from "./DeliveryVehicle";

type Mode = "DIRECT" | "EXCHANGE";

/** Direct delivery (no sales order) or exchange; new or editing. */
export function DirectDeliveryFormView({ mode, deliveryId, today }: { mode: Mode; deliveryId?: string; today: string }) {
  const lookups = useResource("sales-lookups", fetchSalesLookups);
  const warehouses = useResource("warehouses", fetchWarehouses);
  const delivery = useResource(deliveryId ?? null, () => fetchDelivery(deliveryId!));
  const error = lookups.error ?? warehouses.error ?? delivery.error;
  const title = mode === "EXCHANGE" ? "Exchange" : "Create Direct Delivery";

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
const customerLabel = (customer: { name: string; code: string; isAnonymous?: boolean }) => (customer.isAnonymous ? customer.name : `${customer.name} (${customer.code})`);

function newHeader(today: string, lookups: SalesLookups, warehouses: WarehouseOption[], keep?: HeaderValues): HeaderValues {
  const office = lookups.offices.find((candidate) => candidate.id === keep?.officeId) ?? lookups.offices[0];
  return {
    ...blankHeader(today, nowTime()),
    officeId: office?.id ?? "",
    warehouseId: keep?.warehouseId || (warehouses.find((warehouse) => warehouse.officeId === office?.id)?.id ?? ""),
    deliveryDate: keep?.deliveryDate ?? today,
    terms: keep?.terms ?? (office ? (lookups.orderTerms[office.businessUnitId] ?? "") : ""),
  };
}

type SaveMode = "close" | "new" | "print";
type PartnerDialog = "customer" | "promoter" | null;

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
  const fieldId = useId();

  const [header, setHeader] = useState<HeaderValues>(() => (delivery ? headerFromDelivery(delivery) : newHeader(today, lookups, warehouses)));
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
  const [partnerDialog, setPartnerDialog] = useState<PartnerDialog>(null);
  const [termsOpen, setTermsOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(Boolean(delivery && (delivery.refCustomerPo || delivery.refInvoice || delivery.contactPerson)));

  const office = lookups.offices.find((candidate) => candidate.id === header.officeId);
  const businessUnitId = office?.businessUnitId ?? null;
  const masters = useResource(businessUnitId && `delivery-masters:${businessUnitId}`, async () => {
    const [setup, customers, items] = await Promise.all([fetchSetupLookups(businessUnitId!), fetchCustomers(businessUnitId!), fetchItems(businessUnitId!)]);
    return { setup, customers, items };
  });
  const vehicles = useResource(businessUnitId && `vehicles:${businessUnitId}`, () => fetchVehicles(businessUnitId!));
  const customers = useMemo(() => masters.data?.customers ?? [], [masters.data]);
  const items = useMemo(() => masters.data?.items ?? [], [masters.data]);
  const itemById = useMemo(() => new Map(items.map((item) => [item.id, item])), [items]);
  const customer = customers.find((candidate) => candidate.id === customerId);
  const credit = useResource(customerId && !customer?.isAnonymous ? `credit:${customerId}:${today}` : null, () => fetchCustomerCredit(customerId, today));
  const effectivePriceList = priceListId || masters.data?.setup.priceLists.find((list) => list.isDefault)?.id || "";
  const officeWarehouses = warehouses.filter((warehouse) => warehouse.officeId === header.officeId);

  const set = <K extends keyof HeaderValues>(key: K, value: HeaderValues[K]) => setHeader((current) => ({ ...current, [key]: value }));

  function selectCustomer(next: CustomerOption | undefined) {
    setCustomerId(next?.id ?? "");
    setHeader((current) => ({
      ...current,
      salesPersonId: next?.salesPersonId ?? current.salesPersonId,
      shipToAddressId: next?.addresses.find((address) => address.isDefault)?.id ?? "",
      contactPerson: next?.contactPerson ?? "",
      paymentTermDays: String(next?.creditDays ?? 0),
      paymentMethod: next && next.creditDays > 0 ? "CREDIT" : "CASH",
    }));
  }

  // New deliveries start with the business unit's anonymous (walk-in) customer, as in Managerium.
  const [defaultedFor, setDefaultedFor] = useState<string | null>(delivery ? businessUnitId : null);
  if (!delivery && masters.data && businessUnitId && defaultedFor !== businessUnitId) {
    setDefaultedFor(businessUnitId);
    const anonymous = masters.data.customers.find((candidate) => candidate.isAnonymous && candidate.isActive);
    if (!customerId && anonymous) selectCustomer(anonymous);
  }

  function changeOffice(officeId: string) {
    const next = lookups.offices.find((candidate) => candidate.id === officeId);
    const sameUnit = next?.businessUnitId === businessUnitId;
    setHeader((current) => ({
      ...current,
      officeId,
      warehouseId: warehouses.find((warehouse) => warehouse.officeId === officeId)?.id ?? "",
      ...(sameUnit ? {} : { salesPersonId: "", shipToAddressId: "", vehicleId: "", driverEmployeeId: "", driverEmployeeName: "" }),
    }));
    if (!sameUnit) {
      // Customers, items and vehicles belong to one business unit.
      setCustomerId("");
      setLines([]);
      setReceived([]);
      setPriceListId("");
    }
  }

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

  function addLine(line: Omit<LineValues, "key">) {
    setLines((current) => {
      const existing = current.find((candidate) => candidate.itemId === line.itemId);
      if (existing) {
        return current.map((candidate) => (candidate.key === existing.key ? { ...candidate, qty: String(toNumber(candidate.qty) + toNumber(line.qty)) } : candidate));
      }
      return [...current, { ...line, key: newKey() }];
    });
  }

  function partnerSaved(saved: CustomerDto) {
    const kind = partnerDialog;
    setPartnerDialog(null);
    masters.reload();
    if (kind === "promoter") {
      set("referredBy", saved.name);
      toast.success(`Promoter ${saved.name} added.`);
      return;
    }
    setCustomerId(saved.id);
    setHeader((current) => ({
      ...current,
      salesPersonId: saved.salesPersonId ?? current.salesPersonId,
      contactPerson: saved.contactPerson ?? current.contactPerson,
      paymentTermDays: saved.creditDays || "0",
    }));
    toast.success(`Customer ${saved.name} added and selected.`);
  }

  function resetForNext() {
    setHeader((current) => newHeader(today, lookups, warehouses, current));
    setCustomerId("");
    setDefaultedFor(null);
    setLines([]);
    setReceived([]);
    setDiscount("0");
    setReason("");
    setErrors({});
  }

  async function save(saveMode: SaveMode = "close") {
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
      if (saveMode === "new") {
        resetForNext();
        setBusy(false);
      } else if (saveMode === "print") {
        router.push(paths.printDelivery(saved.id, "invoice"));
      } else {
        router.replace(paths.delivery(saved.id));
      }
    } catch (error) {
      toast.error(errorMessage(error));
      setBusy(false);
    }
  }

  useSaveShortcut(() => save(), true);

  const title = delivery ? `Edit ${mode === "EXCHANGE" ? "Exchange" : "Delivery"} ${delivery.number}` : mode === "EXCHANGE" ? "Exchange" : "Create Direct Delivery";
  const field = (key: keyof HeaderValues) => ({
    value: header[key] as string,
    error: errors[key],
    onChange: (event: { target: { value: string } }) => set(key, event.target.value as never),
  });
  const addNew = (kind: Exclude<PartnerDialog, null>) => (
    <button
      type="button"
      className="absolute top-0 right-0 text-xs font-medium text-accent-strong hover:underline disabled:text-ink-faint"
      disabled={!businessUnitId}
      onClick={() => setPartnerDialog(kind)}
    >
      <Plus aria-hidden="true" className="inline size-3.5" /> ADD NEW
    </button>
  );
  const addresses = customer?.addresses ?? [];

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
        subtitle={mode === "EXCHANGE" ? "Take damaged or expired goods back and give replacements." : undefined}
        actions={
          <>
            {!delivery && (
              <>
                <Button variant="accent-soft" onClick={() => save("new")} disabled={busy}>
                  <SaveAll aria-hidden="true" />
                  Save &amp; New
                </Button>
                <Button variant="accent-soft" onClick={() => save("print")} disabled={busy}>
                  <Printer aria-hidden="true" />
                  Save &amp; Print
                </Button>
              </>
            )}
            <Button variant="primary" onClick={() => save()} loading={busy}>
              SAVE
            </Button>
          </>
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
              <TextField label="Create Date" type="date" required {...field("deliveryDate")} />
              <SelectField
                label="Office"
                required
                value={header.officeId}
                error={errors.officeId}
                options={[
                  { value: "", label: "Select office" },
                  ...lookups.offices
                    .filter((candidate) => !delivery || candidate.businessUnitId === delivery.businessUnitId)
                    .map((candidate) => ({ value: candidate.id, label: candidate.name })),
                ]}
                onChange={(event) => changeOffice(event.target.value)}
              />
              <SelectField
                label="Warehouse"
                required
                value={header.warehouseId}
                error={errors.warehouseId}
                hint={header.officeId && officeWarehouses.length === 0 ? "This office has no warehouse. Add one in Configuration." : undefined}
                options={[{ value: "", label: "Select Warehouse" }, ...officeWarehouses.map((warehouse) => ({ value: warehouse.id, label: warehouse.name }))]}
                onChange={(event) => set("warehouseId", event.target.value)}
              />
              <div className="relative">
                <SearchPick
                  key={`${businessUnitId}:${customers.length}`}
                  label="Customer"
                  required
                  error={errors.customerId}
                  disabled={!businessUnitId || masters.loading}
                  placeholder={masters.loading ? "Loading…" : "Select/Search Customer (min 3 letters)"}
                  options={[
                    ...(delivery && !customers.some((candidate) => candidate.id === delivery.customerId) ? [{ id: delivery.customerId, label: delivery.customerName }] : []),
                    ...customers.map((candidate) => ({ id: candidate.id, label: customerLabel(candidate) })),
                  ]}
                  selectedId={customerId}
                  onPick={(id) => selectCustomer(customers.find((candidate) => candidate.id === id))}
                />
                {addNew("customer")}
              </div>

              <div className="relative">
                <SearchPick
                  label="Referred By"
                  freeText
                  error={errors.referredBy}
                  disabled={!businessUnitId}
                  placeholder="Select/Search Customer (min 3 letters)"
                  options={customers.filter((candidate) => candidate.id !== customerId && !candidate.isAnonymous).map((candidate) => ({ id: candidate.id, label: candidate.name }))}
                  text={header.referredBy}
                  onText={(text) => set("referredBy", text)}
                />
                {addNew("promoter")}
              </div>
              <SelectField
                label="Sales Force"
                value={header.salesPersonId}
                error={errors.salesPersonId}
                options={[{ value: "", label: "Sales Force" }, ...(masters.data?.setup.salesPersons ?? []).map((person) => ({ value: person.id, label: person.name }))]}
                onChange={(event) => set("salesPersonId", event.target.value)}
              />
              <TextField label="Name" placeholder="Name" hint={customer?.isAnonymous ? "Buyer of this walk-in sale." : undefined} {...field("buyerName")} />
              <TextField label="Mobile No" type="tel" placeholder="Mobile No" {...field("buyerMobile")} />

              {addresses.length > 0 && (
                <SelectField
                  label="Shipping Address"
                  value={header.shipToAddressId}
                  options={[{ value: "", label: "Type another address…" }, ...addresses.map((address) => ({ value: address.id, label: `${address.label}: ${address.address}` }))]}
                  onChange={(event) => set("shipToAddressId", event.target.value)}
                />
              )}
              {(addresses.length === 0 || !header.shipToAddressId) && (
                <TextField label={addresses.length ? "Shipping Address (other)" : "Shipping Address"} placeholder="Shipping Address" {...field("shippingAddress")} />
              )}
              <TextField label="Challan No" placeholder="Blank = next number" {...field("challanNo")} />
              <TextField label="VAT Challan No" placeholder="VAT Challan No" {...field("vatChallanNo")} />
              <SelectField
                label="Type"
                value={header.salesType}
                options={ORDER_TYPES.map((value) => ({ value, label: ORDER_TYPE_LABELS[value] }))}
                onChange={(event) => set("salesType", event.target.value as OrderType)}
              />

              <TextField label="Project/Outlet/Ref." placeholder="Project/Outlet/Ref." {...field("refProjectOutlet")} />
              <TextField label="Payment Term Days" type="number" min={0} max={365} placeholder="Payment Term Days" {...field("paymentTermDays")} />
              <TextField label="Remarks" placeholder="Remarks" {...field("remarks")} />
              <TextField label="Delivery Time" type="time" {...field("deliveryTime")} />
              {mode === "EXCHANGE" && <TextField label="Exchange Reason" placeholder="Damaged, expired …" value={reason} error={errors.reason} onChange={(event) => setReason(event.target.value)} />}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="primary" size="sm" onClick={() => setTermsOpen(true)}>
                <FileText aria-hidden="true" />
                Terms &amp; Conditions
              </Button>
              <button type="button" className="text-xs text-accent-strong hover:underline" aria-expanded={moreOpen} aria-controls={`${fieldId}-more`} onClick={() => setMoreOpen((value) => !value)}>
                {moreOpen ? "Hide references" : "Contact & customer PO references"}
              </button>
            </div>
            {moreOpen && (
              <div id={`${fieldId}-more`} className="grid gap-x-4 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
                <TextField label="Contact To" {...field("contactPerson")} />
                <TextField label="Ref Customer PO" {...field("refCustomerPo")} />
                <TextField label="Ref Customer PO Date" type="date" {...field("refCustomerPoDate")} />
                <TextField label="Ref Invoice" {...field("refInvoice")} />
              </div>
            )}
          </Section>
        </Card>

        <Card>
          <Section>
            <VehicleSection
              values={header}
              errors={errors}
              set={set}
              businessUnitId={businessUnitId}
              vehicles={vehicles.data ?? []}
              onVehicleCreated={(vehicle) => vehicles.mutate((current) => [...(current ?? []), vehicle])}
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
          <Section title={mode === "EXCHANGE" ? "Replacement Goods Given" : undefined}>
            <ItemEntry
              items={items}
              setup={masters.data?.setup}
              priceListId={effectivePriceList}
              disabled={!businessUnitId || masters.loading}
              onAdd={addLine}
              warehouseId={header.warehouseId}
              filterExtra={
                <SelectField
                  label="Price Type"
                  value={effectivePriceList}
                  options={[{ value: "", label: "Select Price Type" }, ...(masters.data?.setup.priceLists ?? []).map((list) => ({ value: list.id, label: list.name }))]}
                  onChange={(event) => setPriceListId(event.target.value)}
                />
              }
            />
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
        <TextAreaField label="Terms & Conditions" rows={12} maxLength={4000} value={header.terms} error={errors.terms} onChange={(event) => set("terms", event.target.value)} />
      </Dialog>

      <Dialog open={partnerDialog !== null} title={partnerDialog === "promoter" ? "Add Promoter" : "Add Customer"} size="xl" className="max-w-7xl" onClose={() => setPartnerDialog(null)}>
        {partnerDialog && (
          <CustomerFormView
            defaultOfficeId={header.officeId}
            embedded={{ defaultOfficeId: header.officeId, onSaved: partnerSaved, onCancel: () => setPartnerDialog(null) }}
          />
        )}
      </Dialog>
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
