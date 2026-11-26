import { collectionSummary } from "@/features/rtm/server/sales.service";
import { get } from "@/features/rtm/server/routes";

/** Per outlet on one day: delivered, collected, rest (?date&nodeId&srId&outletId). */
export const GET = get((actor, q) => collectionSummary(actor, q));
