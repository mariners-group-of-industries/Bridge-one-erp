import { upsertSalarySchema } from "@/features/configuration/entity-master-data/employee/schemas/salary.schema";
import { getSalary, upsertSalary } from "@/features/configuration/entity-master-data/employee/server/salary.service";
import { apiHandler, ok, parseId, parseJson } from "@/lib/api/handler";

type Ctx = { params: Promise<{ id: string }> };

export const GET = apiHandler("employees:read", async (_req, ctx: Ctx, actor) => {
  const { id } = await ctx.params;
  return ok(await getSalary(parseId(id, "Employee"), actor));
});

export const PUT = apiHandler("employees:read", async (req, ctx: Ctx, actor) => {
  const { id } = await ctx.params;
  const input = await parseJson(req, upsertSalarySchema);
  return ok(await upsertSalary(parseId(id, "Employee"), actor, input));
});
