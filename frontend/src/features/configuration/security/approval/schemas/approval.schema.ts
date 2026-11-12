import { z } from "zod";

// Approval Setup (Configuration › Identity & Security). Shared by the form and
// the API. "" means "not set"; the service stores NULL.

/**
 * Documents that can go through an approval pipeline, grouped by module.
 * Feature names are stored as-is and looked up by the modules (e.g. production
 * orders read the "Production Order" pipeline), so never rename one.
 */
export const APPROVAL_MODULES = [
  { module: "Purchase", features: ["Purchase Requisition", "Purchase Order", "Purchase Order Local", "Goods Receipt", "Purchase Return", "Payment Approval"] },
  { module: "Sales", features: ["Sales Quotation", "Sales Order", "Sales Delivery", "Sales Return", "Sales Collection", "Customer Price Setup", "Offer Setup"] },
  { module: "Accounts", features: ["Journal Voucher", "Fund Transfer", "Expense", "Advance"] },
  { module: "Inventory", features: ["Stock Adjustment", "Inventory Item Conversion", "Transfer Request", "Transfer Return"] },
  { module: "Production", features: ["Production Order"] },
  { module: "HR & Payroll", features: ["Employee Attendance", "Employee Movement", "Employee Leave", "Attendance Register Location", "Attendance Register Device", "Salary Sheet", "Salary Advice Approval"] },
  { module: "RTM", features: ["Outlet Setup Approval"] },
] as const;

export type ApprovalModule = (typeof APPROVAL_MODULES)[number]["module"];
export type ApprovalFeature = (typeof APPROVAL_MODULES)[number]["features"][number];

export const MODULE_NAMES = APPROVAL_MODULES.map((m) => m.module) as [ApprovalModule, ...ApprovalModule[]];
export const APPROVAL_FEATURES = APPROVAL_MODULES.flatMap((m) => m.features) as [ApprovalFeature, ...ApprovalFeature[]];

export const featuresOf = (module: string): readonly string[] => APPROVAL_MODULES.find((m) => m.module === module)?.features ?? [];
export const moduleOf = (feature: string): ApprovalModule | "" => APPROVAL_MODULES.find((m) => (m.features as readonly string[]).includes(feature))?.module ?? "";

export const USER_TYPES = [
  { value: "USER", label: "User" },
  { value: "EMPLOYEE", label: "Employee" },
] as const;
export type UserType = (typeof USER_TYPES)[number]["value"];

export const APPROVAL_ORDERS = [
  { value: "ANY", label: "Any Person" },
  { value: "SEQUENTIAL", label: "Sequential" },
] as const;

export const AUTHORIZATION_TYPES = [
  { value: "APPROVAL", label: "Approval" },
  { value: "RECOMMENDATION", label: "Recommendation" },
  { value: "REVIEW", label: "Review" },
] as const;

export const MAX_APPROVERS = 20;

export const labelOf = (list: readonly { value: string; label: string }[], value: string) => list.find((o) => o.value === value)?.label ?? value;

const optionalId = z
  .union([z.uuid("Select a valid option."), z.literal("")])
  .optional()
  .default("");
const userType = z.enum(["USER", "EMPLOYEE"], { message: "Select the user type." });

export const approverInputSchema = z.object({
  userType,
  businessUnitId: optionalId,
  approverId: z.uuid("Select the approver."),
  authorizationType: z.enum(["APPROVAL", "RECOMMENDATION", "REVIEW"], { message: "Select the authorization type." }),
});

/** "" (not set) or a non-negative amount with at most 2 decimals. */
const optionalAmount = z
  .string()
  .trim()
  .regex(/^(\d{1,16}(\.\d{0,2})?)?$/, "Enter an amount (up to 2 decimals).")
  .optional()
  .default("");

export const stageInputSchema = z
  .object({
    /** Saved stage id ("" for a new stage). */
    id: optionalId,
    name: z.string().trim().min(1, "Enter the stage name.").max(150, "At most 150 characters."),
    approvalOrder: z.enum(["ANY", "SEQUENTIAL"], { message: "Select the approval order." }),
    requiredCount: z.coerce.number({ message: "Select the number of persons." }).int().min(1, "Select the number of persons.").max(MAX_APPROVERS),
    allowThreshold: z.boolean().optional().default(false),
    thresholdMin: optionalAmount,
    thresholdMax: optionalAmount,
    approvers: z.array(approverInputSchema).min(1, "Add at least one approver.").max(MAX_APPROVERS),
  })
  .refine((stage) => stage.requiredCount <= stage.approvers.length, { message: "Number of persons cannot exceed the approvers added.", path: ["requiredCount"] })
  .refine((stage) => !stage.allowThreshold || stage.thresholdMin !== "", { message: "Enter the minimum amount.", path: ["thresholdMin"] })
  .refine((stage) => !stage.allowThreshold || stage.thresholdMax === "" || stage.thresholdMin === "" || Number(stage.thresholdMax) >= Number(stage.thresholdMin), {
    message: "Maximum must be at least the minimum.",
    path: ["thresholdMax"],
  })
  .refine((stage) => new Set(stage.approvers.map((a) => `${a.userType}:${a.approverId}`)).size === stage.approvers.length, {
    message: "Each approver can be added only once per stage.",
    path: ["approvers"],
  });

export const pipelineInputSchema = z
  .object({
    name: z.string().trim().min(1, "Enter the pipeline name.").max(150, "At most 150 characters."),
    /** Optional for older callers: derived from the feature when empty. */
    module: z.union([z.enum(MODULE_NAMES, { message: "Select the module." }), z.literal("")]).optional().default(""),
    feature: z.enum(APPROVAL_FEATURES, { message: "Select the approval feature." }),
    userType,
    superApproverId: z.uuid("Select the super approver."),
    remarks: z.string().trim().max(500, "At most 500 characters.").optional().default(""),
    isOfficeWise: z.boolean().optional().default(false),
    isTerritoryWise: z.boolean().optional().default(false),
    isItemCategoryWise: z.boolean().optional().default(false),
    stages: z.array(stageInputSchema).min(1, "Add at least one stage.").max(20, "At most 20 stages."),
  })
  .refine((p) => !p.module || featuresOf(p.module).includes(p.feature), { message: "The feature does not belong to the selected module.", path: ["feature"] })
  .transform((p) => ({ ...p, module: p.module || moduleOf(p.feature) }));

export type ApproverInput = z.input<typeof approverInputSchema>;
export type StageInput = z.input<typeof stageInputSchema>;
export type PipelineInput = z.input<typeof pipelineInputSchema>;
export type PipelineData = z.output<typeof pipelineInputSchema>;

export const pipelineListQuerySchema = z.object({
  search: z.string().trim().max(100).optional().default(""),
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).optional().default(50),
});
export type PipelineListQuery = z.input<typeof pipelineListQuerySchema>;

// ─── DTOs ─────────────────────────────────────────────────────────────────────

export interface ApproverDto {
  id: string;
  userType: UserType;
  businessUnitId: string;
  businessUnitName: string | null;
  approverId: string;
  approverName: string;
  authorizationType: string;
}

export interface StageDto {
  id: string;
  stageNo: number;
  name: string;
  approvalOrder: string;
  requiredCount: number;
  allowThreshold: boolean;
  /** Amounts as strings ("" = not set). */
  thresholdMin: string;
  thresholdMax: string;
  approvers: ApproverDto[];
}

export interface PipelineDto {
  id: string;
  name: string;
  module: string;
  feature: string;
  userType: UserType;
  superApproverId: string;
  superApproverName: string | null;
  remarks: string;
  isOfficeWise: boolean;
  isTerritoryWise: boolean;
  isItemCategoryWise: boolean;
  stages: StageDto[];
}

export interface PipelineRow {
  id: string;
  name: string;
  module: string;
  feature: string;
  superApproverName: string | null;
  stageCount: number;
}

export interface PipelineList {
  rows: PipelineRow[];
  total: number;
  page: number;
  pageSize: number;
}

/** People who can approve. Employees carry their business unit; users the units they can access. */
export interface ApprovalFormOptions {
  businessUnits: { id: string; name: string }[];
  users: { id: string; name: string; businessUnitIds: string[] }[];
  /** `userId`: the employee's ERP login (a super approver acts through it). */
  employees: { id: string; name: string; code: string; designation: string | null; businessUnitId: string; userId: string | null }[];
}
