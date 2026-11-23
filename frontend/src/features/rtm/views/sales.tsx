"use client";

import { Eye, FileSpreadsheet, Plus, Truck, Wallet, X } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/ui/data-table";
import type { MenuItem } from "@/components/ui/dropdown-menu";
import { Dialog } from "@/components/ui/dialog";
import { CONTROL, SelectField, TextField } from "@/components/ui/form-field";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/section";
import { useToast } from "@/components/ui/toast";
import { useResource } from "@/hooks/use-resource";
import { errorMessage } from "@/lib/api/client";
import { cn } from "@/lib/cn";
import { useFeaturePermissions } from "@/lib/permissions/useFeaturePermissions";
import { collection, delivery, directDelivery, outletLedger, retailOrder, salesReturn } from "../navigation";
import { money, monthStart, qty, rtmApi, today, type Lookups } from "../services/rtm.api";
import { DateRange, FilterBar, FormDialog, Kpi, RtmPage, SimpleTable, StatusBadge, options, useAction, useLookups, type FieldDef } from "../components/kit";
import { EMPTY_TERRITORY, ListCard, RowAction, TerritoryFields, ViewButton, nodeOf, searchOutlets, useListExport, useTerritory, useViewFilters, type ExportFile } from "../components/sales-filters";
import { rtmPaths } from "../paths";

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

// ── Retail orders ────────────────────────────────────────────────────────────

interface OutletRef {
  outletCode: string;
  outletName: string;
  outletPhone: string | null;
}

interface Order extends OutletRef {
  id: string;
  number: string;
  orderDate: string;
  outlet: string;
  distributor: string;
  srId: string | null;
  sr: string | null;
  srCode: string | null;
  status: string;
  subtotal: number;
  discount: number;
  total: number;
  offer: string | null;
  orderedQty: number;
  deliveredQty: number;
  deliveries: string[];
  remarks: string | null;
  lines: (DocLine & { lineId: string; deliveredQty: number; openQty: number })[];
  updatedAt: string;
}

const ORDER_LABELS = { PENDING: "Not delivered", APPROVED: "Partly delivered", COMPLETED: "Delivered" };

const slColumn = <T,>(): Column<T> => ({ id: "sl", header: "SL", cell: (_r, i) => i + 1, className: "w-12 text-right tabular-nums" });
const actionColumn = <T,>(cell: (row: T) => ReactNode, header = "Action"): Column<T> => ({ id: "action", header, cell: (r) => <div className="flex items-center gap-0.5">{cell(r)}</div>, className: "w-24" });
const outletColumn = <T extends OutletRef>(header: string): Column<T> => ({
  id: "outlet",
  header,
  cell: (r) => (
    <span className="flex flex-col">
      <span className="font-semibold text-ink">{r.outletName}</span>
      <span className="font-mono text-[11px] text-ink-faint">{r.outletCode}</span>
    </span>
  ),
  sortValue: (r) => r.outletName,
});
const mobileColumn = <T extends OutletRef>(): Column<T> => ({
  id: "mobile",
  header: "Mobile",
  cell: (r) => (r.outletPhone ? <a href={`tel:${r.outletPhone}`} className="tabular-nums hover:underline">{r.outletPhone}</a> : "—"),
});
const srText = (r: { sr: string | null; srCode: string | null }) => (r.sr ? `${r.srCode ? `${r.srCode} · ` : ""}${r.sr}` : "");

export function RetailOrderView() {
  const lookups = useLookups();
  const territory = useTerritory();
  const can = useFeaturePermissions(rtmPaths.retailOrder);
  const canDeliver = useFeaturePermissions(rtmPaths.delivery).create;
  const f = useViewFilters({ ...EMPTY_TERRITORY, date: today() });
  const a = f.applied;
  const list = useResource(`rtm-orders-${f.key}`, () => rtmApi.get<Order[]>("retail-order", { from: a.date, to: a.date, nodeId: nodeOf(a), srId: a.srId }));
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [viewing, setViewing] = useState<Order | null>(null);
  const [delivering, setDelivering] = useState<Order | null>(null);
  const { busy, run } = useAction(list.reload);
  const rows = searchOutlets(list.data, query);
  const fields: FieldDef[] = [
    { name: "orderDate", label: "Order date", type: "date", required: true },
    { name: "outletId", label: "Outlet", type: "select", required: true, options: outletOptions(lookups.data) },
    { name: "srId", label: "Sales representative", type: "select", options: srOptions(lookups.data) },
    { name: "remarks", label: "Remarks", type: "textarea" },
  ];
  const columns: Column<Order>[] = [
    slColumn(),
    actionColumn((o) => (
      <>
        <RowAction label={`View ${o.number}`} icon={<Eye />} onClick={() => setViewing(o)} />
        {canDeliver && (o.status === "PENDING" || o.status === "APPROVED") && <RowAction label={`Deliver ${o.number}`} icon={<Truck />} onClick={() => setDelivering(o)} />}
        {can.edit && o.status === "PENDING" && o.deliveredQty === 0 && (
          <RowAction label={`Cancel ${o.number}`} tone="danger" icon={<X />} loading={busy === o.id} onClick={() => run(o.id, () => rtmApi.post(`retail-order/${o.id}/cancel`), `${o.number} cancelled.`)} />
        )}
      </>
    )),
    outletColumn("Outlet Name"),
    { id: "sr", header: "Sales Force", cell: (o) => srText(o) || "—", sortValue: (o) => o.sr ?? "" },
    mobileColumn(),
    { id: "date", header: "Date", cell: (o) => o.orderDate, sortValue: (o) => o.orderDate, className: "whitespace-nowrap" },
    { id: "qty", header: "Item Qty", cell: (o) => qty(o.orderedQty), sortValue: (o) => o.orderedQty, className: "text-right tabular-nums" },
    { id: "status", header: "Status", cell: (o) => <StatusBadge status={o.status} labels={ORDER_LABELS} /> },
  ];
  return (
    <RtmPage page={retailOrder} actions={can.create && <Button variant="primary" onClick={() => setCreating(true)}><Plus /> New Order</Button>}>
      <FilterBar>
        <TerritoryFields value={f.draft} onChange={f.set} territory={territory.data} />
        <TextField label="Date" type="date" className="w-40" value={f.draft.date} onChange={(e) => f.set({ date: e.target.value })} />
        <ViewButton loading={list.loading} onClick={() => f.view(list.reload)} />
      </FilterBar>
      {list.error ? <ErrorState message={list.error.message} onRetry={list.reload} /> : !list.data ? <LoadingState /> : (
        <ListCard
          title="Retail Orders"
          rows={rows}
          query={query}
          onQuery={setQuery}
          exportPage="retail-order"
          canExport={can.export}
          exportFile={{
            title: `Retail Orders ${a.date}`,
            headers: ["SL", "Order", "Outlet Code", "Outlet Name", "Sales Force", "Mobile", "Date", "Item Qty", "Total", "Status"],
            row: (o, i) => [i + 1, o.number, o.outletCode, o.outletName, srText(o) || null, o.outletPhone, o.orderDate, o.orderedQty, o.total, ORDER_LABELS[o.status as keyof typeof ORDER_LABELS] ?? o.status],
          }}
        >
          <DataTable sheet rows={rows} columns={columns} getRowId={(o) => o.id} getRowLabel={(o) => o.number} emptyState={<EmptyState title="No retail orders">Nothing was ordered for these filters.</EmptyState>} footer={(r) => ({ qty: qty(r.reduce((t, o) => t + o.orderedQty, 0)) })} />
        </ListCard>
      )}
      <FormDialog
        open={creating}
        title="New Retail Order"
        fields={fields}
        initial={{ orderDate: a.date, srId: a.srId }}
        lines={{ items: lookups.data?.items ?? [], rate: true }}
        onClose={() => setCreating(false)}
        onSubmit={async (body) => {
          await rtmApi.post("retail-order", body);
          list.reload();
        }}
      />
      {viewing && <OrderDetail order={viewing} onClose={() => setViewing(null)} />}
      {delivering && <DeliverDialog order={delivering} onClose={() => setDelivering(null)} onDone={list.reload} />}
    </RtmPage>
  );
}

function DetailHead({ items }: { items: [string, ReactNode][] }) {
  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-[13px] sm:grid-cols-3">
      {items.map(([label, value]) => (
        <div key={label} className="flex flex-col">
          <dt className="text-xs font-medium text-ink-muted">{label}</dt>
          <dd className="text-ink">{value || "—"}</dd>
        </div>
      ))}
    </dl>
  );
}

function LinesTable({ lines, delivered }: { lines: (DocLine & { deliveredQty?: number })[]; delivered?: boolean }) {
  return (
    <div className="overflow-x-auto rounded border border-line">
      <table className="w-full text-[13px]">
        <thead className="bg-canvas text-xs text-ink-muted">
          <tr>
            <th className="px-2.5 py-2 text-left font-semibold">Item</th>
            <th className="px-2.5 py-2 text-right font-semibold">Qty</th>
            {delivered && <th className="px-2.5 py-2 text-right font-semibold">Delivered</th>}
            <th className="px-2.5 py-2 text-right font-semibold">Rate</th>
            <th className="px-2.5 py-2 text-right font-semibold">Amount</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((l, i) => (
            <tr key={i} className="border-t border-line">
              <td className="px-2.5 py-1.5">
                {l.itemName} <span className="font-mono text-[11px] text-ink-faint">{l.itemCode}</span>
              </td>
              <td className="px-2.5 py-1.5 text-right tabular-nums">{qty(l.qty)} {l.uom}</td>
              {delivered && <td className="px-2.5 py-1.5 text-right tabular-nums">{qty(l.deliveredQty)}</td>}
              <td className="px-2.5 py-1.5 text-right tabular-nums">{money(l.rate)}</td>
              <td className="px-2.5 py-1.5 text-right tabular-nums">{money(l.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Totals({ subtotal, discount, total }: { subtotal: number; discount: number; total: number }) {
  return (
    <dl className="ml-auto grid w-full max-w-64 grid-cols-2 gap-y-1 text-[13px]">
      <dt className="text-ink-muted">Subtotal</dt>
      <dd className="text-right tabular-nums">{money(subtotal)}</dd>
      <dt className="text-ink-muted">Discount</dt>
      <dd className="text-right tabular-nums">{money(discount)}</dd>
      <dt className="font-semibold text-ink">Total</dt>
      <dd className="text-right font-semibold tabular-nums">{money(total)}</dd>
    </dl>
  );
}

function OrderDetail({ order: o, onClose }: { order: Order; onClose: () => void }) {
  return (
    <Dialog open size="xl" title={`Retail Order ${o.number}`} description={`${o.outletCode} · ${o.outletName}`} onClose={onClose} footer={<Button onClick={onClose}>Close</Button>}>
      <div className="flex flex-col gap-4">
        <DetailHead
          items={[
            ["Date", o.orderDate],
            ["Status", <StatusBadge key="s" status={o.status} labels={ORDER_LABELS} />],
            ["Sales force", srText(o)],
            ["Mobile", o.outletPhone],
            ["Distributor", o.distributor],
            ["Deliveries", o.deliveries.join(", ")],
            ["Offer", o.offer],
            ["Remarks", o.remarks],
          ]}
        />
        <LinesTable lines={o.lines} delivered />
        <Totals subtotal={o.subtotal} discount={o.discount} total={o.total} />
      </div>
    </Dialog>
  );
}

// ── Delivery ─────────────────────────────────────────────────────────────────

interface Delivery extends OutletRef {
  id: string;
  number: string;
  deliveryDate: string;
  order: string | null;
  outlet: string;
  distributor: string;
  srId: string | null;
  sr: string | null;
  srCode: string | null;
  isDirect: boolean;
  status: string;
  subtotal: number;
  discount: number;
  total: number;
  remarks: string | null;
  lines: DocLine[];
  updatedAt: string;
}

const DELIVERY_LABELS = { COMPLETED: "Delivered" };
const DELIVERY_TYPES = [
  { value: "", label: "All types" },
  { value: "ORDER", label: "Against order" },
  { value: "DIRECT", label: "Direct delivery" },
];

export function DeliveryView() {
  const lookups = useLookups();
  const territory = useTerritory();
  const can = useFeaturePermissions(rtmPaths.delivery);
  const f = useViewFilters({ deliveryType: "", ...EMPTY_TERRITORY, distributorId: "", from: today(), to: today() });
  const a = f.applied;
  const list = useResource(`rtm-deliveries-${f.key}`, () =>
    rtmApi.get<Delivery[]>("delivery", { deliveryType: a.deliveryType, nodeId: nodeOf(a), srId: a.srId, distributorId: a.distributorId, from: a.from, to: a.to }),
  );
  const [query, setQuery] = useState("");
  const [viewing, setViewing] = useState<Delivery | null>(null);
  const rows = searchOutlets(list.data, query);
  const columns: Column<Delivery>[] = [
    slColumn(),
    actionColumn((d) => <RowAction label={`View ${d.number}`} icon={<Eye />} onClick={() => setViewing(d)} />),
    outletColumn("Outlet"),
    { id: "sr", header: "Sales Force", cell: (d) => srText(d) || "—", sortValue: (d) => d.sr ?? "" },
    mobileColumn(),
    { id: "date", header: "Date", cell: (d) => d.deliveryDate, sortValue: (d) => d.deliveryDate, className: "whitespace-nowrap" },
    { id: "status", header: "Status", cell: (d) => <StatusBadge status={d.status} labels={DELIVERY_LABELS} /> },
  ];
  return (
    <RtmPage page={delivery}>
      <FilterBar>
        <SelectField label="Delivery Type" className="w-40" value={f.draft.deliveryType} onChange={(e) => f.set({ deliveryType: e.target.value })} options={DELIVERY_TYPES} />
        <TerritoryFields value={f.draft} onChange={f.set} territory={territory.data} />
        <SelectField label="Delivery By" className="w-56" value={f.draft.distributorId} onChange={(e) => f.set({ distributorId: e.target.value })} options={options(lookups.data?.distributors, (d) => d.name, (d) => d.id, "All distributors")} />
        <DateRange from={f.draft.from} to={f.draft.to} onChange={(from, to) => f.set({ from, to })} />
        <ViewButton loading={list.loading} onClick={() => f.view(list.reload)} />
      </FilterBar>
      {list.error ? <ErrorState message={list.error.message} onRetry={list.reload} /> : !list.data ? <LoadingState /> : (
        <ListCard
          title="Deliveries"
          rows={rows}
          query={query}
          onQuery={setQuery}
          exportPage="delivery"
          canExport={can.export}
          exportFile={{
            title: `Deliveries ${a.from} to ${a.to}`,
            headers: ["SL", "Delivery", "Type", "Order", "Outlet Code", "Outlet", "Sales Force", "Mobile", "Date", "Delivery By", "Total", "Status"],
            row: (d, i) => [i + 1, d.number, d.isDirect ? "Direct" : "Against order", d.order, d.outletCode, d.outletName, srText(d) || null, d.outletPhone, d.deliveryDate, d.distributor, d.total, d.status === "COMPLETED" ? "Delivered" : d.status],
          }}
        >
          <DataTable sheet rows={rows} columns={columns} getRowId={(d) => d.id} getRowLabel={(d) => d.number} emptyState={<EmptyState title="No deliveries">Nothing was delivered for these filters.</EmptyState>} />
        </ListCard>
      )}
      {viewing && <DeliveryDetail delivery={viewing} onClose={() => setViewing(null)} />}
    </RtmPage>
  );
}

function DeliveryDetail({ delivery: d, onClose }: { delivery: Delivery; onClose: () => void }) {
  return (
    <Dialog open size="xl" title={`Delivery ${d.number}`} description={`${d.outletCode} · ${d.outletName}`} onClose={onClose} footer={<Button onClick={onClose}>Close</Button>}>
      <div className="flex flex-col gap-4">
        <DetailHead
          items={[
            ["Date", d.deliveryDate],
            ["Status", <StatusBadge key="s" status={d.status} labels={DELIVERY_LABELS} />],
            ["Type", d.isDirect ? "Direct delivery" : `Against order ${d.order ?? ""}`],
            ["Sales force", srText(d)],
            ["Mobile", d.outletPhone],
            ["Delivery by", d.distributor],
            ["Remarks", d.remarks],
          ]}
        />
        <LinesTable lines={d.lines} />
        <Totals subtotal={d.subtotal} discount={d.discount} total={d.total} />
      </div>
    </Dialog>
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

/** Excel of the rows ticked in a list (the list's bulk action). */
function selectedExcel<T>(download: (rows: readonly T[]) => Promise<void>) {
  return (selected: T[], clear: () => void): MenuItem[] => [
    {
      label: `Excel (${selected.length} selected)`,
      icon: <FileSpreadsheet className="size-4" />,
      onSelect: () => void download(selected).then(clear),
    },
  ];
}

export function DirectDeliveryView() {
  const lookups = useLookups();
  const territory = useTerritory();
  const can = useFeaturePermissions(rtmPaths.directDelivery);
  const f = useViewFilters({ ...EMPTY_TERRITORY, distributorId: "", date: today() });
  const a = f.applied;
  const list = useResource(`rtm-direct-${f.key}`, () => rtmApi.get<Delivery[]>("direct-delivery", { nodeId: nodeOf(a), srId: a.srId, distributorId: a.distributorId, from: a.date, to: a.date }));
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [viewing, setViewing] = useState<Delivery | null>(null);
  const rows = searchOutlets(list.data, query);
  const file: ExportFile<Delivery> = {
    title: `Direct Deliveries ${a.date}`,
    headers: ["SL", "Delivery", "Outlet Code", "Outlet", "Sales Force", "Mobile", "Date", "Delivered By", "Total", "Status"],
    row: (d, i) => [i + 1, d.number, d.outletCode, d.outletName, srText(d) || null, d.outletPhone, d.deliveryDate, d.distributor, d.total, d.status === "COMPLETED" ? "Delivered" : d.status],
  };
  const selected = useListExport("direct-delivery", file);
  const fields: FieldDef[] = [
    { name: "deliveryDate", label: "Delivery date", type: "date", required: true },
    { name: "outletId", label: "Outlet", type: "select", required: true, options: outletOptions(lookups.data) },
    { name: "srId", label: "Sales representative", type: "select", options: srOptions(lookups.data) },
    { name: "discount", label: "Discount", type: "number" },
    { name: "remarks", label: "Remarks", type: "textarea", wide: true },
  ];
  const columns: Column<Delivery>[] = [
    slColumn(),
    outletColumn("Outlet"),
    { id: "sr", header: "Sales Force", cell: (d) => srText(d) || "—" },
    mobileColumn(),
    { id: "date", header: "Date", cell: (d) => d.deliveryDate, className: "whitespace-nowrap" },
    { id: "status", header: "Status", cell: (d) => <StatusBadge status={d.status} labels={DELIVERY_LABELS} /> },
    actionColumn((d) => <RowAction label={`View ${d.number}`} icon={<Eye />} onClick={() => setViewing(d)} />, "Actions"),
  ];
  return (
    <RtmPage page={directDelivery} actions={can.create && <Button variant="primary" onClick={() => setCreating(true)}><Plus /> New Direct Delivery</Button>}>
      <FilterBar>
        <TerritoryFields value={f.draft} onChange={f.set} territory={territory.data} />
        <SelectField label="Delivered By" className="w-56" value={f.draft.distributorId} onChange={(e) => f.set({ distributorId: e.target.value })} options={options(lookups.data?.distributors, (d) => d.name, (d) => d.id, "All distributors")} />
        <TextField label="Date" type="date" className="w-40" value={f.draft.date} onChange={(e) => f.set({ date: e.target.value })} />
        <ViewButton loading={list.loading} onClick={() => f.view(list.reload)} />
      </FilterBar>
      {list.error ? <ErrorState message={list.error.message} onRetry={list.reload} /> : !list.data ? <LoadingState /> : (
        <ListCard title="Direct Deliveries" rows={rows} query={query} onQuery={setQuery} exportPage="direct-delivery" canExport={can.export} exportFile={file}>
          <DataTable
            rows={rows}
            columns={columns}
            getRowId={(d) => d.id}
            getRowLabel={(d) => `${d.number} ${d.outletName}`}
            bulkActions={can.export ? selectedExcel(selected.download) : undefined}
            emptyState={<EmptyState title="No direct deliveries">Nothing was delivered for these filters.</EmptyState>}
          />
        </ListCard>
      )}
      <FormDialog
        open={creating}
        title="New Direct Delivery"
        fields={fields}
        initial={{ deliveryDate: a.date, srId: a.srId }}
        lines={{ items: lookups.data?.items ?? [], rate: true }}
        onClose={() => setCreating(false)}
        onSubmit={async (body) => {
          await rtmApi.post("direct-delivery", body);
          list.reload();
        }}
      />
      {viewing && <DeliveryDetail delivery={viewing} onClose={() => setViewing(null)} />}
    </RtmPage>
  );
}

// ── Collection ───────────────────────────────────────────────────────────────

/** One outlet on one day (GET /api/rtm/collection/summary). */
interface CollectionDay extends OutletRef {
  outletId: string;
  distributor: string;
  date: string;
  srId: string | null;
  sr: string | null;
  delivered: number;
  collected: number;
  rest: number;
  /** Everything the outlet owes now (the most that can be collected). */
  due: number;
}

const METHODS = [
  { value: "CASH", label: "Cash" },
  { value: "BANK", label: "Bank" },
  { value: "MFS", label: "Mobile money (bKash / Nagad)" },
  { value: "CHEQUE", label: "Cheque" },
];

export function CollectionView() {
  const lookups = useLookups();
  const territory = useTerritory();
  const can = useFeaturePermissions(rtmPaths.collection);
  const f = useViewFilters({ ...EMPTY_TERRITORY, outletId: "", date: today() });
  const a = f.applied;
  const list = useResource(`rtm-collection-day-${f.key}`, () => rtmApi.get<CollectionDay[]>("collection/summary", { date: a.date, nodeId: nodeOf(a), srId: a.srId, outletId: a.outletId }));
  const [query, setQuery] = useState("");
  const [collecting, setCollecting] = useState<CollectionDay | null>(null);
  const [creating, setCreating] = useState(false);
  const rows = searchOutlets(list.data, query);
  const collectFields: FieldDef[] = [
    { name: "collectionDate", label: "Date", type: "date", required: true },
    { name: "amount", label: "Amount", type: "number", required: true, hint: collecting ? `Rest ${money(collecting.rest)} · owes ${money(collecting.due)} in all` : undefined },
    { name: "method", label: "Method", type: "select", options: METHODS },
    { name: "reference", label: "Reference / money receipt" },
    { name: "srId", label: "Collected by (SR)", type: "select", options: srOptions(lookups.data) },
    { name: "remarks", label: "Remarks", type: "textarea", wide: true },
  ];
  const newFields: FieldDef[] = [collectFields[0], { name: "outletId", label: "Outlet", type: "select", required: true, options: outletOptions(lookups.data) }, ...collectFields.slice(1)];
  const columns: Column<CollectionDay>[] = [
    slColumn(),
    actionColumn((c) =>
      can.create ? (
        <Button size="sm" variant={c.rest > 0 ? "accent-soft" : "ghost"} disabled={c.due <= 0} title={c.due <= 0 ? "Nothing is due" : `Collect from ${c.outletName}`} onClick={() => setCollecting(c)}>
          <Wallet /> Collect
        </Button>
      ) : null,
    ),
    outletColumn("Outlet Name"),
    mobileColumn(),
    { id: "date", header: "Date", cell: (c) => c.date, className: "whitespace-nowrap" },
    { id: "delivered", header: "Delivered Amount", cell: (c) => money(c.delivered), sortValue: (c) => c.delivered, className: "text-right tabular-nums" },
    { id: "collected", header: "Collection Amount", cell: (c) => money(c.collected), sortValue: (c) => c.collected, className: "text-right tabular-nums" },
    { id: "rest", header: "Rest Amount", cell: (c) => <span className={cn(c.rest > 0 && "font-semibold text-warning")}>{money(c.rest)}</span>, sortValue: (c) => c.rest, className: "text-right tabular-nums" },
  ];
  const sum = (r: readonly CollectionDay[], k: "delivered" | "collected" | "rest") => money(r.reduce((t, c) => t + c[k], 0));
  return (
    <RtmPage page={collection} actions={can.create && <Button variant="primary" onClick={() => setCreating(true)}><Plus /> New Collection</Button>}>
      <FilterBar>
        <TerritoryFields value={f.draft} onChange={f.set} territory={territory.data} />
        <SelectField label="Outlet" className="w-64" value={f.draft.outletId} onChange={(e) => f.set({ outletId: e.target.value })} options={options(lookups.data?.outlets, (o) => `${o.code} · ${o.name}`, (o) => o.id, "All outlets")} />
        <TextField label="Date" type="date" className="w-40" value={f.draft.date} onChange={(e) => f.set({ date: e.target.value })} />
        <ViewButton loading={list.loading} onClick={() => f.view(list.reload)} />
      </FilterBar>
      {list.error ? <ErrorState message={list.error.message} onRetry={list.reload} /> : !list.data ? <LoadingState /> : (
        <ListCard
          title="Collections"
          rows={rows}
          query={query}
          onQuery={setQuery}
          exportPage="collection"
          canExport={can.export}
          exportFile={{
            title: `Collections ${a.date}`,
            headers: ["SL", "Outlet Code", "Outlet Name", "Mobile", "Date", "Delivered Amount", "Collection Amount", "Rest Amount"],
            row: (c, i) => [i + 1, c.outletCode, c.outletName, c.outletPhone, c.date, c.delivered, c.collected, c.rest],
          }}
        >
          <DataTable
            sheet
            rows={rows}
            columns={columns}
            getRowId={(c) => c.outletId}
            getRowLabel={(c) => c.outletName}
            emptyState={<EmptyState title="Nothing delivered or collected">No outlet had a delivery or a collection for these filters.</EmptyState>}
            footer={(r) => ({ delivered: sum(r, "delivered"), collected: sum(r, "collected"), rest: sum(r, "rest") })}
          />
        </ListCard>
      )}
      <FormDialog
        open={collecting !== null}
        title={collecting ? `Collect from ${collecting.outletName}` : ""}
        fields={collectFields}
        initial={collecting ? { collectionDate: collecting.date, amount: collecting.rest > 0 ? String(collecting.rest) : "", method: "CASH", srId: collecting.srId ?? "" } : undefined}
        submitLabel="Collect"
        onClose={() => setCollecting(null)}
        onSubmit={async (body) => {
          await rtmApi.post("collection", { ...body, outletId: collecting!.outletId });
          list.reload();
        }}
      />
      <FormDialog
        open={creating}
        title="New Collection"
        fields={newFields}
        initial={{ collectionDate: a.date, method: "CASH", srId: a.srId }}
        onClose={() => setCreating(false)}
        onSubmit={async (body) => {
          await rtmApi.post("collection", body);
          list.reload();
        }}
      />
    </RtmPage>
  );
}

// ── Sales return ─────────────────────────────────────────────────────────────

interface ReturnRow extends OutletRef {
  id: string;
  number: string;
  returnDate: string;
  outlet: string;
  distributor: string;
  delivery: string | null;
  deliveryType: "ORDER" | "DIRECT" | null;
  srId: string | null;
  sr: string | null;
  srCode: string | null;
  reason: string | null;
  total: number;
  status: string;
  lines: DocLine[];
  updatedAt: string;
}

const RETURN_LABELS = { COMPLETED: "Returned" };
const RETURN_DELIVERY_TYPES = [...DELIVERY_TYPES, { value: "NONE", label: "Without delivery" }];
const returnTypeLabel = (r: ReturnRow) => (r.deliveryType === "DIRECT" ? "Direct delivery" : r.deliveryType === "ORDER" ? "Against order" : "Without delivery");

export function SalesReturnView() {
  const lookups = useLookups();
  const territory = useTerritory();
  const can = useFeaturePermissions(rtmPaths.salesReturn);
  const f = useViewFilters({ deliveryType: "", ...EMPTY_TERRITORY, distributorId: "", date: today() });
  const a = f.applied;
  const list = useResource(`rtm-returns-${f.key}`, () =>
    rtmApi.get<ReturnRow[]>("sales-return", { deliveryType: a.deliveryType, nodeId: nodeOf(a), srId: a.srId, distributorId: a.distributorId, from: a.date, to: a.date }),
  );
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [viewing, setViewing] = useState<ReturnRow | null>(null);
  const rows = searchOutlets(list.data, query);
  const file: ExportFile<ReturnRow> = {
    title: `Sales Returns ${a.date}`,
    headers: ["SL", "Return", "Delivery Type", "Delivery", "Outlet Code", "Outlet", "Sales Force", "Mobile", "Date", "Delivered By", "Reason", "Value", "Status"],
    row: (r, i) => [i + 1, r.number, returnTypeLabel(r), r.delivery, r.outletCode, r.outletName, srText(r) || null, r.outletPhone, r.returnDate, r.distributor, r.reason, r.total, r.status === "COMPLETED" ? "Returned" : r.status],
  };
  const selected = useListExport("sales-return", file);
  const fields: FieldDef[] = [
    { name: "returnDate", label: "Return date", type: "date", required: true },
    { name: "outletId", label: "Outlet", type: "select", required: true, options: outletOptions(lookups.data) },
    { name: "reason", label: "Reason", type: "select", options: ["Damaged", "Expired", "Near expiry", "Wrong item", "Not sold", "Other"].map((r) => ({ value: r, label: r })) },
  ];
  const columns: Column<ReturnRow>[] = [
    slColumn(),
    outletColumn("Outlet"),
    { id: "sr", header: "Sales Force", cell: (r) => srText(r) || "—" },
    mobileColumn(),
    { id: "date", header: "Date", cell: (r) => r.returnDate, className: "whitespace-nowrap" },
    { id: "status", header: "Status", cell: (r) => <StatusBadge status={r.status} labels={RETURN_LABELS} /> },
    actionColumn((r) => <RowAction label={`View ${r.number}`} icon={<Eye />} onClick={() => setViewing(r)} />, "Actions"),
  ];
  return (
    <RtmPage page={salesReturn} actions={can.create && <Button variant="primary" onClick={() => setCreating(true)}><Plus /> New Return</Button>}>
      <FilterBar>
        <SelectField label="Delivery Type" className="w-40" value={f.draft.deliveryType} onChange={(e) => f.set({ deliveryType: e.target.value })} options={RETURN_DELIVERY_TYPES} />
        <TerritoryFields value={f.draft} onChange={f.set} territory={territory.data} />
        <SelectField label="Delivered By" className="w-56" value={f.draft.distributorId} onChange={(e) => f.set({ distributorId: e.target.value })} options={options(lookups.data?.distributors, (d) => d.name, (d) => d.id, "All distributors")} />
        <TextField label="Date" type="date" className="w-40" value={f.draft.date} onChange={(e) => f.set({ date: e.target.value })} />
        <ViewButton loading={list.loading} onClick={() => f.view(list.reload)} />
      </FilterBar>
      {list.error ? <ErrorState message={list.error.message} onRetry={list.reload} /> : !list.data ? <LoadingState /> : (
        <ListCard title="Sales Returns" rows={rows} query={query} onQuery={setQuery} exportPage="sales-return" canExport={can.export} exportFile={file}>
          <DataTable
            rows={rows}
            columns={columns}
            getRowId={(r) => r.id}
            getRowLabel={(r) => `${r.number} ${r.outletName}`}
            bulkActions={can.export ? selectedExcel(selected.download) : undefined}
            emptyState={<EmptyState title="No sales returns">Nothing was returned for these filters.</EmptyState>}
          />
        </ListCard>
      )}
      <FormDialog
        open={creating}
        title="New Sales Return"
        fields={fields}
        initial={{ returnDate: a.date, reason: "Damaged" }}
        lines={{ items: lookups.data?.items ?? [], rate: true }}
        onClose={() => setCreating(false)}
        onSubmit={async (body) => {
          await rtmApi.post("sales-return", body);
          list.reload();
        }}
      />
      {viewing && <ReturnDetail ret={viewing} onClose={() => setViewing(null)} />}
    </RtmPage>
  );
}

function ReturnDetail({ ret: r, onClose }: { ret: ReturnRow; onClose: () => void }) {
  return (
    <Dialog open size="xl" title={`Sales Return ${r.number}`} description={`${r.outletCode} · ${r.outletName}`} onClose={onClose} footer={<Button onClick={onClose}>Close</Button>}>
      <div className="flex flex-col gap-4">
        <DetailHead
          items={[
            ["Date", r.returnDate],
            ["Status", <StatusBadge key="s" status={r.status} labels={RETURN_LABELS} />],
            ["Delivery type", returnTypeLabel(r)],
            ["Delivery", r.delivery],
            ["Sales force", srText(r)],
            ["Mobile", r.outletPhone],
            ["Delivered by", r.distributor],
            ["Reason", r.reason],
          ]}
        />
        <LinesTable lines={r.lines} />
        <dl className="ml-auto grid w-full max-w-64 grid-cols-2 text-[13px]">
          <dt className="font-semibold text-ink">Value</dt>
          <dd className="text-right font-semibold tabular-nums">{money(r.total)}</dd>
        </dl>
      </div>
    </Dialog>
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
