import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma/client", async () => {
  const { testPrisma } = await import("./helpers/test-db");
  return { db: testPrisma };
});
import { createBusinessUnit } from "@/features/configuration/business-config/company-profile/server/business-unit.service";
import { saveCompany } from "@/features/configuration/business-config/company-profile/server/company.service";
import type { PipelineInput } from "@/features/configuration/security/approval/schemas/approval.schema";
import { createPipeline } from "@/features/configuration/security/approval/server/approval.service";
import { approvalTrail, decideWithPipeline, recordApproval, recordRejection } from "@/lib/approval/engine";
import { AppError } from "@/lib/api/errors";
import type { Actor } from "@/lib/auth/actor";
import { adminActor, businessUnitInput, companyInput } from "./helpers/fixtures";
import { resetTestDb, startTestDb, stopTestDb, testPrisma } from "./helpers/test-db";

const FEATURE = "Purchase Requisition";
let unitId: string;
let superId: string;
let managerId: string;
let financeA: string;
let financeB: string;

const as = (id: string): Actor => ({ ...adminActor, id, isMaster: false });
const approver = (approverId: string) => ({ userType: "USER" as const, businessUnitId: "", approverId, authorizationType: "APPROVAL" as const });
const pipeline = (changes: Partial<PipelineInput> = {}): PipelineInput => ({
  name: "PR approval",
  feature: FEATURE,
  userType: "USER",
  superApproverId: superId,
  remarks: "",
  stages: [
    { name: "Manager", approvalOrder: "ANY", requiredCount: 1, approvers: [approver(managerId)] },
    { name: "Finance", approvalOrder: "ANY", requiredCount: 2, approvers: [approver(financeA), approver(financeB)] },
  ],
  ...changes,
});
const approve = (actor: Actor, documentId = "doc-1", amount?: number) => testPrisma().$transaction((tx) => recordApproval(tx, actor, { feature: FEATURE, documentId, businessUnitId: unitId, amount }));

beforeAll(async () => {
  await startTestDb();
});
afterAll(async () => {
  await stopTestDb();
});
beforeEach(async () => {
  await resetTestDb();
  await saveCompany(adminActor, companyInput);
  unitId = (await createBusinessUnit(adminActor, businessUnitInput)).id;
  const user = async (name: string, phone: string) => (await testPrisma().user.create({ data: { name, phone, passwordHash: "x" } })).id;
  superId = await user("Super", "01700000001");
  managerId = await user("Manager", "01700000002");
  financeA = await user("Finance A", "01700000003");
  financeB = await user("Finance B", "01700000004");
});

describe("multilayer approval engine", () => {
  it("is single-layer without a pipeline", async () => {
    expect(await approve(as(managerId))).toMatchObject({ final: true, stages: 0 });
  });

  it("walks the stages in order and is final only after the last one", async () => {
    await createPipeline(adminActor, pipeline());
    // Finance cannot act before the manager stage is done.
    await expect(approve(as(financeA))).rejects.toThrow(/stage 1 \(Manager\).*Manager/);
    expect(await approve(as(managerId))).toMatchObject({ final: false, stage: { stageNo: 1, done: true }, next: { stageNo: 2, name: "Finance" } });
    // Stage 2 needs two of its approvers.
    expect(await approve(as(financeA))).toMatchObject({ final: false, stage: { stageNo: 2, done: false } });
    await expect(approve(as(financeA))).rejects.toBeInstanceOf(AppError);
    expect(await approve(as(financeB))).toMatchObject({ final: true, stage: { stageNo: 2, done: true } });

    const trail = await approvalTrail(FEATURE, "doc-1");
    expect(trail.map((s) => [s.name, s.status, s.approvedNames])).toEqual([
      ["Manager", "APPROVED", ["Manager"]],
      ["Finance", "APPROVED", ["Finance A", "Finance B"]],
    ]);
  });

  it("lets the super approver clear a stage and enforces sequential order", async () => {
    await createPipeline(adminActor, pipeline({ stages: [{ name: "Seq", approvalOrder: "SEQUENTIAL", requiredCount: 2, approvers: [approver(financeA), approver(financeB)] }] }));
    await expect(approve(as(financeB))).rejects.toThrow(/Finance A/);
    expect(await approve(as(financeA))).toMatchObject({ final: false });
    expect(await approve(as(superId), "doc-2")).toMatchObject({ final: true });
  });

  it("skips stages outside the amount threshold", async () => {
    await createPipeline(
      adminActor,
      pipeline({
        stages: [
          { name: "Manager", approvalOrder: "ANY", requiredCount: 1, approvers: [approver(managerId)] },
          { name: "Board", approvalOrder: "ANY", requiredCount: 1, approvers: [approver(financeA)], allowThreshold: true, thresholdMin: "100000", thresholdMax: "" },
        ] as PipelineInput["stages"],
      }),
    );
    expect(await approve(as(managerId), "small", 5000)).toMatchObject({ final: true, stages: 1 });
    expect(await approve(as(managerId), "large", 250000)).toMatchObject({ final: false, next: { name: "Board" } });
  });

  it("rejects at the current stage and starts a new round on resubmission", async () => {
    await createPipeline(adminActor, pipeline());
    await approve(as(managerId));
    await expect(testPrisma().$transaction((tx) => recordRejection(tx, as(managerId), { feature: FEATURE, documentId: "doc-1" }))).rejects.toBeInstanceOf(AppError);
    await testPrisma().$transaction((tx) => recordRejection(tx, as(financeA), { feature: FEATURE, documentId: "doc-1" }));
    expect((await approvalTrail(FEATURE, "doc-1")).map((s) => s.status)).toEqual(["APPROVED", "REJECTED"]);
    // Back in approval: stage 1 again.
    expect(await approve(as(managerId))).toMatchObject({ final: false, stage: { stageNo: 1 } });
  });

  it("decideWithPipeline applies the module's decision only when final", async () => {
    await createPipeline(adminActor, pipeline({ stages: [pipeline().stages[0]] }));
    let applied = 0;
    const apply = async () => {
      applied += 1;
    };
    await decideWithPipeline(as(managerId), { feature: FEATURE, documentId: "d" }, "approve", apply);
    expect(applied).toBe(1);
    await expect(decideWithPipeline(as(financeA), { feature: FEATURE, documentId: "e" }, "approve", apply)).rejects.toBeInstanceOf(AppError);
    expect(applied).toBe(1);
  });
});

