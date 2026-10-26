import ExcelJS from "exceljs";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma/client", async () => {
  const { testPrisma } = await import("./helpers/test-db");
  return { db: testPrisma };
});
import { createBusinessUnit } from "@/features/configuration/business-config/company-profile/server/business-unit.service";
import { saveCompany } from "@/features/configuration/business-config/company-profile/server/company.service";
import { createOffice } from "@/features/configuration/business-config/company-profile/server/office.service";
import type { SupplierInput } from "@/features/configuration/entity-master-data/supplier/schemas/supplier.schema";
import {
  exportSuppliers,
  importSuppliers,
  importTemplate,
} from "@/features/configuration/entity-master-data/supplier/server/supplier-excel";
import {
  addAttachment,
  createSupplier,
  createSupplierGroup,
  createTaxBracket,
  createThana,
  deleteAttachment,
  getFormOptions,
  getSupplier,
  listSuppliers,
  readAttachment,
  updateSupplier,
} from "@/features/configuration/entity-master-data/supplier/server/supplier.service";
import { AppError } from "@/lib/api/errors";
import { setStorage } from "@/lib/storage";
import { adminActor, businessUnitInput, companyInput, MemoryStorage, officeInput, scopedActor } from "./helpers/fixtures";
import { resetTestDb, startTestDb, stopTestDb, testPrisma } from "./helpers/test-db";

async function expectAppError(promise: Promise<unknown>, status: number) {
  const error = await promise.then(
    () => undefined,
    (reason: unknown) => reason,
  );
  expect(error).toBeInstanceOf(AppError);
  expect((error as AppError).status).toBe(status);
}

let storage: MemoryStorage;
let officeId: string;
let companyId: string;

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
  const company = await saveCompany(adminActor, companyInput);
  companyId = company.id;
  const unit = await createBusinessUnit(adminActor, businessUnitInput);
  officeId = (await createOffice(adminActor, unit.id, officeInput)).id;
});

const base = (overrides: Partial<SupplierInput> = {}): SupplierInput => ({ officeId, name: "Acme Traders", ...overrides });
const DHAKA = 1;

describe("supplier profile", () => {
  it("seeds the 64 districts", async () => {
    const options = await getFormOptions(adminActor);
    expect(options.districts).toHaveLength(64);
    expect(options.districts.some((d) => d.name === "Cox's Bazar")).toBe(true);
  });

  it("creates a supplier with a generated code, details and billing data", async () => {
    const thana = await createThana(adminActor, { districtId: DHAKA, name: "Gulshan" });
    const created = await createSupplier(
      adminActor,
      base({
        mobile: "01700000000",
        creditDays: "30",
        tolerancePercent: "2.5",
        tcsPercent: "1",
        isForeign: true,
        vdsApplicable: true,
        billingAddress: "Road 1, Gulshan",
        districtId: DHAKA,
        thanaId: thana.id,
        details: [{ address: "Warehouse 7, Tejgaon", vendorName: "Acme Tejgaon", gps: "23.76, 90.39" }],
      }),
    );

    expect(created.code).toBe("SUP-00001");
    expect(created).toMatchObject({ creditDays: "30", tolerancePercent: "2.5", isForeign: true, districtId: DHAKA });
    expect(created.details).toEqual([
      expect.objectContaining({ address: "Warehouse 7, Tejgaon", vendorName: "Acme Tejgaon", code: "" }),
    ]);

    const second = await createSupplier(adminActor, base({ name: "Beta Ltd" }));
    expect(second.code).toBe("SUP-00002");
  });

  it("requires the office, the partner name and every detail's address", async () => {
    await expect(createSupplier(adminActor, base({ name: "  " }))).rejects.toThrow();
    await expect(createSupplier(adminActor, { name: "No office" } as SupplierInput)).rejects.toThrow();
    await expect(createSupplier(adminActor, base({ details: [{ address: "" }] }))).rejects.toThrow();
  });

  it("rejects a duplicate partner code and mismatched references", async () => {
    await createSupplier(adminActor, base({ code: "ACME" }));
    await expectAppError(createSupplier(adminActor, base({ name: "Other", code: "ACME" })), 409);

    const thana = await createThana(adminActor, { districtId: DHAKA, name: "Banani" });
    await expectAppError(createSupplier(adminActor, base({ name: "X", districtId: 2, thanaId: thana.id })), 400);

    const group = await createSupplierGroup(adminActor, { officeId, name: "Raw Material" });
    const otherGroup = await createSupplierGroup(adminActor, { officeId, name: "Packaging" });
    const sub = await createSupplierGroup(adminActor, { officeId, name: "Chemicals", parentId: group.id });
    await expectAppError(createSupplier(adminActor, base({ name: "Y", groupId: otherGroup.id, subGroupId: sub.id })), 400);
    const ok = await createSupplier(adminActor, base({ name: "Z", groupId: group.id, subGroupId: sub.id }));
    expect(ok.subGroupId).toBe(sub.id);
  });

  it("adds options once (case-insensitive) for groups, thanas and tax brackets", async () => {
    await createSupplierGroup(adminActor, { officeId, name: "Local" });
    await expectAppError(createSupplierGroup(adminActor, { officeId, name: "local" }), 409);
    await createThana(adminActor, { districtId: DHAKA, name: "Mirpur" });
    await expectAppError(createThana(adminActor, { districtId: DHAKA, name: "MIRPUR" }), 409);
    const bracket = await createTaxBracket(adminActor, { officeId, name: "Standard", ratePercent: "15" });
    expect(bracket.ratePercent).toBe("15");
    await expectAppError(createTaxBracket(adminActor, { officeId, name: "standard" }), 409);
  });

  it("lists with search and hides other companies' suppliers", async () => {
    await createSupplier(adminActor, base({ name: "Acme Traders", mobile: "01711111111" }));
    await createSupplier(adminActor, base({ name: "Beta Ltd" }));

    const all = await listSuppliers(adminActor, { page: 1, pageSize: 10 });
    expect(all.total).toBe(2);
    const searched = await listSuppliers(adminActor, { page: 1, pageSize: 10, search: "01711" });
    expect(searched.rows.map((row) => row.name)).toEqual(["Acme Traders"]);

    const outsider = scopedActor(["00000000-0000-0000-0000-000000000000"]);
    expect((await listSuppliers(outsider, { page: 1, pageSize: 10 })).total).toBe(0);
    expect((await listSuppliers(scopedActor([companyId]), { page: 1, pageSize: 10 })).total).toBe(2);
    await expectAppError(getSupplier(outsider, all.rows[0].id), 404);
  });

  it("filters by office, partner group, active/inactive and local/foreign", async () => {
    const unitId = (await testPrisma().office.findUniqueOrThrow({ where: { id: officeId } })).businessUnitId;
    const branch = await createOffice(adminActor, unitId, { ...officeInput, name: "Branch" });
    const group = await createSupplierGroup(adminActor, { officeId, name: "Raw Material" });
    await createSupplier(adminActor, base({ name: "Local Grouped", groupId: group.id }));
    const foreign = await createSupplier(adminActor, base({ name: "Foreign Branch", officeId: branch.id, isForeign: true }));
    await testPrisma().supplier.update({ where: { id: foreign.id }, data: { isActive: false } });

    const names = async (filters: Record<string, string>) =>
      (await listSuppliers(adminActor, { page: 1, pageSize: 10, ...filters })).rows.map((row) => row.name).sort();

    expect(await names({ officeId: branch.id })).toEqual(["Foreign Branch"]);
    expect(await names({ groupId: group.id })).toEqual(["Local Grouped"]);
    expect(await names({ status: "inactive" })).toEqual(["Foreign Branch"]);
    expect(await names({ status: "active", type: "local" })).toEqual(["Local Grouped"]);
    expect(await names({ type: "foreign", officeId })).toEqual([]);
  });

  it("updates fields and replaces the supplier-details list", async () => {
    const created = await createSupplier(adminActor, base({ details: [{ address: "A" }, { address: "B" }] }));
    const updated = await updateSupplier(adminActor, created.id, {
      ...base({ name: "Acme Traders Ltd", details: [{ address: "C", contactNumber: "019" }] }),
    });
    expect(updated.name).toBe("Acme Traders Ltd");
    expect(updated.code).toBe(created.code);
    expect(updated.details.map((detail) => detail.address)).toEqual(["C"]);
  });

  it("stores, streams and deletes attachments, rejecting spoofed types", async () => {
    const supplier = await createSupplier(adminActor, base());
    const pdf = new TextEncoder().encode("%PDF-1.7 test");
    const attachment = await addAttachment(adminActor, supplier.id, {
      name: "trade-license.pdf",
      type: "application/pdf",
      size: pdf.byteLength,
      bytes: pdf,
    });
    expect((await readAttachment(adminActor, supplier.id, attachment.id)).bytes).toEqual(pdf);
    expect(storage.objects.size).toBe(1);

    await expectAppError(
      addAttachment(adminActor, supplier.id, { name: "fake.pdf", type: "application/pdf", size: 4, bytes: new Uint8Array([1, 2, 3, 4]) }),
      415,
    );

    await deleteAttachment(adminActor, supplier.id, attachment.id);
    expect(storage.objects.size).toBe(0);
    expect((await getSupplier(adminActor, supplier.id)).attachments).toEqual([]);
  });
});

describe("supplier Excel", () => {
  async function readSheet(bytes: Uint8Array) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer);
    return workbook.getWorksheet("Suppliers")!;
  }

  it("exports one row per supplier with names for dropdown fields", async () => {
    const group = await createSupplierGroup(adminActor, { officeId, name: "Raw Material" });
    await createSupplier(adminActor, base({ groupId: group.id, districtId: DHAKA, isMonthly: true, details: [{ address: "A" }] }));
    const sheet = await readSheet(await exportSuppliers(adminActor));
    const header = (sheet.getRow(1).values as unknown[]).slice(1);
    const row = (sheet.getRow(2).values as unknown[]).slice(1);
    const cell = (name: string) => row[header.indexOf(name)];
    expect(cell("Partner Name *")).toBe("Acme Traders");
    expect(cell("Office *")).toBe(officeInput.name);
    expect(cell("Partner Group")).toBe("Raw Material");
    expect(cell("District")).toBe("Dhaka");
    expect(cell("Is Monthly")).toBe("Yes");
    expect(cell("Supplier Details")).toBe(1);
  });

  it("imports valid rows from the template and reports bad rows", async () => {
    await createSupplierGroup(adminActor, { officeId, name: "Raw Material" });
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load((await importTemplate()).buffer as ArrayBuffer);
    const sheet = workbook.getWorksheet("Suppliers")!;
    const header = (sheet.getRow(1).values as string[]).slice(1);
    const row = (values: Record<string, string>) => header.map((name) => values[name] ?? "");
    sheet.addRow(row({ "Partner Name *": "Imported One", "Office *": "head office", "Partner Group": "raw material", "Is Foreign Supplier": "Y", District: "Sylhet" }));
    sheet.addRow(row({ "Partner Name *": "Bad Office", "Office *": "Nowhere" }));
    sheet.addRow(row({ "Partner Name *": "Bad Flag", "Office *": officeInput.name, "VDS Applicable": "maybe" }));
    const bytes = new Uint8Array(await workbook.xlsx.writeBuffer());

    const result = await importSuppliers(adminActor, bytes);
    expect(result.created).toBe(1);
    expect(result.errors).toEqual([
      { row: 3, message: 'Office "Nowhere" not found.' },
      { row: 4, message: "VDS Applicable: use Yes or No." },
    ]);
    const list = await listSuppliers(adminActor, { page: 1, pageSize: 10 });
    expect(list.rows[0]).toMatchObject({ name: "Imported One", groupName: "Raw Material", isForeign: true, districtName: "Sylhet" });
  });

  it("rejects files that are not workbooks", async () => {
    await expectAppError(importSuppliers(adminActor, new TextEncoder().encode("not excel")), 400);
  });
});
