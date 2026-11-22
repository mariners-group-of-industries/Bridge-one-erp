import { bulkImportRoute } from "@/lib/bulk-import/route";
import { inventoryImportTemplate, importInventoryDocuments } from "@/features/inventory/server/document-excel";

/** GET: .xlsx template; POST: bulk-create Store Requisition documents (one row per line, Ref groups lines into one document). */
export const { GET, POST } = bulkImportRoute({
  read: "purchase:read",
  write: "purchase:write",
  templateName: "store-requisition-template",
  template: () => inventoryImportTemplate("store-requisition"),
  importFile: (actor, actorName, bytes) => importInventoryDocuments("store-requisition", actor, actorName, bytes),
});
