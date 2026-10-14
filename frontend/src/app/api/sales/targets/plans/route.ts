import { createPlan, listPlans } from "@/features/sales/targets/services/target.service";
import { apiHandler, ok } from "@/lib/api/handler";

/** Sales Target tab: named targets for a period. */
export const GET = apiHandler("sales:read", async (request, _context, actor) => ok(await listPlans(actor, Object.fromEntries(new URL(request.url).searchParams))));

export const POST = apiHandler("sales:write", async (request, _context, actor) => ok(await createPlan(actor, await request.json().catch(() => null)), 201));
