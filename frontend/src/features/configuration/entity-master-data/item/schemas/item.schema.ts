import { z } from "zod";
import { UUID_PATTERN } from "@/lib/validation/fields";

// Shared by the Item Profile forms (client validation) and the API (server
// validation). Items are the same records Sales uses. Optional text fields are
// strings where "" means "not set"; the service stores them as NULL.

const text = (max: number) => z.string().trim().max(max, `Must be ${max} characters or fewer.`);
const optionalText = (max: number) => text(max).optional().default("");
const optionalId = z.union([z.string().regex(UUID_PATTERN, { message: "Select a valid option." }), z.literal("")]).optional().default("");

const amount = (label: string) =>
  z
    .string()
    .trim()
    .refine((value) => value === "" || /^\d{1,12}(\.\d{1,2})?$/.test(value), { message: `${label}: enter an amount (up to 2 decimals).` })
    .optional()
    .default("");

const quantity3 = (label: string) =>
  z
    .string()
    .trim()
    .refine((value) => value === "" || (/^\d{1,11}(\.\d{1,3})?$/.test(value) && Number(value) > 0), {
      message: `${label}: enter a number above 0 (up to 3 decimals).`,
    })
    .optional()
    .default("");

export const ITEM_TYPES = [
  "Raw Material",
  "Packaging Material",
  "Semi-Finished Goods",
  "Finished Goods",
  "Trading Goods",
  "Consumables",
  "Spare Parts",
  "Asset",
  "Service",
] as const;

export const RESTRICTED_AGES = ["None", "16+", "18+", "21+"] as const;
export const TRACKING_OPTIONS = [
  { value: "NONE", label: "None" },
  { value: "BOTH", label: "Both (batch & serial)" },
] as const;

export const ITEM_FLAGS = [
  { key: "autoBarcode", label: "Auto Barcode" },
  { key: "canBeSold", label: "Can be Sold" },
  { key: "canBePurchased", label: "Can be Purchased" },
  { key: "canBeRented", label: "Can be Rented" },
  { key: "noDecimal", label: "Is Not Allow Decimal" },
  { key: "allowEbt", label: "Is Allow EBT" },
  { key: "isDefault", label: "Is Default Item" },
] as const;

export type ItemFlag = (typeof ITEM_FLAGS)[number]["key"];

export const itemInputSchema = z
  .object({
    businessUnitId: z.string().regex(UUID_PATTERN, { message: "Select a valid business unit." }),
    autoBarcode: z.boolean().default(false),
    canBeSold: z.boolean().default(true),
    canBePurchased: z.boolean().default(true),
    canBeRented: z.boolean().default(false),
    noDecimal: z.boolean().default(false),
    allowEbt: z.boolean().default(false),
    isDefault: z.boolean().default(false),
    // Basic Information
    code: text(30).min(1, "Master item code is required."),
    printedCode: text(30).min(1, "Printed item code is required."),
    name: text(200).min(1, "Master item name is required."),
    printedName: text(200).min(1, "Printed / customer name is required."),
    itemType: z.union([z.enum(ITEM_TYPES), z.literal("")]).optional().default(""),
    uom: text(20).min(1, "UOM is required."),
    divisionId: optionalId,
    categoryId: optionalId,
    subCategoryId: optionalId,
    minorCategoryId: optionalId,
    altUom: optionalText(20),
    altUnit: quantity3("Alt. unit"),
    netWeight: quantity3("Net weight"),
    netWeightUnit: optionalText(20),
    restrictedAge: z.union([z.enum(RESTRICTED_AGES), z.literal("")]).optional().default(""),
    tracking: z.enum(["NONE", "BOTH"]).default("NONE"),
    // Additional Information
    barcode: optionalText(60),
    brand: optionalText(100),
    sellingPrice: amount("Selling price"),
    retailPrice: amount("Retail price"),
    dealerPrice: amount("Dealer price"),
    tradingPrice: amount("Trading price"),
    purchasePrice: amount("Purchase price"),
    vatPercent: z
      .string()
      .trim()
      .refine((value) => value === "" || (/^\d{1,3}(\.\d{1,2})?$/.test(value) && Number(value) <= 100), {
        message: "VAT %: enter 0 to 100 (up to 2 decimals).",
      })
      .optional()
      .default(""),
  })
  .refine((data) => !data.subCategoryId || data.categoryId, { message: "Select a category first.", path: ["subCategoryId"] })
  .refine((data) => !data.minorCategoryId || data.subCategoryId, { message: "Select a sub category first.", path: ["minorCategoryId"] })
  .refine((data) => !data.altUnit || data.altUom, { message: "Choose the alt. UOM for this unit.", path: ["altUom"] })
  .refine((data) => !data.netWeight || data.netWeightUnit, { message: "Choose the net weight unit.", path: ["netWeightUnit"] });

export type ItemInput = z.input<typeof itemInputSchema>;
export type ItemData = z.output<typeof itemInputSchema>;

export const itemListQuerySchema = z.object({
  search: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce
    .number()
    .int()
    .refine((value) => [10, 25, 50, 100].includes(value), "Invalid page size.")
    .default(10),
});

export type ItemListQuery = z.output<typeof itemListQuerySchema>;

// ─── Categories, divisions, units ─────────────────────────────────────────────

export const CATEGORY_LEVELS = ["", "Category", "Sub Category", "Minor Category"] as const;

export const createCategorySchema = z.object({
  businessUnitId: z.uuid("Select a business unit."),
  parentId: optionalId,
  name: text(100).min(1, "Name is required."),
  description: optionalText(300),
});

export const updateCategorySchema = z.object({
  name: text(100).min(1, "Name is required."),
  description: optionalText(300),
});

export const createNamedOptionSchema = z.object({
  businessUnitId: z.uuid("Select a business unit."),
  name: text(100).min(1, "Name is required."),
});

export type CreateCategoryInput = z.input<typeof createCategorySchema>;
export type UpdateCategoryInput = z.input<typeof updateCategorySchema>;
export type CreateNamedOptionInput = z.input<typeof createNamedOptionSchema>;

// ─── Opening stock ────────────────────────────────────────────────────────────

export const OPENING_ITEM_TYPES = [
  { value: "INVENTORY", label: "Inventory Item" },
  { value: "ASSET", label: "Asset Item" },
] as const;

export const openingStockLineSchema = z.object({
  itemId: z.uuid("Select an item."),
  quantity: z
    .string()
    .trim()
    .refine((value) => /^\d{1,11}(\.\d{1,3})?$/.test(value) && Number(value) > 0, { message: "Enter a quantity above 0." }),
  rate: z
    .string()
    .trim()
    .refine((value) => /^\d{1,12}(\.\d{1,2})?$/.test(value), { message: "Enter a rate (up to 2 decimals)." }),
});

export const openingStockSchema = z.object({
  receiptDate: z.iso.date("Enter a valid date."),
  officeId: z.uuid("Select an office."),
  warehouseId: z.uuid("Select a warehouse."),
  itemType: z.enum(["INVENTORY", "ASSET"], { error: "Select an item type." }),
  challanNo: optionalText(50),
  remarks: optionalText(500),
  creditAccountCode: optionalText(30),
  lines: z.array(openingStockLineSchema).min(1, "Add at least one item.").max(500, "Up to 500 lines per receipt."),
});

export type OpeningStockInput = z.input<typeof openingStockSchema>;
export type OpeningStockData = z.output<typeof openingStockSchema>;

// ─── DTOs ─────────────────────────────────────────────────────────────────────

export interface ItemListRow {
  id: string;
  isActive: boolean;
  createdAt: string;
  code: string;
  barcode: string | null;
  printedCode: string | null;
  name: string;
  itemType: string | null;
  divisionName: string | null;
  categoryName: string | null;
  subCategoryName: string | null;
  minorCategoryName: string | null;
  brand: string | null;
  uom: string;
  netWeightUnit: string | null;
  currentStock: string;
  sellingPrice: string;
  retailPrice: string | null;
  dealerPrice: string | null;
  tradingPrice: string | null;
  purchasePrice: string | null;
  lastCost: string | null;
  avgCost: string | null;
  vatPercent: string;
}

export interface ItemList {
  rows: ItemListRow[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ItemDto extends ItemData {
  id: string;
  isActive: boolean;
}

export interface CategoryOption {
  id: string;
  name: string;
  parentId: string | null;
  level: number;
  businessUnitId: string;
  description: string | null;
  itemCount: number;
}

export interface ItemFormOptions {
  businessUnits: { id: string; name: string }[];
  divisions: { id: string; name: string; businessUnitId: string }[];
  categories: CategoryOption[];
  uoms: { name: string; businessUnitId: string }[];
}

export interface GlAccountOption {
  code: string;
  name: string;
  type: string;
}

export interface OpeningStockOptions {
  offices: { id: string; name: string; businessUnitId: string }[];
  warehouses: { id: string; name: string; officeId: string }[];
  items: { id: string; code: string; name: string; uom: string; itemType: string | null; noDecimal: boolean; businessUnitId: string }[];
  accounts: GlAccountOption[];
}

export interface OpeningStockResult {
  id: string;
  number: string;
  lineCount: number;
  totalAmount: string;
}

export interface ItemImportResult {
  created: number;
  errors: { row: number; message: string }[];
}

export const MAX_ITEM_IMPORT_ROWS = 2000;
