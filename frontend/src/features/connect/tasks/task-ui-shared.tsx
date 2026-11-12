"use client";

import React, { useState, useId } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  AlertTriangle,
  BellRing,
  CheckCircle2,
  Clock,
  Download,
  FileText,
  Flame,
  LayoutDashboard,
  ListChecks,
  MessageSquare,
  Phone,
  PlusCircle,
  Printer,
  RefreshCw,
  Repeat,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Star,
  TrendingUp,
  Upload,
  Users,
  Video,
  Building2,
  CalendarClock,
  CheckCheck,
  Send,
} from "lucide-react";
import { connectPaths } from "@/features/connect/paths";
import type {
  ConnectTaskRecord,
  EscalationStage,
  TaskPriority,
  TaskStatus,
} from "@/lib/connect/tasks-db";

export type ActiveUserRole =
  | "Managing Director"
  | "Department Head"
  | "Central Monitoring Officer"
  | "Employee / Staff";

export const COMPANIES = ["All Companies", "Mariners", "MOHS", "Marinozz"] as const;
export const DEPARTMENTS = [
  "All Departments",
  "Legal",
  "Accounts",
  "Sales",
  "Operations",
  "Procurement",
  "HR",
  "IT",
] as const;

export const PROJECTS_BY_COMPANY: Record<string, string[]> = {
  Mariners: [
    "Mariners Fleet & Logistics",
    "FY2026 Statutory Tax & Audit",
    "Group Corporate Legal & Compliance",
    "Group Treasury Operations",
  ],
  MOHS: [
    "MOHS Venice City Township",
    "Sector-B Commercial Plots",
    "Block-C Handover & Mutation",
    "MOHS Infrastructure Procurement",
  ],
  Marinozz: [
    "Marinozz Retail Expansion",
    "Flagship Showroom Operations",
    "Supply Chain & Vendor Settlement",
  ],
};

export const STAFF_DIRECTORY = [
  { id: "emp-legal-01", name: "Adv. Rafiqul Islam", department: "Legal", designation: "Senior Legal Counsel", company: "MOHS", supervisor: "Barrister Kamal Hossain (Head of Legal)" },
  { id: "emp-acc-01", name: "Nusrat Jahan", department: "Accounts", designation: "Senior Manager, Accounts", company: "Mariners", supervisor: "Shafiqur Rahman (CFO)" },
  { id: "emp-acc-02", name: "Sajid Hasan", department: "Accounts", designation: "Accounts Executive", company: "Marinozz", supervisor: "Shafiqur Rahman (CFO)" },
  { id: "emp-sales-01", name: "Tanvir Ahmed", department: "Sales", designation: "AGM, Corporate Sales", company: "MOHS", supervisor: "Mahmudul Hasan (Director Sales)" },
  { id: "emp-sales-02", name: "Farhana Yeasmin", department: "Sales", designation: "Retail Operations Executive", company: "Marinozz", supervisor: "Mahmudul Hasan (Director Sales)" },
  { id: "emp-ops-01", name: "Capt. Tareq Mahmud", department: "Operations", designation: "Head of Marine Operations", company: "Mariners", supervisor: "Managing Director" },
  { id: "emp-proc-01", name: "Engr. Ashraful Alam", department: "Procurement", designation: "Procurement Manager", company: "MOHS", supervisor: "Managing Director" },
  { id: "emp-hr-01", name: "Sabrina Karim", department: "HR", designation: "HR & Admin Manager", company: "Marinozz", supervisor: "Managing Director" },
  { id: "emp-it-01", name: "Mehedi Hasan", department: "IT", designation: "Lead Systems Engineer", company: "Mariners", supervisor: "Central Monitoring Officer" },
];

export const TASK_NAV_ITEMS = [
  { label: "My Dashboard", href: connectPaths.myDashboard, icon: LayoutDashboard },
  { label: "Assign Task", href: connectPaths.assignTask, icon: PlusCircle },
  { label: "My Tasks", href: connectPaths.myTasks, icon: ListChecks },
  { label: "Team Tasks", href: connectPaths.teamTasks, icon: Users },
  { label: "All Tasks", href: connectPaths.allTasks, icon: FileText },
  { label: "Daily Work Report", href: connectPaths.dailyReport, icon: CalendarClock },
  { label: "Pending & Overdue", href: connectPaths.pendingOverdue, icon: AlertTriangle },
  { label: "Task Approval", href: connectPaths.taskApproval, icon: ShieldCheck },
  { label: "Recurring Tasks", href: connectPaths.recurringTasks, icon: Repeat },
  { label: "Employee Performance", href: connectPaths.employeePerformance, icon: TrendingUp },
  { label: "Management Dashboard", href: connectPaths.managementDashboard, icon: Building2 },
  { label: "Task Settings", href: connectPaths.taskSettings, icon: Settings },
] as const;

export function formatDateTime(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export function StatusBadge({ status }: { status: TaskStatus }) {
  const map: Record<TaskStatus, { label: string; dot: string; cls: string }> = {
    NOT_STARTED: {
      label: "Not Started",
      dot: "bg-slate-400",
      cls: "bg-slate-50 text-slate-700 border-slate-200/80 dark:bg-slate-800/40 dark:text-slate-300 dark:border-slate-700/80",
    },
    IN_PROGRESS: {
      label: "In Progress",
      dot: "bg-blue-500 animate-pulse",
      cls: "bg-blue-50/80 text-blue-700 border-blue-200/80 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800/60",
    },
    BLOCKED: {
      label: "Blocked / Support Needed",
      dot: "bg-rose-500",
      cls: "bg-rose-50/80 text-rose-700 border-rose-200/80 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/60",
    },
    SUBMITTED_FOR_APPROVAL: {
      label: "Awaiting Approval",
      dot: "bg-amber-500",
      cls: "bg-amber-50/80 text-amber-700 border-amber-200/80 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/60",
    },
    VERIFIED_COMPLETED: {
      label: "Verified Completed",
      dot: "bg-emerald-500",
      cls: "bg-emerald-50/80 text-emerald-700 border-emerald-200/80 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/60",
    },
    REJECTED: {
      label: "Correction Requested",
      dot: "bg-orange-500",
      cls: "bg-orange-50/80 text-orange-700 border-orange-200/80 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-800/60",
    },
    CANCELLED: {
      label: "Cancelled",
      dot: "bg-zinc-400",
      cls: "bg-zinc-50 text-zinc-600 border-zinc-200 dark:bg-zinc-800/40 dark:text-zinc-400 dark:border-zinc-700",
    },
  };
  const item = map[status] || map.NOT_STARTED;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold tracking-tight shadow-2xs ${item.cls}`}
    >
      <span className={`size-1.5 rounded-full shrink-0 ${item.dot}`} />
      <span>{item.label}</span>
    </span>
  );
}

export function PriorityBadge({ priority, showWeight = false }: { priority: TaskPriority; showWeight?: boolean }) {
  const map: Record<TaskPriority, { label: string; weight: string; dot: string; cls: string }> = {
    CRITICAL: {
      label: "Critical",
      weight: "3x KPI",
      dot: "bg-red-500",
      cls: "bg-rose-50/90 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/80",
    },
    HIGH: {
      label: "High",
      weight: "2x KPI",
      dot: "bg-amber-500",
      cls: "bg-amber-50/80 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/60",
    },
    MEDIUM: {
      label: "Medium",
      weight: "1.5x",
      dot: "bg-blue-500",
      cls: "bg-blue-50/70 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800/60",
    },
    LOW: {
      label: "Low",
      weight: "1x",
      dot: "bg-slate-400",
      cls: "bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-800/30 dark:text-slate-300 dark:border-slate-700/60",
    },
  };
  const item = map[priority] || map.MEDIUM;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-semibold tracking-wide ${item.cls}`}
    >
      <span className={`size-1.5 rounded-full shrink-0 ${item.dot}`} />
      <span>{item.label}</span>
      {showWeight && <span className="opacity-75 font-normal text-[10px]">({item.weight})</span>}
    </span>
  );
}

export function EscalationBadge({ stage, overdueHours }: { stage: EscalationStage; overdueHours?: number }) {
  if (stage === "NONE") return null;

  const map: Record<EscalationStage, { label: string; cls: string }> = {
    NONE: { label: "", cls: "" },
    REMINDER_2H: {
      label: "2h Pre-Deadline Reminder Sent",
      cls: "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800",
    },
    OVERDUE_FLAG: {
      label: `Overdue (${overdueHours ?? 0}h)`,
      cls: "bg-orange-50 text-orange-800 border-orange-200 dark:bg-orange-950/50 dark:text-orange-300 dark:border-orange-800",
    },
    DEPT_HEAD_1H: {
      label: `Dept Head Alert (${overdueHours ?? 1}h Overdue)`,
      cls: "bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800",
    },
    CMO_24H: {
      label: `Central Monitoring Alert (${overdueHours ?? 24}h Overdue)`,
      cls: "bg-red-50 text-red-900 border-red-300 dark:bg-red-950/60 dark:text-red-200 dark:border-red-800",
    },
    MD_CRITICAL_ALERT: {
      label: `MD Executive Alert (${overdueHours ? `${overdueHours}h Overdue` : "Critical"})`,
      cls: "bg-red-600 text-white border-red-700 shadow-2xs font-bold",
    },
  };

  const item = map[stage];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-medium ${item.cls}`}
    >
      <AlertTriangle className="size-3 shrink-0" />
      <span>{item.label}</span>
    </span>
  );
}

export function exportTasksToCsv(filename: string, tasks: ConnectTaskRecord[]) {
  const headers = [
    "Task ID",
    "Company",
    "Department",
    "Project",
    "Task Title",
    "Assigned To",
    "Reporting Supervisor",
    "Priority",
    "Progress %",
    "Status",
    "Deadline",
    "Overdue Hours",
    "Escalation Stage",
    "Quality Rating",
    "Staff Remarks",
  ];
  const rows = tasks.map((t) => [
    t.taskCode,
    t.companyName,
    t.department,
    t.projectName,
    `"${(t.title || "").replace(/"/g, '""')}"`,
    t.assignedToName,
    t.reportingToName,
    t.priority,
    `${t.progressPercent}%`,
    t.status,
    formatDateTime(t.deadline),
    t.overdueHours,
    t.computedEscalation,
    t.qualityRating ?? "Pending",
    `"${(t.staffRemarks || "").replace(/"/g, '""')}"`,
  ]);

  const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Top Header + 12-Menu Navigation Bar + Role Switcher
 */
export function TaskModuleHeader({
  title,
  subtitle,
  activeRole,
  onRoleChange,
  onRefresh,
  isLoading,
  rightActions,
}: {
  title: string;
  subtitle: string;
  activeRole: ActiveUserRole;
  onRoleChange: (role: ActiveUserRole) => void;
  onRefresh?: () => void;
  isLoading?: boolean;
  rightActions?: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="space-y-4 pb-4 border-b border-line">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-xs">
            <span className="inline-flex items-center gap-1 rounded bg-blue-600/10 text-blue-600 dark:text-blue-400 px-2 py-0.5 font-bold uppercase tracking-wider text-[10px]">
              BridgeOne ERP · Version 1.0
            </span>
            <span className="text-ink-muted">Central Task Management, Monitoring &amp; Employee Performance System</span>
          </div>
          <h1 className="text-xl font-bold text-ink mt-1">{title}</h1>
          <p className="text-xs text-ink-muted mt-0.5">{subtitle}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Active Role Selector to test RBAC & CMO Guardrails live */}
          <div className="flex items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 py-1 text-xs">
            <span className="text-ink-muted font-medium">Active Role:</span>
            <select
              aria-label="Select Active Governance Role"
              value={activeRole}
              onChange={(e) => onRoleChange(e.target.value as ActiveUserRole)}
              className="bg-transparent font-bold text-blue-600 dark:text-blue-400 focus:outline-none cursor-pointer"
            >
              <option value="Managing Director">Managing Director (MD)</option>
              <option value="Department Head">Department Head / Supervisor</option>
              <option value="Central Monitoring Officer">Central Monitoring Officer (CMO)</option>
              <option value="Employee / Staff">Employee / Staff Portal</option>
            </select>
          </div>

          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              disabled={isLoading}
              className="h-8 px-2.5 rounded-md border border-line bg-surface hover:bg-control text-ink text-xs font-medium inline-flex items-center gap-1.5 transition cursor-pointer"
            >
              <RefreshCw className={`size-3.5 ${isLoading ? "animate-spin" : ""}`} />
              <span>Sync Live</span>
            </button>
          )}

          <Link
            href={connectPaths.assignTask}
            className="h-8 px-3 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold inline-flex items-center gap-1.5 transition"
          >
            <PlusCircle className="size-3.5" />
            <span>Assign Task</span>
          </Link>

          {rightActions}
        </div>
      </div>

      {/* Streamlined Navigation: Tasks Hub · Assign Task · Performance & Monitoring */}
      <nav aria-label="Task Management Views" className="flex items-center gap-1.5 overflow-x-auto">
        <Link
          href={connectPaths.tasks}
          className={`h-8 px-3 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition border ${
            pathname === connectPaths.tasks || pathname === "/connect/tasks/dashboard" || pathname === "/connect/tasks/my-tasks"
              ? "bg-blue-600 text-white border-blue-600 shadow-xs"
              : "bg-surface text-ink-muted border-line hover:bg-control hover:text-ink"
          }`}
        >
          <ListChecks className="size-3.5 shrink-0" />
          <span>Tasks Hub</span>
        </Link>
        <Link
          href={connectPaths.assignTask}
          className={`h-8 px-3 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition border ${
            pathname === connectPaths.assignTask
              ? "bg-blue-600 text-white border-blue-600 shadow-xs"
              : "bg-surface text-ink-muted border-line hover:bg-control hover:text-ink"
          }`}
        >
          <PlusCircle className="size-3.5 shrink-0" />
          <span>Assign Task</span>
        </Link>
        <Link
          href={connectPaths.monitoring}
          className={`h-8 px-3 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition border ${
            pathname === connectPaths.monitoring || pathname === "/connect/tasks/executive" || pathname === "/connect/tasks/performance"
              ? "bg-blue-600 text-white border-blue-600 shadow-xs"
              : "bg-surface text-ink-muted border-line hover:bg-control hover:text-ink"
          }`}
        >
          <TrendingUp className="size-3.5 shrink-0" />
          <span>Performance &amp; Monitoring</span>
        </Link>
      </nav>
    </div>
  );
}

/**
 * Section 4: Interactive Employee Task Card
 * Supports live Progress Slider (0-100%), Status transitions, Staff Remarks,
 * File/Evidence Upload, Blocker escalation, Deadline Extension Request, and Approval Submission.
 */
export function InteractiveEmployeeTaskCard({
  task,
  activeRole,
  onUpdated,
}: {
  task: ConnectTaskRecord;
  activeRole: ActiveUserRole;
  onUpdated: () => void;
}) {
  const formId = useId();
  const [progress, setProgress] = useState<number>(task.progressPercent);
  const [status, setStatus] = useState<TaskStatus>(task.status);
  const [remarks, setRemarks] = useState<string>(task.staffRemarks || "");
  const [evidenceName, setEvidenceName] = useState<string>(task.evidenceName || "");
  const [blockerReason, setBlockerReason] = useState<string>(task.blockerReason || "");
  const [blockedByDept, setBlockedByDept] = useState<string>(task.blockedByDepartment || "Accounts");
  const [blockedByPerson, setBlockedByPerson] = useState<string>(task.blockedByPerson || "");
  const [requiresMdDecision, setRequiresMdDecision] = useState<boolean>(task.requiresMdDecision);
  const [isSaving, setIsSaving] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  // Extension Request Modal State
  const [showExtForm, setShowExtForm] = useState(false);
  const [extDate, setExtDate] = useState(() => {
    const d = new Date(new Date(task.deadline).getTime() + 24 * 3600 * 1000);
    return d.toISOString().slice(0, 16);
  });
  const [extReason, setExtReason] = useState("");
  const [isSubmittingExt, setIsSubmittingExt] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setEvidenceName(file.name);
    }
  };

  const handleCopySampleUpdate = () => {
    const sample = `Completed ${ Math.max(progress, 75) }% of ${task.title}. All primary schedules verified and supporting documents attached for ${task.reportingToName} review.`;
    setRemarks(sample);
  };

  const handleSaveTaskUpdate = async (e: React.FormEvent, forceSubmitForApproval = false) => {
    e.preventDefault();
    setIsSaving(true);
    setFeedbackMsg(null);

    const targetStatus: TaskStatus = forceSubmitForApproval ? "SUBMITTED_FOR_APPROVAL" : status;
    const targetProgress = targetStatus === "SUBMITTED_FOR_APPROVAL" ? 100 : progress;

    try {
      const res = await fetch(`/api/connect/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mutationType: "STAFF_UPDATE",
          actorName: task.assignedToName,
          actorRole: activeRole,
          status: targetStatus,
          progressPercent: targetProgress,
          staffRemarks: remarks,
          evidenceName: evidenceName || null,
          evidenceUrl: evidenceName ? "/connect/docs" : null,
          blockerReason: targetStatus === "BLOCKED" ? blockerReason : null,
          blockedByDepartment: targetStatus === "BLOCKED" ? blockedByDept : null,
          blockedByPerson: targetStatus === "BLOCKED" ? blockedByPerson : null,
          requiresMdDecision: targetStatus === "BLOCKED" ? requiresMdDecision : false,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setStatus(data.task.status);
        setProgress(data.task.progressPercent);
        setFeedbackMsg({
          type: "ok",
          text:
            data.task.status === "SUBMITTED_FOR_APPROVAL"
              ? `Submitted to ${task.reportingToName} for Verification & Approval! (Note: Verification Required = Yes, so task completes after Supervisor approval).`
              : "Task progress & daily remarks saved to live database.",
        });
        onUpdated();
      } else {
        setFeedbackMsg({ type: "err", text: data.error || "Failed to update task" });
      }
    } catch {
      setFeedbackMsg({ type: "err", text: "Network error while saving task update" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleRequestExtension = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!extReason.trim()) return;
    setIsSubmittingExt(true);
    try {
      const res = await fetch(`/api/connect/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "REQUEST_DEADLINE_EXTENSION",
          taskId: task.id,
          requestedByName: task.assignedToName,
          proposedDeadline: extDate,
          reason: extReason,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setShowExtForm(false);
        setExtReason("");
        setFeedbackMsg({
          type: "ok",
          text: "Deadline extension request sent to Supervisor for approval.",
        });
        onUpdated();
      }
    } finally {
      setIsSubmittingExt(false);
    }
  };

  const statusChoices: { value: TaskStatus; label: string }[] = [
    { value: "NOT_STARTED", label: "Not Started" },
    { value: "IN_PROGRESS", label: "In Progress" },
    { value: "BLOCKED", label: "Blocked / Need Support" },
    { value: "SUBMITTED_FOR_APPROVAL", label: "Submitted for Approval" },
  ];

  return (
    <div className="rounded-xl border border-line bg-surface p-5 shadow-2xs hover:border-slate-300 dark:hover:border-slate-700 transition-colors space-y-4">
      {/* Top Row: Task ID, Priority, Tags, Escalation & Status */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-line/80 pb-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs font-semibold px-2.5 py-1 rounded-md bg-control/70 text-ink border border-line/80 tracking-tight">
            TASK #{task.taskCode}
          </span>
          <PriorityBadge priority={task.priority} showWeight />
          <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-control/40 text-ink border border-line/60">
            {task.companyName} · {task.department}
          </span>
          {task.recurringType !== "ONE_TIME" && (
            <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/20">
              ↻ {task.recurringType}
            </span>
          )}
          <EscalationBadge stage={task.computedEscalation} overdueHours={task.overdueHours} />
        </div>
        <StatusBadge status={task.status} />
      </div>

      {/* Title & Metadata */}
      <div className="space-y-2">
        <h3 className="text-base font-semibold tracking-tight text-ink">{task.title}</h3>
        <p className="text-[13px] text-ink-muted leading-relaxed">{task.description}</p>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 pt-1 text-xs text-ink-muted">
          <span className="inline-flex items-center gap-1.5">
            <span className="font-medium text-ink-muted">Project:</span>
            <strong className="text-ink font-semibold">{task.projectName}</strong>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="font-medium text-ink-muted">Responsible:</span>
            <strong className="text-ink font-semibold">{task.assignedToName}</strong>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="font-medium text-ink-muted">Supervisor:</span>
            <strong className="text-ink font-semibold">{task.reportingToName}</strong>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="font-medium text-ink-muted">Deadline:</span>
            <span className={task.isOverdue ? "text-rose-600 dark:text-rose-400 font-bold" : "text-ink font-semibold"}>
              {formatDateTime(task.deadline)}
            </span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="font-medium text-ink-muted">Verification:</span>
            <span className="text-ink font-medium">
              {task.verificationRequired ? "Required (Supervisor Sign-off)" : "Self-Complete"}
            </span>
          </span>
        </div>
      </div>

      {/* Supervisor Feedback or MD Executive Directive Banner if present */}
      {task.supervisorFeedback && (
        <div className="rounded-lg border border-amber-200/80 dark:border-amber-800/80 bg-amber-50/60 dark:bg-amber-950/20 p-3 text-xs flex items-start justify-between gap-3">
          <div>
            <span className="font-bold text-amber-900 dark:text-amber-200 block mb-0.5">
              Supervisor Review Feedback ({task.reportingToName}):
            </span>
            <span className="text-amber-800 dark:text-amber-300 leading-relaxed">{task.supervisorFeedback}</span>
          </div>
          {task.qualityRating && (
            <span className="inline-flex items-center gap-1 font-bold text-amber-700 dark:text-amber-300 shrink-0">
              <Star className="size-3.5 fill-amber-400 text-amber-500" />
              {task.qualityRating}/5
            </span>
          )}
        </div>
      )}

      {task.mdDecisionNote && (
        <div className="rounded-lg border border-blue-200/80 dark:border-blue-800/80 bg-blue-50/60 dark:bg-blue-950/20 p-3 text-xs">
          <span className="font-bold text-blue-900 dark:text-blue-200 block mb-0.5">
            MD Executive Directive:
          </span>
          <span className="text-blue-800 dark:text-blue-300 leading-relaxed">{task.mdDecisionNote}</span>
        </div>
      )}

      {/* Interactive Update Form */}
      <form onSubmit={(e) => handleSaveTaskUpdate(e, false)} className="space-y-4 pt-2 border-t border-line/80">
        {/* Work Progress Slider */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <label htmlFor={`${formId}-progress`} className="font-semibold text-ink">
              Work Progress
            </label>
            <div className="flex items-center gap-1.5">
              {[0, 25, 50, 60, 75, 100].map((pct) => (
                <button
                  key={pct}
                  type="button"
                  onClick={() => setProgress(pct)}
                  className={`px-2 py-0.5 rounded text-[11px] font-semibold border transition cursor-pointer ${
                    progress === pct
                      ? "bg-blue-600 text-white border-blue-600 shadow-2xs"
                      : "bg-control/60 text-ink-muted border-line/70 hover:text-ink hover:bg-control"
                  }`}
                >
                  {pct}%
                </button>
              ))}
              <span className="ml-1.5 font-mono text-sm font-bold text-blue-600 dark:text-blue-400">
                {progress}%
              </span>
            </div>
          </div>
          <input
            id={`${formId}-progress`}
            name="progressPercent"
            type="range"
            min={0}
            max={100}
            step={5}
            value={progress}
            onChange={(e) => setProgress(Number(e.target.value))}
            className="w-full accent-blue-600 cursor-pointer"
          />
          <div className="h-2 w-full rounded-full bg-control/80 overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${
                progress === 100
                  ? "bg-emerald-500"
                  : status === "BLOCKED"
                  ? "bg-rose-500"
                  : "bg-blue-600"
              }`}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Task Status Selection (Segmented Radio Options) */}
        <fieldset className="space-y-1.5">
          <legend className="text-xs font-semibold text-ink">Task Status</legend>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 pt-0.5">
            {statusChoices.map((choice) => {
              const selected = status === choice.value;
              return (
                <label
                  key={choice.value}
                  className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium cursor-pointer transition ${
                    selected
                      ? "border-blue-600 bg-blue-500/10 text-blue-700 dark:text-blue-300 font-semibold shadow-2xs"
                      : "border-line/80 bg-control/30 text-ink hover:bg-control/60"
                  }`}
                >
                  <input
                    type="radio"
                    name={`taskStatus-${task.id}`}
                    value={choice.value}
                    checked={selected}
                    onChange={() => {
                      setStatus(choice.value);
                      if (choice.value === "SUBMITTED_FOR_APPROVAL") setProgress(100);
                    }}
                    className="accent-blue-600 size-3.5"
                  />
                  <span>{choice.label}</span>
                </label>
              );
            })}
          </div>
        </fieldset>

        {/* Conditional Blocker Details when Status === BLOCKED */}
        {status === "BLOCKED" && (
          <div className="rounded-lg border border-rose-300 dark:border-rose-800 bg-rose-50/50 dark:bg-rose-950/20 p-3.5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-rose-700 dark:text-rose-300 flex items-center gap-1.5">
                <AlertTriangle className="size-4" />
                Inter-Departmental Blocker &amp; Escalation Details
              </span>
              <span className="text-[11px] text-rose-600 dark:text-rose-400">
                Verified blockers protect employee KPI from overdue penalty
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label htmlFor={`${formId}-block-dept`} className="block text-[11px] font-semibold text-ink mb-1">
                  Blocked By Department
                </label>
                <select
                  id={`${formId}-block-dept`}
                  name="blockedByDepartment"
                  value={blockedByDept}
                  onChange={(e) => setBlockedByDept(e.target.value)}
                  className="w-full h-8 rounded border border-line bg-surface px-2 text-xs text-ink"
                >
                  {DEPARTMENTS.filter((d) => d !== "All Departments").map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                  <option value="Management">Management / Board</option>
                  <option value="External Agency">External Govt / Bank</option>
                </select>
              </div>
              <div>
                <label htmlFor={`${formId}-block-person`} className="block text-[11px] font-semibold text-ink mb-1">
                  Dependency Contact / Person
                </label>
                <input
                  id={`${formId}-block-person`}
                  name="blockedByPerson"
                  type="text"
                  value={blockedByPerson}
                  onChange={(e) => setBlockedByPerson(e.target.value)}
                  placeholder="e.g., Shafiqur Rahman (CFO)"
                  className="w-full h-8 rounded border border-line bg-surface px-2.5 text-xs text-ink"
                />
              </div>
              <div className="flex items-end pb-1">
                <label className="flex items-center gap-2 text-xs font-semibold text-rose-800 dark:text-rose-300 cursor-pointer">
                  <input
                    type="checkbox"
                    name="requiresMdDecision"
                    checked={requiresMdDecision}
                    onChange={(e) => setRequiresMdDecision(e.target.checked)}
                    className="accent-rose-600 size-4"
                  />
                  <span>Requires MD Executive Decision</span>
                </label>
              </div>
            </div>
            <div>
              <label htmlFor={`${formId}-block-reason`} className="block text-[11px] font-semibold text-ink mb-1">
                Exact Reason Task is Blocked / Support Needed
              </label>
              <input
                id={`${formId}-block-reason`}
                name="blockerReason"
                type="text"
                value={blockerReason}
                onChange={(e) => setBlockerReason(e.target.value)}
                placeholder="Describe what approval, document, or dependency is holding up completion..."
                className="w-full h-8 rounded border border-line bg-surface px-2.5 text-xs text-ink"
              />
            </div>
          </div>
        )}

        {/* Staff Update / Remarks + Evidence File Upload */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          <div className="lg:col-span-2 space-y-1">
            <div className="flex items-center justify-between">
              <label htmlFor={`${formId}-remarks`} className="text-xs font-bold text-ink">
                Staff Update / Remarks
              </label>
              <button
                type="button"
                onClick={handleCopySampleUpdate}
                className="text-[11px] font-semibold text-blue-600 hover:underline inline-flex items-center gap-1 cursor-pointer"
              >
                <Sparkles className="size-3" />
                <span>Copy Sample Update</span>
              </button>
            </div>
            <textarea
              id={`${formId}-remarks`}
              name="staffRemarks"
              rows={2}
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Write daily work progress, milestones completed, or notes for supervisor verification..."
              className="w-full rounded-lg border border-line bg-surface p-2.5 text-xs text-ink focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor={`${formId}-file`} className="block text-xs font-bold text-ink">
              Proof of Work / Evidence Upload
            </label>
            <div className="rounded-lg border border-dashed border-line bg-control/30 p-2.5 text-xs space-y-1.5">
              <label
                htmlFor={`${formId}-file`}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-surface border border-line text-ink font-semibold cursor-pointer hover:bg-control transition"
              >
                <Upload className="size-3.5 text-blue-600" />
                <span>Attach File / Deed / Report</span>
              </label>
              <input
                id={`${formId}-file`}
                type="file"
                onChange={handleFileChange}
                className="sr-only"
              />
              <div className="truncate text-[11px] text-ink-muted">
                {evidenceName ? (
                  <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                    ✓ Attached: {evidenceName}
                  </span>
                ) : task.attachmentName ? (
                  <span>Reference Doc: {task.attachmentName}</span>
                ) : (
                  <span>PDF, XLSX, DOCX, or Image evidence</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Feedback Banner */}
        {feedbackMsg && (
          <div
            role="status"
            aria-live="polite"
            className={`rounded-lg border px-3 py-2 text-xs font-medium ${
              feedbackMsg.type === "ok"
                ? "bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/50 dark:border-emerald-800 dark:text-emerald-200"
                : "bg-rose-50 border-rose-200 text-rose-800 dark:bg-rose-950/50 dark:border-rose-800 dark:text-rose-200"
            }`}
          >
            {feedbackMsg.text}
          </div>
        )}

        {/* Action Bar: Save Update, Submit for Approval, Request Extension, Discuss/Call */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="submit"
              disabled={isSaving}
              className="h-8 px-3.5 rounded-md bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-semibold inline-flex items-center gap-1.5 transition cursor-pointer"
            >
              <CheckCircle2 className="size-3.5" />
              <span>{isSaving ? "Saving..." : "Save Daily Update"}</span>
            </button>

            {task.status !== "VERIFIED_COMPLETED" && (
              <button
                type="button"
                disabled={isSaving}
                onClick={(e) => handleSaveTaskUpdate(e, true)}
                className="h-8 px-3.5 rounded-md bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-semibold inline-flex items-center gap-1.5 transition cursor-pointer"
              >
                <Send className="size-3.5" />
                <span>Submit for Approval (100%)</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setShowExtForm((v) => !v)}
              className="h-8 px-2.5 rounded-md border border-line bg-surface hover:bg-control text-ink text-xs font-medium inline-flex items-center gap-1.5 transition cursor-pointer"
            >
              <Clock className="size-3.5 text-amber-600" />
              <span>Request Deadline Extension</span>
            </button>
          </div>

          {/* Integrated BRG Connect Chat & Call Shortcuts */}
          <div className="flex items-center gap-1.5">
            <Link
              href={connectPaths.chat}
              className="h-8 px-2.5 rounded-md border border-line bg-control/40 hover:bg-control text-ink text-xs font-medium inline-flex items-center gap-1.5 transition"
              title="Discuss this task in BRG Connect Chat"
            >
              <MessageSquare className="size-3.5 text-blue-600" />
              <span>Discuss</span>
            </Link>
            <Link
              href={connectPaths.calls}
              className="h-8 px-2.5 rounded-md border border-line bg-control/40 hover:bg-control text-ink text-xs font-medium inline-flex items-center gap-1.5 transition"
              title="Start Audio/Video Call with Assignee or Supervisor"
            >
              <Phone className="size-3.5 text-emerald-600" />
              <Video className="size-3.5 text-blue-600" />
            </Link>
          </div>
        </div>
      </form>

      {/* Collapsible Deadline Extension Form */}
      {showExtForm && (
        <form
          onSubmit={handleRequestExtension}
          className="rounded-lg border border-amber-300 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/30 p-3.5 space-y-3"
        >
          <div className="text-xs font-bold text-amber-900 dark:text-amber-200">
            Request Official Deadline Extension (Logged in Audit History)
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label htmlFor={`${formId}-ext-date`} className="block text-[11px] font-semibold text-ink mb-1">
                Proposed New Deadline
              </label>
              <input
                id={`${formId}-ext-date`}
                type="datetime-local"
                value={extDate}
                onChange={(e) => setExtDate(e.target.value)}
                required
                className="w-full h-8 rounded border border-line bg-surface px-2 text-xs text-ink"
              />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor={`${formId}-ext-reason`} className="block text-[11px] font-semibold text-ink mb-1">
                Justification for Extension
              </label>
              <input
                id={`${formId}-ext-reason`}
                type="text"
                value={extReason}
                onChange={(e) => setExtReason(e.target.value)}
                required
                placeholder="Explain why additional time is required..."
                className="w-full h-8 rounded border border-line bg-surface px-2.5 text-xs text-ink"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={isSubmittingExt}
              className="h-7 px-3 rounded bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold cursor-pointer"
            >
              {isSubmittingExt ? "Submitting..." : "Send Extension Request"}
            </button>
            <button
              type="button"
              onClick={() => setShowExtForm(false)}
              className="h-7 px-2.5 rounded border border-line bg-surface text-xs text-ink-muted cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

export {
  AlertTriangle,
  BellRing,
  Building2,
  CalendarClock,
  CheckCheck,
  CheckCircle2,
  Clock,
  Download,
  FileText,
  Flame,
  LayoutDashboard,
  ListChecks,
  MessageSquare,
  Phone,
  PlusCircle,
  Printer,
  RefreshCw,
  Repeat,
  Send,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Star,
  TrendingUp,
  Upload,
  Users,
  Video,
};

