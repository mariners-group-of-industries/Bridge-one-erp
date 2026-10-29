import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { tradingMonths } from "@/features/home/overview.service";
import { money } from "@/features/sales/dashboard/lib/aggregate";
import { dashboardQuerySchema } from "@/features/sales/dashboard/schemas/dashboard.schema";
import { getSalesDashboard } from "@/features/sales/dashboard/services/dashboard.service";
import { fromDbDate, toDbDate } from "@/features/sales/lib/dates";
import { customerBalances } from "@/features/sales/lib/receivables";
import { scopedBusinessUnitIds } from "@/features/sales/lib/scope";
import type { Actor, Permission } from "@/lib/auth/actor";
import { db } from "@/lib/prisma/client";
import type { ToolSpec } from "./llm";

/**
 * Read-only lookups the assistant may call. Every figure it quotes comes from
 * one of these, scoped to what the signed-in user may see.
 */

export interface AssistantTool<A = unknown> {
  name: string;
  description: string;
  /** Shown in the chat while the tool runs. */
  status: string;
  permission: Permission;
  input: z.ZodType<A>;
  run: (actor: Actor, args: A) => Promise<unknown>;
}

const isoDate = z.iso.date().describe("Date in YYYY-MM-DD format");
const num = (value: Prisma.Decimal | null | undefined) => (value ? value.toNumber() : 0);
const qty = (value: number) => Math.round(value * 1000) / 1000;
const today = () => toDbDate(new Date().toISOString().slice(0, 10));
const nameFilter = (text: string) => ({ contains: text.trim(), mode: "insensitive" as const });

const tool = <A>(definition: AssistantTool<A>) => definition as AssistantTool;

const salesSummary = tool({
  name: "sales_summary",
  description:
    "Sales performance for a date range (max 366 days): net sales (deliveries minus returns), collections, target vs achievement per sales person, top 10 items, customers and sales persons, overdue customers and amounts due on the end date.",
  status: "Reading sales figures…",
  permission: "sales:read",
  input: z.object({ from: isoDate, to: isoDate }),
  run: async (actor, args) => getSalesDashboard(actor, dashboardQuerySchema.parse(args)),
});

const salesTrend = tool({
  name: "sales_trend",
  description: "Month-by-month sales, sales returns, collections and purchases for the last 12 months. Use for trends, growth and seasonality.",
  status: "Reading the 12-month trend…",
  permission: "sales:read",
  input: z.object({}),
  run: async (actor) => {
    const months = await tradingMonths({ in: await scopedBusinessUnitIds(actor) });
    return months ?? { note: "No submitted sales, returns, collections or purchase orders in the last 12 months." };
  },
});

const receivables = tool({
  name: "customer_receivables",
  description:
    "Customer receivables (what customers owe) as of a date, aged into overdue, due today and not yet due, with credit limits. Sorted by overdue amount. Optionally filter by part of a customer name.",
  status: "Checking customer dues…",
  permission: "sales:read",
  input: z.object({
    customer: z.string().max(100).optional().describe("Part of a customer name to filter by"),
    asOf: isoDate.optional().describe("Defaults to today"),
    limit: z.number().int().min(1).max(50).default(10),
  }),
  run: async (actor, { customer, asOf, limit }) => {
    const businessUnitIds = await scopedBusinessUnitIds(actor);
    const customerIds = customer
      ? (await db().customer.findMany({ where: { businessUnitId: { in: businessUnitIds }, name: nameFilter(customer) }, select: { id: true } })).map((c) => c.id)
      : undefined;
    const date = asOf ? toDbDate(asOf) : today();
    const balances = await customerBalances({ businessUnitIds, asOf: date, customerIds });
    const owing = [...balances].filter(([, b]) => b.outstanding > 0);
    const customers = new Map(
      (await db().customer.findMany({ where: { id: { in: owing.map(([id]) => id) } }, select: { id: true, code: true, name: true, creditLimit: true } })).map((c) => [c.id, c]),
    );
    const rows = owing
      .map(([id, b]) => {
        const c = customers.get(id);
        const creditLimit = c?.creditLimit ? num(c.creditLimit) : null;
        return {
          customer: c?.name ?? "Unknown",
          code: c?.code,
          outstanding: b.outstanding,
          overdue: b.overdue,
          dueToday: b.dueToday,
          notYetOverdue: b.due,
          creditLimit,
          overCreditLimit: creditLimit !== null && b.outstanding > creditLimit,
        };
      })
      .sort((a, b) => b.overdue - a.overdue || b.outstanding - a.outstanding);
    return {
      asOf: fromDbDate(date),
      customersOwing: rows.length,
      totalOutstanding: money(rows.reduce((sum, r) => sum + r.outstanding, 0)),
      totalOverdue: money(rows.reduce((sum, r) => sum + r.overdue, 0)),
      customers: rows.slice(0, limit),
    };
  },
});

/** Stock on hand per item and warehouse from the stock ledger. */
async function stockRows(actor: Actor, filter: { item?: string; warehouse?: string }) {
  const businessUnitIds = await scopedBusinessUnitIds(actor);
  const grouped = await db().stockEntry.groupBy({
    by: ["itemId", "warehouseId"],
    where: {
      businessUnitId: { in: businessUnitIds },
      ...(filter.item ? { item: { OR: [{ name: nameFilter(filter.item) }, { code: nameFilter(filter.item) }] } } : {}),
      ...(filter.warehouse ? { warehouse: { name: nameFilter(filter.warehouse) } } : {}),
    },
    _sum: { qty: true },
  });
  const [items, warehouses] = await Promise.all([
    db().item.findMany({ where: { id: { in: [...new Set(grouped.map((g) => g.itemId))] } }, select: { id: true, code: true, name: true, uom: true, salesRate: true } }),
    db().warehouse.findMany({ where: { id: { in: [...new Set(grouped.map((g) => g.warehouseId))] } }, select: { id: true, name: true } }),
  ]);
  const itemById = new Map(items.map((i) => [i.id, i]));
  const warehouseById = new Map(warehouses.map((w) => [w.id, w.name]));
  return grouped.map((g) => {
    const item = itemById.get(g.itemId);
    const onHand = qty(num(g._sum.qty));
    return {
      itemId: g.itemId,
      item: item?.name ?? "Unknown",
      code: item?.code,
      warehouse: warehouseById.get(g.warehouseId) ?? "Unknown",
      qty: onHand,
      uom: item?.uom,
      value: money(onHand * num(item?.salesRate)),
    };
  });
}

const stockLevels = tool({
  name: "stock_levels",
  description:
    "Current stock on hand per item and warehouse, valued at the item's sales rate. Filter by part of an item name/code or warehouse name; set belowQty to find low or out-of-stock lines (sorted lowest first). Items that never had a stock movement are not listed.",
  status: "Checking stock levels…",
  permission: "sales:read",
  input: z.object({
    item: z.string().max(100).optional().describe("Part of an item name or code"),
    warehouse: z.string().max(100).optional().describe("Part of a warehouse name"),
    belowQty: z.number().optional().describe("Only lines with quantity at or below this"),
    limit: z.number().int().min(1).max(100).default(25),
  }),
  run: async (actor, { item, warehouse, belowQty, limit }) => {
    const all = await stockRows(actor, { item, warehouse });
    const rows = belowQty === undefined ? all.sort((a, b) => b.value - a.value) : all.filter((r) => r.qty <= belowQty).sort((a, b) => a.qty - b.qty);
    return {
      lines: rows.length,
      totalQty: qty(rows.reduce((sum, r) => sum + r.qty, 0)),
      totalValue: money(rows.reduce((sum, r) => sum + r.value, 0)),
      rows: rows.slice(0, limit),
    };
  },
});

const slowMovers = tool({
  name: "slow_moving_items",
  description: "Items with stock on hand that have not been delivered to any customer in the last N days (dead or slow stock), largest stock value first.",
  status: "Looking for slow-moving stock…",
  permission: "sales:read",
  input: z.object({
    days: z.number().int().min(7).max(365).default(60),
    limit: z.number().int().min(1).max(50).default(15),
  }),
  run: async (actor, { days, limit }) => {
    const cutoff = new Date(today().getTime() - days * 86_400_000);
    const lines = await stockRows(actor, {});
    const lastSold = new Map(
      (
        await db().stockEntry.groupBy({
          by: ["itemId"],
          where: { itemId: { in: [...new Set(lines.map((l) => l.itemId))] }, source: "SALES_DELIVERY" },
          _max: { postingDate: true },
        })
      ).map((row) => [row.itemId, row._max.postingDate]),
    );
    const byItem = new Map<string, { item: string; code?: string; uom?: string; qty: number; value: number }>();
    for (const line of lines) {
      const entry = byItem.get(line.itemId) ?? { item: line.item, code: line.code, uom: line.uom, qty: 0, value: 0 };
      entry.qty += line.qty;
      entry.value += line.value;
      byItem.set(line.itemId, entry);
    }
    const rows = [...byItem]
      .filter(([itemId, entry]) => entry.qty > 0 && !((lastSold.get(itemId)?.getTime() ?? 0) >= cutoff.getTime()))
      .map(([itemId, entry]) => {
        const sold = lastSold.get(itemId);
        return { ...entry, qty: qty(entry.qty), value: money(entry.value), lastSoldOn: sold ? fromDbDate(sold) : "never" };
      })
      .sort((a, b) => b.value - a.value);
    return {
      noSalesSince: fromDbDate(cutoff),
      items: rows.length,
      totalValue: money(rows.reduce((sum, r) => sum + r.value, 0)),
      rows: rows.slice(0, limit),
    };
  },
});

export const ASSISTANT_TOOLS: AssistantTool[] = [salesSummary, salesTrend, receivables, stockLevels, slowMovers];

export function toolsFor(actor: Actor): AssistantTool[] {
  return ASSISTANT_TOOLS.filter((t) => actor.isMaster || actor.permissions.has(t.permission));
}

export function toolSpec(t: AssistantTool): ToolSpec {
  const { $schema: _, ...parameters } = z.toJSONSchema(t.input, { io: "input" }) as Record<string, unknown>;
  return { type: "function", function: { name: t.name, description: t.description, parameters } };
}

/** Longest tool result handed to the model, in characters. */
const MAX_RESULT = 12_000;

/** JSON for the model: record ids are dropped (they mean nothing to it). */
export function serializeResult(result: unknown): string {
  const json = JSON.stringify(result, (key, value) => (key === "id" || key.endsWith("Id") ? undefined : value));
  return json.length > MAX_RESULT ? `${json.slice(0, MAX_RESULT)}… [truncated — ask for a narrower range or a smaller limit]` : json;
}
