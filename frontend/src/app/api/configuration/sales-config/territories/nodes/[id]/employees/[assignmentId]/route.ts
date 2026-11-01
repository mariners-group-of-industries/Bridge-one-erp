import { removeAssignment, updateAssignment } from "@/features/configuration/sales-config/territory/server/territory.service";
import { apiHandler, ok, parseId } from "@/lib/api/handler";

type Context = { params: Promise<{ id: string; assignmentId: string }> };

export const PUT = apiHandler("configuration:write", async (request, context: Context, actor) => {
  const params = await context.params;
  return ok(await updateAssignment(actor, parseId(params.id, "Territory"), parseId(params.assignmentId, "Assignment"), await request.json().catch(() => null)));
});

export const DELETE = apiHandler("configuration:write", async (_request, context: Context, actor) => {
  const params = await context.params;
  return ok(await removeAssignment(actor, parseId(params.id, "Territory"), parseId(params.assignmentId, "Assignment")));
});
