/** Rounds to paisa so float noise never reaches the screen. */
export function money(value: number): number {
  return Math.round(value * 100) / 100;
}

export interface CustomerLedger {
  /** Delivered amount whose due date is before the as-of date. */
  pastDue: number;
  /** Delivered amount whose due date is the as-of date. */
  dueToday: number;
  /** Delivered amount due after the as-of date. */
  notYetDue: number;
  /** Collections plus returns up to the as-of date. */
  credits: number;
}

export interface AgedBalance {
  overdue: number;
  dueToday: number;
  /** Outstanding that is not yet overdue (due today included). */
  due: number;
}

/**
 * Ages a customer's balance first-in-first-out: credits settle the oldest
 * due amounts first, so whatever is left in the past-due bucket is overdue.
 */
export function ageBalance({ pastDue, dueToday, notYetDue, credits }: CustomerLedger): AgedBalance {
  const overdue = Math.max(0, pastDue - credits);
  const throughToday = Math.max(0, pastDue + dueToday - credits);
  const total = Math.max(0, pastDue + dueToday + notYetDue - credits);
  return {
    overdue: money(overdue),
    dueToday: money(throughToday - overdue),
    due: money(total - overdue),
  };
}

export interface Totals {
  amount: number;
  qty: number;
}

/** Subtracts returns from deliveries per key; keys only in `returns` are kept as negatives. */
export function netOfReturns(deliveries: Map<string, Totals>, returns: Map<string, Totals>): Map<string, Totals> {
  const net = new Map<string, Totals>();
  for (const [key, value] of deliveries) net.set(key, { ...value });
  for (const [key, value] of returns) {
    const current = net.get(key) ?? { amount: 0, qty: 0 };
    net.set(key, { amount: current.amount - value.amount, qty: current.qty - value.qty });
  }
  return net;
}

/** Keys of the `limit` largest positive amounts, largest first (ties by key for stable output). */
export function topKeys(totals: Map<string, Totals>, limit: number): string[] {
  return [...totals.entries()]
    .filter(([, value]) => value.amount > 0)
    .sort(([keyA, a], [keyB, b]) => b.amount - a.amount || keyA.localeCompare(keyB))
    .slice(0, limit)
    .map(([key]) => key);
}

/** Inclusive list of month starts ("YYYY-MM-01") that a date range touches. */
export function monthStarts(from: string, to: string): string[] {
  const months: string[] = [];
  let year = Number(from.slice(0, 4));
  let month = Number(from.slice(5, 7));
  const lastYear = Number(to.slice(0, 4));
  const lastMonth = Number(to.slice(5, 7));
  while (year < lastYear || (year === lastYear && month <= lastMonth)) {
    months.push(`${year}-${String(month).padStart(2, "0")}-01`);
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  return months;
}
