import { AppError, badRequest, conflict, notFound } from "@/lib/api/errors";
import { decideWithPipeline, employeeBusinessUnit, resetApproval } from "@/lib/approval/engine";
import { actorUserId, type Actor } from "@/lib/auth/actor";
import { employeeScope } from "../../shared/hr-access";
import { db } from "@/lib/prisma/client";
import { notifyEmployees } from "@/lib/notifications/notify";
import { ADJUSTABLE_STATUSES, type AttendanceRecord, type AttendanceFilterState, type EmployeeOption } from "../types";
import { dayPlans, daysBetween, isOvernight, minutesOf, type DayPlan, type WorkCalendar } from "./day-plan.service";

/** Devices keep local time; days and times are shown in this time zone. */
export const TIME_ZONE = process.env.APP_TIMEZONE || "Asia/Dhaka";
/** Longest range one request may cover (punch rows are grouped in memory). */
const MAX_RANGE_DAYS = 93;

export const dayKey = new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" });
const clock = new Intl.DateTimeFormat("en-US", { timeZone: TIME_ZONE, hour: "2-digit", minute: "2-digit", hour12: true });
const weekday = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", weekday: "short" });

export async function getAttendanceEmployees(): Promise<EmployeeOption[]> {
  const employees = await db().employee.findMany({
    where: { isActive: true },
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
    orderBy: [{ employeeCode: "asc" }],
    take: 5000,
  });

  return employees.map((e) => ({
    id: e.id,
    employeeCode: e.employeeCode,
    name: e.name,
    designation: e.designation || "",
    department: e.department || "",
    departmentSection: e.departmentSection || "",
    officeId: e.officeId,
    officeName: e.office?.name || "",
  }));
}

// ─── Attendance rules (HR Governance › Settings / Policies › Atten Process) ──

/** Used when no rule applies: late after 9:25 AM, absent after 12:00 PM. */
export const DEFAULT_ATTENDANCE_RULE = { dayStart: "08:00", lateAfter: "09:25", absentAfter: "12:00" } as const;

export interface AttendanceRule {
  officeId: string | null;
  from: string;
  to: string | null;
  lateAfter: string;
  absentAfter: string;
}

const hhmm = new Intl.DateTimeFormat("en-GB", { timeZone: TIME_ZONE, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const isTime = (value: unknown): value is string => typeof value === "string" && /^\d{2}:\d{2}$/.test(value);

export async function attendanceRules(toDate: string): Promise<AttendanceRule[]> {
  const records = await db().hrPolicyRecord.findMany({
    where: { tab: "attendance-process", OR: [{ effectiveFrom: null }, { effectiveFrom: { lte: new Date(`${toDate}T00:00:00Z`) } }] },
    select: { officeId: true, effectiveFrom: true, effectiveTo: true, data: true },
  });
  return records.flatMap((r) => {
    const data = (r.data ?? {}) as Record<string, unknown>;
    if (!isTime(data.lateAfter) || !isTime(data.absentAfter)) return [];
    return [{ officeId: r.officeId, from: r.effectiveFrom?.toISOString().slice(0, 10) ?? "", to: r.effectiveTo?.toISOString().slice(0, 10) ?? null, lateAfter: data.lateAfter, absentAfter: data.absentAfter }];
  });
}

/** The office's own rule in force on the day, else the all-office one (latest effective date first). */
export function ruleFor(rules: AttendanceRule[], officeId: string, date: string) {
  const inForce = rules.filter((r) => r.from <= date && (!r.to || r.to >= date));
  const pick = (list: AttendanceRule[]) => list.sort((a, b) => b.from.localeCompare(a.from))[0];
  return pick(inForce.filter((r) => r.officeId === officeId)) ?? pick(inForce.filter((r) => r.officeId === null)) ?? DEFAULT_ATTENDANCE_RULE;
}

/** Present, Late or Absent from the first punch's local time (minutes; 9:25:59 is still 9:25). */
export function statusOf(firstPunch: Date, rule: { lateAfter: string; absentAfter: string }): "Present" | "Late" | "Absent" {
  const at = hhmm.format(firstPunch);
  if (at > rule.absentAfter) return "Absent";
  if (at > rule.lateAfter) return "Late";
  return "Present";
}

/** False for a missing or reversed range; throws when the range is too long. */
function validRange(filters: AttendanceFilterState): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(filters.fromDate) || !/^\d{4}-\d{2}-\d{2}$/.test(filters.toDate) || filters.fromDate > filters.toDate) return false;
  const days = (Date.parse(filters.toDate) - Date.parse(filters.fromDate)) / 86_400_000 + 1;
  if (days > MAX_RANGE_DAYS) throw new Error(`Choose at most ${MAX_RANGE_DAYS} days at a time.`);
  return true;
}

/**
 * One row per employee and day, from device punches and the day plan
 * (Calendar Assign, Holidays, Off Day, Roster):
 * - a day with punches: first punch = in, last = out (when more than one);
 *   Late / Absent from the day's calendar (grace / last start time), else
 *   from the Atten Process rule; Offday / Holiday when the plan says so.
 * - a planned day without punches: Absent on a past or current working day,
 *   Offday / Holiday on those days. Days with neither get no row.
 * A night calendar's punches after midnight count for the day it started.
 * Manual adjustments are applied afterwards (applyAdjustments).
 */
async function punchRecords(filters: AttendanceFilterState, employees: EmployeeOption[]): Promise<{ rows: AttendanceRecord[]; plans: Map<string, DayPlan> }> {
  if (!validRange(filters)) return { rows: [], plans: new Map() };

  // Two days either side: time-zone offsets, and night shifts that cross midnight.
  const from = new Date(Date.parse(`${filters.fromDate}T00:00:00Z`) - 2 * 86_400_000);
  const to = new Date(Date.parse(`${filters.toDate}T00:00:00Z`) + 2 * 86_400_000);
  const dayBefore = new Date(Date.parse(`${filters.fromDate}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10);
  const dayAfter = new Date(Date.parse(`${filters.toDate}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
  const chosen = filters.employeeId && filters.employeeId !== "ALL" ? filters.employeeId : "";
  const employeeFilter = chosen ? { OR: [...(/^[0-9a-f-]{36}$/i.test(chosen) ? [{ id: chosen }] : []), { employeeCode: chosen }] } : {};
  const people = chosen ? employees.filter((e) => e.id === chosen || e.employeeCode === chosen) : employees;

  const [punches, rules, plans] = await Promise.all([
    db().attendancePunch.findMany({
      where: { punchTime: { gte: from, lt: to }, employeeId: { not: null }, employee: employeeFilter },
      orderBy: { punchTime: "asc" },
      select: { punchTime: true, device: { select: { name: true } }, employeeId: true },
    }),
    attendanceRules(filters.toDate),
    dayPlans(people.map((e) => ({ id: e.id, officeId: e.officeId })), dayBefore, dayAfter),
  ]);
  const byId = new Map(employees.map((e) => [e.id, e]));

  // Punches per employee and local day.
  const days = new Map<string, { at: Date; device: string }[]>();
  for (const punch of punches) {
    if (!punch.employeeId || !byId.has(punch.employeeId)) continue;
    const key = `${punch.employeeId}:${dayKey.format(punch.punchTime)}`;
    days.set(key, [...(days.get(key) ?? []), { at: punch.punchTime, device: punch.device.name }]);
  }

  // Night calendars: the next morning's punches (until 4 h after the end, and
  // at least an hour before that day's own shift) belong to the night they started.
  const nextDay = (date: string) => new Date(Date.parse(`${date}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
  for (const e of people) {
    for (const date of [dayBefore, ...daysBetween(filters.fromDate, filters.toDate)]) {
      const plan = plans.get(`${e.id}:${date}`);
      if (plan?.kind !== "work" || !isOvernight(plan.calendar)) continue;
      const next = nextDay(date);
      const nextPlan = plans.get(`${e.id}:${next}`);
      let cutoff = Math.min(minutesOf(plan.calendar.endTime) + 240, 12 * 60);
      if (nextPlan?.kind === "work" && !isOvernight(nextPlan.calendar)) cutoff = Math.min(cutoff, minutesOf(nextPlan.calendar.startTime) - 60);
      const morning = days.get(`${e.id}:${next}`) ?? [];
      const moved = morning.filter((p) => minutesOf(hhmm.format(p.at)) <= cutoff);
      if (!moved.length) continue;
      days.set(`${e.id}:${date}`, [...(days.get(`${e.id}:${date}`) ?? []), ...moved]);
      const left = morning.filter((p) => !moved.includes(p));
      if (left.length) days.set(`${e.id}:${next}`, left);
      else days.delete(`${e.id}:${next}`);
    }
  }

  const today = dayKey.format(new Date());
  const rows: AttendanceRecord[] = [];
  for (const e of people) {
    for (const date of daysBetween(filters.fromDate, filters.toDate)) {
      const id = `${e.id}:${date}`;
      const times = days.get(id) ?? [];
      const plan = plans.get(id);
      // No punches: a row only for a planned day (working days once they have come).
      if (!times.length && (!plan || (plan.kind === "work" && date > today))) continue;
      const first = times[0];
      const last = times.length > 1 ? times[times.length - 1] : null;
      let status: AttendanceRecord["actualAttendance"];
      let remarks: string | null = times.length > 2 ? `${times.length} punches` : null;
      if (plan?.kind === "off") {
        status = "Offday";
        if (first) remarks = "Punched on an off day";
      } else if (plan?.kind === "holiday") {
        status = "Holiday";
        remarks = first ? `Punched on a holiday (${plan.title})` : plan.title;
      } else if (!first) {
        status = "Absent";
        remarks = "No punch";
      } else if (plan?.kind === "work") {
        status = calendarStatus(first.at, plan.calendar, ruleFor(rules, e.officeId, date));
      } else {
        status = statusOf(first.at, ruleFor(rules, e.officeId, date));
      }
      rows.push({
        id,
        sl: 0,
        employeeId: e.id,
        employeeCode: e.employeeCode,
        employeeName: e.name,
        designation: e.designation,
        department: e.department,
        departmentSection: e.departmentSection,
        date,
        day: weekday.format(new Date(`${date}T00:00:00Z`)),
        calendarName: calendarLabel(plan),
        inTime: first ? clock.format(first.at) : null,
        outTime: last ? clock.format(last.at) : null,
        inTimeLocation: first?.device ?? null,
        outTimeLocation: last?.device ?? null,
        actualAttendance: status,
        requestAttendance: null,
        remarks,
        lastActionBy: first ? "Device" : "Calendar",
        lastActionTime: null,
      });
    }
  }
  return { rows, plans };
}

/** The Calendar column: the calendar and its code, Weekly Off / Holiday, or Not assigned. */
function calendarLabel(plan: DayPlan | undefined): string {
  if (!plan) return "Not assigned";
  if (plan.kind === "off") return "Weekly Off";
  if (plan.kind === "holiday") return "Holiday";
  return `${plan.calendar.name} (${plan.calendar.shortCode})`;
}

/**
 * Present, Late or Absent against a calendar: Late after its grace time,
 * Absent after its last start time (the Atten Process rule fills a time the
 * calendar does not set). Night calendars compare times from 4 h before the
 * start, so 00:10 is later than 22:30.
 */
export function calendarStatus(firstPunch: Date, calendar: WorkCalendar, rule: { lateAfter: string; absentAfter: string }): "Present" | "Late" | "Absent" {
  const lateAfter = calendar.graceTime ?? rule.lateAfter;
  const absentAfter = calendar.lastStartTime ?? rule.absentAfter;
  const base = isOvernight(calendar) ? (minutesOf(calendar.startTime) - 240 + 1440) % 1440 : 0;
  const rel = (m: number) => (m - base + 1440) % 1440;
  const at = rel(minutesOf(hhmm.format(firstPunch)));
  if (at > rel(minutesOf(absentAfter))) return "Absent";
  if (at > rel(minutesOf(lateAfter))) return "Late";
  return "Present";
}

/**
 * One employee's attendance for a range: the same rows HR sees in Daily
 * Attendance (device punches, day plan, approved adjustments; pending ones
 * flagged), plus the day plans. Used by Employee Self Service.
 */
export async function employeeAttendance(employee: EmployeeOption, fromDate: string, toDate: string): Promise<{ rows: AttendanceRecord[]; plans: Map<string, DayPlan> }> {
  const filters: AttendanceFilterState = { fromDate, toDate, viewBy: "Employee", employeeId: employee.id, officeId: "ALL", status: "ALL", pageSize: 1, page: 1 };
  const { rows, plans } = await punchRecords(filters, [employee]);
  const merged = new Map(rows.map((r) => [r.id, r]));
  await applyAdjustments(merged, filters);
  for (const row of merged.values()) if (row.calendarName === "Not assigned") row.calendarName = calendarLabel(plans.get(row.id));
  return { rows: [...merged.values()].sort((a, b) => a.date.localeCompare(b.date)), plans };
}

export async function getDailyAttendance(filters: AttendanceFilterState): Promise<{
  records: AttendanceRecord[];
  totalRecords: number;
  employees: EmployeeOption[];
}> {
  // Checked before any query starts, so a rejected request leaves none running.
  validRange(filters);
  const allEmployees = await getAttendanceEmployees();
  const { rows: fromDevices, plans } = await punchRecords(filters, allEmployees);

  // Device and calendar rows, with manual adjustments applied (approved) or flagged (pending HR approval).
  const merged = new Map(fromDevices.map((r) => [r.id, r]));
  await applyAdjustments(merged, filters);
  // Rows added for an adjustment alone still show the day's calendar.
  for (const row of merged.values()) if (row.calendarName === "Not assigned") row.calendarName = calendarLabel(plans.get(row.id));
  let filtered = Array.from(merged.values());

  if (filters.employeeId && filters.employeeId !== "ALL") {
    filtered = filtered.filter(
      (r) => r.employeeId === filters.employeeId || r.employeeCode === filters.employeeId,
    );
  }

  if (filters.officeId && filters.officeId !== "ALL") {
    const inOffice = new Set(allEmployees.filter((e) => e.officeId === filters.officeId).map((e) => e.id));
    filtered = filtered.filter((r) => inOffice.has(r.employeeId));
  }

  // Department / section / designation: only rows of employees matching every chosen value.
  const wanted = ([
    ["department", filters.department],
    ["departmentSection", filters.departmentSection],
    ["designation", filters.designation],
  ] as const).filter(([, value]) => value && value !== "ALL");
  if (wanted.length > 0) {
    const allowed = new Set(allEmployees.filter((e) => wanted.every(([key, value]) => e[key] === value)).map((e) => e.id));
    filtered = filtered.filter((r) => allowed.has(r.employeeId));
  }

  if (filters.status && filters.status !== "ALL") {
    filtered = filtered.filter((r) => r.actualAttendance === filters.status);
  }

  if (filters.fromDate && filters.toDate) {
    filtered = filtered.filter(
      (r) => r.date >= filters.fromDate && r.date <= filters.toDate,
    );
  }

  filtered.sort((a, b) => b.date.localeCompare(a.date) || a.employeeCode.localeCompare(b.employeeCode));
  filtered = filtered.map((r, index) => ({ ...r, sl: index + 1 }));

  return {
    records: filtered,
    totalRecords: filtered.length,
    employees: allEmployees,
  };
}

// ─── Manual adjustments (HR approval) ─────────────────────────────────────────

/** Approval Setup feature (Configuration › Security › Approval Setup › HR & Payroll). */
export const ATTENDANCE_APPROVAL_FEATURE = "Employee Attendance";
export { ADJUSTABLE_STATUSES };

const isoDay = (value: Date) => value.toISOString().slice(0, 10);
const stamp = (value: Date) => `${dayKey.format(value)} ${clock.format(value)}`;

/**
 * Applies adjustments to the day's rows: the latest approved one sets the
 * status (and times); a pending one is shown as the requested status, waiting
 * for HR. A day with no punches gets a row when it has an adjustment.
 */
async function applyAdjustments(rows: Map<string, AttendanceRecord>, filters: AttendanceFilterState) {
  if (!validRange(filters)) return;
  const chosen = filters.employeeId && filters.employeeId !== "ALL" ? filters.employeeId : "";
  const adjustments = await db().attendanceAdjustment.findMany({
    where: {
      date: { gte: new Date(`${filters.fromDate}T00:00:00Z`), lte: new Date(`${filters.toDate}T00:00:00Z`) },
      status: { in: ["Pending", "Approved"] },
      ...(chosen ? { employee: { OR: [...(/^[0-9a-f-]{36}$/i.test(chosen) ? [{ id: chosen }] : []), { employeeCode: chosen }] } } : {}),
    },
    // Oldest first, so the newest approved and the newest pending win.
    orderBy: { createdAt: "asc" },
    include: { employee: { select: { id: true, employeeCode: true, name: true, designation: true, department: true, departmentSection: true } } },
  });

  for (const a of adjustments) {
    const date = isoDay(a.date);
    const id = `${a.employeeId}:${date}`;
    const row: AttendanceRecord = rows.get(id) ?? {
      id,
      sl: 0,
      employeeId: a.employee.id,
      employeeCode: a.employee.employeeCode,
      employeeName: a.employee.name,
      designation: a.employee.designation || "",
      department: a.employee.department || "",
      departmentSection: a.employee.departmentSection || "",
      date,
      day: weekday.format(new Date(`${date}T00:00:00Z`)),
      calendarName: "Not assigned",
      inTime: null,
      outTime: null,
      inTimeLocation: null,
      outTimeLocation: null,
      actualAttendance: "Absent",
      requestAttendance: null,
      remarks: null,
      lastActionBy: null,
      lastActionTime: null,
    };
    if (a.status === "Approved") {
      Object.assign(row, {
        actualAttendance: a.requestedStatus as AttendanceRecord["actualAttendance"],
        inTime: a.inTime ?? row.inTime,
        outTime: a.outTime ?? row.outTime,
        remarks: a.remarks ?? row.remarks,
        requestAttendance: `${a.requestedStatus} (Approved)`,
        adjustmentId: a.id,
        adjustmentStatus: "Approved",
        lastActionBy: a.decidedByName ?? "HR",
        lastActionTime: a.decidedAt ? stamp(a.decidedAt) : null,
      });
    } else {
      // Pending: the status is unchanged until HR approves.
      Object.assign(row, {
        requestAttendance: `${a.requestedStatus} (Pending HR approval)`,
        adjustmentId: a.id,
        adjustmentStatus: "Pending",
        lastActionBy: a.createdByName ?? row.lastActionBy,
        lastActionTime: stamp(a.createdAt),
      });
    }
    rows.set(id, row);
  }
}

export interface AttendanceAdjustmentInput {
  employeeId: string;
  date: string;
  requestedStatus: string;
  inTime?: string | null;
  outTime?: string | null;
  remarks?: string | null;
  originalStatus?: string | null;
}

/**
 * Submits a manual adjustment for HR approval. A pending request for the same
 * employee and day is replaced (its approval progress starts over).
 */
export async function submitAttendanceAdjustment(
  actor: Actor,
  input: AttendanceAdjustmentInput,
) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date) || Number.isNaN(Date.parse(input.date))) throw badRequest("Choose a valid date.");
  if (!(ADJUSTABLE_STATUSES as readonly string[]).includes(input.requestedStatus)) throw badRequest("Choose a valid attendance status.");
  const employee = await db().employee.findFirst({ where: { ...employeeScope(actor), id: input.employeeId }, select: { id: true } });
  if (!employee) throw notFound("Employee");

  const text = (value: string | null | undefined, max: number) => (value?.trim() ? value.trim().slice(0, max) : null);
  const data = {
    requestedStatus: input.requestedStatus,
    originalStatus: text(input.originalStatus, 20),
    inTime: text(input.inTime, 20),
    outTime: text(input.outTime, 20),
    remarks: text(input.remarks, 500),
    createdById: actorUserId(actor),
    createdByName: (actor.name ?? "ERP User").slice(0, 150),
  };
  const date = new Date(`${input.date}T00:00:00Z`);

  return db().$transaction(async (tx) => {
    const pending = await tx.attendanceAdjustment.findFirst({ where: { employeeId: employee.id, date, status: "Pending" }, select: { id: true } });
    if (pending) {
      await resetApproval(tx, ATTENDANCE_APPROVAL_FEATURE, pending.id);
      return tx.attendanceAdjustment.update({ where: { id: pending.id }, data });
    }
    return tx.attendanceAdjustment.create({ data: { ...data, employeeId: employee.id, date } });
  });
}

export interface AttendanceAdjustmentRow {
  id: string;
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  date: string;
  originalStatus: string | null;
  requestedStatus: string;
  inTime: string | null;
  outTime: string | null;
  remarks: string | null;
  status: string;
  requestedBy: string | null;
  requestedAt: string;
}

export async function listAttendanceAdjustments(actor: Actor, status?: string): Promise<AttendanceAdjustmentRow[]> {
  const rows = await db().attendanceAdjustment.findMany({
    where: { ...(status ? { status } : {}), employee: employeeScope(actor) },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    take: 500,
    include: { employee: { select: { employeeCode: true, name: true } } },
  });
  return rows.map((a) => ({
    id: a.id,
    employeeId: a.employeeId,
    employeeCode: a.employee.employeeCode,
    employeeName: a.employee.name,
    date: isoDay(a.date),
    originalStatus: a.originalStatus,
    requestedStatus: a.requestedStatus,
    inTime: a.inTime,
    outTime: a.outTime,
    remarks: a.remarks,
    status: a.status,
    requestedBy: a.createdByName,
    requestedAt: a.createdAt.toISOString(),
  }));
}

/** HR approves or rejects a pending adjustment, through the "Employee Attendance" pipeline when one is set up. */
export async function decideAttendanceAdjustment(
  actor: Actor,
  id: string,
  status: "Approved" | "Rejected",
) {
  const adjustment = await db().attendanceAdjustment.findFirst({ where: { id, employee: employeeScope(actor) }, select: { id: true, status: true, employeeId: true, date: true } });
  if (!adjustment) throw notFound("Attendance adjustment");
  if (adjustment.status !== "Pending") throw conflict("This adjustment has already been decided.");
  const target = { feature: ATTENDANCE_APPROVAL_FEATURE, documentId: id, businessUnitId: await employeeBusinessUnit(adjustment.employeeId) };
  const result = await decideWithPipeline(actor, target, status === "Approved" ? "approve" : "reject", async (tx) => {
    const { count } = await tx.attendanceAdjustment.updateMany({
      where: { id, status: "Pending" },
      data: { status, decidedByName: (actor.name ?? "Administrator").slice(0, 150), decidedAt: new Date() },
    });
    if (!count) throw conflict("This adjustment has already been decided.");
  });
  // The employee hears about the outcome of a change to their attendance.
  if (status === "Rejected" || result?.final) {
    await notifyEmployees([adjustment.employeeId], { kind: "attendance", title: `Attendance correction ${status.toLowerCase()}`, body: `Your attendance for ${isoDay(adjustment.date)} was ${status.toLowerCase()} by ${actor.name ?? "HR"}.`, link: "/employee/attendance-corrections" });
  }
}

/** Withdraws pending adjustments (the page's "clear" action); decided ones are kept for the record. */
export async function withdrawPendingAdjustments(actor: Actor) {
  const pending = await db().attendanceAdjustment.findMany({ where: { status: "Pending", employee: employeeScope(actor) }, select: { id: true } });
  if (pending.length === 0) return 0;
  await db().$transaction(async (tx) => {
    for (const p of pending) await resetApproval(tx, ATTENDANCE_APPROVAL_FEATURE, p.id);
    await tx.attendanceAdjustment.deleteMany({ where: { id: { in: pending.map((p) => p.id) } } });
  });
  return pending.length;
}

// ─── Employee Self Service: an employee's own attendance change requests ─────

/** How far back an employee may ask for a change. */
export const SELF_REQUEST_DAYS = 60;

async function ownEmployee(actor: Actor) {
  const userId = actorUserId(actor);
  const employee = userId ? await db().employee.findFirst({ where: { userId }, orderBy: { isActive: "desc" }, select: { id: true } }) : null;
  if (!employee) throw new AppError(403, "FORBIDDEN", "No employee record is linked to your account. Ask HR to link your login to your employee record.");
  return employee;
}

/** "09:05" → "09:05 AM" (the attendance table's format); other text is kept. */
const to12hClock = (value: string | null | undefined) => {
  const match = value?.trim().match(/^([01]\d|2[0-3]):([0-5]\d)$/);
  if (!match) return value?.trim() || null;
  const h = Number(match[1]);
  return `${String(((h + 11) % 12) + 1).padStart(2, "0")}:${match[2]} ${h < 12 ? "AM" : "PM"}`;
};

/** The signed-in employee's attendance row for one day (null when there is none). */
export async function myAttendanceDay(actor: Actor, date: string): Promise<AttendanceRecord | null> {
  const own = await ownEmployee(actor);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw badRequest("Choose a valid date.");
  const { records } = await getDailyAttendance({ fromDate: date, toDate: date, viewBy: "Employee", employeeId: own.id, officeId: "ALL", status: "ALL", pageSize: 1, page: 1 });
  return records[0] ?? null;
}

/** The signed-in employee's own requests, newest first. */
export async function myAttendanceRequests(actor: Actor): Promise<AttendanceAdjustmentRow[]> {
  const own = await ownEmployee(actor);
  const rows = await db().attendanceAdjustment.findMany({
    where: { employeeId: own.id },
    orderBy: [{ createdAt: "desc" }],
    take: 200,
    include: { employee: { select: { employeeCode: true, name: true } } },
  });
  return rows.map((a) => ({
    id: a.id,
    employeeId: a.employeeId,
    employeeCode: a.employee.employeeCode,
    employeeName: a.employee.name,
    date: isoDay(a.date),
    originalStatus: a.originalStatus,
    requestedStatus: a.requestedStatus,
    inTime: a.inTime,
    outTime: a.outTime,
    remarks: a.remarks,
    status: a.status,
    requestedBy: a.createdByName,
    requestedAt: a.createdAt.toISOString(),
  }));
}

export interface OwnAttendanceRequestInput {
  date: string;
  requestedStatus: string;
  inTime?: string | null;
  outTime?: string | null;
  reason: string;
}

/**
 * An employee asks to change their own attendance for a past or current day.
 * The current status is read here (never taken from the request), and the
 * change waits for HR in Pending Approval › Attendance, through the
 * "Employee Attendance" pipeline of Approval Setup.
 */
export async function requestOwnAttendanceChange(actor: Actor, input: OwnAttendanceRequestInput) {
  const own = await ownEmployee(actor);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date) || Number.isNaN(Date.parse(input.date))) throw badRequest("Choose a valid date.");
  const today = dayKey.format(new Date());
  if (input.date > today) throw badRequest("You can only ask to change today or an earlier day.");
  const earliest = new Date(Date.parse(`${today}T00:00:00Z`) - SELF_REQUEST_DAYS * 86_400_000).toISOString().slice(0, 10);
  if (input.date < earliest) throw badRequest(`You can only ask to change the last ${SELF_REQUEST_DAYS} days.`);
  if (!input.reason?.trim()) throw badRequest("Enter the reason for the change.");
  const current = await myAttendanceDay(actor, input.date);
  const inTime = to12hClock(input.inTime);
  const outTime = to12hClock(input.outTime);
  if (current && current.actualAttendance === input.requestedStatus && !inTime && !outTime) {
    throw badRequest(`Your attendance on this day is already ${input.requestedStatus}.`);
  }
  return submitAttendanceAdjustment(actor, {
    employeeId: own.id,
    date: input.date,
    requestedStatus: input.requestedStatus,
    inTime,
    outTime,
    remarks: input.reason,
    originalStatus: current?.actualAttendance ?? null,
  });
}

/** Withdraws one of the employee's own pending requests. */
export async function withdrawOwnAttendanceRequest(actor: Actor, id: string) {
  const own = await ownEmployee(actor);
  const request = await db().attendanceAdjustment.findFirst({ where: { id, employeeId: own.id }, select: { id: true, status: true } });
  if (!request) throw notFound("Attendance request");
  if (request.status !== "Pending") throw conflict("Only a pending request can be withdrawn.");
  await db().$transaction(async (tx) => {
    await resetApproval(tx, ATTENDANCE_APPROVAL_FEATURE, id);
    await tx.attendanceAdjustment.delete({ where: { id } });
  });
}
