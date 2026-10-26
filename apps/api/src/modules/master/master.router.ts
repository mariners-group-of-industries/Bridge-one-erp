import { Router } from "express";
import { purchaseStore } from "../../data/store.js";

export const masterRouter = Router();

masterRouter.get("/context", (req, res) => {
  res.json({
    success: true,
    data: {
      company: {
        id: "comp-bridgeone-01",
        code: "BRG-TECH",
        name: "BridgeOne Technologies Ltd.",
        currency: "BDT",
      },
      user: req.userContext,
    },
  });
});

masterRouter.get("/offices", (req, res) => {
  res.json({ success: true, data: purchaseStore.offices });
});

masterRouter.get("/warehouses", (req, res) => {
  const { officeId } = req.query;
  const filtered = officeId
    ? purchaseStore.warehouses.filter((w) => w.officeId === officeId)
    : purchaseStore.warehouses;
  res.json({ success: true, data: filtered });
});

masterRouter.get("/suppliers", (req, res) => {
  res.json({ success: true, data: purchaseStore.suppliers });
});

masterRouter.get("/items", (req, res) => {
  res.json({ success: true, data: purchaseStore.items });
});
