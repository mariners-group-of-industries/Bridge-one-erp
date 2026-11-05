const ROOT = "/rtm";

export const rtmPaths = {
  workspace: ROOT,
  // Dashboards
  salesExecutiveDashboard: `${ROOT}/sales-executive-dashboard`,
  distributorDashboard: `${ROOT}/distributor-dashboard`,
  dashboard: `${ROOT}/dashboard`,
  // Sales transactions
  retailOrder: `${ROOT}/retail-order`,
  delivery: `${ROOT}/delivery`,
  collection: `${ROOT}/collection`,
  salesReturn: `${ROOT}/sales-return`,
  directDelivery: `${ROOT}/direct-delivery`,
  // Distributor stock
  stockTransferRequest: `${ROOT}/distributor-stock-transfer-request`,
  stockTransferIssue: `${ROOT}/distributor-stock-transfer-issue`,
  stockAdjustment: `${ROOT}/distributor-stock-adjustment`,
  // Field force
  srCalendarSetup: `${ROOT}/sr-calendar-setup`,
  tourPlanSetup: `${ROOT}/tour-plan-setup`,
  salesLayerTransfer: `${ROOT}/sales-layer-transfer`,
  employeeTracking: `${ROOT}/employee-tracking`,
  outletTracking: `${ROOT}/outlet-tracking`,
  // Setup
  outletSetup: `${ROOT}/outlet-setup`,
  distributionChannel: `${ROOT}/distribution-channel`,
  offerAndDiscount: `${ROOT}/offer-and-discount`,
  salesTarget: `${ROOT}/sales-target`,
  configuration: `${ROOT}/configuration`,
  // Reports
  salesAnalytics: `${ROOT}/sales-analytics`,
  outletLedger: `${ROOT}/outlet-ledger`,
} as const;
