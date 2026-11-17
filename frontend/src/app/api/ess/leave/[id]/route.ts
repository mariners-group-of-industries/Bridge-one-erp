import { myLeaveDetail } from "@/features/ess/server/ess.service";
import { apiHandler, ok, parseId } from "@/lib/api/handler";

type Context = { params: Promise<{ id: string }> };

/** One of the employee's own applications with its approval trail. */
export const GET = apiHandler("employees:read", async (_request, context: Context, actor) => ok(await myLeaveDetail(actor, parseId((await context.params).id, "Leave application"))));
