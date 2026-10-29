import { returnRates } from "@/features/sales/pricing/services/pricing.service";
import { apiHandler, ok } from "@/lib/api/handler";

/** POST /api/sales/pricing/return-rates: Return Price Setup rates for a sales / market return. */
export const POST = apiHandler("sales:read", async (request, _context, actor) => ok(await returnRates(actor, await request.json().catch(() => null))));
