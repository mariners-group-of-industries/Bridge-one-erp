import { reviewTransfer } from "@/features/rtm/server/stock.service";
import { writeId } from "@/features/rtm/server/routes";

/** Approve a transfer request. */
export const POST = writeId((actor, id) => reviewTransfer(actor, id, "approve"));
