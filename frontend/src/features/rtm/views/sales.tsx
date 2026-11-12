"use client";

import { Plus, Truck, X } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Dialog } from "@/components/ui/dialog";
import { CONTROL, SelectField, TextField } from "@/components/ui/form-field";
import { Card, ErrorState, LoadingState } from "@/components/ui/section";
import { useToast } from "@/components/ui/toast";
import { useResource } from "@/hooks/use-resource";
import { errorMessage } from "@/lib/api/client";
import { cn } from "@/lib/cn";
import { collection, delivery, directDelivery, outletLedger, retailOrder, salesReturn } from "../navigation";
import { money, monthStart, qty, rtmApi, today, type Lookups } from "../services/rtm.api";
import { DateRange, FilterBar, FormDialog, Kpi, RtmPage, SimpleTable, StatusBadge, options, useAction, useLookups, type FieldDef } from "../components/kit";

interface DocLine {
  itemId: string;
  itemCode: string;
  itemName: string;
  uom: string;
  qty: number;
  rate: number;
  amount: number;
}

const outletOptions = (l: Lookups | undefined) => options(l?.outlets, (o) => `${o.code} · ${o.name}`, (o) => o.id, "Select outlet");
const srOptions = (l: Lookups | undefined) => options(l?.srs, (s) => `${s.code} · ${s.name}`, (s) => s.id, "None");
const linesText = (lines: DocLine[]) => lines.map((l) => `${l.itemName} × ${qty(l.qty)}`).join(", ");

/** Period + distributor filter shared by the sales lists. */
function usePeriod() {
  const [from, setFrom] = useState(monthStart());
  const [to, setTo] = useState(today());
  const [distributorId, setDistributorId] = useState("");
  return { from, to, distributorId, setRange: (f: string, t: string) => (setFrom(f), setTo(t)), setDistributorId, key: `${from}-${to}-${distributorId}` };
}

function PeriodFilter({ p, lookups }: { p: ReturnType<typeof usePeriod>; lookups: Lookups | undefined }) {
  return (
    <FilterBar>
      <DateRange from={p.from} to={p.to} onChange={p.setRange} />
      <SelectField label="Distributor" className="w-56" value={p.distributorId} onChange={(e) => p.setDistributorId(e.target.value)} options={options(lookups?.distributors, (d) => d.name, (d) => d.id, "All distributors")} />
    </FilterBar>
  );
}

// ── Retail orders ────────────────────────────────────────────────────────────

interface Order {
  id: string;
  number: string;
  orderDate: string;
  outlet: string;
  distributor: string;
  sr: string | null;
  status: string;
  subtotal: number;
  discount: number;
  total: number;
  offer: string | null;
  orderedQty: number;
  deliveredQty: number;
  deliveries: string[];
  lines: (DocLine & { lineId: string; deliveredQty: number; openQty: number })[];
  updatedAt: string;
}

const ORDER_LABELS = { PENDING: "Not delivered", APPROVED: "Partly delivered", COMPLETED: "Delivered" };

export function RetailOrderView() {
  const p = usePeriod();
  const lookups = useLookups();
  const list = useResource(`rtm-orders-${p.key}`, () => rtmApi.get<Order[]>("retail-order", { from: p.from, to: p.to, distributorId: p.distributorId }));
  const [open, setOpen] = useState(false);
  const { busy, run } = useAction(list.reload);
  const fields: FieldDef[] = [
    { name: "orderDate", label: "Order date", type: "date", required: true },
    { name: "outletId", label: "Outlet", type: "select", required: true, options: outletOptions(lookups.data) },
    { name: "srId", label: "Sales representative", type: "select", options: srOptions(lookups.data) },
    { name: "remarks", label: "Remarks", type: "textarea" },
  ];
  const columns: Column<Order>[] = [
    { id: "number", header: "Order", cell: (o) => <span className="font-mono">{o.number}</span>, sortValue: (o) => o.number },
    { id: "date", header: "Date", cell: (o) => o.orderDate, sortValue: (o) => o.orderDate },
    { id: "outlet", header: "Outlet", cell: (o) => o.outlet },
    { id: "distributor", header: "Distributor", cell: (o) => o.distributor, hideBelow: "md" },
    { id: "sr", header: "SR", cell: (o) => o.sr ?? "—", hideBelow: "lg" },
    { id: "items", header: "Items", cell: (o) => <span className="line-clamp-1 text-xs">{linesText(o.lines)}</span>, hideBelow: "lg" },
    { id: "discount", header: "Discount", cell: (o) => (o.discount ? <span title={o.offer ?? undefined}>{money(o.discount)}</span> : "—"), className: "text-right", hideBelow: "md" },
    { id: "total", header: "Total", cell: (o) => money(o.total), sortValue: (o) => o.total, className: "text-right" },
    { id: "delivered", header: "Delivered", cell: (o) => `${qty(o.deliveredQty)} / ${qty(o.orderedQty)}`, className: "text-right" },
    { id: "status", header: "Status", cell: (o) => <StatusBadge status={o.status} labels={ORDER_LABELS} /> },
    {
      id: "actions",
      header: "",
      cell: (o) =>
        o.status === "PENDING" && o.deliveredQty === 0 ? (
          <Button size="sm" variant="ghost" disabled={busy === o.id} onClick={() => run(o.id, () => rtmApi.post(`retail-order/${o.id}/cancel`), `${o.number} cancelled.`)}>
            <X /> Cancel
          </Button>
        ) : null,
    },
  ];
  return (
    <RtmPage page={retailOrder} actions={<Button variant="primary" onClick={() => setOpen(true)}><Plus /> New Order</Button>}>
      <PeriodFilter p={p} lookups={lookups.data} />
      {list.error ? <ErrorState message={list.error.message} onRetry={list.reload} /> : !list.data ? <LoadingState /> : (
        <Card>
          <DataTable rows={list.data} columns={columns} getRowId={(o) => o.id} getRowLabel={(o) => o.number} modifiedAt={(o) => o.updatedAt} search={{ placeholder: "Search order, outlet…", match: (o, q) => `${o.number} ${o.outlet} ${o.sr ?? ""}`.toLowerCase().includes(q) }} />
        </Card>
      )}
      <FormDialog
        open={open}
        title="New Retail Order"
        fields={fields}
        lines={{ items: lookups.data?.items ?? [], rate: true }}
        onClose={() => setOpen(false)}
        onSubmit={async (body) => {
          await rtmApi.post("retail-order", body);
          list.reload();
        }}
      />
    </RtmPage>
  );
}

// ── Delivery (against orders) ────────────────────────────────────────────────

interface Delivery {
  id: string;
  number: string;
  deliveryDate: string;
  order: string | null;
  outlet: string;
  distributor: string;
  sr: string | null;
  discount: number;
  total: number;
  lines: DocLine[];
  updatedAt: string;
}

const deliveryColumns: Column<Delivery>[] = [
  { id: "number", header: "Delivery", cell: (d) => <span className="font-mono">{d.number}</span>, sortValue: (d) => d.number },
  { id: "date", header: "Date", cell: (d) => d.deliveryDate, sortValue: (d) => d.deliveryDate },
  { id: "order", header: "Order", cell: (d) => d.order ?? "Direct", hideBelow: "md" },
  { id: "outlet", header: "Outlet", cell: (d) => d.outlet },
  { id: "distributor", header: "Distributor", cell: (d) => d.distributor, hideBelow: "md" },
  { id: "items", header: "Items", cell: (d) => <span className="line-clamp-1 text-xs">{linesText(d.lines)}</span>, hideBelow: "lg" },
  { id: "discount", header: "Discount", cell: (d) => (d.discount ? money(d.discount) : "—"), className: "text-right", hideBelow: "md" },
  { id: "total", header: "Total", cell: (d) => money(d.total), sortValue: (d) => d.total, className: "text-right" },
];

export function DeliveryView() {
  const p = usePeriod();
  const lookups = useLookups();
  const open = useResource(`rtm-open-orders-${p.distributorId}`, async () => {
    const [pending, partial] = await Promise.all([
      rtmApi.get<Order[]>("retail-order", { status: "PENDING", distributorId: p.distributorId }),
      rtmApi.get<Order[]>("retail-order", { status: "APPROVED", distributorId: p.distributorId }),
    ]);
    return [...pending, ...partial].sort((a, b) => a.orderDate.localeCompare(b.orderDate));
  });
  const list = useResource(`rtm-deliveries-${p.key}`, () => rtmApi.get<Delivery[]>("delivery", { from: p.from, to: p.to, distributorId: p.distributorId }));
  const [target, setTarget] = useState<Order | null>(null);
  const reload = () => {
    open.reload();
    list.reload();
  };
  return (
    <RtmPage page={delivery}>
      <PeriodFilter p={p} lookups={lookups.data} />
      <SimpleTable
        title="Orders to deliver"
        rows={open.data ?? []}
        empty={open.loading ? "Loading…" : "No orders waiting for delivery."}
        columns={[
          { header: "Order", cell: (o) => <span className="font-mono">{o.number}</span> },
          { header: "Date", cell: (o) => o.orderDate },
          { header: "Outlet", cell: (o) => o.outlet },
          { header: "Distributor", cell: (o) => o.distributor },
          { header: "Open qty", cell: (o) => qty(o.orderedQty - o.deliveredQty), align: "right" },
          { header: "Total", cell: (o) => money(o.total), align: "right" },
          { header: "", cell: (o) => <Button size="sm" variant="primary" onClick={() => setTarget(o)}><Truck /> Deliver</Button> },
        ]}
      />
      {list.error ? <ErrorState message={list.error.message} onRetry={list.reload} /> : !list.data ? <LoadingState /> : (
        <Card>
          <DataTable rows={list.data} columns={deliveryColumns} getRowId={(d) => d.id} getRowLabel={(d) => d.number} modifiedAt={(d) => d.updatedAt} search={{ placeholder: "Search delivery, outlet…", match: (d, q) => `${d.number} ${d.outlet} ${d.order ?? ""}`.toLowerCase().includes(q) }} />
        </Card>
      )}
      {target && <DeliverDialog order={target} onClose={() => setTarget(null)} onDone={reload} />}
    </RtmPage>
  );
}

function DeliverDialog({ order, onClose, onDone }: { order: Order; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [date, setDate] = useState(today());
  const [qtys, setQtys] = useState<Record<string, string>>(Object.fromEntries(order.lines.map((l) => [l.lineId, String(l.openQty)])));
  const [saving, setSaving] = useState(false);
  const submit = async () => {
    setSaving(true);
    try {
      await rtmApi.post("delivery", { orderId: order.id, deliveryDate: date, lines: order.lines.map((l) => ({ lineId: l.lineId, qty: Number(qtys[l.lineId]) || 0 })) });
      toast.success(`${order.number} delivered. Stock left the distributor.`);
      onDone();
      onClose();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSaving(false);
    }
  };
  return (
    <Dialog
      open
      size="lg"
      title={`Deliver ${order.number}`}
      description={`${order.outlet} · ${order.distributor}`}
      onClose={onClose}
      onSubmit={submit}
      footer={
        <>
          <Button onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="submit" variant="primary" loading={saving}>Deliver</Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <TextField label="Delivery date" type="date" value={date} min={order.orderDate} onChange={(e) => setDate(e.target.value)} className="max-w-48" />
        <table className="w-full text-sm">
          <thead className="text-xs text-ink-muted">
            <tr>
              <th className="py-1 text-left font-semibold">Item</th>
              <th className="py-1 text-right font-semibold">Ordered</th>
              <th className="py-1 text-right font-semibold">Open</th>
              <th className="w-32 py-1 text-right font-semibold">Deliver</th>
            </tr>
          </thead>
          <tbody>
            {order.lines.map((l) => (
              <tr key={l.lineId} className="border-t border-line">
                <td className="py-1.5">{l.itemName}</td>
                <td className="py-1.5 text-right tabular-nums">{qty(l.qty)}</td>
                <td className="py-1.5 text-right tabular-nums">{qty(l.openQty)}</td>
                <td className="py-1.5">
                  <input aria-label={`Deliver ${l.itemName}`} type="number" min={0} max={l.openQty} step="any" value={qtys[l.lineId]} onChange={(e) => setQtys({ ...qtys, [l.lineId]: e.target.value })} className={cn(CONTROL, "h-8 text-right")} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Dialog>
  );
}

// ── Direct delivery ──────────────────────────────────────────────────────────

export function DirectDeliveryView() {
  const p = usePeriod();
  const lookups = useLookups();
  const list = useResource(`rtm-direct-${p.key}`, () => rtmApi.get<Delivery[]>("direct-delivery", { from: p.from, to: p.to, distributorId: p.distributorId }));
  const [open, setOpen] = useState(false);
  const fields: FieldDef[] = [
    { name: "deliveryDate", label: "Delivery date", type: "date", required: true },
    { name: "outletId", label: "Outlet", type: "select", required: true, options: outletOptions(lookups.data) },
    { name: "srId", label: "Sales representative", type: "select", options: srOptions(lookups.data) },
    { name: "discount", label: "Discount", type: "number" },
    { name: "remarks", label: "Remarks", type: "textarea", wide: true },
  ];
  return (
    <RtmPage page={directDelivery} actions={<Button variant="primary" onClick={() => setOpen(true)}><Plus /> New Direct Delivery</Button>}>
      <PeriodFilter p={p} lookups={lookups.data} />
      {list.error ? <ErrorState message={list.error.message} onRetry={list.reload} /> : !list.data ? <LoadingState /> : (
        <Card>
          <DataTable rows={list.data} columns={deliveryColumns.filter((c) => c.id !== "order")} getRowId={(d) => d.id} getRowLabel={(d) => d.number} modifiedAt={(d) => d.updatedAt} search={{ placeholder: "Search delivery, outlet…", match: (d, q) => `${d.number} ${d.outlet}`.toLowerCase().includes(q) }} />
        </Card>
      )}
      <FormDialog
        open={open}
        title="New Direct Delivery"
        fields={fields}
        lines={{ items: lookups.data?.items ?? [], rate: true }}
        onClose={() => setOpen(false)}
        onSubmit={async (body) => {
          await rtmApi.post("direct-delivery", body);
          list.reload();
        }}
      />
    </RtmPage>
  );
}

// ── Collection ───────────────────────────────────────────────────────────────

interface CollectionRow {
  id: string;
  number: string;
  collectionDate: string;
  outlet: string;
  distributor: string;
  sr: string | null;
  amount: number;
  method: string;
  reference: string | null;
  updatedAt: string;
}

const METHODS = [
  { value: "CASH", label: "Cash" },
  { value: "BANK", label: "Bank" },
  { value: "MFS", label: "Mobile money (bKash / Nagad)" },
  { value: "CHEQUE", label: "Cheque" },
];

export function CollectionView() {
  const p = usePeriod();
  const lookups = useLookups();
  const list = useResource(`rtm-collections-${p.key}`, () => rtmApi.get<CollectionRow[]>("collection", { from: p.from, to: p.to, distributorId: p.distributorId }));
  const [open, setOpen] = useState(false);
  const fields: FieldDef[] = [
    { name: "collectionDate", label: "Date", type: "date", required: true },
    { name: "outletId", label: "Outlet", type: "select", required: true, options: outletOptions(lookups.data) },
    { name: "amount", label: "Amount", type: "number", required: true },
    { name: "method", label: "Method", type: "select", options: METHODS },
    { name: "reference", label: "Reference / money receipt" },
    { name: "srId", label: "Collected by (SR)", type: "select", options: srOptions(lookups.data) },
    { name: "remarks", label: "Remarks", type: "textarea", wide: true },
  ];
  const columns: Column<CollectionRow>[] = [
    { id: "number", header: "Receipt", cell: (c) => <span className="font-mono">{c.number}</span>, sortValue: (c) => c.number },
    { id: "date", header: "Date", cell: (c) => c.collectionDate, sortValue: (c) => c.collectionDate },
    { id: "outlet", header: "Outlet", cell: (c) => c.outlet },
    { id: "distributor", header: "Distributor", cell: (c) => c.distributor, hideBelow: "md" },
    { id: "sr", header: "SR", cell: (c) => c.sr ?? "—", hideBelow: "lg" },
    { id: "method", header: "Method", cell: (c) => <Badge>{METHODS.find((m) => m.value === c.method)?.label ?? c.method}</Badge> },
    { id: "reference", header: "Reference", cell: (c) => c.reference ?? "—", hideBelow: "lg" },
    { id: "amount", header: "Amount", cell: (c) => money(c.amount), sortValue: (c) => c.amount, className: "text-right" },
  ];
  return (
    <RtmPage page={collection} actions={<Button variant="primary" onClick={() => setOpen(true)}><Plus /> New Collection</Button>}>
      <PeriodFilter p={p} lookups={lookups.data} />
      {list.error ? <ErrorState message={list.error.message} onRetry={list.reload} /> : !list.data ? <LoadingState /> : (
        <Card>
          <DataTable rows={list.data} columns={columns} getRowId={(c) => c.id} getRowLabel={(c) => c.number} modifiedAt={(c) => c.updatedAt} search={{ placeholder: "Search receipt, outlet…", match: (c, q) => `${c.number} ${c.outlet} ${c.reference ?? ""}`.toLowerCase().includes(q) }} footer={(rows) => ({ amount: money(rows.reduce((t, r) => t + r.amount, 0)) })} />
        </Card>
      )}
      <FormDialog open={open} title="New Collection" fields={fields} initial={{ method: "CASH" }} onClose={() => setOpen(false)} onSubmit={async (body) => { await rtmApi.post("collection", body); list.reload(); }} />
    </RtmPage>
  );
}

// ── Sales return ─────────────────────────────────────────────────────────────

interface ReturnRow {
  id: string;
  number: string;
  returnDate: string;
  outlet: string;
  distributor: string;
  delivery: string | null;
  reason: string | null;
  total: number;
  lines: DocLine[];
  updatedAt: string;
}

export function SalesReturnView() {
  const p = usePeriod();
  const lookups = useLookups();
  const list = useResource(`rtm-returns-${p.key}`, () => rtmApi.get<ReturnRow[]>("sales-return", { from: p.from, to: p.to, distributorId: p.distributorId }));
  const [open, setOpen] = useState(false);
  const fields: FieldDef[] = [
    { name: "returnDate", label: "Return date", type: "date", required: true },
    { name: "outletId", label: "Outlet", type: "select", required: true, options: outletOptions(lookups.data) },
    { name: "reason", label: "Reason", type: "select", options: ["Damaged", "Expired", "Near expiry", "Wrong item", "Not sold", "Other"].map((r) => ({ value: r, label: r })) },
  ];
  const columns: Column<ReturnRow>[] = [
    { id: "number", header: "Return", cell: (r) => <span className="font-mono">{r.number}</span>, sortValue: (r) => r.number },
    { id: "date", header: "Date", cell: (r) => r.returnDate, sortValue: (r) => r.returnDate },
    { id: "outlet", header: "Outlet", cell: (r) => r.outlet },
    { id: "distributor", header: "Distributor", cell: (r) => r.distributor, hideBelow: "md" },
    { id: "reason", header: "Reason", cell: (r) => r.reason ?? "—" },
    { id: "items", header: "Items", cell: (r) => <span className="line-clamp-1 text-xs">{linesText(r.lines)}</span>, hideBelow: "lg" },
    { id: "total", header: "Value", cell: (r) => money(r.total), sortValue: (r) => r.total, className: "text-right" },
  ];
  return (
    <RtmPage page={salesReturn} actions={<Button variant="primary" onClick={() => setOpen(true)}><Plus /> New Return</Button>}>
      <PeriodFilter p={p} lookups={lookups.data} />
      {list.error ? <ErrorState message={list.error.message} onRetry={list.reload} /> : !list.data ? <LoadingState /> : (
        <Card>
          <DataTable rows={list.data} columns={columns} getRowId={(r) => r.id} getRowLabel={(r) => r.number} modifiedAt={(r) => r.updatedAt} search={{ placeholder: "Search return, outlet…", match: (r, q) => `${r.number} ${r.outlet}`.toLowerCase().includes(q) }} />
        </Card>
      )}
      <FormDialog
        open={open}
        title="New Sales Return"
        fields={fields}
        initial={{ reason: "Damaged" }}
        lines={{ items: lookups.data?.items ?? [], rate: true }}
        onClose={() => setOpen(false)}
        onSubmit={async (body) => {
          await rtmApi.post("sales-return", body);
          list.reload();
        }}
      />
    </RtmPage>
  );
}

// ── Outlet ledger ────────────────────────────────────────────────────────────

interface Ledger {
  outlet: { id: string; code: string; name: string };
  opening: number;
  closing: number;
  rows: { date: string; number: string; particulars: string; debit: number; credit: number; balance: number }[];
}

export function OutletLedgerView() {
  const lookups = useLookups();
  const [outletId, setOutletId] = useState("");
  const [from, setFrom] = useState(monthStart());
  const [to, setTo] = useState(today());
  const ledger = useResource(outletId ? `rtm-ledger-${outletId}-${from}-${to}` : null, () => rtmApi.get<Ledger>("outlet-ledger", { outletId, from, to }));
  return (
    <RtmPage page={outletLedger}>
      <FilterBar>
        <SelectField label="Outlet" className="w-72" value={outletId} onChange={(e) => setOutletId(e.target.value)} options={outletOptions(lookups.data)} />
        <DateRange from={from} to={to} onChange={(f, t) => (setFrom(f), setTo(t))} />
      </FilterBar>
      {!outletId ? (
        <p className="text-sm text-ink-faint">Choose an outlet to see its ledger.</p>
      ) : ledger.error ? (
        <ErrorState message={ledger.error.message} onRetry={ledger.reload} />
      ) : !ledger.data ? (
        <LoadingState />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Kpi label="Opening balance" value={money(ledger.data.opening)} />
            <Kpi label="Delivered" value={money(ledger.data.rows.reduce((t, r) => t + r.debit, 0))} />
            <Kpi label="Collected & returned" value={money(ledger.data.rows.reduce((t, r) => t + r.credit, 0))} />
            <Kpi label="Closing balance (due)" value={money(ledger.data.closing)} tone={ledger.data.closing > 0 ? "warning" : "success"} />
          </div>
          <SimpleTable
            title={`${ledger.data.outlet.code} · ${ledger.data.outlet.name}`}
            rows={ledger.data.rows}
            empty="No transactions in this period."
            columns={[
              { header: "Date", cell: (r) => r.date },
              { header: "Document", cell: (r) => <span className="font-mono">{r.number}</span> },
              { header: "Particulars", cell: (r) => r.particulars },
              { header: "Debit", cell: (r) => (r.debit ? money(r.debit) : ""), align: "right" },
              { header: "Credit", cell: (r) => (r.credit ? money(r.credit) : ""), align: "right" },
              { header: "Balance", cell: (r) => money(r.balance), align: "right" },
            ]}
          />
        </>
      )}
    </RtmPage>
  );
}
