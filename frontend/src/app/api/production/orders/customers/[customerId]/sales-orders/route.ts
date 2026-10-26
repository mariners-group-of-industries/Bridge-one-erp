import { customerSalesOrders } from "@/features/production/orders/services/order.service";
import { apiHandler, ok, parseId } from "@/lib/api/handler";

type Context = { params: Promise<{ customerId: string }> };

/** GET: confirmed sales orders of the customer. */
export const GET = apiHandler<Context>("production:read", async (_request, context, actor) =>
  ok(await customerSalesOrders(actor, parseId((await context.params).customerId, "Customer"))),
);
