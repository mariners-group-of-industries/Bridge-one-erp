import { z } from "zod";
import { markNotificationsRead } from "@/features/ess/server/ess.service";
import { apiHandler, ok, parseJson } from "@/lib/api/handler";

const Body = z.object({ id: z.uuid().optional() });

/** { id } marks one notification read; {} marks all. */
export const POST = apiHandler("employees:read", async (request, _context, actor) => ok(await markNotificationsRead(actor, (await parseJson(request, Body)).id)));
