import { db } from "@/lib/prisma/client";

export type NotificationKind = "leave" | "movement" | "attendance" | "payslip" | "calendar" | "general";

export interface NotificationInput {
  userId: string;
  kind: NotificationKind;
  title: string;
  body?: string | null;
  link?: string | null;
}

const clip = (value: string | null | undefined, max: number) => (value ? value.slice(0, max) : null);

/**
 * Stores personal notifications (Employee Self Service › Notifications, navbar bell).
 * Called after the business change has been committed: a notification that fails
 * to save is logged and never undoes or blocks the change it reports.
 */
export async function notifyUsers(entries: readonly NotificationInput[]): Promise<void> {
  const rows = entries.filter((e) => e.userId);
  if (rows.length === 0) return;
  try {
    await db().userNotification.createMany({
      data: rows.map((e) => ({ userId: e.userId, kind: e.kind, title: e.title.slice(0, 200), body: clip(e.body, 500), link: clip(e.link, 300) })),
    });
  } catch (error) {
    console.error("[notifications] could not save", error);
  }
}

/** Notifies the login linked to each employee (employees without a login are skipped). */
export async function notifyEmployees(employeeIds: readonly string[], message: Omit<NotificationInput, "userId">): Promise<void> {
  const ids = [...new Set(employeeIds)];
  if (ids.length === 0) return;
  try {
    const linked = await db().employee.findMany({ where: { id: { in: ids }, userId: { not: null } }, select: { userId: true } });
    await notifyUsers(linked.map((e) => ({ ...message, userId: e.userId! })));
  } catch (error) {
    console.error("[notifications] could not resolve employees", error);
  }
}
