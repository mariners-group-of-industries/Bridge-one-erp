import { bulkImportRoute } from "@/lib/bulk-import/route";
import { inventoryImportTemplate, importInventoryDocuments } from "@/features/inventory/server/document-excel";

/** GET: .xlsx template; POST: bulk-create Gate In Out documents (one row per line, Ref groups lines into one document). */
export const { GET, POST } = bulkImportRoute({
  read: "purchase:read",
  write: "purchase:write",
  templateName: "gate-in-out-template",
  template: () => inventoryImportTemplate("gate-in-out"),
  importFile: (actor, actorName, bytes) => importInventoryDocuments("gate-in-out", actor, actorName, bytes),
});
