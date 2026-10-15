import { Router } from "express";
import { purchaseStore } from "../../../data/store.js";

export const dashboardRouter = Router();

dashboardRouter.get("/", (req, res) => {
  const { fromDate, toDate, officeId } = req.query as {
    fromDate?: string;
    toDate?: string;
    officeId?: string;
  };

  const analytics = purchaseStore.getDashboardAnalytics({
    fromDate,
    toDate,
    officeId,
  });

  res.json({
    success: true,
    data: analytics,
  });
});
