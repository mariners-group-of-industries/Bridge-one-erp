import { deliveryChallanPdf } from "@/features/sales/deliveries/services/delivery-export";
import { apiHandler, parseId } from "@/lib/api/handler";

type Context = { params: Promise<{ deliveryId: string }> };

/** GET: the delivery challan as a PDF (?download=1 saves it instead of opening it). */
export const GET = apiHandler<Context>("sales:read", async (request, context, actor) => {
  const { number, bytes } = await deliveryChallanPdf(actor, parseId((await context.params).deliveryId, "Delivery"));
  const disposition = new URL(request.url).searchParams.has("download") ? "attachment" : "inline";
  return new Response(Buffer.from(bytes), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `${disposition}; filename="${encodeURIComponent(number)}.pdf"` },
  });
});
