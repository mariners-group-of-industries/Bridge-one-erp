import { Prisma } from "@/generated/prisma/client";
import { AppError, badRequest, conflict, inUse, notFound } from "@/lib/api/errors";
import { accountBlock, actorUserId, type Actor } from "@/lib/auth/actor";
import { ACTION_COLUMNS, allPermissionKeys, findFeature, permissionKey, PERMISSION_ACTIONS, type PermissionAction } from "@/lib/permissions/registry";
import { explainPermissions, type GroupGrants } from "@/lib/permissions/resolve";
import { db } from "@/lib/prisma/client";
import {
  groupListQuerySchema,
  groupUsersInputSchema,
  permissionGroupInputSchema,
  userAccessInputSchema,
  type AccessUser,
  type EffectivePermissionsDto,
  type GrantMap,
  type GroupListQuery,
  type PermissionGroupDto,
  type PermissionGroupInput,
  type PermissionGroupList,
  type PermissionGroupRow,
  type UserAccessDto,
  type UserAccessInput,
} from "../schemas/access.schema";

/**
 * Permission groups and users' ERP access. Every change is audited. Anyone but
 * the master account can only hand out permissions they hold themselves, cannot
 * assign full-access groups, cannot change master accounts and cannot change
 * their own access.
 */

/** Client details recorded with each audited change. */
export interface RequestMeta {
  ipAddress?: string | null;
  userAgent?: string | null;
}

const forbidden = (message: string) => new AppError(403, "FORBIDDEN", message);

type Tx = Prisma.TransactionClient;
type EntryRow = { activityKey: string } & { [K in (typeof ACTION_COLUMNS)[PermissionAction]]: boolean };

// ─── Grants ↔ matrix rows ─────────────────────────────────────────────────────

/** Matrix rows for the granted actions; unknown pages or actions that do not apply are refused. */
function entriesFromGrants(grants: GrantMap) {
  return Object.entries(grants)
    .filter(([, actions]) => actions.length > 0)
    .map(([key, actions]) => {
      const feature = findFeature(key);
      if (!feature) throw badRequest(`Unknown page "${key}". Reload the page.`);
      const invalid = actions.find((a) => !feature.actions.includes(a));
      if (invalid) throw badRequest(`"${invalid}" does not apply to ${feature.label}.`);
      const row = Object.fromEntries(PERMISSION_ACTIONS.map((a) => [ACTION_COLUMNS[a], actions.includes(a)])) as Omit<EntryRow, "activityKey">;
      return { activityKey: key, moduleName: feature.moduleLabel, activityName: feature.label, ...row };
    });
}

function grantsFromEntries(entries: EntryRow[]): GrantMap {
  const grants: GrantMap = {};
  for (const entry of entries) {
    const actions = PERMISSION_ACTIONS.filter((a) => entry[ACTION_COLUMNS[a]]);
    if (actions.length) grants[entry.activityKey] = actions;
  }
  return grants;
}

const keysOfGrants = (grants: GrantMap) => Object.entries(grants).flatMap(([key, actions]) => actions.map((a) => permissionKey(key, a)));

/** Permission keys a group grants. */
const groupKeys = (group: { fullAccess: boolean; entries: EntryRow[] }) => (group.fullAccess ? allPermissionKeys() : keysOfGrants(grantsFromEntries(group.entries)));

/** True when the actor holds every permission key (the master account holds all). */
function actorHolds(actor: Actor, keys: string[]): boolean {
  if (actor.isMaster || (actor.grants?.all && !actor.grants.readOnly)) return true;
  return keys.every((k) => actor.grants?.keys.has(k));
}

function canAssignGroup(actor: Actor, group: { fullAccess: boolean; entries: EntryRow[] }): boolean {
  if (actor.isMaster) return true;
  return !group.fullAccess && actorHolds(actor, groupKeys(group));
}

// ─── Audit ────────────────────────────────────────────────────────────────────

async function actorName(actor: Actor): Promise<string> {
  const id = actorUserId(actor);
  const user = id ? await db().user.findUnique({ where: { id }, select: { name: true } }) : null;
  return user?.name ?? actor.name ?? (actor.isMaster ? "Administrator" : "System");
}

/** Who is acting, resolved before a transaction opens (no queries outside it while it runs). */
interface Auditor {
  id: string;
  name: string;
}

const auditor = async (actor: Actor): Promise<Auditor> => ({ id: actor.id, name: await actorName(actor) });

async function audit(
  tx: Tx,
  by: Auditor,
  meta: RequestMeta,
  entry: { operation: string; targetUserId?: string; targetGroupId?: string; previousValue?: unknown; newValue?: unknown },
) {
  await tx.permissionAuditLog.create({
    data: {
      actorUserId: by.id,
      actorName: by.name,
      targetUserId: entry.targetUserId ?? null,
      targetGroupId: entry.targetGroupId ?? null,
      operation: entry.operation,
      previousValue: entry.previousValue === undefined ? Prisma.JsonNull : (entry.previousValue as Prisma.InputJsonValue),
      newValue: entry.newValue === undefined ? Prisma.JsonNull : (entry.newValue as Prisma.InputJsonValue),
      ipAddress: meta.ipAddress?.slice(0, 64) ?? null,
      userAgent: meta.userAgent?.slice(0, 300) ?? null,
    },
  });
}

// ─── Permission groups ────────────────────────────────────────────────────────

const groupInclude = { entries: true, _count: { select: { users: true } } } as const;
type GroupRecord = Prisma.PermissionGroupGetPayload<{ include: typeof groupInclude }>;

function toRow(g: GroupRecord): PermissionGroupRow {
  return {
    id: g.id,
    name: g.name,
    code: g.code,
    description: g.description,
    status: g.status,
    fullAccess: g.fullAccess,
    permissionCount: g.fullAccess ? allPermissionKeys().length : keysOfGrants(grantsFromEntries(g.entries)).length,
    userCount: g._count.users,
    createdBy: g.createdByName,
    createdAt: g.createdAt.toISOString(),
    lastActionBy: g.updatedByName,
    updatedAt: g.updatedAt.toISOString(),
  };
}

const toDto = (g: GroupRecord): PermissionGroupDto => ({ ...toRow(g), grants: g.fullAccess ? {} : grantsFromEntries(g.entries) });

const uniqueConflict = (error: unknown) =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002"
    ? conflict(String((error.meta?.target as string[] | string | undefined) ?? "").includes("code") ? "Another group already uses this code." : "Another group already has this name.")
    : error;

export async function listPermissionGroups(_actor: Actor, input: GroupListQuery): Promise<PermissionGroupList> {
  const query = groupListQuerySchema.parse(input);
  const where: Prisma.PermissionGroupWhereInput = {
    ...(query.status !== "ALL" ? { status: query.status } : {}),
    ...(query.search
      ? { OR: [{ name: { contains: query.search, mode: "insensitive" } }, { code: { contains: query.search, mode: "insensitive" } }, { description: { contains: query.search, mode: "insensitive" } }] }
      : {}),
  };
  const [total, groups] = await Promise.all([
    db().permissionGroup.count({ where }),
    db().permissionGroup.findMany({ where, orderBy: { name: "asc" }, skip: (query.page - 1) * query.pageSize, take: query.pageSize, include: groupInclude }),
  ]);
  return { rows: groups.map(toRow), total, page: query.page, pageSize: query.pageSize };
}

async function loadGroup(id: string): Promise<GroupRecord> {
  const group = await db().permissionGroup.findUnique({ where: { id }, include: groupInclude });
  if (!group) throw notFound("Permission group");
  return group;
}

export async function getPermissionGroup(_actor: Actor, id: string): Promise<PermissionGroupDto> {
  return toDto(await loadGroup(id));
}

/** Creates or updates a group; its members' access changes with it on their next request. */
export async function savePermissionGroup(actor: Actor, input: PermissionGroupInput, id?: string, meta: RequestMeta = {}): Promise<PermissionGroupDto> {
  const data = permissionGroupInputSchema.parse(input);
  const before = id ? await loadGroup(id) : null;
  if (before?.fullAccess && !actor.isMaster) throw forbidden("Only the master account can change a full-access group.");
  const entries = entriesFromGrants(data.grants);
  if (!actorHolds(actor, keysOfGrants(data.grants))) throw forbidden("You can only grant permissions you have yourself.");
  const name = await actorName(actor);
  const by = { id: actor.id, name };
  const fields = { name: data.name, code: data.code, description: data.description || null, status: data.status, updatedById: actor.id, updatedByName: name };
  try {
    const saved = await db().$transaction(async (tx) => {
      const group = before
        ? (await tx.permissionGroupEntry.deleteMany({ where: { groupId: before.id } }), await tx.permissionGroup.update({ where: { id: before.id }, data: { ...fields, entries: { create: entries } } }))
        : await tx.permissionGroup.create({ data: { ...fields, createdByName: name, entries: { create: entries } } });
      await audit(tx, by, meta, {
        operation: before ? "GROUP_UPDATE" : "GROUP_CREATE",
        targetGroupId: group.id,
        previousValue: before ? { name: before.name, code: before.code, description: before.description, status: before.status, grants: grantsFromEntries(before.entries) } : undefined,
        newValue: { ...fields, updatedById: undefined, updatedByName: undefined, grants: data.grants },
      });
      return group;
    });
    return toDto(await loadGroup(saved.id));
  } catch (error) {
    throw uniqueConflict(error);
  }
}

/** A copy named "… (Copy)", inactive until reviewed, with no users. */
export async function duplicatePermissionGroup(actor: Actor, id: string, meta: RequestMeta = {}): Promise<PermissionGroupDto> {
  const source = await loadGroup(id);
  if (source.fullAccess && !actor.isMaster) throw forbidden("Only the master account can copy a full-access group.");
  if (!canAssignGroup(actor, source)) throw forbidden("You can only copy groups whose permissions you have yourself.");
  const taken = async (field: "name" | "code", value: string) => !!(await db().permissionGroup.findFirst({ where: { [field]: value }, select: { id: true } }));
  let n = 1;
  const suffix = () => (n === 1 ? "" : ` ${n}`);
  while ((await taken("name", `${source.name} (Copy${suffix()})`.slice(0, 150))) || (await taken("code", `${source.code}_COPY${n === 1 ? "" : n}`.slice(0, 60)))) n++;
  const name = await actorName(actor);
  const by = { id: actor.id, name };
  const copy = await db().$transaction(async (tx) => {
    const group = await tx.permissionGroup.create({
      data: {
        name: `${source.name} (Copy${suffix()})`.slice(0, 150),
        code: `${source.code}_COPY${n === 1 ? "" : n}`.slice(0, 60),
        description: source.description,
        status: "INACTIVE",
        fullAccess: source.fullAccess,
        createdByName: name,
        updatedById: actor.id,
        updatedByName: name,
        entries: { create: source.entries.map(({ groupId: _groupId, ...entry }) => entry) },
      },
    });
    await audit(tx, by, meta, { operation: "GROUP_DUPLICATE", targetGroupId: group.id, previousValue: { sourceGroupId: source.id, sourceCode: source.code }, newValue: { name: group.name, code: group.code } });
    return group;
  });
  return toDto(await loadGroup(copy.id));
}

/** Only groups nobody is assigned to can be deleted; deactivate the others. */
export async function deletePermissionGroup(actor: Actor, id: string, meta: RequestMeta = {}): Promise<void> {
  const group = await loadGroup(id);
  if (group.fullAccess && !actor.isMaster) throw forbidden("Only the master account can delete a full-access group.");
  if (group._count.users > 0) throw inUse(`${group.name} is assigned to ${group._count.users} user(s). Remove them or deactivate the group instead.`);
  const by = await auditor(actor);
  await db().$transaction(async (tx) => {
    await tx.permissionGroup.delete({ where: { id } });
    await audit(tx, by, meta, { operation: "GROUP_DELETE", targetGroupId: id, previousValue: { name: group.name, code: group.code, grants: grantsFromEntries(group.entries) } });
  });
}

// ─── Users ────────────────────────────────────────────────────────────────────

const userSelect = { id: true, name: true, phone: true, isMaster: true, erpAccess: true, status: true, isActive: true, lastLoginAt: true, employee: { select: { employeeCode: true } } } as const;

const toAccessUser = (u: { id: string; name: string; phone: string; isMaster: boolean; employee: { employeeCode: string } | null }): AccessUser => ({
  id: u.id,
  name: u.name,
  phone: u.phone,
  employeeCode: u.employee?.employeeCode ?? null,
  isMaster: u.isMaster,
});

/** Users with ERP accounts, for assigning to groups. */
export async function listAccessUsers(_actor: Actor): Promise<AccessUser[]> {
  const users = await db().user.findMany({ orderBy: { name: "asc" }, select: userSelect });
  return users.map(toAccessUser);
}

export async function getGroupUsers(actor: Actor, id: string): Promise<{ userIds: string[]; users: AccessUser[] }> {
  await loadGroup(id);
  const [assigned, users] = await Promise.all([db().userPermissionGroup.findMany({ where: { groupId: id }, select: { userId: true } }), listAccessUsers(actor)]);
  return { userIds: assigned.map((a) => a.userId), users };
}

/** Replaces the group's members. */
export async function setGroupUsers(actor: Actor, id: string, input: { userIds: string[] }, meta: RequestMeta = {}): Promise<{ userIds: string[] }> {
  const { userIds } = groupUsersInputSchema.parse(input);
  const group = await loadGroup(id);
  if (!canAssignGroup(actor, group)) throw forbidden(group.fullAccess ? "Only the master account can assign a full-access group." : "You can only assign groups whose permissions you have yourself.");
  const before = (await db().userPermissionGroup.findMany({ where: { groupId: id }, select: { userId: true } })).map((r) => r.userId);
  const changed = [...userIds.filter((u) => !before.includes(u)), ...before.filter((u) => !userIds.includes(u))];
  if (changed.length) {
    const users = await db().user.findMany({ where: { id: { in: changed } }, select: { id: true, isMaster: true } });
    if (users.length !== changed.length) throw badRequest("Select existing users.");
    if (!actor.isMaster && users.some((u) => u.isMaster)) throw forbidden("Only the master account can change a master account.");
    if (changed.includes(actor.id)) throw forbidden("You cannot change your own access.");
  }
  const by = await auditor(actor);
  await db().$transaction(async (tx) => {
    await tx.userPermissionGroup.deleteMany({ where: { groupId: id, userId: { notIn: userIds } } });
    await tx.userPermissionGroup.createMany({ data: userIds.filter((u) => !before.includes(u)).map((userId) => ({ userId, groupId: id })), skipDuplicates: true });
    await audit(tx, by, meta, { operation: "GROUP_USERS_UPDATE", targetGroupId: id, previousValue: { userIds: before }, newValue: { userIds } });
  });
  return { userIds };
}

async function loadUser(userId: string) {
  const user = await db().user.findUnique({
    where: { id: userId },
    select: { ...userSelect, permissionGroups: { select: { groupId: true } }, permissionOverrides: { select: { activityKey: true, action: true, effect: true } } },
  });
  if (!user) throw notFound("User");
  return user;
}

/** Why the actor may not change this user's access, or null. */
function editBlock(actor: Actor, user: { id: string; isMaster: boolean }): string | null {
  if (user.id === actor.id) return "You cannot change your own access.";
  if (user.isMaster && !actor.isMaster) return "Only the master account can change a master account.";
  return null;
}

export async function getUserAccess(actor: Actor, userId: string): Promise<UserAccessDto> {
  const user = await loadUser(userId);
  const groups = await db().permissionGroup.findMany({ orderBy: { name: "asc" }, include: { entries: true } });
  const reason = editBlock(actor, user);
  return {
    user: { ...toAccessUser(user), erpAccess: user.erpAccess, status: user.status, lastLoginAt: user.lastLoginAt?.toISOString() ?? null },
    groupIds: user.permissionGroups.map((g) => g.groupId),
    overrides: user.permissionOverrides.map((o) => ({ featureKey: o.activityKey, action: o.action as PermissionAction, effect: o.effect })),
    groups: groups.map((g) => ({ id: g.id, name: g.name, code: g.code, status: g.status, fullAccess: g.fullAccess, grants: g.fullAccess ? {} : grantsFromEntries(g.entries), assignable: canAssignGroup(actor, g) })),
    editable: { access: reason === null, master: actor.isMaster && reason === null, reason },
  };
}

/** Saves a user's ERP access, groups and overrides in one transaction. Losing access ends their sessions. */
export async function updateUserAccess(actor: Actor, userId: string, input: UserAccessInput, meta: RequestMeta = {}): Promise<UserAccessDto> {
  const data = userAccessInputSchema.parse(input);
  const user = await loadUser(userId);
  const block = editBlock(actor, user);
  if (block) throw forbidden(block);
  if (data.isMaster !== undefined && data.isMaster !== user.isMaster && !actor.isMaster) throw forbidden("Only the master account can make or remove master accounts.");

  // Groups being added must be assignable by the actor.
  const previousGroupIds = user.permissionGroups.map((g) => g.groupId);
  const added = data.groupIds.filter((g) => !previousGroupIds.includes(g));
  const groups = await db().permissionGroup.findMany({ where: { id: { in: data.groupIds } }, include: { entries: true } });
  if (groups.length !== data.groupIds.length) throw badRequest("Select existing permission groups.");
  const refused = groups.find((g) => added.includes(g.id) && !canAssignGroup(actor, g));
  if (refused) throw forbidden(refused.fullAccess ? "Only the master account can assign a full-access group." : `You can only assign groups whose permissions you have yourself (${refused.name}).`);

  // Overrides: the page and action must exist; new Allows must be permissions the actor has.
  for (const o of data.overrides) {
    const feature = findFeature(o.featureKey);
    if (!feature || !feature.actions.includes(o.action)) throw badRequest(`Unknown permission ${o.featureKey} · ${o.action}.`);
  }
  const previousAllows = new Set(user.permissionOverrides.filter((o) => o.effect === "ALLOW").map((o) => permissionKey(o.activityKey, o.action as PermissionAction)));
  const newAllows = data.overrides.filter((o) => o.effect === "ALLOW").map((o) => permissionKey(o.featureKey, o.action)).filter((k) => !previousAllows.has(k));
  if (!actorHolds(actor, newAllows)) throw forbidden("You can only allow permissions you have yourself.");

  const loses = !data.erpAccess || data.status !== "ACTIVE";
  const previous = {
    erpAccess: user.erpAccess,
    status: user.status,
    isMaster: user.isMaster,
    groupIds: previousGroupIds,
    overrides: user.permissionOverrides.map((o) => ({ featureKey: o.activityKey, action: o.action, effect: o.effect })),
  };
  const by = await auditor(actor);
  await db().$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: {
        erpAccess: data.erpAccess,
        status: data.status,
        isActive: data.status !== "INACTIVE",
        ...(actor.isMaster && data.isMaster !== undefined ? { isMaster: data.isMaster } : {}),
      },
    });
    await tx.userPermissionGroup.deleteMany({ where: { userId, groupId: { notIn: data.groupIds } } });
    await tx.userPermissionGroup.createMany({ data: added.map((groupId) => ({ userId, groupId })), skipDuplicates: true });
    await tx.userPermissionOverride.deleteMany({ where: { userId } });
    await tx.userPermissionOverride.createMany({ data: data.overrides.map((o) => ({ userId, activityKey: o.featureKey, action: o.action, effect: o.effect })) });
    // Signed-in sessions stop working at once when access is removed.
    if (loses) await tx.userSession.deleteMany({ where: { userId } });
    await audit(tx, by, meta, { operation: "USER_ACCESS_UPDATE", targetUserId: userId, previousValue: previous, newValue: { ...data, isMaster: actor.isMaster ? (data.isMaster ?? user.isMaster) : user.isMaster } });
  });
  return getUserAccess(actor, userId);
}

/** What the user can do, permission by permission, and where each comes from. */
export async function effectivePermissions(_actor: Actor, userId: string): Promise<EffectivePermissionsDto> {
  const user = await db().user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      isMaster: true,
      isActive: true,
      erpAccess: true,
      status: true,
      permissionGroups: { select: { group: { select: { name: true, status: true, fullAccess: true, entries: true } } } },
      permissionOverrides: { select: { activityKey: true, action: true, effect: true } },
    },
  });
  if (!user) throw notFound("User");
  const blockedReason = user.isMaster ? null : accountBlock(user);
  const groups: GroupGrants[] = user.permissionGroups.map((g) => g.group);
  const rows = explainPermissions(groups, user.permissionOverrides);
  return {
    userId: user.id,
    isMaster: user.isMaster,
    canSignIn: blockedReason === null,
    blockedReason,
    permissions: rows.map((r) => ({
      featureKey: r.featureKey,
      action: r.action,
      // A blocked account effectively has nothing, whatever its groups say.
      granted: user.isMaster || (blockedReason === null && r.granted),
      source: user.isMaster ? "master" : r.source,
      groups: r.groups,
    })),
  };
}

/** The signed-in actor's permission keys, for the menus ("*" = everything). */
export function permissionsOf(actor: Actor): string[] {
  if (actor.isMaster || actor.grants?.all) return ["*"];
  return [...(actor.grants?.keys ?? [])].sort();
}
