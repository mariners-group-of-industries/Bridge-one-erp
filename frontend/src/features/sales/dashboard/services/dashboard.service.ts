import type { Prisma } from "@/generated/prisma/client";
import type { Actor } from "@/lib/auth/actor";
import { db } from "@/lib/prisma/client";
import { toDbDate as day } from "../../lib/dates";
import { customerBalances } from "../../lib/receivables";
import { scopedBusinessUnitIds } from "../../lib/scope";
import { money, monthStarts, netOfReturns, topKeys, type Totals } from "../lib/aggregate";
import type { DashboardQuery, RankedEntry, SalesDashboard } from "../schemas/dashboard.schema";

/** Rows in each "Top" list and in the overdue tables. */
export const TOP_LIMIT = 10;

const SUBMITTED = "SUBMITTED" as const;

function num(value: Prisma.Decimal | null | undefined): number {
  return value ? value.toNumber() : 0;
}

function toTotals<K extends string>(
  rows: ({ _sum: { amount?: Prisma.Decimal | null; totalAmount?: Prisma.Decimal | null; qty?: Prisma.Decimal | null; totalQty?: Prisma.Decimal | null } } & Record<K, string | null>)[],
  key: K,
): Map<string, Totals> {
  // Rows sharing a key (e.g. one sales person across customers) are summed.
  const map = new Map<string, Totals>();
  for (const row of rows) {
    const id = row[key];
    if (id === null) continue;
    const current = map.get(id) ?? { amount: 0, qty: 0 };
    map.set(id, {
      amount: current.amount + num(row._sum.amount ?? row._sum.totalAmount),
      qty: current.qty + num(row._sum.qty ?? row._sum.totalQty),
    });
  }
  return map;
}

function ranked(
  totals: Map<string, Totals>,
  names: Map<string, { name: string; detail?: string }>,
): RankedEntry[] {
  return topKeys(totals, TOP_LIMIT).map((id) => {
    const value = totals.get(id)!;
    return {
      id,
      name: names.get(id)?.name ?? "Unknown",
      detail: names.get(id)?.detail,
      amount: money(value.amount),
      qty: Math.round(value.qty * 1000) / 1000,
    };
  });
}

export async function getSalesDashboard(actor: Actor, query: DashboardQuery): Promise<SalesDashboard> {
  const unitIds = await scopedBusinessUnitIds(actor, query.businessUnitId);
  const from = day(query.from);
  const to = day(query.to);
  const monthStart = day(`${query.to.slice(0, 7)}-01`);
  const scope = { businessUnitId: { in: unitIds }, status: SUBMITTED };
  const inRange = { gte: from, lte: to };

  const deliveriesIn = (range: Prisma.DateTimeFilter) =>
    db().salesDelivery.aggregate({ where: { ...scope, deliveryDate: range }, _sum: { totalAmount: true } });
  const returnsIn = (range: Prisma.DateTimeFilter) =>
    db().salesReturn.aggregate({ where: { ...scope, returnDate: range }, _sum: { totalAmount: true } });

  const [
    sales,
    salesReturns,
    monthSales,
    monthReturns,
    collection,
    itemSales,
    itemReturns,
    customerSales,
    customerReturns,
    personSales,
    personReturns,
    targets,
    balances,
  ] = await Promise.all([
    deliveriesIn(inRange),
    returnsIn(inRange),
    deliveriesIn({ gte: monthStart, lte: to }),
    returnsIn({ gte: monthStart, lte: to }),
    db().salesCollection.aggregate({ where: { ...scope, collectionDate: inRange }, _sum: { amount: true } }),
    db().salesDeliveryLine.groupBy({
      by: ["itemId"],
      where: { delivery: { ...scope, deliveryDate: inRange } },
      _sum: { amount: true, qty: true },
    }),
    db().salesReturnLine.groupBy({
      by: ["itemId"],
      where: { salesReturn: { ...scope, returnDate: inRange } },
      _sum: { amount: true, qty: true },
    }),
    db().salesDelivery.groupBy({
      by: ["customerId"],
      where: { ...scope, deliveryDate: inRange },
      _sum: { totalAmount: true, totalQty: true },
    }),
    db().salesReturn.groupBy({
      by: ["customerId"],
      where: { ...scope, returnDate: inRange },
      _sum: { totalAmount: true, totalQty: true },
    }),
    db().salesDelivery.groupBy({
      by: ["salesPersonId", "customerId"],
      where: { ...scope, deliveryDate: inRange },
      _sum: { totalAmount: true, totalQty: true },
    }),
    db().salesReturn.groupBy({
      by: ["salesPersonId", "customerId"],
      where: { ...scope, returnDate: inRange },
      _sum: { totalAmount: true, totalQty: true },
    }),
    db().salesTarget.groupBy({
      by: ["salesPersonId"],
      where: { businessUnitId: { in: unitIds }, month: { in: monthStarts(query.from, query.to).map(day) } },
      _sum: { amount: true },
    }),
    customerBalances({ businessUnitIds: unitIds, asOf: to }),
  ]);

  // ── Receivables as of the To Date ──
  const aged = [...balances].map(([customerId, balance]) => ({ customerId, ...balance }));
  const overdue = aged
    .filter((row) => row.overdue > 0)
    .sort((a, b) => b.overdue - a.overdue)
    .slice(0, TOP_LIMIT);
  const fallingDue = aged
    .filter((row) => row.dueToday > 0)
    .sort((a, b) => b.dueToday - a.dueToday)
    .slice(0, TOP_LIMIT);

  // ── Rankings (net of returns) ──
  const itemTotals = netOfReturns(toTotals(itemSales, "itemId"), toTotals(itemReturns, "itemId"));
  const customerTotals = netOfReturns(toTotals(customerSales, "customerId"), toTotals(customerReturns, "customerId"));
  // A document without a sales person counts for the customer's default sales person,
  // else for whoever made the customer's latest delivery up to the To Date.
  const unattributed = [
    ...new Set([...personSales, ...personReturns].filter((row) => row.salesPersonId === null).map((row) => row.customerId)),
  ];
  const [defaults, latest] = unattributed.length
    ? await Promise.all([
        db().customer.findMany({ where: { id: { in: unattributed }, salesPersonId: { not: null } }, select: { id: true, salesPersonId: true } }),
        db().salesDelivery.findMany({
          where: { ...scope, customerId: { in: unattributed }, salesPersonId: { not: null }, deliveryDate: { lte: to } },
          orderBy: [{ deliveryDate: "desc" }, { createdAt: "desc" }],
          distinct: ["customerId"],
          select: { customerId: true, salesPersonId: true },
        }),
      ])
    : [[], []];
  const customerDefaults = new Map<string, string | null>([
    ...latest.map((row) => [row.customerId, row.salesPersonId] as const),
    ...defaults.map((row) => [row.id, row.salesPersonId] as const),
  ]);
  const attributed = <T extends { salesPersonId: string | null; customerId: string }>(rows: T[]) =>
    rows.map((row) => ({ ...row, salesPersonId: row.salesPersonId ?? customerDefaults.get(row.customerId) ?? null }));
  const personTotals = netOfReturns(
    toTotals(attributed(personSales), "salesPersonId"),
    toTotals(attributed(personReturns), "salesPersonId"),
  );

  const targetByPerson = new Map(
    targets.map((row) => [row.salesPersonId, num(row._sum.amount)] as const).filter(([, amount]) => amount > 0),
  );
  const targetPersonIds = [...targetByPerson.keys()];

  // ── Names ──
  const topItemIds = topKeys(itemTotals, TOP_LIMIT);
  const customerIds = new Set([
    ...topKeys(customerTotals, TOP_LIMIT),
    ...overdue.map((row) => row.customerId),
    ...fallingDue.map((row) => row.customerId),
  ]);
  const personIds = new Set([...topKeys(personTotals, TOP_LIMIT), ...targetPersonIds]);
  const [items, customers, persons] = await Promise.all([
    db().item.findMany({ where: { id: { in: topItemIds } }, select: { id: true, name: true, code: true } }),
    db().customer.findMany({ where: { id: { in: [...customerIds] } }, select: { id: true, name: true, territory: { select: { name: true } } } }),
    db().salesPerson.findMany({ where: { id: { in: [...personIds] } }, select: { id: true, name: true, designation: true } }),
  ]);
  const itemNames = new Map(items.map((item) => [item.id, { name: item.name, detail: item.code }]));
  const customerNames = new Map(
    customers.map((customer) => [customer.id, { name: customer.name, detail: customer.territory?.name }]),
  );
  const personNames = new Map(
    persons.map((person) => [person.id, { name: person.name, detail: person.designation ?? undefined }]),
  );
  const customerName = (id: string) => customerNames.get(id)?.name ?? "Unknown";

  const salesPersons = targetPersonIds
    .map((salesPersonId) => ({
      salesPersonId,
      name: personNames.get(salesPersonId)?.name ?? "Unknown",
      designation: personNames.get(salesPersonId)?.detail,
      target: money(targetByPerson.get(salesPersonId)!),
      achieved: money(Math.max(0, personTotals.get(salesPersonId)?.amount ?? 0)),
    }))
    .sort((a, b) => b.target - a.target || a.name.localeCompare(b.name));

  return {
    from: query.from,
    to: query.to,
    totals: {
      sales: money(num(sales._sum.totalAmount) - num(salesReturns._sum.totalAmount)),
      monthSales: money(num(monthSales._sum.totalAmount) - num(monthReturns._sum.totalAmount)),
      collection: money(num(collection._sum.amount)),
    },
    target: {
      target: money(salesPersons.reduce((sum, row) => sum + row.target, 0)),
      achieved: money(salesPersons.reduce((sum, row) => sum + row.achieved, 0)),
      salesPersons,
    },
    overdue: overdue.map((row) => ({
      customerId: row.customerId,
      name: customerName(row.customerId),
      overdue: row.overdue,
      due: row.due,
    })),
    dueToday: fallingDue.map((row) => ({
      customerId: row.customerId,
      name: customerName(row.customerId),
      amount: row.dueToday,
    })),
    topItems: ranked(itemTotals, itemNames),
    topCustomers: ranked(customerTotals, customerNames),
    topSalesPersons: ranked(personTotals, personNames),
  };
}
