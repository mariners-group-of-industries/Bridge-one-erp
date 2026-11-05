import { createCounter, listCounters } from "@/features/pos/server/pos.service";
import { apiHandler, ok } from "@/lib/api/handler";

/** GET: all counters. POST: add a counter (it sells from one warehouse). */
export const GET = apiHandler("sales:read", async (_request, _context, actor) => ok(await listCounters(actor)));
export const POST = apiHandler("sales:write", async (request, _context, actor) => ok(await createCounter(actor, await request.json().catch(() => ({}))), 201));
