import { listQueue } from "@/features/production/entries/services/entry.service";
import { apiHandler, ok } from "@/lib/api/handler";

/** GET [?search]: approved / in-progress production orders with quantity left to produce. */
export const GET = apiHandler("production:read", async (request, _context, actor) =>
  ok(await listQueue(actor, Object.fromEntries(new URL(request.url).searchParams))),
);
