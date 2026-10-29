import { badRequest } from "@/lib/api/errors";
import { DELIVERY_EXPORT_TABS, deliveryTabExcel, type DeliveryExportTab } from "@/features/sales/deliveries/services/delivery-export";
import { apiHandler } from "@/lib/api/handler";

/** GET ?tab=approved|deliveries|exchanges|challans (+ the tab's filters): the list as .xlsx. */
export const GET = apiHandler("sales:read", async (request, _context, actor) => {
  const { tab, ...filters } = Object.fromEntries(new URL(request.url).searchParams);
  if (!DELIVERY_EXPORT_TABS.includes(tab as DeliveryExportTab)) throw badRequest("Unknown delivery list.");
  const bytes = await deliveryTabExcel(actor, tab as DeliveryExportTab, filters);
  return new Response(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="sales-delivery-${tab}.xlsx"`,
    },
  });
});
