import { z } from "zod";

// Offer Setup (Configuration › Sales Config). Shared by the forms (client
// validation) and the API (server validation). Optional fields use "" for
// "not set"; the service stores NULL.

export const OFFER_KINDS = [
  { kind: "ITEM", slug: "items", label: "Items" },
  { kind: "ITEM_MULTIPLE", slug: "item-multiple", label: "Item (Multiple)" },
  { kind: "DISCOUNT", slug: "discount", label: "Discount" },
  { kind: "SPECIAL_DISCOUNT", slug: "special-discount", label: "Special Discount" },
] as const;

export type OfferKind = (typeof OFFER_KINDS)[number]["kind"];
export type OfferSlug = (typeof OFFER_KINDS)[number]["slug"];
export const kindFromSlug = (slug: string | null | undefined): OfferKind | undefined =>
  OFFER_KINDS.find((entry) => entry.slug === slug)?.kind;
export const slugFromKind = (kind: OfferKind): OfferSlug => OFFER_KINDS.find((entry) => entry.kind === kind)!.slug;

export const OFFER_BASED_ON = ["Customer Group", "Price Type", "All Customers"] as const;
export const SPECIAL_BASED_ON = ["Invoice Amount"] as const;
export const DISCOUNT_TYPES = [
  { value: "PERCENT", label: "Percentage" },
  { value: "FLAT", label: "Flat Amount" },
] as const;
export const AFTER_DISCOUNT_CALC = [
  { value: "true", label: "VAT on discounted price" },
  { value: "false", label: "VAT on original price" },
] as const;

const text = (max: number) => z.string().trim().max(max, `Must be ${max} characters or fewer.`);
const optionalText = (max: number) => text(max).optional().default("");
const optionalId = z.union([z.uuid("Select a valid option."), z.literal("")]).optional().default("");
const optionalDate = z.union([z.iso.date("Enter a valid date."), z.literal("")]).optional().default("");
const requiredDate = (label: string) => z.iso.date(`${label} is required.`);

const qty = (label: string) =>
  z.string().trim().refine((v) => /^\d{1,11}(\.\d{1,3})?$/.test(v) && Number(v) > 0, { message: `${label}: enter a quantity above 0.` });
const optionalQty = (label: string) =>
  z
    .string()
    .trim()
    .refine((v) => v === "" || (/^\d{1,11}(\.\d{1,3})?$/.test(v) && Number(v) > 0), { message: `${label}: enter a quantity above 0.` })
    .optional()
    .default("");
const money = (label: string) =>
  z.string().trim().refine((v) => /^\d{1,12}(\.\d{1,2})?$/.test(v), { message: `${label}: enter an amount (up to 2 decimals).` });
const optionalMoney = (label: string) =>
  z
    .string()
    .trim()
    .refine((v) => v === "" || /^\d{1,14}(\.\d{1,2})?$/.test(v), { message: `${label}: enter an amount (up to 2 decimals).` })
    .optional()
    .default("");
const optionalPercent = (label: string) =>
  z
    .string()
    .trim()
    .refine((v) => v === "" || (/^\d{1,3}(\.\d{1,2})?$/.test(v) && Number(v) <= 100), { message: `${label}: enter 0 to 100.` })
    .optional()
    .default("");
const discountType = z.enum(["PERCENT", "FLAT"], { error: "Select a discount type." });

const num = (v: string) => (v === "" ? null : Number(v));

/** Shared rules for supplier contribution on discount rows. */
function contributionIssues(row: { supplierId: string; supplierContribution: string; internalContribution: string }) {
  const sup = num(row.supplierContribution);
  const internal = num(row.internalContribution);
  if (!row.supplierId && (sup !== null || internal !== null)) return "Select the supplier for the contribution split.";
  if (row.supplierId && (sup ?? 0) + (internal ?? 0) !== 100) return "Supplier % and internal % must add up to 100.";
  return null;
}

// ─── Lines ────────────────────────────────────────────────────────────────────

export const itemLineSchema = z.object({
  sellingItemId: z.uuid("Select the selling item."),
  sellingUom: text(20).min(1, "Select the UoM."),
  sellingQty: qty("Selling qty"),
  offerItemId: z.uuid("Select the offer item."),
  offerUom: text(20).min(1, "Select the UoM."),
  offerQty: qty("Offer qty"),
});

export const pairLineSchema = z
  .object({
    categoryId: optionalId,
    itemId: z.uuid("Select an item."),
    quantity: qty("Qty"),
    minQty: optionalQty("Minimum sales qty"),
    maxQty: optionalQty("Maximum sales qty"),
  })
  .refine((row) => !row.minQty || !row.maxQty || Number(row.minQty) <= Number(row.maxQty), {
    message: "Minimum sales qty cannot exceed the maximum.",
    path: ["maxQty"],
  });

export const bonusLineSchema = z.object({
  itemId: z.uuid("Select a bonus item."),
  quantity: qty("Quantity"),
});

export const discountLineSchema = z
  .object({
    itemId: z.uuid("Select an item."),
    discountType,
    amount: money("Amount/%"),
    quantity: optionalQty("Qty"),
    minQty: optionalQty("Min qty"),
    maxQty: optionalQty("Max qty"),
    isRecurrent: z.boolean().default(false),
    supplierId: optionalId,
    supplierContribution: optionalPercent("Supplier contribution"),
    internalContribution: optionalPercent("Internal contribution"),
  })
  .superRefine((row, ctx) => {
    if (row.discountType === "PERCENT" && Number(row.amount) > 100) ctx.addIssue({ code: "custom", message: "A percentage cannot exceed 100.", path: ["amount"] });
    if (row.minQty && row.maxQty && Number(row.minQty) > Number(row.maxQty)) ctx.addIssue({ code: "custom", message: "Min qty cannot exceed max qty.", path: ["maxQty"] });
    const issue = contributionIssues(row);
    if (issue) ctx.addIssue({ code: "custom", message: issue, path: ["supplierContribution"] });
  });

export const specialLineSchema = z
  .object({
    customerGroupId: optionalId,
    discountType,
    amount: money("Amount/%"),
    fromAmount: optionalMoney("From amount"),
    toAmount: optionalMoney("To amount"),
    supplierId: optionalId,
    supplierContribution: optionalPercent("Supplier contribution"),
    internalContribution: optionalPercent("Internal contribution"),
    vatOnDiscounted: z.boolean().default(true),
  })
  .superRefine((row, ctx) => {
    if (row.discountType === "PERCENT" && Number(row.amount) > 100) ctx.addIssue({ code: "custom", message: "A percentage cannot exceed 100.", path: ["amount"] });
    if (row.fromAmount && row.toAmount && Number(row.fromAmount) > Number(row.toAmount)) {
      ctx.addIssue({ code: "custom", message: "From amount cannot exceed to amount.", path: ["toAmount"] });
    }
    const issue = contributionIssues(row);
    if (issue) ctx.addIssue({ code: "custom", message: issue, path: ["supplierContribution"] });
  });

// ─── Offers ───────────────────────────────────────────────────────────────────

const header = {
  businessUnitId: z.uuid("Select a business unit."),
  name: text(150).min(1, "Offer name is required."),
};
const categoryTrio = { categoryId: optionalId, subCategoryId: optionalId, minorCategoryId: optionalId };

const datesInOrder = <T extends { fromDate: string; toDate: string }>(data: T) => !data.fromDate || !data.toDate || data.fromDate <= data.toDate;
const datesMessage = { message: "To date cannot be before from date.", path: ["toDate"] };

export const itemOfferSchema = z
  .object({
    kind: z.literal("ITEM"),
    ...header,
    fromDate: optionalDate,
    toDate: optionalDate,
    customerGroupId: optionalId,
    ...categoryTrio,
    lines: z.array(itemLineSchema).min(1, "Add at least one item row.").max(500),
  })
  .refine(datesInOrder, datesMessage);

export const itemMultipleOfferSchema = z
  .object({
    kind: z.literal("ITEM_MULTIPLE"),
    ...header,
    fromDate: requiredDate("From date"),
    toDate: requiredDate("To date"),
    priceListId: optionalId,
    basedOn: z.union([z.enum(OFFER_BASED_ON), z.literal("")]).optional().default(""),
    pairLines: z.array(pairLineSchema).min(1, "Add at least one selling item.").max(200),
    bonusLines: z.array(bonusLineSchema).min(1, "Add at least one bonus item.").max(200),
  })
  .refine(datesInOrder, datesMessage);

export const discountOfferSchema = z
  .object({
    kind: z.literal("DISCOUNT"),
    ...header,
    fromDate: optionalDate,
    toDate: optionalDate,
    basedOn: z.union([z.enum(OFFER_BASED_ON), z.literal("")]).optional().default(""),
    customerGroupId: optionalId,
    priceListId: optionalId,
    ...categoryTrio,
    lines: z.array(discountLineSchema).min(1, "Add at least one item.").max(2000),
  })
  .refine(datesInOrder, datesMessage);

export const specialDiscountOfferSchema = z
  .object({
    kind: z.literal("SPECIAL_DISCOUNT"),
    ...header,
    fromDate: optionalDate,
    toDate: optionalDate,
    remarks: optionalText(500),
    basedOn: z.union([z.enum(SPECIAL_BASED_ON), z.literal("")]).optional().default(""),
    lines: z.array(specialLineSchema).min(1, "Add at least one discount row.").max(200),
  })
  .refine(datesInOrder, datesMessage);

export const offerInputSchema = z.discriminatedUnion("kind", [itemOfferSchema, itemMultipleOfferSchema, discountOfferSchema, specialDiscountOfferSchema]);

export type OfferInput = z.input<typeof offerInputSchema>;
export type OfferData = z.output<typeof offerInputSchema>;
export type ItemOfferInput = z.input<typeof itemOfferSchema>;
export type ItemMultipleOfferInput = z.input<typeof itemMultipleOfferSchema>;
export type DiscountOfferInput = z.input<typeof discountOfferSchema>;
export type SpecialDiscountOfferInput = z.input<typeof specialDiscountOfferSchema>;
export type DiscountLineInput = z.input<typeof discountLineSchema>;

export const offerListQuerySchema = z.object({
  kind: z.enum(["ITEM", "ITEM_MULTIPLE", "DISCOUNT", "SPECIAL_DISCOUNT"]),
  search: z.string().trim().max(100).optional(),
  status: z.enum(["active", "inactive"]).optional().catch(undefined),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce
    .number()
    .int()
    .refine((value) => [10, 25, 50, 100].includes(value), "Invalid page size.")
    .default(10),
});

export type OfferListQuery = z.output<typeof offerListQuerySchema>;

// ─── DTOs ─────────────────────────────────────────────────────────────────────

export interface OfferListRow {
  id: string;
  kind: OfferKind;
  name: string;
  fromDate: string | null;
  toDate: string | null;
  customerGroupName: string | null;
  priceListName: string | null;
  basedOn: string | null;
  lineCount: number;
  isActive: boolean;
}

export interface OfferList {
  rows: OfferListRow[];
  total: number;
  page: number;
  pageSize: number;
}

export type OfferDto = OfferData & { id: string; isActive: boolean };

interface BuOption {
  id: string;
  name: string;
  businessUnitId: string;
}

export interface OfferOptions {
  businessUnits: { id: string; name: string }[];
  customerGroups: BuOption[];
  priceLists: BuOption[];
  categories: (BuOption & { parentId: string | null; level: number })[];
  items: (BuOption & { code: string; uom: string; altUom: string | null; categoryId: string | null })[];
  suppliers: (BuOption & { code: string })[];
}

export interface ParsedDiscountLines {
  lines: Required<DiscountLineInput>[];
  errors: { row: number; message: string }[];
}
