export const openApiSpec = {
  openapi: "3.0.3",
  info: {
    title: "BridgeOne ERP - Purchase Management API",
    version: "1.0.0",
    description: "Complete REST API for BridgeOne ERP Purchase Management Module, covering Requisitions, Orders, Goods Receipt (GRN), Returns, Supplier Payments, Analytics, and Reports.",
  },
  servers: [
    {
      url: "http://localhost:4000/api/v1",
      description: "Local Development Server",
    },
  ],
  paths: {
    "/master/context": {
      get: { summary: "Get ERP tenant company and authenticated user context" },
    },
    "/master/offices": {
      get: { summary: "List available company branches/offices" },
    },
    "/master/warehouses": {
      get: { summary: "List warehouses, optionally filtered by officeId" },
    },
    "/master/suppliers": {
      get: { summary: "List approved vendor and supplier directory" },
    },
    "/master/items": {
      get: { summary: "List item catalog with standard pricing and UOM" },
    },
    "/purchase/dashboard": {
      get: { summary: "Purchase dashboard KPIs, charts, and pending approvals" },
    },
    "/purchase/requisitions": {
      get: { summary: "List purchase requisitions with multi-criteria filtering" },
      post: { summary: "Create new purchase requisition and submit for approval" },
    },
    "/purchase/requisitions/{id}/approve": {
      post: { summary: "Approve a submitted requisition" },
    },
    "/purchase/orders": {
      get: { summary: "List purchase orders" },
      post: { summary: "Create new purchase order from requisition or direct" },
    },
    "/purchase/receipts": {
      get: { summary: "List Goods Receipt Notes (GRN)" },
      post: { summary: "Process goods receipt, validate quantities, sync stock" },
    },
    "/purchase/receipts/approved-orders": {
      get: { summary: "List approved POs awaiting goods receipt" },
    },
    "/purchase/returns": {
      get: { summary: "List purchase returns" },
      post: { summary: "Create purchase return, validate returnable qty, sync reversal" },
    },
    "/purchase/supplier-payments": {
      get: { summary: "Supplier payable balances, due list, and payments" },
    },
    "/purchase/supplier-payments/invoices": {
      get: { summary: "Supplier invoices list" },
    },
    "/purchase/analytics": {
      get: { summary: "Deep procurement analytics and cycle time metrics" },
    },
    "/purchase/reports": {
      get: { summary: "Execute structured reports with filters" },
    },
    "/purchase/reports/export-csv": {
      get: { summary: "Download report as CSV stream" },
    },
    "/integrations/status": {
      get: { summary: "Get status of external ERP module adapters (Inventory, Finance, HR)" },
    },
    "/integrations/audit-logs": {
      get: { summary: "Retrieve audit timeline records" },
    },
  },
};
