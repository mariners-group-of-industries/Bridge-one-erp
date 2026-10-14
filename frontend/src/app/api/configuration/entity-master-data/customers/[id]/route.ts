import type { CustomerInput } from "@/features/configuration/entity-master-data/customer/schemas/customer.schema";
import { getCustomer, updateCustomer } from "@/features/configuration/entity-master-data/customer/server/customer.service";
import { badRequest } from "@/lib/api/errors";
import { apiHandler, ok, parseId } from "@/lib/api/handler";

type Context = { params: Promise<{ id: string }> };

export const GET = apiHandler("configuration:read", async (_request, context: Context, actor) => {
  const id = parseId((await context.params).id, "Customer");
  return ok(await getCustomer(actor, id));
});

export const PUT = apiHandler("configuration:write", async (request, context: Context, actor) => {
  const id = parseId((await context.params).id, "Customer");
  const body = (await request.json().catch(() => {
    throw badRequest("Request body must be valid JSON.");
  })) as CustomerInput;
  return ok(await updateCustomer(actor, id, body));
});
