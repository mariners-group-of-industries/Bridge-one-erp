import { Router } from "express";
import { purchaseStore } from "../../../data/store.js";

export const supplierPaymentsRouter = Router();

supplierPaymentsRouter.get("/", (req, res) => {
  const { search, status, category } = req.query as any;
  const list = purchaseStore.getSupplierPayments({ search, status, category });
  res.json({
    success: true,
    data: list,
    meta: { total: list.length },
  });
});

supplierPaymentsRouter.get("/invoices", (req, res) => {
  const { search, status, type } = req.query as any;
  const list = purchaseStore.getSupplierInvoices({ search, status, type });
  res.json({
    success: true,
    data: list,
    meta: { total: list.length },
  });
});
