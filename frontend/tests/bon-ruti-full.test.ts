import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import type { Actor } from "@/lib/auth/actor";
import { purchaseStore } from "@/lib/purchase-store/store";
import { approveSupplierBill, createSupplierBill, listSupplierInvoices } from "@/lib/purchase-store/payables";
import { postPendingDocuments } from "@/lib/accounting/posting.service";
import { createPipeline } from "@/features/configuration/security/approval/server/approval.service";
import { createBom } from "@/features/production/bom/services/bom.service";
import { createEntry } from "@/features/production/entries/services/entry.service";
import { actOnOrder, createOrder as createProductionOrder, getOrder as getProductionOrder } from "@/features/production/orders/services/order.service";
import { createMaster } from "@/features/production/work-centers/services/work-center.service";
import { stockLevels } from "@/features/sales/deliveries/services/stock.service";
import { createCustomer, createSalesPerson } from "@/features/sales/masters/services/masters.service";
import { changeOrderStatus, createOrder as createSalesOrder, getOrder as getSalesOrder } from "@/features/sales/orders/services/order.service";
import { createDelivery, deleteDelivery, listDeliveries } from "@/features/sales/deliveries/services/delivery.service";
import { createDueCollection, listDueInvoices } from "@/features/sales/collections/services/collection.service";
import { approveReturn, createReturn } from "@/features/sales/returns/services/return.service";
import { adminActor, businessUnitInput, companyInput, officeInput } from "./helpers/fixtures";
import { startTestDb, stopTestDb } from "./helpers/test-db";

// Route database access to the per-file PGlite test database.
vi.mock("@/lib/prisma/client", async () => {
  const { testPrisma } = await import("./helpers/test-db");
  return { db: testPrisma };
});

const STAFF = "Store Officer";

/**
 * Bon Ruti A to Z with every control switched on: a multilayer approval
 * pipeline on each document, discount and VAT, partial receipts and deliveries,
 * a cancelled receipt and delivery, a short-closed PO, an advance and a bank
 * payment, a credit and a cash sale. Each step is checked in stock, dues and the GL.
 *
 * Purchase prices: flour 50 −10% = 45, sugar 120 +5% VAT = 126, yeast 400.
 */
describe("Bon Ruti A to Z: approvals, VAT/discount, partials, cancellations, payments", () => {
  let prisma: PrismaClient;
  const ids: Record<string, string> = {};
  let manager: Actor;
  let finance: Actor;

  const stock = async (warehouseId: string, itemId: string) => (await stockLevels(warehouseId, [itemId])).get(itemId) ?? 0;
  const gl = async (key: string) => Number((await prisma.account.findUniqueOrThrow({ where: { id: ids[key] } })).currentBalance);
  const cost = async (itemId: string) => Number((await prisma.item.findUniqueOrThrow({ where: { id: itemId } })).purchasePrice);
  const supplierDue = async () => Number((await prisma.supplier.findUniqueOrThrow({ where: { id: ids.supplier } })).balance);
  const customerDue = async (deliveryId: string) => (await listDueInvoices(adminActor, { asOf: "2026-11-30" })).find((r) => r.deliveryId === deliveryId)?.due ?? 0;

  beforeAll(async () => {
    prisma = await startTestDb();
    const companyId = (await prisma.company.create({ data: { ...companyInput, name: "Mariners Group" } })).id;
    const businessUnitId = (await prisma.businessUnit.create({ data: { ...businessUnitInput, companyId } })).id;
    const officeId = (await prisma.office.create({ data: { ...officeInput, businessUnitId } })).id;
    Object.assign(ids, {
      businessUnitId,
      officeId,
      materialWh: (await prisma.warehouse.create({ data: { officeId, name: "Material WH" } })).id,
      fgWh: (await prisma.warehouse.create({ data: { officeId, name: "FG Store" } })).id,
      supplier: (await prisma.supplier.create({ data: { businessUnitId, code: "SUP-DHA000116", name: "M/S Vai Vai Traders" } })).id,
    });
    const item = async (code: string, name: string, uom: string, salesRate = 0) => (await prisma.item.create({ data: { businessUnitId, code, name, uom, salesRate } })).id;
    ids.flour = await item("RM-00654", "Wheat Flour", "KG");
    ids.sugar = await item("RM-00599", "Sugar", "KG");
    ids.yeast = await item("RM-00535", "Yeast", "KG");
    ids.bonRuti = await item("FG-00100", "Bon Ruti", "PCS", 25);

    const account = async (code: string, name: string, accountType: string, normalBalance: "DEBIT" | "CREDIT") =>
      (await prisma.account.create({ data: { code, name, accountType, accountSubtype: name, normalBalance } })).id;
    const roles: Record<string, [string, string, string, "DEBIT" | "CREDIT"]> = {
      INVENTORY: ["1300", "Inventory", "ASSET", "DEBIT"],
      WORK_IN_PROGRESS: ["1310", "Work in Progress", "ASSET", "DEBIT"],
      RECEIVABLE: ["1200", "Accounts Receivable", "ASSET", "DEBIT"],
      CASH: ["1110", "Cash in Hand", "ASSET", "DEBIT"],
      BANK: ["1120", "Bank", "ASSET", "DEBIT"],
      PAYABLE: ["2100", "Accounts Payable", "LIABILITY", "CREDIT"],
      VAT_PAYABLE: ["2200", "VAT Payable", "LIABILITY", "CREDIT"],
      SALES_REVENUE: ["4100", "Sales Revenue", "INCOME", "CREDIT"],
      COGS: ["5100", "Cost of Goods Sold", "EXPENSE", "DEBIT"],
      STOCK_ADJUSTMENT: ["5200", "Stock Adjustment", "EXPENSE", "DEBIT"],
      PURCHASE_EXPENSE: ["5300", "Purchase Expense", "EXPENSE", "DEBIT"],
    };
    for (const [key, args] of Object.entries(roles)) {
      ids[key] = await account(...args);
      await prisma.postingAccount.create({ data: { key, accountId: ids[key] } });
    }
    ids.bankAccount = (
      await prisma.bankAccount.create({
        data: { accountNumber: "CB-9901", bankName: "City Bank", branchName: "Gulshan", accountHolder: "Mariners Group", glAccountId: ids.BANK, glAccountName: "Bank", openingBalance: 0, currentBalance: 0 },
      })
    ).id;

    // Approvers and one pipeline per document type (Configuration › Approval Setup).
    const user = async (name: string, phone: string) => (await prisma.user.create({ data: { name, phone, passwordHash: "x" } })).id;
    const managerId = await user("Store Manager", "01711111111");
    const financeId = await user("Finance Head", "01722222222");
    // The director is super approver of the single-stage pipelines and never acts here.
    const directorId = await user("Director", "01733333333");
    manager = { ...adminActor, id: managerId, name: "Store Manager", isMaster: false };
    finance = { ...adminActor, id: financeId, name: "Finance Head", isMaster: false };
    const approver = (approverId: string) => ({ userType: "USER" as const, businessUnitId: "", approverId, authorizationType: "APPROVAL" as const });
    const stage = (name: string, userId: string) => ({ name, approvalOrder: "ANY", requiredCount: 1, approvers: [approver(userId)] });
    const pipeline = (feature: string, stages: ReturnType<typeof stage>[], superApproverId: string) =>
      createPipeline(adminActor, { name: `${feature} approval`, feature, userType: "USER", superApproverId, remarks: "", stages } as Parameters<typeof createPipeline>[1]);
    await pipeline("Purchase Requisition", [stage("Store Manager", managerId), stage("Finance", financeId)], managerId);
    for (const feature of ["Purchase Order", "Goods Receipt", "Purchase Return", "Payment Approval", "Production Order", "Sales Order", "Sales Return"]) {
      await pipeline(feature, [stage("Finance", financeId)], directorId);
    }

    const salesPerson = await createSalesPerson(adminActor, { businessUnitId, name: "Md. Manik Miah", designation: "TSM" });
    ids.salesPerson = salesPerson.id;
    ids.customer = (await createCustomer(adminActor, { businessUnitId, name: "M/S Arif Enterprise", creditDays: 7, salesPersonId: salesPerson.id })).id;
    ids.cashCustomer = (await createCustomer(adminActor, { businessUnitId, name: "Walk-in Customer", creditDays: 0, salesPersonId: salesPerson.id })).id;
  });

  afterAll(stopTestDb);

  it("01. Requisition waits for both stages of its pipeline", async () => {
    const req = await purchaseStore.createRequisition(
      {
        companyId: "",
        officeId: ids.officeId,
        warehouseId: ids.materialWh,
        requestType: "LOCAL",
        department: "Production",
        requesterName: "Production",
        purchaseMethod: "DIRECT",
        requestDate: "2026-11-01",
        requiredDeliveryDate: "2026-11-03",
        businessJustification: "Bon Ruti raw material",
        items: [
          { itemId: ids.flour, itemCode: "", itemName: "", uom: "", quantity: 100, estimatedUnitPrice: 50, lineTotal: 0 },
          { itemId: ids.sugar, itemCode: "", itemName: "", uom: "", quantity: 20, estimatedUnitPrice: 120, lineTotal: 0 },
          { itemId: ids.yeast, itemCode: "", itemName: "", uom: "", quantity: 5, estimatedUnitPrice: 400, lineTotal: 0 },
        ],
      },
      STAFF,
    );
    await expect(purchaseStore.updateRequisitionStatus(req.id, "APPROVE", "Finance Head", "", finance)).rejects.toThrow(/stage 1/);
    expect((await purchaseStore.updateRequisitionStatus(req.id, "APPROVE", "Store Manager", "OK", manager))?.status).toBe("SUBMITTED");
    expect((await purchaseStore.updateRequisitionStatus(req.id, "APPROVE", "Finance Head", "Budget OK", finance))?.status).toBe("APPROVED");
    ids.requisition = req.id;
  });

  it("02. PO with discount and VAT waits for approval; nothing can be received before", async () => {
    const line = (itemId: string, orderedQuantity: number, unitPrice: number, discountPercentage = 0, taxPercentage = 0) => ({
      itemId, itemCode: "", itemName: "", uom: "", orderedQuantity, unitPrice, discountPercentage, taxPercentage,
      receivedQuantity: 0, returnedQuantity: 0, outstandingQuantity: 0, discountAmount: 0, taxAmount: 0, lineTotal: 0,
    });
    const po = await purchaseStore.createPurchaseOrder(
      {
        companyId: "",
        requisitionId: ids.requisition,
        supplierId: ids.supplier,
        officeId: ids.officeId,
        warehouseId: ids.materialWh,
        orderDate: "2026-11-02",
        expectedDeliveryDate: "2026-11-03",
        paymentTerms: "",
        deliveryTerms: "",
        shippingFee: 0,
        items: [line(ids.flour, 100, 50, 10), line(ids.sugar, 20, 120, 0, 5), line(ids.yeast, 5, 400)],
      },
      STAFF,
    );
    // 4,500 + 2,520 + 2,000
    expect(po).toMatchObject({ subtotal: 9400, totalDiscount: 500, totalTax: 120, totalAmount: 9020, status: "PENDING_APPROVAL" });
    expect((await purchaseStore.getApprovedOrdersForReceiving()).map((o) => o.id)).not.toContain(po.id);
    await expect(
      purchaseStore.createGoodsReceipt({ purchaseOrderId: po.id, receiptDate: "2026-11-03", items: [{ poItemId: po.items[0].id, itemId: ids.flour, currentReceivedQuantity: 1 }] }, STAFF),
    ).rejects.toThrow();
    expect((await purchaseStore.updatePurchaseOrderStatus(po.id, "APPROVE", "Finance Head", "OK", finance))?.status).toBe("APPROVED");
    ids.po = po.id;
  });

  it("03. First GRN (2 KG flour rejected) waits for approval, then books stock, cost and due", async () => {
    const po = (await purchaseStore.getPurchaseOrderById(ids.po))!;
    const lineOf = (itemId: string) => po.items.find((i) => i.itemId === itemId)!.id;
    const grn = await purchaseStore.createGoodsReceipt(
      {
        purchaseOrderId: ids.po,
        receiptDate: "2026-11-03",
        challanNumber: "CH-1",
        items: [
          { poItemId: lineOf(ids.flour), itemId: ids.flour, currentReceivedQuantity: 62, rejectedDamagedQuantity: 2 },
          { poItemId: lineOf(ids.sugar), itemId: ids.sugar, currentReceivedQuantity: 20, rejectedDamagedQuantity: 0 },
          { poItemId: lineOf(ids.yeast), itemId: ids.yeast, currentReceivedQuantity: 5, rejectedDamagedQuantity: 0 },
        ],
      },
      STAFF,
    );
    expect(grn.status).toBe("DRAFT");
    expect(await stock(ids.materialWh, ids.flour)).toBe(0);
    expect(await supplierDue()).toBe(0);

    await purchaseStore.decideGoodsReceipt(grn.id, "approve", "Finance Head", "OK", finance);
    expect(await stock(ids.materialWh, ids.flour)).toBe(60);
    expect(await stock(ids.materialWh, ids.sugar)).toBe(20);
    // 60 × 45 + 20 × 126 + 5 × 400
    expect(await supplierDue()).toBe(7220);
    expect([await cost(ids.flour), await cost(ids.sugar), await cost(ids.yeast)]).toEqual([45, 126, 400]);
    expect((await purchaseStore.getPurchaseOrderById(ids.po))?.status).toBe("PARTIALLY_RECEIVED");
    await postPendingDocuments(STAFF);
    expect(await gl("INVENTORY")).toBe(7220);
    expect(await gl("PAYABLE")).toBe(7220);
    ids.grn1 = grn.id;
  });

  it("04. A second GRN is cancelled: stock, due, PO progress and GL all go back", async () => {
    const po = (await purchaseStore.getPurchaseOrderById(ids.po))!;
    const flourLine = po.items.find((i) => i.itemId === ids.flour)!.id;
    const grn = await purchaseStore.createGoodsReceipt({ purchaseOrderId: ids.po, receiptDate: "2026-11-04", items: [{ poItemId: flourLine, itemId: ids.flour, currentReceivedQuantity: 20 }] }, STAFF);
    await purchaseStore.decideGoodsReceipt(grn.id, "approve", "Finance Head", "OK", finance);
    expect(await stock(ids.materialWh, ids.flour)).toBe(80);
    await postPendingDocuments(STAFF);
    expect(await gl("INVENTORY")).toBe(7220 + 900);

    await purchaseStore.cancelGoodsReceipt(grn.id, "Store Manager", "Wrong challan");
    expect(await stock(ids.materialWh, ids.flour)).toBe(60);
    expect(await supplierDue()).toBe(7220);
    expect((await purchaseStore.getPurchaseOrderById(ids.po))?.items.find((i) => i.itemId === ids.flour)?.outstandingQuantity).toBe(40);
    await postPendingDocuments(STAFF);
    expect(await prisma.journalVoucher.count({ where: { sourceType: "PURCHASE_RECEIPT_CANCEL", sourceId: grn.id } })).toBe(1);
    expect(await gl("INVENTORY")).toBe(7220);
    expect(await cost(ids.flour)).toBe(45);
  });

  it("05. Third GRN for 30 KG, then the PO is short-closed for the last 10 KG", async () => {
    const po = (await purchaseStore.getPurchaseOrderById(ids.po))!;
    const flourLine = po.items.find((i) => i.itemId === ids.flour)!.id;
    const grn = await purchaseStore.createGoodsReceipt({ purchaseOrderId: ids.po, receiptDate: "2026-11-05", items: [{ poItemId: flourLine, itemId: ids.flour, currentReceivedQuantity: 30 }] }, STAFF);
    await purchaseStore.decideGoodsReceipt(grn.id, "approve", "Finance Head", "OK", finance);
    expect(await stock(ids.materialWh, ids.flour)).toBe(90);
    expect(await supplierDue()).toBe(7220 + 1350);
    const closed = await purchaseStore.updatePurchaseOrderStatus(ids.po, "CLOSE", "Store Manager", "Supplier short of flour");
    expect(closed?.isClosed).toBe(true);
    expect((await purchaseStore.getApprovedOrdersForReceiving()).map((o) => o.id)).not.toContain(ids.po);
    ids.grn3 = grn.id;
  });

  it("06. Purchase return of 5 KG sugar waits for approval, then reduces stock, due and GL", async () => {
    const ret = await purchaseStore.createPurchaseReturn({ goodsReceiptId: ids.grn1, returnDate: "2026-11-05", items: [{ itemId: ids.sugar, returnQuantity: 5, reason: "Lumpy" }] }, STAFF);
    expect(await stock(ids.materialWh, ids.sugar)).toBe(20);
    await purchaseStore.decidePurchaseReturn(ret.id, "approve", "Finance Head", "OK", finance);
    expect(await stock(ids.materialWh, ids.sugar)).toBe(15);
    expect(await supplierDue()).toBe(8570 - 630);
    await postPendingDocuments(STAFF);
    expect(await gl("INVENTORY")).toBe(7220 + 1350 - 630);
    expect(await cost(ids.sugar)).toBe(126);
  });

  it("07. Advance by bank, then the GRN bill is approved and paid; the advance is offset", async () => {
    const advance = await purchaseStore.createSupplierPayment(
      { supplierId: ids.supplier, officeId: ids.officeId, amount: 1000, method: "BANK", bankAccountId: ids.bankAccount, paymentDate: "2026-11-05", isAdvance: true, orderId: ids.po },
      STAFF,
    );
    if (advance.status !== "PAID") await purchaseStore.decideSupplierPayment(advance.id, "approve", "Finance Head", "OK", finance);
    expect(await supplierDue()).toBe(7940 - 1000);

    const bill = await createSupplierBill({ supplierId: ids.supplier, receiptId: ids.grn1, number: "INV-1", billDate: "2026-11-05", dueDate: "2026-11-20" }, STAFF);
    await approveSupplierBill(bill.id, "Finance Head", finance);
    // GRN 1 is 7,220 less the 630 return, less the 1,000 advance paid against its PO.
    expect((await listSupplierInvoices()).find((inv) => inv.receiptId === ids.grn1)?.dueAmount).toBe(5590);
    const pay = await purchaseStore.createSupplierPayment(
      { supplierId: ids.supplier, officeId: ids.officeId, amount: 5590, method: "BANK", bankAccountId: ids.bankAccount, paymentDate: "2026-11-06", receiptId: ids.grn1 },
      STAFF,
    );
    if (pay.status !== "PAID") await purchaseStore.decideSupplierPayment(pay.id, "approve", "Finance Head", "OK", finance);
    // Left: GRN 3 (1,350).
    expect(await supplierDue()).toBe(1350);
    await postPendingDocuments(STAFF);
    expect(await gl("PAYABLE")).toBe(1350);
    expect(await gl("BANK")).toBe(-6590);
  });

  it("08. Production order waits for approval; Bon Ruti is made at the cost of the materials", async () => {
    const department = await createMaster(adminActor, "departments", { name: "Production" });
    const section = await createMaster(adminActor, "sections", { name: "Bakery", departmentId: department.id });
    const bom = await createBom(adminActor, {
      name: "Bon Ruti",
      bomType: "SINGLE_OUTPUT",
      departmentId: department.id,
      departmentSectionId: section.id,
      outputs: [{ itemId: ids.bonRuti, outputType: "FINISHED_GOODS", netWeight: 0, lotSizeQty: 100, costPercent: 100 }],
      materials: [
        { itemId: ids.flour, qty: 10, wastagePercent: 0, rate: 50, excludeFromScrap: false },
        { itemId: ids.sugar, qty: 2, wastagePercent: 0, rate: 120, excludeFromScrap: false },
        { itemId: ids.yeast, qty: 0.5, wastagePercent: 0, rate: 400, excludeFromScrap: false },
      ],
    });
    const order = await createProductionOrder(manager, {
      orderDate: "2026-11-06", productionDate: "2026-11-06", itemId: ids.bonRuti, bomId: bom.id, quantity: 500, officeId: ids.officeId, warehouseId: ids.materialWh,
    });
    await expect(actOnOrder(manager, order.id, { version: order.updatedAt, action: "approve" })).rejects.toThrow();
    await actOnOrder(finance, order.id, { version: (await getProductionOrder(finance, order.id)).updatedAt, action: "approve" });
    expect((await getProductionOrder(finance, order.id)).status).not.toBe("PENDING");

    const entry = await createEntry(manager, {
      orderId: order.id, entryDate: "2026-11-06", shift: "Morning", departmentId: department.id, departmentSectionId: section.id,
      outputWarehouseId: ids.fgWh, totalQty: 505, rejectQty: 5, hours: 8,
      materials: [{ itemId: ids.flour, actualQty: 50 }, { itemId: ids.sugar, actualQty: 10 }, { itemId: ids.yeast, actualQty: 2.5 }],
    });
    expect(await stock(ids.fgWh, ids.bonRuti)).toBe(500);
    // 50 × 45 + 10 × 126 + 2.5 × 400 = 4,510 for 500 good pieces
    expect(await cost(ids.bonRuti)).toBe(9.02);
    await postPendingDocuments(STAFF);
    expect(Number((await prisma.journalVoucher.findFirstOrThrow({ where: { sourceType: "PRODUCTION_ENTRY", sourceId: entry.id } })).totalDebit)).toBe(4510);
    expect(await gl("INVENTORY")).toBe(7940);
  });

  it("09. Credit sales order with VAT waits for its Sales Order pipeline", async () => {
    const order = await createSalesOrder(adminActor, {
      officeId: ids.officeId, customerId: ids.customer, salesPersonId: ids.salesPerson, orderType: "SALES", paymentMethod: "CREDIT",
      orderDate: "2026-11-07", expectedDeliveryDate: "2026-11-08", priceIncludesVat: false, isForeign: false, paymentTermDays: 7,
      dueLimit: 0, discountAmount: 0, deliveryCharge: 0, unloadingCharge: 0,
      lines: [{ itemId: ids.bonRuti, qty: 300, unitPrice: 25, discountPercent: 0, vatPercent: 5, aitPercent: 0 }],
    });
    const submitted = await changeOrderStatus(adminActor, order.id, { action: "submit", version: order.updatedAt, today: "2026-11-07" });
    expect(submitted.status, "a Sales Order approval pipeline is set up, so the order must wait for it").toBe("PENDING_APPROVAL");
    const approved = await changeOrderStatus(finance, order.id, { action: "approve", version: submitted.updatedAt, today: "2026-11-07" });
    expect(approved.status).toBe("APPROVED");
    ids.salesOrder = order.id;
    ids.salesOrderLine = order.lines[0].id;
  });

  it("10. Partial deliveries; one is deleted and stock and due come back", async () => {
    const deliver = (qty: number, date: string) =>
      createDelivery(adminActor, {
        deliveryType: "SALES_ORDER", salesOrderId: ids.salesOrder, officeId: ids.officeId, warehouseId: ids.fgWh, deliveryDate: date,
        paymentMethod: "CREDIT", paymentTermDays: 7, deliveryCharge: 0, unloadingCharge: 0, paidAmount: 0,
        lines: [{ orderLineId: ids.salesOrderLine, qty }],
      });
    const first = await deliver(200, "2026-11-08");
    expect(await stock(ids.fgWh, ids.bonRuti)).toBe(300);
    // 200 × 25 = 5,000 + 5% VAT
    expect(await customerDue(first.id)).toBe(5250);
    const second = await deliver(100, "2026-11-08");
    expect((await getSalesOrder(adminActor, ids.salesOrder)).status).toBe("COMPLETED");

    const fresh = (await listDeliveries(adminActor, {})).rows.find((row) => row.id === second.id)!;
    await deleteDelivery(adminActor, second.id, { version: fresh.updatedAt, reason: "Wrong truck" });
    expect(await stock(ids.fgWh, ids.bonRuti)).toBe(300);
    expect(await customerDue(second.id)).toBe(0);
    expect((await getSalesOrder(adminActor, ids.salesOrder)).status).toBe("APPROVED");

    await postPendingDocuments(STAFF);
    expect(await gl("RECEIVABLE")).toBe(5250);
    expect(await gl("SALES_REVENUE")).toBe(5000);
    expect(await gl("VAT_PAYABLE")).toBe(250);
    expect(await gl("COGS")).toBe(1804); // 200 × 9.02
    ids.delivery = first.id;
    ids.deliveryLine = first.lines[0].id;
  });

  it("11. Sales return of 10 pcs waits for its pipeline, then restocks at cost", async () => {
    const salesReturn = await createReturn(adminActor, {
      mode: "PARTIAL", deliveryId: ids.delivery, officeId: ids.officeId, warehouseId: ids.fgWh, returnDate: "2026-11-09",
      lines: [{ deliveryLineId: ids.deliveryLine, qty: 10 }],
    });
    await approveReturn(manager, salesReturn.id, { version: salesReturn.updatedAt }).catch(() => undefined);
    const current = await prisma.salesReturn.findUniqueOrThrow({ where: { id: salesReturn.id } });
    expect(current.status, "a pending return waits for the Finance stage").toBe("DRAFT");
    await approveReturn(finance, salesReturn.id, { version: current.updatedAt.toISOString() });
    expect(await stock(ids.fgWh, ids.bonRuti)).toBe(310);
    expect(await customerDue(ids.delivery)).toBe(5250 - 262.5);
    await postPendingDocuments(STAFF);
    expect(await gl("COGS")).toBe(1804 - 90.2);
    expect(await cost(ids.bonRuti)).toBe(9.02);
  });

  it("12. Cash sale to a walk-in customer: paid on delivery, nothing due", async () => {
    const order = await createSalesOrder(adminActor, {
      officeId: ids.officeId, customerId: ids.cashCustomer, salesPersonId: ids.salesPerson, orderType: "SALES", paymentMethod: "CASH",
      orderDate: "2026-11-09", expectedDeliveryDate: "2026-11-09", priceIncludesVat: false, isForeign: false, paymentTermDays: 0,
      dueLimit: 0, discountAmount: 0, deliveryCharge: 0, unloadingCharge: 0,
      lines: [{ itemId: ids.bonRuti, qty: 40, unitPrice: 25, discountPercent: 0, vatPercent: 0, aitPercent: 0 }],
    });
    let status = (await changeOrderStatus(adminActor, order.id, { action: "submit", version: order.updatedAt, today: "2026-11-09" })).status;
    if (status === "PENDING_APPROVAL") {
      status = (await changeOrderStatus(finance, order.id, { action: "approve", version: (await getSalesOrder(adminActor, order.id)).updatedAt, today: "2026-11-09" })).status;
    }
    expect(status).toBe("APPROVED");
    const delivery = await createDelivery(adminActor, {
      deliveryType: "SALES_ORDER", salesOrderId: order.id, officeId: ids.officeId, warehouseId: ids.fgWh, deliveryDate: "2026-11-09",
      paymentMethod: "CASH", paymentTermDays: 0, deliveryCharge: 0, unloadingCharge: 0, paidAmount: 1000,
      lines: [{ orderLineId: order.lines[0].id, qty: 40 }],
    });
    expect(await stock(ids.fgWh, ids.bonRuti)).toBe(270);
    expect(await customerDue(delivery.id)).toBe(0);
  });

  it("13. Credit customer pays by bank; the books balance and inventory equals stock value", async () => {
    await createDueCollection(adminActor, {
      officeId: ids.officeId, collectionDate: "2026-11-10", method: "BANK", salesPersonId: ids.salesPerson,
      rows: [{ customerId: ids.customer, allocations: [{ deliveryId: ids.delivery, amount: 4987.5 }] }],
    });
    expect(await customerDue(ids.delivery)).toBe(0);
    await postPendingDocuments(STAFF);
    expect(await gl("RECEIVABLE")).toBe(0);

    // Stock left: flour 40 × 45, sugar 5 × 126, yeast 2.5 × 400, Bon Ruti 270 × 9.02
    expect(await stock(ids.materialWh, ids.flour)).toBe(40);
    expect(await stock(ids.materialWh, ids.sugar)).toBe(5);
    expect(await stock(ids.materialWh, ids.yeast)).toBe(2.5);
    const stockValue = 40 * 45 + 5 * 126 + 2.5 * 400 + 270 * 9.02;
    expect(await gl("INVENTORY")).toBeCloseTo(stockValue, 2);
    const totals = await prisma.journalVoucherLine.aggregate({ _sum: { debit: true, credit: true } });
    expect(Number(totals._sum.debit)).toBeCloseTo(Number(totals._sum.credit), 2);
  });
});
