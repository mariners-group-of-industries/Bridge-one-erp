"use client";

import { useSyncExternalStore } from "react";
import type {
  InventoryKpis,
  ValuationCategory,
  TransactionValueItem,
  MovingFrequencyItem,
  TurnoverRatioItem,
} from "../types";

export interface InventoryState {
  fromDate: string;
  toDate: string;
  warehouseFilter: string;
  valuationMethod: string;
  itemCategoryFilter: string;
  kpis: InventoryKpis;
  valuationData: ValuationCategory[];
  topTransactions: TransactionValueItem[];
  movingFrequencies: MovingFrequencyItem[];
  turnoverRatios: TurnoverRatioItem[];
  setFromDate: (date: string) => void;
  setToDate: (date: string) => void;
  setWarehouseFilter: (wh: string) => void;
  setValuationMethod: (method: string) => void;
  setItemCategoryFilter: (cat: string) => void;
  refreshDashboard: () => void;
}

const defaultState: InventoryState = {
  fromDate: "2026-10-01",
  toDate: "2026-10-13",
  warehouseFilter: "ALL",
  valuationMethod: "FIFO",
  itemCategoryFilter: "ALL",

  kpis: {
    totalBalance: -468631.72,
    openingBalance: 17060438.88,
    inventoryOut: 4698645.86,
    inventoryIn: 4230014.13,
  },

  valuationData: [
    { name: "Raw", value: 76.5, percentage: 76.5, color: "#38effe" },
    { name: "MRO", value: 14.4, percentage: 14.4, color: "#b939e5" },
    { name: "Finished Goods", value: 9.0, percentage: 9.0, color: "#3b82f6" },
    { name: "Asset", value: 0.1, percentage: 0.1, color: "#facc15" },
  ],

  topTransactions: [
    { id: 1, rank: 1, name: "Receive from Production", amount: 65039272.72 },
    { id: 2, rank: 2, name: "Transfer In", amount: 54679213.56 },
    { id: 3, rank: 3, name: "Purchase", amount: 46585968.07 },
    { id: 4, rank: 4, name: "Opening Balance", amount: 21443147.68 },
    { id: 5, rank: 5, name: "Sales Return", amount: 4210017.61 },
  ],

  movingFrequencies: [
    { id: 1, rank: 1, name: "100% Cotton Yarn 30/1", category: "Raw Material", frequency: 1420, unit: "Bales" },
    { id: 2, rank: 2, name: "Reactive Black B Dyes", category: "Chemicals", frequency: 980, unit: "Kg" },
    { id: 3, rank: 3, name: "Corrugated Carton 7-Ply", category: "Packaging", frequency: 845, unit: "Pcs" },
    { id: 4, rank: 4, name: "Spindle Lubricant ISO 68", category: "MRO", frequency: 620, unit: "Liters" },
    { id: 5, rank: 5, name: "Polybag Self-Adhesive", category: "Packaging", frequency: 490, unit: "Pcs" },
  ],

  turnoverRatios: [
    { category: "Raw Materials", ratio: 7.6, coverageDays: 48, targetRatio: 8.0 },
    { category: "Finished Goods", ratio: 11.2, coverageDays: 32, targetRatio: 10.0 },
    { category: "Work in Progress", ratio: 9.1, coverageDays: 40, targetRatio: 9.0 },
    { category: "MRO Spares", ratio: 4.2, coverageDays: 86, targetRatio: 5.0 },
  ],

  setFromDate: (fromDate: string) => updateState({ fromDate }),
  setToDate: (toDate: string) => updateState({ toDate }),
  setWarehouseFilter: (warehouseFilter: string) => updateState({ warehouseFilter }),
  setValuationMethod: (valuationMethod: string) => updateState({ valuationMethod }),
  setItemCategoryFilter: (itemCategoryFilter: string) => updateState({ itemCategoryFilter }),
  refreshDashboard: () => updateState({}),
};

let currentState: InventoryState = { ...defaultState };
const listeners = new Set<() => void>();

function updateState(partial: Partial<InventoryState>) {
  currentState = { ...currentState, ...partial };
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot() {
  return currentState;
}

export function useInventoryStore(): InventoryState {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

useInventoryStore.getState = getSnapshot;
