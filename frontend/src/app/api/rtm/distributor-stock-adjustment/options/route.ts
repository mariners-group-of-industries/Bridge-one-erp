import { adjustmentOptions } from "@/features/rtm/server/stock.service";
import { get } from "@/features/rtm/server/routes";

/** Distributors with their Sales Territory node (Adjust Stock filters). */
export const GET = get((actor) => adjustmentOptions(actor));
