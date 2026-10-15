import { priceTemplate } from "@/features/configuration/sales-config/customer-price/server/customer-price-files";
import { apiHandler } from "@/lib/api/handler";

const XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export const GET = apiHandler("configuration:read", async (request) => {
  const tab = new URL(request.url).searchParams.get("tab") === "group" ? "group" : "customer";
  const bytes = await priceTemplate(tab);
  return new Response(new Blob([new Uint8Array(bytes)], { type: XLSX }), {
    headers: {
      "Content-Type": XLSX,
      "Content-Disposition": `attachment; filename="${tab === "customer" ? "customer-price" : "customer-group-price"}-template.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
});
