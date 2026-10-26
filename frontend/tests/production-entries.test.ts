import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import type { Actor, Permission } from "@/lib/auth/actor";
import { createBom } from "@/features/production/bom/services/bom.service";
import { getProductionDashboard } from "@/features/production/dashboard/services/dashboard.service";
import { entryPdf } from "@/features/production/entries/services/entry-pdf";
import { cancelEntry, createEntry, entryForm, getEntry, listEntries, listQueue } from "@/features/production/entries/services/entry.service";
import { actOnOrder, createOrder, getOrder } from "@/features/production/orders/services/order.service";
import { createMaster } from "@/features/production/work-centers/services/work-center.service";
import { stockLevels } from "@/features/sales/deliveries/services/stock.service";
import { adminActor, businessUnitInput, companyInput, officeInput, scopedActor } from "./helpers/fixtures";
import { resetTestDb, startTestDb, stopTestDb } from "./helpers/test-db";

// Route database access to the per-file PGlite test database.
vi.mock("@/lib/prisma/client", async () => {
  const { testPrisma } = await import("./helpers/test-db");
  return { db: testPrisma };
});

const OTHER_COMPANY = "00000000-0000-4000-8000-000000000000";
const actor = (id: string, permissions: Permission[]): Actor => ({ ...adminActor, id, isMaster: false, permissions: new Set(permissions) });
const operator = actor("operator", ["production:read", "production:write"]);
const manager = actor("manager", ["production:read", "production:write", "production:approve"]);

describe("production entries", () => {
  let prisma: PrismaClient;
  let ids: Record<string, string>;

  beforeAll(async () => {
    prisma = await startTestDb();
  });

  beforeEach(async () => {
    await resetTestDb();
    const companyId = (await prisma.company.create({ data: { ...companyInput, name: "Mariners Group" } })).id;
    const businessUnitId = (await prisma.businessUnit.create({ data: { ...businessUnitInput, companyId } })).id;
    const officeId = (await prisma.office.create({ data: { ...officeInput, businessUnitId } })).id;
    const rmStore = (await prisma.warehouse.create({ data: { officeId, name: "RM Store" } })).id;
    const fgStore = (await prisma.warehouse.create({ data: { officeId, name: "FG Store" } })).id;
    const parent = await prisma.itemCategory.create({ data: { businessUnitId, level: 1, name: "Snacks" } });
    const child = await prisma.itemCategory.create({ data: { businessUnitId, level: 2, name: "Chips", parentId: parent.id } });
    const item = async (code: string, name: string, uom = "KG", categoryId?: string) =>
      (await prisma.item.create({ data: { businessUnitId, code, name, uom, categoryId } })).id;
    ids = {
      businessUnitId,
      officeId,
      rmStore,
      fgStore,
      chips: await item("SFG-00658", "SFGSNCHIPS", "KG", child.id),
      potato: await item("RM-00529", "Potato Pallet"),
      oil: await item("RM-00100", "Palm Oil", "LTR"),
    };
    const opening = (itemId: string, qty: number) =>
      prisma.stockEntry.create({ data: { businessUnitId, warehouseId: rmStore, itemId, qty, source: "OPENING", postingDate: new Date("2026-10-01"), createdBy: "test" } });
    await opening(ids.potato, 500);
    await opening(ids.oil, 50);
    const department = await createMaster(adminActor, "departments", { name: "Production" });
    const section = await createMaster(adminActor, "sections", { name: "Snacks", departmentId: department.id });
    ids.department = department.id;
    ids.section = section.id;
    // 100 KG chips per lot: 100 KG potato (80 + 25%) at 20, 10 LTR oil at 150 → 3,500 per lot.
    const bom = await createBom(adminActor, {
      name: "SFGSNCHIPS",
      bomType: "SINGLE_OUTPUT",
      departmentId: department.id,
      departmentSectionId: section.id,
      outputs: [{ itemId: ids.chips, outputType: "SEMI_FINISHED_GOODS", netWeight: 1, lotSizeQty: 100, costPercent: 100 }],
      materials: [
        { itemId: ids.potato, qty: 80, wastagePercent: 25, rate: 20, excludeFromScrap: false },
        { itemId: ids.oil, qty: 10, wastagePercent: 0, rate: 150, excludeFromScrap: false },
      ],
    });
    const order = await createOrder(manager, {
      orderDate: "2026-10-21",
      productionDate: "2026-10-21",
      itemId: ids.chips,
      bomId: bom.id,
      quantity: 200,
      officeId,
      warehouseId: rmStore,
    });
    ids.pending = (await createOrder(manager, { orderDate: "2026-10-21", productionDate: "2026-10-21", itemId: ids.chips, bomId: bom.id, quantity: 5, officeId, warehouseId: rmStore })).id;
    await actOnOrder(manager, order.id, { version: order.updatedAt, action: "approve" });
    ids.order = order.id;
  });

  afterAll(stopTestDb);

  const input = (overrides: Record<string, unknown> = {}) => ({
    orderId: ids.order,
    entryDate: "2026-10-22",
    shift: "Morning",
    departmentId: ids.department,
    departmentSectionId: ids.section,
    outputWarehouseId: ids.fgStore,
    totalQty: 120,
    rejectQty: 20,
    hours: 6,
    materials: [
      { itemId: ids.potato, actualQty: 125, wastageQty: 3, scrapQty: 2 },
      { itemId: ids.oil, actualQty: 12 },
    ],
    ...overrides,
  });

  it("posts an entry: consumes materials, adds output to stock and moves the order on", async () => {
    expect((await listQueue(operator, {})).map((row) => [row.number, row.remainingQty])).toEqual([["PRO-MG260000001", 200]]);
    const form = await entryForm(operator, ids.order);
    expect(form.materials.map((line) => [line.code, line.perUnit, line.rate, line.stock])).toEqual([
      ["RM-00529", 1, 20, 500],
      ["RM-00100", 0.1, 150, 50],
    ]);
    await expect(entryForm(operator, ids.pending)).rejects.toThrow("not open");

    const entry = await createEntry(operator, input());
    // standard for 120: potato 120, oil 12 → 2,400 + 1,800 = 4,200; actual 125 × 20 + 12 × 150 = 4,300
    expect(entry).toMatchObject({
      number: "PE-MG260000001",
      status: "POSTED",
      totalQty: 120,
      rejectQty: 20,
      netQty: 100,
      excessQty: 0,
      netWeight: 100,
      standardCost: 4200,
      actualCost: 4300,
      variance: 100,
      departmentName: "Production",
      sectionName: "Snacks",
      categoryName: "Snacks",
      subCategoryName: "Chips",
      shift: "Morning",
      canCancel: true,
    });
    expect(entry.materials.map((line) => [line.code, line.standardQty, line.actualQty, line.varianceQty])).toEqual([
      ["RM-00529", 120, 125, 5],
      ["RM-00100", 12, 12, 0],
    ]);
    expect(Object.fromEntries(await stockLevels(ids.rmStore, [ids.potato, ids.oil]))).toEqual({ [ids.potato]: 375, [ids.oil]: 38 });
    expect((await stockLevels(ids.fgStore, [ids.chips])).get(ids.chips)).toBe(100);

    const order = await getOrder(operator, ids.order);
    expect(order).toMatchObject({ status: "IN_PROGRESS", producedQty: 100, remainingQty: 100, producedValue: 3500 });
    expect(order.materials.map((line) => [line.code, line.usedQty, line.remainingQty])).toEqual([
      ["RM-00529", 125, 75],
      ["RM-00100", 12, 8],
    ]);

    expect(await listEntries(operator, { from: "2026-10-01", to: "2026-10-31", departmentSectionId: ids.section })).toHaveLength(1);
    expect(await listEntries(operator, { search: "PRO-MG260000001" })).toHaveLength(1);
    expect(await listEntries(scopedActor([OTHER_COMPANY]), {})).toHaveLength(0);
    const dashboard = await getProductionDashboard(operator, { from: "2026-10-01", to: "2026-10-31" });
    expect(dashboard).toMatchObject({ volume: 120, hours: 6, entries: 1 });
    expect(Buffer.from((await entryPdf(operator, entry.id)).bytes.slice(0, 5)).toString()).toBe("%PDF-");
  });

  it("closes the order when fully produced and records the excess", async () => {
    await createEntry(operator, input());
    const last = await createEntry(operator, input({ totalQty: 130, rejectQty: 0, materials: [{ itemId: ids.potato, actualQty: 130 }, { itemId: ids.oil, actualQty: 13 }] }));
    expect(last).toMatchObject({ number: "PE-MG260000002", netQty: 130, excessQty: 30 });
    expect(await getOrder(operator, ids.order)).toMatchObject({ status: "CLOSED", producedQty: 230, remainingQty: 0 });
    expect(await listQueue(operator, {})).toHaveLength(0);
    await expect(createEntry(operator, input())).rejects.toThrow("not open");
  });

  it("refuses short stock, wrong materials and bad quantities", async () => {
    await expect(createEntry(operator, input({ materials: [{ itemId: ids.potato, actualQty: 600 }, { itemId: ids.oil, actualQty: 1 }] }))).rejects.toThrow("Not enough stock");
    await expect(createEntry(operator, input({ materials: [{ itemId: ids.potato, actualQty: 1 }] }))).rejects.toThrow("exactly the materials");
    await expect(createEntry(operator, input({ rejectQty: 200 }))).rejects.toThrow();
    await expect(createEntry(operator, input({ totalQty: 0 }))).rejects.toThrow();
    await expect(createEntry(operator, input({ entryDate: "2026-10-20" }))).rejects.toThrow("before the order date");
    await expect(createEntry(operator, input({ materials: [{ itemId: ids.potato, actualQty: 10, wastageQty: 8, scrapQty: 5 }, { itemId: ids.oil, actualQty: 1 }] }))).rejects.toThrow();
    await expect(createEntry(operator, input({ orderId: ids.pending }))).rejects.toThrow("not open");
    expect((await stockLevels(ids.rmStore, [ids.potato])).get(ids.potato)).toBe(500);
  });

  it("cancels an entry: stock and the order go back, a closed order reopens", async () => {
    await createEntry(operator, input());
    const closing = await createEntry(operator, input({ totalQty: 100, rejectQty: 0, materials: [{ itemId: ids.potato, actualQty: 100 }, { itemId: ids.oil, actualQty: 10 }] }));
    expect((await getOrder(operator, ids.order)).status).toBe("CLOSED");

    const cancelled = await cancelEntry(operator, closing.id, { version: closing.updatedAt, reason: "Wrong batch" });
    expect(cancelled).toMatchObject({ status: "CANCELLED", cancelReason: "Wrong batch", canCancel: false });
    expect(Object.fromEntries(await stockLevels(ids.rmStore, [ids.potato, ids.oil]))).toEqual({ [ids.potato]: 375, [ids.oil]: 38 });
    expect((await stockLevels(ids.fgStore, [ids.chips])).get(ids.chips)).toBe(100);
    expect(await getOrder(operator, ids.order)).toMatchObject({ status: "IN_PROGRESS", producedQty: 100 });
    expect((await getOrder(operator, ids.order)).materials[0].usedQty).toBe(125);
    await expect(cancelEntry(operator, closing.id, { version: cancelled.updatedAt, reason: "again" })).rejects.toThrow("already cancelled");

    // Output already moved out of the warehouse cannot be taken back.
    const first = (await listEntries(operator, { status: "POSTED" }))[0];
    await prisma.stockEntry.create({
      data: { businessUnitId: ids.businessUnitId, warehouseId: ids.fgStore, itemId: ids.chips, qty: -100, source: "ADJUSTMENT", postingDate: new Date("2026-10-23"), createdBy: "test" },
    });
    await expect(cancelEntry(operator, first.id, { version: first.updatedAt, reason: "x" })).rejects.toThrow("Not enough stock");
    expect((await getEntry(operator, first.id)).status).toBe("POSTED");
    expect((await getProductionDashboard(operator, { from: "2026-10-01", to: "2026-10-31" })).volume).toBe(120);
  });
});
