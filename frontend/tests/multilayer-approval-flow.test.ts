import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma/client", async () => {
  const { testPrisma } = await import("./helpers/test-db");
  return { db: testPrisma };
});
import type { PrismaClient } from "@/generated/prisma/client";
import { getApprovalSummary } from "@/features/approvals/server/summary.service";
import { createPipeline } from "@/features/configuration/security/approval/server/approval.service";
import { createItem } from "@/features/sales/masters/services/masters.service";
import { approvalTrail } from "@/lib/approval/engine";
import type { Actor } from "@/lib/auth/actor";
import { purchaseStore } from "@/lib/purchase-store/store";
import { adminActor, businessUnitInput, companyInput, officeInput } from "./helpers/fixtures";
import { startTestDb, stopTestDb } from "./helpers/test-db";

/** A real document (Purchase Requisition) through a two-stage pipeline, end to end. */
describe("multilayer approval: purchase requisition", () => {
  let prisma: PrismaClient;
  let officeId: string;
  let warehouseId: string;
  let flourId: string;
  let managerId: string;
  let financeId: string;
  const as = (id: string, name: string): Actor => ({ ...adminActor, id, name, isMaster: false });

  beforeAll(async () => {
    prisma = await startTestDb();
    const companyId = (await prisma.company.create({ data: companyInput })).id;
    const businessUnitId = (await prisma.businessUnit.create({ data: { ...businessUnitInput, companyId } })).id;
    officeId = (await prisma.office.create({ data: { ...officeInput, businessUnitId } })).id;
    warehouseId = (await prisma.warehouse.create({ data: { officeId, name: "Material WH" } })).id;
    flourId = (await createItem(adminActor, { businessUnitId, name: "Wheat Flour", uom: "KG", salesRate: 60 })).id;
    managerId = (await prisma.user.create({ data: { name: "Store Manager", phone: "01711111111", passwordHash: "x" } })).id;
    financeId = (await prisma.user.create({ data: { name: "Finance Head", phone: "01722222222", passwordHash: "x" } })).id;
    const approver = (approverId: string) => ({ userType: "USER" as const, businessUnitId: "", approverId, authorizationType: "APPROVAL" as const });
    await createPipeline(adminActor, {
      name: "Requisition approval",
      feature: "Purchase Requisition",
      userType: "USER",
      superApproverId: managerId,
      remarks: "",
      stages: [
        { name: "Store Manager", approvalOrder: "ANY", requiredCount: 1, approvers: [approver(managerId)] },
        { name: "Finance", approvalOrder: "ANY", requiredCount: 1, approvers: [approver(financeId)] },
      ],
    } as Parameters<typeof createPipeline>[1]);
  });

  afterAll(async () => {
    await stopTestDb();
  });

  it("stays pending until the last stage approves, then is approved", async () => {
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
        items: [{ itemId: flourId, itemCode: "", itemName: "", uom: "", quantity: 100, estimatedUnitPrice: 50, lineTotal: 0 }],
      },
      "Store Officer",
    );
    const manager = as(managerId, "Store Manager");
    const finance = as(financeId, "Finance Head");

    // Finance cannot jump the queue.
    await expect(purchaseStore.updateRequisitionStatus(req.id, "APPROVE", "Finance Head", "", finance)).rejects.toThrow(/stage 1 \(Store Manager\)/);

    // Stage 1: still pending, waiting at stage 2.
    const afterStage1 = await purchaseStore.updateRequisitionStatus(req.id, "APPROVE", "Store Manager", "OK", manager);
    expect(afterStage1.status).toBe("SUBMITTED");
    expect((await prisma.purchaseRequisition.findUniqueOrThrow({ where: { id: req.id } })).status).toBe("PENDING");

    // The summary page shows it waiting at the Finance stage.
    const summary = await getApprovalSummary(adminActor);
    const category = summary.categories.find((c) => c.id === "purchase-requisition");
    expect(category).toMatchObject({ pending: 1, pipeline: { stages: 2 }, stageLoad: [{ stageNo: 2, name: "Finance", pending: 1 }] });

    // Stage 2: approved.
    const approved = await purchaseStore.updateRequisitionStatus(req.id, "APPROVE", "Finance Head", "Budget OK", finance);
    expect(approved.status).toBe("APPROVED");
    expect((await approvalTrail("Purchase Requisition", req.id)).map((s) => [s.name, s.status, s.approvedNames])).toEqual([
      ["Store Manager", "APPROVED", ["Store Manager"]],
      ["Finance", "APPROVED", ["Finance Head"]],
    ]);

    // Reversed back to pending: approval starts over at stage 1.
    await purchaseStore.updateRequisitionStatus(req.id, "REVERSE", "Store Manager", "Recheck", manager);
    expect(await approvalTrail("Purchase Requisition", req.id)).toEqual([]);
    await expect(purchaseStore.updateRequisitionStatus(req.id, "APPROVE", "Finance Head", "", finance)).rejects.toThrow(/stage 1/);
  });
});
