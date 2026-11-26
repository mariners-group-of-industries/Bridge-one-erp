import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import type { Actor, Permission } from "@/lib/auth/actor";
import { purchaseStore } from "@/lib/purchase-store/store";
import { postPendingDocuments } from "@/lib/accounting/posting.service";
import { createBom } from "@/features/production/bom/services/bom.service";
import { createEntry, entryForm } from "@/features/production/entries/services/entry.service";
import { actOnOrder, createOrder as createProductionOrder, getOrder as getProductionOrder } from "@/features/production/orders/services/order.service";
import { createMaster } from "@/features/production/work-centers/services/work-center.service";
import { stockLevels } from "@/features/sales/deliveries/services/stock.service";
import { createCustomer, createSalesPerson } from "@/features/sales/masters/services/masters.service";
import { changeOrderStatus, createOrder as createSalesOrder } from "@/features/sales/orders/services/order.service";
import { createDelivery } from "@/features/sales/deliveries/services/delivery.service";
import { createDueCollection, listDueInvoices } from "@/features/sales/collections/services/collection.service";
import { approveReturn, createReturn } from "@/features/sales/returns/services/return.service";
import { approveSupplierBill, createSupplierBill, listSupplierInvoices } from "@/lib/purchase-store/payables";
import { adminActor, businessUnitInput, companyInput, officeInput } from "./helpers/fixtures";
import { startTestDb, stopTestDb } from "./helpers/test-db";

// Route database access to the per-file PGlite test database.
vi.mock("@/lib/prisma/client", async () => {
  const { testPrisma } = await import("./helpers/test-db");
  return { db: testPrisma };
});

const STAFF = "Store Officer";
const manager: Actor = { ...adminActor, id: "manager", isMaster: false, permissions: new Set<Permission>(["production:read", "production:write", "production:approve"]) };

/**
 * Bon Ruti, end to end: raw material is bought (PR → PO → GRN), Bon Ruti is
 * produced from it, sold, collected, and the supplier is paid. Every step is
 * checked where the next module reads it: stock, supplier and customer dues,
 * and the general ledger, which must agree with stock at the end.
 *
 * Numbers: 100 KG flour @50, 20 KG sugar @120, 5 KG yeast @400 = 9,400 bought;
 * 10 KG flour returned to the supplier (−500); the GRN is billed, plus a 600
 * transport bill without goods.
 * 500 pcs made from 50 / 10 / 2.5 KG = 4,700 material (9.40 per piece).
 * 300 pcs sold @25 = 7,500 (cost 2,820); 20 pcs returned by the customer (−500, cost −188).
 */
describe("Bon Ruti: buy → return → bill → produce → sell → return → collect → pay", () => {
  let prisma: PrismaClient;
  const ids: Record<string, string> = {};

  const stock = async (warehouseId: string, itemId: string) => (await stockLevels(warehouseId, [itemId])).get(itemId) ?? 0;
  const gl = async (accountId: string) => Number((await prisma.account.findUniqueOrThrow({ where: { id: accountId } })).currentBalance);
  const voucher = (sourceType: string, sourceId: string) =>
    prisma.journalVoucher.findUnique({ where: { sourceType_sourceId: { sourceType, sourceId } }, include: { lines: true } });

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
    // Items as a user creates them: no purchase price on the master; cost comes from buying.
    const item = async (code: string, name: string, uom: string, salesRate = 0) =>
      (await prisma.item.create({ data: { businessUnitId, code, name, uom, salesRate } })).id;
    ids.flour = await item("RM-00654", "Wheat Flour/Maida C Grade", "KG");
    ids.sugar = await item("RM-00599", "Sugar", "KG");
    ids.yeast = await item("RM-00535", "Yeast", "KG");
    ids.bonRuti = await item("FG-00100", "Bon Ruti", "PCS", 25);

    // Chart of accounts and posting roles (Accounts › Posting Setup).
    const account = async (code: string, name: string, accountType: string, normalBalance: "DEBIT" | "CREDIT") =>
      (await prisma.account.create({ data: { code, name, accountType, accountSubtype: name, normalBalance } })).id;
    Object.assign(ids, {
      inventory: await account("1300", "Inventory", "ASSET", "DEBIT"),
      wip: await account("1310", "Work in Progress", "ASSET", "DEBIT"),
      receivable: await account("1200", "Accounts Receivable", "ASSET", "DEBIT"),
      cash: await account("1110", "Cash in Hand", "ASSET", "DEBIT"),
      bank: await account("1120", "Bank", "ASSET", "DEBIT"),
      payable: await account("2100", "Accounts Payable", "LIABILITY", "CREDIT"),
      vat: await account("2200", "VAT Payable", "LIABILITY", "CREDIT"),
      revenue: await account("4100", "Sales Revenue", "INCOME", "CREDIT"),
      cogs: await account("5100", "Cost of Goods Sold", "EXPENSE", "DEBIT"),
      stockAdj: await account("5200", "Stock Adjustment", "EXPENSE", "DEBIT"),
      purchaseExp: await account("5300", "Purchase Expense", "EXPENSE", "DEBIT"),
    });
    await prisma.postingAccount.createMany({
      data: [
        { key: "INVENTORY", accountId: ids.inventory },
        { key: "WORK_IN_PROGRESS", accountId: ids.wip },
        { key: "RECEIVABLE", accountId: ids.receivable },
        { key: "CASH", accountId: ids.cash },
        { key: "BANK", accountId: ids.bank },
        { key: "PAYABLE", accountId: ids.payable },
        { key: "VAT_PAYABLE", accountId: ids.vat },
        { key: "SALES_REVENUE", accountId: ids.revenue },
        { key: "COGS", accountId: ids.cogs },
        { key: "STOCK_ADJUSTMENT", accountId: ids.stockAdj },
        { key: "PURCHASE_EXPENSE", accountId: ids.purchaseExp },
      ],
    });

    const salesPerson = await createSalesPerson(adminActor, { businessUnitId, name: "Md. Manik Miah", designation: "TSM" });
    ids.salesPerson = salesPerson.id;
    ids.customer = (await createCustomer(adminActor, { businessUnitId, name: "M/S Arif Enterprise", creditDays: 7, salesPersonId: salesPerson.id })).id;
  });

  afterAll(stopTestDb);

  it("1. Purchase Requisition for the raw material, approved", async () => {
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
    expect(req.requisitionNumber).toMatch(/^PR-MG2611\d{5}$/);
    expect(req.totalEstimatedAmount).toBe(9400);
    const approved = await purchaseStore.updateRequisitionStatus(req.id, "APPROVE", "Manager", "OK");
    expect(approved?.status).toBe("APPROVED");
    ids.requisition = req.id;
  });

  it("2. Purchase Order from the requisition", async () => {
    const line = (itemId: string, orderedQuantity: number, unitPrice: number) => ({
      itemId, itemCode: "", itemName: "", uom: "", orderedQuantity, unitPrice, discountPercentage: 0, taxPercentage: 0,
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
        items: [line(ids.flour, 100, 50), line(ids.sugar, 20, 120), line(ids.yeast, 5, 400)],
      },
      STAFF,
    );
    expect(po.poNumber).toMatch(/^PO-MG2611\d{5}$/);
    expect(po.totalAmount).toBe(9400);
    expect(po.status).toBe("APPROVED"); // no approval pipeline configured
    expect((await purchaseStore.getRequisitionById(ids.requisition))?.status).toBe("CONVERTED_TO_PO");
    ids.po = po.id;
  });

  it("3. Goods received into Material WH: stock, supplier due and GL", async () => {
    const po = (await purchaseStore.getPurchaseOrderById(ids.po))!;
    const grn = await purchaseStore.createGoodsReceipt(
      {
        purchaseOrderId: ids.po,
        receiptDate: "2026-11-03",
        challanNumber: "CH-1792",
        items: po.items.map((it) => ({ poItemId: it.id, itemId: it.itemId, currentReceivedQuantity: it.orderedQuantity, rejectedDamagedQuantity: 0 })),
      },
      STAFF,
    );
    expect(grn.grnNumber).toMatch(/^GRN-MG2611\d{5}$/);
    expect(grn.totalReceivedAmount).toBe(9400);
    expect(await stock(ids.materialWh, ids.flour)).toBe(100);
    expect(await stock(ids.materialWh, ids.sugar)).toBe(20);
    expect(await stock(ids.materialWh, ids.yeast)).toBe(5);
    expect((await purchaseStore.getPurchaseOrderById(ids.po))?.status).toBe("COMPLETED");
    expect(Number((await prisma.supplier.findUniqueOrThrow({ where: { id: ids.supplier } })).balance)).toBe(9400);

    await postPendingDocuments(STAFF);
    expect(await voucher("PURCHASE_RECEIPT", grn.id)).not.toBeNull();
    expect(await gl(ids.inventory)).toBe(9400);
    expect(await gl(ids.payable)).toBe(9400);
    ids.grn = grn.id;
  });

  it("3a. Purchase return: 10 KG wet flour back to the supplier", async () => {
    const ret = await purchaseStore.createPurchaseReturn(
      { goodsReceiptId: ids.grn, returnDate: "2026-11-03", items: [{ itemId: ids.flour, returnQuantity: 10, reason: "Wet" }] },
      STAFF,
    );
    expect(ret.totalReturnAmount).toBe(500);
    expect(await stock(ids.materialWh, ids.flour)).toBe(90);
    expect(Number((await prisma.supplier.findUniqueOrThrow({ where: { id: ids.supplier } })).balance)).toBe(8900);
    // What is owed on the GRN now is net of the return.
    const grnInvoice = (await listSupplierInvoices()).find((inv) => inv.receiptId === ids.grn);
    expect(grnInvoice?.dueAmount).toBe(8900);

    await postPendingDocuments(STAFF);
    expect(await voucher("PURCHASE_RETURN", ret.id)).not.toBeNull();
    expect(await gl(ids.inventory)).toBe(8900);
    expect(await gl(ids.payable)).toBe(8900);
    // The flour left in stock still costs 50.
    expect(Number((await prisma.item.findUniqueOrThrow({ where: { id: ids.flour } })).purchasePrice)).toBe(50);
  });

  it("3b. Bills: the GRN bill releases it for payment; a transport bill without goods adds to the due", async () => {
    const grnBill = await createSupplierBill({ supplierId: ids.supplier, receiptId: ids.grn, number: "INV-1792", billDate: "2026-11-03", dueDate: "2026-12-03" }, STAFF);
    await expect(
      purchaseStore.createSupplierPayment({ supplierId: ids.supplier, officeId: ids.officeId, amount: 100, method: "CASH", paymentDate: "2026-11-03", receiptId: ids.grn }, STAFF),
    ).rejects.toThrow(/not approved/);
    await approveSupplierBill(grnBill.id, "Accounts Manager");
    // The GRN bill neither doubles the due nor posts again: the GRN already did.
    expect(Number((await prisma.supplier.findUniqueOrThrow({ where: { id: ids.supplier } })).balance)).toBe(8900);
    const grnInvoice = (await listSupplierInvoices()).find((inv) => inv.receiptId === ids.grn);
    expect(grnInvoice?.dueAmount).toBe(8900);

    const transport = await createSupplierBill({ supplierId: ids.supplier, number: "TR-55", amount: 600, billDate: "2026-11-03", dueDate: "2026-11-10" }, STAFF);
    await approveSupplierBill(transport.id, "Accounts Manager");
    expect(Number((await prisma.supplier.findUniqueOrThrow({ where: { id: ids.supplier } })).balance)).toBe(9500);
    await postPendingDocuments(STAFF);
    expect(await voucher("SUPPLIER_BILL", grnBill.id)).toBeNull();
    expect(await voucher("SUPPLIER_BILL", transport.id)).not.toBeNull();
    expect(await gl(ids.purchaseExp)).toBe(600);
    expect(await gl(ids.payable)).toBe(9500);
    ids.transportBill = transport.id;
  });

  it("4. Bon Ruti produced from the bought material: stock moves and the GL follows", async () => {
    const department = await createMaster(adminActor, "departments", { name: "Production" });
    const section = await createMaster(adminActor, "sections", { name: "Bakery", departmentId: department.id });
    // 100 pcs per lot: 10 KG flour, 2 KG sugar, 0.5 KG yeast.
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
      orderDate: "2026-11-04",
      productionDate: "2026-11-04",
      itemId: ids.bonRuti,
      bomId: bom.id,
      quantity: 500,
      officeId: ids.officeId,
      warehouseId: ids.materialWh,
    });
    await actOnOrder(manager, order.id, { version: order.updatedAt, action: "approve" });
    const form = await entryForm(manager, order.id);
    expect(form.materials.map((m) => m.stock)).toEqual([90, 20, 5]);

    const entry = await createEntry(manager, {
      orderId: order.id,
      entryDate: "2026-11-04",
      shift: "Morning",
      departmentId: department.id,
      departmentSectionId: section.id,
      outputWarehouseId: ids.fgWh,
      totalQty: 500,
      rejectQty: 0,
      hours: 8,
      materials: [
        { itemId: ids.flour, actualQty: 50 },
        { itemId: ids.sugar, actualQty: 10 },
        { itemId: ids.yeast, actualQty: 2.5 },
      ],
    });
    expect(entry.status).toBe("POSTED");
    expect(await stock(ids.materialWh, ids.flour)).toBe(40);
    expect(await stock(ids.materialWh, ids.sugar)).toBe(10);
    expect(await stock(ids.materialWh, ids.yeast)).toBe(2.5);
    expect(await stock(ids.fgWh, ids.bonRuti)).toBe(500);
    expect((await getProductionOrder(manager, order.id)).status).toBe("CLOSED");

    await postPendingDocuments(STAFF);
    // Material used is worth what it was bought for: 50×50 + 10×120 + 2.5×400 = 4,700.
    const production = await voucher("PRODUCTION_ENTRY", entry.id);
    expect(production, "production entry must post to the GL").not.toBeNull();
    expect(Number(production!.totalDebit)).toBe(4700);
    // Raw material out, Bon Ruti in at the same value: the inventory account is unchanged.
    expect(await gl(ids.inventory)).toBe(8900);
    expect(Number((await prisma.item.findUniqueOrThrow({ where: { id: ids.bonRuti } })).purchasePrice)).toBe(9.4);
    ids.entry = entry.id;
  });

  it("5. Bon Ruti sold and delivered from FG Store: stock, customer due, revenue and cost of goods sold", async () => {
    const order = await createSalesOrder(adminActor, {
      officeId: ids.officeId,
      customerId: ids.customer,
      salesPersonId: ids.salesPerson,
      orderType: "SALES",
      paymentMethod: "CREDIT",
      orderDate: "2026-11-05",
      expectedDeliveryDate: "2026-11-06",
      priceIncludesVat: true,
      isForeign: false,
      paymentTermDays: 7,
      dueLimit: 0,
      discountAmount: 0,
      deliveryCharge: 0,
      unloadingCharge: 0,
      lines: [{ itemId: ids.bonRuti, qty: 300, unitPrice: 25, discountPercent: 0, vatPercent: 0, aitPercent: 0 }],
    });
    const submitted = await changeOrderStatus(adminActor, order.id, { action: "submit", version: order.updatedAt, today: "2026-11-05" });
    expect(submitted.status).toBe("APPROVED");

    const delivery = await createDelivery(adminActor, {
      deliveryType: "SALES_ORDER",
      salesOrderId: order.id,
      officeId: ids.officeId,
      warehouseId: ids.fgWh,
      deliveryDate: "2026-11-06",
      paymentMethod: "CREDIT",
      paymentTermDays: 7,
      deliveryCharge: 0,
      unloadingCharge: 0,
      paidAmount: 0,
      lines: [{ orderLineId: order.lines[0].id, qty: 300 }],
    });
    expect(await stock(ids.fgWh, ids.bonRuti)).toBe(200);
    const due = (await listDueInvoices(adminActor, { asOf: "2026-11-30" })).find((r) => r.deliveryId === delivery.id);
    expect(due?.due).toBe(7500);

    await postPendingDocuments(STAFF);
    expect(await gl(ids.receivable)).toBe(7500);
    expect(await gl(ids.revenue)).toBe(7500);
    // 300 pcs at the 9.40 they cost to make.
    expect(await gl(ids.cogs)).toBe(2820);
    expect(await gl(ids.inventory)).toBe(8900 - 2820);
    ids.delivery = delivery.id;
    ids.deliveryLine = delivery.lines[0].id;
  });

  it("5a. Sales return: 20 pcs back from the customer into FG Store", async () => {
    const salesReturn = await createReturn(adminActor, {
      mode: "PARTIAL",
      deliveryId: ids.delivery,
      officeId: ids.officeId,
      warehouseId: ids.fgWh,
      returnDate: "2026-11-07",
      lines: [{ deliveryLineId: ids.deliveryLine, qty: 20 }],
    });
    expect(await stock(ids.fgWh, ids.bonRuti)).toBe(200); // a pending return changes nothing yet
    await approveReturn(adminActor, salesReturn.id, { version: salesReturn.updatedAt });
    expect(await stock(ids.fgWh, ids.bonRuti)).toBe(220);
    const due = (await listDueInvoices(adminActor, { asOf: "2026-11-30" })).find((r) => r.deliveryId === ids.delivery);
    expect(due?.due).toBe(7000);

    await postPendingDocuments(STAFF);
    expect(await voucher("SALES_RETURN", salesReturn.id)).not.toBeNull();
    expect(await gl(ids.receivable)).toBe(7000);
    expect(await gl(ids.revenue)).toBe(7000);
    expect(await gl(ids.cogs)).toBe(2820 - 188);
    expect(await gl(ids.inventory)).toBe(8900 - 2820 + 188);
    // Bon Ruti comes back at what it cost: the item cost does not move.
    expect(Number((await prisma.item.findUniqueOrThrow({ where: { id: ids.bonRuti } })).purchasePrice)).toBe(9.4);
  });

  it("6. Customer pays: due cleared, cash up", async () => {
    await createDueCollection(adminActor, {
      officeId: ids.officeId,
      collectionDate: "2026-11-08",
      method: "CASH",
      cashType: "Cash in Hand",
      salesPersonId: ids.salesPerson,
      rows: [{ customerId: ids.customer, allocations: [{ deliveryId: ids.delivery, amount: 7000 }] }],
    });
    const due = (await listDueInvoices(adminActor, { asOf: "2026-11-30" })).find((r) => r.deliveryId === ids.delivery);
    expect(due?.due ?? 0).toBe(0);
    await postPendingDocuments(STAFF);
    expect(await gl(ids.receivable)).toBe(0);
    expect(await gl(ids.cash)).toBe(7000);
  });

  it("7. Supplier paid in cash against the GRN and the transport bill: due cleared, payable cleared", async () => {
    await expect(
      purchaseStore.createSupplierPayment({ supplierId: ids.supplier, officeId: ids.officeId, amount: 9400, method: "CASH", paymentDate: "2026-11-09", receiptId: ids.grn }, STAFF),
    ).rejects.toThrow(/8900/);
    await purchaseStore.createSupplierPayment({ supplierId: ids.supplier, officeId: ids.officeId, amount: 8900, method: "CASH", paymentDate: "2026-11-09", receiptId: ids.grn }, STAFF);
    await purchaseStore.createSupplierPayment({ supplierId: ids.supplier, officeId: ids.officeId, amount: 600, method: "CASH", paymentDate: "2026-11-09", billId: ids.transportBill }, STAFF);
    expect(Number((await prisma.supplier.findUniqueOrThrow({ where: { id: ids.supplier } })).balance)).toBe(0);
    const open = (await listSupplierInvoices()).filter((inv) => inv.supplierId === ids.supplier && inv.dueAmount > 0);
    expect(open).toEqual([]);
    await postPendingDocuments(STAFF);
    expect(await gl(ids.payable)).toBe(0);
    expect(await gl(ids.cash)).toBe(7000 - 9500);
  });

  it("8. The books agree: inventory GL equals the stock left, and debits equal credits", async () => {
    // Left: 40 KG flour, 10 KG sugar, 2.5 KG yeast (4,200) + 220 Bon Ruti at 9.40 (2,068).
    expect(await stock(ids.materialWh, ids.flour)).toBe(40);
    expect(await stock(ids.fgWh, ids.bonRuti)).toBe(220);
    expect(await gl(ids.inventory)).toBe(6268);
    const totals = await prisma.journalVoucherLine.aggregate({ _sum: { debit: true, credit: true } });
    expect(Number(totals._sum.debit)).toBe(Number(totals._sum.credit));
    // Gross profit: 7,000 revenue − 2,632 cost; after the 600 transport bill, 3,768.
    expect((await gl(ids.revenue)) - (await gl(ids.cogs))).toBe(4368);
    expect((await gl(ids.revenue)) - (await gl(ids.cogs)) - (await gl(ids.purchaseExp))).toBe(3768);
  });
});
