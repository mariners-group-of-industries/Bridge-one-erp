import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getConnectPool } from "@/lib/connect/db";
import { apiHandler } from "@/lib/api/handler";
import { can, type Actor } from "@/lib/auth/actor";
import { connectPaths } from "@/features/connect/paths";
import { getPusherServer } from "@/lib/connect/pusher-server";
import {
  ensureTasksSchema,
  mapTaskRow,
  calculateEmployeeKpiScorecards,
  type TaskPriority,
  type RecurringType,
} from "@/lib/connect/tasks-db";

function deptPrefix(dept: string): string {
  const clean = dept.trim().toUpperCase().replace(/[^A-Z]/g, "");
  if (clean.startsWith("ACCOUNT")) return "ACCOUNTS";
  if (clean.startsWith("OPERAT")) return "OPS";
  if (clean.startsWith("PROCUR")) return "PROC";
  return clean.slice(0, 8) || "TASK";
}

async function handleGET(req: Request) {
  try {
    await ensureTasksSchema();
    const pool = getConnectPool();
    const { searchParams } = new URL(req.url);

    const company = searchParams.get("company") || "";
    const department = searchParams.get("department") || "";
    const status = searchParams.get("status") || "";
    const priority = searchParams.get("priority") || "";
    const assignedTo = searchParams.get("assignedTo") || "";
    const search = searchParams.get("search") || "";
    const overdueOnly = searchParams.get("overdueOnly") === "true";

    const [
      tasksRes,
      reportsRes,
      templatesRes,
      extensionsRes,
      auditRes,
      settingsRes,
      logsRes,
    ] = await Promise.all([
      pool.query(`SELECT * FROM connect_tasks ORDER BY created_at DESC`),
      pool.query(`SELECT * FROM connect_daily_work_reports ORDER BY report_date DESC, submitted_at DESC LIMIT 100`),
      pool.query(`SELECT * FROM connect_task_recurring_templates ORDER BY created_at DESC`),
      pool.query(`SELECT * FROM connect_task_extension_requests ORDER BY created_at DESC LIMIT 50`),
      pool.query(`SELECT * FROM connect_task_audit_logs ORDER BY created_at DESC LIMIT 100`),
      pool.query(`SELECT * FROM connect_task_settings WHERE id = 'global' LIMIT 1`),
      pool.query(`SELECT * FROM connect_task_logs ORDER BY created_at DESC LIMIT 150`),
    ]);

    const allTasks = tasksRes.rows.map(mapTaskRow);

    // Apply filters for the filtered view while keeping allTasks for KPI/Golden Reports if needed
    const filteredTasks = allTasks.filter((t) => {
      if (company && company !== "All" && company !== "All Companies") {
        if (t.companyName.toLowerCase() !== company.toLowerCase()) return false;
      }
      if (department && department !== "All" && department !== "All Departments") {
        if (t.department.toLowerCase() !== department.toLowerCase()) return false;
      }
      if (status && status !== "All") {
        if (t.status !== status) return false;
      }
      if (priority && priority !== "All") {
        if (t.priority !== priority) return false;
      }
      if (assignedTo && assignedTo !== "All" && assignedTo !== "All Employees") {
        if (!t.assignedToName.toLowerCase().includes(assignedTo.toLowerCase())) return false;
      }
      if (overdueOnly && !t.isOverdue) {
        return false;
      }
      if (search) {
        const q = search.toLowerCase();
        const hit =
          t.taskCode.toLowerCase().includes(q) ||
          t.title.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q) ||
          t.assignedToName.toLowerCase().includes(q) ||
          t.department.toLowerCase().includes(q) ||
          t.companyName.toLowerCase().includes(q) ||
          t.projectName.toLowerCase().includes(q);
        if (!hit) return false;
      }
      return true;
    });

    const activeDataset = filteredTasks.filter((t) => t.status !== "CANCELLED");
    const totalTasks = activeDataset.length;
    const completedTasks = activeDataset.filter((t) => t.status === "VERIFIED_COMPLETED").length;
    const submittedForApprovalTasks = activeDataset.filter((t) => t.status === "SUBMITTED_FOR_APPROVAL").length;
    const blockedTasks = activeDataset.filter((t) => t.status === "BLOCKED").length;
    const overdueTasks = activeDataset.filter((t) => t.isOverdue).length;
    const pendingActiveTasks = activeDataset.filter(
      (t) => t.status !== "VERIFIED_COMPLETED"
    ).length;
    const completionRatePercent =
      totalTasks > 0 ? Number(((completedTasks / totalTasks) * 100).toFixed(1)) : 0;

    // MD's 3 Golden Reports (filtered by company/department if selected)
    const todaysCompletedTasks = activeDataset.filter((t) => t.status === "VERIFIED_COMPLETED");
    const criticalOverdueTasks = activeDataset.filter(
      (t) => t.isOverdue && (t.priority === "CRITICAL" || t.priority === "HIGH")
    );
    const managementDecisionRequiredTasks = activeDataset.filter(
      (t) => t.requiresMdDecision || (t.status === "BLOCKED" && t.priority === "CRITICAL")
    );

    // 100-Point Employee KPI Scorecards
    const kpiScorecards = calculateEmployeeKpiScorecards(activeDataset, reportsRes.rows);

    return NextResponse.json({
      success: true,
      tasks: filteredTasks,
      summary: {
        totalTasks,
        completedTasks,
        pendingActiveTasks,
        submittedForApprovalTasks,
        blockedTasks,
        overdueTasks,
        completionRatePercent,
      },
      goldenReports: {
        todaysCompletedTasks,
        criticalOverdueTasks,
        managementDecisionRequiredTasks,
      },
      kpiScorecards,
      dailyReports: reportsRes.rows,
      recurringTemplates: templatesRes.rows,
      extensionRequests: extensionsRes.rows,
      auditLogs: auditRes.rows,
      recentLogs: logsRes.rows,
      settings: settingsRes.rows[0] || null,
    });
  } catch (error) {
    console.error("Error in GET /api/connect/tasks:", error);
    return NextResponse.json(
      { success: false, error: "Failed to load task management data" },
      { status: 500 }
    );
  }
}

/** Reviewing extension requests is a supervisor action; global settings belong to the executive dashboard. */
function actionAllowed(actor: Actor, action: string): boolean {
  if (action === "REVIEW_EXTENSION_REQUEST") return can(actor, connectPaths.tasks, "approve");
  if (action === "UPDATE_SETTINGS") return can(actor, connectPaths.monitoring, "approve");
  return true; // Create on the tasks page, checked by apiHandler.
}

async function handlePOST(req: Request, actor: Actor) {
  try {
    await ensureTasksSchema();
    // Identity comes from the session, never from the request body.
    const actorId = actor.id;
    const actorName = actor.name || "ERP User";

    const pool = getConnectPool();
    const body = await req.json();
    const action = String(body.action || "CREATE_TASK");
    if (!actionAllowed(actor, action)) {
      return NextResponse.json({ success: false, error: "You do not have permission to perform this action." }, { status: 403 });
    }

    // 1. Create & Assign a New Task
    if (action === "CREATE_TASK") {
      const companyName = String(body.companyName || "Mariners").trim();
      const department = String(body.department || "Operations").trim();
      const projectName = String(body.projectName || "General Corporate Operations").trim();
      const title = String(body.title || "").trim();
      const description = String(body.description || "").trim();
      const assignedToId = String(body.assignedToId || `emp-${Date.now()}`).trim();
      const assignedToName = String(body.assignedToName || "").trim();
      const assignedToDesignation = String(body.assignedToDesignation || "Executive").trim();
      const collaborators = Array.isArray(body.collaborators) ? body.collaborators : [];
      const assignedByName = String(body.assignedByName || actorName).trim();
      const assignedByRole = String(body.assignedByRole || "Department Head").trim();
      const reportingToName = String(body.reportingToName || assignedByName).trim();
      const startDate = body.startDate ? new Date(body.startDate).toISOString() : new Date().toISOString();
      const deadline = body.deadline
        ? new Date(body.deadline).toISOString()
        : new Date(Date.now() + 8 * 3600 * 1000).toISOString();
      const priority = (String(body.priority || "HIGH").toUpperCase() as TaskPriority);
      const verificationRequired = body.verificationRequired !== false;
      const recurringType = (String(body.recurringType || "ONE_TIME").toUpperCase() as RecurringType);
      const attachmentName = body.attachmentName ? String(body.attachmentName).trim() : null;
      const attachmentUrl = body.attachmentUrl ? String(body.attachmentUrl).trim() : null;

      if (!title || !assignedToName) {
        return NextResponse.json(
          { success: false, error: "Task Title and Assigned Employee are required." },
          { status: 400 }
        );
      }

      // Generate Unique Task ID: e.g. LEGAL-2026-011
      const seqRes = await pool.query(`SELECT COUNT(*)::int AS cnt FROM connect_tasks`);
      const nextNum = (seqRes.rows[0]?.cnt ?? 0) + 1;
      const year = new Date().getFullYear();
      const taskCode = `${deptPrefix(department)}-${year}-${String(nextNum).padStart(3, "0")}`;
      const id = randomUUID();

      const insertRes = await pool.query(
        `
        INSERT INTO connect_tasks (
          id, task_code, company_name, department, project_name, title, description,
          assigned_to_id, assigned_to_name, assigned_to_designation, collaborators,
          assigned_by_id, assigned_by_name, assigned_by_role, reporting_to_id, reporting_to_name,
          start_date, original_deadline, deadline, priority, status, progress_percent,
          verification_required, recurring_type, attachment_name, attachment_url
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7,
          $8, $9, $10, $11::jsonb,
          $12, $13, $14, $15, $16,
          $17, $18, $19, $20, 'NOT_STARTED', 0,
          $21, $22, $23, $24
        ) RETURNING *
        `,
        [
          id,
          taskCode,
          companyName,
          department,
          projectName,
          title,
          description,
          assignedToId,
          assignedToName,
          assignedToDesignation,
          JSON.stringify(collaborators),
          actorId,
          assignedByName,
          assignedByRole,
          actorId,
          reportingToName,
          startDate,
          deadline,
          deadline,
          priority,
          verificationRequired,
          recurringType,
          attachmentName,
          attachmentUrl,
        ]
      );

      // Write progress log
      await pool.query(
        `
        INSERT INTO connect_task_logs (id, task_id, actor_id, actor_name, actor_role, action_type, previous_status, new_status, progress_percent, remarks)
        VALUES ($1, $2, $3, $4, $5, 'TASK_ASSIGNED', NULL, 'NOT_STARTED', 0, $6)
        `,
        [
          randomUUID(),
          id,
          actorId,
          assignedByName,
          assignedByRole,
          `Assigned new ${priority} priority task (#${taskCode}) to ${assignedToName}.`,
        ]
      );

      // If Recurring != ONE_TIME, also register in recurring templates automatically
      if (recurringType !== "ONE_TIME") {
        await pool.query(
          `
          INSERT INTO connect_task_recurring_templates (
            id, template_code, company_name, department, project_name, title, description,
            assigned_to_id, assigned_to_name, reporting_to_name, priority, frequency,
            schedule_label, due_offset_hours, verification_required, is_active, last_generated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 8, $14, TRUE, NOW())
          ON CONFLICT (template_code) DO NOTHING
          `,
          [
            randomUUID(),
            `REC-${taskCode}`,
            companyName,
            department,
            projectName,
            title,
            description,
            assignedToId,
            assignedToName,
            reportingToName,
            priority,
            recurringType,
            `Auto-scheduled ${recurringType} routine`,
            verificationRequired,
          ]
        );
      }

      // Broadcast real-time notification via Pusher
      try {
        const pusher = getPusherServer();
        if (pusher) {
          await pusher.trigger("connect-global", "new-message", {
            id: randomUUID(),
            conversationId: "task-alerts",
            senderId: actorId,
            senderName: `${assignedByName} (Task Desk)`,
            content: `New Task Assigned: [${taskCode}] ${title} — Assigned to ${assignedToName} (${priority} Priority)`,
            createdAt: new Date().toISOString(),
          });
        }
      } catch {
        // Ignore Pusher errors in offline dev
      }

      return NextResponse.json({
        success: true,
        task: mapTaskRow(insertRes.rows[0]),
      });
    }

    // 2. Submit Daily Work Report
    if (action === "SUBMIT_DAILY_REPORT") {
      const id = randomUUID();
      const employeeName = String(body.employeeName || actorName).trim();
      const companyName = String(body.companyName || "Mariners").trim();
      const department = String(body.department || "Operations").trim();
      const designation = String(body.designation || "Executive").trim();
      const tasksWorkedCount = Number(body.tasksWorkedCount ?? 1);
      const tasksCompletedCount = Number(body.tasksCompletedCount ?? 0);
      const tasksBlockedCount = Number(body.tasksBlockedCount ?? 0);
      const hoursLogged = Number(body.hoursLogged ?? 8.0);
      const summaryNotes = String(body.summaryNotes || "").trim();
      const achievements = String(body.achievements || "").trim();
      const blockersReported = String(body.blockersReported || "None").trim();
      const nextDayPlan = String(body.nextDayPlan || "").trim();
      const onApprovedLeave = Boolean(body.onApprovedLeave);

      const res = await pool.query(
        `
        INSERT INTO connect_daily_work_reports (
          id, report_date, employee_id, employee_name, company_name, department, designation,
          tasks_worked_count, tasks_completed_count, tasks_blocked_count, hours_logged,
          summary_notes, achievements, blockers_reported, next_day_plan, on_approved_leave
        ) VALUES ($1, CURRENT_DATE, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
        RETURNING *
        `,
        [
          id,
          actorId,
          employeeName,
          companyName,
          department,
          designation,
          tasksWorkedCount,
          tasksCompletedCount,
          tasksBlockedCount,
          hoursLogged,
          summaryNotes,
          achievements,
          blockersReported,
          nextDayPlan,
          onApprovedLeave,
        ]
      );

      return NextResponse.json({ success: true, report: res.rows[0] });
    }

    // 3. Create Recurring Task Template
    if (action === "CREATE_RECURRING_TEMPLATE") {
      const id = randomUUID();
      const seqRes = await pool.query(`SELECT COUNT(*)::int AS cnt FROM connect_task_recurring_templates`);
      const nextNum = (seqRes.rows[0]?.cnt ?? 0) + 1;
      const frequency = String(body.frequency || "DAILY").toUpperCase();
      const templateCode = `REC-${frequency}-${String(nextNum).padStart(3, "0")}`;

      const res = await pool.query(
        `
        INSERT INTO connect_task_recurring_templates (
          id, template_code, company_name, department, project_name, title, description,
          assigned_to_id, assigned_to_name, reporting_to_name, priority, frequency,
          schedule_label, due_offset_hours, verification_required, is_active, last_generated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, TRUE, NULL)
        RETURNING *
        `,
        [
          id,
          templateCode,
          String(body.companyName || "Mariners"),
          String(body.department || "Accounts"),
          String(body.projectName || "Routine Operations"),
          String(body.title || ""),
          String(body.description || ""),
          String(body.assignedToId || "emp-staff"),
          String(body.assignedToName || ""),
          String(body.reportingToName || "Department Head"),
          String(body.priority || "HIGH").toUpperCase(),
          frequency,
          String(body.scheduleLabel || `Every ${frequency} cycle`),
          Number(body.dueOffsetHours ?? 8),
          body.verificationRequired !== false,
        ]
      );

      return NextResponse.json({ success: true, template: res.rows[0] });
    }

    // 4. Spawn Live Task from Recurring Template
    if (action === "GENERATE_FROM_RECURRING") {
      const templateId = String(body.templateId || "");
      const tplRes = await pool.query(
        `SELECT * FROM connect_task_recurring_templates WHERE id = $1 LIMIT 1`,
        [templateId]
      );
      if (tplRes.rows.length === 0) {
        return NextResponse.json({ success: false, error: "Template not found" }, { status: 404 });
      }
      const tpl = tplRes.rows[0];
      const seqRes = await pool.query(`SELECT COUNT(*)::int AS cnt FROM connect_tasks`);
      const nextNum = (seqRes.rows[0]?.cnt ?? 0) + 1;
      const taskCode = `${deptPrefix(tpl.department)}-${new Date().getFullYear()}-${String(nextNum).padStart(3, "0")}`;
      const newTaskId = randomUUID();
      const deadline = new Date(Date.now() + Number(tpl.due_offset_hours || 8) * 3600 * 1000).toISOString();

      const insertRes = await pool.query(
        `
        INSERT INTO connect_tasks (
          id, task_code, company_name, department, project_name, title, description,
          assigned_to_id, assigned_to_name, assigned_to_designation, collaborators,
          assigned_by_id, assigned_by_name, assigned_by_role, reporting_to_id, reporting_to_name,
          start_date, original_deadline, deadline, priority, status, progress_percent,
          verification_required, recurring_type
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7,
          $8, $9, 'Assigned Executive', '[]'::jsonb,
          $10, 'Recurring Scheduler', 'System Automation', $10, $11,
          NOW(), $12, $12, $13, 'NOT_STARTED', 0,
          $14, $15
        ) RETURNING *
        `,
        [
          newTaskId,
          taskCode,
          tpl.company_name,
          tpl.department,
          tpl.project_name,
          tpl.title,
          tpl.description,
          tpl.assigned_to_id,
          tpl.assigned_to_name,
          actorId,
          tpl.reporting_to_name,
          deadline,
          tpl.priority,
          tpl.verification_required,
          tpl.frequency,
        ]
      );

      await pool.query(
        `UPDATE connect_task_recurring_templates SET last_generated_at = NOW() WHERE id = $1`,
        [templateId]
      );

      return NextResponse.json({
        success: true,
        task: mapTaskRow(insertRes.rows[0]),
      });
    }

    // 5. Request Deadline Extension
    if (action === "REQUEST_DEADLINE_EXTENSION") {
      const taskId = String(body.taskId || "");
      const proposedDeadline = new Date(body.proposedDeadline).toISOString();
      const reason = String(body.reason || "").trim();
      const requestedByName = String(body.requestedByName || actorName).trim();

      const taskRes = await pool.query(`SELECT * FROM connect_tasks WHERE id = $1 LIMIT 1`, [taskId]);
      if (taskRes.rows.length === 0) {
        return NextResponse.json({ success: false, error: "Task not found" }, { status: 404 });
      }
      const task = taskRes.rows[0];

      const extRes = await pool.query(
        `
        INSERT INTO connect_task_extension_requests (
          id, task_id, task_code, requested_by_id, requested_by_name,
          current_deadline, proposed_deadline, reason, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'PENDING')
        RETURNING *
        `,
        [
          randomUUID(),
          taskId,
          task.task_code,
          actorId,
          requestedByName,
          task.deadline,
          proposedDeadline,
          reason,
        ]
      );

      return NextResponse.json({ success: true, extensionRequest: extRes.rows[0] });
    }

    // 6. Approve or Reject Deadline Extension Request
    if (action === "REVIEW_EXTENSION_REQUEST") {
      const requestId = String(body.requestId || "");
      const decision = String(body.decision || "APPROVED").toUpperCase(); // APPROVED | REJECTED
      const reviewerName = actorName;
      const reviewRemarks = String(body.reviewRemarks || "").trim();

      const extRes = await pool.query(
        `SELECT * FROM connect_task_extension_requests WHERE id = $1 LIMIT 1`,
        [requestId]
      );
      if (extRes.rows.length === 0) {
        return NextResponse.json({ success: false, error: "Extension request not found" }, { status: 404 });
      }
      const ext = extRes.rows[0];

      await pool.query(
        `
        UPDATE connect_task_extension_requests
        SET status = $1, reviewed_by_name = $2, review_remarks = $3
        WHERE id = $4
        `,
        [decision, reviewerName, reviewRemarks, requestId]
      );

      if (decision === "APPROVED") {
        await pool.query(
          `UPDATE connect_task_tasks_deadlines_helper`
        ).catch(() => null);

        await pool.query(
          `UPDATE connect_tasks SET deadline = $1, updated_at = NOW() WHERE id = $2`,
          [ext.proposed_deadline, ext.task_id]
        );

        // Log Immutable Audit Entry for Deadline Change
        await pool.query(
          `
          INSERT INTO connect_task_audit_logs (
            id, task_id, task_code, actor_id, actor_name, actor_role,
            audit_action, field_changed, old_value, new_value, reason
          ) VALUES ($1, $2, $3, $4, $5, 'Supervisor / Approver', 'DEADLINE_CHANGE', 'deadline', $6, $7, $8)
          `,
          [
            randomUUID(),
            ext.task_id,
            ext.task_code,
            actorId,
            reviewerName,
            new Date(ext.current_deadline).toISOString(),
            new Date(ext.proposed_deadline).toISOString(),
            `Approved extension request: ${ext.reason}`,
          ]
        );
      }

      return NextResponse.json({ success: true });
    }

    // 7. Update Global Task & Escalation Settings
    if (action === "UPDATE_SETTINGS") {
      const res = await pool.query(
        `
        UPDATE connect_task_settings
        SET
          reminder_before_deadline_hours = $1,
          dept_head_overdue_alert_hours = $2,
          cmo_overdue_alert_hours = $3,
          critical_task_immediate_md_alert = $4,
          require_verification_for_completion = $5,
          cmo_can_approve_tasks = $6,
          cmo_can_change_deadlines = $7,
          cmo_can_send_nudges = $8,
          cmo_can_escalate_to_md = $9,
          updated_at = NOW()
        WHERE id = 'global'
        RETURNING *
        `,
        [
          Number(body.reminderBeforeDeadlineHours ?? 2),
          Number(body.deptHeadOverdueAlertHours ?? 1),
          Number(body.cmoOverdueAlertHours ?? 24),
          Boolean(body.criticalTaskImmediateMdAlert ?? true),
          Boolean(body.requireVerificationForCompletion ?? true),
          Boolean(body.cmoCanApproveTasks ?? false),
          Boolean(body.cmoCanChangeDeadlines ?? false),
          Boolean(body.cmoCanSendNudges ?? true),
          Boolean(body.cmoCanEscalateToMd ?? true),
        ]
      );
      return NextResponse.json({ success: true, settings: res.rows[0] });
    }

    return NextResponse.json({ success: false, error: "Unsupported action" }, { status: 400 });
  } catch (error) {
    console.error("Error in POST /api/connect/tasks:", error);
    return NextResponse.json(
      { success: false, error: "Failed to process task operation" },
      { status: 500 }
    );
  }
}

export const GET = apiHandler("configuration:read", (req) => handleGET(req));
export const POST = apiHandler("configuration:write", (req, _context, actor) => handlePOST(req, actor));

