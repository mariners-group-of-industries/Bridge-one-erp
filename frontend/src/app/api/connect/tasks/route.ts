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
  canViewConnectTask,
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

async function handleGET(req: Request, actor: Actor) {
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

    let currentEmployeeId: string | null = null;
    try {
      const empSelf = await pool.query(`SELECT id FROM employees WHERE "userId"::text = $1 LIMIT 1`, [actor.id]);
      currentEmployeeId = empSelf.rows[0]?.id ? String(empSelf.rows[0].id) : null;
    } catch {
      currentEmployeeId = null;
    }

    const allTasks = tasksRes.rows.map(mapTaskRow);
    const visibleTasks = actor.isMaster
      ? allTasks
      : allTasks.filter((t) => canViewConnectTask(t, actor, currentEmployeeId));

    // Apply filters for the filtered view while keeping visibleTasks for KPI/Golden Reports
    const filteredTasks = visibleTasks.filter((t) => {
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
      currentUser: {
        id: actor.id,
        name: actor.name || "ERP User",
        employeeId: currentEmployeeId,
        isMaster: Boolean(actor.isMaster),
      },
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
      const checklist = Array.isArray(body.checklist)
        ? body.checklist
            .filter((item: unknown) => item && typeof item === "object" && String((item as { text?: string }).text || "").trim())
            .map((item: { id?: string; text?: string; done?: boolean }) => ({
              id: String(item.id || randomUUID()),
              text: String(item.text || "").trim(),
              done: Boolean(item.done),
            }))
        : [];

      const assigneesList: Array<{ id: string; name: string; designation: string; department?: string }> =
        Array.isArray(body.assignees) && body.assignees.length > 0
          ? body.assignees
              .filter((a: unknown) => a && typeof a === "object" && String((a as { name?: string }).name || "").trim())
              .map((a: { id?: string; name?: string; designation?: string; department?: string }) => ({
                id: String(a.id || `emp-${Date.now()}`),
                name: String(a.name || "").trim(),
                designation: String(a.designation || "Executive").trim(),
                department: a.department ? String(a.department).trim() : undefined,
              }))
          : [{ id: assignedToId, name: assignedToName, designation: assignedToDesignation, department }];

      if (!title || assigneesList.length === 0 || !assigneesList[0].name) {
        return NextResponse.json(
          { success: false, error: "Task Title and Assigned Employee are required." },
          { status: 400 }
        );
      }

      const seqRes = await pool.query(`SELECT COUNT(*)::int AS cnt FROM connect_tasks`);
      let nextNum = (seqRes.rows[0]?.cnt ?? 0) + 1;
      const year = new Date().getFullYear();

      const allocationMode = String(body.allocationMode || "INDIVIDUAL").toUpperCase();
      const groupName = String(body.groupName || "").trim();
      const isSharedGroup = allocationMode === "GROUP" && assigneesList.length > 1;

      const primaryAssignee = assigneesList[0];
      const targets = isSharedGroup
        ? [
            {
              id: primaryAssignee.id,
              name: groupName ? `${groupName} (${assigneesList.length})` : `${primaryAssignee.name} +${assigneesList.length - 1}`,
              designation: "Group Task",
              department: groupName || primaryAssignee.department || department,
              collaboratorsList: [
                ...collaborators,
                ...assigneesList.map((a) => ({
                  id: a.id,
                  name: a.name,
                  department: a.department || department,
                })),
              ],
            },
          ]
        : assigneesList.map((a) => ({
            ...a,
            collaboratorsList: collaborators,
          }));

      let firstCreatedRow = null as Record<string, unknown> | null;
      const createdTasks = [];

      for (const target of targets) {
        const taskDept = target.department || department;
        const taskCode = `${deptPrefix(taskDept)}-${year}-${String(nextNum).padStart(3, "0")}`;
        nextNum += 1;
        const id = randomUUID();

        const insertRes = await pool.query(
          `
          INSERT INTO connect_tasks (
            id, task_code, company_name, department, project_name, title, description,
            assigned_to_id, assigned_to_name, assigned_to_designation, collaborators, checklist,
            assigned_by_id, assigned_by_name, assigned_by_role, reporting_to_id, reporting_to_name,
            start_date, original_deadline, deadline, priority, status, progress_percent,
            verification_required, recurring_type, attachment_name, attachment_url
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7,
            $8, $9, $10, $11::jsonb, $12::jsonb,
            $13, $14, $15, $16, $17,
            $18, $19, $20, $21, 'NOT_STARTED', 0,
            $22, $23, $24, $25
          ) RETURNING *
          `,
          [
            id,
            taskCode,
            companyName,
            taskDept,
            projectName,
            title,
            description,
            target.id,
            target.name,
            target.designation,
            JSON.stringify(target.collaboratorsList),
            JSON.stringify(checklist),
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
        if (!firstCreatedRow) firstCreatedRow = insertRes.rows[0];
        createdTasks.push(mapTaskRow(insertRes.rows[0]));

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
            `Assigned new ${priority} priority task (#${taskCode}) to ${target.name}.`,
          ]
        );
      }

      const taskCode = createdTasks[0].taskCode;

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
            primaryAssignee.id,
            primaryAssignee.name,
            reportingToName,
            priority,
            recurringType,
            `Auto-scheduled ${recurringType} routine`,
            verificationRequired,
          ]
        );
      }

      // Send direct BRG Connect Chat notification to each linked employee
      try {
        for (let i = 0; i < assigneesList.length; i += 1) {
          const assignee = assigneesList[i];
          const created = isSharedGroup ? createdTasks[0] : createdTasks[i];
          const empUserRes = await pool.query(
            `SELECT "userId" FROM employees WHERE id::text = $1 AND "userId" IS NOT NULL LIMIT 1`,
            [assignee.id]
          );
          const targetUserId = empUserRes.rows[0]?.userId ? String(empUserRes.rows[0].userId) : null;
          if (!targetUserId || targetUserId === actorId) continue;

          const existingConv = await pool.query(
            `
            SELECT c.id FROM connect_conversations c
            JOIN connect_conversation_members m1 ON m1.conversation_id = c.id AND m1.user_id::text = $1 AND m1.left_at IS NULL
            JOIN connect_conversation_members m2 ON m2.conversation_id = c.id AND m2.user_id::text = $2 AND m2.left_at IS NULL
            WHERE c.type = 'DIRECT' AND c.is_archived = false
            LIMIT 1
            `,
            [actorId, targetUserId]
          );
          let convId = existingConv.rows[0]?.id ? String(existingConv.rows[0].id) : null;
          if (!convId) {
            convId = randomUUID();
            await pool.query(
              `INSERT INTO connect_conversations (id, type, created_by_id, is_archived, created_at, updated_at) VALUES ($1, 'DIRECT', $2::uuid, false, NOW(), NOW())`,
              [convId, actorId]
            );
            await pool.query(
              `INSERT INTO connect_conversation_members (id, conversation_id, user_id, role) VALUES ($1, $2, $3::uuid, 'MEMBER'), ($4, $2, $5::uuid, 'MEMBER') ON CONFLICT DO NOTHING`,
              [randomUUID(), convId, actorId, randomUUID(), targetUserId]
            );
          }
          const msgBody = `New Task Allocated: [${created.taskCode}] ${title}\nPriority: ${priority} · Due: ${deadline.slice(0, 10)}`;
          await pool.query(
            `
            INSERT INTO connect_messages (id, conversation_id, sender_id, type, body, erp_record_type, erp_record_id, erp_record_data, created_at)
            VALUES ($1, $2, $3::uuid, 'TEXT', $4, 'TASK', $5, $6::jsonb, NOW())
            `,
            [
              randomUUID(),
              convId,
              actorId,
              msgBody,
              created.id,
              JSON.stringify({ taskCode: created.taskCode, title, priority, deadline: deadline.slice(0, 10) }),
            ]
          );
          await pool.query(`UPDATE connect_conversations SET updated_at = NOW() WHERE id = $1`, [convId]);
        }
      } catch {
        // Non-blocking: chat notification failure should never fail task creation
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
            content: `New Task Assigned: [${taskCode}] ${title} — Assigned to ${assigneesList.map((a) => a.name).join(", ")} (${priority} Priority)`,
            createdAt: new Date().toISOString(),
          });
        }
      } catch {
        // Ignore Pusher errors in offline dev
      }

      return NextResponse.json({
        success: true,
        task: createdTasks[0],
        tasks: createdTasks,
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

export const GET = apiHandler("configuration:read", (req, _context, actor) => handleGET(req, actor));
export const POST = apiHandler("configuration:write", (req, _context, actor) => handlePOST(req, actor));

