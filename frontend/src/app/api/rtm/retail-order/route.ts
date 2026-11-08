import { createOrder, listOrders } from "@/features/rtm/server/sales.service";
import { get, write } from "@/features/rtm/server/routes";

/** Retail orders (?from&to&distributorId&outletId&status). */
export const GET = get((actor, q) => listOrders(actor, q));
export const POST = write((actor, body) => createOrder(actor, body), 201);
