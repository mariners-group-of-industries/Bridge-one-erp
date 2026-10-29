import { decidePending } from "@/features/hrm/governance/server/governance.service";
import { PENDING_KINDS, type PendingKind } from "@/features/hrm/governance/types";
import { notFound } from "@/lib/api/errors";
import { apiHandler, noContent, parseId } from "@/lib/api/handler";

type Context = { params: Promise<{ kind: string; id: string; decision: string }> };

/** POST …/{kind}/{id}/approve | reject */
export const POST = apiHandler("employees:read", async (_request, context: Context, actor) => {
  const { kind, id, decision } = await context.params;
  if (!PENDING_KINDS.some((k) => k.id === kind) || !["approve", "reject"].includes(decision)) throw notFound("Approval");
  await decidePending(actor, kind as PendingKind, parseId(id, "Application"), decision === "approve" ? "Approved" : "Rejected");
  return noContent();
});
