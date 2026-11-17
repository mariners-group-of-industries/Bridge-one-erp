import { bulkImportRoute } from "@/lib/bulk-import/route";
import { returnImportTemplate, importPurchaseReturns } from "@/features/purchase/server/return-excel";

/** GET: .xlsx template; POST: bulk-create purchase returns (against a GRN number, or WITHOUT_REF). */
export const { GET, POST } = bulkImportRoute({
  read: "purchase:read",
  write: "purchase:write",
  templateName: "purchase-returns-template",
  template: returnImportTemplate,
  importFile: importPurchaseReturns,
});
