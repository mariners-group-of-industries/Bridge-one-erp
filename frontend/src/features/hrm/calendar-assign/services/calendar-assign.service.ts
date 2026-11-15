import { badRequest } from "@/lib/api/errors";
import type { Actor } from "@/lib/auth/actor";
import { db } from "@/lib/prisma/client";
import { calendarForCode, daysBetween, HOLIDAY_CODE, OFF_CODE, workCalendars } from "../../attendance/services/day-plan.service";
import { employeeScope } from "../../shared/hr-access";
import type {
  CalendarDefinition,
  EmployeeRosterItem,
  EmployeeFilterOption,
  PaginationMeta,
  RosterGridData,
} from "../types";

export interface CalendarAssignMeta {
  offices: string[];
  departments: string[];
  departmentSections: string[];
  designations: string[];
  employeeOptions: EmployeeFilterOption[];
}

export interface CalendarAssignParams {
  office?: string;
  department?: string;
  departmentSection?: string;
  designation?: string;
  employeeId?: string;
  search?: string;
  page?: number;
  limit?: number;
  skipEmployees?: boolean;
}

export async function getCalendarAssignData(params?: CalendarAssignParams): Promise<{
  options: CalendarAssignMeta;
  employees: EmployeeRosterItem[];
  pagination: PaginationMeta;
}> {
  // 1. Fetch real filter options from DB
  const [
    offices,
    departmentsRaw,
    sectionsRaw,
    prodSections,
    designationsRaw,
    allEmployeesRaw,
  ] = await Promise.all([
    db().office.findMany({
      select: { name: true },
      orderBy: { name: "asc" },
    }),
    db().employee.findMany({
      distinct: ["department"],
      where: { department: { not: null }, isActive: true },
      select: { department: true },
      orderBy: { department: "asc" },
    }),
    db().employee.findMany({
      distinct: ["departmentSection"],
      where: { departmentSection: { not: null }, isActive: true },
      select: { departmentSection: true },
      orderBy: { departmentSection: "asc" },
    }),
    db().productionDepartmentSection.findMany({
      select: { name: true },
      orderBy: { name: "asc" },
    }),
    db().employee.findMany({
      distinct: ["designation"],
      where: { designation: { not: null }, isActive: true },
      select: { designation: true },
      orderBy: { designation: "asc" },
    }),
    db().employee.findMany({
      where: { isActive: true },
      select: {
        id: true,
        employeeCode: true,
        name: true,
        office: { select: { name: true } },
        department: true,
      },
      orderBy: [{ employeeCode: "asc" }],
      take: 500,
    }),
  ]);

  // Combine real department sections from both employee records and production sections
  const combinedSections = Array.from(
    new Set([
      ...sectionsRaw.map((s) => s.departmentSection).filter((s): s is string => Boolean(s)),
      ...prodSections.map((p) => p.name).filter(Boolean),
    ]),
  ).sort();

  // 2. Build where filter for real employees
  const where: any = { isActive: true };
  if (params?.office) where.office = { name: params.office };
  if (params?.department) where.department = params.department;
  if (params?.departmentSection) where.departmentSection = params.departmentSection;
  if (params?.designation) where.designation = params.designation;
  if (params?.employeeId) where.id = params.employeeId;
  if (params?.search) {
    where.OR = [
      { employeeCode: { contains: params.search, mode: "insensitive" } },
      { name: { contains: params.search, mode: "insensitive" } },
      { attendanceId: { contains: params.search, mode: "insensitive" } },
    ];
  }

  // 3. Pagination calculation
  const page = Math.max(1, params?.page || 1);
  const limit = Math.min(100, Math.max(10, params?.limit || 40));
  const skip = (page - 1) * limit;

  let employees: EmployeeRosterItem[] = [];
  let totalEmployees = 0;

  // Only query employee roster records when not skipped
  if (!params?.skipEmployees) {
    const [total, rawEmployees] = await Promise.all([
      db().employee.count({ where }),
      db().employee.findMany({
        where,
        select: {
          id: true,
          employeeCode: true,
          attendanceId: true,
          name: true,
          designation: true,
          department: true,
          departmentSection: true,
          office: { select: { name: true } },
        },
        orderBy: [{ employeeCode: "asc" }],
        skip,
        take: limit,
      }),
    ]);

    totalEmployees = total;
    employees = rawEmployees.map((e) => ({
      id: e.id,
      employeeCode: e.employeeCode,
      attendanceId: e.attendanceId || e.employeeCode,
      name: e.name,
      officeName: e.office?.name || "",
      department: e.department || "",
      departmentSection: e.departmentSection || "",
      designation: e.designation || "",
    }));
  }

  return {
    options: {
      offices: offices.map((o) => o.name),
      departments: departmentsRaw.map((d) => d.department!).filter(Boolean),
      departmentSections: combinedSections,
      designations: designationsRaw.map((d) => d.designation!).filter(Boolean),
      employeeOptions: allEmployeesRaw.map((e) => ({
        id: e.id,
        employeeCode: e.employeeCode,
        name: e.name,
        officeName: e.office?.name || "",
        department: e.department || "",
      })),
    },
    employees,
    pagination: {
      page,
      limit,
      total: totalEmployees,
      totalPages: Math.ceil(totalEmployees / limit) || 1,
      hasMore: skip + employees.length < totalEmployees,
    },
  };
}

// ─── Calendars (HR Governance › Calendar Setup) and saved days ───────────────

const BADGES = [
  ["bg-blue-100 dark:bg-blue-950/70", "text-blue-700 dark:text-blue-300", "border-blue-300 dark:border-blue-800"],
  ["bg-emerald-100 dark:bg-emerald-950/70", "text-emerald-700 dark:text-emerald-300", "border-emerald-300 dark:border-emerald-800"],
  ["bg-amber-100 dark:bg-amber-950/70", "text-amber-700 dark:text-amber-300", "border-amber-300 dark:border-amber-800"],
  ["bg-indigo-100 dark:bg-indigo-950/70", "text-indigo-700 dark:text-indigo-300", "border-indigo-300 dark:border-indigo-800"],
  ["bg-teal-100 dark:bg-teal-950/70", "text-teal-700 dark:text-teal-300", "border-teal-300 dark:border-teal-800"],
  ["bg-violet-100 dark:bg-violet-950/70", "text-violet-700 dark:text-violet-300", "border-violet-300 dark:border-violet-800"],
  ["bg-cyan-100 dark:bg-cyan-950/70", "text-cyan-700 dark:text-cyan-300", "border-cyan-300 dark:border-cyan-800"],
  ["bg-rose-100 dark:bg-rose-950/70", "text-rose-700 dark:text-rose-300", "border-rose-300 dark:border-rose-800"],
] as const;

/** "13:05" → "1:05 PM"; "-" when unset. */
const to12h = (hhmm: string | null) => {
  if (!hhmm) return "-";
  const [h, m] = hhmm.split(":").map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
};

const SPECIAL_CALENDARS: CalendarDefinition[] = [
  { id: "special-off", office: "All", calendarName: "Weekly Off", shortCode: OFF_CODE, startTime: "-", endTime: "-", minWorkHour: 0, lastStartTime: "-", graceTime: "-", minInTime: "-", maxOutTime: "-", breakStartTime: "-", breakEndTime: "-", badgeBg: "bg-red-50 dark:bg-red-950/50", badgeText: "text-red-600 dark:text-red-400 font-bold", badgeBorder: "border-red-200 dark:border-red-900" },
  { id: "special-hol", office: "All", calendarName: "Holiday", shortCode: HOLIDAY_CODE, startTime: "-", endTime: "-", minWorkHour: 0, lastStartTime: "-", graceTime: "-", minInTime: "-", maxOutTime: "-", breakStartTime: "-", breakEndTime: "-", badgeBg: "bg-orange-100 dark:bg-orange-950/70", badgeText: "text-orange-700 dark:text-orange-300 font-bold", badgeBorder: "border-orange-300 dark:border-orange-800" },
];

/** The calendars Calendar Assign offers: Calendar Setup's (by office, then start time), then Weekly Off and Holiday. */
export async function calendarDefinitions(): Promise<CalendarDefinition[]> {
  const [calendars, rows, offices] = await Promise.all([
    workCalendars(),
    db().hrPolicyRecord.findMany({ where: { tab: "calendar-setup" }, select: { id: true, data: true } }),
    db().office.findMany({ select: { id: true, name: true } }),
  ]);
  const officeName = new Map(offices.map((o) => [o.id, o.name]));
  const extra = new Map(rows.map((r) => [r.id, (r.data ?? {}) as Record<string, unknown>]));
  const time = (v: unknown) => (typeof v === "string" && /^\d{2}:\d{2}$/.test(v) ? v : null);
  const list = calendars
    .map((c) => ({ c, office: c.officeId ? officeName.get(c.officeId) ?? "" : "All" }))
    .sort((a, b) => a.office.localeCompare(b.office) || a.c.startTime.localeCompare(b.c.startTime));
  return [
    ...list.map(({ c, office }, i) => {
      const d = extra.get(c.id) ?? {};
      const [badgeBg, badgeText, badgeBorder] = BADGES[i % BADGES.length];
      return {
        id: c.id,
        office,
        calendarName: c.name,
        shortCode: c.shortCode,
        startTime: to12h(c.startTime),
        endTime: to12h(c.endTime),
        minWorkHour: Number(d.minWorkHours) || 0,
        lastStartTime: to12h(c.lastStartTime),
        graceTime: to12h(c.graceTime),
        minInTime: "-",
        maxOutTime: "-",
        breakStartTime: to12h(time(d.breakStartTime)),
        breakEndTime: to12h(time(d.breakEndTime)),
        badgeBg,
        badgeText,
        badgeBorder,
      } satisfies CalendarDefinition;
    }),
    ...SPECIAL_CALENDARS,
  ];
}

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
const MAX_DAYS = 93;

/** The saved codes of these employees for the range: employeeId → date → code. */
export async function loadCalendarDays(employeeIds: string[], from: string, to: string): Promise<RosterGridData> {
  if (!employeeIds.length || !ISO_DAY.test(from) || !ISO_DAY.test(to) || from > to) return {};
  const rows = await db().employeeCalendarDay.findMany({
    where: { employeeId: { in: employeeIds }, date: { gte: new Date(`${from}T00:00:00Z`), lte: new Date(`${to}T00:00:00Z`) } },
    select: { employeeId: true, date: true, code: true },
  });
  const grid: RosterGridData = {};
  for (const r of rows) (grid[r.employeeId] ??= {})[r.date.toISOString().slice(0, 10)] = r.code;
  return grid;
}

export interface SaveCalendarDaysInput {
  from: string;
  to: string;
  /** employeeId → date → code; "" (or a date left out) clears that day. */
  assignments: Record<string, Record<string, string>>;
}

/**
 * Saves the grid as shown: for each listed employee, every day of the range
 * becomes exactly what was sent (a code, or nothing). Codes are matched to
 * the employee's office calendars (or every-office ones); OFF and HOL are
 * Weekly Off and Holiday. Unknown codes are refused before anything is saved.
 */
export async function saveCalendarDays(actor: Actor, input: SaveCalendarDaysInput): Promise<{ saved: number; cleared: number }> {
  const { from, to, assignments } = input;
  if (!ISO_DAY.test(from) || !ISO_DAY.test(to) || from > to) throw badRequest("Choose a valid date range.");
  const range = daysBetween(from, to);
  if (range.length > MAX_DAYS) throw badRequest(`Save at most ${MAX_DAYS} days at a time.`);
  const ids = Object.keys(assignments);
  if (!ids.length) return { saved: 0, cleared: 0 };

  const [employees, calendars] = await Promise.all([
    db().employee.findMany({ where: { ...employeeScope(actor), id: { in: ids } }, select: { id: true, officeId: true, employeeCode: true } }),
    workCalendars(),
  ]);
  if (employees.length !== ids.length) throw badRequest("Some employees were not found.");

  const rows: { employeeId: string; date: Date; code: string; calendarId: string | null; updatedByName: string }[] = [];
  const unknown = new Set<string>();
  const by = (actor.name ?? "HR").slice(0, 150);
  for (const e of employees) {
    const days = assignments[e.id] ?? {};
    for (const date of range) {
      const code = (days[date] ?? "").trim();
      if (!code) continue;
      if (code === OFF_CODE || code === HOLIDAY_CODE) {
        rows.push({ employeeId: e.id, date: new Date(`${date}T00:00:00Z`), code, calendarId: null, updatedByName: by });
        continue;
      }
      const calendar = calendarForCode(calendars, e.officeId, code);
      if (!calendar) unknown.add(`${e.employeeCode}: ${code}`);
      else rows.push({ employeeId: e.id, date: new Date(`${date}T00:00:00Z`), code: calendar.shortCode, calendarId: calendar.id, updatedByName: by });
    }
  }
  if (unknown.size) {
    const list = [...unknown];
    throw badRequest(`Not set up for the employee's office in HR Governance › Calendar Setup: ${list.slice(0, 8).join(", ")}${list.length > 8 ? ` and ${list.length - 8} more` : ""}.`);
  }

  const window = { gte: new Date(`${from}T00:00:00Z`), lte: new Date(`${to}T00:00:00Z`) };
  const removed = await db().$transaction(async (tx) => {
    const { count } = await tx.employeeCalendarDay.deleteMany({ where: { employeeId: { in: ids }, date: window } });
    if (rows.length) await tx.employeeCalendarDay.createMany({ data: rows });
    return count;
  });
  return { saved: rows.length, cleared: Math.max(0, removed - rows.length) };
}

