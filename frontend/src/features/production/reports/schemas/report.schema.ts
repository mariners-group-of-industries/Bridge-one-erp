import { z } from "zod";

/** "View By" options, in Managerium's order. */
export const REPORT_TYPES = [
  { id: "production", label: "Production Report" },
  { id: "consumption", label: "Consumption Report" },
  { id: "performance", label: "Performance Report" },
  { id: "process-date", label: "Process And Date Wise Production Report" },
  { id: "details", label: "Production Report Details" },
  { id: "details-view", label: "Production Report Details View" },
  { id: "demand", label: "Production VS Demand Report" },
  { id: "cogs", label: "COGS Calculation Report" },
  { id: "utilization", label: "Work Center Utilization Report" },
  { id: "downtime", label: "Downtime Report" },
  { id: "work-center", label: "Work Center Report" },
  { id: "output-consumption", label: "Production Output vs Material Consumption" },
  { id: "so-planning", label: "Sales Order VS Production Planning" },
  { id: "defect", label: "Defect Report Monthly" },
] as const;
export type ReportType = (typeof REPORT_TYPES)[number]["id"];
export const REPORT_IDS = REPORT_TYPES.map((type) => type.id) as [ReportType, ...ReportType[]];
export const reportLabel = (id: ReportType) => REPORT_TYPES.find((type) => type.id === id)!.label;

/** Longest range of the day-by-day downtime report. */
export const MAX_DAILY_DAYS = 62;
export const MAX_RANGE_DAYS = 366;
/** Longest range of the monthly Work Center Report. */
export const MAX_MONTHS = 12;

/** Months from `from` to `to` inclusive ("YYYY-MM-DD"). */
export const monthsBetween = (from: string, to: string) =>
  (Number(to.slice(0, 4)) - Number(from.slice(0, 4))) * 12 + Number(to.slice(5, 7)) - Number(from.slice(5, 7)) + 1;

const flag = z
  .union([z.boolean(), z.enum(["true", "false"])])
  .optional()
  .transform((value) => value === true || value === "true");
const optionalId = z.uuid().optional();

/** Work center status filter (Work Center Utilization Report). */
export const WORK_CENTER_STATUSES = [
  { id: "ACTIVE", label: "Active" },
  { id: "INACTIVE", label: "Inactive" },
] as const;
/** Downtime reason, derived from the entries: hours short of the plan, or no entry on the day. */
export const DOWNTIME_REASONS = [
  { id: "SHORT_RUN", label: "Short run (reason not recorded)" },
  { id: "NO_PRODUCTION", label: "No production recorded" },
] as const;

const daysBetween = (from: string, to: string) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000) + 1;

/** Query of GET /api/production/reports (and its Excel / PDF exports); shared by the route and the browser. */
export const reportQuerySchema = z
  .object({
    viewBy: z.enum(REPORT_IDS, { error: "Choose the report (View By)." }),
    from: z.iso.date({ error: "From Date is required." }),
    to: z.iso.date({ error: "To Date is required." }),
    departmentId: optionalId,
    departmentSectionId: optionalId,
    officeId: optionalId,
    workCenterId: optionalId,
    filterBy: z.enum(["item", "category", "bom"]).optional(),
    itemId: optionalId,
    itemType: z.string().trim().max(50).optional(),
    categoryId: optionalId,
    subCategoryId: optionalId,
    minorCategoryId: optionalId,
    bomId: optionalId,
    shift: z.string().trim().max(30).optional(),
    workCenterStatus: z.enum(["ACTIVE", "INACTIVE"]).optional(),
    downtimeReason: z.enum(["SHORT_RUN", "NO_PRODUCTION"]).optional(),
    summary: flag,
    materialsVariance: flag,
    monthly: flag,
    shiftWise: flag,
    workCenterWise: flag,
  })
  .refine((query) => query.from <= query.to, { error: "From Date must be on or before To Date.", path: ["to"] })
  .refine((query) => daysBetween(query.from, query.to) <= MAX_RANGE_DAYS, { error: `Choose at most ${MAX_RANGE_DAYS} days.`, path: ["to"] })
  .refine((query) => query.viewBy !== "downtime" || daysBetween(query.from, query.to) <= MAX_DAILY_DAYS, {
    error: `This report shows one row per day: choose at most ${MAX_DAILY_DAYS} days.`,
    path: ["to"],
  })
  .refine((query) => query.viewBy !== "work-center" || monthsBetween(query.from, query.to) <= MAX_MONTHS, {
    error: `Choose at most ${MAX_MONTHS} months.`,
    path: ["to"],
  });
export type ReportQuery = z.input<typeof reportQuerySchema>;
export type ParsedReportQuery = z.output<typeof reportQuerySchema>;

export type ColumnKind = "text" | "date" | "qty" | "money" | "percent" | "hours";

export interface ReportColumn {
  key: string;
  label: string;
  kind: ColumnKind;
}

export type ReportCell = string | number | null;

export interface Report {
  type: ReportType;
  title: string;
  company: string;
  /** Lines under the title: office, range, filters. */
  subtitle: string[];
  columns: ReportColumn[];
  rows: Record<string, ReportCell>[];
  /** Footer row (sums of quantity / value columns), null when the report has none. */
  totals: Record<string, ReportCell> | null;
  /** Remarks about how figures are derived. */
  notes: string[];
}

export interface ReportLookups {
  company: string;
  departments: { id: string; name: string }[];
  sections: { id: string; name: string; departmentId: string }[];
  offices: { id: string; name: string }[];
  workCenters: { id: string; code: string; name: string }[];
  categories: { id: string; name: string; parentId: string | null; level: number }[];
  boms: { id: string; name: string }[];
  items: { id: string; code: string; name: string; uom: string; itemType: string | null }[];
  itemTypes: string[];
  /** Shifts recorded on production entries. */
  shifts: string[];
}
