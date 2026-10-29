import { z } from "zod";

export const APPROVAL_STATUSES = ["Pending", "Approved", "Rejected"] as const;
export type ApprovalStatus = (typeof APPROVAL_STATUSES)[number];

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a date.");

export const bonusInputSchema = z.object({
  name: z.string().trim().min(1, "Enter a bonus name.").max(100),
  officeId: z.union([z.uuid(), z.literal("")]).default(""),
  bonusDate: date,
  percentOfGross: z.coerce.number("Enter a percentage.").gt(0, "Must be more than 0.").max(500),
  minServiceMonths: z.coerce.number().int().min(0).max(600).default(0),
});
export type BonusInput = z.input<typeof bonusInputSchema>;

export interface BonusRunRow {
  id: string;
  name: string;
  officeName: string;
  bonusDate: string;
  percentOfGross: number;
  minServiceMonths: number;
  employeeCount: number;
  totalAmount: number;
  status: ApprovalStatus;
  createdByName: string | null;
  createdAt: string;
  decidedByName: string | null;
}

export interface BonusAdviceRow {
  id: string;
  bonusName: string;
  bonusDate: string;
  status: ApprovalStatus;
  employeeCode: string;
  employeeName: string;
  officeName: string;
  serviceMonths: number;
  grossSalary: number;
  amount: number;
}

export const INCREMENT_TYPES = ["Amount", "Percent"] as const;

export const incrementInputSchema = z.object({
  employeeId: z.uuid("Select an employee."),
  effectiveDate: date,
  incrementType: z.enum(INCREMENT_TYPES),
  value: z.coerce.number("Enter a value.").gt(0, "Must be more than 0.").max(10_000_000),
  remarks: z.string().trim().max(500).default(""),
});
export type IncrementInput = z.input<typeof incrementInputSchema>;

export interface IncrementRow {
  id: string;
  employeeCode: string;
  employeeName: string;
  officeName: string;
  designation: string | null;
  effectiveDate: string;
  incrementType: string;
  value: number;
  previousGross: number;
  newGross: number;
  remarks: string;
  status: ApprovalStatus;
  createdByName: string | null;
  decidedByName: string | null;
}
