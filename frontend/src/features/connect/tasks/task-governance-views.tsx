"use client";

import React, { useState, useEffect, useCallback, useId } from "react";
import Link from "next/link";
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
  STAFF_DIRECTORY,
  TaskModuleHeader,
  StatusBadge,
  PriorityBadge,
  EscalationBadge,
  formatDateTime,
  exportTasksToCsv,
  AlertTriangle,
  BellRing,
  Building2,
  CheckCheck,
  CheckCircle2,
  Clock,
  Download,
  Flame,
  MessageSquare,
  Phone,
  PlusCircle,
  Printer,
  Repeat,
  Send,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Star,
  TrendingUp,
  Video,
} from "./task-ui-shared";

interface FullGovernanceData {
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
  goldenReports: {
    todaysCompletedTasks: ConnectTaskRecord[];
    criticalOverdueTasks: ConnectTaskRecord[];
    managementDecisionRequiredTasks: ConnectTaskRecord[];
  };
  kpiScorecards: EmployeeKpiScorecard[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  recurringTemplates: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  extensionRequests: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  auditLogs: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  settings: any;
}

function useGovernanceData() {
  const [data, setData] = useState<FullGovernanceData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeRole, setActiveRole] = useState<ActiveUserRole>("Managing Director");

  const fetchAll = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/connect/tasks");
      const json = await res.json();
      if (json.success) {
        setData(json);
      }
    } catch {
      // ignore offline
    } finally {
      setIsLoading(false);
    }
  }, []);

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
 * 7. PENDING & OVERDUE (/connect/tasks/overdue)
 * Central Monitoring Control Tower + Automatic Follow-up & Escalation Engine + CMO Follow-up Nudge.
 */
export function PendingOverdueView() {
  const { data, isLoading, fetchAll, activeRole, setActiveRole } = useGovernanceData();
  const [companyFilter, setCompanyFilter] = useState("All Companies");
  const [nudgeStatus, setNudgeStatus] = useState<string | null>(null);
  const [busyTaskId, setBusyTaskId] = useState<string | null>(null);

  const allTasks = data?.tasks || [];
  const attentionTasks = allTasks.filter((t) => {
    if (t.status === "VERIFIED_COMPLETED" || t.status === "CANCELLED") return false;
    if (companyFilter !== "All Companies" && t.companyName !== companyFilter) return false;
    return true;
  });

  const handleSendCmoNudge = async (task: ConnectTaskRecord, escalateToMd = false) => {
    setBusyTaskId(task.id);
    setNudgeStatus(null);
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
            ? `Escalated [${task.taskCode}] (${task.companyName} · ${task.department}) to MD Golden Report due to critical delay/blocker.`
            : `Central Monitoring Follow-up Reminder sent to ${task.assignedToName} and Supervisor ${task.reportingToName}.`,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setNudgeStatus(
          escalateToMd
            ? `🚨 Escalated ${task.taskCode} to MD Golden Report #3!`
            : `⏰ Follow-up reminder sent to ${task.assignedToName} (Nudge #${json.task.nudgeCount}).`
        );
        fetchAll();
      }
    } finally {
      setBusyTaskId(null);
    }
  };

  const handleVerifyBlocker = async (task: ConnectTaskRecord) => {
    setBusyTaskId(task.id);
    try {
      const res = await fetch(`/api/connect/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mutationType: "VERIFY_BLOCKER",
          actorName: activeRole,
          actorRole: activeRole,
          blockerVerified: true,
        }),
      });
      if (res.ok) {
        setNudgeStatus(
          `✓ Verified external blocker on ${task.taskCode}. ${task.assignedToName}'s KPI is protected from overdue penalty.`
        );
        fetchAll();
      }
    } finally {
      setBusyTaskId(null);
    }
  };

  const handleReviewExtension = async (requestId: string, decision: "APPROVED" | "REJECTED") => {
    await fetch("/api/connect/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "REVIEW_EXTENSION_REQUEST",
        requestId,
        decision,
        reviewerName: activeRole,
        reviewRemarks: `${decision} by ${activeRole}`,
      }),
    });
    setNudgeStatus(`Deadline extension request ${decision.toLowerCase()} (logged in Audit History).`);
    fetchAll();
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <TaskModuleHeader
        title="Pending, Overdue & Blocked — Central Monitoring Control Tower"
        subtitle="Automatic SLA follow-up engine, multi-tier escalation alerts, inter-departmental blocker verification, and Central Monitoring Officer nudges."
        activeRole={activeRole}
        onRoleChange={setActiveRole}
        onRefresh={fetchAll}
        isLoading={isLoading}
      />

      {/* Section 5 Automatic Follow-up & Escalation Pipeline Matrix */}
      <div className="rounded-xl border border-line bg-surface p-4 space-y-3 shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-bold text-ink flex items-center gap-2">
            <BellRing className="size-4 text-amber-600" />
            <span>Section 5 — Live Automatic Follow-up &amp; Escalation Pipeline</span>
          </h2>
          <select
            aria-label="Filter by Company"
            value={companyFilter}
            onChange={(e) => setCompanyFilter(e.target.value)}
            className="h-8 rounded border border-line bg-control/40 px-2.5 text-xs font-semibold text-ink"
          >
            {COMPANIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs">
          <div className="rounded-lg border border-amber-300 dark:border-amber-800 bg-amber-50/60 dark:bg-amber-950/30 p-3">
            <div className="font-bold text-amber-900 dark:text-amber-200">2 Hours Before Deadline</div>
            <div className="text-[11px] text-amber-800 dark:text-amber-300 mt-0.5">Automatic Employee Reminder</div>
          </div>
          <div className="rounded-lg border border-orange-300 dark:border-orange-800 bg-orange-50/60 dark:bg-orange-950/30 p-3">
            <div className="font-bold text-orange-900 dark:text-orange-200">Deadline Passed</div>
            <div className="text-[11px] text-orange-800 dark:text-orange-300 mt-0.5">Automatic Overdue Flag</div>
          </div>
          <div className="rounded-lg border border-rose-300 dark:border-rose-800 bg-rose-50/60 dark:bg-rose-950/30 p-3">
            <div className="font-bold text-rose-900 dark:text-rose-200">1 Hour Overdue</div>
            <div className="text-[11px] text-rose-800 dark:text-rose-300 mt-0.5">Department Head Alert</div>
          </div>
          <div className="rounded-lg border border-red-400 dark:border-red-800 bg-red-100/60 dark:bg-red-950/50 p-3">
            <div className="font-bold text-red-900 dark:text-red-200">24 Hours Overdue</div>
            <div className="text-[11px] text-red-800 dark:text-red-300 mt-0.5">Central Monitoring Officer Alert</div>
          </div>
          <div className="rounded-lg border border-red-700 bg-red-600 text-white p-3">
            <div className="font-bold">Critical Task Overdue</div>
            <div className="text-[11px] opacity-90 mt-0.5">Direct MD / Management Alert</div>
          </div>
        </div>
      </div>

      {nudgeStatus && (
        <div
          role="status"
          aria-live="polite"
          className="rounded-xl border border-blue-300 bg-blue-50 dark:bg-blue-950/40 p-3 text-xs font-semibold text-blue-900 dark:text-blue-200"
        >
          {nudgeStatus}
        </div>
      )}

      {/* Pending Deadline Extension Requests */}
      {(data?.extensionRequests || []).filter((e) => e.status === "PENDING").length > 0 && (
        <div className="rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20 p-4 space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-amber-900 dark:text-amber-200">
            Pending Deadline Extension Requests From Staff
          </h3>
          <div className="space-y-2">
            {(data?.extensionRequests || [])
              .filter((e) => e.status === "PENDING")
              .map((req) => (
                <div
                  key={req.id}
                  className="rounded-lg border border-line bg-surface p-3 flex flex-wrap items-center justify-between gap-3 text-xs"
                >
                  <div>
                    <span className="font-mono font-bold text-blue-600 mr-2">{req.task_code}</span>
                    <strong className="text-ink">{req.requested_by_name}</strong> requested extension from{" "}
                    <span className="text-rose-600">{formatDateTime(req.current_deadline)}</span> to{" "}
                    <span className="font-bold text-emerald-600">{formatDateTime(req.proposed_deadline)}</span>
                    <div className="text-ink-muted mt-0.5">Reason: {req.reason}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleReviewExtension(req.id, "APPROVED")}
                      className="h-7 px-3 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-semibold cursor-pointer"
                    >
                      Approve Extension
                    </button>
                    <button
                      type="button"
                      onClick={() => handleReviewExtension(req.id, "REJECTED")}
                      className="h-7 px-3 rounded bg-rose-600 hover:bg-rose-700 text-white font-semibold cursor-pointer"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Overdue, Blocked & Pending Cards */}
      <div className="space-y-4">
        {attentionTasks.map((task) => (
          <div
            key={task.id}
            className={`rounded-xl border p-5 bg-surface shadow-2xs space-y-3 ${
              task.isOverdue || task.status === "BLOCKED"
                ? "border-rose-400 dark:border-rose-800"
                : "border-line"
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs font-bold px-2.5 py-1 rounded bg-blue-600/10 text-blue-600">
                  TASK #{task.taskCode}
                </span>
                <PriorityBadge priority={task.priority} showWeight />
                <span className="text-xs font-bold px-2 py-0.5 rounded bg-control text-ink">
                  {task.companyName} · {task.department}
                </span>
                <EscalationBadge stage={task.computedEscalation} overdueHours={task.overdueHours} />
              </div>
              <StatusBadge status={task.status} />
            </div>

            <div>
              <h3 className="text-base font-bold text-ink">{task.title}</h3>
              <p className="text-xs text-ink-muted mt-0.5">{task.description}</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 text-xs rounded-lg bg-control/40 p-3">
              <div>
                <span className="text-ink-muted block">Responsible Employee:</span>
                <strong className="text-ink">{task.assignedToName}</strong>
              </div>
              <div>
                <span className="text-ink-muted block">Reporting Supervisor:</span>
                <strong className="text-ink">{task.reportingToName}</strong>
              </div>
              <div>
                <span className="text-ink-muted block">Official Deadline:</span>
                <strong className={task.isOverdue ? "text-rose-600" : "text-ink"}>
                  {formatDateTime(task.deadline)}
                </strong>
              </div>
              <div>
                <span className="text-ink-muted block">Progress &amp; Follow-ups:</span>
                <strong className="text-ink">
                  {task.progressPercent}% · {task.nudgeCount} Nudges Sent
                </strong>
              </div>
            </div>

            {/* Blocker Details */}
            {task.status === "BLOCKED" && (
              <div className="rounded-lg border border-rose-300 dark:border-rose-800 bg-rose-50/70 dark:bg-rose-950/30 p-3 text-xs flex flex-wrap items-center justify-between gap-3">
                <div>
                  <span className="font-bold text-rose-800 dark:text-rose-200 block">
                    Reported Blocker (Blocked by {task.blockedByDepartment || "External"} — {task.blockedByPerson || "Pending"}):
                  </span>
                  <span className="text-rose-700 dark:text-rose-300">{task.blockerReason}</span>
                </div>
                <div className="flex items-center gap-2">
                  {task.blockerVerified ? (
                    <span className="px-2.5 py-1 rounded bg-emerald-600 text-white font-bold text-[11px]">
                      ✓ Verified Blocker (KPI Protected)
                    </span>
                  ) : (
                    <button
                      type="button"
                      disabled={busyTaskId === task.id}
                      onClick={() => handleVerifyBlocker(task)}
                      className="h-7 px-3 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-semibold cursor-pointer"
                    >
                      Verify Blocker (Waive KPI Penalty)
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Central Monitoring Officer (CMO) & Supervisor Action Bar */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-line">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={busyTaskId === task.id}
                  onClick={() => handleSendCmoNudge(task, false)}
                  className="h-8 px-3 rounded-md bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <BellRing className="size-3.5" />
                  <span>Send Follow-up Reminder ({task.nudgeCount})</span>
                </button>

                <button
                  type="button"
                  disabled={busyTaskId === task.id}
                  onClick={() => handleSendCmoNudge(task, true)}
                  className="h-8 px-3 rounded-md bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Flame className="size-3.5" />
                  <span>Escalate to MD Golden Report</span>
                </button>
              </div>

              <div className="flex items-center gap-1.5">
                <Link
                  href={connectPaths.chat}
                  className="h-8 px-2.5 rounded-md border border-line bg-control/40 hover:bg-control text-ink text-xs font-semibold inline-flex items-center gap-1.5"
                >
                  <MessageSquare className="size-3.5 text-blue-600" />
                  <span>Direct Chat</span>
                </Link>
                <Link
                  href={connectPaths.calls}
                  className="h-8 px-2.5 rounded-md border border-line bg-control/40 hover:bg-control text-ink text-xs font-semibold inline-flex items-center gap-1.5"
                >
                  <Phone className="size-3.5 text-emerald-600" />
                  <span>Call Now</span>
                </Link>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * 8. TASK APPROVAL (/connect/tasks/approvals)
 * Supervisor Verification Studio: Inspect Evidence, Rate Quality (1-5 Stars), Verify & Approve, or Reject for Correction.
 * Enforces CMO Permission Guardrail!
 */
export function TaskApprovalView() {
  const { data, isLoading, fetchAll, activeRole, setActiveRole } = useGovernanceData();
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [feedbacks, setFeedbacks] = useState<Record<string, string>>({});
  const [actionBanner, setActionBanner] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const submittedTasks = (data?.tasks || []).filter(
    (t) => t.status === "SUBMITTED_FOR_APPROVAL"
  );
  const recentlyVerified = (data?.tasks || []).filter(
    (t) => t.status === "VERIFIED_COMPLETED"
  );

  const handleSupervisorDecision = async (
    task: ConnectTaskRecord,
    decision: "SUPERVISOR_VERIFY" | "SUPERVISOR_REJECT"
  ) => {
    setBusyId(task.id);
    setActionBanner(null);
    const qualityRating = ratings[task.id] || 5;
    const supervisorFeedback =
      feedbacks[task.id] ||
      (decision === "SUPERVISOR_VERIFY"
        ? "Deliverables & evidence verified. Approved as Verified Completed."
        : "Correction required. Please update supporting annexure and resubmit.");

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
        setActionBanner({
          type: "ok",
          text:
            decision === "SUPERVISOR_VERIFY"
              ? `✓ Task #${task.taskCode} verified & marked VERIFIED COMPLETED (${qualityRating}/5★ Quality credited to ${task.assignedToName}'s KPI).`
              : `↩ Task #${task.taskCode} rejected and returned to ${task.assignedToName} with a Correction Request.`,
        });
        fetchAll();
      } else {
        setActionBanner({
          type: "err",
          text: json.error || "Permission denied for this role.",
        });
      }
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <TaskModuleHeader
        title="Task Approval — Supervisor Verification & Quality Rating Studio"
        subtitle="Special Governance Rule: Staff completion requires Supervisor verification to become 'Verified Completed'. Quality rating contributes 30% to Employee KPI."
        activeRole={activeRole}
        onRoleChange={setActiveRole}
        onRefresh={fetchAll}
        isLoading={isLoading}
      />

      {/* CMO Permission Notice when Central Monitoring Officer role is active */}
      {activeRole === "Central Monitoring Officer" && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-950/40 p-4 text-xs flex items-center gap-3">
          <ShieldAlert className="size-5 text-amber-600 shrink-0" />
          <div>
            <strong className="text-amber-900 dark:text-amber-200 block">
              Section 9 Governance Guardrail Active (Central Monitoring Officer Mode)
            </strong>
            <span className="text-amber-800 dark:text-amber-300">
              As Central Monitoring Officer, you can inspect all tasks and send follow-up reminders, but attempting to Approve or Reject completion below will be blocked by the server unless you switch to <strong>Department Head</strong> or <strong>Managing Director</strong>.
            </span>
          </div>
        </div>
      )}

      {actionBanner && (
        <div
          role="alert"
          className={`rounded-xl border p-4 text-xs font-bold ${
            actionBanner.type === "ok"
              ? "border-emerald-300 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-200"
              : "border-rose-300 bg-rose-50 text-rose-900 dark:bg-rose-950/50 dark:text-rose-200"
          }`}
        >
          {actionBanner.text}
        </div>
      )}

      {/* Awaiting Verification Queue */}
      <div className="space-y-4">
        <h2 className="text-base font-bold text-ink flex items-center gap-2">
          <ShieldCheck className="size-5 text-blue-600" />
          <span>Tasks Submitted for Supervisor Approval ({submittedTasks.length})</span>
        </h2>

        {submittedTasks.length === 0 ? (
          <div className="rounded-xl border border-dashed border-line bg-surface p-8 text-center text-xs text-ink-muted">
            All submitted tasks have been verified! You can submit another task from the <strong>My Tasks</strong> menu to test the approval queue.
          </div>
        ) : (
          submittedTasks.map((task) => {
            const currentRating = ratings[task.id] ?? 5;
            return (
              <div
                key={task.id}
                className="rounded-xl border-2 border-amber-400/70 dark:border-amber-700 bg-surface p-5 shadow-2xs space-y-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-3">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold px-2.5 py-1 rounded bg-blue-600/10 text-blue-600">
                      TASK #{task.taskCode}
                    </span>
                    <PriorityBadge priority={task.priority} showWeight />
                    <span className="text-xs font-semibold px-2 py-0.5 rounded bg-control text-ink">
                      {task.companyName} · {task.department}
                    </span>
                  </div>
                  <StatusBadge status={task.status} />
                </div>

                <div>
                  <h3 className="text-base font-bold text-ink">{task.title}</h3>
                  <p className="text-xs text-ink-muted mt-0.5">{task.description}</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 rounded-lg bg-control/40 p-3 text-xs">
                  <div>
                    <span className="text-ink-muted block">Submitted By:</span>
                    <strong className="text-ink">
                      {task.assignedToName} ({task.assignedToDesignation})
                    </strong>
                  </div>
                  <div>
                    <span className="text-ink-muted block">Assigned Supervisor:</span>
                    <strong className="text-ink">{task.reportingToName}</strong>
                  </div>
                  <div>
                    <span className="text-ink-muted block">Attached Proof / Evidence:</span>
                    <strong className="text-emerald-600">
                      {task.evidenceName || task.attachmentName || "Deliverable_Verification_Pack.pdf"}
                    </strong>
                  </div>
                </div>

                {task.staffRemarks && (
                  <div className="rounded-lg border border-line bg-surface p-3 text-xs">
                    <strong className="text-ink block mb-0.5">Employee Submission Remarks:</strong>
                    <span className="text-ink-muted">{task.staffRemarks}</span>
                  </div>
                )}

                {/* Quality Rating (1-5 Stars) & Supervisor Feedback */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 border-t border-line items-end">
                  <div>
                    <span className="block text-xs font-bold text-ink mb-1.5">
                      Supervisor Quality Rating (30% KPI Weight)
                    </span>
                    <div className="flex items-center gap-1.5">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          onClick={() => setRatings((prev) => ({ ...prev, [task.id]: star }))}
                          className={`h-8 px-2.5 rounded border text-xs font-bold inline-flex items-center gap-1 cursor-pointer transition ${
                            currentRating >= star
                              ? "bg-amber-400/20 border-amber-500 text-amber-700 dark:text-amber-300"
                              : "bg-control border-line text-ink-muted"
                          }`}
                        >
                          <Star
                            className={`size-3.5 ${
                              currentRating >= star ? "fill-amber-400 text-amber-500" : ""
                            }`}
                          />
                          <span>{star}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-ink mb-1">
                      Supervisor Verification / Correction Remarks
                    </label>
                    <input
                      type="text"
                      value={feedbacks[task.id] || ""}
                      onChange={(e) =>
                        setFeedbacks((prev) => ({ ...prev, [task.id]: e.target.value }))
                      }
                      placeholder="Write verification approval note or specify required corrections..."
                      className="w-full h-8 rounded border border-line bg-control/40 px-2.5 text-xs text-ink"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    disabled={busyId === task.id}
                    onClick={() => handleSupervisorDecision(task, "SUPERVISOR_REJECT")}
                    className="h-8 px-4 rounded-md bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold cursor-pointer"
                  >
                    Reject &amp; Send Correction Request
                  </button>
                  <button
                    type="button"
                    disabled={busyId === task.id}
                    onClick={() => handleSupervisorDecision(task, "SUPERVISOR_VERIFY")}
                    className="h-8 px-4 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <CheckCheck className="size-4" />
                    <span>Verify &amp; Approve (Verified Completed)</span>
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Recently Verified Completed Tasks */}
      <div className="space-y-3 pt-4 border-t border-line">
        <h2 className="text-sm font-bold text-ink">
          Recently Verified Completed Tasks ({recentlyVerified.length})
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {recentlyVerified.map((t) => (
            <div key={t.id} className="rounded-xl border border-line bg-surface p-4 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-mono font-bold text-emerald-600">{t.taskCode}</span>
                <span className="font-bold text-amber-600 inline-flex items-center gap-1">
                  <Star className="size-3.5 fill-amber-400 text-amber-500" />
                  {t.qualityRating || 5}/5
                </span>
              </div>
              <div className="font-bold text-ink">{t.title}</div>
              <div className="text-ink-muted">
                {t.assignedToName} · {t.companyName} ({t.department})
              </div>
              {t.supervisorFeedback && (
                <div className="text-[11px] text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 p-2 rounded">
                  &ldquo;{t.supervisorFeedback}&rdquo;
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * 9. RECURRING TASKS (/connect/tasks/recurring)
 * Automated Daily / Weekly / Monthly Task Templates + 1-Click Live Task Spawner.
 */
export function RecurringTasksView() {
  const { data, isLoading, fetchAll, activeRole, setActiveRole } = useGovernanceData();
  const formId = useId();

  const [companyName, setCompanyName] = useState("Mariners");
  const [department, setDepartment] = useState("Accounts");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assignedToName, setAssignedToName] = useState("Nusrat Jahan");
  const [frequency, setFrequency] = useState("DAILY");
  const [scheduleLabel, setScheduleLabel] = useState("Every Working Day at 9:30 AM");
  const [priority, setPriority] = useState<TaskPriority>("HIGH");
  const [spawnBanner, setSpawnBanner] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const handleCreateTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreating(true);
    setSpawnBanner(null);
    const emp = STAFF_DIRECTORY.find((s) => s.name === assignedToName);
    try {
      const res = await fetch("/api/connect/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "CREATE_RECURRING_TEMPLATE",
          companyName,
          department,
          projectName: `${companyName} Routine Operations`,
          title,
          description,
          assignedToId: emp?.id || "emp-staff",
          assignedToName,
          reportingToName: emp?.supervisor || "Department Head",
          priority,
          frequency,
          scheduleLabel,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setTitle("");
        setDescription("");
        setSpawnBanner(`✓ Created ${frequency} recurring template (${json.template.template_code}).`);
        fetchAll();
      }
    } finally {
      setIsCreating(false);
    }
  };

  const handleGenerateNow = async (templateId: string, tplTitle: string) => {
    setSpawnBanner(null);
    const res = await fetch("/api/connect/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "GENERATE_FROM_RECURRING",
        templateId,
      }),
    });
    const json = await res.json();
    if (json.success && json.task) {
      setSpawnBanner(
        `⚡ Spawned live task #${json.task.taskCode} ("${tplTitle}") and assigned to ${json.task.assignedToName}!`
      );
      fetchAll();
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <TaskModuleHeader
        title="Recurring Tasks — Automated Daily, Weekly & Monthly Routines"
        subtitle="Manage standing corporate routines across Accounts, HR, Sales, IT, and Operations with 1-click task generation."
        activeRole={activeRole}
        onRoleChange={setActiveRole}
        onRefresh={fetchAll}
        isLoading={isLoading}
      />

      {spawnBanner && (
        <div
          role="status"
          aria-live="polite"
          className="rounded-xl border border-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 p-3.5 text-xs font-bold text-emerald-900 dark:text-emerald-200"
        >
          {spawnBanner}
        </div>
      )}

      {/* Create Recurring Template Form */}
      <form onSubmit={handleCreateTemplate} className="rounded-xl border border-line bg-surface p-5 space-y-4 shadow-2xs">
        <h2 className="text-sm font-bold text-ink">Create New Recurring Task Rule</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs">
          <div>
            <label htmlFor={`${formId}-comp`} className="block font-bold text-ink mb-1">
              Company
            </label>
            <select
              id={`${formId}-comp`}
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              className="w-full h-8 rounded border border-line bg-control/40 px-2 font-semibold text-ink"
            >
              <option value="Mariners">Mariners</option>
              <option value="MOHS">MOHS</option>
              <option value="Marinozz">Marinozz</option>
            </select>
          </div>
          <div>
            <label htmlFor={`${formId}-dept`} className="block font-bold text-ink mb-1">
              Department
            </label>
            <select
              id={`${formId}-dept`}
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              className="w-full h-8 rounded border border-line bg-control/40 px-2 font-semibold text-ink"
            >
              {DEPARTMENTS.filter((d) => d !== "All Departments").map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor={`${formId}-emp`} className="block font-bold text-ink mb-1">
              Responsible Staff
            </label>
            <select
              id={`${formId}-emp`}
              value={assignedToName}
              onChange={(e) => setAssignedToName(e.target.value)}
              className="w-full h-8 rounded border border-line bg-control/40 px-2 font-semibold text-ink"
            >
              {STAFF_DIRECTORY.map((s) => (
                <option key={s.id} value={s.name}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor={`${formId}-freq`} className="block font-bold text-ink mb-1">
              Frequency
            </label>
            <select
              id={`${formId}-freq`}
              value={frequency}
              onChange={(e) => setFrequency(e.target.value)}
              className="w-full h-8 rounded border border-line bg-control/40 px-2 font-semibold text-ink"
            >
              <option value="DAILY">Daily</option>
              <option value="WEEKLY">Weekly</option>
              <option value="MONTHLY">Monthly</option>
            </select>
          </div>
          <div>
            <label htmlFor={`${formId}-prio`} className="block font-bold text-ink mb-1">
              Priority
            </label>
            <select
              id={`${formId}-prio`}
              value={priority}
              onChange={(e) => setPriority(e.target.value as TaskPriority)}
              className="w-full h-8 rounded border border-line bg-control/40 px-2 font-semibold text-ink"
            >
              <option value="CRITICAL">Critical (3x)</option>
              <option value="HIGH">High (2x)</option>
              <option value="MEDIUM">Medium (1.5x)</option>
              <option value="LOW">Low (1x)</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          <div>
            <label htmlFor={`${formId}-title`} className="block font-bold text-ink mb-1">
              Routine Task Title <span className="text-rose-600">*</span>
            </label>
            <input
              id={`${formId}-title`}
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Daily Treasury Cashbook Reconciliation"
              className="w-full h-8 rounded border border-line bg-control/40 px-2.5 text-ink"
            />
          </div>
          <div>
            <label htmlFor={`${formId}-sched`} className="block font-bold text-ink mb-1">
              Schedule Rule Label
            </label>
            <input
              id={`${formId}-sched`}
              type="text"
              value={scheduleLabel}
              onChange={(e) => setScheduleLabel(e.target.value)}
              className="w-full h-8 rounded border border-line bg-control/40 px-2.5 text-ink"
            />
          </div>
          <div>
            <label htmlFor={`${formId}-desc`} className="block font-bold text-ink mb-1">
              Standard Operating Instructions
            </label>
            <input
              id={`${formId}-desc`}
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Instructions included on each generated task..."
              className="w-full h-8 rounded border border-line bg-control/40 px-2.5 text-ink"
            />
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isCreating}
            className="h-8 px-4 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold cursor-pointer"
          >
            {isCreating ? "Saving..." : "Save Recurring Template"}
          </button>
        </div>
      </form>

      {/* Recurring Templates Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {(data?.recurringTemplates || []).map((tpl) => (
          <div
            key={tpl.id}
            className="rounded-xl border border-line bg-surface p-5 space-y-3 shadow-2xs flex flex-col justify-between"
          >
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-purple-600/10 text-purple-700 dark:text-purple-300">
                  ↻ {tpl.frequency} · {tpl.template_code}
                </span>
                <PriorityBadge priority={tpl.priority as TaskPriority} />
              </div>
              <h3 className="text-sm font-bold text-ink">{tpl.title}</h3>
              <p className="text-xs text-ink-muted">{tpl.description}</p>
              <div className="text-xs text-ink-muted pt-1">
                <strong className="text-ink">{tpl.company_name}</strong> · {tpl.department} · Assigned to{" "}
                <strong className="text-ink">{tpl.assigned_to_name}</strong>
              </div>
              <div className="text-[11px] text-blue-600 font-medium">
                Schedule: {tpl.schedule_label}
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-line text-xs">
              <span className="text-ink-muted">
                Last generated: {formatDateTime(tpl.last_generated_at)}
              </span>
              <button
                type="button"
                onClick={() => handleGenerateNow(tpl.id, tpl.title)}
                className="h-8 px-3 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white font-semibold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Repeat className="size-3.5" />
                <span>Generate Live Task Now</span>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * 10. EMPLOYEE PERFORMANCE (/connect/tasks/performance)
 * Section 8: 100-Point Weighted KPI Evaluation Engine with Priority Multipliers & Leave/Blocker Fairness Protection.
 */
export function EmployeePerformanceView() {
  const { data, isLoading, fetchAll, activeRole, setActiveRole } = useGovernanceData();
  const [companyFilter, setCompanyFilter] = useState("All Companies");
  const [deptFilter, setDeptFilter] = useState("All Departments");

  const scorecards = (data?.kpiScorecards || []).filter((s) => {
    if (companyFilter !== "All Companies" && s.companyName !== companyFilter) return false;
    if (deptFilter !== "All Departments" && s.department !== deptFilter) return false;
    return true;
  });

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <TaskModuleHeader
        title="Employee Performance — 100-Point Weighted KPI & Accountability Analytics"
        subtitle="Objective performance evaluation for promotions, bonuses, targeted training, and management review."
        activeRole={activeRole}
        onRoleChange={setActiveRole}
        onRefresh={fetchAll}
        isLoading={isLoading}
        rightActions={
          <button
            type="button"
            onClick={() => window.print()}
            className="h-8 px-3 rounded-md border border-line bg-surface hover:bg-control text-xs font-semibold text-ink inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Printer className="size-3.5 text-blue-600" />
            <span>Print KPI Report</span>
          </button>
        }
      />

      {/* Section 8 Formula & Priority Weight Explanation */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 rounded-xl border border-line bg-surface p-4 space-y-2">
          <h2 className="text-sm font-bold text-ink">
            Section 8 — 100-Point Weighted KPI Formula
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs pt-1">
            <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-2.5">
              <div className="font-extrabold text-base text-blue-600">40%</div>
              <div className="font-bold text-ink">Deadline Compliance</div>
              <div className="text-[11px] text-ink-muted">On-time task completion</div>
            </div>
            <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-2.5">
              <div className="font-extrabold text-base text-emerald-600">30%</div>
              <div className="font-bold text-ink">Quality &amp; Approval</div>
              <div className="text-[11px] text-ink-muted">Supervisor 1–5★ &amp; zero rework</div>
            </div>
            <div className="rounded-lg border border-purple-500/20 bg-purple-500/5 p-2.5">
              <div className="font-extrabold text-base text-purple-600">20%</div>
              <div className="font-bold text-ink">Task Importance</div>
              <div className="text-[11px] text-ink-muted">Priority-weighted delivery</div>
            </div>
            <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-2.5">
              <div className="font-extrabold text-base text-amber-600">10%</div>
              <div className="font-bold text-ink">Timely Reporting</div>
              <div className="text-[11px] text-ink-muted">Daily updates &amp; reports</div>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-line bg-surface p-4 space-y-2 text-xs">
          <h2 className="text-sm font-bold text-ink">Priority Multipliers &amp; Fairness Rules</h2>
          <div className="flex flex-wrap gap-1.5">
            <span className="px-2 py-0.5 rounded bg-red-600 text-white font-bold">Critical = 3.0x</span>
            <span className="px-2 py-0.5 rounded bg-orange-500/15 text-orange-700 dark:text-orange-300 font-bold">High = 2.0x</span>
            <span className="px-2 py-0.5 rounded bg-blue-500/15 text-blue-700 dark:text-blue-300 font-bold">Medium = 1.5x</span>
            <span className="px-2 py-0.5 rounded bg-slate-500/15 text-slate-700 dark:text-slate-300 font-bold">Low = 1.0x</span>
          </div>
          <p className="text-[11px] text-ink-muted leading-relaxed pt-1">
            ✓ <strong>Leave &amp; External Blocker Protection:</strong> Approved HRM Leave days and tasks with a Supervisor-Verified Inter-Departmental Blocker never reduce an employee&apos;s KPI score.
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-surface p-3.5 text-xs">
        <span className="font-bold text-ink">Filter Scorecard:</span>
        <select
          aria-label="Filter KPI by Company"
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
          aria-label="Filter KPI by Department"
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
      </div>

      {/* 100-Point KPI Leaderboard Table */}
      <div className="rounded-xl border border-line bg-surface overflow-hidden shadow-2xs">
        <div
          tabIndex={0}
          role="region"
          aria-label="Employee 100-Point KPI Leaderboard"
          className="overflow-auto max-h-[600px] max-w-full"
        >
          <table className="w-full text-left border-collapse text-xs">
            <thead className="sticky top-0 z-10 bg-control text-ink font-bold border-b border-line">
              <tr>
                <th className="p-3">Rank &amp; Employee</th>
                <th className="p-3">Company / Dept</th>
                <th className="p-3">Tasks (Done/Total)</th>
                <th className="p-3">Deadline (40)</th>
                <th className="p-3">Quality (30)</th>
                <th className="p-3">Importance (20)</th>
                <th className="p-3">Reporting (10)</th>
                <th className="p-3">Total KPI (100)</th>
                <th className="p-3">Grade &amp; HR Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {scorecards.map((s, idx) => (
                <tr key={s.employeeName} className="hover:bg-control/30 transition">
                  <th scope="row" className="p-3 bg-surface sticky left-0 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <span className="size-6 rounded-full bg-blue-600/10 text-blue-600 font-bold flex items-center justify-center">
                        #{idx + 1}
                      </span>
                      <div>
                        <div className="font-bold text-ink">{s.employeeName}</div>
                        <div className="text-[11px] text-ink-muted font-normal">{s.designation}</div>
                      </div>
                    </div>
                  </th>
                  <td className="p-3 whitespace-nowrap">
                    <div className="font-semibold text-ink">{s.companyName}</div>
                    <div className="text-[11px] text-ink-muted">{s.department}</div>
                  </td>
                  <td className="p-3 whitespace-nowrap">
                    <span className="font-bold text-emerald-600">{s.verifiedCompletedTasks}</span> / {s.totalTasks}
                    {s.verifiedBlockerExcusedCount > 0 && (
                      <span className="block text-[10px] text-blue-600 font-semibold">
                        ✓ {s.verifiedBlockerExcusedCount} Blocker Excused
                      </span>
                    )}
                  </td>
                  <td className="p-3 font-mono font-bold text-ink">{s.deadlineComplianceScore}</td>
                  <td className="p-3 font-mono font-bold text-ink">
                    {s.qualityApprovalScore}{" "}
                    <span className="text-[11px] text-amber-600">({s.averageQualityRating}★)</span>
                  </td>
                  <td className="p-3 font-mono font-bold text-ink">
                    {s.taskImportanceScore}{" "}
                    <span className="text-[10px] text-ink-muted">
                      ({s.weightedPointsEarned}/{s.weightedPointsPossible}w)
                    </span>
                  </td>
                  <td className="p-3 font-mono font-bold text-ink">{s.timelyReportingScore}</td>
                  <td className="p-3 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-extrabold text-blue-600 dark:text-blue-400">
                        {s.totalKpiScore}%
                      </span>
                    </div>
                  </td>
                  <td className="p-3 whitespace-nowrap">
                    <div className="font-bold text-ink">{s.grade}</div>
                    <div className="text-[11px] text-emerald-600 font-semibold">{s.recommendation}</div>
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
 * 11. MANAGEMENT DASHBOARD (/connect/tasks/executive)
 * Sections 6 & 7: MD Central Command Center + Company/Dept/Employee Filters + The 3 Golden Reports!
 */
export function ManagementDashboardView() {
  const { data, isLoading, fetchAll, activeRole, setActiveRole } = useGovernanceData();
  const [selectedCompany, setSelectedCompany] = useState("All Companies");
  const [selectedDept, setSelectedDept] = useState("All Departments");
  const [selectedEmployee, setSelectedEmployee] = useState("All Employees");

  // MD Executive Decision Input for Golden Report #3
  const [mdNotes, setMdNotes] = useState<Record<string, string>>({});
  const [mdBanner, setMdBanner] = useState<string | null>(null);
  const [busyDecisionId, setBusyDecisionId] = useState<string | null>(null);

  const allTasks = (data?.tasks || []).filter((t) => {
    if (t.status === "CANCELLED") return false;
    if (selectedCompany !== "All Companies" && t.companyName !== selectedCompany) return false;
    if (selectedDept !== "All Departments" && t.department !== selectedDept) return false;
    if (selectedEmployee !== "All Employees" && t.assignedToName !== selectedEmployee) return false;
    return true;
  });

  const totalTasks = allTasks.length;
  const completedTasks = allTasks.filter((t) => t.status === "VERIFIED_COMPLETED").length;
  const pendingActive = allTasks.filter((t) => t.status !== "VERIFIED_COMPLETED").length;
  const overdueTasks = allTasks.filter((t) => t.isOverdue).length;
  const completionRate = totalTasks > 0 ? Number(((completedTasks / totalTasks) * 100).toFixed(1)) : 0;

  // MD's 3 Golden Reports (filtered dynamically by Company/Dept/Employee!)
  const goldenCompletedToday = allTasks.filter((t) => t.status === "VERIFIED_COMPLETED");
  const goldenCriticalOverdue = allTasks.filter(
    (t) => t.isOverdue && (t.priority === "CRITICAL" || t.priority === "HIGH")
  );
  const goldenDecisionRequired = allTasks.filter(
    (t) => t.requiresMdDecision || (t.status === "BLOCKED" && t.priority === "CRITICAL")
  );

  const handleIssueMdDirective = async (task: ConnectTaskRecord) => {
    const note =
      mdNotes[task.id]?.trim() ||
      "Approved by Managing Director. Proceed immediately and coordinate with Finance/Legal.";
    setBusyDecisionId(task.id);
    setMdBanner(null);
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
        setMdBanner(
          `✓ MD Executive Directive issued on #${task.taskCode} ("${note}"). Task unblocked & logged in Audit History.`
        );
        fetchAll();
      }
    } finally {
      setBusyDecisionId(null);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <TaskModuleHeader
        title="Management Dashboard — MD & Group Executive Command Center"
        subtitle="Centralized oversight across Mariners, MOHS, and Marinozz with live Executive Filters and MD's 3 Golden Reports."
        activeRole={activeRole}
        onRoleChange={setActiveRole}
        onRefresh={fetchAll}
        isLoading={isLoading}
        rightActions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => exportTasksToCsv("md-executive-report", allTasks)}
              className="h-8 px-3 rounded-md border border-line bg-surface hover:bg-control text-xs font-semibold text-ink inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="size-3.5 text-blue-600" />
              <span>Export Excel / CSV</span>
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="h-8 px-3 rounded-md border border-line bg-surface hover:bg-control text-xs font-semibold text-ink inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Printer className="size-3.5 text-emerald-600" />
              <span>Print / PDF</span>
            </button>
          </div>
        }
      />

      {/* Section 6: MD Executive Filter Bar (Company Pills + Department + Employee) */}
      <div className="rounded-xl border border-line bg-surface p-4 space-y-3 shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Company Pills: All Companies | Mariners | MOHS | Marinozz */}
          <div className="flex flex-wrap items-center gap-1.5">
            {COMPANIES.map((comp) => (
              <button
                key={comp}
                type="button"
                onClick={() => setSelectedCompany(comp)}
                className={`h-8 px-3.5 rounded-full text-xs font-bold transition cursor-pointer ${
                  selectedCompany === comp
                    ? "bg-blue-600 text-white shadow-2xs"
                    : "bg-control/50 text-ink-muted hover:text-ink border border-line"
                }`}
              >
                {comp}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <select
              aria-label="Executive Department Filter"
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

            <select
              aria-label="Executive Employee Filter"
              value={selectedEmployee}
              onChange={(e) => setSelectedEmployee(e.target.value)}
              className="h-8 rounded border border-line bg-control/40 px-2.5 font-semibold text-ink"
            >
              <option value="All Employees">All Employees</option>
              {STAFF_DIRECTORY.map((emp) => (
                <option key={emp.id} value={emp.name}>
                  {emp.name} ({emp.company})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* 5 Executive Overview Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-2">
          <div className="rounded-xl border border-line bg-control/20 p-3.5">
            <div className="text-xs text-ink-muted font-medium">Total Tasks</div>
            <div className="text-2xl font-extrabold text-ink mt-0.5">{totalTasks}</div>
            <div className="text-[11px] text-ink-muted">{selectedCompany}</div>
          </div>
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3.5">
            <div className="text-xs text-emerald-700 dark:text-emerald-300 font-semibold">Completed</div>
            <div className="text-2xl font-extrabold text-emerald-600 mt-0.5">{completedTasks}</div>
            <div className="text-[11px] text-emerald-600">Supervisor Verified</div>
          </div>
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3.5">
            <div className="text-xs text-amber-700 dark:text-amber-300 font-semibold">Pending / Active</div>
            <div className="text-2xl font-extrabold text-amber-600 mt-0.5">{pendingActive}</div>
            <div className="text-[11px] text-amber-600">In execution or review</div>
          </div>
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/5 p-3.5">
            <div className="text-xs text-rose-700 dark:text-rose-300 font-semibold">Overdue</div>
            <div className="text-2xl font-extrabold text-rose-600 mt-0.5">{overdueTasks}</div>
            <div className="text-[11px] text-rose-600">SLA breached</div>
          </div>
          <div className="rounded-xl border border-blue-500/30 bg-blue-600/10 p-3.5">
            <div className="text-xs text-blue-700 dark:text-blue-300 font-bold">Completion Rate</div>
            <div className="text-2xl font-extrabold text-blue-600 dark:text-blue-400 mt-0.5">
              {completionRate}%
            </div>
            <div className="h-1.5 w-full rounded-full bg-control mt-1.5 overflow-hidden">
              <div className="h-full bg-blue-600" style={{ width: `${completionRate}%` }} />
            </div>
          </div>
        </div>
      </div>

      {mdBanner && (
        <div
          role="status"
          aria-live="polite"
          className="rounded-xl border border-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 p-3.5 text-xs font-bold text-emerald-900 dark:text-emerald-200"
        >
          {mdBanner}
        </div>
      )}

      {/* SECTION 7: MD'S 3 GOLDEN REPORTS */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-ink">
            Section 7 — MD&apos;s 3 Golden Reports (Executive Daily Briefing)
          </h2>
          <span className="text-xs text-ink-muted">
            Instant clarity without inspecting hundreds of individual tasks
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* GOLDEN REPORT 1: Today's Completed Tasks */}
          <div className="rounded-xl border-2 border-emerald-500/40 bg-surface p-4 space-y-3 shadow-2xs flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-line pb-2.5">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">
                    Golden Report #1
                  </span>
                  <h3 className="text-sm font-bold text-ink flex items-center gap-1.5">
                    <CheckCircle2 className="size-4 text-emerald-600" />
                    <span>Today&apos;s Completed Tasks</span>
                  </h3>
                </div>
                <span className="size-7 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-bold text-xs flex items-center justify-center">
                  {goldenCompletedToday.length}
                </span>
              </div>

              <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
                {goldenCompletedToday.map((t) => (
                  <div key={t.id} className="rounded-lg border border-line bg-control/30 p-3 text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-emerald-600">{t.taskCode}</span>
                      <span className="font-semibold text-ink">
                        {t.companyName} · {t.department}
                      </span>
                    </div>
                    <div className="font-bold text-ink">{t.title}</div>
                    <div className="text-ink-muted flex items-center justify-between pt-1">
                      <span>By: {t.assignedToName}</span>
                      <span className="text-amber-600 font-bold">{t.qualityRating || 5}★ Verified</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* GOLDEN REPORT 2: Critical Overdue Tasks */}
          <div className="rounded-xl border-2 border-rose-500/50 bg-surface p-4 space-y-3 shadow-2xs flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-line pb-2.5">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-rose-600">
                    Golden Report #2
                  </span>
                  <h3 className="text-sm font-bold text-ink flex items-center gap-1.5">
                    <Flame className="size-4 text-rose-600" />
                    <span>Critical Overdue Tasks</span>
                  </h3>
                </div>
                <span className="size-7 rounded-full bg-rose-500/15 text-rose-700 dark:text-rose-300 font-bold text-xs flex items-center justify-center">
                  {goldenCriticalOverdue.length}
                </span>
              </div>

              <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
                {goldenCriticalOverdue.map((t) => (
                  <div
                    key={t.id}
                    className="rounded-lg border border-rose-300 dark:border-rose-800 bg-rose-50/50 dark:bg-rose-950/25 p-3 text-xs space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-rose-600">{t.taskCode}</span>
                      <PriorityBadge priority={t.priority} />
                    </div>
                    <div className="font-bold text-ink">{t.title}</div>
                    <div className="text-[11px] text-ink-muted">
                      <strong>{t.companyName}</strong> ({t.department}) · {t.assignedToName}
                    </div>
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-rose-600 font-bold">
                        Overdue by {t.overdueHours}h ({t.progressPercent}%)
                      </span>
                      <Link
                        href={connectPaths.pendingOverdue}
                        className="text-blue-600 hover:underline font-semibold"
                      >
                        Follow Up &rarr;
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* GOLDEN REPORT 3: Management Decision Required */}
          <div className="rounded-xl border-2 border-amber-500/60 bg-surface p-4 space-y-3 shadow-2xs flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-line pb-2.5">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600">
                    Golden Report #3
                  </span>
                  <h3 className="text-sm font-bold text-ink flex items-center gap-1.5">
                    <AlertTriangle className="size-4 text-amber-600" />
                    <span>Management Decision Required</span>
                  </h3>
                </div>
                <span className="size-7 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 font-bold text-xs flex items-center justify-center">
                  {goldenDecisionRequired.length}
                </span>
              </div>

              <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                {goldenDecisionRequired.length === 0 ? (
                  <div className="p-6 text-center text-xs text-ink-muted">
                    All escalated executive decisions have been resolved!
                  </div>
                ) : (
                  goldenDecisionRequired.map((t) => (
                    <div
                      key={t.id}
                      className="rounded-lg border border-amber-300 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/25 p-3 text-xs space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-blue-600">{t.taskCode}</span>
                        <span className="font-bold text-ink">
                          {t.companyName} · {t.department}
                        </span>
                      </div>
                      <div className="font-bold text-ink">{t.title}</div>
                      <div className="text-rose-700 dark:text-rose-300 bg-rose-500/10 p-2 rounded text-[11px]">
                        <strong>Blocker / Decision Needed:</strong>{" "}
                        {t.blockerReason || "Escalated for MD authorization."}
                      </div>
                      <input
                        type="text"
                        value={mdNotes[t.id] || ""}
                        onChange={(e) =>
                          setMdNotes((prev) => ({ ...prev, [t.id]: e.target.value }))
                        }
                        placeholder="Enter MD decision / directive..."
                        className="w-full h-7 rounded border border-line bg-surface px-2 text-xs text-ink"
                      />
                      <button
                        type="button"
                        disabled={busyDecisionId === t.id}
                        onClick={() => handleIssueMdDirective(t)}
                        className="w-full h-7 rounded bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs cursor-pointer"
                      >
                        {busyDecisionId === t.id
                          ? "Issuing Directive..."
                          : "Issue MD Decision & Unblock Task"}
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * 12. TASK SETTINGS (/connect/tasks/settings)
 * Configurable Escalation Rules, Central Monitoring Officer Permissions & Immutable Audit History.
 */
export function TaskSettingsView() {
  const { data, isLoading, fetchAll, activeRole, setActiveRole } = useGovernanceData();
  const [reminderHours, setReminderHours] = useState(2);
  const [deptHeadHours, setDeptHeadHours] = useState(1);
  const [cmoHours, setCmoHours] = useState(24);
  const [criticalImmediateMd, setCriticalImmediateMd] = useState(true);
  const [requireVerification, setRequireVerification] = useState(true);
  const [cmoCanApprove, setCmoCanApprove] = useState(false);
  const [cmoCanChangeDeadlines, setCmoCanChangeDeadlines] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavedNotice(false);
    const res = await fetch("/api/connect/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "UPDATE_SETTINGS",
        reminderBeforeDeadlineHours: reminderHours,
        deptHeadOverdueAlertHours: deptHeadHours,
        cmoOverdueAlertHours: cmoHours,
        criticalTaskImmediateMdAlert: criticalImmediateMd,
        requireVerificationForCompletion: requireVerification,
        cmoCanApproveTasks: cmoCanApprove,
        cmoCanChangeDeadlines: cmoCanChangeDeadlines,
        cmoCanSendNudges: true,
        cmoCanEscalateToMd: true,
      }),
    });
    if (res.ok) {
      setSavedNotice(true);
      fetchAll();
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <TaskModuleHeader
        title="Task Settings — SLA Escalation Rules, Permissions & Audit History"
        subtitle="Configure automated follow-up timers, Central Monitoring Officer guardrails, and inspect immutable governance audit logs."
        activeRole={activeRole}
        onRoleChange={setActiveRole}
        onRefresh={fetchAll}
        isLoading={isLoading}
      />

      {savedNotice && (
        <div
          role="status"
          aria-live="polite"
          className="rounded-xl border border-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 p-3.5 text-xs font-bold text-emerald-900 dark:text-emerald-200"
        >
          ✓ Task Management SLA &amp; Permission rules updated across BridgeOne ERP.
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Configurable SLA Timers (Section 5) */}
        <form onSubmit={handleSaveSettings} className="rounded-xl border border-line bg-surface p-5 space-y-4 shadow-2xs">
          <h2 className="text-sm font-bold text-ink border-b border-line pb-2">
            Section 5 — Automatic Follow-up &amp; Escalation Configuration
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div>
              <label className="block font-bold text-ink mb-1">
                Pre-Deadline Reminder (Hours)
              </label>
              <input
                type="number"
                min={1}
                max={48}
                value={reminderHours}
                onChange={(e) => setReminderHours(Number(e.target.value))}
                className="w-full h-8 rounded border border-line bg-control/40 px-2.5 text-ink font-mono font-bold"
              />
            </div>
            <div>
              <label className="block font-bold text-ink mb-1">
                Dept Head Alert (Hours Overdue)
              </label>
              <input
                type="number"
                min={1}
                max={48}
                value={deptHeadHours}
                onChange={(e) => setDeptHeadHours(Number(e.target.value))}
                className="w-full h-8 rounded border border-line bg-control/40 px-2.5 text-ink font-mono font-bold"
              />
            </div>
            <div>
              <label className="block font-bold text-ink mb-1">
                Central Monitoring Alert (Hours)
              </label>
              <input
                type="number"
                min={1}
                max={168}
                value={cmoHours}
                onChange={(e) => setCmoHours(Number(e.target.value))}
                className="w-full h-8 rounded border border-line bg-control/40 px-2.5 text-ink font-mono font-bold"
              />
            </div>
          </div>

          <div className="space-y-2 text-xs pt-2">
            <label className="flex items-center gap-2 font-semibold text-ink cursor-pointer">
              <input
                type="checkbox"
                checked={criticalImmediateMd}
                onChange={(e) => setCriticalImmediateMd(e.target.checked)}
                className="accent-blue-600 size-4"
              />
              <span>Critical Task Overdue triggers immediate MD / Authorized Management Alert</span>
            </label>
            <label className="flex items-center gap-2 font-semibold text-ink cursor-pointer">
              <input
                type="checkbox"
                checked={requireVerification}
                onChange={(e) => setRequireVerification(e.target.checked)}
                className="accent-blue-600 size-4"
              />
              <span>Enforce Supervisor Verification before marking tasks Verified Completed</span>
            </label>
          </div>

          <div className="pt-3 border-t border-line space-y-2 text-xs">
            <div className="font-bold text-ink">
              Section 9 — Central Monitoring Officer (CMO) Governance Guardrails
            </div>
            <p className="text-[11px] text-ink-muted">
              By default, the Central Monitoring Officer can view all tasks, send follow-up reminders, and escalate to MD, but cannot approve completion or alter deadlines.
            </p>
            <label className="flex items-center gap-2 text-ink cursor-pointer">
              <input
                type="checkbox"
                checked={cmoCanApprove}
                onChange={(e) => setCmoCanApprove(e.target.checked)}
                className="accent-blue-600 size-4"
              />
              <span>Allow Central Monitoring Officer to Approve / Verify Tasks (Default: Off)</span>
            </label>
            <label className="flex items-center gap-2 text-ink cursor-pointer">
              <input
                type="checkbox"
                checked={cmoCanChangeDeadlines}
                onChange={(e) => setCmoCanChangeDeadlines(e.target.checked)}
                className="accent-blue-600 size-4"
              />
              <span>Allow Central Monitoring Officer to Change Deadlines / Assignments (Default: Off)</span>
            </label>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              className="h-8 px-4 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold cursor-pointer"
            >
              Save Governance Configuration
            </button>
          </div>
        </form>

        {/* Role & Permission Matrix */}
        <div className="rounded-xl border border-line bg-surface p-5 space-y-3 shadow-2xs text-xs">
          <h2 className="text-sm font-bold text-ink border-b border-line pb-2">
            Role &amp; Authority Matrix (BridgeOne ERP v1.0)
          </h2>
          <div className="space-y-2.5">
            <div className="rounded-lg border border-line bg-control/30 p-3">
              <div className="font-bold text-blue-600">1. Managing Director (MD) / Group Management</div>
              <div className="text-ink-muted mt-0.5">
                Full access across all companies (Mariners, MOHS, Marinozz), 3 Golden Reports, executive unblock directives, and final KPI overrides.
              </div>
            </div>
            <div className="rounded-lg border border-line bg-control/30 p-3">
              <div className="font-bold text-emerald-600">2. Department Head / Reporting Supervisor</div>
              <div className="text-ink-muted mt-0.5">
                Assigns departmental tasks, approves deadline extensions, inspects evidence, rates quality (1–5★), and approves Verified Completed.
              </div>
            </div>
            <div className="rounded-lg border border-line bg-control/30 p-3">
              <div className="font-bold text-amber-600">3. Central Monitoring Officer (CMO)</div>
              <div className="text-ink-muted mt-0.5">
                Views all pending/overdue tasks across companies, sends follow-up nudges, verifies inter-departmental blockers, and escalates to MD — <strong>cannot</strong> approve tasks or alter deadlines without authorization.
              </div>
            </div>
            <div className="rounded-lg border border-line bg-control/30 p-3">
              <div className="font-bold text-ink">4. Employee / Staff Portal</div>
              <div className="text-ink-muted mt-0.5">
                Updates work progress (0–100%), logs daily remarks, uploads proof of work, reports blockers, and submits for supervisor approval.
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Section 10: Immutable Audit History Table */}
      <div className="rounded-xl border border-line bg-surface overflow-hidden shadow-2xs">
        <div className="p-4 border-b border-line flex items-center justify-between">
          <div>
            <h2 id="audit-history-caption" className="text-sm font-bold text-ink">
              Section 10 — Immutable Governance Audit History ({data?.auditLogs?.length || 0})
            </h2>
            <p className="text-xs text-ink-muted">
              Every Task Cancel/Delete, Deadline Change, Assignment Change, and MD Directive is permanently recorded here.
            </p>
          </div>
        </div>
        <div
          tabIndex={0}
          role="region"
          aria-labelledby="audit-history-caption"
          className="overflow-auto max-h-[420px] max-w-full"
        >
          <table className="w-full text-left border-collapse text-xs">
            <thead className="sticky top-0 z-10 bg-control text-ink font-bold border-b border-line">
              <tr>
                <th className="p-3">Timestamp</th>
                <th className="p-3">Task ID</th>
                <th className="p-3">Audit Action</th>
                <th className="p-3">Actor &amp; Role</th>
                <th className="p-3">Previous Value</th>
                <th className="p-3">New Value</th>
                <th className="p-3">Recorded Reason</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {(data?.auditLogs || []).map((log) => (
                <tr key={log.id} className="hover:bg-control/30">
                  <td className="p-3 whitespace-nowrap text-ink-muted">
                    {formatDateTime(log.created_at)}
                  </td>
                  <th scope="row" className="p-3 font-mono font-bold text-blue-600 whitespace-nowrap bg-surface sticky left-0">
                    {log.task_code}
                  </th>
                  <td className="p-3 whitespace-nowrap">
                    <span className="px-2 py-0.5 rounded bg-amber-500/15 text-amber-800 dark:text-amber-300 font-bold text-[11px]">
                      {log.audit_action}
                    </span>
                  </td>
                  <td className="p-3 whitespace-nowrap">
                    <strong className="text-ink">{log.actor_name}</strong>{" "}
                    <span className="text-ink-muted">({log.actor_role})</span>
                  </td>
                  <td className="p-3 text-rose-600 max-w-xs truncate">{log.old_value || "—"}</td>
                  <td className="p-3 text-emerald-600 font-semibold max-w-xs truncate">
                    {log.new_value || "—"}
                  </td>
                  <td className="p-3 text-ink">{log.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

