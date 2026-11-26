import { bulkImportRoute } from "@/lib/bulk-import/route";
import { inventoryImportTemplate, importInventoryDocuments } from "@/features/inventory/server/document-excel";

/** GET: .xlsx template; POST: bulk-create Item Conversion documents (one row per line, Ref groups lines into one document). */
export const { GET, POST } = bulkImportRoute({
  read: "purchase:read",
  write: "purchase:write",
  templateName: "item-stock-conversion-template",
  template: () => inventoryImportTemplate("item-stock-conversion"),
  importFile: (actor, actorName, bytes) => importInventoryDocuments("item-stock-conversion", actor, actorName, bytes),
});
