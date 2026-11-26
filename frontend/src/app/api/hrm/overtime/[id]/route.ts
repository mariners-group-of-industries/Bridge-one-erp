import { deleteEntry } from "@/features/hrm/overtime/server/overtime.service";
import { apiHandler, noContent, parseId } from "@/lib/api/handler";

type Context = { params: Promise<{ id: string }> };

/** DELETE: removes a pending entry. */
export const DELETE = apiHandler("employees:read", async (_request, context: Context, actor) => {
  await deleteEntry(actor, parseId((await context.params).id, "Overtime entry"));
  return noContent();
});
