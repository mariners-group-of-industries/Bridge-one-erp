const ROOT = "/hrm";

export const hrmPaths = {
  root: ROOT,
  dashboard: ROOT,

  // Employee Self Service
  selfService: `${ROOT}/self-service`,
  myProfile: `${ROOT}/self-service/profile`,
  myLeave: `${ROOT}/self-service/leave`,
  leaveApply: `${ROOT}/self-service/leave/apply`,
  myMovement: `${ROOT}/self-service/movement`,
  movementApply: `${ROOT}/self-service/movement/apply`,

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
