import { reviewTourPlan } from "@/features/rtm/server/field.service";
import { writeId } from "@/features/rtm/server/routes";

/** Approve a tour plan. */
export const POST = writeId((actor, id) => reviewTourPlan(actor, id, "approve"));
