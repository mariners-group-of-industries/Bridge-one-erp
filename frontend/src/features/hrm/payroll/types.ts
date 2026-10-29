import { z } from "zod";

export const monthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Select a month and year.");
export const processPayrollSchema = z.object({ officeId: z.uuid("Select an office."), month: monthSchema });

export type PayrollStatus = "Processed" | "Not Processed";

/** One office's payroll for one month (HRM › Payroll). */
export interface PayrollRow {
  officeId: string;
  businessUnit: string;
  officeName: string;
  /** YYYY-MM */
  month: string;
  fromDate: string;
  toDate: string;
  employeeCount: number;
  netAmount: number;
  status: PayrollStatus;
  runId: string | null;
  processedByName: string | null;
  processedAt: string | null;
}

/** One employee in the salary generate sheet / advice. */
export interface SalaryLine {
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  designation: string | null;
  monthDays: number;
  payableDays: number;
  grossSalary: number;
  earnedSalary: number;
  additions: number;
  deductions: number;
  netAmount: number;
  disbursementMode: string;
  bankOrProvider: string | null;
  accountNo: string | null;
}

export interface SalarySheet {
  officeName: string;
  businessUnit: string;
  month: string;
  fromDate: string;
  toDate: string;
  status: PayrollStatus;
  lines: SalaryLine[];
  totals: { grossSalary: number; earnedSalary: number; additions: number; deductions: number; netAmount: number };
  /** Employees left out because they have no salary set. */
  withoutSalary: number;
}
