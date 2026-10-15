import { z } from "zod";
import { ITEM_TYPES } from "@/features/configuration/entity-master-data/item/schemas/item.schema";

// Sales Return Price Setup (Configuration › Sales Config). One editable row per
// item; each save stores dated return rates (history), the latest date is current.

export { ITEM_TYPES };

const optionalId = z
  .union([z.uuid("Select a valid option."), z.literal("")])
  .optional()
  .default("");
const rate = (label: string) =>
  z
    .string()
    .trim()
    .transform((v) => (v === "" ? "0" : v))
    .refine((v) => /^\d{1,12}(\.\d{1,2})?$/.test(v), { message: `${label}: enter an amount (up to 2 decimals).` });

export const RATE_FIELDS = [
  { key: "damageRate", label: "Damage Return Rate" },
  { key: "expireRate", label: "Expire Rate" },
  { key: "damageExpireRate", label: "Damage & Expire Rate" },
  { key: "soundStockRate", label: "Sound & Stock Rate" },
] as const;
export type RateField = (typeof RATE_FIELDS)[number]["key"];

/** Filters of the list (applied with "View"), plus search and paging. */
export const returnPriceQuerySchema = z.object({
  businessUnitId: optionalId,
  itemType: z
    .union([z.enum(ITEM_TYPES), z.literal("")])
    .optional()
    .default(""),
  categoryId: optionalId,
  subCategoryId: optionalId,
  search: z.string().trim().max(100).optional().default(""),
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(200).optional().default(50),
});

/** Filters as the client sends them (validated by `returnPriceQuerySchema`). */
export type ReturnPriceFilter = {
  businessUnitId?: string;
  itemType?: string;
  categoryId?: string;
  subCategoryId?: string;
  search?: string;
};

export const returnPriceRowSchema = z.object({
  itemId: z.uuid("Select an item."),
  effectiveFrom: z.iso.date("Effective From: enter a valid date."),
  damageRate: rate("Damage Return Rate"),
  expireRate: rate("Expire Rate"),
  damageExpireRate: rate("Damage & Expire Rate"),
  soundStockRate: rate("Sound & Stock Rate"),
});

export const saveReturnPricesSchema = z
  .object({
    businessUnitId: z.uuid("Select a business unit."),
    rows: z.array(returnPriceRowSchema).min(1, "Change at least one row before saving.").max(1000, "Save at most 1000 rows at a time."),
  })
  .refine((data) => new Set(data.rows.map((r) => r.itemId)).size === data.rows.length, { message: "Each item can appear only once.", path: ["rows"] });

export type ReturnPriceRowInput = z.input<typeof returnPriceRowSchema>;
export type SaveReturnPricesInput = z.input<typeof saveReturnPricesSchema>;

// ─── DTOs ─────────────────────────────────────────────────────────────────────

export interface ReturnPriceRow {
  itemId: string;
  code: string;
  name: string;
  uom: string;
  /** Saved rates id; null = never saved (date empty, rates 0). */
  priceId: string | null;
  effectiveFrom: string;
  damageRate: string;
  expireRate: string;
  damageExpireRate: string;
  soundStockRate: string;
  historyCount: number;
}

export interface ReturnPriceList {
  rows: ReturnPriceRow[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ReturnPriceOptions {
  businessUnits: { id: string; name: string }[];
  categories: { id: string; name: string; businessUnitId: string; parentId: string | null; level: number }[];
}

export interface ReturnPriceImportResult {
  created: number;
  updated: number;
  errors: { row: number; message: string }[];
}
