import { bulkImportRoute } from "@/lib/bulk-import/route";
import { costCenterImportTemplate, importCostCenters } from "@/features/accounts/server/cost-center-excel";

/** GET: .xlsx template; POST: bulk-create cost centers (one row per center). */
export const { GET, POST } = bulkImportRoute({
  read: "accounts:read",
  write: "accounts:write",
  templateName: "cost-centers-template",
  template: costCenterImportTemplate,
  importFile: importCostCenters,
});
