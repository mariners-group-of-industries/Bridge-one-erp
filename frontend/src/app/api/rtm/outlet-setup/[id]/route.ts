import { saveOutlet } from "@/features/rtm/server/outlet.service";
import { writeId } from "@/features/rtm/server/routes";

/** Edit an outlet. */
export const PATCH = writeId((actor, id, body) => saveOutlet(actor, body, id));
