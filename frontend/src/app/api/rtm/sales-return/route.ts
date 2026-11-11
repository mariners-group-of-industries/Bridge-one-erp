import { createReturn, listReturns } from "@/features/rtm/server/sales.service";
import { get, write } from "@/features/rtm/server/routes";

/** Outlet returns. */
export const GET = get((actor, q) => listReturns(actor, q));
export const POST = write((actor, body) => createReturn(actor, body), 201);
