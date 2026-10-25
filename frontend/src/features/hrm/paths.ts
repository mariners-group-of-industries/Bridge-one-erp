const ROOT = "/hrm";

export const hrmPaths = {
  root: ROOT,
  dashboard: ROOT,

  // Employees & Organization
  employees: `${ROOT}/employees`,
  employeeCreate: `${ROOT}/employees/new`,
  employeeProfile: (id: string) => `${ROOT}/employees/${id}`,
  departments: `${ROOT}/departments`,
  designations: `${ROOT}/designations`,

  // Attendance & Shifts
  attendance: `${ROOT}/attendance`,
  attendanceLogs: `${ROOT}/attendance/logs`,
  shifts: `${ROOT}/shifts`,

  // Leave Management
  leave: `${ROOT}/leave`,
  leavePolicies: `${ROOT}/leave/policies`,

  // Payroll Management
  payroll: `${ROOT}/payroll`,
  salaryStructures: `${ROOT}/payroll/structures`,
  salaryProcess: `${ROOT}/payroll/process`,
  payslips: `${ROOT}/payroll/payslips`,
  salaryAdjustments: `${ROOT}/payroll/adjustments`,
  bankAdvice: `${ROOT}/payroll/bank-advice`,

  // Reports
  reports: `${ROOT}/reports`,
  salarySheet: `${ROOT}/reports/salary-sheet`,
  attendanceReport: `${ROOT}/reports/attendance`,
} as const;

export const hrmPatterns = {
  employeeProfile: `${ROOT}/employees/[id]`,
} as const;
