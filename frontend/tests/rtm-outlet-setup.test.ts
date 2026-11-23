import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma/client", async () => {
  const { testPrisma } = await import("./helpers/test-db");
  return { db: () => testPrisma() };
});

import ExcelJS from "exceljs";
import { lookups } from "@/features/rtm/server/masters.service";
import { addOutletAttachment, bulkCreateOutlets, deleteOutletAttachment, listOutletAttachments, listOutlets, readOutletAttachment, resubmitOutlet, reviewOutlet, saveOutlet } from "@/features/rtm/server/outlet.service";
import { setStorage } from "@/lib/storage";
import { MemoryStorage, adminActor, businessUnitInput, companyInput, pngBytes } from "./helpers/fixtures";
import { resetTestDb, startTestDb, stopTestDb, testPrisma } from "./helpers/test-db";

let businessUnitId: string;
let distributorId: string;
const node: Record<string, string> = {};

beforeAll(async () => {
  await startTestDb();
  setStorage(new MemoryStorage());
});
afterAll(async () => {
  setStorage(undefined);
  await stopTestDb();
});

beforeEach(async () => {
  await resetTestDb();
  const companyId = (await testPrisma().company.create({ data: companyInput })).id;
  businessUnitId = (await testPrisma().businessUnit.create({ data: { ...businessUnitInput, companyId } })).id;
  distributorId = (await testPrisma().customer.create({ data: { businessUnitId, code: "D-001", name: "Rahman Distribution", customerType: "DISTRIBUTOR" } })).id;
  // Territory › Base Point › Route › Market
  const layers = ["Territory", "Base Point", "Route", "Market"];
  const layerIds: string[] = [];
  for (const [i, name] of layers.entries()) layerIds.push((await testPrisma().salesTerritoryLayer.create({ data: { businessUnitId, level: i + 1, code: name.slice(0, 3).toUpperCase(), name } })).id);
  let parentId: string | null = null;
  for (const [i, code] of ["TER-1", "BP-1", "RTE-1", "MKT-1"].entries()) {
    parentId = (await testPrisma().salesTerritoryNode.create({ data: { businessUnitId, layerId: layerIds[i], parentId, code, name: `${layers[i]} One` } })).id;
    node[code] = parentId;
  }
});

const outlet = (extra: Record<string, unknown> = {}) => ({ name: "Karim Store", nameBn: "করিম স্টোর", partnerCode: "P-100", distributorId, phone: "01711000000", salesPeriod: "MONTHLY", regularSales: "25000", areaNodeIds: [node["MKT-1"]], ...extra });

describe("Outlet Setup", () => {
  it("creates an outlet waiting for approval, with its territory path in the list", async () => {
    const { id, code } = await saveOutlet(adminActor, outlet());
    expect(code).toMatch(/^OUT-\d{5}$/);
    const [row] = await listOutlets(adminActor);
    expect(row).toMatchObject({ id, name: "Karim Store", nameBn: "করিম স্টোর", partnerCode: "P-100", approvalStatus: "PENDING", territory: "Territory One", basePoint: "Base Point One", route: "Route One", market: "Market One", salesPeriod: "MONTHLY", regularSales: 25000 });
  });

  it("keeps unapproved outlets out of ordering until approved; a rejected one can be sent again", async () => {
    const { id } = await saveOutlet(adminActor, outlet());
    expect((await lookups(adminActor)).outlets.map((o) => o.id)).not.toContain(id);
    await reviewOutlet(adminActor, id, "reject");
    await expect(reviewOutlet(adminActor, id, "approve")).rejects.toThrow(/already rejected/);
    await resubmitOutlet(adminActor, id);
    await reviewOutlet(adminActor, id, "approve");
    expect((await lookups(adminActor)).outlets.map((o) => o.id)).toContain(id);
    expect((await listOutlets(adminActor))[0]).toMatchObject({ approvalStatus: "APPROVED" });
  });

  it("refuses a partner code used by another outlet, and wrong NID or email", async () => {
    await saveOutlet(adminActor, outlet());
    await expect(saveOutlet(adminActor, outlet({ name: "Other" }))).rejects.toThrow(/Partner code P-100 is already used/);
    await expect(saveOutlet(adminActor, outlet({ partnerCode: "", nid: "12" }))).rejects.toThrow(/NID/);
    await expect(saveOutlet(adminActor, outlet({ partnerCode: "", email: "not-an-email" }))).rejects.toThrow();
  });

  it("edits the areas: the first is the main one", async () => {
    const { id } = await saveOutlet(adminActor, outlet());
    await saveOutlet(adminActor, outlet({ areaNodeIds: [node["RTE-1"], node["MKT-1"]] }), id);
    const [row] = await listOutlets(adminActor);
    // The main area is the route, so the list shows no market for it.
    expect(row).toMatchObject({ areaNodeIds: [node["RTE-1"], node["MKT-1"]], route: "Route One", moreAreas: 1 });
    expect(row.market).toBeUndefined();
    await expect(saveOutlet(adminActor, outlet({ areaNodeIds: [node["MKT-1"], node["MKT-1"]] }), id)).rejects.toThrow(/added twice/);
  });

  it("stores, reads and removes the outlet image", async () => {
    const { id } = await saveOutlet(adminActor, outlet());
    const bytes = pngBytes();
    const { id: fileId } = await addOutletAttachment(adminActor, id, "IMAGE", { name: "front.png", type: "image/png", size: bytes.byteLength, bytes });
    expect(await listOutletAttachments(adminActor, id)).toMatchObject([{ kind: "IMAGE", originalName: "front.png" }]);
    expect((await readOutletAttachment(adminActor, id, fileId)).mimeType).toBe("image/png");
    await deleteOutletAttachment(adminActor, id, fileId);
    expect(await listOutletAttachments(adminActor, id)).toHaveLength(0);
  });

  it("bulk-creates outlets from the template, and saves nothing when a row is wrong", async () => {
    const sheet = async (rows: string[][]) => {
      const book = new ExcelJS.Workbook();
      const ws = book.addWorksheet("Outlets");
      ws.addRow(["Outlet Name", "Partner Code", "Distributor Code", "Market Code", "Contact Number"]);
      for (const r of rows) ws.addRow(r);
      return new Uint8Array(await book.xlsx.writeBuffer());
    };
    await expect(bulkCreateOutlets(adminActor, await sheet([["A Store", "P-1", "D-001", "MKT-1", "01711111111"], ["B Store", "P-2", "D-404", "", ""]]))).rejects.toThrow(/Row 3: no distributor with code "D-404"/);
    expect(await listOutlets(adminActor)).toHaveLength(0);
    expect(await bulkCreateOutlets(adminActor, await sheet([["A Store", "P-1", "D-001", "MKT-1", "01711111111"], ["B Store", "P-2", "D-001", "", ""]]))).toEqual({ created: 2 });
    const rows = await listOutlets(adminActor);
    expect(rows.map((r) => [r.name, r.approvalStatus, r.market ?? null])).toEqual([
      ["A Store", "PENDING", "Market One"],
      ["B Store", "PENDING", null],
    ]);
  });
});
