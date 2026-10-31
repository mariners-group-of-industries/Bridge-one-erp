import { z } from "zod";

export const BOM_TYPES = ["SINGLE_OUTPUT", "MULTIPLE_OUTPUT"] as const;
export type BomType = (typeof BOM_TYPES)[number];
export const BOM_TYPE_LABELS: Record<BomType, string> = { SINGLE_OUTPUT: "Single Output", MULTIPLE_OUTPUT: "Multiple Output" };

export const OUTPUT_TYPES = ["FINISHED_GOODS", "SEMI_FINISHED_GOODS"] as const;
export type OutputType = (typeof OUTPUT_TYPES)[number];
export const OUTPUT_TYPE_LABELS: Record<OutputType, string> = { FINISHED_GOODS: "Finished Goods", SEMI_FINISHED_GOODS: "Semi Finished Goods" };

export const WASTAGE_TYPES = ["SCRAP", "BY_PRODUCT", "RUNNER", "REWORK", "DEFECT"] as const;
export type WastageType = (typeof WASTAGE_TYPES)[number];
export const WASTAGE_TYPE_LABELS: Record<WastageType, string> = { SCRAP: "Scrap", BY_PRODUCT: "By-Product", RUNNER: "Runner", REWORK: "Rework", DEFECT: "Defect" };

const finite = (label: string) => z.number({ error: `${label} is required.` }).refine(Number.isFinite, { error: `${label} must be a number.` });
const MAX = 9_999_999_999;

const outputSchema = z.object({
  itemId: z.uuid({ error: "Choose the FG/SFG item." }),
  outputType: z.enum(OUTPUT_TYPES, { error: "Choose the item type." }),
  netWeight: finite("Net Weight").min(0, { error: "Net Weight cannot be negative." }).max(MAX),
  lotSizeQty: finite("Lot Size").gt(0, { error: "Lot Size must be more than 0." }).max(MAX),
  costPercent: finite("Cost %").min(0, { error: "Cost % cannot be negative." }).max(100, { error: "Cost % cannot be over 100." }),
  tolerancePercent: finite("Tolerance").min(0, { error: "Tolerance cannot be negative." }).max(100, { error: "Tolerance cannot be over 100%." }).nullish(),
  /** The main output; when none is marked, the first item is. */
  isPrimary: z.boolean().default(false),
});

const materialSchema = z.object({
  itemId: z.uuid({ error: "Choose the material item." }),
  materialType: z.string().trim().max(50).nullish(),
  excludeFromScrap: z.boolean().default(false),
  qty: finite("Quantity").gt(0, { error: "Quantity must be more than 0." }).max(MAX),
  wastagePercent: finite("Wastage").min(0, { error: "Wastage cannot be negative." }).lt(100, { error: "Wastage must be below 100%." }),
  rate: finite("Rate").min(0, { error: "Rate cannot be negative." }).max(MAX),
});

const wastageSchema = z.object({
  itemId: z.uuid({ error: "Choose the wastage / by-product item." }),
  itemType: z.string().trim().max(50).nullish(),
  outputType: z.enum(WASTAGE_TYPES, { error: "Choose the output type." }),
  ratioPercent: finite("Ratio Qty (%)").gt(0, { error: "Ratio Qty (%) must be more than 0." }).max(100, { error: "Ratio Qty (%) cannot be over 100." }),
  isMandatory: z.boolean().default(false),
  calcWithNetWeight: z.boolean().default(false),
  calcWithProcessRunner: z.boolean().default(false),
});

/** Overhead booked to an expense account: a % of the material cost, or a fixed amount. */
const overheadSchema = z
  .object({
    accountId: z.uuid({ error: "Choose the overhead account." }),
    percentage: finite("Percentage").gt(0, { error: "Percentage must be more than 0." }).max(1000, { error: "Percentage is too large." }).nullish(),
    amount: finite("Amount").min(0, { error: "Amount cannot be negative." }).max(MAX).default(0),
  })
  .refine((line) => (line.percentage ?? null) !== null || line.amount > 0, { error: "Enter a percentage or an amount.", path: ["amount"] });

const distinct = (ids: readonly string[]) => new Set(ids).size === ids.length;

/** Body of POST /api/production/bill-of-materials and `data` of PUT (shared by the route and the browser). */
export const bomInputSchema = z
  .object({
    /** Needed only when the user has more than one business unit. */
    businessUnitId: z.uuid().optional(),
    name: z.string({ error: "BoM Name is required." }).trim().min(1, { error: "BoM Name is required." }).max(150, { error: "BoM Name is too long." }),
    bomType: z.enum(BOM_TYPES),
    /** Required for a multiple output BOM; optional for a single output one (as in Managerium). */
    departmentId: z.uuid().nullish(),
    departmentSectionId: z.uuid().nullish(),
    remarks: z.string().trim().max(500).nullish(),
    outputs: z.array(outputSchema).min(1, { error: "Add at least one production item." }).max(50),
    materials: z.array(materialSchema).min(1, { error: "Add at least one input material." }).max(300),
    wastages: z.array(wastageSchema).max(100).default([]),
    overheads: z.array(overheadSchema).max(50).default([]),
  })
  .superRefine((input, ctx) => {
    if (input.bomType === "SINGLE_OUTPUT" && input.outputs.length !== 1) {
      ctx.addIssue({ code: "custom", path: ["outputs"], message: "A single output BOM has exactly one production item." });
    }
    if (input.bomType === "MULTIPLE_OUTPUT" && input.outputs.length < 2) {
      ctx.addIssue({ code: "custom", path: ["outputs"], message: "A multiple output BOM needs at least two production items." });
    }
    if (input.bomType === "MULTIPLE_OUTPUT" && !input.departmentId) ctx.addIssue({ code: "custom", path: ["departmentId"], message: "Department is required." });
    if (input.bomType === "MULTIPLE_OUTPUT" && !input.departmentSectionId) ctx.addIssue({ code: "custom", path: ["departmentSectionId"], message: "Section is required." });
    if (input.departmentSectionId && !input.departmentId) ctx.addIssue({ code: "custom", path: ["departmentId"], message: "Choose the department of the section." });
    const share = input.outputs.reduce((sum, line) => sum + line.costPercent, 0);
    if (input.outputs.length > 0 && Math.abs(share - 100) > 0.01) {
      ctx.addIssue({ code: "custom", path: ["outputs"], message: `Cost percentages must add up to 100 (now ${Math.round(share * 100) / 100}).` });
    }
    if (!distinct(input.outputs.map((line) => line.itemId))) ctx.addIssue({ code: "custom", path: ["outputs"], message: "A production item is added twice." });
    if (input.outputs.filter((line) => line.isPrimary).length > 1) ctx.addIssue({ code: "custom", path: ["outputs"], message: "Only one production item can be the primary item." });
    if (!distinct(input.materials.map((line) => line.itemId))) ctx.addIssue({ code: "custom", path: ["materials"], message: "An input material is added twice." });
    if (!distinct(input.wastages.map((line) => line.itemId))) ctx.addIssue({ code: "custom", path: ["wastages"], message: "A wastage item is added twice." });
    if (!distinct(input.overheads.map((line) => line.accountId))) ctx.addIssue({ code: "custom", path: ["overheads"], message: "An overhead account is added twice." });
    const outputIds = new Set(input.outputs.map((line) => line.itemId));
    if (input.materials.some((line) => outputIds.has(line.itemId))) {
      ctx.addIssue({ code: "custom", path: ["materials"], message: "A production item cannot also be its own input material." });
    }
  });
export type BomInput = z.input<typeof bomInputSchema>;
export type ParsedBomInput = z.output<typeof bomInputSchema>;

/** PUT body: optimistic lock on `updatedAt`. */
export const bomUpdateSchema = z.object({ version: z.iso.datetime(), data: bomInputSchema });
export type BomUpdate = z.input<typeof bomUpdateSchema>;
export const bomStatusSchema = z.object({ version: z.iso.datetime(), isActive: z.boolean() });
export const bomDeleteSchema = z.object({ version: z.iso.datetime() });

/** Body of PUT /api/production/bill-of-materials/[id]/children ("Tag Child BOM"): replaces the list. */
export const bomChildrenSchema = z.object({
  links: z
    .array(
      z.object({
        childBomId: z.uuid({ error: "Choose the child BOM." }),
        stage: z.string().trim().min(1, { error: "Stage/Level is required." }).max(50, { error: "Stage/Level is too long." }),
      }),
    )
    .max(100)
    .refine((links) => distinct(links.map((link) => link.childBomId)), { error: "A child BOM is tagged twice." }),
});
export type BomChildrenInput = z.input<typeof bomChildrenSchema>;

export const BOM_STATUSES = ["ACTIVE", "INACTIVE"] as const;

/** Filters of GET /api/production/bill-of-materials. */
export const bomListQuerySchema = z.object({
  departmentId: z.uuid().optional(),
  departmentSectionId: z.uuid().optional(),
  status: z.enum(BOM_STATUSES).optional(),
  search: z.string().trim().max(100).optional(),
});
export type BomListQuery = z.input<typeof bomListQuerySchema>;

/**
 * GET /api/production/bill-of-materials/options: child BOM search. An empty search lists
 * the first ones (by name) for the open dropdown; otherwise at least 3 letters.
 */
export const bomOptionsQuerySchema = z.object({
  search: z
    .string()
    .trim()
    .max(100)
    .default("")
    .refine((search) => search.length === 0 || search.length >= 3, { error: "Type at least 3 letters." }),
  exclude: z.uuid().optional(),
});

export interface BomOption {
  id: string;
  name: string;
  isActive: boolean;
}

export interface BomItemOption {
  id: string;
  businessUnitId: string;
  code: string;
  name: string;
  uom: string;
  altUom: string | null;
  altUomFactor: number | null;
  itemType: string | null;
  netWeight: number | null;
  /** Level-1 and level-2 ancestors of the item's category. */
  categoryId: string | null;
  subCategoryId: string | null;
  /** Weighted average purchase rate (accepted receipts), else the purchase price, else 0. */
  avgRate: number;
  /** Stock on hand in all warehouses. */
  stock: number;
}

export interface BomLookups {
  businessUnits: { id: string; name: string }[];
  /** Active expense accounts for overheads. */
  accounts: { id: string; code: string; name: string }[];
  departments: { id: string; name: string; businessUnitId: string }[];
  sections: { id: string; name: string; departmentId: string }[];
  categories: { id: string; name: string; parentId: string | null; level: number; businessUnitId: string }[];
  items: BomItemOption[];
}

export interface BomRowOutput {
  itemId: string;
  code: string;
  name: string;
  uom: string;
  altUom: string | null;
  lotSizeQty: number;
}

export interface BomRow {
  id: string;
  businessUnitId: string;
  name: string;
  bomType: BomType;
  createdAt: string;
  updatedAt: string;
  departmentName: string | null;
  sectionName: string | null;
  outputs: BomRowOutput[];
  lotSize: number;
  tolerancePercent: number | null;
  materialCost: number;
  overheadCost: number;
  totalCost: number;
  isActive: boolean;
  childCount: number;
  createdByName: string;
}

export interface BomOutputLine {
  itemId: string;
  code: string;
  name: string;
  uom: string;
  outputType: OutputType;
  netWeight: number;
  lotSizeQty: number;
  totalWeight: number;
  costPercent: number;
  tolerancePercent: number | null;
  isPrimary: boolean;
}

export interface BomMaterialLine {
  itemId: string;
  code: string;
  name: string;
  materialType: string | null;
  excludeFromScrap: boolean;
  uom: string;
  altUom: string | null;
  altQty: number | null;
  qty: number;
  wastagePercent: number;
  totalQty: number;
  rate: number;
  amount: number;
}

export interface BomWastageLine {
  itemId: string;
  code: string;
  name: string;
  uom: string;
  itemType: string | null;
  outputType: WastageType;
  ratioPercent: number;
  isMandatory: boolean;
  calcWithNetWeight: boolean;
  calcWithProcessRunner: boolean;
  /** Expected quantity of one lot (see `wastageQty`). */
  expectedQty: number;
}

export interface BomOverheadLine {
  accountId: string;
  accountCode: string;
  accountName: string;
  percentage: number | null;
  amount: number;
}

export interface BomChildLink {
  childBomId: string;
  name: string;
  stage: string;
  totalCost: number;
  isActive: boolean;
}

export interface BomDetail extends BomRow {
  departmentId: string | null;
  departmentSectionId: string | null;
  remarks: string | null;
  outputLines: BomOutputLine[];
  materials: BomMaterialLine[];
  wastages: BomWastageLine[];
  overheads: BomOverheadLine[];
  children: BomChildLink[];
  /** BOMs this one is tagged to as a child. */
  parents: { id: string; name: string; stage: string }[];
}
