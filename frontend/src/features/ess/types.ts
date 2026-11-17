import type { ApprovalTrailStage } from "@/lib/approval/engine";
import type { LeaveBalanceRow } from "@/features/hrm/self-service/leave-movement/schemas/leave-movement.schema";

/** Employee Self Service data contracts (browser ⇄ /api/ess). */

export interface EssEmployee {
  code: string;
  name: string;
  designation: string | null;
  department: string | null;
  departmentSection: string | null;
  officeName: string;
  joiningDate: string;
  isActive: boolean;
  canApply: boolean;
  hasPhoto: boolean;
}

export type EssMe = { linked: true; employee: EssEmployee } | { linked: false; message: string };

/** A day's status as the employee sees it. "Pending" = not processed yet (today); "Upcoming" = a future day. */
export type EssDayStatus = "Present" | "Late" | "Absent" | "Leave" | "Holiday" | "Weekly Off" | "Pending" | "Upcoming" | "No Schedule";

export interface EssDay {
  date: string;
  day: string;
  /** Calendar name and code, "Weekly Off", "Holiday" or null when nothing is assigned. */
  shift: string | null;
  scheduledIn: string | null;
  scheduledOut: string | null;
  actualIn: string | null;
  actualOut: string | null;
  lateMinutes: number | null;
  earlyLeaveMinutes: number | null;
  workedMinutes: number | null;
  status: EssDayStatus;
  /** Today's figures can still change (more punches, processing). */
  provisional: boolean;
  remarks: string | null;
  leaveType: string | null;
  holidayTitle: string | null;
  /** A correction request on this day. */
  correction: "Pending" | "Approved" | null;
  /** Deduction this day attracts under the current policies, in words. */
  deduction: string | null;
}

export interface EssAttendanceSummary {
  workingDays: number;
  present: number;
  late: number;
  absent: number;
  leave: number;
  weeklyOff: number;
  holidays: number;
  pending: number;
  /** Late rule: lates per deduction and days deducted (null without a rule). */
  lateRule: { latesAllowed: number; deductionDays: number; deductFrom: string } | null;
  lateDeductionDays: number;
  /** Absent days deducted from salary under the payroll rule (null when the rule does not deduct absence). */
  absentDeductionDays: number | null;
  /** Share of scheduled days so far that were attended (present + late + leave), 0–100. */
  attendanceRate: number | null;
}

export interface EssPayrollRef {
  reference: string;
  month: string;
  attendanceDeduction: number;
  netPayable: number;
}

export interface EssAttendanceMonth {
  month: string;
  from: string;
  to: string;
  summary: EssAttendanceSummary;
  days: EssDay[];
  /** The published payslip for this month, when there is one (actual deduction). */
  payroll: EssPayrollRef | null;
}

export interface EssPunch {
  time: string;
  device: string;
}

export interface EssDayDetail {
  day: EssDay;
  calendar: { name: string; code: string; start: string; end: string; graceTime: string | null; lastStartTime: string | null } | null;
  punches: EssPunch[];
  processing: string;
  requests: EssCorrection[];
  canRequestCorrection: boolean;
}

export interface EssCalendarDay {
  date: string;
  day: string;
  kind: "work" | "off" | "holiday" | "none";
  shift: string | null;
  start: string | null;
  end: string | null;
  holidayTitle: string | null;
  leave: { type: string; status: string } | null;
  status: EssDayStatus | null;
}

export interface EssCalendarMonth {
  month: string;
  days: EssCalendarDay[];
  holidays: { date: string; title: string }[];
}

export interface EssLeaveApplication {
  id: string;
  reference: string;
  leaveType: string;
  fromDate: string;
  toDate: string;
  days: number;
  reason: string;
  location: string;
  status: string;
  appliedAt: string;
  decidedByName: string | null;
  decidedAt: string | null;
  /** "Stage 1 of 2 — Line Manager", "Approved", … */
  stage: string;
  attachments: { id: string; name: string; size: number }[];
  canCancel: boolean;
}

export interface EssLeaveDetail extends EssLeaveApplication {
  trail: ApprovalTrailStage[];
}

export interface EssLeaveOverview {
  year: number;
  balances: LeaveBalanceRow[];
  applications: EssLeaveApplication[];
  counts: { pending: number; approved: number; rejected: number; cancelled: number };
  canApply: boolean;
}

export interface EssLeavePreview {
  days: number;
  calendarDays: number;
  excluded: { date: string; reason: string }[];
  remaining: number | null;
  noticeDays: number | null;
  attachmentRequired: boolean;
  problems: string[];
}

export interface EssCorrection {
  id: string;
  date: string;
  originalStatus: string | null;
  requestedStatus: string;
  inTime: string | null;
  outTime: string | null;
  reason: string | null;
  status: string;
  requestedAt: string;
}

export const CORRECTION_TYPES = ["Missing Check-In", "Missing Check-Out", "Incorrect Attendance", "Shift Mismatch", "Other"] as const;
export type CorrectionType = (typeof CORRECTION_TYPES)[number];

export interface EssPayslipRow {
  id: string;
  reference: string;
  month: string;
  payrollDate: string;
  salaryType: string;
  grossSalary: number;
  allowances: number;
  deductions: number;
  netPayable: number;
  publishedAt: string;
}

export interface EssPayslip extends EssPayslipRow {
  employee: { code: string; name: string; designation: string | null; department: string | null; office: string };
  period: { from: string; to: string };
  earnings: { label: string; amount: number }[];
  deductionLines: { label: string; amount: number }[];
  earnedGross: number;
  additions: number;
  attendanceDeduction: number;
  otherDeduction: number;
  payMethod: string;
  attendance: Record<string, unknown>;
}

export interface EssNotification {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  link: string | null;
  read: boolean;
  createdAt: string;
}

export interface EssNotice {
  id: string;
  title: string;
  priority: string;
  message: string;
  publishedOn: string | null;
  expiresOn: string | null;
}

export interface EssNotifications {
  unread: number;
  items: EssNotification[];
  notices: EssNotice[];
}

export interface EssActivity {
  at: string;
  kind: "leave" | "attendance" | "payslip" | "calendar" | "notification";
  title: string;
  detail: string | null;
  tone: "success" | "warning" | "danger" | "neutral";
  link: string | null;
}

export interface EssUpcoming {
  date: string;
  day: string;
  label: string;
  kind: "work" | "off" | "holiday" | "leave" | "none";
}

export interface EssDashboard {
  employee: EssEmployee;
  today: EssDay;
  month: { month: string; summary: EssAttendanceSummary };
  leave: { balances: LeaveBalanceRow[]; pending: number; upcoming: { leaveType: string; fromDate: string; toDate: string; days: number }[] };
  activities: EssActivity[];
  upcoming: EssUpcoming[];
  notices: EssNotice[];
  unread: number;
  latestPayslip: EssPayslipRow | null;
}

export interface EssProfile {
  employee: EssEmployee;
  basic: { label: string; value: string | null }[];
  contact: { label: string; value: string | null }[];
  employment: { label: string; value: string | null }[];
}
