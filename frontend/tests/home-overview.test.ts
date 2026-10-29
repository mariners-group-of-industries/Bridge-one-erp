import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma/client", async () => {
  const { testPrisma } = await import("./helpers/test-db");
  return { db: testPrisma };
});
import { createBusinessUnit } from "@/features/configuration/business-config/company-profile/server/business-unit.service";
import { saveCompany } from "@/features/configuration/business-config/company-profile/server/company.service";
import { createOffice } from "@/features/configuration/business-config/company-profile/server/office.service";
import { getBusinessOverview } from "@/features/home/overview.service";
import { workspaces } from "@/lib/navigation/registry";
import { adminActor, businessUnitInput, companyInput, officeInput, scopedActor } from "./helpers/fixtures";
import { resetTestDb, startTestDb, stopTestDb, testPrisma } from "./helpers/test-db";

beforeAll(async () => {
  await startTestDb();
});
afterAll(async () => {
  await stopTestDb();
});
beforeEach(async () => {
  await resetTestDb();
});

describe("home overview", () => {
  it("builds inventory, target and customer figures from stored data only", async () => {
    await saveCompany(adminActor, companyInput);
    const unitId = (await createBusinessUnit(adminActor, businessUnitInput)).id;
    const officeId = (await createOffice(adminActor, unitId, officeInput)).id;
    const group = await testPrisma().customerGroup.create({ data: { businessUnitId: unitId, name: "Dhaka Region" } });
    await testPrisma().customer.create({ data: { businessUnitId: unitId, code: "C-1", name: "Store", customerGroupId: group.id } });
    const item = await testPrisma().item.create({ data: { businessUnitId: unitId, code: "I-1", name: "Chips", salesRate: "8.50", mrp: "10" } });
    const warehouse = await testPrisma().warehouse.create({ data: { officeId, name: "FG WH" } });
    const entry = (qty: string, source: "OPENING" | "SALES_DELIVERY" | "SALES_RETURN", day: string) =>
      testPrisma().stockEntry.create({ data: { businessUnitId: unitId, warehouseId: warehouse.id, itemId: item.id, qty, source, postingDate: new Date(day), createdBy: "test" } });
    await entry("100", "OPENING", "2026-09-01");
    await entry("-30", "SALES_DELIVERY", "2026-09-02");
    await entry("5", "SALES_RETURN", "2026-09-03");
    const person = await testPrisma().salesPerson.create({ data: { businessUnitId: unitId, code: "SP-1", name: "Rahim" } });
    const budget = await testPrisma().salesTargetBudget.create({ data: { businessUnitId: unitId, basis: "AMOUNT", year: 2026 } });
    await testPrisma().salesTarget.create({ data: { businessUnitId: unitId, budgetId: budget.id, salesPersonId: person.id, month: new Date("2026-10-01"), amount: "50000" } });

    const overview = await getBusinessOverview(adminActor);
    expect(overview.trading).toBeNull();
    expect(overview.counts).toMatchObject({ customers: 1, items: 1, warehouses: 1 });
    expect(overview.customers.byGroup).toEqual([{ name: "Dhaka Region", value: 1 }]);
    expect(overview.inventory.units).toBe(75);
    expect(overview.inventory.value).toBe(637.5);
    expect(overview.inventory.movement.map((p) => [p.outQty, p.returnQty, p.balance])).toEqual([
      [0, 0, 100],
      [30, 0, 70],
      [0, 5, 75],
    ]);
    expect(overview.targets).toEqual({ month: "2026-10", total: 50000, byPerson: [{ name: "Rahim", value: 50000 }] });
    expect(overview.finance).not.toBeNull();

    const outsider = await getBusinessOverview({ ...scopedActor([]), isMaster: false, permissions: new Set(["sales:read"]) });
    expect(outsider.counts.customers).toBe(0);
    expect(outsider.finance).toBeNull();
  });
});

describe("module order", () => {
  it("follows the agreed sidebar order", () => {
    expect(workspaces.map((w) => w.label)).toEqual(["Purchase", "Inventory", "Production", "Sales", "Account", "HRM", "Configuration", "RTM", "CRM"]);
  });
});
