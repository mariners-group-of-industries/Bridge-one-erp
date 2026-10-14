import { z } from "zod";
import { optionalText } from "@/lib/validation/fields";
import type { DeliveryType } from "../../deliveries/schemas/delivery.schema";

// ─── Enums ───────────────────────────────────────────────────────────────────

/** "Type" on the list: back into a warehouse, or collected from the market (factory receives + QC). */
export const RETURN_KINDS = ["SALES", "MARKET"] as const;
export type ReturnKind = (typeof RETURN_KINDS)[number];
export const RETURN_KIND_LABELS: Record<ReturnKind, string> = { SALES: "Sales Return", MARKET: "Market Return" };

/** "Return Type" on the list: how the return refers to a delivery. */
export const RETURN_MODES = ["FULL", "PARTIAL", "WITHOUT_REFERENCE", "EXCHANGE"] as const;
export type ReturnMode = (typeof RETURN_MODES)[number];
export const RETURN_MODE_LABELS: Record<ReturnMode, string> = {
  FULL: "Full Return",
  PARTIAL: "Partial Return",
  WITHOUT_REFERENCE: "Return Without Reference",
  EXCHANGE: "Exchange",
};

/** DRAFT waits for approval; SUBMITTED is approved (credits the customer); CANCELLED is deleted. */
export const RETURN_STATUSES = ["DRAFT", "SUBMITTED", "CANCELLED"] as const;
export type ReturnStatus = (typeof RETURN_STATUSES)[number];
export const RETURN_STATUS_LABELS: Record<ReturnStatus, string> = { DRAFT: "Pending", SUBMITTED: "Approved", CANCELLED: "Deleted" };

/** Where a market return is in its flow. */
export type MarketStage = "PENDING" | "APPROVED" | "FACTORY_RECEIVED" | "QC_DONE" | "DELETED";
export const MARKET_STAGE_LABELS: Record<MarketStage, string> = {
  PENDING: "Pending",
  APPROVED: "Approved",
  FACTORY_RECEIVED: "Factory Received",
  QC_DONE: "QC Done",
  DELETED: "Deleted",
};

// ─── Input ───────────────────────────────────────────────────────────────────

const MAX_AMOUNT = 999_999_999_999;
const MAX_LINES = 300;
const isoDate = (label: string) => z.iso.date({ error: `${label} is required.` });
const money = (label: string) =>
  z.number({ error: `${label} must be a number.` }).min(0, `${label} cannot be negative.`).max(MAX_AMOUNT);
const qty = z.number({ error: "Quantity must be a number." }).gt(0, "Quantity must be more than 0.").max(MAX_AMOUNT);
const optionalId = z.uuid().nullish().transform((value) => value ?? null);
const version = z.iso.datetime({ error: "Reload the return and try again." });

const headerFields = {
  officeId: z.uuid({ error: "Select an office." }),
  warehouseId: z.uuid({ error: "Select a warehouse." }),
  returnDate: isoDate("Return date"),
  salesPersonId: optionalId,
  /** Return Reason (header). */
  reason: optionalText("Return reason", 500),
  refNo: optionalText("Return ref. no", 60),
  refDate: z.iso.date().nullish().transform((value) => value ?? null),
  refAmount: money("Return ref. amount").nullish().transform((value) => value ?? null),
  requestNo: optionalText("Return req. no", 60),
  remarks: optionalText("Remarks", 500),
};

const lineReason = optionalText("Return reason", 100);

/** Full or partial return of a delivery: quantities per delivery line. */
export const referencedReturnSchema = z.object({
  mode: z.enum(["FULL", "PARTIAL"]),
  deliveryId: z.uuid({ error: "Select a delivery." }),
  ...headerFields,
  lines: z
    .array(z.object({ deliveryLineId: z.uuid(), qty, reason: lineReason }))
    .min(1, "Enter a return quantity for at least one item.")
    .max(MAX_LINES),
});

/** Return without a delivery: items and prices entered by hand. */
export const withoutReferenceSchema = z.object({
  mode: z.literal("WITHOUT_REFERENCE"),
  kind: z.enum(RETURN_KINDS),
  customerId: z.uuid({ error: "Select a customer." }),
  priceIncludesVat: z.boolean(),
  withoutInvoice: z.boolean(),
  shippingAddress: optionalText("Shipping address", 500),
  ...headerFields,
  lines: z
    .array(
      z.object({
        itemId: z.uuid({ error: "Select an item." }),
        qty,
        rate: money("Return price"),
        vatPercent: z.number({ error: "VAT % must be a number." }).min(0, "VAT % cannot be negative.").max(100, "VAT % can be at most 100."),
        reason: lineReason,
      }),
    )
    .min(1, "Add at least one item.")
    .max(MAX_LINES, `At most ${MAX_LINES} items.`),
});

export const returnInputSchema = z.discriminatedUnion("mode", [referencedReturnSchema, withoutReferenceSchema]);
export type ReturnInput = z.input<typeof returnInputSchema>;
export type ReferencedReturnInput = z.input<typeof referencedReturnSchema>;
export type WithoutReferenceInput = z.input<typeof withoutReferenceSchema>;

export const returnUpdateSchema = z.object({ version, data: returnInputSchema });
export const returnVersionSchema = z.object({ version });
export const returnDeleteSchema = z.object({
  version,
  reason: optionalText("Reason", 500).refine((value) => value !== null, "Enter why the return is deleted."),
});

/** Market returns: what the factory received, then what passed QC (per return line). */
export const factoryReceiveSchema = z.object({
  version,
  lines: z.array(z.object({ lineId: z.uuid(), qty: z.number({ error: "Quantity must be a number." }).min(0, "Quantity cannot be negative.").max(MAX_AMOUNT) })).min(1),
});

const optionalUuid = z.uuid().optional();
const validRange = (query: { from?: string; to?: string }) => !query.from || !query.to || query.from <= query.to;
const rangeMessage = { error: "From Date must be on or before To Date.", path: ["to"] };

export const returnableDeliveryQuerySchema = z
  .object({ officeId: optionalUuid, customerId: optionalUuid, from: z.iso.date().optional(), to: z.iso.date().optional() })
  .refine(validRange, rangeMessage);
export type ReturnableDeliveryQuery = z.infer<typeof returnableDeliveryQuerySchema>;

export const returnListQuerySchema = z
  .object({
    kind: z.enum(RETURN_KINDS).optional(),
    mode: z.enum(RETURN_MODES).optional(),
    status: z.enum(RETURN_STATUSES).optional(),
    officeId: optionalUuid,
    customerGroupId: optionalUuid,
    territoryId: optionalUuid,
    salesPersonId: optionalUuid,
    from: z.iso.date().optional(),
    to: z.iso.date().optional(),
  })
  .refine(validRange, rangeMessage);
export type ReturnListQuery = z.input<typeof returnListQuerySchema>;

// ─── DTOs ────────────────────────────────────────────────────────────────────

/** Delivery List tab: a delivery and how much of it came back. */
export interface ReturnableDeliveryRow {
  id: string;
  number: string;
  challanNo: string | null;
  deliveryType: DeliveryType;
  deliveryDate: string;
  orderNumber: string | null;
  customerCode: string;
  customerName: string;
  salesPersonName: string | null;
  deliveredQty: number;
  /** On pending and approved returns. */
  returnedQty: number;
  totalAmount: number;
}

export interface DeliveryForReturnLine {
  deliveryLineId: string;
  itemId: string;
  itemCode: string;
  itemName: string;
  uom: string | null;
  deliveredQty: number;
  /** On other pending and approved returns. */
  returnedQty: number;
  /** deliveredQty − returnedQty. */
  returnable: number;
  rate: number;
  vatPercent: number;
  /** Line total of the delivered quantity (VAT/AIT included, after line discount). */
  amount: number;
}

export interface DeliveryForReturn {
  id: string;
  number: string;
  challanNo: string | null;
  deliveryDate: string;
  businessUnitId: string;
  officeId: string;
  officeName: string;
  warehouseId: string | null;
  customerId: string;
  customerCode: string;
  customerName: string;
  salesPersonId: string | null;
  salesPersonName: string | null;
  priceIncludesVat: boolean;
  refProjectOutlet: string | null;
  itemsTotal: number;
  discountAmount: number;
  lines: DeliveryForReturnLine[];
}

export interface ReturnListRow {
  id: string;
  number: string;
  kind: ReturnKind;
  mode: ReturnMode;
  status: ReturnStatus;
  marketStage: MarketStage;
  returnDate: string;
  deliveryId: string | null;
  deliveryNumber: string | null;
  officeName: string | null;
  customerCode: string;
  customerName: string;
  refProjectOutlet: string | null;
  refNo: string | null;
  requestNo: string | null;
  totalQty: number;
  receivedQty: number;
  qcQty: number;
  totalAmount: number;
  salesPersonName: string | null;
  territory: string | null;
  updatedAt: string;
}

export interface ReturnList {
  rows: ReturnListRow[];
  totalCount: number;
  totalQty: number;
  totalAmount: number;
}

export interface ReturnLine {
  id: string;
  lineNo: number;
  itemId: string;
  itemCode: string;
  itemName: string;
  deliveryLineId: string | null;
  uom: string | null;
  qty: number;
  rate: number;
  vatPercent: number;
  baseAmount: number;
  vatAmount: number;
  aitAmount: number;
  amount: number;
  reason: string | null;
  receivedQty: number | null;
  qcQty: number | null;
}

export interface ReturnDetail {
  id: string;
  number: string;
  kind: ReturnKind;
  mode: ReturnMode;
  status: ReturnStatus;
  marketStage: MarketStage;
  businessUnitId: string;
  companyName: string;
  officeId: string | null;
  officeName: string | null;
  officeAddress: string | null;
  warehouseId: string | null;
  warehouseName: string | null;
  deliveryId: string | null;
  deliveryNumber: string | null;
  challanNo: string | null;
  /** Exchange returns: the delivery that took the goods back. */
  exchangeDeliveryId: string | null;
  customerId: string;
  customerCode: string;
  customerName: string;
  customerPhone: string | null;
  customerAddress: string | null;
  customerGroup: string | null;
  territory: string | null;
  salesPersonId: string | null;
  salesPersonName: string | null;
  returnDate: string;
  priceIncludesVat: boolean;
  withoutInvoice: boolean;
  shippingAddress: string | null;
  refProjectOutlet: string | null;
  refNo: string | null;
  refDate: string | null;
  refAmount: number | null;
  requestNo: string | null;
  reason: string | null;
  remarks: string | null;
  totalQty: number;
  itemsTotal: number;
  itemsBase: number;
  vatAmount: number;
  aitAmount: number;
  discountAmount: number;
  totalAmount: number;
  createdBy: string | null;
  createdAt: string;
  updatedBy: string | null;
  updatedAt: string;
  approvedBy: string | null;
  approvedAt: string | null;
  factoryReceivedBy: string | null;
  factoryReceivedAt: string | null;
  qcBy: string | null;
  qcAt: string | null;
  deletedBy: string | null;
  deletedAt: string | null;
  deleteReason: string | null;
  lines: ReturnLine[];
}
