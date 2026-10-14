import { customerListQuerySchema, type CustomerInput } from "@/features/configuration/entity-master-data/customer/schemas/customer.schema";
import { createCustomer, listCustomers } from "@/features/configuration/entity-master-data/customer/server/customer.service";
import { badRequest } from "@/lib/api/errors";
import { apiHandler, ok } from "@/lib/api/handler";

export const GET = apiHandler("configuration:read", async (request, _context, actor) => {
  const query = customerListQuerySchema.parse(Object.fromEntries(new URL(request.url).searchParams));
  return ok(await listCustomers(actor, query));
});

export const POST = apiHandler("configuration:write", async (request, _context, actor) => {
  const body = (await request.json().catch(() => {
    throw badRequest("Request body must be valid JSON.");
  })) as CustomerInput;
  // The service validates the body with the shared schema.
  return ok(await createCustomer(actor, body), 201);
});
