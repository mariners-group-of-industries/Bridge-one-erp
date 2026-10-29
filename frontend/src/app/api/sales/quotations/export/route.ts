import { quotationsExcel } from "@/features/sales/quotations/services/quotation-export";
import { apiHandler } from "@/lib/api/handler";

/** GET (same query as the list): the quotation list as .xlsx. */
export const GET = apiHandler("sales:read", async (request, _context, actor) => {
  const bytes = await quotationsExcel(actor, Object.fromEntries(new URL(request.url).searchParams));
  return new Response(Buffer.from(bytes), {
    headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": 'attachment; filename="sales-quotations.xlsx"' },
  });
});
