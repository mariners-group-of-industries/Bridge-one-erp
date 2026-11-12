import { stockLevels } from "@/features/rtm/server/stock.service";
import { get } from "@/features/rtm/server/routes";

/** ?distributorId: distributor stock per item. */
export const GET = get((actor, q) => stockLevels(actor, q.distributorId ?? ""));
