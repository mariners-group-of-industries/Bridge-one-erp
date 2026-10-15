import { z } from "zod";

// Approval Setup (Configuration › Identity & Security). Shared by the form and
// the API. "" means "not set"; the service stores NULL.

/** Documents that can go through an approval pipeline. */
export const APPROVAL_FEATURES = [
  "Purchase Requisition",
  "Purchase Order",
  "Goods Receipt",
  "Purchase Return",
  "Sales Quotation",
  "Sales Order",
  "Sales Delivery",
  "Sales Return",
  "Sales Collection",
  "Customer Price Setup",
  "Offer Setup",
] as const;

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

export const stageInputSchema = z
  .object({
    /** Saved stage id ("" for a new stage). */
    id: optionalId,
    name: z.string().trim().min(1, "Enter the stage name.").max(150, "At most 150 characters."),
    approvalOrder: z.enum(["ANY", "SEQUENTIAL"], { message: "Select the approval order." }),
    requiredCount: z.coerce.number({ message: "Select the number of persons." }).int().min(1, "Select the number of persons.").max(MAX_APPROVERS),
    approvers: z.array(approverInputSchema).min(1, "Add at least one approver.").max(MAX_APPROVERS),
  })
  .refine((stage) => stage.requiredCount <= stage.approvers.length, { message: "Number of persons cannot exceed the approvers added.", path: ["requiredCount"] })
  .refine((stage) => new Set(stage.approvers.map((a) => `${a.userType}:${a.approverId}`)).size === stage.approvers.length, {
    message: "Each approver can be added only once per stage.",
    path: ["approvers"],
  });

export const pipelineInputSchema = z.object({
  name: z.string().trim().min(1, "Enter the pipeline name.").max(150, "At most 150 characters."),
  feature: z.enum(APPROVAL_FEATURES, { message: "Select the approval feature." }),
  userType,
  superApproverId: z.uuid("Select the super approver."),
  remarks: z.string().trim().max(500, "At most 500 characters.").optional().default(""),
  stages: z.array(stageInputSchema).min(1, "Add at least one stage.").max(20, "At most 20 stages."),
});

export type ApproverInput = z.input<typeof approverInputSchema>;
export type StageInput = z.input<typeof stageInputSchema>;
export type PipelineInput = z.input<typeof pipelineInputSchema>;
export type PipelineData = z.output<typeof pipelineInputSchema>;

export const pipelineListQuerySchema = z.object({
  search: z.string().trim().max(100).optional().default(""),
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).optional().default(25),
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
  approvers: ApproverDto[];
}

export interface PipelineDto {
  id: string;
  name: string;
  feature: string;
  userType: UserType;
  superApproverId: string;
  superApproverName: string | null;
  remarks: string;
  stages: StageDto[];
}

export interface PipelineRow {
  id: string;
  name: string;
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
  employees: { id: string; name: string; code: string; designation: string | null; businessUnitId: string }[];
}
