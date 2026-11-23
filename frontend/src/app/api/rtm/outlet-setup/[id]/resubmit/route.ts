import { resubmitOutlet } from "@/features/rtm/server/outlet.service";
import { writeId } from "@/features/rtm/server/routes";

/** Send a rejected outlet for approval again. */
export const POST = writeId((actor, id) => resubmitOutlet(actor, id));
