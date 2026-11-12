import { listDocuments } from "@/features/inventory/server/inventory.service";
import { apiHandler, ok } from "@/lib/api/handler";

/** GET ?from&to: transfers and transfer requests of a period, for the transfer report. */
export const GET = apiHandler("purchase:read", async (request, _context, actor) => {
  const q = new URL(request.url).searchParams;
  const filters = { from: q.get("from") ?? undefined, to: q.get("to") ?? undefined };
  const [transfers, requests] = await Promise.all([listDocuments(actor, "TRANSFER", filters), listDocuments(actor, "TRANSFER_REQUEST", filters)]);
  return ok({ transfers, requests });
});
