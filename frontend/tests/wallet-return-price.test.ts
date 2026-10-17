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
import { exportReturnPrices, importReturnPrices, returnPricePdf } from "@/features/configuration/sales-config/return-price/server/return-price-files";
import { listReturnPrices, saveReturnPrices } from "@/features/configuration/sales-config/return-price/server/return-price.service";
import {
  createWallet,
  deleteWallet,
  getWallet,
  listWallets,
  readWalletAttachment,
  removeWalletAttachment,
  setWalletAttachment,
  updateWallet,
} from "@/features/configuration/sales-config/wallet/server/wallet.service";
import { AppError } from "@/lib/api/errors";
import { setStorage } from "@/lib/storage";
import { adminActor, businessUnitInput, companyInput, MemoryStorage, officeInput, pngBytes, scopedActor } from "./helpers/fixtures";
import { resetTestDb, startTestDb, stopTestDb, testPrisma } from "./helpers/test-db";

let unitId: string;
let officeId: string;
let bankId: string;
let storage: MemoryStorage;

beforeAll(async () => {
  await startTestDb();
});
afterAll(async () => {
  await stopTestDb();
});
beforeEach(async () => {
  await resetTestDb();
  storage = new MemoryStorage();
  setStorage(storage);
  await saveCompany(adminActor, companyInput);
  unitId = (await createBusinessUnit(adminActor, businessUnitInput)).id;
  officeId = (await createOffice(adminActor, unitId, officeInput)).id;
  bankId = (await testPrisma().bankAccount.create({ data: { accountNumber: "0011223344", bankName: "Test Bank", branchName: "Main", accountHolder: "Test Co" } })).id;
});

const wallet = (changes: Record<string, unknown> = {}) => ({ businessUnitId: unitId, name: "bKash", commissionPercent: "1.85", bankAccountId: bankId, ...changes });

describe("wallet setup", () => {
  it("creates, lists, updates and deletes wallets", async () => {
    const created = await createWallet(adminActor, wallet({ officeId, referenceCode: "BK-01", isMfs: true, isWalletCharge: true }));
    expect(created).toMatchObject({ name: "bKash", commissionPercent: "1.85", isCash: false, isMfs: true, attachment: null });
    const list = await listWallets(adminActor, { search: "0011" });
    expect(list.rows).toEqual([expect.objectContaining({ name: "bKash", accountNo: "0011223344", referenceCode: "BK-01", isWalletCharge: true, isCoupon: false })]);

    // Cash wallets drop the bank account.
    const cash = await updateWallet(adminActor, created.id, wallet({ name: "Cash", isCash: true }));
    expect(cash).toMatchObject({ name: "Cash", isCash: true, bankAccountId: "" });
    await deleteWallet(adminActor, created.id);
    expect((await listWallets(adminActor, {})).total).toBe(0);
  });

  it("validates names, commission, bank account and scope", async () => {
    await createWallet(adminActor, wallet());
    await expect(createWallet(adminActor, wallet())).rejects.toBeInstanceOf(AppError);
    await expect(createWallet(adminActor, wallet({ name: "Nagad", commissionPercent: "101" }))).rejects.toThrow();
    await expect(createWallet(adminActor, wallet({ name: "Nagad", bankAccountId: "" }))).rejects.toThrow();
    await expect(createWallet(scopedActor([]), wallet({ name: "Nagad" }))).rejects.toBeInstanceOf(AppError);
    expect((await listWallets(scopedActor([]), {})).total).toBe(0);
  });

  it("keeps one attachment per wallet, replacing the old file", async () => {
    const { id } = await createWallet(adminActor, wallet());
    const png = pngBytes();
    await setWalletAttachment(adminActor, id, { name: "form.png", type: "image/png", size: png.byteLength, bytes: png });
    await setWalletAttachment(adminActor, id, { name: "form2.png", type: "image/png", size: png.byteLength, bytes: png });
    expect(storage.objects.size).toBe(1);
    expect((await getWallet(adminActor, id)).attachment).toMatchObject({ name: "form2.png", type: "image/png" });
    expect((await readWalletAttachment(adminActor, id)).originalName).toBe("form2.png");
    await expect(setWalletAttachment(adminActor, id, { name: "x.png", type: "image/png", size: 4, bytes: new Uint8Array([1, 2, 3, 4]) })).rejects.toBeInstanceOf(AppError);
    await removeWalletAttachment(adminActor, id);
    expect(storage.objects.size).toBe(0);
  });
});

describe("sales return price setup", () => {
  let itemId: string;
  beforeEach(async () => {
    itemId = (await createItem(adminActor, { businessUnitId: unitId, code: "FG-1", printedCode: "FG-1", name: "Bonruti 120 gm", printedName: "Bonruti", uom: "PCS", itemType: "Finished Goods" })).id;
  });

  it("shows unpriced items with no date and zero rates, then keeps dated history", async () => {
    expect((await listReturnPrices(adminActor, { businessUnitId: unitId })).rows[0]).toMatchObject({ priceId: null, effectiveFrom: "", damageRate: "0", soundStockRate: "0" });
    const row = { itemId, effectiveFrom: "2026-03-15", damageRate: "7.4", expireRate: "", damageExpireRate: "0", soundStockRate: "0" };
    expect(await saveReturnPrices(adminActor, { businessUnitId: unitId, rows: [row] })).toEqual({ created: 1, updated: 0 });
    expect(await saveReturnPrices(adminActor, { businessUnitId: unitId, rows: [{ ...row, damageRate: "30.84" }] })).toEqual({ created: 0, updated: 1 });
    await saveReturnPrices(adminActor, { businessUnitId: unitId, rows: [{ ...row, effectiveFrom: "2026-04-01", damageRate: "60.7" }] });
    expect((await listReturnPrices(adminActor, { businessUnitId: unitId, itemType: "Finished Goods" })).rows[0]).toMatchObject({
      effectiveFrom: "2026-04-01",
      damageRate: "60.7",
      expireRate: "0",
      historyCount: 2,
    });
    expect((await listReturnPrices(adminActor, { businessUnitId: unitId, itemType: "Raw Material" })).total).toBe(0);
    await expect(saveReturnPrices(adminActor, { businessUnitId: unitId, rows: [{ ...row, effectiveFrom: "" }] })).rejects.toThrow();
    await expect(saveReturnPrices(scopedActor([]), { businessUnitId: unitId, rows: [row] })).rejects.toBeInstanceOf(AppError);
  });

  it("round-trips through Excel (skipping undated rows) and prints a PDF", async () => {
    const book = new ExcelJS.Workbook();
    await book.xlsx.load((await exportReturnPrices(adminActor, { businessUnitId: unitId })) as unknown as ArrayBuffer);
    const sheet = book.worksheets[0];
    sheet.addRow(["FG-1", "", "", "2026-03-15", "7.1", "1", "2", "3"]);
    sheet.addRow(["NOPE", "", "", "2026-03-15", "1"]);
    const result = await importReturnPrices(adminActor, unitId, new Uint8Array(await book.xlsx.writeBuffer()));
    expect(result.created).toBe(1);
    expect(result.errors).toEqual([expect.objectContaining({ row: 4 })]);
    expect((await listReturnPrices(adminActor, { businessUnitId: unitId })).rows[0]).toMatchObject({ damageRate: "7.1", soundStockRate: "3" });
    const pdf = await returnPricePdf(adminActor, { businessUnitId: unitId });
    expect(new TextDecoder().decode(pdf.slice(0, 5))).toBe("%PDF-");
  });
});
