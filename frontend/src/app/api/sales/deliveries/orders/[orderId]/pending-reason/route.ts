import { setOrderPendingReason } from "@/features/sales/deliveries/services/delivery.service";
import { apiHandler, noContent, parseId } from "@/lib/api/handler";

/** PUT body: { reasonId | null } */
export const PUT = apiHandler<{ params: Promise<{ orderId: string }> }>("sales:write", async (request, context, actor) => {
  await setOrderPendingReason(actor, parseId((await context.params).orderId, "Sales order"), await request.json().catch(() => null));
  return noContent();
});
