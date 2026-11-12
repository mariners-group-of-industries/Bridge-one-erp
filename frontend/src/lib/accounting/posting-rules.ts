/**
 * Automatic GL posting: which journal each document makes. The rules are pure
 * (document amounts in, balanced lines out); posting.service.ts loads the
 * documents and writes the vouchers. Accounts are named by role (POSTING_KEYS);
 * Accounts › Posting Setup maps each role to a GL account.
 */

export const POSTING_KEYS = {
  RECEIVABLE: "Accounts receivable (customers)",
  SALES_REVENUE: "Sales revenue",
  VAT_PAYABLE: "VAT payable",
  PAYABLE: "Accounts payable (suppliers)",
  INVENTORY: "Inventory",
  COGS: "Cost of goods sold",
  CASH: "Cash in hand",
  BANK: "Bank / card / mobile money",
  PURCHASE_EXPENSE: "Purchase expense (bills without goods)",
  STOCK_ADJUSTMENT: "Stock adjustment & consumption",
  SALARY_EXPENSE: "Salary expense",
  SALARY_PAYABLE: "Salary payable",
} as const;

export type PostingKey = keyof typeof POSTING_KEYS;

/** A journal line by role, or by a GL account the document itself chose. */
export interface RuleLine {
  key?: PostingKey;
  accountId?: string;
  debit: number;
  credit: number;
  narration?: string;
}

export interface Journal {
  date: Date;
  number: string;
  narration: string;
  officeId?: string | null;
  lines: RuleLine[];
}

const r2 = (n: number) => Math.round(n * 100) / 100;
const dr = (key: PostingKey, amount: number, narration?: string): RuleLine => ({ key, debit: r2(amount), credit: 0, narration });
const cr = (key: PostingKey, amount: number, narration?: string): RuleLine => ({ key, debit: 0, credit: r2(amount), narration });

/** Drops zero lines; a journal is balanced when debits equal credits. */
export function clean(lines: RuleLine[]): RuleLine[] {
  return lines.filter((l) => Math.abs(l.debit) > 0.004 || Math.abs(l.credit) > 0.004);
}

export function isBalanced(lines: RuleLine[]): boolean {
  const debit = lines.reduce((t, l) => t + l.debit, 0);
  const credit = lines.reduce((t, l) => t + l.credit, 0);
  return Math.abs(debit - credit) < 0.01 && lines.length >= 2;
}

/** The same journal with debits and credits swapped (a cancelled document). */
export function reverse(lines: RuleLine[]): RuleLine[] {
  return lines.map((l) => ({ ...l, debit: l.credit, credit: l.debit }));
}

/** Sale with goods: receivable (or cash) against revenue and VAT; cost of the goods out of inventory. */
export function saleLines(input: { total: number; vat: number; cost: number; debitKey?: PostingKey }): RuleLine[] {
  const debitKey = input.debitKey ?? "RECEIVABLE";
  return clean([
    dr(debitKey, input.total),
    cr("VAT_PAYABLE", input.vat),
    cr("SALES_REVENUE", input.total - input.vat),
    dr("COGS", input.cost),
    cr("INVENTORY", input.cost),
  ]);
}

/** Money received from a customer: cash/bank (less bank charges) against what the customer owes. */
export function collectionLines(input: {
  amount: number;
  cashAccountId?: string | null;
  method: string;
  adjustAccountId?: string | null;
  deductions: { accountId: string; amount: number }[];
}): RuleLine[] {
  const charges = input.deductions.reduce((t, d) => t + d.amount, 0);
  const received = input.amount - charges;
  const debit: RuleLine = input.cashAccountId
    ? { accountId: input.cashAccountId, debit: r2(received), credit: 0 }
    : dr(input.method === "CASH" ? "CASH" : "BANK", received);
  const credit: RuleLine = input.adjustAccountId ? { accountId: input.adjustAccountId, debit: 0, credit: r2(input.amount) } : cr("RECEIVABLE", input.amount);
  return clean([debit, ...input.deductions.map((d) => ({ accountId: d.accountId, debit: r2(d.amount), credit: 0, narration: "Bank charges" })), credit]);
}

/** Goods received from a supplier: inventory against payable. */
export const receiptLines = (amount: number) => clean([dr("INVENTORY", amount), cr("PAYABLE", amount)]);
/** A bill without goods (services, utilities): expense against payable. */
export const billLines = (amount: number) => clean([dr("PURCHASE_EXPENSE", amount), cr("PAYABLE", amount)]);
/** Paying a supplier: payable against the chosen cash/bank GL account (or default cash/bank role). */
export const supplierPaymentLines = (amount: number, method: string, cashAccountId?: string | null) =>
  clean([
    dr("PAYABLE", amount),
    cashAccountId ? { accountId: cashAccountId, debit: 0, credit: r2(amount) } : cr(method === "CASH" ? "CASH" : "BANK", amount),
  ]);
/** Stock found (+) or lost / used (−), at cost. */
export const stockValueLines = (value: number) =>
  clean(value >= 0 ? [dr("INVENTORY", value), cr("STOCK_ADJUSTMENT", value)] : [dr("STOCK_ADJUSTMENT", -value), cr("INVENTORY", -value)]);
/** A processed payroll: salary expense against salary payable (net pay). */
export const payrollLines = (net: number) => clean([dr("SALARY_EXPENSE", net), cr("SALARY_PAYABLE", net)]);

/** Bangladesh fiscal year (July – June) of a date, as "2026-2027". */
export function fiscalYearOf(date: Date): string {
  const year = date.getUTCFullYear();
  const start = date.getUTCMonth() >= 6 ? year : year - 1;
  return `${start}-${start + 1}`;
}
