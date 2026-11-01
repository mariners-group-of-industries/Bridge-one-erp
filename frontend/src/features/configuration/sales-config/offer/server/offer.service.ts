import ExcelJS from "exceljs";
import { cellText, parseFlag } from "@/features/configuration/entity-master-data/supplier/server/supplier-excel";
import type { Prisma } from "@/generated/prisma/client";
import { AppError, badRequest, notFound } from "@/lib/api/errors";
import { assertCompanyAccess, type Actor } from "@/lib/auth/actor";
import { db } from "@/lib/prisma/client";
import {
  DISCOUNT_TYPES,
  discountLineSchema,
  OFFER_BASED_ON,
  offerInputSchema,
  type OfferData,
  type OfferDto,
  type OfferInput,
  type OfferKind,
  type OfferList,
  type OfferListQuery,
  type OfferOptions,
  type ParsedDiscountLines,
} from "../schemas/offer.schema";

type Tx = Prisma.TransactionClient;

// ─── Scoping & helpers ────────────────────────────────────────────────────────

function unitScope(actor: Actor): Prisma.BusinessUnitWhereInput {
  return actor.companyScope === "ALL" ? {} : { companyId: { in: [...actor.companyScope] } };
}

async function loadUnit(actor: Actor, businessUnitId: string) {
  const unit = await db().businessUnit.findUnique({ where: { id: businessUnitId }, select: { id: true, companyId: true } });
  if (!unit) throw notFound("Business unit");
  assertCompanyAccess(actor, unit.companyId, "Business unit");
  return unit;
}

async function loadOffer(actor: Actor, id: string) {
  const offer = await db().salesOffer.findFirst({ where: { id, businessUnit: unitScope(actor) } });
  if (!offer) throw notFound("Offer");
  return offer;
}

const orNull = (value: string) => (value === "" ? null : value);
const str = (value: unknown) => (value === null || value === undefined ? "" : String(value));
const toDate = (value: string) => (value ? new Date(`${value}T00:00:00.000Z`) : null);
const dateOnly = (value: Date | null) => (value ? value.toISOString().slice(0, 10) : "");
const escapeLike = (value: string) => value.replace(/[\\%_]/g, (char) => `\\${char}`);

/** Category chain → ids by level (1 = category, 2 = sub, 3 = minor). */
async function chainOf(categoryId: string | null) {
  const levels: Record<number, string> = {};
  let id = categoryId;
  while (id) {
    const category = await db().itemCategory.findUnique({ where: { id }, select: { id: true, level: true, parentId: true } });
    if (!category) break;
    levels[category.level] = category.id;
    id = category.parentId;
  }
  return levels;
}

// ─── References ───────────────────────────────────────────────────────────────

async function validateReferences(tx: Tx, unitId: string, data: OfferData) {
  const inUnit = async (ids: string[], find: (ids: string[]) => Promise<{ id: string; businessUnitId: string }[]>, label: string) => {
    const unique = [...new Set(ids.filter(Boolean))];
    if (unique.length === 0) return;
    const found = await find(unique);
    if (found.length !== unique.length || found.some((row) => row.businessUnitId !== unitId)) {
      throw badRequest(`Select ${label} of this business unit.`);
    }
  };
  const select = { id: true, businessUnitId: true } as const;
  const groups = (ids: string[]) => tx.customerGroup.findMany({ where: { id: { in: ids } }, select });
  const items = (ids: string[]) => tx.item.findMany({ where: { id: { in: ids } }, select });
  const suppliers = (ids: string[]) => tx.supplier.findMany({ where: { id: { in: ids } }, select });

  if ("customerGroupId" in data) await inUnit([data.customerGroupId], groups, "a customer group");
  if ("priceListId" in data) await inUnit([data.priceListId], (ids) => tx.priceList.findMany({ where: { id: { in: ids } }, select }), "a price type");

  if ("categoryId" in data) {
    const check = async (id: string, level: number, parentId: string | null, label: string) => {
      if (!id) return;
      const category = await tx.itemCategory.findUnique({ where: { id } });
      if (!category || category.businessUnitId !== unitId || category.level !== level || (category.parentId ?? null) !== parentId) {
        throw badRequest(`Select a valid ${label}.`);
      }
    };
    if (data.subCategoryId && !data.categoryId) throw badRequest("Select a category first.");
    if (data.minorCategoryId && !data.subCategoryId) throw badRequest("Select a sub category first.");
    await check(data.categoryId, 1, null, "category");
    await check(data.subCategoryId, 2, data.categoryId || null, "sub category");
    await check(data.minorCategoryId, 3, data.subCategoryId || null, "minor category");
  }

  switch (data.kind) {
    case "ITEM":
      await inUnit(data.lines.flatMap((l) => [l.sellingItemId, l.offerItemId]), items, "items");
      break;
    case "ITEM_MULTIPLE":
      await inUnit([...data.pairs.map((p) => p.itemId), ...data.pairs.flatMap((p) => p.bonusLines.map((l) => l.itemId))], items, "items");
      await inUnit(
        data.pairs.map((p) => p.categoryId),
        (ids) => tx.itemCategory.findMany({ where: { id: { in: ids } }, select }),
        "categories",
      );
      break;
    case "DISCOUNT":
      await inUnit(data.lines.map((l) => l.itemId), items, "items");
      await inUnit(data.lines.map((l) => l.supplierId), suppliers, "suppliers");
      if (new Set(data.lines.map((l) => l.itemId)).size !== data.lines.length) throw badRequest("Each item can appear only once in a discount offer.");
      break;
    case "SPECIAL_DISCOUNT":
      await inUnit(data.lines.map((l) => l.customerGroupId), groups, "customer groups");
      await inUnit(data.lines.map((l) => l.supplierId), suppliers, "suppliers");
      break;
  }
}

/** Header columns of the offer row. */
function headerColumns(data: OfferData) {
  const base = {
    name: data.name,
    fromDate: toDate(data.fromDate),
    toDate: toDate(data.toDate),
    customerGroupId: null as string | null,
    priceListId: null as string | null,
    basedOn: null as string | null,
    categoryId: null as string | null,
    remarks: null as string | null,
  };
  if ("customerGroupId" in data) base.customerGroupId = orNull(data.customerGroupId);
  if ("priceListId" in data) base.priceListId = orNull(data.priceListId);
  if ("basedOn" in data) base.basedOn = orNull(data.basedOn);
  if ("categoryId" in data) base.categoryId = orNull(data.minorCategoryId || data.subCategoryId || data.categoryId);
  if ("remarks" in data) base.remarks = orNull(data.remarks);
  return base;
}

async function writeLines(tx: Tx, offerId: string, data: OfferData) {
  await Promise.all([
    tx.salesOfferItemLine.deleteMany({ where: { offerId } }),
    tx.salesOfferPairLine.deleteMany({ where: { offerId } }),
    tx.salesOfferBonusLine.deleteMany({ where: { offerId } }),
    tx.salesOfferDiscountLine.deleteMany({ where: { offerId } }),
    tx.salesOfferSpecialLine.deleteMany({ where: { offerId } }),
  ]);
  switch (data.kind) {
    case "ITEM":
      await tx.salesOfferItemLine.createMany({ data: data.lines.map((line, sortOrder) => ({ offerId, sortOrder, ...line })) });
      break;
    case "ITEM_MULTIPLE":
      // Pair n: one selling condition and its bonus lines, all with pairNo n.
      await tx.salesOfferPairLine.createMany({
        data: data.pairs.map((pair, index) => ({
          offerId,
          sortOrder: index,
          pairNo: index + 1,
          categoryId: orNull(pair.categoryId),
          itemId: orNull(pair.itemId),
          quantity: pair.quantity,
          minQty: orNull(pair.minQty),
          maxQty: orNull(pair.maxQty),
        })),
      });
      await tx.salesOfferBonusLine.createMany({
        data: data.pairs.flatMap((pair, index) => pair.bonusLines.map((line, sortOrder) => ({ offerId, sortOrder, pairNo: index + 1, ...line }))),
      });
      break;
    case "DISCOUNT":
      await tx.salesOfferDiscountLine.createMany({
        data: data.lines.map((line, sortOrder) => ({
          offerId,
          sortOrder,
          itemId: line.itemId,
          discountType: line.discountType,
          amount: line.amount,
          quantity: orNull(line.quantity),
          minQty: orNull(line.minQty),
          maxQty: orNull(line.maxQty),
          isRecurrent: line.isRecurrent,
          supplierId: orNull(line.supplierId),
          supplierContribution: orNull(line.supplierContribution),
          internalContribution: orNull(line.internalContribution),
        })),
      });
      break;
    case "SPECIAL_DISCOUNT":
      await tx.salesOfferSpecialLine.createMany({
        data: data.lines.map((line, sortOrder) => ({
          offerId,
          sortOrder,
          customerGroupId: orNull(line.customerGroupId),
          discountType: line.discountType,
          amount: line.amount,
          fromAmount: orNull(line.fromAmount),
          toAmount: orNull(line.toAmount),
          supplierId: orNull(line.supplierId),
          supplierContribution: orNull(line.supplierContribution),
          internalContribution: orNull(line.internalContribution),
          vatOnDiscounted: line.vatOnDiscounted,
        })),
      });
      break;
  }
}

// ─── Queries ──────────────────────────────────────────────────────────────────

export async function listOffers(actor: Actor, query: OfferListQuery): Promise<OfferList> {
  const where: Prisma.SalesOfferWhereInput = {
    businessUnit: unitScope(actor),
    kind: query.kind,
    ...(query.search ? { name: { contains: escapeLike(query.search), mode: "insensitive" as const } } : {}),
    ...(query.status ? { isActive: query.status === "active" } : {}),
  };
  const [total, records] = await Promise.all([
    db().salesOffer.count({ where }),
    db().salesOffer.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      include: {
        customerGroup: { select: { name: true } },
        priceList: { select: { name: true } },
        _count: { select: { itemLines: true, pairLines: true, discountLines: true, specialLines: true } },
      },
    }),
  ]);
  return {
    rows: records.map((record) => ({
      id: record.id,
      kind: record.kind as OfferKind,
      name: record.name,
      fromDate: record.fromDate ? dateOnly(record.fromDate) : null,
      toDate: record.toDate ? dateOnly(record.toDate) : null,
      customerGroupName: record.customerGroup?.name ?? null,
      priceListName: record.priceList?.name ?? null,
      basedOn: record.basedOn,
      lineCount: record._count.itemLines + record._count.pairLines + record._count.discountLines + record._count.specialLines,
      isActive: record.isActive,
    })),
    total,
    page: query.page,
    pageSize: query.pageSize,
  };
}

export async function getOffer(actor: Actor, id: string): Promise<OfferDto> {
  const offer = await db().salesOffer.findFirst({
    where: { id, businessUnit: unitScope(actor) },
    include: {
      itemLines: { orderBy: { sortOrder: "asc" } },
      pairLines: { orderBy: { sortOrder: "asc" } },
      bonusLines: { orderBy: { sortOrder: "asc" } },
      discountLines: { orderBy: { sortOrder: "asc" } },
      specialLines: { orderBy: { sortOrder: "asc" } },
    },
  });
  if (!offer) throw notFound("Offer");
  const common = { id: offer.id, isActive: offer.isActive, businessUnitId: offer.businessUnitId, name: offer.name, fromDate: dateOnly(offer.fromDate), toDate: dateOnly(offer.toDate) };
  const chain = await chainOf(offer.categoryId);
  const trio = { categoryId: chain[1] ?? "", subCategoryId: chain[2] ?? "", minorCategoryId: chain[3] ?? "" };

  switch (offer.kind as OfferKind) {
    case "ITEM":
      return {
        ...common,
        kind: "ITEM",
        customerGroupId: str(offer.customerGroupId),
        ...trio,
        lines: offer.itemLines.map((line) => ({
          sellingItemId: line.sellingItemId,
          sellingUom: line.sellingUom,
          sellingQty: line.sellingQty.toString(),
          offerItemId: line.offerItemId,
          offerUom: line.offerUom,
          offerQty: line.offerQty.toString(),
        })),
      };
    case "ITEM_MULTIPLE":
      return {
        ...common,
        kind: "ITEM_MULTIPLE",
        priceListId: str(offer.priceListId),
        basedOn: (offer.basedOn ?? "All Customers") as (typeof OFFER_BASED_ON)[number],
        pairs: offer.pairLines
          .toSorted((a, b) => a.pairNo - b.pairNo || a.sortOrder - b.sortOrder)
          .map((line) => ({
            categoryId: str(line.categoryId),
            itemId: str(line.itemId),
            quantity: line.quantity.toString(),
            minQty: str(line.minQty),
            maxQty: str(line.maxQty),
            bonusLines: offer.bonusLines
              .filter((bonus) => bonus.pairNo === line.pairNo)
              .map((bonus) => ({ itemId: bonus.itemId, quantity: bonus.quantity.toString() })),
          })),
      };
    case "DISCOUNT":
      return {
        ...common,
        kind: "DISCOUNT",
        basedOn: (offer.basedOn ?? "") as "",
        customerGroupId: str(offer.customerGroupId),
        priceListId: str(offer.priceListId),
        ...trio,
        lines: offer.discountLines.map((line) => ({
          itemId: line.itemId,
          discountType: line.discountType as "PERCENT" | "FLAT",
          amount: line.amount.toString(),
          quantity: str(line.quantity),
          minQty: str(line.minQty),
          maxQty: str(line.maxQty),
          isRecurrent: line.isRecurrent,
          supplierId: str(line.supplierId),
          supplierContribution: str(line.supplierContribution),
          internalContribution: str(line.internalContribution),
        })),
      };
    default:
      return {
        ...common,
        kind: "SPECIAL_DISCOUNT",
        remarks: str(offer.remarks),
        basedOn: (offer.basedOn ?? "") as "",
        lines: offer.specialLines.map((line) => ({
          customerGroupId: str(line.customerGroupId),
          discountType: line.discountType as "PERCENT" | "FLAT",
          amount: line.amount.toString(),
          fromAmount: str(line.fromAmount),
          toAmount: str(line.toAmount),
          supplierId: str(line.supplierId),
          supplierContribution: str(line.supplierContribution),
          internalContribution: str(line.internalContribution),
          vatOnDiscounted: line.vatOnDiscounted,
        })),
      };
  }
}

export async function getOfferOptions(actor: Actor): Promise<OfferOptions> {
  const unit = { businessUnit: unitScope(actor) };
  const bu = { id: true, name: true, businessUnitId: true } as const;
  const [businessUnits, customerGroups, priceLists, categories, items, suppliers] = await Promise.all([
    db().businessUnit.findMany({ where: unitScope(actor), orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db().customerGroup.findMany({ where: { ...unit, isActive: true }, orderBy: { name: "asc" }, select: bu }),
    db().priceList.findMany({ where: unit, orderBy: { name: "asc" }, select: bu }),
    db().itemCategory.findMany({ where: unit, orderBy: [{ level: "asc" }, { name: "asc" }], select: { ...bu, parentId: true, level: true } }),
    db().item.findMany({
      where: { ...unit, isActive: true },
      orderBy: { name: "asc" },
      select: { ...bu, code: true, uom: true, altUom: true, categoryId: true },
    }),
    db().supplier.findMany({ where: { ...unit, isActive: true }, orderBy: { name: "asc" }, select: { ...bu, code: true } }),
  ]);
  return { businessUnits, customerGroups, priceLists, categories, items, suppliers };
}

// ─── Commands ─────────────────────────────────────────────────────────────────

export async function createOffer(actor: Actor, input: OfferInput): Promise<OfferDto> {
  const data = offerInputSchema.parse(input);
  await loadUnit(actor, data.businessUnitId);
  const offer = await db().$transaction(async (tx) => {
    await validateReferences(tx, data.businessUnitId, data);
    const created = await tx.salesOffer.create({ data: { businessUnitId: data.businessUnitId, kind: data.kind, ...headerColumns(data) } });
    await writeLines(tx, created.id, data);
    return created;
  });
  return getOffer(actor, offer.id);
}

export async function updateOffer(actor: Actor, id: string, input: OfferInput): Promise<OfferDto> {
  const data = offerInputSchema.parse(input);
  const existing = await loadOffer(actor, id);
  if (existing.kind !== data.kind) throw badRequest("An offer cannot change its type.");
  if (existing.businessUnitId !== data.businessUnitId) throw badRequest("An offer cannot move to another business unit.");
  await db().$transaction(async (tx) => {
    await validateReferences(tx, existing.businessUnitId, data);
    await tx.salesOffer.update({ where: { id }, data: headerColumns(data) });
    await writeLines(tx, id, data);
  });
  return getOffer(actor, id);
}

export async function setOfferActive(actor: Actor, id: string, isActive: boolean) {
  await loadOffer(actor, id);
  return db().salesOffer.update({ where: { id }, data: { isActive }, select: { id: true, isActive: true } });
}

// ─── Discount template / upload ───────────────────────────────────────────────

const DISCOUNT_COLUMNS = [
  { key: "itemCode", header: "Item Code *", width: 16 },
  { key: "type", header: "Type (Percentage/Flat Amount) *", width: 26 },
  { key: "amount", header: "Amount/% *", width: 12 },
  { key: "quantity", header: "Qty", width: 10 },
  { key: "minQty", header: "Min Qty", width: 10 },
  { key: "maxQty", header: "Max Qty", width: 10 },
  { key: "recurrent", header: "Recurrent (Yes/No)", width: 16 },
  { key: "supplierCode", header: "Supplier Code", width: 16 },
  { key: "supplierContribution", header: "Sup. Contrib %", width: 14 },
  { key: "internalContribution", header: "Internal Contrib %", width: 16 },
] as const;

const normal = (value: string) => value.trim().toLowerCase().replace(/\s*\*$/, "");

export async function discountTemplate(): Promise<Uint8Array> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Discount Items", { views: [{ state: "frozen", ySplit: 1 }] });
  sheet.columns = DISCOUNT_COLUMNS.map((column) => ({ ...column }));
  const header = sheet.getRow(1);
  header.font = { bold: true, color: { argb: "FF1E3A8A" } };
  header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDBEAFE" } };
  return new Uint8Array(await workbook.xlsx.writeBuffer());
}

/** Reads a filled discount template into rows for the form (nothing is saved). */
export async function parseDiscountLines(actor: Actor, businessUnitId: string, bytes: Uint8Array): Promise<ParsedDiscountLines> {
  await loadUnit(actor, businessUnitId);
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer);
  } catch {
    throw new AppError(400, "VALIDATION_ERROR", "The file is not a valid Excel (.xlsx) workbook.");
  }
  const sheet = workbook.worksheets[0];
  if (!sheet) throw new AppError(400, "VALIDATION_ERROR", "The workbook has no sheets.");
  const index = new Map<string, number>();
  sheet.getRow(1).eachCell((cell, column) => {
    const match = DISCOUNT_COLUMNS.find((c) => normal(c.header) === normal(cellText(cell.value)));
    if (match) index.set(match.key, column);
  });
  if (!index.has("itemCode")) throw new AppError(400, "VALIDATION_ERROR", 'Column "Item Code" is missing. Use the template.');

  const [items, suppliers] = await Promise.all([
    db().item.findMany({ where: { businessUnitId }, select: { id: true, code: true } }),
    db().supplier.findMany({ where: { businessUnitId }, select: { id: true, code: true } }),
  ]);
  const itemByCode = new Map(items.map((item) => [item.code.toLowerCase(), item.id]));
  const supplierByCode = new Map(suppliers.map((supplier) => [supplier.code.toLowerCase(), supplier.id]));

  const result: ParsedDiscountLines = { lines: [], errors: [] };
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const get = (key: string) => {
      const column = index.get(key);
      return column ? cellText(row.getCell(column).value) : "";
    };
    if (DISCOUNT_COLUMNS.every((c) => get(c.key) === "")) return;
    try {
      const itemId = itemByCode.get(get("itemCode").toLowerCase());
      if (!itemId) throw new Error(`Item code "${get("itemCode")}" not found.`);
      const typeText = get("type").toLowerCase();
      const discountType = DISCOUNT_TYPES.find((t) => t.label.toLowerCase() === typeText || t.value.toLowerCase() === typeText || (typeText === "flat" && t.value === "FLAT"))?.value;
      if (!discountType) throw new Error("Type: use Percentage or Flat Amount.");
      let supplierId = "";
      if (get("supplierCode")) {
        supplierId = supplierByCode.get(get("supplierCode").toLowerCase()) ?? "";
        if (!supplierId) throw new Error(`Supplier code "${get("supplierCode")}" not found.`);
      }
      const candidate = {
        itemId,
        discountType,
        amount: get("amount"),
        quantity: get("quantity"),
        minQty: get("minQty"),
        maxQty: get("maxQty"),
        isRecurrent: parseFlag(get("recurrent"), "Recurrent"),
        supplierId,
        supplierContribution: get("supplierContribution"),
        internalContribution: get("internalContribution"),
      };
      const parsed = discountLineSchema.safeParse(candidate);
      if (!parsed.success) throw new Error(parsed.error.issues.map((issue) => issue.message).join(" "));
      result.lines.push(candidate);
    } catch (error) {
      result.errors.push({ row: rowNumber, message: error instanceof Error ? error.message : "Could not read this row." });
    }
  });
  return result;
}
