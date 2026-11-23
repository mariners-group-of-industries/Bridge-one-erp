import { bulkImportRoute } from "@/lib/bulk-import/route";
import { expenseImportTemplate, importExpenses } from "@/features/accounts/server/expense-excel";

/** GET: .xlsx template; POST: bulk-create expense records (one row per GL line, Ref groups lines into one record). */
export const { GET, POST } = bulkImportRoute({
  read: "accounts:read",
  write: "accounts:write",
  templateName: "expenses-template",
  template: expenseImportTemplate,
  importFile: importExpenses,
});
