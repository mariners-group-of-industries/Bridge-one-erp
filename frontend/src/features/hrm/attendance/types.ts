export type AttendanceStatus =
  | "Present"
  | "Late"
  | "Absent"
  | "Offday"
  | "Holiday"
  | "Leave";

/** Statuses a manual change (HR edit or an employee's own request) may set. */
export const ADJUSTABLE_STATUSES = ["Present", "Late", "Absent", "Leave", "Offday", "Holiday"] as const;

export interface AttendanceRecord {
  id: string;
  sl: number;
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  designation: string;
  department: string;
  departmentSection: string;
  date: string; // YYYY-MM-DD
  day: string; // Fri, Sat, Sun, etc.
  calendarName: string;
  inTime: string | null;
  outTime: string | null;
  inTimeLocation: string | null;
  outTimeLocation: string | null;
  actualAttendance: AttendanceStatus;
  requestAttendance: string | null;
  remarks: string | null;
  lastActionBy: string | null;
  lastActionTime: string | null;
  /** The manual adjustment shown on this row, if any. */
  adjustmentId?: string;
  /** Pending = waiting for HR approval; the status changes only once approved. */
  adjustmentStatus?: "Pending" | "Approved";
}

export interface AttendanceFilterState {
  fromDate: string; // YYYY-MM-DD
  toDate: string; // YYYY-MM-DD
  viewBy: "Employee" | "Department" | "Date" | "All";
  employeeId: string; // "ALL" or employee id/code
  /** "ALL" or an office id: only employees of that office. */
  officeId: string;
  status: string; // "ALL" or AttendanceStatus
  pageSize: number;
  page: number;
}

export interface EmployeeOption {
  id: string;
  employeeCode: string;
  name: string;
  designation: string;
  department: string;
  departmentSection: string;
  officeId: string;
  officeName: string;
}
