import { saveStandardPricesSchema, standardPriceQuerySchema } from "@/features/configuration/sales-config/standard-price/schemas/standard-price.schema";
import { listStandardPrices, saveStandardPrices } from "@/features/configuration/sales-config/standard-price/server/standard-price.service";
import { apiHandler, ok, parseJson } from "@/lib/api/handler";

/** Items of the filter with their current standard price (?businessUnitId, itemType, categoryId, subCategoryId, customerId, supplierId, search, page, pageSize). */
export const GET = apiHandler("configuration:read", async (request, _context, actor) => {
  const query = standardPriceQuerySchema.parse(Object.fromEntries(new URL(request.url).searchParams));
  return ok(await listStandardPrices(actor, query));
});

/** Save the edited rows: { businessUnitId, rows: [...] }. */
export const PUT = apiHandler("configuration:write", async (request, _context, actor) => ok(await saveStandardPrices(actor, await parseJson(request, saveStandardPricesSchema))));
