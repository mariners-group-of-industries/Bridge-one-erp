import type { Prisma } from "@/generated/prisma/client";
import { badRequest, notFound } from "@/lib/api/errors";
import type { Actor } from "@/lib/auth/actor";
import { db } from "@/lib/prisma/client";
import { fromDbDate, toDbDate } from "@/features/sales/lib/dates";
import { scopedBusinessUnitIds } from "@/features/sales/lib/scope";
import { companyDocumentNumber } from "@/features/sales/lib/sequence";
import { assertStockAvailable, lockWarehouse, requireWarehouse } from "@/features/sales/deliveries/services/stock.service";
import {
  counterPatchSchema,
  counterSchema,
  saleSchema,
  saleTotals,
  voidSchema,
  type PosCounter,
  type PosSale,
} from "../schemas/pos.schema";

const num = (value: unknown) => Number(value ?? 0);
const actorName = (actor: Actor) => (actor.name ?? actor.id).slice(0, 150);
const today = () => new Date().toISOString().slice(0, 10);

// ── Counters ─────────────────────────────────────────────────────────────────

const counterInclude = { warehouse: { select: { name: true, office: { select: { name: true } } } } } satisfies Prisma.PosCounterInclude;

function counterDto(c: Prisma.PosCounterGetPayload<{ include: typeof counterInclude }>): PosCounter {
  return {
    id: c.id,
    code: c.code,
    name: c.name,
    warehouseId: c.warehouseId,
    warehouseName: c.warehouse.name,
    officeName: c.warehouse.office.name,
    floorName: c.floorName,
    userName: c.userName,
    receiptMessage: c.receiptMessage,
    isEcommerce: c.isEcommerce,
    isActive: c.isActive,
  };
}

export async function listCounters(actor: Actor): Promise<PosCounter[]> {
  const unitIds = await scopedBusinessUnitIds(actor);
  const rows = await db().posCounter.findMany({ where: { businessUnitId: { in: unitIds } }, include: counterInclude, orderBy: { code: "asc" } });
  return rows.map(counterDto);
}

async function requireCounter(actor: Actor, id: string) {
  const unitIds = await scopedBusinessUnitIds(actor);
  const counter = await db().posCounter.findFirst({ where: { id, businessUnitId: { in: unitIds } }, include: counterInclude });
  if (!counter) throw notFound("Counter");
  return counter;
}

export async function createCounter(actor: Actor, raw: unknown): Promise<PosCounter> {
  const input = counterSchema.parse(raw);
  const warehouse = await requireWarehouse(actor, input.warehouseId);
  const created = await db().$transaction(async (tx) => {
    // Codes count up per business unit: 11, 12, 13 …
    const count = await tx.posCounter.count({ where: { businessUnitId: warehouse.businessUnitId } });
    return tx.posCounter.create({
      data: { ...input, businessUnitId: warehouse.businessUnitId, code: String(11 + count) },
      include: counterInclude,
    });
  });
  return counterDto(created);
}

export async function updateCounter(actor: Actor, id: string, raw: unknown): Promise<PosCounter> {
  const input = counterPatchSchema.parse(raw);
  const counter = await requireCounter(actor, id);
  if (input.warehouseId && input.warehouseId !== counter.warehouseId) {
    const warehouse = await requireWarehouse(actor, input.warehouseId);
    if (warehouse.businessUnitId !== counter.businessUnitId) throw badRequest("The warehouse belongs to another business unit.");
  }
  const updated = await db().posCounter.update({ where: { id }, data: input, include: counterInclude });
  return counterDto(updated);
}

// ── Sales ────────────────────────────────────────────────────────────────────

const saleInclude = {
  counter: { select: { name: true } },
  warehouse: { select: { name: true } },
  lines: {
    orderBy: { lineNo: "asc" },
    include: { item: { select: { code: true, name: true, uom: true, category: { select: { name: true } } } } },
  },
} satisfies Prisma.PosSaleInclude;

type SaleRow = Prisma.PosSaleGetPayload<{ include: typeof saleInclude }>;

function saleDto(s: SaleRow): PosSale {
  return {
    id: s.id,
    number: s.number,
    saleDate: fromDbDate(s.saleDate),
    soldAt: s.soldAt.toISOString(),
    counterId: s.counterId,
    counterName: s.counter.name,
    warehouseName: s.warehouse.name,
    customerName: s.customerName,
    customerMobile: s.customerMobile,
    tableRef: s.tableRef,
    subtotal: num(s.subtotal),
    discount: num(s.discount),
    vatPercent: num(s.vatPercent),
    vatAmount: num(s.vatAmount),
    total: num(s.total),
    paidAmount: num(s.paidAmount),
    changeAmount: num(s.changeAmount),
    paymentMethod: s.paymentMethod,
    status: s.status,
    voidReason: s.voidReason,
    createdBy: s.createdBy,
    voidedBy: s.voidedBy,
    lines: s.lines.map((l) => ({
      itemId: l.itemId,
      itemCode: l.item.code,
      itemName: l.item.name,
      category: l.item.category?.name ?? "Uncategorised",
      uom: l.item.uom,
      qty: num(l.qty),
      rate: num(l.rate),
      discount: num(l.discount),
      amount: num(l.amount),
    })),
  };
}

export async function listSales(actor: Actor, filters: { from?: string; to?: string; counterId?: string } = {}): Promise<PosSale[]> {
  const unitIds = await scopedBusinessUnitIds(actor);
  const rows = await db().posSale.findMany({
    where: {
      businessUnitId: { in: unitIds },
      ...(filters.counterId ? { counterId: filters.counterId } : {}),
      ...(filters.from || filters.to
        ? { saleDate: { ...(filters.from ? { gte: toDbDate(filters.from) } : {}), ...(filters.to ? { lte: toDbDate(filters.to) } : {}) } }
        : {}),
    },
    include: saleInclude,
    orderBy: { soldAt: "desc" },
    take: 5000,
  });
  return rows.map(saleDto);
}

/** Completes a counter sale: the items leave the counter's warehouse at once. */
export async function createSale(actor: Actor, raw: unknown): Promise<PosSale> {
  const input = saleSchema.parse(raw);
  const counter = await requireCounter(actor, input.counterId);
  if (!counter.isActive) throw badRequest(`${counter.name} is inactive.`);
  const totals = saleTotals(input.lines, input.discount, input.vatPercent);
  if (input.discount > totals.subtotal) throw badRequest("The discount is more than the sale amount.");
  if (input.paidAmount + 0.005 < totals.total) throw badRequest(`The customer has to pay ${totals.total.toFixed(2)}.`);

  const created = await db().$transaction(async (tx) => {
    const items = await tx.item.findMany({
      where: { id: { in: [...new Set(input.lines.map((l) => l.itemId))] }, businessUnitId: counter.businessUnitId },
      select: { id: true, name: true },
    });
    if (items.length !== new Set(input.lines.map((l) => l.itemId)).size) throw badRequest("Some items are not sold in this business unit.");

    await lockWarehouse(tx, counter.warehouseId);
    const needs = new Map<string, number>();
    for (const l of input.lines) needs.set(l.itemId, (needs.get(l.itemId) ?? 0) + l.qty);
    await assertStockAvailable(tx, counter.warehouseId, needs, new Map(items.map((i) => [i.id, i.name])));

    const date = today();
    const number = await companyDocumentNumber(tx, counter.businessUnitId, "POS_SALE", "POS-", date);
    const sale = await tx.posSale.create({
      data: {
        businessUnitId: counter.businessUnitId,
        counterId: counter.id,
        warehouseId: counter.warehouseId,
        number,
        saleDate: toDbDate(date),
        customerName: input.customerName ?? null,
        customerMobile: input.customerMobile ?? null,
        tableRef: input.tableRef ?? null,
        subtotal: totals.subtotal,
        discount: input.discount,
        vatPercent: input.vatPercent,
        vatAmount: totals.vatAmount,
        total: totals.total,
        paidAmount: input.paidAmount,
        changeAmount: Math.round((input.paidAmount - totals.total) * 100) / 100,
        paymentMethod: input.paymentMethod,
        createdBy: actorName(actor),
        lines: {
          create: input.lines.map((l, i) => ({
            lineNo: i + 1,
            itemId: l.itemId,
            qty: l.qty,
            rate: l.rate,
            discount: l.discount,
            amount: Math.round(Math.max(0, l.qty * l.rate - l.discount) * 100) / 100,
          })),
        },
      },
    });
    await tx.stockEntry.createMany({
      data: [...needs].map(([itemId, qty]) => ({
        businessUnitId: counter.businessUnitId,
        warehouseId: counter.warehouseId,
        itemId,
        qty: -qty,
        source: "POS_SALE" as const,
        sourceId: sale.id,
        postingDate: toDbDate(date),
        remarks: number,
        createdBy: actorName(actor),
      })),
    });
    return sale;
  });
  return getSale(actor, created.id);
}

async function getSale(actor: Actor, id: string): Promise<PosSale> {
  const unitIds = await scopedBusinessUnitIds(actor);
  const sale = await db().posSale.findFirst({ where: { id, businessUnitId: { in: unitIds } }, include: saleInclude });
  if (!sale) throw notFound("Sale");
  return saleDto(sale);
}

/** Voids a sale: the items go back into the counter's warehouse. */
export async function voidSale(actor: Actor, id: string, raw: unknown): Promise<PosSale> {
  const { reason } = voidSchema.parse(raw);
  const sale = await getSale(actor, id);
  if (sale.status === "VOIDED") throw badRequest(`${sale.number} is already voided.`);
  const row = await db().posSale.findUniqueOrThrow({ where: { id }, select: { businessUnitId: true, warehouseId: true } });
  await db().$transaction(async (tx) => {
    await tx.posSale.update({ where: { id }, data: { status: "VOIDED", voidReason: reason, voidedBy: actorName(actor), voidedAt: new Date() } });
    const qty = new Map<string, number>();
    for (const l of sale.lines) qty.set(l.itemId, (qty.get(l.itemId) ?? 0) + l.qty);
    await tx.stockEntry.createMany({
      data: [...qty].map(([itemId, q]) => ({
        businessUnitId: row.businessUnitId,
        warehouseId: row.warehouseId,
        itemId,
        qty: q,
        source: "POS_RETURN" as const,
        sourceId: id,
        postingDate: toDbDate(today()),
        remarks: `Void ${sale.number}`,
        createdBy: actorName(actor),
      })),
    });
  });
  return getSale(actor, id);
}

/** Items a counter can sell, with their price and the stock in its warehouse. */
export async function counterCatalog(actor: Actor, counterId: string) {
  const counter = await requireCounter(actor, counterId);
  const [items, stock] = await Promise.all([
    db().item.findMany({
      where: { businessUnitId: counter.businessUnitId, isActive: true },
      select: { id: true, code: true, name: true, uom: true, salesRate: true, category: { select: { name: true } } },
      orderBy: { name: "asc" },
    }),
    db().stockEntry.groupBy({ by: ["itemId"], where: { warehouseId: counter.warehouseId }, _sum: { qty: true } }),
  ]);
  const onHand = new Map(stock.map((s) => [s.itemId, Math.round(num(s._sum.qty) * 1000) / 1000]));
  return items.map((i) => ({
    id: i.id,
    code: i.code,
    name: i.name,
    uom: i.uom,
    category: i.category?.name ?? "Uncategorised",
    rate: num(i.salesRate),
    inStock: onHand.get(i.id) ?? 0,
  }));
}
