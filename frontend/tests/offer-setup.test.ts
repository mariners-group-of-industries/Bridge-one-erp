import ExcelJS from "exceljs";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma/client", async () => {
  const { testPrisma } = await import("./helpers/test-db");
  return { db: testPrisma };
});
import { createBusinessUnit } from "@/features/configuration/business-config/company-profile/server/business-unit.service";
import { saveCompany } from "@/features/configuration/business-config/company-profile/server/company.service";
import { createCategory, createItem } from "@/features/configuration/entity-master-data/item/server/item.service";
import {
  createOffer,
  discountTemplate,
  getOffer,
  getOfferOptions,
  listOffers,
  parseDiscountLines,
  setOfferActive,
  updateOffer,
} from "@/features/configuration/sales-config/offer/server/offer.service";
import { AppError } from "@/lib/api/errors";
import { adminActor, businessUnitInput, companyInput, scopedActor } from "./helpers/fixtures";
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
let feedId: string;
let bagId: string;
let groupId: string;
let supplierId: string;

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
  const feed = await createCategory(adminActor, { businessUnitId: unitId, name: "Feed" });
  const item = (code: string, name: string) =>
    createItem(adminActor, { businessUnitId: unitId, code, printedCode: code, name, printedName: name, itemType: "Finished Goods", uom: "Bag", altUom: "Kg", altUnit: "25", categoryId: feed.id });
  feedId = (await item("F-1", "Broiler Feed")).id;
  bagId = (await item("F-2", "Layer Feed")).id;
  groupId = (await testPrisma().customerGroup.create({ data: { businessUnitId: unitId, name: "Dealer" } })).id;
  supplierId = (await testPrisma().supplier.create({ data: { businessUnitId: unitId, code: "SUP-1", name: "Acme" } })).id;
});

/** Offer header; extra fields (dates, groups, basedOn …) pass through at runtime. */
const head = (overrides: Record<string, string> = {}) =>
  ({ businessUnitId: unitId, name: "Eid Offer", fromDate: "", toDate: "", ...overrides }) as { businessUnitId: string; name: string; fromDate: string; toDate: string };

describe("offers", () => {
  it("creates an Items offer (buy X get Y) and reads it back with the category trio", async () => {
    const [feed] = (await getOfferOptions(adminActor)).categories;
    const offer = await createOffer(adminActor, {
      kind: "ITEM",
      ...head({ fromDate: "2026-01-01", toDate: "2026-01-31", customerGroupId: groupId, categoryId: feed.id }),
      lines: [{ sellingItemId: feedId, sellingUom: "Bag", sellingQty: "10", offerItemId: bagId, offerUom: "Kg", offerQty: "5" }],
    });
    expect(offer).toMatchObject({ kind: "ITEM", customerGroupId: groupId, categoryId: feed.id, subCategoryId: "" });
    if (offer.kind !== "ITEM") throw new Error("kind");
    expect(offer.lines[0]).toMatchObject({ sellingQty: "10", offerQty: "5", offerUom: "Kg" });

    const list = await listOffers(adminActor, { kind: "ITEM", page: 1, pageSize: 10 });
    expect(list.rows[0]).toMatchObject({ name: "Eid Offer", customerGroupName: "Dealer", fromDate: "2026-01-01", lineCount: 1, isActive: true });
    expect((await listOffers(adminActor, { kind: "DISCOUNT", page: 1, pageSize: 10 })).total).toBe(0);
  });

  it("saves Item (Multiple) pairs, each with its own selling item (or a whole category) and bonus items", async () => {
    const [feed] = (await getOfferOptions(adminActor)).categories;
    const dates = { fromDate: "2026-02-01", toDate: "2026-02-28" };
    await expect(createOffer(adminActor, { kind: "ITEM_MULTIPLE", ...head(dates), basedOn: "All Customers", pairs: [] } as never)).rejects.toThrow();
    const offer = await createOffer(adminActor, {
      kind: "ITEM_MULTIPLE",
      ...head(dates),
      basedOn: "All Customers",
      pairs: [
        { itemId: feedId, quantity: "5", minQty: "5", maxQty: "50", bonusLines: [{ itemId: bagId, quantity: "1" }] },
        // "All": any items of the category count together.
        { categoryId: feed.id, itemId: "", quantity: "10", bonusLines: [{ itemId: bagId, quantity: "2" }, { itemId: feedId, quantity: "1" }] },
      ],
    });
    if (offer.kind !== "ITEM_MULTIPLE") throw new Error("kind");
    expect(offer.pairs.map((pair) => [pair.itemId, pair.categoryId, pair.quantity, pair.bonusLines.map((line) => line.quantity)])).toEqual([
      [feedId, "", "5", ["1"]],
      ["", feed.id, "10", ["2", "1"]],
    ]);
    expect((await getOffer(adminActor, offer.id)).kind).toBe("ITEM_MULTIPLE");

    const invalid = (changes: Record<string, unknown>) =>
      createOffer(adminActor, { kind: "ITEM_MULTIPLE", ...head(dates), basedOn: "All Customers", pairs: [{ itemId: feedId, quantity: "5", bonusLines: [{ itemId: bagId, quantity: "1" }] }], ...changes } as never);
    await expect(invalid({ fromDate: "2026-03-01" })).rejects.toThrow();
    await expect(invalid({ basedOn: "" })).rejects.toThrow();
    await expect(invalid({ basedOn: "Price Type" })).rejects.toThrow();
    await expect(invalid({ pairs: [{ itemId: "", quantity: "5", bonusLines: [{ itemId: bagId, quantity: "1" }] }] })).rejects.toThrow();
    await expect(invalid({ pairs: [{ itemId: feedId, quantity: "5", bonusLines: [] }] })).rejects.toThrow();
    await expect(invalid({ pairs: [{ itemId: feedId, quantity: "5", minQty: "9", maxQty: "2", bonusLines: [{ itemId: bagId, quantity: "1" }] }] })).rejects.toThrow();
  });

  it("validates discount rows: percentage cap, contribution split and duplicate items", async () => {
    const line = { itemId: feedId, discountType: "PERCENT" as const, amount: "10", supplierId, supplierContribution: "40", internalContribution: "60", isRecurrent: true };
    const offer = await createOffer(adminActor, { kind: "DISCOUNT", ...head({ basedOn: "Customer Group", customerGroupId: groupId }), lines: [line] });
    if (offer.kind !== "DISCOUNT") throw new Error("kind");
    expect(offer.lines[0]).toMatchObject({ amount: "10", supplierContribution: "40", internalContribution: "60", isRecurrent: true });

    await expect(createOffer(adminActor, { kind: "DISCOUNT", ...head(), lines: [{ ...line, amount: "150" }] })).rejects.toThrow();
    await expect(createOffer(adminActor, { kind: "DISCOUNT", ...head(), lines: [{ ...line, internalContribution: "50" }] })).rejects.toThrow();
    await expect(createOffer(adminActor, { kind: "DISCOUNT", ...head(), lines: [{ ...line, supplierId: "" }] })).rejects.toThrow();
    await expectAppError(createOffer(adminActor, { kind: "DISCOUNT", ...head(), lines: [line, line] }), 400);
  });

  it("saves special discount slabs and updates them", async () => {
    const offer = await createOffer(adminActor, {
      kind: "SPECIAL_DISCOUNT",
      ...head({ basedOn: "Invoice Amount", remarks: "Year end" }),
      lines: [{ customerGroupId: groupId, discountType: "FLAT", amount: "500", fromAmount: "10000", toAmount: "50000", vatOnDiscounted: false }],
    });
    const updated = await updateOffer(adminActor, offer.id, {
      kind: "SPECIAL_DISCOUNT",
      ...head({ name: "Year End", basedOn: "Invoice Amount" }),
      lines: [
        { discountType: "PERCENT", amount: "2", fromAmount: "0", toAmount: "9999.99" },
        { discountType: "PERCENT", amount: "3", fromAmount: "10000" },
      ],
    });
    if (updated.kind !== "SPECIAL_DISCOUNT") throw new Error("kind");
    expect(updated.name).toBe("Year End");
    expect(updated.lines.map((l) => l.amount)).toEqual(["2", "3"]);
    await expect(
      createOffer(adminActor, { kind: "SPECIAL_DISCOUNT", ...head(), lines: [{ discountType: "FLAT", amount: "1", fromAmount: "500", toAmount: "100" }] }),
    ).rejects.toThrow();
  });

  it("toggles active, filters by status and stays inside the actor's companies", async () => {
    const offer = await createOffer(adminActor, { kind: "SPECIAL_DISCOUNT", ...head(), lines: [{ discountType: "FLAT", amount: "5" }] });
    await setOfferActive(adminActor, offer.id, false);
    expect((await listOffers(adminActor, { kind: "SPECIAL_DISCOUNT", status: "inactive", page: 1, pageSize: 10 })).total).toBe(1);
    expect((await listOffers(adminActor, { kind: "SPECIAL_DISCOUNT", status: "active", page: 1, pageSize: 10 })).total).toBe(0);
    await expectAppError(getOffer(scopedActor([]), offer.id), 404);
    await expectAppError(updateOffer(adminActor, offer.id, { kind: "DISCOUNT", ...head(), lines: [{ itemId: feedId, discountType: "FLAT", amount: "1" }] }), 400);
  });

  it("reads a filled discount template into rows and reports bad ones", async () => {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load((await discountTemplate()).buffer as ArrayBuffer);
    const sheet = workbook.worksheets[0];
    sheet.addRow(["F-1", "Percentage", "5", "", "1", "10", "yes", "SUP-1", "30", "70"]);
    sheet.addRow(["NOPE", "Flat Amount", "5"]);
    sheet.addRow(["F-2", "Percentage", "120"]);
    const result = await parseDiscountLines(adminActor, unitId, new Uint8Array(await workbook.xlsx.writeBuffer()));
    expect(result.lines).toEqual([
      expect.objectContaining({ itemId: feedId, discountType: "PERCENT", amount: "5", isRecurrent: true, supplierId, supplierContribution: "30" }),
    ]);
    expect(result.errors.map((e) => e.row)).toEqual([3, 4]);
  });
});
