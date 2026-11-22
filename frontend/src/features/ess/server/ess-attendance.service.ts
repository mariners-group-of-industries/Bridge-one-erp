import { badRequest } from "@/lib/api/errors";
import type { Actor } from "@/lib/auth/actor";
import { db } from "@/lib/prisma/client";
import { SELF_REQUEST_DAYS, dayKey, employeeAttendance, myAttendanceRequests } from "@/features/hrm/attendance/services/attendance.service";
import { daysBetween, minutesOf, type DayPlan } from "@/features/hrm/attendance/services/day-plan.service";
import type { AttendanceRecord, EmployeeOption } from "@/features/hrm/attendance/types";
import { payrollPeriodOfMonth, payrollPeriodOn } from "@/features/hrm/payroll/server/payroll-inputs";
import { policiesInForce } from "@/features/hrm/self-service/leave-movement/server/leave-policy";
import type { EssAttendanceMonth, EssAttendanceSummary, EssCalendarDay, EssCalendarMonth, EssCorrection, EssDay, EssDayDetail, EssDayStatus, EssPayrollRef } from "../types";
import { requireSelf, type SelfEmployee } from "./identity";

/**
 * Employee Self Service › attendance and calendar. Everything is read through
 * the HRM attendance service (the same rows HR sees in Daily Attendance) and
 * the day plan (Calendar Assign, Holidays, Off Day, Roster); nothing here
 * recalculates attendance from punches on its own.
 */

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
/** Longest custom range (the attendance service's own limit). */
const MAX_RANGE_DAYS = 93;
const weekday = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", weekday: "short" });
const record = (v: unknown) => (v && typeof v === "object" ? (v as Record<string, unknown>) : {});
const num = (v: unknown) => (typeof v === "number" ? v : typeof v === "string" && v.trim() ? Number(v) : NaN);
const truthy = (v: unknown) => v === true || v === "true" || v === "Yes";

export const today = () => dayKey.format(new Date());

export function monthRange(month: string): { from: string; to: string } {
  if (!MONTH.test(month)) throw badRequest("Choose a valid month.");
  const [y, m] = month.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { from: `${month}-01`, to: `${month}-${String(last).padStart(2, "0")}` };
}

const asOption = (self: SelfEmployee): EmployeeOption => ({
  id: self.id,
  employeeCode: self.code,
  name: self.name,
  designation: self.designation ?? "",
  department: self.department ?? "",
  departmentSection: self.departmentSection ?? "",
  officeId: self.officeId,
  officeName: self.officeName,
});

/** "09:05 AM" → minutes after midnight. */
function clockMinutes(value: string | null): number | null {
  const m = value?.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!m) return null;
  const h = (Number(m[1]) % 12) + (m[3].toUpperCase() === "PM" ? 12 : 0);
  return h * 60 + Number(m[2]);
}

const STATUS: Record<AttendanceRecord["actualAttendance"], EssDayStatus> = { Present: "Present", Late: "Late", Absent: "Absent", Offday: "Weekly Off", Holiday: "Holiday", Leave: "Leave" };

interface Rules {
  late: EssAttendanceSummary["lateRule"];
  deductAbsent: boolean;
}

async function deductionRules(officeId: string, date: string): Promise<Rules> {
  const [late, payroll] = await Promise.all([policiesInForce("late-punishment", officeId, date), policiesInForce("payroll-rules", officeId, date)]);
  const l = late[0] ? record(late[0].data) : null;
  const latesAllowed = l ? num(l.latesAllowed) : NaN;
  const deductionDays = l ? num(l.deductionDays) : NaN;
  return {
    late: l && latesAllowed > 0 && deductionDays > 0 ? { latesAllowed, deductionDays, deductFrom: typeof l.deductFrom === "string" ? l.deductFrom : "Salary" } : null,
    deductAbsent: payroll[0] ? truthy(record(payroll[0].data).deductAbsentDays) : false,
  };
}

interface LeaveOnDay {
  leaveType: string;
  status: string;
}

async function leavesByDay(employeeId: string, from: string, to: string): Promise<Map<string, LeaveOnDay>> {
  const leaves = await db().leaveApplication.findMany({
    where: { employeeId, status: { in: ["Approved", "Pending"] }, fromDate: { lte: new Date(`${to}T00:00:00Z`) }, toDate: { gte: new Date(`${from}T00:00:00Z`) } },
    select: { leaveType: true, status: true, fromDate: true, toDate: true },
    orderBy: { createdAt: "asc" },
  });
  const out = new Map<string, LeaveOnDay>();
  for (const l of leaves) {
    for (const date of daysBetween(l.fromDate.toISOString().slice(0, 10), l.toDate.toISOString().slice(0, 10))) {
      // An approved leave wins over a pending one on the same day.
      if (out.get(date)?.status !== "Approved") out.set(date, { leaveType: l.leaveType, status: l.status });
    }
  }
  return out;
}

const shiftOf = (plan: DayPlan | undefined) => (!plan ? null : plan.kind === "off" ? "Weekly Off" : plan.kind === "holiday" ? "Holiday" : `${plan.calendar.name} (${plan.calendar.shortCode})`);

/**
 * The employee's days in the range, one per date from joining (or the range
 * start) to termination (or the range end). Today's figures are provisional; a
 * working day without a punch today is Pending, not Absent.
 */
async function buildDays(self: SelfEmployee, from: string, to: string) {
  const start = from < self.joiningDate ? self.joiningDate : from;
  const end = self.terminationDate && self.terminationDate < to ? self.terminationDate : to;
  if (start > end) return { days: [] as EssDay[], plans: new Map<string, DayPlan>(), leaves: new Map<string, LeaveOnDay>(), rules: await deductionRules(self.officeId, to) };
  const now = today();
  const [{ rows, plans }, leaves, rules] = await Promise.all([employeeAttendance(asOption(self), start, end), leavesByDay(self.id, start, end), deductionRules(self.officeId, end)]);
  const byDate = new Map(rows.map((r) => [r.date, r]));
  let lates = 0;
  const days: EssDay[] = daysBetween(start, end).map((date) => {
    const plan = plans.get(`${self.id}:${date}`);
    const row = byDate.get(date);
    const leave = leaves.get(date);
    const approvedLeave = leave?.status === "Approved" ? leave : null;
    const scheduled = plan?.kind === "work" ? plan.calendar : null;
    let status: EssDayStatus;
    if (date > now) status = plan?.kind === "off" ? "Weekly Off" : plan?.kind === "holiday" ? "Holiday" : approvedLeave ? "Leave" : "Upcoming";
    else if (row) {
      status = STATUS[row.actualAttendance];
      // Approved leave covers a working day without attendance.
      if (status === "Absent" && approvedLeave && !row.inTime) status = "Leave";
      // Today is not over: no punch yet is not an absence.
      if (date === now && status === "Absent" && !row.inTime && row.adjustmentStatus !== "Approved") status = "Pending";
    } else status = approvedLeave ? "Leave" : "No Schedule";

    const inMin = clockMinutes(row?.inTime ?? null);
    const outMin = clockMinutes(row?.outTime ?? null);
    const startMin = scheduled ? minutesOf(scheduled.startTime) : null;
    const endMin = scheduled ? minutesOf(scheduled.endTime) : null;
    const overnight = startMin !== null && endMin !== null && endMin <= startMin;
    const lateMinutes = status === "Late" && inMin !== null && startMin !== null ? (inMin - startMin + 1440) % 1440 : null;
    const workedMinutes = inMin !== null && outMin !== null ? (outMin - inMin + 1440) % 1440 : null;
    const earlyLeaveMinutes = !overnight && outMin !== null && endMin !== null && outMin < endMin && date < now ? endMin - outMin : null;

    let deduction: string | null = null;
    if (status === "Absent" && rules.deductAbsent && date < now) deduction = "1 day's salary";
    if (status === "Late" && rules.late) {
      lates += 1;
      deduction = lates % rules.late.latesAllowed === 0 ? `${rules.late.deductionDays} day(s) from ${rules.late.deductFrom}` : `Late ${lates % rules.late.latesAllowed} of ${rules.late.latesAllowed}`;
    }

    return {
      date,
      day: weekday.format(new Date(`${date}T00:00:00Z`)),
      shift: shiftOf(plan),
      scheduledIn: scheduled?.startTime ?? null,
      scheduledOut: scheduled?.endTime ?? null,
      actualIn: row?.inTime ?? null,
      actualOut: row?.outTime ?? null,
      lateMinutes,
      earlyLeaveMinutes,
      workedMinutes,
      status,
      provisional: date === now,
      remarks: row?.remarks ?? null,
      leaveType: status === "Leave" ? (approvedLeave?.leaveType ?? null) : null,
      holidayTitle: plan?.kind === "holiday" ? plan.title : null,
      correction: row?.adjustmentStatus ?? null,
      deduction,
    };
  });
  return { days, plans, leaves, rules };
}

function summarize(days: EssDay[], rules: Rules): EssAttendanceSummary {
  const count = (s: EssDayStatus) => days.filter((d) => d.status === s).length;
  const present = count("Present");
  const late = count("Late");
  const absent = count("Absent");
  const leave = count("Leave");
  const attended = present + late + leave;
  const counted = attended + absent;
  return {
    workingDays: days.filter((d) => d.scheduledIn !== null || d.status === "Present" || d.status === "Late" || d.status === "Absent" || d.status === "Leave" || d.status === "Pending").length,
    present,
    late,
    absent,
    leave,
    weeklyOff: count("Weekly Off"),
    holidays: count("Holiday"),
    pending: count("Pending"),
    lateRule: rules.late,
    lateDeductionDays: rules.late ? Math.floor(late / rules.late.latesAllowed) * rules.late.deductionDays : 0,
    absentDeductionDays: rules.deductAbsent ? days.filter((d) => d.status === "Absent" && d.deduction).length : null,
    attendanceRate: counted ? Math.round((attended / counted) * 1000) / 10 : null,
  };
}

/** The published payslip line of `month`, for the actual attendance deduction. */
async function publishedPayroll(employeeId: string, month: string): Promise<EssPayrollRef | null> {
  const line = await db().payrollBatchLine.findFirst({
    where: { employeeId, batch: { month, status: "Approved", payslipsPublishedAt: { not: null } } },
    orderBy: { batch: { payrollDate: "desc" } },
    select: { attendanceDeduction: true, netPayable: true, batch: { select: { reference: true, month: true } } },
  });
  return line ? { reference: line.batch.reference, month: line.batch.month, attendanceDeduction: Number(line.attendanceDeduction), netPayable: Number(line.netPayable) } : null;
}

export interface AttendanceQuery {
  month?: string | null;
  from?: string | null;
  to?: string | null;
  status?: string | null;
}

/**
 * My Attendance: a payroll month or a custom range, optionally one status.
 * A month is its payroll period (21st – 20th unless the Payroll Rule says
 * otherwise); without one, the period that contains today. Future days are left out.
 */
export async function myAttendance(actor: Actor, query: AttendanceQuery): Promise<EssAttendanceMonth> {
  const self = await requireSelf(actor);
  let from: string;
  let to: string;
  let month: string;
  if (query.from || query.to) {
    if (!query.from || !query.to || !DAY.test(query.from) || !DAY.test(query.to) || query.from > query.to) throw badRequest("Choose a valid date range.");
    if (daysBetween(query.from, query.to).length > MAX_RANGE_DAYS) throw badRequest(`Choose at most ${MAX_RANGE_DAYS} days at a time.`);
    ({ from, to } = { from: query.from, to: query.to });
    month = from.slice(0, 7);
  } else {
    if (query.month && !MONTH.test(query.month)) throw badRequest("Choose a valid month.");
    const period = query.month ? await payrollPeriodOfMonth(self.officeId, query.month) : await payrollPeriodOn(self.officeId, today());
    ({ month, fromDate: from, toDate: to } = period);
  }
  const { days, rules } = await buildDays(self, from, to);
  const past = days.filter((d) => d.status !== "Upcoming" && d.date <= today());
  const wanted = query.status && query.status !== "ALL" ? past.filter((d) => d.status === query.status) : past;
  return { month, from, to, summary: summarize(past, rules), days: wanted.reverse(), payroll: await publishedPayroll(self.id, month) };
}

/**
 * The current payroll period's summary and today's row, for the dashboard. The
 * period follows the office's Payroll Rule (21st – 20th by default), so lates
 * and deductions count over the same days as the salary.
 */
export async function attendanceSnapshot(self: SelfEmployee) {
  const now = today();
  const period = await payrollPeriodOn(self.officeId, now);
  const { month, fromDate: from, toDate: to } = period;
  const { days, rules, plans, leaves } = await buildDays(self, from, to);
  const todayRow =
    days.find((d) => d.date === now) ??
    ({
      date: now,
      day: weekday.format(new Date(`${now}T00:00:00Z`)),
      shift: shiftOf(plans.get(`${self.id}:${now}`)),
      scheduledIn: null,
      scheduledOut: null,
      actualIn: null,
      actualOut: null,
      lateMinutes: null,
      earlyLeaveMinutes: null,
      workedMinutes: null,
      status: "No Schedule",
      provisional: true,
      remarks: null,
      leaveType: null,
      holidayTitle: null,
      correction: null,
      deduction: null,
    } satisfies EssDay);
  return { month, from, to, summary: summarize(days.filter((d) => d.date <= now), rules), today: todayRow, days, plans, leaves };
}

/** One day in detail, with the raw device punches of that day. */
export async function myAttendanceDay(actor: Actor, date: string): Promise<EssDayDetail> {
  const self = await requireSelf(actor);
  if (!DAY.test(date) || Number.isNaN(Date.parse(date))) throw badRequest("Choose a valid date.");
  const { days, plans } = await buildDays(self, date, date);
  const day = days[0];
  if (!day) throw badRequest(date < self.joiningDate ? `You joined on ${self.joiningDate}; there is no attendance before that.` : "There is no attendance for this day.");
  const plan = plans.get(`${self.id}:${date}`);
  const window = { gte: new Date(Date.parse(`${date}T00:00:00Z`) - 86_400_000), lt: new Date(Date.parse(`${date}T00:00:00Z`) + 2 * 86_400_000) };
  const clock = new Intl.DateTimeFormat("en-US", { timeZone: process.env.APP_TIMEZONE || "Asia/Dhaka", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true });
  const [punches, requests] = await Promise.all([
    db().attendancePunch.findMany({ where: { employeeId: self.id, punchTime: window }, orderBy: { punchTime: "asc" }, select: { punchTime: true, device: { select: { name: true } } } }),
    db().attendanceAdjustment.findMany({ where: { employeeId: self.id, date: new Date(`${date}T00:00:00Z`) }, orderBy: { createdAt: "desc" } }),
  ]);
  const now = today();
  const earliest = new Date(Date.parse(`${now}T00:00:00Z`) - SELF_REQUEST_DAYS * 86_400_000).toISOString().slice(0, 10);
  const processing =
    day.status === "Upcoming"
      ? "This day has not come yet."
      : day.correction === "Approved"
        ? "Adjusted by HR (approved correction)."
        : day.provisional
          ? "Provisional: today's attendance is still being recorded and may change."
          : day.status === "No Schedule"
            ? "Attendance is pending processing: no schedule or punch is recorded for this day."
            : day.actualIn
              ? "Processed from device punches."
              : "Processed from your work calendar (no punch recorded).";
  return {
    day,
    calendar: plan?.kind === "work" ? { name: plan.calendar.name, code: plan.calendar.shortCode, start: plan.calendar.startTime, end: plan.calendar.endTime, graceTime: plan.calendar.graceTime, lastStartTime: plan.calendar.lastStartTime } : null,
    punches: punches.filter((p) => dayKey.format(p.punchTime) === date).map((p) => ({ time: clock.format(p.punchTime), device: p.device.name })),
    processing,
    requests: requests.map(toCorrection),
    canRequestCorrection: self.canApply && date <= now && date >= earliest,
  };
}

/** My Calendar: the month's plan, leave and (for past days) attendance status. */
export async function myCalendar(actor: Actor, month: string): Promise<EssCalendarMonth> {
  const self = await requireSelf(actor);
  const { from, to } = monthRange(month || today().slice(0, 7));
  const { days, plans, leaves } = await buildDays(self, from, to);
  const byDate = new Map(days.map((d) => [d.date, d]));
  const out: EssCalendarDay[] = daysBetween(from, to).map((date) => {
    const plan = plans.get(`${self.id}:${date}`);
    const leave = leaves.get(date);
    const d = byDate.get(date);
    return {
      date,
      day: weekday.format(new Date(`${date}T00:00:00Z`)),
      kind: plan?.kind ?? "none",
      shift: shiftOf(plan),
      start: plan?.kind === "work" ? plan.calendar.startTime : null,
      end: plan?.kind === "work" ? plan.calendar.endTime : null,
      holidayTitle: plan?.kind === "holiday" ? plan.title : null,
      leave: leave ? { type: leave.leaveType, status: leave.status } : null,
      status: d ? d.status : null,
    };
  });
  return { month: from.slice(0, 7), days: out, holidays: out.filter((d) => d.holidayTitle).map((d) => ({ date: d.date, title: d.holidayTitle! })) };
}

export function toCorrection(a: { id: string; date: Date; originalStatus: string | null; requestedStatus: string; inTime: string | null; outTime: string | null; remarks: string | null; status: string; createdAt: Date }): EssCorrection {
  return {
    id: a.id,
    date: a.date.toISOString().slice(0, 10),
    originalStatus: a.originalStatus,
    requestedStatus: a.requestedStatus,
    inTime: a.inTime,
    outTime: a.outTime,
    reason: a.remarks,
    status: a.status,
    requestedAt: a.createdAt.toISOString(),
  };
}

/** The employee's correction requests (the HRM service resolves the employee from the session too). */
export async function myCorrections(actor: Actor): Promise<EssCorrection[]> {
  await requireSelf(actor);
  return (await myAttendanceRequests(actor)).map((r) => ({
    id: r.id,
    date: r.date,
    originalStatus: r.originalStatus,
    requestedStatus: r.requestedStatus,
    inTime: r.inTime,
    outTime: r.outTime,
    reason: r.remarks,
    status: r.status,
    requestedAt: r.requestedAt,
  }));
}
