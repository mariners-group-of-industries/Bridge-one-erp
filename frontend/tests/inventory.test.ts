import { describe, expect, it } from "vitest";
import { inventoryWorkspace } from "@/features/inventory/navigation";
import { paths } from "@/features/inventory/paths";
import { INVENTORY_DOC_TYPES } from "@/features/inventory/schemas/document.schema";
import { STOCK_SOURCE_LABELS } from "@/features/inventory/server/overview.service";
import { StockSource } from "@/generated/prisma/enums";
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

describe("Inventory documents and the stock ledger", () => {
  it("keeps each document type on an inventory page of the menu", () => {
    const pages = new Set((inventoryWorkspace.cards?.[0]?.links ?? []).map((l) => l.href));
    for (const slug of Object.keys(INVENTORY_DOC_TYPES)) expect(pages.has(`/inventory/${slug}`)).toBe(true);
  });

  it("names every stock movement shown on the dashboard and reports", () => {
    for (const source of Object.values(StockSource)) expect(STOCK_SOURCE_LABELS[source]).toBeTruthy();
  });
});
