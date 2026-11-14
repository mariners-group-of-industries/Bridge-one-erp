/**
 * Purchase business rules with no database access, so they are unit-tested
 * directly: line pricing, document status transitions, and how much of an
 * order may still be received or of a receipt may still be returned.
 */

export const round2 = (value: number) => Math.round(value * 100) / 100;
export const round3 = (value: number) => Math.round(value * 1000) / 1000;

export interface PricedLine {
  gross: number;
  discount: number;
  tax: number;
  lineTotal: number;
}

/** qty × rate, less the discount %, plus VAT % on the discounted amount. */
export function priceLine(qty: number, rate: number, discountPercent = 0, vatPercent = 0): PricedLine {
  const gross = round2(qty * rate);
  const discount = round2((gross * clampPercent(discountPercent)) / 100);
  const tax = round2(((gross - discount) * clampPercent(vatPercent)) / 100);
  return { gross, discount, tax, lineTotal: round2(gross - discount + tax) };
}

function clampPercent(value: number) {
  return Number.isFinite(value) ? Math.min(100, Math.max(0, value)) : 0;
}

export interface OrderTotals {
  subtotal: number;
  totalDiscount: number;
  totalTax: number;
  totalAmount: number;
}

export function orderTotals(lines: PricedLine[], shippingFee = 0): OrderTotals {
  const sum = (pick: (l: PricedLine) => number) => round2(lines.reduce((acc, l) => acc + pick(l), 0));
  const shipping = Number.isFinite(shippingFee) && shippingFee > 0 ? shippingFee : 0;
  return {
    subtotal: sum((l) => l.gross),
    totalDiscount: sum((l) => l.discount),
    totalTax: sum((l) => l.tax),
    totalAmount: round2(sum((l) => l.lineTotal) + shipping),
  };
}

/** Cost of one unit as the supplier bills it: line total ÷ ordered quantity. */
export function effectiveUnitCost(lineTotal: number, qty: number): number {
  return qty > 0 ? round2(lineTotal / qty) : 0;
}

// ---------------------------------------------------------------------------
// Requisition workflow
// ---------------------------------------------------------------------------

export type RequisitionDbStatus = "DRAFT" | "PENDING" | "APPROVED" | "REJECTED" | "ORDERED" | "CANCELLED";
export type RequisitionAction = "APPROVE" | "REJECT" | "CANCEL" | "REVERSE";

const REQUISITION_TRANSITIONS: Record<RequisitionAction, { from: RequisitionDbStatus[]; to: RequisitionDbStatus }> = {
  APPROVE: { from: ["DRAFT", "PENDING"], to: "APPROVED" },
  REJECT: { from: ["DRAFT", "PENDING"], to: "REJECTED" },
  CANCEL: { from: ["DRAFT", "PENDING", "APPROVED", "REJECTED"], to: "CANCELLED" },
  REVERSE: { from: ["APPROVED", "REJECTED", "CANCELLED"], to: "PENDING" },
};

/** The status an action moves a requisition to, or an error message when it is not allowed. */
export function requisitionTransition(current: RequisitionDbStatus, action: RequisitionAction): { to: RequisitionDbStatus } | { error: string } {
  const rule = REQUISITION_TRANSITIONS[action];
  if (!rule) return { error: `Unknown requisition action '${action}'.` };
  if (current === "ORDERED") return { error: "A purchase order has been issued for this requisition; cancel the order first." };
  if (!rule.from.includes(current)) return { error: `A ${current.toLowerCase()} requisition cannot be ${pastTense(action)}.` };
  return { to: rule.to };
}

/** Requisitions can be edited until they are approved. */
export function requisitionEditable(status: RequisitionDbStatus): boolean {
  return status === "DRAFT" || status === "PENDING" || status === "REJECTED";
}

// ---------------------------------------------------------------------------
// Purchase order workflow
// ---------------------------------------------------------------------------

export type OrderDbStatus = "DRAFT" | "PENDING" | "APPROVED" | "PARTIAL_RECEIVED" | "RECEIVED" | "CLOSED" | "CANCELLED";
export type OrderAction = "APPROVE" | "CLOSE" | "CANCEL" | "REVERSE";

export interface OrderLineProgress {
  ordered: number;
  received: number;
}

/** Receiving status from the lines: nothing in, some in, or everything in. */
export function receivingStatus(lines: OrderLineProgress[]): "APPROVED" | "PARTIAL_RECEIVED" | "RECEIVED" {
  const anyReceived = lines.some((l) => l.received > 0);
  if (!anyReceived) return "APPROVED";
  return lines.every((l) => l.received + 1e-9 >= l.ordered) ? "RECEIVED" : "PARTIAL_RECEIVED";
}

export function orderTransition(
  current: OrderDbStatus,
  action: OrderAction,
  lines: OrderLineProgress[],
): { to: OrderDbStatus } | { error: string } {
  const anyReceived = lines.some((l) => l.received > 0);
  switch (action) {
    case "APPROVE":
      if (current === "DRAFT" || current === "PENDING") return { to: "APPROVED" };
      return { error: `A ${label(current)} order cannot be approved.` };
    case "CLOSE":
      // Short-close: stop waiting for the rest of a partly received order.
      if (current === "APPROVED" || current === "PARTIAL_RECEIVED") return { to: "CLOSED" };
      return { error: `A ${label(current)} order cannot be closed.` };
    case "CANCEL":
      if (anyReceived) return { error: "Goods have been received against this order; close it instead of cancelling." };
      if (current === "CANCELLED" || current === "CLOSED" || current === "RECEIVED") return { error: `A ${label(current)} order cannot be cancelled.` };
      return { to: "CANCELLED" };
    case "REVERSE":
      if (current === "CLOSED") return { to: receivingStatus(lines) };
      if (current === "APPROVED" && !anyReceived) return { to: "PENDING" };
      return { error: `A ${label(current)} order cannot be reversed.` };
    default:
      return { error: `Unknown order action '${action as string}'.` };
  }
}

/** Orders can be edited until goods are received against them. */
export function orderEditable(status: OrderDbStatus, lines: OrderLineProgress[]): boolean {
  return (status === "DRAFT" || status === "PENDING" || status === "APPROVED") && !lines.some((l) => l.received > 0);
}

export function orderReceivable(status: OrderDbStatus): boolean {
  return status === "APPROVED" || status === "PARTIAL_RECEIVED";
}

// ---------------------------------------------------------------------------
// Receiving and returns
// ---------------------------------------------------------------------------

export interface ReceiptLineCheck {
  itemName: string;
  outstanding: number;
  received: number;
  rejected: number;
}

/** Message for the first line that receives more than is outstanding or rejects more than arrived. */
export function receiptLineError(line: ReceiptLineCheck): string | null {
  if (!(line.received > 0)) return null;
  if (line.rejected < 0 || line.rejected > line.received) return `${line.itemName}: rejected quantity cannot exceed the received quantity.`;
  const accepted = line.received - line.rejected;
  if (accepted > line.outstanding + 1e-9) {
    return `${line.itemName}: only ${round3(line.outstanding)} is still due on the order, ${round3(accepted)} was entered.`;
  }
  return null;
}

/** Remaining returnable quantity per item: accepted on the receipt less what was already returned. */
export function returnableByItem(
  acceptedLines: { itemKey: string; qty: number }[],
  returnedLines: { itemKey: string; qty: number }[],
): Map<string, number> {
  const left = new Map<string, number>();
  for (const l of acceptedLines) left.set(l.itemKey, round3((left.get(l.itemKey) ?? 0) + l.qty));
  for (const l of returnedLines) left.set(l.itemKey, round3((left.get(l.itemKey) ?? 0) - l.qty));
  return left;
}

function pastTense(action: RequisitionAction) {
  return { APPROVE: "approved", REJECT: "rejected", CANCEL: "cancelled", REVERSE: "reversed" }[action];
}

function label(status: OrderDbStatus) {
  return status.toLowerCase().replace("_", " ");
}

/**
 * Appends an audit note ("[<time> APPROVED by X] comment") to existing notes,
 * within the column limit. When the column is full the oldest audit lines are
 * dropped first, so the free-text part (justification, notes) is kept.
 */
export function appendNote(existing: string | null | undefined, entry: string, limit = 1000): string {
  const lines = [...(existing ? existing.split("\n") : []), entry];
  const length = () => lines.reduce((n, l) => n + l.length, 0) + lines.length - 1;
  while (length() > limit) {
    const oldestAudit = lines.findIndex((l, i) => i < lines.length - 1 && l.startsWith("["));
    if (oldestAudit < 0) break;
    lines.splice(oldestAudit, 1);
  }
  const next = lines.join("\n");
  return next.length > limit ? next.slice(next.length - limit) : next;
}

export interface ApprovalStageRule {
  allowThreshold: boolean;
  thresholdMin: number | null;
  thresholdMax: number | null;
  /** Business units configured on stage approvers (null = any BU). */
  approverBuIds: (string | null)[];
  /** Business units for which the current actor is an approver in this stage (null = any BU). */
  actorBuIds: (string | null)[];
}

export interface ApprovalRightsSummary {
  unrestricted: boolean;
  stages: ApprovalStageRule[];
}

const matchesThreshold = (stage: ApprovalStageRule, amount: number) =>
  !stage.allowThreshold ||
  ((stage.thresholdMin === null || amount >= stage.thresholdMin) &&
    (stage.thresholdMax === null || amount <= stage.thresholdMax));

const matchesBu = (buList: (string | null)[], businessUnitId?: string | null) =>
  buList.some((bu) => !bu || !businessUnitId || bu === businessUnitId);

/**
 * Pure check matching backend assertApprovalPipeline:
 * Returns true when unrestricted OR no matching stage designates approvers for the BU OR actor is in one.
 */
export function canApproveWithSummary(
  summary: ApprovalRightsSummary | undefined,
  businessUnitId: string | null | undefined,
  amount: number,
): boolean {
  if (!summary || summary.unrestricted) return true;
  if (summary.stages.length === 0) return true;
  const matching = summary.stages.filter((s) => matchesThreshold(s, amount));
  if (matching.length === 0) return false;
  const hasAnyApproverForBu = matching.some((s) => matchesBu(s.approverBuIds, businessUnitId));
  if (!hasAnyApproverForBu) return true;
  return matching.some((s) => matchesBu(s.actorBuIds, businessUnitId));
}
