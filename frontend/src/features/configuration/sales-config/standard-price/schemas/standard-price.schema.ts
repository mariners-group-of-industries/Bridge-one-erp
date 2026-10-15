import { z } from "zod";
import { ITEM_TYPES } from "@/features/configuration/entity-master-data/item/schemas/item.schema";

// Standard Price Setup (Configuration › Sales Config). One editable row per item;
// each save stores a dated price (history), the latest date is the current one.
// "" means "not set"; the service stores NULL.

export { ITEM_TYPES };

export const INCREASE_TYPES = [
  { value: "PERCENT", label: "%" },
  { value: "AMOUNT", label: "Amount" },
] as const;
export type IncreaseType = (typeof INCREASE_TYPES)[number]["value"];

const optionalId = z
  .union([z.uuid("Select a valid option."), z.literal("")])
  .optional()
  .default("");
const optionalPrice = (label: string) =>
  z
    .string()
    .trim()
    .refine((v) => v === "" || /^\d{1,12}(\.\d{1,2})?$/.test(v), { message: `${label}: enter an amount (up to 2 decimals).` })
    .optional()
    .default("");

/** Filters of the list (applied with "View"), plus search and paging. */
export const standardPriceQuerySchema = z.object({
  businessUnitId: optionalId,
  itemType: z
    .union([z.enum(ITEM_TYPES), z.literal("")])
    .optional()
    .default(""),
  categoryId: optionalId,
  subCategoryId: optionalId,
  customerId: optionalId,
  supplierId: optionalId,
  search: z.string().trim().max(100).optional().default(""),
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(200).optional().default(50),
});
export type StandardPriceQuery = z.output<typeof standardPriceQuerySchema>;
/** Filters as the client sends them (validated by `standardPriceQuerySchema`). */
export type StandardPriceFilter = {
  businessUnitId?: string;
  itemType?: string;
  categoryId?: string;
  subCategoryId?: string;
  customerId?: string;
  supplierId?: string;
  search?: string;
};

export const standardPriceRowSchema = z
  .object({
    itemId: z.uuid("Select an item."),
    effectiveFrom: z.iso.date("Effective From: enter a valid date."),
    costPrice: optionalPrice("Cost Price"),
    increaseType: z.enum(["PERCENT", "AMOUNT"]).optional().default("PERCENT"),
    increaseValue: optionalPrice("Price Increase"),
    etpPrice: optionalPrice("ETP Price"),
    dealerPrice: optionalPrice("Dealer Price"),
    tradingPrice: optionalPrice("Trading Price"),
    mrp: optionalPrice("Retail Price (MRP)"),
    minSalesPrice: optionalPrice("Minimum Sales Price"),
    remarks: z.string().trim().max(300, "Remarks: at most 300 characters.").optional().default(""),
  })
  .refine((row) => row.increaseType !== "PERCENT" || row.increaseValue === "" || Number(row.increaseValue) <= 1000, {
    message: "Price Increase: at most 1000%.",
    path: ["increaseValue"],
  })
  .refine((row) => row.minSalesPrice === "" || row.mrp === "" || Number(row.minSalesPrice) <= Number(row.mrp), {
    message: "Minimum Sales Price cannot be above the Retail Price (MRP).",
    path: ["minSalesPrice"],
  });

export const saveStandardPricesSchema = z
  .object({
    businessUnitId: z.uuid("Select a business unit."),
    rows: z.array(standardPriceRowSchema).min(1, "Change at least one row before saving.").max(1000, "Save at most 1000 rows at a time."),
  })
  .refine((data) => new Set(data.rows.map((r) => r.itemId)).size === data.rows.length, { message: "Each item can appear only once.", path: ["rows"] });

export type StandardPriceRowInput = z.input<typeof standardPriceRowSchema>;
export type SaveStandardPricesInput = z.input<typeof saveStandardPricesSchema>;

/** ETP = cost + increase (% of cost, or a flat amount); "" when there is no cost. */
export function etpOf(costPrice: string, increaseType: string, increaseValue: string): string {
  if (costPrice === "" || Number.isNaN(Number(costPrice))) return "";
  const cost = Number(costPrice);
  const value = Number(increaseValue || 0);
  const etp = increaseType === "AMOUNT" ? cost + value : cost + (cost * value) / 100;
  return (Math.round(etp * 100) / 100).toFixed(2);
}

// ─── DTOs ─────────────────────────────────────────────────────────────────────

/** One item with its current standard price (or the Item Profile prices when none is saved). */
export interface StandardPriceRow {
  itemId: string;
  code: string;
  name: string;
  uom: string;
  /** Saved standard price id; null = never saved (values come from the Item Profile). */
  priceId: string | null;
  effectiveFrom: string;
  costPrice: string;
  increaseType: IncreaseType;
  increaseValue: string;
  etpPrice: string;
  dealerPrice: string;
  tradingPrice: string;
  mrp: string;
  minSalesPrice: string;
  remarks: string;
  /** How many dated prices the item has. */
  historyCount: number;
}

export interface StandardPriceList {
  rows: StandardPriceRow[];
  total: number;
  page: number;
  pageSize: number;
}

type BuOption = { id: string; name: string; businessUnitId: string };
export interface StandardPriceOptions {
  businessUnits: { id: string; name: string }[];
  categories: (BuOption & { parentId: string | null; level: number })[];
  customers: (BuOption & { code: string })[];
  suppliers: (BuOption & { code: string })[];
}

export interface StandardPriceImportResult {
  created: number;
  updated: number;
  errors: { row: number; message: string }[];
}
