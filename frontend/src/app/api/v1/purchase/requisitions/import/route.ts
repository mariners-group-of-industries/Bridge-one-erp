import { bulkImportRoute } from "@/lib/bulk-import/route";
import { requisitionImportTemplate, importRequisitions } from "@/features/purchase/server/requisition-excel";

/** GET: .xlsx template; POST: bulk-create requisitions (one row per line, Ref groups lines into one document). */
export const { GET, POST } = bulkImportRoute({
  read: "purchase:read",
  write: "purchase:write",
  templateName: "requisitions-template",
  template: requisitionImportTemplate,
  importFile: importRequisitions,
});
