"use client";

import { ArrowLeft, Ban, HandCoins, Printer, Scale } from "lucide-react";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { PageContainer, PageHead } from "@/components/layout/page";
import { Button, buttonClasses } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { CONTROL, TextAreaField } from "@/components/ui/form-field";
import { Indicator } from "@/components/ui/indicator";
import { Card, EmptyState, ErrorState, LoadingState } from "@/components/ui/section";
import { useToast } from "@/components/ui/toast";
import { useResource } from "@/hooks/use-resource";
import { errorMessage } from "@/lib/api/client";
import { cn } from "@/lib/cn";
import { formatDateTime } from "@/lib/format";
import { formatAmount } from "../../dashboard/lib/format";
import { amountInWords } from "../../lib/amount-in-words";
import { formatDay, useToday } from "../../lib/use-today";
import { paths } from "../../paths";
import { round2 } from "../../quotations/lib/totals";
import { COLLECTION_KIND_LABELS, COLLECTION_METHOD_LABELS, type BillDetail, type CollectionDetail } from "../schemas/collection.schema";
import { adjustAdvance, cancelBill, cancelCollection, fetchBill, fetchCollection, fetchDueInvoices } from "../services/collection.api";

function Shell({ title, back, children }: { title: string; back: string; children?: ReactNode }) {
  return (
    <PageContainer>
      <PageHead
        title={
          <span className="flex items-center gap-2">
            <Link href={back} aria-label="Back" className={buttonClasses("ghost", "icon")}>
              <ArrowLeft />
            </Link>
            {title}
          </span>
        }
      />
      {children ?? <LoadingState />}
    </PageContainer>
  );
}

function Detail({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="grid grid-cols-[9rem_1fr] gap-2 text-sm">
      <dt className="text-ink-muted">{label}</dt>
      <dd className="text-ink">: {value || "N/A"}</dd>
    </div>
  );
}

function CancelDialog({ open, title, description, busy, onClose, onConfirm }: { open: boolean; title: string; description: string; busy: boolean; onClose: () => void; onConfirm: (reason: string) => void }) {
  const [reason, setReason] = useState("");
  return (
    <Dialog
      open={open}
      title={title}
      description={description}
      onClose={busy ? () => undefined : onClose}
      onSubmit={() => onConfirm(reason)}
      footer={
        <>
          <Button onClick={onClose} disabled={busy}>
            Back
          </Button>
          <Button type="submit" variant="danger" loading={busy} disabled={!reason.trim()}>
            Cancel It
          </Button>
        </>
      }
    >
      <TextAreaField label="Reason" required rows={3} value={reason} onChange={(event) => setReason(event.target.value)} />
    </Dialog>
  );
}

// ─── Money receipt ───────────────────────────────────────────────────────────

export function CollectionDetailView({ id }: { id: string }) {
  const record = useResource(id, () => fetchCollection(id));
  const back = paths.collectionTab(record.data?.kind === "ADVANCE" ? "advance" : "collected");
  if (record.error)
    return (
      <Shell title="Money Receipt" back={back}>
        <Card>
          <ErrorState message={errorMessage(record.error)} onRetry={record.reload} />
        </Card>
      </Shell>
    );
  if (!record.data) return <Shell title="Money Receipt" back={back} />;
  return <CollectionBody record={record.data} onChanged={(next) => record.mutate(() => next)} />;
}

function CollectionBody({ record, onChanged }: { record: CollectionDetail; onChanged: (next: CollectionDetail) => void }) {
  const toast = useToast();
  const today = useToday();
  const [dialog, setDialog] = useState<"cancel" | "adjust" | null>(null);
  const [busy, setBusy] = useState(false);
  const cancelled = record.status === "CANCELLED";
  const canAdjust = !cancelled && record.kind === "ADVANCE" && record.unallocated > 0;

  async function run(action: () => Promise<CollectionDetail>, message: string) {
    setBusy(true);
    try {
      onChanged(await action());
      toast.success(message);
      setDialog(null);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <PageContainer className="max-w-none">
      <PageHead
        title={
          <span className="flex items-center gap-2">
            <Link href={paths.collectionTab(record.kind === "ADVANCE" ? "advance" : "collected")} aria-label="Back" className={buttonClasses("ghost", "icon")}>
              <ArrowLeft />
            </Link>
            Money Receipt
          </span>
        }
        indicator={cancelled ? <Indicator color="red">Cancelled</Indicator> : <Indicator color="green">{COLLECTION_KIND_LABELS[record.kind]}</Indicator>}
        subtitle={`${record.number} · ${record.customerName} · ${formatAmount(record.amount)}`}
        actions={
          <>
            <Link href={paths.printCollection(record.id)} className={buttonClasses("secondary")}>
              <Printer aria-hidden="true" />
              Print
            </Link>
            {!cancelled && !record.onDelivery && (
              <Button onClick={() => setDialog("cancel")}>
                <Ban aria-hidden="true" />
                Cancel
              </Button>
            )}
            {canAdjust && (
              <Button variant="primary" onClick={() => setDialog("adjust")}>
                <Scale aria-hidden="true" />
                Adjust Against Invoices
              </Button>
            )}
          </>
        }
      />

      {cancelled && (
        <p role="note" className="mb-3 rounded-lg bg-control px-3 py-2 text-sm text-ink">
          <span className="font-medium">Cancelled</span> by {record.cancelledBy} on {record.cancelledAt && formatDateTime(record.cancelledAt)}: <span className="text-ink-muted">{record.cancelReason}</span>
        </p>
      )}
      {record.onDelivery && record.deliveryId && (
        <p role="note" className="mb-3 rounded-lg bg-control px-3 py-2 text-sm text-ink">
          Collected on delivery. Change it from the{" "}
          <Link href={paths.delivery(record.deliveryId)} className="underline underline-offset-2">
            delivery
          </Link>
          .
        </p>
      )}

      <div className="flex flex-col gap-4">
        <Card className="p-4">
          <h2 className="mb-3 text-base font-semibold text-ink">
            Office Name: {record.officeName ?? "N/A"} <span className="ml-3 text-sm font-normal text-ink-muted">Receipt No {record.number}</span>
          </h2>
          <div className="grid gap-x-8 gap-y-1 md:grid-cols-2">
            <dl className="flex flex-col gap-1">
              <Detail label="Customer" value={`${record.customerName} (${record.customerCode})`} />
              <Detail label="Mobile" value={record.customerPhone} />
              <Detail label="Address" value={record.customerAddress} />
              <Detail label="Collect By" value={record.salesPersonName} />
              <Detail label="Remarks" value={record.remarks} />
            </dl>
            <dl className="flex flex-col gap-1">
              <Detail label="Collection Date" value={formatDay(record.collectionDate)} />
              <Detail label="Type" value={COLLECTION_KIND_LABELS[record.kind]} />
              <Detail label="Payment Method" value={COLLECTION_METHOD_LABELS[record.method]} />
              <Detail label="Reference" value={[record.reference, record.bankName].filter(Boolean).join(" · ")} />
              <Detail label="Created By" value={record.createdBy && `${record.createdBy} · ${formatDateTime(record.createdAt)}`} />
            </dl>
          </div>
        </Card>

        <Card>
          <div className="border-b border-line px-4 py-2.5 text-sm font-semibold text-ink">{record.kind === "ADVANCE" ? "Adjusted Against Invoices" : "Invoices Paid"}</div>
          {record.allocations.length === 0 ? (
            <EmptyState title={record.kind === "ADVANCE" ? "Not adjusted yet" : "No invoices"} />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead className="bg-canvas text-xs text-ink-muted">
                  <tr className="border-b border-line">
                    {["SL", "Invoice No", "Invoice Date", "Invoice Amount", "Paid"].map((label, index) => (
                      <th key={label} scope="col" className={cn("px-3 py-2 font-medium", index >= 3 ? "text-right" : "text-left")}>
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {record.allocations.map((row, index) => (
                    <tr key={row.deliveryId}>
                      <td className="px-3 py-2 text-ink-faint">{index + 1}</td>
                      <td className="px-3 py-2">
                        <Link href={paths.delivery(row.deliveryId)} className="font-medium text-ink hover:underline">
                          {row.invoiceNumber}
                        </Link>
                      </td>
                      <td className="px-3 py-2">{formatDay(row.invoiceDate)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatAmount(row.invoiceAmount)}</td>
                      <td className="px-3 py-2 text-right font-medium text-ink tabular-nums">{formatAmount(row.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <div className="grid gap-4 lg:grid-cols-[1fr_22rem]">
          <p className="text-sm">
            <span className="font-semibold text-ink">Amount in Words: </span>
            <span className="text-ink-muted">{amountInWords(record.amount)}</span>
          </p>
          <Card className="p-4">
            <dl className="flex flex-col gap-1.5 text-sm">
              <Row label="Amount" value={record.amount} strong />
              <Row label="Applied to Invoices" value={record.allocated} />
              {record.kind === "ADVANCE" && <Row label="Advance Balance" value={record.unallocated} />}
            </dl>
          </Card>
        </div>
      </div>

      <CancelDialog
        open={dialog === "cancel"}
        title={`Cancel ${record.number}?`}
        description="The invoices it paid become due again. Only approvers can cancel a money receipt."
        busy={busy}
        onClose={() => setDialog(null)}
        onConfirm={(reason) => run(() => cancelCollection(record.id, record.updatedAt, reason), `${record.number} cancelled.`)}
      />
      {dialog === "adjust" && today && (
        <AdjustDialog
          record={record}
          today={today}
          busy={busy}
          onClose={() => setDialog(null)}
          onConfirm={(allocations) => run(() => adjustAdvance(record.id, record.updatedAt, allocations), "Advance adjusted.")}
        />
      )}
    </PageContainer>
  );
}

function Row({ label, value, strong }: { label: string; value: number; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className={strong ? "font-semibold text-ink" : "text-ink-muted"}>{label}</dt>
      <dd className={cn("tabular-nums", strong ? "text-base font-semibold text-ink" : "text-ink")}>{formatAmount(value)}</dd>
    </div>
  );
}

/** Applies the advance balance to the customer's due invoices (oldest first by default). */
function AdjustDialog({
  record,
  today,
  busy,
  onClose,
  onConfirm,
}: {
  record: CollectionDetail;
  today: string;
  busy: boolean;
  onClose: () => void;
  onConfirm: (allocations: { deliveryId: string; amount: number }[]) => void;
}) {
  const invoices = useResource(`adjust:${record.id}:${record.updatedAt}`, () => fetchDueInvoices({ customerId: record.customerId, asOf: today }));
  const [amounts, setAmounts] = useState<Record<string, string> | null>(null);
  if (invoices.data && amounts === null) {
    let left = record.unallocated;
    const initial: Record<string, string> = {};
    for (const row of invoices.data) {
      const take = round2(Math.min(row.due, left));
      initial[row.deliveryId] = take > 0 ? String(take) : "";
      left = round2(left - take);
    }
    setAmounts(initial);
  }
  const total = round2(Object.values(amounts ?? {}).reduce((sum, value) => sum + (Number(value) || 0), 0));
  const allocations = Object.entries(amounts ?? {})
    .filter(([, value]) => Number(value) > 0)
    .map(([deliveryId, value]) => ({ deliveryId, amount: Number(value) }));

  return (
    <Dialog
      open
      size="lg"
      title={`Adjust ${record.number}`}
      description={`Advance balance ${formatAmount(record.unallocated)}. Enter how much goes to each invoice.`}
      onClose={busy ? () => undefined : onClose}
      onSubmit={() => onConfirm(allocations)}
      footer={
        <>
          <Button onClick={onClose} disabled={busy}>
            Back
          </Button>
          <Button type="submit" variant="primary" loading={busy} disabled={allocations.length === 0 || total > record.unallocated + 1e-9}>
            Adjust {formatAmount(total)}
          </Button>
        </>
      }
    >
      {invoices.error ? (
        <ErrorState message={errorMessage(invoices.error)} onRetry={invoices.reload} />
      ) : !invoices.data || !amounts ? (
        <LoadingState />
      ) : invoices.data.length === 0 ? (
        <EmptyState title="Nothing is due from this customer" />
      ) : (
        <table className="w-full text-sm">
          <thead className="text-xs text-ink-muted">
            <tr className="border-b border-line">
              <th scope="col" className="py-1.5 text-left font-medium">Invoice</th>
              <th scope="col" className="py-1.5 text-left font-medium">Date</th>
              <th scope="col" className="py-1.5 text-right font-medium">Due</th>
              <th scope="col" className="w-36 py-1.5 text-right font-medium">Adjust</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {invoices.data.map((row) => (
              <tr key={row.deliveryId}>
                <td className="py-1.5 text-ink">{row.number}</td>
                <td className="py-1.5">{formatDay(row.deliveryDate)}</td>
                <td className="py-1.5 text-right tabular-nums">{formatAmount(row.due)}</td>
                <td className="py-1 pl-2">
                  <input
                    aria-label={`Adjust amount for ${row.number}`}
                    type="number"
                    min={0}
                    max={row.due}
                    step="any"
                    value={amounts[row.deliveryId] ?? ""}
                    onChange={(event) => setAmounts({ ...amounts, [row.deliveryId]: event.target.value })}
                    className={cn(CONTROL, "h-7 w-full text-right tabular-nums")}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {total > record.unallocated + 1e-9 && <p className="mt-2 text-xs text-danger">More than the advance balance.</p>}
    </Dialog>
  );
}

// ─── Bill ────────────────────────────────────────────────────────────────────

export function BillDetailView({ id }: { id: string }) {
  const today = useToday();
  const bill = useResource(today ? `bill:${id}` : null, () => fetchBill(id, today!));
  if (bill.error)
    return (
      <Shell title="Bill" back={paths.collectionTab("bills")}>
        <Card>
          <ErrorState message={errorMessage(bill.error)} onRetry={bill.reload} />
        </Card>
      </Shell>
    );
  if (!today || !bill.data) return <Shell title="Bill" back={paths.collectionTab("bills")} />;
  return <BillBody today={today} bill={bill.data} onChanged={(next) => bill.mutate(() => next)} />;
}

function BillBody({ today, bill, onChanged }: { today: string; bill: BillDetail; onChanged: (next: BillDetail) => void }) {
  const toast = useToast();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const cancelled = bill.status === "CANCELLED";

  async function cancel(reason: string) {
    setBusy(true);
    try {
      onChanged(await cancelBill(bill.id, bill.updatedAt, reason, today));
      toast.success(`${bill.number} cancelled. Its invoices can go on a new bill.`);
      setCancelOpen(false);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <PageContainer className="max-w-none">
      <PageHead
        title={
          <span className="flex items-center gap-2">
            <Link href={paths.collectionTab("bills")} aria-label="Back" className={buttonClasses("ghost", "icon")}>
              <ArrowLeft />
            </Link>
            Bill {bill.number}
          </span>
        }
        indicator={cancelled ? <Indicator color="red">Cancelled</Indicator> : bill.due > 0 ? <Indicator color="orange">Due</Indicator> : <Indicator color="green">Collected</Indicator>}
        subtitle={`${bill.customerName} · Bill ${formatAmount(bill.billAmount)} · Due ${formatAmount(bill.due)}`}
        actions={
          <>
            <Link href={paths.printBill(bill.id)} className={buttonClasses("secondary")}>
              <Printer aria-hidden="true" />
              Print
            </Link>
            {!cancelled && (
              <Button onClick={() => setCancelOpen(true)}>
                <Ban aria-hidden="true" />
                Cancel Bill
              </Button>
            )}
            {!cancelled && bill.due > 0 && (
              <Link href={paths.collectByInvoice(bill.customerId, bill.id)} className={buttonClasses("primary")}>
                <HandCoins aria-hidden="true" />
                Collect
              </Link>
            )}
          </>
        }
      />
      {cancelled && (
        <p role="note" className="mb-3 rounded-lg bg-control px-3 py-2 text-sm text-ink">
          <span className="font-medium">Cancelled</span> by {bill.cancelledBy} on {bill.cancelledAt && formatDateTime(bill.cancelledAt)}: <span className="text-ink-muted">{bill.cancelReason}</span>
        </p>
      )}

      <div className="flex flex-col gap-4">
        <Card className="p-4">
          <div className="grid gap-x-8 gap-y-1 md:grid-cols-2">
            <dl className="flex flex-col gap-1">
              <Detail label="Customer" value={`${bill.customerName} (${bill.customerCode})`} />
              <Detail label="Mobile" value={bill.customerPhone} />
              <Detail label="Address" value={bill.customerAddress} />
              <Detail label="Remarks" value={bill.remarks} />
            </dl>
            <dl className="flex flex-col gap-1">
              <Detail label="Bill Date" value={formatDay(bill.billDate)} />
              <Detail label="Office" value={bill.officeName} />
              <Detail label="Created By" value={bill.createdBy && `${bill.createdBy} · ${formatDateTime(bill.createdAt)}`} />
            </dl>
          </div>
        </Card>
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="bg-canvas text-xs text-ink-muted">
                <tr className="border-b border-line">
                  {["SL", "Invoice No", "Challan No", "Invoice Date", "Due Date", "Invoice Amount", "Billed", "Due Now"].map((label, index) => (
                    <th key={label} scope="col" className={cn("px-3 py-2 font-medium", index >= 5 ? "text-right" : "text-left")}>
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {bill.lines.map((line, index) => (
                  <tr key={line.deliveryId}>
                    <td className="px-3 py-2 text-ink-faint">{index + 1}</td>
                    <td className="px-3 py-2">
                      <Link href={paths.delivery(line.deliveryId)} className="font-medium text-ink hover:underline">
                        {line.invoiceNumber}
                      </Link>
                    </td>
                    <td className="px-3 py-2">{line.challanNo ?? "—"}</td>
                    <td className="px-3 py-2">{formatDay(line.invoiceDate)}</td>
                    <td className="px-3 py-2">{formatDay(line.dueDate)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatAmount(line.invoiceAmount)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatAmount(line.billedAmount)}</td>
                    <td className={cn("px-3 py-2 text-right font-medium tabular-nums", line.due > 0 ? "text-ink" : "text-success")}>{formatAmount(line.due)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t border-line-strong bg-canvas font-medium text-ink">
                <tr>
                  <td colSpan={6} className="px-3 py-2 text-right">
                    Total
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatAmount(bill.billAmount)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatAmount(bill.due)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </Card>
      </div>
      <CancelDialog
        open={cancelOpen}
        title={`Cancel ${bill.number}?`}
        description="Collections stay as they are; the invoices can be put on a new bill."
        busy={busy}
        onClose={() => setCancelOpen(false)}
        onConfirm={cancel}
      />
    </PageContainer>
  );
}
