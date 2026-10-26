import ExcelJS from "exceljs";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma/client", async () => {
  const { testPrisma } = await import("./helpers/test-db");
  return { db: testPrisma };
});
import { createBusinessUnit } from "@/features/configuration/business-config/company-profile/server/business-unit.service";
import { saveCompany } from "@/features/configuration/business-config/company-profile/server/company.service";
import { createItem } from "@/features/configuration/entity-master-data/item/server/item.service";
import { etpOf } from "@/features/configuration/sales-config/standard-price/schemas/standard-price.schema";
import { exportStandardPrices, importStandardPrices, standardPricePdf } from "@/features/configuration/sales-config/standard-price/server/standard-price-files";
import { listStandardPrices, saveStandardPrices } from "@/features/configuration/sales-config/standard-price/server/standard-price.service";
import { AppError } from "@/lib/api/errors";
import { adminActor, businessUnitInput, companyInput, scopedActor } from "./helpers/fixtures";
import { resetTestDb, startTestDb, stopTestDb, testPrisma } from "./helpers/test-db";

let unitId: string;
let feedId: string;
let maizeId: string;

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
  const item = (code: string, name: string, itemType: "Finished Goods" | "Raw Material") => createItem(adminActor, { businessUnitId: unitId, code, printedCode: code, name, printedName: name, uom: "Bag", itemType });
  feedId = (await item("F-1", "Broiler Feed", "Finished Goods")).id;
  maizeId = (await item("R-1", "Maize", "Raw Material")).id;
  await testPrisma().item.update({ where: { id: feedId }, data: { purchasePrice: "900", mrp: "1200" } });
});

const today = new Date().toISOString().slice(0, 10);
const row = (itemId: string, changes: Record<string, string> = {}) => ({
  itemId,
  effectiveFrom: today,
  costPrice: "1000",
  increaseType: "PERCENT" as const,
  increaseValue: "10",
  etpPrice: "1100",
  dealerPrice: "1150",
  tradingPrice: "1180",
  mrp: "1250",
  minSalesPrice: "1120",
  remarks: "",
  ...changes,
});

describe("standard price", () => {
  it("works out ETP from cost and a % or flat increase", () => {
    expect(etpOf("1000", "PERCENT", "10")).toBe("1100.00");
    expect(etpOf("1000", "AMOUNT", "75.5")).toBe("1075.50");
    expect(etpOf("", "PERCENT", "10")).toBe("");
  });

  it("starts unsaved items from the Item Profile and filters by item type and search", async () => {
    const all = await listStandardPrices(adminActor, { businessUnitId: unitId });
    expect(all.total).toBe(2);
    expect(all.rows.find((r) => r.code === "F-1")).toMatchObject({ priceId: null, costPrice: "900.00", mrp: "1200.00", effectiveFrom: today });
    expect((await listStandardPrices(adminActor, { businessUnitId: unitId, itemType: "Raw Material" })).rows.map((r) => r.itemId)).toEqual([maizeId]);
    expect((await listStandardPrices(adminActor, { businessUnitId: unitId, search: "broiler" })).rows.map((r) => r.code)).toEqual(["F-1"]);
    await expect(listStandardPrices(scopedActor([]), { businessUnitId: unitId })).rejects.toBeInstanceOf(AppError);
  });

  it("keeps dated history, shows the latest and syncs the Item Profile for prices in force", async () => {
    expect(await saveStandardPrices(adminActor, { businessUnitId: unitId, rows: [row(feedId)] })).toEqual({ created: 1, updated: 0 });
    // Same date again → update; a future date → new history entry, no sync yet.
    expect(await saveStandardPrices(adminActor, { businessUnitId: unitId, rows: [row(feedId, { mrp: "1300" })] })).toEqual({ created: 0, updated: 1 });
    await saveStandardPrices(adminActor, { businessUnitId: unitId, rows: [row(feedId, { effectiveFrom: "2099-01-01", mrp: "1500", minSalesPrice: "1400" })] });

    const item = await testPrisma().item.findUniqueOrThrow({ where: { id: feedId } });
    expect([item.purchasePrice?.toString(), item.dealerPrice?.toString(), item.tradingPrice?.toString(), item.mrp?.toString()]).toEqual(["1000", "1150", "1180", "1300"]);
    const listed = (await listStandardPrices(adminActor, { businessUnitId: unitId, search: "F-1" })).rows[0];
    expect(listed).toMatchObject({ effectiveFrom: "2099-01-01", mrp: "1500.00", historyCount: 2 });
  });

  it("rejects bad rows and items of other business units", async () => {
    await expect(saveStandardPrices(adminActor, { businessUnitId: unitId, rows: [row(feedId, { minSalesPrice: "2000" })] })).rejects.toThrow();
    await expect(saveStandardPrices(adminActor, { businessUnitId: unitId, rows: [row(feedId, { effectiveFrom: "" })] })).rejects.toThrow();
    await expect(saveStandardPrices(adminActor, { businessUnitId: unitId, rows: [row(feedId), row(feedId)] })).rejects.toThrow();
    await expect(saveStandardPrices(scopedActor([]), { businessUnitId: unitId, rows: [row(feedId)] })).rejects.toBeInstanceOf(AppError);
  });

  it("round-trips through Excel and prints a PDF", async () => {
    const bytes = await exportStandardPrices(adminActor, { businessUnitId: unitId });
    const book = new ExcelJS.Workbook();
    await book.xlsx.load(bytes as unknown as ArrayBuffer);
    const sheet = book.worksheets[0];
    expect(sheet.rowCount).toBe(3);
    // Edit the downloaded file: new cost for F-1 (ETP left empty → worked out), bad code row.
    sheet.eachRow((r, n) => {
      if (n > 1 && r.getCell(1).value === "F-1") {
        r.getCell(5).value = "2000";
        r.getCell(6).value = "5";
        r.getCell(8).value = "";
      }
    });
    sheet.addRow(["NOPE", "", "", today]);
    const result = await importStandardPrices(adminActor, unitId, new Uint8Array(await book.xlsx.writeBuffer()));
    expect(result.created).toBe(2);
    expect(result.errors).toEqual([expect.objectContaining({ row: 4 })]);
    const feed = (await listStandardPrices(adminActor, { businessUnitId: unitId, search: "F-1" })).rows[0];
    expect(feed).toMatchObject({ costPrice: "2000.00", increaseValue: "5.00", etpPrice: "2100.00" });

    const pdf = await standardPricePdf(adminActor, { businessUnitId: unitId });
    expect(new TextDecoder().decode(pdf.slice(0, 5))).toBe("%PDF-");
  });
});
