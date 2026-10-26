/** BOM arithmetic shared by the form (live totals) and the service (stored totals). */

export const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
export const round4 = (value: number) => Math.round((value + Number.EPSILON) * 10_000) / 10_000;

/** Quantity including wastage: qty × (1 + wastage %). */
export function totalQty(qty: number, wastagePercent: number): number {
  return round4(qty * (1 + wastagePercent / 100));
}

/** Cost of one material line: total quantity × rate. */
export function materialAmount(qty: number, wastagePercent: number, rate: number): number {
  return round2(totalQty(qty, wastagePercent) * rate);
}

/** Quantity in the alternative unit (alt unit holds `factor` base units). */
export function altQty(qty: number, factor: number | null | undefined): number | null {
  return factor && factor > 0 ? round4(qty / factor) : null;
}

/** Weight of one output line: net weight × lot size. */
export function outputWeight(netWeight: number, lotSizeQty: number): number {
  return round4(netWeight * lotSizeQty);
}

/** Overhead of one lot: material cost × percentage when a percentage is set, else the entered amount. */
export function overheadAmount(materialCost: number, percentage: number | null | undefined, amount: number): number {
  return percentage !== null && percentage !== undefined ? round2((materialCost * percentage) / 100) : round2(amount);
}

/**
 * Expected wastage / by-product quantity of one lot: ratio % of the production items' total
 * net weight (`calcWithNetWeight`) or of the input material quantity after wastage.
 */
export function wastageQty(ratioPercent: number, calcWithNetWeight: boolean, base: { outputWeight: number; materialTotalQty: number }): number {
  return round4(((calcWithNetWeight ? base.outputWeight : base.materialTotalQty) * ratioPercent) / 100);
}

export interface BomTotals {
  materialCost: number;
  overheadCost: number;
  totalCost: number;
  /** Raw material quantity before / after wastage. */
  materialQty: number;
  materialTotalQty: number;
  /** Total net weight of the production items (net weight × lot size). */
  outputWeight: number;
  lotSize: number;
}

export function bomTotals(
  materials: readonly { qty: number; wastagePercent: number; rate: number }[],
  overheads: readonly { amount: number; percentage?: number | null }[],
  outputs: readonly { lotSizeQty: number; netWeight?: number }[],
): BomTotals {
  const materialCost = round2(materials.reduce((sum, line) => sum + materialAmount(line.qty, line.wastagePercent, line.rate), 0));
  const overheadCost = round2(overheads.reduce((sum, line) => sum + overheadAmount(materialCost, line.percentage, line.amount), 0));
  return {
    materialCost,
    overheadCost,
    totalCost: round2(materialCost + overheadCost),
    materialQty: round4(materials.reduce((sum, line) => sum + line.qty, 0)),
    materialTotalQty: round4(materials.reduce((sum, line) => sum + totalQty(line.qty, line.wastagePercent), 0)),
    outputWeight: round4(outputs.reduce((sum, line) => sum + outputWeight(line.netWeight ?? 0, line.lotSizeQty), 0)),
    lotSize: round4(outputs.reduce((sum, line) => sum + line.lotSizeQty, 0)) || 1,
  };
}
