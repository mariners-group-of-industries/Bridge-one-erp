"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Download, Printer, Search } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { useResource } from "@/hooks/use-resource";
import { dmy, inventoryApi, monthAgo, today } from "@/features/inventory/services/inventory.api";
import type { InventoryReportRow, LedgerRow } from "@/features/inventory/server/overview.service";

// ── Report views (iBOS "View By") ────────────────────────────────────────────

type Cell = string | number | null;
type Rec = Record<string, Cell>;
type Format = "text" | "qty" | "money" | "date" | "int";
interface Col {
  key: string;
  label: string;
  format?: Format;
  /** Summed in the footer. */
  total?: boolean;
}
type Source = "item" | "detail" | "warehouse" | "category" | "ledger" | "issue" | "pivot";
interface View {
  source: Source;
  columns: Col[];
  /** Keeps only some items (e.g. semi-finished goods for WIP). */
  only?: (r: Rec) => boolean;
  /** Inserts a subtotal row whenever this column changes. */
  groupBy?: string;
  note?: string;
}

const T = (key: string, label: string): Col => ({ key, label });
const Q = (key: string, label: string, total = true): Col => ({ key, label, format: "qty", total });
const M = (key: string, label: string, total = true): Col => ({ key, label, format: "money", total });
const D = (key: string, label: string): Col => ({ key, label, format: "date" });
const N = (key: string, label: string, total = false): Col => ({ key, label, format: "int", total });

const CODE = T("itemCode", "Code");
const ITEM = T("itemName", "Item");
const UOM = T("uom", "UoM");
const CLOSING = Q("closingQty", "Closing Qty");
const PRICE = M("rate", "Unit Price", false);
const VALUE = M("value", "Closing Value");

const VIEWS: Record<string, View> = {
  "Inventory Report": {
    source: "item",
    columns: [
      CODE, ITEM, T("itemType", "Item Type"), T("category", "Item Category"), T("subCategory", "Item SubCategory"),
      T("minorCategory", "Item MinorCategory"), T("supplier", "Supplier"), T("uomAlt", "UoM - Alt.UoM"),
      Q("openingQty", "Opening Qty"), Q("inQty", "In Qty/+"), Q("outQty", "Out Qty/-"), CLOSING, PRICE, VALUE,
    ],
  },
  "Stock History": {
    source: "ledger",
    columns: [D("date", "Date"), T("warehouse", "Warehouse"), CODE, ITEM, UOM, T("movement", "Transaction Type"), T("reference", "Reference"), Q("inQty", "In Qty"), Q("outQty", "Out Qty"), M("rate", "Rate", false), M("value", "Value")],
  },
  "Stock Report": { source: "item", columns: [CODE, ITEM, T("category", "Item Category"), UOM, CLOSING] },
  "Warehouse Wise Report": {
    source: "warehouse",
    columns: [T("office", "Office"), T("warehouse", "Warehouse"), N("items", "No. of Items", true), Q("openingQty", "Opening Qty"), Q("inQty", "In Qty"), Q("outQty", "Out Qty"), CLOSING, VALUE],
  },
  "Warehouse Wise Report Details": {
    source: "detail",
    columns: [T("office", "Office"), T("warehouse", "Warehouse"), CODE, ITEM, UOM, Q("openingQty", "Opening Qty"), Q("inQty", "In Qty"), Q("outQty", "Out Qty"), CLOSING, PRICE, VALUE],
  },
  "Stock Report(WIP)": {
    source: "item",
    only: (r) => /semi/i.test(String(r.itemType)),
    columns: [CODE, ITEM, T("category", "Item Category"), UOM, Q("inQty", "Produced/In"), Q("outQty", "Consumed/Out"), CLOSING, PRICE, VALUE],
    note: "Work in process = stock of items whose type is Semi Finished Goods.",
  },
  "Serial Report": {
    source: "item",
    only: () => false,
    columns: [CODE, ITEM, T("serial", "Serial No"), UOM, CLOSING],
    note: "Items are not tracked by serial number yet (Item setup offers None or Batch), so there is nothing to list.",
  },
  "Batch Wise Stock Report": {
    source: "detail",
    only: (r) => r.tracking === "BATCH",
    columns: [T("warehouse", "Warehouse"), CODE, ITEM, UOM, D("lastInDate", "Last Receive"), CLOSING, VALUE],
    note: "Batch-tracked items. Batch numbers are not recorded on receipts yet, so stock is shown per warehouse.",
  },
  "Stock Summary": {
    source: "category",
    columns: [T("category", "Item Category"), N("items", "No. of Items", true), Q("openingQty", "Opening Qty"), Q("inQty", "In Qty"), Q("outQty", "Out Qty"), CLOSING, VALUE],
  },
  "Item Report": {
    source: "item",
    columns: [CODE, ITEM, T("itemType", "Item Type"), T("category", "Item Category"), T("subCategory", "Item SubCategory"), T("minorCategory", "Item MinorCategory"), UOM, T("altUom", "Alt. UoM"), T("supplier", "Supplier"), PRICE],
  },
  "Item Wise Stock Report": { source: "pivot", columns: [CODE, ITEM, UOM] },
  "Item Details(Inventory)": {
    source: "item",
    columns: [CODE, ITEM, T("itemType", "Item Type"), T("category", "Item Category"), UOM, T("warehouses", "Warehouses"), D("lastInDate", "Last Receive"), D("lastOutDate", "Last Issue"), CLOSING, PRICE, VALUE],
  },
  "Stock Report (Item Category)": {
    source: "item",
    groupBy: "category",
    columns: [T("category", "Item Category"), T("subCategory", "Item SubCategory"), CODE, ITEM, UOM, CLOSING, PRICE, VALUE],
  },
  "Inventory Aging Report": {
    source: "item",
    columns: [CODE, ITEM, UOM, CLOSING, Q("age0", "0-30 Days"), Q("age31", "31-60 Days"), Q("age61", "61-90 Days"), Q("age91", "91-180 Days"), Q("age181", "180+ Days"), VALUE],
    note: "Closing stock is aged first in, first out: what is on hand came from the latest receipts.",
  },
  "Demand Estimation": {
    source: "item",
    columns: [CODE, ITEM, UOM, Q("outQty", "Out Qty (Period)"), Q("avgDailyOut", "Avg. Daily Out", false), CLOSING, Q("pipelineQty", "Pipeline Qty"), Q("demand30", "Next 30 Days Demand"), Q("shortfall", "Shortfall")],
    note: "Demand = average daily out of the period × 30. Shortfall = demand − closing − pipeline.",
  },
  "Item Issue Report": {
    source: "issue",
    columns: [D("date", "Issue Date"), T("warehouse", "Warehouse"), CODE, ITEM, UOM, T("reference", "Reference"), Q("outQty", "Issue Qty"), M("rate", "Rate", false), M("value", "Value")],
  },
  "Serial Stock Report": {
    source: "detail",
    only: () => false,
    columns: [T("warehouse", "Warehouse"), CODE, ITEM, T("serial", "Serial No"), CLOSING],
    note: "Items are not tracked by serial number yet (Item setup offers None or Batch), so there is nothing to list.",
  },
  "Stock Report (With Value)": { source: "item", columns: [CODE, ITEM, T("category", "Item Category"), UOM, CLOSING, PRICE, VALUE] },
  "Stock Report (With Unit)": { source: "item", columns: [CODE, ITEM, UOM, CLOSING, T("altUom", "Alt. UoM"), Q("altQty", "Alt. Qty")] },
  "Current Stock Pipeline Coverage Days Analysis": {
    source: "item",
    columns: [CODE, ITEM, UOM, CLOSING, Q("pendingPoQty", "Pending PO Qty"), Q("inTransitQty", "In Transit Qty"), Q("pipelineQty", "Pipeline Qty"), Q("avgDailyOut", "Avg. Daily Out", false), N("coverageDays", "Stock Coverage Days"), N("pipelineCoverageDays", "Coverage Days With Pipeline")],
    note: "Coverage days = quantity ÷ average daily out of the period. Pipeline = approved purchase orders not received + transfers in transit.",
  },
  "Stock In/Out and Aging report": {
    source: "item",
    columns: [CODE, ITEM, UOM, Q("openingQty", "Opening Qty"), Q("inQty", "In Qty"), Q("outQty", "Out Qty"), CLOSING, D("lastInDate", "Last In Date"), D("lastOutDate", "Last Out Date"), N("daysSinceIn", "Days Since In"), N("daysSinceOut", "Days Since Out")],
  },
};
const VIEW_NAMES = Object.keys(VIEWS);

const ITEM_TYPES = [
  "Finished/Trading Goods",
  "Raw Material",
  "Maintenance, Repair, and Operating Supplies",
  "Marketing and Communication Material",
  "Packaging Material",
  "Production Tools and Resources",
  "Semi Finished Goods",
  "Stationery & Consumable Item",
  "Construction Materials",
];

// ── Aggregation ──────────────────────────────────────────────────────────────

const r3 = (n: number) => Math.round(n * 1000) / 1000;
const r2 = (n: number) => Math.round(n * 100) / 100;
const DAY = 86_400_000;
const daysFrom = (date: Cell, to: string) => (date ? Math.max(0, Math.round((Date.parse(to) - Date.parse(String(date))) / DAY)) : null);
const latest = (a: Cell, b: Cell) => (!a ? b : !b ? a : String(a) > String(b) ? a : b);
const SUMS = ["openingQty", "inQty", "outQty", "issueQty", "closingQty", "value", "pendingPoQty", "inTransitQty", "age0", "age31", "age61", "age91", "age181"] as const;

function flatten(r: InventoryReportRow): Rec {
  return {
    ...r,
    aging: null,
    uomAlt: r.altUom ? `${r.uom} - ${r.altUom}` : r.uom,
    age0: r.aging.d0_30,
    age31: r.aging.d31_60,
    age61: r.aging.d61_90,
    age91: r.aging.d91_180,
    age181: r.aging.d181,
    warehouses: r.warehouse,
  };
}

function sumInto(target: Rec, source: Rec) {
  for (const k of SUMS) target[k] = r3(Number(target[k] ?? 0) + Number(source[k] ?? 0));
}

function groupRows(rows: Rec[], keyOf: (r: Rec) => string, seed: (r: Rec) => Rec): Rec[] {
  const out = new Map<string, Rec>();
  for (const r of rows) {
    const key = keyOf(r);
    const g = out.get(key);
    if (!g) {
      out.set(key, { ...seed(r), items: 1, _items: String(r.itemId) });
      continue;
    }
    sumInto(g, r);
    if (!String(g._items).split(",").includes(String(r.itemId))) {
      g._items = `${g._items},${r.itemId}`;
      g.items = Number(g.items) + 1;
    }
    g.lastInDate = latest(g.lastInDate, r.lastInDate);
    g.lastOutDate = latest(g.lastOutDate, r.lastOutDate);
    if (r.warehouse && !String(g.warehouses).split(", ").includes(String(r.warehouse))) g.warehouses = `${g.warehouses}, ${r.warehouse}`;
  }
  return [...out.values()];
}

/** Adds the per-item figures the analysis views show (period length in days). */
function derive(r: Rec, days: number, to: string): Rec {
  const closing = Number(r.closingQty);
  const avg = Number(r.outQty) / days;
  const pipeline = Number(r.pendingPoQty) + Number(r.inTransitQty);
  const demand = avg * 30;
  const factor = Number(r.altUomFactor);
  return {
    ...r,
    value: r2(Number(r.value)),
    pipelineQty: r3(pipeline),
    avgDailyOut: r3(avg),
    demand30: r3(demand),
    shortfall: r3(Math.max(0, demand - closing - pipeline)),
    coverageDays: avg > 0 ? Math.round(closing / avg) : null,
    pipelineCoverageDays: avg > 0 ? Math.round((closing + pipeline) / avg) : null,
    altQty: r.altUom && factor > 0 ? r3(closing / factor) : null,
    daysSinceIn: daysFrom(r.lastInDate, to),
    daysSinceOut: daysFrom(r.lastOutDate, to),
  };
}

const fmt = (v: Cell, format: Format = "text") => {
  if (v === null || v === undefined || v === "") return format === "text" ? "N/A" : "";
  if (format === "qty") return Number(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 3 });
  if (format === "money") return Number(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (format === "date") return dmy(String(v));
  return String(v);
};

// ── Page ─────────────────────────────────────────────────────────────────────

const field = "h-9 w-full rounded-md border border-line bg-surface px-2.5 text-[13px] text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/20 disabled:bg-control disabled:text-ink-faint";
const labelCls = "mb-1 block text-xs font-medium text-ink-muted";
const iconBtn = "inline-flex size-8 items-center justify-center rounded-md border border-line bg-surface text-ink-muted hover:bg-control disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/20";
const outlineBtn = "inline-flex h-9 items-center gap-1.5 rounded-md border border-blue-600 bg-surface px-3.5 text-xs font-semibold text-blue-600 hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/20 dark:hover:bg-blue-500/10";

export default function InventoryReportPage() {
  const [viewBy, setViewBy] = useState("Inventory Report");
  const [search, setSearch] = useState("");
  const [officeId, setOfficeId] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [itemType, setItemType] = useState("");
  const [category, setCategory] = useState("");
  const [subCategory, setSubCategory] = useState("");
  const [minorCategory, setMinorCategory] = useState("");
  const [supplier, setSupplier] = useState("");
  const [fromDate, setFromDate] = useState(monthAgo());
  const [toDate, setToDate] = useState(today());
  const [netWeight, setNetWeight] = useState(false);
  const [withoutZero, setWithoutZero] = useState(false);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(50);

  // Figures are loaded for the period and view applied with View.
  const [applied, setApplied] = useState({ from: fromDate, to: toDate, view: viewBy });
  const view = VIEWS[applied.view];
  const usesLedger = view.source === "ledger" || view.source === "issue";

  const masters = useResource("inventory-masters", () => inventoryApi.masters());
  const report = useResource(usesLedger ? null : `inventory-report-${applied.from}-${applied.to}`, () => inventoryApi.inventoryReport({ from: applied.from, to: applied.to }));
  const ledger = useResource(usesLedger ? `inventory-ledger-${applied.from}-${applied.to}` : null, () => inventoryApi.ledger({ from: applied.from, to: applied.to }));
  const loading = usesLedger ? ledger.loading : report.loading;

  // Filter choices.
  const warehouses = useMemo(() => masters.data?.warehouses ?? [], [masters.data]);
  const offices = useMemo(() => [...new Map(warehouses.map((w) => [w.officeId, w.officeName])).entries()].sort((a, b) => a[1].localeCompare(b[1])), [warehouses]);
  const officeWarehouses = warehouses.filter((w) => !officeId || w.officeId === officeId);
  const items = useMemo(() => masters.data?.items ?? [], [masters.data]);
  const uniq = (values: (string | null)[]) => [...new Set(values.filter((v): v is string => !!v))].sort();
  const itemTypes = uniq([...ITEM_TYPES, ...items.map((i) => i.itemType)]);
  const categories = uniq(items.filter((i) => !itemType || i.itemType === itemType).map((i) => i.category));
  const subCategories = uniq(items.filter((i) => !category || i.category === category).map((i) => i.subCategory));
  const minorCategories = uniq(items.filter((i) => (!category || i.category === category) && (!subCategory || i.subCategory === subCategory)).map((i) => i.minorCategory));
  const suppliers = masters.data?.suppliers ?? [];

  const days = Math.max(1, Math.round((Date.parse(applied.to) - Date.parse(applied.from)) / DAY) + 1);
  const warehouseNames = useMemo(() => new Map(warehouses.map((w) => [w.name, w.officeId])), [warehouses]);

  // Stock rows after the filters (per warehouse and item).
  const detail = useMemo<Rec[]>(() => {
    const officeOf = (r: InventoryReportRow) => r.officeId;
    return (report.data ?? [])
      .filter((r) => (!officeId || officeOf(r) === officeId) && (!warehouseId || r.warehouseId === warehouseId))
      .filter((r) => (!itemType || r.itemType === itemType) && (!category || r.category === category))
      .filter((r) => (!subCategory || r.subCategory === subCategory) && (!minorCategory || r.minorCategory === minorCategory))
      .filter((r) => !supplier || r.supplier === supplier)
      .map(flatten);
  }, [report.data, officeId, warehouseId, itemType, category, subCategory, minorCategory, supplier]);

  const { rows, columns } = useMemo(() => {
    let rows: Rec[];
    let columns = [...view.columns];
    switch (view.source) {
      case "ledger":
      case "issue": {
        const byCategory = new Map(items.map((i) => [i.code, i]));
        rows = (ledger.data ?? [])
          .filter((l: LedgerRow) => view.source === "ledger" || l.movement === "Store Issue")
          .filter((l) => (!officeId || warehouseNames.get(l.warehouse) === officeId) && (!warehouseId || warehouses.find((w) => w.id === warehouseId)?.name === l.warehouse))
          .filter((l) => {
            const it = byCategory.get(l.itemCode);
            return (!itemType || it?.itemType === itemType) && (!category || l.category === category) && (!subCategory || it?.subCategory === subCategory) && (!minorCategory || it?.minorCategory === minorCategory);
          })
          .map((l) => ({ ...l }));
        break;
      }
      case "detail":
        rows = detail.map((r) => derive(r, days, applied.to));
        break;
      case "warehouse":
        rows = groupRows(detail, (r) => String(r.warehouseId), (r) => ({ ...r }));
        break;
      case "category":
        rows = groupRows(detail, (r) => String(r.category), (r) => ({ ...r }));
        break;
      case "pivot": {
        const names = uniq(detail.map((r) => String(r.warehouse)));
        const byItem = new Map<string, Rec>();
        for (const r of detail) {
          const row = byItem.get(String(r.itemId)) ?? { itemId: r.itemId, itemCode: r.itemCode, itemName: r.itemName, uom: r.uom, closingQty: 0, value: 0 };
          row[`wh:${r.warehouse}`] = r3(Number(row[`wh:${r.warehouse}`] ?? 0) + Number(r.closingQty));
          row.closingQty = r3(Number(row.closingQty) + Number(r.closingQty));
          row.value = r2(Number(row.value) + Number(r.value));
          byItem.set(String(r.itemId), row);
        }
        rows = [...byItem.values()].sort((a, b) => String(a.itemName).localeCompare(String(b.itemName)));
        columns = [...columns, ...names.map((n) => Q(`wh:${n}`, n)), Q("closingQty", "Total Qty"), VALUE];
        break;
      }
      default:
        rows = groupRows(detail, (r) => String(r.itemId), (r) => ({ ...r }))
          .map((r) => derive(r, days, applied.to))
          .sort((a, b) => String(a.itemName).localeCompare(String(b.itemName)));
    }
    if (view.only) rows = rows.filter(view.only);
    if (withoutZero && !usesLedger) rows = rows.filter((r) => Math.abs(Number(r.closingQty)) > 1e-9);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      rows = rows.filter((r) => columns.some((c) => String(r[c.key] ?? "").toLowerCase().includes(q)));
    }
    if (view.groupBy) rows = [...rows].sort((a, b) => String(a[view.groupBy!]).localeCompare(String(b[view.groupBy!])) || String(a.itemName).localeCompare(String(b.itemName)));
    if (netWeight && applied.view === "Inventory Report") {
      rows = rows.map((r) => ({ ...r, netWeightKg: r3(Number(r.netWeight ?? 0) * Number(r.closingQty)) }));
      columns = [...columns.slice(0, -2), Q("netWeightKg", "Net Weight (Kg)"), ...columns.slice(-2)];
    }
    return { rows, columns };
  }, [view, applied, detail, ledger.data, items, officeId, warehouseId, itemType, category, subCategory, minorCategory, warehouses, warehouseNames, withoutZero, usesLedger, search, netWeight, days]);

  const pages = Math.max(1, Math.ceil(rows.length / perPage));
  const current = Math.min(page, pages);
  const shown = rows.slice((current - 1) * perPage, current * perPage);
  const totals = Object.fromEntries(columns.filter((c) => c.total).map((c) => [c.key, rows.reduce((t, r) => t + Number(r[c.key] ?? 0), 0)]));
  const firstTotal = columns.findIndex((c) => c.total);

  // Subtotal rows for grouped views (within the shown page).
  const body: { row: Rec; subtotal?: string }[] = [];
  shown.forEach((row, i) => {
    body.push({ row });
    const g = view.groupBy;
    if (g && (i === shown.length - 1 || shown[i + 1][g] !== row[g])) {
      const group = rows.filter((r) => r[g] === row[g]);
      body.push({ row: Object.fromEntries(columns.filter((c) => c.total).map((c) => [c.key, group.reduce((t, r) => t + Number(r[c.key] ?? 0), 0)])), subtotal: `${row[g]} total` });
    }
  });

  const exportCsv = () => {
    const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const lines = [["SL", ...columns.map((c) => c.label)].map(esc).join(","), ...rows.map((r, i) => [String(i + 1), ...columns.map((c) => fmt(r[c.key], c.format))].map(esc).join(","))];
    const url = URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: `${applied.view.replace(/[^\w]+/g, "_").toLowerCase()}_${applied.to}.csv` });
    a.click();
    URL.revokeObjectURL(url);
  };

  const apply = () => {
    setApplied({ from: fromDate, to: toDate, view: viewBy });
    setPage(1);
  };
  const error = (usesLedger ? ledger.error : report.error)?.message;
  const isRight = (c: Col) => c.format === "qty" || c.format === "money" || c.format === "int";

  return (
    <div className="space-y-3 p-1 text-ink">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between print:hidden">
        <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Inventory Report</h1>
        <div className="flex flex-wrap items-center gap-2">
          <label className="relative">
            <span className="sr-only">Search</span>
            <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search...." className={`${field} w-56 pr-8 sm:w-64`} />
            <Search className="pointer-events-none absolute right-2.5 top-1/2 size-3.5 -translate-y-1/2 text-ink-faint" aria-hidden />
          </label>
          <button type="button" onClick={exportCsv} disabled={!rows.length} className={outlineBtn}>
            <Download className="size-3.5" aria-hidden /> EXCEL
          </button>
          <button type="button" onClick={() => window.print()} className={outlineBtn}>
            <Printer className="size-3.5" aria-hidden /> PRINT/PDF
          </button>
        </div>
      </div>

      <div className="space-y-3 rounded-lg border border-line bg-surface p-3 shadow-2xs print:hidden">
        <div className="sm:w-1/2 lg:w-[34rem]">
          <label className={labelCls} htmlFor="view-by">
            View By <span className="text-rose-600">*</span>
          </label>
          <select id="view-by" value={viewBy} onChange={(e) => setViewBy(e.target.value)} className={field}>
            {VIEW_NAMES.map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-6">
          <div>
            <label className={labelCls} htmlFor="f-office">Office</label>
            <select id="f-office" value={officeId} onChange={(e) => { setOfficeId(e.target.value); setWarehouseId(""); }} className={field}>
              <option value="">All</option>
              {offices.map(([id, name]) => (
                <option key={id} value={id}>{name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls} htmlFor="f-wh">Warehouse (Location)</label>
            <select id="f-wh" value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} className={field}>
              <option value="">All</option>
              {officeWarehouses.map((w) => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls} htmlFor="f-type">Item Type</label>
            <select id="f-type" value={itemType} onChange={(e) => { setItemType(e.target.value); setCategory(""); setSubCategory(""); setMinorCategory(""); }} className={field}>
              <option value="">ALL</option>
              {itemTypes.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls} htmlFor="f-cat">Item Category</label>
            <select id="f-cat" value={category} onChange={(e) => { setCategory(e.target.value); setSubCategory(""); setMinorCategory(""); }} className={field}>
              <option value="">Item Category</option>
              {categories.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls} htmlFor="f-sub">Sub Category</label>
            <select id="f-sub" value={subCategory} onChange={(e) => { setSubCategory(e.target.value); setMinorCategory(""); }} disabled={!category} className={field}>
              <option value="">Select Sub Category</option>
              {subCategories.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls} htmlFor="f-minor">Minor Category</label>
            <select id="f-minor" value={minorCategory} onChange={(e) => setMinorCategory(e.target.value)} disabled={!subCategory} className={field}>
              <option value="">Select Minor Category</option>
              {minorCategories.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls} htmlFor="f-sup">Supplier</label>
            <select id="f-sup" value={supplier} onChange={(e) => setSupplier(e.target.value)} className={field}>
              <option value="">Select/Search Supplier</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.name}>{s.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls} htmlFor="f-from">From Date</label>
            <input id="f-from" type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className={field} />
          </div>
          <div>
            <label className={labelCls} htmlFor="f-to">To Date</label>
            <input id="f-to" type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className={field} />
          </div>
          <label className="flex min-h-9 cursor-pointer items-center gap-2 self-end text-[13px]">
            <input type="checkbox" checked={netWeight} onChange={(e) => setNetWeight(e.target.checked)} className="size-4 rounded border-line" /> Net Weight
          </label>
          <label className="flex min-h-9 cursor-pointer items-center gap-2 self-end text-[13px]">
            <input type="checkbox" checked={withoutZero} onChange={(e) => { setWithoutZero(e.target.checked); setPage(1); }} className="size-4 rounded border-line" /> Without Zero Stock
          </label>
          <div className="self-end">
            <button
              type="button"
              onClick={apply}
              disabled={!fromDate || !toDate || fromDate > toDate || loading}
              className="inline-flex h-9 min-w-24 items-center justify-center gap-2 rounded-md bg-blue-600 px-4 text-[13px] font-semibold text-white hover:bg-blue-700 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/20"
            >
              {loading && <Spinner className="size-4" />} View
            </button>
          </div>
        </div>
      </div>

      <div className="hidden text-center print:block">
        <h2 className="text-lg font-bold">{applied.view}</h2>
        <p className="text-xs">From {dmy(applied.from)} to {dmy(applied.to)}</p>
      </div>

      {view.note && <p className="rounded-md border border-line bg-control px-3 py-2 text-xs text-ink-muted print:hidden">{view.note}</p>}
      {error && <p className="rounded-md border border-rose-200 bg-rose-500/10 px-3 py-2 text-xs text-rose-700">{error}</p>}

      <div className="overflow-hidden rounded-lg border border-line bg-surface shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr className="bg-blue-50 text-left text-xs font-semibold text-ink dark:bg-blue-500/10">
                <th className="border-b border-line px-2.5 py-2.5">SL</th>
                {columns.map((c) => (
                  <th key={c.key} className={`border-b border-l border-line px-2.5 py-2.5 ${isRight(c) ? "text-right" : ""}`}>
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={columns.length + 1} className="py-10 text-center">
                    <Spinner label="Loading report…" />
                  </td>
                </tr>
              )}
              {!loading && !rows.length && (
                <tr>
                  <td colSpan={columns.length + 1} className="py-10 text-center text-ink-faint">
                    No data found
                  </td>
                </tr>
              )}
              {!loading &&
                body.map(({ row, subtotal }, i) =>
                  subtotal ? (
                    <tr key={`s${i}`} className="bg-control font-semibold">
                      <td className="border-b border-line px-2.5 py-2" />
                      {columns.map((c, ci) => (
                        <td key={c.key} className={`border-b border-l border-line px-2.5 py-2 ${isRight(c) ? "text-right tabular-nums" : ""}`}>
                          {ci === 0 ? subtotal : c.total ? fmt(row[c.key] ?? 0, c.format) : ""}
                        </td>
                      ))}
                    </tr>
                  ) : (
                    <tr key={`r${i}`} className="align-top hover:bg-canvas">
                      <td className="border-b border-line px-2.5 py-2 text-ink-muted">{(current - 1) * perPage + body.slice(0, i).filter((b) => !b.subtotal).length + 1}</td>
                      {columns.map((c) => (
                        <td key={c.key} className={`border-b border-l border-line px-2.5 py-2 ${isRight(c) ? "whitespace-nowrap text-right tabular-nums" : ""} ${c.key === "itemCode" ? "whitespace-nowrap font-mono text-xs" : ""}`}>
                          {fmt(row[c.key], c.format)}
                        </td>
                      ))}
                    </tr>
                  ),
                )}
            </tbody>
            {!loading && rows.length > 0 && firstTotal >= 0 && (
              <tfoot>
                <tr className="bg-control font-semibold">
                  <td className="px-2.5 py-2" />
                  {columns.map((c, ci) => (
                    <td key={c.key} className={`border-l border-line px-2.5 py-2 ${isRight(c) ? "whitespace-nowrap text-right tabular-nums" : ""}`}>
                      {ci === firstTotal - 1 || (firstTotal === 0 && ci === 0) ? `Total of ${rows.length}` : c.total ? fmt(totals[c.key], c.format) : ""}
                    </td>
                  ))}
                </tr>
              </tfoot>
            )}
          </table>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-4 border-t border-line px-3 py-2 text-xs text-ink-muted print:hidden">
          <label className="flex items-center gap-2">
            Rows per page:
            <select value={perPage} onChange={(e) => { setPerPage(Number(e.target.value)); setPage(1); }} className="h-8 rounded-md border border-line bg-surface px-1.5 text-xs">
              {[25, 50, 100, 200].map((n) => (
                <option key={n}>{n}</option>
              ))}
            </select>
          </label>
          <span>
            {rows.length ? (current - 1) * perPage + 1 : 0}–{Math.min(current * perPage, rows.length)} of {rows.length}
          </span>
          <div className="flex gap-1">
            <button type="button" aria-label="Previous page" disabled={current <= 1} onClick={() => setPage(current - 1)} className={iconBtn}>
              <ChevronLeft className="size-4" />
            </button>
            <button type="button" aria-label="Next page" disabled={current >= pages} onClick={() => setPage(current + 1)} className={iconBtn}>
              <ChevronRight className="size-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
