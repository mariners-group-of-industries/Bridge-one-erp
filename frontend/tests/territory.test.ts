import ExcelJS from "exceljs";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma/client", async () => {
  const { testPrisma } = await import("./helpers/test-db");
  return { db: testPrisma };
});
import { createBusinessUnit } from "@/features/configuration/business-config/company-profile/server/business-unit.service";
import { saveCompany } from "@/features/configuration/business-config/company-profile/server/company.service";
import { createOffice } from "@/features/configuration/business-config/company-profile/server/office.service";
import { exportTree, importCustomers, importTree } from "@/features/configuration/sales-config/territory/server/territory-files";
import {
  addLayer,
  assignEmployee,
  createNode,
  deleteLayer,
  deleteNode,
  getTree,
  removeAssignment,
  territoryCustomers,
  updateLayer,
  updateNode,
} from "@/features/configuration/sales-config/territory/server/territory.service";
import { AppError } from "@/lib/api/errors";
import { adminActor, businessUnitInput, companyInput, officeInput, scopedActor } from "./helpers/fixtures";
import { resetTestDb, startTestDb, stopTestDb, testPrisma } from "./helpers/test-db";

let unitId: string;
let officeId: string;

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
});

/** National → Region → Territory chain; returns the node ids. */
async function chain() {
  const national = await createNode(adminActor, { businessUnitId: unitId, parentId: "", code: "BD", name: "Bangladesh" });
  const region = await createNode(adminActor, { businessUnitId: unitId, parentId: national.id, code: "R-DHK", name: "Dhaka Region" });
  const territory = await createNode(adminActor, { businessUnitId: unitId, parentId: region.id, code: "T-SAV", name: "Savar" });
  return { national: national.id, region: region.id, territory: territory.id };
}

async function workbook(rows: (string | number)[][]) {
  const book = new ExcelJS.Workbook();
  const sheet = book.addWorksheet("Sheet1");
  for (const row of rows) sheet.addRow(row);
  return new Uint8Array(await book.xlsx.writeBuffer());
}

describe("sales territory", () => {
  it("seeds the default layers and builds a tree one level at a time", async () => {
    const empty = await getTree(adminActor);
    expect(empty.layers.map((l) => l.name)).toEqual(["National", "Region", "Territory", "Base Point", "Route", "Market"]);
    const ids = await chain();
    const tree = await getTree(adminActor, unitId);
    expect(tree.nodes.map((n) => [n.code, n.level])).toEqual(expect.arrayContaining([["BD", 1], ["R-DHK", 2], ["T-SAV", 3]]));
    // Codes are unique per business unit.
    await expect(createNode(adminActor, { businessUnitId: unitId, parentId: ids.national, code: "R-DHK", name: "Other" })).rejects.toBeInstanceOf(AppError);
    // Outsiders cannot touch the tree.
    await expect(createNode(scopedActor([]), { businessUnitId: unitId, parentId: "", code: "X", name: "X" })).rejects.toBeInstanceOf(AppError);
  });

  it("links the Territory layer to a Sales territory and keeps names in sync", async () => {
    const ids = await chain();
    const node = await testPrisma().salesTerritoryNode.findUniqueOrThrow({ where: { id: ids.territory }, include: { salesArea: true } });
    expect(node.salesArea).toMatchObject({ name: "Savar", kind: "TERRITORY" });
    await updateNode(adminActor, ids.territory, { code: "T-SAV", name: "Savar North" });
    expect((await testPrisma().salesArea.findUniqueOrThrow({ where: { id: node.salesAreaId! } })).name).toBe("Savar North");
  });

  it("refuses to delete entries with children or customers", async () => {
    const ids = await chain();
    await expect(deleteNode(adminActor, ids.region)).rejects.toBeInstanceOf(AppError);
    const { salesAreaId } = await testPrisma().salesTerritoryNode.findUniqueOrThrow({ where: { id: ids.territory } });
    const customer = await testPrisma().customer.create({ data: { businessUnitId: unitId, code: "C-1", name: "Lovely Store", territoryId: salesAreaId } });
    await expect(deleteNode(adminActor, ids.territory)).rejects.toBeInstanceOf(AppError);
    await testPrisma().customer.delete({ where: { id: customer.id } });
    await deleteNode(adminActor, ids.territory);
    await deleteNode(adminActor, ids.region);
    expect((await getTree(adminActor, unitId)).nodes).toHaveLength(1);
  });

  it("adds, renames and removes only the deepest empty layer", async () => {
    const { layers } = await getTree(adminActor, unitId);
    const extra = await addLayer(adminActor, unitId, { code: "OUT", name: "Outlet" });
    expect(extra).toBeTruthy();
    const after = await getTree(adminActor, unitId);
    const outlet = after.layers.at(-1)!;
    expect(outlet).toMatchObject({ level: 7, name: "Outlet" });
    await updateLayer(adminActor, outlet.id, { code: "OUT", name: "Shop" });
    // Not the deepest, or the Territory layer → refused.
    await expect(deleteLayer(adminActor, layers[1].id)).rejects.toBeInstanceOf(AppError);
    await expect(deleteLayer(adminActor, layers.find((l) => l.isTerritory)!.id)).rejects.toBeInstanceOf(AppError);
    await deleteLayer(adminActor, outlet.id);
    expect((await getTree(adminActor, unitId)).layers).toHaveLength(6);
  });

  it("assigns employees once per entry", async () => {
    const ids = await chain();
    const employee = await testPrisma().employee.create({ data: { officeId, employeeCode: "E-1", name: "Rahim", joiningDate: new Date("2024-01-01") } });
    const rows = await assignEmployee(adminActor, ids.territory, { employeeId: employee.id, distributionChannel: "General Trade" });
    expect(rows).toEqual([expect.objectContaining({ name: "Rahim", distributionChannel: "General Trade" })]);
    await expect(assignEmployee(adminActor, ids.territory, { employeeId: employee.id, distributionChannel: "" })).rejects.toBeInstanceOf(AppError);
    expect(await removeAssignment(adminActor, ids.territory, rows[0].id)).toEqual([]);
  });

  it("lists territory-wise customers including everything below, page by page", async () => {
    const ids = await chain();
    const { salesAreaId } = await testPrisma().salesTerritoryNode.findUniqueOrThrow({ where: { id: ids.territory } });
    for (let i = 1; i <= 3; i++) await testPrisma().customer.create({ data: { businessUnitId: unitId, code: `C-${i}`, name: `Store ${i}`, territoryId: salesAreaId, creditLimit: "5000" } });
    const first = await territoryCustomers(adminActor, { businessUnitId: unitId, nodeId: ids.region, customerId: "", search: "", page: 1, pageSize: 2 });
    expect(first.territory).toMatchObject({ name: "Dhaka Region", path: ["Bangladesh", "Dhaka Region"] });
    expect(first.total).toBe(3);
    expect(first.rows).toHaveLength(2);
    expect(first.customers).toHaveLength(3);
    const searched = await territoryCustomers(adminActor, { businessUnitId: unitId, nodeId: ids.territory, customerId: "", search: "store 3", page: 1, pageSize: 30 });
    expect(searched.rows.map((r) => r.code)).toEqual(["C-3"]);
  });

  it("imports the tree and customer assignments from Excel and exports them back", async () => {
    await getTree(adminActor, unitId);
    const tree = await importTree(
      adminActor,
      unitId,
      await workbook([
        ["National Code", "National Name", "Region Code", "Region Name", "Territory Code", "Territory Name"],
        ["BD", "Bangladesh", "R-CTG", "Chattogram Region", "T-PAT", "Patiya"],
        ["BD", "Bangladesh", "R-CTG", "Chattogram Region", "T-BOA", "Boalkhali"],
      ]),
    );
    expect(tree.errors).toEqual([]);
    expect(tree.created).toBeGreaterThanOrEqual(4);
    await testPrisma().customer.create({ data: { businessUnitId: unitId, code: "C-9", name: "Hill Store" } });
    const customers = await importCustomers(adminActor, unitId, await workbook([["Customer Code", "Territory Code"], ["C-9", "T-PAT"], ["C-404", "T-PAT"]]));
    expect(customers.errors).toHaveLength(1);
    const patiya = await testPrisma().salesTerritoryNode.findFirstOrThrow({ where: { code: "T-PAT" } });
    expect((await testPrisma().customer.findFirstOrThrow({ where: { code: "C-9" } })).territoryId).toBe(patiya.salesAreaId);

    const book = new ExcelJS.Workbook();
    await book.xlsx.load((await exportTree(adminActor, unitId)) as unknown as ArrayBuffer);
    expect(book.worksheets[0].rowCount).toBe(3);
  });
});
