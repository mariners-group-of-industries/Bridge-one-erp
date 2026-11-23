"use client";

import { Fragment, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, FileSpreadsheet, FileText } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { useResource } from "@/hooks/use-resource";
import { InventoryTabBar, tabBarOutlineButton } from "@/features/inventory/components/InventoryTabBar";
import type { InventoryDocument, InventoryDocumentLine } from "@/features/inventory/schemas/document.schema";
import { dmy, inventoryApi, monthAgo, today, type ItemOption } from "@/features/inventory/services/inventory.api";
import { useFeaturePermissions } from "@/lib/permissions/useFeaturePermissions";
import { NativeDateInput } from "@/components/ui/date-input";

// iBOS Transfer Report: View By × Based On, with "Is Details" for one row per item line.
const VIEWS = ["Transfer Out", "Transfer Received", "Transfer In Transit"] as const;
const BASED_ON = ["Transfer", "Item", "Supplier", "Category"] as const;
type View = (typeof VIEWS)[number];
type Based = (typeof BASED_ON)[number];

interface Filters {
  view: View | "";
  basedOn: Based | "";
  transferCode: string;
  itemId: string;
  supplierId: string;
  category: string;
  fromOfficeId: string;
  fromWarehouseId: string;
  toOfficeId: string;
  toWarehouseId: string;
  from: string;
  to: string;
  details: boolean;
}

type Cell = string | number | null;
type Row = Record<string, Cell> & { _key: string };
interface Col {
  key: string;
  label: string;
  kind?: "qty" | "money";
}

const r3 = (n: number) => Math.round(n * 1000) / 1000;
const r2 = (n: number) => Math.round(n * 100) / 100;
const fmt = (v: Cell, kind?: Col["kind"]) =>
  v === null || v === undefined || v === ""
    ? ""
    : kind === "qty"
      ? Number(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 3 })
      : kind === "money"
        ? Number(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        : String(v);

const Q = (key: string, label: string): Col => ({ key, label, kind: "qty" });
const M = (key: string, label: string): Col => ({ key, label, kind: "money" });
const T = (key: string, label: string): Col => ({ key, label });

const PLACES = [T("fromOffice", "Sending/Issue Office"), T("fromWarehouse", "Sending/Issue Warehouse"), T("toOffice", "Requesting/Receive Office"), T("toWarehouse", "Requesting/Receive Warehouse")];
const ITEM_INFO = [T("barcode", "Barcode"), T("itemName", "Item Name"), T("category", "Category"), T("subCategory", "Sub Category"), T("minorCategory", "Minor Category"), T("supplier", "Supplier Name")];

/** Columns iBOS shows for each view: per transfer, per item, or per line (Is Details). */
function columnsFor(view: View, mode: "transfer" | "item" | "details"): Col[] {
  const received = view === "Transfer Received";
  const transit = view === "Transfer In Transit";
  if (mode === "transfer") {
    if (received)
      return [T("date", "Transfer Receive Date"), T("requestNo", "Request No."), T("transferNo", "Transfer No."), ...PLACES, Q("qty", "Transfer Qty."), Q("returned", "Returned Qty."), Q("received", "Received Qty."), Q("remaining", "Remaining Qty."), M("receivedCost", "Received Amt.(Cost)"), M("receivedSale", "Received Amt.(Sale)")];
    return [T("date", "Transfer Date"), T("requestNo", "Request No."), T("transferNo", "Transfer No."), ...PLACES, Q("qty", "Transfer Qty."), ...(transit ? [Q("inTransit", "In Transit Qty.")] : []), M("cost", "Transfer Amt.(Cost)"), M("sale", "Transfer Amt.(Sale)")];
  }
  if (mode === "item") {
    if (received) return [...ITEM_INFO, Q("qty", "Transfer Qty."), Q("returned", "Returned Qty."), Q("received", "Received Qty."), M("receivedCost", "Received Amt.(Cost)"), M("receivedSale", "Received Amt.(Sale)")];
    return [...ITEM_INFO, Q("qty", "Transfer Qty."), ...(transit ? [Q("inTransit", "In Transit Qty.")] : []), M("cost", "Transfer Amt.(Cost)"), M("sale", "Transfer Amt.(Sale)")];
  }
  if (received)
    return [T("date", "Transfer Receive Date"), T("requestNo", "Request No."), T("transferNo", "Transfer No."), ...ITEM_INFO, Q("requestQty", "Request Qty."), Q("qty", "Transfer Qty."), Q("returned", "Return Qty."), Q("received", "Receive Qty."), M("receivedCost", "Receive Amt.(Cost)"), M("receivedSale", "Receive Amt.(Sale)"), Q("remaining", "Remaining Qty.")];
  return [T("date", "Transfer Date"), T("requestNo", "Request No."), T("transferNo", "Transfer No."), ...ITEM_INFO, Q("qty", "Transfer Qty."), ...(transit ? [Q("inTransit", "In Transit Qty.")] : []), M("cost", "Transfer Amt.(Cost)"), M("sale", "Transfer Amt.(Sale)"), T("remarks", "Remarks")];
}

/** Dates and document numbers stay on one line. */
const NOWRAP = new Set(["date", "requestNo", "transferNo", "barcode"]);

const SUMMED = ["qty", "inTransit", "returned", "received", "remaining", "requestQty", "cost", "sale", "receivedCost", "receivedSale"];

const blank = (): Filters => ({
  view: "",
  basedOn: "",
  transferCode: "",
  itemId: "",
  supplierId: "",
  category: "",
  fromOfficeId: "",
  fromWarehouseId: "",
  toOfficeId: "",
  toWarehouseId: "",
  from: monthAgo(),
  to: today(),
  details: false,
});

const field = "h-8 w-full rounded border border-line bg-surface px-2.5 text-xs text-ink focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-control";
const labelCls = "mb-1 block text-xs font-medium text-ink";
const Req = () => <span className="mr-0.5 text-rose-600 dark:text-rose-400">*</span>;

export default function TransferReportPage() {
  const perms = useFeaturePermissions("/inventory/transfer-report");
  const [form, setForm] = useState<Filters>(blank);
  const [applied, setApplied] = useState<Filters | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const set = <K extends keyof Filters>(key: K, value: Filters[K]) => setForm((f) => ({ ...f, [key]: value }));

  const masters = useResource("inventory-masters", inventoryApi.masters);
  // Transfers sent up to the To date (a receipt in the period may belong to an earlier transfer).
  const report = useResource(applied ? `transfer-report-${applied.to}` : null, () => inventoryApi.transferReport({ to: applied!.to }));

  const data = masters.data;
  const warehouses = useMemo(() => data?.warehouses ?? [], [data]);
  const offices = useMemo(() => [...new Map(warehouses.map((w) => [w.officeId, w.officeName])).entries()].sort((a, b) => a[1].localeCompare(b[1])), [warehouses]);
  const itemById = useMemo(() => new Map((data?.items ?? []).map((i) => [i.id, i])), [data]);
  const supplierName = useMemo(() => new Map((data?.suppliers ?? []).map((s) => [s.id, s.name])), [data]);
  const categories = useMemo(() => [...new Set((data?.items ?? []).map((i) => i.category))].sort(), [data]);
  const officeOfWarehouse = useMemo(() => new Map(warehouses.map((w) => [w.id, w.officeId])), [warehouses]);

  const byPlace = form.basedOn !== "" && form.basedOn !== "Transfer";
  const canView = !!form.view && !!form.basedOn && (!byPlace || (form.from && form.to && form.from <= form.to));

  const { rows, columns, linesOf } = useMemo(() => {
    if (!applied || !report.data || !data || !applied.view) return { rows: [] as Row[], columns: [] as Col[], linesOf: new Map<string, Row[]>() };
    const view = applied.view;
    const placeFilters = applied.basedOn !== "Transfer";
    const mode: "transfer" | "item" | "details" = applied.details ? "details" : applied.basedOn === "Transfer" ? "transfer" : "item";
    const requests = new Map(report.data.requests.map((r) => [r.id, r]));

    const dateOf = (d: InventoryDocument) => (view === "Transfer Received" ? (d.completedAt?.slice(0, 10) ?? "") : d.docDate);
    const docs = report.data.transfers
      .filter((d) => (view === "Transfer Received" ? d.status === "COMPLETED" : view === "Transfer In Transit" ? d.status === "IN_TRANSIT" : d.status !== "CANCELLED"))
      .filter((d) => !applied.transferCode.trim() || d.number.toLowerCase().includes(applied.transferCode.trim().toLowerCase()))
      .filter((d) => {
        if (!placeFilters) return true;
        const date = dateOf(d);
        if (!date || date < applied.from || date > applied.to) return false;
        if (applied.fromWarehouseId && d.warehouse?.id !== applied.fromWarehouseId) return false;
        if (applied.toWarehouseId && d.toWarehouse?.id !== applied.toWarehouseId) return false;
        if (applied.fromOfficeId && officeOfWarehouse.get(d.warehouse?.id ?? "") !== applied.fromOfficeId) return false;
        if (applied.toOfficeId && officeOfWarehouse.get(d.toWarehouse?.id ?? "") !== applied.toOfficeId) return false;
        return true;
      });

    const lineMatches = (l: InventoryDocumentLine) => {
      const item = itemById.get(l.itemId);
      if (applied.basedOn === "Item" && applied.itemId && l.itemId !== applied.itemId) return false;
      if ((applied.basedOn === "Supplier" || applied.basedOn === "Category") && applied.supplierId && !item?.supplierIds.includes(applied.supplierId)) return false;
      if ((applied.basedOn === "Supplier" || applied.basedOn === "Category") && applied.category && (item?.category ?? l.category) !== applied.category) return false;
      return true;
    };
    const itemInfo = (l: InventoryDocumentLine, item: ItemOption | undefined) => ({
      barcode: item?.barcode || l.itemCode,
      itemName: l.itemName,
      category: item?.category ?? l.category,
      subCategory: item?.subCategory ?? "N/A",
      minorCategory: item?.minorCategory ?? "N/A",
      supplier: (item?.supplierIds ?? []).map((id) => supplierName.get(id)).filter(Boolean).join(", "),
    });
    // One line's figures: quantities and their value at cost and sale price.
    const lineRow = (d: InventoryDocument, l: InventoryDocumentLine): Row => {
      const item = itemById.get(l.itemId);
      const cost = item?.costPrice ?? 0;
      const sale = item?.tradePrice ?? item?.mrp ?? 0;
      const done = d.status === "COMPLETED";
      const received = done ? l.processedQty : 0;
      const request = d.request ? requests.get(d.request.id) : undefined;
      const requestLine = request?.lines.find((x) => x.itemId === l.itemId);
      return {
        _key: `${d.id}:${l.id}`,
        date: dmy(dateOf(d)),
        requestNo: d.request?.number ?? "",
        transferNo: d.number,
        fromOffice: d.warehouse?.officeName ?? "",
        fromWarehouse: d.warehouse?.name ?? "",
        toOffice: d.toWarehouse?.officeName ?? "",
        toWarehouse: d.toWarehouse?.name ?? "",
        ...itemInfo(l, item),
        requestQty: requestLine ? requestLine.qty : null,
        qty: l.qty,
        inTransit: d.status === "IN_TRANSIT" ? l.qty : 0,
        returned: done ? r3(l.qty - l.processedQty) : 0,
        received,
        remaining: requestLine ? r3(Math.max(0, requestLine.qty - requestLine.processedQty)) : 0,
        cost: r2(l.qty * cost),
        sale: r2(l.qty * sale),
        receivedCost: r2(received * cost),
        receivedSale: r2(received * sale),
        remarks: l.remarks ?? "",
      };
    };
    const sumInto = (target: Row, add: Row) => {
      for (const k of SUMMED) if (add[k] !== null && add[k] !== undefined) target[k] = r3(Number(target[k] ?? 0) + Number(add[k]));
    };

    const lines = docs.flatMap((d) => d.lines.filter(lineMatches).map((l) => lineRow(d, l)));
    // The lines behind each summary row (shown with its Action toggle).
    const linesOf = new Map<string, Row[]>();
    let rows: Row[];
    if (mode === "details") rows = lines;
    else if (mode === "transfer") {
      const byDoc = new Map<string, Row>();
      for (const line of lines) {
        const id = line._key.split(":")[0];
        const row: Row = byDoc.get(id) ?? { ...line, _key: id, ...Object.fromEntries(SUMMED.map((k) => [k, 0])) };
        sumInto(row, line);
        linesOf.set(id, [...(linesOf.get(id) ?? []), line]);
        byDoc.set(id, row);
      }
      rows = [...byDoc.values()];
    } else {
      const byItem = new Map<string, Row>();
      for (const line of lines) {
        const id = String(line.barcode) + "|" + String(line.itemName);
        const row: Row = byItem.get(id) ?? { ...line, _key: id, ...Object.fromEntries(SUMMED.map((k) => [k, 0])) };
        sumInto(row, line);
        linesOf.set(id, [...(linesOf.get(id) ?? []), line]);
        byItem.set(id, row);
      }
      rows = [...byItem.values()].sort((a, b) => String(a.itemName).localeCompare(String(b.itemName)));
    }
    return { rows, columns: columnsFor(view, mode), linesOf };
  }, [applied, report.data, data, itemById, supplierName, officeOfWarehouse]);

  const totals = Object.fromEntries(columns.filter((c) => c.kind).map((c) => [c.key, rows.reduce((t, r) => t + Number(r[c.key] ?? 0), 0)]));
  const firstNumeric = columns.findIndex((c) => c.kind);
  const hasAction = applied && !applied.details;
  // Prices, categories and suppliers come from the item list, so wait for it too.
  const loading = !!applied && (report.loading || masters.loading);

  const toggle = (key: string) =>
    setExpanded((all) => {
      const next = new Set(all);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const exportCsv = () => {
    const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const lines = [["SL", ...columns.map((c) => c.label)].map(esc).join(","), ...rows.map((r, i) => [String(i + 1), ...columns.map((c) => fmt(r[c.key], c.kind))].map(esc).join(","))];
    const url = URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" }));
    Object.assign(document.createElement("a"), { href: url, download: `transfer_report_${(applied?.view ?? "").replace(/\W+/g, "_").toLowerCase()}_${today()}.csv` }).click();
    URL.revokeObjectURL(url);
  };

  const officeName = (id: string) => offices.find(([o]) => o === id)?.[1] ?? "";
  const warehouseName = (id: string) => warehouses.find((w) => w.id === id)?.name ?? "";
  const nestedCols = applied ? columnsFor(applied.view as View, "details") : [];

  return (
    <div className="space-y-3 p-1 text-ink flex flex-col md:h-[calc(100dvh-3.5rem)] md:overflow-hidden print:block print:h-auto print:overflow-visible">
      <InventoryTabBar
        title="Transfer Report"
        tabs={[{ id: "REPORT", label: "Transfer Report" }]}
        active="REPORT"
        onChange={() => {}}
        actions={
          <>
            {perms.export && (<button type="button" className={tabBarOutlineButton} onClick={() => window.print()} disabled={!rows.length}>
              <FileText /> PDF
            </button>)}
            {perms.export && (<button type="button" className={tabBarOutlineButton} onClick={exportCsv} disabled={!rows.length}>
              <FileSpreadsheet /> Excel
            </button>)}
          </>
        }
      />

      {/* Filters */}
      <div className="grid grid-cols-1 items-end gap-3 rounded-lg border border-line bg-surface p-3 shadow-2xs sm:grid-cols-3 lg:grid-cols-6 print:hidden shrink-0">
        <div>
          <label className={labelCls} htmlFor="tr-view"><Req />View By</label>
          <select id="tr-view" className={field} value={form.view} onChange={(e) => set("view", e.target.value as View)}>
            <option value="">Select View By</option>
            {VIEWS.map((v) => <option key={v}>{v}</option>)}
          </select>
        </div>
        {form.view && (
          <div>
            <label className={labelCls} htmlFor="tr-based"><Req />Based On</label>
            <select id="tr-based" className={field} value={form.basedOn} onChange={(e) => set("basedOn", e.target.value as Based)}>
              <option value="">Select Based On</option>
              {BASED_ON.map((v) => <option key={v}>{v}</option>)}
            </select>
          </div>
        )}
        {form.basedOn === "Transfer" && (
          <div>
            <label className={labelCls} htmlFor="tr-code">Transfer Code</label>
            <input id="tr-code" className={field} placeholder="Search Transfer Code" value={form.transferCode} onChange={(e) => set("transferCode", e.target.value)} />
          </div>
        )}
        {form.basedOn === "Item" && (
          <div className="sm:col-span-2">
            <label className={labelCls} htmlFor="tr-item">Item</label>
            <select id="tr-item" className={field} value={form.itemId} onChange={(e) => set("itemId", e.target.value)}>
              <option value="">All Items</option>
              {(data?.items ?? []).map((i) => <option key={i.id} value={i.id}>{i.code} - {i.name}</option>)}
            </select>
          </div>
        )}
        {(form.basedOn === "Supplier" || form.basedOn === "Category") &&
          (form.basedOn === "Supplier" ? ["supplier", "category"] : ["category", "supplier"]).map((k) =>
            k === "supplier" ? (
              <div key={k}>
                <label className={labelCls} htmlFor="tr-sup">Supplier</label>
                <select id="tr-sup" className={field} value={form.supplierId} onChange={(e) => set("supplierId", e.target.value)}>
                  <option value="">All Suppliers</option>
                  {(data?.suppliers ?? []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            ) : (
              <div key={k}>
                <label className={labelCls} htmlFor="tr-cat">Category</label>
                <select id="tr-cat" className={field} value={form.category} onChange={(e) => set("category", e.target.value)}>
                  <option value="">All Categories</option>
                  {categories.map((c) => <option key={c}>{c}</option>)}
                </select>
              </div>
            ),
          )}
        {byPlace && (
          <>
            <div>
              <label className={labelCls} htmlFor="tr-fo">From Office</label>
              <select id="tr-fo" className={field} value={form.fromOfficeId} onChange={(e) => setForm((f) => ({ ...f, fromOfficeId: e.target.value, fromWarehouseId: "" }))}>
                <option value="">All Offices</option>
                {offices.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls} htmlFor="tr-fw">From Warehouse</label>
              <select id="tr-fw" className={`${field} disabled:bg-control disabled:text-ink-faint disabled:cursor-not-allowed`} value={form.fromWarehouseId} onChange={(e) => set("fromWarehouseId", e.target.value)} disabled={!form.fromOfficeId}>
                <option value="">{form.fromOfficeId ? "All Warehouses" : "Select From Office first"}</option>
                {warehouses.filter((w) => !!form.fromOfficeId && w.officeId === form.fromOfficeId).map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls} htmlFor="tr-to">To Office</label>
              <select id="tr-to" className={field} value={form.toOfficeId} onChange={(e) => setForm((f) => ({ ...f, toOfficeId: e.target.value, toWarehouseId: "" }))}>
                <option value="">All Offices</option>
                {offices.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls} htmlFor="tr-tw">To Warehouse</label>
              <select id="tr-tw" className={`${field} disabled:bg-control disabled:text-ink-faint disabled:cursor-not-allowed`} value={form.toWarehouseId} onChange={(e) => set("toWarehouseId", e.target.value)} disabled={!form.toOfficeId}>
                <option value="">{form.toOfficeId ? "All Warehouses" : "Select To Office first"}</option>
                {warehouses.filter((w) => !!form.toOfficeId && w.officeId === form.toOfficeId).map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls} htmlFor="tr-from"><Req />From Date</label>
              <NativeDateInput id="tr-from" type="date" className={field} value={form.from} onChange={(e) => set("from", e.target.value)} />
            </div>
            <div>
              <label className={labelCls} htmlFor="tr-todate"><Req />To Date</label>
              <NativeDateInput id="tr-todate" type="date" className={field} value={form.to} onChange={(e) => set("to", e.target.value)} />
            </div>
          </>
        )}
        {form.basedOn && (
          <div className="flex items-center gap-4">
            <label className="inline-flex min-h-8 cursor-pointer items-center gap-2 text-xs font-medium">
              <input type="checkbox" className="size-4 accent-primary" checked={form.details} onChange={(e) => set("details", e.target.checked)} />
              Is Details
            </label>
            <button
              type="button"
              disabled={!canView || loading}
              onClick={() => {
                setApplied({ ...form });
                setExpanded(new Set());
              }}
              className="inline-flex h-8 min-w-20 items-center justify-center gap-2 rounded bg-blue-600 px-4 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/30"
            >
              {loading && <Spinner className="size-3.5" />} View
            </button>
          </div>
        )}
      </div>

      {/* Report */}
      {!applied ? (
        <p className="py-16 text-center text-sm text-ink-faint shrink-0">Select View By and Based On, then View.</p>
      ) : loading ? (
        <div className="py-16 text-center shrink-0">
          <Spinner label="Loading report…" />
        </div>
      ) : (
        <div className="space-y-3 flex-1 min-h-0 flex flex-col print:block">
          <h2 className="hidden text-center text-lg font-bold print:block">Transfer Report — {applied.view}</h2>
          {applied.basedOn !== "Transfer" && (applied.fromOfficeId || applied.fromWarehouseId || applied.toOfficeId || applied.toWarehouseId) && (
            <div className="grid gap-3 text-xs sm:grid-cols-2 shrink-0">
              <dl className="rounded-lg border border-line bg-surface px-3 py-2">
                <div className="flex gap-1"><dt className="font-semibold">Sending/Issue Office:</dt><dd>{officeName(applied.fromOfficeId) || "All"}</dd></div>
                <div className="flex gap-1"><dt className="font-semibold">Sending/Issue Warehouse:</dt><dd>{warehouseName(applied.fromWarehouseId) || "All"}</dd></div>
              </dl>
              <dl className="rounded-lg border border-line bg-surface px-3 py-2">
                <div className="flex gap-1"><dt className="font-semibold">Requesting/Received Office:</dt><dd>{officeName(applied.toOfficeId) || "All"}</dd></div>
                <div className="flex gap-1"><dt className="font-semibold">Requesting/Received Warehouse:</dt><dd>{warehouseName(applied.toWarehouseId) || "All"}</dd></div>
              </dl>
            </div>
          )}
          <div className="rounded-lg border border-line bg-surface shadow-2xs flex-1 min-h-0 overflow-auto print:overflow-visible [&_thead]:sticky [&_thead]:top-0 [&_thead]:z-10">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="bg-blue-100/70 text-left font-semibold text-ink dark:bg-blue-500/15 dark:text-ink">
                  <th className="border-b border-line px-2.5 py-2">SL</th>
                  {hasAction && <th className="border-b border-line px-2.5 py-2 text-center">Action</th>}
                  {columns.map((c) => (
                    <th key={c.key} className={`border-b border-line px-2.5 py-2 ${c.kind ? "text-right" : ""}`}>{c.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={columns.length + 2} className="py-14 text-center text-ink-faint">No Data Found</td>
                  </tr>
                )}
                {rows.map((row, i) => {
                  const open = expanded.has(row._key);
                  const nested = linesOf.get(row._key);
                  return (
                    <Fragment key={row._key}>
                      <tr className="hover:bg-canvas">
                        <td className="border-b border-line px-2.5 py-2 text-ink-muted">{i + 1}</td>
                        {hasAction && (
                          <td className="border-b border-line px-1 py-1 text-center">
                            <button
                              type="button"
                              onClick={() => toggle(row._key)}
                              aria-expanded={open}
                              aria-label={`${open ? "Hide" : "Show"} lines of ${row.transferNo ?? row.itemName}`}
                              className="inline-flex size-6 items-center justify-center rounded text-ink-muted hover:bg-control hover:text-blue-600 dark:hover:text-blue-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/30"
                            >
                              {open ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                            </button>
                          </td>
                        )}
                        {columns.map((c) => (
                          <td key={c.key} className={`border-b border-line px-2.5 py-2 ${c.kind ? "whitespace-nowrap text-right tabular-nums" : NOWRAP.has(c.key) ? "whitespace-nowrap" : ""}`}>{fmt(row[c.key], c.kind)}</td>
                        ))}
                      </tr>
                      {open && nested && (
                        <tr>
                          <td colSpan={columns.length + 2} className="border-b border-line bg-canvas px-4 py-2">
                            <table className="w-full text-[11px]">
                              <thead>
                                <tr className="text-left text-ink-muted">
                                  {nestedCols.map((c) => <th key={c.key} className={`px-2 py-1 font-semibold ${c.kind ? "text-right" : ""}`}>{c.label}</th>)}
                                </tr>
                              </thead>
                              <tbody>
                                {nested.map((l) => (
                                  <tr key={l._key}>
                                    {nestedCols.map((c) => <td key={c.key} className={`px-2 py-1 ${c.kind ? "whitespace-nowrap text-right tabular-nums" : NOWRAP.has(c.key) ? "whitespace-nowrap" : ""}`}>{fmt(l[c.key], c.kind)}</td>)}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
              {rows.length > 0 && firstNumeric >= 0 && (
                <tfoot>
                  <tr className="bg-control font-semibold">
                    <td className="px-2.5 py-2" />
                    {hasAction && <td />}
                    {columns.map((c, ci) => (
                      <td key={c.key} className={`px-2.5 py-2 ${c.kind ? "whitespace-nowrap text-right tabular-nums" : ""}`}>
                        {ci === firstNumeric - 1 ? "Total" : c.kind ? fmt(totals[c.key], c.kind) : ""}
                      </td>
                    ))}
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
