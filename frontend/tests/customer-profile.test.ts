import ExcelJS from "exceljs";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma/client", async () => {
  const { testPrisma } = await import("./helpers/test-db");
  return { db: testPrisma };
});
import { createBusinessUnit } from "@/features/configuration/business-config/company-profile/server/business-unit.service";
import { saveCompany } from "@/features/configuration/business-config/company-profile/server/company.service";
import { createOffice } from "@/features/configuration/business-config/company-profile/server/office.service";
import type { CustomerInput } from "@/features/configuration/entity-master-data/customer/schemas/customer.schema";
import { customerImportTemplate, importCustomers } from "@/features/configuration/entity-master-data/customer/server/customer-excel";
import {
  createCustomer,
  createCustomerGroup,
  createSection,
  getCustomer,
  getFormOptions,
  listCustomers,
  listCustomersBySalesForce,
  setCustomerActive,
  updateCustomer,
} from "@/features/configuration/entity-master-data/customer/server/customer.service";
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

let officeId: string;
let unitId: string;
let territoryId: string;

beforeAll(async () => {
  await startTestDb();
});
afterAll(async () => {
  await stopTestDb();
});
beforeEach(async () => {
  await resetTestDb();
  setStorage(new MemoryStorage());
  await saveCompany(adminActor, companyInput);
  unitId = (await createBusinessUnit(adminActor, businessUnitInput)).id;
  officeId = (await createOffice(adminActor, unitId, officeInput)).id;
  territoryId = (await testPrisma().salesArea.create({ data: { businessUnitId: unitId, kind: "TERRITORY", name: "Sadar" } })).id;
});

const base = (overrides: Partial<CustomerInput> = {}): CustomerInput => ({
  officeId,
  name: "Lovely Store",
  mobile: "01700000000",
  billingName: "Lovely Store",
  territoryId,
  ...overrides,
});

const rep = (name: string, code: string) =>
  testPrisma().salesPerson.create({ data: { businessUnitId: unitId, name, code } });
const territory = (name: string) =>
  testPrisma().salesArea.create({ data: { businessUnitId: unitId, kind: "TERRITORY", name } });

describe("customer profile", () => {
  it("creates a customer with Sales numbering, billing name and shipping rows", async () => {
    const section = await createSection(adminActor, { officeId, name: "Bazar Road" });
    const created = await createCustomer(
      adminActor,
      base({
        creditDays: "15",
        creditLimit: "50000.50",
        isDistributor: true,
        maritalStatus: "Married",
        marriageDate: "2020-02-14",
        billingName: "Lovely Store Ltd",
        bankType: "Current",
        bankAccountNo: "1234567890",
        bankBranch: "Gulshan",
        bankName: "Dutch-Bangla Bank",
        bankRoutingNo: "090261725",
        shipping: [
          { outlet: "Main Outlet", address: "12 Bazar Road", districtId: 1, sectionId: section.id },
          { address: "Warehouse 2" },
        ],
      }),
    );
    expect(created.code).toBe("CUST-00001");
    expect(created).toMatchObject({ creditLimit: "50000.5", isDistributor: true, billingName: "Lovely Store Ltd" });
    expect(created).toMatchObject({ bankType: "Current", bankAccountNo: "1234567890", bankBranch: "Gulshan", bankName: "Dutch-Bangla Bank", bankRoutingNo: "090261725" });
    expect(created.shipping.map((row) => row.outlet)).toEqual(["Main Outlet", "Outlet 2"]);

    const addresses = await testPrisma().customerAddress.findMany({ where: { customerId: created.id }, orderBy: { sortOrder: "asc" } });
    expect(addresses.map((address) => address.isDefault)).toEqual([true, false]);
  });

  it("requires office, partner name, billing name, mobile and territory, and rejects a single person's marriage date", async () => {
    await expect(createCustomer(adminActor, base({ mobile: "" }))).rejects.toThrow();
    await expect(createCustomer(adminActor, base({ name: "" }))).rejects.toThrow();
    await expect(createCustomer(adminActor, base({ billingName: "" }))).rejects.toThrow("Partner billing name is required.");
    await expect(createCustomer(adminActor, base({ territoryId: "" }))).rejects.toThrow("Select a territory.");
    await expect(createCustomer(adminActor, base({ maritalStatus: "Single", marriageDate: "2020-01-01" }))).rejects.toThrow();
  });

  it("validates sub groups, duplicate codes and the shipping thana/district pair", async () => {
    const group = await createCustomerGroup(adminActor, { officeId, name: "Retail" });
    const other = await createCustomerGroup(adminActor, { officeId, name: "Corporate" });
    const sub = await createCustomerGroup(adminActor, { officeId, name: "Pharmacy", parentId: group.id });
    await expectAppError(createCustomerGroup(adminActor, { officeId, name: "retail" }), 409);
    await expectAppError(createCustomer(adminActor, base({ groupId: other.id, subGroupId: sub.id })), 400);

    await createCustomer(adminActor, base({ code: "LS-1" }));
    await expectAppError(createCustomer(adminActor, base({ name: "Other", code: "LS-1" })), 409);

    const thana = await testPrisma().thana.create({ data: { districtId: 1, name: "Gulshan" } });
    await expectAppError(createCustomer(adminActor, base({ name: "X", shipping: [{ address: "A", districtId: 2, thanaId: thana.id }] })), 400);
  });

  it("lists the requested columns and applies every filter", async () => {
    const north = await territory("North");
    const group = await createCustomerGroup(adminActor, { officeId, name: "Retail" });
    const sub = await createCustomerGroup(adminActor, { officeId, name: "Pharmacy", parentId: group.id });
    await createCustomer(
      adminActor,
      base({ groupId: group.id, subGroupId: sub.id, territoryId: north.id, contactNo: "01811111111", billingAddress: "Dhaka", isForeign: true }),
    );
    const beta = await createCustomer(adminActor, base({ name: "Beta Mart" }));
    await testPrisma().customer.update({ where: { id: beta.id }, data: { isActive: false, createdAt: new Date("2025-01-10") } });

    const all = await listCustomers(adminActor, { page: 1, pageSize: 10 });
    expect(all.total).toBe(2);
    expect(all.rows.find((row) => row.name === "Lovely Store")).toMatchObject({
      officeName: officeInput.name,
      groupName: "Retail",
      subGroupName: "Pharmacy",
      billingContactNo: "01811111111",
      mobile: "01700000000",
      billingAddress: "Dhaka",
      territoryName: "North",
      isForeign: true,
    });

    const names = async (filters: Record<string, string>) =>
      (await listCustomers(adminActor, { page: 1, pageSize: 10, ...filters })).rows.map((row) => row.name).sort();
    expect(await names({ subGroupId: sub.id })).toEqual(["Lovely Store"]);
    expect(await names({ territoryId: north.id })).toEqual(["Lovely Store"]);
    expect(await names({ status: "inactive" })).toEqual(["Beta Mart"]);
    expect(await names({ fromDate: "2025-01-01", toDate: "2025-01-10" })).toEqual(["Beta Mart"]);
    expect(await names({ search: "01811" })).toEqual(["Lovely Store"]);
    expect((await listCustomers(scopedActor([]), { page: 1, pageSize: 10 })).total).toBe(0);
  });

  it("groups customers by default sales representative, unassigned last", async () => {
    const zara = await rep("Zara Khan", "SR-2");
    const amin = await rep("Amin Ali", "SR-1");
    await createCustomer(adminActor, base({ name: "A", salesPersonId: zara.id }));
    await createCustomer(adminActor, base({ name: "B", salesPersonId: amin.id }));
    await createCustomer(adminActor, base({ name: "C", salesPersonId: amin.id }));
    await createCustomer(adminActor, base({ name: "D" }));

    const result = await listCustomersBySalesForce(adminActor, {});
    expect(result.groups.map((group) => [group.salesPerson?.name ?? null, group.customers.map((c) => c.name)])).toEqual([
      ["Amin Ali", ["B", "C"]],
      ["Zara Khan", ["A"]],
      [null, ["D"]],
    ]);
  });

  it("toggles a customer active/inactive, only within the actor's companies", async () => {
    const created = await createCustomer(adminActor, base());
    expect(await setCustomerActive(adminActor, created.id, false)).toEqual({ id: created.id, isActive: false });
    expect((await listCustomers(adminActor, { page: 1, pageSize: 10, status: "inactive" })).total).toBe(1);
    await expectAppError(setCustomerActive(scopedActor([]), created.id, true), 404);
  });

  it("updates shipping rows in place so existing ids are kept", async () => {
    const created = await createCustomer(adminActor, base({ shipping: [{ address: "Old" }, { address: "Gone" }] }));
    const keep = created.shipping[0];
    const updated = await updateCustomer(adminActor, created.id, {
      ...base({ billingName: "New Billing" }),
      shipping: [{ ...keep, address: "Old, renamed" }, { address: "Brand new" }],
    });
    expect(updated.shipping[0].id).toBe(keep.id);
    expect(updated.shipping.map((row) => row.address)).toEqual(["Old, renamed", "Brand new"]);
    expect((await getCustomer(adminActor, created.id)).billingName).toBe("New Billing");
  });

  it("offers sub groups, territories and sections in the form options", async () => {
    const group = await createCustomerGroup(adminActor, { officeId, name: "Retail" });
    await createCustomerGroup(adminActor, { officeId, name: "Pharmacy", parentId: group.id });
    await territory("North");
    await createSection(adminActor, { officeId, name: "Bazar Road" });
    const options = await getFormOptions(adminActor);
    expect(options.groups.find((g) => g.name === "Pharmacy")?.parentId).toBe(group.id);
    expect(options.territories.map((t) => t.name)).toEqual(["North", "Sadar"]);
    expect(options.sections.map((s) => s.name)).toEqual(["Bazar Road"]);
  });
});

describe("customer bulk upload", () => {
  it("imports valid rows and reports bad ones", async () => {
    await rep("Amin Ali", "SR-1");
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load((await customerImportTemplate()).buffer as ArrayBuffer);
    const sheet = workbook.getWorksheet("Customers")!;
    const header = (sheet.getRow(1).values as string[]).slice(1);
    const row = (values: Record<string, string>) => header.map((name) => values[name] ?? "");
    sheet.addRow(row({ "Partner Name *": "Imported", "Office *": "head office", "Mobile Number *": "019", "Territory *": "sadar", "Default Sales Representative": "sr-1", "Is Distributor": "yes", Gender: "female" }));
    sheet.addRow(row({ "Partner Name *": "No Mobile", "Office *": officeInput.name }));
    sheet.addRow(row({ "Partner Name *": "Bad Gender", "Office *": officeInput.name, "Mobile Number *": "018", Gender: "x" }));

    const result = await importCustomers(adminActor, new Uint8Array(await workbook.xlsx.writeBuffer()));
    expect(result.created).toBe(1);
    expect(result.errors.map((error) => error.row)).toEqual([3, 4]);
    expect(result.errors[1].message).toBe("Gender: use Male, Female, Other.");
    const [customer] = (await listCustomers(adminActor, { page: 1, pageSize: 10 })).rows;
    expect(customer).toMatchObject({ name: "Imported", salesPersonName: "Amin Ali", territoryName: "Sadar" });
  });
});
