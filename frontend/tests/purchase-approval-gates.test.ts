import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma/client", async () => {
  const { testPrisma } = await import("./helpers/test-db");
  return { db: testPrisma };
});
import type { PrismaClient } from "@/generated/prisma/client";
import { createPipeline } from "@/features/configuration/security/approval/server/approval.service";
import { createItem } from "@/features/sales/masters/services/masters.service";
import type { Actor } from "@/lib/auth/actor";
import { createSupplierBill } from "@/lib/purchase-store/payables";
import { purchaseStore } from "@/lib/purchase-store/store";
import { adminActor, businessUnitInput, companyInput, officeInput } from "./helpers/fixtures";
import { startTestDb, stopTestDb } from "./helpers/test-db";

/**
 * Goods receipts, purchase returns and supplier payments under an approval pipeline:
 * nothing reaches stock or the supplier balance until the last stage approves.
 */
describe("purchase approval gates", () => {
  let prisma: PrismaClient;
  let warehouseId: string;
  let supplierId: string;
  let flourId: string;
  let managerId: string;
  let financeId: string;
  let chairId: string;
  let receiptId: string;
  const as = (id: string, name: string): Actor => ({ ...adminActor, id, name, isMaster: false });
  const stock = async () => Number((await prisma.stockEntry.aggregate({ where: { warehouseId, itemId: flourId }, _sum: { qty: true } }))._sum.qty ?? 0);
  const balance = async () => Number((await prisma.supplier.findUniqueOrThrow({ where: { id: supplierId } })).balance);
  const approver = (approverId: string) => ({ userType: "USER" as const, businessUnitId: "", approverId, authorizationType: "APPROVAL" as const });
  const pipeline = (feature: string, stages: { name: string; id: string }[]) =>
    createPipeline(adminActor, {
      name: `${feature} approval`,
      feature,
      userType: "USER",
      superApproverId: chairId,
      remarks: "",
      stages: stages.map((s) => ({ name: s.name, approvalOrder: "ANY", requiredCount: 1, approvers: [approver(s.id)] })),
    } as Parameters<typeof createPipeline>[1]);
  const directReceive = (qty: number) =>
    purchaseStore.createGoodsReceipt(
      {
        purchaseOrderId: "DIRECT",
        receiptDate: "2026-11-05",
        supplierId,
        warehouseId,
        items: [{ itemId: flourId, itemCode: "", itemName: "Wheat Flour", uom: "KG", currentReceivedQuantity: qty, rejectedDamagedQuantity: 0, unitPrice: 50 }],
      },
      "Store Officer",
    );

  beforeAll(async () => {
    prisma = await startTestDb();
    const companyId = (await prisma.company.create({ data: companyInput })).id;
    const businessUnitId = (await prisma.businessUnit.create({ data: { ...businessUnitInput, companyId } })).id;
    const officeId = (await prisma.office.create({ data: { ...officeInput, businessUnitId } })).id;
    warehouseId = (await prisma.warehouse.create({ data: { officeId, name: "Material WH" } })).id;
    supplierId = (await prisma.supplier.create({ data: { businessUnitId, code: "SUP-001", name: "Anhar Traders" } })).id;
    flourId = (await createItem(adminActor, { businessUnitId, name: "Wheat Flour", uom: "KG", salesRate: 60 })).id;
    managerId = (await prisma.user.create({ data: { name: "Store Manager", phone: "01711111111", passwordHash: "x" } })).id;
    financeId = (await prisma.user.create({ data: { name: "Finance Head", phone: "01722222222", passwordHash: "x" } })).id;
    chairId = (await prisma.user.create({ data: { name: "Chairman", phone: "01733333333", passwordHash: "x" } })).id;
    await pipeline("Goods Receipt", [
      { name: "Store Manager", id: managerId },
      { name: "Finance", id: financeId },
    ]);
    await pipeline("Purchase Return", [{ name: "Store Manager", id: managerId }]);
    await pipeline("Payment Approval", [{ name: "Finance", id: financeId }]);
  });

  afterAll(async () => {
    await stopTestDb();
  });

  it("keeps a goods receipt out of stock and payables until its last stage approves", async () => {
    const grn = await directReceive(10);
    receiptId = grn.id;
    expect(grn.status).toBe("DRAFT");
    expect(await stock()).toBe(0);
    expect(await balance()).toBe(0);
    // Not payable, not billable, not returnable while pending.
    await expect(createSupplierBill({ supplierId, receiptId, billDate: "2026-11-05", number: "INV-1" }, "Accounts")).rejects.toThrow(/waiting for approval/);
    await expect(
      purchaseStore.createPurchaseReturn({ goodsReceiptId: receiptId, returnDate: "2026-11-06", items: [{ itemId: flourId, returnQuantity: 1, reason: "Wet" }] }, "Store Officer"),
    ).rejects.toThrow(/waiting for approval/);

    const manager = as(managerId, "Store Manager");
    const finance = as(financeId, "Finance Head");
    await expect(purchaseStore.decideGoodsReceipt(receiptId, "approve", "Finance Head", "", finance)).rejects.toThrow(/stage 1 \(Store Manager\)/);
    expect((await purchaseStore.decideGoodsReceipt(receiptId, "approve", "Store Manager", "OK", manager)).status).toBe("DRAFT");
    expect(await stock()).toBe(0);

    const approved = await purchaseStore.decideGoodsReceipt(receiptId, "approve", "Finance Head", "", finance);
    expect(approved.status).toBe("RECEIVED");
    expect(await stock()).toBe(10);
    expect(await balance()).toBe(500);
  });

  it("closes a rejected receipt without touching stock", async () => {
    const grn = await directReceive(4);
    await expect(purchaseStore.decideGoodsReceipt(grn.id, "reject", "Store Manager", "", as(managerId, "Store Manager"))).rejects.toThrow(/reason/);
    const rejected = await purchaseStore.decideGoodsReceipt(grn.id, "reject", "Store Manager", "Wrong challan", as(managerId, "Store Manager"));
    expect(rejected.status).toBe("CANCELLED");
    expect(await stock()).toBe(10);
    expect(await balance()).toBe(500);
  });

  it("takes returned goods out of stock only when the return is approved", async () => {
    const ret = await purchaseStore.createPurchaseReturn(
      { goodsReceiptId: receiptId, returnDate: "2026-11-06", items: [{ itemId: flourId, returnQuantity: 4, reason: "Wet" }] },
      "Store Officer",
    );
    expect(ret.status).toBe("PENDING_APPROVAL");
    expect(await stock()).toBe(10);
    expect(await balance()).toBe(500);

    const done = await purchaseStore.decidePurchaseReturn(ret.id, "approve", "Store Manager", "", as(managerId, "Store Manager"));
    expect(done.status).toBe("COMPLETED");
    expect(await stock()).toBe(6);
    expect(await balance()).toBe(300);
  });

  it("pays an advance only after Payment Approval", async () => {
    const payment = await purchaseStore.createSupplierPayment({ supplierId, amount: 100, isAdvance: true, method: "CASH", paymentDate: "2026-11-07" }, "Accounts");
    expect(payment.status).toBe("DRAFT");
    expect(await balance()).toBe(300);
    await expect(purchaseStore.decideSupplierPayment(payment.id, "approve", "Store Manager", "", as(managerId, "Store Manager"))).rejects.toThrow(/Finance/);

    const paid = await purchaseStore.decideSupplierPayment(payment.id, "approve", "Finance Head", "", as(financeId, "Finance Head"));
    expect(paid.status).toBe("PAID");
    expect(await balance()).toBe(200);
  });

  it("sends an approved purchase order back for approval when it is edited", async () => {
    const grn = await directReceive(2); // a pending receipt against a fresh, auto-approved order
    const order = (await prisma.goodsReceipt.findUniqueOrThrow({ where: { id: grn.id }, select: { orderId: true } })).orderId;
    expect((await prisma.purchaseOrder.findUniqueOrThrow({ where: { id: order } })).status).toBe("APPROVED");

    await purchaseStore.updatePurchaseOrder(order, { referenceNumber: "REF-2" }, "Buyer");
    expect((await prisma.purchaseOrder.findUniqueOrThrow({ where: { id: order } })).status).toBe("PENDING");
    // Its pending receipt can no longer book against an order that is back in approval.
    await expect(purchaseStore.decideGoodsReceipt(grn.id, "approve", "Master", "", { ...adminActor, isMaster: true } as Actor)).rejects.toThrow(/no longer be approved/);
  });
});
