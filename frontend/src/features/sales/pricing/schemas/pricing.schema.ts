import { z } from "zod";

// Sales pricing: rates and offers from Configuration › Sales Config, applied to
// quotations and orders. Shared by the preview route and the order/quotation forms.

/** Where a resolved rate came from, most specific first. */
export const PRICE_SOURCES = ["CUSTOMER", "CUSTOMER_GROUP", "STANDARD", "PRICE_TYPE", "ITEM"] as const;
export type PriceSource = (typeof PRICE_SOURCES)[number];
export const PRICE_SOURCE_LABELS: Record<PriceSource, string> = {
  CUSTOMER: "Customer Price Setup",
  CUSTOMER_GROUP: "Customer Group Price",
  STANDARD: "Standard Price",
  PRICE_TYPE: "Price Type",
  ITEM: "Item Sales Rate",
};

/** Dealer (DP) or trading (TP) price, chosen by the price type's name. */
export type PriceTier = "DP" | "TP";

export const pricingLineSchema = z.object({
  itemId: z.uuid(),
  qty: z.number().min(0).max(999_999_999_999).default(0),
  unitPrice: z.number().min(0).max(999_999_999_999).default(0),
  discountPercent: z.number().min(0).max(100).default(0),
});
export type PricingLine = z.output<typeof pricingLineSchema>;

/** Body of POST /api/sales/pricing: what the order / quotation form has so far. */
export const pricingQuerySchema = z.object({
  officeId: z.uuid(),
  customerId: z.uuid(),
  priceListId: z.uuid().nullish(),
  date: z.iso.date(),
  lines: z.array(pricingLineSchema).max(300).default([]),
});
export type PricingQuery = z.input<typeof pricingQuerySchema>;

export interface ResolvedPrice {
  itemId: string;
  /** Null when no setup and no sales rate gives a price. */
  rate: number | null;
  source: PriceSource | null;
  tier: PriceTier;
  /** From Standard Price; an order line may not go below it. */
  minSalesPrice: number | null;
  mrp: number | null;
}

export interface OfferFreeLine {
  itemId: string;
  code: string;
  name: string;
  qty: number;
  /** Rate the free line is shown at (100% discount). */
  rate: number;
  offerName: string;
}

export interface OfferDiscount {
  itemId: string;
  percent: number;
  offerName: string;
}

export interface OfferResult {
  freeLines: OfferFreeLine[];
  discounts: OfferDiscount[];
  /** Special (invoice amount) discount; orders only. */
  invoiceDiscount: number;
  invoiceOfferName: string | null;
  /** Items any applicable offer gives free, so a re-save can replace them. */
  freeItemIds: string[];
}

export interface PricingResult {
  prices: ResolvedPrice[];
  offers: OfferResult;
}

/** Body of POST /api/sales/pricing/return-rates: Return Price Setup rates on a return date. */
export const returnRatesQuerySchema = z.object({
  officeId: z.uuid(),
  date: z.iso.date(),
  itemIds: z.array(z.uuid()).min(1).max(300),
});
export type ReturnRatesQuery = z.input<typeof returnRatesQuerySchema>;

export interface ReturnRates {
  itemId: string;
  damageRate: number;
  expireRate: number;
  damageExpireRate: number;
  soundStockRate: number;
}

/** Which Return Price Setup rate a return reason uses ("Damaged", "Expired", "Packet Torn", …). */
export function returnRateFor(rates: ReturnRates, reason: string): number {
  const damaged = /damage|torn|broken|leak/i.test(reason);
  const expired = /expir/i.test(reason);
  if (damaged && expired) return rates.damageExpireRate;
  if (damaged) return rates.damageRate;
  if (expired) return rates.expireRate;
  return rates.soundStockRate;
}
