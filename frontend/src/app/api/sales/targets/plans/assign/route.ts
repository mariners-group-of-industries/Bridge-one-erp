import { assignPlan } from "@/features/sales/targets/services/target.service";
import { apiHandler, ok } from "@/lib/api/handler";

/** POST body: { planId, rows: [{ salesPersonId, customerGroupId, targetAmount, commissionBasis, commissionRate, minimumCollection }] }. */
export const POST = apiHandler("sales:write", async (request, _context, actor) => ok(await assignPlan(actor, await request.json().catch(() => null))));
