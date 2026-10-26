"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, type ReactNode } from "react";
import { PageContainer, PageHead } from "@/components/layout/page";
import { Button, buttonClasses } from "@/components/ui/button";
import { CONTROL, CheckboxField } from "@/components/ui/form-field";
import { Indicator } from "@/components/ui/indicator";
import { Card, ErrorState, LoadingState, Section } from "@/components/ui/section";
import { useToast } from "@/components/ui/toast";
import { useResource } from "@/hooks/use-resource";
import { useSaveShortcut } from "@/hooks/use-save-shortcut";
import { errorMessage } from "@/lib/api/client";
import { cn } from "@/lib/cn";
import { formatAmount, formatQty } from "../../dashboard/lib/format";
import { issuesToErrors } from "../../lib/form";
import { formatDay } from "../../lib/use-today";
import type { SalesLookups } from "../../masters/schemas/masters.schema";
import { fetchSalesLookups, fetchSetupLookups } from "../../masters/services/masters.api";
import { altQty, orderLineAmounts, orderTotals } from "../../orders/lib/order-totals";
import { paths } from "../../paths";
import { round2 } from "../../quotations/lib/totals";
import { APPROVED_ORDER_STATUS_LABELS, orderDeliverySchema, type DeliveryDetail, type OrderForDelivery, type WarehouseOption } from "../schemas/delivery.schema";
import { createDelivery, fetchDelivery, fetchOrderForDelivery, fetchStock, fetchVehicles, fetchWarehouses, updateDelivery } from "../services/delivery.api";
import { VehicleSection } from "./DeliveryVehicle";
import { DeliverySummary, TransportSection, blankHeader, headerFromDelivery, headerInput, nowTime, type HeaderValues } from "./DeliveryFormParts";

/** /sales/deliveries/new?order=… or editing an order delivery. */
export function DeliveryOrderFormView({ orderId, deliveryId, today }: { orderId: string; deliveryId?: string; today: string }) {
  const lookups = useResource("sales-lookups", fetchSalesLookups);
  const warehouses = useResource("warehouses", fetchWarehouses);
  const delivery = useResource(deliveryId ?? null, () => fetchDelivery(deliveryId!));
  const order = useResource(`order-for-delivery:${orderId}:${deliveryId ?? ""}`, () => fetchOrderForDelivery(orderId, today, deliveryId));
  const error = lookups.error ?? warehouses.error ?? order.error ?? delivery.error;
  const title = deliveryId ? "Edit Delivery" : "Delivery For SO";

  if (error) {
    return (
      <PageContainer>
        <PageHead title={title} />
        <Card>
          <ErrorState message={errorMessage(error)} onRetry={order.reload} />
        </Card>
      </PageContainer>
    );
  }
  if (!lookups.data || !warehouses.data || !order.data || (deliveryId && !delivery.data)) {
    return (
      <PageContainer>
        <PageHead title={title} />
        <LoadingState />
      </PageContainer>
    );
  }
  return (
    <OrderDeliveryEditor
      key={delivery.data?.updatedAt ?? "new"}
      today={today}
      lookups={lookups.data}
      warehouses={warehouses.data}
      order={order.data}
      delivery={delivery.data ?? null}
    />
  );
}

const toNumber = (value: string) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

function OrderDeliveryEditor({
  today,
  lookups,
  warehouses,
  order,
  delivery,
}: {
  today: string;
  lookups: SalesLookups;
  warehouses: WarehouseOption[];
  order: OrderForDelivery;
  delivery: DeliveryDetail | null;
}) {
  const router = useRouter();
  const toast = useToast();
  const setup = useResource(`setup:${order.businessUnitId}`, () => fetchSetupLookups(order.businessUnitId));
  const vehicles = useResource(`vehicles:${order.businessUnitId}`, () => fetchVehicles(order.businessUnitId));

  const [header, setHeader] = useState<HeaderValues>(() => {
    if (delivery) return headerFromDelivery(delivery);
    const firstWarehouse = warehouses.find((warehouse) => warehouse.officeId === order.officeId);
    return {
      ...blankHeader(today, nowTime()),
      officeId: order.officeId,
      warehouseId: firstWarehouse?.id ?? "",
      salesPersonId: order.salesPersonId ?? "",
      shipToAddressId: order.shipToAddressId ?? "",
      shippingAddress: order.shipToAddressId ? "" : (order.shippingAddress ?? ""),
      refCustomerPo: order.refCustomerPo ?? "",
      refCustomerPoDate: order.refCustomerPoDate ?? "",
      refInvoice: order.refInvoice ?? "",
      refProjectOutlet: order.refProjectOutlet ?? "",
      terms: order.terms ?? "",
      paymentMethod: order.paymentMethod,
      paymentTermDays: String(order.paymentTermDays),
      // Order charges go on the first delivery only.
      deliveryCharge: String(order.chargesBilled ? 0 : order.deliveryCharge),
      unloadingCharge: String(order.chargesBilled ? 0 : order.unloadingCharge),
    };
  });
  const original = useMemo(() => new Map((delivery?.lines ?? []).map((line) => [line.orderLineId, line.qty])), [delivery]);
  const [qtys, setQtys] = useState<Record<string, string>>(() =>
    Object.fromEntries(order.lines.map((line) => [line.orderLineId, original.has(line.orderLineId) ? String(original.get(line.orderLineId)) : ""])),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const itemIds = order.lines.map((line) => line.itemId);
  const stock = useResource(header.warehouseId ? `stock:${header.warehouseId}:${itemIds.join(",")}` : null, () => fetchStock(header.warehouseId, itemIds));
  // When editing, this delivery's own quantities are already out of the stock.
  const sameWarehouse = delivery?.warehouseId === header.warehouseId;
  const stockOf = (itemId: string) => {
    const level = stock.data?.find((row) => row.itemId === itemId)?.qty;
    if (level === undefined) return undefined;
    const own = sameWarehouse ? (delivery?.lines.filter((line) => line.itemId === itemId).reduce((sum, line) => sum + line.qty, 0) ?? 0) : 0;
    return Math.round((level + own) * 1000) / 1000;
  };

  const set = <K extends keyof HeaderValues>(key: K, value: HeaderValues[K]) => setHeader((current) => ({ ...current, [key]: value }));

  const chosen = order.lines.filter((line) => toNumber(qtys[line.orderLineId] ?? "") > 0);
  const priced = chosen.map((line) => orderLineAmounts({ ...line, qty: toNumber(qtys[line.orderLineId]) }, order.priceIncludesVat));
  const itemsTotal = round2(priced.reduce((sum, line) => sum + line.lineTotal, 0));
  const discountAmount = order.itemsTotal > 0 ? round2((order.discountAmount * itemsTotal) / order.itemsTotal) : 0;
  const totals = orderTotals(
    chosen.map((line) => ({ ...line, qty: toNumber(qtys[line.orderLineId]) })),
    { priceIncludesVat: order.priceIncludesVat, discountAmount, deliveryCharge: toNumber(header.deliveryCharge), unloadingCharge: toNumber(header.unloadingCharge) },
  );

  const deliverAll = order.lines.every((line) => line.remaining <= 0 || toNumber(qtys[line.orderLineId] ?? "") === line.remaining);
  function toggleAll(checked: boolean) {
    setQtys(
      Object.fromEntries(
        order.lines.map((line) => {
          const available = stockOf(line.itemId);
          const qty = checked ? Math.min(line.remaining, available ?? line.remaining) : 0;
          return [line.orderLineId, qty > 0 ? String(qty) : ""];
        }),
      ),
    );
  }

  async function save() {
    if (busy) return;
    const input = {
      deliveryType: "SALES_ORDER" as const,
      salesOrderId: order.id,
      ...headerInput(header),
      lines: chosen.map((line) => ({ orderLineId: line.orderLineId, qty: toNumber(qtys[line.orderLineId]) })),
    };
    const parsed = orderDeliverySchema.safeParse(input);
    const lineErrors: Record<string, string> = {};
    for (const line of chosen) {
      const qty = toNumber(qtys[line.orderLineId]);
      const available = stockOf(line.itemId);
      if (qty > line.maxQty + 1e-9) lineErrors[`qty.${line.orderLineId}`] = `At most ${formatQty(line.maxQty)}`;
      else if (available !== undefined && qty > available + 1e-9) lineErrors[`qty.${line.orderLineId}`] = `Only ${formatQty(available)} in stock`;
    }
    if (!parsed.success || Object.keys(lineErrors).length) {
      const next = { ...(parsed.success ? {} : issuesToErrors(parsed.error)), ...lineErrors };
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

  return (
    <PageContainer className="max-w-none">
      <PageHead
        title={
          <span className="flex items-center gap-2">
            <Link href={delivery ? paths.delivery(delivery.id) : paths.deliveryTab("approved")} aria-label="Back" className={buttonClasses("ghost", "icon")}>
              <ArrowLeft />
            </Link>
            {delivery ? `Edit Delivery ${delivery.number}` : "Delivery For SO"}
          </span>
        }
        subtitle={`Office: ${order.officeName}`}
        actions={
          <Button variant="primary" onClick={save} loading={busy}>
            Save
          </Button>
        }
      />

      <div className="flex flex-col gap-4">
        <Card className="p-4">
          <div className="mb-3 flex flex-wrap items-center gap-x-6 gap-y-1 text-sm">
            <span className="text-ink-muted">
              Ledger Balance: <span className="font-medium text-ink tabular-nums">{formatAmount(order.ledgerBalance)}</span>
            </span>
            <span className="text-ink-muted">
              Credit Limit: <span className="font-medium text-ink tabular-nums">{order.creditLimit === null ? "No limit" : formatAmount(order.creditLimit)}</span>
            </span>
            <span className="ml-auto text-ink-muted">
              Sales Order:{" "}
              <Link href={paths.order(order.id)} className="font-medium text-ink underline underline-offset-2">
                {order.number}
              </Link>
            </span>
          </div>
          <div className="grid gap-x-8 gap-y-1 md:grid-cols-2">
            <dl className="flex flex-col gap-1">
              <Detail label="Customer" value={[order.customerName, order.customerPhone].filter(Boolean).join(" · ")} />
              <Detail label="Customer Code" value={order.customerCode} />
              <Detail label="Billing Address" value={order.billingAddress} />
              <Detail label="Shipping Address" value={order.shippingAddress} />
              <Detail label="Sales Force" value={order.salesPersonName} />
              <Detail label="Price Type" value={order.priceListName ?? "Default sales rate"} />
              <Detail label="Remarks" value={order.remarks} />
            </dl>
            <dl className="flex flex-col gap-1">
              <Detail label="Ref/Project/Outlet" value={order.refProjectOutlet} />
              <Detail label="Status" value={<Indicator color="green">{APPROVED_ORDER_STATUS_LABELS[order.status]}</Indicator>} />
              <Detail label="Order Date" value={formatDay(order.orderDate)} />
              <Detail label="Exp. Delivery Date" value={formatDay(order.expectedDeliveryDate)} />
              <Detail label="Approved By" value={order.approvedBy} />
              <Detail label="Ref Customer PO Amount" value={order.refCustomerPoAmount === null ? null : formatAmount(order.refCustomerPoAmount)} />
            </dl>
          </div>
        </Card>

        <Card>
          <Section title="Transportation Details">
            <TransportSection
              values={header}
              errors={errors}
              set={set}
              offices={lookups.offices}
              businessUnitId={order.businessUnitId}
              warehouses={warehouses}
              salesPersons={setup.data?.salesPersons ?? []}
              addresses={order.addresses}
            />
          </Section>
        </Card>

        <Card>
          <Section title="Vehicle">
            <VehicleSection
              values={header}
              errors={errors}
              set={set}
              businessUnitId={order.businessUnitId}
              vehicles={vehicles.data ?? []}
              onVehicleCreated={(vehicle) => vehicles.mutate((current) => [...(current ?? []), vehicle])}
            />
          </Section>
        </Card>

        <Card>
          <Section
            title="Items"
            actions={<CheckboxField label="Deliver All" checked={deliverAll} onChange={(event) => toggleAll(event.target.checked)} />}
          >
            <div className="overflow-x-auto rounded-lg border border-line">
              <table className="w-full min-w-[1000px] text-sm">
                <thead className="bg-canvas text-xs text-ink-muted">
                  <tr className="border-b border-line">
                    {["SL", "Code", "Item Name", "Ordered", "Stock", "Tolerance", "Remaining (Alt. Qty)", "Remaining", "Delivery Alt. Qty", "Delivery Qty"].map((label, index) => (
                      <th key={label} scope="col" className={cn("px-2 py-2 font-medium", index >= 3 ? "text-right" : "text-left")}>
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {order.lines.map((line, index) => {
                    const available = stockOf(line.itemId);
                    const short = available !== undefined && available < Math.min(line.remaining, line.maxQty);
                    const qtyText = qtys[line.orderLineId] ?? "";
                    const alt = altQty(toNumber(qtyText), line.altUomFactor);
                    const lineError = errors[`qty.${line.orderLineId}`];
                    return (
                      <tr key={line.orderLineId} className={cn(short && "bg-danger/10")}>
                        <td className="px-2 py-1.5 text-ink-faint tabular-nums">{index + 1}</td>
                        <td className="px-2 py-1.5 whitespace-nowrap text-ink-muted">{line.itemCode}</td>
                        <td className="px-2 py-1.5 text-ink">{line.itemName}</td>
                        <td className="px-2 py-1.5 text-right whitespace-nowrap tabular-nums">
                          {formatQty(line.qty)} {line.uom}
                        </td>
                        <td className={cn("px-2 py-1.5 text-right tabular-nums", short && "font-medium text-danger")}>
                          {available === undefined ? (header.warehouseId ? "…" : "—") : formatQty(available)}
                        </td>
                        <td className="px-2 py-1.5 text-right tabular-nums">{line.tolerancePercent ? `${line.tolerancePercent}%` : "0"}</td>
                        <td className="px-2 py-1.5 text-right whitespace-nowrap tabular-nums">
                          {line.altUom ? `${formatQty(altQty(line.remaining, line.altUomFactor) ?? 0)} ${line.altUom}` : "—"}
                        </td>
                        <td className="px-2 py-1.5 text-right whitespace-nowrap tabular-nums">
                          {formatQty(line.remaining)} {line.uom}
                        </td>
                        <td className="w-28 px-2 py-1.5">
                          <input
                            aria-label={`Delivery alt. quantity, ${line.itemName}`}
                            type="number"
                            min={0}
                            step="any"
                            disabled={!line.altUomFactor || line.maxQty <= 0}
                            value={alt === null || qtyText === "" ? "" : String(alt)}
                            placeholder={line.altUom ?? "—"}
                            onChange={(event) =>
                              setQtys({
                                ...qtys,
                                [line.orderLineId]: event.target.value === "" ? "" : String(Math.round(toNumber(event.target.value) * (line.altUomFactor ?? 1) * 1000) / 1000),
                              })
                            }
                            className={cn(CONTROL, "h-7 w-full text-right tabular-nums")}
                          />
                        </td>
                        <td className="w-32 px-2 py-1.5">
                          <input
                            aria-label={`Delivery quantity, ${line.itemName}`}
                            type="number"
                            min={0}
                            step="any"
                            disabled={line.maxQty <= 0}
                            value={qtyText}
                            placeholder="Quantity"
                            onChange={(event) => setQtys({ ...qtys, [line.orderLineId]: event.target.value })}
                            className={cn(CONTROL, "h-7 w-full text-right tabular-nums", lineError && "ring-1 ring-danger")}
                          />
                          {lineError && <p className="mt-0.5 text-right text-xs text-danger">{lineError}</p>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="border-t border-line-strong bg-canvas font-medium text-ink">
                  <tr>
                    <td colSpan={3} className="px-2 py-2">
                      Total
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums">{formatQty(order.lines.reduce((sum, line) => sum + line.qty, 0))}</td>
                    <td colSpan={5} />
                    <td className="px-2 py-2 text-right tabular-nums">{formatQty(totals.totalQty)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
            {errors.lines && <p className="text-xs text-danger">{errors.lines}</p>}
            <p className="text-xs text-ink-faint">Red rows do not have enough stock in the selected warehouse for what is left on the order.</p>
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
                total={totals.salesTotal}
              />
            </Section>
          </Card>
        </div>
      </div>
    </PageContainer>
  );
}

function Detail({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="grid grid-cols-[10rem_1fr] gap-2 text-sm">
      <dt className="text-ink-muted">{label}</dt>
      <dd className="text-ink">: {value || "N/A"}</dd>
    </div>
  );
}
