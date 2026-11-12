"use client";

import React, { useState, useEffect, useCallback, useId } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { connectPaths } from "@/features/connect/paths";
import type {
  ConnectTaskRecord,
  EmployeeKpiScorecard,
  RecurringType,
  TaskPriority,
  TaskStatus,
} from "@/lib/connect/tasks-db";
import {
  type ActiveUserRole,
  COMPANIES,
  DEPARTMENTS,
  PROJECTS_BY_COMPANY,
  STAFF_DIRECTORY,
  TaskModuleHeader,
  InteractiveEmployeeTaskCard,
  StatusBadge,
  PriorityBadge,
  EscalationBadge,
  formatDateTime,
  exportTasksToCsv,
  AlertTriangle,
  Building2,
  CalendarClock,
  CheckCheck,
  CheckCircle2,
  Clock,
  Download,
  FileText,
  LayoutDashboard,
  ListChecks,
  MessageSquare,
  Phone,
  PlusCircle,
  Printer,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Upload,
  Users,
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
  kpiScorecards: EmployeeKpiScorecard[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  dailyReports: any[];
}

export function useTasksPortalData(queryParams = "") {
  const [data, setData] = useState<TasksApiPayload | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeRole, setActiveRole] = useState<ActiveUserRole>("Department Head");

  const fetchAll = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/connect/tasks${queryParams ? `?${queryParams}` : ""}`);
      const json = await res.json();
      if (json.success) {
        setData(json);
      }
    } catch {
      // ignore offline error
    } finally {
      setIsLoading(false);
    }
  }, [queryParams]);

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (active) fetchAll();
    });
    return () => {
      active = false;
    };
  }, [fetchAll]);

  return { data, isLoading, fetchAll, activeRole, setActiveRole };
}

/**
 * 1. MY DASHBOARD (/connect/tasks/dashboard)
 * Personal today's tasks, SLA focus, personal KPI meter, and quick progress updates.
 */
export function MyDashboardView() {
  const { data, isLoading, fetchAll, activeRole, setActiveRole } = useTasksPortalData();
  const [selectedStaff, setSelectedStaff] = useState<string>("Adv. Rafiqul Islam");

  const tasks = data?.tasks || [];
  const myTasks = tasks.filter(
    (t) => selectedStaff === "All" || t.assignedToName.toLowerCase() === selectedStaff.toLowerCase()
  );
  const myKpi =
    data?.kpiScorecards?.find(
      (k) => k.employeeName.toLowerCase() === selectedStaff.toLowerCase()
    ) || data?.kpiScorecards?.[0];

  const myActiveCount = myTasks.filter((t) => t.status !== "VERIFIED_COMPLETED").length;
  const myVerifiedCount = myTasks.filter((t) => t.status === "VERIFIED_COMPLETED").length;
  const myOverdueCount = myTasks.filter((t) => t.isOverdue).length;
  const mySubmittedCount = myTasks.filter((t) => t.status === "SUBMITTED_FOR_APPROVAL").length;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <TaskModuleHeader
        title="My Dashboard — Today's Work & Personal KPI"
        subtitle="Personal daily task command center, SLA countdowns, live progress updates, and 100-point accountability score."
        activeRole={activeRole}
        onRoleChange={setActiveRole}
        onRefresh={fetchAll}
        isLoading={isLoading}
      />

      {/* Employee Selector Bar for testing any staff member's personal portal */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface p-3.5">
        <div className="flex items-center gap-2 text-xs">
          <Users className="size-4 text-blue-600" />
          <span className="font-bold text-ink">Viewing Personal Portal For:</span>
          <select
            aria-label="Select Employee Portal"
            value={selectedStaff}
            onChange={(e) => setSelectedStaff(e.target.value)}
            className="h-8 rounded border border-line bg-control/50 px-2.5 text-xs font-semibold text-ink"
          >
            {STAFF_DIRECTORY.map((emp) => (
              <option key={emp.id} value={emp.name}>
                {emp.name} — {emp.designation} ({emp.company} · {emp.department})
              </option>
            ))}
            <option value="All">All Employees (Combined View)</option>
          </select>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <Link
            href={connectPaths.myTasks}
            className="h-8 px-3 rounded-md border border-line bg-control/50 hover:bg-control text-ink font-semibold inline-flex items-center gap-1.5"
          >
            <ListChecks className="size-3.5 text-blue-600" />
            <span>Open Full Task Cards</span>
          </Link>
          <Link
            href={connectPaths.dailyReport}
            className="h-8 px-3 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white font-semibold inline-flex items-center gap-1.5"
          >
            <CalendarClock className="size-3.5" />
            <span>Submit Daily Work Report</span>
          </Link>
        </div>
      </div>

      {/* 5 Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="rounded-xl border border-line bg-surface p-4 space-y-1">
          <span className="text-xs text-ink-muted font-medium">Assigned Tasks</span>
          <div className="text-2xl font-bold text-ink">{myTasks.length}</div>
          <span className="text-[11px] text-blue-600 font-medium">Active &amp; Completed</span>
        </div>
        <div className="rounded-xl border border-line bg-surface p-4 space-y-1">
          <span className="text-xs text-ink-muted font-medium">Pending / In Progress</span>
          <div className="text-2xl font-bold text-amber-600">{myActiveCount}</div>
          <span className="text-[11px] text-ink-muted">{mySubmittedCount} awaiting supervisor verification</span>
        </div>
        <div className="rounded-xl border border-line bg-surface p-4 space-y-1">
          <span className="text-xs text-ink-muted font-medium">Verified Completed</span>
          <div className="text-2xl font-bold text-emerald-600">{myVerifiedCount}</div>
          <span className="text-[11px] text-emerald-600 font-medium">Supervisor approved</span>
        </div>
        <div className="rounded-xl border border-line bg-surface p-4 space-y-1">
          <span className="text-xs text-ink-muted font-medium">Overdue / Delayed</span>
          <div className="text-2xl font-bold text-rose-600">{myOverdueCount}</div>
          <span className="text-[11px] text-rose-600 font-medium">Requires immediate update</span>
        </div>
        <div className="rounded-xl border border-blue-500/30 bg-blue-600/5 p-4 space-y-1">
          <span className="text-xs text-blue-700 dark:text-blue-300 font-bold">My 100-Point KPI Score</span>
          <div className="text-2xl font-extrabold text-blue-600 dark:text-blue-400">
            {myKpi ? `${myKpi.totalKpiScore} / 100` : "92.0 / 100"}
          </div>
          <span className="text-[11px] font-semibold text-emerald-600 block">
            {myKpi?.grade || "A+ (Exemplary)"}
          </span>
        </div>
      </div>

      {/* Personal KPI Breakdown Bar */}
      {myKpi && (
        <div className="rounded-xl border border-line bg-surface p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-bold text-ink flex items-center gap-2">
                <TrendingUp className="size-4 text-blue-600" />
                <span>My Live Performance Breakdown ({myKpi.employeeName})</span>
              </h2>
              <p className="text-xs text-ink-muted">
                Calculated automatically from Deadline Compliance (40%), Supervisor Quality Rating (30%), Priority-Weighted Achievement (20%), and Daily Reporting (10%).
              </p>
            </div>
            <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
              {myKpi.recommendation}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
            <div className="rounded-lg border border-line bg-control/30 p-3">
              <div className="text-ink-muted">Deadline Compliance (40%)</div>
              <div className="text-lg font-bold text-ink mt-0.5">{myKpi.deadlineComplianceScore} / 40</div>
            </div>
            <div className="rounded-lg border border-line bg-control/30 p-3">
              <div className="text-ink-muted">Quality &amp; Approval (30%)</div>
              <div className="text-lg font-bold text-ink mt-0.5">
                {myKpi.qualityApprovalScore} / 30{" "}
                <span className="text-xs font-semibold text-amber-600">({myKpi.averageQualityRating}★)</span>
              </div>
            </div>
            <div className="rounded-lg border border-line bg-control/30 p-3">
              <div className="text-ink-muted">Priority Weighted (20%)</div>
              <div className="text-lg font-bold text-ink mt-0.5">{myKpi.taskImportanceScore} / 20</div>
            </div>
            <div className="rounded-lg border border-line bg-control/30 p-3">
              <div className="text-ink-muted">Timely Reporting (10%)</div>
              <div className="text-lg font-bold text-ink mt-0.5">{myKpi.timelyReportingScore} / 10</div>
            </div>
          </div>
        </div>
      )}

      {/* Today's Interactive Task Cards */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-ink">
            Today&apos;s Assigned Tasks ({myTasks.length})
          </h2>
          <span className="text-xs text-ink-muted">
            Update progress slider, status, or upload evidence directly below
          </span>
        </div>

        {myTasks.map((task) => (
          <InteractiveEmployeeTaskCard
            key={task.id}
            task={task}
            activeRole={activeRole}
            onUpdated={fetchAll}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * 2. ASSIGN TASK (/connect/tasks/assign)
 * Full Staff Task Assignment Form matching Section 3 of the Master Plan.
 */
export function AssignTaskView() {
  const router = useRouter();
  const formId = useId();
  const [activeRole, setActiveRole] = useState<ActiveUserRole>("Department Head");

  const [companyName, setCompanyName] = useState("MOHS");
  const [department, setDepartment] = useState("Legal");
  const [projectName, setProjectName] = useState("MOHS Venice City Township");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assignedToName, setAssignedToName] = useState("Adv. Rafiqul Islam");
  const [collaboratorNames, setCollaboratorNames] = useState<string[]>(["Nusrat Jahan"]);
  const [assignedByName, setAssignedByName] = useState("Managing Director");
  const [reportingToName, setReportingToName] = useState("Barrister Kamal Hossain (Head of Legal)");
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 16));
  const [deadline, setDeadline] = useState(() => {
    const d = new Date(Date.now() + 6 * 3600 * 1000);
    return d.toISOString().slice(0, 16);
  });
  const [priority, setPriority] = useState<TaskPriority>("HIGH");
  const [attachmentName, setAttachmentName] = useState("");
  const [verificationRequired, setVerificationRequired] = useState(true);
  const [recurringType, setRecurringType] = useState<RecurringType>("ONE_TIME");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdTask, setCreatedTask] = useState<ConnectTaskRecord | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleCompanyChange = (comp: string) => {
    setCompanyName(comp);
    const projs = PROJECTS_BY_COMPANY[comp] || ["General Corporate Operations"];
    setProjectName(projs[0]);
  };

  const handleAssigneeChange = (name: string) => {
    setAssignedToName(name);
    const found = STAFF_DIRECTORY.find((s) => s.name === name);
    if (found) {
      setDepartment(found.department);
      setReportingToName(found.supervisor);
    }
  };

  const toggleCollaborator = (name: string) => {
    setCollaboratorNames((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]
    );
  };

  const handleLoadSampleDraft = () => {
    setCompanyName("MOHS");
    setDepartment("Legal");
    setProjectName("MOHS Venice City Township");
    setTitle("Prepare Tripartite Commercial Plot Allotment & Indemnity Deed");
    setDescription(
      "Draft commercial plot allotment agreement with stamp duty schedule, power of attorney clause, and bank mortgage NOC verification."
    );
    setAssignedToName("Adv. Rafiqul Islam");
    setAssignedByName("Managing Director");
    setReportingToName("Barrister Kamal Hossain (Head of Legal)");
    setPriority("HIGH");
    setVerificationRequired(true);
    setRecurringType("ONE_TIME");
    setAttachmentName("Commercial_Allotment_Guidelines_2026.pdf");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMsg(null);
    setCreatedTask(null);

    const empObj = STAFF_DIRECTORY.find((s) => s.name === assignedToName);
    const collabObjects = collaboratorNames.map((name) => {
      const c = STAFF_DIRECTORY.find((s) => s.name === name);
      return { id: c?.id || name, name, department: c?.department || "General" };
    });

    try {
      const res = await fetch(`/api/connect/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "CREATE_TASK",
          companyName,
          department,
          projectName,
          title,
          description,
          assignedToId: empObj?.id || "emp-assigned",
          assignedToName,
          assignedToDesignation: empObj?.designation || "Executive",
          collaborators: collabObjects,
          assignedByName,
          assignedByRole: activeRole,
          reportingToName,
          startDate,
          deadline,
          priority,
          verificationRequired,
          recurringType,
          attachmentName: attachmentName || null,
          attachmentUrl: attachmentName ? "/connect/docs" : null,
        }),
      });
      const data = await res.json();
      if (data.success && data.task) {
        setCreatedTask(data.task);
        setTitle("");
        setDescription("");
      } else {
        setErrorMsg(data.error || "Failed to assign task");
      }
    } catch {
      setErrorMsg("Network error while creating task");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <TaskModuleHeader
        title="Assign New Task — Staff Task Assignment Form"
        subtitle="Create a uniquely numbered task across Mariners, MOHS, or Marinozz with automatic SLA reminders and supervisor verification."
        activeRole={activeRole}
        onRoleChange={setActiveRole}
      />

      {createdTask && (
        <div
          role="status"
          aria-live="polite"
          className="rounded-xl border border-emerald-300 dark:border-emerald-800 bg-emerald-50/80 dark:bg-emerald-950/40 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
        >
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="size-5 text-emerald-600" />
              <span className="text-sm font-bold text-emerald-900 dark:text-emerald-200">
                Task Assigned &amp; Employee Notified Live!
              </span>
              <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-emerald-600 text-white">
                TASK #{createdTask.taskCode}
              </span>
            </div>
            <p className="text-xs text-emerald-800 dark:text-emerald-300">
              Assigned <strong>{createdTask.title}</strong> to{" "}
              <strong>{createdTask.assignedToName}</strong> ({createdTask.companyName} ·{" "}
              {createdTask.department}) with deadline {formatDateTime(createdTask.deadline)}.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => router.push(connectPaths.myTasks)}
              className="h-8 px-3 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold cursor-pointer"
            >
              View in My Tasks
            </button>
            <button
              type="button"
              onClick={() => router.push(connectPaths.allTasks)}
              className="h-8 px-3 rounded-md border border-emerald-600 text-emerald-800 dark:text-emerald-200 text-xs font-semibold cursor-pointer"
            >
              All Tasks Registry
            </button>
          </div>
        </div>
      )}

      {errorMsg && (
        <div role="alert" className="rounded-lg border border-rose-300 bg-rose-50 p-3 text-xs font-semibold text-rose-800">
          {errorMsg}
        </div>
      )}

      <form onSubmit={handleSubmit} className="rounded-xl border border-line bg-surface p-6 shadow-2xs space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-line">
          <div>
            <h2 className="text-base font-bold text-ink">Section 3 — Official Task Assignment Specification</h2>
            <p className="text-xs text-ink-muted">
              A unique Task ID (e.g., <code className="font-mono font-bold text-blue-600">TASK #LEGAL-2026-XXX</code>) is automatically generated upon submission.
            </p>
          </div>
          <button
            type="button"
            onClick={handleLoadSampleDraft}
            className="h-8 px-3 rounded-md border border-line bg-control/50 hover:bg-control text-ink text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Sparkles className="size-3.5 text-blue-600" />
            <span>Auto-Fill Sample Task</span>
          </button>
        </div>

        {/* Row 1: Company, Department, Project */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label htmlFor={`${formId}-company`} className="block text-xs font-bold text-ink mb-1.5">
              1. Company <span className="text-rose-600">*</span>
            </label>
            <select
              id={`${formId}-company`}
              name="companyName"
              value={companyName}
              onChange={(e) => handleCompanyChange(e.target.value)}
              className="w-full h-9 rounded-md border border-line bg-control/40 px-3 text-xs font-semibold text-ink"
            >
              <option value="Mariners">Mariners</option>
              <option value="MOHS">MOHS</option>
              <option value="Marinozz">Marinozz</option>
            </select>
          </div>

          <div>
            <label htmlFor={`${formId}-dept`} className="block text-xs font-bold text-ink mb-1.5">
              2. Department <span className="text-rose-600">*</span>
            </label>
            <select
              id={`${formId}-dept`}
              name="department"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              className="w-full h-9 rounded-md border border-line bg-control/40 px-3 text-xs font-semibold text-ink"
            >
              {DEPARTMENTS.filter((d) => d !== "All Departments").map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor={`${formId}-project`} className="block text-xs font-bold text-ink mb-1.5">
              3. Associated Project <span className="text-rose-600">*</span>
            </label>
            <input
              id={`${formId}-project`}
              name="projectName"
              list={`${formId}-project-list`}
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              required
              placeholder="Select or type project name..."
              className="w-full h-9 rounded-md border border-line bg-control/40 px-3 text-xs text-ink"
            />
            <datalist id={`${formId}-project-list`}>
              {(PROJECTS_BY_COMPANY[companyName] || []).map((p) => (
                <option key={p} value={p} />
              ))}
            </datalist>
          </div>
        </div>

        {/* Row 2: Task Title & Description */}
        <div className="space-y-4">
          <div>
            <label htmlFor={`${formId}-title`} className="block text-xs font-bold text-ink mb-1.5">
              4. Task Title <span className="text-rose-600">*</span>
            </label>
            <input
              id={`${formId}-title`}
              name="title"
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Prepare Client Investment Deed / Reconcile Monthly Bank Ledger"
              className="w-full h-9 rounded-md border border-line bg-control/40 px-3 text-xs font-medium text-ink"
            />
          </div>

          <div>
            <label htmlFor={`${formId}-desc`} className="block text-xs font-bold text-ink mb-1.5">
              5. Task Description &amp; Detailed Instructions <span className="text-rose-600">*</span>
            </label>
            <textarea
              id={`${formId}-desc`}
              name="description"
              rows={3}
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Provide step-by-step deliverables, compliance checkpoints, and expected output format..."
              className="w-full rounded-md border border-line bg-control/40 p-3 text-xs text-ink"
            />
          </div>
        </div>

        {/* Row 3: Assigned To (Primary Responsible), Assigned By, Reporting To (Supervisor) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label htmlFor={`${formId}-assignee`} className="block text-xs font-bold text-ink mb-1.5">
              6. Assigned To (Primary Responsible Employee) <span className="text-rose-600">*</span>
            </label>
            <select
              id={`${formId}-assignee`}
              name="assignedToName"
              value={assignedToName}
              onChange={(e) => handleAssigneeChange(e.target.value)}
              className="w-full h-9 rounded-md border border-line bg-control/40 px-3 text-xs font-semibold text-ink"
            >
              {STAFF_DIRECTORY.map((emp) => (
                <option key={emp.id} value={emp.name}>
                  {emp.name} ({emp.department} · {emp.company})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor={`${formId}-assigned-by`} className="block text-xs font-bold text-ink mb-1.5">
              7. Assigned By (Manager / MD) <span className="text-rose-600">*</span>
            </label>
            <input
              id={`${formId}-assigned-by`}
              name="assignedByName"
              type="text"
              required
              value={assignedByName}
              onChange={(e) => setAssignedByName(e.target.value)}
              className="w-full h-9 rounded-md border border-line bg-control/40 px-3 text-xs text-ink"
            />
          </div>

          <div>
            <label htmlFor={`${formId}-reporting-to`} className="block text-xs font-bold text-ink mb-1.5">
              8. Reporting To (Responsible Supervisor) <span className="text-rose-600">*</span>
            </label>
            <input
              id={`${formId}-reporting-to`}
              name="reportingToName"
              type="text"
              required
              value={reportingToName}
              onChange={(e) => setReportingToName(e.target.value)}
              className="w-full h-9 rounded-md border border-line bg-control/40 px-3 text-xs text-ink"
            />
          </div>
        </div>

        {/* Supporting Collaborators (Multi-select checkboxes) */}
        <fieldset className="space-y-2">
          <legend className="text-xs font-bold text-ink">
            Supporting Collaborator Staff (Optional — Primary accountability remains with Assigned Employee)
          </legend>
          <div className="flex flex-wrap gap-2">
            {STAFF_DIRECTORY.filter((s) => s.name !== assignedToName).map((emp) => {
              const checked = collaboratorNames.includes(emp.name);
              return (
                <label
                  key={emp.id}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs cursor-pointer transition ${
                    checked
                      ? "border-blue-600 bg-blue-600/10 text-blue-700 dark:text-blue-300 font-semibold"
                      : "border-line bg-control/30 text-ink-muted hover:text-ink"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleCollaborator(emp.name)}
                    className="accent-blue-600"
                  />
                  <span>
                    {emp.name} ({emp.department})
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>

        {/* Row 4: Start Date, Deadline, Attachment */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label htmlFor={`${formId}-start`} className="block text-xs font-bold text-ink mb-1.5">
              9. Start Date &amp; Time <span className="text-rose-600">*</span>
            </label>
            <input
              id={`${formId}-start`}
              name="startDate"
              type="datetime-local"
              required
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full h-9 rounded-md border border-line bg-control/40 px-3 text-xs text-ink"
            />
          </div>

          <div>
            <label htmlFor={`${formId}-deadline`} className="block text-xs font-bold text-ink mb-1.5">
              10. Deadline Date &amp; Time <span className="text-rose-600">*</span>
            </label>
            <input
              id={`${formId}-deadline`}
              name="deadline"
              type="datetime-local"
              required
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className="w-full h-9 rounded-md border border-line bg-control/40 px-3 text-xs text-ink"
            />
          </div>

          <div>
            <label htmlFor={`${formId}-attach`} className="block text-xs font-bold text-ink mb-1.5">
              11. Reference Attachment / Instruction Document
            </label>
            <div className="flex items-center gap-2">
              <label
                htmlFor={`${formId}-attach`}
                className="h-9 px-3 rounded-md border border-line bg-control/40 hover:bg-control text-xs font-semibold text-ink inline-flex items-center gap-1.5 cursor-pointer shrink-0"
              >
                <Upload className="size-3.5 text-blue-600" />
                <span>Choose File</span>
              </label>
              <input
                id={`${formId}-attach`}
                type="file"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) setAttachmentName(f.name);
                }}
                className="sr-only"
              />
              <input
                type="text"
                value={attachmentName}
                onChange={(e) => setAttachmentName(e.target.value)}
                placeholder="Or enter document name..."
                className="w-full h-9 rounded-md border border-line bg-control/40 px-2.5 text-xs text-ink"
              />
            </div>
          </div>
        </div>

        {/* Row 5: Priority (Radio), Verification Required (Radio), Recurring (Radio) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 pt-2 border-t border-line">
          <fieldset className="space-y-1.5">
            <legend className="text-xs font-bold text-ink">
              12. Priority &amp; KPI Weight Multiplier <span className="text-rose-600">*</span>
            </legend>
            <div className="grid grid-cols-2 gap-2 pt-1">
              {(
                [
                  { val: "CRITICAL", label: "Critical (3x KPI)" },
                  { val: "HIGH", label: "High (2x KPI)" },
                  { val: "MEDIUM", label: "Medium (1.5x)" },
                  { val: "LOW", label: "Low (1x KPI)" },
                ] as const
              ).map((p) => (
                <label
                  key={p.val}
                  className={`flex items-center gap-2 rounded-md border px-2.5 py-2 text-xs font-semibold cursor-pointer ${
                    priority === p.val
                      ? "border-blue-600 bg-blue-600/10 text-blue-700 dark:text-blue-300"
                      : "border-line bg-control/30 text-ink"
                  }`}
                >
                  <input
                    type="radio"
                    name="priority"
                    value={p.val}
                    checked={priority === p.val}
                    onChange={() => setPriority(p.val)}
                    className="accent-blue-600"
                  />
                  <span>{p.label}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset className="space-y-1.5">
            <legend className="text-xs font-bold text-ink">
              13. Supervisor Verification Required <span className="text-rose-600">*</span>
            </legend>
            <div className="grid grid-cols-2 gap-2 pt-1">
              <label
                className={`flex items-center gap-2 rounded-md border px-3 py-2 text-xs font-semibold cursor-pointer ${
                  verificationRequired
                    ? "border-emerald-600 bg-emerald-600/10 text-emerald-700 dark:text-emerald-300"
                    : "border-line bg-control/30 text-ink"
                }`}
              >
                <input
                  type="radio"
                  name="verificationRequired"
                  checked={verificationRequired}
                  onChange={() => setVerificationRequired(true)}
                  className="accent-emerald-600"
                />
                <span>Yes (Mandatory Sign-off)</span>
              </label>
              <label
                className={`flex items-center gap-2 rounded-md border px-3 py-2 text-xs font-semibold cursor-pointer ${
                  !verificationRequired
                    ? "border-blue-600 bg-blue-600/10 text-blue-700 dark:text-blue-300"
                    : "border-line bg-control/30 text-ink"
                }`}
              >
                <input
                  type="radio"
                  name="verificationRequired"
                  checked={!verificationRequired}
                  onChange={() => setVerificationRequired(false)}
                  className="accent-blue-600"
                />
                <span>No (Self-Complete)</span>
              </label>
            </div>
            <p className="text-[11px] text-ink-muted">
              When &ldquo;Yes&rdquo;, staff submission enters <strong>Submitted for Approval</strong> until Supervisor verifies.
            </p>
          </fieldset>

          <fieldset className="space-y-1.5">
            <legend className="text-xs font-bold text-ink">
              14. Recurring Schedule <span className="text-rose-600">*</span>
            </legend>
            <div className="grid grid-cols-2 gap-2 pt-1">
              {(
                [
                  { val: "ONE_TIME", label: "One-time" },
                  { val: "DAILY", label: "Daily" },
                  { val: "WEEKLY", label: "Weekly" },
                  { val: "MONTHLY", label: "Monthly" },
                ] as const
              ).map((r) => (
                <label
                  key={r.val}
                  className={`flex items-center gap-2 rounded-md border px-2.5 py-2 text-xs font-semibold cursor-pointer ${
                    recurringType === r.val
                      ? "border-purple-600 bg-purple-600/10 text-purple-700 dark:text-purple-300"
                      : "border-line bg-control/30 text-ink"
                  }`}
                >
                  <input
                    type="radio"
                    name="recurringType"
                    value={r.val}
                    checked={recurringType === r.val}
                    onChange={() => setRecurringType(r.val)}
                    className="accent-purple-600"
                  />
                  <span>{r.label}</span>
                </label>
              ))}
            </div>
          </fieldset>
        </div>

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-line">
          <Link
            href={connectPaths.allTasks}
            className="h-9 px-4 rounded-md border border-line bg-surface hover:bg-control text-xs font-semibold text-ink inline-flex items-center"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={isSubmitting}
            className="h-9 px-5 rounded-md bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold inline-flex items-center gap-2 shadow-xs cursor-pointer"
          >
            <PlusCircle className="size-4" />
            <span>{isSubmitting ? "Assigning & Notifying..." : "Assign Task & Notify Employee"}</span>
          </button>
        </div>
      </form>
    </div>
  );
}

/**
 * 3. MY TASKS (/connect/tasks/my-tasks)
 * Interactive Employee Task Cards with Section 4 Sample (TASK #LEGAL-2026-001) highlighted at top.
 */
export function MyTasksView() {
  const { data, isLoading, fetchAll, activeRole, setActiveRole } = useTasksPortalData();
  const [selectedEmployee, setSelectedEmployee] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");

  const tasks = (data?.tasks || []).filter((t) => {
    if (selectedEmployee !== "All" && t.assignedToName !== selectedEmployee) return false;
    if (statusFilter !== "All" && t.status !== statusFilter) return false;
    return true;
  });

  // Ensure TASK #LEGAL-2026-001 appears first so the user sees their exact sample card immediately
  const sortedTasks = [...tasks].sort((a, b) => {
    if (a.taskCode === "LEGAL-2026-001") return -1;
    if (b.taskCode === "LEGAL-2026-001") return 1;
    return 0;
  });

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <TaskModuleHeader
        title="My Tasks — Staff Daily Work Update Portal"
        subtitle="Update work progress (0%–100%), change task status, attach proof of completion, or submit for supervisor verification."
        activeRole={activeRole}
        onRoleChange={setActiveRole}
        onRefresh={fetchAll}
        isLoading={isLoading}
      />

      {/* Filter Ribbon */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface p-3.5">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="font-bold text-ink">Employee Filter:</span>
          <select
            aria-label="Filter by Employee"
            value={selectedEmployee}
            onChange={(e) => setSelectedEmployee(e.target.value)}
            className="h-8 rounded border border-line bg-control/40 px-2.5 text-xs font-semibold text-ink"
          >
            <option value="All">All Staff Members ({data?.tasks?.length || 0})</option>
            {STAFF_DIRECTORY.map((emp) => (
              <option key={emp.id} value={emp.name}>
                {emp.name} ({emp.department})
              </option>
            ))}
          </select>

          <span className="font-bold text-ink ml-2">Status:</span>
          <select
            aria-label="Filter by Status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-8 rounded border border-line bg-control/40 px-2.5 text-xs font-semibold text-ink"
          >
            <option value="All">All Statuses</option>
            <option value="NOT_STARTED">Not Started</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="BLOCKED">Blocked / Need Support</option>
            <option value="SUBMITTED_FOR_APPROVAL">Submitted for Approval</option>
            <option value="VERIFIED_COMPLETED">Verified Completed</option>
          </select>
        </div>

        <span className="text-xs text-ink-muted">
          Showing <strong>{sortedTasks.length}</strong> interactive Employee Task Cards
        </span>
      </div>

      <div className="space-y-4">
        {sortedTasks.map((task) => (
          <InteractiveEmployeeTaskCard
            key={task.id}
            task={task}
            activeRole={activeRole}
            onUpdated={fetchAll}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * 4. TEAM TASKS (/connect/tasks/team)
 * Subordinate staff workload matrix & departmental progress oversight.
 */
export function TeamTasksView() {
  const { data, isLoading, fetchAll, activeRole, setActiveRole } = useTasksPortalData();
  const [selectedDept, setSelectedDept] = useState("All Departments");
  const [selectedCompany, setSelectedCompany] = useState("All Companies");

  const tasks = (data?.tasks || []).filter((t) => {
    if (selectedCompany !== "All Companies" && t.companyName !== selectedCompany) return false;
    if (selectedDept !== "All Departments" && t.department !== selectedDept) return false;
    return true;
  });

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <TaskModuleHeader
        title="Team Tasks — Subordinate Workload & Departmental Supervision"
        subtitle="Monitor subordinate staff assignments, workload balance, progress velocity, and departmental bottlenecks."
        activeRole={activeRole}
        onRoleChange={setActiveRole}
        onRefresh={fetchAll}
        isLoading={isLoading}
      />

      {/* Company & Department Filters */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface p-3.5">
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-ink">Company:</span>
            <select
              aria-label="Filter by Company"
              value={selectedCompany}
              onChange={(e) => setSelectedCompany(e.target.value)}
              className="h-8 rounded border border-line bg-control/40 px-2.5 font-semibold text-ink"
            >
              {COMPANIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="font-bold text-ink">Department:</span>
            <select
              aria-label="Filter by Department"
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              className="h-8 rounded border border-line bg-control/40 px-2.5 font-semibold text-ink"
            >
              {DEPARTMENTS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>
        </div>

        <button
          type="button"
          onClick={() => exportTasksToCsv("team-tasks", tasks)}
          className="h-8 px-3 rounded-md border border-line bg-surface hover:bg-control text-xs font-semibold text-ink inline-flex items-center gap-1.5 cursor-pointer"
        >
          <Download className="size-3.5 text-blue-600" />
          <span>Export Team CSV</span>
        </button>
      </div>

      {/* Subordinate Staff Workload Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {(data?.kpiScorecards || [])
          .filter(
            (s) =>
              (selectedCompany === "All Companies" || s.companyName === selectedCompany) &&
              (selectedDept === "All Departments" || s.department === selectedDept)
          )
          .map((member) => (
            <div
              key={member.employeeName}
              className="rounded-xl border border-line bg-surface p-4 space-y-3 shadow-2xs"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-sm font-bold text-ink">{member.employeeName}</h3>
                  <p className="text-xs text-ink-muted">
                    {member.designation} · {member.companyName} ({member.department})
                  </p>
                </div>
                <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-blue-600/10 text-blue-600 dark:text-blue-400">
                  KPI {member.totalKpiScore}%
                </span>
              </div>

              <div className="grid grid-cols-4 gap-2 text-center text-xs">
                <div className="rounded bg-control/40 p-1.5">
                  <div className="font-bold text-ink">{member.totalTasks}</div>
                  <div className="text-[10px] text-ink-muted">Total</div>
                </div>
                <div className="rounded bg-emerald-500/10 p-1.5">
                  <div className="font-bold text-emerald-600">{member.verifiedCompletedTasks}</div>
                  <div className="text-[10px] text-ink-muted">Verified</div>
                </div>
                <div className="rounded bg-amber-500/10 p-1.5">
                  <div className="font-bold text-amber-600">{member.submittedTasks}</div>
                  <div className="text-[10px] text-ink-muted">Review</div>
                </div>
                <div className="rounded bg-rose-500/10 p-1.5">
                  <div className="font-bold text-rose-600">{member.overdueTasks}</div>
                  <div className="text-[10px] text-ink-muted">Overdue</div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-line text-xs">
                <span className="text-ink-muted">Avg Quality: {member.averageQualityRating}★</span>
                <div className="flex items-center gap-2">
                  <Link
                    href={connectPaths.chat}
                    className="text-blue-600 hover:underline font-semibold inline-flex items-center gap-1"
                  >
                    <MessageSquare className="size-3" />
                    <span>Message</span>
                  </Link>
                  <Link
                    href={connectPaths.taskApproval}
                    className="text-emerald-600 hover:underline font-semibold inline-flex items-center gap-1"
                  >
                    <ShieldCheck className="size-3" />
                    <span>Review</span>
                  </Link>
                </div>
              </div>
            </div>
          ))}
      </div>

      {/* Team Tasks Table (Responsive table per modern-web-guidance `responsive-table`) */}
      <div className="rounded-xl border border-line bg-surface overflow-hidden shadow-2xs">
        <div className="p-4 border-b border-line flex items-center justify-between">
          <h2 id="team-tasks-caption" className="text-sm font-bold text-ink">
            Subordinate Task Execution Matrix ({tasks.length})
          </h2>
          <span className="text-xs text-ink-muted">Scroll horizontally on narrow viewports</span>
        </div>
        <div
          tabIndex={0}
          role="region"
          aria-labelledby="team-tasks-caption"
          className="overflow-auto max-h-[540px] max-w-full"
        >
          <table className="w-full text-left border-collapse text-xs">
            <thead className="sticky top-0 z-10 bg-control text-ink font-bold border-b border-line">
              <tr>
                <th className="p-3">Task ID</th>
                <th className="p-3">Task &amp; Project</th>
                <th className="p-3">Company / Dept</th>
                <th className="p-3">Responsible Staff</th>
                <th className="p-3">Priority</th>
                <th className="p-3">Progress</th>
                <th className="p-3">Deadline &amp; SLA</th>
                <th className="p-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {tasks.map((t) => (
                <tr key={t.id} className="hover:bg-control/30 transition">
                  <th scope="row" className="p-3 font-mono font-bold text-blue-600 dark:text-blue-400 whitespace-nowrap bg-surface sticky left-0">
                    {t.taskCode}
                  </th>
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
                    <div className="text-[11px] text-ink-muted">Reports to: {t.reportingToName}</div>
                  </td>
                  <td className="p-3 whitespace-nowrap">
                    <PriorityBadge priority={t.priority} />
                  </td>
                  <td className="p-3 whitespace-nowrap w-32">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-20 rounded-full bg-control overflow-hidden">
                        <div
                          className="h-full bg-blue-600"
                          style={{ width: `${t.progressPercent}%` }}
                        />
                      </div>
                      <span className="font-mono font-bold text-ink">{t.progressPercent}%</span>
                    </div>
                  </td>
                  <td className="p-3 whitespace-nowrap">
                    <div className={t.isOverdue ? "text-rose-600 font-bold" : "text-ink"}>
                      {formatDateTime(t.deadline)}
                    </div>
                    <EscalationBadge stage={t.computedEscalation} overdueHours={t.overdueHours} />
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
  );
}

/**
 * 5. ALL TASKS (/connect/tasks/all)
 * Master Enterprise Task Registry with Governance Edit (Deadline Change, Reassign, Cancel -> Audit Log).
 */
export function AllTasksView() {
  const { data, isLoading, fetchAll, activeRole, setActiveRole } = useTasksPortalData();
  const [companyFilter, setCompanyFilter] = useState("All Companies");
  const [deptFilter, setDeptFilter] = useState("All Departments");
  const [statusFilter, setStatusFilter] = useState("All");
  const [priorityFilter, setPriorityFilter] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");

  // Governance Edit Modal (tracks Deadline Change, Assignment Change, Task Cancel in Audit History)
  const [editingTask, setEditingTask] = useState<ConnectTaskRecord | null>(null);
  const [editAssignee, setEditAssignee] = useState("");
  const [editDeadline, setEditDeadline] = useState("");
  const [editReason, setEditReason] = useState("");
  const [editError, setEditError] = useState<string | null>(null);
  const [isSavingGov, setIsSavingGov] = useState(false);

  const filtered = (data?.tasks || []).filter((t) => {
    if (companyFilter !== "All Companies" && t.companyName !== companyFilter) return false;
    if (deptFilter !== "All Departments" && t.department !== deptFilter) return false;
    if (statusFilter !== "All" && t.status !== statusFilter) return false;
    if (priorityFilter !== "All" && t.priority !== priorityFilter) return false;
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

  const openGovernanceModal = (task: ConnectTaskRecord) => {
    setEditingTask(task);
    setEditAssignee(task.assignedToName);
    setEditDeadline(new Date(task.deadline).toISOString().slice(0, 16));
    setEditReason("");
    setEditError(null);
  };

  const handleGovernanceSave = async (e: React.FormEvent, cancelTask = false) => {
    e.preventDefault();
    if (!editingTask) return;
    setIsSavingGov(true);
    setEditError(null);
    try {
      const res = await fetch(`/api/connect/tasks/${editingTask.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mutationType: "GOVERNANCE_EDIT",
          actorName: activeRole,
          actorRole: activeRole,
          assignedToName: editAssignee,
          deadline: editDeadline,
          cancelTask,
          reason: editReason || "Administrative governance update",
        }),
      });
      const json = await res.json();
      if (json.success) {
        setEditingTask(null);
        fetchAll();
      } else {
        setEditError(json.error || "Permission denied");
      }
    } finally {
      setIsSavingGov(false);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <TaskModuleHeader
        title="All Tasks — Master Group Task Registry"
        subtitle="Centralized registry of all approved tasks across Mariners, MOHS, and Marinozz with immutable audit tracking."
        activeRole={activeRole}
        onRoleChange={setActiveRole}
        onRefresh={fetchAll}
        isLoading={isLoading}
        rightActions={
          <button
            type="button"
            onClick={() => exportTasksToCsv("bridgeone-all-tasks", filtered)}
            className="h-8 px-3 rounded-md border border-line bg-surface hover:bg-control text-xs font-semibold text-ink inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Download className="size-3.5 text-blue-600" />
            <span>Export CSV</span>
          </button>
        }
      />

      {/* Multi-Filter Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 rounded-xl border border-line bg-surface p-3.5 text-xs">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search Task ID, title, staff, project..."
          aria-label="Search Tasks"
          className="h-8 rounded border border-line bg-control/40 px-2.5 text-ink"
        />
        <select
          aria-label="Filter by Company"
          value={companyFilter}
          onChange={(e) => setCompanyFilter(e.target.value)}
          className="h-8 rounded border border-line bg-control/40 px-2.5 font-semibold text-ink"
        >
          {COMPANIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select
          aria-label="Filter by Department"
          value={deptFilter}
          onChange={(e) => setDeptFilter(e.target.value)}
          className="h-8 rounded border border-line bg-control/40 px-2.5 font-semibold text-ink"
        >
          {DEPARTMENTS.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
        <select
          aria-label="Filter by Priority"
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value)}
          className="h-8 rounded border border-line bg-control/40 px-2.5 font-semibold text-ink"
        >
          <option value="All">All Priorities</option>
          <option value="CRITICAL">Critical (3x)</option>
          <option value="HIGH">High (2x)</option>
          <option value="MEDIUM">Medium (1.5x)</option>
          <option value="LOW">Low (1x)</option>
        </select>
        <select
          aria-label="Filter by Status"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="h-8 rounded border border-line bg-control/40 px-2.5 font-semibold text-ink"
        >
          <option value="All">All Statuses</option>
          <option value="NOT_STARTED">Not Started</option>
          <option value="IN_PROGRESS">In Progress</option>
          <option value="BLOCKED">Blocked</option>
          <option value="SUBMITTED_FOR_APPROVAL">Submitted for Approval</option>
          <option value="VERIFIED_COMPLETED">Verified Completed</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
      </div>

      {/* Governance Modal for Deadline / Assignment / Cancel (Section 10 Audit History) */}
      {editingTask && (
        <form
          onSubmit={(e) => handleGovernanceSave(e, false)}
          className="rounded-xl border-2 border-blue-600 bg-surface p-5 shadow-lg space-y-4"
        >
          <div className="flex items-center justify-between border-b border-line pb-2">
            <div>
              <span className="text-xs font-bold uppercase text-blue-600">
                Governance &amp; Audit-Tracked Modification
              </span>
              <h3 className="text-sm font-bold text-ink">
                Modify {editingTask.taskCode} — {editingTask.title}
              </h3>
            </div>
            <button
              type="button"
              onClick={() => setEditingTask(null)}
              className="text-xs text-ink-muted hover:text-ink cursor-pointer"
            >
              ✕ Close
            </button>
          </div>

          {editError && (
            <div role="alert" className="rounded border border-rose-300 bg-rose-50 p-2.5 text-xs font-semibold text-rose-800">
              {editError}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="block font-bold text-ink mb-1">Reassign Responsible Staff</label>
              <select
                value={editAssignee}
                onChange={(e) => setEditAssignee(e.target.value)}
                className="w-full h-8 rounded border border-line bg-control/40 px-2 text-ink font-semibold"
              >
                {STAFF_DIRECTORY.map((s) => (
                  <option key={s.id} value={s.name}>
                    {s.name} ({s.department})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-bold text-ink mb-1">Modify Official Deadline</label>
              <input
                type="datetime-local"
                value={editDeadline}
                onChange={(e) => setEditDeadline(e.target.value)}
                className="w-full h-8 rounded border border-line bg-control/40 px-2 text-ink"
              />
            </div>
            <div>
              <label className="block font-bold text-ink mb-1">
                Mandatory Audit Reason <span className="text-rose-600">*</span>
              </label>
              <input
                type="text"
                required
                value={editReason}
                onChange={(e) => setEditReason(e.target.value)}
                placeholder="Logged permanently in Task Settings -> Audit History"
                className="w-full h-8 rounded border border-line bg-control/40 px-2 text-ink"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              disabled={isSavingGov}
              onClick={(e) => handleGovernanceSave(e, true)}
              className="h-8 px-3 rounded bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold cursor-pointer"
            >
              Cancel Task (Audit Logged)
            </button>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setEditingTask(null)}
                className="h-8 px-3 rounded border border-line text-xs text-ink cursor-pointer"
              >
                Close
              </button>
              <button
                type="submit"
                disabled={isSavingGov}
                className="h-8 px-4 rounded bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold cursor-pointer"
              >
                {isSavingGov ? "Saving..." : "Save & Write Audit Log"}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Master Responsive Table */}
      <div className="rounded-xl border border-line bg-surface overflow-hidden shadow-2xs">
        <div
          tabIndex={0}
          role="region"
          aria-label="Master Enterprise Task Registry"
          className="overflow-auto max-h-[600px] max-w-full"
        >
          <table className="w-full text-left border-collapse text-xs">
            <thead className="sticky top-0 z-10 bg-control text-ink font-bold border-b border-line">
              <tr>
                <th className="p-3">Task ID</th>
                <th className="p-3">Company &amp; Dept</th>
                <th className="p-3">Task Title &amp; Project</th>
                <th className="p-3">Assigned To</th>
                <th className="p-3">Priority</th>
                <th className="p-3">Progress</th>
                <th className="p-3">Deadline &amp; Escalation</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-right">Governance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {filtered.map((t) => (
                <tr key={t.id} className="hover:bg-control/30 transition">
                  <th scope="row" className="p-3 font-mono font-bold text-blue-600 dark:text-blue-400 whitespace-nowrap bg-surface sticky left-0">
                    {t.taskCode}
                  </th>
                  <td className="p-3 whitespace-nowrap">
                    <div className="font-bold text-ink">{t.companyName}</div>
                    <div className="text-[11px] text-ink-muted">{t.department}</div>
                  </td>
                  <td className="p-3 max-w-xs">
                    <div className="font-bold text-ink truncate">{t.title}</div>
                    <div className="text-[11px] text-ink-muted truncate">{t.projectName}</div>
                  </td>
                  <td className="p-3 whitespace-nowrap">
                    <div className="font-semibold text-ink">{t.assignedToName}</div>
                    <div className="text-[11px] text-ink-muted">Sup: {t.reportingToName}</div>
                  </td>
                  <td className="p-3 whitespace-nowrap">
                    <PriorityBadge priority={t.priority} showWeight />
                  </td>
                  <td className="p-3 whitespace-nowrap">
                    <span className="font-mono font-bold text-ink">{t.progressPercent}%</span>
                  </td>
                  <td className="p-3 whitespace-nowrap">
                    <div className={t.isOverdue ? "text-rose-600 font-bold" : "text-ink"}>
                      {formatDateTime(t.deadline)}
                    </div>
                    <EscalationBadge stage={t.computedEscalation} overdueHours={t.overdueHours} />
                  </td>
                  <td className="p-3 whitespace-nowrap">
                    <StatusBadge status={t.status} />
                  </td>
                  <td className="p-3 whitespace-nowrap text-right">
                    <button
                      type="button"
                      onClick={() => openGovernanceModal(t)}
                      className="h-7 px-2.5 rounded border border-line bg-control/50 hover:bg-control text-[11px] font-semibold text-ink cursor-pointer"
                    >
                      Reassign / Deadline
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/**
 * 6. DAILY WORK REPORT (/connect/tasks/daily-report)
 * Staff daily work report submission & auto-compiled log register (with Approved Leave protection).
 */
export function DailyWorkReportView() {
  const { data, isLoading, fetchAll, activeRole, setActiveRole } = useTasksPortalData();
  const formId = useId();

  const [employeeName, setEmployeeName] = useState("Adv. Rafiqul Islam");
  const [companyName, setCompanyName] = useState("MOHS");
  const [department, setDepartment] = useState("Legal");
  const [hoursLogged, setHoursLogged] = useState("8.5");
  const [tasksWorkedCount, setTasksWorkedCount] = useState("2");
  const [tasksCompletedCount, setTasksCompletedCount] = useState("1");
  const [summaryNotes, setSummaryNotes] = useState("");
  const [achievements, setAchievements] = useState("");
  const [blockersReported, setBlockersReported] = useState("None");
  const [nextDayPlan, setNextDayPlan] = useState("");
  const [onApprovedLeave, setOnApprovedLeave] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedBanner, setSubmittedBanner] = useState(false);

  const handleStaffSelect = (name: string) => {
    setEmployeeName(name);
    const emp = STAFF_DIRECTORY.find((s) => s.name === name);
    if (emp) {
      setCompanyName(emp.company);
      setDepartment(emp.department);
    }
  };

  const handleSubmitReport = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmittedBanner(false);
    const emp = STAFF_DIRECTORY.find((s) => s.name === employeeName);
    try {
      const res = await fetch(`/api/connect/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "SUBMIT_DAILY_REPORT",
          employeeName,
          companyName,
          department,
          designation: emp?.designation || "Executive",
          hoursLogged: Number(hoursLogged),
          tasksWorkedCount: Number(tasksWorkedCount),
          tasksCompletedCount: Number(tasksCompletedCount),
          summaryNotes: onApprovedLeave ? "On Approved HRM Leave — KPI Protected" : summaryNotes,
          achievements,
          blockersReported,
          nextDayPlan,
          onApprovedLeave,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setSubmittedBanner(true);
        setSummaryNotes("");
        setAchievements("");
        setNextDayPlan("");
        fetchAll();
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <TaskModuleHeader
        title="Daily Work Report — Staff End-of-Day Submission & Register"
        subtitle="Contributes 10% to the Employee Performance KPI Scorecard. Approved Leave days are automatically exempted from KPI penalty."
        activeRole={activeRole}
        onRoleChange={setActiveRole}
        onRefresh={fetchAll}
        isLoading={isLoading}
      />

      {submittedBanner && (
        <div
          role="status"
          aria-live="polite"
          className="rounded-xl border border-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 p-3.5 text-xs font-semibold text-emerald-800 dark:text-emerald-200"
        >
          ✓ Daily Work Report submitted and credited toward Timely Reporting &amp; Communication KPI (10%).
        </div>
      )}

      {/* Submit Daily Report Form */}
      <form onSubmit={handleSubmitReport} className="rounded-xl border border-line bg-surface p-5 space-y-4 shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-3">
          <h2 className="text-sm font-bold text-ink">Submit Today&apos;s Work Report</h2>
          <label className="inline-flex items-center gap-2 text-xs font-semibold text-blue-600 cursor-pointer">
            <input
              type="checkbox"
              checked={onApprovedLeave}
              onChange={(e) => setOnApprovedLeave(e.target.checked)}
              className="accent-blue-600 size-4"
            />
            <span>Mark as Approved HRM Leave Today (Zero KPI Penalty)</span>
          </label>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs">
          <div className="lg:col-span-2">
            <label htmlFor={`${formId}-emp`} className="block font-bold text-ink mb-1">
              Staff Member
            </label>
            <select
              id={`${formId}-emp`}
              value={employeeName}
              onChange={(e) => handleStaffSelect(e.target.value)}
              className="w-full h-8 rounded border border-line bg-control/40 px-2 font-semibold text-ink"
            >
              {STAFF_DIRECTORY.map((s) => (
                <option key={s.id} value={s.name}>
                  {s.name} ({s.company} · {s.department})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor={`${formId}-hrs`} className="block font-bold text-ink mb-1">
              Hours Logged
            </label>
            <input
              id={`${formId}-hrs`}
              type="text"
              inputMode="decimal"
              value={hoursLogged}
              onChange={(e) => setHoursLogged(e.target.value)}
              className="w-full h-8 rounded border border-line bg-control/40 px-2 text-ink"
            />
          </div>
          <div>
            <label htmlFor={`${formId}-worked`} className="block font-bold text-ink mb-1">
              Tasks Worked On
            </label>
            <input
              id={`${formId}-worked`}
              type="text"
              inputMode="numeric"
              value={tasksWorkedCount}
              onChange={(e) => setTasksWorkedCount(e.target.value)}
              className="w-full h-8 rounded border border-line bg-control/40 px-2 text-ink"
            />
          </div>
          <div>
            <label htmlFor={`${formId}-comp`} className="block font-bold text-ink mb-1">
              Tasks Completed
            </label>
            <input
              id={`${formId}-comp`}
              type="text"
              inputMode="numeric"
              value={tasksCompletedCount}
              onChange={(e) => setTasksCompletedCount(e.target.value)}
              className="w-full h-8 rounded border border-line bg-control/40 px-2 text-ink"
            />
          </div>
        </div>

        {!onApprovedLeave && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <div>
              <label htmlFor={`${formId}-sum`} className="block font-bold text-ink mb-1">
                Daily Work Summary <span className="text-rose-600">*</span>
              </label>
              <textarea
                id={`${formId}-sum`}
                rows={2}
                required={!onApprovedLeave}
                value={summaryNotes}
                onChange={(e) => setSummaryNotes(e.target.value)}
                placeholder="Summarize key tasks executed today..."
                className="w-full rounded border border-line bg-control/40 p-2 text-ink"
              />
            </div>
            <div>
              <label htmlFor={`${formId}-ach`} className="block font-bold text-ink mb-1">
                Key Deliverables / Achievements
              </label>
              <textarea
                id={`${formId}-ach`}
                rows={2}
                value={achievements}
                onChange={(e) => setAchievements(e.target.value)}
                placeholder="Deeds drafted, vouchers reconciled, client handovers..."
                className="w-full rounded border border-line bg-control/40 p-2 text-ink"
              />
            </div>
            <div>
              <label htmlFor={`${formId}-plan`} className="block font-bold text-ink mb-1">
                Next Working Day Plan &amp; Blockers
              </label>
              <textarea
                id={`${formId}-plan`}
                rows={2}
                value={nextDayPlan}
                onChange={(e) => setNextDayPlan(e.target.value)}
                placeholder="Priority targets for tomorrow..."
                className="w-full rounded border border-line bg-control/40 p-2 text-ink"
              />
            </div>
          </div>
        )}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isSubmitting}
            className="h-8 px-4 rounded-md bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold cursor-pointer"
          >
            {isSubmitting ? "Submitting..." : "Submit Daily Work Report"}
          </button>
        </div>
      </form>

      {/* Submitted Daily Work Reports Feed */}
      <div className="space-y-3">
        <h2 className="text-sm font-bold text-ink">
          Submitted Daily Work Reports ({data?.dailyReports?.length || 0})
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(data?.dailyReports || []).map((rep) => (
            <div
              key={rep.id}
              className="rounded-xl border border-line bg-surface p-4 space-y-2 shadow-2xs text-xs"
            >
              <div className="flex items-center justify-between border-b border-line pb-2">
                <div>
                  <span className="font-bold text-sm text-ink">{rep.employee_name}</span>
                  <span className="text-ink-muted block">
                    {rep.designation} · {rep.company_name} ({rep.department})
                  </span>
                </div>
                {rep.on_approved_leave ? (
                  <span className="px-2 py-0.5 rounded bg-purple-500/10 text-purple-700 dark:text-purple-300 font-bold">
                    Approved Leave (KPI Exempt)
                  </span>
                ) : (
                  <span className="font-mono font-bold text-emerald-600">
                    {rep.hours_logged}h · {rep.tasks_completed_count}/{rep.tasks_worked_count} Completed
                  </span>
                )}
              </div>
              <p className="text-ink leading-relaxed">{rep.summary_notes}</p>
              {rep.achievements && (
                <div className="text-emerald-700 dark:text-emerald-300">
                  <strong>Achievements:</strong> {rep.achievements}
                </div>
              )}
              {rep.blockers_reported && rep.blockers_reported !== "None" && (
                <div className="text-rose-600 dark:text-rose-400">
                  <strong>Blocker:</strong> {rep.blockers_reported}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

