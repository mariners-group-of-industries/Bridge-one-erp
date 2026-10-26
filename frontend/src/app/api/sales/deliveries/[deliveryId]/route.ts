import { deleteDelivery, getDelivery, updateDelivery, updateDeliveryReferences } from "@/features/sales/deliveries/services/delivery.service";
import { apiHandler, noContent, ok, parseId } from "@/lib/api/handler";

type Context = { params: Promise<{ deliveryId: string }> };
const idOf = async (context: Context) => parseId((await context.params).deliveryId, "Delivery");

export const GET = apiHandler<Context>("sales:read", async (_request, context, actor) => ok(await getDelivery(actor, await idOf(context))));

/** PUT body: { version, data }. Only unconfirmed deliveries. */
export const PUT = apiHandler<Context>("sales:write", async (request, context, actor) =>
  ok(await updateDelivery(actor, await idOf(context), await request.json().catch(() => null))),
);

/** PATCH body: { version, vatChallanNo, refCustomerPo, refCustomerPoDate, refInvoice, remarks }. Only unconfirmed deliveries. */
export const PATCH = apiHandler<Context>("sales:write", async (request, context, actor) =>
  ok(await updateDeliveryReferences(actor, await idOf(context), await request.json().catch(() => null))),
);

/** DELETE body: { version, reason }. Soft delete; reverses stock, order quantities and collection. */
export const DELETE = apiHandler<Context>("sales:write", async (request, context, actor) => {
  await deleteDelivery(actor, await idOf(context), await request.json().catch(() => null));
  return noContent();
});
