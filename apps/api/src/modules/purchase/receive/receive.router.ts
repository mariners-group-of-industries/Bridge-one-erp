import { Router } from "express";
import { CreateGoodsReceiptSchema } from "@bridgeone/contracts";
import { purchaseStore } from "../../../data/store.js";
import { AppError } from "../../../middleware/errorHandler.js";

export const receiveRouter = Router();

// List of all received GRNs
receiveRouter.get("/", (req, res) => {
  const { search, status } = req.query as any;
  const list = purchaseStore.getGoodsReceipts({ search, status });
  res.json({
    success: true,
    data: list,
    meta: { total: list.length },
  });
});

// List of approved POs awaiting goods receipt
receiveRouter.get("/approved-orders", (req, res) => {
  const list = purchaseStore.getApprovedOrdersForReceiving();
  res.json({
    success: true,
    data: list,
    meta: { total: list.length },
  });
});

receiveRouter.post("/", async (req, res, next) => {
  try {
    const validated = CreateGoodsReceiptSchema.parse(req.body);
    const actorName = req.userContext?.name || "Nurul Huda";
    const grn = await purchaseStore.createGoodsReceipt(validated, actorName);
    res.status(201).json({ success: true, data: grn });
  } catch (err) {
    next(err);
  }
});
