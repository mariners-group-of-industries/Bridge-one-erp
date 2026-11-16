export const paths = {
  dashboard: "/accounts",
  chartOfAccounts: "/accounts/chart-of-accounts",
  journal: "/accounts/journal",
  expenses: "/accounts/expenses",
  fundTransfers: "/accounts/fund-transfers",
  banking: "/accounts/banking",
  chequeSetup: "/accounts/cheque-setup",
  chequeIssue: "/accounts/cheque-issue",
  budget: "/accounts/budget",
  centerSetup: "/accounts/center-setup",
  financialReports: "/accounts/financial-reports",
  otherReports: "/accounts/other-reports",
  postingSetup: "/accounts/posting-setup",
} as const;

/** The page whose permission a banking API record needs: cheques have their own pages. */
export function bankingFeatureOf(entityType: unknown): string {
  if (entityType === "chequeBook" || entityType === "receivedCheque") return paths.chequeSetup;
  if (entityType === "chequeIssue") return paths.chequeIssue;
  return paths.banking;
}
