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

/** Cash Type on Due Collection. */
export const CASH_TYPES = ["Cash in Hand", "Petty Cash", "Cash at Bank"] as const;

/** Advance Collection voucher type. */
export const VOUCHER_TYPES = ["CASH_RECEIVE", "BANK_RECEIVE"] as const;
export type VoucherType = (typeof VOUCHER_TYPES)[number];
export const VOUCHER_TYPE_LABELS: Record<VoucherType, string> = { CASH_RECEIVE: "Cash Receive", BANK_RECEIVE: "Bank Receive" };

export const BILL_TYPES = ["NORMAL", "FACTORING"] as const;
export type BillType = (typeof BILL_TYPES)[number];
export const BILL_TYPE_LABELS: Record<BillType, string> = { NORMAL: "Bill", FACTORING: "Factoring Bill" };

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

const requiredText = (label: string, max: number) =>
  z.string({ error: `${label} is required.` }).trim().min(1, `${label} is required.`).max(max, `${label} must be at most ${max} characters.`);

/** Bank Deduction Details: charges the bank kept out of the money received. */
export const deductionSchema = z.object({
  expense: requiredText("Expenses", 150),
  accountId: z.uuid({ error: "Select the account head (GL)." }),
  amount: amount("Deduction amount"),
});
export type DeductionInput = z.input<typeof deductionSchema>;

/** Due Collection: one header, invoices of one or more customers (one money receipt per customer). */
export const dueCollectionSchema = z
  .object({
    officeId: z.uuid({ error: "Select an office." }),
    collectionDate: isoDate("Date"),
    method: z.enum(COLLECTION_METHODS),
    cashType: optionalText("Cash type", 30),
    /** Wallet Setup (Sales Config): bank / MFS wallet the money came through. */
    walletId: optionalId,
    salesPersonId: optionalId,
    adjustAccountId: optionalId,
    moneyReceiptNo: optionalText("Money receipt no", 60),
    bankName: optionalText("Bank name", 100),
    reference: optionalText("Reference", 100),
    remarks: optionalText("Remarks", 500),
    deductions: z.array(deductionSchema).max(20).default([]),
    rows: z
      .array(z.object({ customerId: z.uuid({ error: "Select a customer." }), allocations: allocations.min(1, "Select at least one invoice.") }))
      .min(1, "Add at least one invoice.")
      .max(100),
  })
  .refine((input) => new Set(input.rows.map((row) => row.customerId)).size === input.rows.length, { error: "A customer appears twice.", path: ["rows"] })
  .refine(
    (input) =>
      input.deductions.reduce((sum, row) => sum + row.amount, 0) <
      input.rows.reduce((sum, row) => sum + row.allocations.reduce((total, item) => total + item.amount, 0), 0),
    { error: "Bank deductions must be less than the collected amount.", path: ["deductions"] },
  );
export type DueCollectionInput = z.input<typeof dueCollectionSchema>;

/** Advance Collection voucher: money taken before invoicing from one or more customers. */
export const advanceVoucherSchema = z
  .object({
    officeId: z.uuid({ error: "Select an office." }),
    collectionDate: isoDate("Date"),
    employeeId: optionalId,
    voucherType: z.enum(VOUCHER_TYPES),
    project: optionalText("Project", 150),
    narration: optionalText("Narration", 500),
    controlAmount: z.number({ error: "Control amount must be a number." }).min(0).max(MAX_AMOUNT).nullish().transform((value) => value ?? null),
    cashAccountId: z.uuid({ error: "Select the cash account." }),
    cashRemarks: optionalText("Cash remarks", 300),
    adjustAccountId: optionalId,
    rows: z
      .array(
        z
          .object({
            customerId: z.uuid({ error: "Select a partner." }),
            salesOrderId: optionalId,
            adjustmentAmount: z.number({ error: "Adjustment amount must be a number." }).min(0, "Adjustment amount cannot be negative.").max(MAX_AMOUNT).default(0),
            amount: amount("Amount"),
            remarks: optionalText("Remarks", 500),
          })
          .refine((row) => row.adjustmentAmount <= row.amount, { error: "Adjustment amount cannot be more than the amount.", path: ["adjustmentAmount"] }),
      )
      .min(1, "Add at least one row.")
      .max(100),
  })
  .refine((input) => input.controlAmount === null || rounded(input.rows.reduce((sum, row) => sum + row.amount, 0)) === rounded(input.controlAmount), {
    error: "The amounts must add up to the control amount.",
    path: ["controlAmount"],
  });
export type AdvanceVoucherInput = z.input<typeof advanceVoucherSchema>;

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
  billType: z.enum(BILL_TYPES).default("NORMAL"),
  terms: optionalText("Terms and conditions", 4000),
  /** Per invoice: challan as written, GRN number and submission date. */
  details: z
    .array(
      z.object({
        deliveryId: z.uuid(),
        challanManual: optionalText("Challan (manual)", 60),
        grnNumber: optionalText("GRN number", 60),
        submissionDate: z.iso.date().nullish().transform((value) => value ?? null),
      }),
    )
    .max(MAX_INVOICES)
    .default([]),
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

export interface GlAccountOption {
  id: string;
  code: string;
  name: string;
  accountType: string;
}

export interface CollectionDetail extends CollectionRow {
  moneyReceiptNo: string | null;
  cashType: string | null;
  adjustAccount: string | null;
  voucherType: VoucherType | null;
  cashAccount: string | null;
  cashRemarks: string | null;
  project: string | null;
  narration: string | null;
  controlAmount: number | null;
  adjustmentAmount: number;
  salesOrderId: string | null;
  salesOrderNumber: string | null;
  employeeName: string | null;
  deductionAmount: number;
  deductions: { id: string; expense: string; account: string; amount: number }[];
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
  billType: BillType;
  terms: string | null;
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
  lines: {
    deliveryId: string;
    invoiceNumber: string;
    challanNo: string | null;
    challanManual: string | null;
    grnNumber: string | null;
    submissionDate: string | null;
    invoiceDate: string;
    dueDate: string;
    invoiceAmount: number;
    billedAmount: number;
    due: number;
  }[];
}

/** A Wallet Setup wallet offered on Due Collection (GET /api/sales/collections/wallets?officeId). */
export interface CollectionWallet {
  id: string;
  name: string;
  commissionPercent: number;
  isCash: boolean;
  isMfs: boolean;
  isReferenceRequired: boolean;
  /** GL of the wallet's bank account, used as "Adjust With GL". */
  glAccountId: string | null;
}
