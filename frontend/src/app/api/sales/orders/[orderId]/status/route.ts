import { changeOrderStatus } from "@/features/sales/orders/services/order.service";
import { apiHandler, ok, parseId } from "@/lib/api/handler";

/** POST body: { action: "submit" | "approve" | "reject" | "cancel" | "complete", version, remarks?, today } */
export const POST = apiHandler<RouteContext<"/api/sales/orders/[orderId]/status">>(
  "sales:write",
  async (request, context, actor) => {
    const id = parseId((await context.params).orderId, "Sales order");
    return ok(await changeOrderStatus(actor, id, await request.json().catch(() => null)));
  },
);
