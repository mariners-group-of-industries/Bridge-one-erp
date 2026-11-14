import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { createItem } from "@/features/sales/masters/services/masters.service";
import { purchaseStore } from "@/lib/purchase-store/store";
import { listSupplierAdvanceDetails, listSupplierPayables } from "@/lib/purchase-store/payables";
import { postPendingDocuments } from "@/lib/accounting/posting.service";
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

  it("supports direct receive VAT, PO-linked advance payments, quick master creation, and form options", async () => {
    const newSup = await purchaseStore.quickCreateSupplier({ name: "Quick Steel Traders", phone: "01711223344" });
    expect(newSup.name).toBe("Quick Steel Traders");

    const newItem = await purchaseStore.quickCreateItem({ name: "MS Rod 10mm", uom: "KG", purchasePrice: 100, vatPercent: 15 });
    expect(newItem.vatPercent).toBe(15);

    const vatGrn = await purchaseStore.createGoodsReceipt(
      {
        purchaseOrderId: "DIRECT",
        receiptDate: "2026-11-09",
        challanDate: "2026-11-09",
        paymentTerms: "Net 15 Days",
        supplierId: newSup.id,
        warehouseId,
        items: [
          {
            itemId: newItem.id,
            itemCode: newItem.code,
            itemName: newItem.name,
            uom: newItem.uom,
            currentReceivedQuantity: 10,
            rejectedDamagedQuantity: 0,
            unitPrice: 100,
            taxPercentage: 15,
          },
        ],
      },
      ACTOR,
    );
    expect(vatGrn.totalReceivedAmount).toBe(1150);
    expect(await stockOf(newItem.id)).toBe(10);

    const adv = await purchaseStore.createSupplierPayment(
      {
        supplierId: newSup.id,
        orderId: vatGrn.purchaseOrderId,
        amount: 400,
        method: "CASH",
        paymentDate: "2026-11-10",
        isAdvance: true,
        referenceNumber: "LC-9001",
      },
      ACTOR,
    );
    expect(adv.isAdvance).toBe(true);
    expect(adv.orderId).toBe(vatGrn.purchaseOrderId);

    const options = await purchaseStore.getPurchaseFormOptions();
    expect(Array.isArray(options.categories)).toBe(true);
    expect(Array.isArray(options.accounts)).toBe(true);
    expect(options.stockByWarehouse.some((s) => s.itemId === newItem.id && s.qty === 10)).toBe(true);

    // Date filtering on payables and advance details
    const periodPayables = await listSupplierPayables({ fromDate: "2026-11-09", toDate: "2026-11-10" });
    const supRow = periodPayables.find((r) => r.supplierId === newSup.id)!;
    expect(supRow.totalPurchasedAmount).toBe(1150);
    expect(supRow.paidAmount).toBe(400);
    const outOfRange = await listSupplierPayables({ fromDate: "2026-12-01", toDate: "2026-12-31" });
    expect(outOfRange.find((r) => r.supplierId === newSup.id)?.totalPurchasedAmount).toBe(0);
    const advDetails = await listSupplierAdvanceDetails({ fromDate: "2026-11-01", toDate: "2026-11-30" });
    expect(advDetails.some((d) => d.id === adv.id && d.referenceNumber === "LC-9001")).toBe(true);
  });

  it("updates linked bank balance on supplier payment/cancel and reverses GL on cancelled return", async () => {
    const invAcc = await prisma.account.create({
      data: { code: "1300", name: "Inventory Asset", accountType: "ASSET", accountSubtype: "Current Asset", normalBalance: "DEBIT" },
    });
    const payAcc = await prisma.account.create({
      data: { code: "2100", name: "Accounts Payable", accountType: "LIABILITY", accountSubtype: "Current Liability", normalBalance: "CREDIT" },
    });
    const bankGl = await prisma.account.create({
      data: { code: "1120", name: "City Bank GL", accountType: "ASSET", accountSubtype: "Bank", normalBalance: "DEBIT", currentBalance: 5000 },
    });
    const cashAcc = await prisma.account.create({
      data: { code: "1110", name: "Petty Cash", accountType: "ASSET", accountSubtype: "Cash", normalBalance: "DEBIT" },
    });
    const expAcc = await prisma.account.create({
      data: { code: "5100", name: "Purchase Expense", accountType: "EXPENSE", accountSubtype: "Direct Expense", normalBalance: "DEBIT" },
    });
    await prisma.postingAccount.createMany({
      data: [
        { key: "INVENTORY", accountId: invAcc.id },
        { key: "PAYABLE", accountId: payAcc.id },
        { key: "BANK", accountId: bankGl.id },
        { key: "CASH", accountId: cashAcc.id },
        { key: "PURCHASE_EXPENSE", accountId: expAcc.id },
      ],
    });
    const bank = await prisma.bankAccount.create({
      data: {
        accountNumber: "CB-9901",
        bankName: "City Bank",
        branchName: "Gulshan",
        accountHolder: "BridgeOne Ltd",
        glAccountId: bankGl.id,
        glAccountName: bankGl.name,
        openingBalance: 5000,
        currentBalance: 5000,
      },
    });

    const pay = await purchaseStore.createSupplierPayment(
      { supplierId, officeId, bankAccountId: bank.id, amount: 300, method: "BANK", paymentDate: "2026-11-10" },
      ACTOR,
    );
    expect(Number((await prisma.bankAccount.findUniqueOrThrow({ where: { id: bank.id } })).currentBalance)).toBe(4700);

    await postPendingDocuments(ACTOR);
    const vouchers = await prisma.journalVoucher.findMany({ where: { sourceType: "SUPPLIER_PAYMENT", sourceId: pay.id }, include: { lines: true } });
    expect(vouchers).toHaveLength(1);
    expect(vouchers[0].lines.some((l) => l.accountId === bankGl.id && Number(l.credit) === 300)).toBe(true);

    await purchaseStore.cancelSupplierPayment(pay.id, ACTOR, "reissued");
    expect(Number((await prisma.bankAccount.findUniqueOrThrow({ where: { id: bank.id } })).currentBalance)).toBe(5000);

    const ret = await purchaseStore.createPurchaseReturn(
      { goodsReceiptId: "WITHOUT_REF", supplierId, officeId, warehouseId, returnDate: "2026-11-11", items: [{ itemId: sugarId, returnQuantity: 2, unitPrice: 110, reason: "Damaged" }] },
      ACTOR,
    );
    await postPendingDocuments(ACTOR);
    expect(await prisma.journalVoucher.count({ where: { sourceType: "PURCHASE_RETURN", sourceId: ret.id } })).toBe(1);

    await purchaseStore.cancelPurchaseReturn(ret.id, ACTOR, "reversed");
    await postPendingDocuments(ACTOR);
    expect(await prisma.journalVoucher.count({ where: { sourceType: "PURCHASE_RETURN_CANCEL", sourceId: ret.id } })).toBe(1);
  });
});
