import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma/client", async () => {
  const { testPrisma } = await import("./helpers/test-db");
  return { db: testPrisma };
});

import { createItem } from "@/features/sales/masters/services/masters.service";
import { approveDocument, createDocument } from "@/features/inventory/server/inventory.service";
import { inventoryReport } from "@/features/inventory/server/overview.service";
import { adminActor, businessUnitInput, companyInput, officeInput } from "./helpers/fixtures";
import { resetTestDb, startTestDb, stopTestDb, testPrisma } from "./helpers/test-db";

let businessUnitId = "";
let mainWh = "";
let storeWh = "";
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
  const officeId = (await prisma.office.create({ data: { ...officeInput, businessUnitId, name: "MG Sirajganj Factory" } })).id;
  mainWh = (await prisma.warehouse.create({ data: { officeId, name: "Material WH" } })).id;
  storeWh = (await prisma.warehouse.create({ data: { officeId, name: "PD Biscuit Store" } })).id;
  flourId = (await createItem(adminActor, { businessUnitId, name: "Wheat Flour", uom: "KG", salesRate: 60 })).id;
  await prisma.stockEntry.create({
    data: { businessUnitId, warehouseId: mainWh, itemId: flourId, qty: 100, source: "OPENING", postingDate: new Date("2026-11-01"), createdBy: "test" },
  });
});

const stockOf = async (warehouseId: string) =>
  Number((await testPrisma().stockEntry.aggregate({ where: { warehouseId, itemId: flourId }, _sum: { qty: true } }))._sum.qty ?? 0);

describe("iBOS inventory forms", () => {
  it("a transfer request names only the requesting warehouse; the transfer out picks where the stock comes from", async () => {
    const request = await createDocument(adminActor, "TRANSFER_REQUEST", {
      docDate: "2026-11-15",
      expectedDate: "2026-11-16",
      toWarehouseId: storeWh,
      reference: "SO-MG261100074",
      meta: { requestTo: "Md. Usuf Ali", itemType: "Inventory Item", officeName: "MG Sirajganj Factory" },
      lines: [{ itemId: flourId, qty: 30 }],
    });
    expect(request.warehouse).toBeNull();
    expect(request.toWarehouse?.id).toBe(storeWh);
    expect(request.meta?.requestTo).toBe("Md. Usuf Ali");

    // Without a requesting warehouse it is refused.
    await expect(createDocument(adminActor, "TRANSFER_REQUEST", { docDate: "2026-11-15", lines: [{ itemId: flourId, qty: 1 }] })).rejects.toThrow(/requesting warehouse/);

    await approveDocument(adminActor, "TRANSFER_REQUEST", request.id, {});
    const transfer = await createDocument(adminActor, "TRANSFER", {
      docDate: "2026-11-15",
      warehouseId: mainWh,
      toWarehouseId: storeWh,
      requestId: request.id,
      meta: { grnNo: "GRN-1" },
      lines: [{ itemId: flourId, qty: 30, remarks: "first lot" }],
    });
    expect(transfer.status).toBe("IN_TRANSIT");
    expect(transfer.lines[0].remarks).toBe("first lot");
    expect(await stockOf(mainWh)).toBe(70);
    // The list shows who raised the request and who it was addressed to.
    expect(transfer.request).toMatchObject({ number: request.number, requestTo: "Md. Usuf Ali" });

    // Report: 70 left in the main warehouse, all from the 1 Nov opening (14 days old on 15 Nov);
    // the 30 on the road count as pipeline for the store.
    const rows = await inventoryReport(adminActor, { from: "2026-11-10", to: "2026-11-15" });
    const main = rows.find((r) => r.warehouseId === mainWh)!;
    expect(main).toMatchObject({ openingQty: 100, outQty: 30, closingQty: 70, lastOutDate: "2026-11-15" });
    expect(main.aging).toEqual({ d0_30: 70, d31_60: 0, d61_90: 0, d91_180: 0, d181: 0 });
    // The store has nothing yet, but its 30 in transit still shows.
    expect(rows.find((r) => r.warehouseId === storeWh)).toMatchObject({ closingQty: 0, inTransitQty: 30 });
  });

  it("a direct transfer in is received at once, with nothing left in transit", async () => {
    const transfer = await createDocument(adminActor, "TRANSFER", {
      docDate: "2026-11-15",
      warehouseId: mainWh,
      toWarehouseId: storeWh,
      meta: { directTransferIn: "Yes" },
      lines: [{ itemId: flourId, qty: 25 }],
    });
    expect(transfer.status).toBe("COMPLETED");
    expect(transfer.processedQty).toBe(25);
    expect(await stockOf(mainWh)).toBe(75);
    expect(await stockOf(storeWh)).toBe(25);
  });

  it("a goods gate pass needs no party; a visitor pass needs the visitor's name", async () => {
    const goods = await createDocument(adminActor, "GATE_PASS", {
      docDate: "2026-11-15",
      subtype: "Gate In",
      reference: "PO-2026-00001",
      meta: { refType: "Purchase Order", vehicleNo: "DHAKA-METRO-TA-11", driverName: "Karim", weightBefore: "12000", weightAfter: "9000" },
    });
    expect(goods.partyName).toBeNull();
    expect(goods.meta?.weightAfter).toBe("9000");

    await expect(createDocument(adminActor, "GATE_PASS", { docDate: "2026-11-15", subtype: "Visitor" })).rejects.toThrow(/visitor name/);
    const visitor = await createDocument(adminActor, "GATE_PASS", { docDate: "2026-11-15", subtype: "Visitor", partyName: "Rahim", meta: { companyName: "ACES Inc." } });
    expect(visitor.partyName).toBe("Rahim");
  });

  it("a store requisition keeps the employee, department and project of the iBOS form", async () => {
    const req = await createDocument(adminActor, "STORE_REQUISITION", {
      docDate: "2026-11-15",
      expectedDate: "2026-11-17",
      warehouseId: mainWh,
      partyName: "Md. Usuf Ali",
      meta: { department: "Production", project: "CC-100 - Corporate Head Office" },
      lines: [{ itemId: flourId, qty: 5 }],
    });
    expect(req.partyName).toBe("Md. Usuf Ali");
    expect(req.meta).toMatchObject({ department: "Production" });
  });
});
