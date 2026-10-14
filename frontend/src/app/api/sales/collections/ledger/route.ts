import { listLedger } from "@/features/sales/collections/services/collection.service";
import { apiHandler, ok } from "@/lib/api/handler";

/** GET — Customer Sales vs Ledger Balance. */
export const GET = apiHandler("sales:read", async (request, _context, actor) =>
  ok(await listLedger(actor, Object.fromEntries(new URL(request.url).searchParams))),
);
