import { round2 } from "../../quotations/lib/totals";

/** Amount of `qty` units at `rate`, split into base and VAT (shared by the form and the server). */
export function returnLineAmounts(qty: number, rate: number, vatPercent: number, priceIncludesVat: boolean) {
  const gross = round2(qty * rate);
  if (priceIncludesVat) {
    const baseAmount = round2(gross / (1 + vatPercent / 100));
    return { baseAmount, vatAmount: round2(gross - baseAmount), amount: gross };
  }
  const vatAmount = round2((gross * vatPercent) / 100);
  return { baseAmount: gross, vatAmount, amount: round2(gross + vatAmount) };
}

/** Share of a delivery's header discount given back for `returnedValue` of its `itemsTotal`. */
export function discountShare(deliveryDiscount: number, deliveryItemsTotal: number, returnedValue: number): number {
  if (deliveryItemsTotal <= 0) return 0;
  return Math.min(returnedValue, round2((deliveryDiscount * returnedValue) / deliveryItemsTotal));
}
