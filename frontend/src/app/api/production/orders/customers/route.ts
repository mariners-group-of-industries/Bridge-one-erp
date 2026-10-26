import { searchCustomers } from "@/features/production/orders/services/order.service";
import { apiHandler, ok } from "@/lib/api/handler";

/** GET ?search=<3+ letters>: customers by name or code. */
export const GET = apiHandler("production:read", async (request, _context, actor) =>
  ok(await searchCustomers(actor, Object.fromEntries(new URL(request.url).searchParams))),
);
