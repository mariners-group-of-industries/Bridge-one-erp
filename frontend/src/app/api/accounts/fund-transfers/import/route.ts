import { bulkImportRoute } from "@/lib/bulk-import/route";
import { fundTransferImportTemplate, importFundTransfers } from "@/features/accounts/server/fund-transfer-excel";

/** GET: .xlsx template; POST: bulk-create fund transfer requests (saved as SUBMITTED). */
export const { GET, POST } = bulkImportRoute({
  read: "accounts:read",
  write: "accounts:write",
  templateName: "fund-transfers-template",
  template: fundTransferImportTemplate,
  importFile: importFundTransfers,
});
