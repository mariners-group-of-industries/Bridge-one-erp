import { tourPlanTsms } from "@/features/rtm/server/field.service";
import { get } from "@/features/rtm/server/routes";

/** Territory Sales Managers (the only employees a tour plan is made for). */
export const GET = get((actor) => tourPlanTsms(actor));
