import { deleteMovement, getMovement } from "@/features/hrm/self-service/leave-movement/server/leave-movement.service";
import { apiHandler, noContent, ok, parseId } from "@/lib/api/handler";

type Context = { params: Promise<{ id: string }> };

/** One movement application with its approval stages: the applicant's own, or any for HR. */
export const GET = apiHandler("employees:read", async (_request, context: Context, actor) => ok(await getMovement(actor, parseId((await context.params).id, "Movement application"))));

/** Deletes a pending application (the applicant or HR). */
export const DELETE = apiHandler("employees:read", async (_request, context: Context, actor) => {
  await deleteMovement(actor, parseId((await context.params).id, "Movement application"));
  return noContent();
});
