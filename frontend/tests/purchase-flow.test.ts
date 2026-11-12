import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { createItem } from "@/features/sales/masters/services/masters.service";
import { purchaseStore } from "@/lib/purchase-store/store";
import {
  orderTransition,
  priceLine,
  receiptLineError,
  receivingStatus,
  requisitionTransition,
  returnableByItem,
} from "@/lib/purchase-store/rules";
import { adminActor, businessUnitInput, companyInput, officeInput } from "./helpers/fixtures";
import { startTestDb, stopTestDb } from "./helpers/test-db";

// Route database access to the per-file PGlite test database.
vi.mock("@/lib/prisma/client", async () => {
  const { testPrisma } = await import("./helpers/test-db");
  return { db: testPrisma };
});

const ACTOR = "Store Officer";

describe("purchase rules", () => {
  it("prices a line with discount, then VAT on the discounted amount", () => {
    expect(priceLine(10, 100, 10, 15)).toEqual({ gross: 1000, discount: 100, tax: 135, lineTotal: 1035 });
  });

  it("only lets an approved requisition be ordered, and never changes an ordered one", () => {
    expect(requisitionTransition("PENDING", "APPROVE")).toEqual({ to: "APPROVED" });
    expect(requisitionTransition("APPROVED", "APPROVE")).toHaveProperty("error");
    expect(requisitionTransition("ORDERED", "CANCEL")).toHaveProperty("error");
    expect(requisitionTransition("REJECTED", "REVERSE")).toEqual({ to: "PENDING" });
  });

  it("closes rather than cancels an order once goods arrived", () => {
    const partly = [{ ordered: 10, received: 4 }];
    expect(orderTransition("PARTIAL_RECEIVED", "CANCEL", partly)).toHaveProperty("error");
    expect(orderTransition("PARTIAL_RECEIVED", "CLOSE", partly)).toEqual({ to: "CLOSED" });
    expect(orderTransition("CLOSED", "REVERSE", partly)).toEqual({ to: "PARTIAL_RECEIVED" });
    expect(receivingStatus([{ ordered: 10, received: 10 }, { ordered: 5, received: 0 }])).toBe("PARTIAL_RECEIVED");
  });

  it("refuses to receive more than is due or reject more than arrived", () => {
    expect(receiptLineError({ itemName: "Flour", outstanding: 5, received: 6, rejected: 0 })).toMatch(/only 5/);
    expect(receiptLineError({ itemName: "Flour", outstanding: 5, received: 6, rejected: 1 })).toBeNull();
    expect(receiptLineError({ itemName: "Flour", outstanding: 5, received: 2, rejected: 3 })).toMatch(/rejected/);
  });

  it("tracks what is still returnable per item", () => {
    const left = returnableByItem([{ itemKey: "a", qty: 8 }], [{ itemKey: "a", qty: 3 }]);
    expect(left.get("a")).toBe(5);
  });
});

describe("purchase flow: requisition → order → receipt → return", () => {
  let prisma: PrismaClient;
  let officeId: string;
  let warehouseId: string;
  let supplierId: string;
  let flourId: string;
  let sugarId: string;

  const stockOf = async (itemId: string) =>
    Number((await prisma.stockEntry.aggregate({ where: { warehouseId, itemId }, _sum: { qty: true } }))._sum.qty ?? 0);
  const balanceOf = async () => Number((await prisma.supplier.findUniqueOrThrow({ where: { id: supplierId } })).balance);

  beforeAll(async () => {
    prisma = await startTestDb();
    const companyId = (await prisma.company.create({ data: companyInput })).id;
    const businessUnitId = (await prisma.businessUnit.create({ data: { ...businessUnitInput, companyId } })).id;
    officeId = (await prisma.office.create({ data: { ...officeInput, businessUnitId } })).id;
    warehouseId = (await prisma.warehouse.create({ data: { officeId, name: "Material WH" } })).id;
    supplierId = (await prisma.supplier.create({ data: { businessUnitId, code: "SUP-001", name: "Anhar Traders" } })).id;
    flourId = (await createItem(adminActor, { businessUnitId, name: "Wheat Flour", uom: "KG", salesRate: 60 })).id;
    sugarId = (await createItem(adminActor, { businessUnitId, name: "Sugar", uom: "KG", salesRate: 120 })).id;
  });

  afterAll(async () => {
    await stopTestDb();
  });

  let requisitionId: string;
  let orderId: string;
  let receiptId: string;

  it("numbers and validates a requisition", async () => {
    const req = await purchaseStore.createRequisition(
      {
        companyId: "",
        officeId,
        warehouseId,
        requestType: "LOCAL",
        department: "Production",
        requesterName: "Line Supervisor",
        purchaseMethod: "DIRECT",
        requestDate: "2026-11-01",
        requiredDeliveryDate: "2026-11-08",
        businessJustification: "Weekly raw material",
        items: [
          { itemId: flourId, itemCode: "", itemName: "", uom: "", quantity: 100, estimatedUnitPrice: 50, lineTotal: 0 },
          { itemId: sugarId, itemCode: "", itemName: "", uom: "", quantity: 20, estimatedUnitPrice: 100, lineTotal: 0 },
        ],
      },
      ACTOR,
    );
    requisitionId = req.id;
    expect(req.requisitionNumber).toBe("REQ-2026-00001");
    expect(req.status).toBe("SUBMITTED");
    expect(req.totalEstimatedAmount).toBe(7000);
    // Item code and name come from the item master.
    expect(req.items[0].itemName).toBe("Wheat Flour");
  });

  it("will not order a requisition before it is approved", async () => {
    await expect(
      purchaseStore.createPurchaseOrder(
        {
          companyId: "",
          requisitionId,
          supplierId,
          officeId,
          warehouseId,
          orderDate: "2026-11-02",
          expectedDeliveryDate: "2026-11-09",
          paymentTerms: "",
          deliveryTerms: "",
          shippingFee: 0,
          items: [],
        },
        ACTOR,
      ),
    ).rejects.toThrow(/approved/);
  });

  it("requires a reason to reject, and records the approval", async () => {
    await expect(purchaseStore.updateRequisitionStatus(requisitionId, "REJECT", "Manager", "")).rejects.toThrow(/reason/);
    const approved = await purchaseStore.updateRequisitionStatus(requisitionId, "APPROVE", "Manager", "OK for this week");
    expect(approved?.status).toBe("APPROVED");
    expect(approved?.approvalHistory.map((h) => h.action)).toEqual(["SUBMITTED", "APPROVED"]);
    expect(approved?.businessJustification).toBe("Weekly raw material");
  });

  it("prices the order with discount and VAT and marks the requisition ordered", async () => {
    const po = await purchaseStore.createPurchaseOrder(
      {
        companyId: "",
        requisitionId,
        supplierId,
        officeId,
        warehouseId,
        orderDate: "2026-11-02",
        expectedDeliveryDate: "2026-11-09",
        paymentTerms: "",
        deliveryTerms: "",
        shippingFee: 50,
        items: [
          // 100 × 50 = 5000, −10% = 4500, +5% VAT = 4725
          { itemId: flourId, itemCode: "", itemName: "", uom: "", orderedQuantity: 100, unitPrice: 50, discountPercentage: 10, taxPercentage: 5, receivedQuantity: 0, returnedQuantity: 0, outstandingQuantity: 0, discountAmount: 0, taxAmount: 0, lineTotal: 0 },
          { itemId: sugarId, itemCode: "", itemName: "", uom: "", orderedQuantity: 20, unitPrice: 100, discountPercentage: 0, taxPercentage: 0, receivedQuantity: 0, returnedQuantity: 0, outstandingQuantity: 0, discountAmount: 0, taxAmount: 0, lineTotal: 0 },
        ],
      },
      ACTOR,
    );
    orderId = po.id;
    expect(po.poNumber).toBe("PO-2026-00001");
    expect(po.subtotal).toBe(7000);
    expect(po.totalDiscount).toBe(500);
    expect(po.totalTax).toBe(225);
    expect(po.totalAmount).toBe(6775);
    expect((await purchaseStore.getRequisitionById(requisitionId))?.status).toBe("CONVERTED_TO_PO");
  });

  it("receives part of the order: accepted goods into stock and payable, order partly received", async () => {
    const po = (await purchaseStore.getPurchaseOrderById(orderId))!;
    const flour = po.items.find((i) => i.itemId === flourId)!;
    await expect(
      purchaseStore.createGoodsReceipt(
        { purchaseOrderId: orderId, receiptDate: "2026-11-05", items: [{ poItemId: flour.id, itemId: flourId, currentReceivedQuantity: 101, rejectedDamagedQuantity: 0 }] },
        ACTOR,
      ),
    ).rejects.toThrow(/only 100/);

    const grn = await purchaseStore.createGoodsReceipt(
      {
        purchaseOrderId: orderId,
        receiptDate: "2026-11-05",
        challanNumber: "CH-77",
        items: [{ poItemId: flour.id, itemId: flourId, currentReceivedQuantity: 62, rejectedDamagedQuantity: 2 }],
      },
      ACTOR,
    );
    receiptId = grn.id;
    expect(grn.grnNumber).toBe("GRN-2026-00001");
    expect(grn.challanNumber).toBe("CH-77");
    // 60 accepted × 47.25 effective unit cost
    expect(grn.totalReceivedAmount).toBe(2835);
    expect(await stockOf(flourId)).toBe(60);
    expect(await balanceOf()).toBe(2835);

    const after = (await purchaseStore.getPurchaseOrderById(orderId))!;
    expect(after.status).toBe("PARTIALLY_RECEIVED");
    expect(after.items.find((i) => i.itemId === flourId)?.outstandingQuantity).toBe(40);
  });

  it("returns at most what is left on the receipt", async () => {
    await expect(
      purchaseStore.createPurchaseReturn(
        { goodsReceiptId: receiptId, returnDate: "2026-11-06", items: [{ itemId: flourId, returnQuantity: 61, reason: "Wet" }] },
        ACTOR,
      ),
    ).rejects.toThrow(/only 60/);

    const ret = await purchaseStore.createPurchaseReturn(
      { goodsReceiptId: receiptId, returnDate: "2026-11-06", items: [{ itemId: flourId, returnQuantity: 10, reason: "Wet" }] },
      ACTOR,
    );
    expect(ret.returnNumber).toBe("PR-2026-00001");
    expect(ret.totalReturnAmount).toBe(472.5);
    expect(await stockOf(flourId)).toBe(50);
    expect(await balanceOf()).toBe(2362.5);

    const eligible = await purchaseStore.getEligibleReceiptsForReturn();
    expect(eligible.find((g) => g.id === receiptId)?.items[0].currentReceivedQuantity).toBe(50);
    expect((await purchaseStore.getGoodsReceipts({})).find((g) => g.id === receiptId)?.status).toBe("PARTIALLY_RETURNED");

    // A receipt with a return cannot be cancelled until the return is cancelled.
    await expect(purchaseStore.cancelGoodsReceipt(receiptId, ACTOR, "wrong PO")).rejects.toThrow(/returns/);
    await purchaseStore.cancelPurchaseReturn(ret.id, ACTOR, "posted by mistake");
    expect(await stockOf(flourId)).toBe(60);
    expect(await balanceOf()).toBe(2835);
  });

  it("will not cancel an order with receipts, but closes it and can reopen it", async () => {
    await expect(purchaseStore.updatePurchaseOrderStatus(orderId, "CANCEL", ACTOR, "x")).rejects.toThrow(/close it/);
    await expect(purchaseStore.updatePurchaseOrder(orderId, { shippingFee: 0 }, ACTOR)).rejects.toThrow(/no longer be edited/);
    const closed = await purchaseStore.updatePurchaseOrderStatus(orderId, "CLOSE", ACTOR, "Supplier short");
    expect(closed?.isClosed).toBe(true);
    expect(await purchaseStore.getApprovedOrdersForReceiving()).toHaveLength(0);
    const reopened = await purchaseStore.updatePurchaseOrderStatus(orderId, "REVERSE", ACTOR, "More coming");
    expect(reopened?.status).toBe("PARTIALLY_RECEIVED");
  });

  it("cancelling the receipt takes the stock out and reopens the order", async () => {
    const grn = await purchaseStore.cancelGoodsReceipt(receiptId, ACTOR, "Received against wrong PO");
    expect(grn.status).toBe("CANCELLED");
    expect(await stockOf(flourId)).toBe(0);
    expect(await balanceOf()).toBe(0);
    const po = (await purchaseStore.getPurchaseOrderById(orderId))!;
    expect(po.status).toBe("APPROVED");
    expect(po.items.every((i) => i.receivedQuantity === 0)).toBe(true);
  });

  it("cancelling an order frees the requisition for a new order", async () => {
    await purchaseStore.updatePurchaseOrderStatus(orderId, "CANCEL", ACTOR, "Supplier unavailable");
    expect((await purchaseStore.getRequisitionById(requisitionId))?.status).toBe("APPROVED");
  });

  it("direct receive creates its own order and receipt in one step", async () => {
    const grn = await purchaseStore.createGoodsReceipt(
      {
        purchaseOrderId: "DIRECT",
        receiptDate: "2026-11-07",
        supplierId,
        warehouseId,
        items: [{ itemId: sugarId, itemCode: "", itemName: "Sugar", uom: "KG", currentReceivedQuantity: 5, rejectedDamagedQuantity: 0, unitPrice: 110 }],
      },
      ACTOR,
    );
    expect(grn.totalReceivedAmount).toBe(550);
    expect(grn.poNumber).toBe("PO-2026-00002");
    expect(await stockOf(sugarId)).toBe(5);
    expect((await purchaseStore.getPurchaseOrderById(grn.purchaseOrderId))?.status).toBe("COMPLETED");
  });

  it("pays the supplier and reverses the payment on cancel", async () => {
    const payment = await purchaseStore.createSupplierPayment({ supplierId, amount: 200, method: "CASH", paymentDate: "2026-11-08" }, ACTOR);
    expect(payment.number).toBe("PAY-2026-00001");
    expect(await balanceOf()).toBe(350);
    await purchaseStore.cancelSupplierPayment(payment.id, ACTOR, "duplicate");
    expect(await balanceOf()).toBe(550);
  });

  it("reports by type", async () => {
    const byItem = await purchaseStore.generateReport({ reportType: "ITEM_PURCHASE_REPORT", isSummary: false });
    expect(byItem.columns).toContain("Received Qty");
    expect(byItem.rows.map((r) => r.Item)).toEqual(["Sugar"]);
    const grns = await purchaseStore.generateReport({ reportType: "GOODS_RECEIPT_REPORT", isSummary: false });
    expect(grns.totalRecords).toBe(2);
  });
});
