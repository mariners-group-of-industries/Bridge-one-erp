import { importTemplate } from "@/features/configuration/entity-master-data/supplier/server/supplier-excel";
import { apiHandler } from "@/lib/api/handler";

const XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export const GET = apiHandler("configuration:read", async () => {
  const bytes = await importTemplate();
  return new Response(new Blob([new Uint8Array(bytes)], { type: XLSX }), {
    headers: {
      "Content-Type": XLSX,
      "Content-Disposition": 'attachment; filename="supplier-upload-template.xlsx"',
      "Cache-Control": "no-store",
    },
  });
});
