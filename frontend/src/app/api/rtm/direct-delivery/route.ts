import { directDelivery, listDeliveries } from "@/features/rtm/server/sales.service";
import { get, write } from "@/features/rtm/server/routes";

/** Deliveries without an order. */
export const GET = get((actor, q) => listDeliveries(actor, { ...q, direct: true }));
export const POST = write((actor, body) => directDelivery(actor, body), 201);
