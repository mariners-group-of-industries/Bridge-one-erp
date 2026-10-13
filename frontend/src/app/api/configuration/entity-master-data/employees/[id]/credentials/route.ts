import { updateCredentialsSchema } from "@/features/configuration/entity-master-data/employee/schemas/personal-info.schema";
import { getCredentials, updateCredentials } from "@/features/configuration/entity-master-data/employee/server/personal-info.service";
import { apiHandler, ok, parseId, parseJson } from "@/lib/api/handler";

type Ctx = { params: Promise<{ id: string }> };

export const GET = apiHandler("employees:read", async (_req, ctx: Ctx, actor) => {
  const { id } = await ctx.params;
  return ok(await getCredentials(parseId(id, "Employee"), actor));
});

export const PATCH = apiHandler("employees:read", async (req, ctx: Ctx, actor) => {
  const { id } = await ctx.params;
  const input = await parseJson(req, updateCredentialsSchema);
  return ok(await updateCredentials(parseId(id, "Employee"), actor, input));
});
