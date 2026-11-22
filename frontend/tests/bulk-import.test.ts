import ExcelJS from "exceljs";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma/client", async () => {
  const { testPrisma } = await import("./helpers/test-db");
  return { db: testPrisma };
});

import { createItem } from "@/features/sales/masters/services/masters.service";
import { requisitionImportTemplate, importRequisitions } from "@/features/purchase/server/requisition-excel";
import { inventoryImportTemplate, importInventoryDocuments } from "@/features/inventory/server/document-excel";
import { journalImportTemplate, importJournalVouchers } from "@/features/accounts/server/journal-excel";
import { adminActor, businessUnitInput, companyInput, officeInput } from "./helpers/fixtures";
import { resetTestDb, startTestDb, stopTestDb, testPrisma } from "./helpers/test-db";

/**
 * Bulk upload for the transactional modules: the template round-trip, per-Ref
 * grouping and row-level error reporting. Runs against the in-memory test DB.
 */

let businessUnitId = "";
let officeId = "";
let warehouseId = "";
let flourId = "";

beforeAll(async () => {
  await startTestDb();
});
afterAll(async () => {
  await stopTestDb();
});
beforeEach(async () => {
  await resetTestDb();
  const prisma = testPrisma();
  const company = await prisma.company.create({ data: companyInput });
  businessUnitId = (await prisma.businessUnit.create({ data: { ...businessUnitInput, companyId: company.id } })).id;
  officeId = (await prisma.office.create({ data: { ...officeInput, businessUnitId, name: "Head Office" } })).id;
  warehouseId = (await prisma.warehouse.create({ data: { officeId, name: "Main Store" } })).id;
  flourId = (await createItem(adminActor, { businessUnitId, code: "FLR-1", printedCode: "FLR-1", name: "Wheat Flour", printedName: "Wheat Flour", uom: "KG", itemType: "Raw Material", salesRate: 60, purchasePrice: "50" })).id;
});

/** Loads a template, writes rows keyed by the template's own header, returns the bytes. */
async function fillTemplate(template: Uint8Array, sheetName: string, rows: Record<string, string>[]): Promise<Uint8Array> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(template.buffer as ArrayBuffer);
  const sheet = workbook.getWorksheet(sheetName)!;
  const header = (sheet.getRow(1).values as string[]).slice(1);
  const lookup = (row: Record<string, string>, name: string) => row[name] ?? row[name.replace(/\s*\*$/, "").trim()] ?? "";
  for (const row of rows) sheet.addRow(header.map((name) => lookup(row, name)));
  return new Uint8Array(await workbook.xlsx.writeBuffer());
}

describe("purchase requisition bulk upload", () => {
  it("creates one requisition per Ref and reports the bad Ref without stopping the good one", async () => {
    const template = await requisitionImportTemplate();
    const bytes = await fillTemplate(template, "Requisitions", [
      { Ref: "1", "Request Date *": "2026-11-15", "Required Delivery Date *": "2026-11-22", Office: "Head Office", Warehouse: "Main Store", Department: "Production", "Requester Name *": "Md. Usuf Ali", "Business Justification": "Weekly production", "Item Code *": "FLR-1", "Quantity *": "30", "Est. Unit Price *": "60" },
      { Ref: "1", "Request Date *": "2026-11-15", "Required Delivery Date *": "2026-11-22", Office: "Head Office", Warehouse: "Main Store", Department: "Production", "Requester Name *": "Md. Usuf Ali", "Business Justification": "Weekly production", "Item Code *": "FLR-1", "Quantity *": "20", "Est. Unit Price *": "60", "Line Remarks": "second line" },
      { Ref: "2", "Request Date *": "2026-11-15", "Required Delivery Date *": "2026-11-22", Office: "Head Office", Warehouse: "Nowhere WH", Department: "Production", "Requester Name *": "Md. Usuf Ali", "Item Code *": "FLR-1", "Quantity *": "99", "Est. Unit Price *": "60" },
    ]);
    const result = await importRequisitions(adminActor, "Tester", bytes);
    expect(result.created).toBe(1);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].message).toContain("Nowhere WH");
    const saved = await testPrisma().purchaseRequisition.findMany({ include: { lines: true } });
    expect(saved).toHaveLength(1);
    expect(saved[0].lines).toHaveLength(2);
    expect(Number(saved[0].totalEstimated)).toBe(50 * 60);
  });
});

describe("inventory document bulk upload", () => {
  it("creates a stock update with a negative line and rejects an unknown warehouse", async () => {
    const template = await inventoryImportTemplate("stock-adjustment");
    const bytes = await fillTemplate(template, "Stock Update", [
      { Ref: "1", "Doc Date *": "2026-11-15", Warehouse: "Main Store", Type: "Damage", "Item Code *": "FLR-1", Qty: "-5", Remarks: "rodent damage" },
      { Ref: "2", "Doc Date *": "2026-11-15", Warehouse: "Nowhere WH", Type: "Damage", "Item Code *": "FLR-1", Qty: "3" },
    ]);
    const result = await importInventoryDocuments("stock-adjustment", adminActor, "Tester", bytes);
    expect(result.created).toBe(1);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].message).toContain("Nowhere WH");
    const doc = await testPrisma().inventoryDocument.findFirst({
      where: { type: "STOCK_UPDATE" },
      include: { lines: true },
    });
    expect(doc).not.toBeNull();
    expect(doc!.status).toBe("PENDING");
    expect(Number(doc!.lines[0].qty)).toBe(-5);
  });
});

describe("journal voucher bulk upload", () => {
  it("posts a balanced voucher and updates account balances; an unbalanced Ref is skipped", async () => {
    const prisma = testPrisma();
    const expense = await prisma.account.create({ data: { code: "50101001", name: "Rent Expense", accountType: "EXPENSE", accountSubtype: "Expense", normalBalance: "DEBIT", isGroup: false } });
    const cash = await prisma.account.create({ data: { code: "10101001", name: "Cash In Hand", accountType: "ASSET", accountSubtype: "CASH", normalBalance: "DEBIT", isGroup: false } });

    const template = await journalImportTemplate();
    const bytes = await fillTemplate(template, "Journal Vouchers", [
      { Ref: "1", "Transaction Date *": "2026-11-15", Office: "Head Office", Narration: "November rent", "Account Code *": "50101001", Debit: "1000" },
      { Ref: "1", "Transaction Date *": "2026-11-15", Office: "Head Office", Narration: "November rent", "Account Code *": "10101001", Credit: "1000" },
      { Ref: "2", "Transaction Date *": "2026-11-15", Office: "Head Office", Narration: "Unbalanced", "Account Code *": "50101001", Debit: "250" },
      { Ref: "2", "Transaction Date *": "2026-11-15", Office: "Head Office", Narration: "Unbalanced", "Account Code *": "10101001", Credit: "200" },
    ]);
    const result = await importJournalVouchers(adminActor, "Tester", bytes);
    expect(result.created).toBe(1);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].message).toMatch(/unbalanced/i);

    const voucher = await prisma.journalVoucher.findFirst({ include: { lines: true } });
    expect(voucher).not.toBeNull();
    expect(voucher!.lines).toHaveLength(2);
    expect(Number((await prisma.account.findUniqueOrThrow({ where: { id: expense.id } })).currentBalance)).toBe(1000);
    expect(Number((await prisma.account.findUniqueOrThrow({ where: { id: cash.id } })).currentBalance)).toBe(-1000);
  });

  it("rejects a file whose Ref column is missing entirely", async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Journal Vouchers");
    sheet.addRow(["Something", "Else"]);
    sheet.addRow(["a", "b"]);
    const bytes = new Uint8Array(await workbook.xlsx.writeBuffer());
    await expect(importJournalVouchers(adminActor, "Tester", bytes)).rejects.toThrow(/Account Code|Ref|missing/i);
  });
});
