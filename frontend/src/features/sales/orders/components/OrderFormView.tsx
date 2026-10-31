"use client";

import { ArrowLeft, CirclePlus, ClipboardList, Paperclip, Pencil, Plus, SaveAll, Trash2, UserPlus, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useMemo, useState, type ReactNode } from "react";
import { PageContainer, PageHead } from "@/components/layout/page";
import { ALLOWED_SUPPLIER_ATTACHMENT_TYPES, MAX_SUPPLIER_ATTACHMENT_BYTES } from "@/features/configuration/entity-master-data/supplier/schemas/supplier.schema";
import { Button, buttonClasses } from "@/components/ui/button";
import { CONTROL, CheckboxField, SelectField, TextAreaField, TextField } from "@/components/ui/form-field";
import { Indicator } from "@/components/ui/indicator";
import { Card, ErrorState, LoadingState, Section } from "@/components/ui/section";
import { EmptyState } from "@/features/sales/components/EmptyState";
import { useToast } from "@/components/ui/toast";
import { useResource } from "@/hooks/use-resource";
import { useSaveShortcut } from "@/hooks/use-save-shortcut";
import { errorMessage } from "@/lib/api/client";
import { cn } from "@/lib/cn";
import { formatAmount, formatQty } from "../../dashboard/lib/format";
import { issuesToErrors, numberText, optionalNumber, requiredNumber } from "../../lib/form";
import { addDays, useToday } from "../../lib/use-today";
import {
  CATEGORY_LEVEL_LABELS,
  type CustomerOption,
  type ItemOption,
  type SalesLookups,
  type SetupLookups,
} from "../../masters/schemas/masters.schema";
import {
  fetchCustomerCredit,
  fetchCustomers,
  fetchItemPending,
  fetchItems,
  fetchSalesLookups,
  fetchSetupLookups,
} from "../../masters/services/masters.api";
import { paths } from "../../paths";
import { OfferPanel, usePricing } from "../../pricing/components/OfferPanel";
import { fetchPricing } from "../../pricing/services/pricing.api";
import type { QuotationDetail } from "../../quotations/schemas/quotation.schema";
import { fetchStock, fetchWarehouses } from "../../deliveries/services/delivery.api";
import { fetchQuotation, fetchQuotations } from "../../quotations/services/quotation.api";
import { CustomerDialog } from "../../setup/components/CustomerDialog";
import { SearchPick } from "../../components/SearchPick";
import { altQty, orderTotals } from "../lib/order-totals";
import {
  ORDER_TYPES,
  ORDER_TYPE_LABELS,
  PAYMENT_METHODS,
  PAYMENT_METHOD_LABELS,
  orderInputSchema,
  type OrderAttachment,
  type OrderDetail,
  type OrderInput,
  type OrderType,
  type PaymentMethod,
} from "../schemas/order.schema";
import { addOrderAttachment, createOrder, deleteOrderAttachment, fetchOrder, orderAttachmentUrl, updateOrder } from "../services/order.api";
import { OrderStatusIndicator } from "./OrderStatusIndicator";

// ─── Entry points ────────────────────────────────────────────────────────────

/** /sales/orders/new[?quotation=<id>] */
export function NewOrderView({ quotationId }: { quotationId: string | null }) {
  const today = useToday();
  const lookups = useResource("sales-lookups", fetchSalesLookups);
  const quotation = useResource(quotationId, () => fetchQuotation(quotationId!));
  const error = lookups.error ?? quotation.error;
  if (error) return <Failed title="Create Sales Order" error={error} onRetry={lookups.reload} />;
  if (!today || !lookups.data || (quotationId && !quotation.data)) return <Loading title="Create Sales Order" />;
  return <OrderEditor today={today} lookups={lookups.data} order={null} quotation={quotation.data} />;
}

/** /sales/orders/[orderId]/edit */
export function EditOrderView({ id }: { id: string }) {
  const today = useToday();
  const lookups = useResource("sales-lookups", fetchSalesLookups);
  const order = useResource(id, () => fetchOrder(id));
  const error = lookups.error ?? order.error;
  if (error) return <Failed title="Edit Sales Order" error={error} onRetry={order.reload} />;
  if (!today || !lookups.data || !order.data) return <Loading title="Edit Sales Order" />;
  if (order.data.status !== "DRAFT") {
    return (
      <PageContainer>
        <PageHead title={`Edit ${order.data.number}`} indicator={<OrderStatusIndicator status={order.data.status} />} />
        <Card>
          <EmptyState title="Only draft orders can be edited">
            <Link href={paths.order(id)} className="font-medium text-ink underline underline-offset-2">
              View the order
            </Link>
          </EmptyState>
        </Card>
      </PageContainer>
    );
  }
  return <OrderEditor key={order.data.updatedAt} today={today} lookups={lookups.data} order={order.data} />;
}

function Loading({ title }: { title: string }) {
  return (
    <PageContainer>
      <PageHead title={title} />
      <LoadingState />
    </PageContainer>
  );
}

function Failed({ title, error, onRetry }: { title: string; error: Error; onRetry: () => void }) {
  return (
    <PageContainer>
      <PageHead title={title} />
      <Card>
        <ErrorState message={errorMessage(error)} onRetry={onRetry} />
      </Card>
    </PageContainer>
  );
}

// ─── Form state ──────────────────────────────────────────────────────────────

/** Order attachments follow the customer / supplier rules: PDF or images, 5 MB each. */
const ATTACHMENT_TYPES = ALLOWED_SUPPLIER_ATTACHMENT_TYPES;
const MAX_ATTACHMENT_BYTES = MAX_SUPPLIER_ATTACHMENT_BYTES;

const formatSize = (bytes: number) =>
  bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;

export interface LineValues {
  key: string;
  itemId: string;
  qty: string;
  unitPrice: string;
  discountPercent: string;
  vatPercent: string;
  aitPercent: string;
}

interface Values {
  officeId: string;
  customerId: string;
  salesPersonId: string;
  priceListId: string;
  offerId: string;
  shipToAddressId: string;
  shippingAddress: string;
  contactPerson: string;
  referredBy: string;
  orderType: OrderType;
  paymentMethod: PaymentMethod;
  orderDate: string;
  expectedDeliveryDate: string;
  priceIncludesVat: boolean;
  isForeign: boolean;
  refCustomerPo: string;
  refCustomerPoDate: string;
  refCustomerPoAmount: string;
  refInvoice: string;
  refProjectOutlet: string;
  paymentTermDays: string;
  dueLimit: string;
  remarks: string;
  terms: string;
  discountAmount: string;
  deliveryCharge: string;
  unloadingCharge: string;
  lines: LineValues[];
}

const newKey = () => crypto.randomUUID();

function fromOrder(order: OrderDetail): Values {
  return {
    officeId: order.officeId,
    customerId: order.customerId,
    salesPersonId: order.salesPersonId ?? "",
    priceListId: order.priceListId ?? "",
    offerId: order.offerId ?? "",
    shipToAddressId: order.shipToAddressId ?? "",
    shippingAddress: order.shipToAddressId ? "" : (order.shippingAddress ?? ""),
    contactPerson: order.contactPerson ?? "",
    referredBy: order.referredBy ?? "",
    orderType: order.orderType,
    paymentMethod: order.paymentMethod,
    orderDate: order.orderDate,
    expectedDeliveryDate: order.expectedDeliveryDate,
    priceIncludesVat: order.priceIncludesVat,
    isForeign: order.isForeign,
    refCustomerPo: order.refCustomerPo ?? "",
    refCustomerPoDate: order.refCustomerPoDate ?? "",
    refCustomerPoAmount: numberText(order.refCustomerPoAmount),
    refInvoice: order.refInvoice ?? "",
    refProjectOutlet: order.refProjectOutlet ?? "",
    paymentTermDays: String(order.paymentTermDays),
    dueLimit: String(order.dueLimit),
    remarks: order.remarks ?? "",
    terms: order.terms ?? "",
    discountAmount: String(order.discountAmount),
    deliveryCharge: String(order.deliveryCharge),
    unloadingCharge: String(order.unloadingCharge),
    lines: order.lines.map((line) => ({
      key: line.id,
      itemId: line.itemId,
      qty: String(line.qty),
      unitPrice: String(line.unitPrice),
      discountPercent: String(line.discountPercent),
      vatPercent: String(line.vatPercent),
      aitPercent: String(line.aitPercent),
    })),
  };
}

function blank(today: string, lookups: SalesLookups, quotation?: QuotationDetail): Values {
  const office = quotation ? lookups.offices.find((candidate) => candidate.id === quotation.officeId) : lookups.offices[0];
  return {
    officeId: office?.id ?? "",
    customerId: quotation?.customerId ?? "",
    salesPersonId: quotation?.salesPersonId ?? "",
    priceListId: "",
    offerId: "",
    shipToAddressId: "",
    shippingAddress: "",
    contactPerson: "",
    referredBy: "",
    orderType: "SALES",
    paymentMethod: "CASH",
    orderDate: today,
    expectedDeliveryDate: addDays(today, 1),
    // A quotation says whether its unit prices include VAT.
    priceIncludesVat: quotation ? quotation.includingVat : true,
    isForeign: false,
    refCustomerPo: "",
    refCustomerPoDate: "",
    refCustomerPoAmount: "",
    refInvoice: "",
    refProjectOutlet: "",
    paymentTermDays: "0",
    dueLimit: "0",
    remarks: quotation?.remarks ?? "",
    terms: quotation?.terms ?? (office ? (lookups.orderTerms[office.businessUnitId] ?? "") : ""),
    // Quotation discounts are per line (carried in the lines), not a header amount.
    discountAmount: "0",
    deliveryCharge: "0",
    unloadingCharge: "0",
    lines: (quotation?.lines ?? []).map((line) => ({
      key: newKey(),
      itemId: line.itemId,
      qty: String(line.qty),
      unitPrice: String(line.rate),
      discountPercent: String(line.discountPercent),
      vatPercent: String(line.vatPercent),
      aitPercent: String(line.aitPercent),
    })),
  };
}

const orZero = (value: string) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

function toInput(values: Values, quotationId: string | null): OrderInput {
  return {
    officeId: values.officeId,
    customerId: values.customerId,
    salesPersonId: values.salesPersonId || null,
    quotationId,
    priceListId: values.priceListId || null,
    offerId: values.offerId || null,
    shipToAddressId: values.shipToAddressId || null,
    shippingAddress: values.shippingAddress,
    contactPerson: values.contactPerson,
    referredBy: values.referredBy,
    orderType: values.orderType,
    paymentMethod: values.paymentMethod,
    orderDate: values.orderDate,
    expectedDeliveryDate: values.expectedDeliveryDate,
    priceIncludesVat: values.priceIncludesVat,
    isForeign: values.isForeign,
    refCustomerPo: values.refCustomerPo,
    refCustomerPoDate: values.refCustomerPoDate || null,
    refCustomerPoAmount: optionalNumber(values.refCustomerPoAmount),
    refInvoice: values.refInvoice,
    refProjectOutlet: values.refProjectOutlet,
    paymentTermDays: requiredNumber(values.paymentTermDays || "0"),
    dueLimit: requiredNumber(values.dueLimit || "0"),
    remarks: values.remarks,
    terms: values.terms,
    discountAmount: requiredNumber(values.discountAmount || "0"),
    deliveryCharge: requiredNumber(values.deliveryCharge || "0"),
    unloadingCharge: requiredNumber(values.unloadingCharge || "0"),
    lines: values.lines.map((line) => ({
      itemId: line.itemId,
      qty: requiredNumber(line.qty),
      unitPrice: requiredNumber(line.unitPrice),
      discountPercent: requiredNumber(line.discountPercent || "0"),
      vatPercent: requiredNumber(line.vatPercent || "0"),
      aitPercent: requiredNumber(line.aitPercent || "0"),
    })),
  };
}

/** Rate of an item for a price type (falls back to the item's default rate). */
const rateFor = (item: ItemOption, priceListId: string) => item.prices[priceListId] ?? item.salesRate;

// ─── Editor ──────────────────────────────────────────────────────────────────

interface EditorProps {
  today: string;
  lookups: SalesLookups;
  order: OrderDetail | null;
  quotation?: QuotationDetail;
}

function OrderEditor({ today, lookups, order, quotation }: EditorProps) {
  const router = useRouter();
  const toast = useToast();
  const initial = useMemo(() => (order ? fromOrder(order) : blank(today, lookups, quotation)), [order, today, lookups, quotation]);
  const [values, setValues] = useState<Values>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [customerDialog, setCustomerDialog] = useState<CustomerOption | "new" | null>(null);
  /** Whether a customer added in the dialog is the order's customer or who referred it. */
  const [dialogFor, setDialogFor] = useState<"customer" | "referrer">("customer");
  const [fromQuotation, setFromQuotation] = useState(Boolean(quotation));
  const initialJson = useMemo(() => JSON.stringify(initial, (name, value) => (name === "key" ? undefined : value)), [initial]);
  const dirty = !order || JSON.stringify(values, (name, value) => (name === "key" ? undefined : value)) !== initialJson;
  const quotationId = order?.quotationId ?? quotation?.id ?? null;

  const office = lookups.offices.find((candidate) => candidate.id === values.officeId);
  const businessUnitId = office?.businessUnitId ?? null;
  const masters = useResource(businessUnitId && `order-masters:${businessUnitId}`, async () => {
    const [setup, customers, items] = await Promise.all([
      fetchSetupLookups(businessUnitId!),
      fetchCustomers(businessUnitId!),
      fetchItems(businessUnitId!),
    ]);
    return { setup, customers, items };
  });
  const setup = masters.data?.setup;
  const customers = useMemo(() => masters.data?.customers ?? [], [masters.data]);
  const items = useMemo(() => masters.data?.items ?? [], [masters.data]);
  const itemById = useMemo(() => new Map(items.map((item) => [item.id, item])), [items]);
  const customer = customers.find((candidate) => candidate.id === values.customerId);
  // Live stock is read from the office's first warehouse.
  const warehouses = useResource("sales-warehouses", fetchWarehouses);
  const warehouseId = warehouses.data?.find((candidate) => candidate.officeId === values.officeId)?.id ?? null;
  const openQuotations = useResource(
    !order && fromQuotation && !quotation && values.officeId ? `open-quotations:${values.officeId}:${today}` : null,
    () => fetchQuotations({ officeId: values.officeId, status: "SUBMITTED", today }),
  );
  const quotationChoices = (openQuotations.data ?? []).filter((row) => !values.customerId || row.customerId === values.customerId);
  const credit = useResource(values.customerId ? `credit:${values.customerId}:${today}` : null, () =>
    fetchCustomerCredit(values.customerId, today),
  );

  // Default price type once the masters arrive (new orders only).
  const defaultPriceList = setup?.priceLists.find((list) => list.isDefault)?.id ?? "";
  const priceListId = values.priceListId || (order ? "" : defaultPriceList);

  const totals = orderTotals(
    values.lines.map((line) => ({
      qty: orZero(line.qty),
      unitPrice: orZero(line.unitPrice),
      discountPercent: orZero(line.discountPercent),
      vatPercent: orZero(line.vatPercent),
      aitPercent: orZero(line.aitPercent),
    })),
    {
      priceIncludesVat: values.priceIncludesVat,
      discountAmount: orZero(values.discountAmount),
      deliveryCharge: orZero(values.deliveryCharge),
      unloadingCharge: orZero(values.unloadingCharge),
    },
  );

  // Sales Config: offers the server applies on save, shown while the order is entered.
  const pricing = usePricing(
    values.officeId && values.customerId
      ? {
          officeId: values.officeId,
          customerId: values.customerId,
          priceListId: priceListId || null,
          offerId: values.offerId || null,
          date: values.orderDate,
          lines: values.lines
            .filter((line) => orZero(line.qty) > 0)
            .map((line) => ({ itemId: line.itemId, qty: orZero(line.qty), unitPrice: orZero(line.unitPrice), discountPercent: orZero(line.discountPercent) })),
        }
      : null,
  );

  // Custom Offer: the offers that apply to this customer on the order date.
  const availableOffers = pricing.data?.availableOffers ?? [];
  const offerMissing = !!values.offerId && !!pricing.data && !availableOffers.some((offer) => offer.id === values.offerId);

  // Attachments: saved ones are removed at once; new files upload when the order is saved.
  const termsId = useId();
  const [savedFiles, setSavedFiles] = useState<OrderAttachment[]>(order?.attachments ?? []);
  const [queued, setQueued] = useState<File[]>([]);
  const attachmentCount = savedFiles.length + queued.length;

  function queueFiles(files: FileList | null) {
    const accepted = Array.from(files ?? []).filter((file) => {
      if (!(ATTACHMENT_TYPES as readonly string[]).includes(file.type)) {
        toast.error(`${file.name}: only PDF, PNG, JPEG or WebP files are allowed.`);
        return false;
      }
      if (file.size > MAX_ATTACHMENT_BYTES) {
        toast.error(`${file.name}: files must be 5 MB or smaller.`);
        return false;
      }
      return true;
    });
    if (accepted.length) setQueued((current) => [...current, ...accepted]);
  }

  async function removeSaved(file: OrderAttachment) {
    if (!order) return;
    try {
      await deleteOrderAttachment(order.id, file.id);
      setSavedFiles((current) => current.filter((candidate) => candidate.id !== file.id));
      toast.success(`${file.originalName} removed.`);
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  /** Uploads the queued files to the saved order; returns the ones that failed. */
  async function uploadQueued(orderId: string) {
    const failed: string[] = [];
    for (const file of queued) {
      try {
        await addOrderAttachment(orderId, file);
      } catch (error) {
        failed.push(`${file.name}: ${errorMessage(error)}`);
      }
    }
    return failed;
  }

  const set = <K extends keyof Values>(key: K, value: Values[K]) => setValues((current) => ({ ...current, [key]: value }));
  const setLine = (key: string, patch: Partial<LineValues>) =>
    setValues((current) => ({ ...current, lines: current.lines.map((line) => (line.key === key ? { ...line, ...patch } : line)) }));

  /**
   * Puts the Sales Config rate (customer → customer group → standard price → price type → sales rate)
   * on the lines of `only` (every line when null). Offer (free) lines keep theirs.
   */
  async function applyConfigRates(customerId: string, nextPriceListId: string, lines: { itemId: string; qty: string }[], only: string[] | null) {
    if (!values.officeId || !customerId || lines.length === 0) return;
    try {
      const result = await fetchPricing({
        officeId: values.officeId,
        customerId,
        priceListId: nextPriceListId || null,
        date: values.orderDate,
        lines: lines.map((line) => ({ itemId: line.itemId, qty: orZero(line.qty) })),
      });
      const rate = new Map(result.prices.map((price) => [price.itemId, price.rate]));
      setValues((current) =>
        current.customerId !== customerId
          ? current
          : {
              ...current,
              lines: current.lines.map((line) => {
                const next = rate.get(line.itemId);
                return next && (!only || only.includes(line.itemId)) && orZero(line.discountPercent) < 100 ? { ...line, unitPrice: String(next) } : line;
              }),
            },
      );
    } catch {
      // Keep the rates on screen; the order still saves with them.
    }
  }

  function changeOffice(officeId: string) {
    const next = lookups.offices.find((candidate) => candidate.id === officeId);
    setValues((current) =>
      !next || next.businessUnitId === businessUnitId
        ? { ...current, officeId }
        : {
            ...current,
            officeId,
            customerId: "",
            salesPersonId: "",
            priceListId: "",
            offerId: "",
            shipToAddressId: "",
            terms: current.terms || (lookups.orderTerms[next.businessUnitId] ?? ""),
            lines: [],
          },
    );
  }

  function selectCustomer(next: CustomerOption | undefined) {
    setValues((current) => ({
      ...current,
      customerId: next?.id ?? "",
      salesPersonId: next?.salesPersonId ?? current.salesPersonId,
      shipToAddressId: next?.addresses.find((address) => address.isDefault)?.id ?? "",
      contactPerson: next?.contactPerson ?? "",
      paymentTermDays: String(next?.creditDays ?? 0),
      paymentMethod: next && next.creditDays > 0 ? "CREDIT" : current.paymentMethod,
    }));
    if (next) void applyConfigRates(next.id, priceListId, values.lines, null);
  }

  function changePriceList(nextId: string) {
    setValues((current) => ({
      ...current,
      priceListId: nextId,
      lines: current.lines.map((line) => {
        const item = itemById.get(line.itemId);
        return item ? { ...line, unitPrice: String(rateFor(item, nextId)) } : line;
      }),
    }));
    void applyConfigRates(values.customerId, nextId, values.lines, null);
  }

  function addLine(line: Omit<LineValues, "key">) {
    // A rate typed in the entry row stays; the price type's default is replaced by the Sales Config rate.
    const item = itemById.get(line.itemId);
    if (item && line.unitPrice === String(rateFor(item, priceListId))) {
      const qty = values.lines.find((candidate) => candidate.itemId === line.itemId);
      void applyConfigRates(values.customerId, priceListId, [{ itemId: line.itemId, qty: String(orZero(line.qty) + orZero(qty?.qty ?? "0")) }], [line.itemId]);
    }
    setValues((current) => {
      const existing = current.lines.find((candidate) => candidate.itemId === line.itemId);
      if (existing) {
        // Same item again: add to its quantity instead of a duplicate row.
        return {
          ...current,
          lines: current.lines.map((candidate) =>
            candidate.key === existing.key ? { ...candidate, qty: String(orZero(candidate.qty) + orZero(line.qty)) } : candidate,
          ),
        };
      }
      return { ...current, lines: [...current.lines, { ...line, key: newKey() }] };
    });
  }

  /** SAVE goes to the list (back to the order when editing); Save & New keeps office and dates for the next order. */
  async function save(mode: "close" | "new" = "close") {
    if (busy) return;
    const input = toInput({ ...values, priceListId }, quotationId);
    const parsed = orderInputSchema.safeParse(input);
    if (!parsed.success) {
      setErrors(issuesToErrors(parsed.error));
      toast.error(parsed.error.issues[0]?.message ?? "Please correct the highlighted fields.");
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      const saved = order ? await updateOrder(order.id, order.updatedAt, input) : await createOrder(input);
      const failed = await uploadQueued(saved.id);
      setQueued([]);
      if (failed.length) toast.error(`${saved.number} saved, but some attachments failed. ${failed.join(" ")}`);
      else toast.success(`${saved.number} saved as draft. Open it to submit for approval.`);
      if (order) {
        router.replace(paths.order(saved.id));
      } else if (mode === "new") {
        const fresh = blank(today, lookups);
        setValues({
          ...fresh,
          officeId: values.officeId,
          orderDate: values.orderDate,
          expectedDeliveryDate: values.expectedDeliveryDate,
          priceIncludesVat: values.priceIncludesVat,
        });
        setErrors({});
        setFromQuotation(false);
        setBusy(false);
        if (quotation) router.replace(paths.newOrder);
      } else {
        router.push(paths.orders);
      }
    } catch (error) {
      toast.error(errorMessage(error));
      setBusy(false);
    }
  }

  useSaveShortcut(() => save(), dirty);

  const persons = setup?.salesPersons ?? [];
  const err = (path: string) => errors[path];
  const discountPercent = totals.itemsTotal > 0 ? Math.round((orZero(values.discountAmount) / totals.itemsTotal) * 10_000) / 100 : 0;

  return (
    <PageContainer className="max-w-none">
      <PageHead
        title={
          <span className="flex items-center gap-2">
            <Link href={order ? paths.order(order.id) : paths.orders} aria-label="Back" className={buttonClasses("ghost", "icon")}>
              <ArrowLeft />
            </Link>
            {order ? `Edit Sales Order ${order.number}` : "Create Sales Order"}
          </span>
        }
        indicator={dirty ? <Indicator color="orange">Not Saved</Indicator> : undefined}
        subtitle={quotation ? `From quotation ${quotation.number}` : order?.quotationNumber ? `From quotation ${order.quotationNumber}` : undefined}
        actions={
          <>
            {!order && (
              <Button variant="accent-soft" onClick={() => save("new")} disabled={busy}>
                <SaveAll aria-hidden="true" />
                Save &amp; New
              </Button>
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
              {!order && (
                <CheckboxField
                  label={quotation ? `Order From Quotation (${quotation.number})` : "Order From Quotation"}
                  checked={fromQuotation}
                  onChange={(event) => {
                    setFromQuotation(event.target.checked);
                    if (!event.target.checked && quotation) router.replace(paths.newOrder);
                  }}
                />
              )}
              {!order && fromQuotation && !quotation && (
                <SelectField
                  label="Quotation"
                  className="w-72"
                  value=""
                  disabled={openQuotations.loading}
                  hint={openQuotations.data && quotationChoices.length === 0 ? "No approved quotation for this office / customer." : undefined}
                  options={[
                    { value: "", label: openQuotations.loading ? "Loading…" : "Select approved quotation" },
                    ...quotationChoices.map((row) => ({ value: row.id, label: `${row.number} · ${row.customerName} · ${formatAmount(row.grandTotal)}` })),
                  ]}
                  onChange={(event) => {
                    if (event.target.value) router.replace(`${paths.newOrder}?quotation=${event.target.value}`);
                  }}
                />
              )}
              <CheckboxField label="Price Including VAT" checked={values.priceIncludesVat} onChange={(event) => set("priceIncludesVat", event.target.checked)} />
              <CheckboxField label="Is Foreign" checked={values.isForeign} onChange={(event) => set("isForeign", event.target.checked)} />
              {customer && (
                <div className="ml-auto flex flex-wrap gap-1.5" aria-label="Customer credit">
                  {customer.territoryId && <Indicator color="blue">Tr: {setup?.areas.find((area) => area.id === customer.territoryId)?.name}</Indicator>}
                  {customer.customerGroupId && (
                    <Indicator color="blue">Cust Grp: {setup?.customerGroups.find((group) => group.id === customer.customerGroupId)?.name}</Indicator>
                  )}
                  {credit.data && (
                    <>
                      <Indicator color="blue">Cr Lmt: {credit.data.creditLimit === null ? "No limit" : formatAmount(credit.data.creditLimit)}</Indicator>
                      <Indicator color={credit.data.overdue > 0 ? "red" : "blue"}>OD: {formatAmount(credit.data.overdue)}</Indicator>
                      {credit.data.available !== null && (
                        <Indicator color={credit.data.available < totals.salesTotal ? "red" : "green"}>CL: {formatAmount(credit.data.available)}</Indicator>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>

            <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
              <TextField label="Create Date" type="date" required value={values.orderDate} error={err("orderDate")} onChange={(event) => set("orderDate", event.target.value)} />
              <SelectField
                label="Office"
                required
                value={values.officeId}
                error={err("officeId")}
                options={[
                  { value: "", label: "Select office" },
                  ...lookups.offices
                    .filter((candidate) => !order || candidate.businessUnitId === order.businessUnitId)
                    .map((candidate) => ({ value: candidate.id, label: candidate.name })),
                ]}
                onChange={(event) => changeOffice(event.target.value)}
              />
              <div className="flex items-end gap-1.5 lg:col-span-1">
                <SearchPick
                  key={customers.length}
                  label="Customer"
                  required
                  error={err("customerId")}
                  disabled={!businessUnitId || masters.loading}
                  placeholder={masters.loading ? "Loading…" : "Select/Search Customer (min 3 letters)"}
                  options={[
                    ...(order && !customers.some((candidate) => candidate.id === order.customerId)
                      ? [{ id: order.customerId, label: order.customerName }]
                      : []),
                    ...customers.map((candidate) => ({ id: candidate.id, label: `${candidate.name} (${candidate.code})` })),
                  ]}
                  selectedId={values.customerId}
                  onPick={(id) => selectCustomer(customers.find((candidate) => candidate.id === id))}
                />
                <Button
                  size="icon"
                  variant="ghost"
                  className="text-accent-strong"
                  aria-label="Add customer"
                  title="Add customer"
                  disabled={!setup}
                  onClick={() => {
                    setDialogFor("customer");
                    setCustomerDialog("new");
                  }}
                >
                  <CirclePlus />
                </Button>
              </div>
              <div className="flex items-end gap-1.5">
                <SearchPick
                  label="Referred By"
                  freeText
                  error={err("referredBy")}
                  disabled={!businessUnitId}
                  placeholder="Select/Search Customer (min 3 letters)"
                  options={customers.filter((candidate) => candidate.id !== values.customerId).map((candidate) => ({ id: candidate.id, label: candidate.name }))}
                  text={values.referredBy}
                  onText={(text) => set("referredBy", text)}
                />
                <Button
                  size="icon"
                  variant="ghost"
                  className="text-accent-strong"
                  aria-label="Add referrer"
                  title="Add a customer as referrer"
                  disabled={!setup}
                  onClick={() => {
                    setDialogFor("referrer");
                    setCustomerDialog("new");
                  }}
                >
                  <UserPlus />
                </Button>
              </div>
              <div className="flex items-end gap-1.5">
                {customer && customer.addresses.length > 0 ? (
                  <SelectField
                    label="Ship To"
                    className="min-w-0 flex-1"
                    value={values.shipToAddressId}
                    options={[
                      { value: "", label: "Type another address…" },
                      ...customer.addresses.map((address) => ({ value: address.id, label: `${address.label}: ${address.address}` })),
                    ]}
                    onChange={(event) => set("shipToAddressId", event.target.value)}
                  />
                ) : (
                  <TextField
                    label="Ship To"
                    className="min-w-0 flex-1"
                    value={values.shippingAddress}
                    error={err("shippingAddress")}
                    onChange={(event) => set("shippingAddress", event.target.value)}
                  />
                )}
                {customer && (
                  <Button
                  size="icon"
                  aria-label="Edit customer addresses"
                  title="Edit customer / addresses"
                  onClick={() => {
                    setDialogFor("customer");
                    setCustomerDialog(customer);
                  }}
                >
                    <Pencil />
                  </Button>
                )}
              </div>
              {customer && customer.addresses.length > 0 && !values.shipToAddressId && (
                <TextField
                  label="Ship To (address)"
                  value={values.shippingAddress}
                  error={err("shippingAddress")}
                  onChange={(event) => set("shippingAddress", event.target.value)}
                />
              )}
              <TextField label="Contact To" value={values.contactPerson} error={err("contactPerson")} onChange={(event) => set("contactPerson", event.target.value)} />
              <SelectField
                label="Sales Force"
                value={values.salesPersonId}
                error={err("salesPersonId")}
                options={[{ value: "", label: "None" }, ...persons.map((person) => ({ value: person.id, label: person.name }))]}
                onChange={(event) => set("salesPersonId", event.target.value)}
              />
              <SelectField
                label="Type"
                value={values.orderType}
                options={ORDER_TYPES.map((value) => ({ value, label: ORDER_TYPE_LABELS[value] }))}
                onChange={(event) => set("orderType", event.target.value as OrderType)}
              />
              <TextField label="Ref Customer PO" value={values.refCustomerPo} error={err("refCustomerPo")} onChange={(event) => set("refCustomerPo", event.target.value)} />
              <TextField
                label="Ref Customer PO Date"
                type="date"
                value={values.refCustomerPoDate}
                error={err("refCustomerPoDate")}
                onChange={(event) => set("refCustomerPoDate", event.target.value)}
              />
              <TextField
                label="Ref Customer PO Amount"
                type="number"
                min={0}
                step="any"
                value={values.refCustomerPoAmount}
                error={err("refCustomerPoAmount")}
                onChange={(event) => set("refCustomerPoAmount", event.target.value)}
              />
              <TextField label="Ref Invoice" value={values.refInvoice} error={err("refInvoice")} onChange={(event) => set("refInvoice", event.target.value)} />
              <TextField
                label="Ref Project / Outlet"
                value={values.refProjectOutlet}
                error={err("refProjectOutlet")}
                onChange={(event) => set("refProjectOutlet", event.target.value)}
              />
              <TextField
                label="Exp. Delivery Date"
                type="date"
                required
                min={values.orderDate}
                value={values.expectedDeliveryDate}
                error={err("expectedDeliveryDate")}
                onChange={(event) => set("expectedDeliveryDate", event.target.value)}
              />
              <TextField label="Remarks" value={values.remarks} error={err("remarks")} onChange={(event) => set("remarks", event.target.value)} />
              <TextField
                label="Payment Term Days"
                type="number"
                min={0}
                max={365}
                value={values.paymentTermDays}
                error={err("paymentTermDays")}
                onChange={(event) => set("paymentTermDays", event.target.value)}
              />
              <TextField
                label="Due Limit"
                type="number"
                min={0}
                step="any"
                value={values.dueLimit}
                error={err("dueLimit")}
                onChange={(event) => set("dueLimit", event.target.value)}
              />
              <SelectField
                label="Price Type"
                value={priceListId}
                error={err("priceListId")}
                options={[
                  { value: "", label: "Default sales rate" },
                  ...(setup?.priceLists ?? []).map((list) => ({ value: list.id, label: list.name })),
                ]}
                onChange={(event) => changePriceList(event.target.value)}
              />
              <div className="flex items-end gap-1.5">
                <SelectField
                  label="Custom Offer"
                  className="min-w-0 flex-1"
                  value={values.offerId}
                  disabled={!values.customerId}
                  error={err("offerId") ?? (offerMissing ? "This offer does not apply to the customer on this date." : undefined)}
                  hint={values.customerId ? undefined : "Select a customer first."}
                  options={[
                    { value: "", label: "All applicable offers" },
                    ...(offerMissing && order?.offerId ? [{ value: order.offerId, label: order.offerName ?? "Chosen offer" }] : []),
                    ...availableOffers.map((offer) => ({ value: offer.id, label: offer.name })),
                  ]}
                  onChange={(event) => set("offerId", event.target.value)}
                />
                <Button
                  size="icon"
                  variant="ghost"
                  className="text-accent-strong"
                  aria-label="Terms and conditions"
                  title="Terms and conditions"
                  onClick={() => {
                    const terms = document.getElementById(termsId);
                    terms?.scrollIntoView({ behavior: "smooth", block: "center" });
                    terms?.querySelector("textarea")?.focus({ preventScroll: true });
                  }}
                >
                  <ClipboardList />
                </Button>
                <label
                  title="Attach files (PDF, PNG, JPEG or WebP, up to 5 MB each)"
                  className={cn(buttonClasses("ghost", "icon"), "relative cursor-pointer text-accent-strong")}
                >
                  <Paperclip aria-hidden="true" />
                  <span className="sr-only">Attach files</span>
                  {attachmentCount > 0 && (
                    <span className="absolute -top-1 -right-1 rounded-full bg-accent px-1 text-[10px] leading-4 text-primary-fg">{attachmentCount}</span>
                  )}
                  <input
                    type="file"
                    multiple
                    accept={ATTACHMENT_TYPES.join(",")}
                    className="sr-only"
                    onChange={(event) => {
                      queueFiles(event.target.files);
                      event.target.value = "";
                    }}
                  />
                </label>
              </div>
            </div>
            {attachmentCount > 0 && (
              <ul aria-label="Attachments" className="flex flex-wrap gap-2 text-xs">
                {savedFiles.map((file) => (
                  <li key={file.id} className="flex items-center gap-1 rounded border border-line bg-canvas px-2 py-1">
                    <Paperclip aria-hidden="true" className="size-3 text-ink-faint" />
                    <a href={orderAttachmentUrl(order!.id, file.id)} className="text-ink hover:underline">
                      {file.originalName}
                    </a>
                    <span className="text-ink-faint">({formatSize(file.size)})</span>
                    <button type="button" aria-label={`Remove ${file.originalName}`} className="text-ink-faint hover:text-danger" onClick={() => void removeSaved(file)}>
                      <X className="size-3" />
                    </button>
                  </li>
                ))}
                {queued.map((file, index) => (
                  <li key={`${file.name}-${index}`} className="flex items-center gap-1 rounded border border-dashed border-line px-2 py-1">
                    <Paperclip aria-hidden="true" className="size-3 text-ink-faint" />
                    <span className="text-ink">{file.name}</span>
                    <span className="text-ink-faint">({formatSize(file.size)}, uploaded on save)</span>
                    <button
                      type="button"
                      aria-label={`Remove ${file.name}`}
                      className="text-ink-faint hover:text-danger"
                      onClick={() => setQueued((current) => current.filter((_, at) => at !== index))}
                    >
                      <X className="size-3" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </Card>

        <Card>
          <Section title="Items">
            <ItemEntry
              items={items}
              setup={setup}
              priceListId={priceListId}
              disabled={!businessUnitId || masters.loading}
              warehouseId={warehouseId}
              onAdd={addLine}
            />
            <LinesGrid
              lines={values.lines}
              itemById={itemById}
              storedLines={order?.lines ?? []}
              totals={totals}
              errors={errors}
              onChange={setLine}
              onRemove={(key) => set("lines", values.lines.filter((line) => line.key !== key))}
            />
            {err("lines") && (
              <p role="alert" className="text-xs text-danger">
                {err("lines")}
              </p>
            )}
          </Section>
        </Card>

        <div className="grid gap-4 lg:grid-cols-[1fr_24rem]">
          <div id={termsId}>
            <Card className="h-full">
              <Section title="Terms & Conditions">
                <TextAreaField label="Terms and Conditions" rows={8} value={values.terms} error={err("terms")} onChange={(event) => set("terms", event.target.value)} />
              </Section>
            </Card>
          </div>
          <Card>
            <Section title="Summary">
              <OfferPanel result={pricing.data} itemName={(itemId) => itemById.get(itemId)?.name ?? "Item"} />
              <dl className="flex flex-col gap-2 text-sm">
                <SummaryRow label="Total" value={formatAmount(totals.itemsTotal)} />
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-ink-muted">Total Discount</dt>
                  <dd className="flex items-center gap-1.5">
                    <input
                      aria-label="Total discount percent"
                      type="number"
                      min={0}
                      max={100}
                      step="any"
                      value={discountPercent || ""}
                      placeholder="%"
                      onChange={(event) =>
                        set("discountAmount", String(Math.round(((orZero(event.target.value) * totals.itemsTotal) / 100) * 100) / 100))
                      }
                      className={cn(CONTROL, "h-7 w-16 text-right")}
                    />
                    <input
                      aria-label="Total discount amount"
                      type="number"
                      min={0}
                      step="any"
                      value={values.discountAmount}
                      onChange={(event) => set("discountAmount", event.target.value)}
                      className={cn(CONTROL, "h-7 w-28 text-right tabular-nums", err("discountAmount") && "ring-1 ring-danger")}
                    />
                  </dd>
                </div>
                {err("discountAmount") && <p className="text-right text-xs text-danger">{err("discountAmount")}</p>}
                <SummaryRow label="Item Total (after discount)" value={formatAmount(totals.itemsTotal - totals.discountAmount)} />
                <SummaryRow label="Total VAT" value={formatAmount(totals.vatAmount)} />
                {totals.aitAmount > 0 && <SummaryRow label="Total AIT" value={formatAmount(totals.aitAmount)} />}
                <SummaryRow label="Item Total (Without VAT)" value={formatAmount(totals.itemsBase)} />
                <ChargeRow label="Delivery Charge" value={values.deliveryCharge} error={err("deliveryCharge")} onChange={(value) => set("deliveryCharge", value)} />
                <ChargeRow label="Unloading Charge" value={values.unloadingCharge} error={err("unloadingCharge")} onChange={(value) => set("unloadingCharge", value)} />
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-ink-muted">Payment Method</dt>
                  <dd>
                    <select
                      aria-label="Payment method"
                      value={values.paymentMethod}
                      onChange={(event) => set("paymentMethod", event.target.value as PaymentMethod)}
                      className={cn(CONTROL, "h-7 w-40")}
                    >
                      {PAYMENT_METHODS.map((value) => (
                        <option key={value} value={value}>
                          {PAYMENT_METHOD_LABELS[value]}
                        </option>
                      ))}
                    </select>
                  </dd>
                </div>
                <div className="mt-1 border-t border-line pt-2">
                  <SummaryRow label="Sales Total" value={formatAmount(totals.salesTotal)} strong />
                </div>
              </dl>
            </Section>
          </Card>
        </div>
      </div>

      {customerDialog && businessUnitId && setup && (
        <CustomerDialog
          key={customerDialog === "new" ? "new" : customerDialog.id}
          open
          businessUnitId={businessUnitId}
          lookups={setup}
          customer={customerDialog === "new" ? null : customerDialog}
          onClose={() => setCustomerDialog(null)}
          onSaved={(saved) => {
            setCustomerDialog(null);
            masters.mutate((data) =>
              data
                ? {
                    ...data,
                    customers: [...data.customers.filter((candidate) => candidate.id !== saved.id), saved].sort((a, b) =>
                      a.name.localeCompare(b.name),
                    ),
                  }
                : data!,
            );
            if (dialogFor === "referrer") set("referredBy", saved.name);
            else selectCustomer(saved);
          }}
        />
      )}
    </PageContainer>
  );
}

function SummaryRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className={strong ? "font-semibold text-ink" : "text-ink-muted"}>{label}</dt>
      <dd className={cn("tabular-nums", strong ? "text-base font-semibold text-ink" : "text-ink")}>{value}</dd>
    </div>
  );
}

function ChargeRow({ label, value, error, onChange }: { label: string; value: string; error?: string; onChange: (value: string) => void }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-ink-muted">{label}</dt>
      <dd>
        <input
          aria-label={label}
          type="number"
          min={0}
          step="any"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={cn(CONTROL, "h-7 w-28 text-right tabular-nums", error && "ring-1 ring-danger")}
        />
      </dd>
    </div>
  );
}

// ─── Item entry bar ──────────────────────────────────────────────────────────

/** Item picker bar (category filters, search, qty, rate …). Shows stock when a warehouse is given. */
export function ItemEntry({
  items,
  setup,
  priceListId,
  disabled,
  onAdd,
  warehouseId,
  filterExtra,
}: {
  items: ItemOption[];
  setup: SetupLookups | undefined;
  priceListId: string;
  disabled: boolean;
  onAdd: (line: Omit<LineValues, "key">) => void;
  warehouseId?: string | null;
  /** Shown after the category filters (e.g. Price Type). */
  filterExtra?: ReactNode;
}) {
  const listId = useId();
  const [category, setCategory] = useState<[string, string, string]>(["", "", ""]);
  const [itemType, setItemType] = useState("");
  const itemTypes = useMemo(() => [...new Set(items.map((candidate) => candidate.itemType).filter((value): value is string => Boolean(value)))].sort(), [items]);
  const [itemText, setItemText] = useState("");
  const [entry, setEntry] = useState({ qty: "", unitPrice: "", discountPercent: "0", vatPercent: "0", aitPercent: "0" });
  const [warning, setWarning] = useState<string>();
  /** Quantity in the item's packing unit (Ctn, Bag …); sets Quantity = packs × pieces per pack. */
  const [pack, setPack] = useState("");
  const [error, setError] = useState<string>();

  const categories = useMemo(() => setup?.categories ?? [], [setup]);
  // Items of the deepest chosen category and all its descendants.
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
    (candidate) => (!allowed || (candidate.categoryId && allowed.has(candidate.categoryId))) && (!itemType || candidate.itemType === itemType),
  );
  // As in Managerium, suggestions start after 3 letters.
  const searching = itemText.trim().length >= 3;
  /** "is Customer": search by the printed / customer item code and name. */
  const [byCustomer, setByCustomer] = useState(false);
  const label = (item: ItemOption) =>
    byCustomer ? `${item.printedCode || item.code} — ${item.printedName || item.name}` : `${item.code} — ${item.name}`;
  const item = visible.find((candidate) => label(candidate) === itemText) ?? items.find((candidate) => label(candidate) === itemText);
  const pending = useResource(item ? `pending:${item.id}` : null, () => fetchItemPending(item!.id));
  const stock = useResource(item && warehouseId ? `stock:${warehouseId}:${item.id}` : null, () => fetchStock(warehouseId!, [item!.id]));

  function pick(text: string) {
    setItemText(text);
    const match = items.find((candidate) => label(candidate) === text);
    if (match) {
      setEntry((current) => ({
        ...current,
        qty: current.qty || "1",
        unitPrice: String(rateFor(match, priceListId)),
        vatPercent: String(match.vatPercent),
      }));
    }
  }

  function add() {
    if (!item) {
      setError("Select an item from the list.");
      return;
    }
    if (!(orZero(entry.qty) > 0)) {
      setError("Quantity must be more than 0.");
      return;
    }
    // Orders may exceed stock (production plans from them); the shortfall is only flagged.
    const available = stock.data?.[0]?.qty;
    const shortfall = available !== undefined && orZero(entry.qty) > available;
    onAdd({ itemId: item.id, ...entry });
    setItemText("");
    setEntry({ qty: "", unitPrice: "", discountPercent: "0", vatPercent: "0", aitPercent: "0" });
    setPack("");
    setError(undefined);
    setWarning(shortfall ? `Insufficient stock for ${item.code}: ordered ${formatQty(orZero(entry.qty))}, available ${formatQty(available)}.` : undefined);
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

  const entryTotal = orZero(entry.qty) * orZero(entry.unitPrice) * (1 - orZero(entry.discountPercent) / 100);

  return (
    <div className="flex flex-col gap-3 rounded-lg bg-canvas p-3">
      <div className={cn("grid gap-3 sm:grid-cols-4", Boolean(filterExtra) && "lg:grid-cols-5")}>
        <SelectField
          label="Item Type"
          value={itemType}
          disabled={disabled}
          options={[{ value: "", label: "All" }, ...itemTypes.map((value) => ({ value, label: value }))]}
          onChange={(event) => setItemType(event.target.value)}
        />
        {level(0)}
        {level(1)}
        {level(2)}
        {filterExtra}
      </div>
      <div
        className="grid items-end gap-3 sm:grid-cols-4 lg:grid-cols-[minmax(16rem,2fr)_repeat(8,minmax(5rem,1fr))_auto]"
        onKeyDown={(event) => {
          if (event.key === "Enter" && (event.target as HTMLElement).tagName === "INPUT") {
            event.preventDefault();
            add();
          }
        }}
      >
        <div className="flex flex-col gap-1 sm:col-span-4 lg:col-span-1">
          <div className="flex items-center justify-between gap-2">
            <label htmlFor={`${listId}-item`} className="text-xs text-ink-muted">
              Item <span className="text-danger">*</span>
            </label>
            <label className="flex items-center gap-1 text-xs text-ink-muted" title="Search by the printed / customer item code and name">
              <input
                type="checkbox"
                checked={byCustomer}
                disabled={disabled}
                onChange={(event) => {
                  setByCustomer(event.target.checked);
                  setItemText("");
                }}
              />
              is Customer
            </label>
          </div>
          <input
            id={`${listId}-item`}
            list={listId}
            value={itemText}
            disabled={disabled}
            placeholder={disabled ? "Select an office first" : byCustomer ? "Search customer item code / name (min 3 letters)" : "Select/Search item (min 3 letters)"}
            onChange={(event) => pick(event.target.value)}
            className={cn(CONTROL, "h-7")}
          />
          <datalist id={listId}>
            {(searching ? visible : []).map((candidate) => (
              <option key={candidate.id} value={label(candidate)} />
            ))}
          </datalist>
        </div>
        <TextField
          label="Quantity"
          required
          type="number"
          min={0}
          step="any"
          value={entry.qty}
          disabled={disabled}
          onChange={(event) => {
            setEntry({ ...entry, qty: event.target.value });
            setPack(item?.altUomFactor && event.target.value ? String(Math.round((orZero(event.target.value) / item.altUomFactor) * 1000) / 1000) : "");
          }}
        />
        <TextField
          label={item?.altUom ? `Pack Qty (${item.altUom})` : "Pack Qty"}
          type="number"
          min={0}
          step="any"
          value={pack}
          disabled={disabled || !item?.altUomFactor}
          hint={item && !item.altUomFactor ? "No packing unit" : undefined}
          onChange={(event) => {
            setPack(event.target.value);
            if (item?.altUomFactor) setEntry({ ...entry, qty: event.target.value ? String(Math.round(orZero(event.target.value) * item.altUomFactor * 1000) / 1000) : "" });
          }}
        />
        <TextField label="Rate" type="number" min={0} step="any" value={entry.unitPrice} disabled={disabled} onChange={(event) => setEntry({ ...entry, unitPrice: event.target.value })} />
        <TextField label="MRP" value={item?.mrp === null || !item ? "" : formatAmount(item.mrp)} readOnly tabIndex={-1} />
        <TextField label="Total Amount" value={entryTotal ? formatAmount(entryTotal) : ""} readOnly tabIndex={-1} />
        <TextField
          label="Discount (%)"
          type="number"
          min={0}
          max={100}
          step="any"
          value={entry.discountPercent}
          disabled={disabled}
          onChange={(event) => setEntry({ ...entry, discountPercent: event.target.value })}
        />
        <TextField label="VAT (%)" type="number" min={0} max={100} step="any" value={entry.vatPercent} disabled={disabled} onChange={(event) => setEntry({ ...entry, vatPercent: event.target.value })} />
        <TextField label="AIT (%)" type="number" min={0} max={100} step="any" value={entry.aitPercent} disabled={disabled} onChange={(event) => setEntry({ ...entry, aitPercent: event.target.value })} />
        <Button variant="primary" onClick={add} disabled={disabled}>
          <Plus aria-hidden="true" />
          Add
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        {item && (
          <Indicator color="blue">
            {item.uom}
            {item.altUom ? ` · ${item.altUomFactor} per ${item.altUom}` : ""}
          </Indicator>
        )}
        {/* Always shown, as in Managerium; filled once an item is picked. */}
        <Indicator color="yellow">
          Stock : {!item ? formatQty(0) : !warehouseId ? "No warehouse" : stock.data ? formatQty(stock.data[0].qty) : "…"}
        </Indicator>
        <Indicator color="orange">Pending : {!item ? "" : pending.data ? formatQty(pending.data.pendingQty) : "…"}</Indicator>
        {error && (
          <p role="alert" className="text-danger">
            {error}
          </p>
        )}
        {!error && warning && (
          <p role="status" className="text-warning">
            {warning}
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Lines grid ──────────────────────────────────────────────────────────────

const CELL = cn(CONTROL, "h-7 w-full min-w-0 text-right tabular-nums");

export function LinesGrid({
  lines,
  itemById,
  storedLines,
  totals,
  errors,
  onChange,
  onRemove,
}: {
  lines: LineValues[];
  itemById: Map<string, ItemOption>;
  storedLines: OrderDetail["lines"];
  totals: ReturnType<typeof orderTotals>;
  errors: Record<string, string>;
  onChange: (key: string, patch: Partial<LineValues>) => void;
  onRemove: (key: string) => void;
}) {
  const storedById = new Map(storedLines.map((line) => [line.itemId, line]));
  let altTotal = 0;

  return (
    <div className="overflow-x-auto rounded-lg border border-line">
      <table className="w-full min-w-[1100px] text-sm">
        <thead className="bg-accent-soft text-xs font-semibold text-ink">
          <tr className="border-b border-line">
            {["SL", "Code", "Name", "UOM", "Quantity", "Alt. UOM", "Alt. Qty", "Unit Price", "Disc %", "Net Unit Price", "VAT %", "AIT %", "Total", "Net Total", ""].map(
              (header, index) => (
                <th key={header || index} scope="col" className={cn("px-2 py-2 font-medium", index >= 4 && index !== 5 ? "text-right" : "text-left")}>
                  {header || <span className="sr-only">Remove</span>}
                </th>
              ),
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {/* The header stays visible with no items, as in Managerium. */}
          {lines.length === 0 && (
            <tr>
              <td colSpan={15} className="px-2 py-6 text-center text-ink-muted">
                No items yet. Pick an item above and press Add (or Enter).
              </td>
            </tr>
          )}
          {lines.map((line, index) => {
            const item = itemById.get(line.itemId);
            const stored = storedById.get(line.itemId);
            const amounts = totals.lines[index];
            const factor = item?.altUomFactor ?? stored?.altUomFactor ?? null;
            const alt = altQty(orZero(line.qty), factor);
            altTotal += alt ?? 0;
            const rowError = ["itemId", "qty", "unitPrice", "discountPercent", "vatPercent", "aitPercent"]
              .map((field) => errors[`lines.${index}.${field}`])
              .find(Boolean);
            const input = (field: "qty" | "unitPrice" | "discountPercent" | "vatPercent" | "aitPercent", labelText: string) => (
              <input
                aria-label={`${labelText}, row ${index + 1}`}
                type="number"
                min={0}
                step="any"
                value={line[field]}
                onChange={(event) => onChange(line.key, { [field]: event.target.value })}
                className={cn(CELL, errors[`lines.${index}.${field}`] && "ring-1 ring-danger")}
              />
            );
            return (
              <tr key={line.key} className="align-top">
                <td className="px-2 py-1.5 pt-2.5 text-ink-faint tabular-nums">{index + 1}</td>
                <td className="px-2 py-1.5 pt-2.5 whitespace-nowrap text-ink-muted">{item?.code ?? stored?.itemCode}</td>
                <td className="px-2 py-1.5 pt-2.5 text-ink">
                  {item?.name ?? stored?.itemName ?? "Unknown item"}
                  {rowError && <p className="text-xs text-danger">{rowError}</p>}
                </td>
                <td className="px-2 py-1.5 pt-2.5 text-ink-muted">{item?.uom ?? stored?.uom}</td>
                <td className="w-24 px-2 py-1.5">{input("qty", "Quantity")}</td>
                <td className="px-2 py-1.5 pt-2.5 text-ink-muted">{item?.altUom ?? stored?.altUom ?? "—"}</td>
                <td className="px-2 py-1.5 pt-2.5 text-right tabular-nums">{alt === null ? "—" : formatQty(alt)}</td>
                <td className="w-28 px-2 py-1.5">{input("unitPrice", "Unit price")}</td>
                <td className="w-20 px-2 py-1.5">{input("discountPercent", "Discount percent")}</td>
                <td className="px-2 py-1.5 pt-2.5 text-right tabular-nums">{amounts ? amounts.netUnitPrice.toFixed(2) : "—"}</td>
                <td className="w-20 px-2 py-1.5">{input("vatPercent", "VAT percent")}</td>
                <td className="w-20 px-2 py-1.5">{input("aitPercent", "AIT percent")}</td>
                <td className="px-2 py-1.5 pt-2.5 text-right tabular-nums">{formatAmount(amounts?.grossAmount ?? 0)}</td>
                <td className="px-2 py-1.5 pt-2.5 text-right font-medium text-ink tabular-nums">{formatAmount(amounts?.lineTotal ?? 0)}</td>
                <td className="px-2 py-1.5">
                  <Button variant="ghost" size="icon" aria-label={`Remove row ${index + 1}`} onClick={() => onRemove(line.key)}>
                    <Trash2 />
                  </Button>
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot className="border-t border-line-strong bg-canvas text-sm font-medium text-ink">
          <tr>
            <td colSpan={4} className="px-2 py-2">
              Total:
            </td>
            <td className="px-2 py-2 text-right tabular-nums">{formatQty(totals.totalQty)}</td>
            <td />
            <td className="px-2 py-2 text-right tabular-nums">{formatQty(Math.round(altTotal * 1000) / 1000)}</td>
            <td colSpan={5} />
            <td className="px-2 py-2 text-right tabular-nums">{formatAmount(totals.lines.reduce((sum, line) => sum + line.grossAmount, 0))}</td>
            <td className="px-2 py-2 text-right tabular-nums">{formatAmount(totals.itemsTotal)}</td>
            <td />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

