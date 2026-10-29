import { randomUUID } from "node:crypto";
import type { Prisma } from "@/generated/prisma/client";
import { validateAttachment, type UploadedFile } from "@/features/configuration/entity-master-data/supplier/server/supplier.service";
import { AppError, badRequest, conflict, notFound } from "@/lib/api/errors";
import { actorUserId, type Actor } from "@/lib/auth/actor";
import { db } from "@/lib/prisma/client";
import { getStorage } from "@/lib/storage";
import {
  LEAVE_TYPES,
  MAX_LEAVE_ATTACHMENTS,
  MAX_LEAVE_DAYS,
  MAX_MOVEMENT_DAYS,
  leaveInputSchema,
  movementInputSchema,
  type ApplicationStatus,
  type EmployeeOption,
  type LeaveBalanceRow,
  type LeaveInput,
  type LeaveMovementOptions,
  type LeaveRow,
  type MovementInput,
  type MovementRow,
} from "../schemas/leave-movement.schema";

const LIST_LIMIT = 200;
const DAY_MS = 86_400_000;
/** Applications that hold the dates (and, for leave, the balance). */
const OPEN: ApplicationStatus[] = ["Pending", "Approved"];

const forbidden = (message: string) => new AppError(403, "FORBIDDEN", message);
const toDate = (iso: string) => new Date(`${iso}T00:00:00Z`);
const isoDate = (value: Date) => value.toISOString().slice(0, 10);
const daysBetween = (from: Date, to: Date) => Math.round((to.getTime() - from.getTime()) / DAY_MS) + 1;

// ─── Who is applying ──────────────────────────────────────────────────────────

const employeeScope = (actor: Actor): Prisma.EmployeeWhereInput => (actor.companyScope === "ALL" ? {} : { office: { businessUnit: { companyId: { in: [...actor.companyScope] } } } });

async function linkedEmployee(actor: Actor): Promise<EmployeeOption | null> {
  const userId = actorUserId(actor);
  if (!userId) return null;
  const employee = await db().employee.findFirst({ where: { userId }, orderBy: { isActive: "desc" }, select: { id: true, employeeCode: true, name: true } });
  return employee && { id: employee.id, code: employee.employeeCode, name: employee.name };
}

export async function leaveMovementOptions(actor: Actor): Promise<LeaveMovementOptions> {
  return { canManage: actor.isMaster, self: await linkedEmployee(actor) };
}

/** Employee search for the master account's Employee field. */
export async function searchEmployees(actor: Actor, searchText: string): Promise<EmployeeOption[]> {
  if (!actor.isMaster) return [];
  const search = searchText.trim().slice(0, 100);
  const employees = await db().employee.findMany({
    where: {
      isActive: true,
      ...employeeScope(actor),
      ...(search ? { OR: [{ employeeCode: { contains: search, mode: "insensitive" } }, { name: { contains: search, mode: "insensitive" } }] } : {}),
    },
    orderBy: { employeeCode: "asc" },
    take: 20,
    select: { id: true, employeeCode: true, name: true },
  });
  return employees.map((e) => ({ id: e.id, code: e.employeeCode, name: e.name }));
}

/**
 * The employee an application or balance is for. Everyone works with their own
 * linked employee; only the master account may name another one.
 */
async function resolveEmployee(actor: Actor, requestedId: string | undefined): Promise<string> {
  if (actor.isMaster && requestedId) {
    const employee = await db().employee.findFirst({ where: { id: requestedId, ...employeeScope(actor) }, select: { id: true } });
    if (!employee) throw notFound("Employee");
    return employee.id;
  }
  const self = await linkedEmployee(actor);
  if (!self) throw badRequest(actor.isMaster ? "Select an employee." : "No employee record is linked to your account. Ask HR to link it (Employee › ERP Access).");
  if (requestedId && requestedId !== self.id) throw forbidden("You can only apply for yourself.");
  return self.id;
}

/** Rows the actor may see: the master account sees everyone (or one employee), others only themselves. */
async function listScope(actor: Actor, employeeId: string | undefined): Promise<Prisma.EmployeeWhereInput | null> {
  if (actor.isMaster) return { ...employeeScope(actor), ...(employeeId ? { id: employeeId } : {}) };
  const self = await linkedEmployee(actor);
  return self ? { id: self.id } : null;
}

function checkDates(fromDate: string, toDateIso: string, maxDays: number) {
  const from = toDate(fromDate);
  const to = toDate(toDateIso);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || isoDate(from) !== fromDate || isoDate(to) !== toDateIso) throw badRequest("Use valid dates.");
  if (to < from) throw badRequest("To Date cannot be before From Date.");
  const days = daysBetween(from, to);
  if (days > maxDays) throw badRequest(`An application can cover at most ${maxDays} days.`);
  return { from, to, days };
}

const employeeSelect = { select: { employeeCode: true, name: true } } as const;

interface StoredApplication {
  id: string;
  employeeId: string;
  employee: { employeeCode: string; name: string };
  fromDate: Date;
  toDate: Date;
  location: string | null;
  reason: string;
  status: string;
  createdAt: Date;
  decidedByName: string | null;
  decidedAt: Date | null;
}

function baseRow(actor: Actor, ownId: string | null, a: StoredApplication) {
  const pending = a.status === "Pending";
  return {
    id: a.id,
    employeeId: a.employeeId,
    employeeCode: a.employee.employeeCode,
    employeeName: a.employee.name,
    fromDate: isoDate(a.fromDate),
    toDate: isoDate(a.toDate),
    location: a.location ?? "",
    reason: a.reason,
    status: a.status as ApplicationStatus,
    appliedAt: a.createdAt.toISOString(),
    decidedByName: a.decidedByName,
    decidedAt: a.decidedAt?.toISOString() ?? null,
    canDelete: pending && (actor.isMaster || a.employeeId === ownId),
    canDecide: pending && actor.isMaster,
  };
}

const decision = (actor: Actor, status: "Approved" | "Rejected") => ({ status, decidedByName: (actor.name ?? "Administrator").slice(0, 150), decidedAt: new Date() });

function requireManager(actor: Actor) {
  if (!actor.isMaster) throw forbidden("Only HR can approve or reject applications.");
}

// ─── Leave ────────────────────────────────────────────────────────────────────

const quotaOf = (leaveType: string) => LEAVE_TYPES.find((t) => t.name === leaveType)?.quota ?? null;

export async function leaveBalance(actor: Actor, requestedEmployeeId: string | undefined, year = new Date().getUTCFullYear()): Promise<LeaveBalanceRow[]> {
  return balanceOf(await resolveEmployee(actor, requestedEmployeeId), year);
}

async function balanceOf(employeeId: string, year: number): Promise<LeaveBalanceRow[]> {
  const sums = await db().leaveApplication.groupBy({
    by: ["leaveType", "status"],
    where: { employeeId, status: { in: OPEN }, fromDate: { gte: toDate(`${year}-01-01`), lte: toDate(`${year}-12-31`) } },
    _sum: { days: true },
  });
  const sum = (leaveType: string, status: ApplicationStatus) => sums.find((s) => s.leaveType === leaveType && s.status === status)?._sum.days ?? 0;
  return LEAVE_TYPES.map(({ name, quota }) => {
    const taken = sum(name, "Approved");
    const pending = sum(name, "Pending");
    return { leaveType: name, quota, taken, pending, remaining: quota === null ? null : quota - taken - pending };
  });
}

export async function listLeaves(actor: Actor, employeeId?: string): Promise<LeaveRow[]> {
  const scope = await listScope(actor, employeeId);
  if (!scope) return [];
  const own = await linkedEmployee(actor);
  const leaves = await db().leaveApplication.findMany({
    where: { employee: scope },
    orderBy: [{ fromDate: "desc" }, { createdAt: "desc" }],
    take: LIST_LIMIT,
    include: { employee: employeeSelect, attachments: { orderBy: { createdAt: "asc" }, select: { id: true, originalName: true, size: true } } },
  });
  return leaves.map((l) => ({
    ...baseRow(actor, own?.id ?? null, l),
    leaveType: l.leaveType,
    days: l.days,
    attachments: l.attachments.map((f) => ({ id: f.id, name: f.originalName, size: f.size })),
  }));
}

const sanitizeFileName = (name: string) => (name.replace(/[\u0000-\u001f\u007f"\\/]/g, "_").trim() || "attachment").slice(0, 255);

export async function applyLeave(actor: Actor, input: LeaveInput, files: Required<UploadedFile>[] = []): Promise<{ id: string }> {
  const data = leaveInputSchema.parse(input);
  if (files.length > MAX_LEAVE_ATTACHMENTS) throw badRequest(`Attach at most ${MAX_LEAVE_ATTACHMENTS} files.`);
  const mimeTypes = files.map((file) => validateAttachment(file));
  const employeeId = await resolveEmployee(actor, data.employeeId);
  const { from, to, days } = checkDates(data.fromDate, data.toDate, MAX_LEAVE_DAYS);
  if (from.getUTCFullYear() !== to.getUTCFullYear()) throw badRequest("A leave cannot cross into the next year. Apply separately for each year.");

  const overlap = await db().leaveApplication.findFirst({
    where: { employeeId, status: { in: OPEN }, fromDate: { lte: to }, toDate: { gte: from } },
    select: { fromDate: true, toDate: true, leaveType: true },
  });
  if (overlap) throw conflict(`These dates overlap ${overlap.leaveType} from ${isoDate(overlap.fromDate)} to ${isoDate(overlap.toDate)}.`);

  const quota = quotaOf(data.leaveType);
  if (quota !== null) {
    const remaining = (await balanceOf(employeeId, from.getUTCFullYear())).find((b) => b.leaveType === data.leaveType)?.remaining ?? quota;
    if (days > remaining) throw badRequest(`Only ${Math.max(remaining, 0)} day(s) of ${data.leaveType} remain this year; this application needs ${days}.`);
  }

  const id = randomUUID();
  const stored: { storageKey: string; originalName: string; mimeType: string; size: number }[] = [];
  try {
    for (const [index, file] of files.entries()) {
      const storageKey = `leave-applications/${id}/${randomUUID()}`;
      await getStorage().put(storageKey, file.bytes);
      stored.push({ storageKey, originalName: sanitizeFileName(file.name), mimeType: mimeTypes[index], size: file.size });
    }
    await db().leaveApplication.create({
      data: {
        id,
        employeeId,
        leaveType: data.leaveType,
        fromDate: from,
        toDate: to,
        days,
        location: data.location || null,
        reason: data.reason,
        createdById: actorUserId(actor),
        attachments: { create: stored },
      },
    });
  } catch (error) {
    await Promise.all(
      stored.map((f) =>
        getStorage()
          .delete(f.storageKey)
          .catch(() => undefined),
      ),
    );
    throw error;
  }
  return { id };
}

async function loadLeave(actor: Actor, id: string) {
  const scope = await listScope(actor, undefined);
  const leave = scope && (await db().leaveApplication.findFirst({ where: { id, employee: scope }, include: { attachments: true } }));
  if (!leave) throw notFound("Leave application");
  return leave;
}

export async function decideLeave(actor: Actor, id: string, status: "Approved" | "Rejected") {
  requireManager(actor);
  await loadLeave(actor, id);
  const { count } = await db().leaveApplication.updateMany({ where: { id, status: "Pending" }, data: decision(actor, status) });
  if (!count) throw conflict("This application has already been decided.");
}

export async function deleteLeave(actor: Actor, id: string) {
  const leave = await loadLeave(actor, id);
  if (leave.status !== "Pending") throw badRequest("Only pending applications can be deleted.");
  if (!actor.isMaster && leave.employeeId !== (await linkedEmployee(actor))?.id) throw forbidden("You can only delete your own applications.");
  await db().leaveApplication.delete({ where: { id } });
  await Promise.all(
    leave.attachments.map((f) =>
      getStorage()
        .delete(f.storageKey)
        .catch(() => undefined),
    ),
  );
}

export async function readLeaveAttachment(actor: Actor, id: string, attachmentId: string) {
  const file = (await loadLeave(actor, id)).attachments.find((f) => f.id === attachmentId);
  if (!file) throw notFound("Attachment");
  const bytes = await getStorage().get(file.storageKey);
  if (!bytes) throw notFound("Attachment");
  return { bytes, mimeType: file.mimeType, originalName: file.originalName };
}

// ─── Movement ─────────────────────────────────────────────────────────────────

export async function listMovements(actor: Actor, employeeId?: string): Promise<MovementRow[]> {
  const scope = await listScope(actor, employeeId);
  if (!scope) return [];
  const own = await linkedEmployee(actor);
  const movements = await db().movementApplication.findMany({
    where: { employee: scope },
    orderBy: [{ fromDate: "desc" }, { startTime: "desc" }, { createdAt: "desc" }],
    take: LIST_LIMIT,
    include: { employee: employeeSelect },
  });
  return movements.map((m) => ({ ...baseRow(actor, own?.id ?? null, m), movementType: m.movementType, startTime: m.startTime, endTime: m.endTime }));
}

export async function applyMovement(actor: Actor, input: MovementInput): Promise<{ id: string }> {
  const data = movementInputSchema.parse(input);
  const employeeId = await resolveEmployee(actor, data.employeeId);
  const { from, to } = checkDates(data.fromDate, data.toDate, MAX_MOVEMENT_DAYS);
  if (data.endTime <= data.startTime) throw badRequest("End Time must be after Start Time.");
  return db().movementApplication.create({
    data: {
      employeeId,
      movementType: data.movementType,
      fromDate: from,
      toDate: to,
      startTime: data.startTime,
      endTime: data.endTime,
      location: data.location,
      reason: data.reason,
      createdById: actorUserId(actor),
    },
    select: { id: true },
  });
}

async function loadMovement(actor: Actor, id: string) {
  const scope = await listScope(actor, undefined);
  const movement = scope && (await db().movementApplication.findFirst({ where: { id, employee: scope }, select: { id: true, employeeId: true, status: true } }));
  if (!movement) throw notFound("Movement application");
  return movement;
}

export async function decideMovement(actor: Actor, id: string, status: "Approved" | "Rejected") {
  requireManager(actor);
  await loadMovement(actor, id);
  const { count } = await db().movementApplication.updateMany({ where: { id, status: "Pending" }, data: decision(actor, status) });
  if (!count) throw conflict("This application has already been decided.");
}

export async function deleteMovement(actor: Actor, id: string) {
  const movement = await loadMovement(actor, id);
  if (movement.status !== "Pending") throw badRequest("Only pending applications can be deleted.");
  await db().movementApplication.delete({ where: { id } });
}
