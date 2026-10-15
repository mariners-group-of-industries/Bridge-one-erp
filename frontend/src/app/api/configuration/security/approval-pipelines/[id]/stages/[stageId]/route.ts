import { deleteStage } from "@/features/configuration/security/approval/server/approval.service";
import { apiHandler, ok, parseId } from "@/lib/api/handler";

type Context = { params: Promise<{ id: string; stageId: string }> };

/** Deletes one stage; the remaining stages are renumbered. Returns the updated pipeline. */
export const DELETE = apiHandler("configuration:write", async (_request, context: Context, actor) => {
  const params = await context.params;
  return ok(await deleteStage(actor, parseId(params.id, "Approval pipeline"), parseId(params.stageId, "Stage")));
});
