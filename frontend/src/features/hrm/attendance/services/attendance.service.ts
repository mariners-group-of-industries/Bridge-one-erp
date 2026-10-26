import { db } from "@/lib/prisma/client";
import type { AttendanceRecord, AttendanceFilterState, EmployeeOption } from "../types";

// In-memory / runtime store for user-submitted attendance adjustments
const attendanceRecordsStore = new Map<string, AttendanceRecord>();

// Ensure store starts completely purged
attendanceRecordsStore.clear();

export function clearAllDailyAttendance(): void {
  attendanceRecordsStore.clear();
}

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

export async function getDailyAttendance(filters: AttendanceFilterState): Promise<{
  records: AttendanceRecord[];
  totalRecords: number;
  employees: EmployeeOption[];
}> {
  const allEmployees = await getAttendanceEmployees();

  // Retrieve any real saved records from store
  let filtered = Array.from(attendanceRecordsStore.values());

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

