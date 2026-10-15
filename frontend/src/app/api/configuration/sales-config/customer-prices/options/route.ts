import { getPriceSetupOptions } from "@/features/configuration/sales-config/customer-price/server/customer-price.service";
import { apiHandler, ok } from "@/lib/api/handler";

export const GET = apiHandler("configuration:read", async (_request, _context, actor) => ok(await getPriceSetupOptions(actor)));
