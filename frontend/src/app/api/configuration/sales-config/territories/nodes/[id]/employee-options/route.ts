import { employeeOptions } from "@/features/configuration/sales-config/territory/server/territory.service";
import { apiHandler, ok, parseId } from "@/lib/api/handler";

type Context = { params: Promise<{ id: string }> };

export const GET = apiHandler("configuration:read", async (_request, context: Context, actor) => {
  return ok(await employeeOptions(actor, parseId((await context.params).id, "Territory")));
});
