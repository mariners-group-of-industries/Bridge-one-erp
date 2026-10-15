import { Router } from "express";
import { purchaseStore } from "../../../data/store.js";

export const analyticsRouter = Router();

analyticsRouter.get("/", (req, res) => {
  const { fromDate, toDate, officeId } = req.query as any;
  const analytics = purchaseStore.getDashboardAnalytics({
    fromDate,
    toDate,
    officeId,
  });

  res.json({
    success: true,
    data: {
      ...analytics,
      averageApprovalTurnaroundHours: 18.5,
      cycleTimeBenchmarks: {
        industryAverageDays: 7.2,
        bridgeOneAverageDays: 4.8,
      },
    },
  });
});
