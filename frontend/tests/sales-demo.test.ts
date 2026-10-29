import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { getSalesDashboard } from "@/features/sales/dashboard/services/dashboard.service";
import { getStockLevels } from "@/features/sales/deliveries/services/stock.service";
import { createCustomer, createItem, createSalesPerson } from "@/features/sales/masters/services/masters.service";
import { clearSalesDemo, DEMO_ACTOR_ID, seedSalesDemo } from "../prisma/demo/sales-demo";
import { adminActor, businessUnitInput, companyInput, officeInput } from "./helpers/fixtures";
import { resetTestDb, startTestDb, stopTestDb } from "./helpers/test-db";

// Route database access to the per-file PGlite test database.
vi.mock("@/lib/prisma/client", async () => {
  const { testPrisma } = await import("./helpers/test-db");
  return { db: testPrisma };
});

const TODAY = "2026-10-29";

describe("sales demo data", () => {
  let prisma: PrismaClient;
  let warehouseId: string;
  let itemIds: string[];
  let otherOrderId: string;

  beforeAll(async () => {
    prisma = await startTestDb();
  });

  beforeEach(async () => {
    await resetTestDb();
    const companyId = (await prisma.company.create({ data: companyInput })).id;
    const businessUnitId = (await prisma.businessUnit.create({ data: { ...businessUnitInput, companyId } })).id;
    const officeId = (await prisma.office.create({ data: { ...officeInput, businessUnitId } })).id;
    warehouseId = (await prisma.warehouse.create({ data: { officeId, name: "FG WH" } })).id;
    const person = (await createSalesPerson(adminActor, { businessUnitId, name: "Md. Manik Miah" })).id;
    const customers = [];
    for (const name of ["Arif Enterprise", "Saleha Electric", "Rasel Store", "Bismillah Traders"]) customers.push((await createCustomer(adminActor, { businessUnitId, name, creditDays: 15, salesPersonId: person })).id);
    itemIds = [];
    for (const [name, rate] of [["Noodles", 20], ["Chips", 10], ["Chanachur", 30], ["Biscuit", 15]] as const) {
      itemIds.push((await createItem(adminActor, { businessUnitId, name, uom: "PCS", salesRate: rate })).id);
    }
    await prisma.account.create({ data: { code: "1010", name: "Cash in Hand", accountType: "ASSET", accountSubtype: "Cash", normalBalance: "DEBIT" } });
    await prisma.account.create({ data: { code: "6010", name: "Bank Charges", accountType: "EXPENSE", accountSubtype: "Finance", normalBalance: "DEBIT" } });
    // A record someone else made, which clearing must not touch.
    otherOrderId = (
      await prisma.salesQuotation.create({
        data: { businessUnitId, officeId, customerId: customers[0], number: "SQ-OTHER-1", quotationDate: new Date("2026-10-01"), validTill: new Date("2026-10-30"), createdBy: "someone-else" },
      })
    ).id;
  });

  afterAll(stopTestDb);

  it("seeds a full month through the services and clears only its own records", async () => {
    const summary = await seedSalesDemo(TODAY);
    expect(summary).toMatchObject({ quotations: expect.any(Array), orders: expect.any(Array) });
    expect(summary.quotations).toHaveLength(4);
    expect(summary.orders).toHaveLength(4);
    expect(summary.deliveries).toHaveLength(5);
    expect(summary.returns).toHaveLength(3);
    expect(summary.collections.length).toBeGreaterThanOrEqual(3);
    expect(summary.bills).toHaveLength(1);

    const statuses = await prisma.salesOrder.findMany({ where: { createdBy: DEMO_ACTOR_ID }, select: { status: true } });
    expect(statuses.map((row) => row.status).sort()).toEqual(["APPROVED", "APPROVED", "COMPLETED", "DRAFT"]);
    const board = await getSalesDashboard(adminActor, { from: "2026-10-01", to: TODAY });
    expect(board.totals.sales).toBeGreaterThan(0);
    expect(board.totals.collection).toBeGreaterThan(0);
    expect(board.topItems.length).toBeGreaterThan(0);
    await expect(seedSalesDemo(TODAY)).rejects.toThrow(/already exists/);

    const removed = await clearSalesDemo();
    expect(removed.orders).toBe(4);
    for (const table of ["salesQuotation", "salesOrder", "salesDelivery", "salesReturn", "salesCollection", "salesBill", "vehicle", "stockEntry"] as const) {

      expect(await (prisma[table] as any).count({ where: { createdBy: DEMO_ACTOR_ID } })).toBe(0);
    }
    expect((await getStockLevels(adminActor, warehouseId, itemIds)).every((row) => row.qty === 0)).toBe(true);
    expect(await prisma.salesQuotation.findUnique({ where: { id: otherOrderId } })).not.toBeNull();
    expect(await prisma.deliveryPendingReason.count({ where: { name: { endsWith: "(demo)" } } })).toBe(0);
    // And it can be seeded again afterwards.
    await expect(seedSalesDemo(TODAY)).resolves.toMatchObject({ office: expect.any(String) });
  });
});
