import type { Prisma } from "@/generated/prisma/client";
import { badRequest } from "@/lib/api/errors";
import type { Actor } from "@/lib/auth/actor";
import { db } from "@/lib/prisma/client";
import { COLLECTION_METHOD_LABELS } from "../../collections/schemas/collection.schema";
import { listDueInvoices } from "../../collections/services/collection.service";
import { money } from "../../dashboard/lib/aggregate";
import { fromDbDate, toDbDate } from "../../lib/dates";
import { customerBalances } from "../../lib/receivables";
import { scopedBusinessUnitIds } from "../../lib/scope";
import { RETURN_KIND_LABELS, RETURN_MODE_LABELS, RETURN_STATUS_LABELS } from "../../returns/schemas/return.schema";
import { ORDER_STATUS_LABELS, PAYMENT_METHOD_LABELS } from "../../orders/schemas/order.schema";
import { CONFIRMATION_LABELS, DELIVERY_TYPE_LABELS } from "../../deliveries/schemas/delivery.schema";
import { MONTH_NAMES } from "../../targets/schemas/target.schema";
import { targetReport } from "../../targets/services/target.service";
import { ALL_REPORTS, ANALYTICS, REPORTS, reportQuerySchema, type ReportCell, type ReportColumn, type ReportKey, type ReportResult } from "../schemas/report.schema";

type Query = ReturnType<typeof reportQuerySchema.parse>;
type Row = Record<string, ReportCell>;

/** Most rows a report reads from one table. */
const READ_LIMIT = 20_000;
const LIVE = "SUBMITTED" as const;
const DAY_MS = 24 * 60 * 60 * 1000;
const num = (value: Prisma.Decimal | null | undefined) => (value ? value.toNumber() : 0);
const round3 = (value: number) => Math.round(value * 1000) / 1000;
const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 10_000) / 100 : null);

const col = (key: string, label: string, kind: ReportColumn["kind"] = "text", total = false): ReportColumn => ({ key, label, kind, total });
const amount = (key: string, label: string) => col(key, label, "amount", true);
const qty = (key: string, label: string) => col(key, label, "qty", true);

function dateRange(query: Query) {
  if (!query.from && !query.to) return undefined;
  return { ...(query.from ? { gte: toDbDate(query.from) } : {}), ...(query.to ? { lte: toDbDate(query.to) } : {}) };
}

function customerFilter(query: Query): Prisma.CustomerWhereInput | undefined {
  const filter: Prisma.CustomerWhereInput = {
    ...(query.customerGroupId ? { customerGroupId: query.customerGroupId } : {}),
    ...(query.territoryId ? { territoryId: query.territoryId } : {}),
    ...(query.zoneId ? { zoneId: query.zoneId } : {}),
    ...(query.routeId ? { routeId: query.routeId } : {}),
  };
  return Object.keys(filter).length ? filter : undefined;
}

/** Shared where-clause parts of deliveries, returns and collections. */
function partyWhere(unitIds: string[], query: Query, office: boolean) {
  const customer = customerFilter(query);
  return {
    businessUnitId: { in: unitIds },
    status: LIVE,
    ...(office && query.officeId ? { officeId: query.officeId } : {}),
    ...(query.customerId ? { customerId: query.customerId } : {}),
    ...(query.salesPersonId ? { salesPersonId: query.salesPersonId } : {}),
    ...(customer ? { customer } : {}),
  };
}

/** The category and every category under it. */
async function categoryTree(unitIds: string[], categoryId: string | undefined): Promise<Set<string> | null> {
  if (!categoryId) return null;
  const categories = await db().itemCategory.findMany({ where: { businessUnitId: { in: unitIds } }, select: { id: true, parentId: true } });
  const ids = new Set([categoryId]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const category of categories) {
      if (category.parentId && ids.has(category.parentId) && !ids.has(category.id)) {
        ids.add(category.id);
        grew = true;
      }
    }
  }
  return ids;
}

const partySelect = {
  customerId: true,
  salesPersonId: true,
  customer: { select: { code: true, name: true, customerGroup: { select: { name: true } }, territory: { select: { name: true } } } },
  salesPerson: { select: { name: true } },
} as const;

const lineSelect = { select: { itemId: true, qty: true, amount: true, item: { select: { code: true, name: true, uom: true, categoryId: true } } } } as const;

function loadDeliveries(unitIds: string[], query: Query, withLines = false) {
  const range = dateRange(query);
  return db().salesDelivery.findMany({
    where: {
      ...partyWhere(unitIds, query, true),
      officeId: query.officeId ? query.officeId : { not: null },
      ...(range ? { deliveryDate: range } : {}),
      ...(query.priceListId ? { salesOrder: { priceListId: query.priceListId } } : {}),
    },
    select: {
      ...partySelect,
      id: true,
      number: true,
      challanNo: true,
      deliveryDate: true,
      deliveryType: true,
      confirmation: true,
      totalQty: true,
      totalAmount: true,
      paidAmount: true,
      office: { select: { name: true } },
      salesOrder: { select: { number: true } },
      lines: withLines ? lineSelect : { take: 0, ...lineSelect },
    },
    orderBy: [{ deliveryDate: "asc" }, { number: "asc" }],
    take: READ_LIMIT,
  });
}

function loadReturns(unitIds: string[], query: Query, withLines = false) {
  const range = dateRange(query);
  return db().salesReturn.findMany({
    where: { ...partyWhere(unitIds, query, true), ...(range ? { returnDate: range } : {}) },
    select: { ...partySelect, id: true, returnDate: true, totalQty: true, totalAmount: true, lines: withLines ? lineSelect : { take: 0, ...lineSelect } },
    take: READ_LIMIT,
  });
}

function loadCollections(unitIds: string[], query: Query) {
  const range = dateRange(query);
  return db().salesCollection.findMany({
    where: { ...partyWhere(unitIds, query, true), ...(range ? { collectionDate: range } : {}) },
    select: { ...partySelect, collectionDate: true, amount: true },
    take: READ_LIMIT,
  });
}

type Totals = { invoices: number; qty: number; sales: number; returnQty: number; returns: number; collection: number };
const blank = (): Totals => ({ invoices: 0, qty: 0, sales: 0, returnQty: 0, returns: 0, collection: 0 });

/** Sales, returns and collections added up per key. */
async function totalsBy(unitIds: string[], query: Query, keyOf: (row: { customerId: string; salesPersonId: string | null; customer: { code: string; name: string; customerGroup: { name: string } | null; territory: { name: string } | null }; salesPerson: { name: string } | null }, date: Date) => string | null) {
  const [deliveries, returns, collections] = await Promise.all([loadDeliveries(unitIds, query), loadReturns(unitIds, query), loadCollections(unitIds, query)]);
  const totals = new Map<string, Totals>();
  const at = (key: string) => {
    let value = totals.get(key);
    if (!value) totals.set(key, (value = blank()));
    return value;
  };
  for (const row of deliveries) {
    const key = keyOf(row, row.deliveryDate);
    if (key === null) continue;
    const value = at(key);
    value.invoices += 1;
    value.qty += num(row.totalQty);
    value.sales += num(row.totalAmount);
  }
  for (const row of returns) {
    const key = keyOf(row, row.returnDate);
    if (key === null) continue;
    at(key).returnQty += num(row.totalQty);
    at(key).returns += num(row.totalAmount);
  }
  for (const row of collections) {
    const key = keyOf(row, row.collectionDate);
    if (key === null) continue;
    at(key).collection += num(row.amount);
  }
  return totals;
}

const salesColumns = [qty("qty", "Quantity"), amount("sales", "Sales"), amount("returns", "Returns"), amount("net", "Net Sales"), amount("collection", "Collection")];
const salesCells = (value: Totals): Row => ({
  invoices: value.invoices,
  qty: round3(value.qty - value.returnQty),
  sales: money(value.sales),
  returns: money(value.returns),
  net: money(value.sales - value.returns),
  collection: money(value.collection),
});

/** Signed customer balance: delivered − returned − collected, all time. */
async function signedBalances(unitIds: string[], customerIds?: string[]) {
  const scope = { businessUnitId: { in: unitIds }, status: LIVE, ...(customerIds ? { customerId: { in: customerIds } } : {}) };
  const [delivered, returned, collected] = await Promise.all([
    db().salesDelivery.groupBy({ by: ["customerId"], where: scope, _sum: { totalAmount: true } }),
    db().salesReturn.groupBy({ by: ["customerId"], where: scope, _sum: { totalAmount: true } }),
    db().salesCollection.groupBy({ by: ["customerId"], where: scope, _sum: { amount: true } }),
  ]);
  const balance = new Map<string, number>();
  for (const row of delivered) balance.set(row.customerId, (balance.get(row.customerId) ?? 0) + num(row._sum.totalAmount));
  for (const row of returned) balance.set(row.customerId, (balance.get(row.customerId) ?? 0) - num(row._sum.totalAmount));
  for (const row of collected) balance.set(row.customerId, (balance.get(row.customerId) ?? 0) - num(row._sum.amount));
  return balance;
}

/** Applies the per-line returns to item sales. */
async function itemTotals(unitIds: string[], query: Query, keyOf: (item: { code: string; name: string; uom: string; categoryId: string | null }, itemId: string) => string | null) {
  const categories = await categoryTree(unitIds, query.categoryId);
  const [deliveries, returns] = await Promise.all([loadDeliveries(unitIds, query, true), loadReturns(unitIds, query, true)]);
  const totals = new Map<string, { qty: number; amount: number; returnQty: number; returns: number; invoices: Set<string>; minRate: number; maxRate: number }>();
  const at = (key: string) => {
    let value = totals.get(key);
    if (!value) totals.set(key, (value = { qty: 0, amount: 0, returnQty: 0, returns: 0, invoices: new Set(), minRate: Infinity, maxRate: 0 }));
    return value;
  };
  const allowed = (item: { categoryId: string | null }) => !categories || (item.categoryId !== null && categories.has(item.categoryId));
  for (const delivery of deliveries) {
    for (const line of delivery.lines) {
      if (!allowed(line.item)) continue;
      const key = keyOf(line.item, line.itemId);
      if (key === null) continue;
      const value = at(key);
      const lineQty = num(line.qty);
      value.qty += lineQty;
      value.amount += num(line.amount);
      value.invoices.add(delivery.id);
      if (lineQty > 0) {
        const rate = num(line.amount) / lineQty;
        value.minRate = Math.min(value.minRate, rate);
        value.maxRate = Math.max(value.maxRate, rate);
      }
    }
  }
  for (const salesReturn of returns) {
    for (const line of salesReturn.lines) {
      if (!allowed(line.item)) continue;
      const key = keyOf(line.item, line.itemId);
      if (key === null) continue;
      at(key).returnQty += num(line.qty);
      at(key).returns += num(line.amount);
    }
  }
  return totals;
}

const itemColumns = [qty("qty", "Sold Qty"), amount("amount", "Sales Amount"), qty("returnQty", "Return Qty"), amount("returns", "Return Amount"), qty("netQty", "Net Qty"), amount("net", "Net Amount")];
const itemCells = (value: { qty: number; amount: number; returnQty: number; returns: number }): Row => ({
  qty: round3(value.qty),
  amount: money(value.amount),
  returnQty: round3(value.returnQty),
  returns: money(value.returns),
  netQty: round3(value.qty - value.returnQty),
  net: money(value.amount - value.returns),
});

const byName = (a: Row, b: Row, key = "name") => String(a[key] ?? "").localeCompare(String(b[key] ?? ""));

// ─── Reports ─────────────────────────────────────────────────────────────────

type Builder = (actor: Actor, unitIds: string[], query: Query) => Promise<Omit<ReportResult, "title">>;

const SALES_BUILDERS: Record<(typeof REPORTS)[number]["key"], Builder> = {
  "available-balance": async (_actor, unitIds, query) => {
    const customers = await db().customer.findMany({
      where: { businessUnitId: { in: unitIds }, ...(query.customerId ? { id: query.customerId } : {}), ...(query.customerGroupId ? { customerGroupId: query.customerGroupId } : {}) },
      select: { id: true, code: true, name: true, creditLimit: true, customerGroup: { select: { name: true } } },
      orderBy: { code: "asc" },
    });
    const balances = await signedBalances(unitIds, customers.map((customer) => customer.id));
    return {
      note: "Balance = delivered − returned − collected (negative means the customer paid ahead). Available = credit limit − balance.",
      columns: [col("code", "Customer Code"), col("name", "Customer"), col("group", "Customer Group"), amount("limit", "Credit Limit"), amount("balance", "Balance"), amount("available", "Available Balance")],
      rows: customers.map((customer) => {
        const balance = money(balances.get(customer.id) ?? 0);
        const limit = customer.creditLimit === null ? null : num(customer.creditLimit);
        return { code: customer.code, name: customer.name, group: customer.customerGroup?.name ?? null, limit, balance, available: limit === null ? null : money(limit - Math.max(0, balance)) };
      }),
    };
  },

  customer: async (_actor, unitIds, query) => {
    if (query.summary) {
      const totals = await totalsBy(unitIds, query, (row) => row.customerId);
      const customers = new Map((await db().customer.findMany({ where: { id: { in: [...totals.keys()] } }, select: { id: true, code: true, name: true, customerGroup: { select: { name: true } } } })).map((row) => [row.id, row]));
      return {
        columns: [col("code", "Customer Code"), col("name", "Customer"), col("group", "Customer Group"), col("invoices", "Invoices", "number", true), ...salesColumns],
        rows: [...totals].map(([id, value]) => ({ code: customers.get(id)?.code ?? null, name: customers.get(id)?.name ?? null, group: customers.get(id)?.customerGroup?.name ?? null, ...salesCells(value) })).sort(byName),
      };
    }
    const [deliveries, returns] = await Promise.all([loadDeliveries(unitIds, query, true), loadReturns(unitIds, query, true)]);
    const rows = new Map<string, Row & { qty: number; amount: number; returnQty: number; returns: number }>();
    const at = (customer: { code: string; name: string }, item: { code: string; name: string; uom: string }, key: string) => {
      let value = rows.get(key);
      if (!value) rows.set(key, (value = { code: customer.code, name: customer.name, item: `${item.code} - ${item.name}`, uom: item.uom, qty: 0, amount: 0, returnQty: 0, returns: 0 }));
      return value;
    };
    for (const delivery of deliveries) for (const line of delivery.lines) {
      const value = at(delivery.customer, line.item, `${delivery.customerId}:${line.itemId}`);
      value.qty += num(line.qty);
      value.amount += num(line.amount);
    }
    for (const salesReturn of returns) for (const line of salesReturn.lines) {
      const value = at(salesReturn.customer, line.item, `${salesReturn.customerId}:${line.itemId}`);
      value.returnQty += num(line.qty);
      value.returns += num(line.amount);
    }
    return {
      columns: [col("code", "Customer Code"), col("name", "Customer"), col("item", "Item"), col("uom", "UOM"), ...itemColumns],
      rows: [...rows.values()].map((row) => ({ code: row.code, name: row.name, item: row.item, uom: row.uom, ...itemCells(row) })).sort((a, b) => byName(a, b) || byName(a, b, "item")),
    };
  },

  "credit-utilization": async (_actor, unitIds, query) => {
    const customers = await db().customer.findMany({
      where: {
        businessUnitId: { in: unitIds },
        creditLimit: { gt: 0 },
        ...(query.customerId ? { id: query.customerId } : {}),
        ...(query.customerGroupId ? { customerGroupId: query.customerGroupId } : {}),
        ...(query.territoryId ? { territoryId: query.territoryId } : {}),
        ...(query.salesPersonId ? { salesPersonId: query.salesPersonId } : {}),
        ...(query.officeId ? { deliveries: { some: { officeId: query.officeId } } } : {}),
      },
      select: { id: true, code: true, name: true, creditLimit: true, customerGroup: { select: { name: true } }, territory: { select: { name: true } }, salesPerson: { select: { name: true } } },
      orderBy: { code: "asc" },
    });
    const balances = await customerBalances({ businessUnitIds: unitIds, asOf: toDbDate(query.asOf), customerIds: customers.map((customer) => customer.id) });
    return {
      note: "Outstanding is what is still owed as of today; utilization = outstanding ÷ credit limit.",
      columns: [
        col("code", "Customer Code"),
        col("name", "Customer"),
        col("group", "Customer Group"),
        col("territory", "Territory"),
        col("person", "Sales Person"),
        amount("limit", "Credit Limit"),
        amount("outstanding", "Outstanding"),
        amount("available", "Available"),
        col("utilization", "Credit Utilization %", "percent"),
      ],
      rows: customers
        .map((customer) => {
          const limit = num(customer.creditLimit);
          const outstanding = balances.get(customer.id)?.outstanding ?? 0;
          return {
            code: customer.code,
            name: customer.name,
            group: customer.customerGroup?.name ?? null,
            territory: customer.territory?.name ?? null,
            person: customer.salesPerson?.name ?? null,
            limit,
            outstanding,
            available: money(limit - outstanding),
            utilization: pct(outstanding, limit),
          };
        })
        .filter((row) => query.utilization === undefined || (row.utilization ?? 0) >= query.utilization),
    };
  },

  "customer-details": async (_actor, unitIds, query) => {
    const range = dateRange(query);
    const deliveries = await db().salesDelivery.findMany({
      where: { ...partyWhere(unitIds, query, true), officeId: query.officeId ? query.officeId : { not: null }, ...(range ? { deliveryDate: range } : {}) },
      select: {
        number: true,
        challanNo: true,
        deliveryDate: true,
        dueDate: true,
        totalAmount: true,
        customer: { select: { code: true, name: true } },
        salesPerson: { select: { name: true } },
        exchangeReturn: { select: { status: true, totalAmount: true } },
        returns: { where: { status: LIVE }, select: { totalAmount: true } },
        allocations: { where: { collection: { status: LIVE } }, select: { amount: true } },
      },
      orderBy: [{ deliveryDate: "asc" }, { number: "asc" }],
      take: READ_LIMIT,
    });
    return {
      columns: [col("date", "Invoice Date", "date"), col("invoice", "Invoice No"), col("challan", "Challan No"), col("code", "Customer Code"), col("name", "Customer"), col("person", "Sales Force"), amount("amount", "Invoice Amount"), amount("returned", "Returned"), amount("collected", "Collected"), amount("due", "Due"), col("dueDate", "Due Date", "date")],
      rows: deliveries.map((row) => {
        const total = num(row.totalAmount);
        const returned = money((row.exchangeReturn?.status === LIVE ? num(row.exchangeReturn.totalAmount) : 0) + row.returns.reduce((sum, item) => sum + num(item.totalAmount), 0));
        const collected = money(row.allocations.reduce((sum, item) => sum + num(item.amount), 0));
        return {
          date: fromDbDate(row.deliveryDate),
          invoice: row.number,
          challan: row.challanNo,
          code: row.customer.code,
          name: row.customer.name,
          person: row.salesPerson?.name ?? null,
          amount: total,
          returned,
          collected,
          due: money(Math.max(0, total - returned - collected)),
          dueDate: fromDbDate(row.dueDate),
        };
      }),
    };
  },

  "group-summary": async (_actor, unitIds, query) => {
    const customers = new Map<string, Set<string>>();
    const totals = await totalsBy(unitIds, query, (row) => {
      const group = row.customer.customerGroup?.name ?? "No group";
      customers.set(group, (customers.get(group) ?? new Set()).add(row.customerId));
      return group;
    });
    return {
      columns: [col("name", "Customer Group"), col("customers", "Customers", "number", true), col("invoices", "Invoices", "number", true), ...salesColumns],
      rows: [...totals].map(([name, value]) => ({ name, customers: customers.get(name)?.size ?? 0, ...salesCells(value) })).sort(byName),
    };
  },

  "customer-ledger": async (_actor, unitIds, query) => {
    const customerId = query.customerId!;
    const scope = { businessUnitId: { in: unitIds }, status: LIVE, customerId };
    const from = toDbDate(query.from!);
    const to = toDbDate(query.to!);
    const [openDelivered, openReturned, openCollected, deliveries, returns, collections] = await Promise.all([
      db().salesDelivery.aggregate({ where: { ...scope, deliveryDate: { lt: from } }, _sum: { totalAmount: true } }),
      db().salesReturn.aggregate({ where: { ...scope, returnDate: { lt: from } }, _sum: { totalAmount: true } }),
      db().salesCollection.aggregate({ where: { ...scope, collectionDate: { lt: from } }, _sum: { amount: true } }),
      db().salesDelivery.findMany({ where: { ...scope, deliveryDate: { gte: from, lte: to } }, select: { deliveryDate: true, number: true, challanNo: true, totalAmount: true }, orderBy: { deliveryDate: "asc" } }),
      db().salesReturn.findMany({ where: { ...scope, returnDate: { gte: from, lte: to } }, select: { returnDate: true, number: true, mode: true, totalAmount: true }, orderBy: { returnDate: "asc" } }),
      db().salesCollection.findMany({ where: { ...scope, collectionDate: { gte: from, lte: to } }, select: { collectionDate: true, number: true, method: true, reference: true, amount: true }, orderBy: { collectionDate: "asc" } }),
    ]);
    const entries = [
      ...deliveries.map((row) => ({ date: fromDbDate(row.deliveryDate), type: "Sales Invoice", reference: row.number, description: row.challanNo ? `Challan ${row.challanNo}` : null, debit: num(row.totalAmount), credit: 0 })),
      ...returns.map((row) => ({ date: fromDbDate(row.returnDate), type: "Sales Return", reference: row.number, description: RETURN_MODE_LABELS[row.mode], debit: 0, credit: num(row.totalAmount) })),
      ...collections.map((row) => ({ date: fromDbDate(row.collectionDate), type: "Collection", reference: row.number, description: [COLLECTION_METHOD_LABELS[row.method], row.reference].filter(Boolean).join(" · "), debit: 0, credit: num(row.amount) })),
    ].sort((a, b) => a.date.localeCompare(b.date) || b.debit - a.debit);
    let balance = money(num(openDelivered._sum.totalAmount) - num(openReturned._sum.totalAmount) - num(openCollected._sum.amount));
    const rows: Row[] = [{ date: query.from!, type: "Opening Balance", reference: null, description: null, debit: null, credit: null, balance }];
    for (const entry of entries) {
      balance = money(balance + entry.debit - entry.credit);
      rows.push({ ...entry, balance });
    }
    rows.push({ date: query.to!, type: "Closing Balance", reference: null, description: null, debit: null, credit: null, balance });
    return {
      note: "Debit = invoices; Credit = returns and collections. Balance is what the customer owes (negative = paid ahead).",
      columns: [col("date", "Date", "date"), col("type", "Type"), col("reference", "Reference"), col("description", "Description"), amount("debit", "Debit"), amount("credit", "Credit"), col("balance", "Balance", "amount")],
      rows,
    };
  },

  "customer-sales": async (_actor, unitIds, query) => {
    const totals = await totalsBy(unitIds, query, (row) => `${row.customer.code}\u0000${row.customer.name}`);
    return {
      columns: [col("code", "Customer Code"), col("name", "Customer"), col("invoices", "Invoices", "number", true), ...salesColumns],
      rows: [...totals].map(([key, value]): Row => ({ code: key.split("\u0000")[0], name: key.split("\u0000")[1], ...salesCells(value) })).sort((a, b) => Number(b.net) - Number(a.net)),
    };
  },

  "employee-sales-collection": async (_actor, unitIds, query) => {
    const totals = await totalsBy(unitIds, query, (row) => row.salesPerson?.name ?? "No sales force");
    return {
      columns: [col("name", "Employee"), col("invoices", "Invoices", "number", true), ...salesColumns, col("percent", "Collection %", "percent")],
      rows: [...totals].map(([name, value]) => ({ name, ...salesCells(value), percent: pct(value.collection, value.sales - value.returns) })).sort(byName),
    };
  },

  item: async (_actor, unitIds, query) => {
    const totals = await itemTotals(unitIds, query, (item) => `${item.code}\u0000${item.name}\u0000${item.uom}`);
    return {
      columns: [col("code", "Item Code"), col("name", "Item"), col("uom", "UOM"), ...itemColumns],
      rows: [...totals].map(([key, value]) => {
        const [code, name, uom] = key.split("\u0000");
        return { code, name, uom, ...itemCells(value) };
      }).sort(byName),
    };
  },

  "item-category": async (_actor, unitIds, query) => {
    const categories = new Map((await db().itemCategory.findMany({ where: { businessUnitId: { in: unitIds } }, select: { id: true, name: true, parentId: true } })).map((row) => [row.id, row]));
    const path = (id: string | null): string => {
      const category = id ? categories.get(id) : undefined;
      if (!category) return "No category";
      return category.parentId ? `${path(category.parentId)} › ${category.name}` : category.name;
    };
    const totals = await itemTotals(unitIds, query, (item) => path(item.categoryId));
    return { columns: [col("name", "Item Category"), ...itemColumns], rows: [...totals].map(([name, value]) => ({ name, ...itemCells(value) })).sort(byName) };
  },

  "item-average": async (_actor, unitIds, query) => {
    const totals = await itemTotals(unitIds, query, (item) => `${item.code}\u0000${item.name}\u0000${item.uom}`);
    return {
      note: "Rates are what invoices charged per unit (after line discount, VAT/AIT included).",
      columns: [col("code", "Item Code"), col("name", "Item"), col("uom", "UOM"), col("invoices", "Invoices", "number", true), qty("qty", "Quantity"), amount("amount", "Sales Amount"), col("average", "Average Rate", "amount"), col("min", "Min Rate", "amount"), col("max", "Max Rate", "amount")],
      rows: [...totals]
        .map(([key, value]) => {
          const [code, name, uom] = key.split("\u0000");
          return { code, name, uom, invoices: value.invoices.size, qty: round3(value.qty), amount: money(value.amount), average: value.qty > 0 ? money(value.amount / value.qty) : null, min: Number.isFinite(value.minRate) ? money(value.minRate) : null, max: money(value.maxRate) };
        })
        .sort(byName),
    };
  },

  "monthly-achievement": async (actor, _unitIds, query) => {
    const rows = await targetReport(actor, { year: String(query.year), fromMonth: String(query.fromMonth), toMonth: String(query.toMonth), basis: "AMOUNT", ...(query.salesPersonId ? { salesPersonId: query.salesPersonId } : {}) });
    return {
      note: "Targets come from the amount based target; achieved is delivered less approved returns.",
      columns: [col("name", "Sales Force"), col("designation", "Designation"), col("month", "Month"), amount("target", "Target"), amount("achieved", "Achieved"), col("percent", "Achievement %", "percent")],
      rows: rows.map((row) => ({ name: row.name, designation: row.designation, month: MONTH_NAMES[row.month - 1], target: row.target, achieved: row.achieved, percent: row.percent })),
    };
  },

  "month-sales": async (_actor, unitIds, query) => {
    const totals = await totalsBy(unitIds, query, (_row, date) => fromDbDate(date).slice(0, 7));
    return {
      columns: [col("month", "Month"), col("invoices", "Invoices", "number", true), ...salesColumns],
      rows: [...totals].sort(([a], [b]) => a.localeCompare(b)).map(([month, value]) => ({ month: `${MONTH_NAMES[Number(month.slice(5)) - 1]} ${month.slice(0, 4)}`, ...salesCells(value) })),
    };
  },

  "month-sales-collection": async (_actor, unitIds, query) => {
    const totals = await totalsBy(unitIds, query, (row, date) => `${fromDbDate(date).slice(0, 7)}\u0000${row.customer.customerGroup?.name ?? "No group"}`);
    return {
      note: "Division = customer group.",
      columns: [col("month", "Month"), col("group", "Division"), amount("sales", "Sales"), amount("returns", "Returns"), amount("net", "Net Sales"), amount("collection", "Collection"), col("percent", "Collection %", "percent")],
      rows: [...totals]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, value]) => {
          const [month, group] = key.split("\u0000");
          const net = money(value.sales - value.returns);
          return { month: `${MONTH_NAMES[Number(month.slice(5)) - 1]} ${month.slice(0, 4)}`, group, sales: money(value.sales), returns: money(value.returns), net, collection: money(value.collection), percent: pct(value.collection, net) };
        }),
    };
  },

  "order-booking": async (_actor, unitIds, query) => {
    const orders = await loadOrders(unitIds, query, { not: "CANCELLED" });
    return {
      columns: [col("date", "SO Date", "date"), col("number", "SO No"), col("name", "Customer"), col("person", "Sales Force"), col("status", "Status"), col("payment", "Payment"), qty("qty", "Ordered Qty"), qty("delivered", "Delivered Qty"), col("percent", "Delivered %", "percent"), amount("amount", "Amount")],
      rows: orders.map((order) => {
        const ordered = order.lines.reduce((sum, line) => sum + num(line.qty), 0);
        const delivered = order.lines.reduce((sum, line) => sum + num(line.deliveredQty), 0);
        return { date: fromDbDate(order.orderDate), number: order.number, name: order.customer.name, person: order.salesPerson?.name ?? null, status: ORDER_STATUS_LABELS[order.status], payment: PAYMENT_METHOD_LABELS[order.paymentMethod], qty: round3(ordered), delivered: round3(delivered), percent: pct(delivered, ordered), amount: num(order.salesTotal) };
      }),
    };
  },

  "order-remaining": async (_actor, unitIds, query) => {
    const orders = await loadOrders(unitIds, query, "APPROVED");
    const rows: Row[] = [];
    for (const order of orders) {
      for (const line of order.lines) {
        const remaining = round3(num(line.qty) - num(line.deliveredQty));
        if (remaining <= 0) continue;
        rows.push({
          date: fromDbDate(order.orderDate),
          number: order.number,
          expected: fromDbDate(order.expectedDeliveryDate),
          name: order.customer.name,
          item: `${line.item.code} - ${line.item.name}`,
          ordered: num(line.qty),
          delivered: num(line.deliveredQty),
          remaining,
          value: num(line.qty) > 0 ? money((num(line.lineTotal) * remaining) / num(line.qty)) : 0,
        });
      }
    }
    return { columns: [col("date", "SO Date", "date"), col("number", "SO No"), col("expected", "Exp. Delivery", "date"), col("name", "Customer"), col("item", "Item"), qty("ordered", "Ordered"), qty("delivered", "Delivered"), qty("remaining", "Remaining"), amount("value", "Remaining Value")], rows };
  },

  overdue: async (actor, unitIds, query) => {
    const invoices = (await listDueInvoices(actor, { asOf: query.asOf, officeId: query.officeId, customerId: query.customerId, salesPersonId: query.salesPersonId })).filter((row) => row.overdueDays > 0);
    let inGroup: Set<string> | null = null;
    if (query.customerGroupId) inGroup = new Set((await db().customer.findMany({ where: { businessUnitId: { in: unitIds }, customerGroupId: query.customerGroupId }, select: { id: true } })).map((row) => row.id));
    const bucket = (days: number) => (days <= 30 ? "1–30 days" : days <= 60 ? "31–60 days" : days <= 90 ? "61–90 days" : "Over 90 days");
    return {
      columns: [col("invoice", "Invoice No"), col("date", "Invoice Date", "date"), col("dueDate", "Due Date", "date"), col("days", "Overdue Days", "number"), col("bucket", "Age"), col("code", "Customer Code"), col("name", "Customer"), col("person", "Sales Force"), amount("amount", "Invoice Amount"), amount("due", "Overdue Amount")],
      rows: invoices
        .filter((row) => !inGroup || inGroup.has(row.customerId))
        .sort((a, b) => b.overdueDays - a.overdueDays)
        .map((row) => ({ invoice: row.number, date: row.deliveryDate, dueDate: row.dueDate, days: row.overdueDays, bucket: bucket(row.overdueDays), code: row.customerCode, name: row.customerName, person: row.salesPersonName, amount: row.totalAmount, due: row.due })),
    };
  },

  "payment-method": async (_actor, unitIds, query) => {
    const orders = await loadOrders(unitIds, query, { not: "CANCELLED" });
    const totals = new Map<string, { orders: number; amount: number }>();
    for (const order of orders) {
      const value = totals.get(order.paymentMethod) ?? { orders: 0, amount: 0 };
      value.orders += 1;
      value.amount += num(order.salesTotal);
      totals.set(order.paymentMethod, value);
    }
    const all = [...totals.values()].reduce((sum, value) => sum + value.amount, 0);
    return {
      columns: [col("method", "Payment Method"), col("orders", "Orders", "number", true), amount("amount", "Order Amount"), col("share", "Share %", "percent")],
      rows: [...totals].map(([method, value]) => ({ method: PAYMENT_METHOD_LABELS[method as keyof typeof PAYMENT_METHOD_LABELS], orders: value.orders, amount: money(value.amount), share: pct(value.amount, all) })),
    };
  },

  "received-due": async (actor, unitIds, query) => {
    const totals = await totalsBy(unitIds, query, (row) => row.customerId);
    const dues = await listDueInvoices(actor, { asOf: query.asOf, officeId: query.officeId, customerId: query.customerId });
    const dueBy = new Map<string, number>();
    for (const row of dues) dueBy.set(row.customerId, (dueBy.get(row.customerId) ?? 0) + row.due);
    const ids = [...new Set([...totals.keys(), ...(query.customerGroupId ? [] : dueBy.keys())])];
    const customers = await db().customer.findMany({
      where: { id: { in: ids }, ...(query.customerGroupId ? { customerGroupId: query.customerGroupId } : {}) },
      select: { id: true, code: true, name: true },
      orderBy: { code: "asc" },
    });
    return {
      note: "Sales and received are in the date range; due is what is owed on invoices today.",
      columns: [col("code", "Customer Code"), col("name", "Customer"), amount("sales", "Net Sales"), amount("received", "Received"), amount("due", "Due Now")],
      rows: customers.map((customer) => {
        const value = totals.get(customer.id) ?? blank();
        return { code: customer.code, name: customer.name, sales: money(value.sales - value.returns), received: money(value.collection), due: money(dueBy.get(customer.id) ?? 0) };
      }),
    };
  },

  "referred-by": async (_actor, unitIds, query) => {
    const orders = await loadOrders(unitIds, query, { not: "CANCELLED" });
    const totals = new Map<string, { orders: number; customers: Set<string>; amount: number }>();
    for (const order of orders) {
      const key = order.referredBy?.trim() || "Not referred";
      const value = totals.get(key) ?? { orders: 0, customers: new Set<string>(), amount: 0 };
      value.orders += 1;
      value.customers.add(order.customer.name);
      value.amount += num(order.salesTotal);
      totals.set(key, value);
    }
    return {
      columns: [col("name", "Referred By"), col("orders", "Orders", "number", true), col("customers", "Customers", "number"), amount("amount", "Order Amount")],
      rows: [...totals].map(([name, value]) => ({ name, orders: value.orders, customers: value.customers.size, amount: money(value.amount) })).sort(byName),
    };
  },

  "delivery-report": async (_actor, unitIds, query) => {
    const deliveries = await loadDeliveries(unitIds, query);
    return {
      columns: [col("date", "Delivery Date", "date"), col("invoice", "Invoice No"), col("challan", "Challan No"), col("so", "SO No"), col("office", "Office"), col("name", "Customer"), col("person", "Sales Force"), col("type", "Type"), col("confirmation", "Confirmation"), qty("qty", "Quantity"), amount("amount", "Amount"), amount("paid", "Paid on Delivery")],
      rows: deliveries.map((row) => ({
        date: fromDbDate(row.deliveryDate),
        invoice: row.number,
        challan: row.challanNo,
        so: row.salesOrder?.number ?? null,
        office: row.office?.name ?? null,
        name: row.customer.name,
        person: row.salesPerson?.name ?? null,
        type: DELIVERY_TYPE_LABELS[row.deliveryType],
        confirmation: CONFIRMATION_LABELS[row.confirmation],
        qty: num(row.totalQty),
        amount: num(row.totalAmount),
        paid: num(row.paidAmount),
      })),
    };
  },

  "delivery-schedule": async (_actor, unitIds, query) => {
    const range = dateRange(query);
    const orders = await loadOrders(unitIds, { ...query, from: undefined, to: undefined }, "APPROVED", range);
    const asOf = toDbDate(query.asOf).getTime();
    return {
      columns: [col("expected", "Exp. Delivery", "date"), col("late", "Days Late", "number"), col("number", "SO No"), col("date", "SO Date", "date"), col("name", "Customer"), col("person", "Sales Force"), qty("ordered", "Ordered"), qty("delivered", "Delivered"), qty("remaining", "Remaining"), amount("value", "Remaining Value")],
      rows: orders
        .map((order) => {
          const ordered = order.lines.reduce((sum, line) => sum + num(line.qty), 0);
          const delivered = order.lines.reduce((sum, line) => sum + num(line.deliveredQty), 0);
          const value = order.lines.reduce((sum, line) => sum + (num(line.qty) > 0 ? (num(line.lineTotal) * Math.max(0, num(line.qty) - num(line.deliveredQty))) / num(line.qty) : 0), 0);
          return {
            expected: fromDbDate(order.expectedDeliveryDate),
            late: Math.max(0, Math.round((asOf - order.expectedDeliveryDate.getTime()) / DAY_MS)),
            number: order.number,
            date: fromDbDate(order.orderDate),
            name: order.customer.name,
            person: order.salesPerson?.name ?? null,
            ordered: round3(ordered),
            delivered: round3(delivered),
            remaining: round3(ordered - delivered),
            value: money(value),
          };
        })
        .filter((row) => Number(row.remaining) > 0)
        .sort((a, b) => a.expected.localeCompare(b.expected)),
    };
  },

  "return-report": async (_actor, unitIds, query) => {
    const range = dateRange(query);
    const returns = await db().salesReturn.findMany({
      where: { ...partyWhere(unitIds, query, true), status: { not: "CANCELLED" }, ...(range ? { returnDate: range } : {}) },
      select: { returnDate: true, number: true, kind: true, mode: true, status: true, totalQty: true, totalAmount: true, customer: { select: { name: true } }, salesPerson: { select: { name: true } }, delivery: { select: { number: true } } },
      orderBy: [{ returnDate: "asc" }, { number: "asc" }],
      take: READ_LIMIT,
    });
    return {
      note: "Pending returns are listed but credit the customer only once approved.",
      columns: [col("date", "Return Date", "date"), col("number", "Return No"), col("type", "Return Type"), col("kind", "Type"), col("status", "Status"), col("invoice", "Invoice No"), col("name", "Customer"), col("person", "Sales Force"), qty("qty", "Quantity"), amount("amount", "Return Amount")],
      rows: returns.map((row) => ({
        date: fromDbDate(row.returnDate),
        number: row.number,
        type: RETURN_MODE_LABELS[row.mode],
        kind: RETURN_KIND_LABELS[row.kind],
        status: RETURN_STATUS_LABELS[row.status],
        invoice: row.delivery?.number ?? null,
        name: row.customer.name,
        person: row.salesPerson?.name ?? null,
        qty: num(row.totalQty),
        amount: num(row.totalAmount),
      })),
    };
  },

  "territory-sales": async (_actor, unitIds, query) => {
    const customers = new Map<string, Set<string>>();
    const totals = await totalsBy(unitIds, query, (row) => {
      const territory = row.customer.territory?.name ?? "No territory";
      customers.set(territory, (customers.get(territory) ?? new Set()).add(row.customerId));
      return territory;
    });
    return {
      columns: [col("name", "Territory"), col("customers", "Customers", "number", true), col("invoices", "Invoices", "number", true), ...salesColumns],
      rows: [...totals].map(([name, value]) => ({ name, customers: customers.get(name)?.size ?? 0, ...salesCells(value) })).sort(byName),
    };
  },
};


// ─── Sales Analytics & Reports ───────────────────────────────────────────────

/** Customers in the chosen sales area (null when no area filter is set). */
async function areaCustomers(unitIds: string[], query: Query): Promise<Set<string> | null> {
  const filter = customerFilter(query);
  if (!filter) return null;
  const rows = await db().customer.findMany({ where: { businessUnitId: { in: unitIds }, ...filter }, select: { id: true } });
  return new Set(rows.map((row) => row.id));
}

const addDaysTo = (date: string, days: number) => {
  const value = toDbDate(date);
  value.setUTCDate(value.getUTCDate() + days);
  return fromDbDate(value);
};

/** Invoice dues as of the To Date, limited to the sales area. */
async function areaDues(actor: Actor, unitIds: string[], query: Query) {
  const [dues, allowed] = await Promise.all([listDueInvoices(actor, { asOf: query.to ?? query.asOf, officeId: query.officeId }), areaCustomers(unitIds, query)]);
  return dues.filter((row) => !allowed || allowed.has(row.customerId));
}

const AGING = [
  { key: "notDue", label: "Not Due", test: (days: number) => days === 0 },
  { key: "d30", label: "1–30 Days", test: (days: number) => days > 0 && days <= 30 },
  { key: "d60", label: "31–60 Days", test: (days: number) => days > 30 && days <= 60 },
  { key: "d90", label: "61–90 Days", test: (days: number) => days > 60 && days <= 90 },
  { key: "d120", label: "91–120 Days", test: (days: number) => days > 90 && days <= 120 },
  { key: "over", label: "Over 120 Days", test: (days: number) => days > 120 },
] as const;

async function categoryPaths(unitIds: string[]) {
  const categories = new Map((await db().itemCategory.findMany({ where: { businessUnitId: { in: unitIds } }, select: { id: true, name: true, parentId: true } })).map((row) => [row.id, row]));
  const path = (id: string | null): string => {
    const category = id ? categories.get(id) : undefined;
    if (!category) return "No category";
    return category.parentId ? `${path(category.parentId)} › ${category.name}` : category.name;
  };
  return path;
}

const ANALYTICS_BUILDERS: Record<(typeof ANALYTICS)[number]["key"], Builder> = {
  "abp-target": async (_actor, unitIds, query) => {
    const from = toDbDate(`${query.from!.slice(0, 7)}-01`);
    const [targets, totals] = await Promise.all([
      db().salesTarget.findMany({
        where: { businessUnitId: { in: unitIds }, budget: { basis: "AMOUNT" }, month: { gte: from, lte: toDbDate(query.to!) } },
        select: { salesPersonId: true, amount: true },
      }),
      totalsBy(unitIds, query, (row) => row.salesPersonId),
    ]);
    const target = new Map<string, number>();
    for (const row of targets) target.set(row.salesPersonId, (target.get(row.salesPersonId) ?? 0) + num(row.amount));
    const ids = [...new Set([...target.keys(), ...[...totals.keys()].filter((id) => id !== "null")])];
    const persons = await db().salesPerson.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, designation: true } });
    return {
      note: "ABP = annual business plan: the amount based targets of the months in the range. Achieved is delivered less approved returns in the area.",
      columns: [col("name", "Sales Force"), col("designation", "Designation"), amount("target", "Target"), amount("achieved", "Achieved"), amount("gap", "Gap"), col("percent", "Achievement %", "percent")],
      rows: persons
        .map((person) => {
          const value = totals.get(person.id) ?? blank();
          const goal = money(target.get(person.id) ?? 0);
          const achieved = money(value.sales - value.returns);
          return { name: person.name, designation: person.designation, target: goal, achieved, gap: money(goal - achieved), percent: pct(achieved, goal) };
        })
        .sort(byName),
    };
  },

  "customer-aging": async (actor, unitIds, query) => {
    const dues = await areaDues(actor, unitIds, query);
    const byCustomer = new Map<string, { code: string; name: string; total: number; buckets: Record<string, number> }>();
    for (const due of dues) {
      let entry = byCustomer.get(due.customerId);
      if (!entry) byCustomer.set(due.customerId, (entry = { code: due.customerCode, name: due.customerName, total: 0, buckets: {} }));
      const bucket = AGING.find((candidate) => candidate.test(due.overdueDays))!;
      entry.buckets[bucket.key] = money((entry.buckets[bucket.key] ?? 0) + due.due);
      entry.total = money(entry.total + due.due);
    }
    return {
      note: `Amounts still owed on invoices as of ${query.to ?? query.asOf}, by days past the due date.`,
      columns: [col("code", "Customer Code"), col("name", "Customer"), ...AGING.map((bucket) => amount(bucket.key, bucket.label)), amount("total", "Total Due")],
      rows: [...byCustomer.values()]
        .sort((a, b) => b.total - a.total)
        .map((entry): Row => ({ code: entry.code, name: entry.name, ...Object.fromEntries(AGING.map((bucket) => [bucket.key, entry.buckets[bucket.key] ?? 0])), total: entry.total })),
    };
  },

  "category-comparison": async (_actor, unitIds, query) => {
    const days = Math.round((toDbDate(query.to!).getTime() - toDbDate(query.from!).getTime()) / DAY_MS);
    const previousTo = addDaysTo(query.from!, -1);
    const previous = { ...query, from: addDaysTo(previousTo, -days), to: previousTo };
    const path = await categoryPaths(unitIds);
    const [current, before] = await Promise.all([itemTotals(unitIds, query, (item) => path(item.categoryId)), itemTotals(unitIds, previous, (item) => path(item.categoryId))]);
    const names = [...new Set([...current.keys(), ...before.keys()])].sort();
    return {
      note: `Previous period: ${previous.from} to ${previous.to} (same number of days).`,
      columns: [col("name", "Item Category"), qty("previousQty", "Previous Qty"), amount("previous", "Previous Net Sales"), qty("currentQty", "Current Qty"), amount("current", "Current Net Sales"), amount("change", "Change"), col("growth", "Growth %", "percent")],
      rows: names.map((name) => {
        const now = current.get(name);
        const then = before.get(name);
        const currentNet = now ? money(now.amount - now.returns) : 0;
        const previousNet = then ? money(then.amount - then.returns) : 0;
        return {
          name,
          previousQty: then ? round3(then.qty - then.returnQty) : 0,
          previous: previousNet,
          currentQty: now ? round3(now.qty - now.returnQty) : 0,
          current: currentNet,
          change: money(currentNet - previousNet),
          growth: previousNet !== 0 ? Math.round(((currentNet - previousNet) / Math.abs(previousNet)) * 10_000) / 100 : null,
        };
      }),
    };
  },

  collection: async (_actor, unitIds, query) => {
    const range = dateRange(query);
    const rows = await db().salesCollection.findMany({
      where: { ...partyWhere(unitIds, query, true), ...(range ? { collectionDate: range } : {}) },
      select: {
        collectionDate: true,
        number: true,
        kind: true,
        method: true,
        reference: true,
        bankName: true,
        amount: true,
        customer: { select: { code: true, name: true, customerGroup: { select: { name: true } } } },
        salesPerson: { select: { name: true } },
        office: { select: { name: true } },
        delivery: { select: { number: true } },
      },
      orderBy: [{ collectionDate: "asc" }, { number: "asc" }],
      take: READ_LIMIT,
    });
    return {
      columns: [col("date", "Date", "date"), col("number", "Receipt No"), col("kind", "Type"), col("office", "Office"), col("code", "Customer Code"), col("name", "Customer"), col("region", "Region"), col("method", "Method"), col("reference", "Reference"), col("person", "Collect By"), amount("amount", "Amount")],
      rows: rows.map((row) => ({
        date: fromDbDate(row.collectionDate),
        number: row.number,
        kind: row.delivery ? `On delivery ${row.delivery.number}` : row.kind === "ADVANCE" ? "Advance" : "By Invoice",
        office: row.office?.name ?? null,
        code: row.customer.code,
        name: row.customer.name,
        region: row.customer.customerGroup?.name ?? null,
        method: COLLECTION_METHOD_LABELS[row.method],
        reference: [row.reference, row.bankName].filter(Boolean).join(" · ") || null,
        person: row.salesPerson?.name ?? null,
        amount: num(row.amount),
      })),
    };
  },

  "credit-note": async (_actor, unitIds, query) => {
    const range = dateRange(query);
    const rows = await db().salesReturn.findMany({
      where: { ...partyWhere(unitIds, query, true), ...(range ? { returnDate: range } : {}) },
      select: {
        returnDate: true,
        number: true,
        mode: true,
        kind: true,
        reason: true,
        totalQty: true,
        itemsBase: true,
        vatAmount: true,
        totalAmount: true,
        customer: { select: { code: true, name: true } },
        delivery: { select: { number: true } },
      },
      orderBy: [{ returnDate: "asc" }, { number: "asc" }],
      take: READ_LIMIT,
    });
    return {
      note: "Approved returns: each one credits the customer.",
      columns: [col("date", "Date", "date"), col("number", "Credit Note No"), col("type", "Return Type"), col("kind", "Type"), col("invoice", "Against Invoice"), col("code", "Customer Code"), col("name", "Customer"), col("reason", "Reason"), qty("qty", "Quantity"), amount("base", "Value (Without VAT)"), amount("vat", "VAT"), amount("amount", "Credit Amount")],
      rows: rows.map((row) => ({
        date: fromDbDate(row.returnDate),
        number: row.number,
        type: RETURN_MODE_LABELS[row.mode],
        kind: RETURN_KIND_LABELS[row.kind],
        invoice: row.delivery?.number ?? null,
        code: row.customer.code,
        name: row.customer.name,
        reason: row.reason,
        qty: num(row.totalQty),
        base: num(row.itemsBase),
        vat: num(row.vatAmount),
        amount: num(row.totalAmount),
      })),
    };
  },

  "customer-category-sales": async (_actor, unitIds, query) => {
    const path = await categoryPaths(unitIds);
    const [deliveries, returns] = await Promise.all([loadDeliveries(unitIds, query, true), loadReturns(unitIds, query, true)]);
    const totals = new Map<string, { code: string; name: string; category: string; qty: number; amount: number; returnQty: number; returns: number }>();
    const at = (customer: { code: string; name: string }, categoryId: string | null) => {
      const category = path(categoryId);
      const key = `${customer.code}\u0000${category}`;
      let value = totals.get(key);
      if (!value) totals.set(key, (value = { code: customer.code, name: customer.name, category, qty: 0, amount: 0, returnQty: 0, returns: 0 }));
      return value;
    };
    for (const delivery of deliveries) for (const line of delivery.lines) {
      const value = at(delivery.customer, line.item.categoryId);
      value.qty += num(line.qty);
      value.amount += num(line.amount);
    }
    for (const salesReturn of returns) for (const line of salesReturn.lines) {
      const value = at(salesReturn.customer, line.item.categoryId);
      value.returnQty += num(line.qty);
      value.returns += num(line.amount);
    }
    return {
      columns: [col("code", "Customer Code"), col("name", "Customer"), col("category", "Item Category"), ...itemColumns],
      rows: [...totals.values()].map((row) => ({ code: row.code, name: row.name, category: row.category, ...itemCells(row) })).sort((a, b) => byName(a, b) || byName(a, b, "category")),
    };
  },

  "season-closing": async (_actor, unitIds, query) => {
    const from = toDbDate(query.from!);
    const to = toDbDate(query.to!);
    const allowed = await areaCustomers(unitIds, query);
    const scope = {
      businessUnitId: { in: unitIds },
      status: LIVE,
      ...(allowed ? { customerId: { in: [...allowed] } } : {}),
    };
    const office = query.officeId ? { officeId: query.officeId } : {};
    const sum = <T extends { customerId: string; _sum: Record<string, Prisma.Decimal | null> }>(rows: T[], field: string) => new Map(rows.map((row) => [row.customerId, num(row._sum[field])]));
    const [openSales, openReturns, openCollections, sales, returns, collections] = await Promise.all([
      db().salesDelivery.groupBy({ by: ["customerId"], where: { ...scope, ...office, deliveryDate: { lt: from } }, _sum: { totalAmount: true } }),
      db().salesReturn.groupBy({ by: ["customerId"], where: { ...scope, ...office, returnDate: { lt: from } }, _sum: { totalAmount: true } }),
      db().salesCollection.groupBy({ by: ["customerId"], where: { ...scope, ...office, collectionDate: { lt: from } }, _sum: { amount: true } }),
      db().salesDelivery.groupBy({ by: ["customerId"], where: { ...scope, ...office, deliveryDate: { gte: from, lte: to } }, _sum: { totalAmount: true } }),
      db().salesReturn.groupBy({ by: ["customerId"], where: { ...scope, ...office, returnDate: { gte: from, lte: to } }, _sum: { totalAmount: true } }),
      db().salesCollection.groupBy({ by: ["customerId"], where: { ...scope, ...office, collectionDate: { gte: from, lte: to } }, _sum: { amount: true } }),
    ]);
    const maps = {
      openSales: sum(openSales, "totalAmount"),
      openReturns: sum(openReturns, "totalAmount"),
      openCollections: sum(openCollections, "amount"),
      sales: sum(sales, "totalAmount"),
      returns: sum(returns, "totalAmount"),
      collections: sum(collections, "amount"),
    };
    const ids = [...new Set(Object.values(maps).flatMap((map) => [...map.keys()]))];
    const customers = await db().customer.findMany({ where: { id: { in: ids } }, select: { id: true, code: true, name: true }, orderBy: { code: "asc" } });
    return {
      note: "Closing = opening + sales − returns − collections.",
      columns: [col("code", "Customer Code"), col("name", "Customer"), amount("opening", "Opening Balance"), amount("sales", "Sales"), amount("returns", "Returns"), amount("collections", "Collections"), amount("closing", "Closing Balance")],
      rows: customers.map((customer) => {
        const get = (map: Map<string, number>) => map.get(customer.id) ?? 0;
        const opening = money(get(maps.openSales) - get(maps.openReturns) - get(maps.openCollections));
        const closing = money(opening + get(maps.sales) - get(maps.returns) - get(maps.collections));
        return { code: customer.code, name: customer.name, opening, sales: money(get(maps.sales)), returns: money(get(maps.returns)), collections: money(get(maps.collections)), closing };
      }),
    };
  },

  "customer-credit-invoice": async (actor, unitIds, query) => {
    const dues = await areaDues(actor, unitIds, query);
    const byCustomer = new Map<string, { invoices: number; due: number; overdue: number; oldest: string }>();
    for (const due of dues) {
      const value = byCustomer.get(due.customerId) ?? { invoices: 0, due: 0, overdue: 0, oldest: due.deliveryDate };
      value.invoices += 1;
      value.due += due.due;
      if (due.overdueDays > 0) value.overdue += due.due;
      if (due.deliveryDate < value.oldest) value.oldest = due.deliveryDate;
      byCustomer.set(due.customerId, value);
    }
    const customers = await db().customer.findMany({
      where: { id: { in: [...byCustomer.keys()] } },
      select: { id: true, code: true, name: true, creditLimit: true, creditDays: true },
      orderBy: { code: "asc" },
    });
    return {
      columns: [col("code", "Customer Code"), col("name", "Customer"), amount("limit", "Credit Limit"), col("days", "Credit Days", "number"), col("invoices", "Open Invoices", "number", true), col("oldest", "Oldest Invoice", "date"), amount("due", "Due"), amount("overdue", "Overdue"), amount("available", "Available Credit")],
      rows: customers.map((customer) => {
        const value = byCustomer.get(customer.id)!;
        const limit = customer.creditLimit === null ? null : num(customer.creditLimit);
        return {
          code: customer.code,
          name: customer.name,
          limit,
          days: customer.creditDays,
          invoices: value.invoices,
          oldest: value.oldest,
          due: money(value.due),
          overdue: money(value.overdue),
          available: limit === null ? null : money(limit - value.due),
        };
      }),
    };
  },

  "group-recovery": async (_actor, unitIds, query) => {
    const totals = await totalsBy(unitIds, query, (row) => row.customer.customerGroup?.name ?? "No region");
    return {
      note: "Recovery = collections; Adjustment = approved returns; Net = sales − recovery − adjustment.",
      columns: [col("name", "Region (Customer Group)"), col("invoices", "Invoices", "number", true), amount("sales", "Sales"), amount("recovery", "Recovery"), amount("adjustment", "Adjustment"), amount("net", "Net"), col("percent", "Recovery %", "percent")],
      rows: [...totals]
        .map(([name, value]) => ({
          name,
          invoices: value.invoices,
          sales: money(value.sales),
          recovery: money(value.collection),
          adjustment: money(value.returns),
          net: money(value.sales - value.collection - value.returns),
          percent: pct(value.collection + value.returns, value.sales),
        }))
        .sort(byName),
    };
  },

  "master-invoice": async (_actor, unitIds, query) => {
    const range = dateRange(query);
    const lines = await db().salesDeliveryLine.findMany({
      where: { delivery: { ...partyWhere(unitIds, query, true), officeId: query.officeId ? query.officeId : { not: null }, ...(range ? { deliveryDate: range } : {}) } },
      select: {
        lineNo: true,
        qty: true,
        rate: true,
        discountPercent: true,
        vatAmount: true,
        amount: true,
        item: { select: { code: true, name: true, uom: true } },
        delivery: {
          select: {
            number: true,
            challanNo: true,
            deliveryDate: true,
            office: { select: { name: true } },
            salesOrder: { select: { number: true } },
            salesPerson: { select: { name: true } },
            customer: { select: { code: true, name: true, customerGroup: { select: { name: true } }, territory: { select: { name: true } } } },
          },
        },
      },
      orderBy: [{ delivery: { deliveryDate: "asc" } }, { delivery: { number: "asc" } }, { lineNo: "asc" }],
      take: READ_LIMIT,
    });
    return {
      columns: [
        col("date", "Invoice Date", "date"),
        col("invoice", "Invoice No"),
        col("challan", "Challan No"),
        col("so", "SO No"),
        col("office", "Office"),
        col("code", "Customer Code"),
        col("name", "Customer"),
        col("region", "Region"),
        col("territory", "Territory"),
        col("person", "Sales Force"),
        col("item", "Item"),
        col("uom", "UOM"),
        qty("qty", "Quantity"),
        col("rate", "Rate", "amount"),
        col("discount", "Disc %", "percent"),
        amount("vat", "VAT"),
        amount("amount", "Amount"),
      ],
      rows: lines.map((line) => ({
        date: fromDbDate(line.delivery.deliveryDate),
        invoice: line.delivery.number,
        challan: line.delivery.challanNo,
        so: line.delivery.salesOrder?.number ?? null,
        office: line.delivery.office?.name ?? null,
        code: line.delivery.customer.code,
        name: line.delivery.customer.name,
        region: line.delivery.customer.customerGroup?.name ?? null,
        territory: line.delivery.customer.territory?.name ?? null,
        person: line.delivery.salesPerson?.name ?? null,
        item: `${line.item.code} - ${line.item.name}`,
        uom: line.item.uom,
        qty: num(line.qty),
        rate: num(line.rate),
        discount: num(line.discountPercent),
        vat: num(line.vatAmount),
        amount: num(line.amount),
      })),
    };
  },
};

const BUILDERS: Record<ReportKey, Builder> = { ...SALES_BUILDERS, ...ANALYTICS_BUILDERS };

function loadOrders(unitIds: string[], query: Query, status: Prisma.SalesOrderWhereInput["status"], expected?: { gte?: Date; lte?: Date }) {
  const range = dateRange(query);
  const customer = customerFilter(query);
  return db().salesOrder.findMany({
    where: {
      businessUnitId: { in: unitIds },
      status,
      ...(query.officeId ? { officeId: query.officeId } : {}),
      ...(query.customerId ? { customerId: query.customerId } : {}),
      ...(query.salesPersonId ? { salesPersonId: query.salesPersonId } : {}),
      ...(customer ? { customer } : {}),
      ...(range ? { orderDate: range } : {}),
      ...(expected ? { expectedDeliveryDate: expected } : {}),
    },
    select: {
      number: true,
      orderDate: true,
      expectedDeliveryDate: true,
      status: true,
      paymentMethod: true,
      referredBy: true,
      salesTotal: true,
      customer: { select: { name: true } },
      salesPerson: { select: { name: true } },
      lines: { select: { qty: true, deliveredQty: true, lineTotal: true, item: { select: { code: true, name: true } } } },
    },
    orderBy: [{ orderDate: "asc" }, { number: "asc" }],
    take: READ_LIMIT,
  });
}

export async function getReport(actor: Actor, raw: unknown): Promise<ReportResult> {
  const query = reportQuerySchema.parse(raw);
  const definition = ALL_REPORTS.find((report) => report.key === query.report)!;
  const needed = [...(definition.required ?? []), ...(ANALYTICS.some((report) => report.key === query.report) ? (["from", "to"] as const) : [])];
  const missing = needed.filter((filter) =>
    filter === "customer" ? !query.customerId : filter === "from" ? !query.from : filter === "to" ? !query.to : filter === "year" ? !query.year : filter === "months" ? !query.fromMonth || !query.toMonth : false,
  );
  if (missing.length) throw badRequest(`Select ${missing.map((filter) => (filter === "months" ? "the months" : filter === "from" ? "From Date" : filter === "to" ? "To Date" : filter)).join(", ")} for this report.`);
  const unitIds = await scopedBusinessUnitIds(actor);
  const result = await BUILDERS[query.report](actor, unitIds, query);
  return { title: definition.label, ...result };
}
