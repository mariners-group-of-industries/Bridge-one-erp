import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { bomDetailPdf, bomListExcel, bomListPdf } from "@/features/production/bom/services/bom-export";
import {
  bomLookups,
  bomOptions,
  createBom,
  deleteBom,
  getBom,
  listBoms,
  setBomActive,
  setBomChildren,
  updateBom,
} from "@/features/production/bom/services/bom.service";
import { createMaster } from "@/features/production/work-centers/services/work-center.service";
import { adminActor, businessUnitInput, companyInput, officeInput, scopedActor } from "./helpers/fixtures";
import { resetTestDb, startTestDb, stopTestDb } from "./helpers/test-db";

// Route database access to the per-file PGlite test database.
vi.mock("@/lib/prisma/client", async () => {
  const { testPrisma } = await import("./helpers/test-db");
  return { db: testPrisma };
});

const OTHER_COMPANY = "00000000-0000-4000-8000-000000000000";

describe("production bill of material", () => {
  let prisma: PrismaClient;
  let ids: Record<string, string>;

  beforeAll(async () => {
    prisma = await startTestDb();
  });

  beforeEach(async () => {
    await resetTestDb();
    const companyId = (await prisma.company.create({ data: companyInput })).id;
    const businessUnitId = (await prisma.businessUnit.create({ data: { ...businessUnitInput, companyId } })).id;
    const officeId = (await prisma.office.create({ data: { ...officeInput, businessUnitId } })).id;
    const warehouseId = (await prisma.warehouse.create({ data: { officeId, name: "RM Store" } })).id;
    const item = async (code: string, name: string, extra: Record<string, unknown> = {}) =>
      (await prisma.item.create({ data: { businessUnitId, code, name, uom: "KG", ...extra } })).id;
    ids = {
      businessUnitId,
      biscuit: await item("FG-001", "Peawal Lexus Biscuits", { uom: "PCS", netWeight: 0.05, altUom: "CTN", altUomFactor: 24 }),
      crumbs: await item("SFG-001", "Biscuit Crumbs"),
      flour: await item("RM-001", "Wheat Flour", { purchasePrice: 60, itemType: "Raw Material", altUom: "BAG", altUomFactor: 50 }),
      sugar: await item("RM-002", "Sugar", { purchasePrice: 120 }),
      wrapper: await item("PM-001", "Wrapper", { uom: "PCS", purchasePrice: 0.5, itemType: "Packaging Material" }),
    };
    await prisma.stockEntry.create({
      data: { businessUnitId, warehouseId, itemId: ids.flour, qty: 500, source: "OPENING", postingDate: new Date("2026-10-01"), createdBy: "test" },
    });
    const department = await createMaster(adminActor, "departments", { name: "Production" });
    const section = await createMaster(adminActor, "sections", { name: "Biscuit & Cookies", departmentId: department.id });
    ids.department = department.id;
    ids.section = section.id;
    const account = (code: string, name: string, accountType: string) =>
      prisma.account.create({ data: { code, name, accountType, accountSubtype: "OPERATING_EXPENSE", normalBalance: "DEBIT" } });
    ids.power = (await account("5200", "Electricity, Fuel & Utilities", "EXPENSE")).id;
    ids.labour = (await account("5300", "Salaries, Overtime & Allowances", "EXPENSE")).id;
    ids.cash = (await account("1110", "Cash in Hand", "ASSET")).id;
  });

  afterAll(stopTestDb);

  const input = (overrides: Record<string, unknown> = {}) => ({
    name: "Lexus Biscuit BOM",
    bomType: "SINGLE_OUTPUT",
    departmentId: ids.department,
    departmentSectionId: ids.section,
    tolerancePercent: 2,
    outputs: [{ itemId: ids.biscuit, outputType: "FINISHED_GOODS", netWeight: 0.05, lotSizeQty: 1000, costPercent: 100 }],
    materials: [
      { itemId: ids.flour, qty: 40, wastagePercent: 2.5, rate: 60, excludeFromScrap: false },
      { itemId: ids.sugar, qty: 10, wastagePercent: 0, rate: 120, excludeFromScrap: false },
      { itemId: ids.wrapper, qty: 1000, wastagePercent: 1, rate: 0.5, excludeFromScrap: true },
    ],
    wastages: [{ itemId: ids.crumbs, outputType: "BY_PRODUCT", ratioPercent: 2, isMandatory: true, calcWithNetWeight: true }],
    overheads: [
      { accountId: ids.power, amount: 150 },
      { accountId: ids.labour, percentage: 10 },
    ],
    ...overrides,
  });

  it("stores lines and recomputes every total on the server", async () => {
    const bom = await createBom(adminActor, input());
    // flour 40 × 1.025 = 41 × 60 = 2460; sugar 10 × 120 = 1200; wrapper 1010 × 0.5 = 505
    // overheads: power 150 fixed + labour 10% of 4165 = 416.50
    expect(bom).toMatchObject({
      name: "Lexus Biscuit BOM",
      bomType: "SINGLE_OUTPUT",
      departmentName: "Production",
      sectionName: "Biscuit & Cookies",
      lotSize: 1000,
      tolerancePercent: 2,
      materialCost: 4165,
      overheadCost: 566.5,
      totalCost: 4731.5,
      isActive: true,
    });
    expect(bom.outputLines).toEqual([expect.objectContaining({ code: "FG-001", totalWeight: 50, costPercent: 100 })]);
    expect(bom.materials.map((line) => [line.code, line.totalQty, line.amount, line.altQty, line.materialType])).toEqual([
      ["RM-001", 41, 2460, 0.8, "Raw Material"],
      ["RM-002", 10, 1200, null, null],
      ["PM-001", 1010, 505, null, "Packaging Material"],
    ]);
    // 2% of the output net weight (0.05 × 1000 = 50) = 1
    expect(bom.wastages).toEqual([
      expect.objectContaining({ code: "SFG-001", uom: "KG", outputType: "BY_PRODUCT", ratioPercent: 2, isMandatory: true, calcWithNetWeight: true, calcWithProcessRunner: false, expectedQty: 1 }),
    ]);
    expect(bom.overheads).toEqual([
      { accountId: ids.power, accountCode: "5200", accountName: "Electricity, Fuel & Utilities", percentage: null, amount: 150 },
      { accountId: ids.labour, accountCode: "5300", accountName: "Salaries, Overtime & Allowances", percentage: 10, amount: 416.5 },
    ]);

    const rows = await listBoms(adminActor, { departmentSectionId: ids.section, status: "ACTIVE" });
    expect(rows).toHaveLength(1);
    expect(rows[0].outputs[0]).toMatchObject({ code: "FG-001", uom: "PCS", altUom: "CTN" });
    expect(await listBoms(adminActor, { search: "lexus" })).toHaveLength(1);
    expect(await listBoms(adminActor, { search: "FG-001" })).toHaveLength(1);
    expect(await listBoms(adminActor, { status: "INACTIVE" })).toHaveLength(0);
    expect(await listBoms(scopedActor([OTHER_COMPANY]), {})).toHaveLength(0);
    await expect(getBom(scopedActor([OTHER_COMPANY]), bom.id)).rejects.toThrow("not found");
  });

  it("rejects bad payloads and duplicate names", async () => {
    await createBom(adminActor, input());
    await expect(createBom(adminActor, input({ name: "lexus biscuit bom" }))).rejects.toThrow("already exists");
    await expect(createBom(adminActor, input({ name: " " }))).rejects.toThrow();
    const two = [
      { itemId: ids.biscuit, outputType: "FINISHED_GOODS", netWeight: 0.05, lotSizeQty: 900, costPercent: 90 },
      { itemId: ids.crumbs, outputType: "SEMI_FINISHED_GOODS", netWeight: 1, lotSizeQty: 10, costPercent: 5 },
    ];
    await expect(createBom(adminActor, input({ name: "A", outputs: two, wastages: [] }))).rejects.toThrow(); // single with two outputs
    await expect(createBom(adminActor, input({ name: "B", bomType: "MULTIPLE_OUTPUT", outputs: two, wastages: [] }))).rejects.toThrow("add up to 100");
    await expect(createBom(adminActor, input({ name: "C", materials: [{ itemId: ids.biscuit, qty: 1, wastagePercent: 0, rate: 1 }] }))).rejects.toThrow("own input");
    await expect(createBom(adminActor, input({ name: "D", materials: [] }))).rejects.toThrow();
    await expect(createBom(adminActor, input({ name: "E", materials: [{ itemId: ids.flour, qty: 1, wastagePercent: 100, rate: 1 }] }))).rejects.toThrow();
    await expect(createBom(adminActor, input({ name: "F", overheads: [{ accountId: ids.cash, amount: 10 }] }))).rejects.toThrow("expense account");
    await expect(createBom(adminActor, input({ name: "G", overheads: [{ accountId: ids.power }] }))).rejects.toThrow("percentage or an amount");
    await expect(createBom(adminActor, input({ name: "H", overheads: [{ accountId: ids.power, amount: 1 }, { accountId: ids.power, percentage: 5 }] }))).rejects.toThrow("added twice");
    await expect(createBom(adminActor, input({ name: "I", wastages: [{ itemId: ids.crumbs, outputType: "SCRAP", ratioPercent: 0 }] }))).rejects.toThrow();
    // 5% of the material quantity after wastage (41 + 10 + 1010 = 1061)
    const scrap = await createBom(adminActor, input({ name: "J", wastages: [{ itemId: ids.crumbs, outputType: "SCRAP", ratioPercent: 5 }] }));
    expect(scrap.wastages[0]).toMatchObject({ outputType: "SCRAP", calcWithNetWeight: false, expectedQty: 53.05 });

    const multi = await createBom(adminActor, input({ name: "Multi", bomType: "MULTIPLE_OUTPUT", wastages: [], outputs: [two[0], { ...two[1], costPercent: 10 }] }));
    expect(multi.lotSize).toBe(910);
  });

  it("updates with the version, toggles status and refuses stale writes", async () => {
    const bom = await createBom(adminActor, input());
    const updated = await updateBom(adminActor, bom.id, {
      version: bom.updatedAt,
      data: input({ materials: [{ itemId: ids.flour, qty: 50, wastagePercent: 0, rate: 62, excludeFromScrap: false }], overheads: [], wastages: [] }),
    });
    expect(updated).toMatchObject({ materialCost: 3100, overheadCost: 0, totalCost: 3100 });
    expect(updated.materials).toHaveLength(1);
    await expect(updateBom(adminActor, bom.id, { version: bom.updatedAt, data: input() })).rejects.toThrow("Someone else");

    const inactive = await setBomActive(adminActor, bom.id, { version: updated.updatedAt, isActive: false });
    expect(inactive.isActive).toBe(false);
    await expect(setBomActive(adminActor, bom.id, { version: updated.updatedAt, isActive: true })).rejects.toThrow("Someone else");
  });

  it("tags child BOMs, blocks cycles and deleting a used child", async () => {
    const parent = await createBom(adminActor, input({ name: "Biscuit Packing" }));
    const dough = await createBom(adminActor, input({ name: "Biscuit Dough", outputs: [{ itemId: ids.crumbs, outputType: "SEMI_FINISHED_GOODS", netWeight: 1, lotSizeQty: 100, costPercent: 100 }], wastages: [] }));
    expect((await bomOptions(adminActor, { search: "bis", exclude: parent.id })).map((row) => row.name)).toEqual(["Biscuit Dough"]);
    await expect(bomOptions(adminActor, { search: "bi" })).rejects.toThrow("3 letters");

    const tagged = await setBomChildren(adminActor, parent.id, { links: [{ childBomId: dough.id, stage: "Stage 1" }] });
    expect(tagged.children).toEqual([expect.objectContaining({ name: "Biscuit Dough", stage: "Stage 1" })]);
    expect((await getBom(adminActor, dough.id)).parents).toEqual([expect.objectContaining({ name: "Biscuit Packing" })]);
    expect((await listBoms(adminActor, { search: "packing" }))[0].childCount).toBe(1);

    await expect(setBomChildren(adminActor, dough.id, { links: [{ childBomId: parent.id, stage: "Level 2" }] })).rejects.toThrow("already uses this BOM");
    await expect(setBomChildren(adminActor, parent.id, { links: [{ childBomId: parent.id, stage: "x" }] })).rejects.toThrow("own child");

    const current = await getBom(adminActor, dough.id);
    await expect(deleteBom(adminActor, dough.id, { version: current.updatedAt })).rejects.toThrow("Remove it there first");
    await setBomChildren(adminActor, parent.id, { links: [] });
    await deleteBom(adminActor, dough.id, { version: current.updatedAt });
    expect(await listBoms(adminActor, {})).toHaveLength(1);
  });

  it("gives items with category, purchase rate and stock, and exports Excel and PDF", async () => {
    const lookups = await bomLookups(adminActor);
    const flour = lookups.items.find((item) => item.code === "RM-001");
    expect(flour).toMatchObject({ avgRate: 60, stock: 500, altUom: "BAG", altUomFactor: 50 });
    expect(lookups.accounts.map((account) => account.code)).toEqual(["5200", "5300"]);
    expect(lookups.sections).toEqual([expect.objectContaining({ name: "Biscuit & Cookies" })]);

    const bom = await createBom(adminActor, input());
    const excel = await bomListExcel(adminActor, { details: "true" });
    expect(Buffer.from(excel.slice(0, 2)).toString()).toBe("PK");
    const listPdf = await bomListPdf(adminActor, {});
    expect(Buffer.from(listPdf.slice(0, 5)).toString()).toBe("%PDF-");
    const detail = await bomDetailPdf(adminActor, bom.id);
    expect(detail.name).toBe("Lexus Biscuit BOM");
    expect(Buffer.from(detail.bytes.slice(0, 5)).toString()).toBe("%PDF-");
  });
});
