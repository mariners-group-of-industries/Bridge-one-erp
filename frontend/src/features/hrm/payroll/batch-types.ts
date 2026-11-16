import { z } from "zod";
import { monthSchema } from "./types";

/**
 * HRM › Payroll › Salary Generate: salary batches with a multilayer approval
 * workflow. Shared by the API (validation) and the pages (types).
 */

export const PAYROLL_STATUSES = ["Draft", "Under Processing", "Approved", "Rejected", "Cancelled"] as const;
export type PayrollBatchStatus = (typeof PAYROLL_STATUSES)[number];

/** Statuses a batch can still be recalculated, edited, submitted or cancelled in. */
export const EDITABLE_STATUSES: readonly PayrollBatchStatus[] = ["Draft", "Rejected"];

/**
 * Batch salary types. Monthly is the only type the ERP has today; it covers both
 * regular (monthly) and day-basis employees, as the existing payroll did.
 */
export const SALARY_TYPES = ["Monthly"] as const;
export type SalaryType = (typeof SALARY_TYPES)[number];

/** Approval Setup feature the batches are approved under (Configuration › Approval Setup). */
export const PAYROLL_APPROVAL_FEATURE = "Salary Sheet";

/**
 * Columns after Transport. PFD is the provident fund deduction (HR Governance ›
 * PF Setup); the others are allowances (HR Governance › Allowance) whose Short
 * Code (or name) is the column code, assigned to employees in Allowance Setup.
 */
export const COMPONENT_CODES = ["MA", "FA", "EA", "PFD", "TAA", "TDA", "NPA"] as const;
export type ComponentCode = (typeof COMPONENT_CODES)[number];
export const PF_CODE: ComponentCode = "PFD";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a valid date.");

export const generateInputSchema = z.object({
  officeId: z.uuid("Select an office."),
  month: monthSchema,
  salaryType: z.enum(SALARY_TYPES, "Select a salary type.").default("Monthly"),
  payrollDate: isoDate,
  description: z.string().trim().max(500, "Description can have at most 500 characters.").optional().default(""),
});
export type GenerateInput = z.input<typeof generateInputSchema>;

export const updateBatchSchema = z.object({
  payrollDate: isoDate,
  description: z.string().trim().max(500, "Description can have at most 500 characters.").optional().default(""),
  version: z.number().int().positive(),
});

export const versionSchema = z.object({ version: z.number().int().positive() });

export const decisionSchema = z
  .object({
    decision: z.enum(["approve", "reject"]),
    remarks: z.string().trim().max(500, "Remarks can have at most 500 characters.").optional().default(""),
    version: z.number().int().positive(),
  })
  .refine((v) => v.decision === "approve" || v.remarks.length > 0, { message: "Give a reason for the rejection.", path: ["remarks"] });

export const cancelSchema = z.object({
  reason: z.string().trim().min(1, "Give a reason for cancelling.").max(500, "Reason can have at most 500 characters."),
  version: z.number().int().positive(),
});

export const LINE_SORTS = ["sl", "code", "name", "gross", "net", "deduction"] as const;
export type LineSort = (typeof LINE_SORTS)[number];

// ─── Calculation results ──────────────────────────────────────────────────────

/** One step of the calculation trace shown to HR and approvers. */
export interface TraceStep {
  label: string;
  detail: string;
  /** Amount of the step (BDT), when it has one. */
  amount?: number | null;
  /** "+" adds to net, "-" deducts, "=" a subtotal, "i" information only. */
  kind: "+" | "-" | "=" | "i";
}

export interface AttendanceSummary {
  /** Days of the payroll month. */
  periodDays: number;
  /** Days between joining / leaving that fall in the month. */
  employedDays: number;
  /** Working days of the assigned calendar while employed. */
  workingDays: number;
  presentDays: number;
  lateCount: number;
  /** Rated Absent by the attendance rule (punched after Absent After). */
  absentDays: number;
  /** Working days with neither a punch nor approved leave. */
  unrecordedDays: number;
  /** Days with no calendar from Calendar Assign, Roster, Employee Assign or the office's off days / holidays. */
  unassignedDays: number;
  /** Days after today (the month is not over yet). */
  futureDays: number;
  weeklyOffDays: number;
  holidayDays: number;
  /** Approved leave by leave type (working days only). */
  leaveDays: Record<string, number>;
  paidLeaveDays: number;
  unpaidLeaveDays: number;
  /** Punches on a weekly off day or holiday. */
  offDaysWorked: number;
  absentDeductionDays: number;
  unpaidLeaveDeductionDays: number;
  lateDeductionDays: number;
  /** Late deduction days the Late Punishment rule takes from the leave balance instead of salary. */
  lateLeaveBalanceDays: number;
  totalDeductionDays: number;
}

/** One employee's salary (a batch line or a preview row). */
export interface PayrollLine {
  id: string | null;
  employeeId: string;
  sl: number;
  employeeCode: string;
  employeeName: string;
  joiningDate: string;
  designation: string | null;
  department: string | null;
  grossSalary: number;
  basic: number | null;
  houseRent: number | null;
  medical: number | null;
  transport: number | null;
  components: Partial<Record<ComponentCode, number>>;
  earnedGross: number;
  additions: number;
  attendanceDeduction: number;
  otherDeduction: number;
  totalDeduction: number;
  netPayable: number;
  payMethod: string;
  bankOrProvider: string | null;
  accountNo: string | null;
  warnings: string[];
  errors: string[];
}

export interface PayrollLineDetail extends PayrollLine {
  attendance: AttendanceSummary;
  trace: TraceStep[];
}

export interface PayrollTotals {
  employees: number;
  gross: number;
  basic: number;
  allowances: number;
  earned: number;
  additions: number;
  attendanceDeduction: number;
  otherDeduction: number;
  net: number;
}

export interface ExcludedEmployee {
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  reason: string;
}

export interface PolicyUse {
  id: string;
  tab: string;
  label: string;
  updatedAt: string;
}

/**
 * Payrolls of an office run month after month: once one exists, the next must
 * be for the month right after the latest one (cancelled payrolls do not count).
 */
export interface PayrollSequence {
  /** Latest month with a live payroll (YYYY-MM). */
  lastMonth: string;
  lastReference: string;
  lastStatus: PayrollBatchStatus;
  /** The only month a new payroll may be generated for. */
  nextMonth: string;
}

/** Salary Generate preview: calculated, not saved. */
export interface PayrollPreview {
  officeId: string;
  officeName: string;
  businessUnit: string;
  month: string;
  fromDate: string;
  toDate: string;
  salaryType: string;
  eligibleCount: number;
  lines: PayrollLineDetail[];
  excluded: ExcludedEmployee[];
  totals: PayrollTotals;
  warningCount: number;
  errorCount: number;
  /** Batch-wide notes (missing configuration …). */
  notices: string[];
  policies: PolicyUse[];
  /** A live batch already holds this office and period. */
  existing: { id: string; reference: string; status: PayrollBatchStatus } | null;
  /** The office's latest payroll and the month that must come next; null before its first payroll. */
  sequence: PayrollSequence | null;
  /** False when the month is not the one the sequence requires: it cannot be saved. */
  inSequence: boolean;
}

export interface ApprovalProgress {
  stages: number;
  /** Stage waiting for approval (Under Processing). */
  current: { stageNo: number; name: string } | null;
}

/** HRM › Payroll list row. */
export interface PayrollBatchRow {
  id: string;
  reference: string;
  businessUnit: string;
  officeId: string;
  officeName: string;
  month: string;
  salaryType: string;
  payrollDate: string;
  employeeCount: number;
  totalGross: number;
  totalDeduction: number;
  totalNet: number;
  status: PayrollBatchStatus;
  approval: ApprovalProgress;
  warningCount: number;
  errorCount: number;
  createdByName: string | null;
  createdAt: string;
}

export interface PayrollBatchList {
  rows: PayrollBatchRow[];
  total: number;
  page: number;
  pageSize: number;
}

export interface PayrollBatchEventRow {
  id: string;
  action: string;
  fromStatus: string | null;
  toStatus: string;
  stageNo: number | null;
  stageName: string | null;
  actorName: string;
  remarks: string | null;
  createdAt: string;
}

export interface ApprovalStageRow {
  stageNo: number;
  name: string;
  status: string;
  approverNames: string[];
  approvedNames: string[];
  actedBy: string | null;
  actedAt: string | null;
  comment: string | null;
}

export interface PayrollBatchDetail {
  id: string;
  reference: string;
  businessUnit: string;
  officeId: string;
  officeName: string;
  month: string;
  fromDate: string;
  toDate: string;
  salaryType: string;
  payrollDate: string;
  description: string | null;
  status: PayrollBatchStatus;
  version: number;
  eligibleCount: number;
  totals: PayrollTotals;
  warningCount: number;
  errorCount: number;
  excluded: ExcludedEmployee[];
  policies: PolicyUse[];
  calculatedAt: string;
  createdByName: string | null;
  createdAt: string;
  submittedAt: string | null;
  submittedByName: string | null;
  decidedAt: string | null;
  decidedByName: string | null;
  rejectionReason: string | null;
  cancelReason: string | null;
  /** Salary, attendance or policy data changed since the batch was calculated (editable batches only). */
  stale: boolean;
  approval: ApprovalProgress;
  stages: ApprovalStageRow[];
  events: PayrollBatchEventRow[];
  can: { edit: boolean; submit: boolean; cancel: boolean; decide: boolean };
}

export interface PayrollLinePage {
  rows: PayrollLine[];
  total: number;
  page: number;
  pageSize: number;
}
