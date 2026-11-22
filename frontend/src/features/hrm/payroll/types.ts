import { z } from "zod";

export const monthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Select a month and year.");
export const processPayrollSchema = z.object({ officeId: z.guid("Select an office."), month: monthSchema });

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

/** One employee in Salary Disbursement: the payroll engine's figures (period, lates, absences). */
export interface DisbursementLine extends SalaryLine {
  lateCount: number;
  absentDays: number;
  /** Days deducted for absence, unpaid leave and lates (Late Punishment). */
  deductionDays: number;
  attendanceDeduction: number;
  otherDeduction: number;
}

/** A payroll batch the sheet is read from. */
export interface DisbursementBatch {
  id: string;
  reference: string;
  salaryType: string;
  status: string;
  payrollDate: string;
}

export interface SalarySheet {
  officeName: string;
  businessUnit: string;
  month: string;
  /** Payroll period, e.g. 21 Oct – 20 Nov. */
  fromDate: string;
  toDate: string;
  /** The saved payrolls of the office and month (not cancelled); empty = a live, provisional calculation. */
  batches: DisbursementBatch[];
  /** Every batch is Approved: the figures are final. */
  final: boolean;
  lines: DisbursementLine[];
  totals: { grossSalary: number; earnedSalary: number; additions: number; deductions: number; attendanceDeduction: number; netAmount: number; lateCount: number };
  /** Employees left out because they have no salary set. */
  withoutSalary: number;
}

/** Legacy calendar-month sheet (HRM › Payroll runs), kept for the old Process endpoint. */
export interface LegacySalarySheet {
  officeName: string;
  businessUnit: string;
  month: string;
  fromDate: string;
  toDate: string;
  status: PayrollStatus;
  lines: SalaryLine[];
  totals: { grossSalary: number; earnedSalary: number; additions: number; deductions: number; netAmount: number };
  withoutSalary: number;
}
