import { createCollection, listCollections } from "@/features/rtm/server/sales.service";
import { get, write } from "@/features/rtm/server/routes";

/** Outlet collections. */
export const GET = get((actor, q) => listCollections(actor, q));
export const POST = write((actor, body) => createCollection(actor, body), 201);
