import { createAdvanceVoucher } from "@/features/sales/collections/services/collection.service";
import { apiHandler, ok } from "@/lib/api/handler";

/** POST: Advance Collection voucher (one advance receipt per row). */
export const POST = apiHandler("sales:write", async (request, _context, actor) =>
  ok(await createAdvanceVoucher(actor, await request.json().catch(() => null)), 201),
);
