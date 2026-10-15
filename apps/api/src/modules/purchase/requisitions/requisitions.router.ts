import { Router } from "express";
import { CreateRequisitionSchema } from "@bridgeone/contracts";
import { purchaseStore } from "../../../data/store.js";
import { AppError } from "../../../middleware/errorHandler.js";

export const requisitionsRouter = Router();

requisitionsRouter.get("/", (req, res) => {
  const { officeId, warehouseId, status, search, fromDate, toDate, requestType, section, buyerOfficeId } = req.query as any;
  const list = purchaseStore.getRequisitions({
    officeId,
    warehouseId,
    status,
    search,
    fromDate,
    toDate,
    requestType,
    section,
    buyerOfficeId,
  });

  res.json({
    success: true,
    data: list,
    meta: { total: list.length },
  });
});

requisitionsRouter.get("/:id", (req, res) => {
  const item = purchaseStore.getRequisitionById(req.params.id);
  if (!item) {
    throw new AppError(404, "NOT_FOUND", `Requisition '${req.params.id}' not found`);
  }
  res.json({ success: true, data: item });
});

requisitionsRouter.post("/", (req, res) => {
  const validated = CreateRequisitionSchema.parse(req.body);
  const actorName = req.userContext?.name || "Mahfuz Rahman";
  const created = purchaseStore.createRequisition(validated, actorName);
  res.status(201).json({ success: true, data: created });
});

requisitionsRouter.post("/:id/approve", (req, res) => {
  const { comments } = req.body || {};
  const actorName = req.userContext?.name || "Purchase Manager";
  const updated = purchaseStore.updateRequisitionStatus(
    req.params.id,
    "APPROVE",
    actorName,
    comments
  );
  res.json({ success: true, data: updated });
});

requisitionsRouter.post("/:id/reject", (req, res) => {
  const { comments } = req.body || {};
  const actorName = req.userContext?.name || "Purchase Manager";
  const updated = purchaseStore.updateRequisitionStatus(
    req.params.id,
    "REJECT",
    actorName,
    comments
  );
  res.json({ success: true, data: updated });
});

requisitionsRouter.post("/:id/cancel", (req, res) => {
  const { comments } = req.body || {};
  const actorName = req.userContext?.name || "Purchase Manager";
  const updated = purchaseStore.updateRequisitionStatus(
    req.params.id,
    "CANCEL",
    actorName,
    comments
  );
  res.json({ success: true, data: updated });
});

requisitionsRouter.put("/:id", (req, res) => {
  const actorName = req.userContext?.name || "Mahfuz Rahman";
  const updated = purchaseStore.updateRequisition(req.params.id, req.body, actorName);
  res.json({ success: true, data: updated });
});

requisitionsRouter.post("/:id/reverse", (req, res) => {
  const { comments } = req.body || {};
  const actorName = req.userContext?.name || "Purchase Manager";
  const updated = purchaseStore.updateRequisitionStatus(
    req.params.id,
    "REVERSE",
    actorName,
    comments || "Requisition reversed to submitted status."
  );
  res.json({ success: true, data: updated });
});

