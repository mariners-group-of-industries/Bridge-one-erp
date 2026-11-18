import { bulkImportRoute } from "@/lib/bulk-import/route";
import { receiveImportTemplate, importGoodsReceipts } from "@/features/purchase/server/receive-excel";

/** GET: .xlsx template; POST: bulk-create goods receipts (against a PO number, or DIRECT). */
export const { GET, POST } = bulkImportRoute({
  read: "purchase:read",
  write: "purchase:write",
  templateName: "goods-receipts-template",
  template: receiveImportTemplate,
  importFile: importGoodsReceipts,
});
