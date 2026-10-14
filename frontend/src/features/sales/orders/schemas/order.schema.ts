import { z } from "zod";
import { optionalText } from "@/lib/validation/fields";
import type { CustomerType } from "../../masters/schemas/masters.schema";
import { orderTotals } from "../lib/order-totals";

// ─── Enums ───────────────────────────────────────────────────────────────────

export const ORDER_STATUSES = ["DRAFT", "PENDING_APPROVAL", "APPROVED", "COMPLETED", "CANCELLED"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];
/** As in Managerium: "Pending" waits for approval, "Approved" waits for delivery. */
export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  DRAFT: "Draft",
  PENDING_APPROVAL: "Pending",
  APPROVED: "Approved",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

export const ORDER_TYPES = ["SALES", "SAMPLE", "EXPORT"] as const;
export type OrderType = (typeof ORDER_TYPES)[number];
export const ORDER_TYPE_LABELS: Record<OrderType, string> = { SALES: "Sales", SAMPLE: "Sample", EXPORT: "Export" };

export const PAYMENT_METHODS = ["CASH", "CREDIT", "BANK", "CHEQUE", "MOBILE_BANKING"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  CASH: "Cash",
  CREDIT: "Credit",
  BANK: "Bank",
  CHEQUE: "Cheque",
  MOBILE_BANKING: "Mobile Banking",
};

export const HOLD_REASONS = ["CREDIT_LIMIT_EXCEEDED", "OVERDUE_BALANCE"] as const;
export type HoldReason = (typeof HOLD_REASONS)[number];
export const HOLD_REASON_LABELS: Record<HoldReason, string> = {
  CREDIT_LIMIT_EXCEEDED: "Credit limit exceeded",
  OVERDUE_BALANCE: "Overdue balance",
};

export const ORDER_ACTIONS = ["submit", "approve", "reject", "cancel", "complete"] as const;
export type OrderAction = (typeof ORDER_ACTIONS)[number];
export const ORDER_ACTION_LABELS: Record<OrderAction, string> = {
  submit: "Submit",
  approve: "Approve",
  reject: "Reject",
  cancel: "Cancel Order",
  complete: "Close Order",
};

// ─── Input ───────────────────────────────────────────────────────────────────

export const MAX_ORDER_LINES = 300;
const MAX_AMOUNT = 999_999_999_999;
const isoDate = (label: string) => z.iso.date({ error: `${label} is required.` });
const money = (label: string) =>
  z.number({ error: `${label} must be a number.` }).min(0, `${label} cannot be negative.`).max(MAX_AMOUNT);
const percent = (label: string) =>
  z.number({ error: `${label} must be a number.` }).min(0, `${label} cannot be negative.`).max(100, `${label} can be at most 100.`);
const optionalId = z.uuid().nullish().transform((value) => value ?? null);

export const orderLineSchema = z.object({
  itemId: z.uuid({ error: "Select an item." }),
  qty: z.number({ error: "Quantity must be a number." }).gt(0, "Quantity must be more than 0.").max(MAX_AMOUNT),
  unitPrice: money("Unit price"),
  discountPercent: percent("Discount %"),
  vatPercent: percent("VAT %"),
  aitPercent: percent("AIT %"),
});
export type OrderLineInputValues = z.input<typeof orderLineSchema>;

export const orderInputSchema = z
  .object({
    officeId: z.uuid({ error: "Select an office." }),
    customerId: z.uuid({ error: "Select a customer." }),
    salesPersonId: optionalId,
    quotationId: optionalId,
    priceListId: optionalId,
    shipToAddressId: optionalId,
    orderType: z.enum(ORDER_TYPES),
    paymentMethod: z.enum(PAYMENT_METHODS),
    orderDate: isoDate("Create date"),
    expectedDeliveryDate: isoDate("Exp. delivery date"),
    priceIncludesVat: z.boolean(),
    isForeign: z.boolean(),
    shippingAddress: optionalText("Ship to", 500),
    contactPerson: optionalText("Contact to", 150),
    referredBy: optionalText("Referred by", 150),
    refCustomerPo: optionalText("Ref customer PO", 60),
    refCustomerPoDate: z.iso.date().nullish().transform((value) => value ?? null),
    refCustomerPoAmount: money("Ref customer PO amount").nullish().transform((value) => value ?? null),
    refInvoice: optionalText("Ref invoice", 60),
    refProjectOutlet: optionalText("Ref project/outlet", 150),
    paymentTermDays: z
      .number({ error: "Payment term days must be a number." })
      .int("Payment term days must be a whole number.")
      .min(0, "Payment term days cannot be negative.")
      .max(365, "Payment term days can be at most 365."),
    dueLimit: money("Due limit"),
    remarks: optionalText("Remarks", 500),
    terms: optionalText("Terms and conditions", 4000),
    discountAmount: money("Discount"),
    deliveryCharge: money("Delivery charge"),
    unloadingCharge: money("Unloading charge"),
    lines: z
      .array(orderLineSchema)
      .min(1, "Add at least one item.")
      .max(MAX_ORDER_LINES, `At most ${MAX_ORDER_LINES} items.`),
  })
  .refine((input) => input.expectedDeliveryDate >= input.orderDate, {
    error: "Exp. delivery date cannot be before the create date.",
    path: ["expectedDeliveryDate"],
  })
  .refine(
    (input) =>
      input.discountAmount <=
      orderTotals(input.lines, { priceIncludesVat: input.priceIncludesVat, discountAmount: 0, deliveryCharge: 0, unloadingCharge: 0 })
        .itemsTotal,
    { error: "Discount cannot be more than the items total.", path: ["discountAmount"] },
  );
export type OrderInput = z.input<typeof orderInputSchema>;

export const orderUpdateSchema = z.object({
  version: z.iso.datetime({ error: "Reload the order and try again." }),
  data: orderInputSchema,
});

export const orderActionSchema = z.object({
  action: z.enum(ORDER_ACTIONS),
  version: z.iso.datetime({ error: "Reload the order and try again." }),
  remarks: optionalText("Remarks", 500),
  /** The browser's local date, used for the credit check on submit. */
  today: z.iso.date(),
});

const optionalUuid = z.uuid().optional();
export const orderListQuerySchema = z
  .object({
    officeId: optionalUuid,
    customerGroupId: optionalUuid,
    zoneId: optionalUuid,
    territoryId: optionalUuid,
    routeId: optionalUuid,
    sectionId: optionalUuid,
    salesPersonId: optionalUuid,
    status: z.enum(ORDER_STATUSES).optional(),
    holdReason: z.enum(HOLD_REASONS).optional(),
    /** Delivery pending reason set on the Approved SO tab. */
    pendingReasonId: optionalUuid,
    /** "Order By": the user who entered the order. */
    createdBy: z.string().trim().min(1).max(100).optional(),
    paymentMethod: z.enum(PAYMENT_METHODS).optional(),
    orderType: z.enum(ORDER_TYPES).optional(),
    from: z.iso.date().optional(),
    to: z.iso.date().optional(),
  })
  .refine((query) => !query.from || !query.to || query.from <= query.to, {
    error: "From Date must be on or before To Date.",
    path: ["to"],
  });
export type OrderListQuery = z.infer<typeof orderListQuerySchema>;

// ─── DTOs ────────────────────────────────────────────────────────────────────

export interface OrderListRow {
  id: string;
  number: string;
  status: OrderStatus;
  holdReason: HoldReason | null;
  pendingReasonName: string | null;
  orderDate: string;
  expectedDeliveryDate: string;
  officeName: string;
  customerCode: string;
  customerName: string;
  customerType: CustomerType;
  refProjectOutlet: string | null;
  shippingAddress: string | null;
  zone: string | null;
  territory: string | null;
  route: string | null;
  section: string | null;
  refCustomerPo: string | null;
  refCustomerPoDate: string | null;
  refCustomerPoAmount: number | null;
  refInvoice: string | null;
  salesTotal: number;
  salesPersonName: string | null;
  orderType: OrderType;
  paymentMethod: PaymentMethod;
  updatedAt: string;
}

export interface OrderList {
  rows: OrderListRow[];
  /** Sum of salesTotal over all matching orders (not only the returned rows). */
  totalAmount: number;
  totalCount: number;
  /** Users who entered orders in scope ("Order By" filter). */
  creators: { id: string; name: string }[];
}

export interface OrderLine {
  id: string;
  lineNo: number;
  itemId: string;
  itemCode: string;
  itemName: string;
  uom: string;
  altUom: string | null;
  altUomFactor: number | null;
  qty: number;
  deliveredQty: number;
  unitPrice: number;
  mrp: number | null;
  discountPercent: number;
  vatPercent: number;
  aitPercent: number;
  grossAmount: number;
  lineTotal: number;
  baseAmount: number;
  vatAmount: number;
  aitAmount: number;
}

export interface OrderEvent {
  id: string;
  action: string;
  fromStatus: OrderStatus | null;
  toStatus: OrderStatus;
  remarks: string | null;
  actorId: string;
  actorName: string | null;
  createdAt: string;
}

export interface OrderDetail {
  id: string;
  number: string;
  status: OrderStatus;
  holdReason: HoldReason | null;
  businessUnitId: string;
  companyName: string;
  officeId: string;
  officeName: string;
  officeAddress: string;
  customerId: string;
  customerCode: string;
  customerName: string;
  customerPhone: string | null;
  customerGroup: string | null;
  territory: string | null;
  salesPersonId: string | null;
  salesPersonName: string | null;
  quotationId: string | null;
  quotationNumber: string | null;
  priceListId: string | null;
  priceListName: string | null;
  shipToAddressId: string | null;
  orderType: OrderType;
  paymentMethod: PaymentMethod;
  orderDate: string;
  expectedDeliveryDate: string;
  priceIncludesVat: boolean;
  isForeign: boolean;
  shippingAddress: string | null;
  billingAddress: string | null;
  contactPerson: string | null;
  referredBy: string | null;
  refCustomerPo: string | null;
  refCustomerPoDate: string | null;
  refCustomerPoAmount: number | null;
  refInvoice: string | null;
  refProjectOutlet: string | null;
  paymentTermDays: number;
  dueLimit: number;
  remarks: string | null;
  terms: string | null;
  totalQty: number;
  itemsTotal: number;
  itemsBase: number;
  vatAmount: number;
  aitAmount: number;
  discountAmount: number;
  deliveryCharge: number;
  unloadingCharge: number;
  salesTotal: number;
  createdBy: string;
  updatedBy: string;
  /** Display names of createdBy / updatedBy. */
  createdByName: string | null;
  updatedByName: string | null;
  /** Delivery pending reason (Approved SO tab). */
  pendingReasonName: string | null;
  /** Why the order was closed or cancelled. */
  closedRemarks: string | null;
  submittedAt: string | null;
  approvedAt: string | null;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
  lines: OrderLine[];
  events: OrderEvent[];
}
