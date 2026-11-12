import { issueTransfer } from "@/features/rtm/server/stock.service";
import { writeId } from "@/features/rtm/server/routes";

/** Issue an approved transfer. */
export const POST = writeId((actor, id, body) => issueTransfer(actor, id, body));
