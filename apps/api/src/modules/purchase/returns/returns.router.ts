import { Router } from "express";
import { CreatePurchaseReturnSchema } from "@bridgeone/contracts";
import { purchaseStore } from "../../../data/store.js";

export const returnsRouter = Router();

returnsRouter.get("/", (req, res) => {
  const { search, status } = req.query as any;
  const list = purchaseStore.getPurchaseReturns({ search, status });
  res.json({
    success: true,
    data: list,
    meta: { total: list.length },
  });
});

returnsRouter.get("/eligible-receipts", (req, res) => {
  const list = purchaseStore.getEligibleReceiptsForReturn();
  res.json({
    success: true,
    data: list,
    meta: { total: list.length },
  });
});

returnsRouter.post("/", async (req, res, next) => {
  try {
    const validated = CreatePurchaseReturnSchema.parse(req.body);
    const actorName = req.userContext?.name || "Nurul Huda";
    const pr = await purchaseStore.createPurchaseReturn(validated, actorName);
    res.status(201).json({ success: true, data: pr });
  } catch (err) {
    next(err);
  }
});
