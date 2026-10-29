import { XLSX_TYPE, ordersExcel } from "@/features/sales/orders/services/order-export";
import { apiHandler } from "@/lib/api/handler";

/** GET (same query as the list): Order Management as .xlsx. */
export const GET = apiHandler("sales:read", async (request, _context, actor) => {
  const bytes = await ordersExcel(actor, Object.fromEntries(new URL(request.url).searchParams));
  return new Response(Buffer.from(bytes), {
    headers: { "Content-Type": XLSX_TYPE, "Content-Disposition": 'attachment; filename="sales-orders.xlsx"' },
  });
});
