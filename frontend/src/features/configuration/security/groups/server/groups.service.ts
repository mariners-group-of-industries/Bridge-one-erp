import { Prisma } from "@/generated/prisma/client";
import { badRequest, conflict, notFound } from "@/lib/api/errors";
import type { Actor } from "@/lib/auth/actor";
import { db } from "@/lib/prisma/client";
import { permissionActivities } from "../activities";
import {
  groupListQuerySchema,
  permissionGroupInputSchema,
  userGroupInputSchema,
  type GroupList,
  type GroupListQuery,
  type PermissionGroupDto,
  type PermissionGroupInput,
  type UserGroupDto,
  type UserGroupInput,
  type UserOption,
} from "../schemas/groups.schema";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const escapeLike = (value: string) => value.replace(/[\\%_]/g, (char) => `\\${char}`);

/** Users the actor may pick: active, and (when scoped) with access to one of the actor's companies. */
function userScope(actor: Actor): Prisma.UserWhereInput {
  return actor.companyScope === "ALL" ? { isActive: true } : { isActive: true, businessUnitAccess: { some: { businessUnit: { companyId: { in: [...actor.companyScope] } } } } };
}

/** Who did it, for "Last Action By". */
async function lastAction(actor: Actor) {
  const user = UUID.test(actor.id) ? await db().user.findUnique({ where: { id: actor.id }, select: { name: true } }) : null;
  return { updatedById: actor.id, updatedByName: user?.name ?? (actor.isMaster ? "Administrator" : "System") };
}

const duplicateName = (error: unknown, name: string) => (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002" ? conflict(`A group named "${name}" already exists.`) : error);

function searchWhere(search: string) {
  return search ? { OR: [{ name: { contains: escapeLike(search), mode: "insensitive" as const } }, { updatedByName: { contains: escapeLike(search), mode: "insensitive" as const } }] } : {};
}

// ─── User groups ──────────────────────────────────────────────────────────────

export async function listUserGroups(_actor: Actor, input: GroupListQuery): Promise<GroupList> {
  const query = groupListQuerySchema.parse(input);
  const where = searchWhere(query.search);
  const [total, groups] = await Promise.all([
    db().userGroup.count({ where }),
    db().userGroup.findMany({ where, orderBy: { name: "asc" }, skip: (query.page - 1) * query.pageSize, take: query.pageSize, include: { _count: { select: { members: true } } } }),
  ]);
  return {
    rows: groups.map((g) => ({ id: g.id, name: g.name, count: g._count.members, lastActionBy: g.updatedByName, lastActionAt: g.updatedAt.toISOString() })),
    total,
    page: query.page,
    pageSize: query.pageSize,
  };
}

/** Pickable users with their employee code (no contact details). */
export async function userOptions(actor: Actor): Promise<UserOption[]> {
  const users = await db().user.findMany({ where: userScope(actor), orderBy: { name: "asc" }, select: { id: true, name: true, employee: { select: { employeeCode: true } } } });
  return users.map((u) => ({ id: u.id, name: u.name, employeeCode: u.employee?.employeeCode ?? null }));
}

export async function getUserGroup(_actor: Actor, id: string): Promise<UserGroupDto> {
  const group = await db().userGroup.findUnique({
    where: { id },
    include: { members: { orderBy: { sortOrder: "asc" }, include: { user: { select: { id: true, name: true, employee: { select: { employeeCode: true } } } } } } },
  });
  if (!group) throw notFound("User group");
  return { id: group.id, name: group.name, members: group.members.map((m) => ({ id: m.user.id, name: m.user.name, employeeCode: m.user.employee?.employeeCode ?? null })) };
}

async function checkUsers(actor: Actor, userIds: string[]) {
  const found = await db().user.count({ where: { id: { in: userIds }, ...userScope(actor) } });
  if (found !== userIds.length) throw badRequest("Select active users you can access.");
}

export async function saveUserGroup(actor: Actor, input: UserGroupInput, id?: string): Promise<UserGroupDto> {
  const data = userGroupInputSchema.parse(input);
  if (id && !(await db().userGroup.findUnique({ where: { id }, select: { id: true } }))) throw notFound("User group");
  await checkUsers(actor, data.userIds);
  const by = await lastAction(actor);
  const members = data.userIds.map((userId, sortOrder) => ({ userId, sortOrder }));
  try {
    const saved = await db().$transaction(async (tx) => {
      if (!id) return tx.userGroup.create({ data: { name: data.name, ...by, members: { create: members } } });
      await tx.userGroupMember.deleteMany({ where: { groupId: id } });
      return tx.userGroup.update({ where: { id }, data: { name: data.name, ...by, members: { create: members } } });
    });
    return getUserGroup(actor, saved.id);
  } catch (error) {
    throw duplicateName(error, data.name);
  }
}

export async function deleteUserGroup(_actor: Actor, id: string): Promise<void> {
  const { count } = await db().userGroup.deleteMany({ where: { id } });
  if (count === 0) throw notFound("User group");
}

// ─── Permission groups ────────────────────────────────────────────────────────

export async function listPermissionGroups(_actor: Actor, input: GroupListQuery): Promise<GroupList> {
  const query = groupListQuerySchema.parse(input);
  const where = searchWhere(query.search);
  const [total, groups] = await Promise.all([
    db().permissionGroup.count({ where }),
    db().permissionGroup.findMany({ where, orderBy: { name: "asc" }, skip: (query.page - 1) * query.pageSize, take: query.pageSize, include: { _count: { select: { entries: true } } } }),
  ]);
  return {
    rows: groups.map((g) => ({ id: g.id, name: g.name, count: g._count.entries, lastActionBy: g.updatedByName, lastActionAt: g.updatedAt.toISOString() })),
    total,
    page: query.page,
    pageSize: query.pageSize,
  };
}

export async function getPermissionGroup(_actor: Actor, id: string): Promise<PermissionGroupDto> {
  const group = await db().permissionGroup.findUnique({ where: { id }, include: { entries: true } });
  if (!group) throw notFound("Permission group");
  return {
    id: group.id,
    name: group.name,
    entries: group.entries.map(({ activityKey, canCreate, canEdit, canView, canDelete, canApprove }) => ({ activityKey, canCreate, canEdit, canView, canDelete, canApprove })),
  };
}

/** Stores the granted rows of the matrix (rows with nothing ticked are dropped). */
export async function savePermissionGroup(actor: Actor, input: PermissionGroupInput, id?: string): Promise<PermissionGroupDto> {
  const data = permissionGroupInputSchema.parse(input);
  if (id && !(await db().permissionGroup.findUnique({ where: { id }, select: { id: true } }))) throw notFound("Permission group");
  const catalog = new Map(permissionActivities().map((a) => [a.key, a]));
  const entries = data.entries
    .filter((e) => e.canCreate || e.canEdit || e.canView || e.canDelete || e.canApprove)
    .map((e) => {
      const activity = catalog.get(e.activityKey);
      if (!activity) throw badRequest(`Unknown activity "${e.activityKey}". Reload the page.`);
      return { ...e, moduleName: activity.moduleName, activityName: activity.activityName };
    });
  const by = await lastAction(actor);
  try {
    const saved = await db().$transaction(async (tx) => {
      if (!id) return tx.permissionGroup.create({ data: { name: data.name, ...by, entries: { create: entries } } });
      await tx.permissionGroupEntry.deleteMany({ where: { groupId: id } });
      return tx.permissionGroup.update({ where: { id }, data: { name: data.name, ...by, entries: { create: entries } } });
    });
    return getPermissionGroup(actor, saved.id);
  } catch (error) {
    throw duplicateName(error, data.name);
  }
}

export async function deletePermissionGroup(_actor: Actor, id: string): Promise<void> {
  const { count } = await db().permissionGroup.deleteMany({ where: { id } });
  if (count === 0) throw notFound("Permission group");
}
