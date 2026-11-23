import { rollbackAdjustment } from "@/features/rtm/server/stock.service";
import { writeId } from "@/features/rtm/server/routes";

/** Reverse an approved adjustment (the opposite stock entries are posted). */
export const POST = writeId((actor, id) => rollbackAdjustment(actor, id));
