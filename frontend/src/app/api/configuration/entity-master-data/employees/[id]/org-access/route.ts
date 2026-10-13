import { updateOrgAccessSchema } from "@/features/configuration/entity-master-data/employee/schemas/personal-info.schema";
import { getOrgAccess, updateOrgAccess } from "@/features/configuration/entity-master-data/employee/server/personal-info.service";
import { apiHandler, ok, parseId, parseJson } from "@/lib/api/handler";

type Ctx = { params: Promise<{ id: string }> };

export const GET = apiHandler("employees:read", async (_req, ctx: Ctx, actor) => {
  const { id } = await ctx.params;
  return ok(await getOrgAccess(parseId(id, "Employee"), actor));
});

export const PUT = apiHandler("employees:read", async (req, ctx: Ctx, actor) => {
  const { id } = await ctx.params;
  const input = await parseJson(req, updateOrgAccessSchema);
  return ok(await updateOrgAccess(parseId(id, "Employee"), actor, input));
});
