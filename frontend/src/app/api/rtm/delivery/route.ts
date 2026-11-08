import { deliverOrder, listDeliveries } from "@/features/rtm/server/sales.service";
import { get, write } from "@/features/rtm/server/routes";

/** Deliveries against orders. */
export const GET = get((actor, q) => listDeliveries(actor, { ...q, direct: false }));
export const POST = write((actor, body) => deliverOrder(actor, body), 201);
