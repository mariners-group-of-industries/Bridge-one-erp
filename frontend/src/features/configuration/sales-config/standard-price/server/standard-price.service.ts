import type { Prisma } from "@/generated/prisma/client";
import { badRequest, notFound } from "@/lib/api/errors";
import { assertCompanyAccess, type Actor } from "@/lib/auth/actor";
import { db } from "@/lib/prisma/client";
import {
  saveStandardPricesSchema,
  standardPriceQuerySchema,
  type IncreaseType,
  type SaveStandardPricesInput,
  type StandardPriceFilter,
  type StandardPriceList,
  type StandardPriceOptions,
  type StandardPriceRow,
} from "../schemas/standard-price.schema";

// ─── Scoping & helpers ────────────────────────────────────────────────────────

function unitScope(actor: Actor): Prisma.BusinessUnitWhereInput {
  return actor.companyScope === "ALL" ? {} : { companyId: { in: [...actor.companyScope] } };
}

export async function loadUnit(actor: Actor, businessUnitId: string) {
  const unit = await db().businessUnit.findUnique({ where: { id: businessUnitId }, select: { id: true, companyId: true } });
  if (!unit) throw notFound("Business unit");
  assertCompanyAccess(actor, unit.companyId, "Business unit");
  return unit.id;
}

/** The requested business unit, or the first one the actor can see. */
export async function resolveUnit(actor: Actor, businessUnitId: string) {
  if (businessUnitId) return loadUnit(actor, businessUnitId);
  const first = await db().businessUnit.findFirst({ where: unitScope(actor), orderBy: { name: "asc" }, select: { id: true } });
  if (!first) throw badRequest("Create a business unit first.");
  return first.id;
}

const dec = (value: { toString(): string } | null | undefined) => (value === null || value === undefined ? "" : Number(value.toString()).toFixed(2));
const orNull = (value: string) => (value === "" ? null : value);
const dateOnly = (value: Date) => value.toISOString().slice(0, 10);
const toDate = (value: string) => new Date(`${value}T00:00:00.000Z`);
const today = () => new Date().toISOString().slice(0, 10);
const escapeLike = (value: string) => value.replace(/[\\%_]/g, (char) => `\\${char}`);

/** A category and every category below it. */
export async function categoryIds(businessUnitId: string, categoryId: string) {
  const categories = await db().itemCategory.findMany({ where: { businessUnitId }, select: { id: true, parentId: true } });
  const ids = new Set([categoryId]);
  for (let grew = true; grew;) {
    grew = false;
    for (const category of categories) {
      if (category.parentId && ids.has(category.parentId) && !ids.has(category.id)) {
        ids.add(category.id);
        grew = true;
      }
    }
  }
  return [...ids];
}

/** Items of the filter. Shared by the list, Excel and PDF. */
export async function standardPriceWhere(actor: Actor, filter: StandardPriceFilter) {
  const query = standardPriceQuerySchema.parse(filter);
  const businessUnitId = await resolveUnit(actor, query.businessUnitId);
  const category = query.subCategoryId || query.categoryId;
  const search = query.search ? { contains: escapeLike(query.search), mode: "insensitive" as const } : undefined;
  const where: Prisma.ItemWhereInput = {
    businessUnitId,
    isActive: true,
    ...(query.itemType ? { itemType: query.itemType } : {}),
    ...(category ? { categoryId: { in: await categoryIds(businessUnitId, category) } } : {}),
    AND: [
      // Customer: items in their Customer Price Setup or on their sales orders.
      query.customerId ? { OR: [{ customerPriceLines: { some: { setup: { customerId: query.customerId } } } }, { orderLines: { some: { order: { customerId: query.customerId } } } }] } : {},
      // Supplier: items on their purchase orders.
      query.supplierId ? { purchaseOrderLines: { some: { order: { supplierId: query.supplierId } } } } : {},
      search ? { OR: [{ code: search }, { name: search }] } : {},
    ],
  };
  return { businessUnitId, where, query };
}

const itemSelect = {
  id: true,
  code: true,
  name: true,
  uom: true,
  purchasePrice: true,
  dealerPrice: true,
  tradingPrice: true,
  mrp: true,
  standardPrices: { orderBy: { effectiveFrom: "desc" }, take: 1 },
  _count: { select: { standardPrices: true } },
} satisfies Prisma.ItemSelect;

type ItemWithPrice = Prisma.ItemGetPayload<{ select: typeof itemSelect }>;

function toRow(item: ItemWithPrice): StandardPriceRow {
  const price = item.standardPrices[0];
  if (!price) {
    // Never saved: start from the Item Profile prices.
    return {
      itemId: item.id,
      code: item.code,
      name: item.name,
      uom: item.uom,
      priceId: null,
      effectiveFrom: today(),
      costPrice: dec(item.purchasePrice),
      increaseType: "PERCENT",
      increaseValue: "",
      etpPrice: "",
      dealerPrice: dec(item.dealerPrice),
      tradingPrice: dec(item.tradingPrice),
      mrp: dec(item.mrp),
      minSalesPrice: "",
      remarks: "",
      historyCount: 0,
    };
  }
  return {
    itemId: item.id,
    code: item.code,
    name: item.name,
    uom: item.uom,
    priceId: price.id,
    effectiveFrom: dateOnly(price.effectiveFrom),
    costPrice: dec(price.costPrice),
    increaseType: price.increaseType === "AMOUNT" ? "AMOUNT" : ("PERCENT" as IncreaseType),
    increaseValue: dec(price.increaseValue),
    etpPrice: dec(price.etpPrice),
    dealerPrice: dec(price.dealerPrice),
    tradingPrice: dec(price.tradingPrice),
    mrp: dec(price.mrp),
    minSalesPrice: dec(price.minSalesPrice),
    remarks: price.remarks ?? "",
    historyCount: item._count.standardPrices,
  };
}

// ─── List ─────────────────────────────────────────────────────────────────────

export async function listStandardPrices(actor: Actor, filter: StandardPriceFilter & { page?: number; pageSize?: number }): Promise<StandardPriceList> {
  const { where, query } = await standardPriceWhere(actor, filter);
  const [total, items] = await Promise.all([
    db().item.count({ where }),
    db().item.findMany({ where, orderBy: [{ name: "asc" }, { code: "asc" }], skip: (query.page - 1) * query.pageSize, take: query.pageSize, select: itemSelect }),
  ]);
  return { rows: items.map(toRow), total, page: query.page, pageSize: query.pageSize };
}

/** Every row of the filter (capped), for Excel and PDF. */
export async function allStandardPrices(actor: Actor, filter: StandardPriceFilter, limit = 5000) {
  const { businessUnitId, where } = await standardPriceWhere(actor, filter);
  const items = await db().item.findMany({ where, orderBy: [{ name: "asc" }, { code: "asc" }], take: limit, select: itemSelect });
  return { businessUnitId, rows: items.map(toRow) };
}

export async function getStandardPriceOptions(actor: Actor): Promise<StandardPriceOptions> {
  const unit = { businessUnit: unitScope(actor) };
  const bu = { id: true, name: true, businessUnitId: true } as const;
  const [businessUnits, categories, customers, suppliers] = await Promise.all([
    db().businessUnit.findMany({ where: unitScope(actor), orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db().itemCategory.findMany({ where: unit, orderBy: [{ level: "asc" }, { name: "asc" }], select: { ...bu, parentId: true, level: true } }),
    db().customer.findMany({ where: { ...unit, isActive: true }, orderBy: { name: "asc" }, select: { ...bu, code: true } }),
    db().supplier.findMany({ where: { ...unit, isActive: true }, orderBy: { name: "asc" }, select: { ...bu, code: true } }),
  ]);
  return { businessUnits, categories, customers, suppliers };
}

// ─── Save ─────────────────────────────────────────────────────────────────────

/**
 * Stores each row as the item's price from `effectiveFrom` (same item and date =
 * update). When that date is already in force and no later in-force price exists,
 * the Item Profile prices (purchase, dealer, trading, MRP) follow it.
 */
export async function saveStandardPrices(actor: Actor, input: SaveStandardPricesInput) {
  const data = saveStandardPricesSchema.parse(input);
  const businessUnitId = await loadUnit(actor, data.businessUnitId);
  const itemIds = data.rows.map((row) => row.itemId);
  const items = await db().item.findMany({ where: { id: { in: itemIds }, businessUnitId }, select: { id: true } });
  if (items.length !== new Set(itemIds).size) throw badRequest("Select items of this business unit.");

  const now = today();
  return db().$transaction(
    async (tx) => {
      let created = 0;
      let updated = 0;
      for (const row of data.rows) {
        const values = {
          costPrice: orNull(row.costPrice),
          increaseType: row.increaseType,
          increaseValue: orNull(row.increaseValue),
          etpPrice: orNull(row.etpPrice),
          dealerPrice: orNull(row.dealerPrice),
          tradingPrice: orNull(row.tradingPrice),
          mrp: orNull(row.mrp),
          minSalesPrice: orNull(row.minSalesPrice),
          remarks: orNull(row.remarks),
        };
        const effectiveFrom = toDate(row.effectiveFrom);
        const existing = await tx.standardPrice.findUnique({ where: { itemId_effectiveFrom: { itemId: row.itemId, effectiveFrom } }, select: { id: true } });
        if (existing) {
          await tx.standardPrice.update({ where: { id: existing.id }, data: values });
          updated += 1;
        } else {
          await tx.standardPrice.create({ data: { businessUnitId, itemId: row.itemId, effectiveFrom, ...values } });
          created += 1;
        }

        if (row.effectiveFrom <= now) {
          const newer = await tx.standardPrice.count({ where: { itemId: row.itemId, effectiveFrom: { gt: effectiveFrom, lte: toDate(now) } } });
          if (newer === 0) {
            await tx.item.update({
              where: { id: row.itemId },
              data: {
                ...(values.costPrice !== null ? { purchasePrice: values.costPrice } : {}),
                ...(values.dealerPrice !== null ? { dealerPrice: values.dealerPrice } : {}),
                ...(values.tradingPrice !== null ? { tradingPrice: values.tradingPrice } : {}),
                ...(values.mrp !== null ? { mrp: values.mrp } : {}),
              },
            });
          }
        }
      }
      return { created, updated };
    },
    { timeout: 60_000, maxWait: 10_000 },
  );
}
