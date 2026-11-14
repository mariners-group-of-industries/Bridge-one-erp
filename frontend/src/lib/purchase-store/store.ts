import {
  Office,
  Warehouse,
  Supplier,
  Item,
  PurchaseRequisition,
  PurchaseOrder,
  GoodsReceipt,
  PurchaseReturn,
  SupplierPaymentRecord,
  SupplierInvoiceItem,
  CreateRequisitionInput,
  CreatePurchaseOrderInput,
  DashboardAnalytics,
  ReportQuery,
  ReportResult,
} from "@bridgeone/contracts";
import type { Prisma, StockSource } from "@/generated/prisma/client";
import { badRequest, notFound } from "@/lib/api/errors";
import { approvalNote, recordApproval, recordRejection, resetApproval } from "@/lib/approval/engine";
import type { Actor } from "@/lib/auth/actor";
import { db } from "@/lib/prisma/client";
import { assertStockAvailable, lockWarehouse } from "@/features/sales/deliveries/services/stock.service";
import { formatNumber, nextNumber } from "@/features/sales/lib/sequence";
import { listSupplierInvoices, listSupplierPayables, validatePaymentLink } from "./payables";
import {
  appendNote,
  effectiveUnitCost,
  orderEditable,
  orderReceivable,
  orderTotals,
  orderTransition,
  priceLine,
  receiptLineError,
  receivingStatus,
  requisitionEditable,
  requisitionTransition,
  returnableByItem,
  round2,
  round3,
  type OrderAction,
  type OrderDbStatus,
  type RequisitionAction,
  type RequisitionDbStatus,
} from "./rules";

type Tx = Prisma.TransactionClient;
/** Either the shared client or the caller's transaction, so helpers can run inside one. */
type Client = Tx | ReturnType<typeof db>;

interface StockWarehouse {
  id: string;
  businessUnitId: string;
  officeId: string;
}

/** The warehouse a receipt or return moves stock in; it decides the business unit. */
async function stockWarehouse(warehouseId: string | null | undefined): Promise<StockWarehouse> {
  const warehouse = isUuid(warehouseId)
    ? await db().warehouse.findUnique({
        where: { id: warehouseId! },
        select: { id: true, officeId: true, office: { select: { businessUnitId: true } } },
      })
    : null;
  if (!warehouse) throw badRequest("Select the warehouse the goods are received into or returned from.");
  return { id: warehouse.id, officeId: warehouse.officeId, businessUnitId: warehouse.office.businessUnitId };
}

/** Office + warehouse of a requisition or order; the warehouse must belong to the office. */
async function officeAndWarehouse(officeId: string | undefined, warehouseId: string | undefined | null, client: Client = db()) {
  if (!isUuid(officeId)) throw badRequest("Select the office.");
  const office = await client.office.findUnique({ where: { id: officeId! }, select: { id: true, businessUnitId: true } });
  if (!office) throw badRequest("The selected office does not exist.");
  if (!isUuid(warehouseId)) return { officeId: office.id, businessUnitId: office.businessUnitId, warehouseId: null };
  const warehouse = await client.warehouse.findUnique({ where: { id: warehouseId! }, select: { id: true, officeId: true } });
  if (!warehouse) throw badRequest("The selected warehouse does not exist.");
  if (warehouse.officeId !== office.id) throw badRequest("The warehouse does not belong to the selected office.");
  return { officeId: office.id, businessUnitId: office.businessUnitId, warehouseId: warehouse.id };
}

/**
 * Item master data for lines that reference an item. Code, name and UoM come
 * from the master so documents stay consistent with stock and sales.
 */
async function itemMaster(businessUnitId: string, itemIds: (string | null | undefined)[], client: Client = db()) {
  const ids = [...new Set(itemIds.filter((id): id is string => isUuid(id)))];
  if (!ids.length) return new Map<string, { code: string; name: string; uom: string }>();
  const rows = await client.item.findMany({ where: { id: { in: ids } }, select: { id: true, code: true, name: true, uom: true, businessUnitId: true } });
  const foreign = rows.find((r) => r.businessUnitId !== businessUnitId);
  if (foreign) throw badRequest(`${foreign.name} belongs to another business unit.`);
  return new Map(rows.map((r) => [r.id, { code: r.code, name: r.name, uom: r.uom || "PCS" }]));
}

/**
 * Posts purchase movements to the stock ledger (StockEntry), the same ledger
 * Sales and Production read. Lines without an item (free-text, services) are
 * not stocked. Outgoing quantities must be in stock.
 */
async function postStock(
  tx: Tx,
  warehouse: StockWarehouse,
  lines: { itemId: string | null; qty: number }[],
  entry: { source: StockSource; sourceId: string; postingDate: Date; remarks: string; createdBy: string },
) {
  const qtyByItem = new Map<string, number>();
  for (const line of lines) {
    if (line.itemId && line.qty) qtyByItem.set(line.itemId, (qtyByItem.get(line.itemId) ?? 0) + line.qty);
  }
  if (!qtyByItem.size) return;

  const items = await tx.item.findMany({
    where: { id: { in: [...qtyByItem.keys()] }, businessUnitId: warehouse.businessUnitId },
    select: { id: true, name: true },
  });
  if (items.length !== qtyByItem.size) throw badRequest("Some items do not belong to the warehouse's business unit.");

  const outgoing = new Map([...qtyByItem].filter(([, qty]) => qty < 0).map(([id, qty]) => [id, -qty]));
  if (outgoing.size) await assertStockAvailable(tx, warehouse.id, outgoing, new Map(items.map((i) => [i.id, i.name])));

  await tx.stockEntry.createMany({
    data: [...qtyByItem].map(([itemId, qty]) => ({
      businessUnitId: warehouse.businessUnitId,
      warehouseId: warehouse.id,
      itemId,
      qty,
      source: entry.source,
      sourceId: entry.sourceId,
      postingDate: entry.postingDate,
      remarks: entry.remarks,
      createdBy: entry.createdBy.slice(0, 100),
    })),
  });
}

/** Removes a document's stock movements; refuses when the stock has already been used. */
async function unpostStock(tx: Tx, warehouseId: string, source: StockSource, sourceId: string) {
  const entries = await tx.stockEntry.findMany({ where: { source, sourceId }, select: { itemId: true, qty: true, item: { select: { name: true } } } });
  const incoming = new Map<string, number>();
  const names = new Map<string, string>();
  for (const e of entries) {
    if (Number(e.qty) > 0) incoming.set(e.itemId, (incoming.get(e.itemId) ?? 0) + Number(e.qty));
    names.set(e.itemId, e.item.name);
  }
  if (incoming.size) await assertStockAvailable(tx, warehouseId, incoming, names);
  await tx.stockEntry.deleteMany({ where: { source, sourceId } });
}

/**
 * Next document number for the business unit and year, e.g. "PO-2026-00012".
 * Skips numbers already used (documents numbered before the sequence existed).
 */
async function issueNumber(
  tx: Tx,
  businessUnitId: string,
  docType: string,
  prefix: string,
  date: Date,
  taken: (number: string) => Promise<boolean>,
): Promise<string> {
  const year = date.getUTCFullYear();
  for (let attempt = 0; attempt < 500; attempt++) {
    const number = formatNumber(prefix, year, await nextNumber(tx, businessUnitId, docType, year));
    if (!(await taken(number))) return number;
  }
  throw badRequest(`Could not issue a ${prefix} number; check the document sequence.`);
}

function toDateStr(d: Date | string | null | undefined): string {
  if (!d) return new Date().toISOString().split("T")[0];
  if (typeof d === "string") return d.split("T")[0];
  return d.toISOString().split("T")[0];
}

/** A yyyy-mm-dd date from the form, or today; invalid dates are rejected. */
function parseDate(value: string | undefined | null, field: string): Date {
  if (!value) return new Date(`${toDateStr(new Date())}T00:00:00.000Z`);
  const date = new Date(`${String(value).slice(0, 10)}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) throw badRequest(`${field} is not a valid date.`);
  return date;
}

function isUuid(val: string | undefined | null): boolean {
  if (!val) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);
}

const num = (value: unknown) => Number(value ?? 0);
const text = (value: unknown, max: number) => (value === undefined || value === null || value === "" ? null : String(value).slice(0, max));

/** Approval history entries are kept in the notes as "[<iso> <ACTION> by <name>] <comment>". */
const HISTORY_LINE = /^\[(\d{4}-\d{2}-\d{2}T\S+) ([A-Z_]+) by ([^\]]+)\](?: (.*))?$/;

function splitNotes(notes: string | null) {
  const history: { id: string; action: string; actorName: string; comments?: string; timestamp: string }[] = [];
  const body: string[] = [];
  for (const line of (notes ?? "").split("\n")) {
    const match = HISTORY_LINE.exec(line);
    if (match) {
      history.push({ id: `${match[1]}-${history.length}`, timestamp: match[1], action: match[2], actorName: match[3], comments: match[4] || undefined });
    } else if (line.trim()) {
      body.push(line);
    }
  }
  return { body: body.join("\n"), history };
}

function historyEntry(action: string, actorName: string, comments?: string) {
  const clean = (comments ?? "").replace(/\s+/g, " ").trim();
  return `[${new Date().toISOString()} ${action} by ${actorName.replace(/[\]\n]/g, " ").slice(0, 80)}]${clean ? ` ${clean.slice(0, 300)}` : ""}`;
}

const REQUISITION_STATUS: Record<RequisitionDbStatus, PurchaseRequisition["status"]> = {
  DRAFT: "DRAFT",
  PENDING: "SUBMITTED",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
  ORDERED: "CONVERTED_TO_PO",
  CANCELLED: "CANCELLED",
};

const REQUISITION_PAST: Record<RequisitionAction, string> = { APPROVE: "APPROVED", REJECT: "REJECTED", CANCEL: "CANCELLED", REVERSE: "REVERSED" };

const ORDER_STATUS: Record<OrderDbStatus, PurchaseOrder["status"]> = {
  DRAFT: "DRAFT",
  PENDING: "PENDING_APPROVAL",
  APPROVED: "APPROVED",
  PARTIAL_RECEIVED: "PARTIALLY_RECEIVED",
  RECEIVED: "COMPLETED",
  // Short-closed: no more goods are expected.
  CLOSED: "COMPLETED",
  CANCELLED: "CANCELLED",
};

/** Contract status filter values accepted for orders ("CLOSED" is kept for the closed list). */
function orderStatusMatches(dbStatus: OrderDbStatus, filter: string) {
  return ORDER_STATUS[dbStatus] === filter || dbStatus === filter;
}

interface OrderLineInput {
  itemId?: string;
  itemCode?: string;
  itemName?: string;
  uom?: string;
  orderedQuantity: number;
  unitPrice: number;
  discountPercentage?: number;
  taxPercentage?: number;
  remarks?: string;
}

/** Validated, priced order lines ready to insert. */
async function buildOrderLines(businessUnitId: string, items: OrderLineInput[], client: Client = db()) {
  if (!items?.length) throw badRequest("Add at least one item to the order.");
  const master = await itemMaster(businessUnitId, items.map((i) => i.itemId), client);
  return items.map((it, idx) => {
    const qty = round3(num(it.orderedQuantity));
    const rate = round2(num(it.unitPrice));
    if (!(qty > 0)) throw badRequest(`Line ${idx + 1}: enter a quantity greater than 0.`);
    if (rate < 0) throw badRequest(`Line ${idx + 1}: the unit price cannot be negative.`);
    const itemId = isUuid(it.itemId) ? it.itemId! : null;
    const known = itemId ? master.get(itemId) : undefined;
    if (itemId && !known) throw badRequest(`Line ${idx + 1}: the item does not exist.`);
    const name = known?.name ?? (it.itemName || "").trim();
    if (!name) throw badRequest(`Line ${idx + 1}: select an item.`);
    const priced = priceLine(qty, rate, num(it.discountPercentage), num(it.taxPercentage));
    return {
      priced,
      data: {
        lineNo: idx + 1,
        itemId,
        itemCode: (known?.code ?? it.itemCode ?? `ITM-${idx + 1}`).slice(0, 50),
        itemName: name.slice(0, 200),
        uom: (known?.uom ?? it.uom ?? "PCS").slice(0, 20),
        quantity: qty,
        unitPrice: rate,
        discountPercent: Math.min(100, Math.max(0, num(it.discountPercentage))),
        vatPercent: Math.min(100, Math.max(0, num(it.taxPercentage))),
        lineTotal: priced.lineTotal,
        remarks: text(it.remarks, 500),
      },
    };
  });
}

class PurchaseDataStore {
  private async getContextData() {
    const prisma = db();
    const bu = await prisma.businessUnit.findFirst({
      include: { company: true },
      orderBy: { createdAt: "asc" },
    });
    return {
      businessUnitId: bu?.id || "",
      companyId: bu?.companyId || "",
      companyName: bu?.company?.name || "BridgeOne Technologies Ltd.",
    };
  }

  // -------------------------------------------------------------
  // MASTER DATA
  // -------------------------------------------------------------
  public async getOffices(): Promise<Office[]> {
    const rows = await db().office.findMany({ orderBy: { name: "asc" } });
    return rows.map((o) => ({
      id: o.id,
      code: o.name.replace(/[^A-Za-z0-9]/g, "").slice(0, 8).toUpperCase() || "OFF",
      name: o.name,
      address: o.address || "",
    }));
  }

  public async getWarehouses(officeId?: string): Promise<Warehouse[]> {
    const where = officeId && officeId !== "ALL" && isUuid(officeId) ? { officeId } : undefined;
    const rows = await db().warehouse.findMany({
      where,
      orderBy: { name: "asc" },
    });
    return rows.map((w) => ({
      id: w.id,
      code: w.name.replace(/[^A-Za-z0-9]/g, "").slice(0, 8).toUpperCase() || "WH",
      name: w.name,
      officeId: w.officeId,
    }));
  }

  public async getSuppliers(): Promise<Supplier[]> {
    const rows = await db().supplier.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
    });
    return rows.map((s) => ({
      id: s.id,
      code: s.code,
      name: s.name,
      contactPerson: s.contactPerson || s.name,
      email: s.email || undefined,
      phone: s.phone || "N/A",
      address: s.address || "",
      taxNumber: s.taxNumber || undefined,
      type: s.type === "FOREIGN" ? ("FOREIGN" as const) : ("LOCAL" as const),
      status: s.isActive ? ("ACTIVE" as const) : ("INACTIVE" as const),
      balance: Number(s.balance ?? 0),
    }));
  }

  public async getItems(): Promise<Item[]> {
    const rows = await db().item.findMany({
      where: { isActive: true },
      include: { category: true },
      orderBy: { name: "asc" },
    });
    return rows.map((i) => ({
      id: i.id,
      code: i.code,
      name: i.name,
      category: i.category?.name || "General",
      uom: i.uom || "PCS",
      standardPrice: Number(i.purchasePrice ?? i.salesRate ?? 0),
      description: i.name,
    }));
  }

  public async getContext() {
    const { companyId, companyName } = await this.getContextData();
    return {
      company: {
        id: companyId,
        code: "BRG-TECH",
        name: companyName,
        currency: "BDT",
      },
      user: {
        id: "usr-bridgeone-procurement-mgr",
        name: "Procurement Manager",
        role: "PURCHASE_MANAGER",
      },
    };
  }

  // -------------------------------------------------------------
  // REQUISITIONS
  // -------------------------------------------------------------
  public async getRequisitions(filters: {
    officeId?: string;
    warehouseId?: string;
    status?: string;
    search?: string;
    fromDate?: string;
    toDate?: string;
    requestType?: string;
    section?: string;
  }): Promise<PurchaseRequisition[]> {
    const rows = await db().purchaseRequisition.findMany({
      include: { lines: { orderBy: { lineNo: "asc" } }, office: true, warehouse: true },
      orderBy: { createdAt: "desc" },
    });

    return rows
      .map((r) => {
        const status = REQUISITION_STATUS[r.status as RequisitionDbStatus] ?? "SUBMITTED";
        const { body, history } = splitNotes(r.notes);

        const items = r.lines.map((l) => ({
          id: l.id,
          itemId: l.itemId || "",
          itemCode: l.itemCode,
          itemName: l.itemName,
          uom: l.uom,
          quantity: Number(l.quantity),
          estimatedUnitPrice: Number(l.estimatedUnitPrice),
          lineTotal: Number(l.lineTotal),
          remarks: l.remarks || undefined,
        }));

        return {
          id: r.id,
          companyId: r.businessUnitId,
          officeId: r.officeId,
          warehouseId: r.warehouseId || "",
          requisitionNumber: r.number,
          requestDate: toDateStr(r.requisitionDate),
          requiredDeliveryDate: toDateStr(r.requiredDate),
          requestType: (r.requestType as PurchaseRequisition["requestType"]) || "LOCAL",
          purchaseMethod: (r.purchaseMethod as PurchaseRequisition["purchaseMethod"]) || "DIRECT",
          department: r.department,
          section: r.department,
          requesterName: r.requestedBy,
          businessJustification: body || "Operational replenishment",
          remarks: body || undefined,
          totalEstimatedAmount: Number(r.totalEstimated),
          status,
          createdBy: r.requestedBy,
          createdAt: r.createdAt.toISOString(),
          updatedAt: r.updatedAt.toISOString(),
          approvalHistory: history,
          items,
        };
      })
      .filter((r) => {
        if (filters.officeId && filters.officeId !== "ALL" && r.officeId !== filters.officeId) return false;
        if (filters.warehouseId && filters.warehouseId !== "ALL" && r.warehouseId !== filters.warehouseId) return false;
        if (filters.status && filters.status !== "ALL" && r.status !== filters.status) return false;
        if (filters.requestType && filters.requestType !== "ALL" && r.requestType !== filters.requestType) return false;
        if (filters.section && filters.section !== "ALL" && r.department !== filters.section) return false;
        if (filters.fromDate && r.requestDate < filters.fromDate) return false;
        if (filters.toDate && r.requestDate > filters.toDate) return false;
        if (filters.search) {
          const s = filters.search.toLowerCase();
          return (
            r.requisitionNumber.toLowerCase().includes(s) ||
            r.requesterName.toLowerCase().includes(s) ||
            r.department.toLowerCase().includes(s) ||
            r.items.some((i) => i.itemName.toLowerCase().includes(s) || i.itemCode.toLowerCase().includes(s))
          );
        }
        return true;
      });
  }

  public async getRequisitionById(id: string): Promise<PurchaseRequisition | null> {
    const list = await this.getRequisitions({});
    return list.find((r) => r.id === id || r.requisitionNumber === id) || null;
  }

  private async findRequisition(id: string) {
    const req = await db().purchaseRequisition.findFirst({ where: isUuid(id) ? { id } : { number: id } });
    if (!req) throw notFound("Requisition");
    return req;
  }

  private async buildRequisitionLines(businessUnitId: string, items: CreateRequisitionInput["items"]) {
    if (!items?.length) throw badRequest("Add at least one item to the requisition.");
    const master = await itemMaster(businessUnitId, items.map((i) => i.itemId));
    let total = 0;
    const lines = items.map((it, idx) => {
      const qty = round3(num(it.quantity));
      const rate = round2(num(it.estimatedUnitPrice));
      if (!(qty > 0)) throw badRequest(`Line ${idx + 1}: enter a quantity greater than 0.`);
      if (rate < 0) throw badRequest(`Line ${idx + 1}: the estimated price cannot be negative.`);
      const itemId = isUuid(it.itemId) ? it.itemId : null;
      const known = itemId ? master.get(itemId) : undefined;
      if (itemId && !known) throw badRequest(`Line ${idx + 1}: the item does not exist.`);
      const name = known?.name ?? (it.itemName || "").trim();
      if (!name) throw badRequest(`Line ${idx + 1}: select an item.`);
      const lineTotal = round2(qty * rate);
      total += lineTotal;
      return {
        lineNo: idx + 1,
        itemId,
        itemCode: (known?.code ?? it.itemCode ?? `ITM-${idx + 1}`).slice(0, 50),
        itemName: name.slice(0, 200),
        uom: (known?.uom ?? it.uom ?? "PCS").slice(0, 20),
        quantity: qty,
        estimatedUnitPrice: rate,
        lineTotal,
        remarks: text(it.remarks, 500),
      };
    });
    return { lines, total: round2(total) };
  }

  public async createRequisition(input: CreateRequisitionInput, actorName: string = "Admin"): Promise<PurchaseRequisition> {
    const { officeId, warehouseId, businessUnitId } = await officeAndWarehouse(input.officeId, input.warehouseId);
    const { lines, total } = await this.buildRequisitionLines(businessUnitId, input.items);
    const requisitionDate = parseDate(input.requestDate, "Request date");
    const requiredDate = parseDate(input.requiredDeliveryDate || input.requestDate, "Required delivery date");
    if (requiredDate < requisitionDate) throw badRequest("The required delivery date cannot be before the request date.");

    const created = await db().$transaction(async (tx) => {
      const number = await issueNumber(tx, businessUnitId, "PURCHASE_REQUISITION", "REQ", requisitionDate, async (n) =>
        Boolean(await tx.purchaseRequisition.findFirst({ where: { businessUnitId, number: n }, select: { id: true } })),
      );
      return tx.purchaseRequisition.create({
        data: {
          businessUnitId,
          officeId,
          warehouseId,
          number,
          department: (input.department || "Operations").slice(0, 100),
          requestedBy: (input.requesterName || actorName).slice(0, 150),
          requisitionDate,
          requiredDate,
          status: "PENDING",
          requestType: input.requestType || "LOCAL",
          purchaseMethod: input.purchaseMethod || "DIRECT",
          totalEstimated: total,
          notes: appendNote(text(input.businessJustification || input.remarks, 600), historyEntry("SUBMITTED", actorName)),
          lines: { create: lines },
        },
      });
    });

    return (await this.getRequisitionById(created.id))!;
  }

  /**
   * Approve / reject / cancel / reverse. With an `actor`, approving and rejecting
   * go through the multilayer approval pipeline: the requisition stays PENDING
   * until its last stage approves.
   */
  public async updateRequisitionStatus(id: string, action: string, actorName: string, comments?: string, actor?: Actor) {
    const req = await this.findRequisition(id);
    const result = requisitionTransition(req.status as RequisitionDbStatus, action as RequisitionAction);
    if ("error" in result) throw badRequest(result.error);
    if (action === "REJECT" && !comments?.trim()) throw badRequest("Give a reason for rejecting the requisition.");

    const target = { feature: "Purchase Requisition", documentId: req.id, businessUnitId: req.businessUnitId, amount: Number(req.totalEstimated), comment: comments || null };
    await db().$transaction(async (tx) => {
      let status = result.to as RequisitionDbStatus;
      let label = REQUISITION_PAST[action as RequisitionAction] ?? action;
      let note = comments;
      if (action === "APPROVE" && actor) {
        const gate = await recordApproval(tx, actor, target);
        if (!gate.final) {
          status = req.status as RequisitionDbStatus;
          label = "STAGE_APPROVED";
          note = [approvalNote(gate), comments].filter(Boolean).join(" ");
        }
      } else if (action === "REJECT" && actor) {
        await recordRejection(tx, actor, target);
      } else if (status === "PENDING") {
        // Reversed back to pending: approval starts over.
        await resetApproval(tx, target.feature, req.id);
      }
      await tx.purchaseRequisition.update({
        where: { id: req.id },
        data: { status, notes: appendNote(req.notes, historyEntry(label, actorName, note)) },
      });
    });
    return this.getRequisitionById(req.id);
  }

  public async updateRequisition(id: string, input: Partial<CreateRequisitionInput>, actorName: string) {
    const req = await this.findRequisition(id);
    if (!requisitionEditable(req.status as RequisitionDbStatus)) {
      throw badRequest(`A ${req.status.toLowerCase()} requisition cannot be edited; reverse it first.`);
    }
    const place = await officeAndWarehouse(input.officeId ?? req.officeId, input.warehouseId ?? req.warehouseId);
    const requisitionDate = input.requestDate ? parseDate(input.requestDate, "Request date") : req.requisitionDate;
    const requiredDate = input.requiredDeliveryDate ? parseDate(input.requiredDeliveryDate, "Required delivery date") : req.requiredDate;
    if (requiredDate < requisitionDate) throw badRequest("The required delivery date cannot be before the request date.");
    const built = input.items?.length ? await this.buildRequisitionLines(place.businessUnitId, input.items) : null;

    const { history } = splitNotes(req.notes);
    const justification = input.businessJustification ?? input.remarks;
    const notes =
      justification !== undefined
        ? [text(justification, 600), ...(req.notes ?? "").split("\n").filter((l) => HISTORY_LINE.test(l))].filter(Boolean).join("\n")
        : req.notes;

    await db().$transaction(async (tx) => {
      if (built) {
        await tx.purchaseRequisitionLine.deleteMany({ where: { requisitionId: req.id } });
        await tx.purchaseRequisitionLine.createMany({ data: built.lines.map((l) => ({ ...l, requisitionId: req.id })) });
      }
      await tx.purchaseRequisition.update({
        where: { id: req.id },
        data: {
          officeId: place.officeId,
          warehouseId: place.warehouseId,
          department: input.department ? input.department.slice(0, 100) : undefined,
          requestedBy: input.requesterName ? input.requesterName.slice(0, 150) : undefined,
          requestType: input.requestType ?? undefined,
          purchaseMethod: input.purchaseMethod ?? undefined,
          requisitionDate,
          requiredDate,
          totalEstimated: built ? built.total : undefined,
          // Editing a rejected requisition sends it back for approval.
          status: req.status === "REJECTED" ? "PENDING" : undefined,
          notes: appendNote(notes, historyEntry(history.length && req.status === "REJECTED" ? "RESUBMITTED" : "EDITED", actorName)),
        },
      });
    });

    return this.getRequisitionById(req.id);
  }

  /** Sets how an approved requisition will be bought (direct, quotation, tender, contract). */
  public async setRequisitionMethod(id: string, method: string, actorName: string) {
    const allowed = ["DIRECT", "QUOTATION", "TENDER", "CONTRACT"];
    if (!allowed.includes(method)) throw badRequest("Choose a valid purchase method.");
    const req = await this.findRequisition(id);
    if (req.status === "ORDERED" || req.status === "CANCELLED") throw badRequest(`A ${req.status.toLowerCase()} requisition's method cannot change.`);
    await db().purchaseRequisition.update({
      where: { id: req.id },
      data: { purchaseMethod: method, notes: appendNote(req.notes, historyEntry("METHOD_SET", actorName, method)) },
    });
    return this.getRequisitionById(req.id);
  }

  /**
   * Items still to be bought: lines of approved requisitions without an order,
   * summed per item, with the current stock (all warehouses of the office, or all).
   */
  public async getRequisitionSummary(filters: { officeId?: string; fromDate?: string; toDate?: string }) {
    const office = filters.officeId && filters.officeId !== "ALL" && isUuid(filters.officeId) ? filters.officeId : undefined;
    const date: Prisma.DateTimeFilter = {};
    if (filters.fromDate) date.gte = parseDate(filters.fromDate, "From date");
    if (filters.toDate) date.lte = parseDate(filters.toDate, "To date");
    const lines = await db().purchaseRequisitionLine.findMany({
      where: {
        requisition: { status: "APPROVED", ...(office ? { officeId: office } : {}), ...(date.gte || date.lte ? { requisitionDate: date } : {}) },
      },
      include: { item: { include: { category: { include: { parent: true } } } } },
    });
    const byItem = new Map<string, { itemId: string; itemCode: string; itemName: string; category: string; subCategory: string; uom: string; quantity: number; requisitions: number }>();
    for (const l of lines) {
      const key = l.itemId ?? `${l.itemCode}|${l.itemName}`;
      const cat = l.item?.category;
      const cur = byItem.get(key) ?? {
        itemId: l.itemId ?? "",
        itemCode: l.itemCode,
        itemName: l.itemName,
        category: cat?.parent?.name ?? cat?.name ?? "Uncategorised",
        subCategory: cat?.parent ? cat.name : "",
        uom: l.uom,
        quantity: 0,
        requisitions: 0,
      };
      cur.quantity = round3(cur.quantity + Number(l.quantity));
      cur.requisitions += 1;
      byItem.set(key, cur);
    }
    const itemIds = [...byItem.values()].map((r) => r.itemId).filter(Boolean);
    const stock = itemIds.length
      ? await db().stockEntry.groupBy({
          by: ["itemId"],
          where: { itemId: { in: itemIds }, ...(office ? { warehouse: { officeId: office } } : {}) },
          _sum: { qty: true },
        })
      : [];
    const stockByItem = new Map(stock.map((s) => [s.itemId, round3(Number(s._sum.qty ?? 0))]));
    return [...byItem.values()]
      .map((r) => ({ ...r, currentStock: r.itemId ? (stockByItem.get(r.itemId) ?? 0) : 0 }))
      .sort((a, b) => a.itemName.localeCompare(b.itemName));
  }

  // -------------------------------------------------------------
  // PURCHASE ORDERS
  // -------------------------------------------------------------
  public async getPurchaseOrders(filters: {
    officeId?: string;
    supplierId?: string;
    status?: string;
    search?: string;
    fromDate?: string;
    toDate?: string;
  }): Promise<PurchaseOrder[]> {
    const rows = await db().purchaseOrder.findMany({
      include: {
        lines: { orderBy: { lineNo: "asc" } },
        supplier: true,
        office: true,
        warehouse: true,
        requisition: true,
        returns: { where: { status: { not: "CANCELLED" } }, include: { lines: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return rows
      .filter((po) => !filters.status || filters.status === "ALL" || orderStatusMatches(po.status as OrderDbStatus, filters.status))
      .map((po) => {
        const returnedByItem = new Map<string, number>();
        for (const r of po.returns) for (const l of r.lines) {
          const key = l.itemId ?? l.itemCode;
          returnedByItem.set(key, (returnedByItem.get(key) ?? 0) + Number(l.qty));
        }
        const { body, history } = splitNotes(po.notes);

        const items = po.lines.map((l) => {
          const priced = priceLine(Number(l.quantity), Number(l.unitPrice), Number(l.discountPercent), Number(l.vatPercent));
          return {
            id: l.id,
            itemId: l.itemId || "",
            itemCode: l.itemCode,
            itemName: l.itemName,
            uom: l.uom,
            orderedQuantity: Number(l.quantity),
            receivedQuantity: Number(l.receivedQuantity),
            returnedQuantity: round3(returnedByItem.get(l.itemId ?? l.itemCode) ?? 0),
            outstandingQuantity: po.status === "CLOSED" || po.status === "CANCELLED" ? 0 : round3(Math.max(0, Number(l.quantity) - Number(l.receivedQuantity))),
            unitPrice: Number(l.unitPrice),
            discountPercentage: Number(l.discountPercent),
            discountAmount: priced.discount,
            taxPercentage: Number(l.vatPercent),
            taxAmount: priced.tax,
            lineTotal: Number(l.lineTotal),
            remarks: l.remarks || undefined,
          };
        });

        return {
          id: po.id,
          companyId: po.businessUnitId,
          requisitionId: po.requisitionId || undefined,
          requisitionNumber: po.requisition?.number || undefined,
          supplierId: po.supplierId,
          supplierName: po.supplier?.name || "Supplier",
          officeId: po.officeId,
          officeName: po.office?.name || "Office",
          warehouseId: po.warehouseId || "",
          warehouseName: po.warehouse?.name || "Warehouse",
          projectCostCenter: po.projectCostCenter || undefined,
          poNumber: po.number,
          orderDate: toDateStr(po.orderDate),
          expectedDeliveryDate: toDateStr(po.expectedDeliveryDate || po.orderDate),
          referenceNumber: po.referenceNumber || undefined,
          paymentTerms: "Net 30 Days",
          deliveryTerms: "FOB Warehouse",
          notes: body || undefined,
          shippingFee: Number(po.shippingFee),
          subtotal: Number(po.subtotal),
          totalDiscount: Number(po.totalDiscount),
          totalTax: Number(po.totalTax),
          totalAmount: Number(po.totalAmount),
          status: ORDER_STATUS[po.status as OrderDbStatus] ?? "APPROVED",
          isClosed: po.status === "CLOSED",
          createdBy: po.createdBy,
          createdAt: po.createdAt.toISOString(),
          updatedAt: po.updatedAt.toISOString(),
          approvalHistory: history,
          items,
        };
      })
      .filter((po) => {
        if (filters.officeId && filters.officeId !== "ALL" && po.officeId !== filters.officeId) return false;
        if (filters.supplierId && filters.supplierId !== "ALL" && po.supplierId !== filters.supplierId) return false;
        if (filters.fromDate && po.orderDate < filters.fromDate) return false;
        if (filters.toDate && po.orderDate > filters.toDate) return false;
        if (filters.search) {
          const s = filters.search.toLowerCase();
          return (
            po.poNumber.toLowerCase().includes(s) ||
            po.supplierName.toLowerCase().includes(s) ||
            (po.requisitionNumber ?? "").toLowerCase().includes(s) ||
            (po.referenceNumber ?? "").toLowerCase().includes(s)
          );
        }
        return true;
      });
  }

  public async getPurchaseOrderById(id: string): Promise<PurchaseOrder | null> {
    const list = await this.getPurchaseOrders({});
    return list.find((p) => p.id === id || p.poNumber === id) || null;
  }

  /** Inserts an order inside the caller's transaction (also used by direct receiving). */
  private async insertPurchaseOrder(tx: Tx, input: CreatePurchaseOrderInput, actorName: string) {
    const place = await officeAndWarehouse(input.officeId, input.warehouseId, tx);
    if (!place.warehouseId) throw badRequest("Select the warehouse the goods will be received into.");
    if (!isUuid(input.supplierId)) throw badRequest("Select the supplier.");
    const supplier = await tx.supplier.findUnique({ where: { id: input.supplierId }, select: { id: true, isActive: true, name: true } });
    if (!supplier) throw badRequest("The selected supplier does not exist.");
    if (!supplier.isActive) throw badRequest(`${supplier.name} is inactive; activate the supplier before ordering.`);

    let requisitionId: string | null = null;
    if (input.requisitionId) {
      const req = await tx.purchaseRequisition.findFirst({
        where: isUuid(input.requisitionId) ? { id: input.requisitionId } : { number: input.requisitionId },
        select: { id: true, status: true, number: true },
      });
      if (!req) throw badRequest("The selected requisition does not exist.");
      if (req.status !== "APPROVED") throw badRequest(`Requisition ${req.number} must be approved before a purchase order is issued.`);
      requisitionId = req.id;
    }

    const lines = await buildOrderLines(place.businessUnitId, input.items as OrderLineInput[], tx);
    const totals = orderTotals(lines.map((l) => l.priced), num(input.shippingFee));
    const orderDate = parseDate(input.orderDate, "Order date");
    const expectedDeliveryDate = parseDate(input.expectedDeliveryDate || input.orderDate, "Expected delivery date");
    if (expectedDeliveryDate < orderDate) throw badRequest("The expected delivery date cannot be before the order date.");

    const number = await issueNumber(tx, place.businessUnitId, "PURCHASE_ORDER", "PO", orderDate, async (n) =>
      Boolean(await tx.purchaseOrder.findFirst({ where: { businessUnitId: place.businessUnitId, number: n }, select: { id: true } })),
    );
    const order = await tx.purchaseOrder.create({
      data: {
        businessUnitId: place.businessUnitId,
        officeId: place.officeId,
        warehouseId: place.warehouseId,
        supplierId: supplier.id,
        requisitionId,
        number,
        orderDate,
        expectedDeliveryDate,
        referenceNumber: text(input.referenceNumber, 100),
        projectCostCenter: text(input.projectCostCenter, 100),
        // Issued orders are authorised by the buyer who issues them.
        status: "APPROVED",
        ...totals,
        shippingFee: num(input.shippingFee) > 0 ? round2(num(input.shippingFee)) : 0,
        notes: appendNote(text(input.notes, 600), historyEntry("ISSUED", actorName)),
        createdBy: actorName.slice(0, 150),
        lines: { create: lines.map((l) => l.data) },
      },
      include: { lines: { orderBy: { lineNo: "asc" } } },
    });
    if (requisitionId) await tx.purchaseRequisition.update({ where: { id: requisitionId }, data: { status: "ORDERED" } });
    return order;
  }

  public async createPurchaseOrder(input: CreatePurchaseOrderInput, actorName: string = "Admin"): Promise<PurchaseOrder> {
    const created = await db().$transaction((tx) => this.insertPurchaseOrder(tx, input, actorName));
    return (await this.getPurchaseOrderById(created.id))!;
  }

  private async findOrder(id: string) {
    const po = await db().purchaseOrder.findFirst({ where: isUuid(id) ? { id } : { number: id }, include: { lines: true } });
    if (!po) throw notFound("Purchase order");
    return po;
  }

  public async updatePurchaseOrder(id: string, input: Partial<CreatePurchaseOrderInput>, actorName: string) {
    const po = await this.findOrder(id);
    const progress = po.lines.map((l) => ({ ordered: Number(l.quantity), received: Number(l.receivedQuantity) }));
    if (!orderEditable(po.status as OrderDbStatus, progress)) {
      throw badRequest("Goods have been received or the order is closed; it can no longer be edited.");
    }
    let supplierId = po.supplierId;
    if (input.supplierId && input.supplierId !== po.supplierId) {
      if (!isUuid(input.supplierId) || !(await db().supplier.findUnique({ where: { id: input.supplierId }, select: { id: true } }))) {
        throw badRequest("The selected supplier does not exist.");
      }
      supplierId = input.supplierId;
    }
    const place = await officeAndWarehouse(input.officeId ?? po.officeId, input.warehouseId ?? po.warehouseId);
    const shipping = input.shippingFee !== undefined ? Math.max(0, round2(num(input.shippingFee))) : Number(po.shippingFee);
    const lines = input.items?.length ? await buildOrderLines(place.businessUnitId, input.items as OrderLineInput[]) : null;
    const totals = lines
      ? orderTotals(lines.map((l) => l.priced), shipping)
      : orderTotals(
          po.lines.map((l) => priceLine(Number(l.quantity), Number(l.unitPrice), Number(l.discountPercent), Number(l.vatPercent))),
          shipping,
        );
    const orderDate = input.orderDate ? parseDate(input.orderDate, "Order date") : po.orderDate;
    const expectedDeliveryDate = input.expectedDeliveryDate ? parseDate(input.expectedDeliveryDate, "Expected delivery date") : po.expectedDeliveryDate;
    if (expectedDeliveryDate && expectedDeliveryDate < orderDate) throw badRequest("The expected delivery date cannot be before the order date.");

    await db().$transaction(async (tx) => {
      if (lines) {
        await tx.purchaseOrderLine.deleteMany({ where: { orderId: po.id } });
        await tx.purchaseOrderLine.createMany({ data: lines.map((l) => ({ ...l.data, orderId: po.id })) });
      }
      await tx.purchaseOrder.update({
        where: { id: po.id },
        data: {
          supplierId,
          officeId: place.officeId,
          warehouseId: place.warehouseId,
          orderDate,
          expectedDeliveryDate,
          referenceNumber: input.referenceNumber !== undefined ? text(input.referenceNumber, 100) : undefined,
          projectCostCenter: input.projectCostCenter !== undefined ? text(input.projectCostCenter, 100) : undefined,
          shippingFee: shipping,
          ...totals,
          notes: appendNote(po.notes, historyEntry("EDITED", actorName)),
        },
      });
    });

    return this.getPurchaseOrderById(po.id);
  }

  /** With an `actor`, approving goes through the multilayer approval pipeline (the order stays PENDING until the last stage). */
  public async updatePurchaseOrderStatus(id: string, action: string, actorName: string, comments?: string, actor?: Actor) {
    const po = await this.findOrder(id);
    const progress = po.lines.map((l) => ({ ordered: Number(l.quantity), received: Number(l.receivedQuantity) }));
    const result = orderTransition(po.status as OrderDbStatus, action as OrderAction, progress);
    if ("error" in result) throw badRequest(result.error);

    const pastTense: Record<string, string> = { APPROVE: "APPROVED", CLOSE: "CLOSED", CANCEL: "CANCELLED", REVERSE: "REVERSED" };
    await db().$transaction(async (tx) => {
      let status = result.to as OrderDbStatus;
      let label = pastTense[action] ?? action;
      let note = comments;
      if (action === "APPROVE" && actor) {
        const gate = await recordApproval(tx, actor, { feature: "Purchase Order", documentId: po.id, businessUnitId: po.businessUnitId, amount: Number(po.totalAmount), comment: comments || null });
        if (!gate.final) {
          status = po.status as OrderDbStatus;
          label = "STAGE_APPROVED";
          note = [approvalNote(gate), comments].filter(Boolean).join(" ");
        }
      } else if (status === "PENDING") {
        await resetApproval(tx, "Purchase Order", po.id);
      }
      await tx.purchaseOrder.update({
        where: { id: po.id },
        data: { status, notes: appendNote(po.notes, historyEntry(label, actorName, note)) },
      });
      // A cancelled order frees its requisition for another order.
      if (result.to === "CANCELLED" && po.requisitionId) {
        const otherOrders = await tx.purchaseOrder.count({
          where: { requisitionId: po.requisitionId, id: { not: po.id }, status: { not: "CANCELLED" } },
        });
        if (!otherOrders) await tx.purchaseRequisition.update({ where: { id: po.requisitionId }, data: { status: "APPROVED" } });
      }
    });
    return this.getPurchaseOrderById(po.id);
  }

  // -------------------------------------------------------------
  // GOODS RECEIPT (GRN)
  // -------------------------------------------------------------
  public async getGoodsReceipts(filters: { search?: string; status?: string }): Promise<GoodsReceipt[]> {
    const rows = await db().goodsReceipt.findMany({
      include: {
        lines: { orderBy: { lineNo: "asc" } },
        supplier: true,
        office: true,
        warehouse: true,
        order: { include: { requisition: true } },
        returns: { where: { status: { not: "CANCELLED" } }, include: { lines: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return rows
      .map((g) => {
        const accepted = g.lines.map((l) => ({ itemKey: l.itemId ?? l.itemCode, qty: Number(l.acceptedQty) }));
        const returned = g.returns.flatMap((r) => r.lines.map((l) => ({ itemKey: l.itemId ?? l.itemCode, qty: Number(l.qty) })));
        const left = returnableByItem(accepted, returned);
        const anyReturned = returned.some((r) => r.qty > 0);
        const allReturned = anyReturned && [...left.values()].every((q) => q <= 0);

        let status: GoodsReceipt["status"] = "RECEIVED";
        if (g.status === "DRAFT") status = "DRAFT";
        else if (g.status === "CANCELLED") status = "CANCELLED";
        else if (allReturned) status = "FULLY_RETURNED";
        else if (anyReturned) status = "PARTIALLY_RETURNED";

        const items = g.lines.map((l) => ({
          id: l.id,
          poItemId: l.id,
          itemId: l.itemId || "",
          itemCode: l.itemCode,
          itemName: l.itemName,
          uom: l.uom,
          orderedQuantity: Number(l.orderedQty),
          previouslyReceivedQuantity: 0,
          currentReceivedQuantity: Number(l.receivedQty),
          rejectedDamagedQuantity: Number(l.rejectedQty),
          unitPrice: Number(l.unitPrice),
          lineTotal: Number(l.lineTotal),
          remarks: l.remarks || undefined,
        }));

        return {
          id: g.id,
          companyId: g.businessUnitId,
          purchaseOrderId: g.orderId,
          grnNumber: g.number,
          receiptDate: toDateStr(g.receiveDate),
          poNumber: g.order?.number || "DIRECT-PO",
          poDate: toDateStr(g.order?.orderDate || g.receiveDate),
          requisitionNumber: g.order?.requisition?.number || undefined,
          supplierId: g.supplierId,
          supplierName: g.supplier?.name || "Supplier",
          officeId: g.officeId,
          officeName: g.office?.name || "Office",
          warehouseId: g.warehouseId || "",
          warehouseName: g.warehouse?.name || "Warehouse",
          challanNumber: g.challanNumber || "",
          shipmentDocumentNumber: g.challanNumber || undefined,
          supplierInvoiceNumber: g.challanNumber || undefined,
          gatePassNumber: g.gatePassNumber || undefined,
          remarks: g.remarks || undefined,
          totalReceivedAmount: Number(g.totalAmount),
          status,
          preparedBy: g.receivedBy,
          stockMovementSyncStatus: "LIVE" as const,
          createdAt: g.createdAt.toISOString(),
          items,
        };
      })
      .filter((g) => {
        if (filters.status && filters.status !== "ALL" && g.status !== filters.status) return false;
        if (filters.search) {
          const s = filters.search.toLowerCase();
          return g.grnNumber.toLowerCase().includes(s) || g.poNumber.toLowerCase().includes(s) || g.supplierName.toLowerCase().includes(s);
        }
        return true;
      });
  }

  public async getApprovedOrdersForReceiving(): Promise<PurchaseOrder[]> {
    const list = await this.getPurchaseOrders({});
    return list.filter((p) => (p.status === "APPROVED" || p.status === "PARTIALLY_RECEIVED") && p.items.some((i) => i.outstandingQuantity > 0));
  }

  public async createGoodsReceipt(input: any, actorName: string = "Store Officer"): Promise<GoodsReceipt> {
    const prisma = db();
    const isDirect = !input.purchaseOrderId || input.purchaseOrderId === "DIRECT";
    const existing = isDirect
      ? null
      : await prisma.purchaseOrder.findFirst({
          where: isUuid(input.purchaseOrderId) ? { id: input.purchaseOrderId } : { number: input.purchaseOrderId },
          select: { id: true, warehouseId: true },
        });
    if (!isDirect && !existing) throw badRequest("The purchase order does not exist.");

    const inputLines: any[] = (input.items ?? []).filter((it: any) => num(it.currentReceivedQuantity) > 0);
    if (!inputLines.length) throw badRequest("Enter a received quantity for at least one item.");

    const warehouse = await stockWarehouse(existing?.warehouseId || input.warehouseId);
    const receivedAt = parseDate(input.receiptDate, "Receipt date");
    const challan = text(input.challanNumber ?? input.shipmentDocumentNumber ?? input.supplierInvoiceNumber, 100);

    const created = await prisma.$transaction(async (tx) => {
      await lockWarehouse(tx, warehouse.id);

      const order = isDirect
        ? await this.insertPurchaseOrder(
            tx,
            {
              companyId: "",
              officeId: warehouse.officeId,
              warehouseId: warehouse.id,
              supplierId: input.supplierId || "",
              orderDate: toDateStr(receivedAt),
              expectedDeliveryDate: toDateStr(receivedAt),
              referenceNumber: challan ?? undefined,
              paymentTerms: "Net 30 Days",
              deliveryTerms: "FOB Destination",
              shippingFee: 0,
              notes: "Direct receive without a purchase order",
              items: inputLines.map((it) => ({
                itemId: it.itemId,
                itemCode: it.itemCode,
                itemName: it.itemName,
                uom: it.uom,
                orderedQuantity: num(it.currentReceivedQuantity) - num(it.rejectedDamagedQuantity),
                unitPrice: num(it.unitPrice),
                receivedQuantity: 0,
                returnedQuantity: 0,
                outstandingQuantity: 0,
                discountPercentage: 0,
                discountAmount: 0,
                taxPercentage: 0,
                taxAmount: 0,
                lineTotal: 0,
              })),
            },
            actorName,
          )
        : await tx.purchaseOrder.findUniqueOrThrow({ where: { id: existing!.id }, include: { lines: { orderBy: { lineNo: "asc" } } } });

      if (!orderReceivable(order.status as OrderDbStatus)) {
        throw badRequest(`Order ${order.number} is ${order.status.toLowerCase().replace("_", " ")}; only approved orders can be received.`);
      }

      // Match each received line to its order line: by order line id, then item, then position.
      const used = new Set<string>();
      const matched = inputLines.map((it, idx) => {
        const line =
          order.lines.find((l) => l.id === it.poItemId && !used.has(l.id)) ??
          order.lines.find((l) => isUuid(it.itemId) && l.itemId === it.itemId && !used.has(l.id)) ??
          (isDirect ? order.lines[idx] : undefined);
        if (!line) throw badRequest(`${it.itemName || `Line ${idx + 1}`} is not on order ${order.number}.`);
        used.add(line.id);
        const received = round3(num(it.currentReceivedQuantity));
        const rejected = round3(num(it.rejectedDamagedQuantity));
        const outstanding = round3(Number(line.quantity) - Number(line.receivedQuantity));
        const error = receiptLineError({ itemName: line.itemName, outstanding, received, rejected });
        if (error) throw badRequest(error);
        const accepted = round3(received - rejected);
        const rate = effectiveUnitCost(Number(line.lineTotal), Number(line.quantity));
        return { line, received, rejected, accepted, rate, remarks: text(it.remarks, 500) };
      });

      const number = await issueNumber(tx, warehouse.businessUnitId, "GOODS_RECEIPT", "GRN", receivedAt, async (n) =>
        Boolean(await tx.goodsReceipt.findFirst({ where: { businessUnitId: warehouse.businessUnitId, number: n }, select: { id: true } })),
      );
      const linesData = matched.map((m, idx) => ({
        lineNo: idx + 1,
        itemId: m.line.itemId,
        itemCode: m.line.itemCode,
        itemName: m.line.itemName,
        uom: m.line.uom,
        orderedQty: Number(m.line.quantity),
        receivedQty: m.received,
        acceptedQty: m.accepted,
        rejectedQty: m.rejected,
        unitPrice: m.rate,
        // Only accepted goods are owed to the supplier.
        lineTotal: round2(m.accepted * m.rate),
        remarks: m.remarks,
      }));
      const totalAmount = round2(linesData.reduce((s, l) => s + l.lineTotal, 0));

      const receipt = await tx.goodsReceipt.create({
        data: {
          businessUnitId: warehouse.businessUnitId,
          officeId: order.officeId,
          warehouseId: warehouse.id,
          orderId: order.id,
          supplierId: order.supplierId,
          number,
          receiveDate: receivedAt,
          challanNumber: challan,
          gatePassNumber: text(input.gatePassNumber ?? input.deliveryNoteNumber, 100),
          status: "RECEIVED",
          totalReceivedQty: round3(linesData.reduce((s, l) => s + l.receivedQty, 0)),
          totalAcceptedQty: round3(linesData.reduce((s, l) => s + l.acceptedQty, 0)),
          totalRejectedQty: round3(linesData.reduce((s, l) => s + l.rejectedQty, 0)),
          totalAmount,
          remarks: text(input.remarks, 1000),
          receivedBy: actorName.slice(0, 150),
          lines: { create: linesData },
        },
      });

      // Accepted quantities go into the warehouse, so Sales and Production see the stock.
      await postStock(tx, warehouse, linesData.map((l) => ({ itemId: l.itemId, qty: l.acceptedQty })), {
        source: "PURCHASE_RECEIPT",
        sourceId: receipt.id,
        postingDate: receivedAt,
        remarks: `Goods receipt ${number}`,
        createdBy: actorName,
      });

      for (const m of matched) {
        if (m.accepted > 0) await tx.purchaseOrderLine.update({ where: { id: m.line.id }, data: { receivedQuantity: { increment: m.accepted } } });
      }
      const lines = await tx.purchaseOrderLine.findMany({ where: { orderId: order.id }, select: { quantity: true, receivedQuantity: true } });
      await tx.purchaseOrder.update({
        where: { id: order.id },
        data: { status: receivingStatus(lines.map((l) => ({ ordered: Number(l.quantity), received: Number(l.receivedQuantity) }))) },
      });

      if (totalAmount > 0) {
        await tx.supplier.update({ where: { id: order.supplierId }, data: { balance: { increment: totalAmount } } });
      }
      return receipt;
    });

    const res = await this.getGoodsReceipts({});
    return res.find((g) => g.id === created.id)!;
  }

  /** Cancels a receipt: stock leaves again, the order is reopened and the supplier balance reduced. */
  public async cancelGoodsReceipt(id: string, actorName: string, comments?: string) {
    const prisma = db();
    const receipt = await prisma.goodsReceipt.findFirst({ where: isUuid(id) ? { id } : { number: id }, include: { lines: true } });
    if (!receipt) throw notFound("Goods receipt");
    if (receipt.status === "CANCELLED") throw badRequest("The receipt is already cancelled.");
    const [returns, payments, bill] = await Promise.all([
      prisma.purchaseReturn.count({ where: { receiptId: receipt.id, status: { not: "CANCELLED" } } }),
      prisma.supplierPayment.count({ where: { receiptId: receipt.id, status: { not: "CANCELLED" } } }),
      prisma.supplierBill.count({ where: { receiptId: receipt.id, status: { not: "CANCELLED" } } }),
    ]);
    if (returns) throw badRequest("Cancel the returns made against this receipt first.");
    if (payments) throw badRequest("Payments have been made against this receipt; it cannot be cancelled.");
    if (bill) throw badRequest("A supplier bill has been booked for this receipt; cancel the bill first.");

    await prisma.$transaction(async (tx) => {
      if (receipt.warehouseId) {
        await lockWarehouse(tx, receipt.warehouseId);
        await unpostStock(tx, receipt.warehouseId, "PURCHASE_RECEIPT", receipt.id);
      }
      const orderLines = await tx.purchaseOrderLine.findMany({ where: { orderId: receipt.orderId } });
      const receivedNow = new Map(orderLines.map((o) => [o.id, Number(o.receivedQuantity)]));
      const used = new Set<string>();
      for (const l of receipt.lines) {
        const line = orderLines.find((o) => !used.has(o.id) && (l.itemId ? o.itemId === l.itemId : o.itemCode === l.itemCode));
        if (!line) continue;
        used.add(line.id);
        const back = Math.min(receivedNow.get(line.id)!, Number(l.acceptedQty));
        receivedNow.set(line.id, round3(receivedNow.get(line.id)! - back));
        if (back > 0) await tx.purchaseOrderLine.update({ where: { id: line.id }, data: { receivedQuantity: { decrement: back } } });
      }
      const order = await tx.purchaseOrder.findUniqueOrThrow({ where: { id: receipt.orderId }, select: { status: true } });
      if (order.status !== "CLOSED" && order.status !== "CANCELLED") {
        await tx.purchaseOrder.update({
          where: { id: receipt.orderId },
          data: { status: receivingStatus(orderLines.map((l) => ({ ordered: Number(l.quantity), received: receivedNow.get(l.id)! }))) },
        });
      }
      await tx.goodsReceipt.update({
        where: { id: receipt.id },
        data: { status: "CANCELLED", remarks: appendNote(receipt.remarks, historyEntry("CANCELLED", actorName, comments)) },
      });
      if (Number(receipt.totalAmount) > 0) {
        await tx.supplier.update({ where: { id: receipt.supplierId }, data: { balance: { decrement: Number(receipt.totalAmount) } } });
      }
    });
    const res = await this.getGoodsReceipts({});
    return res.find((g) => g.id === receipt.id)!;
  }

  // -------------------------------------------------------------
  // PURCHASE RETURNS
  // -------------------------------------------------------------
  public async getPurchaseReturns(filters: { search?: string; status?: string }): Promise<PurchaseReturn[]> {
    const rows = await db().purchaseReturn.findMany({
      include: { lines: { orderBy: { lineNo: "asc" } }, supplier: true, office: true, warehouse: true, receipt: { include: { lines: true } }, order: true },
      orderBy: { createdAt: "desc" },
    });

    return rows
      .map((pr) => {
        const items = pr.lines.map((l) => {
          const grnLine = pr.receipt?.lines.find((g) => (l.itemId ? g.itemId === l.itemId : g.itemCode === l.itemCode));
          return {
            id: l.id,
            grnItemId: grnLine?.id ?? l.id,
            itemId: l.itemId || "",
            itemCode: l.itemCode,
            itemName: l.itemName,
            uom: l.uom,
            receivedQuantity: grnLine ? Number(grnLine.acceptedQty) : Number(l.qty),
            previouslyReturnedQuantity: 0,
            eligibleReturnQuantity: grnLine ? Number(grnLine.acceptedQty) : Number(l.qty),
            returnQuantity: Number(l.qty),
            unitPrice: Number(l.unitPrice),
            lineTotal: Number(l.amount),
            reason: l.reason || pr.reason || "Defective",
            condition: "DAMAGED" as const,
          };
        });

        return {
          id: pr.id,
          companyId: pr.businessUnitId,
          goodsReceiptId: pr.receiptId || "WITHOUT_REF",
          returnNumber: pr.number,
          returnDate: toDateStr(pr.returnDate),
          grnNumber: pr.receipt?.number || "Direct Return",
          poNumber: pr.order?.number || "N/A",
          supplierId: pr.supplierId,
          supplierName: pr.supplier?.name || "Supplier",
          officeId: pr.officeId,
          officeName: pr.office?.name || "Office",
          warehouseName: pr.warehouse?.name || "Warehouse",
          totalReturnAmount: Number(pr.totalAmount),
          returnType: "REFUND_CREDIT" as const,
          remarks: pr.reason || undefined,
          status: pr.status === "CANCELLED" ? ("CANCELLED" as const) : ("COMPLETED" as const),
          createdBy: "Store Officer",
          createdAt: pr.createdAt.toISOString(),
          inventoryReversalStatus: "SYNCED" as const,
          financeCreditNoteStatus: "SYNCED" as const,
          items,
        };
      })
      .filter((pr) => {
        if (filters.status && filters.status !== "ALL" && pr.status !== filters.status) return false;
        if (filters.search) {
          const s = filters.search.toLowerCase();
          return pr.returnNumber.toLowerCase().includes(s) || pr.supplierName.toLowerCase().includes(s) || pr.grnNumber.toLowerCase().includes(s);
        }
        return true;
      });
  }

  /**
   * Receipts that still have goods to return. Each item's received quantity is
   * what can still be returned (accepted less earlier returns), so the return
   * screen can never offer more than is left.
   */
  public async getEligibleReceiptsForReturn(): Promise<GoodsReceipt[]> {
    const [receipts, rows] = await Promise.all([
      this.getGoodsReceipts({}),
      db().goodsReceipt.findMany({
        where: { status: { not: "CANCELLED" } },
        select: { id: true, lines: true, returns: { where: { status: { not: "CANCELLED" } }, select: { lines: true } } },
      }),
    ]);
    const leftByReceipt = new Map(
      rows.map((g) => [
        g.id,
        returnableByItem(
          g.lines.map((l) => ({ itemKey: l.itemId ?? l.itemCode, qty: Number(l.acceptedQty) })),
          g.returns.flatMap((r) => r.lines.map((l) => ({ itemKey: l.itemId ?? l.itemCode, qty: Number(l.qty) }))),
        ),
      ]),
    );
    return receipts
      .filter((g) => g.status !== "CANCELLED" && leftByReceipt.has(g.id))
      .map((g) => {
        const left = new Map(leftByReceipt.get(g.id)!);
        const items = g.items
          .map((it) => {
            const key = it.itemId || it.itemCode;
            const qty = Math.max(0, Math.min(left.get(key) ?? 0, it.currentReceivedQuantity - it.rejectedDamagedQuantity));
            left.set(key, round3((left.get(key) ?? 0) - qty));
            return { ...it, currentReceivedQuantity: qty, rejectedDamagedQuantity: 0, lineTotal: round2(qty * it.unitPrice) };
          })
          .filter((it) => it.currentReceivedQuantity > 0);
        return { ...g, items, totalReceivedAmount: round2(items.reduce((s, i) => s + i.lineTotal, 0)) };
      })
      .filter((g) => g.items.length > 0);
  }

  public async createPurchaseReturn(input: any, actorName: string = "Store Officer"): Promise<PurchaseReturn> {
    const prisma = db();
    const withReceipt = input.goodsReceiptId && input.goodsReceiptId !== "WITHOUT_REF";
    const grn = withReceipt
      ? await prisma.goodsReceipt.findFirst({
          where: isUuid(input.goodsReceiptId) ? { id: input.goodsReceiptId } : { number: input.goodsReceiptId },
          include: { lines: true, returns: { where: { status: { not: "CANCELLED" } }, include: { lines: true } } },
        })
      : null;
    if (withReceipt && !grn) throw badRequest("The goods receipt does not exist.");
    if (grn?.status === "CANCELLED") throw badRequest(`Receipt ${grn.number} is cancelled; nothing can be returned against it.`);

    const warehouse = await stockWarehouse(grn?.warehouseId || input.warehouseId);
    const officeId = grn?.officeId || warehouse.officeId;
    const supplierId = grn?.supplierId || (isUuid(input.supplierId) ? input.supplierId : "");
    if (!supplierId) throw badRequest("Select the supplier the goods are returned to.");

    const inputLines: any[] = (input.items ?? []).filter((it: any) => num(it.returnQuantity) > 0);
    if (!inputLines.length) throw badRequest("Enter a return quantity for at least one item.");

    const left = grn
      ? returnableByItem(
          grn.lines.map((l) => ({ itemKey: l.itemId ?? l.itemCode, qty: Number(l.acceptedQty) })),
          grn.returns.flatMap((r) => r.lines.map((l) => ({ itemKey: l.itemId ?? l.itemCode, qty: Number(l.qty) }))),
        )
      : null;
    const master = grn ? new Map() : await itemMaster(warehouse.businessUnitId, inputLines.map((l) => l.itemId));

    const linesData = inputLines.map((it, idx) => {
      const qty = round3(num(it.returnQuantity));
      if (grn) {
        const grnLine = grn.lines.find((l) => (isUuid(it.itemId) ? l.itemId === it.itemId : l.itemCode === it.itemCode));
        if (!grnLine) throw badRequest(`${it.itemName || `Line ${idx + 1}`} was not received on ${grn.number}.`);
        const key = grnLine.itemId ?? grnLine.itemCode;
        const available = left!.get(key) ?? 0;
        if (qty > available + 1e-9) throw badRequest(`${grnLine.itemName}: only ${round3(available)} can still be returned from ${grn.number}.`);
        left!.set(key, round3(available - qty));
        const rate = Number(grnLine.unitPrice);
        return {
          lineNo: idx + 1,
          itemId: grnLine.itemId,
          itemCode: grnLine.itemCode,
          itemName: grnLine.itemName,
          uom: grnLine.uom,
          qty,
          unitPrice: rate,
          amount: round2(qty * rate),
          reason: text(it.reason || "Defective", 500),
        };
      }
      const itemId = isUuid(it.itemId) ? it.itemId : null;
      if (!itemId || !master.get(itemId)) throw badRequest(`Line ${idx + 1}: select the item being returned.`);
      const known = master.get(itemId)!;
      const rate = round2(num(it.unitPrice));
      if (rate < 0) throw badRequest(`Line ${idx + 1}: the unit price cannot be negative.`);
      return {
        lineNo: idx + 1,
        itemId,
        itemCode: known.code,
        itemName: known.name,
        uom: known.uom,
        qty,
        unitPrice: rate,
        amount: round2(qty * rate),
        reason: text(it.reason || "Defective", 500),
      };
    });
    const totalAmount = round2(linesData.reduce((s, l) => s + l.amount, 0));
    const returnedAt = parseDate(input.returnDate, "Return date");
    if (grn && returnedAt < grn.receiveDate) throw badRequest("The return date cannot be before the receipt date.");

    const created = await prisma.$transaction(async (tx) => {
      await lockWarehouse(tx, warehouse.id);
      const number = await issueNumber(tx, warehouse.businessUnitId, "PURCHASE_RETURN", "PR", returnedAt, async (n) =>
        Boolean(await tx.purchaseReturn.findFirst({ where: { businessUnitId: warehouse.businessUnitId, number: n }, select: { id: true } })),
      );
      const purchaseReturn = await tx.purchaseReturn.create({
        data: {
          businessUnitId: warehouse.businessUnitId,
          officeId,
          warehouseId: warehouse.id,
          supplierId,
          receiptId: grn?.id || null,
          orderId: grn?.orderId || null,
          number,
          returnDate: returnedAt,
          reason: text(input.remarks || linesData[0]?.reason || "Defective", 500),
          status: "COMPLETED",
          totalQty: round3(linesData.reduce((s, l) => s + l.qty, 0)),
          totalAmount,
          lines: { create: linesData },
        },
      });

      // Returned goods leave the warehouse; refuses to return more than is in stock.
      await postStock(tx, warehouse, linesData.map((l) => ({ itemId: l.itemId, qty: -l.qty })), {
        source: "PURCHASE_RETURN",
        sourceId: purchaseReturn.id,
        postingDate: returnedAt,
        remarks: `Purchase return ${number}`,
        createdBy: actorName,
      });

      if (totalAmount > 0) {
        await tx.supplier.update({ where: { id: supplierId }, data: { balance: { decrement: totalAmount } } });
      }
      return purchaseReturn;
    });

    const res = await this.getPurchaseReturns({});
    return res.find((r) => r.id === created.id)!;
  }

  /** Cancels a return: the goods come back into stock and the supplier balance goes up again. */
  public async cancelPurchaseReturn(id: string, actorName: string, comments?: string) {
    const prisma = db();
    const ret = await prisma.purchaseReturn.findFirst({ where: isUuid(id) ? { id } : { number: id } });
    if (!ret) throw notFound("Purchase return");
    if (ret.status === "CANCELLED") throw badRequest("The return is already cancelled.");
    await prisma.$transaction(async (tx) => {
      if (ret.warehouseId) {
        await lockWarehouse(tx, ret.warehouseId);
        await tx.stockEntry.deleteMany({ where: { source: "PURCHASE_RETURN", sourceId: ret.id } });
      }
      await tx.purchaseReturn.update({
        where: { id: ret.id },
        data: { status: "CANCELLED", reason: appendNote(ret.reason, historyEntry("CANCELLED", actorName, comments), 500) },
      });
      if (Number(ret.totalAmount) > 0) {
        await tx.supplier.update({ where: { id: ret.supplierId }, data: { balance: { increment: Number(ret.totalAmount) } } });
      }
    });
    const res = await this.getPurchaseReturns({});
    return res.find((r) => r.id === ret.id)!;
  }

  // -------------------------------------------------------------
  // SUPPLIER PAYMENTS & PAYABLES
  // -------------------------------------------------------------
  public async getSupplierPayments(filters: { search?: string; status?: string; category?: string }): Promise<SupplierPaymentRecord[]> {
    const rows = await listSupplierPayables();
    return rows.filter((sp) => {
      if (filters.status && filters.status !== "ALL" && sp.paymentStatus !== filters.status) return false;
      if (filters.category && filters.category !== "ALL" && sp.category !== filters.category) return false;
      if (filters.search) {
        const s = filters.search.toLowerCase();
        return sp.supplierName.toLowerCase().includes(s) || sp.supplierCode.toLowerCase().includes(s);
      }
      return true;
    });
  }

  public async getSupplierInvoices(filters: { search?: string; status?: string; type?: string }): Promise<SupplierInvoiceItem[]> {
    const rows = await listSupplierInvoices();
    return rows.filter((inv) => {
      if (filters.status && filters.status !== "ALL" && inv.status !== filters.status) return false;
      if (filters.type && filters.type !== "ALL" && inv.type !== filters.type) return false;
      if (filters.search) {
        const s = filters.search.toLowerCase();
        return inv.invoiceNumber.toLowerCase().includes(s) || inv.supplierName.toLowerCase().includes(s);
      }
      return true;
    });
  }

  /** Posts a payment to a supplier: settles a receipt or bill, an advance, or on account. */
  public async createSupplierPayment(input: any, actorName: string = "Admin") {
    const prisma = db();
    const supplierId = input.supplierId;
    if (!isUuid(supplierId)) throw badRequest("Select the supplier being paid.");
    const amount = round2(Number(input.amount));
    if (!(amount > 0)) throw badRequest("Enter a payment amount greater than 0.");
    const receiptId = isUuid(input.receiptId) ? String(input.receiptId) : null;
    const billId = isUuid(input.billId) ? String(input.billId) : null;
    const isAdvance = input.isAdvance === true;
    if (isAdvance && (receiptId || billId)) throw badRequest("An advance is paid before a receipt or bill, so it cannot settle one.");
    const method = ["CASH", "BANK", "CHEQUE", "ONLINE"].includes(input.method) ? input.method : "BANK";
    if (method === "CHEQUE" && !input.referenceNumber) throw badRequest("Enter the cheque number.");

    const supplier = await prisma.supplier.findUnique({ where: { id: supplierId }, select: { businessUnitId: true } });
    if (!supplier) throw badRequest("Supplier not found.");
    await validatePaymentLink(supplierId, receiptId, billId, amount);
    const paymentDate = parseDate(input.paymentDate, "Payment date");

    return prisma.$transaction(async (tx) => {
      const number = await issueNumber(tx, supplier.businessUnitId, "SUPPLIER_PAYMENT", "PAY", paymentDate, async (n) =>
        Boolean(await tx.supplierPayment.findFirst({ where: { businessUnitId: supplier.businessUnitId, number: n }, select: { id: true } })),
      );
      const payment = await tx.supplierPayment.create({
        data: {
          businessUnitId: supplier.businessUnitId,
          supplierId,
          receiptId,
          billId,
          isAdvance,
          number,
          paymentDate,
          amount,
          method,
          referenceNumber: text(input.referenceNumber, 100),
          status: "PAID",
          remarks: text(input.narration, 500),
          createdBy: actorName,
        },
      });
      await tx.supplier.update({ where: { id: supplierId }, data: { balance: { decrement: amount } } });
      return payment;
    });
  }

  public async approveSupplierPayment(id: string) {
    const payment = await db().supplierPayment.findFirst({ where: isUuid(id) ? { id } : { number: id } });
    if (!payment) throw notFound("Supplier payment");
    if (payment.status === "CANCELLED") throw badRequest("A cancelled payment cannot be approved.");
    return db().supplierPayment.update({ where: { id: payment.id }, data: { status: "PAID" } });
  }

  /** Cancels a payment: the amount is owed to the supplier again (the GL posts a reversal). */
  public async cancelSupplierPayment(id: string, actorName: string, comments?: string) {
    const prisma = db();
    const payment = await prisma.supplierPayment.findFirst({ where: isUuid(id) ? { id } : { number: id } });
    if (!payment) throw notFound("Supplier payment");
    if (payment.status === "CANCELLED") throw badRequest("The payment is already cancelled.");
    return prisma.$transaction(async (tx) => {
      const updated = await tx.supplierPayment.update({
        where: { id: payment.id },
        data: { status: "CANCELLED", remarks: appendNote(payment.remarks, historyEntry("CANCELLED", actorName, comments), 500) },
      });
      if (payment.status === "PAID") {
        await tx.supplier.update({ where: { id: payment.supplierId }, data: { balance: { increment: Number(payment.amount) } } });
      }
      return updated;
    });
  }

  // -------------------------------------------------------------
  // DASHBOARD & ANALYTICS METRICS
  // -------------------------------------------------------------
  public async getDashboardAnalytics(filters?: { fromDate?: string; toDate?: string; officeId?: string }): Promise<DashboardAnalytics> {
    const [allPos, reqs, payments, invoices, itemsCatalog, receipts] = await Promise.all([
      this.getPurchaseOrders(filters || {}),
      this.getRequisitions(filters || {}),
      this.getSupplierPayments({}),
      this.getSupplierInvoices({}),
      this.getItems(),
      db().goodsReceipt.findMany({ where: { status: { not: "CANCELLED" } }, select: { orderId: true, receiveDate: true } }),
    ]);
    // Cancelled orders are not spend.
    const pos = allPos.filter((p) => p.status !== "CANCELLED");

    const itemMap = new Map(itemsCatalog.map((i) => [i.id, i]));

    const totalRequisitions = reqs.length;
    const pendingApprovals = reqs.filter((r) => r.status === "PENDING_APPROVAL" || r.status === "SUBMITTED").length;
    const approvedRequisitions = reqs.filter((r) => r.status === "APPROVED").length;

    const openPurchaseOrders = pos.filter((p) => p.status === "APPROVED").length;
    const partiallyReceivedOrders = pos.filter((p) => p.status === "PARTIALLY_RECEIVED").length;
    const completedOrders = pos.filter((p) => p.status === "COMPLETED").length;

    const totalSpendAmount = round2(pos.reduce((sum, p) => sum + p.totalAmount, 0));
    const totalOutstandingAmount = round2(payments.reduce((sum, s) => sum + s.dueAmount, 0));
    const pendingSupplierInvoices = invoices.filter((i) => i.status !== "PAID").length;

    const typeMap: Record<string, { count: number; amount: number }> = {};
    for (const po of pos) {
      for (const it of po.items) {
        const cat = itemMap.get(it.itemId)?.category || "Uncategorised";
        if (!typeMap[cat]) typeMap[cat] = { count: 0, amount: 0 };
        typeMap[cat].count += it.orderedQuantity;
        typeMap[cat].amount += it.lineTotal;
      }
    }
    const typeWisePurchase = Object.entries(typeMap).map(([name, v]) => ({ name, value: v.count, amount: round2(v.amount) }));

    const whMap: Record<string, { amount: number; count: number }> = {};
    for (const po of pos) {
      const wh = po.warehouseName || "Warehouse";
      if (!whMap[wh]) whMap[wh] = { amount: 0, count: 0 };
      whMap[wh].amount += po.totalAmount;
      whMap[wh].count += 1;
    }
    const warehouseWisePurchase = Object.entries(whMap).map(([warehouse, v]) => ({ warehouse, amount: round2(v.amount), count: v.count }));

    const monthMap: Record<string, number> = {};
    for (const po of pos) {
      const m = po.orderDate.slice(0, 7);
      monthMap[m] = (monthMap[m] || 0) + po.totalAmount;
    }
    const monthlyExpenditure = Object.entries(monthMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, expenditure]) => ({ month, expenditure: round2(expenditure), budget: Math.round(expenditure * 1.1) }));

    const statusMap: Record<string, number> = {};
    for (const po of allPos) statusMap[po.status] = (statusMap[po.status] || 0) + 1;
    const poStatusDistribution = Object.entries(statusMap).map(([status, count]) => ({ status, count }));

    const supMap: Record<string, { totalSpend: number; poCount: number }> = {};
    for (const po of pos) {
      if (!supMap[po.supplierName]) supMap[po.supplierName] = { totalSpend: 0, poCount: 0 };
      supMap[po.supplierName].totalSpend += po.totalAmount;
      supMap[po.supplierName].poCount += 1;
    }
    const topSuppliers = Object.entries(supMap)
      .map(([supplier, v]) => ({ supplier, totalSpend: round2(v.totalSpend), poCount: v.poCount }))
      .sort((a, b) => b.totalSpend - a.totalSpend)
      .slice(0, 10);

    const itmMap: Record<string, { quantity: number; amount: number }> = {};
    for (const po of pos) {
      for (const it of po.items) {
        if (!itmMap[it.itemName]) itmMap[it.itemName] = { quantity: 0, amount: 0 };
        itmMap[it.itemName].quantity += it.orderedQuantity;
        itmMap[it.itemName].amount += it.lineTotal;
      }
    }
    const topPurchasedItems = Object.entries(itmMap)
      .map(([item, v]) => ({ item, quantity: round3(v.quantity), amount: round2(v.amount) }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 10);

    // Procurement cycle: order date to first goods receipt, averaged over received orders.
    const firstReceipt = new Map<string, number>();
    for (const r of receipts) {
      const t = r.receiveDate.getTime();
      if (!firstReceipt.has(r.orderId) || t < firstReceipt.get(r.orderId)!) firstReceipt.set(r.orderId, t);
    }
    const cycles = pos
      .filter((p) => firstReceipt.has(p.id))
      .map((p) => Math.max(0, (firstReceipt.get(p.id)! - new Date(`${p.orderDate}T00:00:00Z`).getTime()) / 86_400_000));
    const procurementCycleTimeDays = cycles.length ? Math.round((cycles.reduce((a, b) => a + b, 0) / cycles.length) * 10) / 10 : 0;

    const pendingApprovalItems = reqs
      .filter((r) => r.status === "PENDING_APPROVAL" || r.status === "SUBMITTED")
      .map((r) => ({
        id: r.id,
        type: "REQUISITION" as const,
        docNumber: r.requisitionNumber,
        date: r.requestDate,
        requester: r.requesterName,
        amount: r.totalEstimatedAmount,
        status: r.status,
      }));

    return {
      kpis: {
        totalRequisitions,
        pendingApprovals,
        approvedRequisitions,
        openPurchaseOrders,
        partiallyReceivedOrders,
        completedOrders,
        pendingSupplierInvoices,
        totalSpendAmount,
        totalOutstandingAmount,
      },
      typeWisePurchase,
      warehouseWisePurchase,
      monthlyExpenditure,
      poStatusDistribution,
      topSuppliers,
      topPurchasedItems,
      procurementCycleTimeDays,
      pendingApprovalItems,
      isSampleData: false,
    };
  }

  // -------------------------------------------------------------
  // REPORTS
  // -------------------------------------------------------------
  public async generateReport(query: ReportQuery): Promise<ReportResult> {
    const inRange = (date: string) => (!query.fromDate || date >= query.fromDate) && (!query.toDate || date <= query.toDate);
    const officeOk = (officeId: string) => !query.officeId || query.officeId === "ALL" || officeId === query.officeId;
    const supplierOk = (supplierId: string) => !query.supplierId || query.supplierId === "ALL" || supplierId === query.supplierId;
    const statusOk = (status: string) => !query.status || query.status === "ALL" || status === query.status;

    let columns: string[] = [];
    let rows: Record<string, string | number>[] = [];
    let summary: Record<string, string | number> = {};

    const groupSum = <T,>(list: T[], key: (t: T) => string, value: (t: T) => number, count: (t: T) => number = () => 1) => {
      const map = new Map<string, { amount: number; count: number }>();
      for (const t of list) {
        const k = key(t);
        const cur = map.get(k) ?? { amount: 0, count: 0 };
        cur.amount += value(t);
        cur.count += count(t);
        map.set(k, cur);
      }
      return [...map].sort((a, b) => b[1].amount - a[1].amount);
    };

    switch (query.reportType) {
      case "REQUISITION_REPORT": {
        const list = (await this.getRequisitions({})).filter((r) => inRange(r.requestDate) && officeOk(r.officeId) && statusOk(r.status));
        columns = ["SL", "Requisition No", "Date", "Required By", "Department", "Requested By", "Items", "Estimated Amount", "Status"];
        rows = list.map((r, i) => ({
          SL: i + 1,
          "Requisition No": r.requisitionNumber,
          Date: r.requestDate,
          "Required By": r.requiredDeliveryDate,
          Department: r.department,
          "Requested By": r.requesterName,
          Items: r.items.length,
          "Estimated Amount": r.totalEstimatedAmount,
          Status: r.status,
        }));
        summary = { "Total Requisitions": list.length, "Total Estimated": round2(list.reduce((s, r) => s + r.totalEstimatedAmount, 0)) };
        break;
      }
      case "GOODS_RECEIPT_REPORT": {
        const list = (await this.getGoodsReceipts({})).filter((g) => inRange(g.receiptDate) && officeOk(g.officeId) && supplierOk(g.supplierId) && statusOk(g.status));
        columns = ["SL", "GRN No", "Date", "PO No", "Supplier", "Warehouse", "Challan No", "Received Qty", "Rejected Qty", "Amount", "Status"];
        rows = list.map((g, i) => ({
          SL: i + 1,
          "GRN No": g.grnNumber,
          Date: g.receiptDate,
          "PO No": g.poNumber,
          Supplier: g.supplierName,
          Warehouse: g.warehouseName,
          "Challan No": g.shipmentDocumentNumber ?? "",
          "Received Qty": round3(g.items.reduce((s, it) => s + it.currentReceivedQuantity, 0)),
          "Rejected Qty": round3(g.items.reduce((s, it) => s + it.rejectedDamagedQuantity, 0)),
          Amount: g.totalReceivedAmount,
          Status: g.status,
        }));
        summary = { "Total Receipts": list.length, "Total Amount": round2(list.filter((g) => g.status !== "CANCELLED").reduce((s, g) => s + g.totalReceivedAmount, 0)) };
        break;
      }
      case "PURCHASE_RETURN_REPORT": {
        const list = (await this.getPurchaseReturns({})).filter((r) => inRange(r.returnDate) && officeOk(r.officeId) && supplierOk(r.supplierId) && statusOk(r.status));
        columns = ["SL", "Return No", "Date", "GRN No", "PO No", "Supplier", "Reason", "Amount", "Status"];
        rows = list.map((r, i) => ({
          SL: i + 1,
          "Return No": r.returnNumber,
          Date: r.returnDate,
          "GRN No": r.grnNumber,
          "PO No": r.poNumber,
          Supplier: r.supplierName,
          Reason: r.items[0]?.reason ?? "",
          Amount: r.totalReturnAmount,
          Status: r.status,
        }));
        summary = { "Total Returns": list.length, "Total Amount": round2(list.filter((r) => r.status !== "CANCELLED").reduce((s, r) => s + r.totalReturnAmount, 0)) };
        break;
      }
      case "SUPPLIER_PAYMENT_STATUS_REPORT": {
        const list = (await this.getSupplierPayments({})).filter((p) => supplierOk(p.supplierId) && statusOk(p.paymentStatus));
        columns = ["SL", "Supplier Code", "Supplier", "Category", "Purchased", "Returned", "Paid", "Due", "Open Invoices", "Status"];
        rows = list.map((p, i) => ({
          SL: i + 1,
          "Supplier Code": p.supplierCode,
          Supplier: p.supplierName,
          Category: p.category,
          Purchased: p.totalPurchasedAmount,
          Returned: p.returnedAmount,
          Paid: p.paidAmount,
          Due: p.dueAmount,
          "Open Invoices": p.openInvoicesCount,
          Status: p.paymentStatus,
        }));
        summary = { Suppliers: list.length, "Total Due": round2(list.reduce((s, p) => s + p.dueAmount, 0)), "Total Paid": round2(list.reduce((s, p) => s + p.paidAmount, 0)) };
        break;
      }
      case "SUPPLIER_PURCHASE_REPORT": {
        const pos = (await this.getPurchaseOrders({})).filter((p) => p.status !== "CANCELLED" && inRange(p.orderDate) && officeOk(p.officeId) && supplierOk(p.supplierId));
        columns = ["SL", "Supplier", "Orders", "Amount"];
        rows = groupSum(pos, (p) => p.supplierName, (p) => p.totalAmount).map(([supplier, v], i) => ({ SL: i + 1, Supplier: supplier, Orders: v.count, Amount: round2(v.amount) }));
        summary = { Suppliers: rows.length, "Total Amount": round2(pos.reduce((s, p) => s + p.totalAmount, 0)) };
        break;
      }
      case "ITEM_PURCHASE_REPORT": {
        const pos = (await this.getPurchaseOrders({})).filter((p) => p.status !== "CANCELLED" && inRange(p.orderDate) && officeOk(p.officeId) && supplierOk(p.supplierId));
        const lines = pos.flatMap((p) => p.items);
        const qty = new Map<string, { code: string; uom: string; ordered: number; received: number }>();
        for (const l of lines) {
          const cur = qty.get(l.itemName) ?? { code: l.itemCode, uom: l.uom, ordered: 0, received: 0 };
          cur.ordered += l.orderedQuantity;
          cur.received += l.receivedQuantity;
          qty.set(l.itemName, cur);
        }
        columns = ["SL", "Item Code", "Item", "UoM", "Ordered Qty", "Received Qty", "Amount"];
        rows = groupSum(lines, (l) => l.itemName, (l) => l.lineTotal).map(([item, v], i) => {
          const q = qty.get(item)!;
          return { SL: i + 1, "Item Code": q.code, Item: item, UoM: q.uom, "Ordered Qty": round3(q.ordered), "Received Qty": round3(q.received), Amount: round2(v.amount) };
        });
        summary = { Items: rows.length, "Total Amount": round2(lines.reduce((s, l) => s + l.lineTotal, 0)) };
        break;
      }
      case "OFFICE_WAREHOUSE_PURCHASE_REPORT": {
        const pos = (await this.getPurchaseOrders({})).filter((p) => p.status !== "CANCELLED" && inRange(p.orderDate) && officeOk(p.officeId) && supplierOk(p.supplierId));
        columns = ["SL", "Office", "Warehouse", "Orders", "Amount"];
        rows = groupSum(pos, (p) => `${p.officeName}\u0000${p.warehouseName}`, (p) => p.totalAmount).map(([key, v], i) => {
          const [office, warehouse] = key.split("\u0000");
          return { SL: i + 1, Office: office, Warehouse: warehouse, Orders: v.count, Amount: round2(v.amount) };
        });
        summary = { Locations: rows.length, "Total Amount": round2(pos.reduce((s, p) => s + p.totalAmount, 0)) };
        break;
      }
      case "EXPENDITURE_SUMMARY_REPORT": {
        const [pos, receipts, returns] = await Promise.all([this.getPurchaseOrders({}), this.getGoodsReceipts({}), this.getPurchaseReturns({})]);
        const month = (d: string) => d.slice(0, 7);
        const months = new Map<string, { ordered: number; received: number; returned: number }>();
        const bump = (m: string, k: "ordered" | "received" | "returned", v: number) => {
          const cur = months.get(m) ?? { ordered: 0, received: 0, returned: 0 };
          cur[k] += v;
          months.set(m, cur);
        };
        for (const p of pos) if (p.status !== "CANCELLED" && inRange(p.orderDate) && officeOk(p.officeId) && supplierOk(p.supplierId)) bump(month(p.orderDate), "ordered", p.totalAmount);
        for (const g of receipts) if (g.status !== "CANCELLED" && inRange(g.receiptDate) && officeOk(g.officeId) && supplierOk(g.supplierId)) bump(month(g.receiptDate), "received", g.totalReceivedAmount);
        for (const r of returns) if (r.status !== "CANCELLED" && inRange(r.returnDate) && officeOk(r.officeId) && supplierOk(r.supplierId)) bump(month(r.returnDate), "returned", r.totalReturnAmount);
        columns = ["SL", "Month", "Ordered", "Received", "Returned", "Net Purchase"];
        rows = [...months]
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([m, v], i) => ({ SL: i + 1, Month: m, Ordered: round2(v.ordered), Received: round2(v.received), Returned: round2(v.returned), "Net Purchase": round2(v.received - v.returned) }));
        summary = {
          "Total Ordered": round2(rows.reduce((s, r) => s + Number(r.Ordered), 0)),
          "Net Purchase": round2(rows.reduce((s, r) => s + Number(r["Net Purchase"]), 0)),
        };
        break;
      }
      case "PURCHASE_ORDER_REPORT":
      default: {
        const list = (await this.getPurchaseOrders({})).filter((p) => inRange(p.orderDate) && officeOk(p.officeId) && supplierOk(p.supplierId) && statusOk(p.status));
        columns = ["SL", "PO Number", "Date", "Requisition No", "Supplier", "Office", "Warehouse", "Subtotal", "Discount", "VAT", "Total Amount", "Status"];
        rows = list.map((p, i) => ({
          SL: i + 1,
          "PO Number": p.poNumber,
          Date: p.orderDate,
          "Requisition No": p.requisitionNumber ?? "",
          Supplier: p.supplierName,
          Office: p.officeName,
          Warehouse: p.warehouseName,
          Subtotal: p.subtotal,
          Discount: p.totalDiscount,
          VAT: p.totalTax,
          "Total Amount": p.totalAmount,
          Status: p.status,
        }));
        summary = { "Total Orders": list.length, "Total Amount": round2(list.filter((p) => p.status !== "CANCELLED").reduce((s, p) => s + p.totalAmount, 0)) };
      }
    }

    return {
      reportType: query.reportType,
      generatedAt: new Date().toISOString(),
      filtersApplied: query as unknown as Record<string, string>,
      columns,
      rows,
      summary,
      totalRecords: rows.length,
    };
  }
}

export const purchaseStore = new PurchaseDataStore();
