import { createAdjustment, listAdjustments } from "@/features/rtm/server/stock.service";
import { get, write } from "@/features/rtm/server/routes";

/** Distributor stock adjustments. */
export const GET = get((actor, q) => listAdjustments(actor, q));
export const POST = write((actor, body) => createAdjustment(actor, body), 201);
