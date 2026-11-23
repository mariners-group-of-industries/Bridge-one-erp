import { adjustmentTemplate } from "@/features/rtm/server/stock.service";
import { apiHandler } from "@/lib/api/handler";

/** GET: the Bulk adjustment Excel template (with a sheet of distributor and item codes). */
export const GET = apiHandler("sales:read", async (_request, _c, actor) => {
  const bytes = await adjustmentTemplate(actor);
  return new Response(Buffer.from(bytes), {
    headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": 'attachment; filename="stock-adjustment-template.xlsx"' },
  });
});
