export interface CalendarDefinition {
  id: string;
  office: string;
  calendarName: string;
  shortCode: string;
  startTime: string;
  endTime: string;
  minWorkHour: number;
  lastStartTime: string;
  graceTime: string;
  minInTime: string;
  maxOutTime: string;
  breakStartTime: string;
  breakEndTime: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
}

export interface EmployeeRosterItem {
  id: string;
  employeeCode: string;
  attendanceId: string;
  name: string;
  officeName: string;
  department: string;
  departmentSection: string;
  designation: string;
}

export interface EmployeeFilterOption {
  id: string;
  employeeCode: string;
  name: string;
  officeName?: string;
  department?: string;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
}

export interface FilterState {
  office: string;
  department: string;
  departmentSection: string;
  designation: string;
  employeeId: string;
  fromDate: string;
  toDate: string;
  isAssignAll: boolean;
}

export type RosterGridData = Record<string, Record<string, string>>; // employeeId -> dateStr -> shortCode

