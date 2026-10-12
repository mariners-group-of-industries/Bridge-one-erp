"use client";

import { ArrowLeft, CircleCheckBig, Ellipsis, Pencil, Printer, RefreshCw, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { PageContainer, PageHead } from "@/components/layout/page";
import { Button, buttonClasses } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { DropdownMenu, type MenuItem } from "@/components/ui/dropdown-menu";
import { TextAreaField, TextField } from "@/components/ui/form-field";
import { Indicator } from "@/components/ui/indicator";
import { Card, ErrorState, LoadingState } from "@/components/ui/section";
import { Tabs } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast";
import { useResource } from "@/hooks/use-resource";
import { errorMessage } from "@/lib/api/client";
import { cn } from "@/lib/cn";
import { formatDateTime } from "@/lib/format";
import { formatAmount, formatQty } from "../../dashboard/lib/format";
import { amountInWords } from "../../lib/amount-in-words";
import { formatDay, useToday } from "../../lib/use-today";
import { altQty } from "../../orders/lib/order-totals";
import { PAYMENT_METHOD_LABELS } from "../../orders/schemas/order.schema";
import { paths } from "../../paths";
import { CONFIRMATION_LABELS, DELIVERY_TYPE_LABELS, type DeliveryDetail } from "../schemas/delivery.schema";
import { confirmDelivery, deleteDelivery, fetchDelivery } from "../services/delivery.api";

export function DeliveryDetailView({ id }: { id: string }) {
  const today = useToday();
  const delivery = useResource(id, () => fetchDelivery(id));
  if (delivery.error) {
    return (
      <PageContainer>
        <PageHead title="Challan Details" />
        <Card>
          <ErrorState message={errorMessage(delivery.error)} onRetry={delivery.reload} />
        </Card>
      </PageContainer>
    );
  }
  if (!today || !delivery.data) {
    return (
      <PageContainer>
        <PageHead title="Challan Details" />
        <LoadingState />
      </PageContainer>
    );
  }
  return <DeliveryBody today={today} delivery={delivery.data} onChanged={(next) => delivery.mutate(() => next)} onReload={delivery.reload} />;
}

function DeliveryBody({ today, delivery, onChanged, onReload }: { today: string; delivery: DeliveryDetail; onChanged: (next: DeliveryDetail) => void; onReload: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const [tab, setTab] = useState<"items" | "transport">("items");
  const [dialog, setDialog] = useState<"confirm" | "delete" | null>(null);
  const [actualDate, setActualDate] = useState(today < delivery.deliveryDate ? delivery.deliveryDate : today);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const deleted = delivery.status === "CANCELLED";
  const editable = !deleted && delivery.confirmation === "PENDING";

  async function confirm() {
    setBusy(true);
    try {
      const updated = await confirmDelivery(delivery.id, delivery.updatedAt, actualDate);
      toast.success(`${updated.number} confirmed.`);
      setDialog(null);
      onChanged(updated);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    try {
      await deleteDelivery(delivery.id, delivery.updatedAt, reason);
      toast.success(`${delivery.number} deleted. Stock and order quantities were restored.`);
      router.replace(paths.deliveryTab(delivery.deliveryType === "EXCHANGE" ? "exchanges" : "deliveries"));
    } catch (error) {
      toast.error(errorMessage(error));
      setBusy(false);
    }
  }

  const menu: MenuItem[] = [
    { label: "Reload", icon: <RefreshCw />, onSelect: onReload },
    { label: "Challan (with header)", icon: <Printer />, href: paths.printDelivery(delivery.id, "challan") },
    { label: "Challan (without header)", icon: <Printer />, href: paths.printDelivery(delivery.id, "challan-plain") },
    { label: "Mushak 6.3", icon: <Printer />, href: paths.printDelivery(delivery.id, "mushak") },
    { label: "Sales Invoice", icon: <Printer />, href: paths.printDelivery(delivery.id, "invoice") },
    ...(editable ? (["separator", { label: "Delete", icon: <Trash2 />, danger: true, onSelect: () => setDialog("delete") }] satisfies MenuItem[]) : []),
  ];

  const altTotal = delivery.lines.reduce((sum, line) => sum + (altQty(line.qty, line.altUomFactor) ?? 0), 0);

  return (
    <PageContainer className="max-w-none">
      <PageHead
        title={
          <span className="flex items-center gap-2">
            <Link
              href={paths.deliveryTab(delivery.deliveryType === "EXCHANGE" ? "exchanges" : "challans")}
              aria-label="Back to deliveries"
              className={buttonClasses("ghost", "icon")}
            >
              <ArrowLeft />
            </Link>
            Challan Details
          </span>
        }
        indicator={
          deleted ? (
            <Indicator color="red">Deleted</Indicator>
          ) : (
            <Indicator color={delivery.confirmation === "CONFIRMED" ? "green" : "orange"}>{CONFIRMATION_LABELS[delivery.confirmation]}</Indicator>
          )
        }
        subtitle={`Sales Invoice ${delivery.number} · ${delivery.customerName} · ${formatAmount(delivery.totalAmount)}`}
        actions={
          <>
            <DropdownMenu trigger={<Ellipsis />} triggerLabel="More actions" triggerClassName={buttonClasses("secondary", "icon")} items={menu} />
            {editable && (
              <Link href={paths.editDelivery(delivery.id)} className={buttonClasses("secondary")}>
                <Pencil aria-hidden="true" />
                Edit
              </Link>
            )}
            {editable && (
              <Button variant="primary" onClick={() => setDialog("confirm")}>
                <CircleCheckBig aria-hidden="true" />
                Confirm Delivery
              </Button>
            )}
          </>
        }
      />

      {deleted && (
        <p role="note" className="mb-3 rounded-lg bg-control px-3 py-2 text-sm text-ink">
          <span className="font-medium">Deleted</span> by {delivery.deletedBy} on {delivery.deletedAt && formatDateTime(delivery.deletedAt)}:{" "}
          <span className="text-ink-muted">{delivery.deleteReason}</span>
        </p>
      )}

      <div className="flex flex-col gap-4">
        <Card className="p-4">
          <h2 className="mb-3 text-base font-semibold text-ink">
            Office Name: {delivery.officeName}
            <span className="ml-3 text-sm font-normal text-ink-muted">Warehouse: {delivery.warehouseName}</span>
          </h2>
          <div className="grid gap-x-8 gap-y-1 md:grid-cols-2">
            <dl className="flex flex-col gap-1">
              <Detail label="Customer" value={[delivery.customerName, delivery.customerPhone].filter(Boolean).join(" · ")} />
              <Detail label="Customer Code" value={delivery.customerCode} />
              <Detail label="Customer Group" value={delivery.customerGroup} />
              <Detail label="Billing Address" value={delivery.billingAddress} />
              <Detail label="Shipping Address" value={delivery.shippingAddress} />
              <Detail label="Contact To" value={delivery.contactPerson} />
              <Detail label="Ref Customer PO" value={delivery.refCustomerPo} />
              <Detail label="Ref Customer PO Date" value={delivery.refCustomerPoDate && formatDay(delivery.refCustomerPoDate)} />
              <Detail label="Ref Invoice" value={delivery.refInvoice} />
              <Detail label="Project/Outlet/Ref" value={delivery.refProjectOutlet} />
              <Detail label="Sales Force" value={delivery.salesPersonName} />
              <Detail label="Delivery Date" value={`${formatDay(delivery.deliveryDate)}${delivery.deliveryTime ? ` ${delivery.deliveryTime}` : ""}`} />
            </dl>
            <dl className="flex flex-col gap-1">
              <Detail
                label="Sales Order No."
                value={
                  delivery.salesOrderId && (
                    <Link href={paths.order(delivery.salesOrderId)} className="text-ink underline underline-offset-2">
                      {delivery.orderNumber}
                    </Link>
                  )
                }
              />
              <Detail label="Type" value={DELIVERY_TYPE_LABELS[delivery.deliveryType]} />
              <Detail label="Invoice Type" value={delivery.invoiceType} />
              <Detail
                label="Delivery Type"
                value={delivery.orderFullyDelivered === null ? "Direct" : delivery.orderFullyDelivered ? "Fully Delivered" : "Partially Delivered"}
              />
              <Detail label="Exp. Delivery Date" value={delivery.expectedDeliveryDate && formatDay(delivery.expectedDeliveryDate)} />
              <Detail label="Actual Delivery Date" value={delivery.actualDeliveryDate && formatDay(delivery.actualDeliveryDate)} />
              <Detail label="Due Date" value={formatDay(delivery.dueDate)} />
              <Detail label="VAT" value={delivery.priceIncludesVat ? "Inclusive" : "Exclusive"} />
              <Detail label="Challan No" value={delivery.challanNo} />
              <Detail label="VAT Challan No" value={delivery.vatChallanNo} />
              <Detail label="Payment" value={`${PAYMENT_METHOD_LABELS[delivery.paymentMethod]} · ${delivery.paymentTermDays} days · paid ${formatAmount(delivery.paidAmount)}`} />
              <Detail label="Delivered By" value={delivery.createdBy} />
              <Detail label="Confirmed By" value={delivery.confirmedBy && `${delivery.confirmedBy} · ${formatDateTime(delivery.confirmedAt!)}`} />
            </dl>
          </div>
        </Card>

        <Card>
          <Tabs
            label="Delivery sections"
            tabs={[
              { id: "items", label: "Item List", badge: delivery.lines.length },
              { id: "transport", label: "Transportation Details" },
            ]}
            value={tab}
            onChange={setTab}
          >
            {tab === "items" ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] text-sm">
                  <thead className="bg-canvas text-xs text-ink-muted">
                    <tr className="border-b border-line">
                      {["SL", "Item Code", "Item Name", "Delivery Qty", "Delivery Alt. Qty", "Unit Price", "Disc %", "VAT %", "Total"].map((label, index) => (
                        <th key={label} scope="col" className={cn("px-3 py-2 font-medium", index >= 3 ? "text-right" : "text-left")}>
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {delivery.lines.map((line) => {
                      const alt = altQty(line.qty, line.altUomFactor);
                      return (
                        <tr key={line.id}>
                          <td className="px-3 py-2 text-ink-faint tabular-nums">{line.lineNo}</td>
                          <td className="px-3 py-2 whitespace-nowrap text-ink-muted">{line.itemCode}</td>
                          <td className="px-3 py-2 text-ink">{line.itemName}</td>
                          <td className="px-3 py-2 text-right whitespace-nowrap tabular-nums">
                            {formatQty(line.qty)} {line.uom}
                          </td>
                          <td className="px-3 py-2 text-right whitespace-nowrap tabular-nums">{alt === null ? "—" : `${formatQty(alt)} ${line.altUom}`}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{line.rate.toFixed(2)}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{line.discountPercent.toFixed(2)}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{line.vatPercent.toFixed(2)}</td>
                          <td className="px-3 py-2 text-right font-medium text-ink tabular-nums">{formatAmount(line.amount)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="border-t border-line-strong bg-canvas font-medium text-ink">
                    <tr>
                      <td colSpan={3} className="px-3 py-2 text-right">
                        Total
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatQty(delivery.totalQty)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatQty(Math.round(altTotal * 1000) / 1000)}</td>
                      <td colSpan={3} />
                      <td className="px-3 py-2 text-right tabular-nums">{formatAmount(delivery.itemsTotal)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            ) : (
              <dl className="grid gap-x-8 gap-y-1 p-4 md:grid-cols-2">
                <Detail label="Vehicle No" value={delivery.vehicleNo} />
                <Detail label="Driver" value={[delivery.driverName, delivery.driverPhone].filter(Boolean).join(" · ")} />
                <Detail label="Transporter" value={delivery.transporterName} />
                <Detail label="Warehouse" value={delivery.warehouseName} />
                <Detail label="Delivery Charge" value={formatAmount(delivery.deliveryCharge)} />
                <Detail label="Unloading Charge" value={formatAmount(delivery.unloadingCharge)} />
              </dl>
            )}
          </Tabs>
        </Card>

        {delivery.exchangeReturn && (
          <Card className="p-4">
            <h2 className="mb-2 text-base font-semibold text-ink">
              Goods Taken Back <span className="font-normal text-ink-muted">· Return {delivery.exchangeReturn.number}</span>
            </h2>
            {delivery.exchangeReturn.reason && <p className="mb-2 text-sm text-ink-muted">Reason: {delivery.exchangeReturn.reason}</p>}
            <table className="w-full text-sm">
              <tbody className="divide-y divide-line">
                {delivery.exchangeReturn.lines.map((line) => (
                  <tr key={line.id}>
                    <td className="py-1.5 text-ink-muted">{line.itemCode}</td>
                    <td className="py-1.5 text-ink">{line.itemName}</td>
                    <td className="py-1.5 text-right tabular-nums">
                      {formatQty(line.qty)} {line.uom}
                    </td>
                    <td className="py-1.5 text-right tabular-nums">× {line.rate.toFixed(2)}</td>
                    <td className="py-1.5 text-right tabular-nums">{formatAmount(line.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}

        <div className="grid gap-4 lg:grid-cols-[1fr_22rem]">
          <Card className="flex flex-col gap-2 p-4 text-sm">
            <p>
              <span className="font-semibold text-ink">Amount in Words: </span>
              <span className="text-ink-muted">{amountInWords(delivery.totalAmount)}</span>
            </p>
            <div>
              <p className="font-semibold text-ink">Terms &amp; Conditions:</p>
              {delivery.terms ? <p className="whitespace-pre-line text-ink-muted">{delivery.terms}</p> : <p className="text-ink-faint">None</p>}
            </div>
            <p>
              <span className="font-semibold text-ink">Remarks: </span>
              <span className="text-ink-muted">{delivery.remarks ?? "N/A"}</span>
            </p>
          </Card>
          <Card className="p-4">
            <dl className="flex flex-col gap-1.5 text-sm">
              <Total label="Item Price" value={delivery.itemsTotal} />
              <Total label="Discount" value={delivery.discountAmount} />
              <Total label="Total VAT" value={delivery.vatAmount} />
              {delivery.aitAmount > 0 && <Total label="Total AIT" value={delivery.aitAmount} />}
              <Total label="Item Total (Without VAT)" value={delivery.itemsBase} />
              {delivery.deliveryCharge > 0 && <Total label="Delivery Charge" value={delivery.deliveryCharge} />}
              {delivery.unloadingCharge > 0 && <Total label="Unloading Charge" value={delivery.unloadingCharge} />}
              <div className="mt-1 border-t border-line pt-2">
                <Total label="Sales Total" value={delivery.totalAmount} strong />
              </div>
              {delivery.exchangeReturn && <Total label="Less: Taken Back" value={-delivery.exchangeReturn.totalAmount} />}
              <Total label="Paid on Delivery" value={delivery.paidAmount} />
            </dl>
          </Card>
        </div>
      </div>

      <Dialog
        open={dialog === "confirm"}
        title={`Confirm ${delivery.number}`}
        description="Confirm that the goods reached the customer. A confirmed delivery cannot be edited or deleted."
        onClose={busy ? () => undefined : () => setDialog(null)}
        onSubmit={confirm}
        footer={
          <>
            <Button onClick={() => setDialog(null)} disabled={busy}>
              Back
            </Button>
            <Button type="submit" variant="primary" loading={busy}>
              Confirm Delivery
            </Button>
          </>
        }
      >
        <TextField label="Actual Delivery Date" type="date" required min={delivery.deliveryDate} value={actualDate} onChange={(event) => setActualDate(event.target.value)} />
      </Dialog>
      <Dialog
        open={dialog === "delete"}
        title={`Delete ${delivery.number}?`}
        description="Stock goes back to the warehouse, the order quantities are restored and any payment taken on delivery is cancelled."
        onClose={busy ? () => undefined : () => setDialog(null)}
        onSubmit={remove}
        footer={
          <>
            <Button onClick={() => setDialog(null)} disabled={busy}>
              Back
            </Button>
            <Button type="submit" variant="danger" loading={busy} disabled={!reason.trim()}>
              Delete
            </Button>
          </>
        }
      >
        <TextAreaField label="Reason" required rows={3} value={reason} onChange={(event) => setReason(event.target.value)} />
      </Dialog>
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

function Total({ label, value, strong }: { label: string; value: number; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className={strong ? "font-semibold text-ink" : "text-ink-muted"}>{label}</dt>
      <dd className={cn("tabular-nums", strong ? "text-base font-semibold text-ink" : "text-ink")}>{formatAmount(value)}</dd>
    </div>
  );
}
