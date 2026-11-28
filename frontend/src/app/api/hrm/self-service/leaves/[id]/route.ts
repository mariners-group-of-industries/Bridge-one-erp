import { deleteLeave, getLeave } from "@/features/hrm/self-service/leave-movement/server/leave-movement.service";
import { apiHandler, noContent, ok, parseId } from "@/lib/api/handler";

type Context = { params: Promise<{ id: string }> };

/** One application with its approval stages: the applicant's own, or any for HR. */
export const GET = apiHandler("employees:read", async (_request, context: Context, actor) => ok(await getLeave(actor, parseId((await context.params).id, "Leave application"))));

/** Deletes a pending application (the applicant or HR). */
export const DELETE = apiHandler("employees:read", async (_request, context: Context, actor) => {
  await deleteLeave(actor, parseId((await context.params).id, "Leave application"));
  return noContent();
});
