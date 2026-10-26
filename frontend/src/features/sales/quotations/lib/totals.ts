/** Rounds to paisa (2 decimals) the way the database stores amounts. */
export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export interface LineInput {
  qty: number;
  rate: number;
  discountPercent: number;
  vatPercent: number;
  aitPercent: number;
}

export interface LineFigures {
  /** qty × rate. */
  base: number;
  discountAmount: number;
  vatAmount: number;
  aitAmount: number;
  /** Line total. */
  amount: number;
}

/**
 * One line: Base = qty × rate, Discount = Base × disc %, Taxable = Base − Discount,
 * VAT = Taxable × VAT %, AIT = Taxable × AIT %, Total = Taxable + VAT + AIT.
 * When prices include VAT the taxable amount is first taken out of them
 * (Taxable = (Base − Discount) ÷ (1 + VAT %)), so VAT is not charged twice.
 */
export function lineFigures(line: LineInput, includingVat: boolean): LineFigures {
  const base = round2(line.qty * line.rate);
  const discountAmount = round2((base * line.discountPercent) / 100);
  const afterDiscount = base - discountAmount;
  const taxable = includingVat ? afterDiscount / (1 + line.vatPercent / 100) : afterDiscount;
  const vatAmount = round2(includingVat ? afterDiscount - taxable : (taxable * line.vatPercent) / 100);
  const aitAmount = round2((taxable * line.aitPercent) / 100);
  return { base, discountAmount, vatAmount, aitAmount, amount: round2(taxable + vatAmount + aitAmount) };
}

export interface QuotationTotals {
  lines: LineFigures[];
  totalQty: number;
  subTotal: number;
  discountAmount: number;
  vatAmount: number;
  aitAmount: number;
  grandTotal: number;
}

/** Quotation totals: sums of the lines. Shared by the form (live preview) and the server (stored values). */
export function quotationTotals(lines: readonly LineInput[], includingVat: boolean): QuotationTotals {
  const figures = lines.map((line) => lineFigures(line, includingVat));
  const sum = (pick: (line: LineFigures) => number) => round2(figures.reduce((total, line) => total + pick(line), 0));
  return {
    lines: figures,
    totalQty: Math.round(lines.reduce((total, line) => total + line.qty, 0) * 1000) / 1000,
    subTotal: sum((line) => line.base),
    discountAmount: sum((line) => line.discountAmount),
    vatAmount: sum((line) => line.vatAmount),
    aitAmount: sum((line) => line.aitAmount),
    grandTotal: sum((line) => line.amount),
  };
}
