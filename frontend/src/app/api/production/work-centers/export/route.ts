import { workCentersExcel } from "@/features/production/work-centers/services/work-center.service";
import { apiHandler } from "@/lib/api/handler";

/** GET [?typeId&departmentId&departmentSectionId]: the work center list as .xlsx. */
export const GET = apiHandler("production:read", async (request, _context, actor) => {
  const bytes = await workCentersExcel(actor, Object.fromEntries(new URL(request.url).searchParams));
  return new Response(Buffer.from(bytes), {
    headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": 'attachment; filename="work-centers.xlsx"' },
  });
});
