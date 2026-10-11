/**
 * BridgeOne ERP Purchase Precision Calculations
 * Handles financial calculations, discounts, taxes, document totals,
 * remaining quantities, and validation rules.
 */

export interface LineItemPricingInput {
  quantity: number;
  unitPrice: number;
  discountPercentage?: number;
  taxPercentage?: number;
}

export interface LineItemPricingResult {
  baseAmount: number;
  discountAmount: number;
  amountAfterDiscount: number;
  taxAmount: number;
  lineTotal: number;
}

/**
 * Rounds a number to exactly specified decimals (default 2)
 */
export function roundToDecimals(val: number, decimals: number = 2): number {
  const factor = Math.pow(10, decimals);
  return Math.round((val + Number.EPSILON) * factor) / factor;
}

/**
 * Calculate precise line item amounts: base, discount, tax, and final line total
 */
export function calculateLinePricing(item: LineItemPricingInput): LineItemPricingResult {
  const qty = Math.max(0, item.quantity);
  const price = Math.max(0, item.unitPrice);
  const baseAmount = roundToDecimals(qty * price);

  const discountPct = Math.min(100, Math.max(0, item.discountPercentage || 0));
  const discountAmount = roundToDecimals((baseAmount * discountPct) / 100);
  const amountAfterDiscount = roundToDecimals(baseAmount - discountAmount);

  const taxPct = Math.min(100, Math.max(0, item.taxPercentage || 0));
  const taxAmount = roundToDecimals((amountAfterDiscount * taxPct) / 100);

  const lineTotal = roundToDecimals(amountAfterDiscount + taxAmount);

  return {
    baseAmount,
    discountAmount,
    amountAfterDiscount,
    taxAmount,
    lineTotal,
  };
}

export interface DocumentTotalsInput {
  items: Array<{
    quantity: number;
    unitPrice: number;
    discountPercentage?: number;
    taxPercentage?: number;
  }>;
  shippingFee?: number;
  extraDiscount?: number;
}

export interface DocumentTotalsResult {
  subtotal: number;
  totalDiscount: number;
  totalTax: number;
  shippingFee: number;
  grandTotal: number;
}

/**
 * Calculate document subtotal, discounts, tax, and grand total
 */
export function calculateDocumentTotals(doc: DocumentTotalsInput): DocumentTotalsResult {
  let subtotal = 0;
  let totalDiscount = 0;
  let totalTax = 0;

  for (const item of doc.items) {
    const calc = calculateLinePricing(item);
    subtotal += calc.baseAmount;
    totalDiscount += calc.discountAmount;
    totalTax += calc.taxAmount;
  }

  const shipping = roundToDecimals(Math.max(0, doc.shippingFee || 0));
  const extraDisc = roundToDecimals(Math.max(0, doc.extraDiscount || 0));
  totalDiscount = roundToDecimals(totalDiscount + extraDisc);

  const grandTotal = roundToDecimals(
    Math.max(0, subtotal - totalDiscount + totalTax + shipping)
  );

  return {
    subtotal: roundToDecimals(subtotal),
    totalDiscount: roundToDecimals(totalDiscount),
    totalTax: roundToDecimals(totalTax),
    shippingFee: shipping,
    grandTotal,
  };
}

/**
 * Calculate remaining receive quantity for a PO line
 */
export function calculateRemainingReceiptQty(
  orderedQty: number,
  alreadyReceivedQty: number,
  alreadyReturnedQty: number = 0
): number {
  const remaining = orderedQty - alreadyReceivedQty + alreadyReturnedQty;
  return Math.max(0, roundToDecimals(remaining, 3));
}

/**
 * Validates a goods receipt request against ordered quantities
 */
export function validateReceiptLineQuantity(
  orderedQty: number,
  previouslyReceivedQty: number,
  currentReceivedQty: number,
  previouslyReturnedQty: number = 0
): { isValid: boolean; maxAllowed: number; error?: string } {
  const maxAllowed = calculateRemainingReceiptQty(
    orderedQty,
    previouslyReceivedQty,
    previouslyReturnedQty
  );

  if (currentReceivedQty < 0) {
    return {
      isValid: false,
      maxAllowed,
      error: "Received quantity cannot be negative.",
    };
  }

  if (currentReceivedQty > maxAllowed) {
    return {
      isValid: false,
      maxAllowed,
      error: `Received quantity (${currentReceivedQty}) exceeds outstanding allowable quantity (${maxAllowed}).`,
    };
  }

  return { isValid: true, maxAllowed };
}

/**
 * Calculate eligible return quantity for an item from a receipt
 */
export function calculateEligibleReturnQty(
  receivedQty: number,
  previouslyReturnedQty: number
): number {
  const eligible = receivedQty - previouslyReturnedQty;
  return Math.max(0, roundToDecimals(eligible, 3));
}

/**
 * Validates return quantity
 */
export function validateReturnLineQuantity(
  receivedQty: number,
  previouslyReturnedQty: number,
  returnQty: number
): { isValid: boolean; maxAllowed: number; error?: string } {
  const maxAllowed = calculateEligibleReturnQty(receivedQty, previouslyReturnedQty);

  if (returnQty <= 0) {
    return {
      isValid: false,
      maxAllowed,
      error: "Return quantity must be greater than 0.",
    };
  }

  if (returnQty > maxAllowed) {
    return {
      isValid: false,
      maxAllowed,
      error: `Return quantity (${returnQty}) exceeds eligible returnable quantity (${maxAllowed}).`,
    };
  }

  return { isValid: true, maxAllowed };
}

/**
 * Formats a currency number with standard 2 decimal places and comma separators
 */
export function formatCurrency(amount: number, currency: string = "BDT"): string {
  const rounded = roundToDecimals(amount, 2);
  return `${currency} ${rounded.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
