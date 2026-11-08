import { lookups } from "@/features/rtm/server/masters.service";
import { get } from "@/features/rtm/server/routes";

/** Distributors, outlets, channels, routes, SRs and items for RTM forms. */
export const GET = get((actor) => lookups(actor));
