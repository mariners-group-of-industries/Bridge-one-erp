import { reviewOutlet } from "@/features/rtm/server/outlet.service";
import { writeId } from "@/features/rtm/server/routes";

/** Approve an outlet (Outlet Setup Approval). */
export const POST = writeId((actor, id) => reviewOutlet(actor, id, "approve"));
