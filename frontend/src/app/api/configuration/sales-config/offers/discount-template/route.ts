import { discountTemplate } from "@/features/configuration/sales-config/offer/server/offer.service";
import { apiHandler } from "@/lib/api/handler";

const XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export const GET = apiHandler("configuration:read", async () => {
  const bytes = await discountTemplate();
  return new Response(new Blob([new Uint8Array(bytes)], { type: XLSX }), {
    headers: {
      "Content-Type": XLSX,
      "Content-Disposition": 'attachment; filename="discount-offer-template.xlsx"',
      "Cache-Control": "no-store",
    },
  });
});
