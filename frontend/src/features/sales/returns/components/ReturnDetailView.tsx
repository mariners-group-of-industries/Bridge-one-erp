"use client";

import { ArrowLeft, CircleCheckBig, ClipboardCheck, Ellipsis, Factory, FileText, List, Pencil, Printer, RefreshCw, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { PageContainer, PageHead } from "@/components/layout/page";
import { Button, buttonClasses } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { DropdownMenu, type MenuItem } from "@/components/ui/dropdown-menu";
import { CONTROL, TextAreaField } from "@/components/ui/form-field";
import { Indicator } from "@/components/ui/indicator";
import { Card, ErrorState, LoadingState } from "@/components/ui/section";
import { Tabs } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast";
import { useResource } from "@/hooks/use-resource";
import { errorMessage } from "@/lib/api/client";
import { cn } from "@/lib/cn";
import { formatDateTime } from "@/lib/format";
import { formatAmount, formatQty } from "../../dashboard/lib/format";
import { formatDay } from "../../lib/use-today";
import { paths } from "../../paths";
import { MARKET_STAGE_LABELS, RETURN_KIND_LABELS, RETURN_MODE_LABELS, RETURN_STATUS_LABELS, type ReturnDetail } from "../schemas/return.schema";
import { approveReturn, deleteReturn, fetchReturn, qcMarketReturn, receiveMarketReturn, returnChallanPdfUrl } from "../services/return.api";
import { STAGE_COLORS, STATUS_COLORS } from "./ReturnWorkspaceView";

export function ReturnDetailView({ id }: { id: string }) {
  const record = useResource(id, () => fetchReturn(id));
  if (record.error) {
    return (
      <PageContainer>
        <PageHead title="Sales Return" />
        <Card>
          <ErrorState message={errorMessage(record.error)} onRetry={record.reload} />
        </Card>
      </PageContainer>
    );
  }
  if (!record.data) {
    return (
      <PageContainer>
        <PageHead title="Sales Return" />
        <LoadingState />
      </PageContainer>
    );
  }
  return <ReturnBody record={record.data} onChanged={(next) => record.mutate(() => next)} onReload={record.reload} />;
}

type DialogKind = "approve" | "delete" | "receive" | "qc" | null;

function ReturnBody({ record, onChanged, onReload }: { record: ReturnDetail; onChanged: (next: ReturnDetail) => void; onReload: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const [tab, setTab] = useState<"items" | "approval">("items");
  const [dialog, setDialog] = useState<DialogKind>(null);
  const [reason, setReason] = useState("");
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const market = record.kind === "MARKET";
  const pending = record.status === "DRAFT";
  const deleted = record.status === "CANCELLED";
  const exchange = record.mode === "EXCHANGE";
  const canReceive = market && record.marketStage === "APPROVED";
  const canQc = market && record.marketStage === "FACTORY_RECEIVED";
  const listHref = exchange && record.exchangeDeliveryId ? paths.delivery(record.exchangeDeliveryId) : paths.returnTab(market ? "market" : "returns");

  async function run(action: () => Promise<ReturnDetail | void>, message: string) {
    setBusy(true);
    try {
      const next = await action();
      toast.success(message);
      setDialog(null);
      if (next) onChanged(next);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  function openQuantities(kind: "receive" | "qc") {
    setQuantities(Object.fromEntries(record.lines.map((line) => [line.id, String(kind === "receive" ? line.qty : (line.receivedQty ?? 0))])));
    setDialog(kind);
  }

  const lineQuantities = () => record.lines.map((line) => ({ lineId: line.id, qty: Number(quantities[line.id] || 0) }));

  async function remove() {
    setBusy(true);
    try {
      await deleteReturn(record.id, record.updatedAt, reason);
      toast.success(`${record.number} deleted.${record.status === "SUBMITTED" ? " Its stock and credit were reversed." : ""}`);
      router.replace(paths.returnTab(market ? "market" : "returns"));
    } catch (error) {
      toast.error(errorMessage(error));
      setBusy(false);
    }
  }

  const menu: MenuItem[] = [
    { label: "Reload", icon: <RefreshCw />, onSelect: onReload },
    { label: "Print", icon: <Printer />, href: paths.printReturn(record.id) },
    { label: "Return Note/Challan (PDF)", icon: <FileText />, onSelect: () => window.open(returnChallanPdfUrl(record.id), "_blank", "noopener") },
    { label: "Download Return Challan", icon: <FileText />, onSelect: () => window.location.assign(returnChallanPdfUrl(record.id, true)) },
    ...(!deleted && !exchange
      ? (["separator", { label: "Delete", icon: <Trash2 />, danger: true, onSelect: () => { setReason(""); setDialog("delete"); } }] satisfies MenuItem[])
      : []),
  ];

  const statusIndicator =
    market && record.status === "SUBMITTED" ? (
      <Indicator color={STAGE_COLORS[record.marketStage]}>{MARKET_STAGE_LABELS[record.marketStage]}</Indicator>
    ) : (
      <Indicator color={STATUS_COLORS[record.status]}>{RETURN_STATUS_LABELS[record.status]}</Indicator>
    );

  return (
    <PageContainer className="max-w-none">
      <PageHead
        title={
          <span className="flex items-center gap-2">
            <Link href={listHref} aria-label="Back" className={buttonClasses("ghost", "icon")}>
              <ArrowLeft />
            </Link>
            {RETURN_MODE_LABELS[record.mode]}
          </span>
        }
        indicator={statusIndicator}
        subtitle={`${record.number} · ${record.customerName} · ${formatAmount(record.totalAmount)}`}
        actions={
          <>
            <DropdownMenu trigger={<Ellipsis />} triggerLabel="More actions" triggerClassName={buttonClasses("secondary", "icon")} items={menu} />
            {pending && !exchange && (
              <Link href={paths.editReturn(record.id)} className={buttonClasses("secondary")}>
                <Pencil aria-hidden="true" />
                Edit
              </Link>
            )}
            {pending && (
              <Button variant="primary" onClick={() => setDialog("approve")}>
                <CircleCheckBig aria-hidden="true" />
                Approve
              </Button>
            )}
            {canReceive && (
              <Button variant="primary" onClick={() => openQuantities("receive")}>
                <Factory aria-hidden="true" />
                Factory Receive
              </Button>
            )}
            {canQc && (
              <Button variant="primary" onClick={() => openQuantities("qc")}>
                <ClipboardCheck aria-hidden="true" />
                QC
              </Button>
            )}
          </>
        }
      />

      {deleted && (
        <p role="note" className="mb-3 rounded-lg bg-control px-3 py-2 text-sm text-ink">
          <span className="font-medium">Deleted</span> by {record.deletedBy} on {record.deletedAt && formatDateTime(record.deletedAt)}: <span className="text-ink-muted">{record.deleteReason}</span>
        </p>
      )}
      {exchange && (
        <p role="note" className="mb-3 rounded-lg bg-control px-3 py-2 text-sm text-ink">
          Goods taken back on an exchange. Change or delete it from its{" "}
          {record.exchangeDeliveryId ? (
            <Link href={paths.delivery(record.exchangeDeliveryId)} className="underline underline-offset-2">
              exchange delivery
            </Link>
          ) : (
            "exchange delivery"
          )}
          .
        </p>
      )}

      <div className="flex flex-col gap-4">
        <Card className="p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-line pb-3">
            <h2 className="flex items-center gap-2 text-base text-ink">
              <List aria-hidden="true" className="size-4" />
              Office Name : <span className="font-semibold">{record.officeName ?? "N/A"}</span>
            </h2>
            <p className="flex items-center gap-1 text-sm text-ink-muted">
              Total Amount <span className="font-semibold text-ink tabular-nums">{formatAmount(-record.totalAmount)}</span> | Invoice No{" "}
              <span className="font-semibold text-accent-strong">{record.number}</span>
              <a href={returnChallanPdfUrl(record.id)} target="_blank" rel="noopener" aria-label="Print return challan" title="Return Note/Challan (PDF)" className={buttonClasses("ghost", "icon")}>
                <Printer />
              </a>
            </p>
          </div>
          <div className="grid gap-x-8 gap-y-1 md:grid-cols-2">
            <dl className="flex flex-col gap-1">
              <Detail label="Customer" value={record.customerName} />
              <Detail label="Customer Code" value={record.customerCode} />
              <Detail label="Mobile" value={record.customerPhone} />
              <Detail label="Territory Name" value={record.territory} />
              <Detail label="Customer Group Name" value={record.customerGroup} />
              <Detail label="Shipping Address" value={record.shippingAddress} />
              <Detail label="Sales Force" value={record.salesPersonName} />
              <Detail label="Remarks" value={record.remarks} />
              <Detail label="Return Reason" value={record.reason} />
            </dl>
            <dl className="flex flex-col gap-1">
              <Detail label="Return Date" value={formatDay(record.returnDate)} />
              <Detail label="Type" value={RETURN_KIND_LABELS[record.kind]} />
              <Detail label="Challan Number" value={record.deliveryId && record.challanNo && <DeliveryLink id={record.deliveryId}>{record.challanNo}</DeliveryLink>} />
              <Detail label="Sales Invoice" value={record.deliveryId && <DeliveryLink id={record.deliveryId}>{record.deliveryNumber}</DeliveryLink>} />
              <Detail label="Warehouse" value={record.warehouseName} />
              <Detail label="Return Ref. No" value={[record.refNo, record.refDate && formatDay(record.refDate)].filter(Boolean).join(" · ")} />
              <Detail label="Return Ref. Amount" value={record.refAmount === null ? null : formatAmount(record.refAmount)} />
              <Detail label="Return Req. No" value={record.requestNo} />
              <Detail label="Without Invoice" value={record.withoutInvoice ? "Yes (no VAT credited)" : "No"} />
              <Detail label="Created By" value={record.createdBy} />
              <Detail label="Return Ref. Date" value={record.refDate && formatDay(record.refDate)} />
            </dl>
          </div>
        </Card>

        <Card>
          <Tabs
            label="Return sections"
            tabs={[
              { id: "items", label: "Item List", badge: record.lines.length },
              { id: "approval", label: "Approval Status" },
            ]}
            value={tab}
            onChange={setTab}
          >
            {tab === "items" ? <ItemTable record={record} /> : <ApprovalStatus record={record} />}
          </Tabs>
        </Card>

        <div className="grid gap-4 lg:grid-cols-[1fr_22rem]">
          <div />
          <Card className="p-4">
            <dl className="flex flex-col gap-1.5 text-sm">
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-ink-muted">Price Including VAT</dt>
                <dd className="text-ink">{record.priceIncludesVat ? "Yes" : "No"}</dd>
              </div>
              <Total label="Item Total :" value={record.itemsTotal} />
              <Total label="Discount :" value={record.discountAmount} />
              <Total label="Special Discount :" value={0} />
              <Total label="Total VAT:" value={record.vatAmount} />
              {record.aitAmount > 0 && <Total label="Total AIT:" value={record.aitAmount} />}
              <Total label="Item Total (With VAT):" value={record.itemsTotal} />
              <Total label="Total SD:" value={0} />
              <Total label="Delivery Charge:" value={0} />
              <Total label="Other Charge:" value={0} />
              <div className="mt-1 border-t border-line pt-2">
                <Total label="Return Total :" value={record.totalAmount} strong />
              </div>
            </dl>
          </Card>
        </div>
      </div>

      <Dialog
        open={dialog === "approve"}
        title={`Approve ${record.number}`}
        description={
          market
            ? `The customer is credited ${formatAmount(record.totalAmount)}. The goods enter stock after factory receipt and QC.`
            : `The customer is credited ${formatAmount(record.totalAmount)} and ${formatQty(record.totalQty)} units go back into ${record.warehouseName ?? "the warehouse"}.`
        }
        onClose={busy ? () => undefined : () => setDialog(null)}
        onSubmit={() => run(() => approveReturn(record.id, record.updatedAt), `${record.number} approved.`)}
        footer={
          <>
            <Button onClick={() => setDialog(null)} disabled={busy}>
              Back
            </Button>
            <Button type="submit" variant="primary" loading={busy}>
              Approve
            </Button>
          </>
        }
      >
        <ul className="flex flex-col gap-1 text-sm">
          {record.lines.map((line) => (
            <li key={line.id} className="flex justify-between gap-3">
              <span className="text-ink">{line.itemName}</span>
              <span className="text-ink-muted tabular-nums">
                {formatQty(line.qty)} {line.uom} · {formatAmount(line.amount)}
              </span>
            </li>
          ))}
        </ul>
      </Dialog>

      <Dialog
        open={dialog === "receive" || dialog === "qc"}
        size="lg"
        title={dialog === "qc" ? `QC ${record.number}` : `Factory Receive ${record.number}`}
        description={dialog === "qc" ? "Quantity that passed QC goes into the warehouse stock." : "Quantity that actually reached the factory."}
        onClose={busy ? () => undefined : () => setDialog(null)}
        onSubmit={() =>
          dialog === "qc"
            ? run(() => qcMarketReturn(record.id, record.updatedAt, lineQuantities()), `QC saved for ${record.number}.`)
            : run(() => receiveMarketReturn(record.id, record.updatedAt, lineQuantities()), `${record.number} received at the factory.`)
        }
        footer={
          <>
            <Button onClick={() => setDialog(null)} disabled={busy}>
              Back
            </Button>
            <Button type="submit" variant="primary" loading={busy}>
              Save
            </Button>
          </>
        }
      >
        <table className="w-full text-sm">
          <thead className="text-xs text-ink-muted">
            <tr className="border-b border-line">
              <th scope="col" className="py-1.5 text-left font-medium">Item</th>
              <th scope="col" className="py-1.5 text-right font-medium">{dialog === "qc" ? "Received" : "Returned"}</th>
              <th scope="col" className="w-32 py-1.5 text-right font-medium">{dialog === "qc" ? "QC Passed" : "Received"}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {record.lines.map((line) => {
              const max = dialog === "qc" ? (line.receivedQty ?? 0) : line.qty;
              return (
                <tr key={line.id}>
                  <td className="py-1.5 text-ink">{line.itemName}</td>
                  <td className="py-1.5 text-right tabular-nums">{formatQty(max)}</td>
                  <td className="py-1.5 pl-2">
                    <input
                      aria-label={`Quantity of ${line.itemName}`}
                      type="number"
                      min={0}
                      max={max}
                      step="any"
                      value={quantities[line.id] ?? ""}
                      onChange={(event) => setQuantities({ ...quantities, [line.id]: event.target.value })}
                      className={cn(CONTROL, "h-7 w-full text-right tabular-nums")}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Dialog>

      <Dialog
        open={dialog === "delete"}
        title={`Delete ${record.number}?`}
        description={
          record.status === "SUBMITTED"
            ? "The customer's credit is reversed and the returned goods leave the warehouse again (they must still be in stock)."
            : "The quantities held by this pending return become returnable again."
        }
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

function ItemTable({ record }: { record: ReturnDetail }) {
  const market = record.kind === "MARKET";
  const headers = ["Item Code", "Item Name", "UoM", "Return Reason", "Quantity", "Actual Price", "Price", "VAT", "Total", ...(market ? ["Factory Rec.", "QC Passed"] : [])];
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[900px] text-sm">
        <thead className="bg-accent-soft text-xs text-ink">
          <tr className="border-b border-line">
            {headers.map((label, index) => (
              <th key={label} scope="col" className={cn("px-3 py-2 font-semibold", index >= 4 ? "text-right" : "text-left")}>
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {record.lines.map((line) => (
            <tr key={line.id}>
              <td className="px-3 py-2 whitespace-nowrap text-ink-muted">{line.itemCode}</td>
              <td className="px-3 py-2 text-ink">{line.itemName}</td>
              <td className="px-3 py-2 text-ink-muted">{line.uom ?? "—"}</td>
              <td className="px-3 py-2 text-ink-muted">{line.reason ?? "—"}</td>
              <td className="px-3 py-2 text-right tabular-nums">{formatQty(-line.qty)}</td>
              <td className="px-3 py-2 text-right tabular-nums">{line.rate.toFixed(2)}</td>
              <td className="px-3 py-2 text-right tabular-nums">{formatAmount(line.qty * line.rate)}</td>
              <td className="px-3 py-2 text-right tabular-nums">{formatAmount(line.vatAmount)}</td>
              <td className="px-3 py-2 text-right font-medium text-ink tabular-nums">{formatAmount(line.amount)}</td>
              {market && <td className="px-3 py-2 text-right tabular-nums">{line.receivedQty === null ? "—" : formatQty(line.receivedQty)}</td>}
              {market && <td className="px-3 py-2 text-right tabular-nums">{line.qcQty === null ? "—" : formatQty(line.qcQty)}</td>}
            </tr>
          ))}
        </tbody>
        <tfoot className="border-t border-line-strong bg-canvas font-medium text-ink">
          <tr>
            <td colSpan={4} className="px-3 py-2 text-right">
              Total
            </td>
            <td className="px-3 py-2 text-right tabular-nums">{formatQty(-record.totalQty)}</td>
            <td colSpan={2} />
            <td className="px-3 py-2 text-right tabular-nums">{formatAmount(record.vatAmount)}</td>
            <td className="px-3 py-2 text-right tabular-nums">{formatAmount(record.itemsTotal)}</td>
            {market && <td colSpan={2} />}
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function ApprovalStatus({ record }: { record: ReturnDetail }) {
  const steps: { label: string; by: string | null; at: string | null; note?: string | null }[] = [
    { label: "Created", by: record.createdBy, at: record.createdAt },
    { label: "Approved", by: record.approvedBy, at: record.approvedAt },
    ...(record.kind === "MARKET"
      ? [
          { label: "Factory Received", by: record.factoryReceivedBy, at: record.factoryReceivedAt },
          { label: "QC Done", by: record.qcBy, at: record.qcAt },
        ]
      : []),
    ...(record.deletedAt ? [{ label: "Deleted", by: record.deletedBy, at: record.deletedAt, note: record.deleteReason }] : []),
  ];
  return (
    <ol className="flex flex-col gap-3 p-4">
      {steps.map((step) => (
        <li key={step.label} className="flex items-start gap-3 text-sm">
          <span aria-hidden="true" className={cn("mt-1 size-2.5 shrink-0 rounded-full", step.at ? (step.label === "Deleted" ? "bg-danger" : "bg-success") : "bg-line-strong")} />
          <div>
            <p className="font-medium text-ink">{step.label}</p>
            <p className="text-ink-muted">{step.at ? `${step.by ?? "Unknown"} · ${formatDateTime(step.at)}` : "Waiting"}</p>
            {step.note && <p className="text-ink-muted">{step.note}</p>}
          </div>
        </li>
      ))}
    </ol>
  );
}

function DeliveryLink({ id, children }: { id: string; children: ReactNode }) {
  return (
    <Link href={paths.delivery(id)} className="text-ink underline underline-offset-2">
      {children}
    </Link>
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
