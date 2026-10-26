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
] as const;
export type ReportType = (typeof REPORT_TYPES)[number]["id"];
export const REPORT_IDS = REPORT_TYPES.map((type) => type.id) as [ReportType, ...ReportType[]];
export const reportLabel = (id: ReportType) => REPORT_TYPES.find((type) => type.id === id)!.label;

/** Longest range of the day-by-day reports (process-date pivot and downtime). */
export const MAX_DAILY_DAYS = 62;
export const MAX_RANGE_DAYS = 366;

const flag = z
  .union([z.boolean(), z.enum(["true", "false"])])
  .optional()
  .transform((value) => value === true || value === "true");
const optionalId = z.uuid().optional();

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
    bomId: optionalId,
    summary: flag,
    materialsVariance: flag,
    monthly: flag,
    shiftWise: flag,
    workCenterWise: flag,
  })
  .refine((query) => query.from <= query.to, { error: "From Date must be on or before To Date.", path: ["to"] })
  .refine((query) => daysBetween(query.from, query.to) <= MAX_RANGE_DAYS, { error: `Choose at most ${MAX_RANGE_DAYS} days.`, path: ["to"] })
  .refine((query) => !["process-date", "downtime"].includes(query.viewBy) || daysBetween(query.from, query.to) <= MAX_DAILY_DAYS, {
    error: `This report shows one column or row per day: choose at most ${MAX_DAILY_DAYS} days.`,
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
}
