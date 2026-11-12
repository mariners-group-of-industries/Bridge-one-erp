import { saveChannel } from "@/features/rtm/server/masters.service";
import { writeId } from "@/features/rtm/server/routes";

/** Edit a channel. */
export const PATCH = writeId((actor, id, body) => saveChannel(actor, body, id));
