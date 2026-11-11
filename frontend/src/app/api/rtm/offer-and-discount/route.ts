import { listOffers, saveOffer } from "@/features/rtm/server/masters.service";
import { get, write } from "@/features/rtm/server/routes";

/** Trade offers. */
export const GET = get((actor) => listOffers(actor));
export const POST = write((actor, body) => saveOffer(actor, body), 201);
