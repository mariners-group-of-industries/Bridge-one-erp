import { actOnOrder } from "@/features/production/orders/services/order.service";
import { apiHandler, ok, parseId } from "@/lib/api/handler";

type Context = { params: Promise<{ orderId: string }> };

/** POST body: { version, action: approve|reject|start|close|cancel, comment? }. Who may do what is checked in the service. */
export const POST = apiHandler<Context>("production:read", async (request, context, actor) =>
  ok(await actOnOrder(actor, parseId((await context.params).orderId, "Production order"), await request.json().catch(() => null))),
);
