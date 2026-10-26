import { pricePdf } from "@/features/configuration/sales-config/customer-price/server/customer-price-files";
import { apiHandler } from "@/lib/api/handler";

/** PDF of the current tab (?tab=customer|group, optional ?search). */
export const GET = apiHandler("configuration:read", async (request, _context, actor) => {
  const params = new URL(request.url).searchParams;
  const tab = params.get("tab") === "group" ? "group" : "customer";
  const search = params.get("search")?.trim().slice(0, 100) || undefined;
  const bytes = await pricePdf(actor, tab, search);
  const name = tab === "customer" ? "customer-prices" : "customer-group-prices";
  return new Response(new Blob([new Uint8Array(bytes)], { type: "application/pdf" }), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${name}-${new Date().toISOString().slice(0, 10)}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
});
