"use client";

import { ArrowLeft, Ban, Check, CircleCheckBig, Download, Ellipsis, Pencil, Printer, RefreshCw, Send, Trash2, Undo2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { PageContainer, PageHead } from "@/components/layout/page";
import { Button, buttonClasses } from "@/components/ui/button";
import { ConfirmDialog, Dialog } from "@/components/ui/dialog";
import { DropdownMenu, type MenuItem } from "@/components/ui/dropdown-menu";
import { TextAreaField } from "@/components/ui/form-field";
import { Indicator } from "@/components/ui/indicator";
import { Card, EmptyState, ErrorState, LoadingState } from "@/components/ui/section";
import { Tabs } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast";
import { useResource } from "@/hooks/use-resource";
import { errorMessage } from "@/lib/api/client";
import { cn } from "@/lib/cn";
import { formatDateTime } from "@/lib/format";
import { formatAmount, formatQty } from "../../dashboard/lib/format";
import { amountInWords } from "../../lib/amount-in-words";
import { downloadCsv } from "../../lib/csv";
import { formatDay, useToday } from "../../lib/use-today";
import { paths } from "../../paths";
import { altQty } from "../lib/order-totals";
import {
  HOLD_REASON_LABELS,
  ORDER_ACTION_LABELS,
  ORDER_STATUS_LABELS,
  ORDER_TYPE_LABELS,
  PAYMENT_METHOD_LABELS,
  type OrderAction,
  type OrderDetail,
} from "../schemas/order.schema";
import { changeOrderStatus, deleteOrder, fetchOrder } from "../services/order.api";
import { OrderStatusIndicator } from "./OrderStatusIndicator";

/** Actions that need a written reason. */
const NEEDS_REMARKS: Partial<Record<OrderAction, string>> = {
  reject: "Why is the order rejected? The sales force sees this.",
  cancel: "Why is the order cancelled?",
  complete: "Why is the order closed before full delivery?",
};

const EVENT_LABELS: Record<string, string> = {
  CREATED: "Created",
  UPDATED: "Edited",
  SUBMITTED: "Submitted",
  SUBMITTED_FOR_APPROVAL: "Sent for approval",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  CANCELLED: "Cancelled",
  CLOSED: "Closed",
};

export function OrderDetailView({ id }: { id: string }) {
  const today = useToday();
  const order = useResource(id, () => fetchOrder(id));
  if (order.error) {
    return (
      <PageContainer>
        <PageHead title="Sales Order" />
        <Card>
          <ErrorState message={errorMessage(order.error)} onRetry={order.reload} />
        </Card>
      </PageContainer>
    );
  }
  if (!today || !order.data) {
    return (
      <PageContainer>
        <PageHead title="Sales Order" />
        <LoadingState />
      </PageContainer>
    );
  }
  return <OrderDetailBody today={today} order={order.data} onChanged={(next) => order.mutate(() => next)} onReload={order.reload} />;
}

function OrderDetailBody({
  today,
  order,
  onChanged,
  onReload,
}: {
  today: string;
  order: OrderDetail;
  onChanged: (order: OrderDetail) => void;
  onReload: () => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const [tab, setTab] = useState<"items" | "approval">("items");
  const [pending, setPending] = useState<OrderAction | null>(null);
  const [remarks, setRemarks] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);

  async function run(action: OrderAction, note?: string) {
    setBusy(true);
    try {
      const updated = await changeOrderStatus(order.id, action, order.updatedAt, today, note || undefined);
      if (action === "submit" && updated.status === "PENDING_APPROVAL") {
        toast.error(`${updated.number} needs approval: ${updated.holdReason ? HOLD_REASON_LABELS[updated.holdReason] : ""}.`);
      } else {
        toast.success(`${updated.number}: ${ORDER_STATUS_LABELS[updated.status]}.`);
      }
      setPending(null);
      setRemarks("");
      onChanged(updated);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  function ask(action: OrderAction) {
    setRemarks("");
    setPending(action);
  }

  async function remove() {
    setBusy(true);
    try {
      await deleteOrder(order.id);
      toast.success(`${order.number} deleted.`);
      router.replace(paths.orders);
    } catch (error) {
      toast.error(errorMessage(error));
      setBusy(false);
      setConfirmDelete(false);
    }
  }

  function exportItems() {
    downloadCsv(
      `${order.number}.csv`,
      ["SL", "Code", "Name", "UOM", "Quantity", "Alt. UOM", "Alt. Qty", "Rem. Qty", "Price", "Discount %", "VAT %", "AIT %", "Total"],
      order.lines.map((line) => [
        line.lineNo,
        line.itemCode,
        line.itemName,
        line.uom,
        line.qty,
        line.altUom,
        altQty(line.qty, line.altUomFactor),
        line.qty - line.deliveredQty,
        line.unitPrice,
        line.discountPercent,
        line.vatPercent,
        line.aitPercent,
        line.lineTotal.toFixed(2),
      ]),
    );
  }

  const primary: ReactNode =
    order.status === "DRAFT" ? (
      <>
        <Link href={paths.editOrder(order.id)} className={buttonClasses("secondary")}>
          <Pencil aria-hidden="true" />
          Edit
        </Link>
        <Button variant="primary" loading={busy} onClick={() => run("submit")}>
          <Send aria-hidden="true" />
          Submit
        </Button>
      </>
    ) : order.status === "PENDING_APPROVAL" ? (
      <>
        <Button loading={busy} onClick={() => ask("reject")}>
          <Undo2 aria-hidden="true" />
          Reject
        </Button>
        <Button variant="primary" loading={busy} onClick={() => ask("approve")}>
          <Check aria-hidden="true" />
          Approve
        </Button>
      </>
    ) : null;

  const menu: MenuItem[] = [
    { label: "Reload", icon: <RefreshCw />, onSelect: onReload },
    { label: "Print", icon: <Printer />, href: paths.printOrder(order.id) },
    { label: "Excel (CSV)", icon: <Download />, onSelect: exportItems },
    ...(order.status === "APPROVED"
      ? ([{ label: "Close Order", icon: <CircleCheckBig />, onSelect: () => ask("complete") }] satisfies MenuItem[])
      : []),
    ...(order.status === "APPROVED" || order.status === "PENDING_APPROVAL"
      ? (["separator", { label: "Cancel Order", icon: <Ban />, danger: true, onSelect: () => ask("cancel") }] satisfies MenuItem[])
      : []),
    ...(order.status === "DRAFT"
      ? (["separator", { label: "Delete", icon: <Trash2 />, danger: true, onSelect: () => setConfirmDelete(true) }] satisfies MenuItem[])
      : []),
  ];

  const lastEvent = order.events.at(-1);

  return (
    <PageContainer className="max-w-none">
      <PageHead
        title={
          <span className="flex items-center gap-2">
            <Link href={paths.orders} aria-label="Back to orders" className={buttonClasses("ghost", "icon")}>
              <ArrowLeft />
            </Link>
            {order.number}
          </span>
        }
        indicator={<OrderStatusIndicator status={order.status} />}
        subtitle={`${order.customerName} · ${order.officeName} · Total ${formatAmount(order.salesTotal)}`}
        actions={
          <>
            <DropdownMenu trigger={<Ellipsis />} triggerLabel="More actions" triggerClassName={buttonClasses("secondary", "icon")} items={menu} />
            {primary}
          </>
        }
      />

      {order.status === "PENDING_APPROVAL" && order.holdReason && (
        <p role="note" className="mb-3 rounded-lg bg-control px-3 py-2 text-sm text-ink">
          <span className="font-medium">Waiting for approval: {HOLD_REASON_LABELS[order.holdReason]}.</span>{" "}
          <span className="text-ink-muted">{lastEvent?.remarks}</span>
        </p>
      )}
      {order.status === "DRAFT" && lastEvent?.action === "REJECTED" && (
        <p role="note" className="mb-3 rounded-lg bg-control px-3 py-2 text-sm text-ink">
          <span className="font-medium">Rejected:</span> <span className="text-ink-muted">{lastEvent.remarks}</span>
        </p>
      )}

      <div className="flex flex-col gap-4">
        <Card className="p-4">
          <h2 className="mb-3 text-base font-semibold text-ink">
            Order Details <span className="font-normal text-ink-muted">· Office: {order.officeName}</span>
          </h2>
          <div className="grid gap-x-8 gap-y-1 md:grid-cols-2 xl:grid-cols-3">
            <dl className="flex flex-col gap-1">
              <Detail label="Customer" value={[order.customerName, order.customerPhone].filter(Boolean).join(" · ")} />
              <Detail label="Customer Code" value={order.customerCode} />
              <Detail label="Customer Group" value={order.customerGroup} />
              <Detail label="Referred By" value={order.referredBy} />
              <Detail label="Territory" value={order.territory} />
              <Detail label="Billing Address" value={order.billingAddress} />
              <Detail label="Shipping Address" value={order.shippingAddress} />
              <Detail label="Contact To" value={order.contactPerson} />
              <Detail label="Sales Force" value={order.salesPersonName} />
              <Detail label="Project/Outlet/Ref" value={order.refProjectOutlet} />
              <Detail label="Price Type" value={order.priceListName ?? "Default sales rate"} />
            </dl>
            <dl className="flex flex-col gap-1">
              <Detail label="Payment Term Days" value={String(order.paymentTermDays)} />
              <Detail label="Payment Method" value={PAYMENT_METHOD_LABELS[order.paymentMethod]} />
              <Detail label="Type" value={ORDER_TYPE_LABELS[order.orderType]} />
              <Detail label="Ref Customer PO" value={order.refCustomerPo} />
              <Detail label="Ref Customer PO Date" value={order.refCustomerPoDate && formatDay(order.refCustomerPoDate)} />
              <Detail label="Ref Customer PO Amount" value={order.refCustomerPoAmount === null ? null : formatAmount(order.refCustomerPoAmount)} />
              <Detail label="Ref Invoice" value={order.refInvoice} />
              <Detail label="Exp. Delivery Date" value={formatDay(order.expectedDeliveryDate)} />
              <Detail label="Status" value={<OrderStatusIndicator status={order.status} />} />
              <Detail label="Pending Reason" value={order.holdReason && HOLD_REASON_LABELS[order.holdReason]} />
              <Detail label="VAT" value={order.priceIncludesVat ? "Inclusive" : "Exclusive"} />
            </dl>
            <dl className="flex flex-col gap-1">
              <Detail label="Order Date" value={formatDay(order.orderDate)} />
              <Detail label="Order Time" value={formatDateTime(order.createdAt)} />
              <Detail
                label="Quotation No"
                value={
                  order.quotationId && (
                    <Link href={paths.quotation(order.quotationId)} className="text-ink underline underline-offset-2">
                      {order.quotationNumber}
                    </Link>
                  )
                }
              />
              <Detail label="Foreign" value={order.isForeign ? "Yes" : "No"} />
              <Detail label="Due Limit" value={formatAmount(order.dueLimit)} />
              <Detail label="Remarks" value={order.remarks} />
              <Detail label="Created By" value={order.createdBy} />
              <Detail label="Last Modified By" value={order.updatedBy} />
              <Detail label="Last Modified" value={formatDateTime(order.updatedAt)} />
            </dl>
          </div>
        </Card>

        <Card>
          <Tabs
            label="Order sections"
            tabs={[
              { id: "items", label: "Item List", badge: order.lines.length },
              { id: "approval", label: "Approval Status", badge: order.events.length },
            ]}
            value={tab}
            onChange={setTab}
          >
            {tab === "items" ? <ItemsTable order={order} /> : <ApprovalTimeline order={order} />}
          </Tabs>
        </Card>

        <div className="grid gap-4 lg:grid-cols-[1fr_22rem]">
          <Card className="flex flex-col gap-3 p-4 text-sm">
            <p>
              <span className="font-semibold text-ink">Amount in Words: </span>
              <span className="text-ink-muted">{amountInWords(order.salesTotal)}</span>
            </p>
            <div>
              <p className="font-semibold text-ink">Terms &amp; Conditions:</p>
              {order.terms ? <p className="whitespace-pre-line text-ink-muted">{order.terms}</p> : <p className="text-ink-faint">None</p>}
            </div>
            <p>
              <span className="font-semibold text-ink">Remarks: </span>
              <span className="text-ink-muted">{order.remarks ?? "N/A"}</span>
            </p>
          </Card>
          <Card className="p-4">
            <dl className="flex flex-col gap-1.5 text-sm">
              <Total label="Total" value={order.itemsTotal} />
              {order.discountAmount > 0 && <Total label="Discount" value={-order.discountAmount} />}
              <Total label="Item Price (without VAT)" value={order.itemsBase} />
              <Total label="Total VAT" value={order.vatAmount} />
              {order.aitAmount > 0 && <Total label="Total AIT" value={order.aitAmount} />}
              {order.deliveryCharge > 0 && <Total label="Delivery Charge" value={order.deliveryCharge} />}
              {order.unloadingCharge > 0 && <Total label="Unloading Charge" value={order.unloadingCharge} />}
              <div className="mt-1 border-t border-line pt-2">
                <Total label="Sales Total" value={order.salesTotal} strong />
              </div>
            </dl>
          </Card>
        </div>
      </div>

      <Dialog
        open={pending !== null}
        title={pending ? `${ORDER_ACTION_LABELS[pending]} ${order.number}` : ""}
        onClose={busy ? () => undefined : () => setPending(null)}
        onSubmit={() => pending && run(pending, remarks)}
        footer={
          <>
            <Button onClick={() => setPending(null)} disabled={busy}>
              Back
            </Button>
            <Button
              type="submit"
              variant={pending === "cancel" ? "danger" : "primary"}
              loading={busy}
              disabled={!!pending && !!NEEDS_REMARKS[pending] && !remarks.trim()}
            >
              {pending ? ORDER_ACTION_LABELS[pending] : ""}
            </Button>
          </>
        }
      >
        <TextAreaField
          label={pending && NEEDS_REMARKS[pending] ? "Reason" : "Remarks (optional)"}
          required={!!pending && !!NEEDS_REMARKS[pending]}
          hint={pending ? NEEDS_REMARKS[pending] : undefined}
          rows={3}
          value={remarks}
          onChange={(event) => setRemarks(event.target.value)}
        />
      </Dialog>
      <ConfirmDialog
        open={confirmDelete}
        title={`Delete ${order.number}?`}
        message="This draft will be removed permanently. A linked quotation becomes open again."
        busy={busy}
        onConfirm={remove}
        onClose={() => setConfirmDelete(false)}
      />
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

function ItemsTable({ order }: { order: OrderDetail }) {
  const headers = ["SL", "Code", "Name", "UOM", "Quantity", "Alt. UOM", "Alt. Qty", "Rem. Qty", "Price", "Discount", "VAT (%)", "AIT (%)", "Total"];
  const altTotal = order.lines.reduce((sum, line) => sum + (altQty(line.qty, line.altUomFactor) ?? 0), 0);
  const remaining = order.lines.reduce((sum, line) => sum + line.qty - line.deliveredQty, 0);
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[960px] text-sm">
        <thead className="bg-canvas text-xs text-ink-muted">
          <tr className="border-b border-line">
            {headers.map((header, index) => (
              <th key={header} scope="col" className={cn("px-3 py-2 font-medium", index >= 4 && index !== 5 ? "text-right" : "text-left")}>
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {order.lines.map((line) => {
            const alt = altQty(line.qty, line.altUomFactor);
            return (
              <tr key={line.id}>
                <td className="px-3 py-2 text-ink-faint tabular-nums">{line.lineNo}</td>
                <td className="px-3 py-2 whitespace-nowrap text-ink-muted">{line.itemCode}</td>
                <td className="px-3 py-2 text-ink">{line.itemName}</td>
                <td className="px-3 py-2 text-ink-muted">{line.uom}</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatQty(line.qty)}</td>
                <td className="px-3 py-2 text-ink-muted">{line.altUom ?? "—"}</td>
                <td className="px-3 py-2 text-right tabular-nums">{alt === null ? "—" : formatQty(alt)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatQty(line.qty - line.deliveredQty)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{line.unitPrice.toFixed(2)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{line.discountPercent.toFixed(2)} %</td>
                <td className="px-3 py-2 text-right tabular-nums">{line.vatPercent.toFixed(2)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{line.aitPercent.toFixed(2)}</td>
                <td className="px-3 py-2 text-right font-medium text-ink tabular-nums">{formatAmount(line.lineTotal)}</td>
              </tr>
            );
          })}
        </tbody>
        <tfoot className="border-t border-line-strong bg-canvas font-medium text-ink">
          <tr>
            <td colSpan={4} className="px-3 py-2 text-right">
              Total:
            </td>
            <td className="px-3 py-2 text-right tabular-nums">{formatQty(order.totalQty)}</td>
            <td />
            <td className="px-3 py-2 text-right tabular-nums">{formatQty(Math.round(altTotal * 1000) / 1000)}</td>
            <td className="px-3 py-2 text-right tabular-nums">{formatQty(Math.round(remaining * 1000) / 1000)}</td>
            <td colSpan={4} />
            <td className="px-3 py-2 text-right tabular-nums">{formatAmount(order.itemsTotal)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function ApprovalTimeline({ order }: { order: OrderDetail }) {
  if (order.events.length === 0) return <EmptyState title="No history yet" />;
  return (
    <ol className="flex flex-col gap-3 p-4">
      {[...order.events].reverse().map((event) => (
        <li key={event.id} className="flex gap-3">
          <span aria-hidden="true" className="mt-1.5 size-2 shrink-0 rounded-full bg-ink-faint" />
          <div className="flex flex-col gap-0.5 text-sm">
            <p className="flex flex-wrap items-center gap-2">
              <span className="font-medium text-ink">{EVENT_LABELS[event.action] ?? event.action}</span>
              {event.fromStatus !== event.toStatus && <Indicator>{ORDER_STATUS_LABELS[event.toStatus]}</Indicator>}
              <span className="text-xs text-ink-faint">
                by {event.actorId} · {formatDateTime(event.createdAt)}
              </span>
            </p>
            {event.remarks && <p className="text-ink-muted">{event.remarks}</p>}
          </div>
        </li>
      ))}
    </ol>
  );
}
