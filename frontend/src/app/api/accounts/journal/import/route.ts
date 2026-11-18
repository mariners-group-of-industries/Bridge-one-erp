import { bulkImportRoute } from "@/lib/bulk-import/route";
import { journalImportTemplate, importJournalVouchers } from "@/features/accounts/server/journal-excel";

/** GET: .xlsx template; POST: bulk-create journal vouchers (one row per GL line, Ref groups lines into one voucher). */
export const { GET, POST } = bulkImportRoute({
  read: "accounts:read",
  write: "accounts:write",
  templateName: "journal-vouchers-template",
  template: journalImportTemplate,
  importFile: importJournalVouchers,
});
