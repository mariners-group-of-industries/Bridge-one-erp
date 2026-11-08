import { listTransfers } from "@/features/rtm/server/stock.service";
import { get } from "@/features/rtm/server/routes";

/** Transfers to issue (approved) and issued. */
export const GET = get((actor, q) => listTransfers(actor, q));
