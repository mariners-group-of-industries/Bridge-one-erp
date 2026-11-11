import { z } from "zod";
import { badRequest, notFound } from "@/lib/api/errors";
import type { Actor } from "@/lib/auth/actor";
import { db } from "@/lib/prisma/client";
import {
  DATE,
  actorName,
  dateRange,
  documentNumber,
  fromDbDate,
  num,
  postDistributorStock,
  r2,
  r3,
  requireEmployee,
  requireItems,
  requireOutlet,
  toDbDate,
  unitIds,
  type Client,
} from "./common";
import { bestOffer, getSettings } from "./masters.service";

const optUuid = z.preprocess((v) => (v === "" ? undefined : v), z.uuid().optional());
const text = (max: number) => z.string().trim().max(max).optional().transform((v) => v || undefined);
const line = z.object({ itemId: z.uuid(), qty: z.coerce.number().finite().positive("Quantities must be greater than 0."), rate: z.coerce.number().finite().min(0).optional() });

export interface ListFilters {
  from?: string;
  to?: string;
  distributorId?: string;
  outletId?: string;
  status?: string;
}

const linesDto = (lines: { itemId: string; qty: unknown; rate: unknown; amount: unknown; item: { code: string; name: string; uom: string } }[]) =>
  lines.map((l) => ({ itemId: l.itemId, itemCode: l.item.code, itemName: l.item.name, uom: l.item.uom, qty: num(l.qty), rate: num(l.rate), amount: num(l.amount) }));
const itemSelect = { item: { select: { code: true, name: true, uom: true } } } as const;

/** What an outlet owes: deliveries − collections − returns. */
export async function outletBalances(client: Client, outletIds: string[]) {
  const where = { outletId: { in: outletIds }, status: { not: "CANCELLED" as const } };
  const [d, c, r] = await Promise.all([
    client.rtmDelivery.groupBy({ by: ["outletId"], where, _sum: { total: true } }),
    client.rtmCollection.groupBy({ by: ["outletId"], where, _sum: { amount: true } }),
    client.rtmReturn.groupBy({ by: ["outletId"], where, _sum: { total: true } }),
  ]);
  const balance = new Map(outletIds.map((id) => [id, 0]));
  for (const x of d) balance.set(x.outletId, (balance.get(x.outletId) ?? 0) + num(x._sum.total));
  for (const x of c) balance.set(x.outletId, (balance.get(x.outletId) ?? 0) - num(x._sum.amount));
  for (const x of r) balance.set(x.outletId, (balance.get(x.outletId) ?? 0) - num(x._sum.total));
  for (const [k, v] of balance) balance.set(k, r2(v));
  return balance;
}

async function assertCredit(client: Client, outletId: string, businessUnitId: string, adding: number) {
  if ((await getSettings(businessUnitId)).enforceCreditLimit !== "true") return;
  const outlet = await client.rtmOutlet.findUniqueOrThrow({ where: { id: outletId }, select: { name: true, creditLimit: true } });
  if (outlet.creditLimit === null) return;
  const due = (await outletBalances(client, [outletId])).get(outletId) ?? 0;
  if (due + adding > num(outlet.creditLimit) + 0.005) {
    throw badRequest(`${outlet.name} would owe ${r2(due + adding)}, over its credit limit of ${num(outlet.creditLimit)}.`);
  }
}

// ── Retail orders ────────────────────────────────────────────────────────────

const orderSchema = z.object({
  orderDate: z.string().regex(DATE),
  outletId: z.uuid("Select the outlet."),
  srId: optUuid,
  remarks: text(500),
  lines: z.array(line).min(1, "Add at least one item.").max(200),
});

const orderInclude = {
  outlet: { select: { name: true, code: true } },
  distributor: { select: { name: true } },
  sr: { select: { name: true } },
  offer: { select: { name: true } },
  lines: { orderBy: { lineNo: "asc" as const }, include: itemSelect },
  deliveries: { select: { number: true } },
};

export async function listOrders(actor: Actor, f: ListFilters = {}) {
  const units = await unitIds(actor);
  const rows = await db().rtmOrder.findMany({
    where: {
      businessUnitId: { in: units },
      ...(f.from || f.to ? { orderDate: dateRange(f.from, f.to) } : {}),
      ...(f.distributorId ? { distributorId: f.distributorId } : {}),
      ...(f.outletId ? { outletId: f.outletId } : {}),
      ...(f.status ? { status: f.status as never } : {}),
    },
    include: orderInclude,
    orderBy: [{ orderDate: "desc" }, { createdAt: "desc" }],
    take: 2000,
  });
  return rows.map((o) => {
    const ordered = o.lines.reduce((t, l) => t + num(l.qty), 0);
    const delivered = o.lines.reduce((t, l) => t + num(l.deliveredQty), 0);
    return {
      id: o.id,
      number: o.number,
      orderDate: fromDbDate(o.orderDate),
      outletId: o.outletId,
      outlet: `${o.outlet.code} · ${o.outlet.name}`,
      distributorId: o.distributorId,
      distributor: o.distributor.name,
      sr: o.sr?.name ?? null,
      status: o.status,
      subtotal: num(o.subtotal),
      discount: num(o.discount),
      total: num(o.total),
      offer: o.offer?.name ?? null,
      orderedQty: r3(ordered),
      deliveredQty: r3(delivered),
      deliveries: o.deliveries.map((d) => d.number),
      remarks: o.remarks,
      lines: o.lines.map((l) => ({ ...linesDto([l])[0], lineId: l.id, deliveredQty: num(l.deliveredQty), openQty: r3(num(l.qty) - num(l.deliveredQty)) })),
      updatedAt: o.updatedAt.toISOString(),
    };
  });
}

export async function createOrder(actor: Actor, raw: unknown) {
  const input = orderSchema.parse(raw);
  const outlet = await requireOutlet(actor, input.outletId);
  if (!outlet.isActive) throw badRequest("The outlet is inactive.");
  if (input.srId) await requireEmployee(actor, input.srId);
  await db().$transaction(async (tx) => {
    await requireItems(tx, outlet.businessUnitId, input.lines.map((l) => l.itemId));
    const rates = new Map((await tx.item.findMany({ where: { id: { in: input.lines.map((l) => l.itemId) } }, select: { id: true, salesRate: true } })).map((i) => [i.id, num(i.salesRate)]));
    const lines = input.lines.map((l, i) => {
      const rate = l.rate ?? rates.get(l.itemId) ?? 0;
      return { lineNo: i + 1, itemId: l.itemId, qty: l.qty, rate, amount: r2(l.qty * rate) };
    });
    const subtotal = r2(lines.reduce((t, l) => t + l.amount, 0));
    const offer = await bestOffer(outlet.businessUnitId, { date: input.orderDate, channelId: outlet.channelId, lines });
    const discount = offer?.discount ?? 0;
    await tx.rtmOrder.create({
      data: {
        businessUnitId: outlet.businessUnitId,
        number: await documentNumber(tx, outlet.businessUnitId, "ORDER", input.orderDate),
        orderDate: toDbDate(input.orderDate),
        outletId: outlet.id,
        distributorId: outlet.distributorId,
        srId: input.srId ?? null,
        subtotal,
        discount,
        total: r2(subtotal - discount),
        offerId: offer?.id ?? null,
        remarks: input.remarks ?? null,
        createdBy: actorName(actor),
        lines: { create: lines },
      },
    });
  });
  return listOrders(actor, { outletId: outlet.id });
}

export async function cancelOrder(actor: Actor, id: string) {
  const units = await unitIds(actor);
  const order = await db().rtmOrder.findFirst({ where: { id, businessUnitId: { in: units } }, include: { lines: true } });
  if (!order) throw notFound("Order");
  if (order.status !== "PENDING" || order.lines.some((l) => num(l.deliveredQty) > 0)) throw badRequest(`${order.number} has deliveries and cannot be cancelled.`);
  await db().rtmOrder.update({ where: { id }, data: { status: "CANCELLED" } });
}

// ── Deliveries ───────────────────────────────────────────────────────────────

const deliveryInclude = {
  outlet: { select: { name: true, code: true } },
  distributor: { select: { name: true } },
  sr: { select: { name: true } },
  order: { select: { number: true } },
  lines: { orderBy: { lineNo: "asc" as const }, include: itemSelect },
};

export async function listDeliveries(actor: Actor, f: ListFilters & { direct?: boolean } = {}) {
  const units = await unitIds(actor);
  const rows = await db().rtmDelivery.findMany({
    where: {
      businessUnitId: { in: units },
      ...(f.direct === undefined ? {} : { isDirect: f.direct }),
      ...(f.from || f.to ? { deliveryDate: dateRange(f.from, f.to) } : {}),
      ...(f.distributorId ? { distributorId: f.distributorId } : {}),
      ...(f.outletId ? { outletId: f.outletId } : {}),
    },
    include: deliveryInclude,
    orderBy: [{ deliveryDate: "desc" }, { createdAt: "desc" }],
    take: 2000,
  });
  return rows.map((d) => ({
    id: d.id,
    number: d.number,
    deliveryDate: fromDbDate(d.deliveryDate),
    order: d.order?.number ?? null,
    outletId: d.outletId,
    outlet: `${d.outlet.code} · ${d.outlet.name}`,
    distributorId: d.distributorId,
    distributor: d.distributor.name,
    sr: d.sr?.name ?? null,
    isDirect: d.isDirect,
    status: d.status,
    subtotal: num(d.subtotal),
    discount: num(d.discount),
    total: num(d.total),
    remarks: d.remarks,
    lines: linesDto(d.lines),
    updatedAt: d.createdAt.toISOString(),
  }));
}

const deliverSchema = z.object({
  orderId: z.uuid("Select the order."),
  deliveryDate: z.string().regex(DATE),
  remarks: text(500),
  lines: z.array(z.object({ lineId: z.uuid(), qty: z.coerce.number().finite().min(0) })).min(1),
});

/** Delivers (part of) a retail order: stock leaves the distributor, the outlet owes the amount. */
export async function deliverOrder(actor: Actor, raw: unknown) {
  const input = deliverSchema.parse(raw);
  const units = await unitIds(actor);
  await db().$transaction(async (tx) => {
    const order = await tx.rtmOrder.findFirst({ where: { id: input.orderId, businessUnitId: { in: units } }, include: { lines: { include: { item: { select: { name: true } } } } } });
    if (!order) throw notFound("Order");
    if (order.status === "CANCELLED" || order.status === "COMPLETED") throw badRequest(`${order.number} is ${order.status.toLowerCase()}.`);
    const wanted = new Map(input.lines.map((l) => [l.lineId, l.qty]));
    const lines = order.lines
      .map((l) => ({ l, qty: Math.min(wanted.get(l.id) ?? 0, num(l.qty) - num(l.deliveredQty)) }))
      .filter((x) => x.qty > 0);
    if (!lines.length) throw badRequest("Enter a quantity to deliver.");
    const subtotal = r2(lines.reduce((t, x) => t + x.qty * num(x.l.rate), 0));
    // The order's discount is shared in proportion to what is delivered.
    const discount = num(order.subtotal) > 0 ? r2((num(order.discount) * subtotal) / num(order.subtotal)) : 0;
    const total = r2(subtotal - discount);
    await assertCredit(tx, order.outletId, order.businessUnitId, total);
    const number = await documentNumber(tx, order.businessUnitId, "DELIVERY", input.deliveryDate);
    const delivery = await tx.rtmDelivery.create({
      data: {
        businessUnitId: order.businessUnitId,
        number,
        deliveryDate: toDbDate(input.deliveryDate),
        orderId: order.id,
        outletId: order.outletId,
        distributorId: order.distributorId,
        srId: order.srId,
        subtotal,
        discount,
        total,
        remarks: input.remarks ?? null,
        createdBy: actorName(actor),
        lines: { create: lines.map((x, i) => ({ lineNo: i + 1, itemId: x.l.itemId, qty: x.qty, rate: x.l.rate, amount: r2(x.qty * num(x.l.rate)) })) },
      },
    });
    await postDistributorStock(
      tx,
      { businessUnitId: order.businessUnitId, distributorId: order.distributorId, source: "DELIVERY", sourceId: delivery.id, date: toDbDate(input.deliveryDate), remarks: number, createdBy: actorName(actor) },
      lines.map((x) => ({ itemId: x.l.itemId, qty: -x.qty })),
      new Map(order.lines.map((l) => [l.itemId, l.item.name])),
    );
    for (const x of lines) await tx.rtmOrderLine.update({ where: { id: x.l.id }, data: { deliveredQty: { increment: x.qty } } });
    const left = await tx.rtmOrderLine.findMany({ where: { orderId: order.id }, select: { qty: true, deliveredQty: true } });
    const done = left.every((l) => num(l.deliveredQty) + 1e-9 >= num(l.qty));
    await tx.rtmOrder.update({ where: { id: order.id }, data: { status: done ? "COMPLETED" : "APPROVED" } });
  });
  return listDeliveries(actor, { direct: false });
}

const directSchema = z.object({
  deliveryDate: z.string().regex(DATE),
  outletId: z.uuid("Select the outlet."),
  srId: optUuid,
  discount: z.preprocess((v) => (v === "" ? undefined : v), z.coerce.number().finite().min(0).default(0)),
  remarks: text(500),
  lines: z.array(line).min(1, "Add at least one item.").max(200),
});

/** A delivery without an order (spot / van sale). */
export async function directDelivery(actor: Actor, raw: unknown) {
  const input = directSchema.parse(raw);
  const outlet = await requireOutlet(actor, input.outletId);
  if ((await getSettings(outlet.businessUnitId)).allowDirectDelivery !== "true") throw badRequest("Direct deliveries are turned off in RTM Configuration.");
  if (input.srId) await requireEmployee(actor, input.srId);
  await db().$transaction(async (tx) => {
    const names = await requireItems(tx, outlet.businessUnitId, input.lines.map((l) => l.itemId));
    const rates = new Map((await tx.item.findMany({ where: { id: { in: input.lines.map((l) => l.itemId) } }, select: { id: true, salesRate: true } })).map((i) => [i.id, num(i.salesRate)]));
    const lines = input.lines.map((l, i) => {
      const rate = l.rate ?? rates.get(l.itemId) ?? 0;
      return { lineNo: i + 1, itemId: l.itemId, qty: l.qty, rate, amount: r2(l.qty * rate) };
    });
    const subtotal = r2(lines.reduce((t, l) => t + l.amount, 0));
    if (input.discount > subtotal) throw badRequest("The discount is more than the delivery amount.");
    const total = r2(subtotal - input.discount);
    await assertCredit(tx, outlet.id, outlet.businessUnitId, total);
    const number = await documentNumber(tx, outlet.businessUnitId, "DIRECT_DELIVERY", input.deliveryDate);
    const delivery = await tx.rtmDelivery.create({
      data: {
        businessUnitId: outlet.businessUnitId,
        number,
        deliveryDate: toDbDate(input.deliveryDate),
        outletId: outlet.id,
        distributorId: outlet.distributorId,
        srId: input.srId ?? null,
        isDirect: true,
        subtotal,
        discount: input.discount,
        total,
        remarks: input.remarks ?? null,
        createdBy: actorName(actor),
        lines: { create: lines },
      },
    });
    await postDistributorStock(
      tx,
      { businessUnitId: outlet.businessUnitId, distributorId: outlet.distributorId, source: "DELIVERY", sourceId: delivery.id, date: toDbDate(input.deliveryDate), remarks: number, createdBy: actorName(actor) },
      lines.map((l) => ({ itemId: l.itemId, qty: -l.qty })),
      names,
    );
  });
  return listDeliveries(actor, { direct: true });
}

// ── Collections ──────────────────────────────────────────────────────────────

const collectionSchema = z.object({
  collectionDate: z.string().regex(DATE),
  outletId: z.uuid("Select the outlet."),
  srId: optUuid,
  amount: z.coerce.number().finite().positive("Enter the amount collected."),
  method: z.enum(["CASH", "BANK", "MFS", "CHEQUE"]).default("CASH"),
  reference: text(100),
  remarks: text(500),
});

export async function listCollections(actor: Actor, f: ListFilters = {}) {
  const units = await unitIds(actor);
  const rows = await db().rtmCollection.findMany({
    where: {
      businessUnitId: { in: units },
      ...(f.from || f.to ? { collectionDate: dateRange(f.from, f.to) } : {}),
      ...(f.distributorId ? { distributorId: f.distributorId } : {}),
      ...(f.outletId ? { outletId: f.outletId } : {}),
    },
    include: { outlet: { select: { code: true, name: true } }, distributor: { select: { name: true } }, sr: { select: { name: true } } },
    orderBy: [{ collectionDate: "desc" }, { createdAt: "desc" }],
    take: 2000,
  });
  return rows.map((c) => ({
    id: c.id,
    number: c.number,
    collectionDate: fromDbDate(c.collectionDate),
    outletId: c.outletId,
    outlet: `${c.outlet.code} · ${c.outlet.name}`,
    distributor: c.distributor.name,
    sr: c.sr?.name ?? null,
    amount: num(c.amount),
    method: c.method,
    reference: c.reference,
    remarks: c.remarks,
    status: c.status,
    updatedAt: c.createdAt.toISOString(),
  }));
}

export async function createCollection(actor: Actor, raw: unknown) {
  const input = collectionSchema.parse(raw);
  const outlet = await requireOutlet(actor, input.outletId);
  if (input.srId) await requireEmployee(actor, input.srId);
  await db().$transaction(async (tx) => {
    const due = (await outletBalances(tx, [outlet.id])).get(outlet.id) ?? 0;
    if (input.amount > due + 0.005) throw badRequest(`${outlet.name} owes ${r2(Math.max(0, due))}; collect at most that.`);
    await tx.rtmCollection.create({
      data: {
        businessUnitId: outlet.businessUnitId,
        number: await documentNumber(tx, outlet.businessUnitId, "COLLECTION", input.collectionDate),
        collectionDate: toDbDate(input.collectionDate),
        outletId: outlet.id,
        distributorId: outlet.distributorId,
        srId: input.srId ?? null,
        amount: input.amount,
        method: input.method,
        reference: input.reference ?? null,
        remarks: input.remarks ?? null,
        createdBy: actorName(actor),
      },
    });
  });
  return listCollections(actor);
}

// ── Sales returns ────────────────────────────────────────────────────────────

const returnSchema = z.object({
  returnDate: z.string().regex(DATE),
  outletId: z.uuid("Select the outlet."),
  deliveryId: optUuid,
  reason: text(300),
  lines: z.array(line).min(1, "Add at least one item.").max(200),
});

export async function listReturns(actor: Actor, f: ListFilters = {}) {
  const units = await unitIds(actor);
  const rows = await db().rtmReturn.findMany({
    where: {
      businessUnitId: { in: units },
      ...(f.from || f.to ? { returnDate: dateRange(f.from, f.to) } : {}),
      ...(f.distributorId ? { distributorId: f.distributorId } : {}),
      ...(f.outletId ? { outletId: f.outletId } : {}),
    },
    include: { outlet: { select: { code: true, name: true } }, distributor: { select: { name: true } }, delivery: { select: { number: true } }, lines: { orderBy: { lineNo: "asc" }, include: itemSelect } },
    orderBy: [{ returnDate: "desc" }, { createdAt: "desc" }],
    take: 2000,
  });
  return rows.map((r) => ({
    id: r.id,
    number: r.number,
    returnDate: fromDbDate(r.returnDate),
    outletId: r.outletId,
    outlet: `${r.outlet.code} · ${r.outlet.name}`,
    distributor: r.distributor.name,
    delivery: r.delivery?.number ?? null,
    reason: r.reason,
    total: num(r.total),
    status: r.status,
    lines: linesDto(r.lines),
    updatedAt: r.createdAt.toISOString(),
  }));
}

/** Goods back from an outlet: stock returns to the distributor and the outlet owes less. */
export async function createReturn(actor: Actor, raw: unknown) {
  const input = returnSchema.parse(raw);
  const outlet = await requireOutlet(actor, input.outletId);
  await db().$transaction(async (tx) => {
    const names = await requireItems(tx, outlet.businessUnitId, input.lines.map((l) => l.itemId));
    // Against a delivery: the delivered rate, and no more than was delivered.
    let deliveredRate = new Map<string, number>();
    if (input.deliveryId) {
      const delivery = await tx.rtmDelivery.findFirst({ where: { id: input.deliveryId, outletId: outlet.id }, include: { lines: true } });
      if (!delivery) throw badRequest("The delivery is not for this outlet.");
      deliveredRate = new Map(delivery.lines.map((l) => [l.itemId, num(l.rate)]));
      const deliveredQty = new Map<string, number>();
      for (const l of delivery.lines) deliveredQty.set(l.itemId, (deliveredQty.get(l.itemId) ?? 0) + num(l.qty));
      for (const l of input.lines) if (l.qty > (deliveredQty.get(l.itemId) ?? 0) + 1e-9) throw badRequest(`${names.get(l.itemId)}: more than delivered on ${delivery.number}.`);
    }
    const rates = new Map((await tx.item.findMany({ where: { id: { in: input.lines.map((l) => l.itemId) } }, select: { id: true, salesRate: true } })).map((i) => [i.id, num(i.salesRate)]));
    const lines = input.lines.map((l, i) => {
      const rate = deliveredRate.get(l.itemId) ?? l.rate ?? rates.get(l.itemId) ?? 0;
      return { lineNo: i + 1, itemId: l.itemId, qty: l.qty, rate, amount: r2(l.qty * rate) };
    });
    const number = await documentNumber(tx, outlet.businessUnitId, "RETURN", input.returnDate);
    const ret = await tx.rtmReturn.create({
      data: {
        businessUnitId: outlet.businessUnitId,
        number,
        returnDate: toDbDate(input.returnDate),
        outletId: outlet.id,
        distributorId: outlet.distributorId,
        deliveryId: input.deliveryId ?? null,
        reason: input.reason ?? null,
        total: r2(lines.reduce((t, l) => t + l.amount, 0)),
        createdBy: actorName(actor),
        lines: { create: lines },
      },
    });
    await postDistributorStock(
      tx,
      { businessUnitId: outlet.businessUnitId, distributorId: outlet.distributorId, source: "RETURN", sourceId: ret.id, date: toDbDate(input.returnDate), remarks: number, createdBy: actorName(actor) },
      lines.map((l) => ({ itemId: l.itemId, qty: l.qty })),
      names,
    );
  });
  return listReturns(actor);
}

// ── Outlet ledger ────────────────────────────────────────────────────────────

/** Deliveries (debit), collections and returns (credit) of one outlet, with a running balance. */
export async function outletLedger(actor: Actor, outletId: string, from?: string, to?: string) {
  const outlet = await requireOutlet(actor, outletId);
  const range = dateRange(from, to);
  const [deliveries, collections, returns, before] = await Promise.all([
    db().rtmDelivery.findMany({ where: { outletId, status: { not: "CANCELLED" }, ...(range ? { deliveryDate: range } : {}) }, select: { number: true, deliveryDate: true, total: true, isDirect: true } }),
    db().rtmCollection.findMany({ where: { outletId, status: { not: "CANCELLED" }, ...(range ? { collectionDate: range } : {}) }, select: { number: true, collectionDate: true, amount: true, method: true } }),
    db().rtmReturn.findMany({ where: { outletId, status: { not: "CANCELLED" }, ...(range ? { returnDate: range } : {}) }, select: { number: true, returnDate: true, total: true } }),
    from ? openingBalance(outletId, from) : Promise.resolve(0),
  ]);
  const rows = [
    ...deliveries.map((d) => ({ date: fromDbDate(d.deliveryDate), number: d.number, particulars: d.isDirect ? "Direct delivery" : "Delivery", debit: num(d.total), credit: 0 })),
    ...collections.map((c) => ({ date: fromDbDate(c.collectionDate), number: c.number, particulars: `Collection (${c.method})`, debit: 0, credit: num(c.amount) })),
    ...returns.map((r) => ({ date: fromDbDate(r.returnDate), number: r.number, particulars: "Sales return", debit: 0, credit: num(r.total) })),
  ].sort((a, b) => a.date.localeCompare(b.date) || a.number.localeCompare(b.number));
  let balance = before;
  const ledger = rows.map((r) => {
    balance = r2(balance + r.debit - r.credit);
    return { ...r, balance };
  });
  return { outlet: { id: outlet.id, code: outlet.code, name: outlet.name }, opening: r2(before), closing: r2(balance), rows: ledger };
}

async function openingBalance(outletId: string, from: string) {
  const before = { lt: toDbDate(from) };
  const [d, c, r] = await Promise.all([
    db().rtmDelivery.aggregate({ where: { outletId, status: { not: "CANCELLED" }, deliveryDate: before }, _sum: { total: true } }),
    db().rtmCollection.aggregate({ where: { outletId, status: { not: "CANCELLED" }, collectionDate: before }, _sum: { amount: true } }),
    db().rtmReturn.aggregate({ where: { outletId, status: { not: "CANCELLED" }, returnDate: before }, _sum: { total: true } }),
  ]);
  return num(d._sum.total) - num(c._sum.amount) - num(r._sum.total);
}
