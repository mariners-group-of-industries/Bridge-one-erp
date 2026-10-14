import { z } from "zod";
import { optionalText } from "@/lib/validation/fields";

// ─── Enums ───────────────────────────────────────────────────────────────────

export const COLLECTION_METHODS = ["CASH", "BANK", "CHEQUE", "MOBILE_BANKING"] as const;
export type CollectionMethod = (typeof COLLECTION_METHODS)[number];
export const COLLECTION_METHOD_LABELS: Record<CollectionMethod, string> = {
  CASH: "Cash",
  BANK: "Bank",
  CHEQUE: "Cheque",
  MOBILE_BANKING: "Mobile Banking",
};

export const COLLECTION_KINDS = ["INVOICE", "ADVANCE"] as const;
export type CollectionKind = (typeof COLLECTION_KINDS)[number];
export const COLLECTION_KIND_LABELS: Record<CollectionKind, string> = { INVOICE: "Collection By Invoice", ADVANCE: "Advance" };

// ─── Input ───────────────────────────────────────────────────────────────────

const MAX_AMOUNT = 999_999_999_999;
const MAX_INVOICES = 300;
const isoDate = (label: string) => z.iso.date({ error: `${label} is required.` });
const amount = (label: string) =>
  z.number({ error: `${label} must be a number.` }).gt(0, `${label} must be more than 0.`).max(MAX_AMOUNT);
const version = z.iso.datetime({ error: "Reload and try again." });
const optionalId = z.uuid().nullish().transform((value) => value ?? null);

const allocations = z
  .array(z.object({ deliveryId: z.uuid(), amount: amount("Collect amount") }))
  .max(MAX_INVOICES)
  .refine((rows) => new Set(rows.map((row) => row.deliveryId)).size === rows.length, "An invoice appears twice.");

const receiptFields = {
  officeId: z.uuid({ error: "Select an office." }),
  customerId: z.uuid({ error: "Select a customer." }),
  collectionDate: isoDate("Collection date"),
  method: z.enum(COLLECTION_METHODS),
  /** Cheque / transaction / money receipt no. */
  reference: optionalText("Reference", 100),
  bankName: optionalText("Bank name", 100),
  /** Collect By (sales force). */
  salesPersonId: optionalId,
  remarks: optionalText("Remarks", 500),
};

const rounded = (value: number) => Math.round(value * 100) / 100;

export const collectionInputSchema = z.discriminatedUnion("kind", [
  z
    .object({ kind: z.literal("INVOICE"), ...receiptFields, amount: amount("Amount"), allocations: allocations.min(1, "Enter an amount for at least one invoice.") })
    .refine((input) => rounded(input.allocations.reduce((sum, row) => sum + row.amount, 0)) === rounded(input.amount), {
      error: "The invoice amounts must add up to the collected amount.",
      path: ["amount"],
    }),
  z.object({ kind: z.literal("ADVANCE"), ...receiptFields, amount: amount("Amount") }),
]);
export type CollectionInput = z.input<typeof collectionInputSchema>;

export const adjustAdvanceSchema = z.object({ version, allocations: allocations.min(1, "Enter an amount for at least one invoice.") });
export const cancelSchema = z.object({
  version,
  reason: optionalText("Reason", 500).refine((value) => value !== null, "Enter why it is cancelled."),
});

export const billInputSchema = z.object({
  officeId: z.uuid({ error: "Select an office." }),
  customerId: z.uuid({ error: "Select a customer." }),
  billDate: isoDate("Bill date"),
  remarks: optionalText("Remarks", 500),
  deliveryIds: z
    .array(z.uuid())
    .min(1, "Select at least one invoice.")
    .max(MAX_INVOICES)
    .refine((ids) => new Set(ids).size === ids.length, "An invoice appears twice."),
});
export type BillInput = z.input<typeof billInputSchema>;

// ─── Queries ─────────────────────────────────────────────────────────────────

const optionalUuid = z.uuid().optional();
const validRange = (query: { from?: string; to?: string }) => !query.from || !query.to || query.from <= query.to;
const rangeMessage = { error: "From Date must be on or before To Date.", path: ["to"] };
const flag = z
  .enum(["true", "false"])
  .optional()
  .transform((value) => value === "true");

/** Due List, Due Bill and Customer Sales vs Ledger: as of the browser's date. */
export const dueQuerySchema = z.object({ officeId: optionalUuid, asOf: isoDate("Date") });
export type DueQuery = z.input<typeof dueQuerySchema>;

export const dueInvoiceQuerySchema = z
  .object({
    officeId: optionalUuid,
    customerId: optionalUuid,
    salesPersonId: optionalUuid,
    from: z.iso.date().optional(),
    to: z.iso.date().optional(),
    asOf: isoDate("Date"),
    /** Only invoices not on a live bill. */
    notSubmitted: flag,
  })
  .refine(validRange, rangeMessage);
export type DueInvoiceQuery = z.input<typeof dueInvoiceQuerySchema>;

export const collectionListQuerySchema = z
  .object({
    kind: z.enum(COLLECTION_KINDS),
    officeId: optionalUuid,
    customerId: optionalUuid,
    salesPersonId: optionalUuid,
    from: z.iso.date().optional(),
    to: z.iso.date().optional(),
    cancelled: flag,
  })
  .refine(validRange, rangeMessage);
export type CollectionListQuery = z.input<typeof collectionListQuerySchema>;

// ─── DTOs ────────────────────────────────────────────────────────────────────

/** An invoice (delivery) and what is still owed on it. */
export interface DueInvoice {
  deliveryId: string;
  number: string;
  challanNo: string | null;
  deliveryDate: string;
  dueDate: string;
  /** Days past the due date (0 if not yet due). */
  overdueDays: number;
  officeId: string;
  officeName: string;
  customerId: string;
  customerCode: string;
  customerName: string;
  salesPersonName: string | null;
  totalAmount: number;
  /** Approved returns and goods taken back on an exchange. */
  returnedAmount: number;
  /** Collected and allocated to this invoice. */
  collectedAmount: number;
  due: number;
  /** Live bill the invoice is on. */
  billId: string | null;
  billNumber: string | null;
}

export interface DueListRow {
  customerId: string;
  customerCode: string;
  customerName: string;
  customerGroup: string | null;
  territory: string | null;
  salesPersonName: string | null;
  invoices: number;
  due: number;
  overdue: number;
  /** Collected but not applied to any invoice. */
  advance: number;
  /** Deliveries − returns − collections (negative = customer paid ahead). */
  ledger: number;
}

export interface BillRow {
  id: string;
  number: string;
  billDate: string;
  status: "SUBMITTED" | "CANCELLED";
  officeName: string;
  customerId: string;
  customerCode: string;
  customerName: string;
  invoices: number;
  billAmount: number;
  /** Still owed on the bill's invoices now. */
  due: number;
  collected: number;
  updatedAt: string;
}

export interface LedgerRow {
  customerId: string;
  customerCode: string;
  customerName: string;
  customerGroup: string | null;
  /** Sum of the invoice dues. */
  salesDue: number;
  ledger: number;
  diff: number;
}

export interface AllocationRow {
  collectionId: string;
  collectionNumber: string;
  collectionDate: string;
  deliveryId: string;
  invoiceNumber: string;
  invoiceDate: string;
  customerName: string;
  amount: number;
}

export interface CollectionRow {
  id: string;
  number: string;
  kind: CollectionKind;
  status: "DRAFT" | "SUBMITTED" | "CANCELLED";
  collectionDate: string;
  officeName: string | null;
  customerId: string;
  customerCode: string;
  customerName: string;
  method: CollectionMethod;
  reference: string | null;
  bankName: string | null;
  salesPersonName: string | null;
  amount: number;
  /** Applied to invoices. */
  allocated: number;
  /** amount − allocated. */
  unallocated: number;
  invoices: number;
  /** Collected on a delivery (managed by the delivery). */
  onDelivery: boolean;
  updatedAt: string;
}

export interface CollectionList {
  rows: CollectionRow[];
  allocations: AllocationRow[];
  totalCount: number;
  totalAmount: number;
}

export interface CollectionDetail extends CollectionRow {
  businessUnitId: string;
  companyName: string;
  officeId: string | null;
  officeAddress: string | null;
  customerPhone: string | null;
  customerAddress: string | null;
  deliveryId: string | null;
  remarks: string | null;
  createdBy: string | null;
  createdAt: string;
  cancelledBy: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  allocations: { deliveryId: string; invoiceNumber: string; invoiceDate: string; invoiceAmount: number; amount: number }[];
}

export interface BillDetail extends BillRow {
  businessUnitId: string;
  companyName: string;
  officeId: string;
  officeAddress: string | null;
  customerPhone: string | null;
  customerAddress: string | null;
  remarks: string | null;
  createdBy: string | null;
  createdAt: string;
  cancelledBy: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  lines: { deliveryId: string; invoiceNumber: string; challanNo: string | null; invoiceDate: string; dueDate: string; invoiceAmount: number; billedAmount: number; due: number }[];
}
