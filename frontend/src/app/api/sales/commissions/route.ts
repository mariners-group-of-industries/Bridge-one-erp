import { createCommission, listCommissions } from "@/features/sales/targets/services/target.service";
import { apiHandler, ok } from "@/lib/api/handler";

/** Commission Setup: item commissions of the sales force. */
export const GET = apiHandler("sales:read", async (_request, _context, actor) => ok(await listCommissions(actor)));

export const POST = apiHandler("sales:write", async (request, _context, actor) => ok(await createCommission(actor, await request.json().catch(() => null)), 201));
