import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import type { Actor, Permission } from "@/lib/auth/actor";
import { createBom } from "@/features/production/bom/services/bom.service";
import { createEntry } from "@/features/production/entries/services/entry.service";
import { actOnOrder, createOrder } from "@/features/production/orders/services/order.service";
import { reportExcel, reportPdf } from "@/features/production/reports/services/report-export";
import { getReport, reportLookups } from "@/features/production/reports/services/report.service";
import { createMaster, createWorkCenter } from "@/features/production/work-centers/services/work-center.service";
import { adminActor, businessUnitInput, companyInput, officeInput, scopedActor } from "./helpers/fixtures";
import { resetTestDb, startTestDb, stopTestDb } from "./helpers/test-db";

// Route database access to the per-file PGlite test database.
vi.mock("@/lib/prisma/client", async () => {
  const { testPrisma } = await import("./helpers/test-db");
  return { db: testPrisma };
});

const OTHER_COMPANY = "00000000-0000-4000-8000-000000000000";
const actor = (id: string, permissions: Permission[]): Actor => ({ ...adminActor, id, isMaster: false, permissions: new Set(permissions) });
const manager = actor("manager", ["production:read", "production:write", "production:approve"]);
const range = { from: "2026-10-20", to: "2026-10-23" };

describe("production reports", () => {
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
    const store = (await prisma.warehouse.create({ data: { officeId, name: "Factory Store" } })).id;
    const item = async (code: string, name: string, uom = "KG", itemType?: string) => (await prisma.item.create({ data: { businessUnitId, code, name, uom, itemType } })).id;
    const chips = await item("SFG-00658", "SFGSNCHIPS");
    const potato = await item("RM-00529", "Potato Pallet", "KG", "Raw Material");
    const pouch = await item("PM-00001", "Chips Pouch", "PCS", "Packaging Material");
    for (const [itemId, qty] of [
      [potato, 1000],
      [pouch, 5000],
    ] as const) {
      await prisma.stockEntry.create({ data: { businessUnitId, warehouseId: store, itemId, qty, source: "OPENING", postingDate: new Date("2026-10-01"), createdBy: "test" } });
    }
    const department = await createMaster(adminActor, "departments", { name: "Production" });
    const section = await createMaster(adminActor, "sections", { name: "Snacks", departmentId: department.id });
    const type = await createMaster(adminActor, "types", { name: "Finished Goods" });
    const fryer = await createWorkCenter(adminActor, {
      name: "Fryer",
      typeId: type.id,
      code: "FR-01",
      standardRunHour: 10,
      capacityPerHour: 20,
      ratedCapacityPerHour: 20,
      departmentId: department.id,
      departmentSectionId: section.id,
    });
    const account = await prisma.account.create({ data: { code: "5200", name: "Power", accountType: "EXPENSE", accountSubtype: "OPERATING_EXPENSE", normalBalance: "DEBIT" } });
    // 100 KG per lot: 100 KG potato at 20 + 200 pouches at 1 → 2,200 material + 300 overhead.
    const bom = await createBom(adminActor, {
      name: "SFGSNCHIPS",
      bomType: "SINGLE_OUTPUT",
      outputs: [{ itemId: chips, outputType: "SEMI_FINISHED_GOODS", netWeight: 1, lotSizeQty: 100, costPercent: 100 }],
      materials: [
        { itemId: potato, qty: 100, wastagePercent: 0, rate: 20 },
        { itemId: pouch, qty: 200, wastagePercent: 0, rate: 1 },
      ],
      overheads: [{ accountId: account.id, amount: 300 }],
    });
    const order = await createOrder(manager, { orderDate: "2026-10-20", productionDate: "2026-10-20", itemId: chips, bomId: bom.id, quantity: 500, officeId, warehouseId: store, workCenterId: fryer.id });
    await actOnOrder(manager, order.id, { version: order.updatedAt, action: "approve" });
    const entry = (entryDate: string, shift: string, totalQty: number, rejectQty: number, hours: number, potatoQty: number, remarks?: string) =>
      createEntry(manager, {
        orderId: order.id,
        entryDate,
        shift: shift as "Morning",
        workCenterId: fryer.id,
        departmentId: department.id,
        departmentSectionId: section.id,
        outputWarehouseId: store,
        totalQty,
        rejectQty,
        hours,
        remarks,
        materials: [
          { itemId: potato, actualQty: potatoQty },
          { itemId: pouch, actualQty: totalQty * 2 },
        ],
      });
    await entry("2026-10-21", "Morning", 100, 10, 6, 105, "Oil change");
    await entry("2026-10-21", "Night", 50, 0, 3, 50);
    await entry("2026-10-22", "Morning", 80, 0, 4, 80);
    // Demand: a confirmed sales order for 400 KG chips.
    const customerId = (await prisma.customer.create({ data: { businessUnitId, code: "C-1", name: "Retailer" } })).id;
    await prisma.salesOrder.create({
      data: {
        businessUnitId,
        officeId,
        number: "SO-1",
        customerId,
        status: "APPROVED",
        orderDate: new Date("2026-10-20"),
        expectedDeliveryDate: new Date("2026-10-30"),
        createdBy: "test",
        updatedBy: "test",
        lines: { create: [{ lineNo: 1, itemId: chips, uom: "KG", qty: 400, unitPrice: 50, grossAmount: 20_000, lineTotal: 20_000, baseAmount: 20_000, vatAmount: 0, aitAmount: 0 }] },
      },
    });
    ids = { chips, potato, pouch, section: section.id, fryer: fryer.id, bom: bom.id, department: department.id };
  });

  afterAll(stopTestDb);

  const report = (viewBy: string, extra: Record<string, unknown> = {}) => getReport(manager, { viewBy, ...range, ...extra });

  it("production report per entry and as an item summary", async () => {
    const detail = await report("production");
    expect(detail).toMatchObject({ title: "Production Report", company: "Mariners Group" });
    expect(detail.subtitle).toContain("From: 20-10-2026  To: 23-10-2026");
    expect(detail.rows.map((row) => [row.entry, row.shift, row.planned, row.actual, row.variance, row.value])).toEqual([
      ["PE-MG260000001", "Morning", 100, 90, -10, 2250],
      ["PE-MG260000002", "Night", 50, 50, 0, 1250],
      ["PE-MG260000003", "Morning", 80, 80, 0, 2000],
    ]);
    expect(detail.totals).toMatchObject({ planned: 230, actual: 220, variance: -10, value: 5500 });

    const summary = await report("production", { summary: "true" });
    expect(summary.rows).toEqual([expect.objectContaining({ item: "SFG-00658 - SFGSNCHIPS", entries: 3, planned: 230, actual: 220 })]);
    expect((await report("production", { filterBy: "bom", bomId: ids.bom })).rows).toHaveLength(3);
    expect((await report("production", { filterBy: "item", itemId: ids.potato })).rows).toHaveLength(0);
    expect((await getReport(scopedActor([OTHER_COMPANY]), { viewBy: "production", ...range })).rows).toHaveLength(0);
  });

  it("consumption against the BOM, with the variance and monthly options", async () => {
    const consumption = await report("consumption");
    expect(consumption.rows.map((row) => [row.item, row.standard, row.consumed, row.variance, row.variancePct, row.actualCost])).toEqual([
      ["PM-00001 - Chips Pouch", 460, 460, 0, 0, 460],
      ["RM-00529 - Potato Pallet", 230, 235, 5, 2.17, 4700],
    ]);
    expect((await report("consumption", { materialsVariance: "true" })).rows.map((row) => row.item)).toEqual(["RM-00529 - Potato Pallet"]);
    expect((await report("consumption", { itemType: "Packaging Material" })).rows).toHaveLength(1);
    expect((await report("consumption", { monthly: "true" })).rows[0]).toMatchObject({ month: "2026-10" });
  });

  it("performance, utilization and downtime from run hours and work center capacity", async () => {
    const performance = await report("performance");
    // 2 production days × 10 standard hours = 20 operating; 13 run; 230 produced ÷ (20/h × 13 h) = 88.46%
    expect(performance.rows).toEqual([expect.objectContaining({ workCenter: "FR-01 - Fryer", operating: 20, run: 13, downtime: 7, produced: 230, efficiency: 88.46 })]);
    expect((await report("performance", { shiftWise: "true" })).rows.map((row) => [row.shift, row.run, row.operating])).toEqual([
      ["Morning", 10, null],
      ["Night", 3, null],
    ]);

    const utilization = await report("utilization");
    // 4 days × 10 h = 40 available, 13 run → 32.5%
    expect(utilization.rows).toEqual([expect.objectContaining({ activeDays: 2, available: 40, run: 13, utilization: 32.5, capacity: 260, produced: 230 })]);

    const downtime = await report("downtime");
    expect(downtime.rows.map((row) => [row.date, row.run, row.downtime, row.reason])).toEqual([
      ["2026-10-20", 0, 10, "No production recorded"],
      ["2026-10-21", 9, 1, "Short run (reason not recorded)"],
      ["2026-10-22", 4, 6, "Short run (reason not recorded)"],
      ["2026-10-23", 0, 10, "No production recorded"],
    ]);
    await expect(getReport(manager, { viewBy: "downtime", from: "2026-01-01", to: "2026-10-23" })).rejects.toThrow("62 days");
  });

  it("process and date wise, details, details view, demand and COGS", async () => {
    const pivot = await report("process-date");
    expect(pivot.columns.map((column) => column.label)).toEqual(["Process / Work Center", "Item", "UoM", "20-10", "21-10", "22-10", "23-10", "Total"]);
    expect(pivot.rows[0]).toMatchObject({ process: "FR-01 - Fryer", "d2026-10-21": 140, "d2026-10-22": 80, total: 220 });

    const details = await report("details");
    expect(details.rows[0]).toMatchObject({ order: "PRO-MG260000001", lotSize: 100, orderQty: 500, total: 100, reject: 10, net: 90 });

    const view = await report("details-view");
    expect(view.rows.map((row) => [row.date, row.shift, row.net, row.remarks])).toEqual([
      ["2026-10-21", "Morning", 90, "Oil change"],
      ["2026-10-21", "Night", 50, "—"],
      ["2026-10-22", "Morning", 80, "—"],
    ]);

    const demand = await report("demand");
    expect(demand.rows).toEqual([expect.objectContaining({ demand: 400, planned: 500, produced: 220, gap: 180, fulfilment: 55 })]);

    const cogs = await report("cogs");
    // Entry 1: potato 105 × 20 = 2,100; pouches 200 × 1 = 200; overhead 3 per unit × 90 = 270 → 2,570 for 90 units
    expect(cogs.rows[0]).toMatchObject({ material: 2100, packaging: 200, overhead: 270, cogs: 2570, unitCost: 28.5556 });

    const lookups = await reportLookups(manager);
    expect(lookups).toMatchObject({ company: "Mariners Group", workCenters: [expect.objectContaining({ code: "FR-01" })] });
    expect(lookups.itemTypes).toContain("Packaging Material");
  });

  it("exports Excel and PDF", async () => {
    const excel = await reportExcel(manager, { viewBy: "consumption", ...range });
    expect(excel.name).toBe("consumption-report.xlsx");
    expect(Buffer.from(excel.bytes.slice(0, 2)).toString()).toBe("PK");
    const pdf = await reportPdf(manager, { viewBy: "process-date", ...range });
    expect(Buffer.from(pdf.bytes.slice(0, 5)).toString()).toBe("%PDF-");
    const empty = await reportPdf(manager, { viewBy: "production", from: "2025-01-01", to: "2025-01-31" });
    expect(Buffer.from(empty.bytes.slice(0, 5)).toString()).toBe("%PDF-");
  });
});
