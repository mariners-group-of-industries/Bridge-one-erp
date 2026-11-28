import { outletFormOptions } from "@/features/rtm/server/outlet.service";
import { get } from "@/features/rtm/server/routes";

/** Divisions, districts, thanas, distributors, channels and suggested categories for the outlet form. */
export const GET = get((actor) => outletFormOptions(actor));
