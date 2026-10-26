import { db } from "@/lib/prisma/client";
import type {
  EmployeeRosterItem,
  EmployeeFilterOption,
  PaginationMeta,
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

