import { decideIncrement } from "@/features/hrm/compensation/server/compensation.service";
import { apiHandler, noContent, parseId } from "@/lib/api/handler";

type Context = { params: Promise<{ id: string }> };

export const POST = apiHandler("employees:read", async (_request, context: Context, actor) => {
  await decideIncrement(actor, parseId((await context.params).id, "Increment"), "Rejected");
  return noContent();
});
