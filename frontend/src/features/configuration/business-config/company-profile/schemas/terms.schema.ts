import { z } from "zod";
import { requiredText } from "@/lib/validation/fields";

export const TERMS_DOMAINS = ["SALES", "PURCHASE"] as const;
export type TermsDomain = (typeof TERMS_DOMAINS)[number];

export const TERMS_DOCUMENT_TYPES = [
  "SALES_QUOTATION",
  "SALES_ORDER",
  "SALES_DELIVERY",
  "PROFORMA_INVOICE",
  "REQUEST_FOR_QUOTATION",
  "PURCHASE_ORDER",
  "PURCHASE_RECEIVE",
] as const;
export type TermsDocumentType = (typeof TERMS_DOCUMENT_TYPES)[number];

/** Which document types belong to which domain, in display order. */
export const DOCUMENT_TYPES_BY_DOMAIN: Record<TermsDomain, readonly TermsDocumentType[]> = {
  SALES: ["SALES_QUOTATION", "SALES_ORDER", "SALES_DELIVERY", "PROFORMA_INVOICE"],
  PURCHASE: ["REQUEST_FOR_QUOTATION", "PURCHASE_ORDER", "PURCHASE_RECEIVE"],
};

export const DOCUMENT_TYPE_LABELS: Record<TermsDocumentType, string> = {
  SALES_QUOTATION: "Sales Quotation",
  SALES_ORDER: "Sales Order",
  SALES_DELIVERY: "Sales Delivery",
  PROFORMA_INVOICE: "Proforma Invoice",
  REQUEST_FOR_QUOTATION: "Request for Quotation",
  PURCHASE_ORDER: "Purchase Order",
  PURCHASE_RECEIVE: "Purchase Receive",
};

export function documentTypeBelongsTo(domain: TermsDomain, type: TermsDocumentType): boolean {
  return DOCUMENT_TYPES_BY_DOMAIN[domain].includes(type);
}

export const termsDomainSchema = z.enum(TERMS_DOMAINS, { error: "Invalid terms domain." });

const documentTypesSchema = z
  .array(z.enum(TERMS_DOCUMENT_TYPES))
  .max(TERMS_DOCUMENT_TYPES.length)
  .refine((types) => new Set(types).size === types.length, {
    message: "Document types must not repeat.",
  });

const contentSchema = requiredText("Terms & conditions", 2000);

export const createTermSchema = z
  .object({
    domain: termsDomainSchema,
    content: contentSchema,
    isDefault: z.boolean().default(false),
    documentTypes: documentTypesSchema.default([]),
  })
  .refine((term) => term.documentTypes.every((type) => documentTypeBelongsTo(term.domain, type)), {
    message: "One or more document types do not belong to this terms domain.",
    path: ["documentTypes"],
  });

export type CreateTermInput = z.input<typeof createTermSchema>;
export type CreateTermData = z.output<typeof createTermSchema>;

export const updateTermSchema = z
  .object({
    content: contentSchema.optional(),
    isDefault: z.boolean().optional(),
    documentTypes: documentTypesSchema.optional(),
  })
  .refine((patch) => Object.values(patch).some((value) => value !== undefined), {
    message: "Nothing to update.",
  });

export type UpdateTermInput = z.infer<typeof updateTermSchema>;

export const reorderTermsSchema = z.object({
  domain: termsDomainSchema,
  orderedIds: z
    .array(z.uuid())
    .min(1)
    .max(500)
    .refine((ids) => new Set(ids).size === ids.length, { message: "Ids must not repeat." }),
});

export type ReorderTermsInput = z.infer<typeof reorderTermsSchema>;
