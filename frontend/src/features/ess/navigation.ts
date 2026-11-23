import type { NavCard, NavLink } from "@/lib/navigation/types";

/**
 * Employee Self Service ("My Workspace"). Deliberately not a module workspace:
 * module pages are granted per page in Permission Groups, while these pages
 * show only the signed-in employee's own records and need no grant. The
 * sidebar shows them to any login linked to an employee record.
 */
export const essPaths = {
  root: "/employee",
  dashboard: "/employee/dashboard",
  attendance: "/employee/attendance",
  dailyAttendance: "/employee/daily-attendance",
  calendar: "/employee/calendar",
  corrections: "/employee/attendance-corrections",
  leave: "/employee/leave",
  leaveApply: "/employee/leave/apply",
  leaveHistory: "/employee/leave/history",
  leaveDetail: (id: string) => `/employee/leave/history/${id}`,
  payslips: "/employee/payslips",
  payslip: (id: string) => `/employee/payslips/${id}`,
  profile: "/employee/profile",
  notifications: "/employee/notifications",
  account: "/profile",
} as const;

const link = (label: string, href: string, description: string, exact = false): NavLink => ({ label, href, description, exact });

export const essNavigation: readonly NavCard[] = [
  { label: "Overview", links: [link("My Dashboard", essPaths.dashboard, "Your attendance, leave and schedule at a glance.")] },
  {
    label: "Attendance",
    links: [
      link("My Attendance", essPaths.attendance, "Monthly attendance history with lates and deductions."),
      link("Daily Attendance", essPaths.dailyAttendance, "One day in detail with device punches."),
      link("My Calendar", essPaths.calendar, "Assigned shifts, off days, holidays and leave."),
      link("Attendance Corrections", essPaths.corrections, "Ask HR to correct a missing or wrong attendance."),
    ],
  },
  {
    label: "Leave",
    links: [
      link("Apply for Leave", essPaths.leaveApply, "Apply for leave; it goes through the approval workflow."),
      link("My Leave Applications", essPaths.leaveHistory, "Track your leave applications and approvals."),
      link("Leave Balance", essPaths.leave, "Entitlement, taken, pending and remaining days by leave type.", true),
    ],
  },
  { label: "Payroll", links: [link("My Payslips", essPaths.payslips, "Your published payslips.")] },
  {
    label: "Personal",
    links: [
      link("My Profile", essPaths.profile, "Your employee record."),
      link("Notifications", essPaths.notifications, "Decisions, published payslips, calendar changes and notices."),
      link("Account Settings", essPaths.account, "Your login name, phone and password.", true),
    ],
  },
];
