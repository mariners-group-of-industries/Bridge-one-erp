import ExcelJS from "exceljs";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma/client", async () => {
  const { testPrisma } = await import("./helpers/test-db");
  return { db: testPrisma };
});
import { createBusinessUnit } from "@/features/configuration/business-config/company-profile/server/business-unit.service";
import { saveCompany } from "@/features/configuration/business-config/company-profile/server/company.service";
import { createOffice } from "@/features/configuration/business-config/company-profile/server/office.service";
import { createItem } from "@/features/configuration/entity-master-data/item/server/item.service";
import { exportPrices, importPrices, pricePdf, priceTemplate } from "@/features/configuration/sales-config/customer-price/server/customer-price-files";
import {
  getCustomerPrice,
  getGroupPrice,
  listCustomerPrices,
  listGroupPrices,
  saveCustomerPrice,
  saveGroupPrice,
  setCustomerPriceActive,
  setGroupPriceRunning,
} from "@/features/configuration/sales-config/customer-price/server/customer-price.service";
import { AppError } from "@/lib/api/errors";
import { adminActor, businessUnitInput, companyInput, officeInput, scopedActor } from "./helpers/fixtures";
import { resetTestDb, startTestDb, stopTestDb, testPrisma } from "./helpers/test-db";

let unitId: string;
let officeId: string;
let customerId: string;
let groupId: string;
let feedId: string;
let layerId: string;

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
  groupId = (await testPrisma().customerGroup.create({ data: { businessUnitId: unitId, name: "Dealer" } })).id;
  customerId = (await testPrisma().customer.create({ data: { businessUnitId: unitId, code: "C-1", name: "Lovely Store", customerGroupId: groupId } })).id;
  const item = (code: string, name: string) => createItem(adminActor, { businessUnitId: unitId, code, printedCode: code, name, printedName: name, uom: "Bag", itemType: "Finished Goods" });
  feedId = (await item("F-1", "Broiler Feed")).id;
  layerId = (await item("F-2", "Layer Feed")).id;
});

const page = { page: 1, pageSize: 10, tab: "customer" as const };

describe("customer price", () => {
  it("saves one setup per customer and price type (saving again updates it)", async () => {
    const first = await saveCustomerPrice(adminActor, { businessUnitId: unitId, customerId, lines: [{ itemId: feedId, dpPrice: "1000", tpPrice: "1100" }] });
    const again = await saveCustomerPrice(adminActor, {
      businessUnitId: unitId,
      customerId,
      itemType: "Finished Goods",
      lines: [
        { itemId: feedId, dpPrice: "990", tpPrice: "1090" },
        { itemId: layerId, dpPrice: "900", tpPrice: "950.50" },
      ],
    });
    expect(again.id).toBe(first.id);
    expect(again.lines.map((l) => l.dpPrice)).toEqual(["990", "900"]);
    expect((await listCustomerPrices(adminActor, page)).rows).toEqual([
      expect.objectContaining({ customerCode: "C-1", customerName: "Lovely Store", itemCount: 2, isActive: true }),
    ]);
  });

  it("rejects duplicate items and missing prices, and stays inside the actor's companies", async () => {
    await expect(
      saveCustomerPrice(adminActor, { businessUnitId: unitId, customerId, lines: [{ itemId: feedId, dpPrice: "1", tpPrice: "1" }, { itemId: feedId, dpPrice: "2", tpPrice: "2" }] }),
    ).rejects.toThrow();
    await expect(saveCustomerPrice(adminActor, { businessUnitId: unitId, customerId, lines: [{ itemId: feedId, dpPrice: "", tpPrice: "1" }] })).rejects.toThrow();
    const saved = await saveCustomerPrice(adminActor, { businessUnitId: unitId, customerId, lines: [{ itemId: feedId, dpPrice: "1", tpPrice: "1" }] });
    await expect(getCustomerPrice(scopedActor([]), saved.id)).rejects.toBeInstanceOf(AppError);
    await setCustomerPriceActive(adminActor, saved.id, false);
    expect((await getCustomerPrice(adminActor, saved.id)).isActive).toBe(false);
  });
});

describe("customer group price", () => {
  it("saves slabs by date and quantity, and validates ranges", async () => {
    const saved = await saveGroupPrice(adminActor, {
      businessUnitId: unitId,
      officeId,
      customerGroupId: groupId,
      createDate: "2026-10-01",
      circularNo: "CIR-12",
      isRunning: true,
      lines: [
        { itemId: feedId, fromDate: "2026-10-01", toDate: "2026-12-31", fromQty: "1", toQty: "99", dpPrice: "1000", tpPrice: "1100" },
        { itemId: feedId, fromDate: "2026-10-01", toDate: "2026-12-31", fromQty: "100", dpPrice: "950", tpPrice: "1050" },
      ],
    });
    expect((await getGroupPrice(adminActor, saved.id)).lines.map((l) => l.fromQty)).toEqual(["1", "100"]);
    expect((await listGroupPrices(adminActor, { ...page, tab: "group", search: "cir-12" })).rows[0]).toMatchObject({ customerGroupName: "Dealer", itemCount: 2, isRunning: true });

    await setGroupPriceRunning(adminActor, saved.id, false);
    expect((await getGroupPrice(adminActor, saved.id)).isRunning).toBe(false);

    const bad = (line: object) =>
      saveGroupPrice(adminActor, { businessUnitId: unitId, officeId, customerGroupId: groupId, createDate: "2026-10-01", lines: [{ itemId: feedId, dpPrice: "1", tpPrice: "1", ...line }] });
    await expect(bad({ fromDate: "2026-12-01", toDate: "2026-11-01" })).rejects.toThrow();
    await expect(bad({ fromQty: "10", toQty: "5" })).rejects.toThrow();
  });
});

describe("files", () => {
  it("imports customer prices, merging into the existing setup", async () => {
    await saveCustomerPrice(adminActor, { businessUnitId: unitId, customerId, lines: [{ itemId: feedId, dpPrice: "1000", tpPrice: "1100" }] });
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load((await priceTemplate("customer")).buffer as ArrayBuffer);
    const sheet = workbook.worksheets[0];
    sheet.addRow(["C-1", "", "", "F-2", "", "900", "950"]);
    sheet.addRow(["NOPE", "", "", "F-1", "", "1", "1"]);
    const result = await importPrices(adminActor, "customer", new Uint8Array(await workbook.xlsx.writeBuffer()));
    expect(result).toMatchObject({ created: 0, updated: 1 });
    expect(result.errors.map((e) => e.row)).toEqual([3]);
    const [row] = (await listCustomerPrices(adminActor, page)).rows;
    expect(row.itemCount).toBe(2);
  });

  it("imports group prices grouped into setups and exports them", async () => {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load((await priceTemplate("group")).buffer as ArrayBuffer);
    const sheet = workbook.worksheets[0];
    sheet.addRow([officeInput.name, "dealer", "", "2026-10-01", "CIR-1", "", "Yes", "F-1", "", "", "", "1", "99", "1000", "1100"]);
    sheet.addRow([officeInput.name, "dealer", "", "2026-10-01", "CIR-1", "", "Yes", "F-2", "", "", "", "", "", "900", "950"]);
    const result = await importPrices(adminActor, "group", new Uint8Array(await workbook.xlsx.writeBuffer()));
    expect(result).toMatchObject({ created: 1, errors: [] });

    const exported = new ExcelJS.Workbook();
    await exported.xlsx.load((await exportPrices(adminActor, "group")).buffer as ArrayBuffer);
    expect(exported.worksheets[0].rowCount).toBe(3);
  });

  it("generates a PDF", async () => {
    await saveCustomerPrice(adminActor, { businessUnitId: unitId, customerId, lines: [{ itemId: feedId, dpPrice: "1000", tpPrice: "1100" }] });
    const pdf = await pricePdf(adminActor, "customer");
    expect(new TextDecoder().decode(pdf.slice(0, 5))).toBe("%PDF-");
  });
});
