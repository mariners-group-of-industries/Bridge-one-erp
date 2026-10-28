import { db } from "@/lib/prisma/client";
import type { AttendanceRecord, AttendanceFilterState, EmployeeOption } from "../types";

// In-memory / runtime store for user-submitted attendance adjustments
const attendanceRecordsStore = new Map<string, AttendanceRecord>();

// Ensure store starts completely purged
attendanceRecordsStore.clear();

/** Removes manual adjustments only; punches imported from devices are kept. */
export function clearAllDailyAttendance(): void {
  attendanceRecordsStore.clear();
}

/** Devices keep local time; days and times are shown in this time zone. */
const TIME_ZONE = process.env.APP_TIMEZONE || "Asia/Dhaka";
/** Longest range one request may cover (punch rows are grouped in memory). */
const MAX_RANGE_DAYS = 93;

const dayKey = new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" });
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
      office: { select: { name: true } },
    },
    orderBy: [{ employeeCode: "asc" }],
    take: 500,
  });

  return employees.map((e) => ({
    id: e.id,
    employeeCode: e.employeeCode,
    name: e.name,
    designation: e.designation || "",
    department: e.department || "",
    departmentSection: e.departmentSection || "",
    officeName: e.office?.name || "",
  }));
}

/** False for a missing or reversed range; throws when the range is too long. */
function validRange(filters: AttendanceFilterState): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(filters.fromDate) || !/^\d{4}-\d{2}-\d{2}$/.test(filters.toDate) || filters.fromDate > filters.toDate) return false;
  const days = (Date.parse(filters.toDate) - Date.parse(filters.fromDate)) / 86_400_000 + 1;
  if (days > MAX_RANGE_DAYS) throw new Error(`Choose at most ${MAX_RANGE_DAYS} days at a time.`);
  return true;
}

/**
 * One row per employee and day that has device punches: first punch = in,
 * last punch = out (when there is more than one). Manual adjustments saved
 * through the edit dialog replace the row for that employee and day.
 */
async function punchRecords(filters: AttendanceFilterState): Promise<AttendanceRecord[]> {
  if (!validRange(filters)) return [];

  // A day either side covers any time-zone offset; rows are then filtered by local day.
  const from = new Date(Date.parse(`${filters.fromDate}T00:00:00Z`) - 86_400_000);
  const to = new Date(Date.parse(`${filters.toDate}T00:00:00Z`) + 2 * 86_400_000);
  const chosen = filters.employeeId && filters.employeeId !== "ALL" ? filters.employeeId : "";
  const employeeFilter = chosen ? { OR: [...(/^[0-9a-f-]{36}$/i.test(chosen) ? [{ id: chosen }] : []), { employeeCode: chosen }] } : {};

  const punches = await db().attendancePunch.findMany({
    where: { punchTime: { gte: from, lt: to }, employeeId: { not: null }, employee: employeeFilter },
    orderBy: { punchTime: "asc" },
    select: {
      punchTime: true,
      device: { select: { name: true } },
      employee: { select: { id: true, employeeCode: true, name: true, designation: true, department: true, departmentSection: true } },
    },
  });

  const rows = new Map<string, { employee: NonNullable<(typeof punches)[number]["employee"]>; date: string; times: { at: Date; device: string }[] }>();
  for (const punch of punches) {
    const date = dayKey.format(punch.punchTime);
    if (date < filters.fromDate || date > filters.toDate || !punch.employee) continue;
    const key = `${punch.employee.id}:${date}`;
    const row = rows.get(key) ?? { employee: punch.employee, date, times: [] };
    row.times.push({ at: punch.punchTime, device: punch.device.name });
    rows.set(key, row);
  }

  return [...rows.entries()].map(([id, { employee, date, times }]) => {
    const first = times[0];
    const last = times.length > 1 ? times[times.length - 1] : null;
    return {
      id,
      sl: 0,
      employeeId: employee.id,
      employeeCode: employee.employeeCode,
      employeeName: employee.name,
      designation: employee.designation || "",
      department: employee.department || "",
      departmentSection: employee.departmentSection || "",
      date,
      day: weekday.format(new Date(`${date}T00:00:00Z`)),
      calendarName: "Not assigned",
      inTime: clock.format(first.at),
      outTime: last ? clock.format(last.at) : null,
      inTimeLocation: first.device,
      outTimeLocation: last?.device ?? null,
      actualAttendance: "Present",
      requestAttendance: null,
      remarks: times.length > 2 ? `${times.length} punches` : null,
      lastActionBy: "Device",
      lastActionTime: null,
    } satisfies AttendanceRecord;
  });
}

export async function getDailyAttendance(filters: AttendanceFilterState): Promise<{
  records: AttendanceRecord[];
  totalRecords: number;
  employees: EmployeeOption[];
}> {
  // Checked before any query starts, so a rejected request leaves none running.
  validRange(filters);
  const [allEmployees, fromDevices] = await Promise.all([getAttendanceEmployees(), punchRecords(filters)]);

  // Device rows, with any saved adjustment for the same employee and day taking precedence.
  const merged = new Map(fromDevices.map((r) => [r.id, r]));
  for (const adjusted of attendanceRecordsStore.values()) merged.set(adjusted.id, adjusted);
  let filtered = Array.from(merged.values());

  if (filters.employeeId && filters.employeeId !== "ALL") {
    filtered = filtered.filter(
      (r) => r.employeeId === filters.employeeId || r.employeeCode === filters.employeeId,
    );
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

export async function saveAttendanceAdjustment(
  record: AttendanceRecord,
): Promise<AttendanceRecord> {
  attendanceRecordsStore.set(record.id, record);
  return record;
}
