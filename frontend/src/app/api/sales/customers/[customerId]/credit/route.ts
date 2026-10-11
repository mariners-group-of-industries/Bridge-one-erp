import { z } from "zod";
import { getCustomerCredit } from "@/features/sales/masters/services/masters.service";
import { apiHandler, ok, parseId } from "@/lib/api/handler";

const querySchema = z.object({ asOf: z.iso.date() });

/** GET /api/sales/customers/:id/credit?asOf=YYYY-MM-DD: credit limit, outstanding, overdue, available. */
export const GET = apiHandler<RouteContext<"/api/sales/customers/[customerId]/credit">>(
  "sales:read",
  async (request, context, actor) => {
    const id = parseId((await context.params).customerId, "Customer");
    const { asOf } = querySchema.parse(Object.fromEntries(new URL(request.url).searchParams));
    return ok(await getCustomerCredit(actor, id, asOf));
  },
);
