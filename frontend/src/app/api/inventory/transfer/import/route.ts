import { bulkImportRoute } from "@/lib/bulk-import/route";
import { inventoryImportTemplate, importInventoryDocuments } from "@/features/inventory/server/document-excel";

/** GET: .xlsx template; POST: bulk-create Transfer documents (one row per line, Ref groups lines into one document). */
export const { GET, POST } = bulkImportRoute({
  read: "purchase:read",
  write: "purchase:write",
  templateName: "transfer-template",
  template: () => inventoryImportTemplate("transfer"),
  importFile: (actor, actorName, bytes) => importInventoryDocuments("transfer", actor, actorName, bytes),
});
