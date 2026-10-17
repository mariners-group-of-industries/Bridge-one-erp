import { Router } from "express";
import { CreatePurchaseOrderSchema } from "@bridgeone/contracts";
import { purchaseStore } from "../../../data/store.js";
import { AppError } from "../../../middleware/errorHandler.js";

export const ordersRouter = Router();

ordersRouter.get("/", (req, res) => {
  const { officeId, supplierId, status, search, fromDate, toDate } = req.query as any;
  const list = purchaseStore.getPurchaseOrders({
    officeId,
    supplierId,
    status,
    search,
    fromDate,
    toDate,
  });

  res.json({
    success: true,
    data: list,
    meta: { total: list.length },
  });
});

ordersRouter.get("/:id", (req, res) => {
  const po = purchaseStore.getPurchaseOrderById(req.params.id);
  if (!po) {
    throw new AppError(404, "NOT_FOUND", `Purchase Order '${req.params.id}' not found`);
  }
  res.json({ success: true, data: po });
});

ordersRouter.post("/", (req, res) => {
  const validated = CreatePurchaseOrderSchema.parse(req.body);
  const actorName = req.userContext?.name || "Mahfuz Rahman";
  const created = purchaseStore.createPurchaseOrder(validated, actorName);
  res.status(201).json({ success: true, data: created });
});
