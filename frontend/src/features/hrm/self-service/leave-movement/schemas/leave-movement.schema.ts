import { z } from "zod";

/** Yearly quota in days; null = no limit (balance not tracked). Same for every employee for now. */
export const LEAVE_TYPES = [
  { name: "Casual Leave", quota: 10 },
  { name: "Sick Leave", quota: 14 },
  { name: "Earned Leave", quota: 18 },
  { name: "Maternity Leave", quota: 112 },
  { name: "Leave Without Pay", quota: null },
] as const;

export const MOVEMENT_TYPES = ["Official", "Personal", "Client Visit", "Field Work"] as const;

/** Cancelled = withdrawn by the employee while pending (kept for the record; uses no balance). */
export const APPLICATION_STATUSES = ["Pending", "Approved", "Rejected", "Cancelled"] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export const MAX_LEAVE_ATTACHMENTS = 3;
export const MAX_LEAVE_DAYS = 180;
export const MAX_MOVEMENT_DAYS = 31;

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a valid date.");
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use a valid time.");
const employeeId = z.guid("Select an employee.").optional();

export const leaveInputSchema = z.object({
  employeeId,
  // Checked on the server against the employee's leave policy (leave-policy.ts).
  leaveType: z.string("Select a leave type.").trim().min(1, "Select a leave type.").max(40),
  fromDate: date,
  toDate: date,
  location: z.string().trim().max(150).default(""),
  reason: z.string().trim().min(1, "Enter a reason.").max(500),
});
export type LeaveInput = z.input<typeof leaveInputSchema>;

export const movementInputSchema = z.object({
  employeeId,
  movementType: z.enum(MOVEMENT_TYPES, "Select a movement type."),
  fromDate: date,
  toDate: date,
  startTime: time,
  endTime: time,
  location: z.string().trim().min(1, "Enter a location.").max(150),
  reason: z.string().trim().min(1, "Enter a reason.").max(500),
});
export type MovementInput = z.input<typeof movementInputSchema>;

export interface EmployeeOption {
  id: string;
  code: string;
  name: string;
}

export interface LeaveMovementOptions {
  /** The master account (HR) applies for anyone, sees everyone and approves. */
  canManage: boolean;
  /** The employee linked to the signed-in account. */
  self: EmployeeOption | null;
}

export interface LeaveBalanceRow {
  leaveType: string;
  /** This year's entitlement, including days carried forward. */
  quota: number | null;
  /** Unused days carried forward from last year (included in `quota`). */
  carried?: number;
  /** Policy rules shown to the applicant. */
  noticeDays?: number | null;
  attachmentAfterDays?: number | null;
  /** Approved days this year. */
  taken: number;
  /** Days waiting for approval; already held back from `remaining`. */
  pending: number;
  remaining: number | null;
}

interface ApplicationBase {
  id: string;
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  fromDate: string;
  toDate: string;
  location: string;
  reason: string;
  status: ApplicationStatus;
  appliedAt: string;
  decidedByName: string | null;
  decidedAt: string | null;
  canDelete: boolean;
  canDecide: boolean;
}

export interface LeaveRow extends ApplicationBase {
  leaveType: string;
  days: number;
  attachments: { id: string; name: string; size: number }[];
}

export interface MovementRow extends ApplicationBase {
  movementType: string;
  startTime: string;
  endTime: string;
}
