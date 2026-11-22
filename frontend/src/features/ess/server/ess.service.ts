import { z } from "zod";
import type { UploadedFile } from "@/features/configuration/entity-master-data/supplier/server/supplier.service";
import { ADJUSTABLE_STATUSES } from "@/features/hrm/attendance/types";
import { requestOwnAttendanceChange, withdrawOwnAttendanceRequest } from "@/features/hrm/attendance/services/attendance.service";
import { dayPlans, daysBetween } from "@/features/hrm/attendance/services/day-plan.service";
import { PF_CODE } from "@/features/hrm/payroll/batch-types";
import { LEAVE_APPROVAL_FEATURE, applyLeave, balanceOf } from "@/features/hrm/self-service/leave-movement/server/leave-movement.service";
import { chargeableDays, leaveTypesFor } from "@/features/hrm/self-service/leave-movement/server/leave-policy";
import { AppError, badRequest, conflict, notFound } from "@/lib/api/errors";
import { approvalOutlook, resetApproval } from "@/lib/approval/engine";
import type { Actor } from "@/lib/auth/actor";
import { notifyUsers } from "@/lib/notifications/notify";
import { db } from "@/lib/prisma/client";
import { getStorage } from "@/lib/storage";
import {
  CORRECTION_TYPES,
  type EssActivity,
  type EssDashboard,
  type EssEmployee,
  type EssLeaveApplication,
  type EssLeaveDetail,
  type EssLeaveOverview,
  type EssLeavePreview,
  type EssMe,
  type EssNotice,
  type EssNotifications,
  type EssPayslip,
  type EssPayslipRow,
  type EssProfile,
  type EssUpcoming,
} from "../types";
import { attendanceSnapshot, today } from "./ess-attendance.service";
import { NOT_LINKED_MESSAGE, findSelf, requireActiveSelf, requireSelf, type SelfEmployee } from "./identity";

const iso = (d: Date) => d.toISOString().slice(0, 10);
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const n = (v: { toString(): string } | null | undefined) => (v === null || v === undefined ? 0 : Number(v.toString()));

// ─── Who am I ─────────────────────────────────────────────────────────────────

async function employeeCard(self: SelfEmployee): Promise<EssEmployee> {
  const photo = await db().employee.findUnique({ where: { id: self.id }, select: { profileImageKey: true } });
  return {
    code: self.code,
    name: self.name,
    designation: self.designation,
    department: self.department,
    departmentSection: self.departmentSection,
    officeName: self.officeName,
    joiningDate: self.joiningDate,
    isActive: self.isActive,
    canApply: self.canApply,
    hasPhoto: !!photo?.profileImageKey,
  };
}

/** Whether the login is linked to an employee (the portal shows a linking screen otherwise). */
export async function essMe(actor: Actor): Promise<EssMe> {
  const self = await findSelf(actor);
  return self ? { linked: true, employee: await employeeCard(self) } : { linked: false, message: NOT_LINKED_MESSAGE };
}

/** The employee's own photo (Employee › profile image). */
export async function myPhoto(actor: Actor) {
  const self = await requireSelf(actor);
  const e = await db().employee.findUnique({ where: { id: self.id }, select: { profileImageKey: true } });
  const bytes = e?.profileImageKey ? await getStorage().get(e.profileImageKey) : null;
  if (!bytes) throw notFound("Photo");
  return bytes;
}

// ─── Profile ──────────────────────────────────────────────────────────────────

/**
 * The employee-facing fields of Employee Master. Salary, NID, signature,
 * supervisor notes, flags and internal ids are not part of it.
 */
export async function myProfile(actor: Actor): Promise<EssProfile> {
  const self = await requireSelf(actor);
  const e = await db().employee.findUniqueOrThrow({
    where: { id: self.id },
    select: {
      employeeType: true,
      serviceCategory: true,
      hrPosition: true,
      location: true,
      confirmationDate: true,
      mobile: true,
      email: true,
      officialContact: true,
      presentAddress: true,
      permanentAddress: true,
      bloodGroup: true,
      gender: true,
      dateOfBirth: true,
      supervisor: true,
      lineManager: true,
      office: { select: { name: true, businessUnit: { select: { name: true } } } },
    },
  });
  const date = (d: Date | null) => (d ? iso(d) : null);
  return {
    employee: await employeeCard(self),
    basic: [
      { label: "Employee Name", value: self.name },
      { label: "Employee Code", value: self.code },
      { label: "Gender", value: e.gender },
      { label: "Date of Birth", value: date(e.dateOfBirth) },
      { label: "Blood Group", value: e.bloodGroup },
    ],
    contact: [
      { label: "Email", value: e.email },
      { label: "Mobile", value: e.mobile },
      { label: "Official Contact", value: e.officialContact },
      { label: "Present Address", value: e.presentAddress },
      { label: "Permanent Address", value: e.permanentAddress },
    ],
    employment: [
      { label: "Designation", value: self.designation },
      { label: "Position", value: e.hrPosition },
      { label: "Department", value: self.department },
      { label: "Section", value: self.departmentSection },
      { label: "Office", value: e.office.name },
      { label: "Business Unit", value: e.office.businessUnit.name },
      { label: "Work Location", value: e.location },
      { label: "Employment Type", value: e.employeeType },
      { label: "Service Category", value: e.serviceCategory },
      { label: "Joining Date", value: self.joiningDate },
      { label: "Confirmation Date", value: date(e.confirmationDate) },
      { label: "Employment Status", value: self.canApply ? "Active" : self.terminationDate ? `Separated (${self.terminationDate})` : "Inactive" },
      { label: "Reporting Manager", value: e.lineManager || e.supervisor },
    ],
  };
}

// ─── Leave ────────────────────────────────────────────────────────────────────

const leaveReference = (id: string, appliedAt: Date) => `LV-${appliedAt.getUTCFullYear()}-${id.slice(0, 6).toUpperCase()}`;

/** Where each application stands in its approval pipeline. */
async function stagesOf(ids: string[]) {
  const rows = ids.length
    ? await db().documentApproval.findMany({ where: { feature: LEAVE_APPROVAL_FEATURE, documentId: { in: ids } }, orderBy: { stageNo: "asc" }, select: { documentId: true, stageNo: true, stageName: true, status: true } })
    : [];
  return (id: string, status: string) => {
    if (status !== "Pending") return status;
    const own = rows.filter((r) => r.documentId === id);
    const current = own.find((r) => r.status === "PENDING");
    return current ? `Stage ${current.stageNo} of ${own.length}: ${current.stageName}` : "Waiting for approval";
  };
}

type LeaveRecord = Awaited<ReturnType<typeof ownLeaves>>[number];

function ownLeaves(employeeId: string, where: { id?: string } = {}) {
  return db().leaveApplication.findMany({
    where: { employeeId, ...where },
    orderBy: [{ fromDate: "desc" }, { createdAt: "desc" }],
    take: 200,
    include: { attachments: { orderBy: { createdAt: "asc" }, select: { id: true, originalName: true, size: true } } },
  });
}

function toApplication(l: LeaveRecord, stage: string): EssLeaveApplication {
  return {
    id: l.id,
    reference: leaveReference(l.id, l.createdAt),
    leaveType: l.leaveType,
    fromDate: iso(l.fromDate),
    toDate: iso(l.toDate),
    days: l.days,
    reason: l.reason,
    location: l.location ?? "",
    status: l.status,
    appliedAt: l.createdAt.toISOString(),
    decidedByName: l.decidedByName,
    decidedAt: l.decidedAt?.toISOString() ?? null,
    stage,
    attachments: l.attachments.map((a) => ({ id: a.id, name: a.originalName, size: a.size })),
    canCancel: l.status === "Pending",
  };
}

export async function myLeave(actor: Actor, year = Number(today().slice(0, 4))): Promise<EssLeaveOverview> {
  const self = await requireSelf(actor);
  if (!Number.isInteger(year) || year < 2000 || year > 2100) throw badRequest("Choose a valid year.");
  const [balances, leaves] = await Promise.all([balanceOf({ id: self.id, officeId: self.officeId, gender: self.gender }, year), ownLeaves(self.id)]);
  const stage = await stagesOf(leaves.filter((l) => l.status === "Pending").map((l) => l.id));
  const count = (s: string) => leaves.filter((l) => l.status === s && l.fromDate.getUTCFullYear() === year).length;
  return {
    year,
    balances,
    applications: leaves.map((l) => toApplication(l, stage(l.id, l.status))),
    counts: { pending: count("Pending"), approved: count("Approved"), rejected: count("Rejected"), cancelled: count("Cancelled") },
    canApply: self.canApply,
  };
}

export async function myLeaveDetail(actor: Actor, id: string): Promise<EssLeaveDetail> {
  const self = await requireSelf(actor);
  const [leave] = await ownLeaves(self.id, { id });
  if (!leave) throw notFound("Leave application");
  const stage = await stagesOf([leave.id]);
  const trail = await approvalOutlook({ feature: LEAVE_APPROVAL_FEATURE, documentId: id, businessUnitId: self.businessUnitId });
  return { ...toApplication(leave, stage(leave.id, leave.status)), trail };
}

export const leavePreviewSchema = z.object({
  leaveType: z.string().trim().min(1, "Select a leave type.").max(40),
  fromDate: z.string().regex(DAY, "Choose a valid date."),
  toDate: z.string().regex(DAY, "Choose a valid date."),
});

/** What an application would charge, before it is submitted. */
export async function previewLeave(actor: Actor, input: unknown): Promise<EssLeavePreview> {
  const self = await requireSelf(actor);
  const data = leavePreviewSchema.parse(input);
  if (data.toDate < data.fromDate) throw badRequest("To Date cannot be before From Date.");
  if (daysBetween(data.fromDate, data.toDate).length > 180) throw badRequest("An application can cover at most 180 days.");
  const subject = { id: self.id, officeId: self.officeId, gender: self.gender };
  const rule = (await leaveTypesFor(subject, data.fromDate)).find((t) => t.name.toLowerCase() === data.leaveType.toLowerCase());
  if (!rule) throw badRequest(`${data.leaveType} is not available to you.`);
  const [charge, balances, overlap] = await Promise.all([
    chargeableDays(subject, rule.name, data.fromDate, data.toDate),
    balanceOf(subject, Number(data.fromDate.slice(0, 4))),
    db().leaveApplication.findFirst({ where: { employeeId: self.id, status: { in: ["Pending", "Approved"] }, fromDate: { lte: new Date(`${data.toDate}T00:00:00Z`) }, toDate: { gte: new Date(`${data.fromDate}T00:00:00Z`) } }, select: { leaveType: true, fromDate: true, toDate: true } }),
  ]);
  const remaining = balances.find((b) => b.leaveType === rule.name)?.remaining ?? null;
  const problems: string[] = [];
  if (data.fromDate.slice(0, 4) !== data.toDate.slice(0, 4)) problems.push("A leave cannot cross into the next year. Apply separately for each year.");
  if (charge.days === 0) problems.push("Every selected day is a weekly off or holiday.");
  if (remaining !== null && charge.days > remaining) problems.push(`Only ${Math.max(remaining, 0)} day(s) of ${rule.name} remain; this needs ${charge.days}.`);
  if (overlap) problems.push(`Overlaps your ${overlap.leaveType} from ${iso(overlap.fromDate)} to ${iso(overlap.toDate)}.`);
  if (rule.noticeDays) {
    const earliest = iso(new Date(Date.parse(`${today()}T00:00:00Z`) + rule.noticeDays * 86_400_000));
    if (data.fromDate < earliest) problems.push(`${rule.name} must be applied for at least ${rule.noticeDays} day(s) in advance.`);
  }
  if (data.fromDate < self.joiningDate) problems.push(`You joined on ${self.joiningDate}; leave cannot start before that.`);
  return {
    days: charge.days,
    calendarDays: charge.calendarDays,
    excluded: charge.excluded,
    remaining,
    noticeDays: rule.noticeDays,
    attachmentRequired: rule.attachmentAfterDays !== null && charge.days > rule.attachmentAfterDays,
    problems,
  };
}

export const ownLeaveSchema = z.object({
  leaveType: z.string().trim().min(1, "Select a leave type.").max(40),
  fromDate: z.string().regex(DAY, "Choose a valid date."),
  toDate: z.string().regex(DAY, "Choose a valid date."),
  reason: z.string().trim().min(1, "Enter a reason.").max(500),
  contact: z.string().trim().max(150).default(""),
});

/**
 * Applies for the employee's own leave through the HRM leave service (policy,
 * balance, overlap and approval pipeline are all checked there). Any employee
 * id in the request is ignored.
 */
export async function applyOwnLeave(actor: Actor, input: unknown, files: Required<UploadedFile>[]) {
  const self = await requireActiveSelf(actor);
  const data = ownLeaveSchema.parse(input);
  if (data.fromDate < self.joiningDate) throw badRequest(`You joined on ${self.joiningDate}; leave cannot start before that.`);
  const result = await applyLeave(actor, { leaveType: data.leaveType, fromDate: data.fromDate, toDate: data.toDate, reason: data.reason, location: data.contact }, files);
  const created = await db().leaveApplication.findUniqueOrThrow({ where: { id: result.id }, select: { createdAt: true } });
  return { ...result, reference: leaveReference(result.id, created.createdAt) };
}

/** Withdraws a pending application; it is kept as Cancelled and uses no balance. */
export async function cancelOwnLeave(actor: Actor, id: string) {
  const self = await requireSelf(actor);
  const leave = await db().leaveApplication.findFirst({ where: { id, employeeId: self.id }, select: { id: true, status: true, leaveType: true } });
  if (!leave) throw notFound("Leave application");
  if (leave.status !== "Pending") throw conflict(`This application is ${leave.status.toLowerCase()}; only a pending application can be cancelled.`);
  await db().$transaction(async (tx) => {
    const { count } = await tx.leaveApplication.updateMany({ where: { id, status: "Pending" }, data: { status: "Cancelled", decidedByName: self.name.slice(0, 150), decidedAt: new Date() } });
    if (!count) throw conflict("This application was decided in the meantime.");
    await resetApproval(tx, LEAVE_APPROVAL_FEATURE, id);
  });
}

export async function ownLeaveAttachment(actor: Actor, id: string, attachmentId: string) {
  const self = await requireSelf(actor);
  const file = await db().leaveAttachment.findFirst({ where: { id: attachmentId, leaveApplicationId: id, leaveApplication: { employeeId: self.id } } });
  if (!file) throw notFound("Attachment");
  const bytes = await getStorage().get(file.storageKey);
  if (!bytes) throw notFound("Attachment");
  return { bytes, mimeType: file.mimeType, originalName: file.originalName };
}

// ─── Attendance corrections ───────────────────────────────────────────────────

const time = z.union([z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Enter a valid time."), z.literal("")]).default("");

export const correctionSchema = z
  .object({
    date: z.string().regex(DAY, "Choose a valid date."),
    correctionType: z.enum(CORRECTION_TYPES, "Choose the correction type."),
    requestedStatus: z.enum(ADJUSTABLE_STATUSES, "Choose the status you need."),
    inTime: time,
    outTime: time,
    reason: z.string().trim().min(1, "Enter the reason for the correction.").max(400),
  })
  .refine((v) => v.correctionType !== "Missing Check-In" || v.inTime, { message: "Enter the check-in time.", path: ["inTime"] })
  .refine((v) => v.correctionType !== "Missing Check-Out" || v.outTime, { message: "Enter the check-out time.", path: ["outTime"] });

/**
 * Submits a correction through the HRM attendance service: it waits for the
 * "Employee Attendance" approval pipeline and changes attendance only once
 * approved. A day already in a submitted or approved payroll is flagged, as
 * that salary is settled through a payroll adjustment, never rewritten.
 */
export async function requestCorrection(actor: Actor, input: unknown): Promise<{ id: string; warning: string | null }> {
  const self = await requireActiveSelf(actor);
  const data = correctionSchema.parse(input);
  if (data.date < self.joiningDate) throw badRequest(`You joined on ${self.joiningDate}.`);
  const locked = await db().payrollBatchLine.findFirst({
    where: { employeeId: self.id, batch: { status: { in: ["Under Processing", "Approved"] }, fromDate: { lte: new Date(`${data.date}T00:00:00Z`) }, toDate: { gte: new Date(`${data.date}T00:00:00Z`) } } },
    select: { batch: { select: { reference: true, status: true } } },
  });
  const warning = locked ? `This day is in payroll ${locked.batch.reference} (${locked.batch.status}); if approved, any salary effect is settled through a payroll adjustment.` : null;
  const reason = [`[${data.correctionType}]`, data.reason, locked ? `(In payroll ${locked.batch.reference}, ${locked.batch.status}.)` : ""].filter(Boolean).join(" ").slice(0, 500);
  const saved = await requestOwnAttendanceChange(actor, { date: data.date, requestedStatus: data.requestedStatus, inTime: data.inTime || null, outTime: data.outTime || null, reason });
  if (actor.id) await notifyUsers([{ userId: actor.id, kind: "attendance", title: "Attendance correction submitted", body: `${data.correctionType} for ${data.date}. It is waiting for HR approval.`, link: "/employee/attendance-corrections" }]);
  return { id: saved.id, warning };
}

export async function withdrawCorrection(actor: Actor, id: string) {
  await requireSelf(actor);
  await withdrawOwnAttendanceRequest(actor, id);
}

// ─── Payslips ─────────────────────────────────────────────────────────────────

/** Only Approved batches whose payslips HR has published; Under Processing never shows. */
const PUBLISHED = { status: "Approved", payslipsPublishedAt: { not: null } } as const;

const lineSelect = {
  id: true,
  grossSalary: true,
  basic: true,
  houseRent: true,
  medical: true,
  transport: true,
  components: true,
  earnedGross: true,
  additions: true,
  attendanceDeduction: true,
  otherDeduction: true,
  totalDeduction: true,
  netPayable: true,
  payMethod: true,
  attendance: true,
  employeeCode: true,
  employeeName: true,
  designation: true,
  department: true,
  batch: { select: { reference: true, month: true, payrollDate: true, salaryType: true, fromDate: true, toDate: true, payslipsPublishedAt: true, office: { select: { name: true } } } },
} as const;

type LineRow = Awaited<ReturnType<typeof findLines>>[number];

function findLines(employeeId: string, id?: string) {
  return db().payrollBatchLine.findMany({ where: { employeeId, ...(id ? { id } : {}), batch: PUBLISHED }, orderBy: [{ batch: { month: "desc" } }, { batch: { payrollDate: "desc" } }], take: 60, select: lineSelect });
}

const componentsOf = (l: LineRow) => Object.entries((l.components ?? {}) as Record<string, number>).filter(([, v]) => typeof v === "number" && v !== 0);

function toPayslipRow(l: LineRow): EssPayslipRow {
  const allowances = componentsOf(l)
    .filter(([code]) => code !== PF_CODE)
    .reduce((t, [, v]) => t + v, 0);
  return {
    id: l.id,
    reference: l.batch.reference,
    month: l.batch.month,
    payrollDate: iso(l.batch.payrollDate),
    salaryType: l.batch.salaryType,
    grossSalary: n(l.grossSalary),
    allowances: Math.round(allowances * 100) / 100,
    deductions: n(l.totalDeduction),
    netPayable: n(l.netPayable),
    publishedAt: l.batch.payslipsPublishedAt!.toISOString(),
  };
}

export async function myPayslips(actor: Actor): Promise<EssPayslipRow[]> {
  const self = await requireSelf(actor);
  return (await findLines(self.id)).map(toPayslipRow);
}

export async function myPayslip(actor: Actor, id: string): Promise<EssPayslip> {
  const self = await requireSelf(actor);
  const [l] = await findLines(self.id, id);
  if (!l) throw notFound("Payslip");
  // Component columns are allowance short codes (HR Governance › Allowance); show their names.
  const allowances = await db().hrPolicyRecord.findMany({ where: { tab: "allowance" }, select: { data: true } });
  const names = new Map<string, string>();
  for (const a of allowances) {
    const d = (a.data ?? {}) as Record<string, unknown>;
    if (typeof d.shortCode === "string" && typeof d.name === "string") names.set(d.shortCode.trim(), d.name.trim());
  }
  const label = (code: string) => (code === PF_CODE ? "Provident Fund (PFD)" : names.has(code) ? `${names.get(code)} (${code})` : code);
  const base = [
    { label: "Basic", amount: l.basic },
    { label: "House Rent", amount: l.houseRent },
    { label: "Medical", amount: l.medical },
    { label: "Transport", amount: l.transport },
  ].flatMap((x) => (x.amount === null ? [] : [{ label: x.label, amount: n(x.amount) }]));
  const parts = componentsOf(l);
  return {
    ...toPayslipRow(l),
    employee: { code: l.employeeCode, name: l.employeeName, designation: l.designation, department: l.department, office: l.batch.office.name },
    period: { from: iso(l.batch.fromDate), to: iso(l.batch.toDate) },
    earnings: [...base, ...parts.filter(([code]) => code !== PF_CODE).map(([code, amount]) => ({ label: label(code), amount }))],
    deductionLines: [
      ...(n(l.attendanceDeduction) ? [{ label: "Attendance deduction", amount: n(l.attendanceDeduction) }] : []),
      ...parts.filter(([code]) => code === PF_CODE).map(([code, amount]) => ({ label: label(code), amount })),
      ...(n(l.otherDeduction) ? [{ label: "Other deductions", amount: n(l.otherDeduction) }] : []),
    ],
    earnedGross: n(l.earnedGross),
    additions: n(l.additions),
    attendanceDeduction: n(l.attendanceDeduction),
    otherDeduction: n(l.otherDeduction),
    payMethod: l.payMethod,
    attendance: (l.attendance ?? {}) as Record<string, unknown>,
  };
}

// ─── Notifications ────────────────────────────────────────────────────────────

/** Notice Board notices in force for the employee's office. */
async function notices(self: SelfEmployee): Promise<EssNotice[]> {
  const day = new Date(`${today()}T00:00:00Z`);
  const rows = await db().hrPolicyRecord.findMany({
    where: { tab: "notice-board", OR: [{ officeId: self.officeId }, { officeId: null }], AND: [{ OR: [{ effectiveFrom: null }, { effectiveFrom: { lte: day } }] }, { OR: [{ effectiveTo: null }, { effectiveTo: { gte: day } }] }] },
    orderBy: [{ effectiveFrom: "desc" }, { createdAt: "desc" }],
    take: 20,
    select: { id: true, data: true, effectiveFrom: true, effectiveTo: true },
  });
  const rank = { Urgent: 0, Important: 1, Normal: 2 } as Record<string, number>;
  return rows
    .map((r) => {
      const d = (r.data ?? {}) as Record<string, unknown>;
      return {
        id: r.id,
        title: typeof d.name === "string" ? d.name : "Notice",
        priority: typeof d.priority === "string" ? d.priority : "Normal",
        message: typeof d.message === "string" ? d.message : "",
        publishedOn: r.effectiveFrom ? iso(r.effectiveFrom) : null,
        expiresOn: r.effectiveTo ? iso(r.effectiveTo) : null,
      };
    })
    .sort((a, b) => (rank[a.priority] ?? 3) - (rank[b.priority] ?? 3));
}

/** The signed-in user's notifications. They belong to the login, so they work without an employee link too. */
export async function myNotifications(actor: Actor, limit = 50): Promise<EssNotifications> {
  if (actor.via !== "session") throw new AppError(403, "FORBIDDEN", "Notifications are for signed-in users.");
  const self = await findSelf(actor);
  const [items, unread, board] = await Promise.all([
    db().userNotification.findMany({ where: { userId: actor.id }, orderBy: { createdAt: "desc" }, take: Math.min(Math.max(limit, 1), 100) }),
    db().userNotification.count({ where: { userId: actor.id, readAt: null } }),
    self ? notices(self) : Promise.resolve([]),
  ]);
  return {
    unread,
    items: items.map((i) => ({ id: i.id, kind: i.kind, title: i.title, body: i.body, link: i.link, read: !!i.readAt, createdAt: i.createdAt.toISOString() })),
    notices: board,
  };
}

/** Marks one notification (or, without an id, all of them) read. Only the owner's rows are touched. */
export async function markNotificationsRead(actor: Actor, id?: string) {
  if (actor.via !== "session") throw new AppError(403, "FORBIDDEN", "Notifications are for signed-in users.");
  const { count } = await db().userNotification.updateMany({ where: { userId: actor.id, readAt: null, ...(id ? { id } : {}) }, data: { readAt: new Date() } });
  return { updated: count };
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export async function myDashboard(actor: Actor): Promise<EssDashboard> {
  const self = await requireSelf(actor);
  const now = today();
  const year = Number(now.slice(0, 4));
  const subject = { id: self.id, officeId: self.officeId, gender: self.gender };
  const [employee, snapshot, balances, leaves, corrections, payslips, unread, board, recent] = await Promise.all([
    employeeCard(self),
    attendanceSnapshot(self),
    balanceOf(subject, year),
    db().leaveApplication.findMany({ where: { employeeId: self.id }, orderBy: { updatedAt: "desc" }, take: 30, select: { id: true, leaveType: true, fromDate: true, toDate: true, days: true, status: true, createdAt: true, decidedAt: true, decidedByName: true } }),
    db().attendanceAdjustment.findMany({ where: { employeeId: self.id }, orderBy: { updatedAt: "desc" }, take: 5, select: { date: true, status: true, requestedStatus: true, createdAt: true, decidedAt: true } }),
    findLines(self.id),
    db().userNotification.count({ where: { userId: actor.id, readAt: null } }),
    notices(self),
    db().userNotification.findMany({ where: { userId: actor.id, kind: "calendar" }, orderBy: { createdAt: "desc" }, take: 2 }),
  ]);

  const activities: EssActivity[] = [];
  for (const l of leaves.slice(0, 6)) {
    const range = `${iso(l.fromDate)} to ${iso(l.toDate)} · ${l.days} day(s)`;
    activities.push({ at: l.createdAt.toISOString(), kind: "leave", title: `${l.leaveType} application submitted`, detail: range, tone: "neutral", link: "/employee/leave/history" });
    if (l.decidedAt && l.status !== "Pending") {
      activities.push({
        at: l.decidedAt.toISOString(),
        kind: "leave",
        title: `${l.leaveType} ${l.status.toLowerCase()}`,
        detail: `${range}${l.decidedByName ? ` · by ${l.decidedByName}` : ""}`,
        tone: l.status === "Approved" ? "success" : l.status === "Rejected" ? "danger" : "neutral",
        link: "/employee/leave/history",
      });
    }
  }
  for (const c of corrections) {
    const decided = c.decidedAt && c.status !== "Pending";
    activities.push({
      at: (decided ? c.decidedAt! : c.createdAt).toISOString(),
      kind: "attendance",
      title: decided ? `Attendance correction ${c.status.toLowerCase()}` : "Attendance correction submitted",
      detail: `${iso(c.date)} · requested ${c.requestedStatus}`,
      tone: c.status === "Approved" ? "success" : c.status === "Rejected" ? "danger" : "warning",
      link: "/employee/attendance-corrections",
    });
  }
  for (const p of payslips.slice(0, 2)) activities.push({ at: p.batch.payslipsPublishedAt!.toISOString(), kind: "payslip", title: `Payslip published for ${p.batch.month}`, detail: `Net payable ${n(p.netPayable).toFixed(2)}`, tone: "success", link: `/employee/payslips/${p.id}` });
  for (const r of recent) activities.push({ at: r.createdAt.toISOString(), kind: "calendar", title: r.title, detail: r.body, tone: "neutral", link: r.link });
  activities.sort((a, b) => b.at.localeCompare(a.at));

  // The next 14 days: shifts, offs, holidays and approved leave.
  const approved = leaves.filter((l) => l.status === "Approved");
  const leaveOn = (date: string) => approved.find((l) => iso(l.fromDate) <= date && iso(l.toDate) >= date);
  const upcoming: EssUpcoming[] = [];
  const horizon = daysBetween(now, iso(new Date(Date.parse(`${now}T00:00:00Z`) + 13 * 86_400_000)));
  const plans = horizon.at(-1)! <= snapshot.to ? snapshot.plans : await dayPlans([{ id: self.id, officeId: self.officeId }], now, horizon.at(-1)!);
  const weekday = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", weekday: "short" });
  for (const date of horizon) {
    const plan = plans.get(`${self.id}:${date}`);
    const leave = leaveOn(date);
    upcoming.push({
      date,
      day: weekday.format(new Date(`${date}T00:00:00Z`)),
      kind: leave && plan?.kind !== "holiday" && plan?.kind !== "off" ? "leave" : (plan?.kind ?? "none"),
      label: leave && plan?.kind !== "holiday" && plan?.kind !== "off" ? leave.leaveType : !plan ? "No schedule" : plan.kind === "off" ? "Weekly off" : plan.kind === "holiday" ? plan.title : `${plan.calendar.name} · ${plan.calendar.startTime}–${plan.calendar.endTime}`,
    });
  }

  return {
    employee,
    today: snapshot.today,
    month: { month: snapshot.month, from: snapshot.from, to: snapshot.to, summary: snapshot.summary },
    leave: {
      balances,
      pending: leaves.filter((l) => l.status === "Pending").length,
      upcoming: approved.filter((l) => iso(l.toDate) >= now).sort((a, b) => a.fromDate.getTime() - b.fromDate.getTime()).slice(0, 3).map((l) => ({ leaveType: l.leaveType, fromDate: iso(l.fromDate), toDate: iso(l.toDate), days: l.days })),
    },
    activities: activities.slice(0, 8),
    upcoming,
    notices: board.slice(0, 3),
    unread,
    latestPayslip: payslips[0] ? toPayslipRow(payslips[0]) : null,
  };
}

