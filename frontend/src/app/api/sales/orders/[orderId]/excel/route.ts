import { XLSX_TYPE, orderExcel } from "@/features/sales/orders/services/order-export";
import { apiHandler, parseId } from "@/lib/api/handler";

type Context = { params: Promise<{ orderId: string }> };

/** GET: the order's item list as .xlsx. */
export const GET = apiHandler<Context>("sales:read", async (_request, context, actor) => {
  const { number, bytes } = await orderExcel(actor, parseId((await context.params).orderId, "Sales order"));
  return new Response(Buffer.from(bytes), {
    headers: { "Content-Type": XLSX_TYPE, "Content-Disposition": `attachment; filename="${encodeURIComponent(number)}.xlsx"` },
  });
});
