import { z } from "zod";
import { getOrderForDelivery } from "@/features/sales/deliveries/services/delivery.service";
import { apiHandler, ok, parseId } from "@/lib/api/handler";

const querySchema = z.object({ asOf: z.iso.date(), editing: z.uuid().optional() });

/** GET /api/sales/deliveries/orders/:orderId?asOf=YYYY-MM-DD: order lines left to deliver. */
export const GET = apiHandler<{ params: Promise<{ orderId: string }> }>("sales:read", async (request, context, actor) => {
  const id = parseId((await context.params).orderId, "Sales order");
  const { asOf, editing } = querySchema.parse(Object.fromEntries(new URL(request.url).searchParams));
  return ok(await getOrderForDelivery(actor, id, asOf, editing));
});
