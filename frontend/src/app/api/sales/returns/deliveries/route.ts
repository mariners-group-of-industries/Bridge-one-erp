import { listReturnableDeliveries } from "@/features/sales/returns/services/return.service";
import { apiHandler, ok } from "@/lib/api/handler";

/** GET /api/sales/returns/deliveries[?officeId&customerId&from&to]: deliveries with their returned quantity. */
export const GET = apiHandler("sales:read", async (request, _context, actor) =>
  ok(await listReturnableDeliveries(actor, Object.fromEntries(new URL(request.url).searchParams))),
);
