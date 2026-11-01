"use client";

import { ArrowLeft, Download, Ellipsis, Info, Package, Pencil, Printer, RefreshCw, Save, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PageContainer, PageHead } from "@/components/layout/page";
import { Button, buttonClasses } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { DropdownMenu, type MenuItem } from "@/components/ui/dropdown-menu";
import { CONTROL, TextAreaField, TextField } from "@/components/ui/form-field";
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
import { CONFIRMATION_LABELS, deliveryReferenceSchema, type DeliveryDetail } from "../schemas/delivery.schema";
import { challanPdfUrl, confirmDelivery, deleteDelivery, fetchDelivery, updateDeliveryReferences } from "../services/delivery.api";
import { DeliveryBanner, DeliveryInfo, Detail, TermsAndRemarks, TransportDetails } from "./DeliveryDetailParts";

/** Delivery Details (Delivery / Exchange list): references, confirmation, items with stock, accounting. */
export function DeliveryDetailView({ id }: { id: string }) {
  const today = useToday();
  const delivery = useResource(`delivery:${id}`, () => fetchDelivery(id));
  if (delivery.error) {
    return (
      <PageContainer>
        <PageHead title="Delivery Details" />
        <Card>
          <ErrorState message={errorMessage(delivery.error)} onRetry={delivery.reload} />
        </Card>
      </PageContainer>
    );
  }
  if (!today || !delivery.data) {
    return (
      <PageContainer>
        <PageHead title="Delivery Details" />
        <LoadingState />
      </PageContainer>
    );
  }
  return (
    <DeliveryBody
      key={delivery.data.updatedAt}
      today={today}
      delivery={delivery.data}
      onChanged={(next) => delivery.mutate(() => next)}
      onReload={delivery.reload}
    />
  );
}

type References = { vatChallanNo: string; refCustomerPo: string; refCustomerPoDate: string; refInvoice: string; remarks: string };

function DeliveryBody({ today, delivery, onChanged, onReload }: { today: string; delivery: DeliveryDetail; onChanged: (next: DeliveryDetail) => void; onReload: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const [tab, setTab] = useState<"items" | "accounting" | "transport">("items");
  const [deleting, setDeleting] = useState(false);
  const [actualDate, setActualDate] = useState(delivery.actualDeliveryDate ?? (today < delivery.deliveryDate ? delivery.deliveryDate : today));
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const saved: References = {
    vatChallanNo: delivery.vatChallanNo ?? "",
    refCustomerPo: delivery.refCustomerPo ?? "",
    refCustomerPoDate: delivery.refCustomerPoDate ?? "",
    refInvoice: delivery.refInvoice ?? "",
    remarks: delivery.remarks ?? "",
  };
  const [refs, setRefs] = useState<References>(saved);
  /** Return QTY per delivery line, entered before confirming. */
  const [returnQty, setReturnQty] = useState<Record<string, string>>({});
  const dirty = JSON.stringify(refs) !== JSON.stringify(saved);

  const deleted = delivery.status === "CANCELLED";
  const editable = !deleted && delivery.confirmation === "PENDING";
  const canReturn = editable && delivery.deliveryType !== "EXCHANGE";
  const returning = Object.entries(returnQty)
    .map(([deliveryLineId, text]) => ({ deliveryLineId, qty: Number(text) }))
    .filter((row) => Number.isFinite(row.qty) && row.qty > 0);
  const overReturned = delivery.lines.find((line) => Number(returnQty[line.id] ?? 0) > line.qty - line.returnedQty + 1e-9);
  const listTab = delivery.deliveryType === "EXCHANGE" ? "exchanges" : "deliveries";

  /** Saves changed references; returns the delivery to continue with (or null on error). */
  async function saveReferences(): Promise<DeliveryDetail | null> {
    const input = { version: delivery.updatedAt, ...refs, refCustomerPoDate: refs.refCustomerPoDate || null };
    const parsed = deliveryReferenceSchema.safeParse(input);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Please correct the references.");
      return null;
    }
    const updated = await updateDeliveryReferences(delivery.id, input);
    toast.success("References saved.");
    return updated;
  }

  async function run(task: () => Promise<void>) {
    setBusy(true);
    try {
      await task();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  const saveOnly = () =>
    run(async () => {
      const updated = await saveReferences();
      if (updated) onChanged(updated);
    });

  const confirm = () =>
    run(async () => {
      if (!actualDate) {
        toast.error("Enter the actual delivery date.");
        return;
      }
      if (overReturned) {
        toast.error(`${overReturned.itemName}: at most ${formatQty(overReturned.qty - overReturned.returnedQty)} can be returned.`);
        return;
      }
      let current = delivery;
      if (dirty) {
        const updated = await saveReferences();
        if (!updated) return;
        current = updated;
      }
      const confirmed = await confirmDelivery(current.id, current.updatedAt, actualDate, returning);
      toast.success(returning.length ? `${confirmed.number} confirmed; the returned goods are on Sales Return.` : `${confirmed.number} confirmed.`);
      setReturnQty({});
      onChanged(confirmed);
    });

  const remove = () =>
    run(async () => {
      await deleteDelivery(delivery.id, delivery.updatedAt, reason);
      toast.success(`${delivery.number} deleted. Stock and order quantities were restored.`);
      router.replace(paths.deliveryTab(listTab));
    });

  const menu: MenuItem[] = [
    { label: "Reload", icon: <RefreshCw />, onSelect: onReload },
    { label: "Challan Details", icon: <Package />, href: paths.deliveryChallan(delivery.id) },
    { label: "Delivery Challan (PDF)", icon: <Printer />, onSelect: () => window.open(challanPdfUrl(delivery.id), "_blank", "noopener") },
    { label: "Challan (with header)", icon: <Printer />, href: paths.printDelivery(delivery.id, "challan") },
    { label: "Challan (without header)", icon: <Printer />, href: paths.printDelivery(delivery.id, "challan-plain") },
    { label: "Mushak 6.3", icon: <Printer />, href: paths.printDelivery(delivery.id, "mushak") },
    { label: "Sales Invoice", icon: <Printer />, href: paths.printDelivery(delivery.id, "invoice") },
  ];

  const ref = (key: keyof References) => ({
    value: refs[key],
    disabled: !editable,
    onChange: (event: { target: { value: string } }) => setRefs((current) => ({ ...current, [key]: event.target.value })),
  });
  const returnedTotal = delivery.lines.reduce((sum, line) => sum + line.returnedQty, 0);
  const altTotal = delivery.lines.reduce((sum, line) => sum + (altQty(line.qty, line.altUomFactor) ?? 0), 0);

  return (
    <PageContainer className="max-w-none">
      <PageHead
        title={
          <span className="flex items-center gap-2">
            <Link href={paths.deliveryTab(listTab)} aria-label="Back to deliveries" className={buttonClasses("ghost", "icon")}>
              <ArrowLeft />
            </Link>
            {editable ? "Delivery Confirmation" : "Delivery Details"}
          </span>
        }
        indicator={
          deleted ? (
            <Indicator color="red">Deleted</Indicator>
          ) : (
            <Indicator color={delivery.confirmation === "CONFIRMED" ? "green" : "orange"}>{CONFIRMATION_LABELS[delivery.confirmation]}</Indicator>
          )
        }
        actions={
          <>
            <Link href={paths.deliveryTab(listTab)} className={buttonClasses("danger")}>
              Close &amp; Back
            </Link>
            <DropdownMenu trigger={<Ellipsis />} triggerLabel="More actions" triggerClassName={buttonClasses("secondary", "icon")} items={menu} />
            {editable && (
              <Link href={paths.editDelivery(delivery.id)} className={buttonClasses("secondary")}>
                <Pencil aria-hidden="true" />
                Edit
              </Link>
            )}
            {editable && (
              <Button variant="primary" onClick={confirm} loading={busy}>
                Confirm
              </Button>
            )}
            {editable && (
              <Button variant="ghost" onClick={() => setDeleting(true)} disabled={busy}>
                <Trash2 aria-hidden="true" />
                Delete
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
          <DeliveryBanner delivery={delivery} showTotal>
            <Link href={paths.printDelivery(delivery.id, "invoice")} aria-label="Print invoice" title="Print invoice" className={buttonClasses("ghost", "icon")}>
              <Printer />
            </Link>
            <a href={challanPdfUrl(delivery.id, true)} aria-label="Download challan" title="Download challan (PDF)" className={buttonClasses("ghost", "icon")}>
              <Download />
            </a>
          </DeliveryBanner>
          <DeliveryInfo delivery={delivery} />

          <div className="mt-4 grid items-end gap-3 border-t border-line pt-3 sm:grid-cols-2 lg:grid-cols-[repeat(5,minmax(0,1fr))_auto_12rem]">
            <TextField label="VAT Challan No" placeholder="VAT Challan No" {...ref("vatChallanNo")} />
            <TextField label="Ref Customer PO" placeholder="Ref Customer PO" {...ref("refCustomerPo")} />
            <TextField label="Ref Customer PO Date" type="date" {...ref("refCustomerPoDate")} />
            <TextField label="Ref Invoice" placeholder="Ref Invoice" {...ref("refInvoice")} />
            <TextField label="Remarks" placeholder="Remarks" {...ref("remarks")} />
            {editable ? (
              <Button onClick={saveOnly} disabled={!dirty || busy}>
                <Save aria-hidden="true" />
                Save
              </Button>
            ) : (
              <span />
            )}
            <TextField
              label="Actual Delivery Date"
              type="date"
              min={delivery.deliveryDate}
              value={actualDate}
              disabled={!editable}
              onChange={(event) => setActualDate(event.target.value)}
            />
          </div>
        </Card>

        <Card>
          <Tabs
            label="Delivery sections"
            tabs={[
              { id: "items", label: "Item List", badge: delivery.lines.length },
              { id: "accounting", label: "Accounting" },
              { id: "transport", label: "Transportation Details" },
            ]}
            value={tab}
            onChange={setTab}
          >
            {tab === "items" ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1000px] text-xs">
                  <thead className="bg-accent-soft font-semibold text-ink">
                    <tr>
                      {["Item Code", "Name", "Return QTY", "Delivery QTY", "Pack Qty", "Stock", "Price", "VAT", "AIT", "Total Amount"].map((label, index) => (
                        <th key={label} scope="col" className={cn("px-3 py-2", index >= 2 ? "text-right" : "text-left")}>
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
                          <td className="px-3 py-1.5 whitespace-nowrap text-ink-muted">{line.itemCode}</td>
                          <td className="px-3 py-1.5 text-ink">
                            <span className="inline-flex items-center gap-1.5">
                              <Package aria-hidden="true" className="size-3.5 text-warning" />
                              <Info aria-hidden="true" className="size-3.5 text-ink-faint" />
                              {line.itemName}
                            </span>
                          </td>
                          <td className="w-28 px-3 py-1">
                            {canReturn ? (
                              <input
                                aria-label={`Return quantity, ${line.itemName}`}
                                type="number"
                                min={0}
                                max={line.qty - line.returnedQty}
                                step="any"
                                placeholder={formatQty(line.returnedQty)}
                                value={returnQty[line.id] ?? ""}
                                onChange={(event) => setReturnQty((current) => ({ ...current, [line.id]: event.target.value }))}
                                className={cn(CONTROL, "h-7 text-right tabular-nums", Number(returnQty[line.id] ?? 0) > line.qty - line.returnedQty + 1e-9 && "ring-1 ring-danger")}
                              />
                            ) : (
                              <span className="block text-right tabular-nums">{formatQty(line.returnedQty)}</span>
                            )}
                          </td>
                          <td className="px-3 py-1.5 text-right whitespace-nowrap tabular-nums">
                            {formatQty(line.qty)} {line.uom}
                          </td>
                          <td className="px-3 py-1.5 text-right whitespace-nowrap tabular-nums">{alt === null ? "0" : `${formatQty(alt)} ${line.altUom ?? ""}`}</td>
                          <td className="px-3 py-1.5 text-right tabular-nums">{line.stock === null ? "—" : formatQty(line.stock)}</td>
                          <td className="px-3 py-1.5 text-right tabular-nums">{line.rate.toFixed(2)}</td>
                          <td className="px-3 py-1.5 text-right tabular-nums">{line.vatPercent.toFixed(2)}</td>
                          <td className="px-3 py-1.5 text-right tabular-nums">{line.aitPercent.toFixed(2)}</td>
                          <td className="px-3 py-1.5 text-right font-medium text-ink tabular-nums">{formatAmount(line.amount)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="border-t border-line-strong bg-canvas font-semibold text-ink">
                    <tr>
                      <td className="px-3 py-2" />
                      <td className="px-3 py-2">Total :</td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatQty(returnedTotal)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatQty(delivery.totalQty)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatQty(Math.round(altTotal * 1000) / 1000)}</td>
                      <td colSpan={4} />
                      <td className="px-3 py-2 text-right tabular-nums">{formatAmount(delivery.itemsTotal)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            ) : tab === "accounting" ? (
              <dl className="grid gap-x-8 gap-y-1 p-4 md:grid-cols-2">
                <Detail label="Invoice Type" value={delivery.invoiceType} />
                <Detail label="Payment Method" value={PAYMENT_METHOD_LABELS[delivery.paymentMethod]} />
                <Detail label="Payment Term Days" value={String(delivery.paymentTermDays)} />
                <Detail label="Due Date" value={formatDay(delivery.dueDate)} />
                <Detail label="VAT/SD/AIT" value={delivery.priceIncludesVat ? "Inclusive" : "Exclusive"} />
                <Detail label="Sales Total" value={formatAmount(delivery.totalAmount)} />
                <Detail label="Paid on Delivery" value={formatAmount(delivery.paidAmount)} />
                <Detail label="Returned" value={formatAmount(delivery.returnAmount)} />
                <Detail label="Pending Amount" value={formatAmount(delivery.pendingAmount)} />
                <Detail label="Discount" value={formatAmount(delivery.discountAmount)} />
              </dl>
            ) : (
              <TransportDetails delivery={delivery} />
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

        <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
          <TermsAndRemarks delivery={delivery} words={amountInWords(delivery.totalAmount)} />
          <Card className="p-4">
            <dl className="flex flex-col gap-1.5 text-sm">
              <Total label="Total :" value={delivery.itemsTotal} />
              {delivery.discountAmount > 0 && <Total label="Discount :" value={delivery.discountAmount} />}
              <Total label="Total VAT:" value={delivery.vatAmount} />
              {delivery.aitAmount > 0 && <Total label="Total AIT:" value={delivery.aitAmount} />}
              <Total label="Item Price (Without VAT):" value={delivery.itemsBase} />
              {delivery.deliveryCharge > 0 && <Total label="Delivery Charge :" value={delivery.deliveryCharge} />}
              {delivery.unloadingCharge > 0 && <Total label="Unloading Charge :" value={delivery.unloadingCharge} />}
              <Total label="Sales Total :" value={delivery.totalAmount} strong />
              <Total label="Pending Amount :" value={delivery.pendingAmount} />
            </dl>
          </Card>
        </div>
      </div>

      <Dialog
        open={deleting}
        title={`Delete ${delivery.number}?`}
        description="Stock goes back to the warehouse, the order quantities are restored and any payment taken on delivery is cancelled."
        onClose={busy ? () => undefined : () => setDeleting(false)}
        onSubmit={remove}
        footer={
          <>
            <Button onClick={() => setDeleting(false)} disabled={busy}>
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

function Total({ label, value, strong }: { label: string; value: number; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-line pb-1 last:border-0">
      <dt className={strong ? "font-semibold text-ink" : "text-ink-muted"}>{label}</dt>
      <dd className={cn("tabular-nums", strong ? "font-semibold text-ink" : "text-ink")}>{formatAmount(value)}</dd>
    </div>
  );
}
