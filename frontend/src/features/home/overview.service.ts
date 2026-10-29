import type { Prisma } from "@/generated/prisma/client";
import type { Actor } from "@/lib/auth/actor";
import { db } from "@/lib/prisma/client";
import type { BusinessOverview, Named, SalesMonth, StockPoint } from "./overview.types";

/**
 * Home dashboard figures, computed only from what is stored: stock movements,
 * item prices, sales targets, customers, price lists, employees and (for
 * Accounts readers) account balances and budgets. Sales/purchase trends appear
 * once such documents exist.
 */

const num = (value: { toString(): string } | null | undefined) => (value === null || value === undefined ? 0 : Number(value.toString()));
const round = (value: number, places = 2) => Math.round(value * 10 ** places) / 10 ** places;
const dayKey = (date: Date) => date.toISOString().slice(0, 10);
const monthKey = (date: Date) => date.toISOString().slice(0, 7);

/** Count rows per label, largest first; the tail beyond `top` becomes "Other". */
function tally(labels: (string | null | undefined)[], top = 8, empty = "Unassigned"): Named[] {
  const counts = new Map<string, number>();
  for (const label of labels) counts.set(label || empty, (counts.get(label || empty) ?? 0) + 1);
  return rank(
    [...counts].map(([name, value]) => ({ name, value })),
    top,
  );
}

function rank(rows: Named[], top = 8): Named[] {
  const sorted = [...rows].sort((a, b) => b.value - a.value);
  if (sorted.length <= top) return sorted;
  const other = sorted.slice(top - 1).reduce((sum, r) => sum + r.value, 0);
  return [...sorted.slice(0, top - 1), { name: "Other", value: round(other) }];
}

export async function getBusinessOverview(actor: Actor): Promise<BusinessOverview> {
  const unitScope: Prisma.BusinessUnitWhereInput = actor.companyScope === "ALL" ? {} : { companyId: { in: [...actor.companyScope] } };
  const units = await db().businessUnit.findMany({ where: unitScope, select: { id: true } });
  const businessUnitId = { in: units.map((u) => u.id) };

  const [items, stock, warehouses, customers, suppliers, employees, targets, priceRates, priceLists] = await Promise.all([
    db().item.findMany({ where: { businessUnitId, isActive: true }, select: { id: true, name: true, salesRate: true, mrp: true, category: { select: { name: true } } } }),
    db().stockEntry.findMany({ where: { businessUnitId }, select: { itemId: true, warehouseId: true, qty: true, source: true, postingDate: true }, orderBy: { postingDate: "asc" } }),
    db().warehouse.findMany({ where: { office: { businessUnitId } }, select: { id: true, name: true } }),
    db().customer.findMany({ where: { businessUnitId, isActive: true }, select: { customerGroup: { select: { name: true } }, territory: { select: { name: true } } } }),
    db().supplier.count({ where: { businessUnitId, isActive: true } }),
    db().employee.findMany({ where: { isActive: true, office: { businessUnitId } }, select: { designation: true, office: { select: { name: true } } } }),
    db().salesTarget.findMany({ where: { businessUnitId }, select: { month: true, amount: true, salesPerson: { select: { name: true } } } }),
    db().itemPrice.groupBy({ by: ["priceListId"], where: { priceList: { businessUnitId } }, _avg: { rate: true } }),
    db().priceList.findMany({ where: { businessUnitId }, select: { id: true, name: true } }),
  ]);

  // ── Inventory ──
  const itemById = new Map(items.map((i) => [i.id, i]));
  const qtyByItem = new Map<string, number>();
  const qtyByWarehouse = new Map<string, number>();
  for (const entry of stock) {
    const qty = num(entry.qty);
    qtyByItem.set(entry.itemId, (qtyByItem.get(entry.itemId) ?? 0) + qty);
    qtyByWarehouse.set(entry.warehouseId, (qtyByWarehouse.get(entry.warehouseId) ?? 0) + qty);
  }
  const byItem = items
    .map((item) => {
      const qty = round(qtyByItem.get(item.id) ?? 0, 3);
      const salesRate = num(item.salesRate);
      return { name: item.name, qty, value: round(qty * salesRate), salesRate, mrp: item.mrp === null ? null : num(item.mrp) };
    })
    .filter((row) => row.qty !== 0)
    .sort((a, b) => b.value - a.value);
  const categoryValue = new Map<string, number>();
  for (const [itemId, qty] of qtyByItem) {
    const item = itemById.get(itemId);
    if (!item) continue;
    const key = item.category?.name ?? "Uncategorised";
    categoryValue.set(key, (categoryValue.get(key) ?? 0) + qty * num(item.salesRate));
  }
  const warehouseName = new Map(warehouses.map((w) => [w.id, w.name]));

  // Movement: daily when the history is short, monthly otherwise.
  const first = stock[0]?.postingDate;
  const last = stock.at(-1)?.postingDate;
  const monthly = !!first && !!last && last.getTime() - first.getTime() > 120 * 86_400_000;
  const periods = new Map<string, StockPoint>();
  for (const entry of stock) {
    const period = monthly ? monthKey(entry.postingDate) : dayKey(entry.postingDate);
    const point = periods.get(period) ?? { period, inQty: 0, outQty: 0, returnQty: 0, balance: 0 };
    const qty = num(entry.qty);
    if (qty >= 0) point.inQty += qty;
    else point.outQty += -qty;
    if (entry.source === "SALES_RETURN") point.returnQty += qty;
    periods.set(period, point);
  }
  let running = 0;
  const movement = [...periods.values()].map((p) => {
    running += p.inQty - p.outQty;
    return { ...p, inQty: round(p.inQty, 3), outQty: round(p.outQty, 3), returnQty: round(p.returnQty, 3), balance: round(running, 3) };
  });

  // ── Sales targets (latest month with targets) ──
  const latest = targets.reduce<Date | null>((max, t) => (!max || t.month > max ? t.month : max), null);
  const monthTargets = latest ? targets.filter((t) => t.month.getTime() === latest.getTime()) : [];
  const targetByPerson = new Map<string, number>();
  for (const t of monthTargets) targetByPerson.set(t.salesPerson.name, (targetByPerson.get(t.salesPerson.name) ?? 0) + num(t.amount));

  // ── Price lists ──
  const listName = new Map(priceLists.map((p) => [p.id, p.name]));
  const priceListRows = priceRates.map((r) => ({ name: listName.get(r.priceListId) ?? "Price list", value: round(num(r._avg.rate)) })).sort((a, b) => b.value - a.value);

  // ── Finance (Accounts readers only; accounts and budgets are company-wide) ──
  let finance: BusinessOverview["finance"] = null;
  if (actor.isMaster || actor.permissions.has("accounts:read")) {
    const [balances, budgets] = await Promise.all([
      db().account.groupBy({ by: ["accountType"], where: { isGroup: false }, _sum: { currentBalance: true } }),
      db().budget.aggregate({ _sum: { allocatedAmount: true, utilizedAmount: true, committedAmount: true, remainingAmount: true }, _count: { _all: true } }),
    ]);
    const order = ["ASSET", "LIABILITY", "EQUITY", "REVENUE", "EXPENSE"];
    finance = {
      balances: balances
        .map((b) => ({ name: b.accountType.charAt(0) + b.accountType.slice(1).toLowerCase(), value: round(num(b._sum.currentBalance)) }))
        .sort((a, b) => order.indexOf(a.name.toUpperCase()) - order.indexOf(b.name.toUpperCase())),
      budget: budgets._count._all
        ? {
            allocated: round(num(budgets._sum.allocatedAmount)),
            utilized: round(num(budgets._sum.utilizedAmount)),
            committed: round(num(budgets._sum.committedAmount)),
            remaining: round(num(budgets._sum.remainingAmount)),
            count: budgets._count._all,
          }
        : null,
    };
  }

  return {
    counts: { customers: customers.length, suppliers, items: items.length, employees: employees.length, warehouses: warehouses.length, priceLists: priceLists.length },
    inventory: {
      units: round(
        byItem.reduce((sum, r) => sum + r.qty, 0),
        3,
      ),
      value: round(byItem.reduce((sum, r) => sum + r.value, 0)),
      movement,
      byItem,
      byCategory: rank([...categoryValue].map(([name, value]) => ({ name, value: round(value) }))),
      byWarehouse: rank([...qtyByWarehouse].map(([id, value]) => ({ name: warehouseName.get(id) ?? "Warehouse", value: round(value, 3) }))),
    },
    targets: {
      month: latest ? monthKey(latest) : null,
      total: round([...targetByPerson.values()].reduce((a, b) => a + b, 0)),
      byPerson: [...targetByPerson].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value),
    },
    customers: { byGroup: tally(customers.map((c) => c.customerGroup?.name)), byTerritory: tally(customers.map((c) => c.territory?.name)) },
    priceLists: priceListRows,
    employees: { byOffice: tally(employees.map((e) => e.office.name)), byDesignation: tally(employees.map((e) => e.designation)) },
    finance,
    trading: await tradingMonths(businessUnitId),
  };
}

/** Last 12 months of sales, returns, collections and purchases; null when there are no such documents. */
export async function tradingMonths(businessUnitId: { in: string[] }): Promise<SalesMonth[] | null> {
  const now = new Date();
  const keys = Array.from({ length: 12 }, (_, i) => monthKey(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 11 + i, 1))));
  const from = new Date(`${keys[0]}-01T00:00:00.000Z`);
  const submitted = { businessUnitId, status: "SUBMITTED" as const };
  const [deliveries, returns, collections, purchases] = await Promise.all([
    db().salesDelivery.groupBy({ by: ["deliveryDate"], where: { ...submitted, deliveryDate: { gte: from } }, _sum: { totalAmount: true } }),
    db().salesReturn.groupBy({ by: ["returnDate"], where: { ...submitted, returnDate: { gte: from } }, _sum: { totalAmount: true } }),
    db().salesCollection.groupBy({ by: ["collectionDate"], where: { ...submitted, collectionDate: { gte: from } }, _sum: { amount: true } }),
    db().purchaseOrder.groupBy({ by: ["orderDate"], where: { businessUnitId, status: { notIn: ["DRAFT", "CANCELLED"] }, orderDate: { gte: from } }, _sum: { totalAmount: true } }),
  ]);
  if (!deliveries.length && !returns.length && !collections.length && !purchases.length) return null;
  const sum = <T>(rows: T[], date: (r: T) => Date, amount: (r: T) => number) => {
    const totals = new Map<string, number>();
    for (const r of rows) totals.set(monthKey(date(r)), (totals.get(monthKey(date(r))) ?? 0) + amount(r));
    return totals;
  };
  const s = sum(
    deliveries,
    (r) => r.deliveryDate,
    (r) => num(r._sum.totalAmount),
  );
  const rt = sum(
    returns,
    (r) => r.returnDate,
    (r) => num(r._sum.totalAmount),
  );
  const c = sum(
    collections,
    (r) => r.collectionDate,
    (r) => num(r._sum.amount),
  );
  const p = sum(
    purchases,
    (r) => r.orderDate,
    (r) => num(r._sum.totalAmount),
  );
  return keys.map((month) => ({ month, sales: round(s.get(month) ?? 0), returns: round(rt.get(month) ?? 0), collections: round(c.get(month) ?? 0), purchases: round(p.get(month) ?? 0) }));
}
