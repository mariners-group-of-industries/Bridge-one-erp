import { createEntries, listEntries } from "@/features/hrm/overtime/server/overtime.service";
import { entryInputSchema, entryListQuerySchema } from "@/features/hrm/overtime/types";
import { apiHandler, ok, parseJson } from "@/lib/api/handler";

/** GET /api/hrm/overtime?from&to[&officeId][&status]: submitted overtime. */
export const GET = apiHandler("employees:read", async (request, _context, actor) =>
  ok(await listEntries(actor, entryListQuerySchema.parse(Object.fromEntries(new URL(request.url).searchParams)))),
);

/** POST: submit overtime days for approval. */
export const POST = apiHandler("employees:read", async (request, _context, actor) => ok(await createEntries(actor, await parseJson(request, entryInputSchema)), 201));
