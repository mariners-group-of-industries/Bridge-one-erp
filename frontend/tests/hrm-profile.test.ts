import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma/client", async () => {
  const { testPrisma } = await import("./helpers/test-db");
  return { db: testPrisma };
});
import { createBusinessUnit } from "@/features/configuration/business-config/company-profile/server/business-unit.service";
import { saveCompany } from "@/features/configuration/business-config/company-profile/server/company.service";
import { createOffice } from "@/features/configuration/business-config/company-profile/server/office.service";
import { getMyProfile } from "@/features/hrm/self-service/profile/server/profile.service";
import { adminActor, businessUnitInput, companyInput, officeInput } from "./helpers/fixtures";
import { resetTestDb, startTestDb, stopTestDb, testPrisma } from "./helpers/test-db";

let userId: string;
let otherUserId: string;

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
  userId = (await testPrisma().user.create({ data: { name: "Rahim", phone: "01700000077", passwordHash: "x" } })).id;
  otherUserId = (await testPrisma().user.create({ data: { name: "Salma", phone: "01700000078", passwordHash: "x" } })).id;
  const base = { officeId, joiningDate: new Date("2024-03-15") };
  await testPrisma().employee.create({ data: { ...base, employeeCode: "E-1", name: "Rahim Uddin", designation: "Officer", department: "Sales", employeeType: "Permanent", supervisor: "Karim", userId } });
  await testPrisma().employee.create({ data: { ...base, employeeCode: "E-2", name: "Salma Begum", userId: otherUserId } });
});

describe("HRM self-service profile", () => {
  it("shows a signed-in employee only their own record", async () => {
    const mine = await getMyProfile({ ...adminActor, id: userId, isMaster: false });
    expect(mine).toEqual({
      rows: [{ id: expect.any(String), code: "E-1", name: "Rahim Uddin", designation: "Officer", department: "Sales", employeeType: "Permanent", joiningDate: "2024-03-15", supervisor: "Karim" }],
    });
    // Someone without a linked employee (or an API token) sees nothing.
    expect((await getMyProfile({ ...adminActor, id: "token:abc", isMaster: false })).rows).toEqual([]);
  });

  it("shows a different record for each login, and none for an unlinked master account", async () => {
    expect((await getMyProfile({ ...adminActor, id: otherUserId, isMaster: false })).rows.map((r) => r.code)).toEqual(["E-2"]);
    expect((await getMyProfile(adminActor)).rows).toEqual([]);
  });
});
