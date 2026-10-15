import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma/client", async () => {
  const { testPrisma } = await import("./helpers/test-db");
  return { db: testPrisma };
});
import { createBusinessUnit } from "@/features/configuration/business-config/company-profile/server/business-unit.service";
import { saveCompany } from "@/features/configuration/business-config/company-profile/server/company.service";
import { createOffice } from "@/features/configuration/business-config/company-profile/server/office.service";
import type { PipelineInput } from "@/features/configuration/security/approval/schemas/approval.schema";
import { createPipeline, deletePipeline, deleteStage, getApprovalFormOptions, getPipeline, listPipelines, updatePipeline } from "@/features/configuration/security/approval/server/approval.service";
import { AppError } from "@/lib/api/errors";
import { adminActor, businessUnitInput, companyInput, officeInput, scopedActor } from "./helpers/fixtures";
import { resetTestDb, startTestDb, stopTestDb, testPrisma } from "./helpers/test-db";

let unitId: string;
let superId: string;
let helalId: string;
let alAminId: string;
let employeeId: string;

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
  const officeId = (await createOffice(adminActor, unitId, officeInput)).id;
  const user = async (name: string, phone: string) => (await testPrisma().user.create({ data: { name, phone, passwordHash: "x" } })).id;
  superId = await user("Md. Usuf Ali", "01700000001");
  helalId = await user("MD. Helal Uddin", "01700000002");
  alAminId = await user("MD. AL AMIN HAQUE", "01700000003");
  await testPrisma().userBusinessUnitAccess.create({ data: { userId: helalId, businessUnitId: unitId } });
  employeeId = (await testPrisma().employee.create({ data: { officeId, employeeCode: "E-1", name: "Rahim", joiningDate: new Date("2024-01-01") } })).id;
});

const approver = (approverId: string, userType: "USER" | "EMPLOYEE" = "USER") => ({ userType, businessUnitId: "", approverId, authorizationType: "APPROVAL" as const });
const input = (changes: Partial<PipelineInput> = {}): PipelineInput => ({
  name: "Purchase Requisition",
  feature: "Purchase Requisition",
  userType: "USER",
  superApproverId: superId,
  remarks: "",
  stages: [{ name: "Purchase Requisition", approvalOrder: "ANY", requiredCount: 1, approvers: [approver(helalId), approver(alAminId)] }],
  ...changes,
});

describe("approval setup", () => {
  it("creates a pipeline with stages and lists it", async () => {
    const created = await createPipeline(adminActor, input());
    expect(created).toMatchObject({
      superApproverName: "Md. Usuf Ali",
      stages: [{ stageNo: 1, requiredCount: 1, approvers: [{ approverName: "MD. Helal Uddin" }, { approverName: "MD. AL AMIN HAQUE" }] }],
    });
    expect((await listPipelines(adminActor, { search: "usuf" })).rows).toEqual([expect.objectContaining({ name: "Purchase Requisition", feature: "Purchase Requisition", stageCount: 1 })]);
    await expect(createPipeline(adminActor, input())).rejects.toBeInstanceOf(AppError);
  });

  it("validates stages: approvers, person count, duplicates and business units", async () => {
    const stage = (changes: object) => input({ name: "X", stages: [{ name: "S", approvalOrder: "ANY", requiredCount: 1, approvers: [approver(helalId)], ...changes }] });
    await expect(createPipeline(adminActor, stage({ approvers: [] }))).rejects.toThrow();
    await expect(createPipeline(adminActor, stage({ requiredCount: 2 }))).rejects.toThrow();
    await expect(createPipeline(adminActor, stage({ approvers: [approver(helalId), approver(helalId)] }))).rejects.toThrow();
    await expect(createPipeline(adminActor, input({ name: "X", stages: [] }))).rejects.toThrow();
    // An employee approver must belong to the chosen business unit.
    const otherUnit = (await createBusinessUnit(adminActor, { ...businessUnitInput, name: "Second Unit" })).id;
    await expect(createPipeline(adminActor, stage({ approvers: [{ ...approver(employeeId, "EMPLOYEE"), businessUnitId: otherUnit }] }))).rejects.toBeInstanceOf(AppError);
    expect((await createPipeline(adminActor, stage({ approvers: [{ ...approver(employeeId, "EMPLOYEE"), businessUnitId: unitId }] }))).stages[0].approvers[0].approverName).toBe("Rahim");
  });

  it("updates in place: keeps saved stages, adds new ones and renumbers", async () => {
    const created = await createPipeline(adminActor, input());
    const first = created.stages[0];
    const updated = await updatePipeline(
      adminActor,
      created.id,
      input({
        remarks: "Two stages",
        stages: [
          { name: "Checked", approvalOrder: "SEQUENTIAL", requiredCount: 1, approvers: [approver(alAminId)] },
          { id: first.id, name: "Final", approvalOrder: "ANY", requiredCount: 2, approvers: [approver(helalId), approver(alAminId)] },
        ],
      }),
    );
    expect(updated.stages.map((s) => [s.stageNo, s.name])).toEqual([
      [1, "Checked"],
      [2, "Final"],
    ]);
    expect(updated.stages[1].id).toBe(first.id);
    expect(updated.remarks).toBe("Two stages");
  });

  it("deletes a stage (never the last one) and the whole pipeline", async () => {
    const created = await createPipeline(
      adminActor,
      input({
        stages: [
          { name: "One", approvalOrder: "ANY", requiredCount: 1, approvers: [approver(helalId)] },
          { name: "Two", approvalOrder: "ANY", requiredCount: 1, approvers: [approver(alAminId)] },
        ],
      }),
    );
    const after = await deleteStage(adminActor, created.id, created.stages[0].id);
    expect(after.stages.map((s) => [s.stageNo, s.name])).toEqual([[1, "Two"]]);
    await expect(deleteStage(adminActor, created.id, after.stages[0].id)).rejects.toBeInstanceOf(AppError);
    await deletePipeline(adminActor, created.id);
    await expect(getPipeline(adminActor, created.id)).rejects.toBeInstanceOf(AppError);
    expect(await testPrisma().approvalStageApprover.count()).toBe(0);
  });

  it("offers only names (no contact details) and respects company scope", async () => {
    const options = await getApprovalFormOptions(adminActor);
    expect(options.users.find((u) => u.id === helalId)).toEqual({ id: helalId, name: "MD. Helal Uddin", businessUnitIds: [unitId] });
    expect(Object.keys(options.employees[0]).sort()).toEqual(["businessUnitId", "code", "designation", "id", "name"]);
    const outsider = scopedActor([]);
    expect((await getApprovalFormOptions(outsider)).employees).toEqual([]);
    await expect(createPipeline(outsider, input({ name: "Y" }))).rejects.toBeInstanceOf(AppError);
  });
});
