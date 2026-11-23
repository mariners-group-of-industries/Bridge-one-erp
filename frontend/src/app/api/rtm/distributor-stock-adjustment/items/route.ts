import { transferItemOptions } from "@/features/rtm/server/stock.service";
import { get } from "@/features/rtm/server/routes";

/** Item categories and items with dealer price and the distributor's current stock (?distributorId&date). */
export const GET = get((actor, q) => transferItemOptions(actor, q));
