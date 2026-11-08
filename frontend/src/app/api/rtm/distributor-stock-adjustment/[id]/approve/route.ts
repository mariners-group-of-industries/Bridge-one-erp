import { reviewAdjustment } from "@/features/rtm/server/stock.service";
import { writeId } from "@/features/rtm/server/routes";

/** Approve (post) an adjustment. */
export const POST = writeId((actor, id) => reviewAdjustment(actor, id, "approve"));
