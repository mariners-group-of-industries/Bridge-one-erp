import { db } from "@/lib/prisma/client";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Display names for actor ids stored on documents (createdBy, approvedBy …).
 * Ids that are not users (system or test actors) map to themselves.
 */
export async function userNames(ids: readonly (string | null | undefined)[]): Promise<(id: string | null | undefined) => string | null> {
  const wanted = [...new Set(ids.filter((id): id is string => !!id && UUID.test(id)))];
  const users = wanted.length ? await db().user.findMany({ where: { id: { in: wanted } }, select: { id: true, name: true } }) : [];
  const byId = new Map(users.map((user) => [user.id, user.name]));
  return (id) => (id ? (byId.get(id) ?? id) : null);
}
