import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { createItem } from "@/features/sales/masters/services/masters.service";
import { purchaseStore } from "@/lib/purchase-store/store";
import {
  goodsReceiptPdf,
  payablesDueListPdf,
  purchaseOrderPdf,
  purchaseReportPdf,
  purchaseReturnPdf,
  requisitionPdf,
  supplierPaymentPdf,
} from "@/lib/purchase-store/purchase-pdf";
import { adminActor, businessUnitInput, companyInput, officeInput } from "./helpers/fixtures";
import { startTestDb, stopTestDb } from "./helpers/test-db";

vi.mock("@/lib/prisma/client", async () => {
  const { testPrisma } = await import("./helpers/test-db");
  return { db: testPrisma };
});

describe("purchase corporate PDF generation", () => {
  let prisma: PrismaClient;
  let officeId = "";
  let warehouseId = "";
  let supplierId = "";
  let itemId = "";

  beforeAll(async () => {
    prisma = await startTestDb();
    const company = await prisma.company.create({ data: { ...companyInput, name: "Mariners Group" } });
    const bu = await prisma.businessUnit.create({
      data: {
        ...businessUnitInput,
        companyId: company.id,
        name: "MG Head Office",
        address: "10th Floor, MG SAM Center, Mohakhali C/A, Dhaka-1212",
        contactNumber: "01840484845",
        email: "info@marinersgroup.com.bd",
      },
    });
    const office = await prisma.office.create({
      data: {
        ...officeInput,
        businessUnitId: bu.id,
        name: "MG Sirajganj Factory",
        address: "Sirajganj Industrial Park",
        phone: "01700000000",
      },
    });
    officeId = office.id;
    const warehouse = await prisma.warehouse.create({ data: { officeId, name: "Material WH" } });
    warehouseId = warehouse.id;
    const supplier = await prisma.supplier.create({
      data: {
        businessUnitId: bu.id,
        code: "SUP-PDF-01",
        name: "Royal Print Pack",
        contactPerson: "Mahmud",
        phone: "01711112222",
        type: "LOCAL",
      },
    });
    supplierId = supplier.id;
    const item = await createItem(adminActor, {
      businessUnitId: bu.id,
      code: "PM-00639",
      name: "Marine Potato Crackers Foil",
      uom: "KG",
      purchasePrice: 120,
      salesRate: 150,
    });
    itemId = item.id;

    await prisma.employee.create({
      data: {
        officeId,
        employeeCode: "EMP-PDF-1",
        name: "Md. Moshiur Rahman",
        designation: "Officer",
        mobile: "01325088135",
        joiningDate: new Date("2024-01-01"),
      },
    });
  });

  afterAll(async () => {
    await stopTestDb();
  });

  const assertIsPdf = (res: { filename: string; bytes: Uint8Array }, suffix = ".pdf") => {
    expect(res.filename.endsWith(suffix)).toBe(true);
    expect(res.bytes.byteLength).toBeGreaterThan(800);
    const header = Buffer.from(res.bytes.slice(0, 5)).toString("ascii");
    expect(header).toBe("%PDF-");
  };

  it("exposes real DB letterhead context & generates valid PDFs across all Purchase documents", async () => {
    const ctx = await purchaseStore.getContext(adminActor);
    expect(ctx.company.name).toBe("Mariners Group");
    expect(ctx.company.phone).toBe("01840484845");
    expect(ctx.company.email).toBe("info@marinersgroup.com.bd");
    expect(ctx.officesById[officeId]?.name).toBe("MG Sirajganj Factory");

    const req = await purchaseStore.createRequisition(
      {
        companyId: "",
        officeId,
        warehouseId,
        requestType: "LOCAL",
        department: "Store",
        requesterName: "Md. Moshiur Rahman",
        purchaseMethod: "DIRECT",
        requestDate: "2026-11-02",
        requiredDeliveryDate: "2026-11-05",
        businessJustification: "Royal Print Pack",
        items: [
          {
            itemId,
            itemCode: "PM-00639",
            itemName: "Marine Potato Crackers Foil",
            uom: "KG",
            quantity: 1000,
            estimatedUnitPrice: 120,
            lineTotal: 120000,
          },
        ],
      },
      "Md. Moshiur Rahman",
    );
    await purchaseStore.updateRequisitionStatus(req.id, "APPROVE", "Procurement Head", "Approved for sourcing");
    assertIsPdf(await requisitionPdf(req.id));

    const po = await purchaseStore.createPurchaseOrder(
      {
        companyId: "",
        officeId,
        warehouseId,
        supplierId,
        requisitionId: req.id,
        orderDate: "2026-11-03",
        expectedDeliveryDate: "2026-11-06",
        paymentTerms: "Net 30",
        deliveryTerms: "FOB",
        shippingFee: 0,
        items: [
          {
            itemId,
            itemCode: "PM-00639",
            itemName: "Marine Potato Crackers Foil",
            uom: "KG",
            orderedQuantity: 500,
            receivedQuantity: 0,
            returnedQuantity: 0,
            outstandingQuantity: 500,
            unitPrice: 120,
            discountPercentage: 0,
            discountAmount: 0,
            taxPercentage: 0,
            taxAmount: 0,
            lineTotal: 60000,
          },
        ],
      },
      "Md. Moshiur Rahman",
    );
    assertIsPdf(await purchaseOrderPdf(po.id));

    const grn = await purchaseStore.createGoodsReceipt(
      {
        purchaseOrderId: po.id,
        warehouseId,
        receiptDate: "2026-11-04",
        challanNumber: "CH-9001",
        items: [{ poItemId: po.items[0].id, itemId, currentReceivedQuantity: 500, rejectedDamagedQuantity: 0 }],
      },
      "Store Officer",
    );
    assertIsPdf(await goodsReceiptPdf(grn.id));

    const ret = await purchaseStore.createPurchaseReturn(
      {
        goodsReceiptId: grn.id,
        returnDate: "2026-11-05",
        remarks: "Torn foil rolls",
        items: [{ itemId, itemCode: "PM-00639", itemName: "Marine Potato Crackers Foil", uom: "KG", returnQuantity: 50, unitPrice: 120, reason: "Damaged" }],
      },
      "Store Officer",
    );
    assertIsPdf(await purchaseReturnPdf(ret.id));

    const payment = await purchaseStore.createSupplierPayment(
      {
        supplierId,
        officeId,
        receiptId: grn.id,
        paymentDate: "2026-11-06",
        amount: 25000,
        method: "BANK",
        referenceNumber: "CHQ-1001",
      },
      "Accounts Officer",
    );
    assertIsPdf(await supplierPaymentPdf(payment.id));

    assertIsPdf(await payablesDueListPdf({}));
    assertIsPdf(await purchaseReportPdf({ reportType: "PURCHASE_ORDER_REPORT", isSummary: false }));
  });

  it("throws notFound on unknown document ids", async () => {
    await expect(requisitionPdf("non-existent-id")).rejects.toMatchObject({ status: 404 });
    await expect(purchaseOrderPdf("non-existent-id")).rejects.toMatchObject({ status: 404 });
    await expect(goodsReceiptPdf("non-existent-id")).rejects.toMatchObject({ status: 404 });
    await expect(purchaseReturnPdf("non-existent-id")).rejects.toMatchObject({ status: 404 });
    await expect(supplierPaymentPdf("non-existent-id")).rejects.toMatchObject({ status: 404 });
  });
});
