import type { Prisma } from "@/generated/prisma/client";
import { badRequest } from "@/lib/api/errors";
import type { Actor } from "@/lib/auth/actor";
import { db } from "@/lib/prisma/client";
import { toDbDate } from "../../lib/dates";
import { requireOffice } from "../../lib/scope";
import { computeOffers, type ComputedOffers, type OfferRule, type PaidLine } from "../lib/offers";
import { pricingQuerySchema, returnRatesQuerySchema, type PriceTier, type PricingResult, type ResolvedPrice, type ReturnRates } from "../schemas/pricing.schema";

const num = (value: Prisma.Decimal | null | undefined) => (value === null || value === undefined ? null : value.toNumber());
const dateIn = (day: Date) => ({ OR: [{ fromDate: null }, { fromDate: { lte: day } }], AND: [{ OR: [{ toDate: null }, { toDate: { gte: day } }] }] });

export interface PricingContext {
  businessUnitId: string;
  officeId: string;
  customerId: string;
  /** The order's price type; the customer's when not chosen. */
  priceListId: string | null;
  /** "YYYY-MM-DD" the prices and offers must be valid on. */
  date: string;
}

/** Dealer price for a "Dealer"/"DP" price type, trading price otherwise. */
export const tierOf = (priceListName: string | null | undefined): PriceTier => (priceListName && /dealer|\bdp\b|d\.p/i.test(priceListName) ? "DP" : "TP");

async function customerScope(ctx: PricingContext) {
  const customer = await db().customer.findFirst({
    where: { id: ctx.customerId, businessUnitId: ctx.businessUnitId },
    select: { customerGroupId: true, subGroupId: true, priceListId: true },
  });
  if (!customer) throw badRequest("Customer does not belong to the office's business unit.");
  const priceListId = ctx.priceListId ?? customer.priceListId;
  const priceList = priceListId ? await db().priceList.findFirst({ where: { id: priceListId, businessUnitId: ctx.businessUnitId }, select: { name: true } }) : null;
  const groupIds = [customer.customerGroupId, customer.subGroupId].filter((id): id is string => !!id);
  return { groupIds, priceListId: priceList ? priceListId : null, tier: tierOf(priceList?.name) };
}

type Scope = Awaited<ReturnType<typeof customerScope>>;

/**
 * Rate of each item, most specific setup first: Customer Price Setup → Customer Group
 * Price (running, this office, date and quantity in range) → Standard Price (latest
 * effective on the date) → the price type's item price → the item's sales rate.
 */
async function resolvePrices(ctx: PricingContext, scope: Scope, qtyOf: Map<string, number>): Promise<Map<string, ResolvedPrice>> {
  const itemIds = [...qtyOf.keys()];
  if (itemIds.length === 0) return new Map();
  const day = toDbDate(ctx.date);
  const [items, customerLines, groupSetups, standards, typePrices] = await Promise.all([
    db().item.findMany({ where: { id: { in: itemIds }, businessUnitId: ctx.businessUnitId }, select: { id: true, salesRate: true, mrp: true } }),
    db().customerPriceLine.findMany({
      where: { itemId: { in: itemIds }, setup: { customerId: ctx.customerId, businessUnitId: ctx.businessUnitId, isActive: true } },
      select: { itemId: true, dpPrice: true, tpPrice: true },
      orderBy: { setup: { updatedAt: "desc" } },
    }),
    scope.groupIds.length
      ? db().customerGroupPriceSetup.findMany({
          where: { businessUnitId: ctx.businessUnitId, officeId: ctx.officeId, customerGroupId: { in: scope.groupIds }, isRunning: true },
          select: {
            customerGroupId: true,
            lines: { where: { itemId: { in: itemIds }, ...dateIn(day) }, select: { itemId: true, fromQty: true, toQty: true, dpPrice: true, tpPrice: true } },
          },
          orderBy: { createDate: "desc" },
        })
      : [],
    db().standardPrice.findMany({
      where: { itemId: { in: itemIds }, businessUnitId: ctx.businessUnitId, effectiveFrom: { lte: day } },
      select: { itemId: true, dealerPrice: true, tradingPrice: true, minSalesPrice: true, mrp: true },
      orderBy: { effectiveFrom: "desc" },
    }),
    scope.priceListId ? db().itemPrice.findMany({ where: { priceListId: scope.priceListId, itemId: { in: itemIds } }, select: { itemId: true, rate: true } }) : [],
  ]);

  const pick = (row: { dpPrice: Prisma.Decimal; tpPrice: Prisma.Decimal }) => (scope.tier === "DP" ? row.dpPrice : row.tpPrice).toNumber();
  const first = <T extends { itemId: string }>(rows: T[]) => {
    const map = new Map<string, T>();
    for (const row of rows) if (!map.has(row.itemId)) map.set(row.itemId, row);
    return map;
  };
  const customerPrice = first(customerLines);
  const standard = first(standards);
  const typePrice = new Map(typePrices.map((row) => [row.itemId, row.rate.toNumber()]));
  // The customer's own sub group before its group.
  const groupLines = [...groupSetups]
    .sort((a, b) => scope.groupIds.indexOf(b.customerGroupId) - scope.groupIds.indexOf(a.customerGroupId))
    .flatMap((setup) => setup.lines);

  const result = new Map<string, ResolvedPrice>();
  for (const item of items) {
    const qty = qtyOf.get(item.id) ?? 0;
    const std = standard.get(item.id);
    const stdRate = std ? num(scope.tier === "DP" ? std.dealerPrice : std.tradingPrice) : null;
    const group = groupLines.find(
      (line) => line.itemId === item.id && (line.fromQty === null || qty >= line.fromQty.toNumber()) && (line.toQty === null || qty <= line.toQty.toNumber()),
    );
    const candidates: [ResolvedPrice["source"], number | null | undefined][] = [
      ["CUSTOMER", customerPrice.has(item.id) ? pick(customerPrice.get(item.id)!) : null],
      ["CUSTOMER_GROUP", group ? pick(group) : null],
      ["STANDARD", stdRate],
      ["PRICE_TYPE", typePrice.get(item.id)],
      ["ITEM", item.salesRate.toNumber()],
    ];
    const hit = candidates.find(([, rate]) => rate !== null && rate !== undefined && rate > 0);
    result.set(item.id, {
      itemId: item.id,
      rate: hit ? hit[1]! : null,
      source: hit ? hit[0] : null,
      tier: scope.tier,
      minSalesPrice: std ? num(std.minSalesPrice) : null,
      mrp: (std ? num(std.mrp) : null) ?? num(item.mrp),
    });
  }
  return result;
}

/** Active offers valid on the date for this customer's group and price type. */
async function loadOfferRules(ctx: PricingContext, scope: Scope): Promise<OfferRule[]> {
  const day = toDbDate(ctx.date);
  const offers = await db().salesOffer.findMany({
    where: { businessUnitId: ctx.businessUnitId, isActive: true, ...dateIn(day) },
    include: { itemLines: true, pairLines: true, bonusLines: true, discountLines: true, specialLines: true },
    orderBy: { createdAt: "asc" },
  });
  const inGroup = (groupId: string | null) => !groupId || scope.groupIds.includes(groupId);
  const fits = (offer: (typeof offers)[number]) => {
    if (offer.basedOn === "Price Type") return !!offer.priceListId && offer.priceListId === scope.priceListId;
    if (offer.basedOn === "Customer Group" || offer.kind === "ITEM") return inGroup(offer.customerGroupId);
    return true;
  };
  const n = (value: Prisma.Decimal | null) => num(value);
  return offers.filter(fits).flatMap((offer): OfferRule[] => {
    switch (offer.kind) {
      case "ITEM":
        return [{ kind: "ITEM", name: offer.name, lines: offer.itemLines.map((line) => ({ sellingItemId: line.sellingItemId, sellingQty: line.sellingQty.toNumber(), offerItemId: line.offerItemId, offerQty: line.offerQty.toNumber() })) }];
      case "ITEM_MULTIPLE":
        return [
          {
            kind: "ITEM_MULTIPLE",
            name: offer.name,
            pairs: offer.pairLines.map((line) => ({ itemId: line.itemId, quantity: line.quantity.toNumber(), minQty: n(line.minQty), maxQty: n(line.maxQty) })),
            bonus: offer.bonusLines.map((line) => ({ itemId: line.itemId, quantity: line.quantity.toNumber() })),
          },
        ];
      case "DISCOUNT":
        return [
          {
            kind: "DISCOUNT",
            name: offer.name,
            lines: offer.discountLines.map((line) => ({
              itemId: line.itemId,
              discountType: line.discountType,
              amount: line.amount.toNumber(),
              quantity: n(line.quantity),
              minQty: n(line.minQty),
              maxQty: n(line.maxQty),
              isRecurrent: line.isRecurrent,
            })),
          },
        ];
      case "SPECIAL_DISCOUNT":
        return [
          {
            kind: "SPECIAL_DISCOUNT",
            name: offer.name,
            lines: offer.specialLines
              .filter((line) => inGroup(line.customerGroupId))
              .map((line) => ({ discountType: line.discountType, amount: line.amount.toNumber(), fromAmount: n(line.fromAmount), toAmount: n(line.toAmount) })),
          },
        ];
      default:
        return [];
    }
  });
}

export interface AppliedPricing {
  prices: Map<string, ResolvedPrice>;
  offers: ComputedOffers;
  /** Per input line: true when it is a free line an offer gave (replaced on every save). */
  isOfferLine: boolean[];
}

/**
 * Prices and offers for the lines of a quotation / order. Lines with a 100% discount on
 * an item some applicable offer gives free are earlier offer lines: they are left out
 * of the offer calculation and replaced by the result.
 */
export async function salesPricing(ctx: PricingContext, lines: readonly PaidLine[]): Promise<AppliedPricing> {
  const scope = await customerScope(ctx);
  const rules = await loadOfferRules(ctx, scope);
  const candidates = new Set(computeOffers(rules, []).freeItemIds);
  const isOfferLine = lines.map((line) => line.discountPercent >= 100 && candidates.has(line.itemId));
  const paid = lines.filter((_, index) => !isOfferLine[index]);
  const offers = computeOffers(rules, paid);
  const qtyOf = new Map<string, number>();
  for (const line of [...paid, ...offers.free.map((row) => ({ itemId: row.itemId, qty: 0 }))]) qtyOf.set(line.itemId, (qtyOf.get(line.itemId) ?? 0) + line.qty);
  const prices = await resolvePrices(ctx, scope, qtyOf);
  return { prices, offers, isOfferLine };
}

/** Throws when a paid line is priced below its Standard Price minimum. */
export async function assertMinPrices(
  businessUnitId: string,
  lines: readonly { itemId: string; unitPrice: number; discountPercent: number }[],
  prices: Map<string, ResolvedPrice>,
) {
  const low = lines.filter((line) => {
    const min = prices.get(line.itemId)?.minSalesPrice;
    return line.discountPercent < 100 && min !== null && min !== undefined && line.unitPrice + 1e-9 < min;
  });
  if (low.length === 0) return;
  const items = await db().item.findMany({ where: { id: { in: low.map((line) => line.itemId) }, businessUnitId }, select: { id: true, code: true, name: true } });
  const label = new Map(items.map((item) => [item.id, `${item.code} - ${item.name}`]));
  const first = low[0];
  throw badRequest(`${label.get(first.itemId) ?? "An item"}: unit price ${first.unitPrice} is below the minimum sales price ${prices.get(first.itemId)!.minSalesPrice} (Standard Price Setup).`);
}

/** POST /api/sales/pricing: rates and offers for the order / quotation form. */
export async function previewPricing(actor: Actor, raw: unknown): Promise<PricingResult> {
  const query = pricingQuerySchema.parse(raw);
  const office = await requireOffice(actor, query.officeId);
  const ctx: PricingContext = { businessUnitId: office.businessUnitId, officeId: office.id, customerId: query.customerId, priceListId: query.priceListId ?? null, date: query.date };
  const { prices, offers } = await salesPricing(ctx, query.lines);
  const freeItems = await db().item.findMany({ where: { id: { in: offers.free.map((row) => row.itemId) } }, select: { id: true, code: true, name: true, salesRate: true } });
  const itemById = new Map(freeItems.map((item) => [item.id, item]));
  return {
    prices: [...prices.values()],
    offers: {
      freeLines: offers.free.map((row) => {
        const item = itemById.get(row.itemId);
        return { itemId: row.itemId, code: item?.code ?? "", name: item?.name ?? "", qty: row.qty, rate: prices.get(row.itemId)?.rate ?? item?.salesRate.toNumber() ?? 0, offerName: row.offerName };
      }),
      discounts: offers.discounts,
      invoiceDiscount: offers.invoiceDiscount,
      invoiceOfferName: offers.invoiceOfferName,
      freeItemIds: offers.freeItemIds,
    },
  };
}

/** POST /api/sales/pricing/return-rates: the latest Return Price Setup rates effective on the date. */
export async function returnRates(actor: Actor, raw: unknown): Promise<ReturnRates[]> {
  const query = returnRatesQuerySchema.parse(raw);
  const office = await requireOffice(actor, query.officeId);
  const rows = await db().salesReturnPrice.findMany({
    where: { businessUnitId: office.businessUnitId, itemId: { in: query.itemIds }, effectiveFrom: { lte: toDbDate(query.date) } },
    orderBy: { effectiveFrom: "desc" },
  });
  const latest = new Map<string, ReturnRates>();
  for (const row of rows) {
    if (latest.has(row.itemId)) continue;
    latest.set(row.itemId, {
      itemId: row.itemId,
      damageRate: row.damageRate.toNumber(),
      expireRate: row.expireRate.toNumber(),
      damageExpireRate: row.damageExpireRate.toNumber(),
      soundStockRate: row.soundStockRate.toNumber(),
    });
  }
  return [...latest.values()];
}
