import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import type { Actor } from "@/lib/auth/actor";
import { purchaseStore } from "@/lib/purchase-store/store";
import { createPipeline } from "@/features/configuration/security/approval/server/approval.service";
import { stockLevels } from "@/features/sales/deliveries/services/stock.service";
import { adminActor, businessUnitInput, companyInput, officeInput } from "./helpers/fixtures";
import { startTestDb, stopTestDb } from "./helpers/test-db";

vi.mock("@/lib/prisma/client", async () => {
  const { testPrisma } = await import("./helpers/test-db");
  return { db: testPrisma };
});

const STAFF = "Store Officer";

/**
 * Pipelines whose only stage is for large amounts: smaller documents have no
 * one to approve them, so they go through at once. Also: cancelling a receipt
 * takes it back out of the item's average cost.
 */
describe("approval thresholds and receipt cancellation cost", () => {
  let prisma: PrismaClient;
  const ids: Record<string, string> = {};
  let director: Actor;
  const stock = async () => (await stockLevels(ids.wh, [ids.flour])).get(ids.flour) ?? 0;
  const cost = async () => Number((await prisma.item.findUniqueOrThrow({ where: { id: ids.flour } })).purchasePrice);

  beforeAll(async () => {
    prisma = await startTestDb();
    const companyId = (await prisma.company.create({ data: { ...companyInput, name: "Mariners Group" } })).id;
    const businessUnitId = (await prisma.businessUnit.create({ data: { ...businessUnitInput, companyId } })).id;
    const officeId = (await prisma.office.create({ data: { ...officeInput, businessUnitId } })).id;
    Object.assign(ids, {
      officeId,
      wh: (await prisma.warehouse.create({ data: { officeId, name: "Material WH" } })).id,
      supplier: (await prisma.supplier.create({ data: { businessUnitId, code: "SUP-1", name: "M/S Vai Vai Traders" } })).id,
      flour: (await prisma.item.create({ data: { businessUnitId, code: "RM-1", name: "Wheat Flour", uom: "KG" } })).id,
    });
    const directorId = (await prisma.user.create({ data: { name: "Director", phone: "01710000009", passwordHash: "x" } })).id;
    director = { ...adminActor, id: directorId, name: "Director", isMaster: false };
    for (const feature of ["Purchase Order", "Goods Receipt", "Payment Approval"]) {
      await createPipeline(adminActor, {
        name: `${feature} above 1 lakh`, feature, userType: "USER", superApproverId: directorId, remarks: "",
        stages: [{ name: "Director", approvalOrder: "ANY", requiredCount: 1, allowThreshold: true, thresholdMin: "100000", approvers: [{ userType: "USER", businessUnitId: "", approverId: directorId, authorizationType: "APPROVAL" }] }],
      } as Parameters<typeof createPipeline>[1]);
    }
  });

  afterAll(stopTestDb);

  const order = (qty: number, unitPrice: number) =>
    purchaseStore.createPurchaseOrder(
      {
        companyId: "", supplierId: ids.supplier, officeId: ids.officeId, warehouseId: ids.wh, orderDate: "2026-11-02", expectedDeliveryDate: "2026-11-03",
        paymentTerms: "", deliveryTerms: "", shippingFee: 0,
        items: [{ itemId: ids.flour, itemCode: "", itemName: "", uom: "", orderedQuantity: qty, unitPrice, discountPercentage: 0, taxPercentage: 0, receivedQuantity: 0, returnedQuantity: 0, outstandingQuantity: 0, discountAmount: 0, taxAmount: 0, lineTotal: 0 }],
      },
      STAFF,
    );
  const receive = (po: Awaited<ReturnType<typeof order>>, qty: number) =>
    purchaseStore.createGoodsReceipt({ purchaseOrderId: po.id, receiptDate: "2026-11-03", items: [{ poItemId: po.items[0].id!, itemId: ids.flour, currentReceivedQuantity: qty }] }, STAFF);

  it("a 5,000 PO, its receipt and a 500 advance go through: no stage applies below 1 lakh", async () => {
    const po = await order(100, 50);
    expect(po.status).toBe("APPROVED");
    const grn = await receive(po, 60);
    expect(grn.status).not.toBe("DRAFT");
    expect(await stock()).toBe(60);
    expect(await cost()).toBe(50);
    const advance = await purchaseStore.createSupplierPayment({ supplierId: ids.supplier, officeId: ids.officeId, amount: 500, method: "CASH", paymentDate: "2026-11-03", purchaseOrderId: po.id, isAdvance: true }, STAFF);
    expect(advance.status).toBe("PAID");
  });

  it("a 1.2 lakh PO waits for the director", async () => {
    const po = await order(1500, 80);
    expect(po.status).toBe("PENDING_APPROVAL");
    expect((await purchaseStore.updatePurchaseOrderStatus(po.id, "APPROVE", "Director", "OK", director))?.status).toBe("APPROVED");
    ids.bigPo = po.id;
  });

  it("cancelling a receipt at a new price takes it back out of the average cost", async () => {
    const po = (await purchaseStore.getPurchaseOrderById(ids.bigPo))!;
    const grn = await receive(po, 20); // 1,600: below the receipt threshold
    expect(await stock()).toBe(80);
    // (60 × 50 + 20 × 80) ÷ 80
    expect(await cost()).toBe(57.5);
    await purchaseStore.cancelGoodsReceipt(grn.id, STAFF, "Wrong challan");
    expect(await stock()).toBe(60);
    expect(await cost()).toBe(50);
  });
});
