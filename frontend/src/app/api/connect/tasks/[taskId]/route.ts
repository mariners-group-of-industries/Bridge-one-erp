import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getConnectPool } from "@/lib/connect/db";
import { getConnectAuthUser } from "@/lib/connect/auth";
import { getPusherServer } from "@/lib/connect/pusher-server";
import { ensureTasksSchema, mapTaskRow, type TaskStatus, type TaskPriority } from "@/lib/connect/tasks-db";

export async function GET(
  req: Request,
  context: { params: Promise<{ taskId: string }> }
) {
  try {
    const user = await getConnectAuthUser(req);
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    await ensureTasksSchema();
    const { taskId } = await context.params;
    const pool = getConnectPool();

    const taskRes = await pool.query(
      `SELECT * FROM connect_tasks WHERE id::text = $1 OR task_code = $1 LIMIT 1`,
      [taskId]
    );
    if (taskRes.rows.length === 0) {
      return NextResponse.json({ success: false, error: "Task not found" }, { status: 404 });
    }

    const task = mapTaskRow(taskRes.rows[0]);
    const [logsRes, auditRes] = await Promise.all([
      pool.query(`SELECT * FROM connect_task_logs WHERE task_id = $1 ORDER BY created_at DESC`, [task.id]),
      pool.query(`SELECT * FROM connect_task_audit_logs WHERE task_id = $1 ORDER BY created_at DESC`, [task.id]),
    ]);

    return NextResponse.json({
      success: true,
      task,
      logs: logsRes.rows,
      auditLogs: auditRes.rows,
    });
  } catch (error) {
    console.error("Error in GET /api/connect/tasks/[taskId]:", error);
    return NextResponse.json({ success: false, error: "Failed to fetch task details" }, { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  context: { params: Promise<{ taskId: string }> }
) {
  try {
    const user = await getConnectAuthUser(req);
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    await ensureTasksSchema();
    const { taskId } = await context.params;
    const pool = getConnectPool();

    const body = await req.json();
    const mutationType = String(body.mutationType || "STAFF_UPDATE");
    const actorName = String(body.actorName || user?.name || "ERP User").trim();
    const actorRole = String(body.actorRole || "Staff").trim();
    const actorId = user?.id || "emp-user";

    const existingRes = await pool.query(
      `SELECT * FROM connect_tasks WHERE id::text = $1 OR task_code = $1 LIMIT 1`,
      [taskId]
    );
    if (existingRes.rows.length === 0) {
      return NextResponse.json({ success: false, error: "Task not found" }, { status: 404 });
    }
    const current = existingRes.rows[0];
    const settingsRes = await pool.query(`SELECT * FROM connect_task_settings WHERE id = 'global' LIMIT 1`);
    const settings = settingsRes.rows[0] || {};

    // 1. Staff Daily Work Update (Progress %, Status, Remarks, Evidence Upload, Blocker)
    if (mutationType === "STAFF_UPDATE") {
      let nextStatus = String(body.status || current.status) as TaskStatus;
      let nextProgress =
        body.progressPercent !== undefined ? Number(body.progressPercent) : Number(current.progress_percent);
      nextProgress = Math.max(0, Math.min(100, nextProgress));

      // CRITICAL RULE (Section 5): If Verification Required = Yes, Staff cannot self-mark VERIFIED_COMPLETED.
      // Selecting Completed / 100% routes the task to SUBMITTED_FOR_APPROVAL for Supervisor Verification.
      if (nextStatus === "VERIFIED_COMPLETED" && current.verification_required) {
        nextStatus = "SUBMITTED_FOR_APPROVAL";
      }
      if (nextStatus === "SUBMITTED_FOR_APPROVAL") {
        nextProgress = 100;
      }

      const staffRemarks =
        body.staffRemarks !== undefined ? String(body.staffRemarks).trim() : current.staff_remarks;
      const evidenceName =
        body.evidenceName !== undefined ? (body.evidenceName ? String(body.evidenceName).trim() : null) : current.evidence_name;
      const evidenceUrl =
        body.evidenceUrl !== undefined ? (body.evidenceUrl ? String(body.evidenceUrl).trim() : null) : current.evidence_url;
      const blockerReason =
        body.blockerReason !== undefined ? (body.blockerReason ? String(body.blockerReason).trim() : null) : current.blocker_reason;
      const blockedByDepartment =
        body.blockedByDepartment !== undefined ? (body.blockedByDepartment ? String(body.blockedByDepartment).trim() : null) : current.blocked_by_department;
      const blockedByPerson =
        body.blockedByPerson !== undefined ? (body.blockedByPerson ? String(body.blockedByPerson).trim() : null) : current.blocked_by_person;
      const requiresMdDecision =
        body.requiresMdDecision !== undefined ? Boolean(body.requiresMdDecision) : Boolean(current.requires_md_decision);

      const submittedAt =
        nextStatus === "SUBMITTED_FOR_APPROVAL"
          ? new Date().toISOString()
          : current.submitted_at;

      const updatedRes = await pool.query(
        `
        UPDATE connect_tasks
        SET
          status = $1,
          progress_percent = $2,
          staff_remarks = $3,
          evidence_name = $4,
          evidence_url = $5,
          blocker_reason = $6,
          blocked_by_department = $7,
          blocked_by_person = $8,
          requires_md_decision = $9,
          submitted_at = $10,
          updated_at = NOW()
        WHERE id = $11
        RETURNING *
        `,
        [
          nextStatus,
          nextProgress,
          staffRemarks,
          evidenceName,
          evidenceUrl,
          blockerReason,
          blockedByDepartment,
          blockedByPerson,
          requiresMdDecision,
          submittedAt,
          current.id,
        ]
      );

      await pool.query(
        `
        INSERT INTO connect_task_logs (
          id, task_id, actor_id, actor_name, actor_role, action_type,
          previous_status, new_status, progress_percent, remarks, attachment_name, attachment_url
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        `,
        [
          randomUUID(),
          current.id,
          actorId,
          actorName,
          actorRole,
          nextStatus === "SUBMITTED_FOR_APPROVAL"
            ? "SUBMITTED_FOR_APPROVAL"
            : nextStatus === "BLOCKED"
            ? "BLOCKER_REPORTED"
            : "PROGRESS_UPDATE",
          current.status,
          nextStatus,
          nextProgress,
          staffRemarks || `Updated task status to ${nextStatus} (${nextProgress}%)`,
          evidenceName,
          evidenceUrl,
        ]
      );

      // Broadcast live notification if submitted for approval or blocked
      try {
        const pusher = getPusherServer();
        if (pusher && (nextStatus === "SUBMITTED_FOR_APPROVAL" || nextStatus === "BLOCKED")) {
          await pusher.trigger("connect-global", "new-message", {
            id: randomUUID(),
            conversationId: "task-alerts",
            senderId: actorId,
            senderName: `${actorName} (${current.department})`,
            content:
              nextStatus === "SUBMITTED_FOR_APPROVAL"
                ? `Approval Requested: [${current.task_code}] ${current.title} (100%) — Waiting for ${current.reporting_to_name}`
                : `Task Blocked: [${current.task_code}] ${current.title} — Reason: ${blockerReason || "Support needed"}`,
            createdAt: new Date().toISOString(),
          });
        }
      } catch {
        // Ignore offline Pusher errors
      }

      return NextResponse.json({
        success: true,
        task: mapTaskRow(updatedRes.rows[0]),
      });
    }

    // 2. Supervisor Approval -> Verified Completed (with CMO Permission Guardrail!)
    if (mutationType === "SUPERVISOR_VERIFY") {
      if (
        actorRole.toLowerCase().includes("central monitoring") &&
        !settings.cmo_can_approve_tasks
      ) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Permission Denied: Central Monitoring Officer can monitor, send follow-up reminders, and escalate to MD, but cannot approve task completion.",
          },
          { status: 403 }
        );
      }

      const qualityRating = Math.max(1, Math.min(5, Number(body.qualityRating || 5)));
      const supervisorFeedback = String(
        body.supervisorFeedback || "Verified deliverables and approved completion."
      ).trim();

      const updatedRes = await pool.query(
        `
        UPDATE connect_tasks
        SET
          status = 'VERIFIED_COMPLETED',
          progress_percent = 100,
          quality_rating = $1,
          supervisor_feedback = $2,
          completed_at = COALESCE(completed_at, NOW()),
          verified_at = NOW(),
          escalation_stage = 'NONE',
          requires_md_decision = FALSE,
          updated_at = NOW()
        WHERE id = $3
        RETURNING *
        `,
        [qualityRating, supervisorFeedback, current.id]
      );

      await pool.query(
        `
        INSERT INTO connect_task_logs (
          id, task_id, actor_id, actor_name, actor_role, action_type,
          previous_status, new_status, progress_percent, remarks
        ) VALUES ($1, $2, $3, $4, $5, 'VERIFIED_COMPLETED', $6, 'VERIFIED_COMPLETED', 100, $7)
        `,
        [
          randomUUID(),
          current.id,
          actorId,
          actorName,
          actorRole,
          current.status,
          `Verified & Approved (${qualityRating}/5 Stars): ${supervisorFeedback}`,
        ]
      );

      return NextResponse.json({
        success: true,
        task: mapTaskRow(updatedRes.rows[0]),
      });
    }

    // 3. Supervisor Rejects Task -> Correction Request sent back to Employee
    if (mutationType === "SUPERVISOR_REJECT") {
      if (
        actorRole.toLowerCase().includes("central monitoring") &&
        !settings.cmo_can_approve_tasks
      ) {
        return NextResponse.json(
          {
            success: false,
            error: "Permission Denied: Only the Reporting Supervisor, Department Head, or MD can reject/approve submissions.",
          },
          { status: 403 }
        );
      }

      const supervisorFeedback = String(
        body.supervisorFeedback || "Correction required. Please revise and resubmit with updated evidence."
      ).trim();
      const fallbackProgress = Math.min(85, Number(body.progressPercent ?? 75));

      const updatedRes = await pool.query(
        `
        UPDATE connect_tasks
        SET
          status = 'IN_PROGRESS',
          progress_percent = $1,
          supervisor_feedback = $2,
          rework_count = rework_count + 1,
          updated_at = NOW()
        WHERE id = $3
        RETURNING *
        `,
        [fallbackProgress, supervisorFeedback, current.id]
      );

      await pool.query(
        `
        INSERT INTO connect_task_logs (
          id, task_id, actor_id, actor_name, actor_role, action_type,
          previous_status, new_status, progress_percent, remarks
        ) VALUES ($1, $2, $3, $4, $5, 'TASK_REJECTED', $6, 'IN_PROGRESS', $7, $8)
        `,
        [
          randomUUID(),
          current.id,
          actorId,
          actorName,
          actorRole,
          current.status,
          fallbackProgress,
          `Correction Requested by ${actorName}: ${supervisorFeedback}`,
        ]
      );

      try {
        const pusher = getPusherServer();
        if (pusher) {
          await pusher.trigger("connect-global", "new-message", {
            id: randomUUID(),
            conversationId: "task-alerts",
            senderId: actorId,
            senderName: `${actorName} (Supervisor Review)`,
            content: `Correction Requested on [${current.task_code}] ${current.title}: "${supervisorFeedback}"`,
            createdAt: new Date().toISOString(),
          });
        }
      } catch {
        // Ignore offline errors
      }

      return NextResponse.json({
        success: true,
        task: mapTaskRow(updatedRes.rows[0]),
      });
    }

    // 4. Central Monitoring Officer (CMO) / Supervisor Follow-up Nudge & Escalation
    if (mutationType === "CMO_NUDGE") {
      const nudgeMessage = String(
        body.nudgeMessage || `Follow-up reminder on [${current.task_code}] ${current.title}. Please update status immediately.`
      ).trim();
      const escalateToMd = Boolean(body.escalateToMd);

      const updatedRes = await pool.query(
        `
        UPDATE connect_tasks
        SET
          nudge_count = nudge_count + 1,
          last_nudged_at = NOW(),
          requires_md_decision = CASE WHEN $1 THEN TRUE ELSE requires_md_decision END,
          escalation_stage = CASE WHEN $1 THEN 'MD_CRITICAL_ALERT' ELSE escalation_stage END,
          updated_at = NOW()
        WHERE id = $2
        RETURNING *
        `,
        [escalateToMd, current.id]
      );

      await pool.query(
        `
        INSERT INTO connect_task_logs (
          id, task_id, actor_id, actor_name, actor_role, action_type,
          previous_status, new_status, progress_percent, remarks
        ) VALUES ($1, $2, $3, $4, $5, 'FOLLOWUP_NUDGE', $6, $6, $7, $8)
        `,
        [
          randomUUID(),
          current.id,
          actorId,
          actorName,
          actorRole,
          current.status,
          current.progress_percent,
          `${escalateToMd ? "[ESCALATED TO MD] " : "[FOLLOW-UP NUDGE] "}${nudgeMessage}`,
        ]
      );

      if (escalateToMd) {
        await pool.query(
          `
          INSERT INTO connect_task_audit_logs (
            id, task_id, task_code, actor_id, actor_name, actor_role,
            audit_action, field_changed, old_value, new_value, reason
          ) VALUES ($1, $2, $3, $4, $5, $6, 'MD_DECISION_LOGGED', 'requires_md_decision', 'false', 'true', $7)
          `,
          [randomUUID(), current.id, current.task_code, actorId, actorName, actorRole, nudgeMessage]
        );
      }

      try {
        const pusher = getPusherServer();
        if (pusher) {
          await pusher.trigger("connect-global", "new-message", {
            id: randomUUID(),
            conversationId: "task-alerts",
            senderId: actorId,
            senderName: `${actorName} (${actorRole})`,
            content: `${escalateToMd ? "🚨 MD Escalation Alert" : "⏰ Central Monitoring Follow-up"}: [${current.task_code}] ${nudgeMessage}`,
            createdAt: new Date().toISOString(),
          });
        }
      } catch {
        // Ignore offline Pusher errors
      }

      return NextResponse.json({
        success: true,
        task: mapTaskRow(updatedRes.rows[0]),
      });
    }

    // 5. Verify Inter-Departmental Blocker (Protects Employee KPI from unfair penalty)
    if (mutationType === "VERIFY_BLOCKER") {
      const blockerVerified = body.blockerVerified !== false;
      const updatedRes = await pool.query(
        `
        UPDATE connect_tasks
        SET blocker_verified = $1, updated_at = NOW()
        WHERE id = $2
        RETURNING *
        `,
        [blockerVerified, current.id]
      );

      await pool.query(
        `
        INSERT INTO connect_task_logs (
          id, task_id, actor_id, actor_name, actor_role, action_type,
          previous_status, new_status, progress_percent, remarks
        ) VALUES ($1, $2, $3, $4, $5, 'BLOCKER_VERIFIED', $6, $6, $7, $8)
        `,
        [
          randomUUID(),
          current.id,
          actorId,
          actorName,
          actorRole,
          current.status,
          current.progress_percent,
          `Verified inter-departmental blocker (${current.blocked_by_department || "External"}). Overdue KPI penalty waived for ${current.assigned_to_name}.`,
        ]
      );

      return NextResponse.json({
        success: true,
        task: mapTaskRow(updatedRes.rows[0]),
      });
    }

    // 6. MD Executive Decision on Golden Report #3
    if (mutationType === "MD_DECISION") {
      const mdDecisionNote = String(body.mdDecisionNote || "").trim();
      const unblockTask = body.unblockTask !== false;
      const nextStatus = unblockTask && current.status === "BLOCKED" ? "IN_PROGRESS" : current.status;

      const updatedRes = await pool.query(
        `
        UPDATE connect_tasks
        SET
          md_decision_note = $1,
          requires_md_decision = FALSE,
          status = $2,
          updated_at = NOW()
        WHERE id = $3
        RETURNING *
        `,
        [mdDecisionNote, nextStatus, current.id]
      );

      await pool.query(
        `
        INSERT INTO connect_task_audit_logs (
          id, task_id, task_code, actor_id, actor_name, actor_role,
          audit_action, field_changed, old_value, new_value, reason
        ) VALUES ($1, $2, $3, $4, $5, 'Managing Director', 'MD_DECISION_LOGGED', 'md_decision_note', $6, $7, $8)
        `,
        [
          randomUUID(),
          current.id,
          current.task_code,
          actorId,
          actorName,
          current.md_decision_note || "Pending Decision",
          mdDecisionNote,
          `Executive directive issued on ${current.task_code}`,
        ]
      );

      await pool.query(
        `
        INSERT INTO connect_task_logs (
          id, task_id, actor_id, actor_name, actor_role, action_type,
          previous_status, new_status, progress_percent, remarks
        ) VALUES ($1, $2, $3, $4, 'Managing Director', 'MD_DECISION', $5, $6, $7, $8)
        `,
        [
          randomUUID(),
          current.id,
          actorId,
          actorName,
          current.status,
          nextStatus,
          current.progress_percent,
          `MD Executive Decision: ${mdDecisionNote}`,
        ]
      );

      return NextResponse.json({
        success: true,
        task: mapTaskRow(updatedRes.rows[0]),
      });
    }

    // 7. Governance Mutations with Mandatory Audit Trail (Deadline Change / Assignment Change / Priority / Cancel)
    if (mutationType === "GOVERNANCE_EDIT") {
      if (
        actorRole.toLowerCase().includes("central monitoring") &&
        !settings.cmo_can_change_deadlines
      ) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Permission Denied: Central Monitoring Officer cannot modify deadlines, assignments, or cancel tasks.",
          },
          { status: 403 }
        );
      }

      const reason = String(body.reason || "Administrative adjustment").trim();
      const newDeadline = body.deadline ? new Date(body.deadline).toISOString() : null;
      const newAssignedToName = body.assignedToName ? String(body.assignedToName).trim() : null;
      const newPriority = body.priority ? (String(body.priority).toUpperCase() as TaskPriority) : null;
      const cancelTask = Boolean(body.cancelTask);

      if (newDeadline && newDeadline !== new Date(current.deadline).toISOString()) {
        await pool.query(
          `
          INSERT INTO connect_task_audit_logs (
            id, task_id, task_code, actor_id, actor_name, actor_role,
            audit_action, field_changed, old_value, new_value, reason
          ) VALUES ($1, $2, $3, $4, $5, $6, 'DEADLINE_CHANGE', 'deadline', $7, $8, $9)
          `,
          [
            randomUUID(),
            current.id,
            current.task_code,
            actorId,
            actorName,
            actorRole,
            new Date(current.deadline).toISOString(),
            newDeadline,
            reason,
          ]
        );
      }

      if (newAssignedToName && newAssignedToName !== current.assigned_to_name) {
        await pool.query(
          `
          INSERT INTO connect_task_audit_logs (
            id, task_id, task_code, actor_id, actor_name, actor_role,
            audit_action, field_changed, old_value, new_value, reason
          ) VALUES ($1, $2, $3, $4, $5, $6, 'ASSIGNMENT_CHANGE', 'assigned_to_name', $7, $8, $9)
          `,
          [
            randomUUID(),
            current.id,
            current.task_code,
            actorId,
            actorName,
            actorRole,
            current.assigned_to_name,
            newAssignedToName,
            reason,
          ]
        );
      }

      if (cancelTask) {
        await pool.query(
          `
          INSERT INTO connect_task_audit_logs (
            id, task_id, task_code, actor_id, actor_name, actor_role,
            audit_action, field_changed, old_value, new_value, reason
          ) VALUES ($1, $2, $3, $4, $5, $6, 'TASK_CANCELLED', 'status', $7, 'CANCELLED', $8)
          `,
          [
            randomUUID(),
            current.id,
            current.task_code,
            actorId,
            actorName,
            actorRole,
            current.status,
            reason,
          ]
        );
      }

      const updatedRes = await pool.query(
        `
        UPDATE connect_tasks
        SET
          deadline = COALESCE($1, deadline),
          assigned_to_name = COALESCE($2, assigned_to_name),
          priority = COALESCE($3, priority),
          status = CASE WHEN $4 THEN 'CANCELLED' ELSE status END,
          updated_at = NOW()
        WHERE id = $5
        RETURNING *
        `,
        [newDeadline, newAssignedToName, newPriority, cancelTask, current.id]
      );

      return NextResponse.json({
        success: true,
        task: mapTaskRow(updatedRes.rows[0]),
      });
    }

    return NextResponse.json({ success: false, error: "Unsupported mutationType" }, { status: 400 });
  } catch (error) {
    console.error("Error in PATCH /api/connect/tasks/[taskId]:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update task" },
      { status: 500 }
    );
  }
}

