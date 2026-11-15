import type { StockSource } from "@/generated/prisma/client";
import type { Actor } from "@/lib/auth/actor";
import { db } from "@/lib/prisma/client";
import { fromDbDate, toDbDate } from "@/features/sales/lib/dates";
import { scopedBusinessUnitIds } from "@/features/sales/lib/scope";
import type { InventoryKpis, MovingFrequencyItem, TransactionValueItem, TurnoverRatioItem, ValuationCategory } from "../types";

/** What each ledger movement is called on inventory screens. */
export const STOCK_SOURCE_LABELS: Record<StockSource, string> = {
  OPENING: "Opening Balance",
  ADJUSTMENT: "Stock Adjustment",
  SALES_DELIVERY: "Sales Delivery",
  SALES_RETURN: "Sales Return",
  PRODUCTION_CONSUMPTION: "Issue for Production",
  PRODUCTION_OUTPUT: "Receive from Production",
  PURCHASE_RECEIPT: "Purchase",
  PURCHASE_RETURN: "Purchase Return",
  TRANSFER_OUT: "Transfer Out",
  TRANSFER_IN: "Transfer In",
  STORE_ISSUE: "Store Issue",
  CONVERSION_OUT: "Conversion Out",
  CONVERSION_IN: "Conversion In",
  POS_SALE: "POS Sale",
  POS_RETURN: "POS Void",
};

const COLORS = ["#38effe", "#b939e5", "#3b82f6", "#facc15", "#22c55e", "#f97316", "#ef4444", "#64748b"];
const round = (value: number, digits = 2) => Math.round(value * 10 ** digits) / 10 ** digits;
const DAY = 86_400_000;

export interface InventoryOverview {
  from: string;
  to: string;
  kpis: InventoryKpis;
  valuationData: ValuationCategory[];
  /** Closing stock value by item type (iBOS "Valuation"), at the end of the period. */
  valuationByType: { name: string; value: number }[];
  totalValuation: number;
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
        item: { select: { id: true, name: true, uom: true, itemType: true, purchasePrice: true, salesRate: true, category: { select: { name: true } } } },
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
  const closingByType = new Map<string, number>();
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
    const type = e.item.itemType || "Other";
    closingByType.set(type, (closingByType.get(type) ?? 0) + v);
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
    bySource.set(e.source, (bySource.get(e.source) ?? 0) + v);
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
    valuationByType: [...closingByType]
      .filter(([, v]) => v > 0)
      .sort((a, b) => b[1] - a[1])
      .map(([name, v]) => ({ name, value: round(v) })),
    totalValuation: round([...closingByType.values()].filter((v) => v > 0).reduce((t, v) => t + v, 0)),
    // Largest movements first, whichever their direction (issues are negative).
    topTransactions: [...bySource]
      .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
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

/** Closing quantity by how long ago it was received (first in, first out), in days. */
export interface AgingBuckets {
  d0_30: number;
  d31_60: number;
  d61_90: number;
  d91_180: number;
  d181: number;
}

export interface InventoryReportRow {
  warehouseId: string;
  officeId: string;
  itemId: string;
  itemCode: string;
  itemName: string;
  itemType: string;
  /** Category path: Category → Sub Category → Minor Category. */
  category: string;
  subCategory: string;
  minorCategory: string;
  /** Supplier of the item's latest goods receipt. */
  supplier: string;
  tracking: string;
  warehouse: string;
  office: string;
  uom: string;
  altUom: string;
  altUomFactor: number;
  openingQty: number;
  inQty: number;
  outQty: number;
  /** Issued to users (store issue) within the period; part of outQty. */
  issueQty: number;
  closingQty: number;
  netWeight: number;
  rate: number;
  value: number;
  lastInDate: string | null;
  lastOutDate: string | null;
  aging: AgingBuckets;
  /** Ordered from suppliers but not received yet, for this warehouse. */
  pendingPoQty: number;
  /** Sent from another warehouse, not received here yet. */
  inTransitQty: number;
}

const WAREHOUSE_SELECT = { id: true, name: true, officeId: true, office: { select: { name: true } } } as const;
const ITEM_SELECT = {
  id: true,
  code: true,
  name: true,
  uom: true,
  itemType: true,
  tracking: true,
  categoryId: true,
  altUom: true,
  altUomFactor: true,
  netWeight: true,
  purchasePrice: true,
  salesRate: true,
} as const;

const daysBetween = (later: Date, earlier: Date) => Math.max(0, Math.round((later.getTime() - earlier.getTime()) / DAY));

/**
 * Opening, in, out and closing per warehouse and item for a period (stock ledger), with
 * what the iBOS report views need: category path, last supplier, alternate unit, the
 * last in/out dates, FIFO aging of the closing stock and the supply pipeline.
 */
export async function inventoryReport(actor: Actor, filters: OverviewFilters): Promise<InventoryReportRow[]> {
  const unitIds = await scopedBusinessUnitIds(actor);
  const from = toDbDate(filters.from);
  const to = toDbDate(filters.to);
  const prisma = db();
  const [entries, categories, receipts, openOrders, inTransit] = await Promise.all([
    prisma.stockEntry.findMany({
      where: { businessUnitId: { in: unitIds }, postingDate: { lte: to }, ...(filters.warehouseId ? { warehouseId: filters.warehouseId } : {}) },
      select: {
        qty: true,
        source: true,
        postingDate: true,
        warehouse: { select: WAREHOUSE_SELECT },
        item: { select: ITEM_SELECT },
      },
      orderBy: { postingDate: "asc" },
    }),
    prisma.itemCategory.findMany({ where: { businessUnitId: { in: unitIds } }, select: { id: true, parentId: true, name: true } }),
    prisma.goodsReceiptLine.findMany({
      where: { itemId: { not: null }, receipt: { businessUnitId: { in: unitIds }, receiveDate: { lte: to } } },
      select: { itemId: true, receipt: { select: { supplier: { select: { name: true } } } } },
      orderBy: { receipt: { receiveDate: "desc" } },
    }),
    prisma.purchaseOrderLine.findMany({
      where: { itemId: { not: null }, order: { businessUnitId: { in: unitIds }, warehouseId: { not: null }, status: { in: ["APPROVED", "PARTIAL_RECEIVED"] } } },
      select: { itemId: true, quantity: true, receivedQuantity: true, order: { select: { warehouseId: true } } },
    }),
    prisma.inventoryDocumentLine.findMany({
      where: { document: { businessUnitId: { in: unitIds }, type: "TRANSFER", status: "IN_TRANSIT", toWarehouseId: { not: null } } },
      select: { itemId: true, qty: true, document: { select: { toWarehouseId: true } } },
    }),
  ]);

  const byId = new Map(categories.map((c) => [c.id, c]));
  const pathOf = (id: string | null) => {
    const chain: string[] = [];
    let current = id ? byId.get(id) : undefined;
    for (let guard = 0; current && guard < 6; guard++) {
      chain.unshift(current.name);
      current = current.parentId ? byId.get(current.parentId) : undefined;
    }
    return { category: chain[0] ?? "Uncategorised", subCategory: chain[1] ?? "", minorCategory: chain[2] ?? "" };
  };
  const supplierOf = new Map<string, string>();
  for (const r of receipts) if (r.itemId && !supplierOf.has(r.itemId)) supplierOf.set(r.itemId, r.receipt.supplier.name);
  const pipeline = new Map<string, number>();
  const add = (key: string, qty: number) => pipeline.set(key, (pipeline.get(key) ?? 0) + qty);
  for (const l of openOrders) {
    const open = Number(l.quantity) - Number(l.receivedQuantity);
    if (l.itemId && l.order.warehouseId && open > 0) add(`po:${l.order.warehouseId}:${l.itemId}`, open);
  }
  for (const l of inTransit) if (l.document.toWarehouseId) add(`tr:${l.document.toWarehouseId}:${l.itemId}`, Number(l.qty));

  type Wh = (typeof entries)[number]["warehouse"];
  type It = (typeof entries)[number]["item"];
  const rows = new Map<string, InventoryReportRow & { inflows: { date: Date; qty: number }[] }>();
  const rowOf = (w: Wh, it: It) => {
    const key = `${w.id}:${it.id}`;
    let row = rows.get(key);
    if (!row) {
      row = {
        warehouseId: w.id,
        officeId: w.officeId,
        itemId: it.id,
        itemCode: it.code,
        itemName: it.name,
        itemType: it.itemType ?? "",
        ...pathOf(it.categoryId),
        supplier: supplierOf.get(it.id) ?? "",
        tracking: it.tracking,
        warehouse: w.name,
        office: w.office.name,
        uom: it.uom,
        altUom: it.altUom ?? "",
        altUomFactor: Number(it.altUomFactor ?? 0),
        openingQty: 0,
        inQty: 0,
        outQty: 0,
        issueQty: 0,
        closingQty: 0,
        netWeight: Number(it.netWeight ?? 0),
        rate: Number(it.purchasePrice ?? it.salesRate ?? 0),
        value: 0,
        lastInDate: null,
        lastOutDate: null,
        aging: { d0_30: 0, d31_60: 0, d61_90: 0, d91_180: 0, d181: 0 },
        pendingPoQty: round(pipeline.get(`po:${w.id}:${it.id}`) ?? 0, 3),
        inTransitQty: round(pipeline.get(`tr:${w.id}:${it.id}`) ?? 0, 3),
        inflows: [],
      };
      rows.set(key, row);
    }
    return row;
  };
  for (const e of entries) {
    const row = rowOf(e.warehouse, e.item);
    const qty = Number(e.qty);
    if (qty > 0) {
      row.inflows.push({ date: e.postingDate, qty });
      row.lastInDate = fromDbDate(e.postingDate);
    } else if (qty < 0) row.lastOutDate = fromDbDate(e.postingDate);
    if (e.postingDate < from) row.openingQty += qty;
    else if (qty >= 0) row.inQty += qty;
    else {
      row.outQty -= qty;
      if (e.source === "STORE_ISSUE") row.issueQty -= qty;
    }
  }

  // Items with nothing on hand yet but on order or on the road still belong in the pipeline views.
  const waiting = [...pipeline.keys()]
    .map((k) => k.split(":").slice(1) as [string, string])
    .filter(([w, i]) => !rows.has(`${w}:${i}`) && (!filters.warehouseId || w === filters.warehouseId));
  if (waiting.length) {
    const [ws, its] = await Promise.all([
      prisma.warehouse.findMany({ where: { id: { in: [...new Set(waiting.map(([w]) => w))] }, office: { businessUnitId: { in: unitIds } } }, select: WAREHOUSE_SELECT }),
      prisma.item.findMany({ where: { id: { in: [...new Set(waiting.map(([, i]) => i))] }, businessUnitId: { in: unitIds } }, select: ITEM_SELECT }),
    ]);
    const wMap = new Map(ws.map((w) => [w.id, w]));
    const iMap = new Map(its.map((i) => [i.id, i]));
    for (const [w, i] of waiting) if (wMap.has(w) && iMap.has(i)) rowOf(wMap.get(w)!, iMap.get(i)!);
  }

  return [...rows.values()]
    .map(({ inflows, ...r }) => {
      const closing = r.openingQty + r.inQty - r.outQty;
      // FIFO: what is still on hand came from the latest receipts.
      const aging = { ...r.aging };
      let left = closing;
      for (let i = inflows.length - 1; i >= 0 && left > 1e-9; i--) {
        const take = Math.min(left, inflows[i].qty);
        left -= take;
        const age = daysBetween(to, inflows[i].date);
        const bucket: keyof AgingBuckets = age <= 30 ? "d0_30" : age <= 60 ? "d31_60" : age <= 90 ? "d61_90" : age <= 180 ? "d91_180" : "d181";
        aging[bucket] = round(aging[bucket] + take, 3);
      }
      return {
        ...r,
        openingQty: round(r.openingQty, 3),
        inQty: round(r.inQty, 3),
        outQty: round(r.outQty, 3),
        issueQty: round(r.issueQty, 3),
        closingQty: round(closing, 3),
        value: round(closing * r.rate),
        aging,
      };
    })
    .filter((r) => !filters.category || r.category === filters.category)
    .filter((r) => r.openingQty || r.inQty || r.outQty || r.closingQty || r.pendingPoQty || r.inTransitQty)
    .sort((a, b) => a.warehouse.localeCompare(b.warehouse) || a.itemName.localeCompare(b.itemName));
}
