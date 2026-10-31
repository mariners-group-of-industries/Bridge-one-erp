import ExcelJS from "exceljs";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma/client", async () => {
  const { testPrisma } = await import("./helpers/test-db");
  return { db: testPrisma };
});
import { createBusinessUnit } from "@/features/configuration/business-config/company-profile/server/business-unit.service";
import { saveCompany } from "@/features/configuration/business-config/company-profile/server/company.service";
import { createOffice } from "@/features/configuration/business-config/company-profile/server/office.service";
import type { ItemInput, OpeningStockInput } from "@/features/configuration/entity-master-data/item/schemas/item.schema";
import { importItems, itemImportTemplate } from "@/features/configuration/entity-master-data/item/server/item-excel";
import {
  createCategory,
  createDivision,
  createItem,
  createOpeningStock,
  createUom,
  deleteCategory,
  getFormOptions,
  getItem,
  getOpeningStockOptions,
  listItems,
  setItemActive,
  updateCategory,
  updateItem,
} from "@/features/configuration/entity-master-data/item/server/item.service";
import { AppError } from "@/lib/api/errors";
import { adminActor, businessUnitInput, companyInput, officeInput, scopedActor } from "./helpers/fixtures";
import { resetTestDb, startTestDb, stopTestDb, testPrisma } from "./helpers/test-db";

async function expectAppError(promise: Promise<unknown>, status: number) {
  const error = await promise.then(
    () => undefined,
    (reason: unknown) => reason,
  );
  expect(error).toBeInstanceOf(AppError);
  expect((error as AppError).status).toBe(status);
}

let unitId: string;
let officeId: string;
let warehouseId: string;

beforeAll(async () => {
  await startTestDb();
});
afterAll(async () => {
  await stopTestDb();
});
beforeEach(async () => {
  await resetTestDb();
  await saveCompany(adminActor, companyInput);
  unitId = (await createBusinessUnit(adminActor, businessUnitInput)).id;
  officeId = (await createOffice(adminActor, unitId, officeInput)).id;
  warehouseId = (await testPrisma().warehouse.create({ data: { officeId, name: "Main Store" } })).id;
});

const base = (overrides: Partial<ItemInput> = {}): ItemInput => ({
  businessUnitId: unitId,
  code: "ITM-1",
  printedCode: "P-1",
  name: "Poultry Feed 25kg",
  printedName: "Feed 25kg",
  uom: "Bag",
  itemType: "Finished Goods",
  ...overrides,
});

async function tree() {
  const category = await createCategory(adminActor, { businessUnitId: unitId, name: "Feed" });
  const sub = await createCategory(adminActor, { businessUnitId: unitId, parentId: category.id, name: "Poultry" });
  const minor = await createCategory(adminActor, { businessUnitId: unitId, parentId: sub.id, name: "Broiler" });
  return { category, sub, minor };
}

describe("items", () => {
  it("creates an item with the category chain, prices and an auto EAN-13 barcode", async () => {
    const { category, sub, minor } = await tree();
    const division = await createDivision(adminActor, { businessUnitId: unitId, name: "Feed Division" });
    const created = await createItem(
      adminActor,
      base({
        autoBarcode: true,
        divisionId: division.id,
        categoryId: category.id,
        subCategoryId: sub.id,
        minorCategoryId: minor.id,
        sellingPrice: "1200",
        retailPrice: "1250",
        dealerPrice: "1150",
        vatPercent: "5",
        tracking: "BATCH",
        canBeProduced: true,
      }),
    );
    expect(created).toMatchObject({ categoryId: category.id, subCategoryId: sub.id, minorCategoryId: minor.id, tracking: "BATCH", canBeProduced: true, sellingPrice: "1200" });
    expect(created.barcode).toMatch(/^20\d{11}$/);
    const digits = created.barcode.split("").map(Number);
    const sum = digits.slice(0, 12).reduce((total, digit, index) => total + digit * (index % 2 === 0 ? 1 : 3), 0);
    expect((10 - (sum % 10)) % 10).toBe(digits[12]);

    const [row] = (await listItems(adminActor, { page: 1, pageSize: 10 })).rows;
    expect(row).toMatchObject({
      categoryName: "Feed",
      subCategoryName: "Poultry",
      minorCategoryName: "Broiler",
      divisionName: "Feed Division",
      retailPrice: "1250",
      dealerPrice: "1150",
      currentStock: "0",
      lastCost: null,
    });
  });

  it("validates required fields, duplicate codes and the category chain", async () => {
    await expect(createItem(adminActor, base({ printedName: "" }))).rejects.toThrow();
    await createItem(adminActor, base());
    await expectAppError(createItem(adminActor, base({ name: "Other" })), 409);

    const { category } = await tree();
    const other = await createCategory(adminActor, { businessUnitId: unitId, name: "Medicine" });
    const otherSub = await createCategory(adminActor, { businessUnitId: unitId, parentId: other.id, name: "Vaccine" });
    await expectAppError(createItem(adminActor, base({ code: "X", categoryId: category.id, subCategoryId: otherSub.id })), 400);
  });

  it("updates an item and toggles it inactive", async () => {
    const created = await createItem(adminActor, base());
    const updated = await updateItem(adminActor, created.id, { ...base({ name: "Feed 50kg", purchasePrice: "900" }) });
    expect(updated).toMatchObject({ name: "Feed 50kg", purchasePrice: "900" });
    await setItemActive(adminActor, created.id, false);
    expect((await getItem(adminActor, created.id)).isActive).toBe(false);
    await expectAppError(getItem(scopedActor([]), created.id), 404);
  });
});

describe("categories, divisions and units", () => {
  it("edits names/descriptions and only deletes unused leaves", async () => {
    const { category, sub, minor } = await tree();
    await updateCategory(adminActor, minor.id, { name: "Broiler Starter", description: "Day 1–10" });
    const options = await getFormOptions(adminActor);
    expect(options.categories.find((c) => c.id === minor.id)).toMatchObject({ name: "Broiler Starter", description: "Day 1–10", level: 3 });

    await expectAppError(createCategory(adminActor, { businessUnitId: unitId, parentId: minor.id, name: "Too deep" }), 400);
    await expectAppError(deleteCategory(adminActor, sub.id), 409);
    await createItem(adminActor, base({ categoryId: category.id, subCategoryId: sub.id, minorCategoryId: minor.id }));
    await expectAppError(deleteCategory(adminActor, minor.id), 409);

    const spare = await createCategory(adminActor, { businessUnitId: unitId, name: "Spare" });
    await deleteCategory(adminActor, spare.id);
  });

  it("lists added units together with units items already use", async () => {
    await createItem(adminActor, base({ uom: "Bag" }));
    await createUom(adminActor, { businessUnitId: unitId, name: "Kg" });
    await createUom(adminActor, { businessUnitId: unitId, name: "kg" });
    const names = (await getFormOptions(adminActor)).uoms.map((u) => u.name);
    expect(names).toEqual(["Bag", "Kg"]);
  });
});

describe("opening stock", () => {
  it("receives stock and feeds current stock, last cost and average cost", async () => {
    const feed = await createItem(adminActor, base());
    await createOpeningStock(adminActor, {
      receiptDate: "2026-01-05",
      officeId,
      warehouseId,
      itemType: "INVENTORY",
      challanNo: "CH-1",
      lines: [{ itemId: feed.id, quantity: "10", rate: "100" }],
    });
    const second = await createOpeningStock(adminActor, {
      receiptDate: "2026-02-05",
      officeId,
      warehouseId,
      itemType: "INVENTORY",
      lines: [{ itemId: feed.id, quantity: "30", rate: "120" }],
    });
    expect(second).toMatchObject({ number: "OS-2026-00002", lineCount: 1, totalAmount: "3600.00" });

    const [row] = (await listItems(adminActor, { page: 1, pageSize: 10 })).rows;
    expect(row).toMatchObject({ currentStock: "40", lastCost: "120", avgCost: "115" });
  });

  it("rejects items of the wrong type, decimal quantities for whole-unit items and foreign warehouses", async () => {
    const feed = await createItem(adminActor, base({ noDecimal: true }));
    const truck = await createItem(adminActor, base({ code: "AST-1", name: "Truck", itemType: "Asset" }));
    const receipt = (overrides: Partial<OpeningStockInput> & Pick<OpeningStockInput, "lines">): OpeningStockInput => ({
      receiptDate: "2026-01-05",
      officeId,
      warehouseId,
      itemType: "INVENTORY",
      ...overrides,
    });

    await expectAppError(createOpeningStock(adminActor, receipt({ lines: [{ itemId: truck.id, quantity: "1", rate: "5" }] })), 400);
    await expectAppError(createOpeningStock(adminActor, receipt({ lines: [{ itemId: feed.id, quantity: "1.5", rate: "5" }] })), 400);
    const ok = await createOpeningStock(adminActor, receipt({ itemType: "ASSET", lines: [{ itemId: truck.id, quantity: "1", rate: "500000" }] }));
    expect(ok.number).toBe("OS-2026-00001");

    const otherOffice = await createOffice(adminActor, unitId, { ...officeInput, name: "Branch" });
    await expectAppError(createOpeningStock(adminActor, receipt({ officeId: otherOffice.id, lines: [{ itemId: feed.id, quantity: "1", rate: "5" }] })), 400);
  });

  it("returns no GL accounts when the chart of accounts table does not exist", async () => {
    await createItem(adminActor, base());
    const options = await getOpeningStockOptions(adminActor);
    expect(options.accounts).toEqual([]);
    expect(options.warehouses.map((w) => w.name)).toEqual(["Main Store"]);
    expect(options.items).toHaveLength(1);
  });
});

describe("item bulk upload", () => {
  it("imports valid rows following the category tree and reports bad ones", async () => {
    await tree();
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load((await itemImportTemplate()).buffer as ArrayBuffer);
    const sheet = workbook.getWorksheet("Items")!;
    const header = (sheet.getRow(1).values as string[]).slice(1);
    const row = (values: Record<string, string>) => header.map((name) => values[name] ?? "");
    const required = { "Printed Item Code *": "P", "Printed / Customer Name *": "Printed", "UOM *": "Pcs" };
    sheet.addRow(row({ ...required, "Master Item Code *": "A1", "Master Item Name *": "Good", Category: "feed", "Sub Category": "POULTRY", "Minor Category": "Broiler", "Selling Price": "10" }));
    sheet.addRow(row({ ...required, "Master Item Code *": "A2", "Master Item Name *": "Bad Sub", "Sub Category": "Poultry" }));
    sheet.addRow(row({ ...required, "Master Item Code *": "A3", "Master Item Name *": "Bad Type", "Item Type *": "Gadget" }));

    const result = await importItems(adminActor, new Uint8Array(await workbook.xlsx.writeBuffer()));
    expect(result.created).toBe(1);
    expect(result.errors.map((error) => error.row)).toEqual([3, 4]);
    const [item] = (await listItems(adminActor, { page: 1, pageSize: 10 })).rows;
    // A blank Item Type gets the form's default.
    expect(item).toMatchObject({ code: "A1", itemType: "Finished Goods", minorCategoryName: "Broiler", sellingPrice: "10" });
  });
});
