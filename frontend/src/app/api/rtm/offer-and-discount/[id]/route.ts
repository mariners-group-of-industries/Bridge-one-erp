import { saveOffer } from "@/features/rtm/server/masters.service";
import { writeId } from "@/features/rtm/server/routes";

/** Edit an offer. */
export const PATCH = writeId((actor, id, body) => saveOffer(actor, body, id));
