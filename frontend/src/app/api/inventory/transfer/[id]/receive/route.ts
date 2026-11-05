import { receiveRoute } from "@/features/inventory/server/routes";

/** POST: receive a transfer in transit ({ lines: [{ lineId, receivedQty }] }). */
export const { POST } = receiveRoute;
