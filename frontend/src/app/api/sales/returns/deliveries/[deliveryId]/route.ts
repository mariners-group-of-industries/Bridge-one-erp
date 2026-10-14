import { z } from "zod";
import { getDeliveryForReturn } from "@/features/sales/returns/services/return.service";
import { apiHandler, ok, parseId } from "@/lib/api/handler";

const querySchema = z.object({ editing: z.uuid().optional() });

/** GET /api/sales/returns/deliveries/:deliveryId[?editing=<returnId>]: delivery lines with what can still be returned. */
export const GET = apiHandler<{ params: Promise<{ deliveryId: string }> }>("sales:read", async (request, context, actor) => {
  const id = parseId((await context.params).deliveryId, "Delivery");
  const { editing } = querySchema.parse(Object.fromEntries(new URL(request.url).searchParams));
  return ok(await getDeliveryForReturn(actor, id, editing));
});
