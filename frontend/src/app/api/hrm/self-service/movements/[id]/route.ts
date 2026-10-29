import { deleteMovement } from "@/features/hrm/self-service/leave-movement/server/leave-movement.service";
import { apiHandler, noContent, parseId } from "@/lib/api/handler";

type Context = { params: Promise<{ id: string }> };

/** Deletes a pending application (the applicant or HR). */
export const DELETE = apiHandler("employees:read", async (_request, context: Context, actor) => {
  await deleteMovement(actor, parseId((await context.params).id, "Movement application"));
  return noContent();
});
