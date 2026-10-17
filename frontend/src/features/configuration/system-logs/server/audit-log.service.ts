import type { Prisma } from "@/generated/prisma/client";
import { AppError } from "@/lib/api/errors";
import type { Actor } from "@/lib/auth/actor";
import { db } from "@/lib/prisma/client";
import { auditLogQuerySchema, type AuditLogList, type AuditLogOptions, type AuditLogQuery } from "../schemas/audit-log.schema";

/** The audit trail is read by signed-in people only, never through an API token. */
function assertPerson(actor: Actor) {
  if (actor.role === "API") throw new AppError(403, "FORBIDDEN", "API tokens cannot read the audit log.");
}

export async function listAuditLogs(actor: Actor, input: AuditLogQuery): Promise<AuditLogList> {
  assertPerson(actor);
  const query = auditLogQuerySchema.parse(input);
  const where: Prisma.AuditLogWhereInput = {
    ...(query.feature ? { feature: query.feature } : {}),
    ...(query.userId ? { userId: query.userId } : {}),
    ...(query.actionType ? { actionType: query.actionType } : {}),
    ...(query.from || query.to
      ? {
          createdAt: {
            ...(query.from ? { gte: new Date(`${query.from}T00:00:00.000Z`) } : {}),
            // "To" includes the whole day.
            ...(query.to ? { lt: new Date(new Date(`${query.to}T00:00:00.000Z`).getTime() + 86_400_000) } : {}),
          },
        }
      : {}),
  };
  const [total, rows] = await Promise.all([
    db().auditLog.count({ where }),
    db().auditLog.findMany({ where, orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip: (query.page - 1) * query.pageSize, take: query.pageSize }),
  ]);
  return {
    rows: rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })),
    total,
    page: query.page,
    pageSize: query.pageSize,
  };
}

/** Filter choices: every feature and user that appears in the log. */
export async function auditLogOptions(actor: Actor): Promise<AuditLogOptions> {
  assertPerson(actor);
  const [features, users] = await Promise.all([
    db().auditLog.groupBy({ by: ["feature"], orderBy: { feature: "asc" } }),
    db().auditLog.groupBy({ by: ["userId", "userName"], where: { userId: { not: null } }, orderBy: { userName: "asc" } }),
  ]);
  const seen = new Set<string>();
  return {
    features: features.map((f) => f.feature),
    users: users.filter((u) => u.userId && !seen.has(u.userId) && seen.add(u.userId)).map((u) => ({ id: u.userId!, name: u.userName ?? u.userId! })),
  };
}
