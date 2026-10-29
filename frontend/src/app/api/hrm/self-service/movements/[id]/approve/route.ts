import { decideMovement } from "@/features/hrm/self-service/leave-movement/server/leave-movement.service";
import { apiHandler, noContent, parseId } from "@/lib/api/handler";

type Context = { params: Promise<{ id: string }> };

/** HR only. */
export const POST = apiHandler("employees:read", async (_request, context: Context, actor) => {
  await decideMovement(actor, parseId((await context.params).id, "Movement application"), "Approved");
  return noContent();
});
