import type { StockSource } from "@/generated/prisma/client";
import type { Actor } from "@/lib/auth/actor";
import { db } from "@/lib/prisma/client";
import { fromDbDate, toDbDate } from "@/features/sales/lib/dates";
import { scopedBusinessUnitIds } from "@/features/sales/lib/scope";
import type { InventoryKpis, MovingFrequencyItem, TransactionValueItem, TurnoverRatioItem, ValuationCategory } from "../types";

/** What each ledger movement is called on inventory screens. */
export const STOCK_SOURCE_LABELS: Record<StockSource, string> = {
  OPENING: "Opening Balance",
  ADJUSTMENT: "Stock Update",
  SALES_DELIVERY: "Sales Delivery",
  SALES_RETURN: "Sales Return",
  PRODUCTION_CONSUMPTION: "Production Consumption",
  PRODUCTION_OUTPUT: "Receive from Production",
  PURCHASE_RECEIPT: "Purchase",
  PURCHASE_RETURN: "Purchase Return",
  TRANSFER_OUT: "Transfer Out",
  TRANSFER_IN: "Transfer In",
  STORE_ISSUE: "Store Issue",
  CONVERSION_OUT: "Conversion Out",
  CONVERSION_IN: "Conversion In",
};

const COLORS = ["#38effe", "#b939e5", "#3b82f6", "#facc15", "#22c55e", "#f97316", "#ef4444", "#64748b"];
const round = (value: number, digits = 2) => Math.round(value * 10 ** digits) / 10 ** digits;
const DAY = 86_400_000;

export interface InventoryOverview {
  from: string;
  to: string;
  kpis: InventoryKpis;
  valuationData: ValuationCategory[];
  topTransactions: TransactionValueItem[];
  movingFrequencies: MovingFrequencyItem[];
  turnoverRatios: TurnoverRatioItem[];
  /** Turnover and coverage over all categories. */
  overallTurnover: number;
  overallCoverageDays: number;
  /** Closing stock value / average daily outflow, per day of the period. */
  coverage: { day: string; days: number }[];
  warehouses: { id: string; name: string }[];
  categories: string[];
}

export interface OverviewFilters {
  from: string;
  to: string;
  warehouseId?: string;
  category?: string;
}

/** Stock value is quantity × the item's purchase price (sales rate when it has none). */
export async function inventoryOverview(actor: Actor, filters: OverviewFilters): Promise<InventoryOverview> {
  const unitIds = await scopedBusinessUnitIds(actor);
  const from = toDbDate(filters.from);
  const to = toDbDate(filters.to);
  const [warehouses, entries] = await Promise.all([
    db().warehouse.findMany({ where: { office: { businessUnitId: { in: unitIds } } }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    db().stockEntry.findMany({
      where: { businessUnitId: { in: unitIds }, postingDate: { lte: to }, ...(filters.warehouseId ? { warehouseId: filters.warehouseId } : {}) },
      select: {
        qty: true,
        source: true,
        postingDate: true,
        item: { select: { id: true, name: true, uom: true, purchasePrice: true, salesRate: true, category: { select: { name: true } } } },
      },
    }),
  ]);

  const categoryOf = (e: (typeof entries)[number]) => e.item.category?.name ?? "Uncategorised";
  const categories = [...new Set(entries.map(categoryOf))].sort();
  const rows = filters.category ? entries.filter((e) => categoryOf(e) === filters.category) : entries;
  const value = (e: (typeof entries)[number]) => Number(e.qty) * Number(e.item.purchasePrice ?? e.item.salesRate ?? 0);

  let opening = 0;
  let inflow = 0;
  let outflow = 0;
  const closingByCategory = new Map<string, number>();
  const openingByCategory = new Map<string, number>();
  const outByCategory = new Map<string, number>();
  const bySource = new Map<StockSource, number>();
  const moves = new Map<string, { name: string; category: string; uom: string; count: number }>();
  const outByDay = new Map<string, number>();
  const netByDay = new Map<string, number>();

  for (const e of rows) {
    const v = value(e);
    const category = categoryOf(e);
    closingByCategory.set(category, (closingByCategory.get(category) ?? 0) + v);
    if (e.postingDate < from) {
      opening += v;
      openingByCategory.set(category, (openingByCategory.get(category) ?? 0) + v);
      continue;
    }
    const day = fromDbDate(e.postingDate);
    netByDay.set(day, (netByDay.get(day) ?? 0) + v);
    if (v >= 0) inflow += v;
    else {
      outflow -= v;
      outByCategory.set(category, (outByCategory.get(category) ?? 0) - v);
      outByDay.set(day, (outByDay.get(day) ?? 0) - v);
    }
    bySource.set(e.source, (bySource.get(e.source) ?? 0) + Math.abs(v));
    const m = moves.get(e.item.id) ?? { name: e.item.name, category, uom: e.item.uom, count: 0 };
    m.count += 1;
    moves.set(e.item.id, m);
  }

  const closing = opening + inflow - outflow;
  const days = Math.max(1, Math.round((to.getTime() - from.getTime()) / DAY) + 1);
  const positive = [...closingByCategory].filter(([, v]) => v > 0);
  const positiveTotal = positive.reduce((t, [, v]) => t + v, 0);
  const valuationData = positive
    .sort((a, b) => b[1] - a[1])
    .map(([name, v], i) => ({ name, value: round((v / positiveTotal) * 100, 1), percentage: round((v / positiveTotal) * 100, 1), color: COLORS[i % COLORS.length] }));

  const turnover = (out: number, start: number, end: number) => {
    const average = (start + end) / 2;
    return average > 0 ? out / average : 0;
  };
  // Annualised: turnover over the period scaled to a year; coverage = days of outflow the closing stock lasts.
  const annual = 365 / days;
  const coverageDays = (end: number, out: number) => (out > 0 ? Math.round(end / (out / days)) : 0);
  const turnoverRatios = [...closingByCategory.keys()]
    .map((category) => {
      const out = outByCategory.get(category) ?? 0;
      const start = openingByCategory.get(category) ?? 0;
      const end = closingByCategory.get(category) ?? 0;
      return { category, ratio: round(turnover(out, start, end) * annual, 1), coverageDays: coverageDays(end, out), targetRatio: 0 };
    })
    .filter((t) => t.ratio > 0 || t.coverageDays > 0)
    .sort((a, b) => b.ratio - a.ratio);

  // Daily coverage: closing value of the day / average daily outflow of the period.
  const avgDailyOut = outflow / days;
  const coverage: InventoryOverview["coverage"] = [];
  let running = opening;
  for (let t = from.getTime(); t <= to.getTime() && avgDailyOut > 0; t += DAY) {
    const day = fromDbDate(new Date(t));
    running += netByDay.get(day) ?? 0;
    coverage.push({ day: day.slice(5), days: Math.max(0, Math.round(running / avgDailyOut)) });
  }

  return {
    from: filters.from,
    to: filters.to,
    kpis: { openingBalance: round(opening), inventoryIn: round(inflow), inventoryOut: round(outflow), totalBalance: round(closing) },
    valuationData,
    topTransactions: [...bySource]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([source, amount], i) => ({ id: i + 1, rank: i + 1, name: STOCK_SOURCE_LABELS[source], amount: round(amount) })),
    movingFrequencies: [...moves.values()]
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
      .map((m, i) => ({ id: i + 1, rank: i + 1, name: m.name, category: m.category, frequency: m.count, unit: m.uom })),
    turnoverRatios,
    overallTurnover: round(turnover(outflow, opening, closing) * annual, 1),
    overallCoverageDays: coverageDays(closing, outflow),
    coverage,
    warehouses,
    categories,
  };
}

export interface LedgerRow {
  date: string;
  warehouse: string;
  itemCode: string;
  itemName: string;
  category: string;
  uom: string;
  movement: string;
  reference: string;
  inQty: number;
  outQty: number;
  rate: number;
  value: number;
}

/** Stock ledger lines of a period (newest first), for the inventory reports. */
export async function stockLedger(actor: Actor, filters: OverviewFilters & { itemId?: string }): Promise<LedgerRow[]> {
  const unitIds = await scopedBusinessUnitIds(actor);
  const entries = await db().stockEntry.findMany({
    where: {
      businessUnitId: { in: unitIds },
      postingDate: { gte: toDbDate(filters.from), lte: toDbDate(filters.to) },
      ...(filters.warehouseId ? { warehouseId: filters.warehouseId } : {}),
      ...(filters.itemId ? { itemId: filters.itemId } : {}),
      ...(filters.category ? { item: { category: { name: filters.category } } } : {}),
    },
    select: {
      qty: true,
      source: true,
      postingDate: true,
      remarks: true,
      warehouse: { select: { name: true } },
      item: { select: { code: true, name: true, uom: true, purchasePrice: true, salesRate: true, category: { select: { name: true } } } },
    },
    orderBy: [{ postingDate: "desc" }, { createdAt: "desc" }],
    take: 5000,
  });
  return entries.map((e) => {
    const qty = Number(e.qty);
    const rate = Number(e.item.purchasePrice ?? e.item.salesRate ?? 0);
    return {
      date: fromDbDate(e.postingDate),
      warehouse: e.warehouse.name,
      itemCode: e.item.code,
      itemName: e.item.name,
      category: e.item.category?.name ?? "Uncategorised",
      uom: e.item.uom,
      movement: STOCK_SOURCE_LABELS[e.source],
      reference: e.remarks ?? "",
      inQty: qty > 0 ? qty : 0,
      outQty: qty < 0 ? -qty : 0,
      rate,
      value: round(Math.abs(qty) * rate),
    };
  });
}

/** Stock on hand per warehouse and item (non-zero only). */
export async function stockOnHand(actor: Actor, warehouseId?: string) {
  const unitIds = await scopedBusinessUnitIds(actor);
  const sums = await db().stockEntry.groupBy({
    by: ["warehouseId", "itemId"],
    where: { businessUnitId: { in: unitIds }, ...(warehouseId ? { warehouseId } : {}) },
    _sum: { qty: true },
  });
  return sums
    .map((s) => ({ warehouseId: s.warehouseId, itemId: s.itemId, qty: round(Number(s._sum.qty ?? 0), 3) }))
    .filter((s) => Math.abs(s.qty) > 1e-9);
}

export interface InventoryReportRow {
  itemId: string;
  itemCode: string;
  itemName: string;
  itemType: string;
  category: string;
  warehouse: string;
  office: string;
  uom: string;
  openingQty: number;
  inQty: number;
  outQty: number;
  closingQty: number;
  netWeight: number;
  rate: number;
  value: number;
}

/** Opening, in, out and closing per warehouse and item for a period (stock ledger). */
export async function inventoryReport(actor: Actor, filters: OverviewFilters): Promise<InventoryReportRow[]> {
  const unitIds = await scopedBusinessUnitIds(actor);
  const from = toDbDate(filters.from);
  const entries = await db().stockEntry.findMany({
    where: { businessUnitId: { in: unitIds }, postingDate: { lte: toDbDate(filters.to) }, ...(filters.warehouseId ? { warehouseId: filters.warehouseId } : {}) },
    select: {
      qty: true,
      postingDate: true,
      warehouse: { select: { id: true, name: true, office: { select: { name: true } } } },
      item: {
        select: { id: true, code: true, name: true, uom: true, itemType: true, netWeight: true, purchasePrice: true, salesRate: true, category: { select: { name: true } } },
      },
    },
  });
  const rows = new Map<string, InventoryReportRow>();
  for (const e of entries) {
    const key = `${e.warehouse.id}:${e.item.id}`;
    const rate = Number(e.item.purchasePrice ?? e.item.salesRate ?? 0);
    const row = rows.get(key) ?? {
      itemId: e.item.id,
      itemCode: e.item.code,
      itemName: e.item.name,
      itemType: e.item.itemType ?? "",
      category: e.item.category?.name ?? "Uncategorised",
      warehouse: e.warehouse.name,
      office: e.warehouse.office.name,
      uom: e.item.uom,
      openingQty: 0,
      inQty: 0,
      outQty: 0,
      closingQty: 0,
      netWeight: Number(e.item.netWeight ?? 0),
      rate,
      value: 0,
    };
    const qty = Number(e.qty);
    if (e.postingDate < from) row.openingQty += qty;
    else if (qty >= 0) row.inQty += qty;
    else row.outQty -= qty;
    rows.set(key, row);
  }
  return [...rows.values()]
    .map((r) => {
      const closing = r.openingQty + r.inQty - r.outQty;
      return { ...r, openingQty: round(r.openingQty, 3), inQty: round(r.inQty, 3), outQty: round(r.outQty, 3), closingQty: round(closing, 3), value: round(closing * r.rate) };
    })
    .filter((r) => !filters.category || r.category === filters.category)
    .filter((r) => r.openingQty || r.inQty || r.outQty || r.closingQty)
    .sort((a, b) => a.warehouse.localeCompare(b.warehouse) || a.itemName.localeCompare(b.itemName));
}
