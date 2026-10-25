import {
  Banknote,
  Briefcase,
  CalendarCheck,
  CalendarDays,
  Clock,
  FileSpreadsheet,
  FileText,
  Footprints,
  TrendingUp,
  UserCheck,
  Users,
  UserSquare2,
} from "lucide-react";
import type { NavLink, Workspace } from "@/lib/navigation/types";
import { hrmPaths, hrmPatterns } from "./paths";

// ─── Employee Self Service ───────────────────────────────────────────────────

export const profileLink: NavLink = {
  label: "Profile",
  href: hrmPaths.myProfile,
  description: "Personal and job information, employment history, documents, and salary details.",
  keywords: ["profile", "employee", "personal", "self service", "documents"],
};

export const leaveLink: NavLink = {
  label: "Leave",
  href: hrmPaths.myLeave,
  description: "Apply for leaves, view leave balance, track approval status, and holiday list.",
  keywords: ["leave", "vacation", "holiday", "casual leave", "sick leave", "earned leave"],
};

export const movementLink: NavLink = {
  label: "Movement",
  href: hrmPaths.myMovement,
  description: "Official duty / field movement applications, client visit logs, and out-of-office requests.",
  keywords: ["movement", "out of office", "official visit", "tour", "duty", "field work"],
};

// ─── Time and Attendance ─────────────────────────────────────────────────────

export const attendanceLink: NavLink = {
  label: "Attendance",
  href: hrmPaths.attendance,
  description: "Daily attendance tracking, biometric logs, manual in/out adjustments, and late records.",
  keywords: ["attendance", "daily attendance", "biometric", "check in", "late", "absent", "punch"],
};

export const calendarAssignLink: NavLink = {
  label: "Calendar Assign",
  href: hrmPaths.calendarAssign,
  description: "Assign work calendars, general and rotational shift rosters, and weekly off-days to employees.",
  keywords: ["calendar assign", "shift assign", "roster", "work calendar", "off day", "shift schedule"],
};

export const overtimeLink: NavLink = {
  label: "Overtime",
  href: hrmPaths.overtime,
  description: "Overtime (OT) hours tracking, overtime requisitions, approval, and monthly OT summary.",
  keywords: ["overtime", "ot", "extra hours", "ot approval", "ot rate"],
};

// ─── Payroll Administration ──────────────────────────────────────────────────

export const payrollLink: NavLink = {
  label: "Payroll",
  href: hrmPaths.payroll,
  description: "Monthly payroll generation, salary structures, payslips, deductions, and bank advice.",
  keywords: ["payroll", "salary", "pay run", "payslip", "structure", "deductions", "disbursement"],
};

// ─── Talent & Offboarding ───────────────────────────────────────────────────

export const incrementLink: NavLink = {
  label: "Increment",
  href: hrmPaths.increment,
  description: "Employee annual/performance salary increments, revision history, and batch increment processing.",
  keywords: ["increment", "salary hike", "appraisal", "pay raise", "talent", "offboarding"],
};

// ─── Workspace Configuration ────────────────────────────────────────────────

export const hrmWorkspace: Workspace = {
  id: "hrm",
  label: "HRM",
  icon: Users,
  href: hrmPaths.root,
  description: "Human Resource Management: Self-service, time & attendance, payroll administration, and talent management.",
  status: "active",
  shortcuts: [
    profileLink,
    leaveLink,
    movementLink,
    attendanceLink,
    calendarAssignLink,
    overtimeLink,
    payrollLink,
    incrementLink,
  ],
  cards: [
    {
      label: "Employee Self Service",
      links: [
        profileLink,
        leaveLink,
        movementLink,
      ],
    },
    {
      label: "Time and Attendance",
      links: [
        attendanceLink,
        calendarAssignLink,
        overtimeLink,
      ],
    },
    {
      label: "Payroll Administration",
      links: [
        payrollLink,
      ],
    },
    {
      label: "Talent Offboarding",
      links: [
        incrementLink,
      ],
    },
  ],
  routes: [
    { pattern: hrmPatterns.employeeProfile, label: "Employee Profile", parent: hrmPaths.employees },
  ],
};
