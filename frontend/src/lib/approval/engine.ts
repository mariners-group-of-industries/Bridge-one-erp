import type { Prisma } from "@/generated/prisma/client";
import { AppError, conflict } from "@/lib/api/errors";
import type { Actor } from "@/lib/auth/actor";
import { db } from "@/lib/prisma/client";

/**
 * Multilayer approval engine, shared by every module.
 *
 * A document's approval stages are copied from its feature's pipeline
 * (Configuration › Approval Setup) the first time someone approves or rejects
 * it, keeping the pipeline as it was then. Each approve call clears the actor's
 * share of the current stage; the module only marks the document approved when
 * `recordApproval` returns `final: true` (the last stage is done).
 *
 * Without a pipeline (or with no stage applying to the amount) a document has a
 * single layer: whoever holds the page's Approve permission approves it, as before.
 *
 * Callers check the page permission first; the engine then decides whether the
 * actor is one of the current stage's approvers.
 */

type Tx = Prisma.TransactionClient;

export interface ApprovalTarget {
  /** Approval Setup feature name, e.g. "Purchase Requisition". */
  feature: string;
  documentId: string;
  /** Business unit of the document: approvers tied to another unit are left out. */
  businessUnitId?: string | null;
  /** Document amount, for stages with an amount threshold. Unknown = every stage applies. */
  amount?: number | null;
  comment?: string | null;
}

export interface ApprovalResult {
  /** True when the document is fully approved (or has no pipeline). */
  final: boolean;
  /** The stage the actor just acted on (null without a pipeline). */
  stage: { stageNo: number; name: string; done: boolean } | null;
  /** The stage now waiting, when not final. */
  next: { stageNo: number; name: string } | null;
  /** Total stages of the document (0 without a pipeline). */
  stages: number;
}

export interface ApprovalTrailStage {
  stageNo: number;
  name: string;
  approvalOrder: string;
  requiredCount: number;
  status: string;
  approverNames: string[];
  approvedNames: string[];
  actedBy: string | null;
  actedAt: string | null;
  comment: string | null;
}

const SINGLE_LAYER: ApprovalResult = { final: true, stage: null, next: null, stages: 0 };

interface StageRow {
  id: string;
  stageNo: number;
  stageName: string;
  approvalOrder: string;
  requiredCount: number;
  approverUserIds: string[];
  approvedUserIds: string[];
  superApproverUserId: string | null;
  status: string;
}

const num = (value: { toString(): string } | null | undefined) => (value === null || value === undefined ? null : Number(value.toString()));

/** Stages of the feature's pipeline that apply to this document (none without a pipeline). */
async function stagesFromPipeline(tx: Tx, target: ApprovalTarget) {
  const pipeline = await tx.approvalPipeline.findFirst({
    where: { feature: target.feature },
    orderBy: { updatedAt: "desc" },
    include: {
      superApproverEmployee: { select: { userId: true } },
      stages: {
        orderBy: { stageNo: "asc" },
        include: { approvers: { orderBy: { sortOrder: "asc" }, include: { employee: { select: { userId: true } } } } },
      },
    },
  });
  if (!pipeline) return [];
  const superApproverUserId = pipeline.superApproverUserId ?? pipeline.superApproverEmployee?.userId ?? null;
  const amount = target.amount ?? null;
  const applies = (stage: (typeof pipeline.stages)[number]) => {
    if (!stage.allowThreshold || amount === null) return true;
    const min = num(stage.thresholdMin) ?? 0;
    const max = num(stage.thresholdMax);
    return amount >= min && (max === null || amount <= max);
  };
  return pipeline.stages.filter(applies).map((stage, index) => {
    const ids = stage.approvers
      .filter((a) => !a.businessUnitId || !target.businessUnitId || a.businessUnitId === target.businessUnitId)
      .map((a) => (a.userType === "EMPLOYEE" ? a.employee?.userId : a.userId))
      .filter((id): id is string => !!id);
    const approverUserIds = [...new Set(ids)];
    return {
      feature: target.feature,
      documentId: target.documentId,
      businessUnitId: target.businessUnitId ?? null,
      stageNo: index + 1,
      stageName: stage.name,
      approvalOrder: stage.approvalOrder === "SEQUENTIAL" ? "SEQUENTIAL" : "ANY",
      requiredCount: approverUserIds.length ? Math.max(1, Math.min(stage.requiredCount, approverUserIds.length)) : 1,
      approverUserIds,
      superApproverUserId,
    };
  });
}

const STAGE_SELECT = {
  id: true,
  stageNo: true,
  stageName: true,
  approvalOrder: true,
  requiredCount: true,
  approverUserIds: true,
  approvedUserIds: true,
  superApproverUserId: true,
  status: true,
} as const;

/**
 * The document's stages, copying them from the pipeline on first use. A
 * document back in approval after a rejection starts a new round.
 */
async function ensureStages(tx: Tx, target: ApprovalTarget): Promise<StageRow[]> {
  const where = { feature: target.feature, documentId: target.documentId };
  let stages = await tx.documentApproval.findMany({ where, orderBy: { stageNo: "asc" }, select: STAGE_SELECT });
  if (stages.some((s) => s.status === "REJECTED")) {
    await tx.documentApproval.deleteMany({ where });
    stages = [];
  }
  if (stages.length > 0) return stages;
  const fresh = await stagesFromPipeline(tx, target);
  if (fresh.length === 0) return [];
  await tx.documentApproval.createMany({ data: fresh, skipDuplicates: true });
  return tx.documentApproval.findMany({ where, orderBy: { stageNo: "asc" }, select: STAGE_SELECT });
}

async function userNames(tx: Tx, ids: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids)].filter((id) => /^[0-9a-f-]{36}$/i.test(id));
  if (unique.length === 0) return new Map();
  const users = await tx.user.findMany({ where: { id: { in: unique } }, select: { id: true, name: true } });
  return new Map(users.map((u) => [u.id, u.name]));
}

/** Who may act on the stage now, or why the actor may not. */
async function checkTurn(tx: Tx, actor: Actor, stage: StageRow): Promise<{ superApprover: boolean }> {
  const superApprover = !!stage.superApproverUserId && actor.id === stage.superApproverUserId;
  if (superApprover || stage.approverUserIds.length === 0) return { superApprover };
  if (stage.approvedUserIds.includes(actor.id)) {
    throw new AppError(403, "FORBIDDEN", `You have already approved stage ${stage.stageNo} (${stage.stageName}); it is waiting for other approvers.`);
  }
  const waitingFor =
    stage.approvalOrder === "SEQUENTIAL" ? [stage.approverUserIds[stage.approvedUserIds.length]].filter(Boolean) : stage.approverUserIds.filter((id) => !stage.approvedUserIds.includes(id));
  if (waitingFor.includes(actor.id)) return { superApprover };
  const names = await userNames(tx, waitingFor);
  const who = waitingFor.map((id) => names.get(id) ?? "an approver").join(", ");
  throw new AppError(403, "FORBIDDEN", `This document is at stage ${stage.stageNo} (${stage.stageName}), waiting for ${who || "its approvers"}.`);
}

/**
 * Records the actor's approval of the document's current stage. Throws 403
 * when the actor is not an approver of that stage. `final` tells the caller to
 * mark the document approved.
 */
export async function recordApproval(tx: Tx, actor: Actor, target: ApprovalTarget): Promise<ApprovalResult> {
  const stages = await ensureStages(tx, target);
  if (stages.length === 0) return SINGLE_LAYER;
  const current = stages.find((s) => s.status === "PENDING");
  if (!current) return { final: true, stage: null, next: null, stages: stages.length };

  const { superApprover } = await checkTurn(tx, actor, current);
  const approvedUserIds = current.approvedUserIds.includes(actor.id) ? current.approvedUserIds : [...current.approvedUserIds, actor.id];
  const done = superApprover || current.approverUserIds.length === 0 || approvedUserIds.length >= current.requiredCount;
  const { count } = await tx.documentApproval.updateMany({
    where: { id: current.id, status: "PENDING", approvedUserIds: { equals: current.approvedUserIds } },
    data: { approvedUserIds, status: done ? "APPROVED" : "PENDING", actedBy: actor.id, comment: target.comment || null, actedAt: new Date() },
  });
  if (count === 0) throw conflict("Someone else acted on this approval at the same time. Reload and try again.");

  const later = stages.find((s) => s.stageNo > current.stageNo && s.status === "PENDING");
  const final = done && !later;
  const next = final ? null : done ? later! : current;
  return {
    final,
    stage: { stageNo: current.stageNo, name: current.stageName, done },
    next: next ? { stageNo: next.stageNo, name: next.stageName } : null,
    stages: stages.length,
  };
}

/**
 * Records a rejection at the document's current stage. Throws 403 when the
 * actor is not an approver of that stage. Without a pipeline it does nothing
 * (the caller's page permission decides).
 */
export async function recordRejection(tx: Tx, actor: Actor, target: ApprovalTarget): Promise<void> {
  const stages = await ensureStages(tx, target);
  const current = stages.find((s) => s.status === "PENDING");
  if (!current) return;
  await checkTurn(tx, actor, current);
  await tx.documentApproval.update({
    where: { id: current.id },
    data: { status: "REJECTED", actedBy: actor.id, comment: target.comment || null, actedAt: new Date() },
  });
  // Later stages will never be reached in this round.
  await tx.documentApproval.updateMany({
    where: { feature: target.feature, documentId: target.documentId, stageNo: { gt: current.stageNo }, status: "PENDING" },
    data: { status: "SKIPPED" },
  });
}

/**
 * For documents with a plain approve / reject decision: records it in the
 * pipeline and runs `apply` (which writes the module's status) only when the
 * decision is final: a rejection, or the last stage's approval. Returns the
 * approval result (null for a rejection).
 */
export async function decideWithPipeline(
  actor: Actor,
  target: ApprovalTarget,
  decision: "approve" | "reject",
  apply: (tx: Tx) => Promise<void>,
): Promise<ApprovalResult | null> {
  return db().$transaction(async (tx) => {
    if (decision === "reject") {
      await recordRejection(tx, actor, target);
      await apply(tx);
      return null;
    }
    const result = await recordApproval(tx, actor, target);
    if (result.final) await apply(tx);
    return result;
  });
}

/** Business unit of an employee's office, for approvers tied to a unit. */
export async function employeeBusinessUnit(employeeId: string): Promise<string | null> {
  const employee = await db().employee.findUnique({ where: { id: employeeId }, select: { office: { select: { businessUnitId: true } } } });
  return employee?.office.businessUnitId ?? null;
}

/** Approves several documents of one feature; returns the ids that became fully approved. */
export async function recordApprovals(tx: Tx, actor: Actor, targets: ApprovalTarget[]): Promise<Set<string>> {
  const final = new Set<string>();
  for (const target of targets) if ((await recordApproval(tx, actor, target)).final) final.add(target.documentId);
  return final;
}

/** Drops the document's approval progress (e.g. after it is edited), so approval starts over. */
export async function resetApproval(tx: Tx, feature: string, documentId: string): Promise<void> {
  await tx.documentApproval.deleteMany({ where: { feature, documentId } });
}

/** One-line note for audit logs: "Stage 1 (Manager) approved; waiting for stage 2 (Finance)." */
export function approvalNote(result: ApprovalResult): string | null {
  if (!result.stage) return null;
  const at = `Stage ${result.stage.stageNo} (${result.stage.name})`;
  if (result.final) return `${at} approved; all ${result.stages} stages done.`;
  if (!result.stage.done) return `${at}: approval recorded, more approvers needed.`;
  return result.next ? `${at} approved; waiting for stage ${result.next.stageNo} (${result.next.name}).` : `${at} approved.`;
}

/** The document's stages with approver names, for detail views and the Multilayer Approval page. */
export async function approvalTrail(feature: string, documentId: string): Promise<ApprovalTrailStage[]> {
  const client = db();
  const stages = await client.documentApproval.findMany({ where: { feature, documentId }, orderBy: { stageNo: "asc" } });
  const names = await userNames(
    client as unknown as Tx,
    stages.flatMap((s) => [...s.approverUserIds, ...s.approvedUserIds, ...(s.actedBy ? [s.actedBy] : [])]),
  );
  const name = (id: string) => names.get(id) ?? id;
  return stages.map((s) => ({
    stageNo: s.stageNo,
    name: s.stageName,
    approvalOrder: s.approvalOrder,
    requiredCount: s.requiredCount,
    status: s.status,
    approverNames: s.approverUserIds.map(name),
    approvedNames: s.approvedUserIds.map(name),
    actedBy: s.actedBy ? name(s.actedBy) : null,
    actedAt: s.actedAt?.toISOString() ?? null,
    comment: s.comment,
  }));
}
