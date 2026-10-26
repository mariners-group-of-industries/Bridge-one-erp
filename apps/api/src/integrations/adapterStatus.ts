import { ExternalModuleAdapterStatus } from "@bridgeone/contracts";

export const integrationStatusRegistry: Record<string, ExternalModuleAdapterStatus> = {
  INVENTORY: {
    module: "INVENTORY",
    status: (process.env.INVENTORY_SERVICE_STATUS as any) || "SIMULATED",
    description: "Inventory & Warehouse Stock Movement Interface (Stock Card / Inward Movement)",
    lastPingTimestamp: new Date().toISOString(),
  },
  FINANCE: {
    module: "FINANCE",
    status: (process.env.FINANCE_SERVICE_STATUS as any) || "SIMULATED",
    description: "Finance & Accounts Payable Ledger Interface (Vendor Bills, Debit/Credit Notes)",
    lastPingTimestamp: new Date().toISOString(),
  },
  HR: {
    module: "HR",
    status: (process.env.HR_SERVICE_STATUS as any) || "SIMULATED",
    description: "Human Resources Employee & Approval Hierarchy Interface",
    lastPingTimestamp: new Date().toISOString(),
  },
  AUTHENTICATION: {
    module: "AUTHENTICATION",
    status: "LIVE",
    description: "BridgeOne ERP Enterprise Session & Identity Provider",
    lastPingTimestamp: new Date().toISOString(),
  },
};
