import { z } from "zod";
import { optionalText, requiredText } from "@/lib/validation/fields";

// ─── Enums ───────────────────────────────────────────────────────────────────

export const TARGET_BASES = ["AMOUNT", "QUANTITY"] as const;
export type TargetBasis = (typeof TARGET_BASES)[number];
/** "Target Based On" of a budget. */
export const BUDGET_BASIS_LABELS: Record<TargetBasis, string> = { AMOUNT: "Amount Based Budget", QUANTITY: "Quantity Based Budget" };
/** "Target Type" of a sales target plan. */
export const PLAN_BASIS_LABELS: Record<TargetBasis, string> = { AMOUNT: "Amount", QUANTITY: "Quantity" };

export const TARGET_TYPES = ["EMPLOYEE", "TERRITORY"] as const;
export type TargetType = (typeof TARGET_TYPES)[number];
export const TARGET_TYPE_LABELS: Record<TargetType, string> = { EMPLOYEE: "Employee", TERRITORY: "Territory" };

export const COMMISSION_BASES = ["AMOUNT", "PERCENT"] as const;
export type CommissionBasis = (typeof COMMISSION_BASES)[number];
export const COMMISSION_BASIS_LABELS: Record<CommissionBasis, string> = { AMOUNT: "Amount", PERCENT: "Percentage" };

export const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"] as const;

// ─── Input ───────────────────────────────────────────────────────────────────

const MAX_AMOUNT = 999_999_999_999;
const isoDate = (label: string) => z.iso.date({ error: `${label} is required.` });
const money = (label: string) => z.number({ error: `${label} must be a number.` }).min(0, `${label} cannot be negative.`).max(MAX_AMOUNT);
const positive = (label: string) => z.number({ error: `${label} must be a number.` }).gt(0, `${label} must be more than 0.`).max(MAX_AMOUNT);
const month = z.number().int().min(1).max(12);
const year = z.number({ error: "Year must be a number." }).int().min(2000, "Year must be 2000 or later.").max(2100);
const version = z.iso.datetime({ error: "Reload and try again." });
const optionalId = z.uuid().nullish().transform((value) => value ?? null);
/** No two rows share the key. */
const distinct = (keys: string[]) => new Set(keys).size === keys.length;

/** Monthly targets of one sales force. */
const personMonths = z.object({
  salesPersonId: z.uuid({ error: "Select a sales force." }),
  months: z
    .array(z.object({ month, value: money("Target") }))
    .max(12)
    .refine((rows) => distinct(rows.map((row) => String(row.month))), "A month appears twice."),
});

export const budgetInputSchema = z.object({
  businessUnitId: z.uuid({ error: "Select a business unit." }),
  targetType: z.enum(TARGET_TYPES),
  basis: z.enum(TARGET_BASES),
  year,
  persons: z
    .array(personMonths)
    .min(1, "Add targets for at least one sales force.")
    .max(500)
    .refine((rows) => distinct(rows.map((row) => row.salesPersonId)), "A sales force appears twice."),
});
export type BudgetInput = z.input<typeof budgetInputSchema>;
export const budgetUpdateSchema = z.object({ version, data: budgetInputSchema });
/** Details dialog: save (or, with no months, remove) one sales force's months. */
export const budgetPersonSchema = personMonths;

const planLine = z.object({
  customerId: optionalId,
  customerGroupId: optionalId,
  itemId: optionalId,
  rate: money("Rate").nullish().transform((value) => value ?? null),
  qty: money("Quantity").nullish().transform((value) => value ?? null),
  amount: money("Amount"),
});

export const planInputSchema = z
  .object({
    officeId: z.uuid({ error: "Select an office." }),
    createDate: isoDate("Create date"),
    basis: z.enum(TARGET_BASES),
    name: requiredText("Target name", 150),
    targetAmount: positive("Sales target amount"),
    startDate: isoDate("Start date"),
    endDate: isoDate("End date"),
    remarks: optionalText("Remarks", 500),
    customerGroupWise: z.boolean(),
    lines: z.array(planLine).max(1000),
  })
  .refine((input) => input.endDate >= input.startDate, { error: "End date cannot be before the start date.", path: ["endDate"] })
  .refine((input) => input.lines.every((line) => (input.customerGroupWise ? line.customerGroupId : line.customerId)), {
    error: "Every line needs a customer (or a customer group when Customer Group Wise is ticked).",
    path: ["lines"],
  });
export type PlanInput = z.input<typeof planInputSchema>;
export const planUpdateSchema = z.object({ version, data: planInputSchema });

export const assignInputSchema = z.object({
  planId: z.uuid({ error: "Select a target." }),
  rows: z
    .array(
      z.object({
        salesPersonId: z.uuid({ error: "Select an employee." }),
        customerGroupId: optionalId,
        targetAmount: positive("Target amount"),
        commissionBasis: z.enum(COMMISSION_BASES),
        commissionRate: money("Commission rate"),
        minimumCollection: money("Minimum collection"),
      }),
    )
    .min(1, "Add at least one sales force.")
    .max(500)
    .refine((rows) => distinct(rows.map((row) => row.salesPersonId)), "An employee appears twice.")
    .refine((rows) => rows.every((row) => row.commissionBasis !== "PERCENT" || row.commissionRate <= 100), "A percentage commission can be at most 100."),
});
export type AssignInput = z.input<typeof assignInputSchema>;

export const commissionInputSchema = z
  .object({
    name: requiredText("Commission name", 150),
    salesPersonId: z.uuid({ error: "Select an employee." }),
    customerGroupId: optionalId,
    fromDate: isoDate("From date"),
    toDate: isoDate("To date"),
    lines: z
      .array(z.object({ itemId: z.uuid(), basis: z.enum(COMMISSION_BASES), value: money("Commission") }))
      .min(1, "Add at least one item.")
      .max(2000)
      .refine((rows) => distinct(rows.map((row) => row.itemId)), "An item appears twice.")
      .refine((rows) => rows.every((row) => row.basis !== "PERCENT" || row.value <= 100), "A percentage commission can be at most 100."),
  })
  .refine((input) => input.toDate >= input.fromDate, { error: "To date cannot be before the from date.", path: ["toDate"] });
export type CommissionInput = z.input<typeof commissionInputSchema>;
export const commissionUpdateSchema = z.object({ version, data: commissionInputSchema });

// ─── Queries ─────────────────────────────────────────────────────────────────

const optionalUuid = z.uuid().optional();
const flag = z
  .enum(["true", "false"])
  .optional()
  .transform((value) => value === "true");
const validRange = (query: { from?: string; to?: string }) => !query.from || !query.to || query.from <= query.to;
const rangeMessage = { error: "From Date must be on or before To Date.", path: ["to"] };
const queryMonth = z.coerce.number().int().min(1).max(12);

export const targetReportQuerySchema = z
  .object({
    salesPersonId: optionalUuid,
    fromMonth: queryMonth,
    toMonth: queryMonth,
    year: z.coerce.number().int().min(2000).max(2100),
    basis: z.enum(TARGET_BASES),
  })
  .refine((query) => query.fromMonth <= query.toMonth, { error: "From Month must be on or before To Month.", path: ["toMonth"] });
export type TargetReportQuery = z.input<typeof targetReportQuerySchema>;

export const planListQuerySchema = z
  .object({ officeId: optionalUuid, from: z.iso.date().optional(), to: z.iso.date().optional(), basis: z.enum(TARGET_BASES).optional(), name: z.string().trim().max(150).optional() })
  .refine(validRange, rangeMessage);
export type PlanListQuery = z.input<typeof planListQuerySchema>;

export const planReportQuerySchema = z
  .object({
    officeId: optionalUuid,
    planId: optionalUuid,
    salesPersonId: optionalUuid,
    designation: z.string().trim().max(100).optional(),
    from: z.iso.date().optional(),
    to: z.iso.date().optional(),
    /** Break each sales force's achievement down by customer group. */
    byCustomerGroup: flag,
  })
  .refine(validRange, rangeMessage);
export type PlanReportQuery = z.input<typeof planReportQuerySchema>;

export const commissionReportQuerySchema = z
  .object({
    viewBy: z.enum(["EMPLOYEE", "ITEM"]),
    officeId: optionalUuid,
    categoryId: optionalUuid,
    from: isoDate("From date"),
    to: isoDate("To date"),
    summary: flag,
  })
  .refine(validRange, rangeMessage);
export type CommissionReportQuery = z.input<typeof commissionReportQuerySchema>;

// ─── DTOs ────────────────────────────────────────────────────────────────────

export interface BudgetRow {
  id: string;
  businessUnitId: string;
  targetType: TargetType;
  basis: TargetBasis;
  year: number;
  /** Sum of all monthly targets (taka or quantity). */
  total: number;
  personCount: number;
  createdBy: string | null;
  updatedAt: string;
}

export interface BudgetPerson {
  salesPersonId: string;
  name: string;
  designation: string | null;
  months: { month: number; value: number }[];
  total: number;
}

export interface BudgetDetail extends BudgetRow {
  persons: BudgetPerson[];
}

export interface TargetReportRow {
  salesPersonId: string;
  name: string;
  designation: string | null;
  month: number;
  target: number;
  /** Delivered less approved returns of that sales force in the month. */
  achieved: number;
  /** Achieved as a share of the target (null when there is no target). */
  percent: number | null;
}

export interface PlanLineDetail {
  lineNo: number;
  customerId: string | null;
  customerName: string | null;
  customerGroupId: string | null;
  customerGroupName: string | null;
  itemId: string | null;
  itemName: string | null;
  rate: number | null;
  qty: number | null;
  amount: number;
}

export interface AssignmentDetail {
  id: string;
  salesPersonId: string;
  salesPersonName: string;
  designation: string | null;
  customerGroupId: string | null;
  customerGroupName: string | null;
  targetAmount: number;
  commissionBasis: CommissionBasis;
  commissionRate: number;
  minimumCollection: number;
}

export interface PlanRow {
  id: string;
  number: string;
  name: string;
  basis: TargetBasis;
  businessUnitId: string;
  officeId: string;
  officeName: string;
  createDate: string;
  startDate: string;
  endDate: string;
  targetAmount: number;
  customers: number;
  assigned: number;
  createdBy: string | null;
  updatedAt: string;
}

export interface PlanDetail extends PlanRow {
  remarks: string | null;
  customerGroupWise: boolean;
  lines: PlanLineDetail[];
  assignments: AssignmentDetail[];
}

export interface PlanReportRow {
  key: string;
  planId: string;
  planNumber: string;
  planName: string;
  basis: TargetBasis;
  startDate: string;
  endDate: string;
  salesPersonId: string;
  salesPersonName: string;
  designation: string | null;
  /** Set when broken down by customer group. */
  customerGroupName: string | null;
  targetAmount: number;
  /** In the plan's basis (taka or quantity). */
  achieved: number;
  achievedAmount: number;
  percent: number;
  collection: number;
  minimumCollection: number;
  commissionBasis: CommissionBasis;
  commissionRate: number;
  /** Earned when the target and the minimum collection are both reached. */
  commission: number;
  earned: boolean;
}

export interface CommissionRow {
  id: string;
  name: string;
  businessUnitId: string;
  salesPersonId: string;
  salesPersonName: string;
  customerGroupId: string | null;
  customerGroupName: string | null;
  fromDate: string;
  toDate: string;
  items: number;
  createdBy: string | null;
  updatedAt: string;
}

export interface CommissionDetail extends CommissionRow {
  lines: { itemId: string; itemCode: string; itemName: string; uom: string; basis: CommissionBasis; value: number }[];
}

export interface CommissionReportLine {
  key: string;
  deliveryId: string;
  invoiceNumber: string;
  deliveryDate: string;
  salesPersonName: string;
  customerName: string;
  itemCode: string;
  itemName: string;
  /** Delivered less approved returns. */
  qty: number;
  amount: number;
  basis: CommissionBasis;
  rate: number;
  commission: number;
  commissionName: string;
}

export interface CommissionSummaryRow {
  key: string;
  name: string;
  qty: number;
  amount: number;
  commission: number;
}

export interface CommissionReport {
  lines: CommissionReportLine[];
  summary: CommissionSummaryRow[];
  totalCommission: number;
}
