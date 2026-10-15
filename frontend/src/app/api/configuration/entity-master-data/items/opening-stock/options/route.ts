import { getOpeningStockOptions } from "@/features/configuration/entity-master-data/item/server/item.service";
import { apiHandler, ok } from "@/lib/api/handler";

export const GET = apiHandler("configuration:read", async (_request, _context, actor) => ok(await getOpeningStockOptions(actor)));
