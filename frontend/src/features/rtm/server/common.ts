import type { Prisma, RtmStockSource } from "@/generated/prisma/client";
import { badRequest, notFound } from "@/lib/api/errors";
import type { Actor } from "@/lib/auth/actor";
import { db } from "@/lib/prisma/client";
import { fromDbDate, toDbDate } from "@/features/sales/lib/dates";
import { scopedBusinessUnitIds } from "@/features/sales/lib/scope";
import { companyDocumentNumber } from "@/features/sales/lib/sequence";

export type Tx = Prisma.TransactionClient;
export type Client = Tx | ReturnType<typeof db>;

export const num = (value: unknown) => Number(value ?? 0);
export const r2 = (n: number) => Math.round(n * 100) / 100;
export const r3 = (n: number) => Math.round(n * 1000) / 1000;
export const actorName = (actor: Actor) => (actor.name ?? actor.id).slice(0, 150);
export const today = () => new Date().toISOString().slice(0, 10);
export { fromDbDate, toDbDate };

/** Business units the actor may work in (RTM data is scoped like Sales). */
export const unitIds = (actor: Actor) => scopedBusinessUnitIds(actor);

/** A distributor: a customer of type DISTRIBUTOR the actor can see. */
export async function requireDistributor(actor: Actor, id: string, client: Client = db()) {
  const units = await unitIds(actor);
  const d = await client.customer.findFirst({
    where: { id, customerType: "DISTRIBUTOR", businessUnitId: { in: units } },
    select: { id: true, name: true, code: true, businessUnitId: true },
  });
  if (!d) throw badRequest("Select a distributor (a customer of type Distributor).");
  return d;
}

export async function requireOutlet(actor: Actor, id: string, client: Client = db()) {
  const units = await unitIds(actor);
  const o = await client.rtmOutlet.findFirst({
    where: { id, businessUnitId: { in: units } },
    select: { id: true, name: true, code: true, businessUnitId: true, distributorId: true, channelId: true, routeId: true, isActive: true },
  });
  if (!o) throw notFound("Outlet");
  return o;
}

/** The employee must work in one of the actor's business units. */
export async function requireEmployee(actor: Actor, id: string, client: Client = db()) {
  const units = await unitIds(actor);
  const e = await client.employee.findFirst({ where: { id, office: { businessUnitId: { in: units } } }, select: { id: true, name: true } });
  if (!e) throw badRequest("Select a sales representative.");
  return e;
}

export async function requireItems(tx: Client, businessUnitId: string, ids: string[]) {
  const unique = [...new Set(ids)];
  const items = await tx.item.findMany({ where: { id: { in: unique }, businessUnitId }, select: { id: true, name: true } });
  if (items.length !== unique.length) throw badRequest("Some items do not belong to this business unit.");
  return new Map(items.map((i) => [i.id, i.name]));
}

const PREFIX = {
  ORDER: "RO-",
  DELIVERY: "RD-",
  DIRECT_DELIVERY: "DD-",
  COLLECTION: "RC-",
  RETURN: "RR-",
  TRANSFER: "DST-",
  ADJUSTMENT: "DSA-",
} as const;

export function documentNumber(tx: Tx, businessUnitId: string, kind: keyof typeof PREFIX, date: string) {
  return companyDocumentNumber(tx, businessUnitId, `RTM_${kind}`, PREFIX[kind], date);
}

// ── Distributor stock ────────────────────────────────────────────────────────

export async function distributorStock(client: Client, distributorId: string, itemIds?: string[]) {
  const rows = await client.rtmStockEntry.groupBy({
    by: ["itemId"],
    where: { distributorId, ...(itemIds ? { itemId: { in: itemIds } } : {}) },
    _sum: { qty: true },
  });
  return new Map(rows.map((r) => [r.itemId, r3(num(r._sum.qty))]));
}

/** Serialises stock changes of one distributor so two documents cannot both take the last units. */
export async function lockDistributor(tx: Tx, distributorId: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`rtm-stock:${distributorId}`}))`;
}

export interface StockMove {
  itemId: string;
  qty: number;
}

/** Posts signed quantities to a distributor; outgoing quantities must be in stock. */
export async function postDistributorStock(
  tx: Tx,
  entry: { businessUnitId: string; distributorId: string; source: RtmStockSource; sourceId: string; date: Date; remarks: string; createdBy: string },
  moves: StockMove[],
  names: Map<string, string>,
) {
  const byItem = new Map<string, number>();
  for (const m of moves) if (m.qty) byItem.set(m.itemId, (byItem.get(m.itemId) ?? 0) + m.qty);
  if (!byItem.size) return;
  await lockDistributor(tx, entry.distributorId);
  const outgoing = [...byItem].filter(([, q]) => q < 0);
  if (outgoing.length) {
    const stock = await distributorStock(tx, entry.distributorId, outgoing.map(([id]) => id));
    const short = outgoing.filter(([id, q]) => (stock.get(id) ?? 0) + 1e-9 < -q);
    if (short.length) {
      throw badRequest(
        `Not enough distributor stock: ${short.map(([id, q]) => `${names.get(id) ?? "Item"} (need ${r3(-q)}, in stock ${stock.get(id) ?? 0})`).join("; ")}.`,
      );
    }
  }
  await tx.rtmStockEntry.createMany({
    data: [...byItem].map(([itemId, qty]) => ({
      businessUnitId: entry.businessUnitId,
      distributorId: entry.distributorId,
      itemId,
      qty: r3(qty),
      source: entry.source,
      sourceId: entry.sourceId,
      postingDate: entry.date,
      remarks: entry.remarks,
      createdBy: entry.createdBy,
    })),
  });
}

/** Date filter for a @db.Date column. */
export function dateRange(from?: string, to?: string) {
  if (!from && !to) return undefined;
  return { ...(from ? { gte: toDbDate(from) } : {}), ...(to ? { lte: toDbDate(to) } : {}) };
}

export const DATE = /^\d{4}-\d{2}-\d{2}$/;
export const MONTH = /^\d{4}-\d{2}$/;
