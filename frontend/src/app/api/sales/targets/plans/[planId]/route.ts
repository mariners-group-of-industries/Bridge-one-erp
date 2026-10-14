import { getPlan, updatePlan, deletePlan } from "@/features/sales/targets/services/target.service";
import { apiHandler, noContent, ok, parseId } from "@/lib/api/handler";

type Context = { params: Promise<{ planId: string }> };
const idOf = async (context: Context) => parseId((await context.params).planId, "Sales target");

export const GET = apiHandler<Context>("sales:read", async (_request, context, actor) => ok(await getPlan(actor, await idOf(context))));

/** PUT body: { version, data }. */
export const PUT = apiHandler<Context>("sales:write", async (request, context, actor) => ok(await updatePlan(actor, await idOf(context), await request.json().catch(() => null))));

export const DELETE = apiHandler<Context>("sales:write", async (_request, context, actor) => {
  await deletePlan(actor, await idOf(context));
  return noContent();
});
