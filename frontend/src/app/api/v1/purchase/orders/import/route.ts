import { bulkImportRoute } from "@/lib/bulk-import/route";
import { orderImportTemplate, importPurchaseOrders } from "@/features/purchase/server/order-excel";

/** GET: .xlsx template; POST: bulk-create purchase orders (one row per line, Ref groups lines into one document). */
export const { GET, POST } = bulkImportRoute({
  read: "purchase:read",
  write: "purchase:write",
  templateName: "purchase-orders-template",
  template: orderImportTemplate,
  importFile: importPurchaseOrders,
});
