import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { AppError } from "@/lib/api/errors";
import { setStorage } from "@/lib/storage";
import {
  createBusinessUnit,
  deleteBusinessUnit,
  listBusinessUnits,
  updateBusinessUnit,
} from "@/features/configuration/business-config/company-profile/server/business-unit.service";
import { getCompany, saveCompany } from "@/features/configuration/business-config/company-profile/server/company.service";
import {
  deleteOfficeAsset,
  putOfficeAsset,
  readOfficeAsset,
} from "@/features/configuration/business-config/company-profile/server/office-asset.service";
import {
  createOffice,
  deleteOffice,
  getOffice,
  listOffices,
  updateOffice,
} from "@/features/configuration/business-config/company-profile/server/office.service";
import {
  createTerm,
  deleteTerm,
  listTerms,
  reorderTerms,
  updateTerm,
} from "@/features/configuration/business-config/company-profile/server/terms.service";
import {
  createWarehouse,
  deleteWarehouse,
  listWarehouses,
  updateWarehouse,
} from "@/features/configuration/business-config/company-profile/server/warehouse.service";
import {
  adminActor,
  businessUnitInput,
  companyInput,
  MemoryStorage,
  officeInput,
  pngBytes,
  scopedActor,
} from "./helpers/fixtures";
import { resetTestDb, startTestDb, stopTestDb, testPrisma } from "./helpers/test-db";

async function expectAppError(promise: Promise<unknown>, status: number, code?: string) {
  const error = await promise.then(
    () => undefined,
    (reason: unknown) => reason,
  );
  expect(error).toBeInstanceOf(AppError);
  expect((error as AppError).status).toBe(status);
  if (code) expect((error as AppError).code).toBe(code);
}

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
});

async function seedUnit() {
  await saveCompany(adminActor, companyInput);
  return createBusinessUnit(adminActor, businessUnitInput);
}

const officeData = { ...officeInput };

describe("company profile", () => {
  it("creates the company on first save and updates it afterwards", async () => {
    expect(await getCompany(adminActor)).toBeNull();

    const created = await saveCompany(adminActor, companyInput);
    expect(created).toMatchObject(companyInput);

    const updated = await saveCompany(adminActor, { ...companyInput, address: "New address" });
    expect(updated.id).toBe(created.id);
    expect(updated.address).toBe("New address");
    expect(await testPrisma().company.count()).toBe(1);
  });

  it("does not allow a scoped actor to create a company", async () => {
    await expectAppError(saveCompany(scopedActor([]), companyInput), 403, "FORBIDDEN");
  });
});

describe("business units", () => {
  it("requires a company before creating business units", async () => {
    await expectAppError(
      createBusinessUnit(adminActor, businessUnitInput),
      409,
      "PRECONDITION_REQUIRED",
    );
  });

  it("creates, lists and updates units under the company", async () => {
    const unit = await seedUnit();
    const company = await getCompany(adminActor);
    expect(unit.companyId).toBe(company?.id);

    const updated = await updateBusinessUnit(adminActor, unit.id, {
      ...businessUnitInput,
      dateFormat: "YYYY_MM_DD_DASH",
    });
    expect(updated.dateFormat).toBe("YYYY_MM_DD_DASH");

    const list = await listBusinessUnits(adminActor);
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ id: unit.id, officeCount: 0 });
  });

  it("rejects duplicate names case-insensitively", async () => {
    await seedUnit();
    await expectAppError(
      createBusinessUnit(adminActor, { ...businessUnitInput, name: "MARINERS trading" }),
      409,
      "CONFLICT",
    );
  });

  it("blocks deletion while offices exist and removes owned terms on delete", async () => {
    const unit = await seedUnit();
    const office = await createOffice(adminActor, unit.id, officeData);
    await createTerm(adminActor, unit.id, {
      domain: "SALES",
      content: "Advance payment required.",
      isDefault: true,
      documentTypes: ["SALES_ORDER"],
    });

    await expectAppError(deleteBusinessUnit(adminActor, unit.id), 409, "IN_USE");

    await deleteOffice(adminActor, office.id);
    await deleteBusinessUnit(adminActor, unit.id);
    expect(await testPrisma().businessUnit.count()).toBe(0);
    expect(await testPrisma().termsCondition.count()).toBe(0);
    expect(await testPrisma().termApplicability.count()).toBe(0);
  });

  it("hides units of companies outside the actor's scope", async () => {
    const unit = await seedUnit();
    const outsider = scopedActor(["00000000-0000-4000-8000-000000000000"]);
    await expectAppError(updateBusinessUnit(outsider, unit.id, businessUnitInput), 404, "NOT_FOUND");
    await expectAppError(listOffices(outsider, unit.id), 404, "NOT_FOUND");
    expect(await listBusinessUnits(outsider)).toEqual([]);
  });
});

describe("offices and warehouses", () => {
  it("associates offices with units and warehouses with offices", async () => {
    const unit = await seedUnit();
    const headOffice = await createOffice(adminActor, unit.id, officeData);
    const branch = await createOffice(adminActor, unit.id, {
      name: "Branch Office",
      address: "Chattogram",
      email: null,
      phone: null,
      binNumber: null,
    });

    await createWarehouse(adminActor, headOffice.id, { name: "Head Office WH" });
    await createWarehouse(adminActor, headOffice.id, { name: "Asset WH HO" });
    // Same name is fine in a different office.
    await createWarehouse(adminActor, branch.id, { name: "Head Office WH" });

    expect((await listWarehouses(adminActor, headOffice.id)).map((w) => w.name)).toEqual([
      "Head Office WH",
      "Asset WH HO",
    ]);
    expect((await getOffice(adminActor, headOffice.id)).warehouseCount).toBe(2);
    expect((await listBusinessUnits(adminActor))[0].officeCount).toBe(2);
  });

  it("rejects duplicate office and warehouse names within the same parent", async () => {
    const unit = await seedUnit();
    const office = await createOffice(adminActor, unit.id, officeData);
    await expectAppError(
      createOffice(adminActor, unit.id, { ...officeData, name: "head office" }),
      409,
      "CONFLICT",
    );
    const warehouse = await createWarehouse(adminActor, office.id, { name: "Main WH" });
    const other = await createWarehouse(adminActor, office.id, { name: "Other WH" });
    await expectAppError(updateWarehouse(adminActor, other.id, { name: "main wh" }), 409, "CONFLICT");
    expect((await updateWarehouse(adminActor, warehouse.id, { name: "Main WH 2" })).name).toBe("Main WH 2");
  });

  it("updates office details", async () => {
    const unit = await seedUnit();
    const office = await createOffice(adminActor, unit.id, officeData);
    const updated = await updateOffice(adminActor, office.id, { ...officeData, binNumber: null });
    expect(updated.binNumber).toBeNull();
  });

  it("protects offices that still have warehouses", async () => {
    const unit = await seedUnit();
    const office = await createOffice(adminActor, unit.id, officeData);
    const warehouse = await createWarehouse(adminActor, office.id, { name: "Main WH" });

    await expectAppError(deleteOffice(adminActor, office.id), 409, "IN_USE");

    await deleteWarehouse(adminActor, warehouse.id);
    await deleteOffice(adminActor, office.id);
    expect(await testPrisma().office.count()).toBe(0);
  });

  it("is enforced by database foreign keys as well", async () => {
    const unit = await seedUnit();
    const office = await createOffice(adminActor, unit.id, officeData);
    await createWarehouse(adminActor, office.id, { name: "Main WH" });
    await expect(testPrisma().office.delete({ where: { id: office.id } })).rejects.toThrow();
  });
});

describe("office branding assets", () => {
  async function seedOffice() {
    const unit = await seedUnit();
    return createOffice(adminActor, unit.id, officeData);
  }

  const png = (bytes = pngBytes()) => ({ name: "logo.png", type: "image/png", size: bytes.byteLength, bytes });

  it("stores the binary in object storage and metadata in PostgreSQL", async () => {
    const office = await seedOffice();
    const asset = await putOfficeAsset(adminActor, office.id, "BRAND_LOGO", png());

    expect(asset).toMatchObject({ kind: "BRAND_LOGO", mimeType: "image/png", originalName: "logo.png" });
    expect(asset.url).toContain(`/api/configuration/offices/${office.id}/assets/brand-logo`);
    expect(storage.objects.size).toBe(1);

    const row = await testPrisma().officeAsset.findFirstOrThrow();
    expect(storage.objects.has(row.storageKey)).toBe(true);

    const read = await readOfficeAsset(adminActor, office.id, "BRAND_LOGO");
    expect(read.mimeType).toBe("image/png");
    expect((await getOffice(adminActor, office.id)).assets).toHaveLength(1);
  });

  it("replaces an existing asset and deletes the old object", async () => {
    const office = await seedOffice();
    await putOfficeAsset(adminActor, office.id, "HEADER", png());
    const firstKey = (await testPrisma().officeAsset.findFirstOrThrow()).storageKey;

    await putOfficeAsset(adminActor, office.id, "HEADER", png(pngBytes(128)));
    const rows = await testPrisma().officeAsset.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0].sizeBytes).toBe(128);
    expect(storage.objects.has(firstKey)).toBe(false);
    expect(storage.objects.size).toBe(1);
  });

  it("rejects files whose content is not an allowed image", async () => {
    const office = await seedOffice();
    const fake = new TextEncoder().encode("<svg onload=alert(1)>");
    await expectAppError(
      putOfficeAsset(adminActor, office.id, "BRAND_LOGO", {
        name: "logo.png",
        type: "image/png",
        size: fake.byteLength,
        bytes: fake,
      }),
      415,
      "UNSUPPORTED_MEDIA_TYPE",
    );
    await expectAppError(
      putOfficeAsset(adminActor, office.id, "BRAND_LOGO", { ...png(), type: "image/svg+xml" }),
      415,
    );
    expect(storage.objects.size).toBe(0);
  });

  it("rejects files larger than 2 MB", async () => {
    const office = await seedOffice();
    await expectAppError(
      putOfficeAsset(adminActor, office.id, "FOOTER", png(pngBytes(2 * 1024 * 1024 + 1))),
      413,
      "PAYLOAD_TOO_LARGE",
    );
  });

  it("removes assets, and cleans up storage when the office is deleted", async () => {
    const office = await seedOffice();
    await putOfficeAsset(adminActor, office.id, "BRAND_LOGO", png());
    await putOfficeAsset(adminActor, office.id, "FOOTER", png());

    await deleteOfficeAsset(adminActor, office.id, "BRAND_LOGO");
    expect(storage.objects.size).toBe(1);
    await expectAppError(deleteOfficeAsset(adminActor, office.id, "BRAND_LOGO"), 404);

    await deleteOffice(adminActor, office.id);
    expect(storage.objects.size).toBe(0);
    expect(await testPrisma().officeAsset.count()).toBe(0);
  });
});

describe("terms & conditions", () => {
  it("keeps sales and purchase terms separate and ordered", async () => {
    const unit = await seedUnit();
    const first = await createTerm(adminActor, unit.id, {
      domain: "SALES",
      content: "Payment must be completed within the agreed period.",
      isDefault: true,
      documentTypes: ["SALES_QUOTATION", "SALES_ORDER", "PROFORMA_INVOICE"],
    });
    const second = await createTerm(adminActor, unit.id, {
      domain: "SALES",
      content: "Delivered products are subject to approved return policies.",
      isDefault: false,
      documentTypes: ["SALES_ORDER", "SALES_DELIVERY"],
    });
    await createTerm(adminActor, unit.id, {
      domain: "PURCHASE",
      content: "Goods must match the purchase order.",
      isDefault: true,
      documentTypes: ["PURCHASE_ORDER", "PURCHASE_RECEIVE"],
    });

    const sales = await listTerms(adminActor, unit.id, "SALES");
    expect(sales.map((term) => [term.id, term.sortOrder])).toEqual([
      [first.id, 1],
      [second.id, 2],
    ]);
    expect(sales[0].documentTypes.toSorted()).toEqual(
      ["PROFORMA_INVOICE", "SALES_ORDER", "SALES_QUOTATION"].toSorted(),
    );
    // Multiple default terms are allowed.
    expect(await listTerms(adminActor, unit.id, "PURCHASE")).toHaveLength(1);
  });

  it("rejects document types from the other domain", async () => {
    const unit = await seedUnit();
    await expectAppError(
      createTerm(adminActor, unit.id, {
        domain: "SALES",
        content: "x",
        isDefault: false,
        documentTypes: ["PURCHASE_ORDER"],
      }),
      400,
    );
    const term = await createTerm(adminActor, unit.id, {
      domain: "PURCHASE",
      content: "x",
      isDefault: false,
      documentTypes: [],
    });
    await expectAppError(updateTerm(adminActor, term.id, { documentTypes: ["SALES_ORDER"] }), 400);
  });

  it("updates content, default flag and applicability", async () => {
    const unit = await seedUnit();
    const term = await createTerm(adminActor, unit.id, {
      domain: "SALES",
      content: "Original",
      isDefault: false,
      documentTypes: ["SALES_ORDER"],
    });

    const updated = await updateTerm(adminActor, term.id, {
      content: "Revised",
      isDefault: true,
      documentTypes: ["SALES_QUOTATION", "SALES_DELIVERY"],
    });
    expect(updated).toMatchObject({ content: "Revised", isDefault: true });
    expect(updated.documentTypes.toSorted()).toEqual(["SALES_DELIVERY", "SALES_QUOTATION"]);

    const cleared = await updateTerm(adminActor, term.id, { documentTypes: [] });
    expect(cleared.documentTypes).toEqual([]);
    expect(cleared.content).toBe("Revised");
  });

  it("reorders terms and renumbers after deletion", async () => {
    const unit = await seedUnit();
    const ids: string[] = [];
    for (const content of ["A", "B", "C"]) {
      ids.push(
        (await createTerm(adminActor, unit.id, { domain: "SALES", content, isDefault: false, documentTypes: [] })).id,
      );
    }

    const reordered = await reorderTerms(adminActor, unit.id, {
      domain: "SALES",
      orderedIds: [ids[2], ids[0], ids[1]],
    });
    expect(reordered.map((term) => term.content)).toEqual(["C", "A", "B"]);

    await expectAppError(
      reorderTerms(adminActor, unit.id, { domain: "SALES", orderedIds: [ids[0], ids[1]] }),
      400,
    );

    await deleteTerm(adminActor, ids[0]);
    const after = await listTerms(adminActor, unit.id, "SALES");
    expect(after.map((term) => [term.content, term.sortOrder])).toEqual([
      ["C", 1],
      ["B", 2],
    ]);
  });
});
