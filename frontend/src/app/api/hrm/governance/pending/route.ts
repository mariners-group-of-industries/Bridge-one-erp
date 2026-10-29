import { pendingApprovals } from "@/features/hrm/governance/server/governance.service";
import { PENDING_KINDS, type PendingKind } from "@/features/hrm/governance/types";
import { notFound } from "@/lib/api/errors";
import { apiHandler, ok } from "@/lib/api/handler";

/** ?kind = leave | movement | bonus | increment */
export const GET = apiHandler("employees:read", async (request, _context, actor) => {
  const kind = new URL(request.url).searchParams.get("kind") ?? "";
  if (!PENDING_KINDS.some((k) => k.id === kind)) throw notFound("Approval type");
  return ok(await pendingApprovals(actor, kind as PendingKind));
});
