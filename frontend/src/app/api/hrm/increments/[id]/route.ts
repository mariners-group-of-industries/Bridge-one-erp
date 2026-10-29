import { deleteIncrement } from "@/features/hrm/compensation/server/compensation.service";
import { apiHandler, noContent, parseId } from "@/lib/api/handler";

type Context = { params: Promise<{ id: string }> };

/** Pending only. */
export const DELETE = apiHandler("employees:read", async (_request, context: Context, actor) => {
  await deleteIncrement(actor, parseId((await context.params).id, "Increment"));
  return noContent();
});
