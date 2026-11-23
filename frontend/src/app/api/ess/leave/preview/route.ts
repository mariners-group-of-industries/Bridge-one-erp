import { previewLeave } from "@/features/ess/server/ess.service";
import { apiHandler, ok } from "@/lib/api/handler";

/** { leaveType, fromDate, toDate } → the days it would charge and any problems. Changes nothing. */
export const POST = apiHandler("employees:read", async (request, _context, actor) => ok(await previewLeave(actor, await request.json().catch(() => ({})))));
