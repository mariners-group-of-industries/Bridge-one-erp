import { createSale, listCounters } from "@/features/pos/server/pos.service";
import { apiHandler, ok } from "@/lib/api/handler";

/** GET: the active counters the terminal can sell from. */
export const GET = apiHandler("sales:read", async (_request, _context, actor) => ok((await listCounters(actor)).filter((c) => c.isActive)));

/** POST: complete a counter sale (stock leaves the counter's warehouse). */
export const POST = apiHandler("sales:write", async (request, _context, actor) => ok(await createSale(actor, await request.json().catch(() => ({}))), 201));
