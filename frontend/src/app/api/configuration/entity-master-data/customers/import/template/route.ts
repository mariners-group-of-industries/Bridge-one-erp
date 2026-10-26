import { customerImportTemplate } from "@/features/configuration/entity-master-data/customer/server/customer-excel";
import { apiHandler } from "@/lib/api/handler";

const XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export const GET = apiHandler("configuration:read", async () => {
  const bytes = await customerImportTemplate();
  return new Response(new Blob([new Uint8Array(bytes)], { type: XLSX }), {
    headers: {
      "Content-Type": XLSX,
      "Content-Disposition": 'attachment; filename="customer-upload-template.xlsx"',
      "Cache-Control": "no-store",
    },
  });
});
