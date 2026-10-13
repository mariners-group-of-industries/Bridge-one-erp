import { upsertEmploymentHistorySchema } from "@/features/configuration/entity-master-data/employee/schemas/employment-history.schema";
import { getEmploymentHistory, upsertEmploymentHistory } from "@/features/configuration/entity-master-data/employee/server/employment-history.service";
import { apiHandler, ok, parseId, parseJson } from "@/lib/api/handler";

type Ctx = { params: Promise<{ id: string }> };

export const GET = apiHandler("employees:read", async (_req, ctx: Ctx, actor) => {
  const { id } = await ctx.params;
  return ok(await getEmploymentHistory(parseId(id, "Employee"), actor));
});

export const PUT = apiHandler("employees:read", async (req, ctx: Ctx, actor) => {
  const { id } = await ctx.params;
  const input = await parseJson(req, upsertEmploymentHistorySchema);
  return ok(await upsertEmploymentHistory(parseId(id, "Employee"), actor, input));
});
