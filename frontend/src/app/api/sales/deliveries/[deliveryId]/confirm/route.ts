import { confirmDelivery } from "@/features/sales/deliveries/services/delivery.service";
import { apiHandler, ok, parseId } from "@/lib/api/handler";

/** POST body: { version, actualDeliveryDate }. Locks the delivery. */
export const POST = apiHandler<{ params: Promise<{ deliveryId: string }> }>("sales:write", async (request, context, actor) => {
  const id = parseId((await context.params).deliveryId, "Delivery");
  return ok(await confirmDelivery(actor, id, await request.json().catch(() => null)));
});
