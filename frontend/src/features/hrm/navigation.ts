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

export const leaveMovementLink: NavLink = {
  label: "Leave & Movement",
  href: hrmPaths.leaveMovement,
  description: "Apply for leave or movement, see your leave balance, and track approval status.",
  keywords: ["leave", "movement", "vacation", "casual leave", "sick leave", "earned leave", "out of office", "official visit", "field work"],
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

// ─── Compensation Adjustments ───────────────────────────────────────────────

export const salaryDisbursementLink: NavLink = {
  label: "Salary Disbursement",
  href: hrmPaths.salaryDisbursement,
  description: "Salary advice and the salary generate sheet for an office and month.",
  keywords: ["salary disbursement", "salary advice", "salary sheet", "bank advice", "pay sheet"],
};

export const bonusLink: NavLink = {
  label: "Bonus",
  href: hrmPaths.bonus,
  description: "Generate festival or performance bonuses and the bonus advice.",
  keywords: ["bonus", "festival bonus", "eid bonus", "bonus advice", "bonus generate"],
};

// ─── HR Governance ──────────────────────────────────────────────────────────

export const policySettingsLink: NavLink = {
  label: "Settings / Policies",
  href: hrmPaths.policySettings,
  description: "HR settings and policies: leave, salary, bonus, overtime, PF, separation, allowance and more.",
  keywords: ["settings", "policies", "policy", "hr settings", "holiday", "roster", "pf", "overtime setup", "allowance"],
};

export const pendingApprovalLink: NavLink = {
  label: "Pending Approval",
  href: hrmPaths.pendingApproval,
  description: "Leave, movement, bonus and increment applications waiting for approval.",
  keywords: ["pending approval", "approve", "reject", "approval queue"],
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
    leaveMovementLink,
    attendanceLink,
    calendarAssignLink,
    overtimeLink,
    payrollLink,
    salaryDisbursementLink,
    bonusLink,
    incrementLink,
    pendingApprovalLink,
  ],
  cards: [
    {
      label: "Employee Self Service",
      links: [
        profileLink,
        leaveMovementLink,
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
      label: "Compensation Adjustments",
      links: [
        salaryDisbursementLink,
        bonusLink,
      ],
    },
    {
      label: "Talent Offboarding",
      links: [
        incrementLink,
      ],
    },
    {
      label: "HR Governance",
      links: [
        policySettingsLink,
        pendingApprovalLink,
      ],
    },
  ],
  routes: [
    { pattern: hrmPatterns.employeeProfile, label: "Employee Profile", parent: hrmPaths.employees },
  ],
};
