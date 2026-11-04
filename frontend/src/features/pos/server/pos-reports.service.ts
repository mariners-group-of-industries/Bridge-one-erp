import type { Actor } from "@/lib/auth/actor";
import { db } from "@/lib/prisma/client";
import { fromDbDate, toDbDate } from "@/features/sales/lib/dates";
import { scopedBusinessUnitIds } from "@/features/sales/lib/scope";
import { PAYMENT_LABELS, POS_PAYMENT_METHODS, type PosPaymentMethod } from "../schemas/pos.schema";

const num = (value: unknown) => Number(value ?? 0);
const r2 = (n: number) => Math.round(n * 100) / 100;

const COUNTER_COLORS = ["bg-blue-600", "bg-emerald-600", "bg-amber-600", "bg-purple-600", "bg-rose-600", "bg-cyan-600"];
const PAYMENT_STYLE: Record<PosPaymentMethod, { color: string; badge: string }> = {
  CASH: { color: "bg-emerald-500", badge: "text-emerald-700 bg-emerald-50 border-emerald-200" },
  CARD: { color: "bg-blue-500", badge: "text-blue-700 bg-blue-50 border-blue-200" },
  MFS: { color: "bg-pink-500", badge: "text-pink-700 bg-pink-50 border-pink-200" },
  VOUCHER: { color: "bg-purple-500", badge: "text-purple-700 bg-purple-50 border-purple-200" },
};
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export interface PosDashboard {
  counters: { code: string; name: string; floor: string; freq: number; val: number; color: string }[];
  payments: { name: string; freq: number; val: number; color: string; badge: string }[];
  topItems: { rank: number; name: string; category: string; freq: number; val: number }[];
  topCustomers: { rank: number; name: string; mobile: string; freq: number; val: number; tier: "Platinum" | "Gold" | "Silver" }[];
  summary: { invoices: number; gross: number; vat: number; discount: number; net: number };
  monthly: { month: string; sales: number; orders: number }[];
  quarterly: { month: string; sales: number; orders: number }[];
}

const saleSelect = {
  saleDate: true,
  subtotal: true,
  discount: true,
  vatAmount: true,
  total: true,
  paymentMethod: true,
  customerName: true,
  customerMobile: true,
  counter: { select: { code: true, name: true, floorName: true } },
  lines: { select: { itemId: true, qty: true, amount: true, item: { select: { name: true, category: { select: { name: true } } } } } },
} as const;

/** Counter, payment, item and customer figures of a period, and the sales trend of a year. */
export async function posDashboard(actor: Actor, q: { from: string; to: string; year: number }): Promise<PosDashboard> {
  const unitIds = await scopedBusinessUnitIds(actor);
  const base = { businessUnitId: { in: unitIds }, status: "COMPLETED" as const };
  const [sales, yearSales] = await Promise.all([
    db().posSale.findMany({ where: { ...base, saleDate: { gte: toDbDate(q.from), lte: toDbDate(q.to) } }, select: saleSelect }),
    db().posSale.findMany({
      where: { ...base, saleDate: { gte: toDbDate(`${q.year}-01-01`), lte: toDbDate(`${q.year}-12-31`) } },
      select: { saleDate: true, total: true },
    }),
  ]);

  const counters = new Map<string, PosDashboard["counters"][number]>();
  const payments = new Map<PosPaymentMethod, { freq: number; val: number }>(POS_PAYMENT_METHODS.map((m) => [m, { freq: 0, val: 0 }]));
  const items = new Map<string, { name: string; category: string; freq: number; val: number }>();
  const customers = new Map<string, { name: string; mobile: string; freq: number; val: number }>();
  const summary = { invoices: 0, gross: 0, vat: 0, discount: 0, net: 0 };

  for (const s of sales) {
    const total = num(s.total);
    const c = counters.get(s.counter.code) ?? { code: s.counter.code, name: s.counter.name, floor: s.counter.floorName ?? "", freq: 0, val: 0, color: "" };
    c.freq += 1;
    c.val += total;
    counters.set(s.counter.code, c);
    const p = payments.get(s.paymentMethod)!;
    p.freq += 1;
    p.val += total;
    for (const l of s.lines) {
      const it = items.get(l.itemId) ?? { name: l.item.name, category: l.item.category?.name ?? "Uncategorised", freq: 0, val: 0 };
      it.freq += num(l.qty);
      it.val += num(l.amount);
      items.set(l.itemId, it);
    }
    if (s.customerName || s.customerMobile) {
      const key = s.customerMobile || s.customerName!;
      const cu = customers.get(key) ?? { name: s.customerName ?? "", mobile: s.customerMobile ?? "", freq: 0, val: 0 };
      cu.freq += 1;
      cu.val += total;
      customers.set(key, cu);
    }
    summary.invoices += 1;
    summary.gross += num(s.subtotal);
    summary.vat += num(s.vatAmount);
    summary.discount += num(s.discount);
    summary.net += total;
  }

  const monthly = MONTHS.map((m) => ({ month: `${m} ${String(q.year).slice(-2)}`, sales: 0, orders: 0 }));
  for (const s of yearSales) {
    const m = monthly[s.saleDate.getUTCMonth()];
    m.sales += num(s.total);
    m.orders += 1;
  }
  const quarterly = [0, 1, 2, 3].map((qi) => ({
    month: `Q${qi + 1} ${q.year}`,
    sales: r2(monthly.slice(qi * 3, qi * 3 + 3).reduce((t, m) => t + m.sales, 0)),
    orders: monthly.slice(qi * 3, qi * 3 + 3).reduce((t, m) => t + m.orders, 0),
  }));

  return {
    counters: [...counters.values()].sort((a, b) => b.val - a.val).map((c, i) => ({ ...c, val: r2(c.val), color: COUNTER_COLORS[i % COUNTER_COLORS.length] })),
    payments: POS_PAYMENT_METHODS.map((m) => ({ name: PAYMENT_LABELS[m], freq: payments.get(m)!.freq, val: r2(payments.get(m)!.val), ...PAYMENT_STYLE[m] })),
    topItems: [...items.values()].sort((a, b) => b.val - a.val).slice(0, 10).map((it, i) => ({ rank: i + 1, ...it, freq: r2(it.freq), val: r2(it.val) })),
    // Tiers by rank among the period's best customers.
    topCustomers: [...customers.values()]
      .sort((a, b) => b.val - a.val)
      .slice(0, 10)
      .map((cu, i) => ({ rank: i + 1, ...cu, val: r2(cu.val), tier: i < 2 ? "Platinum" : i < 5 ? "Gold" : "Silver" })),
    summary: { invoices: summary.invoices, gross: r2(summary.gross), vat: r2(summary.vat), discount: r2(summary.discount), net: r2(summary.net) },
    monthly: monthly.map((m) => ({ ...m, sales: r2(m.sales) })),
    quarterly,
  };
}

export interface PosReportRow {
  id: string;
  date: string;
  code: string;
  particulars: string;
  category: string;
  qty: number;
  uom: string;
  unitPrice: number;
  discount: number;
  vat: number;
  amount: number;
  status: string;
}

export type PosReportTabId = "INVENTORY_REPORT" | "POS_SALES_REPORT" | "VAT_REPORT" | "DISCOUNT_REPORT" | "DATA_LOG_REPORT" | "MIS_REPORT";

/** Every POS report tab for a period, from counter sales and counter stock. */
export async function posReports(actor: Actor, q: { from: string; to: string }): Promise<Record<PosReportTabId, PosReportRow[]>> {
  const unitIds = await scopedBusinessUnitIds(actor);
  const [sales, counters] = await Promise.all([
    db().posSale.findMany({
      where: { businessUnitId: { in: unitIds }, saleDate: { gte: toDbDate(q.from), lte: toDbDate(q.to) } },
      include: {
        counter: { select: { name: true } },
        lines: { include: { item: { select: { code: true, name: true, uom: true, purchasePrice: true, category: { select: { name: true } } } } } },
      },
      orderBy: { soldAt: "desc" },
    }),
    db().posCounter.findMany({ where: { businessUnitId: { in: unitIds } }, select: { warehouseId: true, warehouse: { select: { name: true } } } }),
  ]);

  const warehouseIds = [...new Set(counters.map((c) => c.warehouseId))];
  const warehouseName = new Map(counters.map((c) => [c.warehouseId, c.warehouse.name]));
  const stock = warehouseIds.length
    ? await db().stockEntry.groupBy({ by: ["warehouseId", "itemId"], where: { warehouseId: { in: warehouseIds } }, _sum: { qty: true } })
    : [];
  const stockItems = new Map(
    (
      await db().item.findMany({
        where: { id: { in: [...new Set(stock.map((s) => s.itemId))] } },
        select: { id: true, code: true, name: true, uom: true, salesRate: true, category: { select: { name: true } } },
      })
    ).map((i) => [i.id, i]),
  );

  const qtyOf = (s: (typeof sales)[number]) => s.lines.reduce((t, l) => t + num(l.qty), 0);
  const completed = sales.filter((s) => s.status === "COMPLETED");

  const mis = new Map<string, { qty: number; revenue: number; cost: number }>();
  for (const s of completed) {
    for (const l of s.lines) {
      const key = l.item.category?.name ?? "Uncategorised";
      const m = mis.get(key) ?? { qty: 0, revenue: 0, cost: 0 };
      m.qty += num(l.qty);
      m.revenue += num(l.amount);
      m.cost += num(l.qty) * num(l.item.purchasePrice);
      mis.set(key, m);
    }
  }

  return {
    INVENTORY_REPORT: stock
      .filter((s) => stockItems.has(s.itemId))
      .map((s) => {
        const item = stockItems.get(s.itemId)!;
        const qty = Math.round(num(s._sum.qty) * 1000) / 1000;
        return {
          id: `${s.warehouseId}:${s.itemId}`,
          date: q.to,
          code: item.code,
          particulars: `${item.name} (${warehouseName.get(s.warehouseId) ?? ""})`,
          category: item.category?.name ?? "Uncategorised",
          qty,
          uom: item.uom,
          unitPrice: num(item.salesRate),
          discount: 0,
          vat: 0,
          amount: r2(qty * num(item.salesRate)),
          status: qty > 0 ? "In Stock" : "Out of Stock",
        };
      }),
    POS_SALES_REPORT: sales.map((s) => ({
      id: s.id,
      date: fromDbDate(s.saleDate),
      code: s.number,
      particulars: `${s.customerName || "Walk-in"}${s.tableRef ? ` · ${s.tableRef}` : ""} (Cashier: ${s.createdBy})`,
      category: s.counter.name,
      qty: qtyOf(s),
      uom: "Items",
      unitPrice: num(s.subtotal),
      discount: num(s.discount),
      vat: num(s.vatAmount),
      amount: num(s.total),
      status: s.status === "VOIDED" ? "Voided" : PAYMENT_LABELS[s.paymentMethod],
    })),
    VAT_REPORT: completed
      .filter((s) => num(s.vatAmount) > 0)
      .map((s) => ({
        id: s.id,
        date: fromDbDate(s.saleDate),
        code: `VAT-${s.number}`,
        particulars: `Mushak 6.3 - ${s.number}`,
        category: `VAT ${num(s.vatPercent)}%`,
        qty: s.lines.length,
        uom: "Lines",
        unitPrice: r2(num(s.subtotal) - num(s.discount)),
        discount: num(s.discount),
        vat: num(s.vatAmount),
        amount: num(s.vatAmount),
        status: "Collected",
      })),
    DISCOUNT_REPORT: completed
      .map((s) => ({ s, lineDiscount: s.lines.reduce((t, l) => t + num(l.discount), 0) }))
      .filter(({ s, lineDiscount }) => num(s.discount) + lineDiscount > 0)
      .map(({ s, lineDiscount }) => ({
        id: s.id,
        date: fromDbDate(s.saleDate),
        code: s.number,
        particulars: `${s.customerName || "Walk-in"} (Cashier: ${s.createdBy})`,
        category: lineDiscount > 0 ? "Item Discount" : "Invoice Discount",
        qty: qtyOf(s),
        uom: "Items",
        unitPrice: num(s.subtotal),
        discount: r2(num(s.discount) + lineDiscount),
        vat: num(s.vatAmount),
        amount: r2(num(s.discount) + lineDiscount),
        status: "Applied",
      })),
    DATA_LOG_REPORT: sales
      .filter((s) => s.status === "VOIDED")
      .map((s) => ({
        id: s.id,
        date: s.voidedAt ? s.voidedAt.toISOString().slice(0, 16).replace("T", " ") : fromDbDate(s.saleDate),
        code: s.number,
        particulars: `Void: ${s.voidReason ?? ""}`,
        category: "Sale Void",
        qty: qtyOf(s),
        uom: "Items",
        unitPrice: num(s.subtotal),
        discount: num(s.discount),
        vat: num(s.vatAmount),
        amount: num(s.total),
        status: s.voidedBy ?? "",
      })),
    MIS_REPORT: [...mis]
      .sort((a, b) => b[1].revenue - a[1].revenue)
      .map(([category, m]) => {
        const margin = m.revenue > 0 ? Math.round(((m.revenue - m.cost) / m.revenue) * 100) : 0;
        return {
          id: category,
          date: q.to,
          code: category.slice(0, 12).toUpperCase(),
          particulars: `${category} Gross Margin (${margin}%)`,
          category: "Sales vs purchase cost",
          qty: r2(m.qty),
          uom: "Units",
          unitPrice: r2(m.revenue),
          discount: 0,
          vat: 0,
          amount: r2(m.revenue - m.cost),
          status: margin >= 0 ? "Profit" : "Loss",
        };
      }),
  };
}
