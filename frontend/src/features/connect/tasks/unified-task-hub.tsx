"use client";

import React, { useState, useEffect, useCallback, useId } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { X, Loader2 } from "lucide-react";
import { connectPaths } from "@/features/connect/paths";
import type {
  ConnectTaskRecord,
  EmployeeKpiScorecard,
  TaskPriority,
} from "@/lib/connect/tasks-db";
import {
  type ActiveUserRole,
  COMPANIES,
  DEPARTMENTS,
  PROJECTS_BY_COMPANY,
  STAFF_DIRECTORY,
  InteractiveEmployeeTaskCard,
  StatusBadge,
  PriorityBadge,
  EscalationBadge,
  formatDateTime,
  exportTasksToCsv,
  AlertTriangle,
  BellRing,
  Building2,
  CalendarClock,
  CheckCheck,
  CheckCircle2,
  Clock,
  Download,
  Flame,
  LayoutDashboard,
  ListChecks,
  PlusCircle,
  RefreshCw,
  Repeat,
  ShieldCheck,
  Star,
  TrendingUp,
  Users,
  FileText,
  Sparkles,
} from "./task-ui-shared";

interface TasksApiPayload {
  tasks: ConnectTaskRecord[];
  summary: {
    totalTasks: number;
    completedTasks: number;
    pendingActiveTasks: number;
    submittedForApprovalTasks: number;
    blockedTasks: number;
    overdueTasks: number;
    completionRatePercent: number;
  };
  goldenReports?: {
    todaysCompletedTasks: ConnectTaskRecord[];
    criticalOverdueTasks: ConnectTaskRecord[];
    managementDecisionRequiredTasks: ConnectTaskRecord[];
  };
  kpiScorecards: EmployeeKpiScorecard[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  dailyReports: any[];
}

export function UnifiedTaskHub() {
  const formId = useId();
  const searchParams = useSearchParams();
  const initialTab = (searchParams.get("tab") || "my-tasks") as
    | "my-tasks"
    | "all"
    | "approvals"
    | "daily-report"
    | "executive";

  const [activeTab, setActiveTab] = useState<
    "my-tasks" | "all" | "approvals" | "daily-report" | "executive"
  >(initialTab);
  const [data, setData] = useState<TasksApiPayload | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeRole, setActiveRole] = useState<ActiveUserRole>("Department Head");

  // In-page Quick Assign Modal State
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignCompany, setAssignCompany] = useState("MOHS");
  const [assignDept, setAssignDept] = useState("Legal");
  const [assignProject, setAssignProject] = useState(PROJECTS_BY_COMPANY["MOHS"][0]);
  const [assignTitle, setAssignTitle] = useState("");
  const [assignDesc, setAssignDesc] = useState("");
  const [assignStaff, setAssignStaff] = useState("Adv. Rafiqul Islam");
  const [assignSupervisor, setAssignSupervisor] = useState("Barrister Kamal Hossain");
  const [assignDeadline, setAssignDeadline] = useState(() => {
    const d = new Date(Date.now() + 48 * 3600 * 1000);
    return d.toISOString().slice(0, 16);
  });
  const [assignPriority, setAssignPriority] = useState<TaskPriority>("HIGH");
  const [assignVerification, setAssignVerification] = useState(true);
  const [assignRecurring, setAssignRecurring] = useState("ONE_TIME");
  const [isSubmittingTask, setIsSubmittingTask] = useState(false);

  // Filters for My Tasks
  const [selectedStaff, setSelectedStaff] = useState<string>("Adv. Rafiqul Islam");

  // Filters for All Tasks
  const [companyFilter, setCompanyFilter] = useState("All Companies");
  const [deptFilter, setDeptFilter] = useState("All Departments");
  const [statusFilter, setStatusFilter] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");

  // Approvals & Overdue Actions State
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [busyTaskId, setBusyTaskId] = useState<string | null>(null);
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [feedbacks, setFeedbacks] = useState<Record<string, string>>({});
  const [mdDirectives, setMdDirectives] = useState<Record<string, string>>({});

  // Daily Work Report State
  const [reportHours, setReportHours] = useState("8.5");
  const [reportNotes, setReportNotes] = useState("");
  const [reportOnLeave, setReportOnLeave] = useState(false);
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);

  const fetchTasks = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/connect/tasks");
      const json = await res.json();
      if (json.success) {
        setData(json);
      }
    } catch {
      // ignore
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (active) fetchTasks();
    });
    return () => {
      active = false;
    };
  }, [fetchTasks]);

  const tasks = data?.tasks || [];
  const summary = data?.summary || {
    totalTasks: tasks.length,
    completedTasks: tasks.filter((t) => t.status === "VERIFIED_COMPLETED").length,
    pendingActiveTasks: tasks.filter((t) => t.status !== "VERIFIED_COMPLETED").length,
    submittedForApprovalTasks: tasks.filter((t) => t.status === "SUBMITTED_FOR_APPROVAL").length,
    blockedTasks: tasks.filter((t) => t.status === "BLOCKED").length,
    overdueTasks: tasks.filter((t) => t.isOverdue).length,
    completionRatePercent: 0,
  };

  const myTasks = tasks.filter(
    (t) => selectedStaff === "All" || t.assignedToName.toLowerCase() === selectedStaff.toLowerCase()
  );
  const myKpi =
    data?.kpiScorecards?.find(
      (k) => k.employeeName.toLowerCase() === selectedStaff.toLowerCase()
    ) || data?.kpiScorecards?.[0];

  const allFiltered = tasks.filter((t) => {
    if (companyFilter !== "All Companies" && t.companyName !== companyFilter) return false;
    if (deptFilter !== "All Departments" && t.department !== deptFilter) return false;
    if (statusFilter !== "All" && t.status !== statusFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const match =
        t.taskCode.toLowerCase().includes(q) ||
        t.title.toLowerCase().includes(q) ||
        t.assignedToName.toLowerCase().includes(q) ||
        t.projectName.toLowerCase().includes(q);
      if (!match) return false;
    }
    return true;
  });

  const submittedQueue = tasks.filter((t) => t.status === "SUBMITTED_FOR_APPROVAL");
  const overdueAndBlocked = tasks.filter(
    (t) => t.status !== "VERIFIED_COMPLETED" && (t.isOverdue || t.status === "BLOCKED")
  );

  // Golden Reports for Tab 5
  const goldenCompletedToday =
    data?.goldenReports?.todaysCompletedTasks ||
    tasks.filter((t) => t.status === "VERIFIED_COMPLETED");
  const goldenCriticalOverdue =
    data?.goldenReports?.criticalOverdueTasks ||
    tasks.filter((t) => t.isOverdue && (t.priority === "CRITICAL" || t.priority === "HIGH"));
  const goldenDecisionRequired =
    data?.goldenReports?.managementDecisionRequiredTasks ||
    tasks.filter((t) => t.requiresMdDecision || (t.status === "BLOCKED" && t.priority === "CRITICAL"));

  const handleSupervisorApproval = async (
    task: ConnectTaskRecord,
    decision: "SUPERVISOR_VERIFY" | "SUPERVISOR_REJECT"
  ) => {
    setBusyTaskId(task.id);
    setActionNotice(null);
    const qualityRating = ratings[task.id] || 5;
    const supervisorFeedback =
      feedbacks[task.id] ||
      (decision === "SUPERVISOR_VERIFY"
        ? "Verified deliverables & approved completion."
        : "Correction required. Please update and resubmit.");

    try {
      const res = await fetch(`/api/connect/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mutationType: decision,
          actorName: activeRole,
          actorRole: activeRole,
          qualityRating,
          supervisorFeedback,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setActionNotice(
          decision === "SUPERVISOR_VERIFY"
            ? `✓ Task #${task.taskCode} verified & marked Completed (${qualityRating}/5★)!`
            : `↩ Task #${task.taskCode} returned for correction.`
        );
        fetchTasks();
      } else {
        setActionNotice(json.error || "Permission denied");
      }
    } finally {
      setBusyTaskId(null);
    }
  };

  const handleSendNudge = async (task: ConnectTaskRecord, escalateToMd = false) => {
    setBusyTaskId(task.id);
    setActionNotice(null);
    try {
      const res = await fetch(`/api/connect/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mutationType: "CMO_NUDGE",
          actorName: activeRole,
          actorRole: activeRole,
          escalateToMd,
          nudgeMessage: escalateToMd
            ? `Escalated [${task.taskCode}] to MD Golden Report due to critical delay.`
            : `Follow-up reminder sent to ${task.assignedToName} (SLA Follow-up).`,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setActionNotice(
          escalateToMd
            ? `🚨 Escalated #${task.taskCode} to MD Golden Report!`
            : `⏰ Follow-up reminder sent to ${task.assignedToName}.`
        );
        fetchTasks();
      }
    } finally {
      setBusyTaskId(null);
    }
  };

  const handleIssueMdDirective = async (task: ConnectTaskRecord) => {
    const note =
      mdDirectives[task.id]?.trim() ||
      "Approved by Managing Director. Proceed immediately and coordinate with Finance/Legal.";
    setBusyTaskId(task.id);
    setActionNotice(null);
    try {
      const res = await fetch(`/api/connect/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mutationType: "MD_DECISION",
          actorName: "Managing Director",
          actorRole: "Managing Director",
          mdDecisionNote: note,
          unblockTask: true,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setActionNotice(
          `✓ MD Executive Directive issued on #${task.taskCode} ("${note}"). Task unblocked.`
        );
        fetchTasks();
      }
    } finally {
      setBusyTaskId(null);
    }
  };

  const handleSubmitDailyReport = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingReport(true);
    const emp = STAFF_DIRECTORY.find((s) => s.name === selectedStaff) || STAFF_DIRECTORY[0];
    try {
      const res = await fetch("/api/connect/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "SUBMIT_DAILY_REPORT",
          employeeName: emp.name,
          companyName: emp.company,
          department: emp.department,
          designation: emp.designation,
          hoursLogged: Number(reportHours),
          tasksWorkedCount: myTasks.length,
          tasksCompletedCount: myTasks.filter((t) => t.status === "VERIFIED_COMPLETED").length,
          summaryNotes: reportOnLeave ? "Approved Leave (Zero KPI penalty)" : reportNotes,
          onApprovedLeave: reportOnLeave,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setActionNotice("✓ Daily work report submitted and credited to KPI (10%).");
        setReportNotes("");
        fetchTasks();
      }
    } finally {
      setIsSubmittingReport(false);
    }
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignTitle.trim()) return;
    setIsSubmittingTask(true);
    const emp = STAFF_DIRECTORY.find((s) => s.name === assignStaff) || STAFF_DIRECTORY[0];
    try {
      const res = await fetch("/api/connect/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName: assignCompany,
          department: assignDept,
          projectName: assignProject,
          title: assignTitle,
          description: assignDesc || `Deliverable task for ${assignProject}`,
          assignedToId: emp.id,
          assignedToName: emp.name,
          assignedToDesignation: emp.designation,
          collaborators: [],
          assignedByName: activeRole,
          assignedByRole: activeRole,
          reportingToName: assignSupervisor,
          startDate: new Date().toISOString(),
          deadline: new Date(assignDeadline).toISOString(),
          priority: assignPriority,
          verificationRequired: assignVerification,
          recurringType: assignRecurring,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setActionNotice(`✓ Successfully created Task #${json.task?.taskCode || "NEW"}!`);
        setShowAssignModal(false);
        setAssignTitle("");
        setAssignDesc("");
        fetchTasks();
      } else {
        setActionNotice(json.error || "Failed to create task");
      }
    } finally {
      setIsSubmittingTask(false);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Streamlined Executive Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-line">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-blue-600/10 text-blue-600 dark:text-blue-400">
              BRG Connect
            </span>
            <span className="text-xs text-ink-muted">Central Task Engine</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-ink mt-1">Tasks</h1>
          <p className="text-xs text-ink-muted mt-0.5">
            Coordinate daily operations, deliverables, approvals, and company-wide accountability.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Active Role Selector for live testing */}
          <div className="flex items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 py-1 text-xs">
            <span className="text-ink-muted font-medium">Role:</span>
            <select
              aria-label="Select Active Governance Role"
              value={activeRole}
              onChange={(e) => setActiveRole(e.target.value as ActiveUserRole)}
              className="bg-transparent font-bold text-blue-600 dark:text-blue-400 focus:outline-none cursor-pointer"
            >
              <option value="Department Head">Supervisor / Head</option>
              <option value="Employee / Staff">Employee / Staff</option>
              <option value="Managing Director">Managing Director</option>
              <option value="Central Monitoring Officer">Central Monitoring</option>
            </select>
          </div>

          <button
            type="button"
            onClick={fetchTasks}
            disabled={isLoading}
            className="h-8 px-2.5 rounded-lg border border-line bg-surface hover:bg-control text-ink text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer transition shadow-2xs"
            title="Refresh Live Data"
          >
            <RefreshCw className={`size-3.5 ${isLoading ? "animate-spin" : ""}`} />
            <span>Sync</span>
          </button>

          <button
            type="button"
            onClick={() => exportTasksToCsv("BridgeOne_Tasks_Export.csv", tasks)}
            className="h-8 px-2.5 rounded-lg border border-line bg-surface hover:bg-control text-ink text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer transition shadow-2xs"
            title="Export CSV"
          >
            <Download className="size-3.5" />
            <span>Export</span>
          </button>

          <button
            type="button"
            onClick={() => setShowAssignModal(true)}
            className="h-8 px-3.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold inline-flex items-center gap-1.5 shadow-xs cursor-pointer transition active:scale-95"
          >
            <PlusCircle className="size-4" />
            <span>Assign Task</span>
          </button>
        </div>
      </div>

      {/* 5 Static Solid Metric Cards (Stripe / Linear tier) */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3.5">
        <div className="rounded-xl border border-line bg-surface p-4 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-xs text-ink-muted">
            <span className="font-medium">Active Tasks</span>
            <div className="size-2 rounded-full bg-blue-500" />
          </div>
          <div className="text-2xl font-bold tracking-tight text-ink">{summary.pendingActiveTasks}</div>
          <div className="text-[11px] text-ink-muted">Across all teams</div>
        </div>

        <div className="rounded-xl border border-line bg-surface p-4 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-xs text-ink-muted">
            <span className="font-medium">Awaiting Approval</span>
            <div className="size-2 rounded-full bg-amber-500" />
          </div>
          <div className="text-2xl font-bold tracking-tight text-amber-600">{summary.submittedForApprovalTasks}</div>
          <div className="text-[11px] text-ink-muted">Pending supervisor sign-off</div>
        </div>

        <div className="rounded-xl border border-line bg-surface p-4 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-xs text-ink-muted">
            <span className="font-medium">Overdue / Blocked</span>
            <div className="size-2 rounded-full bg-rose-500" />
          </div>
          <div className="text-2xl font-bold tracking-tight text-rose-600">{summary.overdueTasks}</div>
          <div className="text-[11px] text-ink-muted">SLA breach or delay</div>
        </div>

        <div className="rounded-xl border border-line bg-surface p-4 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-xs text-ink-muted">
            <span className="font-medium">Completed</span>
            <div className="size-2 rounded-full bg-emerald-500" />
          </div>
          <div className="text-2xl font-bold tracking-tight text-emerald-600">{summary.completedTasks}</div>
          <div className="text-[11px] text-ink-muted">{summary.completionRatePercent}% completion rate</div>
        </div>

        <div className="rounded-xl border border-line bg-surface p-4 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-xs text-ink-muted">
            <span className="font-medium">Group KPI Avg</span>
            <div className="size-2 rounded-full bg-indigo-500" />
          </div>
          <div className="text-2xl font-bold tracking-tight text-blue-600 dark:text-blue-400">
            {myKpi?.totalKpiScore || 92}%
          </div>
          <div className="text-[11px] font-medium text-emerald-600">{myKpi?.grade || "A+ (Exemplary)"}</div>
        </div>
      </div>

      {actionNotice && (
        <div
          role="status"
          aria-live="polite"
          className="rounded-xl border border-blue-500/30 bg-blue-50 dark:bg-blue-950/40 p-3 text-xs font-semibold text-blue-900 dark:text-blue-200 flex items-center justify-between"
        >
          <span>{actionNotice}</span>
          <button
            type="button"
            onClick={() => setActionNotice(null)}
            className="text-blue-600 hover:text-blue-900 dark:hover:text-blue-100 cursor-pointer text-xs"
          >
            ✕
          </button>
        </div>
      )}

      {/* Modern Segmented Control / Pill Navigation Bar */}
      <div className="space-y-4">
        <div className="bg-control/60 p-1 rounded-xl border border-line flex items-center gap-1 overflow-x-auto text-xs select-none">
          <button
            type="button"
            onClick={() => setActiveTab("my-tasks")}
            className={`h-8 px-3.5 rounded-lg font-semibold inline-flex items-center gap-2 transition cursor-pointer ${
              activeTab === "my-tasks"
                ? "bg-surface text-ink shadow-xs border border-line"
                : "text-ink-muted hover:text-ink"
            }`}
          >
            <ListChecks className="size-4 shrink-0" />
            <span>My Tasks</span>
            <span className="rounded-full bg-slate-200/80 dark:bg-slate-700 text-slate-700 dark:text-slate-300 text-[10px] font-bold px-1.5 py-0.2">
              {myTasks.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("all")}
            className={`h-8 px-3.5 rounded-lg font-semibold inline-flex items-center gap-2 transition cursor-pointer ${
              activeTab === "all"
                ? "bg-surface text-ink shadow-xs border border-line"
                : "text-ink-muted hover:text-ink"
            }`}
          >
            <Users className="size-4 shrink-0" />
            <span>All &amp; Team Tasks</span>
            <span className="rounded-full bg-slate-200/80 dark:bg-slate-700 text-slate-700 dark:text-slate-300 text-[10px] font-bold px-1.5 py-0.2">
              {tasks.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("approvals")}
            className={`h-8 px-3.5 rounded-lg font-semibold inline-flex items-center gap-2 transition cursor-pointer ${
              activeTab === "approvals"
                ? "bg-surface text-ink shadow-xs border border-line"
                : "text-ink-muted hover:text-ink"
            }`}
          >
            <ShieldCheck className="size-4 shrink-0" />
            <span>Approvals &amp; Overdue</span>
            {submittedQueue.length + overdueAndBlocked.length > 0 && (
              <span className="rounded-full bg-amber-500 text-white text-[10px] font-bold px-1.5 py-0.2">
                {submittedQueue.length + overdueAndBlocked.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("daily-report")}
            className={`h-8 px-3.5 rounded-lg font-semibold inline-flex items-center gap-2 transition cursor-pointer ${
              activeTab === "daily-report"
                ? "bg-surface text-ink shadow-xs border border-line"
                : "text-ink-muted hover:text-ink"
            }`}
          >
            <CalendarClock className="size-4 shrink-0" />
            <span>Daily Work Report</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("executive")}
            className={`h-8 px-3.5 rounded-lg font-semibold inline-flex items-center gap-2 transition cursor-pointer ${
              activeTab === "executive"
                ? "bg-surface text-ink shadow-xs border border-line"
                : "text-ink-muted hover:text-ink"
            }`}
          >
            <TrendingUp className="size-4 shrink-0 text-blue-600" />
            <span>Executive &amp; KPI</span>
          </button>
        </div>

        {/* ============================================================== */}
        {/* TAB 1: MY TASKS */}
        {/* ============================================================== */}
        {activeTab === "my-tasks" && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface p-3 text-xs">
              <div className="flex items-center gap-2">
                <span className="font-bold text-ink">Staff Portal:</span>
                <select
                  aria-label="Staff Portal Filter"
                  value={selectedStaff}
                  onChange={(e) => setSelectedStaff(e.target.value)}
                  className="h-8 rounded-lg border border-line bg-control/40 px-2 font-semibold text-ink"
                >
                  {STAFF_DIRECTORY.map((s) => (
                    <option key={s.id} value={s.name}>
                      {s.name} ({s.company} · {s.department})
                    </option>
                  ))}
                  <option value="All">All Staff (Combined View)</option>
                </select>
              </div>
              <span className="text-ink-muted">
                Showing <strong>{myTasks.length}</strong> tasks for {selectedStaff}
              </span>
            </div>

            <div className="space-y-4">
              {myTasks.length === 0 ? (
                <div className="rounded-xl border border-dashed border-line bg-surface p-8 text-center text-xs text-ink-muted">
                  No active tasks assigned to {selectedStaff}.
                </div>
              ) : (
                myTasks.map((task) => (
                  <InteractiveEmployeeTaskCard
                    key={task.id}
                    task={task}
                    activeRole={activeRole}
                    onUpdated={fetchTasks}
                  />
                ))
              )}
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 2: ALL & TEAM TASKS */}
        {/* ============================================================== */}
        {activeTab === "all" && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 rounded-xl border border-line bg-surface p-3 text-xs">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by code, title, staff..."
                className="h-8 rounded-lg border border-line bg-control/40 px-2.5 text-ink"
              />
              <select
                aria-label="Filter All Tasks by Company"
                value={companyFilter}
                onChange={(e) => setCompanyFilter(e.target.value)}
                className="h-8 rounded-lg border border-line bg-control/40 px-2.5 font-semibold text-ink"
              >
                {COMPANIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <select
                aria-label="Filter All Tasks by Department"
                value={deptFilter}
                onChange={(e) => setDeptFilter(e.target.value)}
                className="h-8 rounded-lg border border-line bg-control/40 px-2.5 font-semibold text-ink"
              >
                {DEPARTMENTS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
              <select
                aria-label="Filter All Tasks by Status"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="h-8 rounded-lg border border-line bg-control/40 px-2.5 font-semibold text-ink"
              >
                <option value="All">All Statuses</option>
                <option value="NOT_STARTED">Not Started</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="BLOCKED">Blocked</option>
                <option value="SUBMITTED_FOR_APPROVAL">Submitted for Approval</option>
                <option value="VERIFIED_COMPLETED">Verified Completed</option>
              </select>
            </div>

            <div className="rounded-xl border border-line bg-surface overflow-hidden shadow-2xs">
              <div tabIndex={0} role="region" aria-label="Task List" className="overflow-auto max-h-[500px]">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="sticky top-0 z-10 bg-control text-ink font-bold border-b border-line">
                    <tr>
                      <th className="p-3">Task ID</th>
                      <th className="p-3">Title &amp; Project</th>
                      <th className="p-3">Company / Dept</th>
                      <th className="p-3">Assigned To</th>
                      <th className="p-3">Priority</th>
                      <th className="p-3">Progress</th>
                      <th className="p-3">Deadline</th>
                      <th className="p-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {allFiltered.map((t) => (
                      <tr key={t.id} className="hover:bg-control/30 transition-colors">
                        <td className="p-3 font-mono font-bold text-blue-600 whitespace-nowrap">
                          {t.taskCode}
                        </td>
                        <td className="p-3 max-w-xs">
                          <div className="font-bold text-ink truncate">{t.title}</div>
                          <div className="text-[11px] text-ink-muted truncate">{t.projectName}</div>
                        </td>
                        <td className="p-3 whitespace-nowrap">
                          <span className="font-semibold text-ink">{t.companyName}</span>
                          <span className="text-ink-muted"> · {t.department}</span>
                        </td>
                        <td className="p-3 whitespace-nowrap">
                          <div className="font-semibold text-ink">{t.assignedToName}</div>
                          <div className="text-[11px] text-ink-muted">Sup: {t.reportingToName}</div>
                        </td>
                        <td className="p-3 whitespace-nowrap">
                          <PriorityBadge priority={t.priority} />
                        </td>
                        <td className="p-3 whitespace-nowrap font-mono font-bold text-ink">
                          {t.progressPercent}%
                        </td>
                        <td className="p-3 whitespace-nowrap">
                          <div className={t.isOverdue ? "text-rose-600 font-bold" : "text-ink"}>
                            {formatDateTime(t.deadline)}
                          </div>
                        </td>
                        <td className="p-3 whitespace-nowrap">
                          <StatusBadge status={t.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 3: APPROVALS & OVERDUE */}
        {/* ============================================================== */}
        {activeTab === "approvals" && (
          <div className="space-y-6">
            {/* Approvals Section */}
            <div className="space-y-3">
              <h2 className="text-sm font-bold text-ink flex items-center gap-2">
                <ShieldCheck className="size-4 text-emerald-600" />
                <span>Tasks Awaiting Supervisor Approval ({submittedQueue.length})</span>
              </h2>

              {submittedQueue.length === 0 ? (
                <div className="rounded-xl border border-dashed border-line bg-surface p-6 text-center text-xs text-ink-muted">
                  No tasks currently awaiting approval.
                </div>
              ) : (
                submittedQueue.map((task) => (
                  <div
                    key={task.id}
                    className="rounded-xl border border-amber-400/80 bg-surface p-4 shadow-2xs space-y-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-blue-600">
                          TASK #{task.taskCode}
                        </span>
                        <PriorityBadge priority={task.priority} />
                        <span className="text-xs font-semibold px-2 py-0.5 rounded bg-control text-ink">
                          {task.companyName} · {task.department}
                        </span>
                      </div>
                      <StatusBadge status={task.status} />
                    </div>

                    <div>
                      <h3 className="text-sm font-bold text-ink">{task.title}</h3>
                      <p className="text-xs text-ink-muted mt-0.5">{task.description}</p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 rounded-lg bg-control/40 p-2.5 text-xs">
                      <div>Submitted by: <strong>{task.assignedToName}</strong></div>
                      <div>Supervisor: <strong>{task.reportingToName}</strong></div>
                      <div>Evidence: <strong className="text-emerald-600">{task.evidenceName || "Deliverable_Pack.pdf"}</strong></div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-line text-xs">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-ink mr-1">Quality Rating:</span>
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button
                            key={star}
                            type="button"
                            onClick={() => setRatings((prev) => ({ ...prev, [task.id]: star }))}
                            className={`px-2 py-0.5 rounded border font-bold cursor-pointer transition ${
                              (ratings[task.id] || 5) >= star
                                ? "bg-amber-400/20 text-amber-700 dark:text-amber-300 border-amber-400"
                                : "bg-control border-line text-ink-muted"
                            }`}
                          >
                            ★ {star}
                          </button>
                        ))}
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={busyTaskId === task.id}
                          onClick={() => handleSupervisorApproval(task, "SUPERVISOR_REJECT")}
                          className="h-8 px-3 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold cursor-pointer transition"
                        >
                          Reject
                        </button>
                        <button
                          type="button"
                          disabled={busyTaskId === task.id}
                          onClick={() => handleSupervisorApproval(task, "SUPERVISOR_VERIFY")}
                          className="h-8 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold cursor-pointer transition"
                        >
                          Verify &amp; Approve
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Overdue & Blocked Section */}
            <div className="space-y-3 pt-4 border-t border-line">
              <h2 className="text-sm font-bold text-ink flex items-center gap-2">
                <AlertTriangle className="size-4 text-rose-600" />
                <span>Overdue &amp; Blocked Tasks ({overdueAndBlocked.length})</span>
              </h2>

              <div className="space-y-3">
                {overdueAndBlocked.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-line bg-surface p-6 text-center text-xs text-ink-muted">
                    No overdue or blocked tasks. All deliverables on track!
                  </div>
                ) : (
                  overdueAndBlocked.map((task) => (
                    <div
                      key={task.id}
                      className="rounded-xl border border-rose-300 dark:border-rose-800 bg-surface p-4 space-y-2 shadow-2xs text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-rose-600">TASK #{task.taskCode}</span>
                          <PriorityBadge priority={task.priority} />
                          <span className="font-semibold text-ink">{task.companyName} · {task.department}</span>
                          <EscalationBadge stage={task.computedEscalation} overdueHours={task.overdueHours} />
                        </div>
                        <StatusBadge status={task.status} />
                      </div>

                      <div className="font-bold text-sm text-ink">{task.title}</div>
                      <div className="text-ink-muted">
                        Responsible: <strong>{task.assignedToName}</strong> · Deadline:{" "}
                        <span className="text-rose-600 font-bold">{formatDateTime(task.deadline)}</span>
                      </div>

                      {task.status === "BLOCKED" && (
                        <div className="rounded-lg bg-rose-50 dark:bg-rose-950/30 p-2 text-rose-700 dark:text-rose-300">
                          <strong>Blocker:</strong> {task.blockerReason}
                        </div>
                      )}

                      <div className="flex items-center justify-end gap-2 pt-1">
                        <button
                          type="button"
                          disabled={busyTaskId === task.id}
                          onClick={() => handleSendNudge(task, false)}
                          className="h-7 px-3 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-semibold cursor-pointer"
                        >
                          Send Follow-up ({task.nudgeCount})
                        </button>
                        <button
                          type="button"
                          disabled={busyTaskId === task.id}
                          onClick={() => handleSendNudge(task, true)}
                          className="h-7 px-3 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-semibold cursor-pointer"
                        >
                          Escalate to MD
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 4: DAILY WORK REPORT */}
        {/* ============================================================== */}
        {activeTab === "daily-report" && (
          <div className="space-y-4">
            <form
              onSubmit={handleSubmitDailyReport}
              className="rounded-xl border border-line bg-surface p-5 space-y-4 shadow-2xs text-xs"
            >
              <div className="flex items-center justify-between border-b border-line pb-2">
                <h2 className="font-bold text-sm text-ink">Submit Daily Work Report</h2>
                <label className="flex items-center gap-2 font-semibold text-blue-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={reportOnLeave}
                    onChange={(e) => setReportOnLeave(e.target.checked)}
                    className="accent-blue-600"
                  />
                  <span>Approved HRM Leave (Zero KPI penalty)</span>
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label htmlFor={`${formId}-report-emp`} className="block font-bold text-ink mb-1">
                    Employee
                  </label>
                  <select
                    id={`${formId}-report-emp`}
                    value={selectedStaff}
                    onChange={(e) => setSelectedStaff(e.target.value)}
                    className="w-full h-8 rounded-lg border border-line bg-control/40 px-2 font-semibold text-ink"
                  >
                    {STAFF_DIRECTORY.map((s) => (
                      <option key={s.id} value={s.name}>
                        {s.name} ({s.department})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor={`${formId}-report-hours`} className="block font-bold text-ink mb-1">
                    Hours Logged
                  </label>
                  <input
                    id={`${formId}-report-hours`}
                    type="text"
                    inputMode="decimal"
                    value={reportHours}
                    onChange={(e) => setReportHours(e.target.value)}
                    className="w-full h-8 rounded-lg border border-line bg-control/40 px-2 text-ink"
                  />
                </div>
              </div>

              {!reportOnLeave && (
                <div>
                  <label htmlFor={`${formId}-report-summary`} className="block font-bold text-ink mb-1">
                    Today&apos;s Work Summary
                  </label>
                  <textarea
                    id={`${formId}-report-summary`}
                    rows={3}
                    value={reportNotes}
                    onChange={(e) => setReportNotes(e.target.value)}
                    placeholder="Briefly state key accomplishments, deeds drafted, vouchers cleared..."
                    className="w-full rounded-lg border border-line bg-control/40 p-2.5 text-ink"
                  />
                </div>
              )}

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={isSubmittingReport}
                  className="h-8 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold cursor-pointer transition shadow-xs"
                >
                  {isSubmittingReport ? "Submitting..." : "Submit Daily Report"}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 5: EXECUTIVE & KPI (MD Command & 100-pt Leaderboard) */}
        {/* ============================================================== */}
        {activeTab === "executive" && (
          <div className="space-y-6">
            {/* MD's 3 Golden Reports */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Golden Report 1: Today's Deliverables */}
              <div className="rounded-xl border border-line bg-surface p-4 space-y-3 shadow-2xs">
                <div className="flex items-center justify-between pb-2 border-b border-line">
                  <h3 className="font-bold text-xs text-ink flex items-center gap-1.5">
                    <CheckCheck className="size-4 text-emerald-600" />
                    <span>Verified Deliverables Today</span>
                  </h3>
                  <span className="font-bold text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600">
                    {goldenCompletedToday.length}
                  </span>
                </div>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {goldenCompletedToday.length === 0 ? (
                    <p className="text-xs text-ink-muted text-center py-4">No completed tasks yet today.</p>
                  ) : (
                    goldenCompletedToday.map((t) => (
                      <div key={t.id} className="p-2.5 rounded-lg bg-control/30 text-xs space-y-1">
                        <div className="font-bold text-ink truncate">{t.title}</div>
                        <div className="flex items-center justify-between text-[11px] text-ink-muted">
                          <span>{t.assignedToName} ({t.companyName})</span>
                          <span className="text-emerald-600 font-semibold">100% Verified</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Golden Report 2: Critical Overdue */}
              <div className="rounded-xl border border-rose-300 dark:border-rose-900 bg-surface p-4 space-y-3 shadow-2xs">
                <div className="flex items-center justify-between pb-2 border-b border-line">
                  <h3 className="font-bold text-xs text-rose-700 dark:text-rose-400 flex items-center gap-1.5">
                    <AlertTriangle className="size-4 text-rose-600" />
                    <span>Critical Delays &amp; SLA Alerts</span>
                  </h3>
                  <span className="font-bold text-xs px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-600">
                    {goldenCriticalOverdue.length}
                  </span>
                </div>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {goldenCriticalOverdue.length === 0 ? (
                    <p className="text-xs text-ink-muted text-center py-4">No critical delays. SLA 100% met.</p>
                  ) : (
                    goldenCriticalOverdue.map((t) => (
                      <div key={t.id} className="p-2.5 rounded-lg bg-rose-500/5 border border-rose-500/20 text-xs space-y-1">
                        <div className="font-bold text-ink truncate">{t.title}</div>
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-ink-muted">{t.assignedToName} · {t.department}</span>
                          <span className="text-rose-600 font-bold">{t.overdueHours}h overdue</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Golden Report 3: Decisions Required from MD */}
              <div className="rounded-xl border border-blue-300 dark:border-blue-900 bg-surface p-4 space-y-3 shadow-2xs">
                <div className="flex items-center justify-between pb-2 border-b border-line">
                  <h3 className="font-bold text-xs text-blue-700 dark:text-blue-400 flex items-center gap-1.5">
                    <Sparkles className="size-4 text-blue-600" />
                    <span>Decisions Required from MD</span>
                  </h3>
                  <span className="font-bold text-xs px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600">
                    {goldenDecisionRequired.length}
                  </span>
                </div>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {goldenDecisionRequired.length === 0 ? (
                    <p className="text-xs text-ink-muted text-center py-4">No management interventions required.</p>
                  ) : (
                    goldenDecisionRequired.map((t) => (
                      <div key={t.id} className="p-2.5 rounded-lg bg-blue-500/5 border border-blue-500/20 text-xs space-y-2">
                        <div>
                          <div className="font-bold text-ink">{t.title}</div>
                          <div className="text-[11px] text-ink-muted mt-0.5">
                            Blocker: {t.blockerReason || "Requires MD Decision"}
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <input
                            type="text"
                            placeholder="Directive notes..."
                            value={mdDirectives[t.id] || ""}
                            onChange={(e) => setMdDirectives((prev) => ({ ...prev, [t.id]: e.target.value }))}
                            className="h-7 px-2 text-[11px] rounded border border-line bg-surface flex-1 text-ink"
                          />
                          <button
                            type="button"
                            disabled={busyTaskId === t.id}
                            onClick={() => handleIssueMdDirective(t)}
                            className="h-7 px-2.5 rounded bg-blue-600 hover:bg-blue-700 text-white font-bold text-[10px] cursor-pointer shrink-0"
                          >
                            Unblock
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* 100-Point Employee KPI Leaderboard */}
            <div className="rounded-xl border border-line bg-surface overflow-hidden shadow-2xs space-y-2">
              <div className="p-4 border-b border-line flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-bold text-ink">100-Point Employee Performance Leaderboard</h2>
                  <p className="text-xs text-ink-muted mt-0.5">
                    Weighted KPI Matrix: Task Completion (40%) + SLA Discipline (30%) + Quality Rating (20%) + Daily Reporting (10%).
                  </p>
                </div>
                <Link
                  href={connectPaths.monitoring}
                  className="text-xs font-semibold text-blue-600 hover:underline inline-flex items-center gap-1"
                >
                  <span>Full Executive Command</span>
                  <span>→</span>
                </Link>
              </div>

              <div tabIndex={0} role="region" aria-label="KPI Leaderboard Table" className="overflow-auto max-h-[400px]">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="sticky top-0 z-10 bg-control text-ink font-bold border-b border-line">
                    <tr>
                      <th className="p-3">Rank</th>
                      <th className="p-3">Employee</th>
                      <th className="p-3">Company &amp; Dept</th>
                      <th className="p-3">Completion (40)</th>
                      <th className="p-3">Discipline (30)</th>
                      <th className="p-3">Quality (20)</th>
                      <th className="p-3">Daily Report (10)</th>
                      <th className="p-3">Total Score</th>
                      <th className="p-3">Grade</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {(data?.kpiScorecards || []).map((kpi, idx) => (
                      <tr key={kpi.employeeId} className="hover:bg-control/30 transition-colors">
                        <td className="p-3 font-mono font-bold text-ink-muted">#{idx + 1}</td>
                        <td className="p-3 font-bold text-ink whitespace-nowrap">
                          {kpi.employeeName}
                        </td>
                        <td className="p-3 text-ink-muted whitespace-nowrap">
                          {kpi.companyName} · {kpi.department}
                        </td>
                        <td className="p-3 font-mono text-ink">{kpi.deadlineComplianceScore}/40</td>
                        <td className="p-3 font-mono text-ink">{kpi.qualityApprovalScore}/30</td>
                        <td className="p-3 font-mono text-ink">{kpi.taskImportanceScore}/20</td>
                        <td className="p-3 font-mono text-ink">{kpi.timelyReportingScore}/10</td>
                        <td className="p-3 font-mono font-extrabold text-blue-600 dark:text-blue-400 text-sm">
                          {kpi.totalKpiScore}%
                        </td>
                        <td className="p-3 whitespace-nowrap">
                          <span
                            className={`px-2 py-0.5 rounded font-bold text-[11px] ${
                              kpi.grade.startsWith("A")
                                ? "bg-emerald-500/10 text-emerald-600"
                                : "bg-amber-500/10 text-amber-600"
                            }`}
                          >
                            {kpi.grade}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ============================================================== */}
      {/* IN-PAGE SLICK MODAL: ASSIGN NEW TASK */}
      {/* ============================================================== */}
      {showAssignModal && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-2xl rounded-2xl bg-surface border border-line p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-line">
              <div className="flex items-center gap-2">
                <div className="size-8 rounded-lg bg-blue-600 text-white flex items-center justify-center">
                  <PlusCircle className="size-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-ink">Assign New Task</h3>
                  <p className="text-xs text-ink-muted">Delegate work with SLA deadline and verification requirement.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAssignModal(false)}
                className="text-ink-muted hover:text-ink cursor-pointer p-1 rounded"
              >
                <X className="size-4" />
              </button>
            </div>

            <form onSubmit={handleCreateTask} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label htmlFor={`${formId}-modal-co`} className="block font-bold text-ink mb-1">Company</label>
                  <select
                    id={`${formId}-modal-co`}
                    value={assignCompany}
                    onChange={(e) => {
                      const c = e.target.value;
                      setAssignCompany(c);
                      const projs = PROJECTS_BY_COMPANY[c] || [];
                      if (projs.length > 0) setAssignProject(projs[0]);
                    }}
                    className="w-full h-8 rounded-lg border border-line bg-control/40 px-2 font-semibold text-ink"
                  >
                    <option value="MOHS">MOHS</option>
                    <option value="Mariners">Mariners</option>
                    <option value="Marinozz">Marinozz</option>
                  </select>
                </div>

                <div>
                  <label htmlFor={`${formId}-modal-dept`} className="block font-bold text-ink mb-1">Department</label>
                  <select
                    id={`${formId}-modal-dept`}
                    value={assignDept}
                    onChange={(e) => setAssignDept(e.target.value)}
                    className="w-full h-8 rounded-lg border border-line bg-control/40 px-2 font-semibold text-ink"
                  >
                    {DEPARTMENTS.filter((d) => d !== "All Departments").map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor={`${formId}-modal-proj`} className="block font-bold text-ink mb-1">Project</label>
                  <select
                    id={`${formId}-modal-proj`}
                    value={assignProject}
                    onChange={(e) => setAssignProject(e.target.value)}
                    className="w-full h-8 rounded-lg border border-line bg-control/40 px-2 font-semibold text-ink"
                  >
                    {(PROJECTS_BY_COMPANY[assignCompany] || []).map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor={`${formId}-modal-title`} className="block font-bold text-ink mb-1">Task Title</label>
                <input
                  id={`${formId}-modal-title`}
                  type="text"
                  required
                  placeholder="e.g. Draft Mutation Deed for Sector-B Plots"
                  value={assignTitle}
                  onChange={(e) => setAssignTitle(e.target.value)}
                  className="w-full h-9 rounded-lg border border-line bg-control/40 px-3 text-ink font-medium"
                />
              </div>

              <div>
                <label htmlFor={`${formId}-modal-desc`} className="block font-bold text-ink mb-1">Detailed Description &amp; Instructions</label>
                <textarea
                  id={`${formId}-modal-desc`}
                  rows={3}
                  placeholder="Specific requirements, deliverables, and standards expected..."
                  value={assignDesc}
                  onChange={(e) => setAssignDesc(e.target.value)}
                  className="w-full rounded-lg border border-line bg-control/40 p-2.5 text-ink"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor={`${formId}-modal-staff`} className="block font-bold text-ink mb-1">Assigned Employee</label>
                  <select
                    id={`${formId}-modal-staff`}
                    value={assignStaff}
                    onChange={(e) => {
                      const name = e.target.value;
                      setAssignStaff(name);
                      const match = STAFF_DIRECTORY.find((s) => s.name === name);
                      if (match) setAssignSupervisor(match.supervisor);
                    }}
                    className="w-full h-8 rounded-lg border border-line bg-control/40 px-2 font-semibold text-ink"
                  >
                    {STAFF_DIRECTORY.map((s) => (
                      <option key={s.id} value={s.name}>
                        {s.name} ({s.company} · {s.department})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor={`${formId}-modal-sup`} className="block font-bold text-ink mb-1">Supervisor / Reporting To</label>
                  <input
                    id={`${formId}-modal-sup`}
                    type="text"
                    value={assignSupervisor}
                    onChange={(e) => setAssignSupervisor(e.target.value)}
                    className="w-full h-8 rounded-lg border border-line bg-control/40 px-2 font-semibold text-ink"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label htmlFor={`${formId}-modal-deadline`} className="block font-bold text-ink mb-1">Deadline</label>
                  <input
                    id={`${formId}-modal-deadline`}
                    type="datetime-local"
                    required
                    value={assignDeadline}
                    onChange={(e) => setAssignDeadline(e.target.value)}
                    className="w-full h-8 rounded-lg border border-line bg-control/40 px-2 text-ink"
                  />
                </div>

                <div>
                  <label htmlFor={`${formId}-modal-priority`} className="block font-bold text-ink mb-1">Priority</label>
                  <select
                    id={`${formId}-modal-priority`}
                    value={assignPriority}
                    onChange={(e) => setAssignPriority(e.target.value as TaskPriority)}
                    className="w-full h-8 rounded-lg border border-line bg-control/40 px-2 font-semibold text-ink"
                  >
                    <option value="CRITICAL">Critical (SLA 4h / Weight 1.5x)</option>
                    <option value="HIGH">High (SLA 24h / Weight 1.25x)</option>
                    <option value="MEDIUM">Medium (SLA 48h / Weight 1.0x)</option>
                    <option value="LOW">Low (SLA 72h / Weight 0.8x)</option>
                  </select>
                </div>

                <div>
                  <label htmlFor={`${formId}-modal-rec`} className="block font-bold text-ink mb-1">Recurring Schedule</label>
                  <select
                    id={`${formId}-modal-rec`}
                    value={assignRecurring}
                    onChange={(e) => setAssignRecurring(e.target.value)}
                    className="w-full h-8 rounded-lg border border-line bg-control/40 px-2 font-semibold text-ink"
                  >
                    <option value="ONE_TIME">One-time Task</option>
                    <option value="DAILY">Daily Routine</option>
                    <option value="WEEKLY">Weekly Schedule</option>
                    <option value="MONTHLY">Monthly Audit</option>
                  </select>
                </div>
              </div>

              <div className="rounded-lg bg-control/30 p-2.5 flex items-center justify-between">
                <div>
                  <div className="font-bold text-ink">Verification Required</div>
                  <div className="text-[11px] text-ink-muted">Task only completes after Supervisor approval and deliverable check.</div>
                </div>
                <input
                  type="checkbox"
                  checked={assignVerification}
                  onChange={(e) => setAssignVerification(e.target.checked)}
                  className="size-4 accent-blue-600 cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-line">
                <button
                  type="button"
                  onClick={() => setShowAssignModal(false)}
                  className="h-8 px-3 rounded-lg border border-line bg-surface hover:bg-control text-ink text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingTask}
                  className="h-8 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold inline-flex items-center gap-1.5 shadow-xs cursor-pointer"
                >
                  {isSubmittingTask ? <Loader2 className="size-3.5 animate-spin" /> : <PlusCircle className="size-3.5" />}
                  <span>{isSubmittingTask ? "Creating..." : "Create Task"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
