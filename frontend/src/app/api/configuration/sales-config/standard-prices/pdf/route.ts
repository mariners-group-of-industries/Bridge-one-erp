import { standardPriceQuerySchema } from "@/features/configuration/sales-config/standard-price/schemas/standard-price.schema";
import { standardPricePdf } from "@/features/configuration/sales-config/standard-price/server/standard-price-files";
import { apiHandler } from "@/lib/api/handler";

/** PDF of the filtered list (same query as the list). */
export const GET = apiHandler("configuration:read", async (request, _context, actor) => {
  const query = standardPriceQuerySchema.parse(Object.fromEntries(new URL(request.url).searchParams));
  const bytes = await standardPricePdf(actor, query);
  return new Response(new Blob([new Uint8Array(bytes)], { type: "application/pdf" }), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="standard-prices-${new Date().toISOString().slice(0, 10)}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
});
