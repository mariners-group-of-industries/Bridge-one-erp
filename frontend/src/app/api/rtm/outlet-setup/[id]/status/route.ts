import { setOutletActive } from "@/features/rtm/server/outlet.service";
import { writeId } from "@/features/rtm/server/routes";

/** POST { isActive }: activate or deactivate an outlet. */
export const POST = writeId((actor, id, body) => setOutletActive(actor, id, body));
