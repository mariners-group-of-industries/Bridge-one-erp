import { previewPricing } from "@/features/sales/pricing/services/pricing.service";
import { apiHandler, ok } from "@/lib/api/handler";

/** POST /api/sales/pricing: rates and offers (Configuration › Sales Config) for an order / quotation form. */
export const POST = apiHandler("sales:read", async (request, _context, actor) => ok(await previewPricing(actor, await request.json().catch(() => null))));
