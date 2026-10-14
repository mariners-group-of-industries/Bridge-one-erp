import { z } from "zod";
import { optionalPhone, optionalText } from "@/lib/validation/fields";
import { PAYMENT_METHODS, type OrderType, type PaymentMethod } from "../../orders/schemas/order.schema";

// ─── Enums ───────────────────────────────────────────────────────────────────

export const DELIVERY_TYPES = ["SALES_ORDER", "DIRECT", "EXCHANGE"] as const;
export type DeliveryType = (typeof DELIVERY_TYPES)[number];
export const DELIVERY_TYPE_LABELS: Record<DeliveryType, string> = {
  SALES_ORDER: "Sales",
  DIRECT: "Direct",
  EXCHANGE: "Exchange",
};

export const CONFIRMATIONS = ["PENDING", "CONFIRMED"] as const;
export type Confirmation = (typeof CONFIRMATIONS)[number];
export const CONFIRMATION_LABELS: Record<Confirmation, string> = { PENDING: "Pending", CONFIRMED: "Confirmed" };

/** Approved SO tab: an approved order with nothing / part delivered. */
export const APPROVED_ORDER_STATUSES = ["APPROVED", "PARTIALLY_DELIVERED"] as const;
export type ApprovedOrderStatus = (typeof APPROVED_ORDER_STATUSES)[number];
export const APPROVED_ORDER_STATUS_LABELS: Record<ApprovedOrderStatus, string> = {
  APPROVED: "Approved",
  PARTIALLY_DELIVERED: "Partially Delivered",
};

// ─── Input ───────────────────────────────────────────────────────────────────

const MAX_AMOUNT = 999_999_999_999;
const MAX_LINES = 300;
const isoDate = (label: string) => z.iso.date({ error: `${label} is required.` });
const money = (label: string) =>
  z.number({ error: `${label} must be a number.` }).min(0, `${label} cannot be negative.`).max(MAX_AMOUNT);
const percent = (label: string) =>
  z.number({ error: `${label} must be a number.` }).min(0, `${label} cannot be negative.`).max(100, `${label} can be at most 100.`);
const qty = z.number({ error: "Quantity must be a number." }).gt(0, "Quantity must be more than 0.").max(MAX_AMOUNT);
const optionalId = z.uuid().nullish().transform((value) => value ?? null);

/** Header fields every delivery has (transportation details, references, payment). */
const headerFields = {
  officeId: z.uuid({ error: "Select an office." }),
  warehouseId: z.uuid({ error: "Select a warehouse." }),
  deliveryDate: isoDate("Delivery date"),
  /** "HH:MM" local time the goods left. */
  deliveryTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use a time like 09:30.")
    .nullish()
    .transform((value) => value ?? null),
  salesPersonId: optionalId,
  shipToAddressId: optionalId,
  shippingAddress: optionalText("Ship to", 500),
  contactPerson: optionalText("Contact to", 150),
  /** Blank = next challan number. */
  challanNo: optionalText("Challan no", 30),
  vatChallanNo: optionalText("VAT challan no", 40),
  refCustomerPo: optionalText("Ref customer PO", 60),
  refCustomerPoDate: z.iso.date().nullish().transform((value) => value ?? null),
  refInvoice: optionalText("Ref invoice", 60),
  refProjectOutlet: optionalText("Ref project/outlet", 150),
  remarks: optionalText("Remarks", 500),
  terms: optionalText("Terms and conditions", 4000),
  vehicleNo: optionalText("Vehicle no", 40),
  driverName: optionalText("Driver name", 100),
  driverPhone: optionalPhone("Driver mobile"),
  transporterName: optionalText("Transporter", 150),
  paymentMethod: z.enum(PAYMENT_METHODS),
  paymentTermDays: z
    .number({ error: "Payment term days must be a number." })
    .int("Payment term days must be a whole number.")
    .min(0, "Payment term days cannot be negative.")
    .max(365, "Payment term days can be at most 365."),
  deliveryCharge: money("Delivery charge"),
  unloadingCharge: money("Unloading charge"),
  /** Collected on delivery; creates a sales collection. */
  paidAmount: money("Payment amount"),
};

export const pricedLineSchema = z.object({
  itemId: z.uuid({ error: "Select an item." }),
  qty,
  unitPrice: money("Unit price"),
  discountPercent: percent("Discount %"),
  vatPercent: percent("VAT %"),
  aitPercent: percent("AIT %"),
});
export type PricedLineInput = z.input<typeof pricedLineSchema>;

export const orderDeliverySchema = z.object({
  deliveryType: z.literal("SALES_ORDER"),
  salesOrderId: z.uuid({ error: "Select a sales order." }),
  ...headerFields,
  lines: z
    .array(z.object({ orderLineId: z.uuid(), qty }))
    .min(1, "Enter a delivery quantity for at least one item.")
    .max(MAX_LINES),
});

export const directDeliverySchema = z.object({
  deliveryType: z.literal("DIRECT"),
  customerId: z.uuid({ error: "Select a customer." }),
  priceIncludesVat: z.boolean(),
  discountAmount: money("Discount"),
  ...headerFields,
  lines: z.array(pricedLineSchema).min(1, "Add at least one item.").max(MAX_LINES, `At most ${MAX_LINES} items.`),
});

export const exchangeSchema = z.object({
  deliveryType: z.literal("EXCHANGE"),
  customerId: z.uuid({ error: "Select a customer." }),
  priceIncludesVat: z.boolean(),
  discountAmount: money("Discount"),
  /** Why goods are exchanged (damaged, expired …). */
  reason: optionalText("Reason", 500),
  ...headerFields,
  /** Goods taken back from the customer (into the warehouse). */
  receivedLines: z
    .array(z.object({ itemId: z.uuid({ error: "Select an item." }), qty, rate: money("Rate") }))
    .min(1, "Add at least one item taken back.")
    .max(MAX_LINES),
  /** Replacement goods given to the customer (out of the warehouse). */
  lines: z.array(pricedLineSchema).min(1, "Add at least one replacement item.").max(MAX_LINES),
});

export const deliveryInputSchema = z.discriminatedUnion("deliveryType", [orderDeliverySchema, directDeliverySchema, exchangeSchema]);
export type DeliveryInput = z.input<typeof deliveryInputSchema>;
export type OrderDeliveryInput = z.input<typeof orderDeliverySchema>;
export type DirectDeliveryInput = z.input<typeof directDeliverySchema>;
export type ExchangeInput = z.input<typeof exchangeSchema>;

export const deliveryUpdateSchema = z.object({
  version: z.iso.datetime({ error: "Reload the delivery and try again." }),
  data: deliveryInputSchema,
});

export const deliveryDeleteSchema = z.object({
  version: z.iso.datetime({ error: "Reload the delivery and try again." }),
  reason: optionalText("Reason", 500).refine((value) => value !== null, "Enter why the delivery is deleted."),
});

export const deliveryConfirmSchema = z.object({
  version: z.iso.datetime({ error: "Reload the delivery and try again." }),
  actualDeliveryDate: isoDate("Actual delivery date"),
});

export const pendingReasonSchema = z.object({ reasonId: optionalId });

export const stockAdjustmentSchema = z.object({
  warehouseId: z.uuid({ error: "Select a warehouse." }),
  itemId: z.uuid({ error: "Select an item." }),
  qty: z
    .number({ error: "Quantity must be a number." })
    .refine((value) => value !== 0, "Quantity cannot be 0.")
    .refine((value) => Math.abs(value) <= MAX_AMOUNT, "Quantity is too large."),
  source: z.enum(["OPENING", "ADJUSTMENT"]),
  postingDate: isoDate("Date"),
  remarks: optionalText("Remarks", 500),
});
export type StockAdjustmentInput = z.input<typeof stockAdjustmentSchema>;

const optionalUuid = z.uuid().optional();
const areaFilters = {
  officeId: optionalUuid,
  customerGroupId: optionalUuid,
  zoneId: optionalUuid,
  territoryId: optionalUuid,
  routeId: optionalUuid,
  sectionId: optionalUuid,
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
};
const validRange = (query: { from?: string; to?: string }) => !query.from || !query.to || query.from <= query.to;
const rangeMessage = { error: "From Date must be on or before To Date.", path: ["to"] };

export const approvedOrderQuerySchema = z
  .object({
    ...areaFilters,
    status: z.enum(APPROVED_ORDER_STATUSES).optional(),
    customerId: optionalUuid,
    salesPersonId: optionalUuid,
  })
  .refine(validRange, rangeMessage);
export type ApprovedOrderQuery = z.infer<typeof approvedOrderQuerySchema>;

export const deliveryListQuerySchema = z
  .object({
    ...areaFilters,
    deliveryType: z.enum(DELIVERY_TYPES).optional(),
    confirmation: z.enum(CONFIRMATIONS).optional(),
    paymentMethod: z.enum(PAYMENT_METHODS).optional(),
    vehicleNo: z.string().trim().max(40).optional(),
    deleted: z
      .enum(["true", "false"])
      .optional()
      .transform((value) => value === "true"),
  })
  .refine(validRange, rangeMessage);
export type DeliveryListQuery = z.input<typeof deliveryListQuerySchema>;

// ─── DTOs ────────────────────────────────────────────────────────────────────

export interface ApprovedOrderRow {
  id: string;
  number: string;
  status: ApprovedOrderStatus;
  orderDate: string;
  expectedDeliveryDate: string;
  officeName: string;
  customerCode: string;
  customerName: string;
  shippingAddress: string | null;
  zone: string | null;
  territory: string | null;
  route: string | null;
  section: string | null;
  refCustomerPo: string | null;
  salesPersonName: string | null;
  orderType: OrderType;
  pendingReasonId: string | null;
  salesTotal: number;
  /** Share of the ordered quantity already delivered (0–100). */
  deliveredPercent: number;
  businessUnitId: string;
  updatedAt: string;
}

export interface OrderForDeliveryLine {
  orderLineId: string;
  itemId: string;
  itemCode: string;
  itemName: string;
  uom: string;
  altUom: string | null;
  altUomFactor: number | null;
  qty: number;
  deliveredQty: number;
  /** Ordered − delivered. */
  remaining: number;
  tolerancePercent: number;
  /** Most this delivery may carry: qty × (1 + tolerance) − delivered. */
  maxQty: number;
  unitPrice: number;
  discountPercent: number;
  vatPercent: number;
  aitPercent: number;
}

export interface OrderForDelivery {
  id: string;
  number: string;
  status: ApprovedOrderStatus;
  businessUnitId: string;
  officeId: string;
  officeName: string;
  customerId: string;
  customerCode: string;
  customerName: string;
  customerPhone: string | null;
  billingAddress: string | null;
  shippingAddress: string | null;
  shipToAddressId: string | null;
  addresses: { id: string; label: string; address: string }[];
  salesPersonId: string | null;
  salesPersonName: string | null;
  priceListName: string | null;
  refProjectOutlet: string | null;
  refCustomerPo: string | null;
  refCustomerPoDate: string | null;
  refCustomerPoAmount: number | null;
  refInvoice: string | null;
  orderDate: string;
  expectedDeliveryDate: string;
  approvedBy: string | null;
  remarks: string | null;
  terms: string | null;
  paymentMethod: PaymentMethod;
  paymentTermDays: number;
  priceIncludesVat: boolean;
  /** Order header discount and its items total, for pro-rating per delivery. */
  discountAmount: number;
  itemsTotal: number;
  deliveryCharge: number;
  unloadingCharge: number;
  /** Customer balance (outstanding receivable) and credit limit. */
  ledgerBalance: number;
  creditLimit: number | null;
  /** Charges already billed on earlier deliveries of this order. */
  chargesBilled: boolean;
  lines: OrderForDeliveryLine[];
}

export interface DeliveryListRow {
  id: string;
  number: string;
  challanNo: string | null;
  vatChallanNo: string | null;
  deliveryType: DeliveryType;
  confirmation: Confirmation;
  deleted: boolean;
  deliveryDate: string;
  orderDate: string | null;
  orderNumber: string | null;
  salesOrderId: string | null;
  officeName: string | null;
  salesPersonName: string | null;
  vehicleNo: string | null;
  customerGroup: string | null;
  customerCode: string;
  customerName: string;
  refProjectOutlet: string | null;
  shippingAddress: string | null;
  zone: string | null;
  route: string | null;
  section: string | null;
  refCustomerPo: string | null;
  refCustomerPoDate: string | null;
  refInvoice: string | null;
  paymentMethod: PaymentMethod;
  totalAmount: number;
  paidAmount: number;
  /** Exchange: value of the goods taken back. */
  returnAmount: number;
  /** totalAmount − returnAmount − paidAmount, never below 0. */
  pendingAmount: number;
  updatedAt: string;
}

export interface DeliveryList {
  rows: DeliveryListRow[];
  totalCount: number;
  totalAmount: number;
  pendingAmount: number;
}

export interface DeliveryLine {
  id: string;
  lineNo: number;
  itemId: string;
  itemCode: string;
  itemName: string;
  orderLineId: string | null;
  uom: string | null;
  altUom: string | null;
  altUomFactor: number | null;
  qty: number;
  rate: number;
  discountPercent: number;
  vatPercent: number;
  aitPercent: number;
  grossAmount: number;
  baseAmount: number;
  vatAmount: number;
  aitAmount: number;
  amount: number;
}

export interface DeliveryDetail {
  id: string;
  number: string;
  challanNo: string | null;
  vatChallanNo: string | null;
  deliveryType: DeliveryType;
  confirmation: Confirmation;
  status: "DRAFT" | "SUBMITTED" | "CANCELLED";
  businessUnitId: string;
  companyName: string;
  officeId: string | null;
  officeName: string | null;
  officeAddress: string | null;
  officeBin: string | null;
  warehouseId: string | null;
  warehouseName: string | null;
  salesOrderId: string | null;
  orderNumber: string | null;
  orderDate: string | null;
  expectedDeliveryDate: string | null;
  customerId: string;
  customerCode: string;
  customerName: string;
  customerPhone: string | null;
  customerBin: string | null;
  customerGroup: string | null;
  territory: string | null;
  salesPersonId: string | null;
  salesPersonName: string | null;
  deliveryDate: string;
  deliveryTime: string | null;
  dueDate: string;
  shipToAddressId: string | null;
  shippingAddress: string | null;
  billingAddress: string | null;
  contactPerson: string | null;
  refCustomerPo: string | null;
  refCustomerPoDate: string | null;
  refInvoice: string | null;
  refProjectOutlet: string | null;
  paymentMethod: PaymentMethod;
  paymentTermDays: number;
  priceIncludesVat: boolean;
  vehicleNo: string | null;
  driverName: string | null;
  driverPhone: string | null;
  transporterName: string | null;
  totalQty: number;
  itemsTotal: number;
  itemsBase: number;
  vatAmount: number;
  aitAmount: number;
  discountAmount: number;
  deliveryCharge: number;
  unloadingCharge: number;
  totalAmount: number;
  paidAmount: number;
  /** "Paid" when collected in full on delivery, else "Due". */
  invoiceType: "Paid" | "Due";
  /** Order fully delivered after this delivery? (SO deliveries only.) */
  orderFullyDelivered: boolean | null;
  terms: string | null;
  remarks: string | null;
  actualDeliveryDate: string | null;
  confirmedAt: string | null;
  confirmedBy: string | null;
  deletedAt: string | null;
  deletedBy: string | null;
  deleteReason: string | null;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
  lines: DeliveryLine[];
  /** Exchange: goods taken back. */
  exchangeReturn: {
    id: string;
    number: string;
    reason: string | null;
    totalAmount: number;
    lines: { id: string; itemId: string; itemCode: string; itemName: string; uom: string; qty: number; rate: number; amount: number }[];
  } | null;
}

export interface StockLevel {
  itemId: string;
  qty: number;
}

export interface StockSummary {
  itemId: string;
  warehouses: { warehouseId: string; warehouseName: string; officeName: string; qty: number }[];
  entries: {
    id: string;
    warehouseName: string;
    qty: number;
    source: "OPENING" | "ADJUSTMENT" | "SALES_DELIVERY" | "SALES_RETURN";
    postingDate: string;
    remarks: string | null;
    createdBy: string;
  }[];
}

export interface WarehouseOption {
  id: string;
  name: string;
  officeId: string;
}

