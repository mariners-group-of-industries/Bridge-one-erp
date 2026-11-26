import { bulkImportRoute } from "@/lib/bulk-import/route";
import { supplierPaymentImportTemplate, importSupplierPayments } from "@/features/purchase/server/supplier-payment-excel";

/** GET: .xlsx template; POST: bulk-create supplier payments (one row per payment). */
export const { GET, POST } = bulkImportRoute({
  read: "purchase:read",
  write: "purchase:write",
  templateName: "supplier-payments-template",
  template: supplierPaymentImportTemplate,
  importFile: importSupplierPayments,
});
