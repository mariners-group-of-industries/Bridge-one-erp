export type AttendanceStatus =
  | "Present"
  | "Late"
  | "Absent"
  | "Offday"
  | "Holiday"
  | "Leave";

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
}

export interface AttendanceFilterState {
  fromDate: string; // YYYY-MM-DD
  toDate: string; // YYYY-MM-DD
  viewBy: "Employee" | "Department" | "Date" | "All";
  employeeId: string; // "ALL" or employee id/code
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
  officeName: string;
}
