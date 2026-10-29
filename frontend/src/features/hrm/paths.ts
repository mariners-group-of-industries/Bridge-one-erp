const ROOT = "/hrm";

export const hrmPaths = {
  root: ROOT,
  dashboard: ROOT,

  // Employee Self Service
  selfService: `${ROOT}/self-service`,
  myProfile: `${ROOT}/self-service/profile`,
  leaveMovement: `${ROOT}/self-service/leave-movement`,

  // Time and Attendance
  attendance: `${ROOT}/attendance`,
  attendanceDaily: `${ROOT}/attendance/daily`,
  calendarAssign: `${ROOT}/calendar-assign`,
  overtime: `${ROOT}/overtime`,

  // Payroll Administration
  payroll: `${ROOT}/payroll`,
  payrollProcess: `${ROOT}/payroll/process`,
  payslips: `${ROOT}/payroll/payslips`,
  salaryStructures: `${ROOT}/payroll/structures`,
  salaryAdjustments: `${ROOT}/payroll/adjustments`,

  // Compensation Adjustments
  salaryDisbursement: `${ROOT}/compensation/salary-disbursement`,
  bonus: `${ROOT}/compensation/bonus`,

  // HR Governance
  policySettings: `${ROOT}/governance/settings`,
  pendingApproval: `${ROOT}/governance/pending-approval`,

  // Talent & Offboarding
  talent: `${ROOT}/talent`,
  increment: `${ROOT}/talent/increment`,
  offboarding: `${ROOT}/talent/offboarding`,

  // Employee Directory & Management
  employees: `${ROOT}/employees`,
  employeeProfile: (id: string) => `${ROOT}/employees/${id}`,
} as const;

export const hrmPatterns = {
  employeeProfile: `${ROOT}/employees/[id]`,
} as const;
