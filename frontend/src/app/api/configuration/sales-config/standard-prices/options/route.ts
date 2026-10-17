import { getStandardPriceOptions } from "@/features/configuration/sales-config/standard-price/server/standard-price.service";
import { apiHandler, ok } from "@/lib/api/handler";

export const GET = apiHandler("configuration:read", async (_request, _context, actor) => ok(await getStandardPriceOptions(actor)));
