"use client";

import { ArrowLeft, Save } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { PageContainer, PageHead } from "@/components/layout/page";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/form-field";
import { Card, ErrorState, LoadingState } from "@/components/ui/section";
import { useToast } from "@/components/ui/toast";
import { useResource } from "@/hooks/use-resource";
import { errorMessage } from "@/lib/api/client";
import { cn } from "@/lib/cn";
import { LineTable } from "@/features/production/bom/components/BomDialogs";
import { issuesToErrors } from "@/features/sales/lib/form";
import { useToday } from "@/features/sales/lib/use-today";
import { Combobox } from "../../components/Combobox";
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
    customer: record?.customerId ? { id: record.customerId, code, name: rest.join(" - "), phone: null } : null,
    salesOrderId: record?.salesOrderId ?? "",
    customerPoNo: record?.customerPoNo ?? "",
    itemId: record?.itemId ?? "",
    bomId: record?.bomId ?? "",
    quantity: record ? String(record.orderQty) : "1",
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

/** Customers matching `term` (3+ letters), or the first ones when it is empty; debounced. */
function useCustomerSearch(term: string) {
  const wanted = term.trim();
  const searchable = wanted.length === 0 || wanted.length >= 3;
  const [found, setFound] = useState<{ term: string; rows: CustomerOption[]; error?: string } | null>(null);
  useEffect(() => {
    if (!searchable) return;
    let cancelled = false;
    const timer = setTimeout(
      () => {
        searchOrderCustomers(wanted).then(
          (rows) => !cancelled && setFound({ term: wanted, rows }),
          (error: unknown) => !cancelled && setFound({ term: wanted, rows: [], error: errorMessage(error) }),
        );
      },
      wanted ? 300 : 0,
    );
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [wanted, searchable]);
  return { rows: found?.rows ?? [], error: found?.error, searchable, ready: searchable && found?.term === wanted };
}

const customerLabel = (customer: CustomerOption) => `${customer.code ? `${customer.code} - ` : ""}${customer.name}${customer.phone ? ` (${customer.phone})` : ""}`;
/** One "Item" choice per item and BOM, as in Managerium ("code - name (uom) - (BOM name)"). */
const itemBomKey = (itemId: string, bomId: string) => (itemId && bomId ? `${itemId}|${bomId}` : "");

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
  const customerSearch = useCustomerSearch(customerTerm);
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

  const itemOptions = items.flatMap((option) =>
    option.boms.map((bom) => ({ value: itemBomKey(option.itemId, bom.id), label: `${option.code} - ${option.name} (${option.uom}) - (${bom.name})` })),
  );
  // Work centers of the chosen office (or of no office in particular), by name as in Managerium.
  const officeWorkCenters = values.officeId ? workCenters.map((center) => ({ value: center.id, label: center.name })) : [];

  function chooseItem(key: string) {
    const [itemId = "", bomId = ""] = key.split("|");
    set({ itemId, bomId });
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
            <Combobox
              label="Customer"
              placeholder="Select/Search Customer (min 3 letters)"
              value={values.customer?.id ?? ""}
              selectedLabels={values.customer ? { [values.customer.id]: customerLabel(values.customer) } : undefined}
              error={errors.customerId}
              filter={false}
              options={customerSearch.rows.map((customer) => ({ value: customer.id, label: customerLabel(customer) }))}
              loading={customerSearch.searchable && !customerSearch.ready}
              emptyText={!customerSearch.searchable ? "Type at least 3 letters." : (customerSearch.error ?? "No customer matches.")}
              onQueryChange={setCustomerTerm}
              onChange={(id) => set({ customer: customerSearch.rows.find((row) => row.id === id) ?? null, salesOrderId: "" })}
            />
            <Combobox
              label="Sales Order Number"
              placeholder="Customer Order"
              value={values.salesOrderId}
              disabled={!values.customer}
              hint={!values.customer ? "Choose a customer first." : salesOrders.data?.length === 0 ? "This customer has no confirmed sales order." : undefined}
              loading={salesOrders.loading}
              options={(salesOrders.data ?? []).map((order) => ({ value: order.id, label: `${order.number} (${order.orderDate.split("-").reverse().join("-")})` }))}
              emptyText="No sales order matches."
              onChange={chooseSalesOrder}
            />

            <Combobox
              label="Item"
              required
              placeholder="Item"
              value={itemBomKey(values.itemId, values.bomId)}
              error={errors.itemId ?? errors.bomId}
              hint={items.length === 0 ? "No FG/SFG item has an active bill of material yet." : undefined}
              options={itemOptions}
              emptyText="No item matches."
              onChange={chooseItem}
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
            <Combobox
              label="Office"
              required
              placeholder="Office"
              value={values.officeId}
              error={errors.officeId}
              options={lookups.offices.map((row) => ({ value: row.id, label: row.name }))}
              emptyText="No office matches."
              onChange={(officeId) => set({ officeId, warehouseId: officeId === values.officeId ? values.warehouseId : "", workCenterId: officeId === values.officeId ? values.workCenterId : "" })}
            />
            <Combobox
              label="Warehouse"
              required
              placeholder="Warehouse"
              value={values.warehouseId}
              error={errors.warehouseId}
              disabled={!values.officeId}
              hint={!values.officeId ? "Choose the office first." : warehouses.length === 0 ? "This office has no warehouse." : undefined}
              options={warehouses.map((row) => ({ value: row.id, label: row.name }))}
              emptyText="No warehouse matches."
              onChange={(warehouseId) => set({ warehouseId })}
            />

            <Combobox
              label="Work Center"
              placeholder="Work Center"
              value={values.workCenterId}
              error={errors.workCenterId}
              disabled={!values.officeId}
              hint={values.officeId ? undefined : "Choose the office first."}
              options={officeWorkCenters}
              emptyText="No active work center for this office."
              onChange={(workCenterId) => {
                const center = lookups.workCenters.find((row) => row.id === workCenterId);
                set({ workCenterId, machineName: values.machineName || center?.name || "" });
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
            <TextField label="Remarks" maxLength={500} placeholder="Remarks" value={values.narration} error={errors.narration} onChange={(event) => set({ narration: event.target.value })} />
            <TextField label="Customer PO No" maxLength={60} placeholder="Customer PO No" value={values.customerPoNo} onChange={(event) => set({ customerPoNo: event.target.value })} />
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
            <p className="text-sm text-ink-faint">Choose the item (with its BOM) and a quantity to see the materials this order needs.</p>
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
