import { z } from "zod";
import { badRequest, notFound } from "@/lib/api/errors";
import type { Actor } from "@/lib/auth/actor";
import { decideWithPipeline } from "@/lib/approval/engine";
import { db } from "@/lib/prisma/client";
import { DATE, actorName, dateRange, distributorStock, documentNumber, fromDbDate, num, postDistributorStock, r3, requireDistributor, requireItems, toDbDate, unitIds } from "./common";

const text = (max: number) => z.string().trim().max(max).optional().transform((v) => v || undefined);
const itemSelect = { item: { select: { code: true, name: true, uom: true } } } as const;

/** Stock of a distributor per item (non-zero), with the item's sales rate for valuation. */
export async function stockLevels(actor: Actor, distributorId: string) {
  await requireDistributor(actor, distributorId);
  const stock = await distributorStock(db(), distributorId);
  const items = await db().item.findMany({ where: { id: { in: [...stock.keys()] } }, select: { id: true, code: true, name: true, uom: true, salesRate: true } });
  return items
    .map((i) => ({ itemId: i.id, itemCode: i.code, itemName: i.name, uom: i.uom, qty: stock.get(i.id) ?? 0, rate: num(i.salesRate), value: Math.round((stock.get(i.id) ?? 0) * num(i.salesRate) * 100) / 100 }))
    .filter((r) => Math.abs(r.qty) > 1e-9)
    .sort((a, b) => a.itemName.localeCompare(b.itemName));
}

// ── Transfers between distributors ───────────────────────────────────────────

const transferSchema = z.object({
  requestDate: z.string().regex(DATE),
  fromDistributorId: z.uuid("Select the distributor that sends the stock."),
  toDistributorId: z.uuid("Select the distributor that receives the stock."),
  remarks: text(500),
  lines: z.array(z.object({ itemId: z.uuid(), qty: z.coerce.number().finite().positive("Quantities must be greater than 0.") })).min(1, "Add at least one item.").max(200),
});

const transferInclude = {
  fromDistributor: { select: { name: true } },
  toDistributor: { select: { name: true } },
  lines: { orderBy: { lineNo: "asc" as const }, include: itemSelect },
};

export async function listTransfers(actor: Actor, f: { from?: string; to?: string; status?: string } = {}) {
  const units = await unitIds(actor);
  const rows = await db().rtmStockTransfer.findMany({
    where: { businessUnitId: { in: units }, ...(f.from || f.to ? { requestDate: dateRange(f.from, f.to) } : {}), ...(f.status ? { status: f.status as never } : {}) },
    include: transferInclude,
    orderBy: [{ requestDate: "desc" }, { createdAt: "desc" }],
    take: 2000,
  });
  return rows.map((t) => ({
    id: t.id,
    number: t.number,
    requestDate: fromDbDate(t.requestDate),
    fromDistributorId: t.fromDistributorId,
    fromDistributor: t.fromDistributor.name,
    toDistributorId: t.toDistributorId,
    toDistributor: t.toDistributor.name,
    status: t.status,
    remarks: t.remarks,
    requestedBy: t.requestedBy,
    approvedBy: t.approvedBy,
    issuedBy: t.issuedBy,
    issuedAt: t.issuedAt?.toISOString() ?? null,
    totalQty: r3(t.lines.reduce((s, l) => s + num(l.qty), 0)),
    lines: t.lines.map((l) => ({ lineId: l.id, itemId: l.itemId, itemCode: l.item.code, itemName: l.item.name, uom: l.item.uom, qty: num(l.qty), issuedQty: num(l.issuedQty) })),
    updatedAt: t.createdAt.toISOString(),
  }));
}

export async function requestTransfer(actor: Actor, raw: unknown) {
  const input = transferSchema.parse(raw);
  if (input.fromDistributorId === input.toDistributorId) throw badRequest("Choose two different distributors.");
  const from = await requireDistributor(actor, input.fromDistributorId);
  const to = await requireDistributor(actor, input.toDistributorId);
  if (from.businessUnitId !== to.businessUnitId) throw badRequest("Both distributors must be in the same business unit.");
  await db().$transaction(async (tx) => {
    await requireItems(tx, from.businessUnitId, input.lines.map((l) => l.itemId));
    await tx.rtmStockTransfer.create({
      data: {
        businessUnitId: from.businessUnitId,
        number: await documentNumber(tx, from.businessUnitId, "TRANSFER", input.requestDate),
        requestDate: toDbDate(input.requestDate),
        fromDistributorId: from.id,
        toDistributorId: to.id,
        remarks: input.remarks ?? null,
        requestedBy: actorName(actor),
        lines: { create: input.lines.map((l, i) => ({ lineNo: i + 1, itemId: l.itemId, qty: l.qty })) },
      },
    });
  });
  return listTransfers(actor);
}

async function requireTransfer(actor: Actor, id: string) {
  const units = await unitIds(actor);
  const t = await db().rtmStockTransfer.findFirst({ where: { id, businessUnitId: { in: units } }, include: { lines: { include: { item: { select: { name: true } } } } } });
  if (!t) throw notFound("Transfer");
  return t;
}

export async function reviewTransfer(actor: Actor, id: string, decision: "approve" | "reject") {
  const t = await requireTransfer(actor, id);
  if (t.status !== "PENDING") throw badRequest(`${t.number} is already ${t.status.toLowerCase()}.`);
  // Multilayer approval: stays PENDING until the last pipeline stage approves.
  await decideWithPipeline(actor, { feature: "Distributor Stock Transfer", documentId: id, businessUnitId: t.businessUnitId }, decision, async (tx) => {
    await tx.rtmStockTransfer.update({ where: { id }, data: { status: decision === "approve" ? "APPROVED" : "REJECTED", approvedBy: actorName(actor) } });
  });
  return listTransfers(actor);
}

const issueSchema = z.object({ lines: z.array(z.object({ lineId: z.uuid(), qty: z.coerce.number().finite().min(0) })).min(1) });

/** Issues an approved transfer: stock leaves the sending distributor and reaches the receiving one. */
export async function issueTransfer(actor: Actor, id: string, raw: unknown) {
  const input = issueSchema.parse(raw);
  const t = await requireTransfer(actor, id);
  if (t.status !== "APPROVED") throw badRequest(`${t.number} is not approved for issue.`);
  const wanted = new Map(input.lines.map((l) => [l.lineId, l.qty]));
  const lines = t.lines.map((l) => ({ l, qty: Math.min(wanted.get(l.id) ?? num(l.qty), num(l.qty)) })).filter((x) => x.qty > 0);
  if (!lines.length) throw badRequest("Enter a quantity to issue.");
  const names = new Map(t.lines.map((l) => [l.itemId, l.item.name]));
  const date = toDbDate(new Date().toISOString().slice(0, 10));
  await db().$transaction(async (tx) => {
    const base = { businessUnitId: t.businessUnitId, sourceId: t.id, date, remarks: t.number, createdBy: actorName(actor) };
    await postDistributorStock(tx, { ...base, distributorId: t.fromDistributorId, source: "TRANSFER_OUT" }, lines.map((x) => ({ itemId: x.l.itemId, qty: -x.qty })), names);
    await postDistributorStock(tx, { ...base, distributorId: t.toDistributorId, source: "TRANSFER_IN" }, lines.map((x) => ({ itemId: x.l.itemId, qty: x.qty })), names);
    for (const x of lines) await tx.rtmStockTransferLine.update({ where: { id: x.l.id }, data: { issuedQty: x.qty } });
    await tx.rtmStockTransfer.update({ where: { id }, data: { status: "COMPLETED", issuedBy: actorName(actor), issuedAt: new Date() } });
  });
  return listTransfers(actor);
}

// ── Stock adjustments ────────────────────────────────────────────────────────

export const ADJUSTMENT_REASONS = ["Opening stock", "Physical count", "Damage", "Expiry", "Theft / loss", "Other"] as const;

const adjustmentSchema = z.object({
  adjustDate: z.string().regex(DATE),
  distributorId: z.uuid("Select the distributor."),
  reason: z.enum(ADJUSTMENT_REASONS),
  remarks: text(500),
  lines: z
    .array(z.object({ itemId: z.uuid(), qty: z.coerce.number().finite().refine((q) => q !== 0, "Quantity cannot be 0.") }))
    .min(1, "Add at least one item.")
    .max(200),
});

export async function listAdjustments(actor: Actor, f: { from?: string; to?: string; distributorId?: string } = {}) {
  const units = await unitIds(actor);
  const rows = await db().rtmStockAdjustment.findMany({
    where: { businessUnitId: { in: units }, ...(f.from || f.to ? { adjustDate: dateRange(f.from, f.to) } : {}), ...(f.distributorId ? { distributorId: f.distributorId } : {}) },
    include: { distributor: { select: { name: true } }, lines: { orderBy: { lineNo: "asc" }, include: itemSelect } },
    orderBy: [{ adjustDate: "desc" }, { createdAt: "desc" }],
    take: 2000,
  });
  return rows.map((a) => ({
    id: a.id,
    number: a.number,
    adjustDate: fromDbDate(a.adjustDate),
    distributorId: a.distributorId,
    distributor: a.distributor.name,
    reason: a.reason,
    remarks: a.remarks,
    status: a.status,
    createdBy: a.createdBy,
    approvedBy: a.approvedBy,
    lines: a.lines.map((l) => ({ itemId: l.itemId, itemCode: l.item.code, itemName: l.item.name, uom: l.item.uom, qty: num(l.qty) })),
    updatedAt: a.createdAt.toISOString(),
  }));
}

export async function createAdjustment(actor: Actor, raw: unknown) {
  const input = adjustmentSchema.parse(raw);
  const distributor = await requireDistributor(actor, input.distributorId);
  await db().$transaction(async (tx) => {
    await requireItems(tx, distributor.businessUnitId, input.lines.map((l) => l.itemId));
    await tx.rtmStockAdjustment.create({
      data: {
        businessUnitId: distributor.businessUnitId,
        number: await documentNumber(tx, distributor.businessUnitId, "ADJUSTMENT", input.adjustDate),
        adjustDate: toDbDate(input.adjustDate),
        distributorId: distributor.id,
        reason: input.reason,
        remarks: input.remarks ?? null,
        createdBy: actorName(actor),
        lines: { create: input.lines.map((l, i) => ({ lineNo: i + 1, itemId: l.itemId, qty: l.qty })) },
      },
    });
  });
  return listAdjustments(actor);
}

/** Approving posts the adjustment to the distributor's stock. */
export async function reviewAdjustment(actor: Actor, id: string, decision: "approve" | "reject") {
  const units = await unitIds(actor);
  const a = await db().rtmStockAdjustment.findFirst({ where: { id, businessUnitId: { in: units } }, include: { lines: { include: { item: { select: { name: true } } } } } });
  if (!a) throw notFound("Adjustment");
  if (a.status !== "PENDING") throw badRequest(`${a.number} is already ${a.status.toLowerCase()}.`);
  // Multilayer approval: stock is posted only after the last pipeline stage approves.
  await decideWithPipeline(actor, { feature: "Distributor Stock Adjustment", documentId: id, businessUnitId: a.businessUnitId }, decision, async (tx) => {
    await tx.rtmStockAdjustment.update({ where: { id }, data: { status: decision === "approve" ? "COMPLETED" : "REJECTED", approvedBy: actorName(actor) } });
    if (decision === "approve") {
      await postDistributorStock(
        tx,
        {
          businessUnitId: a.businessUnitId,
          distributorId: a.distributorId,
          source: a.reason === "Opening stock" ? "OPENING" : "ADJUSTMENT",
          sourceId: a.id,
          date: a.adjustDate,
          remarks: `${a.number} · ${a.reason}`,
          createdBy: actorName(actor),
        },
        a.lines.map((l) => ({ itemId: l.itemId, qty: num(l.qty) })),
        new Map(a.lines.map((l) => [l.itemId, l.item.name])),
      );
    }
  });
  return listAdjustments(actor);
}
