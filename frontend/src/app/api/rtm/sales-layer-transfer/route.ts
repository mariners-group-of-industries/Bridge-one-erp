import { salesLayers, transferLayer } from "@/features/rtm/server/field.service";
import { get, write } from "@/features/rtm/server/routes";

/** Sales layers with their employees; POST moves an employee or outlets. */
export const GET = get((actor) => salesLayers(actor));
export const POST = write((actor, body) => transferLayer(actor, body));
