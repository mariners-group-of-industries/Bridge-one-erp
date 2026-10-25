import {
  Banknote,
  Building2,
  CalendarDays,
  Clock,
  CreditCard,
  FileSpreadsheet,
  FileText,
  LayoutDashboard,
  Receipt,
  UserCheck,
  UserPlus,
  Users,
} from "lucide-react";
import type { NavLink, Workspace } from "@/lib/navigation/types";
import { hrmPaths, hrmPatterns } from "./paths";

export const hrmDashboard: NavLink = {
  label: "HRM Dashboard",
  href: hrmPaths.dashboard,
  description: "Workforce overview, attendance statistics, salary expenditures and payroll status.",
  keywords: ["hrm", "dashboard", "kpi", "overview", "workforce", "headcount"],
};

export const employeeList: NavLink = {
  label: "Employee Directory",
  href: hrmPaths.employees,
  description: "Active employees, personal profiles, job designations, and employment records.",
  keywords: ["employee", "staff", "directory", "profiles", "headcount", "personnel"],
};

export const employeeNew: NavLink = {
  label: "New Employee Onboarding",
  href: hrmPaths.employeeCreate,
  description: "Enroll a new staff member with personal, professional, and salary details.",
  keywords: ["new employee", "hire", "onboard", "create employee"],
};

export const departments: NavLink = {
  label: "Departments & Designations",
  href: hrmPaths.departments,
  description: "Organizational hierarchy, business departments, job titles, and grades.",
  keywords: ["department", "designation", "grades", "organization", "hierarchy"],
};

export const dailyAttendance: NavLink = {
  label: "Daily Attendance",
  href: hrmPaths.attendance,
  description: "Daily check-in/out registers, late arrivals, early departures, and overtime hours.",
  keywords: ["attendance", "present", "absent", "late", "overtime", "clock in"],
};

export const shiftSetup: NavLink = {
  label: "Shift Management",
  href: hrmPaths.shifts,
  description: "Roster scheduling, general and rotational shifts, and timing grace periods.",
  keywords: ["shift", "roster", "timings", "schedule"],
};

export const leaveManagement: NavLink = {
  label: "Leave Applications",
  href: hrmPaths.leave,
  description: "Leave requests, balance allowances, maternity/casual/sick leave approvals.",
  keywords: ["leave", "vacation", "holiday", "casual leave", "sick leave", "approval"],
};

export const salaryStructures: NavLink = {
  label: "Salary Structure & Setup",
  href: hrmPaths.salaryStructures,
  description: "Basic salary formulas, house rent, medical, conveyance, food allowances, and PF.",
  keywords: ["salary structure", "basic", "house rent", "allowance", "provident fund", "deduction"],
};

export const salaryProcess: NavLink = {
  label: "Monthly Payroll Processing",
  href: hrmPaths.salaryProcess,
  description: "Generate and review monthly salary sheets from attendance and salary structures.",
  keywords: ["payroll process", "generate salary", "monthly payroll", "pay run"],
};

export const payslips: NavLink = {
  label: "Payslips & Pay Register",
  href: hrmPaths.payslips,
  description: "Individual printable payslips, breakdown statements, and salary payment logs.",
  keywords: ["payslip", "pay slip", "pay register", "salary slip", "advice"],
};

export const salaryAdjustments: NavLink = {
  label: "Salary Adjustments & Loans",
  href: hrmPaths.salaryAdjustments,
  description: "Special bonuses, festival allowances, advance deductions, and loan repayments.",
  keywords: ["adjustment", "bonus", "advance", "loan", "deduction", "fine"],
};

export const bankAdviceReport: NavLink = {
  label: "Bank Advice & Disbursement",
  href: hrmPaths.bankAdvice,
  description: "Bank transfer letters, MFS routing files, and cash disbursement sheets.",
  keywords: ["bank advice", "disbursement", "bftn", "mfs", "bkash", "cash salary"],
};

export const salarySheetReport: NavLink = {
  label: "Monthly Salary Sheet Report",
  href: hrmPaths.salarySheet,
  description: "Comprehensive payroll master report with gross, additions, deductions, and net pay.",
  keywords: ["salary sheet", "payroll report", "register", "audit"],
};

export const attendanceReport: NavLink = {
  label: "Attendance Summary Report",
  href: hrmPaths.attendanceReport,
  description: "Monthly attendance percentages, working days, leaves taken, and overtime logs.",
  keywords: ["attendance report", "timecard", "manhours", "overtime report"],
};

export const hrmWorkspace: Workspace = {
  id: "hrm",
  label: "HRM",
  icon: Users,
  href: hrmPaths.root,
  description: "Human Resource Management: employee directory, attendance, leaves, payroll processing, and salary structures.",
  status: "active",
  shortcuts: [
    employeeList,
    dailyAttendance,
    leaveManagement,
    salaryProcess,
    payslips,
  ],
  cards: [
    {
      label: "Employee & Organization",
      links: [
        employeeList,
        employeeNew,
        departments,
      ],
    },
    {
      label: "Time & Attendance",
      links: [
        dailyAttendance,
        shiftSetup,
        leaveManagement,
      ],
    },
    {
      label: "Payroll & Compensation",
      links: [
        salaryStructures,
        salaryProcess,
        payslips,
        salaryAdjustments,
        bankAdviceReport,
      ],
    },
    {
      label: "HR Reports & Analytics",
      links: [
        salarySheetReport,
        attendanceReport,
      ],
    },
  ],
  routes: [
    { pattern: hrmPatterns.employeeProfile, label: "Employee Profile", parent: hrmPaths.employees },
  ],
};
