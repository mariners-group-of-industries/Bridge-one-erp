import { Router } from "express";
import { ReportQuerySchema } from "@bridgeone/contracts";
import { purchaseStore } from "../../../data/store.js";

export const reportsRouter = Router();

reportsRouter.get("/", (req, res) => {
  const query = ReportQuerySchema.parse({
    reportType: req.query.reportType || "REQUISITION_REPORT",
    officeId: req.query.officeId,
    supplierId: req.query.supplierId,
    fromDate: req.query.fromDate,
    toDate: req.query.toDate,
    status: req.query.status,
    isSummary: req.query.isSummary === "true",
  });

  const report = purchaseStore.generateReport(query);
  res.json({ success: true, data: report });
});

reportsRouter.get("/export-csv", (req, res) => {
  const query = ReportQuerySchema.parse({
    reportType: req.query.reportType || "REQUISITION_REPORT",
    officeId: req.query.officeId,
    supplierId: req.query.supplierId,
    fromDate: req.query.fromDate,
    toDate: req.query.toDate,
    status: req.query.status,
    isSummary: req.query.isSummary === "true",
  });

  const report = purchaseStore.generateReport(query);

  // Convert to CSV format
  const headers = report.columns.join(",");
  const rows = report.rows.map((row) =>
    report.columns
      .map((col) => {
        const val = row[col] !== undefined ? String(row[col]) : "";
        return `"${val.replace(/"/g, '""')}"`;
      })
      .join(",")
  );

  const csvContent = [headers, ...rows].join("\r\n");

  res.setHeader("Content-Type", "text/csv");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${report.reportType.toLowerCase()}_${Date.now()}.csv"`
  );
  res.status(200).send(csvContent);
});
