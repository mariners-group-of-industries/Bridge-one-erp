import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import type { Actor, Permission } from "@/lib/auth/actor";
import { createBom } from "@/features/production/bom/services/bom.service";
import { orderPdf } from "@/features/production/orders/services/order-pdf";
import {
  actOnOrder,
  createOrder,
  customerSalesOrders,
  getOrder,
  listOrders,
  orderLookups,
  previewOrder,
  searchCustomers,
  updateOrder,
} from "@/features/production/orders/services/order.service";
import { adminActor, businessUnitInput, companyInput, officeInput, scopedActor } from "./helpers/fixtures";
import { resetTestDb, startTestDb, stopTestDb } from "./helpers/test-db";

// Route database access to the per-file PGlite test database.
vi.mock("@/lib/prisma/client", async () => {
  const { testPrisma } = await import("./helpers/test-db");
  return { db: testPrisma };
});

const OTHER_COMPANY = "00000000-0000-4000-8000-000000000000";
const actor = (id: string, permissions: Permission[]): Actor => ({ ...adminActor, id, isMaster: false, permissions: new Set(permissions) });
const planner = actor("planner", ["production:read", "production:write"]);
const manager = actor("manager", ["production:read", "production:write", "production:approve"]);

describe("production orders", () => {
  let prisma: PrismaClient;
  let ids: Record<string, string>;

  beforeAll(async () => {
    prisma = await startTestDb();
  });

  beforeEach(async () => {
    await resetTestDb();
    const companyId = (await prisma.company.create({ data: { ...companyInput, name: "Mariners Group" } })).id;
    const businessUnitId = (await prisma.businessUnit.create({ data: { ...businessUnitInput, companyId } })).id;
    const officeId = (await prisma.office.create({ data: { ...officeInput, name: "MG Sirajganj Factory", businessUnitId } })).id;
    const otherOfficeId = (await prisma.office.create({ data: { ...officeInput, name: "Dhaka Office", businessUnitId } })).id;
    const warehouseId = (await prisma.warehouse.create({ data: { officeId, name: "RM Store" } })).id;
    const otherWarehouseId = (await prisma.warehouse.create({ data: { officeId: otherOfficeId, name: "Dhaka Store" } })).id;
    const item = async (code: string, name: string, uom = "KG") => (await prisma.item.create({ data: { businessUnitId, code, name, uom } })).id;
    ids = {
      businessUnitId,
      officeId,
      warehouseId,
      otherWarehouseId,
      chips: await item("SFG-00658", "SFGSNCHIPS"),
      potato: await item("RM-00529", "Potato Pallet"),
      oil: await item("RM-00100", "Palm Oil", "LTR"),
    };
    await prisma.stockEntry.create({
      data: { businessUnitId, warehouseId, itemId: ids.potato, qty: 50, source: "OPENING", postingDate: new Date("2026-10-01"), createdBy: "test" },
    });
    const bom = await createBom(adminActor, {
      name: "SFGSNCHIPS",
      bomType: "SINGLE_OUTPUT",
      outputs: [{ itemId: ids.chips, outputType: "SEMI_FINISHED_GOODS", netWeight: 1, lotSizeQty: 100, costPercent: 100 }],
      materials: [
        { itemId: ids.potato, qty: 80, wastagePercent: 25, rate: 20, excludeFromScrap: false },
        { itemId: ids.oil, qty: 10, wastagePercent: 0, rate: 150, excludeFromScrap: false },
      ],
    });
    ids.bom = bom.id;
    ids.customer = (await prisma.customer.create({ data: { businessUnitId, code: "C-001", name: "Shwapno Retail" } })).id;
  });

  afterAll(stopTestDb);

  const input = (overrides: Record<string, unknown> = {}) => ({
    orderDate: "2026-10-21",
    productionDate: "2026-10-22",
    itemId: ids.chips,
    bomId: ids.bom,
    quantity: 81,
    officeId: ids.officeId,
    warehouseId: ids.warehouseId,
    customerPoNo: "PO-77",
    narration: "Weekly run",
    ...overrides,
  });

  it("explodes the BOM for the order quantity and numbers orders per year", async () => {
    // potato 80 × 1.25 = 100 per lot of 100 → 81; oil 10 → 8.1; cost (2000 + 1500) / 100 = 35 per unit
    const preview = await previewOrder(planner, { bomId: ids.bom, itemId: ids.chips, quantity: "81", warehouseId: ids.warehouseId });
    expect(preview).toMatchObject({ lotSize: 100, factor: 0.81, unitCost: 35, totalCost: 2835 });
    expect(preview.materials.map((line) => [line.code, line.bomQty, line.requiredQty, line.stock])).toEqual([
      ["RM-00529", 100, 81, 50],
      ["RM-00100", 10, 8.1, 0],
    ]);

    const first = await createOrder(planner, input());
    const second = await createOrder(planner, input({ quantity: 10 }));
    expect(first.number).toBe("PRO-MG260000001");
    expect(second.number).toBe("PRO-MG260000002");
    expect(first).toMatchObject({
      status: "PENDING_APPROVAL",
      orderQty: 81,
      remainingQty: 81,
      producedValue: 0,
      bomLotSize: 100,
      unitCost: 35,
      officeName: "MG Sirajganj Factory",
      warehouseName: "RM Store",
      customerPoNo: "PO-77",
      canEdit: true,
    });
    expect(first.materials.map((line) => [line.code, line.requiredQty, line.remainingQty])).toEqual([
      ["RM-00529", 81, 81],
      ["RM-00100", 8.1, 8.1],
    ]);
    expect(first.approvals).toEqual([
      expect.objectContaining({ stageName: "Production Order Approval", approvalOrder: "ANY", status: "PENDING", approverNames: [] }),
    ]);

    expect(await listOrders(planner, { from: "2026-10-19", to: "2026-10-25", search: "chips" })).toHaveLength(2);
    expect(await listOrders(planner, { status: "CLOSED" })).toHaveLength(0);
    expect(await listOrders(scopedActor([OTHER_COMPANY]), {})).toHaveLength(0);
    await expect(getOrder(scopedActor([OTHER_COMPANY]), first.id)).rejects.toThrow("not found");

    const lookups = await orderLookups(planner);
    expect(lookups.items).toEqual([expect.objectContaining({ code: "SFG-00658", boms: [expect.objectContaining({ name: "SFGSNCHIPS", lotSize: 100 })] })]);
    expect(lookups.canApprove).toBe(false);

    const pdf = await orderPdf(planner, first.id);
    expect(Buffer.from(pdf.bytes.slice(0, 5)).toString()).toBe("%PDF-");
  });

  it("validates references and dates", async () => {
    await expect(createOrder(planner, input({ warehouseId: ids.otherWarehouseId }))).rejects.toThrow("warehouse of the chosen office");
    await expect(createOrder(planner, input({ itemId: ids.potato }))).rejects.toThrow("does not produce");
    await expect(createOrder(planner, input({ productionDate: "2026-10-20" }))).rejects.toThrow();
    await expect(createOrder(planner, input({ quantity: 0 }))).rejects.toThrow();
    const salesOrder = await prisma.salesOrder.create({
      data: {
        businessUnitId: ids.businessUnitId,
        officeId: ids.officeId,
        number: "SO-1",
        customerId: ids.customer,
        status: "APPROVED",
        orderDate: new Date("2026-10-20"),
        expectedDeliveryDate: new Date("2026-10-30"),
        createdBy: "test",
        updatedBy: "test",
      },
    });
    await expect(createOrder(planner, input({ salesOrderId: salesOrder.id }))).rejects.toThrow();
    const linked = await createOrder(planner, input({ customerId: ids.customer, salesOrderId: salesOrder.id }));
    expect(linked).toMatchObject({ customerName: "C-001 - Shwapno Retail", salesOrderNumber: "SO-1" });
    expect((await searchCustomers(planner, { search: "shwap" })).map((row) => row.code)).toEqual(["C-001"]);
    expect((await customerSalesOrders(planner, ids.customer)).map((row) => row.number)).toEqual(["SO-1"]);
    await expect(searchCustomers(planner, { search: "sh" })).rejects.toThrow("3 letters");
  });

  it("approves without a pipeline, then runs and closes; edits only before approval", async () => {
    const order = await createOrder(planner, input());
    const edited = await updateOrder(planner, order.id, { version: order.updatedAt, data: input({ quantity: 200 }) });
    expect(edited.materials[0].requiredQty).toBe(200);
    await expect(updateOrder(planner, order.id, { version: order.updatedAt, data: input() })).rejects.toThrow("Someone else");

    expect(edited.allowedActions).toEqual(["cancel"]);
    await expect(actOnOrder(planner, order.id, { version: edited.updatedAt, action: "approve" })).rejects.toThrow("cannot approve");
    const managerView = await getOrder(manager, order.id);
    expect(managerView.allowedActions).toEqual(["approve", "reject", "cancel"]);

    const approved = await actOnOrder(manager, order.id, { version: managerView.updatedAt, action: "approve", comment: "OK" });
    expect(approved.status).toBe("APPROVED");
    expect(approved.approvals[0]).toMatchObject({ status: "APPROVED", comment: "OK", approvedNames: ["manager"] });
    expect(approved.canEdit).toBe(false);
    await expect(updateOrder(planner, order.id, { version: approved.updatedAt, data: input() })).rejects.toThrow();

    const started = await actOnOrder(planner, order.id, { version: approved.updatedAt, action: "start" });
    expect(started.status).toBe("IN_PROGRESS");
    await expect(actOnOrder(planner, order.id, { version: started.updatedAt, action: "cancel", comment: "x" })).rejects.toThrow("cannot cancel");
    const closed = await actOnOrder(planner, order.id, { version: started.updatedAt, action: "close" });
    expect(closed.status).toBe("CLOSED");
    expect(closed.allowedActions).toEqual([]);

    const other = await createOrder(planner, input());
    await expect(actOnOrder(manager, other.id, { version: other.updatedAt, action: "reject" })).rejects.toThrow();
    const rejected = await actOnOrder(manager, other.id, { version: other.updatedAt, action: "reject", comment: "No capacity" });
    expect(rejected).toMatchObject({ status: "REJECTED", statusReason: "No capacity" });
    expect(rejected.approvals[0].status).toBe("REJECTED");
  });

  it("follows a multi-stage approval pipeline with sequential approvers", async () => {
    const user = async (name: string, phone: string) => (await prisma.user.create({ data: { name, phone, passwordHash: "x" } })).id;
    const [supervisor, head, director] = [await user("Supervisor", "01700000001"), await user("Head", "01700000002"), await user("MD. Tofajjol Hossin", "01700000003")];
    await prisma.approvalPipeline.create({
      data: {
        name: "Production Order Approval",
        feature: "Production Order",
        stages: {
          create: [
            {
              stageNo: 1,
              name: "Production Check",
              approvalOrder: "SEQUENTIAL",
              requiredCount: 2,
              approvers: {
                create: [
                  { sortOrder: 0, userType: "USER", userId: supervisor, authorizationType: "APPROVAL" },
                  { sortOrder: 1, userType: "USER", userId: head, authorizationType: "APPROVAL" },
                ],
              },
            },
            { stageNo: 2, name: "Production Order Approval", approvalOrder: "ANY", requiredCount: 1, approvers: { create: [{ userType: "USER", userId: director, authorizationType: "APPROVAL" }] } },
          ],
        },
      },
    });
    const as = (id: string) => actor(id, ["production:read"]);
    let order = await createOrder(planner, input());
    expect(order.approvals.map((stage) => [stage.stageName, stage.approvalOrder, stage.requiredCount, stage.approverNames])).toEqual([
      ["Production Check", "SEQUENTIAL", 2, ["Supervisor", "Head"]],
      ["Production Order Approval", "ANY", 1, ["MD. Tofajjol Hossin"]],
    ]);
    // Sequential: Head cannot approve before Supervisor; the manager permission does not bypass a pipeline.
    expect((await getOrder(as(head), order.id)).allowedActions).toEqual([]);
    expect((await getOrder(manager, order.id)).allowedActions).toEqual(["cancel"]);

    order = await actOnOrder(as(supervisor), order.id, { version: order.updatedAt, action: "approve" });
    expect(order).toMatchObject({ status: "PENDING_APPROVAL", canEdit: false });
    expect(order.approvals[0]).toMatchObject({ status: "PENDING", approvedNames: ["Supervisor"] });
    order = await actOnOrder(as(head), order.id, { version: order.updatedAt, action: "approve" });
    expect(order.approvals.map((stage) => stage.status)).toEqual(["APPROVED", "PENDING"]);
    expect((await getOrder(as(supervisor), order.id)).allowedActions).toEqual([]);
    order = await actOnOrder(as(director), order.id, { version: order.updatedAt, action: "approve", comment: "N/A" });
    expect(order.status).toBe("APPROVED");
    expect(order.approvals[1]).toMatchObject({ status: "APPROVED", approvedNames: ["MD. Tofajjol Hossin"] });
  });
});
