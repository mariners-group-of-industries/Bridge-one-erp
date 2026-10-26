"use client";

import { ArrowLeft, Save, Search, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { PageContainer, PageHead } from "@/components/layout/page";
import { Button } from "@/components/ui/button";
import { SelectField, TextField } from "@/components/ui/form-field";
import { Card, ErrorState, LoadingState } from "@/components/ui/section";
import { useToast } from "@/components/ui/toast";
import { useResource } from "@/hooks/use-resource";
import { errorMessage } from "@/lib/api/client";
import { cn } from "@/lib/cn";
import { LineTable } from "@/features/production/bom/components/BomDialogs";
import { issuesToErrors } from "@/features/sales/lib/form";
import { useToday } from "@/features/sales/lib/use-today";
import { paths } from "../../paths";
import { orderInputSchema, type CustomerOption, type OrderDetail, type OrderInput, type OrderLookups } from "../schemas/order.schema";
import { createOrder, fetchCustomerSalesOrders, fetchOrder, fetchOrderLookups, fetchOrderPreview, searchOrderCustomers, updateOrder } from "../services/order.api";
import { money, qty2 } from "./OrderParts";

interface Values {
  orderDate: string;
  productionDate: string;
  customer: CustomerOption | null;
  salesOrderId: string;
  customerPoNo: string;
  itemId: string;
  bomId: string;
  quantity: string;
  officeId: string;
  warehouseId: string;
  workCenterId: string;
  machineName: string;
  narration: string;
}

function initialValues(lookups: OrderLookups, today: string, record?: OrderDetail): Values {
  const [code = "", ...rest] = record?.customerName?.split(" - ") ?? [];
  return {
    orderDate: record?.orderDate ?? today,
    productionDate: record?.productionDate ?? today,
    customer: record?.customerId ? { id: record.customerId, code, name: rest.join(" - ") } : null,
    salesOrderId: record?.salesOrderId ?? "",
    customerPoNo: record?.customerPoNo ?? "",
    itemId: record?.itemId ?? "",
    bomId: record?.bomId ?? "",
    quantity: record ? String(record.orderQty) : "",
    officeId: record?.officeId ?? (lookups.offices.length === 1 ? lookups.offices[0].id : ""),
    warehouseId: record?.warehouseId ?? "",
    workCenterId: record?.workCenterId ?? "",
    machineName: record?.machineName ?? "",
    narration: record?.narration ?? "",
  };
}

function toInput(values: Values): OrderInput {
  return {
    orderDate: values.orderDate,
    productionDate: values.productionDate,
    customerId: values.customer?.id ?? null,
    salesOrderId: values.salesOrderId || null,
    customerPoNo: values.customerPoNo || null,
    itemId: values.itemId,
    bomId: values.bomId,
    quantity: values.quantity.trim() === "" ? Number.NaN : Number(values.quantity),
    officeId: values.officeId,
    warehouseId: values.warehouseId,
    workCenterId: values.workCenterId || null,
    machineName: values.machineName || null,
    narration: values.narration || null,
  };
}

export function NewOrderView() {
  const today = useToday();
  const lookups = useResource("production-order-lookups", fetchOrderLookups);
  if (lookups.error) return <Failed message={errorMessage(lookups.error)} onRetry={lookups.reload} />;
  if (!lookups.data || !today) return <LoadingState />;
  return <OrderForm lookups={lookups.data} today={today} />;
}

export function EditOrderView({ id }: { id: string }) {
  const today = useToday();
  const lookups = useResource("production-order-lookups", fetchOrderLookups);
  const record = useResource(`production-order:${id}`, () => fetchOrder(id));
  const error = lookups.error ?? record.error;
  if (error) return <Failed message={errorMessage(error)} onRetry={() => (lookups.reload(), record.reload())} />;
  if (!lookups.data || !record.data || !today) return <LoadingState />;
  if (!record.data.canEdit) {
    return (
      <Failed
        message={`${record.data.number} can no longer be edited: only orders nobody has approved yet can change.`}
        backTo={paths.order(id)}
      />
    );
  }
  return <OrderForm key={record.data.updatedAt} lookups={lookups.data} today={today} record={record.data} />;
}

function Failed({ message, onRetry, backTo }: { message: string; onRetry?: () => void; backTo?: string }) {
  return (
    <PageContainer className="max-w-none">
      <PageHead title="Production Order" />
      <Card>
        <ErrorState message={message} onRetry={onRetry} />
        {backTo && (
          <p className="px-4 pb-4 text-center text-sm">
            <Link href={backTo} className="text-accent-strong hover:underline">
              Open the order
            </Link>
          </p>
        )}
      </Card>
    </PageContainer>
  );
}

/** Customers matching `term` (3+ letters), debounced. */
function useCustomerSearch(term: string) {
  const wanted = term.trim();
  const [found, setFound] = useState<{ term: string; rows: CustomerOption[]; error?: string }>({ term: "", rows: [] });
  useEffect(() => {
    if (wanted.length < 3) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      searchOrderCustomers(wanted).then(
        (rows) => !cancelled && setFound({ term: wanted, rows }),
        (error: unknown) => !cancelled && setFound({ term: wanted, rows: [], error: errorMessage(error) }),
      );
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [wanted]);
  return { ...found, ready: wanted.length >= 3 && found.term === wanted };
}

/** `value` once it has stopped changing for `delay` ms. */
function useDebounced<T>(value: T, delay = 400): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return settled;
}

function OrderForm({ lookups, today, record }: { lookups: OrderLookups; today: string; record?: OrderDetail }) {
  const router = useRouter();
  const toast = useToast();
  const [values, setValues] = useState(() => initialValues(lookups, today, record));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [customerTerm, setCustomerTerm] = useState("");
  const customerSearch = useCustomerSearch(values.customer ? "" : customerTerm);
  const salesOrders = useResource(values.customer ? `customer-sales-orders:${values.customer.id}` : null, () => fetchCustomerSalesOrders(values.customer!.id));

  const set = (patch: Partial<Values>) => setValues((current) => ({ ...current, ...patch }));
  const office = lookups.offices.find((row) => row.id === values.officeId);
  const unit = office?.businessUnitId;
  const items = lookups.items.filter((item) => !unit || item.businessUnitId === unit);
  const item = lookups.items.find((row) => row.itemId === values.itemId);
  const warehouses = lookups.warehouses.filter((warehouse) => warehouse.officeId === values.officeId);
  const workCenters = lookups.workCenters.filter((center) => (!unit || center.businessUnitId === unit) && (!center.officeId || !values.officeId || center.officeId === values.officeId));

  // Material explosion preview, once the quantity has settled.
  const quantity = useDebounced(Number(values.quantity));
  const previewKey = values.bomId && values.itemId && quantity > 0 ? JSON.stringify([values.bomId, values.itemId, quantity, values.warehouseId]) : null;
  const preview = useResource(previewKey ? `production-order-preview:${previewKey}` : null, () =>
    fetchOrderPreview({ bomId: values.bomId, itemId: values.itemId, quantity, ...(values.warehouseId ? { warehouseId: values.warehouseId } : {}) }),
  );

  function chooseItem(itemId: string) {
    const next = lookups.items.find((row) => row.itemId === itemId);
    set({ itemId, bomId: next?.boms.length === 1 ? next.boms[0].id : "" });
  }

  function chooseSalesOrder(salesOrderId: string) {
    const order = salesOrders.data?.find((row) => row.id === salesOrderId);
    const line = order?.lines.find((row) => (values.itemId ? row.itemId === values.itemId : items.some((option) => option.itemId === row.itemId)));
    if (!line) return set({ salesOrderId });
    const next = lookups.items.find((row) => row.itemId === line.itemId);
    set({
      salesOrderId,
      itemId: line.itemId,
      bomId: values.itemId === line.itemId ? values.bomId : next?.boms.length === 1 ? next.boms[0].id : "",
      quantity: values.quantity || String(line.qty),
    });
  }

  async function save() {
    const input = toInput(values);
    const parsed = orderInputSchema.safeParse(input);
    if (!parsed.success) {
      setErrors(issuesToErrors(parsed.error));
      toast.error(parsed.error.issues[0]?.message ?? "Please correct the highlighted fields.");
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      const saved = record ? await updateOrder(record.id, { version: record.updatedAt, data: input }) : await createOrder(input);
      toast.success(`Production order ${saved.number} ${record ? "updated" : "created"}.`);
      router.push(paths.order(saved.id));
    } catch (error) {
      toast.error(errorMessage(error));
      setBusy(false);
    }
  }

  const shortages = preview.data?.materials.filter((line) => line.stock !== null && line.stock < line.requiredQty).length ?? 0;

  return (
    <PageContainer className="max-w-none">
      <PageHead
        title={
          <span className="flex items-center gap-2">
            <Link
              href={record ? paths.order(record.id) : paths.orders}
              aria-label="Back"
              className="rounded-md p-1 text-ink-muted hover:bg-control hover:text-ink"
            >
              <ArrowLeft aria-hidden="true" className="size-5" />
            </Link>
            {record ? `Edit Production Order ${record.number}` : "Create Production Order"}
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
        <Card className="p-4">
          <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
            <TextField
              label="Order Date"
              required
              type="date"
              value={values.orderDate}
              error={errors.orderDate}
              onChange={(event) => set({ orderDate: event.target.value })}
            />
            <TextField
              label="Production Date"
              required
              type="date"
              min={values.orderDate}
              value={values.productionDate}
              error={errors.productionDate}
              onChange={(event) => set({ productionDate: event.target.value })}
            />
            <div className="relative">
              {values.customer ? (
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-ink-muted">Customer</span>
                  <span className="flex h-7 items-center gap-2 rounded-md bg-control px-2 text-sm text-ink">
                    <span className="min-w-0 flex-1 truncate">
                      {values.customer.code ? `${values.customer.code} - ` : ""}
                      {values.customer.name}
                    </span>
                    <button
                      type="button"
                      aria-label="Clear customer"
                      onClick={() => {
                        set({ customer: null, salesOrderId: "" });
                        setCustomerTerm("");
                      }}
                      className="text-ink-faint hover:text-ink"
                    >
                      <X aria-hidden="true" className="size-3.5" />
                    </button>
                  </span>
                  {errors.customerId && <p className="text-xs text-danger">{errors.customerId}</p>}
                </div>
              ) : (
                <TextField
                  label="Customer"
                  placeholder="Select/Search Customer (min 3 letters)"
                  value={customerTerm}
                  error={errors.customerId}
                  onChange={(event) => setCustomerTerm(event.target.value)}
                />
              )}
              {!values.customer && customerTerm.trim().length >= 3 && (
                <div role="listbox" aria-label="Matching customers" className="absolute top-12 z-10 max-h-56 w-full overflow-y-auto rounded-md border border-line bg-surface shadow-dropdown">
                  {!customerSearch.ready ? (
                    <p className="flex items-center gap-2 px-3 py-2 text-xs text-ink-faint">
                      <Search aria-hidden="true" className="size-3.5" />
                      Searching…
                    </p>
                  ) : customerSearch.error ? (
                    <p className="px-3 py-2 text-xs text-danger">{customerSearch.error}</p>
                  ) : customerSearch.rows.length === 0 ? (
                    <p className="px-3 py-2 text-xs text-ink-faint">No customer matches.</p>
                  ) : (
                    customerSearch.rows.map((customer) => (
                      <button
                        key={customer.id}
                        type="button"
                        role="option"
                        aria-selected={false}
                        onClick={() => set({ customer, salesOrderId: "" })}
                        className="block w-full px-3 py-2 text-left text-sm text-ink hover:bg-hover"
                      >
                        {customer.code} - {customer.name}
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
            <SelectField
              label="Sales Order Number"
              value={values.salesOrderId}
              disabled={!values.customer}
              hint={!values.customer ? "Choose a customer first." : salesOrders.data?.length === 0 ? "This customer has no confirmed sales order." : undefined}
              options={[
                { value: "", label: salesOrders.loading ? "Loading…" : "Sales Order Number" },
                ...(salesOrders.data ?? []).map((order) => ({ value: order.id, label: `${order.number} (${order.orderDate.split("-").reverse().join("-")})` })),
              ]}
              onChange={(event) => chooseSalesOrder(event.target.value)}
            />

            <SelectField
              label="Item"
              required
              value={values.itemId}
              error={errors.itemId}
              hint={items.length === 0 ? "No item has an active bill of material yet." : undefined}
              options={[{ value: "", label: "FG/SFG item with an active BOM" }, ...items.map((option) => ({ value: option.itemId, label: `${option.code} - ${option.name} (${option.uom})` }))]}
              onChange={(event) => chooseItem(event.target.value)}
            />
            <SelectField
              label="Bill Of Material"
              required
              value={values.bomId}
              error={errors.bomId}
              disabled={!item}
              options={[
                { value: "", label: item ? "Choose the BOM" : "Choose the item first" },
                ...(item?.boms ?? []).map((bom) => ({ value: bom.id, label: `${bom.name} (lot ${qty2(bom.lotSize)})` })),
              ]}
              onChange={(event) => set({ bomId: event.target.value })}
            />
            <TextField
              label="Quantity"
              required
              type="number"
              min={0}
              step="any"
              placeholder={item ? `Quantity (${item.uom})` : "Quantity"}
              value={values.quantity}
              error={errors.quantity}
              onChange={(event) => set({ quantity: event.target.value })}
            />
            <SelectField
              label="Office"
              required
              value={values.officeId}
              error={errors.officeId}
              options={[{ value: "", label: "Factory / Branch" }, ...lookups.offices.map((row) => ({ value: row.id, label: row.name }))]}
              onChange={(event) => set({ officeId: event.target.value, warehouseId: "", workCenterId: "" })}
            />
            <SelectField
              label="Warehouse"
              required
              value={values.warehouseId}
              error={errors.warehouseId}
              disabled={!values.officeId}
              hint={values.officeId && warehouses.length === 0 ? "This office has no warehouse." : undefined}
              options={[{ value: "", label: values.officeId ? "Storage location" : "Choose the office first" }, ...warehouses.map((row) => ({ value: row.id, label: row.name }))]}
              onChange={(event) => set({ warehouseId: event.target.value })}
            />
            <SelectField
              label="Work Center"
              value={values.workCenterId}
              error={errors.workCenterId}
              options={[{ value: "", label: "N/A" }, ...workCenters.map((center) => ({ value: center.id, label: `${center.code} - ${center.name}` }))]}
              onChange={(event) => {
                const center = lookups.workCenters.find((row) => row.id === event.target.value);
                set({ workCenterId: event.target.value, machineName: values.machineName || center?.name || "" });
              }}
            />
            <TextField
              label="Machine Name"
              maxLength={100}
              placeholder="Machine Name"
              list="production-machine-names"
              value={values.machineName}
              error={errors.machineName}
              onChange={(event) => set({ machineName: event.target.value })}
            />
            <datalist id="production-machine-names">
              {workCenters.map((center) => (
                <option key={center.id} value={center.name} />
              ))}
            </datalist>
            <TextField label="Customer PO No" maxLength={60} placeholder="Customer PO No" value={values.customerPoNo} onChange={(event) => set({ customerPoNo: event.target.value })} />
            <TextField
              label="Remarks"
              className="sm:col-span-2"
              maxLength={500}
              placeholder="Narration / remarks"
              value={values.narration}
              error={errors.narration}
              onChange={(event) => set({ narration: event.target.value })}
            />
          </div>
        </Card>

        <Card className="flex flex-col gap-3 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-semibold text-ink">Required Materials</h2>
            {preview.data && (
              <p className="text-sm text-ink-muted">
                Lot size {qty2(preview.data.lotSize)} · factor {qty2(preview.data.factor)} · estimated cost{" "}
                <strong className="text-ink tabular-nums">{money(preview.data.totalCost)}</strong>
              </p>
            )}
          </div>
          {!previewKey ? (
            <p className="text-sm text-ink-faint">Choose the item, its BOM and a quantity to see the materials this order needs.</p>
          ) : preview.error ? (
            <ErrorState message={errorMessage(preview.error)} onRetry={preview.reload} />
          ) : !preview.data ? (
            <LoadingState label="Calculating materials…" />
          ) : (
            <div className={cn("flex flex-col gap-2", preview.loading && "opacity-60")}>
              {shortages > 0 && (
                <p role="status" className="text-sm text-warning">
                  {shortages} material{shortages === 1 ? " is" : "s are"} short in the chosen warehouse. The order can still be saved.
                </p>
              )}
              <LineTable
                columns={[
                  { header: "SL", className: "w-12" },
                  { header: "Item Code" },
                  { header: "Item Name" },
                  { header: "UoM" },
                  { header: "BOM Qty (per lot)", align: "right" },
                  { header: "Required QTY", align: "right" },
                  { header: "Stock", align: "right" },
                ]}
                rows={preview.data.materials.map((line, index) => [
                  index + 1,
                  line.code,
                  <span key="name" className="text-ink">{line.name}</span>,
                  line.uom,
                  qty2(line.bomQty),
                  <span key="req" className="font-medium text-ink">{qty2(line.requiredQty)}</span>,
                  line.stock === null ? (
                    <span key="stock" className="text-ink-faint">Choose a warehouse</span>
                  ) : (
                    <span key="stock" className={line.stock < line.requiredQty ? "font-medium text-danger" : undefined}>
                      {qty2(line.stock)}
                    </span>
                  ),
                ])}
                empty="This BOM has no input material."
              />
            </div>
          )}
        </Card>
      </div>
    </PageContainer>
  );
}
