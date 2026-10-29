import ExcelJS from "exceljs";
import { Prisma } from "@/generated/prisma/client";
import { badRequest, conflict, notFound } from "@/lib/api/errors";
import type { Actor } from "@/lib/auth/actor";
import { db } from "@/lib/prisma/client";
import { scopedBusinessUnitIds } from "@/features/sales/lib/scope";
import { targetBusinessUnit } from "../../lib/business-unit";
import {
  masterInputSchema,
  operatorSearchSchema,
  workCenterInputSchema,
  workCenterListQuerySchema,
  workCenterStatusSchema,
  workCenterUpdateSchema,
  type MasterKind,
  type OperatorOption,
  type Option,
  type WorkCenterDetail,
  type WorkCenterLookups,
  type WorkCenterRow,
} from "../schemas/work-center.schema";

type Tx = Prisma.TransactionClient;
type ParsedInput = ReturnType<typeof workCenterInputSchema.parse>;

const num = (value: Prisma.Decimal | null | undefined) => (value ? value.toNumber() : 0);
const optNum = (value: Prisma.Decimal | null | undefined) => (value ? value.toNumber() : null);

const ROW_INCLUDE = {
  type: { select: { name: true } },
  department: { select: { name: true } },
  departmentSection: { select: { name: true } },
  warehouse: { select: { name: true } },
  _count: { select: { operators: true } },
} satisfies Prisma.ProductionWorkCenterInclude;

type RowRecord = Prisma.ProductionWorkCenterGetPayload<{ include: typeof ROW_INCLUDE }>;

function toRow(record: RowRecord): WorkCenterRow {
  return {
    id: record.id,
    businessUnitId: record.businessUnitId,
    code: record.code,
    name: record.name,
    typeId: record.typeId,
    typeName: record.type.name,
    departmentId: record.departmentId,
    departmentName: record.department?.name ?? null,
    departmentSectionId: record.departmentSectionId,
    sectionName: record.departmentSection?.name ?? null,
    warehouseId: record.warehouseId,
    warehouseName: record.warehouse?.name ?? null,
    standardRunHour: num(record.standardRunHour),
    capacityPerHour: num(record.capacityPerHour),
    ratedCapacityPerHour: num(record.ratedCapacityPerHour),
    costPerHour: optNum(record.costPerHour),
    remarks: record.remarks,
    isActive: record.isActive,
    operatorCount: record._count.operators,
    updatedAt: record.updatedAt.toISOString(),
  };
}

export async function listWorkCenters(actor: Actor, raw: unknown): Promise<WorkCenterRow[]> {
  const query = workCenterListQuerySchema.parse(raw);
  const unitIds = await scopedBusinessUnitIds(actor);
  const records = await db().productionWorkCenter.findMany({
    where: {
      businessUnitId: { in: unitIds },
      ...(query.typeId ? { typeId: query.typeId } : {}),
      ...(query.departmentId ? { departmentId: query.departmentId } : {}),
      ...(query.departmentSectionId ? { departmentSectionId: query.departmentSectionId } : {}),
    },
    include: ROW_INCLUDE,
    orderBy: [{ isActive: "desc" }, { code: "asc" }],
  });
  return records.map(toRow);
}

async function findInScope(actor: Actor, id: string, client: Tx | ReturnType<typeof db> = db()) {
  const unitIds = await scopedBusinessUnitIds(actor);
  const record = await client.productionWorkCenter.findFirst({
    where: { id, businessUnitId: { in: unitIds } },
    include: {
      ...ROW_INCLUDE,
      operators: {
        select: { employee: { select: { id: true, employeeCode: true, name: true, designation: true, department: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!record) throw notFound("Work center");
  return record;
}

export async function getWorkCenter(actor: Actor, id: string): Promise<WorkCenterDetail> {
  const record = await findInScope(actor, id);
  return {
    ...toRow(record),
    operators: record.operators.map(({ employee }) => ({
      employeeId: employee.id,
      code: employee.employeeCode,
      name: employee.name,
      designation: employee.designation,
      department: employee.department,
    })),
  };
}

/** Checks that every referenced record belongs to the business unit; returns the warehouse's office. */
async function checkReferences(tx: Tx, businessUnitId: string, input: ParsedInput): Promise<{ officeId: string | null }> {
  const [type, department, section, warehouse, employees] = await Promise.all([
    tx.productionWorkCenterType.findFirst({ where: { id: input.typeId, businessUnitId }, select: { id: true } }),
    input.departmentId ? tx.productionDepartment.findFirst({ where: { id: input.departmentId, businessUnitId }, select: { id: true } }) : null,
    input.departmentSectionId
      ? tx.productionDepartmentSection.findFirst({ where: { id: input.departmentSectionId }, select: { departmentId: true } })
      : null,
    input.warehouseId
      ? tx.warehouse.findFirst({ where: { id: input.warehouseId, office: { businessUnitId } }, select: { officeId: true } })
      : null,
    input.operatorIds.length
      ? tx.employee.findMany({ where: { id: { in: input.operatorIds }, office: { businessUnitId } }, select: { id: true, isActive: true, name: true } })
      : [],
  ]);
  if (!type) throw badRequest("Choose a work center type of this business unit.");
  if (input.departmentId && !department) throw badRequest("Choose a department of this business unit.");
  if (input.departmentSectionId && section?.departmentId !== input.departmentId) {
    throw badRequest("The department section does not belong to the chosen department.");
  }
  if (input.warehouseId && !warehouse) throw badRequest("Choose a warehouse of this business unit.");
  if (employees.length !== input.operatorIds.length) throw badRequest("An operator is not an employee of this business unit.");
  return { officeId: warehouse?.officeId ?? null };
}

async function assertCodeFree(tx: Tx, businessUnitId: string, code: string, exceptId?: string) {
  const taken = await tx.productionWorkCenter.findFirst({
    where: { businessUnitId, code: { equals: code, mode: "insensitive" }, ...(exceptId ? { id: { not: exceptId } } : {}) },
    select: { id: true },
  });
  if (taken) throw conflict(`Work Center Code ${code} is already used.`);
}

function fields(input: ParsedInput, officeId: string | null) {
  return {
    name: input.name,
    code: input.code,
    typeId: input.typeId,
    departmentId: input.departmentId ?? null,
    departmentSectionId: input.departmentSectionId ?? null,
    warehouseId: input.warehouseId ?? null,
    officeId,
    standardRunHour: input.standardRunHour,
    capacityPerHour: input.capacityPerHour,
    ratedCapacityPerHour: input.ratedCapacityPerHour,
    costPerHour: input.costPerHour ?? null,
    remarks: input.remarks || null,
  };
}

/** Serialises saves of work center codes in one business unit. */
async function lockCodes(tx: Tx, businessUnitId: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`workcenter:${businessUnitId}`}))`;
}

export async function createWorkCenter(actor: Actor, raw: unknown): Promise<WorkCenterDetail> {
  const input = workCenterInputSchema.parse(raw);
  const businessUnitId = await targetBusinessUnit(actor, input.businessUnitId);
  const id = await db().$transaction(async (tx) => {
    await lockCodes(tx, businessUnitId);
    const { officeId } = await checkReferences(tx, businessUnitId, input);
    await assertCodeFree(tx, businessUnitId, input.code);
    const created = await tx.productionWorkCenter.create({
      data: {
        businessUnitId,
        ...fields(input, officeId),
        createdBy: actor.id,
        operators: { create: input.operatorIds.map((employeeId) => ({ employeeId })) },
      },
      select: { id: true },
    });
    return created.id;
  });
  return getWorkCenter(actor, id);
}

export async function updateWorkCenter(actor: Actor, id: string, raw: unknown): Promise<WorkCenterDetail> {
  const { version, data } = workCenterUpdateSchema.parse(raw);
  const current = await findInScope(actor, id);
  await db().$transaction(async (tx) => {
    await lockCodes(tx, current.businessUnitId);
    const { officeId } = await checkReferences(tx, current.businessUnitId, data);
    await assertCodeFree(tx, current.businessUnitId, data.code, id);
    const { count } = await tx.productionWorkCenter.updateMany({
      where: { id, updatedAt: new Date(version) },
      data: fields(data, officeId),
    });
    if (count === 0) throw conflict("Someone else changed this work center. Reload and try again.");
    await tx.productionWorkCenterOperator.deleteMany({ where: { workCenterId: id, employeeId: { notIn: data.operatorIds } } });
    await tx.productionWorkCenterOperator.createMany({
      data: data.operatorIds.map((employeeId) => ({ workCenterId: id, employeeId })),
      skipDuplicates: true,
    });
  });
  return getWorkCenter(actor, id);
}

/** Active / inactive toggle of the list. */
export async function setWorkCenterActive(actor: Actor, id: string, raw: unknown): Promise<WorkCenterRow> {
  const { version, isActive } = workCenterStatusSchema.parse(raw);
  await findInScope(actor, id);
  const { count } = await db().productionWorkCenter.updateMany({ where: { id, updatedAt: new Date(version) }, data: { isActive } });
  if (count === 0) throw conflict("Someone else changed this work center. Reload and try again.");
  return toRow(await findInScope(actor, id));
}

export async function workCenterLookups(actor: Actor): Promise<WorkCenterLookups> {
  const unitIds = await scopedBusinessUnitIds(actor);
  const inUnits = { businessUnitId: { in: unitIds } };
  const [businessUnits, types, departments, sections, warehouses] = await Promise.all([
    db().businessUnit.findMany({ where: { id: { in: unitIds } }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    db().productionWorkCenterType.findMany({ where: inUnits, select: { id: true, name: true, businessUnitId: true }, orderBy: { name: "asc" } }),
    db().productionDepartment.findMany({ where: inUnits, select: { id: true, name: true, businessUnitId: true }, orderBy: { name: "asc" } }),
    db().productionDepartmentSection.findMany({
      where: { department: inUnits },
      select: { id: true, name: true, departmentId: true },
      orderBy: { name: "asc" },
    }),
    db().warehouse.findMany({
      where: { office: inUnits },
      select: { id: true, name: true, office: { select: { name: true, businessUnitId: true } } },
      orderBy: { name: "asc" },
    }),
  ]);
  return {
    businessUnits,
    types,
    departments,
    sections,
    warehouses: warehouses.map((row) => ({ id: row.id, name: row.name, officeName: row.office.name, businessUnitId: row.office.businessUnitId })),
  };
}

/** Active employees by name or code, for operator tagging. */
export async function searchOperators(actor: Actor, raw: unknown): Promise<OperatorOption[]> {
  const query = operatorSearchSchema.parse(raw);
  const unitIds = await scopedBusinessUnitIds(actor);
  const text = { contains: query.search, mode: "insensitive" as const };
  const employees = await db().employee.findMany({
    where: {
      isActive: true,
      office: { businessUnitId: query.businessUnitId && unitIds.includes(query.businessUnitId) ? query.businessUnitId : { in: unitIds } },
      OR: [{ name: text }, { employeeCode: text }],
    },
    select: { id: true, employeeCode: true, name: true, designation: true, department: true },
    orderBy: { name: "asc" },
    take: 20,
  });
  return employees.map((row) => ({ employeeId: row.id, code: row.employeeCode, name: row.name, designation: row.designation, department: row.department }));
}

/** The filtered list as a formatted .xlsx file. */
export async function workCentersExcel(actor: Actor, raw: unknown): Promise<Uint8Array> {
  const rows = await listWorkCenters(actor, raw);
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Work Center");
  const columns: [string, number][] = [
    ["SL", 6],
    ["Department", 18],
    ["Department Section", 20],
    ["Work Center Code", 16],
    ["Work Center Type", 18],
    ["Work Center", 26],
    ["Standard Run Hour", 12],
    ["Capacity Per Hour", 12],
    ["Rated Capacity Per Hour", 14],
    ["Cost Per Hour", 12],
    ["Operator Tagging", 10],
    ["Warehouse", 18],
    ["Status", 10],
    ["Remarks", 24],
  ];
  const border = { top: { style: "thin" }, left: { style: "thin" }, bottom: { style: "thin" }, right: { style: "thin" } } as const;
  const header = sheet.addRow(columns.map(([label]) => label));
  header.eachCell((cell) => {
    cell.font = { bold: true };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDBEAFE" } };
    cell.border = border;
    cell.alignment = { vertical: "middle", wrapText: true };
  });
  rows.forEach((row, index) => {
    sheet
      .addRow([
        index + 1,
        row.departmentName ?? "",
        row.sectionName ?? "",
        row.code,
        row.typeName,
        row.name,
        row.standardRunHour,
        row.capacityPerHour,
        row.ratedCapacityPerHour,
        row.costPerHour ?? "",
        row.operatorCount,
        row.warehouseName ?? "",
        row.isActive ? "Active" : "Inactive",
        row.remarks ?? "",
      ])
      .eachCell({ includeEmpty: true }, (cell) => (cell.border = border));
  });
  columns.forEach(([, width], index) => (sheet.getColumn(index + 1).width = width));
  for (const column of [7, 8, 9, 10]) sheet.getColumn(column).numFmt = "#,##0.00";
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  return new Uint8Array(await workbook.xlsx.writeBuffer());
}

/** "ADD NEW" of work center type, department and department section. */
export async function createMaster(actor: Actor, kind: MasterKind, raw: unknown): Promise<Option> {
  const input = masterInputSchema.parse(raw);
  const select = { id: true, name: true } as const;
  try {
    if (kind === "sections") {
      if (!input.departmentId) throw badRequest("Choose the department first.");
      const unitIds = await scopedBusinessUnitIds(actor);
      const department = await db().productionDepartment.findFirst({ where: { id: input.departmentId, businessUnitId: { in: unitIds } } });
      if (!department) throw notFound("Department");
      return await db().productionDepartmentSection.create({ data: { departmentId: department.id, name: input.name }, select });
    }
    const businessUnitId = await targetBusinessUnit(actor, input.businessUnitId);
    if (kind === "types") return await db().productionWorkCenterType.create({ data: { businessUnitId, name: input.name }, select });
    return await db().productionDepartment.create({ data: { businessUnitId, name: input.name }, select });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw conflict(`${input.name} already exists.`);
    throw error;
  }
}
