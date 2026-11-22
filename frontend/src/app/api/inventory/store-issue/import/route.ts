import { bulkImportRoute } from "@/lib/bulk-import/route";
import { inventoryImportTemplate, importInventoryDocuments } from "@/features/inventory/server/document-excel";

/** GET: .xlsx template; POST: bulk-create Store Issue documents (one row per line, Ref groups lines into one document). */
export const { GET, POST } = bulkImportRoute({
  read: "purchase:read",
  write: "purchase:write",
  templateName: "store-issue-template",
  template: () => inventoryImportTemplate("store-issue"),
  importFile: (actor, actorName, bytes) => importInventoryDocuments("store-issue", actor, actorName, bytes),
});
