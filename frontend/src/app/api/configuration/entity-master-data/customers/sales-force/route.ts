import { customerFilterSchema } from "@/features/configuration/entity-master-data/customer/schemas/customer.schema";
import { listCustomersBySalesForce } from "@/features/configuration/entity-master-data/customer/server/customer.service";
import { apiHandler, ok } from "@/lib/api/handler";

/** "Sales force wise customer details" tab: customers grouped by default sales representative. */
export const GET = apiHandler("configuration:read", async (request, _context, actor) => {
  const filters = customerFilterSchema.parse(Object.fromEntries(new URL(request.url).searchParams));
  return ok(await listCustomersBySalesForce(actor, filters));
});
