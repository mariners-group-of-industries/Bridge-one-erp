import { deleteAssignment } from "@/features/sales/targets/services/target.service";
import { apiHandler, noContent, parseId } from "@/lib/api/handler";

export const DELETE = apiHandler<{ params: Promise<{ assignmentId: string }> }>("sales:write", async (_request, context, actor) => {
  await deleteAssignment(actor, parseId((await context.params).assignmentId, "Assignment"));
  return noContent();
});
