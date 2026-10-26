/** Business overview on the home page, built only from data in the database. */

export interface Named {
  name: string;
  value: number;
}

export interface StockPoint {
  /** "2026-09-21" (daily) or "2026-09" (monthly when the history is long). */
  period: string;
  /** Units received (opening, purchases, returns, adjustments in). */
  inQty: number;
  /** Units dispatched (deliveries, adjustments out), as a positive number. */
  outQty: number;
  /** Units returned by customers (part of inQty). */
  returnQty: number;
  /** Units on hand at the end of the period. */
  balance: number;
}

export interface ItemStock {
  name: string;
  qty: number;
  /** qty × sales rate. */
  value: number;
  salesRate: number;
  mrp: number | null;
}

export interface SalesMonth {
  month: string;
  sales: number;
  returns: number;
  collections: number;
  purchases: number;
}

export interface BusinessOverview {
  counts: { customers: number; suppliers: number; items: number; employees: number; warehouses: number; priceLists: number };

  inventory: {
    units: number;
    value: number;
    /** Daily / monthly movement with running balance. */
    movement: StockPoint[];
    byItem: ItemStock[];
    byCategory: Named[];
    byWarehouse: Named[];
  };

  /** Latest month that has targets. */
  targets: { month: string | null; total: number; byPerson: Named[] };

  customers: { byGroup: Named[]; byTerritory: Named[] };
  /** Average rate of each price list. */
  priceLists: Named[];
  employees: { byOffice: Named[]; byDesignation: Named[] };

  /** Only for actors who may read Accounts; null otherwise. */
  finance: {
    balances: Named[];
    budget: { allocated: number; utilized: number; committed: number; remaining: number; count: number } | null;
  } | null;

  /** Present only when sales / purchase documents exist (last 12 months). */
  trading: SalesMonth[] | null;
}
