import type { Prisma } from "@/generated/prisma/client";
import { badRequest } from "@/lib/api/errors";
import type { Actor } from "@/lib/auth/actor";
import { db } from "@/lib/prisma/client";
import { categoryIds, loadUnit, resolveUnit } from "../../standard-price/server/standard-price.service";
import {
  returnPriceQuerySchema,
  saveReturnPricesSchema,
  type ReturnPriceFilter,
  type ReturnPriceList,
  type ReturnPriceOptions,
  type ReturnPriceRow,
  type SaveReturnPricesInput,
} from "../schemas/return-price.schema";

const rate = (value: { toString(): string }) => {
  const n = Number(value.toString());
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100);
};
const dateOnly = (value: Date) => value.toISOString().slice(0, 10);
const toDate = (value: string) => new Date(`${value}T00:00:00.000Z`);
const escapeLike = (value: string) => value.replace(/[\\%_]/g, (char) => `\\${char}`);

/** Items of the filter. Shared by the list, Excel and PDF. */
async function returnPriceWhere(actor: Actor, filter: ReturnPriceFilter) {
  const query = returnPriceQuerySchema.parse(filter);
  const businessUnitId = await resolveUnit(actor, query.businessUnitId);
  const category = query.subCategoryId || query.categoryId;
  const search = query.search ? { contains: escapeLike(query.search), mode: "insensitive" as const } : undefined;
  const where: Prisma.ItemWhereInput = {
    businessUnitId,
    isActive: true,
    ...(query.itemType ? { itemType: query.itemType } : {}),
    ...(category ? { categoryId: { in: await categoryIds(businessUnitId, category) } } : {}),
    ...(search ? { OR: [{ code: search }, { name: search }] } : {}),
  };
  return { where, query };
}

const itemSelect = {
  id: true,
  code: true,
  name: true,
  uom: true,
  salesReturnPrices: { orderBy: { effectiveFrom: "desc" }, take: 1 },
  _count: { select: { salesReturnPrices: true } },
} satisfies Prisma.ItemSelect;

function toRow(item: Prisma.ItemGetPayload<{ select: typeof itemSelect }>): ReturnPriceRow {
  const price = item.salesReturnPrices[0];
  return {
    itemId: item.id,
    code: item.code,
    name: item.name,
    uom: item.uom,
    priceId: price?.id ?? null,
    effectiveFrom: price ? dateOnly(price.effectiveFrom) : "",
    damageRate: price ? rate(price.damageRate) : "0",
    expireRate: price ? rate(price.expireRate) : "0",
    damageExpireRate: price ? rate(price.damageExpireRate) : "0",
    soundStockRate: price ? rate(price.soundStockRate) : "0",
    historyCount: item._count.salesReturnPrices,
  };
}

export async function listReturnPrices(actor: Actor, filter: ReturnPriceFilter & { page?: number; pageSize?: number }): Promise<ReturnPriceList> {
  const { where, query } = await returnPriceWhere(actor, filter);
  const [total, items] = await Promise.all([
    db().item.count({ where }),
    db().item.findMany({ where, orderBy: [{ name: "asc" }, { code: "asc" }], skip: (query.page - 1) * query.pageSize, take: query.pageSize, select: itemSelect }),
  ]);
  return { rows: items.map(toRow), total, page: query.page, pageSize: query.pageSize };
}

/** Every row of the filter (capped), for Excel and PDF. */
export async function allReturnPrices(actor: Actor, filter: ReturnPriceFilter, limit = 5000) {
  const { where } = await returnPriceWhere(actor, filter);
  const items = await db().item.findMany({ where, orderBy: [{ name: "asc" }, { code: "asc" }], take: limit, select: itemSelect });
  return items.map(toRow);
}

export async function getReturnPriceOptions(actor: Actor): Promise<ReturnPriceOptions> {
  const scope: Prisma.BusinessUnitWhereInput = actor.companyScope === "ALL" ? {} : { companyId: { in: [...actor.companyScope] } };
  const [businessUnits, categories] = await Promise.all([
    db().businessUnit.findMany({ where: scope, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db().itemCategory.findMany({
      where: { businessUnit: scope },
      orderBy: [{ level: "asc" }, { name: "asc" }],
      select: { id: true, name: true, businessUnitId: true, parentId: true, level: true },
    }),
  ]);
  return { businessUnits, categories };
}

/** Stores each row as the item's return rates from `effectiveFrom` (same item and date = update). */
export async function saveReturnPrices(actor: Actor, input: SaveReturnPricesInput) {
  const data = saveReturnPricesSchema.parse(input);
  const businessUnitId = await loadUnit(actor, data.businessUnitId);
  const itemIds = data.rows.map((row) => row.itemId);
  const items = await db().item.findMany({ where: { id: { in: itemIds }, businessUnitId }, select: { id: true } });
  if (items.length !== new Set(itemIds).size) throw badRequest("Select items of this business unit.");

  return db().$transaction(
    async (tx) => {
      let created = 0;
      let updated = 0;
      for (const { itemId, effectiveFrom: date, ...rates } of data.rows) {
        const effectiveFrom = toDate(date);
        const existing = await tx.salesReturnPrice.findUnique({ where: { itemId_effectiveFrom: { itemId, effectiveFrom } }, select: { id: true } });
        if (existing) {
          await tx.salesReturnPrice.update({ where: { id: existing.id }, data: rates });
          updated += 1;
        } else {
          await tx.salesReturnPrice.create({ data: { businessUnitId, itemId, effectiveFrom, ...rates } });
          created += 1;
        }
      }
      return { created, updated };
    },
    { timeout: 60_000, maxWait: 10_000 },
  );
}
