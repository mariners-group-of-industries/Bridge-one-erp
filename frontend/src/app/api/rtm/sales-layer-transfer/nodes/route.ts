import { salesLayers } from "@/features/rtm/server/field.service";
import { get } from "@/features/rtm/server/routes";

/** Territory nodes with their layer, children and assigned employees (the transfer form). */
export const GET = get((actor) => salesLayers(actor));
