import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import {
  createMaster,
  createWorkCenter,
  getWorkCenter,
  listWorkCenters,
  searchOperators,
  setWorkCenterActive,
  updateWorkCenter,
  workCenterLookups,
  workCentersExcel,
} from "@/features/production/work-centers/services/work-center.service";
import { adminActor, businessUnitInput, companyInput, officeInput, scopedActor } from "./helpers/fixtures";
import { resetTestDb, startTestDb, stopTestDb } from "./helpers/test-db";

// Route database access to the per-file PGlite test database.
vi.mock("@/lib/prisma/client", async () => {
  const { testPrisma } = await import("./helpers/test-db");
  return { db: testPrisma };
});

const OTHER_COMPANY = "00000000-0000-4000-8000-000000000000";

describe("production work centers", () => {
  let prisma: PrismaClient;
  let officeId: string;
  let warehouseId: string;
  let operatorIds: string[];

  beforeAll(async () => {
    prisma = await startTestDb();
  });

  beforeEach(async () => {
    await resetTestDb();
    const companyId = (await prisma.company.create({ data: companyInput })).id;
    const businessUnitId = (await prisma.businessUnit.create({ data: { ...businessUnitInput, companyId } })).id;
    officeId = (await prisma.office.create({ data: { ...officeInput, businessUnitId } })).id;
    warehouseId = (await prisma.warehouse.create({ data: { officeId, name: "Factory Store" } })).id;
    const employee = (employeeCode: string, name: string) =>
      prisma.employee.create({ data: { officeId, employeeCode, name, designation: "Machine Operator", joiningDate: new Date("2025-01-01") } });
    operatorIds = [(await employee("E-001", "Rahim")).id, (await employee("E-002", "Karim")).id];
  });

  afterAll(stopTestDb);

  async function masters() {
    const type = await createMaster(adminActor, "types", { name: "Finished Goods" });
    const department = await createMaster(adminActor, "departments", { name: "Production" });
    const section = await createMaster(adminActor, "sections", { name: "Juice", departmentId: department.id });
    return { type, department, section };
  }

  const input = (ids: Awaited<ReturnType<typeof masters>>, overrides: Record<string, unknown> = {}) => ({
    name: "Juice Maker",
    typeId: ids.type.id,
    code: "JM-001",
    standardRunHour: 18,
    capacityPerHour: 300,
    ratedCapacityPerHour: 280,
    costPerHour: 1,
    remarks: "Test",
    departmentId: ids.department.id,
    departmentSectionId: ids.section.id,
    warehouseId,
    operatorIds,
    ...overrides,
  });

  it("creates a work center with its masters, warehouse office and operators, and lists it", async () => {
    const ids = await masters();
    const created = await createWorkCenter(adminActor, input(ids));
    expect(created).toMatchObject({
      code: "JM-001",
      typeName: "Finished Goods",
      departmentName: "Production",
      sectionName: "Juice",
      warehouseName: "Factory Store",
      standardRunHour: 18,
      capacityPerHour: 300,
      ratedCapacityPerHour: 280,
      costPerHour: 1,
      isActive: true,
      operatorCount: 2,
    });
    expect(created.operators.map((operator) => operator.code)).toEqual(["E-001", "E-002"]);
    expect((await prisma.productionWorkCenter.findUniqueOrThrow({ where: { id: created.id } })).officeId).toBe(officeId);

    expect(await listWorkCenters(adminActor, { departmentSectionId: ids.section.id })).toHaveLength(1);
    const otherType = await createMaster(adminActor, "types", { name: "Packaging" });
    expect(await listWorkCenters(adminActor, { typeId: otherType.id })).toHaveLength(0);
    expect(await listWorkCenters(scopedActor([OTHER_COMPANY]), {})).toHaveLength(0);
    await expect(getWorkCenter(scopedActor([OTHER_COMPANY]), created.id)).rejects.toThrow("not found");

    const lookups = await workCenterLookups(adminActor);
    expect(lookups).toMatchObject({ types: [{ name: "Finished Goods" }, { name: "Packaging" }], sections: [{ name: "Juice" }] });
    expect((await searchOperators(adminActor, { search: "rah" })).map((row) => [row.code, row.name])).toEqual([["E-001", "Rahim"]]);
    expect(await searchOperators(adminActor, { search: "E-00" })).toHaveLength(2);
    await expect(searchOperators(adminActor, { search: "ra" })).rejects.toThrow("3 letters");
    expect(Buffer.from((await workCentersExcel(adminActor, {})).slice(0, 2)).toString()).toBe("PK");
  });

  it("rejects a used code, a section of another department, bad numbers and duplicate masters", async () => {
    const ids = await masters();
    await createWorkCenter(adminActor, input(ids));
    await expect(createWorkCenter(adminActor, input(ids, { code: "jm-001", name: "Second" }))).rejects.toThrow("already used");

    const store = await createMaster(adminActor, "departments", { name: "Store (Materials)" });
    await expect(createWorkCenter(adminActor, input(ids, { code: "JM-002", departmentId: store.id }))).rejects.toThrow("does not belong");
    await expect(createWorkCenter(adminActor, input(ids, { code: "JM-003", standardRunHour: 25 }))).rejects.toThrow();
    await expect(createWorkCenter(adminActor, input(ids, { code: "JM-004", capacityPerHour: 0 }))).rejects.toThrow();
    await expect(createWorkCenter(adminActor, input(ids, { code: "JM-005", operatorIds: [operatorIds[0], operatorIds[0]] }))).rejects.toThrow();
    await expect(createMaster(adminActor, "departments", { name: "Production" })).rejects.toThrow("already exists");
    await expect(createMaster(adminActor, "sections", { name: "Snacks" })).rejects.toThrow("department");
    await expect(createWorkCenter(adminActor, input(ids, { code: "JM-006", departmentId: null, departmentSectionId: null }))).rejects.toThrow("Department is required");
  });

  it("updates with the version, replaces operators and toggles active", async () => {
    const ids = await masters();
    const created = await createWorkCenter(adminActor, input(ids));
    const updated = await updateWorkCenter(adminActor, created.id, {
      version: created.updatedAt,
      data: input(ids, { name: "Juice Maker 2", ratedCapacityPerHour: 290, operatorIds: [operatorIds[1]], warehouseId: null }),
    });
    expect(updated).toMatchObject({ name: "Juice Maker 2", ratedCapacityPerHour: 290, sectionName: "Juice", warehouseName: null, operatorCount: 1 });
    expect(updated.operators.map((operator) => operator.name)).toEqual(["Karim"]);

    await expect(updateWorkCenter(adminActor, created.id, { version: created.updatedAt, data: input(ids) })).rejects.toThrow("Someone else");

    const inactive = await setWorkCenterActive(adminActor, created.id, { version: updated.updatedAt, isActive: false });
    expect(inactive.isActive).toBe(false);
    await expect(setWorkCenterActive(adminActor, created.id, { version: updated.updatedAt, isActive: true })).rejects.toThrow("Someone else");
  });
});
