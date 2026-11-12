import { getConnectPool } from "./db";

export type TaskPriority = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

export type TaskStatus =
  | "NOT_STARTED"
  | "IN_PROGRESS"
  | "BLOCKED"
  | "SUBMITTED_FOR_APPROVAL"
  | "VERIFIED_COMPLETED"
  | "REJECTED"
  | "CANCELLED";

export type RecurringType = "ONE_TIME" | "DAILY" | "WEEKLY" | "MONTHLY";

export type EscalationStage =
  | "NONE"
  | "REMINDER_2H"
  | "OVERDUE_FLAG"
  | "DEPT_HEAD_1H"
  | "CMO_24H"
  | "MD_CRITICAL_ALERT";

export interface TaskCollaborator {
  id: string;
  name: string;
  department: string;
}

export interface ConnectTaskRecord {
  id: string;
  taskCode: string;
  companyName: string;
  department: string;
  projectName: string;
  title: string;
  description: string;
  assignedToId: string;
  assignedToName: string;
  assignedToDesignation: string;
  collaborators: TaskCollaborator[];
  assignedById: string;
  assignedByName: string;
  assignedByRole: string;
  reportingToId: string;
  reportingToName: string;
  startDate: string;
  originalDeadline: string;
  deadline: string;
  priority: TaskPriority;
  status: TaskStatus;
  progressPercent: number;
  verificationRequired: boolean;
  recurringType: RecurringType;
  attachmentName: string | null;
  attachmentUrl: string | null;
  evidenceName: string | null;
  evidenceUrl: string | null;
  staffRemarks: string | null;
  blockerReason: string | null;
  blockedByDepartment: string | null;
  blockedByPerson: string | null;
  blockerVerified: boolean;
  requiresMdDecision: boolean;
  mdDecisionNote: string | null;
  qualityRating: number | null;
  supervisorFeedback: string | null;
  reworkCount: number;
  escalationStage: EscalationStage;
  nudgeCount: number;
  lastNudgedAt: string | null;
  submittedAt: string | null;
  completedAt: string | null;
  verifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
  // Computed live fields
  isOverdue: boolean;
  overdueHours: number;
  hoursUntilDeadline: number;
  computedEscalation: EscalationStage;
  priorityWeight: number;
}

export interface EmployeeKpiScorecard {
  employeeId: string;
  employeeName: string;
  designation: string;
  companyName: string;
  department: string;
  totalTasks: number;
  verifiedCompletedTasks: number;
  submittedTasks: number;
  inProgressTasks: number;
  overdueTasks: number;
  blockedTasks: number;
  verifiedBlockerExcusedCount: number;
  onApprovedLeaveDays: number;
  // 100-Point Breakdown
  deadlineComplianceScore: number; // out of 40
  qualityApprovalScore: number; // out of 30
  taskImportanceScore: number; // out of 20
  timelyReportingScore: number; // out of 10
  totalKpiScore: number; // out of 100
  weightedPointsEarned: number;
  weightedPointsPossible: number;
  averageQualityRating: number;
  reworkCount: number;
  dailyReportsSubmitted: number;
  grade: "A+ (Exemplary)" | "A (Strong)" | "B (Satisfactory)" | "C (Needs Coaching)" | "D (Management Review)";
  recommendation: "Recognition & Bonus Eligible" | "Standard Progression" | "Targeted Training" | "MD / HR Performance Review";
}

let schemaInitialized = false;

export function getPriorityWeight(priority: TaskPriority): number {
  switch (priority) {
    case "CRITICAL":
      return 3.0;
    case "HIGH":
      return 2.0;
    case "MEDIUM":
      return 1.5;
    case "LOW":
    default:
      return 1.0;
  }
}

export function computeLiveEscalation(
  deadlineIso: string,
  status: TaskStatus,
  priority: TaskPriority,
  reminderHours = 2,
  deptHeadHours = 1,
  cmoHours = 24
): {
  isOverdue: boolean;
  overdueHours: number;
  hoursUntilDeadline: number;
  computedEscalation: EscalationStage;
} {
  if (status === "VERIFIED_COMPLETED" || status === "CANCELLED") {
    return {
      isOverdue: false,
      overdueHours: 0,
      hoursUntilDeadline: 0,
      computedEscalation: "NONE",
    };
  }

  const now = Date.now();
  const deadlineMs = new Date(deadlineIso).getTime();
  const diffHours = (deadlineMs - now) / (1000 * 60 * 60);

  if (diffHours >= 0) {
    return {
      isOverdue: false,
      overdueHours: 0,
      hoursUntilDeadline: Number(diffHours.toFixed(1)),
      computedEscalation: diffHours <= reminderHours ? "REMINDER_2H" : "NONE",
    };
  }

  const overdueHrs = Math.abs(diffHours);
  let stage: EscalationStage = "OVERDUE_FLAG";
  if (priority === "CRITICAL") {
    stage = "MD_CRITICAL_ALERT";
  } else if (overdueHrs >= cmoHours) {
    stage = "CMO_24H";
  } else if (overdueHrs >= deptHeadHours) {
    stage = "DEPT_HEAD_1H";
  }

  return {
    isOverdue: true,
    overdueHours: Number(overdueHrs.toFixed(1)),
    hoursUntilDeadline: Number(diffHours.toFixed(1)),
    computedEscalation: stage,
  };
}

export async function ensureTasksSchema(): Promise<void> {
  if (schemaInitialized) return;
  const pool = getConnectPool();

  await pool.query(`
    CREATE TABLE IF NOT EXISTS connect_tasks (
      id UUID PRIMARY KEY,
      task_code TEXT UNIQUE NOT NULL,
      company_name TEXT NOT NULL DEFAULT 'Mariners',
      department TEXT NOT NULL DEFAULT 'General',
      project_name TEXT NOT NULL DEFAULT 'General Operations',
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      assigned_to_id TEXT NOT NULL,
      assigned_to_name TEXT NOT NULL,
      assigned_to_designation TEXT NOT NULL DEFAULT 'Executive',
      collaborators JSONB NOT NULL DEFAULT '[]'::jsonb,
      assigned_by_id TEXT NOT NULL,
      assigned_by_name TEXT NOT NULL,
      assigned_by_role TEXT NOT NULL DEFAULT 'Department Head',
      reporting_to_id TEXT NOT NULL,
      reporting_to_name TEXT NOT NULL,
      start_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      original_deadline TIMESTAMPTZ NOT NULL,
      deadline TIMESTAMPTZ NOT NULL,
      priority TEXT NOT NULL DEFAULT 'MEDIUM',
      status TEXT NOT NULL DEFAULT 'NOT_STARTED',
      progress_percent INT NOT NULL DEFAULT 0,
      verification_required BOOLEAN NOT NULL DEFAULT TRUE,
      recurring_type TEXT NOT NULL DEFAULT 'ONE_TIME',
      attachment_name TEXT,
      attachment_url TEXT,
      evidence_name TEXT,
      evidence_url TEXT,
      staff_remarks TEXT,
      blocker_reason TEXT,
      blocked_by_department TEXT,
      blocked_by_person TEXT,
      blocker_verified BOOLEAN NOT NULL DEFAULT FALSE,
      requires_md_decision BOOLEAN NOT NULL DEFAULT FALSE,
      md_decision_note TEXT,
      quality_rating INT,
      supervisor_feedback TEXT,
      rework_count INT NOT NULL DEFAULT 0,
      escalation_stage TEXT NOT NULL DEFAULT 'NONE',
      nudge_count INT NOT NULL DEFAULT 0,
      last_nudged_at TIMESTAMPTZ,
      submitted_at TIMESTAMPTZ,
      completed_at TIMESTAMPTZ,
      verified_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS connect_task_logs (
      id UUID PRIMARY KEY,
      task_id UUID NOT NULL,
      actor_id TEXT NOT NULL,
      actor_name TEXT NOT NULL,
      actor_role TEXT NOT NULL DEFAULT 'Staff',
      action_type TEXT NOT NULL,
      previous_status TEXT,
      new_status TEXT,
      progress_percent INT,
      remarks TEXT,
      attachment_name TEXT,
      attachment_url TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS connect_task_audit_logs (
      id UUID PRIMARY KEY,
      task_id UUID NOT NULL,
      task_code TEXT NOT NULL,
      actor_id TEXT NOT NULL,
      actor_name TEXT NOT NULL,
      actor_role TEXT NOT NULL,
      audit_action TEXT NOT NULL,
      field_changed TEXT NOT NULL,
      old_value TEXT,
      new_value TEXT,
      reason TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS connect_task_extension_requests (
      id UUID PRIMARY KEY,
      task_id UUID NOT NULL,
      task_code TEXT NOT NULL,
      requested_by_id TEXT NOT NULL,
      requested_by_name TEXT NOT NULL,
      current_deadline TIMESTAMPTZ NOT NULL,
      proposed_deadline TIMESTAMPTZ NOT NULL,
      reason TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'PENDING',
      reviewed_by_name TEXT,
      review_remarks TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS connect_task_recurring_templates (
      id UUID PRIMARY KEY,
      template_code TEXT UNIQUE NOT NULL,
      company_name TEXT NOT NULL,
      department TEXT NOT NULL,
      project_name TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      assigned_to_id TEXT NOT NULL,
      assigned_to_name TEXT NOT NULL,
      reporting_to_name TEXT NOT NULL,
      priority TEXT NOT NULL DEFAULT 'MEDIUM',
      frequency TEXT NOT NULL DEFAULT 'DAILY',
      schedule_label TEXT NOT NULL,
      due_offset_hours INT NOT NULL DEFAULT 8,
      verification_required BOOLEAN NOT NULL DEFAULT TRUE,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      last_generated_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS connect_daily_work_reports (
      id UUID PRIMARY KEY,
      report_date DATE NOT NULL DEFAULT CURRENT_DATE,
      employee_id TEXT NOT NULL,
      employee_name TEXT NOT NULL,
      company_name TEXT NOT NULL,
      department TEXT NOT NULL,
      designation TEXT NOT NULL DEFAULT 'Executive',
      tasks_worked_count INT NOT NULL DEFAULT 0,
      tasks_completed_count INT NOT NULL DEFAULT 0,
      tasks_blocked_count INT NOT NULL DEFAULT 0,
      hours_logged NUMERIC(4,1) NOT NULL DEFAULT 8.0,
      summary_notes TEXT NOT NULL,
      achievements TEXT,
      blockers_reported TEXT,
      next_day_plan TEXT,
      on_approved_leave BOOLEAN NOT NULL DEFAULT FALSE,
      submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      supervisor_acknowledged BOOLEAN NOT NULL DEFAULT FALSE
    );

    CREATE TABLE IF NOT EXISTS connect_task_settings (
      id TEXT PRIMARY KEY DEFAULT 'global',
      reminder_before_deadline_hours INT NOT NULL DEFAULT 2,
      dept_head_overdue_alert_hours INT NOT NULL DEFAULT 1,
      cmo_overdue_alert_hours INT NOT NULL DEFAULT 24,
      critical_task_immediate_md_alert BOOLEAN NOT NULL DEFAULT TRUE,
      require_verification_for_completion BOOLEAN NOT NULL DEFAULT TRUE,
      cmo_can_approve_tasks BOOLEAN NOT NULL DEFAULT FALSE,
      cmo_can_change_deadlines BOOLEAN NOT NULL DEFAULT FALSE,
      cmo_can_send_nudges BOOLEAN NOT NULL DEFAULT TRUE,
      cmo_can_escalate_to_md BOOLEAN NOT NULL DEFAULT TRUE,
      kpi_weight_deadline INT NOT NULL DEFAULT 40,
      kpi_weight_quality INT NOT NULL DEFAULT 30,
      kpi_weight_importance INT NOT NULL DEFAULT 20,
      kpi_weight_reporting INT NOT NULL DEFAULT 10,
      priority_multiplier_critical NUMERIC(3,1) NOT NULL DEFAULT 3.0,
      priority_multiplier_high NUMERIC(3,1) NOT NULL DEFAULT 2.0,
      priority_multiplier_medium NUMERIC(3,1) NOT NULL DEFAULT 1.5,
      priority_multiplier_low NUMERIC(3,1) NOT NULL DEFAULT 1.0,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  // Ensure settings row exists
  await pool.query(`
    INSERT INTO connect_task_settings (id)
    VALUES ('global')
    ON CONFLICT (id) DO NOTHING;
  `);

  // Check if seed tasks exist
  const countRes = await pool.query(`SELECT COUNT(*)::int AS cnt FROM connect_tasks`);
  const count = countRes.rows[0]?.cnt ?? 0;

  if (count === 0) {
    await seedInitialTaskEcosystem();
  }

  schemaInitialized = true;
}

async function seedInitialTaskEcosystem(): Promise<void> {
  const pool = getConnectPool();
  const now = new Date();
  const hoursFromNow = (h: number) => new Date(now.getTime() + h * 3600 * 1000).toISOString();

  const sampleTasks = [
    {
      id: "11111111-2222-4333-8444-000000000001",
      taskCode: "LEGAL-2026-001",
      companyName: "MOHS",
      department: "Legal",
      projectName: "MOHS Venice City Township",
      title: "Prepare Client Investment Deed",
      description:
        "Draft and vet the tripartite client investment deed for Plot Sector-B commercial investors, including stamp duty schedule, arbitration clause, and land schedule verification.",
      assignedToId: "emp-legal-01",
      assignedToName: "Adv. Rafiqul Islam",
      assignedToDesignation: "Senior Legal Counsel",
      collaborators: JSON.stringify([
        { id: "emp-acc-01", name: "Nusrat Jahan", department: "Accounts" },
        { id: "emp-sales-01", name: "Tanvir Ahmed", department: "Sales" },
      ]),
      assignedById: "emp-md-01",
      assignedByName: "Managing Director",
      assignedByRole: "Managing Director",
      reportingToId: "emp-legal-head",
      reportingToName: "Barrister Kamal Hossain (Head of Legal)",
      startDate: hoursFromNow(-6),
      originalDeadline: hoursFromNow(1.8),
      deadline: hoursFromNow(1.8), // Within 2h window -> triggers 2h Reminder
      priority: "HIGH",
      status: "IN_PROGRESS",
      progressPercent: 60,
      verificationRequired: true,
      recurringType: "ONE_TIME",
      attachmentName: "Investment_Deed_Policy_2026.pdf",
      attachmentUrl: "/connect/docs",
      evidenceName: null,
      evidenceUrl: null,
      staffRemarks:
        "Completed schedule-A property verification and indemnity clauses (60%). Waiting on final investor TIN/NID annexure from Sales before submitting for approval.",
      blockerReason: null,
      blockedByDepartment: null,
      blockedByPerson: null,
      blockerVerified: false,
      requiresMdDecision: false,
      mdDecisionNote: null,
      qualityRating: null,
      supervisorFeedback: null,
      reworkCount: 0,
      escalationStage: "REMINDER_2H",
      nudgeCount: 1,
      lastNudgedAt: hoursFromNow(-0.5),
      submittedAt: null,
      completedAt: null,
      verifiedAt: null,
    },
    {
      id: "11111111-2222-4333-8444-000000000002",
      taskCode: "ACCOUNTS-2026-002",
      companyName: "Mariners",
      department: "Accounts",
      projectName: "FY2026 Statutory Tax & Audit",
      title: "Reconcile Monthly Bank Ledger & VAT Mushak-9.1 Return",
      description:
        "Complete multi-bank treasury reconciliation across all 6 corporate accounts and prepare the verified Mushak-9.1 treasury challan summary for CFO & MD sign-off.",
      assignedToId: "emp-acc-01",
      assignedToName: "Nusrat Jahan",
      assignedToDesignation: "Senior Manager, Accounts",
      collaborators: JSON.stringify([{ id: "emp-acc-02", name: "Sajid Hasan", department: "Accounts" }]),
      assignedById: "emp-cfo-01",
      assignedByName: "Shafiqur Rahman (CFO)",
      assignedByRole: "Department Head",
      reportingToId: "emp-cfo-01",
      reportingToName: "Shafiqur Rahman (CFO)",
      startDate: hoursFromNow(-28),
      originalDeadline: hoursFromNow(-6),
      deadline: hoursFromNow(-3.5), // Overdue Critical Task -> MD Alert
      priority: "CRITICAL",
      status: "IN_PROGRESS",
      progressPercent: 80,
      verificationRequired: true,
      recurringType: "MONTHLY",
      attachmentName: "Bank_Ledger_Mushak_Checklist.xlsx",
      attachmentUrl: "/connect/docs",
      evidenceName: null,
      evidenceUrl: null,
      staffRemarks: "5 out of 6 bank statements reconciled. Finalizing LC margin adjustment entries.",
      blockerReason: null,
      blockedByDepartment: null,
      blockedByPerson: null,
      blockerVerified: false,
      requiresMdDecision: false,
      mdDecisionNote: null,
      qualityRating: null,
      supervisorFeedback: null,
      reworkCount: 0,
      escalationStage: "MD_CRITICAL_ALERT",
      nudgeCount: 2,
      lastNudgedAt: hoursFromNow(-1),
      submittedAt: null,
      completedAt: null,
      verifiedAt: null,
    },
    {
      id: "11111111-2222-4333-8444-000000000003",
      taskCode: "OPS-2026-003",
      companyName: "Mariners",
      department: "Operations",
      projectName: "Mariners Fleet & Logistics",
      title: "Port Customs Clearance & LC Release for Shipment #408",
      description:
        "Coordinate with Chittagong Customs House C&F agent, verify Bill of Entry assessment, and secure container release order for heavy marine machinery.",
      assignedToId: "emp-ops-01",
      assignedToName: "Capt. Tareq Mahmud",
      assignedToDesignation: "Head of Marine Operations",
      collaborators: JSON.stringify([{ id: "emp-legal-01", name: "Adv. Rafiqul Islam", department: "Legal" }]),
      assignedById: "emp-md-01",
      assignedByName: "Managing Director",
      assignedByRole: "Managing Director",
      reportingToId: "emp-md-01",
      reportingToName: "Managing Director",
      startDate: hoursFromNow(-48),
      originalDeadline: hoursFromNow(-26),
      deadline: hoursFromNow(-26), // Overdue >24h + Critical + Blocked
      priority: "CRITICAL",
      status: "BLOCKED",
      progressPercent: 55,
      verificationRequired: true,
      recurringType: "ONE_TIME",
      attachmentName: "Bill_Of_Entry_408.pdf",
      attachmentUrl: "/connect/docs",
      evidenceName: null,
      evidenceUrl: null,
      staffRemarks: "Customs assessment completed; release held pending duty bond approval.",
      blockerReason:
        "Customs Commissioner requested an additional bank guarantee of BDT 14.5 Lakh for HS Code classification variance. Needs immediate MD authorization.",
      blockedByDepartment: "Accounts",
      blockedByPerson: "Shafiqur Rahman (CFO)",
      blockerVerified: true,
      requiresMdDecision: true,
      mdDecisionNote: null,
      qualityRating: null,
      supervisorFeedback: null,
      reworkCount: 0,
      escalationStage: "MD_CRITICAL_ALERT",
      nudgeCount: 3,
      lastNudgedAt: hoursFromNow(-2),
      submittedAt: null,
      completedAt: null,
      verifiedAt: null,
    },
    {
      id: "11111111-2222-4333-8444-000000000004",
      taskCode: "SALES-2026-004",
      companyName: "MOHS",
      department: "Sales",
      projectName: "MOHS Venice City Township",
      title: "Finalize Plot Handover Documentation for Block-C Clients",
      description:
        "Compile zero-due clearance certificates, engineering demarcation maps, and signed possession letters for 12 residential plot owners in Block-C.",
      assignedToId: "emp-sales-01",
      assignedToName: "Tanvir Ahmed",
      assignedToDesignation: "AGM, Corporate Sales",
      collaborators: JSON.stringify([]),
      assignedById: "emp-sales-head",
      assignedByName: "Mahmudul Hasan (Director Sales)",
      assignedByRole: "Department Head",
      reportingToId: "emp-sales-head",
      reportingToName: "Mahmudul Hasan (Director Sales)",
      startDate: hoursFromNow(-20),
      originalDeadline: hoursFromNow(4),
      deadline: hoursFromNow(4),
      priority: "HIGH",
      status: "SUBMITTED_FOR_APPROVAL",
      progressPercent: 100,
      verificationRequired: true,
      recurringType: "ONE_TIME",
      attachmentName: "Block_C_Allotment_Master.xlsx",
      attachmentUrl: "/connect/docs",
      evidenceName: "Signed_Plot_Handover_Dossier_12_Clients.pdf",
      evidenceUrl: "/connect/docs",
      staffRemarks:
        "All 12 client files verified with Accounts zero-due certificates and uploaded for Supervisor verification.",
      blockerReason: null,
      blockedByDepartment: null,
      blockedByPerson: null,
      blockerVerified: false,
      requiresMdDecision: false,
      mdDecisionNote: null,
      qualityRating: null,
      supervisorFeedback: null,
      reworkCount: 0,
      escalationStage: "NONE",
      nudgeCount: 0,
      lastNudgedAt: null,
      submittedAt: hoursFromNow(-1),
      completedAt: null,
      verifiedAt: null,
    },
    {
      id: "11111111-2222-4333-8444-000000000005",
      taskCode: "PROC-2026-005",
      companyName: "MOHS",
      department: "Procurement",
      projectName: "MOHS Venice City Township",
      title: "Vendor Price Negotiation for 500 MT Structural Steel Batch Q4",
      description:
        "Conduct comparative CS analysis across top 4 steel manufacturers and lock credit terms (90-day LC) within approved project budget.",
      assignedToId: "emp-proc-01",
      assignedToName: "Engr. Ashraful Alam",
      assignedToDesignation: "Procurement Manager",
      collaborators: JSON.stringify([{ id: "emp-acc-01", name: "Nusrat Jahan", department: "Accounts" }]),
      assignedById: "emp-md-01",
      assignedByName: "Managing Director",
      assignedByRole: "Managing Director",
      reportingToId: "emp-md-01",
      reportingToName: "Managing Director",
      startDate: hoursFromNow(-30),
      originalDeadline: hoursFromNow(-5),
      deadline: hoursFromNow(-5),
      priority: "CRITICAL",
      status: "BLOCKED",
      progressPercent: 85,
      verificationRequired: true,
      recurringType: "ONE_TIME",
      attachmentName: "Comparative_Statement_Steel_Q4.pdf",
      attachmentUrl: "/connect/docs",
      evidenceName: "Vendor_Final_Quotations_CS.xlsx",
      evidenceUrl: "/connect/docs",
      staffRemarks: "Comparative statement ready. Lowest bidder quoted BDT 94,500/MT vs budgeted BDT 92,000/MT.",
      blockerReason:
        "Market raw billet price surged by 2.7%. Requires MD executive decision to either approve revised rate ceiling (BDT 94,500/MT) or split order 50/50.",
      blockedByDepartment: "Management",
      blockedByPerson: "Managing Director",
      blockerVerified: true,
      requiresMdDecision: true,
      mdDecisionNote: null,
      qualityRating: null,
      supervisorFeedback: null,
      reworkCount: 0,
      escalationStage: "MD_CRITICAL_ALERT",
      nudgeCount: 1,
      lastNudgedAt: hoursFromNow(-2),
      submittedAt: null,
      completedAt: null,
      verifiedAt: null,
    },
    {
      id: "11111111-2222-4333-8444-000000000006",
      taskCode: "ACCOUNTS-2026-006",
      companyName: "Marinozz",
      department: "Accounts",
      projectName: "Marinozz Retail Expansion",
      title: "Disburse Supplier Payment Batch #19 & Upload RTGS Advice",
      description:
        "Process approved vendor bills for Marinozz flagship outlets, verify VDS/AIT deductions, and upload stamped bank RTGS confirmation.",
      assignedToId: "emp-acc-02",
      assignedToName: "Sajid Hasan",
      assignedToDesignation: "Accounts Executive",
      collaborators: JSON.stringify([]),
      assignedById: "emp-cfo-01",
      assignedByName: "Shafiqur Rahman (CFO)",
      assignedByRole: "Department Head",
      reportingToId: "emp-cfo-01",
      reportingToName: "Shafiqur Rahman (CFO)",
      startDate: hoursFromNow(-10),
      originalDeadline: hoursFromNow(-2),
      deadline: hoursFromNow(-2),
      priority: "HIGH",
      status: "VERIFIED_COMPLETED",
      progressPercent: 100,
      verificationRequired: true,
      recurringType: "WEEKLY",
      attachmentName: "Supplier_Payment_Schedule_19.xlsx",
      attachmentUrl: "/connect/docs",
      evidenceName: "RTGS_Bank_Advice_Batch19_Verified.pdf",
      evidenceUrl: "/connect/docs",
      staffRemarks: "All 14 supplier RTGS transfers executed and treasury challans archived.",
      blockerReason: null,
      blockedByDepartment: null,
      blockedByPerson: null,
      blockerVerified: false,
      requiresMdDecision: false,
      mdDecisionNote: null,
      qualityRating: 5,
      supervisorFeedback: "Verified all 14 RTGS vouchers and tax deductions with zero discrepancy.",
      reworkCount: 0,
      escalationStage: "NONE",
      nudgeCount: 0,
      lastNudgedAt: null,
      submittedAt: hoursFromNow(-3.5),
      completedAt: hoursFromNow(-3),
      verifiedAt: hoursFromNow(-2.5),
    },
    {
      id: "11111111-2222-4333-8444-000000000007",
      taskCode: "HR-2026-007",
      companyName: "Marinozz",
      department: "HR",
      projectName: "Marinozz Retail Expansion",
      title: "Daily Biometric Attendance & Shift Roster Verification",
      description:
        "Audit morning attendance across Head Office and 4 retail outlets, reconcile approved leave applications, and publish late-arrival summary.",
      assignedToId: "emp-hr-01",
      assignedToName: "Sabrina Karim",
      assignedToDesignation: "HR & Admin Manager",
      collaborators: JSON.stringify([]),
      assignedById: "emp-md-01",
      assignedByName: "Managing Director",
      assignedByRole: "Managing Director",
      reportingToId: "emp-md-01",
      reportingToName: "Managing Director",
      startDate: hoursFromNow(-8),
      originalDeadline: hoursFromNow(-1),
      deadline: hoursFromNow(-1),
      priority: "MEDIUM",
      status: "VERIFIED_COMPLETED",
      progressPercent: 100,
      verificationRequired: true,
      recurringType: "DAILY",
      attachmentName: "Roster_Policy_2026.pdf",
      attachmentUrl: "/connect/docs",
      evidenceName: "Biometric_Attendance_Summary_Today.pdf",
      evidenceUrl: "/connect/docs",
      staffRemarks: "98.4% on-time attendance recorded today; 2 approved medical leaves logged in HRM.",
      blockerReason: null,
      blockedByDepartment: null,
      blockedByPerson: null,
      blockerVerified: false,
      requiresMdDecision: false,
      mdDecisionNote: null,
      qualityRating: 5,
      supervisorFeedback: "Prompt and accurate daily reporting before 11:00 AM.",
      reworkCount: 0,
      escalationStage: "NONE",
      nudgeCount: 0,
      lastNudgedAt: null,
      submittedAt: hoursFromNow(-2),
      completedAt: hoursFromNow(-1.5),
      verifiedAt: hoursFromNow(-1.2),
    },
    {
      id: "11111111-2222-4333-8444-000000000008",
      taskCode: "IT-2026-008",
      companyName: "Mariners",
      department: "IT",
      projectName: "Group Corporate Legal & Compliance",
      title: "ERP Cloud Database Snapshot & DR Integrity Verification",
      description:
        "Verify automated PostgreSQL WAL replication, test point-in-time recovery checksums, and archive encrypted offsite backup logs.",
      assignedToId: "emp-it-01",
      assignedToName: "Mehedi Hasan",
      assignedToDesignation: "Lead Systems Engineer",
      collaborators: JSON.stringify([]),
      assignedById: "emp-cmo-01",
      assignedByName: "Central Monitoring Officer",
      assignedByRole: "Central Monitoring",
      reportingToId: "emp-cmo-01",
      reportingToName: "Central Monitoring Officer",
      startDate: hoursFromNow(-12),
      originalDeadline: hoursFromNow(3),
      deadline: hoursFromNow(3),
      priority: "HIGH",
      status: "SUBMITTED_FOR_APPROVAL",
      progressPercent: 100,
      verificationRequired: true,
      recurringType: "DAILY",
      attachmentName: "DR_SOP_Checklist.pdf",
      attachmentUrl: "/connect/docs",
      evidenceName: "PG_Snapshot_SHA256_Verification.log",
      evidenceUrl: "/connect/docs",
      staffRemarks: "All 3 company database schemas backed up and SHA-256 verified in 42 seconds.",
      blockerReason: null,
      blockedByDepartment: null,
      blockedByPerson: null,
      blockerVerified: false,
      requiresMdDecision: false,
      mdDecisionNote: null,
      qualityRating: null,
      supervisorFeedback: null,
      reworkCount: 0,
      escalationStage: "NONE",
      nudgeCount: 0,
      lastNudgedAt: null,
      submittedAt: hoursFromNow(-0.5),
      completedAt: null,
      verifiedAt: null,
    },
    {
      id: "11111111-2222-4333-8444-000000000009",
      taskCode: "SALES-2026-009",
      companyName: "Marinozz",
      department: "Sales",
      projectName: "Marinozz Retail Expansion",
      title: "Flagship Showroom Inventory & Visual Merchandising Audit",
      description:
        "Complete SKU-level physical stock count at Banani & Gulshan outlets and submit display compliance photos.",
      assignedToId: "emp-sales-02",
      assignedToName: "Farhana Yeasmin",
      assignedToDesignation: "Retail Operations Executive",
      collaborators: JSON.stringify([]),
      assignedById: "emp-sales-head",
      assignedByName: "Mahmudul Hasan (Director Sales)",
      assignedByRole: "Department Head",
      reportingToId: "emp-sales-head",
      reportingToName: "Mahmudul Hasan (Director Sales)",
      startDate: hoursFromNow(-18),
      originalDeadline: hoursFromNow(-4.5),
      deadline: hoursFromNow(-4.5), // Overdue >1h -> Dept Head Alert
      priority: "MEDIUM",
      status: "IN_PROGRESS",
      progressPercent: 45,
      verificationRequired: true,
      recurringType: "WEEKLY",
      attachmentName: "Showroom_Audit_Template.pdf",
      attachmentUrl: "/connect/docs",
      evidenceName: null,
      evidenceUrl: null,
      staffRemarks: "Banani outlet completed; currently auditing Gulshan outlet POS stock variance.",
      blockerReason: null,
      blockedByDepartment: null,
      blockedByPerson: null,
      blockerVerified: false,
      requiresMdDecision: false,
      mdDecisionNote: null,
      qualityRating: null,
      supervisorFeedback: null,
      reworkCount: 1,
      escalationStage: "DEPT_HEAD_1H",
      nudgeCount: 1,
      lastNudgedAt: hoursFromNow(-1.5),
      submittedAt: null,
      completedAt: null,
      verifiedAt: null,
    },
    {
      id: "11111111-2222-4333-8444-000000000010",
      taskCode: "LEGAL-2026-010",
      companyName: "MOHS",
      department: "Legal",
      projectName: "MOHS Venice City Township",
      title: "Sub-Registry Mutation & Land Tax Clearance for Sector-A2",
      description:
        "Complete Dakhila verification, mutation khatian indexing, and upload certified scan copies to the Legal Repository.",
      assignedToId: "emp-legal-01",
      assignedToName: "Adv. Rafiqul Islam",
      assignedToDesignation: "Senior Legal Counsel",
      collaborators: JSON.stringify([]),
      assignedById: "emp-legal-head",
      assignedByName: "Barrister Kamal Hossain (Head of Legal)",
      assignedByRole: "Department Head",
      reportingToId: "emp-legal-head",
      reportingToName: "Barrister Kamal Hossain (Head of Legal)",
      startDate: hoursFromNow(-24),
      originalDeadline: hoursFromNow(-3),
      deadline: hoursFromNow(-3),
      priority: "CRITICAL",
      status: "VERIFIED_COMPLETED",
      progressPercent: 100,
      verificationRequired: true,
      recurringType: "ONE_TIME",
      attachmentName: "Sector_A2_Khatian_Index.pdf",
      attachmentUrl: "/connect/docs",
      evidenceName: "Certified_Mutation_Dakhila_A2.pdf",
      evidenceUrl: "/connect/docs",
      staffRemarks: "Mutation khatian and online LD tax receipt verified and uploaded.",
      blockerReason: null,
      blockedByDepartment: null,
      blockedByPerson: null,
      blockerVerified: false,
      requiresMdDecision: false,
      mdDecisionNote: null,
      qualityRating: 5,
      supervisorFeedback: "Critical land documentation completed ahead of board review.",
      reworkCount: 0,
      escalationStage: "NONE",
      nudgeCount: 0,
      lastNudgedAt: null,
      submittedAt: hoursFromNow(-5),
      completedAt: hoursFromNow(-4.5),
      verifiedAt: hoursFromNow(-4),
    },
  ];

  for (const t of sampleTasks) {
    await pool.query(
      `
      INSERT INTO connect_tasks (
        id, task_code, company_name, department, project_name, title, description,
        assigned_to_id, assigned_to_name, assigned_to_designation, collaborators,
        assigned_by_id, assigned_by_name, assigned_by_role, reporting_to_id, reporting_to_name,
        start_date, original_deadline, deadline, priority, status, progress_percent,
        verification_required, recurring_type, attachment_name, attachment_url,
        evidence_name, evidence_url, staff_remarks, blocker_reason, blocked_by_department,
        blocked_by_person, blocker_verified, requires_md_decision, md_decision_note,
        quality_rating, supervisor_feedback, rework_count, escalation_stage,
        nudge_count, last_nudged_at, submitted_at, completed_at, verified_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7,
        $8, $9, $10, $11::jsonb,
        $12, $13, $14, $15, $16,
        $17, $18, $19, $20, $21, $22,
        $23, $24, $25, $26,
        $27, $28, $29, $30, $31,
        $32, $33, $34, $35,
        $36, $37, $38, $39,
        $40, $41, $42, $43, $44
      ) ON CONFLICT (task_code) DO NOTHING
      `,
      [
        t.id,
        t.taskCode,
        t.companyName,
        t.department,
        t.projectName,
        t.title,
        t.description,
        t.assignedToId,
        t.assignedToName,
        t.assignedToDesignation,
        t.collaborators,
        t.assignedById,
        t.assignedByName,
        t.assignedByRole,
        t.reportingToId,
        t.reportingToName,
        t.startDate,
        t.originalDeadline,
        t.deadline,
        t.priority,
        t.status,
        t.progressPercent,
        t.verificationRequired,
        t.recurringType,
        t.attachmentName,
        t.attachmentUrl,
        t.evidenceName,
        t.evidenceUrl,
        t.staffRemarks,
        t.blockerReason,
        t.blockedByDepartment,
        t.blockedByPerson,
        t.blockerVerified,
        t.requiresMdDecision,
        t.mdDecisionNote,
        t.qualityRating,
        t.supervisorFeedback,
        t.reworkCount,
        t.escalationStage,
        t.nudgeCount,
        t.lastNudgedAt,
        t.submittedAt,
        t.completedAt,
        t.verifiedAt,
      ]
    );
  }

  // Seed Task Progress Logs
  await pool.query(
    `
    INSERT INTO connect_task_logs (id, task_id, actor_id, actor_name, actor_role, action_type, previous_status, new_status, progress_percent, remarks, created_at)
    VALUES
      ('22222222-2222-4333-8444-000000000001', '11111111-2222-4333-8444-000000000001', 'emp-md-01', 'Managing Director', 'Managing Director', 'TASK_ASSIGNED', NULL, 'NOT_STARTED', 0, 'Assigned high-priority Client Investment Deed drafting to Legal.', $1),
      ('22222222-2222-4333-8444-000000000002', '11111111-2222-4333-8444-000000000001', 'emp-legal-01', 'Adv. Rafiqul Islam', 'Senior Legal Counsel', 'PROGRESS_UPDATE', 'NOT_STARTED', 'IN_PROGRESS', 60, 'Completed property schedule-A verification and arbitration clauses. Coordinating with Sales for investor NID annexure.', $2),
      ('22222222-2222-4333-8444-000000000003', '11111111-2222-4333-8444-000000000003', 'emp-ops-01', 'Capt. Tareq Mahmud', 'Head of Marine Operations', 'BLOCKER_REPORTED', 'IN_PROGRESS', 'BLOCKED', 55, 'Escalated HS Code customs bank guarantee requirement (BDT 14.5L) for MD decision.', $3),
      ('22222222-2222-4333-8444-000000000004', '11111111-2222-4333-8444-000000000004', 'emp-sales-01', 'Tanvir Ahmed', 'AGM, Corporate Sales', 'SUBMITTED_FOR_APPROVAL', 'IN_PROGRESS', 'SUBMITTED_FOR_APPROVAL', 100, 'Uploaded Signed_Plot_Handover_Dossier_12_Clients.pdf for Director Sales verification.', $4)
    ON CONFLICT (id) DO NOTHING
    `,
    [hoursFromNow(-6), hoursFromNow(-2), hoursFromNow(-4), hoursFromNow(-1)]
  );

  // Seed Immutable Audit Logs (Section 10: Task Delete/Cancel, Deadline Change, Assignment Change)
  await pool.query(
    `
    INSERT INTO connect_task_audit_logs (id, task_id, task_code, actor_id, actor_name, actor_role, audit_action, field_changed, old_value, new_value, reason, created_at)
    VALUES
      ('33333333-2222-4333-8444-000000000001', '11111111-2222-4333-8444-000000000002', 'ACCOUNTS-2026-002', 'emp-cfo-01', 'Shafiqur Rahman (CFO)', 'Department Head', 'DEADLINE_CHANGE', 'deadline', $1, $2, 'Extended by 2.5 hours due to Bangladesh Bank RTGS settlement maintenance window.', $3),
      ('33333333-2222-4333-8444-000000000002', '11111111-2222-4333-8444-000000000001', 'LEGAL-2026-001', 'emp-legal-head', 'Barrister Kamal Hossain', 'Department Head', 'ASSIGNMENT_CHANGE', 'collaborators', 'None', 'Nusrat Jahan (Accounts), Tanvir Ahmed (Sales)', 'Added Accounts & Sales collaborators for tripartite schedule verification.', $4),
      ('33333333-2222-4333-8444-000000000003', '11111111-2222-4333-8444-000000000003', 'OPS-2026-003', 'emp-cmo-01', 'Central Monitoring Officer', 'Central Monitoring', 'MD_DECISION_LOGGED', 'requires_md_decision', 'false', 'true', 'Escalated Shipment #408 customs bank guarantee blocker to MD Golden Report #3.', $5)
    ON CONFLICT (id) DO NOTHING
    `,
    [hoursFromNow(-6), hoursFromNow(-3.5), hoursFromNow(-5), hoursFromNow(-4.5), hoursFromNow(-2)]
  );

  // Seed Extension Request
  await pool.query(
    `
    INSERT INTO connect_task_extension_requests (id, task_id, task_code, requested_by_id, requested_by_name, current_deadline, proposed_deadline, reason, status, created_at)
    VALUES
      ('44444444-2222-4333-8444-000000000001', '11111111-2222-4333-8444-000000000002', 'ACCOUNTS-2026-002', 'emp-acc-01', 'Nusrat Jahan', $1, $2, 'Awaiting final LC margin debit advice from Eastern Bank Corporate Branch.', 'PENDING', $3)
    ON CONFLICT (id) DO NOTHING
    `,
    [hoursFromNow(-3.5), hoursFromNow(3), hoursFromNow(-1)]
  );

  // Seed Recurring Task Templates (Daily / Weekly / Monthly)
  await pool.query(
    `
    INSERT INTO connect_task_recurring_templates (
      id, template_code, company_name, department, project_name, title, description,
      assigned_to_id, assigned_to_name, reporting_to_name, priority, frequency,
      schedule_label, due_offset_hours, verification_required, is_active, last_generated_at
    ) VALUES
      ('55555555-2222-4333-8444-000000000001', 'REC-DAILY-001', 'Mariners', 'Accounts', 'Group Treasury Operations', 'Daily Cashbook & Bank Position Summary for MD', 'Compile opening/closing balances across all Mariners, MOHS, and Marinozz bank accounts and submit daily liquidity sheet.', 'emp-acc-01', 'Nusrat Jahan', 'Shafiqur Rahman (CFO)', 'HIGH', 'DAILY', 'Every Working Day at 9:30 AM (Deadline 11:30 AM)', 2, TRUE, TRUE, $1),
      ('55555555-2222-4333-8444-000000000002', 'REC-DAILY-002', 'Marinozz', 'HR', 'Marinozz Retail Expansion', 'Daily Biometric Attendance & Shift Roster Verification', 'Audit morning attendance across Head Office and retail outlets and reconcile leave records.', 'emp-hr-01', 'Sabrina Karim', 'Managing Director', 'MEDIUM', 'DAILY', 'Every Working Day at 9:15 AM (Deadline 10:30 AM)', 2, TRUE, TRUE, $1),
      ('55555555-2222-4333-8444-000000000003', 'REC-WEEKLY-001', 'MOHS', 'Sales', 'MOHS Venice City Township', 'Weekly Client Booking, Collection & Plot Handover Pipeline Report', 'Summarize weekly plot bookings, down-payment collections, and installment overdue recovery.', 'emp-sales-01', 'Tanvir Ahmed', 'Mahmudul Hasan (Director Sales)', 'HIGH', 'WEEKLY', 'Every Thursday at 10:00 AM (Deadline 5:00 PM)', 7, TRUE, TRUE, $1),
      ('55555555-2222-4333-8444-000000000004', 'REC-MONTHLY-001', 'Mariners', 'Accounts', 'FY2026 Statutory Tax & Audit', 'Monthly VAT Mushak-9.1 & Withholding Tax Return Filing', 'Prepare and verify monthly statutory VAT & AIT returns with treasury challans across all units.', 'emp-acc-01', 'Nusrat Jahan', 'Shafiqur Rahman (CFO)', 'CRITICAL', 'MONTHLY', '1st Working Day of Month (Deadline 10th of Month)', 72, TRUE, TRUE, $1)
    ON CONFLICT (template_code) DO NOTHING
    `,
    [hoursFromNow(-8)]
  );

  // Seed Daily Work Reports
  await pool.query(
    `
    INSERT INTO connect_daily_work_reports (
      id, report_date, employee_id, employee_name, company_name, department, designation,
      tasks_worked_count, tasks_completed_count, tasks_blocked_count, hours_logged,
      summary_notes, achievements, blockers_reported, next_day_plan, on_approved_leave, supervisor_acknowledged
    ) VALUES
      ('66666666-2222-4333-8444-000000000001', CURRENT_DATE, 'emp-legal-01', 'Adv. Rafiqul Islam', 'MOHS', 'Legal', 'Senior Legal Counsel', 2, 1, 0, 8.5, 'Completed Sector-A2 Sub-Registry Mutation verification and reached 60% progress on Client Investment Deed (LEGAL-2026-001).', 'Certified Mutation Dakhila A2 verified (5/5 quality rating).', 'Waiting for investor NID annexure from Sales team.', 'Submit LEGAL-2026-001 for final approval by 4:00 PM.', FALSE, TRUE),
      ('66666666-2222-4333-8444-000000000002', CURRENT_DATE, 'emp-acc-01', 'Nusrat Jahan', 'Mariners', 'Accounts', 'Senior Manager, Accounts', 2, 0, 0, 9.0, 'Reconciled 5 corporate bank ledgers and reviewed steel procurement LC costings.', 'Completed 80% of monthly bank reconciliation.', 'Awaiting Eastern Bank LC debit advice.', 'Finalize Mushak-9.1 return and submit for CFO verification.', FALSE, TRUE),
      ('66666666-2222-4333-8444-000000000003', CURRENT_DATE, 'emp-sales-01', 'Tanvir Ahmed', 'MOHS', 'Sales', 'AGM, Corporate Sales', 2, 1, 0, 8.0, 'Compiled and submitted all 12 Block-C plot handover dossiers for supervisor approval.', '100% completion of SALES-2026-004 ahead of deadline.', 'None', 'Follow up on Investor NID annexure for Legal.', FALSE, TRUE),
      ('66666666-2222-4333-8444-000000000004', CURRENT_DATE, 'emp-ops-01', 'Capt. Tareq Mahmud', 'Mariners', 'Operations', 'Head of Marine Operations', 1, 0, 1, 8.5, 'Completed Chittagong Customs assessment for Shipment #408; logged verified blocker for HS code bank guarantee.', 'Customs assessment completed without penalty.', 'Requires MD decision on BDT 14.5L bank guarantee (Verified Blocker — KPI protected).', 'Execute container release immediately upon bank guarantee issuance.', FALSE, TRUE),
      ('66666666-2222-4333-8444-000000000005', CURRENT_DATE, 'emp-acc-02', 'Sajid Hasan', 'Marinozz', 'Accounts', 'Accounts Executive', 1, 1, 0, 8.0, 'Executed Supplier Payment Batch #19 across 14 vendors and uploaded stamped RTGS bank advice.', 'Verified Completed with 5-star quality rating.', 'None', 'Prepare Marinozz outlet petty cash reconciliation.', FALSE, TRUE),
      ('66666666-2222-4333-8444-000000000006', CURRENT_DATE, 'emp-hr-01', 'Sabrina Karim', 'Marinozz', 'HR', 'HR & Admin Manager', 1, 1, 0, 8.0, 'Verified biometric attendance across all offices and updated HRM leave ledger.', 'Daily attendance report verified before 11:00 AM.', 'None', 'Conduct onboarding orientation for 3 new sales executives.', FALSE, TRUE)
    ON CONFLICT (id) DO NOTHING
    `
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapTaskRow(row: any): ConnectTaskRecord {
  const priority = (row.priority || "MEDIUM") as TaskPriority;
  const status = (row.status || "NOT_STARTED") as TaskStatus;
  const deadlineIso =
    row.deadline instanceof Date ? row.deadline.toISOString() : String(row.deadline || new Date().toISOString());
  const origDeadlineIso =
    row.original_deadline instanceof Date
      ? row.original_deadline.toISOString()
      : String(row.original_deadline || deadlineIso);
  const startIso =
    row.start_date instanceof Date ? row.start_date.toISOString() : String(row.start_date || new Date().toISOString());

  const live = computeLiveEscalation(deadlineIso, status, priority);

  let parsedCollaborators: TaskCollaborator[] = [];
  if (Array.isArray(row.collaborators)) {
    parsedCollaborators = row.collaborators;
  } else if (typeof row.collaborators === "string") {
    try {
      parsedCollaborators = JSON.parse(row.collaborators);
    } catch {
      parsedCollaborators = [];
    }
  }

  return {
    id: String(row.id),
    taskCode: String(row.task_code),
    companyName: String(row.company_name || "Mariners"),
    department: String(row.department || "General"),
    projectName: String(row.project_name || "General Operations"),
    title: String(row.title),
    description: String(row.description || ""),
    assignedToId: String(row.assigned_to_id),
    assignedToName: String(row.assigned_to_name),
    assignedToDesignation: String(row.assigned_to_designation || "Executive"),
    collaborators: parsedCollaborators,
    assignedById: String(row.assigned_by_id),
    assignedByName: String(row.assigned_by_name),
    assignedByRole: String(row.assigned_by_role || "Department Head"),
    reportingToId: String(row.reporting_to_id),
    reportingToName: String(row.reporting_to_name),
    startDate: startIso,
    originalDeadline: origDeadlineIso,
    deadline: deadlineIso,
    priority,
    status,
    progressPercent: Number(row.progress_percent ?? 0),
    verificationRequired: Boolean(row.verification_required ?? true),
    recurringType: (row.recurring_type || "ONE_TIME") as RecurringType,
    attachmentName: row.attachment_name || null,
    attachmentUrl: row.attachment_url || null,
    evidenceName: row.evidence_name || null,
    evidenceUrl: row.evidence_url || null,
    staffRemarks: row.staff_remarks || null,
    blockerReason: row.blocker_reason || null,
    blockedByDepartment: row.blocked_by_department || null,
    blockedByPerson: row.blocked_by_person || null,
    blockerVerified: Boolean(row.blocker_verified),
    requiresMdDecision: Boolean(row.requires_md_decision),
    mdDecisionNote: row.md_decision_note || null,
    qualityRating: row.quality_rating !== null && row.quality_rating !== undefined ? Number(row.quality_rating) : null,
    supervisorFeedback: row.supervisor_feedback || null,
    reworkCount: Number(row.rework_count ?? 0),
    escalationStage: (row.escalation_stage || live.computedEscalation) as EscalationStage,
    nudgeCount: Number(row.nudge_count ?? 0),
    lastNudgedAt: row.last_nudged_at ? new Date(row.last_nudged_at).toISOString() : null,
    submittedAt: row.submitted_at ? new Date(row.submitted_at).toISOString() : null,
    completedAt: row.completed_at ? new Date(row.completed_at).toISOString() : null,
    verifiedAt: row.verified_at ? new Date(row.verified_at).toISOString() : null,
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : new Date().toISOString(),
    isOverdue: live.isOverdue,
    overdueHours: live.overdueHours,
    hoursUntilDeadline: live.hoursUntilDeadline,
    computedEscalation: live.computedEscalation,
    priorityWeight: getPriorityWeight(priority),
  };
}

/**
 * 100-Point Weighted Employee KPI Calculation Engine
 * Criteria:
 *  - Deadline Compliance: 40%
 *  - Quality & Supervisor Approval: 30%
 *  - Task Importance / Achievement (Weighted by Priority: Critical=3x, High=2x, Medium=1.5x, Low=1x): 20%
 *  - Timely Reporting & Communication: 10%
 * Fairness Rules:
 *  - Approved Leave days never penalize KPI.
 *  - Verified Inter-Departmental Blockers (blockerVerified = true) excuse overdue penalties on blocked tasks.
 */
export function calculateEmployeeKpiScorecards(
  tasks: ConnectTaskRecord[],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  dailyReports: any[]
): EmployeeKpiScorecard[] {
  const byEmployee = new Map<string, ConnectTaskRecord[]>();

  for (const t of tasks) {
    if (t.status === "CANCELLED") continue;
    const key = t.assignedToName.trim();
    const list = byEmployee.get(key) || [];
    list.push(t);
    byEmployee.set(key, list);
  }

  const scorecards: EmployeeKpiScorecard[] = [];

  for (const [employeeName, empTasks] of byEmployee.entries()) {
    const first = empTasks[0];
    const empReports = dailyReports.filter(
      (r) => String(r.employee_name || "").toLowerCase() === employeeName.toLowerCase()
    );
    const onApprovedLeaveDays = empReports.filter((r) => Boolean(r.on_approved_leave)).length;

    const totalTasks = empTasks.length;
    const verifiedCompletedTasks = empTasks.filter((t) => t.status === "VERIFIED_COMPLETED").length;
    const submittedTasks = empTasks.filter((t) => t.status === "SUBMITTED_FOR_APPROVAL").length;
    const inProgressTasks = empTasks.filter((t) => t.status === "IN_PROGRESS" || t.status === "NOT_STARTED").length;
    const blockedTasks = empTasks.filter((t) => t.status === "BLOCKED").length;
    const verifiedBlockerExcusedCount = empTasks.filter((t) => t.status === "BLOCKED" && t.blockerVerified).length;

    // Unexcused overdue tasks (exclude tasks with a verified external blocker)
    const unexcusedOverdueTasks = empTasks.filter(
      (t) => t.isOverdue && !(t.status === "BLOCKED" && t.blockerVerified)
    ).length;

    // 1. Deadline Compliance (40 points)
    const evaluableForDeadline = Math.max(1, totalTasks - verifiedBlockerExcusedCount);
    const onTimeCount = Math.max(0, evaluableForDeadline - unexcusedOverdueTasks);
    const deadlineComplianceScore = Number(((onTimeCount / evaluableForDeadline) * 40).toFixed(1));

    // 2. Quality & Supervisor Approval (30 points)
    const ratedTasks = empTasks.filter((t) => t.qualityRating !== null && t.qualityRating > 0);
    const avgRating =
      ratedTasks.length > 0
        ? ratedTasks.reduce((acc, t) => acc + (t.qualityRating || 5), 0) / ratedTasks.length
        : 4.5; // baseline before supervisor rating
    const totalReworks = empTasks.reduce((acc, t) => acc + t.reworkCount, 0);
    const reworkPenalty = Math.min(6, totalReworks * 2);
    const qualityApprovalScore = Number(Math.max(0, (avgRating / 5) * 30 - reworkPenalty).toFixed(1));

    // 3. Task Importance / Priority Weighted Achievement (20 points)
    let weightedPossible = 0;
    let weightedEarned = 0;
    for (const t of empTasks) {
      const w = t.priorityWeight;
      weightedPossible += w;
      if (t.status === "VERIFIED_COMPLETED") {
        weightedEarned += w;
      } else if (t.status === "SUBMITTED_FOR_APPROVAL") {
        weightedEarned += w * 0.85;
      } else if (t.status === "BLOCKED" && t.blockerVerified) {
        // Fairness adjustment: verified external blocker protects weighted achievement ratio
        weightedEarned += w * Math.max(0.75, t.progressPercent / 100);
      } else {
        weightedEarned += w * (t.progressPercent / 100) * 0.7;
      }
    }
    const taskImportanceScore = Number(
      (weightedPossible > 0 ? (weightedEarned / weightedPossible) * 20 : 16).toFixed(1)
    );

    // 4. Timely Reporting & Communication (10 points)
    const tasksWithRemarks = empTasks.filter((t) => Boolean(t.staffRemarks && t.staffRemarks.trim().length > 5)).length;
    const remarkRatio = totalTasks > 0 ? tasksWithRemarks / totalTasks : 1;
    const reportBonus = empReports.length > 0 || onApprovedLeaveDays > 0 ? 4 : 2;
    const timelyReportingScore = Number(Math.min(10, remarkRatio * 6 + reportBonus).toFixed(1));

    const totalKpiScore = Number(
      Math.min(
        100,
        deadlineComplianceScore + qualityApprovalScore + taskImportanceScore + timelyReportingScore
      ).toFixed(1)
    );

    let grade: EmployeeKpiScorecard["grade"] = "B (Satisfactory)";
    let recommendation: EmployeeKpiScorecard["recommendation"] = "Standard Progression";

    if (totalKpiScore >= 90) {
      grade = "A+ (Exemplary)";
      recommendation = "Recognition & Bonus Eligible";
    } else if (totalKpiScore >= 80) {
      grade = "A (Strong)";
      recommendation = "Recognition & Bonus Eligible";
    } else if (totalKpiScore >= 70) {
      grade = "B (Satisfactory)";
      recommendation = "Standard Progression";
    } else if (totalKpiScore >= 55) {
      grade = "C (Needs Coaching)";
      recommendation = "Targeted Training";
    } else {
      grade = "D (Management Review)";
      recommendation = "MD / HR Performance Review";
    }

    scorecards.push({
      employeeId: first.assignedToId,
      employeeName,
      designation: first.assignedToDesignation,
      companyName: first.companyName,
      department: first.department,
      totalTasks,
      verifiedCompletedTasks,
      submittedTasks,
      inProgressTasks,
      overdueTasks: unexcusedOverdueTasks,
      blockedTasks,
      verifiedBlockerExcusedCount,
      onApprovedLeaveDays,
      deadlineComplianceScore,
      qualityApprovalScore,
      taskImportanceScore,
      timelyReportingScore,
      totalKpiScore,
      weightedPointsEarned: Number(weightedEarned.toFixed(2)),
      weightedPointsPossible: Number(weightedPossible.toFixed(2)),
      averageQualityRating: Number(avgRating.toFixed(1)),
      reworkCount: totalReworks,
      dailyReportsSubmitted: empReports.length,
      grade,
      recommendation,
    });
  }

  return scorecards.sort((a, b) => b.totalKpiScore - a.totalKpiScore);
}

