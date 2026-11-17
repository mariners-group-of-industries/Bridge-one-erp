import { bulkImportRoute } from "@/lib/bulk-import/route";
import { budgetImportTemplate, importBudgets } from "@/features/accounts/server/budget-excel";

/** GET: .xlsx template; POST: bulk-create budgets (one row per budget). */
export const { GET, POST } = bulkImportRoute({
  read: "accounts:read",
  write: "accounts:write",
  templateName: "budgets-template",
  template: budgetImportTemplate,
  importFile: importBudgets,
});
