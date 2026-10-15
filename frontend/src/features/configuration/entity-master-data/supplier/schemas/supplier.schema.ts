import { z } from "zod";

// Shared by the Supplier Profile form (client validation) and the API (server
// validation). Optional text fields are plain strings where "" means "not set";
// the service stores them as NULL.

const text = (max: number) => z.string().trim().max(max, `Must be ${max} characters or fewer.`);
const optionalText = (max: number) => text(max).optional().default("");
const optionalId = z.union([z.uuid("Select a valid option."), z.literal("")]).optional().default("");

/** Percentage 0–100 with up to two decimals, or "". */
const percent = z
  .string()
  .trim()
  .refine((value) => value === "" || (/^\d{1,3}(\.\d{1,2})?$/.test(value) && Number(value) <= 100), {
    message: "Enter a percentage between 0 and 100 (up to 2 decimals).",
  })
  .optional()
  .default("");

export const supplierDetailSchema = z.object({
  code: optionalText(30),
  vendorName: optionalText(150),
  address: text(500).min(1, "Address is required."),
  gps: optionalText(100),
  contactPerson: optionalText(150),
  contactNumber: optionalText(30),
  vatRegNo: optionalText(50),
});

export const supplierInputSchema = z.object({
  // Partner Details
  officeId: z.uuid("Select an office."),
  name: text(150).min(1, "Partner name is required."),
  code: optionalText(30),
  mobile: optionalText(30),
  email: z.union([z.email("Enter a valid email address.").max(254), z.literal("")]).optional().default(""),
  groupId: optionalId,
  subGroupId: optionalId,
  creditDays: z
    .string()
    .trim()
    .refine((value) => value === "" || (/^\d{1,4}$/.test(value) && Number(value) <= 3650), {
      message: "Enter whole days between 0 and 3650.",
    })
    .optional()
    .default(""),
  tolerancePercent: percent,
  binNumber: optionalText(30),
  tcsPercent: percent,
  vatRegistrationNo: optionalText(50),
  tinNumber: optionalText(50),
  tradeLicenseNo: optionalText(50),
  isMonthly: z.boolean().default(false),
  isForeign: z.boolean().default(false),
  vdsApplicable: z.boolean().default(false),
  vatAccountingNotApplicable: z.boolean().default(false),
  isUser: z.boolean().default(false),
  // Billing Details
  billingAddress: optionalText(500),
  districtId: z
    .union([z.number().int().min(1), z.literal("")])
    .optional()
    .default(""),
  thanaId: optionalId,
  contactPerson: optionalText(150),
  contactNo: optionalText(30),
  taxBracketId: optionalId,
  remarks: optionalText(1000),
  // Supplier Details list
  details: z.array(supplierDetailSchema).max(200, "Up to 200 supplier details per partner.").default([]),
});

export type SupplierDetailInput = z.input<typeof supplierDetailSchema>;
export type SupplierInput = z.input<typeof supplierInputSchema>;
export type SupplierData = z.output<typeof supplierInputSchema>;

/** List filters; shared by the list and the Excel download. */
export const supplierFilterSchema = z.object({
  search: z.string().trim().max(100).optional(),
  officeId: z.uuid().optional().catch(undefined),
  groupId: z.uuid().optional().catch(undefined),
  status: z.enum(["active", "inactive"]).optional().catch(undefined),
  type: z.enum(["local", "foreign"]).optional().catch(undefined),
});

export type SupplierFilters = z.output<typeof supplierFilterSchema>;

export const supplierListQuerySchema = supplierFilterSchema.extend({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce
    .number()
    .int()
    .refine((value) => [10, 25, 50, 100].includes(value), "Invalid page size.")
    .default(10),
});

export type SupplierListQuery = z.output<typeof supplierListQuerySchema>;

// ─── "+ Add new" options ──────────────────────────────────────────────────────

export const createSupplierGroupSchema = z.object({
  officeId: z.uuid("Select an office first."),
  name: text(100).min(1, "Name is required."),
  /** Set for a Sub Group. */
  parentId: optionalId,
});

export const createThanaSchema = z.object({
  districtId: z.number().int().min(1, "Select a district first."),
  name: text(100).min(1, "Name is required."),
});

export const createTaxBracketSchema = z.object({
  officeId: z.uuid("Select an office first."),
  name: text(100).min(1, "Name is required."),
  ratePercent: percent,
});

export type CreateSupplierGroupInput = z.input<typeof createSupplierGroupSchema>;
export type CreateThanaInput = z.input<typeof createThanaSchema>;
export type CreateTaxBracketInput = z.input<typeof createTaxBracketSchema>;

// ─── DTOs ─────────────────────────────────────────────────────────────────────

export interface SupplierListRow {
  id: string;
  code: string;
  name: string;
  officeName: string | null;
  groupName: string | null;
  subGroupName: string | null;
  mobile: string | null;
  email: string | null;
  billingContactNo: string | null;
  billingAddress: string | null;
  creditDays: number | null;
  districtName: string | null;
  isForeign: boolean;
  detailCount: number;
  isActive: boolean;
  updatedAt: string;
}

export interface SupplierList {
  rows: SupplierListRow[];
  total: number;
  page: number;
  pageSize: number;
}

export interface SupplierAttachmentDto {
  id: string;
  originalName: string;
  mimeType: string;
  size: number;
  createdAt: string;
}

/** A saved supplier in the form's shape, plus server-only fields. */
export interface SupplierDto extends SupplierData {
  id: string;
  attachments: SupplierAttachmentDto[];
}

export interface SupplierGroupOption {
  id: string;
  name: string;
  parentId: string | null;
  businessUnitId: string;
}

export interface TaxBracketOption {
  id: string;
  name: string;
  ratePercent: string | null;
  businessUnitId: string;
}

export interface SupplierFormOptions {
  offices: { id: string; name: string; businessUnitId: string }[];
  groups: SupplierGroupOption[];
  districts: { id: number; name: string; division: string }[];
  thanas: { id: string; name: string; districtId: number }[];
  taxBrackets: TaxBracketOption[];
}

export interface SupplierImportResult {
  created: number;
  /** Row numbers are the spreadsheet's (header is row 1). */
  errors: { row: number; message: string }[];
}

// ─── Attachments ──────────────────────────────────────────────────────────────

export const MAX_SUPPLIER_ATTACHMENT_BYTES = 5 * 1024 * 1024;
export const ALLOWED_SUPPLIER_ATTACHMENT_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
] as const;

// ─── Bulk upload ──────────────────────────────────────────────────────────────

export const MAX_IMPORT_BYTES = 5 * 1024 * 1024;
export const MAX_IMPORT_ROWS = 2000;
