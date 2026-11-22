import { cancelOwnLeave } from "@/features/ess/server/ess.service";
import { apiHandler, noContent, parseId } from "@/lib/api/handler";

type Context = { params: Promise<{ id: string }> };

/** Withdraws one of the employee's own pending applications. */
export const POST = apiHandler("employees:read", async (_request, context: Context, actor) => {
  await cancelOwnLeave(actor, parseId((await context.params).id, "Leave application"));
  return noContent();
});
