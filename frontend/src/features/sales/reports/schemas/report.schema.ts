import { z } from "zod";

/** Filters a report can show (and the query parameter each one sets). */
export type ReportFilter =
  | "office"
  | "priceList"
  | "customerGroup"
  | "customer"
  | "salesPerson"
  | "territory"
  | "zone"
  | "route"
  | "category"
  | "from"
  | "to"
  | "summary"
  | "utilization"
  | "year"
  | "months";

export interface ReportDefinition {
  key: string;
  label: string;
  filters: readonly ReportFilter[];
  /** Filters that must be filled before viewing. */
  required?: readonly ReportFilter[];
}

const PARTY: ReportFilter[] = ["office", "customerGroup", "customer", "salesPerson"];
const RANGE: ReportFilter[] = ["from", "to"];

/** The "View By" list, alphabetical as in Managerium. */
export const REPORTS = [
  { key: "available-balance", label: "Available Balance Report", filters: ["customerGroup", "customer"] },
  { key: "customer", label: "Customer", filters: ["office", "priceList", "customerGroup", "customer", "salesPerson", ...RANGE, "summary"] },
  { key: "credit-utilization", label: "Customer Credit Limit Utilization Report", filters: ["office", "customerGroup", "customer", "territory", "salesPerson", "utilization"] },
  { key: "customer-details", label: "Customer Details", filters: ["office", "customer", "salesPerson", ...RANGE] },
  { key: "group-summary", label: "Customer Group Summary", filters: ["customerGroup", ...RANGE] },
  { key: "customer-ledger", label: "Customer Wise Ledger Report", filters: ["customer", ...RANGE], required: ["customer", "from", "to"] },
  { key: "customer-sales", label: "Customer Wise Sales", filters: RANGE },
  { key: "employee-sales-collection", label: "Employee Wise Sales Collection", filters: ["office", "salesPerson", ...RANGE] },
  { key: "item", label: "Item", filters: ["office", "category", ...PARTY.slice(1), ...RANGE] },
  { key: "item-category", label: "Item Category", filters: ["office", "category", ...RANGE] },
  { key: "item-average", label: "Item Wise Average Details", filters: ["office", "category", ...RANGE] },
  { key: "monthly-achievement", label: "Monthly Achievement Report by Sales Force", filters: ["salesPerson", "year", "months"], required: ["year", "months"] },
  { key: "month-sales", label: "Month Wise Sales Report", filters: ["office", ...RANGE] },
  { key: "month-sales-collection", label: "Month Wise Sales VS Collection (Division)", filters: ["customerGroup", ...RANGE] },
  { key: "order-booking", label: "Order Wise Booking", filters: [...PARTY, ...RANGE] },
  { key: "order-remaining", label: "Order Wise Remaining Quantity", filters: [...PARTY, ...RANGE] },
  { key: "overdue", label: "Over Due Reports", filters: ["office", "customerGroup", "customer", "salesPerson"] },
  { key: "payment-method", label: "Payment Method Based On Sales Order", filters: ["office", ...RANGE] },
  { key: "received-due", label: "Received and Due Collection", filters: ["office", "customerGroup", "customer", ...RANGE] },
  { key: "referred-by", label: "Referred By", filters: ["office", ...RANGE] },
  { key: "delivery-report", label: "Sales Delivery Report", filters: [...PARTY, ...RANGE] },
  { key: "delivery-schedule", label: "Sales Delivery Schedule", filters: [...PARTY, ...RANGE] },
  { key: "return-report", label: "Sales Return Report", filters: [...PARTY, ...RANGE] },
  { key: "territory-sales", label: "Territory Wise Sales", filters: ["office", "territory", ...RANGE] },
] as const satisfies readonly ReportDefinition[];

const AREA: ReportFilter[] = ["office", "from", "to", "zone", "customerGroup", "territory", "route"];

/** Sales Analytics & Reports: every report takes office, dates and the sales area (National › Region › Territory › Base Point). */
export const ANALYTICS = [
  { key: "abp-target", label: "ABP Target vs Achievement", filters: AREA },
  { key: "customer-aging", label: "Customer Aging (Day Wise)", filters: AREA },
  { key: "category-comparison", label: "Category Wise Sales Comparison Report", filters: AREA },
  { key: "collection", label: "Collection", filters: AREA },
  { key: "credit-note", label: "Credit Note", filters: AREA },
  { key: "customer-category-sales", label: "Customer & Category Wise Sales", filters: AREA },
  { key: "season-closing", label: "Season/Year Closing", filters: AREA },
  { key: "customer-credit-invoice", label: "Customer Credit with Invoice", filters: AREA },
  { key: "group-recovery", label: "Sales, Recovery & Adjustment (Group Wise)", filters: AREA },
  { key: "master-invoice", label: "Master Report(Invoice Wise)", filters: AREA },
] as const satisfies readonly ReportDefinition[];

/** Sales area filters as Managerium names them on Sales Analytics. */
export const AREA_FILTER_LABELS = { zone: "National", customerGroup: "Region", territory: "Territory", route: "Base Point" } as const;

export type ReportKey = (typeof REPORTS)[number]["key"] | (typeof ANALYTICS)[number]["key"];
export const REPORT_KEYS = [...REPORTS, ...ANALYTICS].map((report) => report.key) as [ReportKey, ...ReportKey[]];
export const ALL_REPORTS: readonly ReportDefinition[] = [...REPORTS, ...ANALYTICS];

const optionalUuid = z.uuid().optional();
const flag = z
  .enum(["true", "false"])
  .optional()
  .transform((value) => value === "true");

export const reportQuerySchema = z
  .object({
    report: z.enum(REPORT_KEYS),
    /** The browser's date: "as of" for balances and overdue days. */
    asOf: z.iso.date(),
    officeId: optionalUuid,
    priceListId: optionalUuid,
    customerGroupId: optionalUuid,
    customerId: optionalUuid,
    salesPersonId: optionalUuid,
    territoryId: optionalUuid,
    zoneId: optionalUuid,
    routeId: optionalUuid,
    categoryId: optionalUuid,
    from: z.iso.date().optional(),
    to: z.iso.date().optional(),
    summary: flag,
    /** Credit utilization at or above this percent. */
    utilization: z.coerce.number().min(0).max(1000).optional(),
    year: z.coerce.number().int().min(2000).max(2100).optional(),
    fromMonth: z.coerce.number().int().min(1).max(12).optional(),
    toMonth: z.coerce.number().int().min(1).max(12).optional(),
  })
  .refine((query) => !query.from || !query.to || query.from <= query.to, { error: "From Date must be on or before To Date.", path: ["to"] })
  .refine((query) => !query.fromMonth || !query.toMonth || query.fromMonth <= query.toMonth, { error: "From Month must be on or before To Month.", path: ["toMonth"] });
export type ReportQuery = z.input<typeof reportQuerySchema>;

export type ColumnKind = "text" | "date" | "amount" | "qty" | "number" | "percent";

export interface ReportColumn {
  key: string;
  label: string;
  kind: ColumnKind;
  /** Add up in the total row. */
  total?: boolean;
}

export type ReportCell = string | number | null;

export interface ReportResult {
  title: string;
  columns: ReportColumn[];
  rows: Record<string, ReportCell>[];
  /** Shown above the table (e.g. how a figure is worked out). */
  note?: string;
}
