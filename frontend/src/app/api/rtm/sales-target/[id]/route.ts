import { deleteTarget } from "@/features/rtm/server/masters.service";
import { writeId } from "@/features/rtm/server/routes";

/** Delete a target. */
export const DELETE = writeId((actor, id) => deleteTarget(actor, id));
