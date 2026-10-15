import { getOfferOptions } from "@/features/configuration/sales-config/offer/server/offer.service";
import { apiHandler, ok } from "@/lib/api/handler";

export const GET = apiHandler("configuration:read", async (_request, _context, actor) => ok(await getOfferOptions(actor)));
