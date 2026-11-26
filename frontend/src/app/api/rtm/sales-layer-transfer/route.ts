import { createLayerTransfer, listLayerTransfers } from "@/features/rtm/server/field.service";
import { get, write } from "@/features/rtm/server/routes";

/** Sales layer transfers (?status&layerLevel&type&from&to); POST raises one for approval. */
export const GET = get((actor, q) => listLayerTransfers(actor, q));
export const POST = write((actor, body) => createLayerTransfer(actor, body), 201);
