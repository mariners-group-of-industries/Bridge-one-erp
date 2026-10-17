import { returnPriceQuerySchema } from "@/features/configuration/sales-config/return-price/schemas/return-price.schema";
import { returnPricePdf } from "@/features/configuration/sales-config/return-price/server/return-price-files";
import { apiHandler } from "@/lib/api/handler";

/** PDF of the filtered list (same query as the list). */
export const GET = apiHandler("configuration:read", async (request, _context, actor) => {
  const query = returnPriceQuerySchema.parse(Object.fromEntries(new URL(request.url).searchParams));
  const bytes = await returnPricePdf(actor, query);
  return new Response(new Blob([new Uint8Array(bytes)], { type: "application/pdf" }), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="sales-return-prices-${new Date().toISOString().slice(0, 10)}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
});
