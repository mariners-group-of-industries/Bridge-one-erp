import { createDueCollection } from "@/features/sales/collections/services/collection.service";
import { apiHandler, ok } from "@/lib/api/handler";

/** POST: Due Collection (invoices of one or more customers, bank deductions). Returns the money receipts. */
export const POST = apiHandler("sales:write", async (request, _context, actor) =>
  ok(await createDueCollection(actor, await request.json().catch(() => null)), 201),
);
