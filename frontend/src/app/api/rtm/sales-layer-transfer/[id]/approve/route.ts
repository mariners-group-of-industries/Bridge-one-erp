import { reviewLayerTransfer } from "@/features/rtm/server/field.service";
import { writeId } from "@/features/rtm/server/routes";

/** Approve a sales layer transfer (the last approval applies it). */
export const POST = writeId((actor, id) => reviewLayerTransfer(actor, id, "approve"));
