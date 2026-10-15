import express from "express";
import cors from "cors";
import { requestLogger } from "./middleware/requestLogger.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { authContextMiddleware } from "./middleware/authContext.js";

import { masterRouter } from "./modules/master/master.router.js";
import { dashboardRouter } from "./modules/purchase/dashboard/dashboard.router.js";
import { requisitionsRouter } from "./modules/purchase/requisitions/requisitions.router.js";
import { ordersRouter } from "./modules/purchase/orders/orders.router.js";
import { receiveRouter } from "./modules/purchase/receive/receive.router.js";
import { returnsRouter } from "./modules/purchase/returns/returns.router.js";
import { supplierPaymentsRouter } from "./modules/purchase/supplier-payments/supplierPayments.router.js";
import { analyticsRouter } from "./modules/purchase/analytics/analytics.router.js";
import { reportsRouter } from "./modules/purchase/reports/reports.router.js";
import { integrationsRouter } from "./modules/integrations/integrations.router.js";
import { openApiSpec } from "./docs/openapi.js";

export function createApp() {
  const app = express();

  // Basic security and parsing middleware
  app.use(cors());
  app.use(express.json());
  app.use(requestLogger);
  app.use(authContextMiddleware);

  // Health check
  app.get("/health", (req, res) => {
    res.json({
      status: "ok",
      app: "BridgeOne ERP - Purchase Management API",
      timestamp: new Date().toISOString(),
    });
  });

  // OpenAPI spec
  app.get("/api/v1/openapi.json", (req, res) => {
    res.json(openApiSpec);
  });

  // API v1 routes
  const v1 = express.Router();
  v1.use("/master", masterRouter);
  v1.use("/purchase/dashboard", dashboardRouter);
  v1.use("/purchase/requisitions", requisitionsRouter);
  v1.use("/purchase/orders", ordersRouter);
  v1.use("/purchase/receipts", receiveRouter);
  v1.use("/purchase/returns", returnsRouter);
  v1.use("/purchase/supplier-payments", supplierPaymentsRouter);
  v1.use("/purchase/analytics", analyticsRouter);
  v1.use("/purchase/reports", reportsRouter);
  v1.use("/integrations", integrationsRouter);

  app.use("/api/v1", v1);

  // Centralized Error Handler
  app.use(errorHandler);

  return app;
}
