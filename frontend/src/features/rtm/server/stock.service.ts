import { z } from "zod";
import { badRequest, notFound } from "@/lib/api/errors";
import type { Actor } from "@/lib/auth/actor";
import { decideWithPipeline } from "@/lib/approval/engine";
import { db } from "@/lib/prisma/client";
import ExcelJS from "exceljs";
import { loadWorkbook } from "@/lib/excel/load-workbook";
import { DATE, actorName, dateRange, distributorStock, documentNumber, fromDbDate, num, postDistributorStock, r2, r3, requireDistributor, requireItems, toDbDate, unitIds, type Client, type Tx } from "./common";

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

/**
 * What the transfer form picks items from: the item category tree (Category ›
 * Sub Category › Minor Category), and each active item with its category path,
 * dealer price on `date` (the latest Standard Price, else the item's own) and the
 * sending distributor's current stock.
 */
export async function transferItemOptions(actor: Actor, f: { distributorId?: string; date?: string } = {}) {
  const units = f.distributorId ? [(await requireDistributor(actor, f.distributorId)).businessUnitId] : await unitIds(actor);
  const day = toDbDate(f.date && DATE.test(f.date) ? f.date : new Date().toISOString().slice(0, 10));
  const [categories, items, stock] = await Promise.all([
    db().itemCategory.findMany({ where: { businessUnitId: { in: units } }, select: { id: true, name: true, level: true, parentId: true }, orderBy: { name: "asc" } }),
    db().item.findMany({ where: { businessUnitId: { in: units }, isActive: true }, select: { id: true, code: true, name: true, uom: true, categoryId: true, dealerPrice: true }, orderBy: { name: "asc" } }),
    f.distributorId ? distributorStock(db(), f.distributorId) : Promise.resolve(new Map<string, number>()),
  ]);
  const prices = await db().standardPrice.findMany({
    where: { itemId: { in: items.map((i) => i.id) }, effectiveFrom: { lte: day }, dealerPrice: { not: null } },
    select: { itemId: true, dealerPrice: true },
    orderBy: { effectiveFrom: "desc" },
  });
  const dealer = new Map<string, number>();
  for (const p of prices) if (!dealer.has(p.itemId)) dealer.set(p.itemId, num(p.dealerPrice));
  const parent = new Map(categories.map((c) => [c.id, c.parentId]));
  const path = (id: string | null) => {
    const out: string[] = [];
    for (let c = id; c && !out.includes(c); c = parent.get(c) ?? null) out.unshift(c);
    return out;
  };
  return {
    categories,
    items: items.map((i) => ({
      id: i.id,
      code: i.code,
      name: i.name,
      uom: i.uom,
      categoryPath: path(i.categoryId),
      dealerPrice: dealer.get(i.id) ?? (i.dealerPrice === null ? null : num(i.dealerPrice)),
      stock: stock.get(i.id) ?? 0,
    })),
  };
}

const transferSchema = z.object({
  requestDate: z.string().regex(DATE),
  fromDistributorId: z.guid("Select the distributor that sends the stock."),
  toDistributorId: z.guid("Select the distributor that receives the stock."),
  remarks: text(500),
  lines: z.array(z.object({ itemId: z.guid(), qty: z.coerce.number().finite().positive("Quantities must be greater than 0.") })).min(1, "Add at least one item.").max(200),
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

const issueSchema = z.object({ lines: z.array(z.object({ lineId: z.guid(), qty: z.coerce.number().finite().min(0) })).min(1) });

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

const YEAR_MONTH = z.object({ year: z.coerce.number().int().min(2000).max(2100), month: z.coerce.number().int().min(1).max(12) });

/** The date an adjustment for a year and month is booked on: today in the current month, else the month's last day. */
function monthDate(year: number, month: number) {
  const now = new Date().toISOString().slice(0, 10);
  const ym = `${year}-${String(month).padStart(2, "0")}`;
  if (ym > now.slice(0, 7)) throw badRequest("Stock cannot be adjusted for a future month.");
  if (ym === now.slice(0, 7)) return now;
  return new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
}

/** Dealer price of each item on `day`: the latest Standard Price, else the item's own dealer price, else its sales rate. */
async function dealerPrices(client: Client, itemIds: string[], day: Date) {
  const [standard, items] = await Promise.all([
    client.standardPrice.findMany({ where: { itemId: { in: itemIds }, effectiveFrom: { lte: day }, dealerPrice: { not: null } }, select: { itemId: true, dealerPrice: true }, orderBy: { effectiveFrom: "desc" } }),
    client.item.findMany({ where: { id: { in: itemIds } }, select: { id: true, dealerPrice: true, salesRate: true } }),
  ]);
  const price = new Map<string, number>();
  for (const p of standard) if (!price.has(p.itemId)) price.set(p.itemId, num(p.dealerPrice));
  for (const i of items) if (!price.has(i.id)) price.set(i.id, i.dealerPrice === null ? num(i.salesRate) : num(i.dealerPrice));
  return price;
}

const adjustmentSchema = z.object({
  adjustDate: z.string().regex(DATE).optional(),
  year: z.coerce.number().int().optional(),
  month: z.coerce.number().int().optional(),
  distributorId: z.guid("Select the distributor."),
  reason: z.enum(ADJUSTMENT_REASONS),
  remarks: text(500),
  lines: z
    .array(z.object({ itemId: z.guid(), qty: z.coerce.number().finite().refine((q) => q !== 0, "Quantity cannot be 0.") }))
    .min(1, "Add at least one item.")
    .max(500),
});

export async function listAdjustments(actor: Actor, f: { from?: string; to?: string; distributorId?: string; year?: string; month?: string } = {}) {
  const units = await unitIds(actor);
  const year = f.year && /^\d{4}$/.test(f.year) ? Number(f.year) : undefined;
  const month = f.month && /^\d{1,2}$/.test(f.month) ? Number(f.month) : undefined;
  const period = year
    ? month
      ? { gte: new Date(Date.UTC(year, month - 1, 1)), lt: new Date(Date.UTC(year, month, 1)) }
      : { gte: new Date(Date.UTC(year, 0, 1)), lt: new Date(Date.UTC(year + 1, 0, 1)) }
    : f.from || f.to
      ? dateRange(f.from, f.to)
      : undefined;
  const rows = await db().rtmStockAdjustment.findMany({
    where: { businessUnitId: { in: units }, ...(period ? { adjustDate: period } : {}), ...(f.distributorId ? { distributorId: f.distributorId } : {}) },
    include: { distributor: { select: { code: true, name: true } }, lines: { orderBy: { lineNo: "asc" }, include: { item: { select: { code: true, name: true, uom: true, dealerPrice: true, salesRate: true } } } } },
    orderBy: [{ adjustDate: "desc" }, { createdAt: "desc" }],
    take: 2000,
  });
  return rows.map((a) => {
    const lines = a.lines.map((l) => {
      const rate = l.rate !== null ? num(l.rate) : l.item.dealerPrice !== null ? num(l.item.dealerPrice) : num(l.item.salesRate);
      return { itemId: l.itemId, itemCode: l.item.code, itemName: l.item.name, uom: l.item.uom, qty: num(l.qty), rate, value: r2(num(l.qty) * rate) };
    });
    const date = fromDbDate(a.adjustDate);
    return {
      id: a.id,
      number: a.number,
      adjustDate: date,
      year: Number(date.slice(0, 4)),
      month: Number(date.slice(5, 7)),
      distributorId: a.distributorId,
      distributorCode: a.distributor.code,
      distributor: a.distributor.name,
      reason: a.reason,
      remarks: a.remarks,
      status: a.status,
      createdBy: a.createdBy,
      approvedBy: a.approvedBy,
      rolledBackBy: a.rolledBackBy,
      rolledBackAt: a.rolledBackAt?.toISOString() ?? null,
      netValue: r2(lines.reduce((t, l) => t + l.value, 0)),
      lines,
      updatedAt: a.createdAt.toISOString(),
    };
  });
}

async function saveAdjustment(tx: Tx, actor: Actor, d: { businessUnitId: string; distributorId: string; date: string; reason: string; remarks?: string | null; lines: { itemId: string; qty: number }[] }) {
  await requireItems(tx, d.businessUnitId, d.lines.map((l) => l.itemId));
  const day = toDbDate(d.date);
  const price = await dealerPrices(tx, d.lines.map((l) => l.itemId), day);
  return tx.rtmStockAdjustment.create({
    data: {
      businessUnitId: d.businessUnitId,
      number: await documentNumber(tx, d.businessUnitId, "ADJUSTMENT", d.date),
      adjustDate: day,
      distributorId: d.distributorId,
      reason: d.reason,
      remarks: d.remarks ?? null,
      createdBy: actorName(actor),
      lines: { create: d.lines.map((l, i) => ({ lineNo: i + 1, itemId: l.itemId, qty: r3(l.qty), rate: price.get(l.itemId) ?? 0 })) },
    },
  });
}

/** One adjustment (PENDING until approved). Booked on `adjustDate`, or on the chosen year and month. */
export async function createAdjustment(actor: Actor, raw: unknown) {
  const input = adjustmentSchema.parse(raw);
  const date = input.adjustDate ?? (() => {
    const ym = YEAR_MONTH.safeParse(input);
    if (!ym.success) throw badRequest("Choose the year and month.");
    return monthDate(ym.data.year, ym.data.month);
  })();
  const distributor = await requireDistributor(actor, input.distributorId);
  await db().$transaction((tx) => saveAdjustment(tx, actor, { businessUnitId: distributor.businessUnitId, distributorId: distributor.id, date, reason: input.reason, remarks: input.remarks, lines: input.lines }));
  return listAdjustments(actor);
}

/** Reverses an approved adjustment: the opposite stock entries are posted and it shows as rolled back (CANCELLED). */
export async function rollbackAdjustment(actor: Actor, id: string) {
  const units = await unitIds(actor);
  const a = await db().rtmStockAdjustment.findFirst({ where: { id, businessUnitId: { in: units } }, include: { lines: { include: { item: { select: { name: true } } } } } });
  if (!a) throw notFound("Adjustment");
  if (a.status !== "COMPLETED") throw badRequest(`Only approved adjustments can be rolled back; ${a.number} is ${a.status === "CANCELLED" ? "already rolled back" : a.status.toLowerCase()}.`);
  await db().$transaction(async (tx) => {
    // Guard against a second rollback running at the same time.
    const claimed = await tx.rtmStockAdjustment.updateMany({ where: { id, status: "COMPLETED" }, data: { status: "CANCELLED", rolledBackBy: actorName(actor), rolledBackAt: new Date() } });
    if (claimed.count !== 1) throw badRequest(`${a.number} was already rolled back.`);
    await postDistributorStock(
      tx,
      {
        businessUnitId: a.businessUnitId,
        distributorId: a.distributorId,
        source: "ADJUSTMENT",
        sourceId: a.id,
        date: toDbDate(new Date().toISOString().slice(0, 10)),
        remarks: `${a.number} · Rollback`,
        createdBy: actorName(actor),
      },
      a.lines.map((l) => ({ itemId: l.itemId, qty: -num(l.qty) })),
      new Map(a.lines.map((l) => [l.itemId, l.item.name])),
    );
  });
  return listAdjustments(actor);
}

/** Distributors with the Sales Territory node of their territory (for the layer filters). */
export async function adjustmentOptions(actor: Actor) {
  const units = await unitIds(actor);
  const distributors = await db().customer.findMany({
    where: { businessUnitId: { in: units }, customerType: "DISTRIBUTOR", isActive: true },
    select: { id: true, code: true, name: true, territory: { select: { territoryNode: { select: { id: true } } } } },
    orderBy: { name: "asc" },
  });
  return { distributors: distributors.map((d) => ({ id: d.id, code: d.code, name: d.name, territoryNodeId: d.territory?.territoryNode?.id ?? null })) };
}

// ── Bulk adjustment (Excel) ──────────────────────────────────────────────────

const BULK_HEADERS = ["Distributor Code", "Item Code", "Counted Qty"] as const;

/** The upload template: one row per distributor and item with the counted (physical) quantity. */
export async function adjustmentTemplate(actor: Actor) {
  const units = await unitIds(actor);
  const book = new ExcelJS.Workbook();
  const sheet = book.addWorksheet("Stock count");
  sheet.addRow([...BULK_HEADERS]).eachCell((c) => {
    c.font = { bold: true };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDBEAFE" } };
  });
  sheet.columns = [{ width: 20 }, { width: 20 }, { width: 14 }];
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  const [distributors, items] = await Promise.all([
    db().customer.findMany({ where: { businessUnitId: { in: units }, customerType: "DISTRIBUTOR", isActive: true }, select: { code: true, name: true }, orderBy: { code: "asc" } }),
    db().item.findMany({ where: { businessUnitId: { in: units }, isActive: true }, select: { code: true, name: true, uom: true }, orderBy: { code: "asc" } }),
  ]);
  const ref = book.addWorksheet("Codes");
  ref.addRow(["Distributor Code", "Distributor", "", "Item Code", "Item", "UoM"]).font = { bold: true };
  for (let i = 0; i < Math.max(distributors.length, items.length); i++) {
    const d = distributors[i];
    const it = items[i];
    ref.addRow([d?.code ?? "", d?.name ?? "", "", it?.code ?? "", it?.name ?? "", it?.uom ?? ""]);
  }
  return new Uint8Array(await book.xlsx.writeBuffer());
}

const bulkSchema = YEAR_MONTH.extend({ reason: z.enum(ADJUSTMENT_REASONS).default("Physical count"), remarks: text(500) });

/**
 * Reads a counted-stock sheet and raises one adjustment per distributor for the
 * difference from its current stock (items already right are skipped). Every
 * row is checked first; nothing is saved when any row is wrong.
 */
export async function bulkAdjust(actor: Actor, bytes: Uint8Array, raw: unknown) {
  const input = bulkSchema.parse(raw);
  const date = monthDate(input.year, input.month);
  const units = await unitIds(actor);
  const book = await loadWorkbook(bytes);
  const sheet = book.worksheets[0];
  if (!sheet) throw badRequest("The workbook has no sheet.");
  const head = (sheet.getRow(1).values as unknown[]).slice(1).map((v) => String(v ?? "").trim().toLowerCase());
  const col = BULK_HEADERS.map((h) => head.indexOf(h.toLowerCase()) + 1);
  if (col.some((c) => c === 0)) throw badRequest(`The first row must have the columns ${BULK_HEADERS.join(", ")}.`);
  const cell = (row: ExcelJS.Row, c: number) => {
    const v = row.getCell(c).value;
    return v && typeof v === "object" && "result" in v ? v.result : v;
  };
  const raws: { line: number; distributor: string; item: string; counted: number }[] = [];
  const errors: string[] = [];
  sheet.eachRow((row, n) => {
    if (n === 1) return;
    const distributor = String(cell(row, col[0]) ?? "").trim();
    const item = String(cell(row, col[1]) ?? "").trim();
    const countedRaw = cell(row, col[2]);
    if (!distributor && !item && (countedRaw === null || countedRaw === undefined || countedRaw === "")) return;
    const counted = Number(countedRaw);
    if (!distributor || !item) errors.push(`Row ${n}: distributor code and item code are required.`);
    else if (!Number.isFinite(counted) || counted < 0) errors.push(`Row ${n}: counted qty must be 0 or more.`);
    else raws.push({ line: n, distributor, item, counted });
  });
  if (!raws.length && !errors.length) throw badRequest("The sheet has no rows.");
  if (raws.length > 10_000) throw badRequest("Upload at most 10,000 rows at a time.");
  const [distributors, items] = await Promise.all([
    db().customer.findMany({ where: { businessUnitId: { in: units }, customerType: "DISTRIBUTOR", code: { in: [...new Set(raws.map((r) => r.distributor))] } }, select: { id: true, code: true, businessUnitId: true } }),
    db().item.findMany({ where: { businessUnitId: { in: units }, code: { in: [...new Set(raws.map((r) => r.item))] } }, select: { id: true, code: true, businessUnitId: true } }),
  ]);
  const dByCode = new Map(distributors.map((d) => [d.code.toLowerCase(), d]));
  const iByCode = new Map<string, typeof items>();
  for (const i of items) iByCode.set(i.code.toLowerCase(), [...(iByCode.get(i.code.toLowerCase()) ?? []), i]);
  const perDistributor = new Map<string, { d: (typeof distributors)[number]; counted: Map<string, number> }>();
  const seen = new Set<string>();
  for (const r of raws) {
    const d = dByCode.get(r.distributor.toLowerCase());
    const item = iByCode.get(r.item.toLowerCase())?.find((i) => i.businessUnitId === d?.businessUnitId);
    if (!d) errors.push(`Row ${r.line}: no distributor with code ${r.distributor}.`);
    else if (!item) errors.push(`Row ${r.line}: no item ${r.item} in ${r.distributor}'s business unit.`);
    else if (seen.has(`${d.id}:${item.id}`)) errors.push(`Row ${r.line}: ${r.distributor} / ${r.item} appears twice.`);
    else {
      seen.add(`${d.id}:${item.id}`);
      const entry = perDistributor.get(d.id) ?? { d, counted: new Map<string, number>() };
      entry.counted.set(item.id, r.counted);
      perDistributor.set(d.id, entry);
    }
  }
  if (errors.length) throw badRequest(`${errors.length} row(s) need fixing: ${errors.slice(0, 8).join(" ")}${errors.length > 8 ? " …" : ""}`);
  let created = 0;
  let skipped = 0;
  await db().$transaction(
    async (tx) => {
      for (const { d, counted } of perDistributor.values()) {
        const stock = await distributorStock(tx, d.id, [...counted.keys()]);
        const lines = [...counted].map(([itemId, c]) => ({ itemId, qty: r3(c - (stock.get(itemId) ?? 0)) })).filter((l) => Math.abs(l.qty) > 1e-9);
        skipped += counted.size - lines.length;
        if (!lines.length) continue;
        for (let i = 0; i < lines.length; i += 500) {
          await saveAdjustment(tx, actor, { businessUnitId: d.businessUnitId, distributorId: d.id, date, reason: input.reason, remarks: input.remarks ?? "Bulk adjustment", lines: lines.slice(i, i + 500) });
          created++;
        }
      }
    },
    { timeout: 60_000 },
  );
  return { created, distributors: perDistributor.size, unchanged: skipped };
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
