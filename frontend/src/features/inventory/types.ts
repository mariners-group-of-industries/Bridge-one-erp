export interface InventoryKpis {
  totalBalance: number;
  openingBalance: number;
  inventoryOut: number;
  inventoryIn: number;
}

export interface ValuationCategory {
  name: string;
  value: number;
  percentage: number;
  color: string;
}

export interface TransactionValueItem {
  id: number;
  rank: number;
  name: string;
  amount: number;
}

export interface MovingFrequencyItem {
  id: number;
  rank: number;
  name: string;
  category: string;
  frequency: number;
  unit: string;
}

export interface TurnoverRatioItem {
  category: string;
  ratio: number;
  coverageDays: number;
  targetRatio: number;
}
