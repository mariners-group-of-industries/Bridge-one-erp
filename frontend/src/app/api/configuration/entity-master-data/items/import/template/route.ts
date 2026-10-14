import { itemImportTemplate } from "@/features/configuration/entity-master-data/item/server/item-excel";
import { apiHandler } from "@/lib/api/handler";

const XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export const GET = apiHandler("configuration:read", async () => {
  const bytes = await itemImportTemplate();
  return new Response(new Blob([new Uint8Array(bytes)], { type: XLSX }), {
    headers: {
      "Content-Type": XLSX,
      "Content-Disposition": 'attachment; filename="item-upload-template.xlsx"',
      "Cache-Control": "no-store",
    },
  });
});
