import { territoryFilters } from "@/features/rtm/server/territory.service";
import { get } from "@/features/rtm/server/routes";

/** Base points, routes, markets and sales force for the RTM sales list filters. */
export const GET = get((actor) => territoryFilters(actor));
