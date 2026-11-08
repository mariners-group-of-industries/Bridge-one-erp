import { badRequest } from "@/lib/api/errors";
import type { Actor } from "@/lib/auth/actor";
import { db } from "@/lib/prisma/client";
import { DATE, MONTH, dateRange, distributorStock, fromDbDate, num, r2, requireDistributor, unitIds } from "./common";
import { outletBalances } from "./sales.service";

/** Sales are what was delivered to outlets (secondary sales), net of discounts. */

function checkRange(from: string, to: string) {
  if (!DATE.test(from) || !DATE.test(to) || from > to) throw badRequest("Choose a valid date range.");
}

const top = <T>(map: Map<string, T>, value: (t: T) => number, n = 10) => [...map.values()].sort((a, b) => value(b) - value(a)).slice(0, n);

async function periodData(units: string[], from: string, to: string, extra: { distributorId?: string; srId?: string } = {}) {
  const where = { businessUnitId: { in: units }, status: { not: "CANCELLED" as const }, ...extra };
  const [deliveries, collections, returns, orders] = await Promise.all([
    db().rtmDelivery.findMany({
      where: { ...where, deliveryDate: dateRange(from, to) },
      select: {
        deliveryDate: true,
        total: true,
        distributorId: true,
        srId: true,
        outletId: true,
        distributor: { select: { name: true } },
        sr: { select: { name: true } },
        outlet: { select: { name: true, code: true, channel: { select: { name: true } }, route: { select: { name: true } } } },
        lines: { select: { itemId: true, qty: true, amount: true, item: { select: { name: true, uom: true } } } },
      },
    }),
    db().rtmCollection.findMany({ where: { ...where, collectionDate: dateRange(from, to) }, select: { collectionDate: true, amount: true, distributorId: true, srId: true } }),
    db().rtmReturn.findMany({ where: { ...where, returnDate: dateRange(from, to) }, select: { total: true, distributorId: true } }),
    db().rtmOrder.findMany({ where: { ...where, orderDate: dateRange(from, to) }, select: { total: true, status: true, outletId: true, srId: true } }),
  ]);
  return { deliveries, collections, returns, orders };
}

// ── RTM dashboard ────────────────────────────────────────────────────────────

export async function rtmDashboard(actor: Actor, from: string, to: string) {
  checkRange(from, to);
  const units = await unitIds(actor);
  const { deliveries, collections, returns, orders } = await periodData(units, from, to);
  const outlets = await db().rtmOutlet.findMany({ where: { businessUnitId: { in: units }, isActive: true }, select: { id: true } });
  const balances = await outletBalances(db(), outlets.map((o) => o.id));
  const visits = await db().rtmVisit.count({ where: { businessUnitId: { in: units }, kind: "VISIT", visitedAt: { gte: new Date(`${from}T00:00:00Z`), lt: new Date(new Date(`${to}T00:00:00Z`).getTime() + 86_400_000) } } });

  const byDistributor = new Map<string, { name: string; sales: number; collection: number; returns: number }>();
  const add = (id: string, name: string) => byDistributor.get(id) ?? byDistributor.set(id, { name, sales: 0, collection: 0, returns: 0 }).get(id)!;
  const distributorNames = new Map(deliveries.map((d) => [d.distributorId, d.distributor.name]));
  for (const d of deliveries) add(d.distributorId, d.distributor.name).sales += num(d.total);
  for (const c of collections) add(c.distributorId, distributorNames.get(c.distributorId) ?? "Distributor").collection += num(c.amount);
  for (const r of returns) add(r.distributorId, distributorNames.get(r.distributorId) ?? "Distributor").returns += num(r.total);

  const byChannel = new Map<string, { name: string; sales: number }>();
  const items = new Map<string, { name: string; qty: number; value: number }>();
  const daily = new Map<string, { day: string; sales: number; collection: number }>();
  for (const d of deliveries) {
    const ch = d.outlet.channel?.name ?? "No channel";
    (byChannel.get(ch) ?? byChannel.set(ch, { name: ch, sales: 0 }).get(ch)!).sales += num(d.total);
    for (const l of d.lines) {
      const it = items.get(l.itemId) ?? items.set(l.itemId, { name: l.item.name, qty: 0, value: 0 }).get(l.itemId)!;
      it.qty += num(l.qty);
      it.value += num(l.amount);
    }
    const day = fromDbDate(d.deliveryDate);
    (daily.get(day) ?? daily.set(day, { day, sales: 0, collection: 0 }).get(day)!).sales += num(d.total);
  }
  for (const c of collections) {
    const day = fromDbDate(c.collectionDate);
    (daily.get(day) ?? daily.set(day, { day, sales: 0, collection: 0 }).get(day)!).collection += num(c.amount);
  }
  const orderingOutlets = new Set(orders.map((o) => o.outletId)).size;
  const sum = <T>(rows: T[], f: (r: T) => number) => r2(rows.reduce((t, r) => t + f(r), 0));

  return {
    kpis: {
      orders: orders.length,
      orderValue: sum(orders, (o) => num(o.total)),
      sales: sum(deliveries, (d) => num(d.total)),
      collection: sum(collections, (c) => num(c.amount)),
      returns: sum(returns, (r) => num(r.total)),
      outstanding: r2([...balances.values()].reduce((t, b) => t + Math.max(0, b), 0)),
      activeOutlets: outlets.length,
      orderingOutlets,
      coverage: outlets.length ? Math.round((orderingOutlets / outlets.length) * 100) : 0,
      visits,
      strikeRate: visits ? Math.round((orders.length / visits) * 100) : 0,
    },
    distributors: top(byDistributor, (d) => d.sales).map((d) => ({ ...d, sales: r2(d.sales), collection: r2(d.collection), returns: r2(d.returns) })),
    channels: top(byChannel, (c) => c.sales).map((c) => ({ ...c, sales: r2(c.sales) })),
    items: top(items, (i) => i.value).map((i) => ({ ...i, qty: r2(i.qty), value: r2(i.value) })),
    daily: [...daily.values()].sort((a, b) => a.day.localeCompare(b.day)).map((d) => ({ ...d, sales: r2(d.sales), collection: r2(d.collection) })),
  };
}

// ── Distributor dashboard ────────────────────────────────────────────────────

export async function distributorDashboard(actor: Actor, distributorId: string, from: string, to: string) {
  checkRange(from, to);
  const distributor = await requireDistributor(actor, distributorId);
  const units = [distributor.businessUnitId];
  const { deliveries, collections, returns, orders } = await periodData(units, from, to, { distributorId });
  const outlets = await db().rtmOutlet.findMany({ where: { distributorId, isActive: true }, select: { id: true, code: true, name: true } });
  const balances = await outletBalances(db(), outlets.map((o) => o.id));
  const stock = await distributorStock(db(), distributorId);
  const stockItems = await db().item.findMany({ where: { id: { in: [...stock.keys()] } }, select: { id: true, name: true, uom: true, salesRate: true } });
  const pending = await db().rtmOrder.findMany({
    where: { distributorId, status: { in: ["PENDING", "APPROVED"] } },
    select: { number: true, orderDate: true, total: true, status: true, outlet: { select: { name: true } } },
    orderBy: { orderDate: "asc" },
    take: 20,
  });
  const outletSales = new Map<string, { name: string; sales: number }>();
  for (const d of deliveries) (outletSales.get(d.outletId) ?? outletSales.set(d.outletId, { name: `${d.outlet.code} · ${d.outlet.name}`, sales: 0 }).get(d.outletId)!).sales += num(d.total);
  const stockRows = stockItems
    .map((i) => ({ item: i.name, uom: i.uom, qty: stock.get(i.id) ?? 0, value: r2((stock.get(i.id) ?? 0) * num(i.salesRate)) }))
    .filter((s) => Math.abs(s.qty) > 1e-9)
    .sort((a, b) => b.value - a.value);
  const sum = <T>(rows: T[], f: (r: T) => number) => r2(rows.reduce((t, r) => t + f(r), 0));
  return {
    distributor: { id: distributor.id, name: distributor.name, code: distributor.code },
    kpis: {
      sales: sum(deliveries, (d) => num(d.total)),
      collection: sum(collections, (c) => num(c.amount)),
      returns: sum(returns, (r) => num(r.total)),
      orders: orders.length,
      outletDue: r2([...balances.values()].reduce((t, b) => t + Math.max(0, b), 0)),
      stockValue: r2(stockRows.reduce((t, s) => t + s.value, 0)),
      outlets: outlets.length,
      pendingOrders: pending.length,
    },
    stock: stockRows.slice(0, 15),
    pendingOrders: pending.map((p) => ({ number: p.number, date: fromDbDate(p.orderDate), outlet: p.outlet.name, total: num(p.total), status: p.status })),
    topOutlets: top(outletSales, (o) => o.sales).map((o) => ({ ...o, sales: r2(o.sales) })),
    dues: outlets
      .map((o) => ({ outlet: `${o.code} · ${o.name}`, due: balances.get(o.id) ?? 0 }))
      .filter((o) => o.due > 0)
      .sort((a, b) => b.due - a.due)
      .slice(0, 10),
  };
}

// ── Sales executive dashboard ────────────────────────────────────────────────

/** Each sales representative's month: target vs achievement, orders, collection, visits. */
export async function salesExecutiveDashboard(actor: Actor, month: string) {
  if (!MONTH.test(month)) throw badRequest("Use a YYYY-MM month.");
  const units = await unitIds(actor);
  const [y, m] = month.split("-").map(Number);
  const from = `${month}-01`;
  const to = `${month}-${String(new Date(Date.UTC(y, m, 0)).getUTCDate()).padStart(2, "0")}`;
  const { deliveries, collections, orders } = await periodData(units, from, to);
  const [targets, visits] = await Promise.all([
    db().rtmTarget.findMany({ where: { businessUnitId: { in: units }, month, employeeId: { not: null } }, select: { employeeId: true, targetValue: true } }),
    db().rtmVisit.findMany({
      where: { businessUnitId: { in: units }, kind: "VISIT", visitedAt: { gte: new Date(`${from}T00:00:00Z`), lt: new Date(new Date(`${to}T00:00:00Z`).getTime() + 86_400_000) } },
      select: { employeeId: true, outletId: true, visitedAt: true },
    }),
  ]);
  const ids = new Set<string>([
    ...targets.map((t) => t.employeeId!),
    ...deliveries.flatMap((d) => (d.srId ? [d.srId] : [])),
    ...orders.flatMap((o) => (o.srId ? [o.srId] : [])),
    ...visits.map((v) => v.employeeId),
  ]);
  const employees = await db().employee.findMany({ where: { id: { in: [...ids] } }, select: { id: true, name: true, employeeCode: true, designation: true } });
  return employees
    .map((e) => {
      const target = targets.filter((t) => t.employeeId === e.id).reduce((s, t) => s + num(t.targetValue), 0);
      const achieved = deliveries.filter((d) => d.srId === e.id).reduce((s, d) => s + num(d.total), 0);
      const mine = visits.filter((v) => v.employeeId === e.id);
      return {
        employeeId: e.id,
        employee: `${e.employeeCode} · ${e.name}`,
        designation: e.designation,
        target: r2(target),
        achieved: r2(achieved),
        achievement: target > 0 ? Math.round((achieved / target) * 100) : null,
        orders: orders.filter((o) => o.srId === e.id).length,
        orderValue: r2(orders.filter((o) => o.srId === e.id).reduce((s, o) => s + num(o.total), 0)),
        collection: r2(collections.filter((c) => c.srId === e.id).reduce((s, c) => s + num(c.amount), 0)),
        visits: mine.length,
        outletsVisited: new Set(mine.map((v) => v.outletId)).size,
        visitDays: new Set(mine.map((v) => v.visitedAt.toISOString().slice(0, 10))).size,
      };
    })
    .sort((a, b) => b.achieved - a.achieved);
}

// ── Sales analytics ──────────────────────────────────────────────────────────

export async function salesAnalytics(actor: Actor, from: string, to: string) {
  checkRange(from, to);
  const units = await unitIds(actor);
  const { deliveries } = await periodData(units, from, to);
  const group = (key: (d: (typeof deliveries)[number]) => string) => {
    const m = new Map<string, { name: string; sales: number; deliveries: number }>();
    for (const d of deliveries) {
      const k = key(d);
      const g = m.get(k) ?? m.set(k, { name: k, sales: 0, deliveries: 0 }).get(k)!;
      g.sales += num(d.total);
      g.deliveries += 1;
    }
    return [...m.values()].sort((a, b) => b.sales - a.sales).map((g) => ({ ...g, sales: r2(g.sales) }));
  };
  const items = new Map<string, { name: string; uom: string; qty: number; sales: number }>();
  for (const d of deliveries) {
    for (const l of d.lines) {
      const it = items.get(l.itemId) ?? items.set(l.itemId, { name: l.item.name, uom: l.item.uom, qty: 0, sales: 0 }).get(l.itemId)!;
      it.qty += num(l.qty);
      it.sales += num(l.amount);
    }
  }
  const total = deliveries.reduce((t, d) => t + num(d.total), 0);
  return {
    total: r2(total),
    deliveries: deliveries.length,
    outlets: new Set(deliveries.map((d) => d.outletId)).size,
    monthly: group((d) => fromDbDate(d.deliveryDate).slice(0, 7)).sort((a, b) => a.name.localeCompare(b.name)),
    byChannel: group((d) => d.outlet.channel?.name ?? "No channel"),
    byRoute: group((d) => d.outlet.route?.name ?? "No route"),
    byDistributor: group((d) => d.distributor.name),
    bySr: group((d) => d.sr?.name ?? "No SR"),
    byItem: [...items.values()].sort((a, b) => b.sales - a.sales).map((i) => ({ ...i, qty: r2(i.qty), sales: r2(i.sales) })),
  };
}
