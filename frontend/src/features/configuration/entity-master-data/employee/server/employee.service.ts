import type { Prisma } from "@/generated/prisma/client";
import { actorUserId, type Actor } from "@/lib/auth/actor";
import { db } from "@/lib/prisma/client";
import type {
  CreateEmployeeInput,
  CreateEmployeeResult,
  EmployeeFilterOptions,
  EmployeeFormOptions,
  EmployeeList,
  EmployeeListQuery,
  EmployeeListRow,
} from "../schemas/employee.schema";

function scopeWhere(actor: Actor): Prisma.EmployeeWhereInput {
  return actor.companyScope === "ALL"
    ? {}
    : { office: { businessUnit: { companyId: { in: [...actor.companyScope] } } } };
}

const escapeLike = (value: string) => value.replace(/[\\%_]/g, (char) => `\\${char}`);

function searchWhere(search: string): Prisma.EmployeeWhereInput {
  const contains = { contains: escapeLike(search), mode: "insensitive" as const };
  return {
    OR: [
      { employeeCode: contains },
      { attendanceId: contains },
      { name: contains },
      { user: { is: { phone: contains } } },
    ],
  };
}

const dateOnly = (value: Date) => value.toISOString().slice(0, 10);

const rowSelect = {
  id: true,
  employeeCode: true,
  attendanceId: true,
  name: true,
  designation: true,
  department: true,
  employeeType: true,
  joiningDate: true,
  terminationDate: true,
  isActive: true,
  updatedAt: true,
  office: { select: { name: true, businessUnit: { select: { dateFormat: true } } } },
  user: { select: { phone: true, role: true } },
  updatedBy: { select: { name: true } },
} satisfies Prisma.EmployeeSelect;

type RowRecord = Prisma.EmployeeGetPayload<{ select: typeof rowSelect }>;

function toRow(record: RowRecord): EmployeeListRow {
  return {
    id: record.id,
    employeeCode: record.employeeCode,
    attendanceId: record.attendanceId,
    name: record.name,
    designation: record.designation,
    department: record.department,
    officeName: record.office.name,
    joiningDate: dateOnly(record.joiningDate),
    terminationDate: record.terminationDate ? dateOnly(record.terminationDate) : null,
    mobile: record.user?.phone ?? null,
    employeeType: record.employeeType,
    userRole: record.user?.role ?? null,
    lastActionBy: record.updatedBy?.name ?? null,
    lastActionAt: record.updatedAt.toISOString(),
    isActive: record.isActive,
    dateFormat: record.office.businessUnit.dateFormat,
  };
}

export async function listEmployees(actor: Actor, query: EmployeeListQuery): Promise<EmployeeList> {
  const where: Prisma.EmployeeWhereInput = {
    AND: [
      scopeWhere(actor),
      query.search ? searchWhere(query.search) : {},
      query.status ? { isActive: query.status === "active" } : {},
      query.userType ? { employeeType: query.userType } : {},
    ],
  };

  const totalRecords = await db().employee.count({ where });
  const totalPages = Math.ceil(totalRecords / query.pageSize);
  const page = Math.min(query.page, Math.max(totalPages, 1));

  const records =
    totalRecords === 0
      ? []
      : await db().employee.findMany({
          where,
          select: rowSelect,
          orderBy: [{ [query.sort]: query.order }, { id: "asc" }],
          skip: (page - 1) * query.pageSize,
          take: query.pageSize,
        });

  return {
    rows: records.map(toRow),
    pagination: { page, pageSize: query.pageSize, totalRecords, totalPages },
  };
}

export async function employeeFilterOptions(actor: Actor): Promise<EmployeeFilterOptions> {
  const types = await db().employee.findMany({
    where: { AND: [scopeWhere(actor), { employeeType: { not: null } }] },
    distinct: ["employeeType"],
    select: { employeeType: true },
    orderBy: { employeeType: "asc" },
  });
  return { employeeTypes: types.flatMap((item) => (item.employeeType ? [item.employeeType] : [])) };
}

export async function employeeFormOptions(actor: Actor): Promise<EmployeeFormOptions> {
  const scope = scopeWhere(actor);

  const [offices, designations, hrPositions, departments, departmentSections, employeeTypes, serviceCategories, employeePolicies, supervisors, lineManagers] =
    await Promise.all([
      db().office.findMany({
        where: actor.companyScope === "ALL" ? {} : { businessUnit: { companyId: { in: [...actor.companyScope] } } },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
      db().employee.findMany({ where: { AND: [scope, { designation: { not: null } }] }, distinct: ["designation"], select: { designation: true }, orderBy: { designation: "asc" } }),
      db().employee.findMany({ where: { AND: [scope, { hrPosition: { not: null } }] }, distinct: ["hrPosition"], select: { hrPosition: true }, orderBy: { hrPosition: "asc" } }),
      db().employee.findMany({ where: { AND: [scope, { department: { not: null } }] }, distinct: ["department"], select: { department: true }, orderBy: { department: "asc" } }),
      db().employee.findMany({ where: { AND: [scope, { departmentSection: { not: null } }] }, distinct: ["departmentSection"], select: { departmentSection: true }, orderBy: { departmentSection: "asc" } }),
      db().employee.findMany({ where: { AND: [scope, { employeeType: { not: null } }] }, distinct: ["employeeType"], select: { employeeType: true }, orderBy: { employeeType: "asc" } }),
      db().employee.findMany({ where: { AND: [scope, { serviceCategory: { not: null } }] }, distinct: ["serviceCategory"], select: { serviceCategory: true }, orderBy: { serviceCategory: "asc" } }),
      db().employee.findMany({ where: { AND: [scope, { employeePolicy: { not: null } }] }, distinct: ["employeePolicy"], select: { employeePolicy: true }, orderBy: { employeePolicy: "asc" } }),
      db().employee.findMany({ where: { AND: [scope, { supervisor: { not: null } }] }, distinct: ["supervisor"], select: { supervisor: true }, orderBy: { supervisor: "asc" } }),
      db().employee.findMany({ where: { AND: [scope, { lineManager: { not: null } }] }, distinct: ["lineManager"], select: { lineManager: true }, orderBy: { lineManager: "asc" } }),
    ]);

  return {
    offices,
    designations:       designations.flatMap((r) => (r.designation ? [r.designation] : [])),
    hrPositions:        hrPositions.flatMap((r) => (r.hrPosition ? [r.hrPosition] : [])),
    departments:        departments.flatMap((r) => (r.department ? [r.department] : [])),
    departmentSections: departmentSections.flatMap((r) => (r.departmentSection ? [r.departmentSection] : [])),
    employeeTypes:      employeeTypes.flatMap((r) => (r.employeeType ? [r.employeeType] : [])),
    serviceCategories:  serviceCategories.flatMap((r) => (r.serviceCategory ? [r.serviceCategory] : [])),
    employeePolicies:   employeePolicies.flatMap((r) => (r.employeePolicy ? [r.employeePolicy] : [])),
    supervisors:        supervisors.flatMap((r) => (r.supervisor ? [r.supervisor] : [])),
    lineManagers:       lineManagers.flatMap((r) => (r.lineManager ? [r.lineManager] : [])),
  };
}

export async function createEmployee(actor: Actor, input: CreateEmployeeInput): Promise<CreateEmployeeResult> {
  const toDate = (s?: string) => (s ? new Date(s) : undefined);
  const record = await db().employee.create({
    data: {
      officeId:           input.officeId,
      employeeCode:       input.employeeCode,
      attendanceId:       input.attendanceId || null,
      name:               input.name,
      designation:        input.designation || null,
      hrPosition:         input.hrPosition || null,
      department:         input.department || null,
      departmentSection:  input.departmentSection || null,
      employeeType:       input.employeeType || null,
      serviceCategory:    input.serviceCategory || null,
      employeePolicy:     input.employeePolicy || null,
      location:           input.location || null,
      joiningDate:        new Date(input.joiningDate),
      confirmationDate:   toDate(input.confirmationDate),
      terminationDate:    toDate(input.terminationDate),
      mobile:             input.mobile || null,
      email:              input.email || null,
      officialContact:    input.officialContact || null,
      religion:           input.religion || null,
      gender:             input.gender || null,
      bloodGroup:         input.bloodGroup || null,
      dateOfBirth:        toDate(input.dateOfBirth),
      fathersName:        input.fathersName || null,
      mothersName:        input.mothersName || null,
      nidNumber:          input.nidNumber || null,
      presentAddress:     input.presentAddress || null,
      permanentAddress:   input.permanentAddress || null,
      supervisor:         input.supervisor || null,
      lineManager:        input.lineManager || null,
      holdSalary:         input.holdSalary,
      departmentApproval: input.departmentApproval,
      isService:          input.isService,
      holdPayment:        input.holdPayment,
      isReseller:         input.isReseller,
      isUser:             input.isUser,
      updatedById:        actorUserId(actor),
    },
    select: { id: true, employeeCode: true },
  });
  return record;
}
