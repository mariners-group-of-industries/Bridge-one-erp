import { badRequest, notFound } from "@/lib/api/errors";
import type { Actor } from "@/lib/auth/actor";
import { db } from "@/lib/prisma/client";
import { dayKey, employeeAttendance, TIME_ZONE } from "@/features/hrm/attendance/services/attendance.service";
import {
  DEFAULT_ATTENDANCE_MESSAGE_TEMPLATE,
  notificationSettingSchema,
  type NotificationSettingInput,
} from "../schemas/attendance-notification.schema";
import { getGatewayHealth, listGatewayGroups, sendGatewayMessage } from "./whatsapp-gateway.client";

const MAX_ATTEMPTS = 5;
const RETRY_DELAYS_MS = [60_000, 5 * 60_000, 15 * 60_000, 60 * 60_000];

const displayDate = (ymd: string) => {
  const [y, m, d] = ymd.split("-");
  return y && m && d ? `${d}-${m}-${y}` : ymd;
};

const displayClock = new Intl.DateTimeFormat("en-US", {
  timeZone: TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  hour12: true,
});

export function formatAttendanceMessage(
  template: string,
  vars: {
    employeeName: string;
    employeeCode: string;
    designation: string;
    department: string;
    date: string;
    time: string;
    status: string;
  },
): string {
  const ddmmyyyy = displayDate(vars.date);
  return template
    .replaceAll("{employee_name}", vars.employeeName)
    .replaceAll("{name}", vars.employeeName)
    .replaceAll("{employee_id}", vars.employeeCode)
    .replaceAll("{id}", vars.employeeCode)
    .replaceAll("{designation}", vars.designation || "—")
    .replaceAll("{department}", vars.department || "—")
    .replaceAll("{date}", ddmmyyyy)
    .replaceAll("{time}", vars.time)
    .replaceAll("{datetime}", `${ddmmyyyy} at ${vars.time}`)
    .replaceAll("{status}", vars.status);
}

export async function getNotificationSettings() {
  const existing = await db().attendanceNotificationSetting.findFirst({ orderBy: { createdAt: "asc" } });
  if (existing) return existing;
  return {
    id: null,
    enabled: false,
    notifyCheckIn: true,
    notifyLate: true,
    notifyCheckOut: false,
    whatsappGroupId: null,
    whatsappGroupName: null,
    departmentFilter: null,
    messageTemplate: DEFAULT_ATTENDANCE_MESSAGE_TEMPLATE,
    updatedBy: null,
    updatedAt: null,
  };
}

export async function saveNotificationSettings(actor: Actor, raw: unknown) {
  const input: NotificationSettingInput = notificationSettingSchema.parse(raw);
  if (input.enabled && !input.whatsappGroupId) {
    throw badRequest("Select or enter a WhatsApp Group ID (@g.us) before enabling notifications.");
  }

  const existing = await db().attendanceNotificationSetting.findFirst({ orderBy: { createdAt: "asc" }, select: { id: true } });
  const data = {
    enabled: input.enabled,
    notifyCheckIn: input.notifyCheckIn,
    notifyLate: input.notifyLate,
    notifyCheckOut: input.notifyCheckOut,
    whatsappGroupId: input.whatsappGroupId || null,
    whatsappGroupName: input.whatsappGroupName || null,
    departmentFilter: input.departmentFilter || null,
    messageTemplate: input.messageTemplate,
    updatedBy: actor.name || actor.id || "Admin",
  };

  if (existing) {
    return db().attendanceNotificationSetting.update({ where: { id: existing.id }, data });
  }
  return db().attendanceNotificationSetting.create({ data });
}

export async function getNotificationDashboard() {
  const [settings, gateway, logs, counts] = await Promise.all([
    getNotificationSettings(),
    getGatewayHealth(),
    db().attendanceNotificationOutbox.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    db().attendanceNotificationOutbox.groupBy({
      by: ["status"],
      _count: { _all: true },
    }),
  ]);

  let groups: Array<{ id: string; name: string }> = [];
  if (gateway.connected) {
    groups = await listGatewayGroups().catch(() => []);
  }

  const summary = { pending: 0, sent: 0, failed: 0 };
  for (const row of counts) {
    if (row.status === "PENDING") summary.pending = row._count._all;
    else if (row.status === "SENT") summary.sent = row._count._all;
    else if (row.status === "FAILED") summary.failed = row._count._all;
  }

  return { settings, gateway, groups, summary, logs };
}

/**
 * Enqueues WhatsApp notifications for newly persisted punches that fall on
 * today's local date (`Asia/Dhaka`), using the ERP's authoritative attendance
 * calculation (`employeeAttendance`) for status. Never throws.
 */
export async function handleNewAttendancePunches(
  punches: ReadonlyArray<{ employeeId: string | null; punchTime: Date }>,
): Promise<{ enqueued: number; sent: number }> {
  try {
    const settings = await db().attendanceNotificationSetting.findFirst({ orderBy: { createdAt: "asc" } });
    if (!settings || !settings.enabled || !settings.whatsappGroupId) {
      return { enqueued: 0, sent: 0 };
    }

    const today = dayKey.format(new Date());
    const earliestPunchByEmp = new Map<string, Date>();
    const latestPunchByEmp = new Map<string, Date>();
    for (const p of punches) {
      if (!p.employeeId) continue;
      if (dayKey.format(p.punchTime) !== today) continue;
      const prevMin = earliestPunchByEmp.get(p.employeeId);
      if (!prevMin || p.punchTime < prevMin) earliestPunchByEmp.set(p.employeeId, p.punchTime);
      const prevMax = latestPunchByEmp.get(p.employeeId);
      if (!prevMax || p.punchTime > prevMax) latestPunchByEmp.set(p.employeeId, p.punchTime);
    }

    if (earliestPunchByEmp.size === 0) return { enqueued: 0, sent: 0 };

    const employees = await db().employee.findMany({
      where: { id: { in: [...earliestPunchByEmp.keys()] }, isActive: true },
      select: {
        id: true,
        employeeCode: true,
        name: true,
        designation: true,
        department: true,
        departmentSection: true,
        officeId: true,
        office: { select: { name: true } },
      },
    });

    const deptSet = settings.departmentFilter
      ? new Set(
          settings.departmentFilter
            .split(",")
            .map((d) => d.trim().toLowerCase())
            .filter(Boolean),
        )
      : null;

    const outboxRows: Array<{
      employeeId: string;
      employeeCode: string;
      employeeName: string;
      designation: string | null;
      department: string | null;
      attendanceDate: string;
      eventType: string;
      attendanceStatus: string;
      punchTime: Date;
      groupId: string;
      messageText: string;
      status: string;
    }> = [];

    for (const emp of employees) {
      if (deptSet && deptSet.size > 0 && !deptSet.has((emp.department || "").trim().toLowerCase())) {
        continue;
      }

      const { rows } = await employeeAttendance(
        {
          id: emp.id,
          employeeCode: emp.employeeCode,
          name: emp.name,
          designation: emp.designation || "",
          department: emp.department || "",
          departmentSection: emp.departmentSection || "",
          officeId: emp.officeId,
          officeName: emp.office?.name || "",
        },
        today,
        today,
      );

      const record = rows[0];
      const rawStatus = record?.actualAttendance || "Present";
      // A punch is never reported as Absent in WhatsApp; late arrivals after cutoff are Late.
      const calculatedStatus = rawStatus === "Absent" ? "Late" : rawStatus;
      const punchTime = earliestPunchByEmp.get(emp.id)!;
      const timeStr = record?.inTime || displayClock.format(punchTime);

      const shouldNotifyCheckIn =
        (calculatedStatus === "Late" && settings.notifyLate) ||
        (calculatedStatus === "Present" && settings.notifyCheckIn) ||
        ((calculatedStatus === "Offday" || calculatedStatus === "Holiday") && settings.notifyCheckIn);

      if (shouldNotifyCheckIn) {
        const messageText = formatAttendanceMessage(settings.messageTemplate, {
          employeeName: emp.name,
          employeeCode: emp.employeeCode,
          designation: emp.designation || "—",
          department: emp.department || "—",
          date: today,
          time: timeStr,
          status: calculatedStatus,
        });

        outboxRows.push({
          employeeId: emp.id,
          employeeCode: emp.employeeCode,
          employeeName: emp.name,
          designation: emp.designation || null,
          department: emp.department || null,
          attendanceDate: today,
          eventType: "CHECK_IN",
          attendanceStatus: calculatedStatus,
          punchTime,
          groupId: settings.whatsappGroupId,
          messageText,
          status: "PENDING",
        });
      }

      if (settings.notifyCheckOut && record?.outTime && record.outTime !== record.inTime) {
        const outTimeStamp = latestPunchByEmp.get(emp.id) ?? punchTime;
        const outTemplate = settings.messageTemplate
          .replace(/In[\s-]*Time:/gi, "Out-Time:")
          .replace(/\(\{status\}[^)]*\)/gi, "(Checked Out)");
        const outMessage = formatAttendanceMessage(outTemplate, {
          employeeName: emp.name,
          employeeCode: emp.employeeCode,
          designation: emp.designation || "—",
          department: emp.department || "—",
          date: today,
          time: record.outTime,
          status: "Checked Out",
        });

        outboxRows.push({
          employeeId: emp.id,
          employeeCode: emp.employeeCode,
          employeeName: emp.name,
          designation: emp.designation || null,
          department: emp.department || null,
          attendanceDate: today,
          eventType: "CHECK_OUT",
          attendanceStatus: "Checked Out",
          punchTime: outTimeStamp,
          groupId: settings.whatsappGroupId,
          messageText: outMessage,
          status: "PENDING",
        });
      }
    }

    if (outboxRows.length === 0) return { enqueued: 0, sent: 0 };

    const { count } = await db().attendanceNotificationOutbox.createMany({
      data: outboxRows,
      skipDuplicates: true,
    });

    const sent = await processPendingAttendanceNotifications(10);
    return { enqueued: count, sent };
  } catch (err) {
    console.error("[attendance-notifications] failed to enqueue punches:", err);
    return { enqueued: 0, sent: 0 };
  }
}

export async function processPendingAttendanceNotifications(limit = 20): Promise<number> {
  const now = new Date();
  const today = dayKey.format(now);
  const rows = await db().attendanceNotificationOutbox.findMany({
    where: {
      attendanceDate: today,
      OR: [
        { status: "PENDING" },
        { status: "FAILED", attempts: { lt: MAX_ATTEMPTS }, nextRetryAt: { lte: now } },
      ],
    },
    orderBy: { createdAt: "asc" },
    take: limit,
  });

  let sentCount = 0;
  for (const row of rows) {
    try {
      const res = await sendGatewayMessage(row.groupId, row.messageText);
      await db().attendanceNotificationOutbox.update({
        where: { id: row.id },
        data: {
          status: "SENT",
          attempts: row.attempts + 1,
          gatewayMessageId: res.messageId,
          lastError: null,
          nextRetryAt: null,
          sentAt: new Date(),
        },
      });
      sentCount += 1;
    } catch (err) {
      const nextAttempt = row.attempts + 1;
      const delayMs = RETRY_DELAYS_MS[Math.min(nextAttempt - 1, RETRY_DELAYS_MS.length - 1)];
      await db().attendanceNotificationOutbox.update({
        where: { id: row.id },
        data: {
          status: "FAILED",
          attempts: nextAttempt,
          lastError: (err instanceof Error ? err.message : "Send failed").slice(0, 500),
          nextRetryAt: nextAttempt < MAX_ATTEMPTS ? new Date(Date.now() + delayMs) : null,
        },
      });
    }
  }
  return sentCount;
}

export async function retryNotificationOutboxItem(id: string) {
  const row = await db().attendanceNotificationOutbox.findUnique({ where: { id } });
  if (!row) throw notFound("Notification outbox entry");
  if (row.status === "SENT") return row;

  try {
    const res = await sendGatewayMessage(row.groupId, row.messageText);
    return db().attendanceNotificationOutbox.update({
      where: { id },
      data: {
        status: "SENT",
        attempts: row.attempts + 1,
        gatewayMessageId: res.messageId,
        lastError: null,
        nextRetryAt: null,
        sentAt: new Date(),
      },
    });
  } catch (err) {
    return db().attendanceNotificationOutbox.update({
      where: { id },
      data: {
        status: "FAILED",
        attempts: row.attempts + 1,
        lastError: (err instanceof Error ? err.message : "Send failed").slice(0, 500),
      },
    });
  }
}

export async function sendTestAttendanceNotification(actor: Actor, input: { groupId?: string | null; message?: string }) {
  const settings = await getNotificationSettings();
  const groupId = (input.groupId || settings.whatsappGroupId || "").trim();
  if (!groupId || !groupId.endsWith("@g.us")) {
    throw badRequest("Select or enter a valid WhatsApp Group ID (@g.us) first.");
  }

  const now = new Date();
  const today = dayKey.format(now);
  const msg =
    input.message?.trim() ||
    formatAttendanceMessage(settings.messageTemplate, {
      employeeName: actor.name || "Test Employee",
      employeeCode: "TEST-001",
      designation: "Assistant Manager, Supply Chain Management",
      department: "Supply Chain",
      date: today,
      time: displayClock.format(now),
      status: "Late",
    });

  return sendGatewayMessage(groupId, msg);
}
