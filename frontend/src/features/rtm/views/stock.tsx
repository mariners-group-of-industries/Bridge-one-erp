"use client";

import { Check, Eye, FileSpreadsheet, Plus, Trash2, Truck, Undo2, Upload, X } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/ui/data-table";
import { ConfirmDialog, Dialog } from "@/components/ui/dialog";
import { CONTROL, SelectField, TextField } from "@/components/ui/form-field";
import { Card, EmptyState, ErrorState, LoadingState } from "@/components/ui/section";
import { useToast } from "@/components/ui/toast";
import { useResource } from "@/hooks/use-resource";
import { apiRequest, errorMessage } from "@/lib/api/client";
import { cn } from "@/lib/cn";
import { downloadFile } from "@/lib/download";
import { useFeaturePermissions } from "@/lib/permissions/useFeaturePermissions";
import { rtmPaths } from "../paths";
import { LayerFields, deepestNode, useTerritory } from "../components/sales-filters";
import { stockAdjustment, stockTransferIssue, stockTransferRequest } from "../navigation";
import { money, monthStart, qty, rtmApi, today, type Lookups } from "../services/rtm.api";
import { DateRange, FilterBar, FormDialog, RtmPage, StatusBadge, SimpleTable, options, useAction, useLookups, type FieldDef } from "../components/kit";

const distOptions = (l: Lookups | undefined, placeholder = "All distributors") =>
  options(l?.distributors, (d) => `${d.code} · ${d.name}`, (d) => d.id, placeholder);

// ── Transfer line type ────────────────────────────────────────────────────────

interface TransferLine {
  lineId: string;
  itemId: string;
  itemCode: string;
  itemName: string;
  uom: string;
  qty: number;
  issuedQty: number;
}

interface Transfer {
  id: string;
  number: string;
  requestDate: string;
  fromDistributorId: string;
  fromDistributor: string;
  toDistributorId: string;
  toDistributor: string;
  status: string;
  remarks: string | null;
  requestedBy: string;
  approvedBy: string | null;
  issuedBy: string | null;
  issuedAt: string | null;
  totalQty: number;
  lines: TransferLine[];
  updatedAt: string;
}

// ── Distributor Stock Transfer Request ────────────────────────────────────────

const TRANSFER_LABELS = {
  PENDING: "Pending approval",
  APPROVED: "Approved",
  COMPLETED: "Issued",
  REJECTED: "Rejected",
};

export function StockTransferRequestView() {
  const [from, setFrom] = useState(monthStart());
  const [to, setTo] = useState(today());
  const lookups = useLookups();
  const list = useResource(`rtm-transfers-${from}-${to}`, () =>
    rtmApi.get<Transfer[]>("distributor-stock-transfer-request", { from, to }),
  );
  const [open, setOpen] = useState(false);
  const { busy, run } = useAction(list.reload);

  const fields: FieldDef[] = [
    { name: "requestDate", label: "Request date", type: "date", required: true },
    {
      name: "fromDistributorId",
      label: "From distributor",
      type: "select",
      required: true,
      options: distOptions(lookups.data, "Select distributor"),
    },
    {
      name: "toDistributorId",
      label: "To distributor",
      type: "select",
      required: true,
      options: distOptions(lookups.data, "Select distributor"),
    },
    { name: "remarks", label: "Remarks", type: "textarea", wide: true },
  ];

  const columns: Column<Transfer>[] = [
    { id: "number", header: "Transfer", cell: (t) => <span className="font-mono">{t.number}</span>, sortValue: (t) => t.number },
    { id: "date", header: "Date", cell: (t) => t.requestDate, sortValue: (t) => t.requestDate },
    { id: "from", header: "From", cell: (t) => t.fromDistributor },
    { id: "to", header: "To", cell: (t) => t.toDistributor },
    { id: "qty", header: "Total qty", cell: (t) => qty(t.totalQty), className: "text-right" },
    { id: "requestedBy", header: "Requested by", cell: (t) => t.requestedBy, hideBelow: "lg" },
    { id: "approvedBy", header: "Approved by", cell: (t) => t.approvedBy ?? "—", hideBelow: "lg" },
    { id: "status", header: "Status", cell: (t) => <StatusBadge status={t.status} labels={TRANSFER_LABELS} /> },
    {
      id: "actions",
      header: "",
      cell: (t) =>
        t.status === "PENDING" ? (
          <div className="flex gap-1">
            <Button
              size="sm"
              variant="primary"
              disabled={busy === `approve-${t.id}`}
              onClick={() =>
                run(`approve-${t.id}`, () => rtmApi.post(`distributor-stock-transfer-request/${t.id}/approve`), `${t.number} approved.`)
              }
            >
              <Check /> Approve
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={busy === `reject-${t.id}`}
              onClick={() =>
                run(`reject-${t.id}`, () => rtmApi.post(`distributor-stock-transfer-request/${t.id}/reject`), `${t.number} rejected.`)
              }
            >
              <X /> Reject
            </Button>
          </div>
        ) : null,
    },
  ];

  return (
    <RtmPage
      page={stockTransferRequest}
      actions={
        <Button variant="primary" onClick={() => setOpen(true)}>
          <Plus /> New Request
        </Button>
      }
    >
      <FilterBar>
        <DateRange from={from} to={to} onChange={(f, t) => { setFrom(f); setTo(t); }} />
      </FilterBar>
      {list.error ? (
        <ErrorState message={list.error.message} onRetry={list.reload} />
      ) : !list.data ? (
        <LoadingState />
      ) : (
        <Card>
          <DataTable
            rows={list.data}
            columns={columns}
            getRowId={(t) => t.id}
            getRowLabel={(t) => t.number}
            modifiedAt={(t) => t.updatedAt}
            search={{
              placeholder: "Search transfer, distributor…",
              match: (t, q) =>
                `${t.number} ${t.fromDistributor} ${t.toDistributor}`.toLowerCase().includes(q),
            }}
          />
        </Card>
      )}
      <FormDialog
        open={open}
        title="New Stock Transfer Request"
        fields={fields}
        lines={{ items: lookups.data?.items ?? [] }}
        onClose={() => setOpen(false)}
        onSubmit={async (body) => {
          await rtmApi.post("distributor-stock-transfer-request", body);
          list.reload();
        }}
      />
    </RtmPage>
  );
}

// ── Distributor Stock Transfer Issue ──────────────────────────────────────────

export function StockTransferIssueView() {
  const [from, setFrom] = useState(monthStart());
  const [to, setTo] = useState(today());
  const approved = useResource(`rtm-transfers-approved`, () =>
    rtmApi.get<Transfer[]>("distributor-stock-transfer-request", { status: "APPROVED" }),
  );
  const list = useResource(`rtm-transfers-issued-${from}-${to}`, () =>
    rtmApi.get<Transfer[]>("distributor-stock-transfer-issue", { from, to }),
  );
  const [target, setTarget] = useState<Transfer | null>(null);
  const [creating, setCreating] = useState(false);
  const lookups = useLookups();
  const can = useFeaturePermissions(rtmPaths.stockTransferIssue);
  const reload = () => {
    approved.reload();
    list.reload();
  };

  const issuedColumns: Column<Transfer>[] = [
    { id: "number", header: "Transfer", cell: (t) => <span className="font-mono">{t.number}</span>, sortValue: (t) => t.number },
    { id: "date", header: "Date", cell: (t) => t.requestDate },
    { id: "from", header: "From", cell: (t) => t.fromDistributor },
    { id: "to", header: "To", cell: (t) => t.toDistributor },
    { id: "qty", header: "Total qty", cell: (t) => qty(t.totalQty), className: "text-right" },
    { id: "issuedBy", header: "Issued by", cell: (t) => t.issuedBy ?? "—", hideBelow: "lg" },
    { id: "status", header: "Status", cell: (t) => <StatusBadge status={t.status} labels={TRANSFER_LABELS} /> },
  ];

  return (
    <RtmPage
      page={stockTransferIssue}
      actions={
        can.create && (
          <Button variant="primary" onClick={() => setCreating(true)}>
            <Plus /> Distributor Stock Transfer
          </Button>
        )
      }
    >
      <FilterBar>
        <DateRange from={from} to={to} onChange={(f, t) => { setFrom(f); setTo(t); }} />
      </FilterBar>

      <SimpleTable
        title="Approved transfers awaiting issue"
        rows={approved.data ?? []}
        empty={approved.loading ? "Loading…" : "No approved transfers pending issue."}
        columns={[
          { header: "Transfer", cell: (t) => <span className="font-mono">{t.number}</span> },
          { header: "Date", cell: (t) => t.requestDate },
          { header: "From", cell: (t) => t.fromDistributor },
          { header: "To", cell: (t) => t.toDistributor },
          { header: "Qty", cell: (t) => qty(t.totalQty), align: "right" },
          {
            header: "",
            cell: (t) => (
              <Button size="sm" variant="primary" onClick={() => setTarget(t)}>
                <Truck /> Issue
              </Button>
            ),
          },
        ]}
      />

      {list.error ? (
        <ErrorState message={list.error.message} onRetry={list.reload} />
      ) : !list.data ? (
        <LoadingState />
      ) : (
        <Card>
          <DataTable
            rows={list.data}
            columns={issuedColumns}
            getRowId={(t) => t.id}
            getRowLabel={(t) => t.number}
            modifiedAt={(t) => t.updatedAt}
            search={{
              placeholder: "Search transfer…",
              match: (t, q) => `${t.number} ${t.fromDistributor} ${t.toDistributor}`.toLowerCase().includes(q),
            }}
          />
        </Card>
      )}
      {target && <IssueDialog transfer={target} onClose={() => setTarget(null)} onDone={reload} />}
      {creating && <StockTransferDialog lookups={lookups.data} onClose={() => setCreating(false)} onDone={reload} />}
    </RtmPage>
  );
}

// ── New distributor stock transfer (from the Issue page) ─────────────────────

interface TransferItemOptions {
  categories: { id: string; name: string; level: number; parentId: string | null }[];
  items: { id: string; code: string; name: string; uom: string; categoryPath: string[]; dealerPrice: number | null; stock: number }[];
}

interface RequestLine {
  itemId: string;
  qty: string;
}

/**
 * Requesting portion (date, distributors, remarks), an item filter (Category ›
 * Sub Category › Minor Category › Item, Add) and the requested items. The
 * transfer then goes through approval and is issued from this page.
 */
function StockTransferDialog({ lookups, onClose, onDone }: { lookups: Lookups | undefined; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [requestDate, setRequestDate] = useState(today());
  const [fromId, setFromId] = useState("");
  const [toId, setToId] = useState("");
  const [remarks, setRemarks] = useState("");
  const [filter, setFilter] = useState({ category: "", sub: "", minor: "", itemId: "" });
  const [lines, setLines] = useState<RequestLine[]>([]);
  const [saving, setSaving] = useState(false);
  const [tried, setTried] = useState(false);
  const opts = useResource(`rtm-transfer-items-${fromId}-${requestDate}`, () =>
    rtmApi.get<TransferItemOptions>("distributor-stock-transfer-issue/items", { distributorId: fromId, date: requestDate }),
  );
  const cats = opts.data?.categories ?? [];
  const items = opts.data?.items ?? [];
  const byId = new Map(items.map((i) => [i.id, i]));
  const level = (n: number, parentId: string) => cats.filter((c) => c.level === n && (n === 1 || c.parentId === parentId));
  const shownItems = items.filter((i) => {
    const want = filter.minor || filter.sub || filter.category;
    return !want || i.categoryPath.includes(want);
  });
  const add = () => {
    if (!filter.itemId) return;
    if (lines.some((l) => l.itemId === filter.itemId)) {
      toast.error(`${byId.get(filter.itemId)?.name ?? "This item"} is already in the list.`);
      return;
    }
    setLines([...lines, { itemId: filter.itemId, qty: "" }]);
    setFilter({ ...filter, itemId: "" });
  };
  const lineError = (l: RequestLine) => {
    const n = Number(l.qty);
    const item = byId.get(l.itemId);
    if (!(n > 0)) return "Enter a quantity.";
    if (item && n > item.stock + 1e-9) return `Only ${qty(item.stock)} in stock.`;
    return null;
  };
  const submit = async () => {
    setTried(true);
    const problem = !fromId || !toId ? "Choose both distributors." : fromId === toId ? "Choose two different distributors." : !lines.length ? "Add at least one item." : lines.some(lineError) ? "Fix the highlighted quantities." : null;
    if (problem) {
      toast.error(problem);
      return;
    }
    setSaving(true);
    try {
      await rtmApi.post("distributor-stock-transfer-issue", { requestDate, fromDistributorId: fromId, toDistributorId: toId, remarks, lines: lines.map((l) => ({ itemId: l.itemId, qty: l.qty })) });
      toast.success("Transfer requested. It is issued here once approved.");
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
      size="2xl"
      title="Distributor Stock Transfer"
      onClose={onClose}
      onSubmit={submit}
      footer={
        <>
          <Button onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="submit" variant="primary" loading={saving}>Save</Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <section className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold text-ink">Requesting</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <TextField label="Request date" type="date" required value={requestDate} onChange={(e) => setRequestDate(e.target.value)} />
            <SelectField
              label="From distributor"
              required
              value={fromId}
              onChange={(e) => {
                setFromId(e.target.value);
                if (e.target.value === toId) setToId("");
              }}
              options={distOptions(lookups, "Select distributor")}
            />
            <SelectField label="To distributor" required value={toId} onChange={(e) => setToId(e.target.value)} options={distOptions(lookups, "Select distributor").filter((o) => !o.value || o.value !== fromId)} />
            <TextField label="Remarks" value={remarks} maxLength={500} onChange={(e) => setRemarks(e.target.value)} />
          </div>
        </section>

        <section className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold text-ink">Item filter</h3>
          <div className="flex flex-wrap items-end gap-3">
            <SelectField label="Item category" className="w-48" value={filter.category} onChange={(e) => setFilter({ category: e.target.value, sub: "", minor: "", itemId: "" })} options={options(level(1, ""), (c) => c.name, (c) => c.id, "All categories")} />
            <SelectField label="Item sub category" className="w-48" value={filter.sub} disabled={!filter.category} onChange={(e) => setFilter({ ...filter, sub: e.target.value, minor: "", itemId: "" })} options={options(level(2, filter.category), (c) => c.name, (c) => c.id, "All sub categories")} />
            <SelectField label="Item minor category" className="w-48" value={filter.minor} disabled={!filter.sub} onChange={(e) => setFilter({ ...filter, minor: e.target.value, itemId: "" })} options={options(level(3, filter.sub), (c) => c.name, (c) => c.id, "All minor categories")} />
            <SelectField
              label="Item"
              className="w-72"
              value={filter.itemId}
              onChange={(e) => setFilter({ ...filter, itemId: e.target.value })}
              options={options(shownItems, (i) => `${i.code} · ${i.name}${fromId ? ` (stock ${qty(i.stock)})` : ""}`, (i) => i.id, opts.loading ? "Loading items…" : "Select item")}
            />
            <Button variant="accent-soft" onClick={add} disabled={!filter.itemId} className="mb-px">
              <Plus /> Add
            </Button>
          </div>
          {!fromId && <p className="text-xs text-ink-muted">Choose the From distributor to see its current stock.</p>}
        </section>

        <div className="overflow-x-auto rounded border border-line">
          <table className="w-full text-[13px]">
            <thead className="bg-grid-head text-xs text-grid-head-ink">
              <tr>
                <th className="w-12 px-2.5 py-2 text-right font-bold">SL</th>
                <th className="px-2.5 py-2 text-left font-bold">Item Name</th>
                <th className="px-2.5 py-2 text-right font-bold">Dealer Price</th>
                <th className="px-2.5 py-2 text-right font-bold">Current Stock</th>
                <th className="w-40 px-2.5 py-2 text-right font-bold">Request Qty</th>
                <th className="w-16 px-2.5 py-2 text-center font-bold">Action</th>
              </tr>
            </thead>
            <tbody>
              {lines.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-2.5 py-6 text-center text-ink-faint">No items yet. Pick an item above and press Add.</td>
                </tr>
              ) : (
                lines.map((l, i) => {
                  const item = byId.get(l.itemId);
                  const error = tried || l.qty !== "" ? lineError(l) : null;
                  return (
                    <tr key={l.itemId} className="border-t border-line align-top">
                      <td className="px-2.5 py-1.5 text-right tabular-nums">{i + 1}</td>
                      <td className="px-2.5 py-1.5">
                        {item?.name ?? "…"} <span className="font-mono text-[11px] text-ink-faint">{item?.code}</span>
                      </td>
                      <td className="px-2.5 py-1.5 text-right tabular-nums">{item?.dealerPrice == null ? "—" : money(item.dealerPrice)}</td>
                      <td className="px-2.5 py-1.5 text-right tabular-nums">{item ? `${qty(item.stock)} ${item.uom}` : "—"}</td>
                      <td className="px-2.5 py-1.5">
                        <input
                          aria-label={`Request quantity of ${item?.name ?? "item"}`}
                          aria-invalid={error ? true : undefined}
                          type="number"
                          min={0}
                          step="any"
                          value={l.qty}
                          onChange={(e) => setLines(lines.map((x) => (x.itemId === l.itemId ? { ...x, qty: e.target.value } : x)))}
                          className={cn(CONTROL, "h-8 text-right", error && "border-danger")}
                        />
                        {error && <span className="mt-0.5 block text-right text-[11px] text-danger">{error}</span>}
                      </td>
                      <td className="px-2.5 py-1.5 text-center">
                        <Button variant="ghost" size="icon" aria-label={`Remove ${item?.name ?? "item"}`} title="Remove" className="hover:text-danger" onClick={() => setLines(lines.filter((x) => x.itemId !== l.itemId))}>
                          <Trash2 />
                        </Button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </Dialog>
  );
}

function IssueDialog({
  transfer,
  onClose,
  onDone,
}: {
  transfer: Transfer;
  onClose: () => void;
  onDone: () => void;
}) {
  const toast = useToast();
  const [qtys, setQtys] = useState<Record<string, string>>(
    Object.fromEntries(transfer.lines.map((l) => [l.lineId, String(l.qty)])),
  );
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setSaving(true);
    try {
      await rtmApi.post(`distributor-stock-transfer-issue/${transfer.id}/issue`, {
        lines: transfer.lines.map((l) => ({ lineId: l.lineId, qty: Number(qtys[l.lineId]) || 0 })),
      });
      toast.success(`${transfer.number} issued. Stock transferred.`);
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
      title={`Issue ${transfer.number}`}
      description={`${transfer.fromDistributor} → ${transfer.toDistributor}`}
      onClose={onClose}
      onSubmit={submit}
      footer={
        <>
          <Button onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={saving}>
            Issue
          </Button>
        </>
      }
    >
      <table className="w-full text-sm">
        <thead className="text-xs text-ink-muted">
          <tr>
            <th className="py-1 text-left font-semibold">Item</th>
            <th className="py-1 text-right font-semibold">UoM</th>
            <th className="py-1 text-right font-semibold">Requested</th>
            <th className="w-36 py-1 text-right font-semibold">Issue</th>
          </tr>
        </thead>
        <tbody>
          {transfer.lines.map((l) => (
            <tr key={l.lineId} className="border-t border-line">
              <td className="py-1.5">
                {l.itemName}
                <span className="ml-1 text-xs text-ink-faint">{l.itemCode}</span>
              </td>
              <td className="py-1.5 text-right text-ink-muted">{l.uom}</td>
              <td className="py-1.5 text-right tabular-nums">{qty(l.qty)}</td>
              <td className="py-1.5">
                <input
                  aria-label={`Issue ${l.itemName}`}
                  type="number"
                  min={0}
                  max={l.qty}
                  step="any"
                  value={qtys[l.lineId]}
                  onChange={(e) => setQtys({ ...qtys, [l.lineId]: e.target.value })}
                  className={cn(CONTROL, "h-8 text-right")}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Dialog>
  );
}

// ── Distributor Stock Adjustment ──────────────────────────────────────────────

interface Adjustment {
  id: string;
  number: string;
  adjustDate: string;
  year: number;
  month: number;
  distributorId: string;
  distributorCode: string;
  distributor: string;
  reason: string;
  remarks: string | null;
  status: string;
  createdBy: string;
  approvedBy: string | null;
  rolledBackBy: string | null;
  rolledBackAt: string | null;
  netValue: number;
  lines: { itemId: string; itemCode: string; itemName: string; uom: string; qty: number; rate: number; value: number }[];
  updatedAt: string;
}

const ADJUSTMENT_REASONS = ["Opening stock", "Physical count", "Damage", "Expiry", "Theft / loss", "Other"];
const ADJ_LABELS = { PENDING: "Pending approval", COMPLETED: "Approved", REJECTED: "Rejected", CANCELLED: "Rolled back" };
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const thisYear = new Date().getFullYear();
const YEARS = Array.from({ length: 6 }, (_, i) => String(thisYear - i));
const yearOptions = (all?: string) => [...(all ? [{ value: "", label: all }] : []), ...YEARS.map((y) => ({ value: y, label: y }))];
const monthOptions = (all?: string) => [...(all ? [{ value: "", label: all }] : []), ...MONTHS.map((m, i) => ({ value: String(i + 1), label: m }))];
const signedMoney = (n: number) => <span className={cn("tabular-nums", n > 0 && "text-success", n < 0 && "text-danger")}>{n > 0 ? "+" : ""}{money(n)}</span>;

export function StockAdjustmentView() {
  const [year, setYear] = useState(String(thisYear));
  const [month, setMonth] = useState("");
  const can = useFeaturePermissions(rtmPaths.stockAdjustment);
  const list = useResource(`rtm-adjustments-${year}-${month}`, () => rtmApi.get<Adjustment[]>("distributor-stock-adjustment", { year, month }));
  const [adjusting, setAdjusting] = useState(false);
  const [bulk, setBulk] = useState(false);
  const [viewing, setViewing] = useState<Adjustment | null>(null);
  const [rollingBack, setRollingBack] = useState<Adjustment | null>(null);
  const { busy, run } = useAction(list.reload);

  const columns: Column<Adjustment>[] = [
    { id: "sl", header: "SL", cell: (_a, i) => i + 1, className: "w-12 text-right tabular-nums" },
    { id: "year", header: "Year", cell: (a) => a.year, sortValue: (a) => a.adjustDate, className: "tabular-nums" },
    { id: "month", header: "Month", cell: (a) => MONTHS[a.month - 1] },
    {
      id: "distributor",
      header: "Distributor Name",
      cell: (a) => (
        <span className="flex flex-col">
          <span className="font-semibold text-ink">{a.distributor}</span>
          <span className="font-mono text-[11px] text-ink-faint">{a.number} · {a.reason}</span>
        </span>
      ),
      sortValue: (a) => a.distributor,
    },
    { id: "value", header: "Net Valuation Impact", cell: (a) => signedMoney(a.netValue), sortValue: (a) => a.netValue, className: "text-right" },
    {
      id: "action",
      header: "Action / Rollback",
      cell: (a) => (
        <div className="flex flex-wrap items-center gap-1">
          <StatusBadge status={a.status} labels={ADJ_LABELS} />
          <Button variant="ghost" size="icon" aria-label={`View ${a.number}`} title="View" onClick={() => setViewing(a)}>
            <Eye />
          </Button>
          {can.approve && a.status === "PENDING" && (
            <>
              <Button variant="ghost" size="icon" aria-label={`Approve ${a.number}`} title="Approve" className="hover:text-success" loading={busy === `a-${a.id}`} onClick={() => run(`a-${a.id}`, () => rtmApi.post(`distributor-stock-adjustment/${a.id}/approve`), `${a.number} approved. Stock adjusted.`)}>
                {busy !== `a-${a.id}` && <Check />}
              </Button>
              <Button variant="ghost" size="icon" aria-label={`Reject ${a.number}`} title="Reject" className="hover:text-danger" loading={busy === `r-${a.id}`} onClick={() => run(`r-${a.id}`, () => rtmApi.post(`distributor-stock-adjustment/${a.id}/reject`), `${a.number} rejected.`)}>
                {busy !== `r-${a.id}` && <X />}
              </Button>
            </>
          )}
          {can.delete && a.status === "COMPLETED" && (
            <Button size="sm" variant="ghost" className="hover:text-danger" loading={busy === `b-${a.id}`} onClick={() => setRollingBack(a)}>
              {busy !== `b-${a.id}` && <Undo2 />} Rollback
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <RtmPage
      page={stockAdjustment}
      actions={
        <>
          {can.import && (
            <Button onClick={() => setBulk(true)}>
              <Upload /> Bulk adjustment
            </Button>
          )}
          {can.create && (
            <Button variant="primary" onClick={() => setAdjusting(true)}>
              <Plus /> Adjust Stock
            </Button>
          )}
        </>
      }
    >
      <FilterBar>
        <SelectField label="Year" className="w-32" value={year} onChange={(e) => setYear(e.target.value)} options={yearOptions("All years")} />
        <SelectField label="Month" className="w-40" value={month} disabled={!year} onChange={(e) => setMonth(e.target.value)} options={monthOptions("All months")} />
      </FilterBar>
      {list.error ? (
        <ErrorState message={list.error.message} onRetry={list.reload} />
      ) : !list.data ? (
        <LoadingState />
      ) : (
        <Card>
          <DataTable
            sheet
            rows={list.data}
            columns={columns}
            getRowId={(a) => a.id}
            getRowLabel={(a) => a.number}
            search={{ placeholder: "Search distributor, adjustment…", match: (a, q) => `${a.number} ${a.distributor} ${a.distributorCode} ${a.reason}`.toLowerCase().includes(q) }}
            footer={(rows) => ({ value: signedMoney(rows.filter((r) => r.status !== "CANCELLED" && r.status !== "REJECTED").reduce((t, r) => t + r.netValue, 0)) })}
            emptyState={<EmptyState title="No adjustments">No stock was adjusted in this period.</EmptyState>}
          />
        </Card>
      )}
      {adjusting && <AdjustStockDialog onClose={() => setAdjusting(false)} onDone={list.reload} />}
      {bulk && <BulkAdjustDialog onClose={() => setBulk(false)} onDone={list.reload} />}
      {viewing && <AdjustmentDetail adjustment={viewing} onClose={() => setViewing(null)} />}
      <ConfirmDialog
        open={rollingBack !== null}
        title={`Roll back ${rollingBack?.number ?? ""}?`}
        message={rollingBack ? `The stock change to ${rollingBack.distributor} is reversed (valuation ${money(-rollingBack.netValue)}). The adjustment stays on record as Rolled back.` : ""}
        confirmLabel="Roll back"
        onConfirm={async () => {
          const a = rollingBack!;
          setRollingBack(null);
          await run(`b-${a.id}`, () => rtmApi.post(`distributor-stock-adjustment/${a.id}/rollback`), `${a.number} rolled back.`);
        }}
        onClose={() => setRollingBack(null)}
      />
    </RtmPage>
  );
}

function AdjustmentDetail({ adjustment: a, onClose }: { adjustment: Adjustment; onClose: () => void }) {
  return (
    <Dialog open size="xl" title={`Stock Adjustment ${a.number}`} description={`${a.distributorCode} · ${a.distributor} · ${MONTHS[a.month - 1]} ${a.year}`} onClose={onClose} footer={<Button onClick={onClose}>Close</Button>}>
      <div className="flex flex-col gap-4">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-[13px] sm:grid-cols-4">
          {(
            [
              ["Date", a.adjustDate],
              ["Status", <StatusBadge key="s" status={a.status} labels={ADJ_LABELS} />],
              ["Reason", a.reason],
              ["Created by", a.createdBy],
              ["Approved by", a.approvedBy],
              ["Rolled back", a.rolledBackAt ? `${a.rolledBackBy ?? ""} · ${new Date(a.rolledBackAt).toLocaleString()}` : null],
              ["Remarks", a.remarks],
            ] as [string, ReactNode][]
          ).map(([label, value]) => (
            <div key={label} className="flex flex-col">
              <dt className="text-xs font-medium text-ink-muted">{label}</dt>
              <dd className="text-ink">{value || "—"}</dd>
            </div>
          ))}
        </dl>
        <SimpleTable
          rows={a.lines}
          columns={[
            { header: "Item", cell: (l) => <>{l.itemName} <span className="font-mono text-[11px] text-ink-faint">{l.itemCode}</span></> },
            { header: "Qty", cell: (l) => `${l.qty > 0 ? "+" : ""}${qty(l.qty)} ${l.uom}`, align: "right" },
            { header: "Dealer Price", cell: (l) => money(l.rate), align: "right" },
            { header: "Valuation", cell: (l) => signedMoney(l.value), align: "right" },
          ]}
        />
        <p className="text-right text-[13px] font-semibold">Net valuation impact {signedMoney(a.netValue)}</p>
      </div>
    </Dialog>
  );
}

interface AdjustOptions {
  distributors: { id: string; code: string; name: string; territoryNodeId: string | null }[];
}

/**
 * Adjust Stock: narrow to a distributor (by sales territory) and items (by
 * category), View stock items, enter the counted quantity of each, and save the
 * differences as one adjustment for the chosen year and month.
 */
function AdjustStockDialog({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const territory = useTerritory();
  const opts = useResource("rtm-adjust-options", () => rtmApi.get<AdjustOptions>("distributor-stock-adjustment/options"));
  const [layers, setLayers] = useState<Record<string, string>>({});
  const [distributorId, setDistributorId] = useState("");
  const [cat, setCat] = useState({ category: "", sub: "", minor: "" });
  const [year, setYear] = useState(String(thisYear));
  const [month, setMonth] = useState(String(new Date().getMonth() + 1));
  const [reason, setReason] = useState("Physical count");
  const [remarks, setRemarks] = useState("");
  const [shown, setShown] = useState<{ distributorId: string; category: string } | null>(null);
  const [counted, setCounted] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const stock = useResource(shown ? `rtm-adjust-items-${shown.distributorId}` : null, () => rtmApi.get<TransferItemOptions>("distributor-stock-adjustment/items", { distributorId: shown!.distributorId }));
  // Categories are the same for every distributor of a business unit; load them before a distributor is chosen.
  const catalog = useResource("rtm-adjust-catalog", () => rtmApi.get<TransferItemOptions>("distributor-stock-adjustment/items"));
  const cats = catalog.data?.categories ?? [];
  const level = (n: number, parentId: string) => cats.filter((c) => c.level === n && (n === 1 || c.parentId === parentId));

  const allNodes = (territory.data?.layers ?? []).flatMap((l) => l.nodes);
  const picked = deepestNode(territory.data, layers);
  const pickedPath = allNodes.find((n) => n.id === picked)?.path ?? [];
  const distributors = (opts.data?.distributors ?? []).filter((d) => {
    if (!picked) return true;
    if (!d.territoryNodeId) return false;
    const path = allNodes.find((n) => n.id === d.territoryNodeId)?.path ?? [];
    return path.includes(picked) || pickedPath.includes(d.territoryNodeId);
  });

  const viewItems = () => {
    if (!distributorId) {
      toast.error("Choose the distributor.");
      return;
    }
    setCounted({});
    setShown({ distributorId, category: cat.minor || cat.sub || cat.category });
    if (shown?.distributorId === distributorId) stock.reload();
  };
  const items = (stock.data?.items ?? []).filter((i) => !shown?.category || i.categoryPath.includes(shown.category));
  const diff = (i: (typeof items)[number]) => (counted[i.id] === undefined || counted[i.id] === "" ? 0 : Number(counted[i.id]) - i.stock);
  const changed = items.filter((i) => Number.isFinite(diff(i)) && Math.abs(diff(i)) > 1e-9);
  const net = changed.reduce((t, i) => t + diff(i) * (i.dealerPrice ?? 0), 0);

  const submit = async () => {
    if (!shown) {
      toast.error("View the stock items first.");
      return;
    }
    if (items.some((i) => counted[i.id] !== undefined && counted[i.id] !== "" && !(Number(counted[i.id]) >= 0))) {
      toast.error("Counted quantities must be 0 or more.");
      return;
    }
    if (!changed.length) {
      toast.error("Enter a counted quantity that differs from the current stock.");
      return;
    }
    setSaving(true);
    try {
      await rtmApi.post("distributor-stock-adjustment", { distributorId: shown.distributorId, year, month, reason, remarks, lines: changed.map((i) => ({ itemId: i.id, qty: Math.round(diff(i) * 1000) / 1000 })) });
      toast.success("Adjustment saved. Stock changes once it is approved.");
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
      size="2xl"
      title="Adjust Stock"
      onClose={onClose}
      onSubmit={submit}
      footer={
        <>
          <Button onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="submit" variant="primary" loading={saving} disabled={!changed.length}>
            Save{changed.length ? ` (${changed.length} item${changed.length === 1 ? "" : "s"})` : ""}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end gap-3">
          <LayerFields
            withSr={false}
            value={layers}
            srId=""
            territory={territory.data}
            onChange={(l) => {
              setLayers(l);
              setDistributorId("");
            }}
          />
          <SelectField label="Distributor Name" className="w-64" value={distributorId} onChange={(e) => setDistributorId(e.target.value)} options={options(distributors, (d) => `${d.code} · ${d.name}`, (d) => d.id, opts.loading ? "Loading…" : "Select distributor")} />
          <SelectField label="Item Category" className="w-44" value={cat.category} onChange={(e) => setCat({ category: e.target.value, sub: "", minor: "" })} options={options(level(1, ""), (c) => c.name, (c) => c.id, "All")} />
          <SelectField label="Item Sub-Category" className="w-44" value={cat.sub} disabled={!cat.category} onChange={(e) => setCat({ ...cat, sub: e.target.value, minor: "" })} options={options(level(2, cat.category), (c) => c.name, (c) => c.id, "All")} />
          <SelectField label="Item Minor Category" className="w-44" value={cat.minor} disabled={!cat.sub} onChange={(e) => setCat({ ...cat, minor: e.target.value })} options={options(level(3, cat.sub), (c) => c.name, (c) => c.id, "All")} />
          <SelectField label="Year" className="w-28" value={year} onChange={(e) => setYear(e.target.value)} options={yearOptions()} />
          <SelectField label="Month" className="w-36" value={month} onChange={(e) => setMonth(e.target.value)} options={monthOptions()} />
          <Button variant="primary" onClick={viewItems} loading={stock.loading} className="mb-px">
            {!stock.loading && <Eye />} View stock items
          </Button>
        </div>

        {shown && (
          <>
            {stock.error ? (
              <ErrorState message={stock.error.message} onRetry={stock.reload} />
            ) : !stock.data ? (
              <LoadingState />
            ) : (
              <div className="overflow-x-auto rounded border border-line">
                <table className="w-full text-[13px]">
                  <thead className="bg-grid-head text-xs text-grid-head-ink">
                    <tr>
                      <th className="w-12 px-2.5 py-2 text-right font-bold">SL</th>
                      <th className="px-2.5 py-2 text-left font-bold">Item</th>
                      <th className="px-2.5 py-2 text-right font-bold">Dealer Price</th>
                      <th className="px-2.5 py-2 text-right font-bold">Current Stock</th>
                      <th className="w-36 px-2.5 py-2 text-right font-bold">Counted Qty</th>
                      <th className="px-2.5 py-2 text-right font-bold">Adjustment</th>
                      <th className="px-2.5 py-2 text-right font-bold">Valuation Impact</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-2.5 py-6 text-center text-ink-faint">No items in this category.</td>
                      </tr>
                    ) : (
                      items.map((i, n) => {
                        const d = diff(i);
                        return (
                          <tr key={i.id} className="border-t border-line">
                            <td className="px-2.5 py-1.5 text-right tabular-nums">{n + 1}</td>
                            <td className="px-2.5 py-1.5">{i.name} <span className="font-mono text-[11px] text-ink-faint">{i.code}</span></td>
                            <td className="px-2.5 py-1.5 text-right tabular-nums">{i.dealerPrice == null ? "—" : money(i.dealerPrice)}</td>
                            <td className="px-2.5 py-1.5 text-right tabular-nums">{qty(i.stock)} {i.uom}</td>
                            <td className="px-2.5 py-1.5">
                              <input aria-label={`Counted quantity of ${i.name}`} type="number" min={0} step="any" placeholder={qty(i.stock)} value={counted[i.id] ?? ""} onChange={(e) => setCounted({ ...counted, [i.id]: e.target.value })} className={cn(CONTROL, "h-8 text-right")} />
                            </td>
                            <td className={cn("px-2.5 py-1.5 text-right tabular-nums", d > 0 && "text-success", d < 0 && "text-danger")}>{Math.abs(d) > 1e-9 ? `${d > 0 ? "+" : ""}${qty(d)}` : "—"}</td>
                            <td className="px-2.5 py-1.5 text-right">{Math.abs(d) > 1e-9 ? signedMoney(d * (i.dealerPrice ?? 0)) : "—"}</td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                  {changed.length > 0 && (
                    <tfoot>
                      <tr className="border-t-2 border-line-strong font-semibold">
                        <td colSpan={6} className="px-2.5 py-2 text-right">Net valuation impact</td>
                        <td className="px-2.5 py-2 text-right">{signedMoney(net)}</td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            )}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <SelectField label="Reason" required value={reason} onChange={(e) => setReason(e.target.value)} options={ADJUSTMENT_REASONS.map((r) => ({ value: r, label: r }))} />
              <TextField label="Remarks" className="sm:col-span-2" value={remarks} maxLength={500} onChange={(e) => setRemarks(e.target.value)} />
            </div>
          </>
        )}
      </div>
    </Dialog>
  );
}

/** Bulk adjustment: upload a counted-stock sheet; one adjustment per distributor is raised for the differences. */
function BulkAdjustDialog({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [year, setYear] = useState(String(thisYear));
  const [month, setMonth] = useState(String(new Date().getMonth() + 1));
  const [reason, setReason] = useState("Physical count");
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [templating, setTemplating] = useState(false);
  const template = async () => {
    setTemplating(true);
    try {
      await downloadFile("/api/rtm/distributor-stock-adjustment/bulk/template", "stock-adjustment-template.xlsx");
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setTemplating(false);
    }
  };
  const submit = async () => {
    if (!file) {
      toast.error("Choose the Excel file to upload.");
      return;
    }
    setSaving(true);
    try {
      const body = new FormData();
      body.set("file", file);
      body.set("year", year);
      body.set("month", month);
      body.set("reason", reason);
      const result = await apiRequest<{ created: number; distributors: number; unchanged: number }>("/api/rtm/distributor-stock-adjustment/bulk", { method: "POST", body });
      toast.success(result.created ? `${result.created} adjustment(s) raised for ${result.distributors} distributor(s); ${result.unchanged} item(s) already matched.` : "Every counted quantity already matches the stock; nothing to adjust.");
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
      title="Bulk adjustment"
      description="Upload counted stock per distributor and item. The differences from current stock are raised as adjustments for approval."
      onClose={onClose}
      onSubmit={submit}
      footer={
        <>
          <Button onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="submit" variant="primary" loading={saving}>
            {!saving && <Upload />} Upload
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <SelectField label="Year" required value={year} onChange={(e) => setYear(e.target.value)} options={yearOptions()} />
          <SelectField label="Month" required value={month} onChange={(e) => setMonth(e.target.value)} options={monthOptions()} />
          <SelectField label="Reason" required value={reason} onChange={(e) => setReason(e.target.value)} options={ADJUSTMENT_REASONS.map((r) => ({ value: r, label: r }))} />
        </div>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-ink-muted">Excel file (.xlsx) with Distributor Code, Item Code, Counted Qty</span>
          <input type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="text-[13px] file:mr-3 file:h-8 file:cursor-pointer file:rounded file:border file:border-line-strong file:bg-surface file:px-3 file:text-xs file:font-semibold file:text-ink-muted hover:file:bg-control" />
        </label>
        <div>
          <Button size="sm" variant="ghost" onClick={template} loading={templating}>
            {!templating && <FileSpreadsheet />} Download template
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
