import { getFilterOptions } from "@/features/configuration/entity-master-data/item/server/item.service";
import { apiHandler, ok } from "@/lib/api/handler";

/** Suppliers and customers for the Item Profile filters. */
export const GET = apiHandler("configuration:read", async (_request, _context, actor) => ok(await getFilterOptions(actor)));
