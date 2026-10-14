import { upsertAcademicsSchema } from "@/features/configuration/entity-master-data/employee/schemas/academic.schema";
import { getAcademics, upsertAcademics } from "@/features/configuration/entity-master-data/employee/server/academic.service";
import { apiHandler, ok, parseId, parseJson } from "@/lib/api/handler";

type Ctx = { params: Promise<{ id: string }> };

export const GET = apiHandler("employees:read", async (_req, ctx: Ctx, actor) => {
  const { id } = await ctx.params;
  return ok(await getAcademics(parseId(id, "Employee"), actor));
});

export const PUT = apiHandler("employees:read", async (req, ctx: Ctx, actor) => {
  const { id } = await ctx.params;
  const input = await parseJson(req, upsertAcademicsSchema);
  return ok(await upsertAcademics(parseId(id, "Employee"), actor, input));
});
