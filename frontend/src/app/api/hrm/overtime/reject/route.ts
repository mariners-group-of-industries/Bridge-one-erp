import { decideEntries } from "@/features/hrm/overtime/server/overtime.service";
import { decisionInputSchema } from "@/features/hrm/overtime/types";
import { apiHandler, ok, parseJson } from "@/lib/api/handler";

/** POST { ids }: rejects the pending entries among them. */
export const POST = apiHandler("employees:read", async (request, _context, actor) => ok(await decideEntries(actor, await parseJson(request, decisionInputSchema), "Rejected")));
