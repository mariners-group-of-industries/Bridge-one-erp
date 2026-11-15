import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import type { Actor } from "@/lib/auth/actor";
import { AppError } from "@/lib/api/errors";
import { actionForRequest, checkApiAccess, ruleForRequest } from "@/lib/permissions/api-rules";
import { grantsFromList, permissionKey, type PermissionAction } from "@/lib/permissions/registry";
import { canApproveWithSummary, type ApprovalRightsSummary } from "@/lib/purchase-store/rules";
import { assertApprovalPipeline, getApprovalRightsSummary, resolvePurchaseOrgScope } from "@/lib/purchase-store/governance";
import { purchaseStore } from "@/lib/purchase-store/store";
import {
  approveSupplierBill,
  approvePendingSupplierBills,
  createSupplierBill,
  listPaymentHistory,
  listSupplierInvoices,
  listSupplierPayables,
} from "@/lib/purchase-store/payables";
import { goodsReceiptPdf, supplierPaymentPdf } from "@/lib/purchase-store/purchase-pdf";
import { businessUnitInput, companyInput, officeInput } from "./helpers/fixtures";
import { resetTestDb, startTestDb, stopTestDb } from "./helpers/test-db";

vi.mock("@/lib/prisma/client", async () => {
  const { testPrisma } = await import("./helpers/test-db");
  return { db: testPrisma };
});

function makeRbacActor(
  grants: Array<{ feature: string; actions: PermissionAction[] }>,
  isMaster = false,
): Actor {
  const keys = grants.flatMap((g) => g.actions.map((a) => permissionKey(g.feature, a)));
  return {
    id: "rbac-actor",
    name: "RBAC Tester",
    role: "STAFF",
    isMaster,
    permissions: new Set(),
    companyScope: "ALL",
    grants: grantsFromList(keys),
  };
}

const effectiveAction = (method: string, pathname: string): PermissionAction =>
  ruleForRequest(pathname)?.action ?? actionForRequest(method, pathname);

describe("purchase API RBAC rule mapping", () => {
  it("maps cancel endpoints to delete, reverse/close/method to edit, and approve/reject/bill-approve to approve", () => {
    expect(effectiveAction("POST", "/api/v1/purchase/requisitions/123/cancel")).toBe("delete");
    expect(effectiveAction("POST", "/api/v1/purchase/orders/123/cancel")).toBe("delete");
    expect(effectiveAction("POST", "/api/v1/purchase/receive/123/cancel")).toBe("delete");
    expect(effectiveAction("POST", "/api/v1/purchase/receipts/123/cancel")).toBe("delete");
    expect(effectiveAction("POST", "/api/v1/purchase/returns/123/cancel")).toBe("delete");
    expect(effectiveAction("POST", "/api/v1/purchase/supplier-payments/123/cancel")).toBe("delete");
    expect(effectiveAction("POST", "/api/v1/purchase/supplier-bills/123/cancel")).toBe("delete");

    expect(effectiveAction("PUT", "/api/v1/purchase/requisitions/123/reverse")).toBe("edit");
    expect(effectiveAction("PUT", "/api/v1/purchase/requisitions/123/method")).toBe("edit");
    expect(effectiveAction("PUT", "/api/v1/purchase/orders/123/close")).toBe("edit");
    expect(effectiveAction("PUT", "/api/v1/purchase/orders/123/reverse")).toBe("edit");

    expect(effectiveAction("POST", "/api/v1/purchase/requisitions/123/approve")).toBe("approve");
    expect(effectiveAction("POST", "/api/v1/purchase/requisitions/123/reject")).toBe("approve");
    expect(effectiveAction("POST", "/api/v1/purchase/orders/123/approve")).toBe("approve");
    expect(effectiveAction("POST", "/api/v1/purchase/supplier-payments/123/approve")).toBe("approve");
    expect(effectiveAction("POST", "/api/v1/purchase/supplier-bills/123/approve")).toBe("approve");
    expect(effectiveAction("POST", "/api/v1/purchase/supplier-bills/approve-pending")).toBe("approve");

    expect(effectiveAction("GET", "/api/v1/purchase/orders/123/pdf")).toBe("export");
    expect(effectiveAction("GET", "/api/v1/purchase/reports/export-csv")).toBe("export");
    expect(effectiveAction("GET", "/api/v1/purchase/supplier-payments/payables-pdf")).toBe("export");
  });

  it("enforces fine-grained view/create/edit/delete/approve/export + quick-create permissions", () => {
    const viewOnly = makeRbacActor([{ feature: "/purchase/requisitions", actions: ["view"] }]);
    expect(checkApiAccess(viewOnly.grants, "GET", "/api/v1/purchase/requisitions").allowed).toBe(true);
    expect(checkApiAccess(viewOnly.grants, "GET", "/api/v1/master/suppliers").allowed).toBe(true);
    expect(checkApiAccess(viewOnly.grants, "GET", "/api/v1/master/items").allowed).toBe(true);
    expect(checkApiAccess(viewOnly.grants, "POST", "/api/v1/purchase/requisitions").allowed).toBe(false);
    expect(checkApiAccess(viewOnly.grants, "PUT", "/api/v1/purchase/requisitions/1/reverse").allowed).toBe(false);
    expect(checkApiAccess(viewOnly.grants, "POST", "/api/v1/purchase/requisitions/1/cancel").allowed).toBe(false);
    expect(checkApiAccess(viewOnly.grants, "POST", "/api/v1/purchase/requisitions/1/approve").allowed).toBe(false);
    expect(checkApiAccess(viewOnly.grants, "POST", "/api/v1/purchase/requisitions/1/reject").allowed).toBe(false);
    expect(checkApiAccess(viewOnly.grants, "GET", "/api/v1/purchase/requisitions/1/pdf").allowed).toBe(false);

    // Quick-create supplier & item from Purchase forms strictly require supplier-profile / item-profile create
    expect(checkApiAccess(viewOnly.grants, "POST", "/api/v1/master/suppliers").allowed).toBe(false);
    expect(checkApiAccess(viewOnly.grants, "POST", "/api/v1/master/items").allowed).toBe(false);

    const creator = makeRbacActor([
      { feature: "/purchase/orders", actions: ["view", "create", "edit"] },
      { feature: "/configuration/entity-master-data/supplier-profile", actions: ["view", "create"] },
    ]);
    expect(checkApiAccess(creator.grants, "POST", "/api/v1/purchase/orders").allowed).toBe(true);
    expect(checkApiAccess(creator.grants, "PUT", "/api/v1/purchase/orders/1/close").allowed).toBe(true);
    expect(checkApiAccess(creator.grants, "POST", "/api/v1/purchase/orders/1/cancel").allowed).toBe(false);
    expect(checkApiAccess(creator.grants, "POST", "/api/v1/master/suppliers").allowed).toBe(true);
    expect(checkApiAccess(creator.grants, "POST", "/api/v1/master/items").allowed).toBe(false);

    const exportActor = makeRbacActor([
      { feature: "/purchase/reports", actions: ["view", "export"] },
      { feature: "/purchase/supplier-payments", actions: ["view", "approve", "export"] },
    ]);
    expect(checkApiAccess(exportActor.grants, "GET", "/api/v1/purchase/reports/export-csv").allowed).toBe(true);
    expect(checkApiAccess(exportActor.grants, "GET", "/api/v1/purchase/supplier-payments/payables-pdf").allowed).toBe(true);
    expect(checkApiAccess(exportActor.grants, "POST", "/api/v1/purchase/supplier-bills/1/approve").allowed).toBe(true);
    expect(checkApiAccess(exportActor.grants, "POST", "/api/v1/purchase/supplier-bills/approve-pending").allowed).toBe(true);
    expect(checkApiAccess(exportActor.grants, "POST", "/api/v1/purchase/supplier-payments/1/cancel").allowed).toBe(false);
  });

  it("evaluates canApproveWithSummary threshold & BU rules consistently", () => {
    const summary: ApprovalRightsSummary = {
      unrestricted: false,
      stages: [
        {
          allowThreshold: true,
          thresholdMin: 0,
          thresholdMax: 50000,
          approverBuIds: ["bu-1"],
          actorBuIds: ["bu-1"],
        },
        {
          allowThreshold: true,
          thresholdMin: 50001,
          thresholdMax: null,
          approverBuIds: [null],
          actorBuIds: [],
        },
      ],
    };

    expect(canApproveWithSummary(summary, "bu-1", 25000)).toBe(true);
    expect(canApproveWithSummary(summary, "bu-2", 25000)).toBe(true); // Stage 1 has approvers only for bu-1
    expect(canApproveWithSummary(summary, "bu-1", 75000)).toBe(false); // Stage 2 designates global approver, actor not in it
    expect(canApproveWithSummary({ unrestricted: true, stages: [] }, "bu-2", 999999)).toBe(true);
  });
});

describe("purchase approval pipeline & organizational scope governance", () => {
  let prisma: PrismaClient;
  let bu1Id = "";
  let bu2Id = "";
  let office1Id = "";
  let office2Id = "";
  let wh1Id = "";
  let wh2Id = "";
  let supplierId = "";
  let itemId = "";
  let item2Id = "";
  let approverUserId = "";
  let nonApproverUserId = "";
  let superApproverUserId = "";
  let scopedUserId = "";

  beforeAll(async () => {
    prisma = await startTestDb();
  });

  afterAll(async () => {
    await stopTestDb();
  });

  beforeEach(async () => {
    await resetTestDb();

    const company = await prisma.company.create({ data: companyInput });
    const bu1 = await prisma.businessUnit.create({ data: { ...businessUnitInput, companyId: company.id, name: "BU Dhaka" } });
    const bu2 = await prisma.businessUnit.create({ data: { ...businessUnitInput, companyId: company.id, name: "BU Chattogram" } });
    bu1Id = bu1.id;
    bu2Id = bu2.id;

    const office1 = await prisma.office.create({ data: { ...officeInput, businessUnitId: bu1Id, name: "Dhaka HQ" } });
    const office2 = await prisma.office.create({ data: { ...officeInput, businessUnitId: bu2Id, name: "Chattogram Branch" } });
    office1Id = office1.id;
    office2Id = office2.id;

    const wh1 = await prisma.warehouse.create({ data: { officeId: office1Id, name: "Dhaka WH" } });
    const wh2 = await prisma.warehouse.create({ data: { officeId: office2Id, name: "Ctg WH" } });
    wh1Id = wh1.id;
    wh2Id = wh2.id;

    const supplier = await prisma.supplier.create({
      data: { businessUnitId: bu1Id, code: "SUP-GOV-1", name: "Gov Supplier", phone: "01711000001", type: "LOCAL" },
    });
    supplierId = supplier.id;

    const item1 = await prisma.item.create({
      data: {
        businessUnitId: bu1Id,
        code: "ITM-GOV-1",
        name: "Test Raw Material",
        uom: "KG",
        purchasePrice: 100,
        salesRate: 120,
      },
    });
    const item2 = await prisma.item.create({
      data: {
        businessUnitId: bu2Id,
        code: "ITM-GOV-2",
        name: "Ctg Raw Material",
        uom: "KG",
        purchasePrice: 100,
        salesRate: 120,
      },
    });
    itemId = item1.id;
    item2Id = item2.id;

    const approver = await prisma.user.create({
      data: { name: "Stage Approver", phone: "01800000001", passwordHash: "x", erpAccess: true },
    });
    const nonApprover = await prisma.user.create({
      data: { name: "Plain Staff", phone: "01800000002", passwordHash: "x", erpAccess: true },
    });
    const superApprover = await prisma.user.create({
      data: { name: "Super Approver", phone: "01800000003", passwordHash: "x", erpAccess: true },
    });
    const scopedUser = await prisma.user.create({
      data: {
        name: "Dhaka Scoped",
        phone: "01800000004",
        passwordHash: "x",
        erpAccess: true,
        allBusinessUnits: false,
        allOffices: false,
        allWarehouses: false,
      },
    });

    approverUserId = approver.id;
    nonApproverUserId = nonApprover.id;
    superApproverUserId = superApprover.id;
    scopedUserId = scopedUser.id;

    await prisma.userBusinessUnitAccess.create({ data: { userId: scopedUserId, businessUnitId: bu1Id } });
    await prisma.userOfficeAccess.create({ data: { userId: scopedUserId, officeId: office1Id } });
    await prisma.userWarehouseAccess.create({ data: { userId: scopedUserId, warehouseId: wh1Id } });
  });

  it("enforces ApprovalPipeline threshold & super approver rules for requisition and payment approvals", async () => {
    const pipeline = await prisma.approvalPipeline.create({
      data: {
        name: "PR Approval Pipeline",
        module: "Purchase",
        feature: "Purchase Requisition",
        userType: "USER",
        superApproverUserId,
      },
    });
    const stage1 = await prisma.approvalStage.create({
      data: {
        pipelineId: pipeline.id,
        stageNo: 1,
        name: "Officer up to 50k",
        approvalOrder: "ANY",
        requiredCount: 1,
        allowThreshold: true,
        thresholdMin: 0,
        thresholdMax: 50000,
      },
    });
    await prisma.approvalStageApprover.create({
      data: {
        stageId: stage1.id,
        sortOrder: 0,
        userType: "USER",
        businessUnitId: bu1Id,
        userId: approverUserId,
        authorizationType: "APPROVE",
      },
    });

    const summaryApprover = await getApprovalRightsSummary(["Purchase Requisition"], { id: approverUserId, isMaster: false }, prisma);
    expect(canApproveWithSummary(summaryApprover, bu1Id, 30000)).toBe(true);
    expect(canApproveWithSummary(summaryApprover, bu1Id, 90000)).toBe(false);

    // Master & Super Approver pass all thresholds
    await expect(
      assertApprovalPipeline(prisma, ["Purchase Requisition"], bu1Id, 90000, { id: superApproverUserId, isMaster: false }),
    ).resolves.toBeUndefined();
    await expect(
      assertApprovalPipeline(prisma, ["Purchase Requisition"], bu1Id, 90000, { id: nonApproverUserId, isMaster: true }),
    ).resolves.toBeUndefined();

    // Requisition below threshold: non-approver rejected on APPROVE & REJECT, stage approver succeeds
    const reqLow = await purchaseStore.createRequisition({
      companyId: bu1Id,
      requestDate: "2026-11-12",
      requiredDeliveryDate: "2026-11-15",
      officeId: office1Id,
      warehouseId: wh1Id,
      requestType: "LOCAL",
      purchaseMethod: "DIRECT",
      department: "Maintenance",
      requesterName: "Plain Staff",
      businessJustification: "Threshold test",
      items: [{ itemId, itemCode: "ITM-GOV-1", itemName: "Test Raw Material", uom: "KG", quantity: 10, estimatedUnitPrice: 100, lineTotal: 1000 }],
    });

    await expect(
      purchaseStore.updateRequisitionStatus(reqLow.id, "APPROVE", "Plain Staff", "Nope", {
        id: nonApproverUserId,
        name: "Plain Staff",
        isMaster: false,
      }),
    ).rejects.toThrowError(AppError);

    await expect(
      purchaseStore.updateRequisitionStatus(reqLow.id, "REJECT", "Plain Staff", "Nope", {
        id: nonApproverUserId,
        name: "Plain Staff",
        isMaster: false,
      }),
    ).rejects.toThrowError(AppError);

    const approved = await purchaseStore.updateRequisitionStatus(reqLow.id, "APPROVE", "Stage Approver", "OK", {
      id: approverUserId,
      name: "Stage Approver",
      isMaster: false,
    });
    expect(approved?.status).toBe("APPROVED");

    // Payment Approval pipeline enforcement on SupplierBill
    const payPipeline = await prisma.approvalPipeline.create({
      data: { name: "Payment Pipeline", module: "Purchase", feature: "Payment Approval", userType: "USER" },
    });
    const payStage = await prisma.approvalStage.create({
      data: { pipelineId: payPipeline.id, stageNo: 1, name: "Finance Approver", approvalOrder: "ANY", requiredCount: 1 },
    });
    await prisma.approvalStageApprover.create({
      data: { stageId: payStage.id, sortOrder: 0, userType: "USER", userId: approverUserId, authorizationType: "APPROVE" },
    });

    const bill = await createSupplierBill(
      { supplierId, businessUnitId: bu1Id, number: "BILL-GOV-01", billDate: "2026-11-12", amount: 5000 },
      "Creator",
    );
    await expect(
      approveSupplierBill(bill.id, "Plain Staff", { id: nonApproverUserId, name: "Plain Staff", isMaster: false }),
    ).rejects.toThrowError(AppError);

    await expect(
      approvePendingSupplierBills("Plain Staff", { id: nonApproverUserId, name: "Plain Staff", isMaster: false }),
    ).rejects.toThrowError(AppError);

    const approvedBill = await approveSupplierBill(bill.id, "Stage Approver", {
      id: approverUserId,
      name: "Stage Approver",
      isMaster: false,
    });
    expect(approvedBill.status).toBe("APPROVED");
  });

  it("restricts Purchase offices, warehouses, lists, and creation by User Org Access", async () => {
    await purchaseStore.createRequisition({
      companyId: bu1Id,
      requestDate: "2026-11-12",
      requiredDeliveryDate: "2026-11-15",
      officeId: office1Id,
      warehouseId: wh1Id,
      requestType: "LOCAL",
      purchaseMethod: "DIRECT",
      department: "Dhaka Ops",
      requesterName: "Dhaka Staff",
      businessJustification: "Org scope test 1",
      items: [{ itemId, itemCode: "ITM-GOV-1", itemName: "Test Raw Material", uom: "KG", quantity: 5, estimatedUnitPrice: 100, lineTotal: 500 }],
    });
    await purchaseStore.createRequisition({
      companyId: bu2Id,
      requestDate: "2026-11-12",
      requiredDeliveryDate: "2026-11-15",
      officeId: office2Id,
      warehouseId: wh2Id,
      requestType: "LOCAL",
      purchaseMethod: "DIRECT",
      department: "Ctg Ops",
      requesterName: "Ctg Staff",
      businessJustification: "Org scope test 2",
      items: [{ itemId: item2Id, itemCode: "ITM-GOV-2", itemName: "Ctg Raw Material", uom: "KG", quantity: 5, estimatedUnitPrice: 100, lineTotal: 500 }],
    });

    const scopedActorObj = { id: scopedUserId, name: "Dhaka Scoped", isMaster: false };
    const scope = await resolvePurchaseOrgScope(scopedActorObj, prisma);
    expect(scope.restricted).toBe(true);
    expect(scope.officeIds?.includes(office1Id)).toBe(true);
    expect(scope.officeIds?.includes(office2Id)).toBe(false);

    const officesForScoped = await purchaseStore.getOffices(scopedActorObj);
    expect(officesForScoped.map((o) => o.id)).toEqual([office1Id]);

    const whForScoped = await purchaseStore.getWarehouses(undefined, scopedActorObj);
    expect(whForScoped.map((w) => w.id)).toEqual([wh1Id]);

    const reqsForScoped = await purchaseStore.getRequisitions({}, scopedActorObj);
    expect(reqsForScoped).toHaveLength(1);
    expect(reqsForScoped[0].officeId).toBe(office1Id);

    // Master sees both offices & both requisitions
    const reqsForMaster = await purchaseStore.getRequisitions({}, { id: scopedUserId, name: "Master", isMaster: true });
    expect(reqsForMaster).toHaveLength(2);

    // Scoped user cannot create requisition in Office 2
    await expect(
      purchaseStore.createRequisition(
        {
          companyId: bu2Id,
          requestDate: "2026-11-12",
          requiredDeliveryDate: "2026-11-15",
          officeId: office2Id,
          warehouseId: wh2Id,
          requestType: "LOCAL",
          purchaseMethod: "DIRECT",
          department: "Blocked Ctg",
          requesterName: "Dhaka Scoped",
          businessJustification: "Blocked cross-office test",
          items: [{ itemId: item2Id, itemCode: "ITM-GOV-2", itemName: "Ctg Raw Material", uom: "KG", quantity: 2, estimatedUnitPrice: 100, lineTotal: 200 }],
        },
        "Dhaka Scoped",
        scopedActorObj,
      ),
    ).rejects.toThrowError(AppError);
  });

  it("restricts supplier payables, payments, bills and their PDFs by User Org Access", async () => {
    const scoped = { id: scopedUserId, name: "Dhaka Scoped", isMaster: false };
    const ctgSupplier = await prisma.supplier.create({ data: { businessUnitId: bu2Id, code: "SUP-GOV-2", name: "Ctg Supplier", type: "LOCAL" } });

    // Goods received in Chattogram, and a payment recorded against the Chattogram office.
    const ctgGrn = await purchaseStore.createGoodsReceipt(
      {
        purchaseOrderId: "DIRECT",
        receiptDate: "2026-11-12",
        supplierId: ctgSupplier.id,
        warehouseId: wh2Id,
        items: [{ itemId: item2Id, itemCode: "ITM-GOV-2", itemName: "Ctg Raw Material", uom: "KG", currentReceivedQuantity: 4, rejectedDamagedQuantity: 0, unitPrice: 100 }],
      },
      "Ctg Staff",
    );
    const ctgPayment = await purchaseStore.createSupplierPayment(
      { supplierId: ctgSupplier.id, officeId: office2Id, amount: 100, method: "CASH", paymentDate: "2026-11-12" },
      "Ctg Staff",
    );

    // Unrestricted users still see everything.
    expect((await listSupplierInvoices()).some((i) => i.receiptId === ctgGrn.id)).toBe(true);

    expect((await listSupplierPayables(undefined, scoped)).some((r) => r.supplierId === ctgSupplier.id)).toBe(false);
    expect((await listSupplierInvoices(scoped)).some((i) => i.receiptId === ctgGrn.id)).toBe(false);
    expect((await listPaymentHistory(scoped)).some((p) => p.id === ctgPayment.id)).toBe(false);
    expect((await purchaseStore.getSupplierPayments({}, scoped)).some((r) => r.supplierId === ctgSupplier.id)).toBe(false);

    await expect(goodsReceiptPdf(ctgGrn.id, scoped)).rejects.toThrowError(AppError);
    await expect(supplierPaymentPdf(ctgPayment.id, scoped)).rejects.toThrowError(AppError);
    await expect(purchaseStore.cancelSupplierPayment(ctgPayment.id, "Dhaka Scoped", "not mine", scoped)).rejects.toThrowError(AppError);
    await expect(
      purchaseStore.createSupplierPayment({ supplierId: ctgSupplier.id, receiptId: ctgGrn.id, amount: 50, method: "CASH" }, "Dhaka Scoped", scoped),
    ).rejects.toThrowError(AppError);
    await expect(
      createSupplierBill({ supplierId: ctgSupplier.id, receiptId: ctgGrn.id, number: "CTG-INV-1" }, "Dhaka Scoped", scoped),
    ).rejects.toThrowError(AppError);

    // A pending Chattogram bill is not approved by a Dhaka user's "approve all".
    await createSupplierBill({ supplierId: ctgSupplier.id, number: "CTG-ADHOC-1", amount: 75 }, "Ctg Staff");
    // Not even offered to the pipeline: nothing approved, advanced or skipped.
    expect(await approvePendingSupplierBills("Dhaka Scoped", scoped)).toEqual({ approved: 0, advanced: 0, skipped: 0 });
  });
});
