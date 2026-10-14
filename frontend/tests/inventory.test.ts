import { describe, expect, it } from "vitest";
import { inventoryWorkspace } from "@/features/inventory/navigation";
import { paths } from "@/features/inventory/paths";
import { useInventoryStore } from "@/features/inventory/store/inventory-store";
import { findWorkspace } from "@/lib/navigation/registry";

describe("Inventory Navigation & Workspace", () => {
  it("registers inventory workspace as active with 10 direct menu links", () => {
    expect(inventoryWorkspace.id).toBe("inventory");
    expect(inventoryWorkspace.status).toBe("active");
    expect(inventoryWorkspace.href).toBe("/inventory");

    const links = inventoryWorkspace.cards?.[0]?.links ?? [];
    expect(links.length).toBe(10);
    expect(links[0].href).toBe(paths.dashboard);
    expect(links[1].href).toBe(paths.transferRequest);
    expect(links[2].href).toBe(paths.transfer);
    expect(links[3].href).toBe(paths.storeRequisition);
    expect(links[4].href).toBe(paths.storeIssue);
    expect(links[5].href).toBe(paths.stockAdjustment);
    expect(links[6].href).toBe(paths.gateInOut);
    expect(links[7].href).toBe(paths.itemStockConversion);
    expect(links[8].href).toBe(paths.inventoryReports);
    expect(links[9].href).toBe(paths.transferReport);
  });

  it("finds inventory workspace for any inventory route", () => {
    expect(findWorkspace("/inventory")?.id).toBe("inventory");
    expect(findWorkspace("/inventory/transfer-request")?.id).toBe("inventory");
    expect(findWorkspace("/inventory/gate-in-out")?.id).toBe("inventory");
  });
});

describe("Inventory Store Data", () => {
  it("contains initial KPIs matching the screenshot values", () => {
    const state = useInventoryStore.getState();
    expect(state.kpis.totalBalance).toBe(-468631.72);
    expect(state.kpis.openingBalance).toBe(17060438.88);
    expect(state.kpis.inventoryOut).toBe(4698645.86);
    expect(state.kpis.inventoryIn).toBe(4230014.13);
  });

  it("contains top 5 transaction values matching the screenshot", () => {
    const state = useInventoryStore.getState();
    expect(state.topTransactions.length).toBe(5);
    expect(state.topTransactions[0].name).toBe("Receive from Production");
    expect(state.topTransactions[0].amount).toBe(65039272.72);
    expect(state.topTransactions[1].name).toBe("Transfer In");
    expect(state.topTransactions[1].amount).toBe(54679213.56);
    expect(state.topTransactions[2].name).toBe("Purchase");
    expect(state.topTransactions[2].amount).toBe(46585968.07);
    expect(state.topTransactions[3].name).toBe("Opening Balance");
    expect(state.topTransactions[3].amount).toBe(21443147.68);
    expect(state.topTransactions[4].name).toBe("Sales Return");
    expect(state.topTransactions[4].amount).toBe(4210017.61);
  });

  it("contains valuation percentage categories", () => {
    const state = useInventoryStore.getState();
    const raw = state.valuationData.find((d) => d.name === "Raw");
    const mro = state.valuationData.find((d) => d.name === "MRO");
    const fg = state.valuationData.find((d) => d.name === "Finished Goods");
    expect(raw?.percentage).toBe(76.5);
    expect(mro?.percentage).toBe(14.4);
    expect(fg?.percentage).toBe(9.0);
  });
});
