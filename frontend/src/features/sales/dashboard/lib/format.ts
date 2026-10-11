const amountFormat = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const qtyFormat = new Intl.NumberFormat("en-US", { maximumFractionDigits: 3 });

/** 1234567.5 → "1,234,567.50" */
export function formatAmount(value: number): string {
  return amountFormat.format(value);
}

export function formatQty(value: number): string {
  return qtyFormat.format(value);
}

/** Achieved share of a target as a whole percent; null when there is no target. */
export function percentOf(achieved: number, target: number): number | null {
  return target > 0 ? Math.round((achieved / target) * 100) : null;
}

