import { z } from "zod";
import { richTextSchema, type RichTextNode } from "@/lib/rich-text";
import { optionalPhone, optionalText } from "@/lib/validation/fields";

/**
 * Stored statuses. Users see them as Managerium does: DRAFT = Pending (waiting for
 * approval), SUBMITTED = Approved (can become a sales order), LOST = Reject.
 */
export const QUOTATION_STATUSES = ["DRAFT", "SUBMITTED", "ORDERED", "LOST", "CANCELLED"] as const;
export type QuotationStatus = (typeof QUOTATION_STATUSES)[number];
/** What the list and form show: the stored status, or EXPIRED for an approved quotation past its validity. */
export type QuotationDisplayStatus = QuotationStatus | "EXPIRED";

export const STATUS_LABELS: Record<QuotationDisplayStatus, string> = {
  DRAFT: "Pending",
  SUBMITTED: "Approved",
  ORDERED: "Ordered",
  LOST: "Reject",
  CANCELLED: "Cancelled",
  EXPIRED: "Expired",
};

export const QUOTATION_TYPES = ["Quotation", "Proforma Invoice", "Price Offer"] as const;

export const MAX_LINES = 200;
export const MAX_TERMS = 50;
const MAX_AMOUNT = 999_999_999_999;

const isoDate = (label: string) => z.iso.date({ error: `${label} is required.` });
const money = (label: string) => z.number({ error: `${label} must be a number.` }).min(0, `${label} cannot be negative.`).max(MAX_AMOUNT);
const percent = (label: string) =>
  z.number({ error: `${label} must be a number.` }).min(0, `${label} cannot be negative.`).max(100, `${label} can be at most 100.`);

export const quotationLineSchema = z.object({
  itemId: z.uuid({ error: "Select an item." }),
  description: optionalText("Description", 500),
  qty: z.number({ error: "Qty must be a number." }).gt(0, "Qty must be more than 0.").max(MAX_AMOUNT),
  rate: money("Unit Price").gt(0, "Unit Price must be more than 0."),
  discountPercent: percent("Discount %").default(0),
  vatPercent: percent("VAT %").default(0),
  aitPercent: percent("AIT %").default(0),
  warranty: optionalText("Warranty", 100),
  deliveryDate: z.iso.date().nullish(),
});

export const termSchema = z.object({
  text: z.string().trim().min(1, "Write the term or remove it.").max(1000, "A term can be at most 1000 characters."),
  optional: z.boolean().default(false),
});
export type QuotationTerm = z.output<typeof termSchema>;

export const quotationInputSchema = z
  .object({
    officeId: z.uuid({ error: "Office is required." }),
    customerId: z.uuid({ error: "Customer is required." }),
    salesPersonId: z.uuid().nullish(),
    quotationDate: isoDate("Create Date"),
    validTill: isoDate("Valid Till Date"),
    contactMobile: optionalPhone("Mobile no."),
    billingAddress: optionalText("Billing Address", 500),
    billingContactPerson: optionalText("Billing Contact Person", 150),
    billingContactNo: optionalPhone("Billing Contact No"),
    reference: optionalText("Reference", 150),
    subject: optionalText("Subject", 300),
    quotationType: z.enum(QUOTATION_TYPES).default("Quotation"),
    includingVat: z.boolean().default(false),
    remarksBody: richTextSchema.nullish(),
    remarksFooter: richTextSchema.nullish(),
    terms: z.array(termSchema).max(MAX_TERMS, `At most ${MAX_TERMS} terms.`).default([]),
    lines: z.array(quotationLineSchema).min(1, "At least one item is required in the quotation.").max(MAX_LINES, `At most ${MAX_LINES} items.`),
  })
  .refine((input) => input.validTill >= input.quotationDate, {
    error: "Valid Till Date cannot be before the Create Date.",
    path: ["validTill"],
  })
  .refine((input) => input.lines.every((line) => !line.deliveryDate || line.deliveryDate >= input.quotationDate), {
    error: "A delivery date cannot be before the Create Date.",
    path: ["lines"],
  });
export type QuotationInput = z.input<typeof quotationInputSchema>;

/** PUT body: the edit plus the `updatedAt` the user started from (optimistic locking). */
export const quotationUpdateSchema = z.object({
  version: z.iso.datetime({ error: "Reload the quotation and try again." }),
  data: quotationInputSchema,
});

/** approve: Pending → Approved; reject: Pending / Approved → Reject (reason); reopen: Reject → Pending. */
export const QUOTATION_ACTIONS = ["approve", "reject", "cancel", "reopen"] as const;
export type QuotationAction = (typeof QUOTATION_ACTIONS)[number];

export const quotationActionSchema = z.object({
  action: z.enum(QUOTATION_ACTIONS),
  version: z.iso.datetime({ error: "Reload the quotation and try again." }),
  reason: optionalText("Reason", 500),
});

export const quotationListQuerySchema = z
  .object({
    officeId: z.uuid().optional(),
    from: z.iso.date().optional(),
    to: z.iso.date().optional(),
    status: z.enum([...QUOTATION_STATUSES, "EXPIRED"]).optional(),
    search: z.string().trim().max(100).optional(),
    /** The browser's local date, used to tell SUBMITTED from EXPIRED. */
    today: z.iso.date(),
  })
  .refine((query) => !query.from || !query.to || query.from <= query.to, {
    error: "From Date must be on or before To Date.",
    path: ["to"],
  });
export type QuotationListQuery = z.infer<typeof quotationListQuerySchema>;

export interface QuotationListRow {
  id: string;
  number: string;
  status: QuotationStatus;
  officeName: string;
  customerId: string;
  customerName: string;
  contactMobile: string | null;
  quotationDate: string;
  validTill: string;
  grandTotal: number;
  updatedAt: string;
}

export interface QuotationLine {
  id: string;
  lineNo: number;
  itemId: string;
  itemCode: string;
  itemName: string;
  description: string | null;
  uom: string;
  qty: number;
  rate: number;
  discountPercent: number;
  discountAmount: number;
  vatPercent: number;
  vatAmount: number;
  aitPercent: number;
  aitAmount: number;
  amount: number;
  warranty: string | null;
  deliveryDate: string | null;
}

export interface QuotationDetail {
  id: string;
  number: string;
  status: QuotationStatus;
  businessUnitId: string;
  officeId: string;
  officeName: string;
  customerId: string;
  customerName: string;
  customerCode: string;
  salesPersonId: string | null;
  quotationDate: string;
  validTill: string;
  contactMobile: string | null;
  billingAddress: string | null;
  billingContactPerson: string | null;
  billingContactNo: string | null;
  reference: string | null;
  subject: string | null;
  quotationType: string;
  includingVat: boolean;
  remarksBody: RichTextNode | null;
  remarksFooter: RichTextNode | null;
  termsList: QuotationTerm[];
  /** Plain text of the body remarks and the numbered terms (sales order prefill, PDF). */
  remarks: string | null;
  terms: string | null;
  totalQty: number;
  subTotal: number;
  discountAmount: number;
  vatAmount: number;
  aitAmount: number;
  grandTotal: number;
  lostReason: string | null;
  approvedBy: string | null;
  submittedAt: string | null;
  cancelledAt: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  lines: QuotationLine[];
}

/** Stored status → what users see. `today` is "YYYY-MM-DD". */
export function displayStatus(status: QuotationStatus, validTill: string, today: string): QuotationDisplayStatus {
  return status === "SUBMITTED" && validTill < today ? "EXPIRED" : status;
}

/** "1. text", "2. text (optional)" … */
export function termsText(terms: readonly QuotationTerm[]): string | null {
  return terms.length ? terms.map((term, index) => `${index + 1}. ${term.text}${term.optional ? " (optional)" : ""}`).join("\n") : null;
}
