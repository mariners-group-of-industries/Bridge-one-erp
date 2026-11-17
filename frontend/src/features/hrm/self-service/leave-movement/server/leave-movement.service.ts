import { randomUUID } from "node:crypto";
import type { Prisma } from "@/generated/prisma/client";
import { validateAttachment, type UploadedFile } from "@/features/configuration/entity-master-data/supplier/server/supplier.service";
import { AppError, badRequest, conflict, notFound } from "@/lib/api/errors";
import { actorUserId, can, type Actor } from "@/lib/auth/actor";
import { decideWithPipeline, employeeBusinessUnit } from "@/lib/approval/engine";
import { db } from "@/lib/prisma/client";
import { getStorage } from "@/lib/storage";
import { notifyEmployees } from "@/lib/notifications/notify";
import { dayKey } from "@/features/hrm/attendance/services/attendance.service";
import { chargeableDays, leaveTypesFor, type LeaveSubject, type LeaveTypeRule } from "./leave-policy";
import {
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
  return { canManage: managesLeave(actor), self: await linkedEmployee(actor) };
}

/** HR who handle everyone's applications: Approve on Leave & Movement or on Pending Approval. */
export const managesLeave = (actor: Actor) => can(actor, "/hrm/self-service/leave-movement", "approve") || can(actor, "/hrm/governance/pending-approval", "approve");

/** Employee search for HR's Employee field. */
export async function searchEmployees(actor: Actor, searchText: string): Promise<EmployeeOption[]> {
  if (!managesLeave(actor)) return [];
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
  if (managesLeave(actor) && requestedId) {
    const employee = await db().employee.findFirst({ where: { id: requestedId, ...employeeScope(actor) }, select: { id: true } });
    if (!employee) throw notFound("Employee");
    return employee.id;
  }
  const self = await linkedEmployee(actor);
  if (!self) throw badRequest(managesLeave(actor) ? "Select an employee." : "No employee record is linked to your account. Ask HR to link it (Employee › ERP Access).");
  if (requestedId && requestedId !== self.id) throw forbidden("You can only apply for yourself.");
  return self.id;
}

/** Rows the actor may see: the master account sees everyone (or one employee), others only themselves. */
async function listScope(actor: Actor, employeeId: string | undefined): Promise<Prisma.EmployeeWhereInput | null> {
  if (managesLeave(actor)) return { ...employeeScope(actor), ...(employeeId ? { id: employeeId } : {}) };
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
    canDelete: pending && (managesLeave(actor) || a.employeeId === ownId),
    canDecide: pending && managesLeave(actor),
  };
}

const decision = (actor: Actor, status: "Approved" | "Rejected") => ({ status, decidedByName: (actor.name ?? "Administrator").slice(0, 150), decidedAt: new Date() });

function requireManager(actor: Actor) {
  if (!managesLeave(actor)) throw forbidden("Only HR can approve or reject applications.");
}

// ─── Leave ────────────────────────────────────────────────────────────────────

type Client = Prisma.TransactionClient | ReturnType<typeof db>;

/** The employee's office and gender, which decide their leave types. */
async function leaveSubject(employeeId: string, client: Client = db()): Promise<LeaveSubject> {
  const e = await client.employee.findUnique({ where: { id: employeeId }, select: { id: true, officeId: true, gender: true } });
  if (!e) throw notFound("Employee");
  return e;
}

export async function leaveBalance(actor: Actor, requestedEmployeeId: string | undefined, year = new Date().getUTCFullYear()): Promise<LeaveBalanceRow[]> {
  return balanceOf(await leaveSubject(await resolveEmployee(actor, requestedEmployeeId)), year);
}

/** Approved and pending days per leave type in `year`. */
async function usedDays(employeeId: string, year: number, client: Client) {
  const sums = await client.leaveApplication.groupBy({
    by: ["leaveType", "status"],
    where: { employeeId, status: { in: OPEN }, fromDate: { gte: toDate(`${year}-01-01`), lte: toDate(`${year}-12-31`) } },
    _sum: { days: true },
  });
  return (leaveType: string, status: ApplicationStatus) => sums.filter((s) => s.leaveType.toLowerCase() === leaveType.toLowerCase() && s.status === status).reduce((n, s) => n + (s._sum.days ?? 0), 0);
}

/**
 * The employee's balance per leave type for `year`, from their leave policy
 * (leave-policy.ts). Pending days are held back. Types that carry forward add
 * last year's unused days, up to the policy's maximum.
 */
export async function balanceOf(subject: LeaveSubject, year: number): Promise<LeaveBalanceRow[]> {
  const asOf = `${year}-12-31` < isoDate(new Date()) ? `${year}-12-31` : `${year}-01-01` > isoDate(new Date()) ? `${year}-01-01` : isoDate(new Date());
  const types = await leaveTypesFor(subject, asOf);
  const [sum, lastYear] = await Promise.all([usedDays(subject.id, year, db()), usedDays(subject.id, year - 1, db())]);
  return types.map((t) => balanceRow(t, sum, lastYear));
}

type Used = Awaited<ReturnType<typeof usedDays>>;

function balanceRow(t: LeaveTypeRule, sum: Used, lastYear: Used): LeaveBalanceRow {
  const carried = t.carryForward && t.quota !== null ? Math.max(0, Math.min(t.quota - lastYear(t.name, "Approved"), t.maxCarryDays ?? t.quota)) : 0;
  const quota = t.quota === null ? null : t.quota + carried;
  const taken = sum(t.name, "Approved");
  const pending = sum(t.name, "Pending");
  return { leaveType: t.name, quota, carried, taken, pending, remaining: quota === null ? null : quota - taken - pending, noticeDays: t.noticeDays, attachmentAfterDays: t.attachmentAfterDays };
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

export async function applyLeave(actor: Actor, input: LeaveInput, files: Required<UploadedFile>[] = []): Promise<{ id: string; days: number }> {
  const data = leaveInputSchema.parse(input);
  if (files.length > MAX_LEAVE_ATTACHMENTS) throw badRequest(`Attach at most ${MAX_LEAVE_ATTACHMENTS} files.`);
  const mimeTypes = files.map((file) => validateAttachment(file));
  const employeeId = await resolveEmployee(actor, data.employeeId);
  const { from, to } = checkDates(data.fromDate, data.toDate, MAX_LEAVE_DAYS);
  if (from.getUTCFullYear() !== to.getUTCFullYear()) throw badRequest("A leave cannot cross into the next year. Apply separately for each year.");

  // The leave type must be one the employee's policy offers on these dates.
  const subject = await leaveSubject(employeeId);
  const rule = (await leaveTypesFor(subject, data.fromDate)).find((t) => t.name.toLowerCase() === data.leaveType.toLowerCase());
  if (!rule) throw badRequest(`${data.leaveType} is not available to this employee. Choose another leave type.`);
  const leaveType = rule.name;
  const { days } = await chargeableDays(subject, leaveType, data.fromDate, data.toDate);
  if (days === 0) throw badRequest("Every selected day is a weekly off or holiday, so there is nothing to apply for.");

  // HR entering leave for someone else may record it after the fact; employees follow the notice rule.
  const forSelf = employeeId === (await linkedEmployee(actor))?.id;
  if (forSelf && rule.noticeDays) {
    const earliest = isoDate(new Date(Date.parse(`${dayKey.format(new Date())}T00:00:00Z`) + rule.noticeDays * DAY_MS));
    if (data.fromDate < earliest) throw badRequest(`${leaveType} must be applied for at least ${rule.noticeDays} day(s) in advance (from ${earliest}).`);
  }
  if (rule.attachmentAfterDays !== null && days > rule.attachmentAfterDays && files.length === 0) {
    throw badRequest(rule.attachmentAfterDays === 0 ? `${leaveType} needs a supporting document. Attach one and submit again.` : `${leaveType} longer than ${rule.attachmentAfterDays} day(s) needs a supporting document. Attach one and submit again.`);
  }

  /** Overlap and balance are checked under a per-employee lock, so two quick submissions cannot both pass. */
  const checkAndCreate = (create: (tx: Prisma.TransactionClient) => Promise<unknown>) =>
    db().$transaction(async (tx) => {
      await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtext(${`leave:${employeeId}`}))`;
      const overlap = await tx.leaveApplication.findFirst({
        where: { employeeId, status: { in: OPEN }, fromDate: { lte: to }, toDate: { gte: from } },
        select: { fromDate: true, toDate: true, leaveType: true },
      });
      if (overlap) throw conflict(`These dates overlap ${overlap.leaveType} from ${isoDate(overlap.fromDate)} to ${isoDate(overlap.toDate)}.`);
      if (rule.quota !== null) {
        // Only the transaction's own connection is used while the lock is held.
        const year = from.getUTCFullYear();
        const remaining = balanceRow(rule, await usedDays(employeeId, year, tx), await usedDays(employeeId, year - 1, tx)).remaining ?? rule.quota;
        if (days > remaining) throw badRequest(`Only ${Math.max(remaining, 0)} day(s) of ${leaveType} remain this year; this application needs ${days}.`);
      }
      await create(tx);
    });

  const id = randomUUID();
  const stored: { storageKey: string; originalName: string; mimeType: string; size: number }[] = [];
  try {
    for (const [index, file] of files.entries()) {
      const storageKey = `leave-applications/${id}/${randomUUID()}`;
      await getStorage().put(storageKey, file.bytes);
      stored.push({ storageKey, originalName: sanitizeFileName(file.name), mimeType: mimeTypes[index], size: file.size });
    }
    await checkAndCreate((tx) =>
      tx.leaveApplication.create({
        data: {
          id,
          employeeId,
          leaveType,
          fromDate: from,
          toDate: to,
          days,
          location: data.location || null,
          reason: data.reason,
          createdById: actorUserId(actor),
          attachments: { create: stored },
        },
      }),
    );
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
  await notifyEmployees([employeeId], {
    kind: "leave",
    title: `${leaveType} application submitted`,
    body: `${days} day(s), ${data.fromDate} to ${data.toDate}. It is waiting for approval.`,
    link: "/employee/leave/history",
  });
  return { id, days };
}

async function loadLeave(actor: Actor, id: string) {
  const scope = await listScope(actor, undefined);
  const leave = scope && (await db().leaveApplication.findFirst({ where: { id, employee: scope }, include: { attachments: true } }));
  if (!leave) throw notFound("Leave application");
  return leave;
}

export async function decideLeave(actor: Actor, id: string, status: "Approved" | "Rejected") {
  requireManager(actor);
  const leave = await loadLeave(actor, id);
  if (leave.status !== "Pending") throw conflict("This application has already been decided.");
  await refuseOwnDecision(actor, leave.employeeId);
  // Multilayer approval: stays Pending until the last pipeline stage approves.
  const target = { feature: LEAVE_APPROVAL_FEATURE, documentId: id, businessUnitId: await employeeBusinessUnit(leave.employeeId) };
  const result = await decideWithPipeline(actor, target, status === "Approved" ? "approve" : "reject", async (tx) => {
    const { count } = await tx.leaveApplication.updateMany({ where: { id, status: "Pending" }, data: decision(actor, status) });
    if (!count) throw conflict("This application has already been decided.");
  });
  const range = `${isoDate(leave.fromDate)} to ${isoDate(leave.toDate)}`;
  if (status === "Rejected") await notifyEmployees([leave.employeeId], { kind: "leave", title: `${leave.leaveType} rejected`, body: `Your application for ${range} was rejected by ${actor.name ?? "the approver"}.`, link: "/employee/leave/history" });
  else if (result?.final) await notifyEmployees([leave.employeeId], { kind: "leave", title: `${leave.leaveType} approved`, body: `Your ${leave.days} day(s) from ${range} are approved.`, link: "/employee/leave/history" });
  else if (result?.next) await notifyEmployees([leave.employeeId], { kind: "leave", title: `${leave.leaveType}: stage ${result.stage?.stageNo} approved`, body: `Now waiting for ${result.next.name} (stage ${result.next.stageNo} of ${result.stages}).`, link: "/employee/leave/history" });
}

/** Approval Setup feature of leave applications. */
export const LEAVE_APPROVAL_FEATURE = "Employee Leave";

/** Nobody decides their own application, whatever their permissions (the master account excepted). */
async function refuseOwnDecision(actor: Actor, employeeId: string) {
  if (actor.isMaster) return;
  if ((await linkedEmployee(actor))?.id === employeeId) throw forbidden("You cannot approve or reject your own application.");
}

export async function deleteLeave(actor: Actor, id: string) {
  const leave = await loadLeave(actor, id);
  if (leave.status !== "Pending") throw badRequest("Only pending applications can be deleted.");
  if (!managesLeave(actor) && leave.employeeId !== (await linkedEmployee(actor))?.id) throw forbidden("You can only delete your own applications.");
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
  const movement = await loadMovement(actor, id);
  if (movement.status !== "Pending") throw conflict("This application has already been decided.");
  await refuseOwnDecision(actor, movement.employeeId);
  const target = { feature: "Employee Movement", documentId: id, businessUnitId: await employeeBusinessUnit(movement.employeeId) };
  const result = await decideWithPipeline(actor, target, status === "Approved" ? "approve" : "reject", async (tx) => {
    const { count } = await tx.movementApplication.updateMany({ where: { id, status: "Pending" }, data: decision(actor, status) });
    if (!count) throw conflict("This application has already been decided.");
  });
  if (status === "Rejected" || result?.final) await notifyEmployees([movement.employeeId], { kind: "movement", title: `Movement application ${status.toLowerCase()}`, body: `Decided by ${actor.name ?? "the approver"}.`, link: "/employee/notifications" });
}

export async function deleteMovement(actor: Actor, id: string) {
  const movement = await loadMovement(actor, id);
  if (movement.status !== "Pending") throw badRequest("Only pending applications can be deleted.");
  await db().movementApplication.delete({ where: { id } });
}
