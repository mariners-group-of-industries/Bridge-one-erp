import { z } from "zod";
import { optionalEmail, optionalPhone, optionalText, requiredText } from "@/lib/validation/fields";

const businessUnitId = z.uuid({ error: "Business unit is required." });
/** Blank code = generate the next one from the sequence. */
const optionalCode = optionalText("Code", 30);
const optionalId = z.uuid().nullish().transform((value) => value ?? null);
const MAX_AMOUNT = 999_999_999_999;
const percent = (label: string) =>
  z.number({ error: `${label} must be a number.` }).min(0, `${label} cannot be negative.`).max(100, `${label} can be at most 100.`);

// ─── Enums ───────────────────────────────────────────────────────────────────

export const CUSTOMER_TYPES = ["GENERAL", "DEALER", "DISTRIBUTOR", "RETAILER", "CORPORATE"] as const;
export type CustomerType = (typeof CUSTOMER_TYPES)[number];
export const CUSTOMER_TYPE_LABELS: Record<CustomerType, string> = {
  GENERAL: "General Customer",
  DEALER: "Dealer",
  DISTRIBUTOR: "Distributor",
  RETAILER: "Retailer",
  CORPORATE: "Corporate",
};

export const AREA_KINDS = ["ZONE", "TERRITORY", "ROUTE", "SECTION"] as const;
export type AreaKind = (typeof AREA_KINDS)[number];
export const AREA_KIND_LABELS: Record<AreaKind, string> = {
  ZONE: "Zone",
  TERRITORY: "Territory",
  ROUTE: "Route",
  SECTION: "Section",
};

export const CATEGORY_LEVEL_LABELS = ["", "Category", "Sub Category", "Minor Category"] as const;

// ─── Customers ───────────────────────────────────────────────────────────────

export const customerAddressSchema = z.object({
  id: z.uuid().optional(),
  label: requiredText("Address label", 60),
  address: requiredText("Address", 500),
  isDefault: z.boolean(),
});

const customerFields = {
  code: optionalCode,
  name: requiredText("Customer name", 150),
  phone: optionalPhone("Mobile no."),
  email: optionalEmail(),
  contactPerson: optionalText("Contact person", 150),
  binNumber: optionalText("BIN", 30),
  address: optionalText("Billing address", 500),
  customerType: z.enum(CUSTOMER_TYPES).default("GENERAL"),
  customerGroupId: optionalId,
  zoneId: optionalId,
  territoryId: optionalId,
  routeId: optionalId,
  sectionId: optionalId,
  salesPersonId: optionalId,
  creditDays: z
    .number({ error: "Credit days must be a number." })
    .int("Credit days must be a whole number.")
    .min(0, "Credit days cannot be negative.")
    .max(365, "Credit days can be at most 365."),
  creditLimit: z
    .number({ error: "Credit limit must be a number." })
    .min(0, "Credit limit cannot be negative.")
    .max(MAX_AMOUNT)
    .nullish()
    .transform((value) => value ?? null),
  addresses: z
    .array(customerAddressSchema)
    .max(20, "At most 20 addresses.")
    .refine((list) => list.filter((address) => address.isDefault).length <= 1, "Only one address can be the default.")
    .default([]),
  isActive: z.boolean().default(true),
};

export const customerInputSchema = z.object({ businessUnitId, ...customerFields });
export type CustomerInput = z.input<typeof customerInputSchema>;
export const customerUpdateSchema = z.object(customerFields);
export type CustomerUpdate = z.input<typeof customerUpdateSchema>;

// ─── Items ───────────────────────────────────────────────────────────────────

const itemFields = {
  code: optionalCode,
  name: requiredText("Item name", 200),
  uom: requiredText("Unit", 20),
  salesRate: z.number({ error: "Rate must be a number." }).min(0, "Rate cannot be negative.").max(MAX_AMOUNT),
  mrp: z
    .number({ error: "MRP must be a number." })
    .min(0, "MRP cannot be negative.")
    .max(MAX_AMOUNT)
    .nullish()
    .transform((value) => value ?? null),
  vatPercent: percent("VAT %").default(0),
  deliveryTolerancePercent: percent("Delivery tolerance %").default(0),
  altUom: optionalText("Alt. unit", 20),
  altUomFactor: z
    .number({ error: "Units per alt. unit must be a number." })
    .gt(0, "Units per alt. unit must be more than 0.")
    .max(1_000_000)
    .nullish()
    .transform((value) => value ?? null),
  categoryId: optionalId,
  prices: z
    .array(z.object({ priceListId: z.uuid(), rate: z.number().min(0, "Price cannot be negative.").max(MAX_AMOUNT) }))
    .max(50)
    .default([]),
  isActive: z.boolean().default(true),
};

const altUomRule = <T extends { altUom: string | null; altUomFactor: number | null }>(item: T) =>
  (item.altUom === null) === (item.altUomFactor === null);
const altUomMessage = { error: "Enter both the alt. unit and how many units it holds, or neither.", path: ["altUomFactor"] };

export const itemInputSchema = z.object({ businessUnitId, ...itemFields }).refine(altUomRule, altUomMessage);
export type ItemInput = z.input<typeof itemInputSchema>;
export const itemUpdateSchema = z.object(itemFields).refine(altUomRule, altUomMessage);
export type ItemUpdate = z.input<typeof itemUpdateSchema>;

// ─── Sales persons ───────────────────────────────────────────────────────────

const salesPersonFields = {
  code: optionalCode,
  name: requiredText("Name", 150),
  designation: optionalText("Designation", 100),
  phone: optionalPhone("Mobile no."),
  isActive: z.boolean().default(true),
};
export const salesPersonInputSchema = z.object({ businessUnitId, ...salesPersonFields });
export type SalesPersonInput = z.input<typeof salesPersonInputSchema>;
export const salesPersonUpdateSchema = z.object(salesPersonFields);
export type SalesPersonUpdate = z.input<typeof salesPersonUpdateSchema>;

// ─── Simple setup masters ────────────────────────────────────────────────────

export const SETUP_KINDS = ["customer-groups", "areas", "categories", "price-lists", "delivery-reasons", "return-reasons"] as const;
export type SetupKind = (typeof SETUP_KINDS)[number];

export const customerGroupInputSchema = z.object({ businessUnitId, name: requiredText("Group name", 100) });
export const deliveryReasonInputSchema = z.object({ businessUnitId, name: requiredText("Reason", 100) });
export const returnReasonInputSchema = deliveryReasonInputSchema;
export const salesAreaInputSchema = z.object({ businessUnitId, kind: z.enum(AREA_KINDS), name: requiredText("Name", 100) });
export const itemCategoryInputSchema = z.object({
  businessUnitId,
  parentId: optionalId,
  name: requiredText("Category name", 100),
});
export const priceListInputSchema = z.object({
  businessUnitId,
  name: requiredText("Price type name", 100),
  isDefault: z.boolean().default(false),
});
/** Renames (and the default flag for price lists) — the parent and business unit never change. */
export const setupUpdateSchema = z.object({ name: requiredText("Name", 100), isDefault: z.boolean().optional() });

export const businessUnitQuerySchema = z.object({
  businessUnitId,
  includeInactive: z
    .enum(["true", "false"])
    .optional()
    .transform((value) => value === "true"),
});
export const optionalBusinessUnitQuerySchema = z.object({ businessUnitId: z.uuid().optional() });

// ─── DTOs ────────────────────────────────────────────────────────────────────

export interface OfficeOption {
  id: string;
  name: string;
  address: string;
  businessUnitId: string;
  businessUnitName: string;
}

export interface SalesLookups {
  offices: OfficeOption[];
  /** Default quotation terms per business unit (numbered lines). */
  quotationTerms: Record<string, string>;
  /** Default sales order terms per business unit (numbered lines). */
  orderTerms: Record<string, string>;
}

export interface NamedOption {
  id: string;
  businessUnitId: string;
  name: string;
}
export interface AreaOption extends NamedOption {
  kind: AreaKind;
}
export interface CategoryOption extends NamedOption {
  parentId: string | null;
  level: number;
}
export interface PriceListOption extends NamedOption {
  isDefault: boolean;
}

export interface SetupLookups {
  customerGroups: NamedOption[];
  areas: AreaOption[];
  categories: CategoryOption[];
  priceLists: PriceListOption[];
  deliveryReasons: NamedOption[];
  returnReasons: NamedOption[];
  salesPersons: (NamedOption & { code: string; designation: string | null })[];
  /** Sales Setup tree nodes above the Territory layer (Region, …): a list filter on one covers every territory below. */
  territoryGroups: (NamedOption & { layer: string })[];
}

export interface AddressOption {
  id: string;
  label: string;
  address: string;
  isDefault: boolean;
}

export interface CustomerOption {
  id: string;
  code: string;
  name: string;
  phone: string | null;
  email: string | null;
  contactPerson: string | null;
  binNumber: string | null;
  address: string | null;
  customerType: CustomerType;
  customerGroupId: string | null;
  zoneId: string | null;
  territoryId: string | null;
  routeId: string | null;
  sectionId: string | null;
  salesPersonId: string | null;
  creditDays: number;
  creditLimit: number | null;
  isActive: boolean;
  /** The walk-in customer (direct deliveries default to it). */
  isAnonymous: boolean;
  addresses: AddressOption[];
}

export interface ItemOption {
  id: string;
  code: string;
  name: string;
  /** Printed / customer item code and name (the "is Customer" item search). */
  printedCode: string | null;
  printedName: string | null;
  uom: string;
  altUom: string | null;
  altUomFactor: number | null;
  categoryId: string | null;
  itemType: string | null;
  brand: string | null;
  /** Purchase (cost) price from the item profile. */
  costPrice: number | null;
  mrp: number | null;
  vatPercent: number;
  deliveryTolerancePercent: number;
  salesRate: number;
  isActive: boolean;
  /** Rate per price list id. */
  prices: Record<string, number>;
}

export interface SalesPersonOption {
  id: string;
  code: string;
  name: string;
  designation: string | null;
  phone: string | null;
  isActive: boolean;
}

/** Credit position shown on the order form ("Cr Lmt", "OD", "CL"). */
export interface CustomerCredit {
  creditLimit: number | null;
  outstanding: number;
  overdue: number;
  /** Value of submitted orders not yet delivered. */
  openOrders: number;
  /** creditLimit − outstanding − openOrders; null when there is no limit. */
  available: number | null;
}
