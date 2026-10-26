"use client";

import { ArrowLeft, Ban, CheckCircle2, Pencil, Play, Printer, Square, XCircle } from "lucide-react";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { PageContainer, PageHead } from "@/components/layout/page";
import { Button, buttonClasses } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { TextAreaField } from "@/components/ui/form-field";
import { Indicator } from "@/components/ui/indicator";
import { Card, ErrorState, LoadingState } from "@/components/ui/section";
import { Tabs } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast";
import { useResource } from "@/hooks/use-resource";
import { errorMessage } from "@/lib/api/client";
import { LineTable } from "@/features/production/bom/components/BomDialogs";
import { paths } from "../../paths";
import { APPROVAL_ORDER_LABELS, APPROVAL_STATUS_LABELS, type OrderAction, type OrderDetail } from "../schemas/order.schema";
import { actOnOrder, fetchOrder, orderPdfUrl } from "../services/order.api";
import { OrderStatusBadge, day, money, qty2, stamp } from "./OrderParts";

const ACTIONS: Record<OrderAction, { label: string; icon: ReactNode; variant: "primary" | "secondary" | "danger"; needsReason?: boolean; confirm: string }> = {
  approve: { label: "Approve", icon: <CheckCircle2 aria-hidden="true" />, variant: "primary", confirm: "Approve this production order?" },
  reject: { label: "Reject", icon: <XCircle aria-hidden="true" />, variant: "danger", needsReason: true, confirm: "Reject this production order?" },
  start: { label: "Start Production", icon: <Play aria-hidden="true" />, variant: "primary", confirm: "Mark this order as in progress?" },
  close: { label: "Close", icon: <Square aria-hidden="true" />, variant: "secondary", confirm: "Close this order? No more production can be booked to it." },
  cancel: { label: "Cancel Order", icon: <Ban aria-hidden="true" />, variant: "danger", needsReason: true, confirm: "Cancel this production order?" },
};

function Pair({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="grid grid-cols-[9rem_auto_1fr] gap-x-2 text-sm">
      <dt className="text-ink-muted">{label}</dt>
      <span aria-hidden="true" className="text-ink-faint">
        :
      </span>
      <dd className="font-medium text-ink">{value}</dd>
    </div>
  );
}

/** /production/orders/[orderId]: "Production Order View". */
export function OrderDetailView({ id }: { id: string }) {
  const detail = useResource(`production-order:${id}`, () => fetchOrder(id));
  return (
    <PageContainer className="max-w-none">
      <PageHead
        title={
          <span className="flex items-center gap-2">
            <Link href={paths.orders} aria-label="Back to Production Order list" className="rounded-md p-1 text-ink-muted hover:bg-control hover:text-ink">
              <ArrowLeft aria-hidden="true" className="size-5" />
            </Link>
            Production Order View
          </span>
        }
      />
      {detail.error ? (
        <Card>
          <ErrorState message={errorMessage(detail.error)} onRetry={detail.reload} />
        </Card>
      ) : !detail.data ? (
        <LoadingState />
      ) : (
        <OrderView order={detail.data} onChanged={(order) => detail.mutate(() => order)} />
      )}
    </PageContainer>
  );
}

function OrderView({ order, onChanged }: { order: OrderDetail; onChanged: (order: OrderDetail) => void }) {
  const toast = useToast();
  const [tab, setTab] = useState<"items" | "approvals">("items");
  const [acting, setActing] = useState<OrderAction | null>(null);
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  function open(action: OrderAction) {
    setActing(action);
    setComment("");
    setError(undefined);
  }

  async function submit() {
    if (!acting) return;
    if (ACTIONS[acting].needsReason && !comment.trim()) return setError("Give a reason.");
    setBusy(true);
    try {
      const updated = await actOnOrder(order.id, { version: order.updatedAt, action: acting, ...(comment.trim() ? { comment: comment.trim() } : {}) });
      toast.success(`${order.number}: ${ACTIONS[acting].label} done.`);
      onChanged(updated);
      setActing(null);
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setBusy(false);
    }
  }

  const materialTotals = order.materials.reduce(
    (sum, line) => ({
      required: sum.required + line.requiredQty,
      issue: sum.issue + line.issueQty,
      used: sum.used + line.usedQty,
      remaining: sum.remaining + line.remainingQty,
      returned: sum.returned + line.returnQty,
    }),
    { required: 0, issue: 0, used: 0, remaining: 0, returned: 0 },
  );

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-col gap-4 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="flex-1 text-base font-semibold text-ink">Order Details</h2>
          {order.allowedActions.map((action) => (
            <Button key={action} size="sm" variant={ACTIONS[action].variant} onClick={() => open(action)}>
              {ACTIONS[action].icon}
              {ACTIONS[action].label}
            </Button>
          ))}
          {order.canEdit && (
            <Link href={paths.editOrder(order.id)} className={buttonClasses("secondary", "sm")}>
              <Pencil aria-hidden="true" />
              Edit
            </Link>
          )}
          <a href={orderPdfUrl(order.id)} target="_blank" rel="noopener" aria-label="Print production order" title="Print" className={buttonClasses("ghost", "icon")}>
            <Printer aria-hidden="true" />
          </a>
          <OrderStatusBadge status={order.status} />
        </div>
        <dl className="grid gap-x-10 gap-y-1.5 md:grid-cols-2">
          <Pair label="Product Order Code" value={order.number} />
          <Pair label="Production Date" value={day(order.productionDate)} />
          <Pair label="Order Date" value={day(order.orderDate)} />
          <Pair label="Narration" value={order.narration ?? "N/A"} />
          <Pair label="Office Name" value={order.officeName} />
          <Pair label="Customer PoNo" value={order.customerPoNo ?? "N/A"} />
          <Pair label="Work Center" value={order.workCenterName ?? "N/A"} />
          <Pair label="Lot Size" value={qty2(order.bomLotSize)} />
          <Pair label="Warehouse" value={order.warehouseName} />
          <Pair label="Machine Name" value={order.machineName ?? "N/A"} />
          <Pair label="Customer" value={order.customerName ?? "N/A"} />
          <Pair label="Sales Order" value={order.salesOrderNumber ?? "N/A"} />
          <Pair label="Produced Value" value={money(order.producedValue)} />
          <Pair label="Created By" value={`${order.createdByName} · ${stamp(order.createdAt)}`} />
        </dl>
        {order.statusReason && (
          <p className="rounded-md bg-control px-3 py-2 text-sm text-ink-muted">
            <span className="font-medium text-ink">Reason:</span> {order.statusReason}
          </p>
        )}
      </Card>

      <Card>
        <Tabs
          label="Production order"
          value={tab}
          onChange={setTab}
          tabs={[
            { id: "items", label: "Item List" },
            { id: "approvals", label: "Approval Status" },
          ]}
        >
          <div className="flex flex-col gap-4 p-4">
            {tab === "items" ? (
              <>
                <section aria-labelledby="fg-details" className="flex flex-col gap-2">
                  <h3 id="fg-details" className="text-sm font-semibold text-ink">
                    Finished goods details
                  </h3>
                  <LineTable
                    columns={[
                      { header: "SL", className: "w-12" },
                      { header: "BOM Name" },
                      { header: "Item Code" },
                      { header: "Item Name" },
                      { header: "QTY", align: "right" },
                      { header: "Produced", align: "right" },
                      { header: "Remaining", align: "right" },
                    ]}
                    rows={[
                      [
                        1,
                        order.bomName,
                        order.itemCode,
                        <span key="name" className="text-ink">{order.itemName}</span>,
                        `${qty2(order.orderQty)} ${order.uom}`,
                        `${qty2(order.producedQty)} ${order.uom}`,
                        `${qty2(order.remainingQty)} ${order.uom}`,
                      ],
                    ]}
                  />
                </section>
                <section aria-labelledby="material-details" className="flex flex-col gap-2">
                  <h3 id="material-details" className="text-sm font-semibold text-ink">
                    Material Details
                  </h3>
                  <LineTable
                    columns={[
                      { header: "SL", className: "w-12" },
                      { header: "Item Code" },
                      { header: "Item Name" },
                      { header: "UoM" },
                      { header: "Required QTY", align: "right" },
                      { header: "Issue QTY", align: "right" },
                      { header: "Used QTY", align: "right" },
                      { header: "Remaining QTY", align: "right" },
                      { header: "Return QTY", align: "right" },
                    ]}
                    rows={order.materials.map((line, index) => [
                      index + 1,
                      line.code,
                      <span key="name" className="text-ink">{line.name}</span>,
                      line.uom,
                      qty2(line.requiredQty),
                      qty2(line.issueQty),
                      qty2(line.usedQty),
                      qty2(line.remainingQty),
                      qty2(line.returnQty),
                    ])}
                    footer={[
                      [
                        "",
                        "",
                        "Total",
                        "",
                        qty2(materialTotals.required),
                        qty2(materialTotals.issue),
                        qty2(materialTotals.used),
                        qty2(materialTotals.remaining),
                        qty2(materialTotals.returned),
                      ],
                    ]}
                    empty="The BOM has no input material."
                  />
                </section>
              </>
            ) : (
              <LineTable
                columns={[
                  { header: "SL", className: "w-12" },
                  { header: "Stage Name" },
                  { header: "Approver Name" },
                  { header: "Order Type" },
                  { header: "Status" },
                  { header: "Comment" },
                  { header: "Time" },
                ]}
                rows={order.approvals.map((stage, index) => [
                  index + 1,
                  <span key="stage" className="text-ink">
                    {stage.stageName}
                    {stage.requiredCount > 1 && <span className="ml-1 text-xs text-ink-faint">({stage.approvedNames.length}/{stage.requiredCount})</span>}
                  </span>,
                  stage.approvedNames.length
                    ? stage.approvedNames.join(", ")
                    : stage.actedByName
                      ? stage.actedByName
                      : stage.approverNames.length
                        ? <span key="who" className="text-ink-faint">{stage.approverNames.join(", ")}</span>
                        : <span key="who" className="text-ink-faint">Any approver</span>,
                  APPROVAL_ORDER_LABELS[stage.approvalOrder] ?? stage.approvalOrder,
                  <Indicator key="status" color={stage.status === "APPROVED" ? "green" : stage.status === "REJECTED" ? "red" : "orange"}>
                    {APPROVAL_STATUS_LABELS[stage.status]}
                  </Indicator>,
                  stage.comment ?? "N/A",
                  stage.actedAt ? <span key="time" className="whitespace-nowrap">{stamp(stage.actedAt)}</span> : "—",
                ])}
              />
            )}
          </div>
        </Tabs>
      </Card>

      <Dialog
        open={acting !== null}
        title={acting ? ACTIONS[acting].label : ""}
        description={acting ? `${ACTIONS[acting].confirm} (${order.number})` : undefined}
        onClose={busy ? () => undefined : () => setActing(null)}
        onSubmit={submit}
        footer={
          <>
            <Button onClick={() => setActing(null)} disabled={busy}>
              Back
            </Button>
            {acting && (
              <Button type="submit" variant={ACTIONS[acting].variant === "danger" ? "danger" : "primary"} loading={busy}>
                {ACTIONS[acting].label}
              </Button>
            )}
          </>
        }
      >
        <TextAreaField
          label={acting && ACTIONS[acting].needsReason ? "Reason" : "Comment"}
          required={!!acting && !!ACTIONS[acting].needsReason}
          maxLength={500}
          value={comment}
          error={error}
          onChange={(event) => setComment(event.target.value)}
        />
      </Dialog>
    </div>
  );
}
