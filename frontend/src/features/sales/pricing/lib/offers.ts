// Offer Setup rules applied to the paid lines of a quotation or order. Pure: the
// service loads the offers that fit the customer and date, this works out the result.

export type OfferRule =
  | { kind: "ITEM"; name: string; lines: { sellingItemId: string; sellingQty: number; offerItemId: string; offerQty: number }[] }
  | {
      kind: "ITEM_MULTIPLE";
      name: string;
      /**
       * Each pair stands alone: buying `quantity` of its items (one item, or every item of a
       * category for "All", counted together) within min/max earns its bonus per whole multiple.
       */
      pairs: {
        itemIds: string[];
        quantity: number;
        minQty: number | null;
        maxQty: number | null;
        bonus: { itemId: string; quantity: number }[];
      }[];
    }
  | {
      kind: "DISCOUNT";
      name: string;
      lines: {
        itemId: string;
        discountType: string;
        amount: number;
        quantity: number | null;
        minQty: number | null;
        maxQty: number | null;
        isRecurrent: boolean;
      }[];
    }
  | { kind: "SPECIAL_DISCOUNT"; name: string; lines: { discountType: string; amount: number; fromAmount: number | null; toAmount: number | null }[] };

export interface PaidLine {
  itemId: string;
  qty: number;
  unitPrice: number;
  discountPercent: number;
}

export interface ComputedOffers {
  free: { itemId: string; qty: number; offerName: string }[];
  discounts: { itemId: string; percent: number; offerName: string }[];
  invoiceDiscount: number;
  invoiceOfferName: string | null;
  freeItemIds: string[];
}

const EPS = 1e-9;
const round2 = (value: number) => Math.round(value * 100) / 100;
const round3 = (value: number) => Math.round(value * 1000) / 1000;
const within = (qty: number, min: number | null, max: number | null) => (min === null || qty >= min - EPS) && (max === null || qty <= max + EPS);
/** Whole multiples of `step` in `qty` (an offer's "buy N"). */
const sets = (qty: number, step: number) => (step > 0 ? Math.floor(qty / step + EPS) : 0);

/** Item-wise discount in Tk for `qty` units under one discount row. */
function rowDiscount(row: Extract<OfferRule, { kind: "DISCOUNT" }>["lines"][number], qty: number, unitPrice: number): number {
  if (!within(qty, row.minQty, row.maxQty)) return 0;
  if (row.discountType === "PERCENT") return (qty * unitPrice * row.amount) / 100;
  if (row.quantity === null) return qty * row.amount;
  const times = row.isRecurrent ? sets(qty, row.quantity) : qty >= row.quantity - EPS ? 1 : 0;
  return times * row.amount;
}

export function computeOffers(rules: readonly OfferRule[], lines: readonly PaidLine[]): ComputedOffers {
  const qtyOf = new Map<string, number>();
  const priceOf = new Map<string, number>();
  for (const line of lines) {
    qtyOf.set(line.itemId, (qtyOf.get(line.itemId) ?? 0) + line.qty);
    if (!priceOf.has(line.itemId)) priceOf.set(line.itemId, line.unitPrice);
  }

  const free = new Map<string, { qty: number; offerName: string }>();
  const addFree = (itemId: string, qty: number, offerName: string) => {
    if (qty <= 0) return;
    const current = free.get(itemId);
    const names = current && !current.offerName.split(", ").includes(offerName) ? `${current.offerName}, ${offerName}` : (current?.offerName ?? offerName);
    free.set(itemId, { qty: round3((current?.qty ?? 0) + qty), offerName: names });
  };
  const freeItemIds = new Set<string>();
  const best = new Map<string, { percent: number; offerName: string }>();

  for (const rule of rules) {
    if (rule.kind === "ITEM") {
      for (const row of rule.lines) {
        freeItemIds.add(row.offerItemId);
        addFree(row.offerItemId, sets(qtyOf.get(row.sellingItemId) ?? 0, row.sellingQty) * row.offerQty, rule.name);
      }
    } else if (rule.kind === "ITEM_MULTIPLE") {
      for (const pair of rule.pairs) {
        for (const row of pair.bonus) freeItemIds.add(row.itemId);
        const qty = pair.itemIds.reduce((sum, itemId) => sum + (qtyOf.get(itemId) ?? 0), 0);
        const times = within(qty, pair.minQty, pair.maxQty) ? sets(qty, pair.quantity) : 0;
        for (const row of pair.bonus) addFree(row.itemId, times * row.quantity, rule.name);
      }
    } else if (rule.kind === "DISCOUNT") {
      for (const row of rule.lines) {
        const qty = qtyOf.get(row.itemId) ?? 0;
        const unitPrice = priceOf.get(row.itemId) ?? 0;
        const gross = qty * unitPrice;
        if (gross <= 0) continue;
        const percent = Math.min(round2((rowDiscount(row, qty, unitPrice) / gross) * 100), 100);
        if (percent > (best.get(row.itemId)?.percent ?? 0)) best.set(row.itemId, { percent, offerName: rule.name });
      }
    }
  }

  // Invoice discount on the items total after line discounts (user's or offer's, whichever is larger).
  const itemsTotal = lines.reduce((sum, line) => {
    const percent = Math.max(line.discountPercent, best.get(line.itemId)?.percent ?? 0);
    return sum + line.qty * line.unitPrice * (1 - percent / 100);
  }, 0);
  let invoiceDiscount = 0;
  let invoiceOfferName: string | null = null;
  for (const rule of rules) {
    if (rule.kind !== "SPECIAL_DISCOUNT") continue;
    for (const row of rule.lines) {
      if (!within(itemsTotal, row.fromAmount, row.toAmount)) continue;
      const amount = Math.min(round2(row.discountType === "PERCENT" ? (itemsTotal * row.amount) / 100 : row.amount), round2(itemsTotal));
      if (amount > invoiceDiscount) {
        invoiceDiscount = amount;
        invoiceOfferName = rule.name;
      }
    }
  }

  return {
    free: [...free].map(([itemId, value]) => ({ itemId, ...value })),
    discounts: [...best].map(([itemId, value]) => ({ itemId, ...value })),
    invoiceDiscount,
    invoiceOfferName,
    freeItemIds: [...freeItemIds],
  };
}
