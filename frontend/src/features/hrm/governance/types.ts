export const POLICY_TABS = [
  { id: "attendance-process", label: "Atten Process" },
  { id: "holidays", label: "Holidays" },
  { id: "calendar-setup", label: "Calendar Setup" },
  { id: "off-day", label: "Off Day" },
  { id: "leave", label: "Leave" },
  { id: "sandwich-leave", label: "Sandwich Leave" },
  { id: "roster", label: "Roster" },
  { id: "salary", label: "Salary" },
  { id: "notice-board", label: "Notice Board" },
  { id: "bonus", label: "Bonus" },
  { id: "overtime-setup", label: "Overtime Setup" },
  { id: "separation-setup", label: "Separation Setup" },
  { id: "allowance", label: "Allowance" },
  { id: "allowance-setup", label: "Allowance Setup" },
  { id: "policy", label: "Policy" },
  { id: "employee-assign", label: "Employee Assign" },
  { id: "pf-setup", label: "PF Setup" },
  { id: "late-punishment", label: "Late Punishment" },
  { id: "others", label: "Others" },
] as const;
export type PolicyTab = (typeof POLICY_TABS)[number]["id"];

export interface PolicyFilter {
  officeId?: string;
  fromDate?: string;
  toDate?: string;
  employeeId?: string;
}

export interface GridColumn {
  key: string;
  label: string;
  align?: "right";
}

/** A read-only grid of what is stored for a settings tab. */
export interface PolicyGrid {
  /** False when the ERP does not store this setting yet. */
  configured: boolean;
  note?: string;
  columns: GridColumn[];
  rows: Record<string, string | number>[];
}

/** Employee Assign › checklist flags; OverTime and PF live on the employee's salary, Hold Salary on the employee. */
export const CHECKLIST_FLAGS = [
  { key: "overtime", label: "OverTime" },
  { key: "pf", label: "PF" },
  { key: "holdSalary", label: "Hold Salary" },
] as const;
export type ChecklistFlag = (typeof CHECKLIST_FLAGS)[number]["key"];

export interface ChecklistRow {
  id: string;
  code: string;
  name: string;
  designation: string;
  joiningDate: string;
  department: string;
  /** Policy assigned in Employee Assign today, else the one on the employee profile. */
  policy: string;
  serviceDays: number;
  /** OverTime and PF need a salary set up in Employee › Salary. */
  hasSalary: boolean;
  overtime: boolean;
  pf: boolean;
  holdSalary: boolean;
}

export const PENDING_KINDS = [
  { id: "leave", label: "Leave" },
  { id: "movement", label: "Movement" },
  { id: "bonus", label: "Bonus" },
  { id: "increment", label: "Increment" },
] as const;
export type PendingKind = (typeof PENDING_KINDS)[number]["id"];

export interface PendingList {
  columns: GridColumn[];
  rows: (Record<string, string | number> & { id: string })[];
}
