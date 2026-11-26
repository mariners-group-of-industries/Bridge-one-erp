import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import type { Actor } from "@/lib/auth/actor";
import { approvalTrail, currentApproverIds } from "@/lib/approval/engine";
import { purchaseStore } from "@/lib/purchase-store/store";
import { approveSupplierBill, createSupplierBill } from "@/lib/purchase-store/payables";
import { createPipeline } from "@/features/configuration/security/approval/server/approval.service";
import { createBom } from "@/features/production/bom/services/bom.service";
import { actOnOrder, createOrder as createProductionOrder, getOrder as getProductionOrder } from "@/features/production/orders/services/order.service";
import { createMaster } from "@/features/production/work-centers/services/work-center.service";
import { stockLevels } from "@/features/sales/deliveries/services/stock.service";
import { createCustomer, createSalesPerson } from "@/features/sales/masters/services/masters.service";
import { changeOrderStatus, createOrder as createSalesOrder, getOrder as getSalesOrder } from "@/features/sales/orders/services/order.service";
import { createDelivery } from "@/features/sales/deliveries/services/delivery.service";
import { approveReturn, createReturn, getReturn, updateReturn } from "@/features/sales/returns/services/return.service";
import { adminActor, businessUnitInput, companyInput, officeInput } from "./helpers/fixtures";
import { startTestDb, stopTestDb } from "./helpers/test-db";

vi.mock("@/lib/prisma/client", async () => {
  const { testPrisma } = await import("./helpers/test-db");
  return { db: testPrisma };
});

const STAFF = "Store Officer";

/**
 * Multilayer approval across every document of the Bon Ruti chain, with
 * pipelines that use each Approval Setup option: sequential and "any person"
 * stages, two people needed in one stage, an amount threshold, a super
 * approver, and an approver tied to another business unit.
 */
describe("Multilayer approval A to Z", () => {
  let prisma: PrismaClient;
  const ids: Record<string, string> = {};
  const people: Record<string, Actor> = {};
  const as = (key: string) => people[key];
  const stock = async (warehouseId: string, itemId: string) => (await stockLevels(warehouseId, [itemId])).get(itemId) ?? 0;
  const trailStatus = async (feature: string, id: string) => (await approvalTrail(feature, id)).map((s) => s.status);

  beforeAll(async () => {
    prisma = await startTestDb();
    const companyId = (await prisma.company.create({ data: { ...companyInput, name: "Mariners Group" } })).id;
    const businessUnitId = (await prisma.businessUnit.create({ data: { ...businessUnitInput, companyId } })).id;
    const otherUnitId = (await prisma.businessUnit.create({ data: { ...businessUnitInput, name: "Other Unit", companyId } })).id;
    const officeId = (await prisma.office.create({ data: { ...officeInput, businessUnitId } })).id;
    Object.assign(ids, {
      businessUnitId,
      officeId,
      wh: (await prisma.warehouse.create({ data: { officeId, name: "Material WH" } })).id,
      fgWh: (await prisma.warehouse.create({ data: { officeId, name: "FG Store" } })).id,
      supplier: (await prisma.supplier.create({ data: { businessUnitId, code: "SUP-1", name: "M/S Vai Vai Traders" } })).id,
    });
    ids.flour = (await prisma.item.create({ data: { businessUnitId, code: "RM-1", name: "Wheat Flour", uom: "KG" } })).id;
    ids.bonRuti = (await prisma.item.create({ data: { businessUnitId, code: "FG-1", name: "Bon Ruti", uom: "PCS", salesRate: 25 } })).id;

    // A, B: store; C, D, E: accounts; F: director; S: super approver; G: approver of another unit.
    for (const [key, name, phone] of [
      ["A", "Store Officer A", "01710000001"],
      ["B", "Store Officer B", "01710000002"],
      ["C", "Accounts C", "01710000003"],
      ["D", "Accounts D", "01710000004"],
      ["E", "Accounts E", "01710000005"],
      ["F", "Director F", "01710000006"],
      ["S", "Super S", "01710000007"],
      ["G", "Other Unit G", "01710000008"],
    ]) {
      const id = (await prisma.user.create({ data: { name, phone, passwordHash: "x" } })).id;
      ids[key] = id;
      people[key] = { ...adminActor, id, name, isMaster: false };
    }
    const approver = (key: string, unit = "") => ({ userType: "USER" as const, businessUnitId: unit, approverId: ids[key], authorizationType: "APPROVAL" as const });
    type Stage = { name: string; approvalOrder: "ANY" | "SEQUENTIAL"; requiredCount: number; approvers: ReturnType<typeof approver>[]; allowThreshold?: boolean; thresholdMin?: string; thresholdMax?: string };
    const stage = (name: string, keys: string[], extra: Partial<Stage> = {}): Stage => ({ name, approvalOrder: "ANY", requiredCount: 1, approvers: keys.map((k) => approver(k)), ...extra });
    const pipeline = (feature: string, stages: Stage[]) =>
      createPipeline(adminActor, { name: `${feature} approval`, feature, userType: "USER", superApproverId: ids.S, remarks: "", stages } as Parameters<typeof createPipeline>[1]);

    await pipeline("Purchase Requisition", [
      stage("Store", ["A", "B"], { approvalOrder: "SEQUENTIAL", requiredCount: 2 }),
      stage("Accounts", ["C", "D", "E"], { requiredCount: 2 }),
      stage("Director", ["F"], { allowThreshold: true, thresholdMin: "50000" }),
    ]);
    await pipeline("Purchase Order", [stage("Store", ["A"]), stage("Accounts", ["C"])]);
    await pipeline("Goods Receipt", [stage("Store", ["A"]), stage("Accounts", ["C"])]);
    await pipeline("Purchase Return", [stage("Store", ["A"]), stage("Accounts", ["C"])]);
    await pipeline("Payment Approval", [stage("Accounts", ["C"]), stage("Director", ["F"])]);
    await pipeline("Production Order", [stage("Production", ["A", "B"], { approvalOrder: "SEQUENTIAL", requiredCount: 2 }), stage("Accounts", ["C"])]);
    await pipeline("Sales Order", [{ ...stage("Sales", ["A"]), approvers: [approver("G", otherUnitId), approver("A")] }, stage("Accounts", ["C"])]);
    await pipeline("Sales Return", [stage("Store", ["A"]), stage("Accounts", ["C"])]);

    const salesPerson = await createSalesPerson(adminActor, { businessUnitId, name: "Md. Manik Miah", designation: "TSM" });
    ids.salesPerson = salesPerson.id;
    ids.customer = (await createCustomer(adminActor, { businessUnitId, name: "M/S Arif Enterprise", creditDays: 7, salesPersonId: salesPerson.id })).id;
  });

  afterAll(stopTestDb);

  const requisition = (qty: number) =>
    purchaseStore.createRequisition(
      {
        companyId: "", officeId: ids.officeId, warehouseId: ids.wh, requestType: "LOCAL", department: "Production", requesterName: "Production",
        purchaseMethod: "DIRECT", requestDate: "2026-11-01", requiredDeliveryDate: "2026-11-03", businessJustification: "Flour",
        items: [{ itemId: ids.flour, itemCode: "", itemName: "", uom: "", quantity: qty, estimatedUnitPrice: 50, lineTotal: 0 }],
      },
      STAFF,
    );
  const prApprove = (id: string, key: string) => purchaseStore.updateRequisitionStatus(id, "APPROVE", as(key).name!, "OK", as(key));

  it("01. PR 5,000: sequential store stage (A then B), then 2 of 3 accounts; the director stage is skipped under 50,000", async () => {
    const pr = await requisition(100);
    expect((await currentApproverIds({ feature: "Purchase Requisition", documentId: pr.id, businessUnitId: ids.businessUnitId, amount: 5000 }))?.sort()).toEqual([ids.A, ids.S].sort());

    await expect(prApprove(pr.id, "C"), "accounts cannot act at the store stage").rejects.toThrow(/stage 1/);
    await expect(prApprove(pr.id, "B"), "sequential: B waits for A").rejects.toThrow(/waiting for Store Officer A/);
    expect((await prApprove(pr.id, "A"))?.status).toBe("SUBMITTED");
    await expect(prApprove(pr.id, "A"), "nobody approves twice").rejects.toThrow(/already approved/);
    expect((await prApprove(pr.id, "B"))?.status).toBe("SUBMITTED");

    expect((await prApprove(pr.id, "C"))?.status, "one of two accounts approvers is not enough").toBe("SUBMITTED");
    await expect(prApprove(pr.id, "C")).rejects.toThrow(/already approved/);
    await expect(prApprove(pr.id, "F"), "the director is not in the accounts stage").rejects.toThrow(/stage 2/);
    expect((await prApprove(pr.id, "E"))?.status).toBe("APPROVED");

    const trail = await approvalTrail("Purchase Requisition", pr.id);
    expect(trail.map((s) => [s.name, s.status])).toEqual([["Store", "APPROVED"], ["Accounts", "APPROVED"]]);
    expect(trail[1].approvedNames).toEqual(["Accounts C", "Accounts E"]);
    ids.pr = pr.id;
  });

  it("02. PR 60,000 also needs the director; the super approver clears one stage per approval", async () => {
    const pr = await requisition(1200);
    expect(await trailStatus("Purchase Requisition", pr.id)).toEqual([]);
    expect((await prApprove(pr.id, "S"))?.status).toBe("SUBMITTED");
    expect(await trailStatus("Purchase Requisition", pr.id)).toEqual(["APPROVED", "PENDING", "PENDING"]);
    expect((await prApprove(pr.id, "S"))?.status).toBe("SUBMITTED");
    await expect(prApprove(pr.id, "C"), "stage 3 is the director's").rejects.toThrow(/stage 3/);
    expect((await prApprove(pr.id, "F"))?.status).toBe("APPROVED");
  });

  it("03. PR rejected at stage 2: later stages skipped; editing resubmits it and approval starts again at stage 1", async () => {
    const pr = await requisition(100);
    await prApprove(pr.id, "A");
    await prApprove(pr.id, "B");
    await expect(purchaseStore.updateRequisitionStatus(pr.id, "REJECT", "Accounts D", "", as("D"))).rejects.toThrow(/reason/);
    await expect(purchaseStore.updateRequisitionStatus(pr.id, "REJECT", "Store Officer A", "No", as("A")), "A has no say at stage 2").rejects.toThrow(/stage 2/);
    expect((await purchaseStore.updateRequisitionStatus(pr.id, "REJECT", "Accounts D", "Too much", as("D")))?.status).toBe("REJECTED");
    expect(await trailStatus("Purchase Requisition", pr.id)).toEqual(["APPROVED", "REJECTED"]);

    const edited = await purchaseStore.updateRequisition(pr.id, { items: [{ itemId: ids.flour, itemCode: "", itemName: "", uom: "", quantity: 80, estimatedUnitPrice: 50, lineTotal: 0 }] }, STAFF, as("A"));
    expect(edited?.status).toBe("SUBMITTED");
    expect(await trailStatus("Purchase Requisition", pr.id), "edit drops the old round").toEqual([]);
    await expect(prApprove(pr.id, "C"), "the new round starts at the store stage").rejects.toThrow(/stage 1/);
    await prApprove(pr.id, "A");
    // Edited again in the middle of approval: A's approval no longer stands.
    await purchaseStore.updateRequisition(pr.id, { businessJustification: "Flour, 80 KG" }, STAFF, as("A"));
    await expect(prApprove(pr.id, "B"), "after an edit B waits for A again").rejects.toThrow(/waiting for Store Officer A/);
  });

  it("04. PO: A then C; it cannot be received before; editing an approved PO sends it back for both stages", async () => {
    const po = await purchaseStore.createPurchaseOrder(
      {
        companyId: "", requisitionId: ids.pr, supplierId: ids.supplier, officeId: ids.officeId, warehouseId: ids.wh, orderDate: "2026-11-02",
        expectedDeliveryDate: "2026-11-03", paymentTerms: "", deliveryTerms: "", shippingFee: 0,
        items: [{ itemId: ids.flour, itemCode: "", itemName: "", uom: "", orderedQuantity: 100, unitPrice: 50, discountPercentage: 0, taxPercentage: 0, receivedQuantity: 0, returnedQuantity: 0, outstandingQuantity: 0, discountAmount: 0, taxAmount: 0, lineTotal: 0 }],
      },
      STAFF,
    );
    expect(po.status).toBe("PENDING_APPROVAL");
    const approve = (key: string) => purchaseStore.updatePurchaseOrderStatus(po.id, "APPROVE", as(key).name!, "OK", as(key));
    await expect(approve("C")).rejects.toThrow(/stage 1/);
    expect((await approve("A"))?.status).toBe("PENDING_APPROVAL");
    expect((await purchaseStore.getApprovedOrdersForReceiving()).map((o) => o.id)).not.toContain(po.id);
    expect((await approve("C"))?.status).toBe("APPROVED");

    await purchaseStore.updatePurchaseOrder(po.id, { paymentTerms: "30 days" }, STAFF, as("A"));
    expect((await purchaseStore.getPurchaseOrderById(po.id))?.status).toBe("PENDING_APPROVAL");
    expect(await trailStatus("Purchase Order", po.id)).toEqual([]);
    await approve("A");
    expect((await approve("C"))?.status).toBe("APPROVED");
    ids.po = po.id;
    ids.poLine = po.items[0].id!;
  });

  it("05. GRN: no stock until C approves stage 2; a rejected GRN never reaches stock", async () => {
    const receive = (qty: number) =>
      purchaseStore.createGoodsReceipt({ purchaseOrderId: ids.po, receiptDate: "2026-11-03", items: [{ poItemId: ids.poLine, itemId: ids.flour, currentReceivedQuantity: qty }] }, STAFF);
    const grn = await receive(60);
    await expect(purchaseStore.decideGoodsReceipt(grn.id, "approve", "Accounts C", "OK", as("C"))).rejects.toThrow(/stage 1/);
    await purchaseStore.decideGoodsReceipt(grn.id, "approve", "Store Officer A", "OK", as("A"));
    expect(await stock(ids.wh, ids.flour), "stage 1 alone books nothing").toBe(0);
    await purchaseStore.decideGoodsReceipt(grn.id, "approve", "Accounts C", "OK", as("C"));
    expect(await stock(ids.wh, ids.flour)).toBe(60);
    ids.grn = grn.id;

    const second = await receive(10);
    await purchaseStore.decideGoodsReceipt(second.id, "approve", "Store Officer A", "OK", as("A"));
    await purchaseStore.decideGoodsReceipt(second.id, "reject", "Accounts C", "Wet bags", as("C"));
    expect(await stock(ids.wh, ids.flour)).toBe(60);
    expect(await trailStatus("Goods Receipt", second.id)).toEqual(["APPROVED", "REJECTED"]);
  });

  it("06. Purchase return leaves stock only after both stages", async () => {
    const ret = await purchaseStore.createPurchaseReturn({ goodsReceiptId: ids.grn, returnDate: "2026-11-04", items: [{ itemId: ids.flour, returnQuantity: 5, reason: "Torn" }] }, STAFF);
    await purchaseStore.decidePurchaseReturn(ret.id, "approve", "Store Officer A", "OK", as("A"));
    expect(await stock(ids.wh, ids.flour)).toBe(60);
    await expect(purchaseStore.decidePurchaseReturn(ret.id, "approve", "Store Officer A", "OK", as("A"))).rejects.toThrow(/stage 2/);
    await purchaseStore.decidePurchaseReturn(ret.id, "approve", "Accounts C", "OK", as("C"));
    expect(await stock(ids.wh, ids.flour)).toBe(55);
  });

  it("07. Payment: C then the director; no money moves before the last stage; a bill goes through the same pipeline", async () => {
    const due = async () => Number((await prisma.supplier.findUniqueOrThrow({ where: { id: ids.supplier } })).balance);
    expect(await due()).toBe(2750);
    const bill = await createSupplierBill({ supplierId: ids.supplier, receiptId: ids.grn, number: "INV-1", billDate: "2026-11-04", dueDate: "2026-12-04" }, STAFF);
    await expect(approveSupplierBill(bill.id, "Director F", as("F"))).rejects.toThrow(/stage 1/);
    expect((await approveSupplierBill(bill.id, "Accounts C", as("C"))).status).toBe("PENDING");
    expect((await approveSupplierBill(bill.id, "Director F", as("F"))).status).toBe("APPROVED");

    const advance = await purchaseStore.createSupplierPayment({ supplierId: ids.supplier, officeId: ids.officeId, amount: 500, method: "CASH", paymentDate: "2026-11-04", purchaseOrderId: ids.po, isAdvance: true }, STAFF);
    expect(advance.status).toBe("DRAFT");
    await purchaseStore.decideSupplierPayment(advance.id, "approve", "Accounts C", "OK", as("C"));
    expect(await due(), "stage 1 alone pays nothing").toBe(2750);
    const paid = await purchaseStore.decideSupplierPayment(advance.id, "approve", "Director F", "OK", as("F"));
    expect(paid.status).toBe("PAID");
    expect(await due()).toBe(2250);
  });

  it("08. Production order: A then B (sequential, both needed), then C", async () => {
    const department = await createMaster(adminActor, "departments", { businessUnitId: ids.businessUnitId, name: "Production" });
    const section = await createMaster(adminActor, "sections", { name: "Bakery", departmentId: department.id });
    const bom = await createBom(adminActor, {
      businessUnitId: ids.businessUnitId, name: "Bon Ruti", bomType: "SINGLE_OUTPUT", departmentId: department.id, departmentSectionId: section.id,
      outputs: [{ itemId: ids.bonRuti, outputType: "FINISHED_GOODS", netWeight: 0, lotSizeQty: 100, costPercent: 100 }],
      materials: [{ itemId: ids.flour, qty: 10, wastagePercent: 0, rate: 50, excludeFromScrap: false }],
    });
    const order = await createProductionOrder(as("A"), {
      orderDate: "2026-11-05", productionDate: "2026-11-05", itemId: ids.bonRuti, bomId: bom.id, quantity: 200, officeId: ids.officeId, warehouseId: ids.wh,
    });
    const act = async (key: string) => actOnOrder(as(key), order.id, { version: (await getProductionOrder(as(key), order.id)).updatedAt, action: "approve" });
    await expect(act("B"), "B waits for A").rejects.toThrow();
    await expect(act("C"), "C waits for the production stage").rejects.toThrow();
    expect((await act("A")).status).toBe("IN_REVIEW");
    await expect(act("A"), "A cannot approve twice").rejects.toThrow();
    expect((await act("B")).status).toBe("IN_REVIEW");
    expect((await act("C")).status).toBe("APPROVED");
    expect((await getProductionOrder(as("C"), order.id)).approvals.map((s) => s.status)).toEqual(["APPROVED", "APPROVED"]);
  });

  it("09. Sales order: an approver tied to another unit has no say; rejected orders go back to draft and start again", async () => {
    await prisma.stockEntry.create({
      data: { businessUnitId: ids.businessUnitId, warehouseId: ids.fgWh, itemId: ids.bonRuti, qty: 500, source: "OPENING", postingDate: new Date("2026-11-05"), createdBy: STAFF },
    });
    const order = await createSalesOrder(adminActor, {
      officeId: ids.officeId, customerId: ids.customer, salesPersonId: ids.salesPerson, orderType: "SALES", paymentMethod: "CREDIT",
      orderDate: "2026-11-06", expectedDeliveryDate: "2026-11-07", priceIncludesVat: false, isForeign: false, paymentTermDays: 7,
      dueLimit: 0, discountAmount: 0, deliveryCharge: 0, unloadingCharge: 0,
      lines: [{ itemId: ids.bonRuti, qty: 100, unitPrice: 25, discountPercent: 0, vatPercent: 0, aitPercent: 0 }],
    });
    const version = async () => (await getSalesOrder(adminActor, order.id)).updatedAt;
    const act = async (key: string, action: "approve" | "reject" | "submit", remarks?: string) =>
      changeOrderStatus(key === "admin" ? adminActor : as(key), order.id, { action, version: await version(), today: "2026-11-06", remarks });

    expect((await act("admin", "submit")).status).toBe("PENDING_APPROVAL");
    expect(await currentApproverIds({ feature: "Sales Order", documentId: order.id, businessUnitId: ids.businessUnitId })).not.toContain(ids.G);
    await expect(act("G", "approve"), "G approves for another unit only").rejects.toThrow(/stage 1/);
    expect((await act("A", "approve")).status).toBe("PENDING_APPROVAL");
    await expect(act("C", "reject"), "a rejection needs a reason").rejects.toThrow();
    expect((await act("C", "reject", "Price too low")).status).toBe("DRAFT");

    expect((await act("admin", "submit")).status).toBe("PENDING_APPROVAL");
    await expect(act("C", "approve"), "the new round starts at stage 1").rejects.toThrow(/stage 1/);
    await act("A", "approve");
    expect((await act("C", "approve")).status).toBe("APPROVED");
    ids.salesOrder = order.id;
    ids.salesOrderLine = order.lines[0].id;
  });

  it("10. Sales return: stock comes back only after stage 2; editing it after stage 1 starts approval again", async () => {
    const delivery = await createDelivery(adminActor, {
      deliveryType: "SALES_ORDER", salesOrderId: ids.salesOrder, officeId: ids.officeId, warehouseId: ids.fgWh, deliveryDate: "2026-11-07",
      paymentMethod: "CREDIT", paymentTermDays: 7, deliveryCharge: 0, unloadingCharge: 0, paidAmount: 0,
      lines: [{ orderLineId: ids.salesOrderLine, qty: 100 }],
    });
    const before = await stock(ids.fgWh, ids.bonRuti);
    const input = (qty: number) => ({ mode: "PARTIAL", deliveryId: delivery.id, officeId: ids.officeId, warehouseId: ids.fgWh, returnDate: "2026-11-08", lines: [{ deliveryLineId: delivery.lines[0].id, qty }] });
    const ret = await createReturn(adminActor, input(10));
    const version = async () => (await getReturn(adminActor, ret.id)).updatedAt;

    await expect(approveReturn(as("C"), ret.id, { version: await version() })).rejects.toThrow(/stage 1/);
    await approveReturn(as("A"), ret.id, { version: await version() });
    expect((await getReturn(adminActor, ret.id)).status).toBe("DRAFT");
    expect(await stock(ids.fgWh, ids.bonRuti)).toBe(before);

    // Quantity changed after A approved: A must look at it again.
    await updateReturn(adminActor, ret.id, { version: await version(), data: input(20) });
    expect(await trailStatus("Sales Return", ret.id), "the edit drops A's approval").toEqual([]);
    await expect(approveReturn(as("C"), ret.id, { version: await version() })).rejects.toThrow(/stage 1/);
    await approveReturn(as("A"), ret.id, { version: await version() });
    await approveReturn(as("C"), ret.id, { version: await version() });
    expect((await getReturn(adminActor, ret.id)).status).toBe("SUBMITTED");
    expect(await stock(ids.fgWh, ids.bonRuti)).toBe(before + 20);
  });
});
