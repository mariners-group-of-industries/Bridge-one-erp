import { bulkImportRoute } from "@/lib/bulk-import/route";
import { inventoryImportTemplate, importInventoryDocuments } from "@/features/inventory/server/document-excel";

/** GET: .xlsx template; POST: bulk-create Stock Update documents (one row per line, Ref groups lines into one document). */
export const { GET, POST } = bulkImportRoute({
  read: "purchase:read",
  write: "purchase:write",
  templateName: "stock-adjustment-template",
  template: () => inventoryImportTemplate("stock-adjustment"),
  importFile: (actor, actorName, bytes) => importInventoryDocuments("stock-adjustment", actor, actorName, bytes),
});
