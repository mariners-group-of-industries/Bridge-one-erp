import { cancelOrder } from "@/features/rtm/server/sales.service";
import { writeId } from "@/features/rtm/server/routes";

/** Cancel an order without deliveries. */
export const POST = writeId((actor, id) => cancelOrder(actor, id));
