import { reviewTransfer } from "@/features/rtm/server/stock.service";
import { writeId } from "@/features/rtm/server/routes";

/** Reject a transfer request. */
export const POST = writeId((actor, id) => reviewTransfer(actor, id, "reject"));
