import { z } from "zod";
import { ITEM_TYPES } from "@/features/configuration/entity-master-data/item/schemas/item.schema";

// Customer Price Setup (Configuration › Sales Config). Shared by the forms and
// the API. "" means "not set"; the service stores NULL.

export const PRICE_TABS = [
  { id: "customer", slug: "customer-price", label: "Customer Price" },
  { id: "group", slug: "customer-offer", label: "Customer Offer" },
] as const;
export type PriceTab = (typeof PRICE_TABS)[number]["id"];
export const tabFromSlug = (slug: string | null | undefined): PriceTab => PRICE_TABS.find((t) => t.slug === slug)?.id ?? "customer";
export const slugFromTab = (tab: PriceTab) => PRICE_TABS.find((t) => t.id === tab)!.slug;

export { ITEM_TYPES };

const optionalId = z.union([z.uuid("Select a valid option."), z.literal("")]).optional().default("");
const optionalDate = z.union([z.iso.date("Enter a valid date."), z.literal("")]).optional().default("");
const price = (label: string) =>
  z.string().trim().refine((v) => /^\d{1,12}(\.\d{1,2})?$/.test(v), { message: `${label}: enter a price (up to 2 decimals).` });
const optionalQty = (label: string) =>
  z
    .string()
    .trim()
    .refine((v) => v === "" || /^\d{1,11}(\.\d{1,3})?$/.test(v), { message: `${label}: enter a quantity.` })
    .optional()
    .default("");

const itemFilter = {
  itemType: z.union([z.enum(ITEM_TYPES), z.literal("")]).optional().default(""),
  categoryId: optionalId,
  subCategoryId: optionalId,
  minorCategoryId: optionalId,
};

// ─── Customer price ───────────────────────────────────────────────────────────

export const customerPriceLineSchema = z.object({
  itemId: z.uuid("Select an item."),
  dpPrice: price("DP price"),
  tpPrice: price("TP price"),
});

export const customerPriceSchema = z
  .object({
    businessUnitId: z.uuid("Select a business unit."),
    priceListId: optionalId,
    customerId: z.uuid("Select a customer."),
    ...itemFilter,
    lines: z.array(customerPriceLineSchema).min(1, "Add at least one item.").max(5000),
  })
  .refine((data) => new Set(data.lines.map((l) => l.itemId)).size === data.lines.length, {
    message: "Each item can appear only once.",
    path: ["lines"],
  });

export type CustomerPriceInput = z.input<typeof customerPriceSchema>;
export type CustomerPriceData = z.output<typeof customerPriceSchema>;

// ─── Customer group price ─────────────────────────────────────────────────────

export const groupPriceLineSchema = z
  .object({
    itemId: z.uuid("Select an item."),
    fromDate: optionalDate,
    toDate: optionalDate,
    fromQty: optionalQty("From qty"),
    toQty: optionalQty("To qty"),
    dpPrice: price("DP price"),
    tpPrice: price("TP price"),
  })
  .superRefine((row, ctx) => {
    if (row.fromDate && row.toDate && row.fromDate > row.toDate) ctx.addIssue({ code: "custom", message: "From date cannot be after to date.", path: ["toDate"] });
    if (row.fromQty && row.toQty && Number(row.fromQty) > Number(row.toQty)) ctx.addIssue({ code: "custom", message: "From qty cannot exceed to qty.", path: ["toQty"] });
  });

export const groupPriceSchema = z.object({
  businessUnitId: z.uuid("Select a business unit."),
  priceListId: optionalId,
  officeId: z.uuid("Select an office."),
  customerGroupId: z.uuid("Select a customer group."),
  createDate: z.iso.date("Create date is required."),
  circularNo: z.string().trim().max(100).optional().default(""),
  remarks: z.string().trim().max(500).optional().default(""),
  isRunning: z.boolean().default(true),
  ...itemFilter,
  lines: z.array(groupPriceLineSchema).min(1, "Add at least one item.").max(5000),
});

export type GroupPriceInput = z.input<typeof groupPriceSchema>;
export type GroupPriceData = z.output<typeof groupPriceSchema>;

// ─── List ─────────────────────────────────────────────────────────────────────

export const priceListQuerySchema = z.object({
  tab: z.enum(["customer", "group"]).default("customer"),
  search: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce
    .number()
    .int()
    .refine((value) => [10, 25, 50, 100].includes(value), "Invalid page size.")
    .default(10),
});

export type PriceListQuery = z.output<typeof priceListQuerySchema>;

export interface CustomerPriceRow {
  id: string;
  customerCode: string;
  customerName: string;
  priceListName: string | null;
  itemCount: number;
  updatedAt: string;
  isActive: boolean;
}

export interface GroupPriceRow {
  id: string;
  officeName: string;
  customerGroupName: string;
  priceListName: string | null;
  createDate: string;
  circularNo: string | null;
  itemCount: number;
  isRunning: boolean;
}

export interface PriceSetupList<T> {
  rows: T[];
  total: number;
  page: number;
  pageSize: number;
}

export type CustomerPriceDto = CustomerPriceData & { id: string; isActive: boolean };
export type GroupPriceDto = GroupPriceData & { id: string };

interface BuOption {
  id: string;
  name: string;
  businessUnitId: string;
}

export interface PriceSetupOptions {
  businessUnits: { id: string; name: string }[];
  offices: BuOption[];
  customerGroups: BuOption[];
  priceLists: BuOption[];
  customers: (BuOption & { code: string })[];
  categories: (BuOption & { parentId: string | null; level: number })[];
  items: (BuOption & { code: string; uom: string; itemType: string | null; categoryId: string | null; salesRate: string })[];
}

export interface PriceImportResult {
  created: number;
  updated: number;
  errors: { row: number; message: string }[];
}
