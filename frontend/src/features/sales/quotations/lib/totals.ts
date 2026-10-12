/** Rounds to paisa (2 decimals) the way the database stores amounts. */
export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export interface LineInput {
  qty: number;
  rate: number;
  discountPercent: number;
}

export interface QuotationTotals {
  lineAmounts: number[];
  totalQty: number;
  subTotal: number;
  discountAmount: number;
  vatAmount: number;
  grandTotal: number;
}

/** Line amount after its own discount. */
export function lineAmount({ qty, rate, discountPercent }: LineInput): number {
  return round2(qty * rate * (1 - discountPercent / 100));
}

/**
 * Quotation totals. VAT applies to the subtotal after the header discount.
 * Shared by the form (live preview) and the server (the stored values).
 */
export function quotationTotals(lines: readonly LineInput[], discountAmount: number, vatPercent: number): QuotationTotals {
  const lineAmounts = lines.map(lineAmount);
  const subTotal = round2(lineAmounts.reduce((sum, amount) => sum + amount, 0));
  const discount = round2(Math.min(Math.max(discountAmount, 0), subTotal));
  const vatAmount = round2(((subTotal - discount) * vatPercent) / 100);
  return {
    lineAmounts,
    totalQty: Math.round(lines.reduce((sum, line) => sum + line.qty, 0) * 1000) / 1000,
    subTotal,
    discountAmount: discount,
    vatAmount,
    grandTotal: round2(subTotal - discount + vatAmount),
  };
}
