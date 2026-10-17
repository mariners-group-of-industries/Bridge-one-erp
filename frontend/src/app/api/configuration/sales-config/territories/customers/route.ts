import { customerListQuerySchema } from "@/features/configuration/sales-config/territory/schemas/territory.schema";
import { territoryCustomers } from "@/features/configuration/sales-config/territory/server/territory.service";
import { apiHandler, ok } from "@/lib/api/handler";

/** Territory wise customer list (?businessUnitId&nodeId&customerId&search&page&pageSize). */
export const GET = apiHandler("configuration:read", async (request, _context, actor) => {
  const query = customerListQuerySchema.parse(Object.fromEntries(new URL(request.url).searchParams));
  return ok(await territoryCustomers(actor, query));
});
