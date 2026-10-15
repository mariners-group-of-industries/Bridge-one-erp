import { Router } from "express";
import { integrationStatusRegistry } from "../../integrations/adapterStatus.js";
import { AuditService } from "../../integrations/auditLogger.js";

export const integrationsRouter = Router();

integrationsRouter.get("/status", (req, res) => {
  res.json({
    success: true,
    data: Object.values(integrationStatusRegistry),
  });
});

integrationsRouter.get("/audit-logs", (req, res) => {
  const { entityType, entityId } = req.query as {
    entityType?: string;
    entityId?: string;
  };
  const logs = AuditService.getHistory(entityType, entityId);
  res.json({ success: true, data: logs });
});
