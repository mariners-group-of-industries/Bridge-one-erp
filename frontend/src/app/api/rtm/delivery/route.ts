import { deliverOrder, listDeliveries } from "@/features/rtm/server/sales.service";
import { get, write } from "@/features/rtm/server/routes";

/** Deliveries (?from&to&distributorId&nodeId&srId&deliveryType=ORDER|DIRECT; both types when omitted). */
export const GET = get((actor, q) => listDeliveries(actor, { ...q, direct: q.deliveryType === "DIRECT" ? true : q.deliveryType === "ORDER" ? false : undefined }));
export const POST = write((actor, body) => deliverOrder(actor, body), 201);
