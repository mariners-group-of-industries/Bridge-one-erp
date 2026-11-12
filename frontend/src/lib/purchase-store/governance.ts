import { AppError } from "@/lib/api/errors";
import { db } from "@/lib/prisma/client";
import type { Prisma } from "@/lib/prisma/client";
import {
  canApproveWithSummary,
  type ApprovalRightsSummary,
  type ApprovalStageRule,
} from "./rules";

type DbClient = ReturnType<typeof db> | Prisma.TransactionClient;

export interface PurchaseActor {
  id?: string;
  name?: string;
  isMaster?: boolean;
  via?: "session" | "token";
}

export interface PurchaseOrgScope {
  restricted: boolean;
  businessUnitIds: string[] | null;
  officeIds: string[] | null;
  warehouseIds: string[] | null;
}

const UNRESTRICTED_APPROVAL: ApprovalRightsSummary = { unrestricted: true, stages: [] };
const UNRESTRICTED_ORG_SCOPE: PurchaseOrgScope = {
  restricted: false,
  businessUnitIds: null,
  officeIds: null,
  warehouseIds: null,
};

async function loadPipeline(client: DbClient, features: string[]) {
  return client.approvalPipeline.findFirst({
    where: { feature: { in: features } },
    orderBy: { updatedAt: "desc" },
    include: {
      superApproverEmployee: { select: { userId: true } },
      stages: {
        orderBy: { stageNo: "asc" },
        include: { approvers: { include: { employee: { select: { userId: true } } } } },
      },
    },
  });
}

function buildSummaryFromPipeline(
  pipeline: Awaited<ReturnType<typeof loadPipeline>>,
  actor?: PurchaseActor,
): ApprovalRightsSummary {
  if (!actor?.id || actor.isMaster) return UNRESTRICTED_APPROVAL;
  if (!pipeline || pipeline.stages.length === 0) return UNRESTRICTED_APPROVAL;
  const superId = pipeline.superApproverUserId ?? pipeline.superApproverEmployee?.userId ?? null;
  if (superId && superId === actor.id) return UNRESTRICTED_APPROVAL;

  const stages: ApprovalStageRule[] = pipeline.stages.map((s) => {
    const resolved = s.approvers
      .map((a) => ({
        userId: a.userType === "EMPLOYEE" ? a.employee?.userId : a.userId,
        buId: a.businessUnitId ?? null,
      }))
      .filter((a): a is { userId: string; buId: string | null } => Boolean(a.userId));

    return {
      allowThreshold: s.allowThreshold,
      thresholdMin: s.thresholdMin !== null ? Number(s.thresholdMin) : null,
      thresholdMax: s.thresholdMax !== null ? Number(s.thresholdMax) : null,
      approverBuIds: resolved.map((a) => a.buId),
      actorBuIds: resolved.filter((a) => a.userId === actor.id).map((a) => a.buId),
    };
  });

  return { unrestricted: false, stages };
}

/** Summarizes the actor's approval eligibility under active Configuration › Approval Setup pipelines. */
export async function getApprovalRightsSummary(
  features: string[],
  actor?: PurchaseActor,
  client: DbClient = db(),
): Promise<ApprovalRightsSummary> {
  if (!actor?.id || actor.isMaster) return UNRESTRICTED_APPROVAL;
  const pipeline = await loadPipeline(client, features);
  return buildSummaryFromPipeline(pipeline, actor);
}

/** Enforces active Configuration › Approval Setup pipeline when configured for a Purchase feature. */
export async function assertApprovalPipeline(
  client: DbClient,
  features: string[],
  businessUnitId: string,
  amount: number,
  actor?: PurchaseActor,
) {
  if (!actor?.id || actor.isMaster) return;
  const pipeline = await loadPipeline(client, features);
  const summary = buildSummaryFromPipeline(pipeline, actor);
  if (!canApproveWithSummary(summary, businessUnitId, amount)) {
    throw new AppError(
      403,
      "FORBIDDEN",
      "You are not an authorized approver in the active approval pipeline for this document.",
    );
  }
}

/**
 * Resolves Employee › ERP Login & Access org restrictions for a signed-in session user.
 * When org access has never been configured on the user (no flags & no access rows), stays unrestricted
 * so seeded/test users with Permission Group access continue to work seamlessly.
 */
export async function resolvePurchaseOrgScope(
  actor?: PurchaseActor,
  client: DbClient = db(),
): Promise<PurchaseOrgScope> {
  if (!actor?.id || actor.isMaster || (actor.via && actor.via !== "session")) {
    return UNRESTRICTED_ORG_SCOPE;
  }

  const [user, bus, offices, warehouses] = await Promise.all([
    client.user.findUnique({
      where: { id: actor.id },
      select: { allBusinessUnits: true, allOffices: true, allWarehouses: true },
    }),
    client.userBusinessUnitAccess.findMany({ where: { userId: actor.id }, select: { businessUnitId: true } }),
    client.userOfficeAccess.findMany({ where: { userId: actor.id }, select: { officeId: true } }),
    client.userWarehouseAccess.findMany({ where: { userId: actor.id }, select: { warehouseId: true } }),
  ]);

  if (!user) return UNRESTRICTED_ORG_SCOPE;
  const hasAnyConfigured =
    user.allBusinessUnits ||
    user.allOffices ||
    user.allWarehouses ||
    bus.length > 0 ||
    offices.length > 0 ||
    warehouses.length > 0;

  if (!hasAnyConfigured) return UNRESTRICTED_ORG_SCOPE;

  return {
    restricted: true,
    businessUnitIds: user.allBusinessUnits ? null : bus.map((r) => r.businessUnitId),
    officeIds: user.allOffices ? null : offices.map((r) => r.officeId),
    warehouseIds: user.allWarehouses ? null : warehouses.map((r) => r.warehouseId),
  };
}

export function isPlaceInOrgScope(
  scope: PurchaseOrgScope,
  place: { businessUnitId?: string | null; officeId?: string | null; warehouseId?: string | null },
): boolean {
  if (!scope.restricted) return true;
  if (scope.businessUnitIds && place.businessUnitId && !scope.businessUnitIds.includes(place.businessUnitId)) {
    return false;
  }
  if (scope.officeIds && place.officeId && !scope.officeIds.includes(place.officeId)) {
    return false;
  }
  if (scope.warehouseIds && place.warehouseId && !scope.warehouseIds.includes(place.warehouseId)) {
    return false;
  }
  return true;
}

export async function assertPlaceInScope(
  actor: PurchaseActor | undefined,
  place: { businessUnitId?: string | null; officeId?: string | null; warehouseId?: string | null },
  client: DbClient = db(),
): Promise<void> {
  const scope = await resolvePurchaseOrgScope(actor, client);
  if (!isPlaceInOrgScope(scope, place)) {
    throw new AppError(
      403,
      "FORBIDDEN",
      "You do not have Configuration access to this business unit, office, or warehouse.",
    );
  }
}

