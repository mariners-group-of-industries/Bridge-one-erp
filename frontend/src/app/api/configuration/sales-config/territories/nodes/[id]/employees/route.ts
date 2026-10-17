import { assignEmployeeSchema } from "@/features/configuration/sales-config/territory/schemas/territory.schema";
import { assignEmployee, listAssignments } from "@/features/configuration/sales-config/territory/server/territory.service";
import { apiHandler, ok, parseId, parseJson } from "@/lib/api/handler";

type Context = { params: Promise<{ id: string }> };

export const GET = apiHandler("configuration:read", async (_request, context: Context, actor) => {
  return ok(await listAssignments(actor, parseId((await context.params).id, "Territory")));
});

export const POST = apiHandler("configuration:write", async (request, context: Context, actor) => {
  const id = parseId((await context.params).id, "Territory");
  return ok(await assignEmployee(actor, id, await parseJson(request, assignEmployeeSchema)), 201);
});
