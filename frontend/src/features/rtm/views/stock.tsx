"use client";

import { Check, Plus, Truck, X } from "lucide-react";
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
    <RtmPage page={stockTransferIssue}>
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
    </RtmPage>
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
  distributorId: string;
  distributor: string;
  reason: string;
  remarks: string | null;
  status: string;
  createdBy: string;
  approvedBy: string | null;
  lines: { itemId: string; itemCode: string; itemName: string; uom: string; qty: number }[];
  updatedAt: string;
}

const ADJUSTMENT_REASONS = ["Opening stock", "Physical count", "Damage", "Expiry", "Theft / loss", "Other"];
const ADJ_LABELS = { PENDING: "Pending approval", COMPLETED: "Approved", REJECTED: "Rejected" };

export function StockAdjustmentView() {
  const [from, setFrom] = useState(monthStart());
  const [to, setTo] = useState(today());
  const [distributorId, setDistributorId] = useState("");
  const lookups = useLookups();
  const list = useResource(`rtm-adjustments-${from}-${to}-${distributorId}`, () =>
    rtmApi.get<Adjustment[]>("distributor-stock-adjustment", { from, to, distributorId: distributorId || undefined }),
  );
  const [open, setOpen] = useState(false);
  const { busy, run } = useAction(list.reload);

  const fields: FieldDef[] = [
    { name: "adjustDate", label: "Date", type: "date", required: true },
    {
      name: "distributorId",
      label: "Distributor",
      type: "select",
      required: true,
      options: distOptions(lookups.data, "Select distributor"),
    },
    {
      name: "reason",
      label: "Reason",
      type: "select",
      required: true,
      options: ADJUSTMENT_REASONS.map((r) => ({ value: r, label: r })),
    },
    { name: "remarks", label: "Remarks", type: "textarea", wide: true },
  ];

  const columns: Column<Adjustment>[] = [
    { id: "number", header: "Adjustment", cell: (a) => <span className="font-mono">{a.number}</span>, sortValue: (a) => a.number },
    { id: "date", header: "Date", cell: (a) => a.adjustDate, sortValue: (a) => a.adjustDate },
    { id: "distributor", header: "Distributor", cell: (a) => a.distributor },
    { id: "reason", header: "Reason", cell: (a) => a.reason },
    {
      id: "items",
      header: "Items",
      cell: (a) => (
        <span className="line-clamp-1 text-xs">
          {a.lines.map((l) => `${l.itemName} (${l.qty > 0 ? "+" : ""}${qty(l.qty)})`).join(", ")}
        </span>
      ),
      hideBelow: "lg",
    },
    { id: "createdBy", header: "Created by", cell: (a) => a.createdBy, hideBelow: "lg" },
    { id: "approvedBy", header: "Approved by", cell: (a) => a.approvedBy ?? "—", hideBelow: "lg" },
    { id: "status", header: "Status", cell: (a) => <StatusBadge status={a.status} labels={ADJ_LABELS} /> },
    {
      id: "actions",
      header: "",
      cell: (a) =>
        a.status === "PENDING" ? (
          <div className="flex gap-1">
            <Button
              size="sm"
              variant="primary"
              disabled={busy === `approve-${a.id}`}
              onClick={() =>
                run(
                  `approve-${a.id}`,
                  () => rtmApi.post(`distributor-stock-adjustment/${a.id}/approve`),
                  `${a.number} approved — stock updated.`,
                )
              }
            >
              <Check /> Approve
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={busy === `reject-${a.id}`}
              onClick={() =>
                run(
                  `reject-${a.id}`,
                  () => rtmApi.post(`distributor-stock-adjustment/${a.id}/reject`),
                  `${a.number} rejected.`,
                )
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
      page={stockAdjustment}
      actions={
        <Button variant="primary" onClick={() => setOpen(true)}>
          <Plus /> New Adjustment
        </Button>
      }
    >
      <FilterBar>
        <DateRange from={from} to={to} onChange={(f, t) => { setFrom(f); setTo(t); }} />
        <SelectField
          label="Distributor"
          className="w-56"
          value={distributorId}
          onChange={(e) => setDistributorId(e.target.value)}
          options={distOptions(lookups.data)}
        />
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
            getRowId={(a) => a.id}
            getRowLabel={(a) => a.number}
            modifiedAt={(a) => a.updatedAt}
            search={{
              placeholder: "Search adjustment, distributor…",
              match: (a, q) => `${a.number} ${a.distributor} ${a.reason}`.toLowerCase().includes(q),
            }}
          />
        </Card>
      )}
      <FormDialog
        open={open}
        title="New Stock Adjustment"
        fields={fields}
        initial={{ reason: "Physical count" }}
        lines={{ items: lookups.data?.items ?? [], signed: true }}
        onClose={() => setOpen(false)}
        onSubmit={async (body) => {
          await rtmApi.post("distributor-stock-adjustment", body);
          list.reload();
        }}
      />
    </RtmPage>
  );
}
