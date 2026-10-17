import { getReturnPriceOptions } from "@/features/configuration/sales-config/return-price/server/return-price.service";
import { apiHandler, ok } from "@/lib/api/handler";

export const GET = apiHandler("configuration:read", async (_request, _context, actor) => ok(await getReturnPriceOptions(actor)));
