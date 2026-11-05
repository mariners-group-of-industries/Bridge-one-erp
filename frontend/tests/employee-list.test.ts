import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma/client", async () => {
  const { testPrisma } = await import("./helpers/test-db");
  return { db: testPrisma };
});
import { createBusinessUnit } from "@/features/configuration/business-config/company-profile/server/business-unit.service";
import { saveCompany } from "@/features/configuration/business-config/company-profile/server/company.service";
import { createOffice } from "@/features/configuration/business-config/company-profile/server/office.service";
import { employeeListQuerySchema } from "@/features/configuration/entity-master-data/employee/schemas/employee.schema";
import { listEmployees } from "@/features/configuration/entity-master-data/employee/server/employee.service";
import { adminActor, businessUnitInput, companyInput, officeInput } from "./helpers/fixtures";
import { resetTestDb, startTestDb, stopTestDb, testPrisma } from "./helpers/test-db";

const list = async (params: Record<string, string>) =>
  (await listEmployees(adminActor, employeeListQuerySchema.parse(params))).rows.map((r) => r.employeeCode).sort();

let officeId: string;
let otherOfficeId: string;

beforeAll(async () => {
  await startTestDb();
});
afterAll(async () => {
  await stopTestDb();
});
beforeEach(async () => {
  await resetTestDb();
  await saveCompany(adminActor, companyInput);
  const unitId = (await createBusinessUnit(adminActor, businessUnitInput)).id;
  officeId = (await createOffice(adminActor, unitId, officeInput)).id;
  otherOfficeId = (await createOffice(adminActor, unitId, { ...officeInput, name: "Second Office" })).id;
  const login = await testPrisma().user.create({ data: { name: "Rahim", phone: "01700000077", passwordHash: "x" } });
  await testPrisma().employee.createMany({
    data: [
      { officeId, employeeCode: "E-1", name: "Rahim Uddin", department: "Sales", designation: "Officer", employeeType: "Permanent", mobile: "01811111111", joiningDate: new Date("2024-01-10"), userId: login.id },
      { officeId, employeeCode: "E-2", name: "Karim Mia", department: "HR", designation: "Manager", employeeType: "Contract", officialContact: "01922222222", joiningDate: new Date("2024-06-01") },
      { officeId: otherOfficeId, employeeCode: "E-3", name: "Salma Begum", department: "Sales", designation: "Manager", employeeType: "Permanent", joiningDate: new Date("2025-02-01"), isActive: false },
    ],
  });
});

describe("employee list filters", () => {
  it("finds employees by their own mobile and official contact, not only their login phone", async () => {
    expect(await list({ search: "01811111111" })).toEqual(["E-1"]);
    expect(await list({ search: "01922222222" })).toEqual(["E-2"]);
    expect(await list({ search: "01700000077" })).toEqual(["E-1"]);
  });

  it("filters by office, department, designation, type, login and status", async () => {
    expect(await list({ officeId: otherOfficeId })).toEqual(["E-3"]);
    expect(await list({ department: "Sales" })).toEqual(["E-1", "E-3"]);
    expect(await list({ designation: "Manager", department: "Sales" })).toEqual(["E-3"]);
    expect(await list({ userType: "Contract" })).toEqual(["E-2"]);
    expect(await list({ login: "yes" })).toEqual(["E-1"]);
    expect(await list({ login: "no" })).toEqual(["E-2", "E-3"]);
    expect(await list({ status: "inactive" })).toEqual(["E-3"]);
  });

  it("filters by joining date range, both ends included", async () => {
    expect(await list({ joinedFrom: "2024-06-01", joinedTo: "2025-02-01" })).toEqual(["E-2", "E-3"]);
    expect(await list({ joinedTo: "2024-01-10" })).toEqual(["E-1"]);
  });
});
