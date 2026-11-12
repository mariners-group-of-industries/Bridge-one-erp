import { createTourPlan, listTourPlans } from "@/features/rtm/server/field.service";
import { get, write } from "@/features/rtm/server/routes";

/** Tour plans. */
export const GET = get((actor, q) => listTourPlans(actor, q));
export const POST = write((actor, body) => createTourPlan(actor, body), 201);
