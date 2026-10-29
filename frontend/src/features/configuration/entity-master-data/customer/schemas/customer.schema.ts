import { z } from "zod";

// Shared by the Customer Profile form (client validation) and the API (server
// validation). Optional text fields are strings where "" means "not set"; the
// service stores them as NULL. Customers are the same records Sales uses.

const text = (max: number) => z.string().trim().max(max, `Must be ${max} characters or fewer.`);
const optionalText = (max: number) => text(max).optional().default("");
const optionalId = z.union([z.uuid("Select a valid option."), z.literal("")]).optional().default("");
const optionalDistrict = z.union([z.number().int().min(1), z.literal("")]).optional().default("");
const optionalDate = z
  .union([z.iso.date("Enter a valid date."), z.literal("")])
  .optional()
  .default("");

/** Percentage 0–100 with up to two decimals, or "". */
const percent = z
  .string()
  .trim()
  .refine((value) => value === "" || (/^\d{1,3}(\.\d{1,2})?$/.test(value) && Number(value) <= 100), {
    message: "Enter a percentage between 0 and 100 (up to 2 decimals).",
  })
  .optional()
  .default("");

export const MARITAL_STATUSES = ["Single", "Married", "Divorced", "Widowed"] as const;
export const GENDERS = ["Male", "Female", "Other"] as const;

export const CUSTOMER_FLAGS = [
  { key: "isMonthly", label: "Is Monthly" },
  { key: "creditLimitAllOutlets", label: "Credit Limit for All Outlets" },
  { key: "isForeign", label: "Is Foreign Customer" },
  { key: "isDistributor", label: "Is Distributor" },
  { key: "isEmployeeCustomer", label: "Employee Convert as Customer" },
  { key: "isAnonymous", label: "Is Anonymous" },
  { key: "vatAccountingNotApplicable", label: "Is VAT Accounting Not Applicable" },
  { key: "availableBalanceCheck", label: "Is Available Balance Check" },
  { key: "onlyBusinessUnitWise", label: "Is Only BU Wise Applicable" },
  { key: "isUser", label: "User" },
] as const;

export type CustomerFlag = (typeof CUSTOMER_FLAGS)[number]["key"];

export const shippingSchema = z.object({
  /** Existing shipping row (kept so sales orders that use it stay linked). */
  id: optionalId,
  code: optionalText(30),
  outlet: optionalText(60),
  address: text(500).min(1, "Address is required."),
  gps: optionalText(100),
  contactPerson: optionalText(150),
  contactNo: optionalText(30),
  vatRegNo: optionalText(50),
  districtId: optionalDistrict,
  thanaId: optionalId,
  sectionId: optionalId,
});

const flagFields = Object.fromEntries(CUSTOMER_FLAGS.map((flag) => [flag.key, z.boolean().default(false)])) as Record<
  CustomerFlag,
  z.ZodDefault<z.ZodBoolean>
>;

export const customerInputSchema = z
  .object({
    // Partner Details
    officeId: z.uuid("Select an office."),
    name: text(150).min(1, "Partner name is required."),
    code: optionalText(30),
    mobile: text(30).min(1, "Mobile number is required."),
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
    creditLimit: z
      .string()
      .trim()
      .refine((value) => value === "" || (/^\d{1,12}(\.\d{1,2})?$/.test(value)), {
        message: "Enter an amount (up to 2 decimals).",
      })
      .optional()
      .default(""),
    territoryId: optionalId,
    salesPersonId: optionalId,
    tolerancePercent: percent,
    binNumber: optionalText(30),
    priceListId: optionalId,
    tcsPercent: percent,
    vatRegistrationNo: optionalText(50),
    tinNumber: optionalText(50),
    tradeLicenseNo: optionalText(50),
    maritalStatus: z.union([z.enum(MARITAL_STATUSES), z.literal("")]).optional().default(""),
    marriageDate: optionalDate,
    birthDate: optionalDate,
    gender: z.union([z.enum(GENDERS), z.literal("")]).optional().default(""),
    nidNumber: optionalText(30),
    ...flagFields,
    // Billing Details
    billingName: optionalText(150),
    billingAddress: optionalText(500),
    districtId: optionalDistrict,
    thanaId: optionalId,
    contactPerson: optionalText(150),
    contactNo: optionalText(30),
    taxBracketId: optionalId,
    remarks: optionalText(1000),
    // Partner Bank Information
    bankType: optionalText(50),
    bankAccountNo: optionalText(50),
    bankBranch: optionalText(100),
    bankName: optionalText(100),
    bankRoutingNo: optionalText(30),
    // Shipping Details list
    shipping: z.array(shippingSchema).max(200, "Up to 200 shipping addresses per customer.").default([]),
  })
  .refine((data) => !data.marriageDate || data.maritalStatus !== "Single", {
    message: "A marriage date needs a marital status other than Single.",
    path: ["marriageDate"],
  });

export type ShippingInput = z.input<typeof shippingSchema>;
export type CustomerInput = z.input<typeof customerInputSchema>;
export type CustomerData = z.output<typeof customerInputSchema>;

/** List filters ("View" applies them); shared by both tabs and the API. */
export const customerFilterSchema = z.object({
  search: z.string().trim().max(100).optional(),
  officeId: z.uuid().optional().catch(undefined),
  groupId: z.uuid().optional().catch(undefined),
  subGroupId: z.uuid().optional().catch(undefined),
  status: z.enum(["active", "inactive"]).optional().catch(undefined),
  territoryId: z.uuid().optional().catch(undefined),
  /** Customer created date range (inclusive), YYYY-MM-DD. */
  fromDate: z.iso.date().optional().catch(undefined),
  toDate: z.iso.date().optional().catch(undefined),
});

export type CustomerFilters = z.output<typeof customerFilterSchema>;

export const customerListQuerySchema = customerFilterSchema.extend({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce
    .number()
    .int()
    .refine((value) => [10, 25, 50, 100].includes(value), "Invalid page size.")
    .default(10),
});

export type CustomerListQuery = z.output<typeof customerListQuerySchema>;

// ─── "+ Add new" options ──────────────────────────────────────────────────────

export const createCustomerGroupSchema = z.object({
  officeId: z.uuid("Select an office first."),
  name: text(100).min(1, "Name is required."),
  parentId: optionalId,
});

export const createSectionSchema = z.object({
  officeId: z.uuid("Select an office first."),
  name: text(100).min(1, "Name is required."),
});

export type CreateCustomerGroupInput = z.input<typeof createCustomerGroupSchema>;
export type CreateSectionInput = z.input<typeof createSectionSchema>;

// ─── DTOs ─────────────────────────────────────────────────────────────────────

export interface CustomerListRow {
  id: string;
  code: string;
  name: string;
  officeName: string | null;
  groupName: string | null;
  subGroupName: string | null;
  /** Mobile number ("Other Phone No" in the list). */
  mobile: string | null;
  billingName: string | null;
  billingContactNo: string | null;
  billingAddress: string | null;
  territoryName: string | null;
  salesPersonName: string | null;
  creditLimit: string | null;
  isForeign: boolean;
  isActive: boolean;
  createdAt: string;
}

export interface CustomerList {
  rows: CustomerListRow[];
  total: number;
  page: number;
  pageSize: number;
}

export interface SalesForceGroup {
  salesPerson: { id: string; code: string; name: string; phone: string | null } | null;
  customers: CustomerListRow[];
}

export interface SalesForceList {
  groups: SalesForceGroup[];
  total: number;
  /** True when more customers matched than are returned. */
  truncated: boolean;
}

export interface CustomerAttachmentDto {
  id: string;
  originalName: string;
  mimeType: string;
  size: number;
  createdAt: string;
}

export interface CustomerDto extends CustomerData {
  id: string;
  attachments: CustomerAttachmentDto[];
}

interface BuOption {
  id: string;
  name: string;
  businessUnitId: string;
}

export interface CustomerFormOptions {
  offices: BuOption[];
  groups: (BuOption & { parentId: string | null })[];
  territories: BuOption[];
  sections: BuOption[];
  salesPersons: (BuOption & { code: string })[];
  priceLists: BuOption[];
  taxBrackets: (BuOption & { ratePercent: string | null })[];
  districts: { id: number; name: string; division: string }[];
  thanas: { id: string; name: string; districtId: number }[];
}

export interface CustomerImportResult {
  created: number;
  errors: { row: number; message: string }[];
}

export const MAX_CUSTOMER_IMPORT_ROWS = 2000;
export const SALES_FORCE_LIMIT = 2000;
