import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma/client", async () => {
  const { testPrisma } = await import("./helpers/test-db");
  return { db: testPrisma };
});
import { createBusinessUnit } from "@/features/configuration/business-config/company-profile/server/business-unit.service";
import { saveCompany } from "@/features/configuration/business-config/company-profile/server/company.service";
import { createOffice } from "@/features/configuration/business-config/company-profile/server/office.service";
import { updateCredentials } from "@/features/configuration/entity-master-data/employee/server/personal-info.service";
import { accountBlock } from "@/lib/auth/actor";
import { adminActor, businessUnitInput, companyInput, officeInput } from "./helpers/fixtures";
import { resetTestDb, startTestDb, stopTestDb, testPrisma } from "./helpers/test-db";

let employeeId: string;

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
  const officeId = (await createOffice(adminActor, unitId, officeInput)).id;
  employeeId = (await testPrisma().employee.create({ data: { officeId, employeeCode: "E-9", name: "New Joiner", joiningDate: new Date("2026-01-01") } })).id;
});

describe("employee ERP login", () => {
  it("lets an employee sign in once a login is created for them", async () => {
    await updateCredentials(employeeId, adminActor, { phone: "01700000999", password: "secret-pass", confirmPassword: "secret-pass" });
    const employee = await testPrisma().employee.findUniqueOrThrow({ where: { id: employeeId }, include: { user: true } });
    expect(employee.user?.erpAccess).toBe(true);
    expect(accountBlock(employee.user!)).toBeNull();
  });
});
