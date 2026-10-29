import { createBudget, listBudgets } from "@/features/sales/targets/services/target.service";
import { apiHandler, ok } from "@/lib/api/handler";

/** Target tab: yearly monthly targets of the sales force. */
export const GET = apiHandler("sales:read", async (_request, _context, actor) => ok(await listBudgets(actor)));

export const POST = apiHandler("sales:write", async (request, _context, actor) => ok(await createBudget(actor, await request.json().catch(() => null)), 201));
