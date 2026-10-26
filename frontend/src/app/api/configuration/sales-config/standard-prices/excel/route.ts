import { standardPriceQuerySchema } from "@/features/configuration/sales-config/standard-price/schemas/standard-price.schema";
import { exportStandardPrices } from "@/features/configuration/sales-config/standard-price/server/standard-price-files";
import { apiHandler } from "@/lib/api/handler";

/** Excel of the filtered list (same query as the list); also the bulk upload template. */
export const GET = apiHandler("configuration:read", async (request, _context, actor) => {
  const query = standardPriceQuerySchema.parse(Object.fromEntries(new URL(request.url).searchParams));
  const bytes = await exportStandardPrices(actor, query);
  return new Response(new Blob([new Uint8Array(bytes)], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="standard-prices-${new Date().toISOString().slice(0, 10)}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
});
