import { z } from "zod";
import { optionalPhone, optionalText } from "@/lib/validation/fields";
import { quotationTotals } from "../lib/totals";

export const QUOTATION_STATUSES = ["DRAFT", "SUBMITTED", "ORDERED", "LOST", "CANCELLED"] as const;
export type QuotationStatus = (typeof QUOTATION_STATUSES)[number];
/** What the list and form show: the stored status, or EXPIRED for a submitted quotation past its validity. */
export type QuotationDisplayStatus = QuotationStatus | "EXPIRED";

export const STATUS_LABELS: Record<QuotationDisplayStatus, string> = {
  DRAFT: "Draft",
  SUBMITTED: "Submitted",
  ORDERED: "Ordered",
  LOST: "Lost",
  CANCELLED: "Cancelled",
  EXPIRED: "Expired",
};

export const MAX_LINES = 200;
const MAX_AMOUNT = 999_999_999_999;

const isoDate = (label: string) => z.iso.date({ error: `${label} is required.` });
const money = (label: string) =>
  z.number({ error: `${label} must be a number.` }).min(0, `${label} cannot be negative.`).max(MAX_AMOUNT);
const percent = (label: string) =>
  z.number({ error: `${label} must be a number.` }).min(0, `${label} cannot be negative.`).max(100, `${label} can be at most 100.`);

export const quotationLineSchema = z.object({
  itemId: z.uuid({ error: "Select an item." }),
  description: optionalText("Description", 500),
  qty: z.number({ error: "Qty must be a number." }).gt(0, "Qty must be more than 0.").max(MAX_AMOUNT),
  rate: money("Rate"),
  discountPercent: percent("Discount %"),
});

export const quotationInputSchema = z
  .object({
    officeId: z.uuid({ error: "Select an office." }),
    customerId: z.uuid({ error: "Select a customer." }),
    salesPersonId: z.uuid().nullish(),
    quotationDate: isoDate("Quotation date"),
    validTill: isoDate("Valid till date"),
    contactMobile: optionalPhone("Mobile no."),
    remarks: optionalText("Remarks", 500),
    terms: optionalText("Terms and conditions", 4000),
    discountAmount: money("Discount"),
    vatPercent: percent("VAT %"),
    lines: z.array(quotationLineSchema).min(1, "Add at least one item.").max(MAX_LINES, `At most ${MAX_LINES} items.`),
  })
  .refine((input) => input.validTill >= input.quotationDate, {
    error: "Valid till date cannot be before the quotation date.",
    path: ["validTill"],
  })
  .refine((input) => input.discountAmount <= quotationTotals(input.lines, 0, 0).subTotal, {
    error: "Discount cannot be more than the subtotal.",
    path: ["discountAmount"],
  });
export type QuotationInput = z.input<typeof quotationInputSchema>;

/** PUT body: the edit plus the `updatedAt` the user started from (optimistic locking). */
export const quotationUpdateSchema = z.object({
  version: z.iso.datetime({ error: "Reload the quotation and try again." }),
  data: quotationInputSchema,
});

export const QUOTATION_ACTIONS = ["submit", "cancel", "lost", "reopen"] as const;
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
  amount: number;
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
  salesPersonId: string | null;
  quotationDate: string;
  validTill: string;
  contactMobile: string | null;
  remarks: string | null;
  terms: string | null;
  totalQty: number;
  subTotal: number;
  discountAmount: number;
  vatPercent: number;
  vatAmount: number;
  grandTotal: number;
  lostReason: string | null;
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
