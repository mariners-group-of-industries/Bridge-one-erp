import { round2 } from "../../quotations/lib/totals";

export interface OrderLineInput {
  qty: number;
  unitPrice: number;
  discountPercent: number;
  vatPercent: number;
  aitPercent: number;
}

export interface OrderLineAmounts {
  /** qty × unit price. */
  grossAmount: number;
  /** Unit price after the line discount. */
  netUnitPrice: number;
  /** What the customer pays for the line (VAT/AIT included). */
  lineTotal: number;
  /** Value without VAT/AIT. */
  baseAmount: number;
  vatAmount: number;
  aitAmount: number;
}

/**
 * One order line. With VAT-inclusive prices the taxes are carved out of the
 * discounted amount; otherwise they are added on top of it.
 */
export function orderLineAmounts(line: OrderLineInput, priceIncludesVat: boolean): OrderLineAmounts {
  const grossAmount = round2(line.qty * line.unitPrice);
  const net = round2(grossAmount * (1 - line.discountPercent / 100));
  const netUnitPrice = Math.round(line.unitPrice * (1 - line.discountPercent / 100) * 10_000) / 10_000;
  if (priceIncludesVat) {
    const baseAmount = round2(net / (1 + (line.vatPercent + line.aitPercent) / 100));
    const vatAmount = round2((baseAmount * line.vatPercent) / 100);
    // Whatever is left is AIT, so base + VAT + AIT always equals the line total.
    const aitAmount = round2(net - baseAmount - vatAmount);
    return { grossAmount, netUnitPrice, lineTotal: net, baseAmount, vatAmount, aitAmount };
  }
  const vatAmount = round2((net * line.vatPercent) / 100);
  const aitAmount = round2((net * line.aitPercent) / 100);
  return { grossAmount, netUnitPrice, lineTotal: round2(net + vatAmount + aitAmount), baseAmount: net, vatAmount, aitAmount };
}

export interface OrderCharges {
  priceIncludesVat: boolean;
  discountAmount: number;
  deliveryCharge: number;
  unloadingCharge: number;
}

export interface OrderTotals {
  lines: OrderLineAmounts[];
  totalQty: number;
  itemsTotal: number;
  itemsBase: number;
  vatAmount: number;
  aitAmount: number;
  /** Header discount, capped at the items total. */
  discountAmount: number;
  deliveryCharge: number;
  unloadingCharge: number;
  /** itemsTotal − discount + delivery + unloading. */
  salesTotal: number;
}

/** Order totals; shared by the form (live preview) and the server (stored values). */
export function orderTotals(lines: readonly OrderLineInput[], charges: OrderCharges): OrderTotals {
  const amounts = lines.map((line) => orderLineAmounts(line, charges.priceIncludesVat));
  const sum = (pick: (line: OrderLineAmounts) => number) => round2(amounts.reduce((total, line) => total + pick(line), 0));
  const itemsTotal = sum((line) => line.lineTotal);
  const discountAmount = round2(Math.min(Math.max(charges.discountAmount, 0), itemsTotal));
  const deliveryCharge = round2(Math.max(charges.deliveryCharge, 0));
  const unloadingCharge = round2(Math.max(charges.unloadingCharge, 0));
  return {
    lines: amounts,
    totalQty: Math.round(lines.reduce((total, line) => total + line.qty, 0) * 1000) / 1000,
    itemsTotal,
    itemsBase: sum((line) => line.baseAmount),
    vatAmount: sum((line) => line.vatAmount),
    aitAmount: sum((line) => line.aitAmount),
    discountAmount,
    deliveryCharge,
    unloadingCharge,
    salesTotal: round2(itemsTotal - discountAmount + deliveryCharge + unloadingCharge),
  };
}

/** Quantity in the larger packing unit (e.g. 480 Pcs at 24/Ctn → 20 Ctn). */
export function altQty(qty: number, altUomFactor: number | null): number | null {
  return altUomFactor ? Math.round((qty / altUomFactor) * 1000) / 1000 : null;
}
