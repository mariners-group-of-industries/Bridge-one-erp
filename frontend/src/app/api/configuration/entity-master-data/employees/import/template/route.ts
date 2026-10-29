import { employeeImportTemplate } from "@/features/configuration/entity-master-data/employee/server/employee-excel";
import { apiHandler } from "@/lib/api/handler";

const XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export const GET = apiHandler("configuration:read", async (_request, _context, actor) => {
  const bytes = await employeeImportTemplate(actor);
  return new Response(new Blob([new Uint8Array(bytes)], { type: XLSX }), {
    headers: { "Content-Type": XLSX, "Content-Disposition": 'attachment; filename="employee-upload-template.xlsx"', "Cache-Control": "no-store" },
  });
});
