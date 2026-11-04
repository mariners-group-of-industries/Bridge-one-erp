import type { Prisma, StockSource } from "@/generated/prisma/client";
import { badRequest, notFound } from "@/lib/api/errors";
import type { Actor } from "@/lib/auth/actor";
import { db } from "@/lib/prisma/client";
import { fromDbDate, toDbDate } from "@/features/sales/lib/dates";
import { scopedBusinessUnitIds } from "@/features/sales/lib/scope";
import { companyDocumentNumber } from "@/features/sales/lib/sequence";
import { assertStockAvailable, lockWarehouse, requireWarehouse } from "@/features/sales/deliveries/services/stock.service";
import {
  inventoryDocumentSchema,
  receiveSchema,
  reviewSchema,
  type InventoryDocType,
  type InventoryDocument,
  type InventoryDocumentInput,
} from "../schemas/document.schema";

type Tx = Prisma.TransactionClient;

const PREFIX: Record<InventoryDocType, string> = {
  STOCK_UPDATE: "IA-",
  TRANSFER_REQUEST: "TRQ-",
  TRANSFER: "TR-",
  STORE_REQUISITION: "SR-",
  STORE_ISSUE: "SI-",
  CONVERSION: "CV-",
  GATE_PASS: "GP-",
};
/** Requests, stock updates and conversions wait for approval; the rest take effect when saved. */
const NEEDS_APPROVAL = new Set<InventoryDocType>(["STOCK_UPDATE", "CONVERSION", "TRANSFER_REQUEST", "STORE_REQUISITION"]);
/** Approving these posts their stock movements. */
const POSTS_ON_APPROVAL = new Set<InventoryDocType>(["STOCK_UPDATE", "CONVERSION"]);
/** Gate pass kinds; a visitor pass stays open until the visitor leaves. */
const GATE_KINDS = new Set(["Gate In", "Gate Out", "Visitor"]);

const round3 = (value: number) => Math.round(value * 1000) / 1000;
const num = (value: unknown) => Number(value ?? 0);
const actorName = (actor: Actor) => (actor.name ?? actor.id).slice(0, 150);

const documentInclude = {
  warehouse: { select: { id: true, name: true, office: { select: { name: true } } } },
  toWarehouse: { select: { id: true, name: true, office: { select: { name: true } } } },
  request: { select: { id: true, number: true } },
  fulfilments: { select: { id: true, type: true, number: true, status: true, lines: { select: { qty: true, processedQty: true } } }, orderBy: { createdAt: "asc" } },
  lines: {
    orderBy: { lineNo: "asc" },
    include: {
      item: { select: { code: true, name: true, uom: true, category: { select: { name: true } } } },
      toItem: { select: { code: true, name: true, uom: true } },
    },
  },
} satisfies Prisma.InventoryDocumentInclude;

type DocumentRow = Prisma.InventoryDocumentGetPayload<{ include: typeof documentInclude }>;

function toDto(doc: DocumentRow): InventoryDocument {
  const warehouse = (w: DocumentRow["warehouse"]) => (w ? { id: w.id, name: w.name, officeName: w.office.name } : null);
  const lines = doc.lines.map((l) => ({
    id: l.id,
    itemId: l.itemId,
    itemCode: l.item.code,
    itemName: l.item.name,
    uom: l.item.uom,
    category: l.item.category?.name ?? "Uncategorised",
    qty: num(l.qty),
    processedQty: num(l.processedQty),
    toItemId: l.toItemId,
    toItemCode: l.toItem?.code ?? null,
    toItemName: l.toItem?.name ?? null,
    toUom: l.toItem?.uom ?? null,
    toQty: l.toQty === null ? null : num(l.toQty),
    remarks: l.remarks,
  }));
  return {
    id: doc.id,
    type: doc.type,
    number: doc.number,
    docDate: fromDbDate(doc.docDate),
    expectedDate: doc.expectedDate ? fromDbDate(doc.expectedDate) : null,
    status: doc.status,
    subtype: doc.subtype,
    partyName: doc.partyName,
    reference: doc.reference,
    remarks: doc.remarks,
    reviewComment: doc.reviewComment,
    meta: (doc.meta as Record<string, string> | null) ?? null,
    createdBy: doc.createdBy,
    approvedBy: doc.approvedBy,
    approvedAt: doc.approvedAt?.toISOString() ?? null,
    completedAt: doc.completedAt?.toISOString() ?? null,
    createdAt: doc.createdAt.toISOString(),
    warehouse: warehouse(doc.warehouse),
    toWarehouse: warehouse(doc.toWarehouse),
    request: doc.request,
    fulfilments: doc.fulfilments.map((f) => ({
      id: f.id,
      number: f.number,
      status: f.status,
      qty: round3(f.lines.reduce((t, l) => t + num(l.qty), 0)),
      // A received transfer counts what arrived; a store issue is complete when saved.
      receivedQty: round3(
        f.lines.reduce((t, l) => t + (f.status !== "COMPLETED" ? 0 : f.type === "TRANSFER" ? num(l.processedQty) : num(l.qty)), 0),
      ),
    })),
    lines,
    totalQty: round3(lines.reduce((t, l) => t + Math.abs(l.qty), 0)),
    processedQty: round3(lines.reduce((t, l) => t + l.processedQty, 0)),
  };
}

// ── Reading ──────────────────────────────────────────────────────────────────

export interface DocumentFilters {
  from?: string;
  to?: string;
  status?: string;
}

export async function listDocuments(actor: Actor, type: InventoryDocType, filters: DocumentFilters = {}): Promise<InventoryDocument[]> {
  const unitIds = await scopedBusinessUnitIds(actor);
  const rows = await db().inventoryDocument.findMany({
    where: {
      businessUnitId: { in: unitIds },
      type,
      ...(filters.status ? { status: filters.status as InventoryDocument["status"] } : {}),
      ...(filters.from || filters.to
        ? { docDate: { ...(filters.from ? { gte: toDbDate(filters.from) } : {}), ...(filters.to ? { lte: toDbDate(filters.to) } : {}) } }
        : {}),
    },
    include: documentInclude,
    orderBy: [{ docDate: "desc" }, { createdAt: "desc" }],
    take: 1000,
  });
  return rows.map(toDto);
}

async function requireDocument(actor: Actor, type: InventoryDocType, id: string, client: Tx | ReturnType<typeof db> = db()) {
  const unitIds = await scopedBusinessUnitIds(actor);
  const doc = await client.inventoryDocument.findFirst({ where: { id, type, businessUnitId: { in: unitIds } }, include: documentInclude });
  if (!doc) throw notFound("Document");
  return doc;
}

export async function getDocument(actor: Actor, type: InventoryDocType, id: string): Promise<InventoryDocument> {
  return toDto(await requireDocument(actor, type, id));
}

// ── Stock postings ───────────────────────────────────────────────────────────

interface Movement {
  warehouseId: string;
  itemId: string;
  qty: number;
  source: StockSource;
}

/** Writes ledger entries; outgoing quantities must be in stock in their warehouse. */
async function post(tx: Tx, businessUnitId: string, doc: { id: string; number: string; docDate: Date }, movements: Movement[], createdBy: string) {
  const moves = movements.filter((m) => Math.abs(m.qty) > 1e-9);
  if (!moves.length) return;
  const warehouses = [...new Set(moves.map((m) => m.warehouseId))].sort();
  for (const id of warehouses) await lockWarehouse(tx, id);

  const names = new Map(
    (await tx.item.findMany({ where: { id: { in: [...new Set(moves.map((m) => m.itemId))] } }, select: { id: true, name: true } })).map((i) => [i.id, i.name]),
  );
  for (const warehouseId of warehouses) {
    const needs = new Map<string, number>();
    for (const m of moves) if (m.warehouseId === warehouseId && m.qty < 0) needs.set(m.itemId, (needs.get(m.itemId) ?? 0) - m.qty);
    if (needs.size) await assertStockAvailable(tx, warehouseId, needs, names);
  }
  await tx.stockEntry.createMany({
    data: moves.map((m) => ({
      businessUnitId,
      warehouseId: m.warehouseId,
      itemId: m.itemId,
      qty: round3(m.qty),
      source: m.source,
      sourceId: doc.id,
      postingDate: doc.docDate,
      remarks: doc.number,
      createdBy,
    })),
  });
}

// ── Creating ─────────────────────────────────────────────────────────────────

async function itemsOf(tx: Tx, businessUnitId: string, ids: string[]) {
  const unique = [...new Set(ids)];
  const found = await tx.item.findMany({ where: { id: { in: unique }, businessUnitId }, select: { id: true } });
  if (found.length !== unique.length) throw badRequest("Some items do not belong to the warehouse's business unit.");
}

/** Lines of an approved request still open, per item. */
function openRequestQty(request: DocumentRow) {
  const open = new Map<string, number>();
  for (const l of request.lines) open.set(l.itemId, (open.get(l.itemId) ?? 0) + num(l.qty) - num(l.processedQty));
  return open;
}

/** Adds fulfilled quantities to the request's lines and completes it when nothing is left. */
async function fulfil(tx: Tx, request: DocumentRow, qtyByItem: Map<string, number>) {
  for (const line of request.lines) {
    const take = Math.min(qtyByItem.get(line.itemId) ?? 0, num(line.qty) - num(line.processedQty));
    if (take <= 0) continue;
    await tx.inventoryDocumentLine.update({ where: { id: line.id }, data: { processedQty: { increment: take } } });
    qtyByItem.set(line.itemId, (qtyByItem.get(line.itemId) ?? 0) - take);
  }
  const lines = await tx.inventoryDocumentLine.findMany({ where: { documentId: request.id }, select: { qty: true, processedQty: true } });
  if (lines.every((l) => num(l.processedQty) + 1e-9 >= num(l.qty))) {
    await tx.inventoryDocument.update({ where: { id: request.id }, data: { status: "COMPLETED", completedAt: new Date() } });
  }
}

export async function createDocument(actor: Actor, type: InventoryDocType, raw: unknown): Promise<InventoryDocument> {
  const input: InventoryDocumentInput = inventoryDocumentSchema.parse(raw);
  const name = actorName(actor);

  // Validation that does not need the database.
  const positive = type !== "STOCK_UPDATE";
  if (positive && input.lines.some((l) => l.qty < 0)) throw badRequest("Quantities must be greater than 0.");
  if (type !== "GATE_PASS" && !input.lines.length) throw badRequest("Add at least one item.");
  if (type === "CONVERSION" && input.lines.some((l) => !l.toItemId || !l.toQty || l.toItemId === l.itemId)) {
    throw badRequest("Each conversion line needs a different target item and its quantity.");
  }
  if (type === "GATE_PASS") {
    if (!input.subtype || !GATE_KINDS.has(input.subtype)) throw badRequest("Choose gate in, gate out or visitor.");
    if (!input.partyName) throw badRequest("Enter the party or visitor name.");
  }
  if (type === "STORE_REQUISITION" && !input.partyName) throw badRequest("Enter who the requisition is for.");
  const twoWarehouses = type === "TRANSFER" || type === "TRANSFER_REQUEST";
  if (type !== "GATE_PASS" && !input.warehouseId) throw badRequest(twoWarehouses ? "Select the warehouse the stock comes from." : "Select the warehouse.");
  if (twoWarehouses && (!input.toWarehouseId || input.toWarehouseId === input.warehouseId)) {
    throw badRequest("Select a different warehouse for the stock to go to.");
  }

  const created = await db().$transaction(async (tx) => {
    const source = input.warehouseId ? await requireWarehouse(actor, input.warehouseId, tx) : null;
    const target = input.toWarehouseId ? await requireWarehouse(actor, input.toWarehouseId, tx) : null;
    if (source && target && source.businessUnitId !== target.businessUnitId) throw badRequest("Both warehouses must belong to the same business unit.");
    const businessUnitId = source?.businessUnitId ?? (await scopedBusinessUnitIds(actor))[0];
    if (!businessUnitId) throw badRequest("You do not have access to any business unit.");
    await itemsOf(tx, businessUnitId, input.lines.flatMap((l) => (l.toItemId ? [l.itemId, l.toItemId] : [l.itemId])));

    // A transfer or issue may fulfil an approved request for the same warehouses.
    let request: DocumentRow | null = null;
    if (input.requestId) {
      const requestType = type === "TRANSFER" ? "TRANSFER_REQUEST" : type === "STORE_ISSUE" ? "STORE_REQUISITION" : null;
      if (!requestType) throw badRequest("Only transfers and store issues can fulfil a request.");
      request = await requireDocument(actor, requestType, input.requestId, tx);
      if (request.status !== "APPROVED") throw badRequest(`Request ${request.number} is not approved or is already completed.`);
      if (request.warehouseId !== input.warehouseId || (type === "TRANSFER" && request.toWarehouseId !== input.toWarehouseId)) {
        throw badRequest(`Request ${request.number} is for different warehouses.`);
      }
      const open = openRequestQty(request);
      const asked = new Map<string, number>();
      for (const l of input.lines) asked.set(l.itemId, (asked.get(l.itemId) ?? 0) + l.qty);
      for (const [itemId, qty] of asked) {
        if (!open.has(itemId)) throw badRequest(`An item is not on request ${request.number}.`);
        if (qty > (open.get(itemId) ?? 0) + 1e-9) throw badRequest(`More than requested on ${request.number} (open ${round3(open.get(itemId) ?? 0)}).`);
      }
    }

    const status =
      NEEDS_APPROVAL.has(type) ? "PENDING" : type === "TRANSFER" ? "IN_TRANSIT" : type === "GATE_PASS" && input.subtype === "Visitor" ? "PENDING" : "COMPLETED";
    const number = await companyDocumentNumber(tx, businessUnitId, `INVENTORY_${type}`, PREFIX[type], input.docDate);
    const doc = await tx.inventoryDocument.create({
      data: {
        businessUnitId,
        type,
        number,
        docDate: toDbDate(input.docDate),
        expectedDate: input.expectedDate ? toDbDate(input.expectedDate) : null,
        warehouseId: source?.id ?? null,
        toWarehouseId: target?.id ?? null,
        requestId: request?.id ?? null,
        status,
        subtype: input.subtype ?? null,
        partyName: input.partyName ?? null,
        reference: input.reference ?? null,
        meta: input.meta ?? undefined,
        remarks: input.remarks ?? null,
        createdBy: name,
        completedAt: status === "COMPLETED" ? new Date() : null,
        lines: {
          create: input.lines.map((l, i) => ({
            lineNo: i + 1,
            itemId: l.itemId,
            qty: l.qty,
            toItemId: l.toItemId ?? null,
            toQty: l.toQty ?? null,
            remarks: l.remarks ?? null,
          })),
        },
      },
    });

    // Movements that happen when the document is saved.
    if (source) {
      const movements: Movement[] =
        type === "TRANSFER"
          ? input.lines.map((l) => ({ warehouseId: source.id, itemId: l.itemId, qty: -l.qty, source: "TRANSFER_OUT" }))
          : type === "STORE_ISSUE"
            ? input.lines.map((l) => ({ warehouseId: source.id, itemId: l.itemId, qty: -l.qty, source: "STORE_ISSUE" }))
            : [];
      await post(tx, businessUnitId, doc, movements, name);
    }
    if (request) {
      const qty = new Map<string, number>();
      for (const l of input.lines) qty.set(l.itemId, (qty.get(l.itemId) ?? 0) + l.qty);
      await fulfil(tx, request, qty);
    }
    return doc;
  });
  return getDocument(actor, type, created.id);
}

// ── Actions ──────────────────────────────────────────────────────────────────

/** Approves a pending request, or a stock update / conversion (posting its stock movements). */
export async function approveDocument(actor: Actor, type: InventoryDocType, id: string, raw: unknown): Promise<InventoryDocument> {
  if (!NEEDS_APPROVAL.has(type)) throw badRequest("This document does not need approval.");
  const { comment } = reviewSchema.parse(raw ?? {});
  await db().$transaction(async (tx) => {
    const doc = await requireDocument(actor, type, id, tx);
    if (doc.status !== "PENDING") throw badRequest(`${doc.number} is already ${doc.status.toLowerCase().replace("_", " ")}.`);
    const done = POSTS_ON_APPROVAL.has(type);
    await tx.inventoryDocument.update({
      where: { id },
      data: {
        status: done ? "COMPLETED" : "APPROVED",
        approvedBy: actorName(actor),
        approvedAt: new Date(),
        reviewComment: comment ?? null,
        completedAt: done ? new Date() : null,
      },
    });
    if (done && doc.warehouseId) {
      await post(
        tx,
        doc.businessUnitId,
        doc,
        type === "CONVERSION"
          ? doc.lines.flatMap((l) => [
              { warehouseId: doc.warehouseId!, itemId: l.itemId, qty: -num(l.qty), source: "CONVERSION_OUT" as const },
              { warehouseId: doc.warehouseId!, itemId: l.toItemId!, qty: num(l.toQty), source: "CONVERSION_IN" as const },
            ])
          : doc.lines.map((l) => ({ warehouseId: doc.warehouseId!, itemId: l.itemId, qty: num(l.qty), source: "ADJUSTMENT" as const })),
        actorName(actor),
      );
    }
  });
  return getDocument(actor, type, id);
}

export async function rejectDocument(actor: Actor, type: InventoryDocType, id: string, raw: unknown): Promise<InventoryDocument> {
  if (!NEEDS_APPROVAL.has(type)) throw badRequest("This document does not need approval.");
  const { comment } = reviewSchema.parse(raw ?? {});
  const doc = await requireDocument(actor, type, id);
  if (doc.status !== "PENDING") throw badRequest(`${doc.number} is already ${doc.status.toLowerCase().replace("_", " ")}.`);
  await db().inventoryDocument.update({
    where: { id },
    data: { status: "REJECTED", approvedBy: actorName(actor), approvedAt: new Date(), reviewComment: comment ?? null },
  });
  return getDocument(actor, type, id);
}

/**
 * Receives a transfer in transit: the received quantity goes into the destination
 * warehouse and the rest goes back to the source warehouse (shown as returned).
 */
export async function receiveTransfer(actor: Actor, id: string, raw: unknown): Promise<InventoryDocument> {
  const input = receiveSchema.parse(raw);
  await db().$transaction(async (tx) => {
    const doc = await requireDocument(actor, "TRANSFER", id, tx);
    if (doc.status !== "IN_TRANSIT") throw badRequest(`${doc.number} has already been received.`);
    const received = new Map(input.lines.map((l) => [l.lineId, l.receivedQty]));
    const movements: Movement[] = [];
    for (const line of doc.lines) {
      const sent = num(line.qty);
      const qty = Math.min(sent, received.get(line.id) ?? sent);
      await tx.inventoryDocumentLine.update({ where: { id: line.id }, data: { processedQty: qty } });
      movements.push({ warehouseId: doc.toWarehouseId!, itemId: line.itemId, qty, source: "TRANSFER_IN" });
      if (sent - qty > 1e-9) movements.push({ warehouseId: doc.warehouseId!, itemId: line.itemId, qty: sent - qty, source: "TRANSFER_IN" });
    }
    const receiveDate = input.receiveDate ? toDbDate(input.receiveDate) : toDbDate(new Date().toISOString().slice(0, 10));
    await post(tx, doc.businessUnitId, { ...doc, docDate: receiveDate }, movements, actorName(actor));
    await tx.inventoryDocument.update({ where: { id }, data: { status: "COMPLETED", completedAt: new Date() } });
  });
  return getDocument(actor, "TRANSFER", id);
}

/** Marks a visitor as left. */
export async function completeGatePass(actor: Actor, id: string): Promise<InventoryDocument> {
  const doc = await requireDocument(actor, "GATE_PASS", id);
  if (doc.status !== "PENDING") throw badRequest(`${doc.number} is already closed.`);
  await db().inventoryDocument.update({ where: { id }, data: { status: "COMPLETED", completedAt: new Date() } });
  return getDocument(actor, "GATE_PASS", id);
}
