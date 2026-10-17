import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { getProductionDashboard } from "@/features/production/dashboard/services/dashboard.service";
import { businessUnitInput, companyInput, officeInput, adminActor, scopedActor } from "./helpers/fixtures";
import { resetTestDb, startTestDb, stopTestDb } from "./helpers/test-db";

// Route database access to the per-file PGlite test database.
vi.mock("@/lib/prisma/client", async () => {
  const { testPrisma } = await import("./helpers/test-db");
  return { db: testPrisma };
});

const OTHER_COMPANY = "00000000-0000-4000-8000-000000000000";
const day = (value: string) => new Date(`${value}T00:00:00.000Z`);

describe("production dashboard", () => {
  let prisma: PrismaClient;

  beforeAll(async () => {
    prisma = await startTestDb();
  });

  beforeEach(async () => {
    await resetTestDb();
    const companyId = (await prisma.company.create({ data: companyInput })).id;
    const businessUnitId = (await prisma.businessUnit.create({ data: { ...businessUnitInput, companyId } })).id;
    const officeId = (await prisma.office.create({ data: { ...officeInput, businessUnitId } })).id;
    const bu = { businessUnitId };
    const item = (code: string, name: string) => prisma.item.create({ data: { ...bu, code, name, uom: "PCS", salesRate: 10 } });
    const chanachur = await item("FGSN230207", "Peawal Bar-B-Q Biriyani Chanachur 12gm");
    const chips = await item("FGCHIPS240613", "Marine Potato Chips 12gm");
    const typeId = (await prisma.productionWorkCenterType.create({ data: { ...bu, name: "Finished Goods" } })).id;
    const capacity = { typeId, standardRunHour: 16, capacityPerHour: 1500, ratedCapacityPerHour: 1400 };
    const lineA = await prisma.productionWorkCenter.create({ data: { ...bu, ...capacity, officeId, code: "M-01", name: "Fryer Line A" } });
    const lineB = await prisma.productionWorkCenter.create({ data: { ...bu, ...capacity, officeId, code: "M-02", name: "Packing Line B" } });
    let serial = 0;
    const entry = (itemId: string, workCenterId: string | null, date: string, qty: number, hours: number) =>
      prisma.productionEntry.create({ data: { ...bu, officeId, number: `PE-${++serial}`, itemId, workCenterId, productionDate: day(date), qty, hours } });
    await entry(chanachur.id, lineA.id, "2026-10-02", 12_000, 8);
    await entry(chanachur.id, lineA.id, "2026-10-03", 9_000, 6);
    await entry(chips.id, lineB.id, "2026-10-03", 4_000, 8);
    await entry(chips.id, null, "2026-10-04", 1_000, 0);
    await entry(chips.id, lineB.id, "2026-09-30", 50_000, 10); // before the range
  });

  afterAll(stopTestDb);

  it("adds up output, productivity and the top items and machines in the range", async () => {
    const dashboard = await getProductionDashboard(adminActor, { from: "2026-10-01", to: "2026-10-14" });
    expect(dashboard).toMatchObject({ volume: 26_000, hours: 22, entries: 4 });
    expect(dashboard.productivity).toBeCloseTo(1181.82, 2);
    expect(dashboard.topItems.map((row) => [row.code, row.qty])).toEqual([
      ["FGSN230207", 21_000],
      ["FGCHIPS240613", 5_000],
    ]);
    expect(dashboard.topWorkCenters).toEqual([
      expect.objectContaining({ name: "Fryer Line A", qty: 21_000, hours: 14, productivity: 1500 }),
      expect.objectContaining({ name: "Packing Line B", qty: 4_000, productivity: 500 }),
    ]);
    await expect(getProductionDashboard(adminActor, { from: "2026-10-14", to: "2026-10-01" })).rejects.toThrow();
    expect((await getProductionDashboard(scopedActor([OTHER_COMPANY]), { from: "2026-10-01", to: "2026-10-14" })).volume).toBe(0);
  });
});
