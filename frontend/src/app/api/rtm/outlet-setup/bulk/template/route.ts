import { outletTemplate } from "@/features/rtm/server/outlet.service";
import { apiHandler } from "@/lib/api/handler";

/** GET: the outlet bulk upload template (with a sheet of distributor and area codes). */
export const GET = apiHandler("sales:read", async (_request, _c, actor) => {
  const bytes = await outletTemplate(actor);
  return new Response(Buffer.from(bytes), {
    headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": 'attachment; filename="outlet-upload-template.xlsx"' },
  });
});
