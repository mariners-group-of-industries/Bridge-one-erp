import { describe, expect, it } from "vitest";
import {
  billLines,
  collectionLines,
  fiscalYearOf,
  isBalanced,
  payrollLines,
  receiptLines,
  reverse,
  saleLines,
  stockValueLines,
  supplierPaymentLines,
  type RuleLine,
} from "@/lib/accounting/posting-rules";

const total = (lines: RuleLine[], side: "debit" | "credit") => Math.round(lines.reduce((t, l) => t + l[side], 0) * 100) / 100;
const byKey = (lines: RuleLine[]) => Object.fromEntries(lines.map((l) => [l.key ?? l.accountId, l.debit - l.credit]));

describe("automatic GL posting rules", () => {
  it("posts a sale as receivable against revenue and VAT, with cost of goods out of inventory", () => {
    const lines = saleLines({ total: 1150, vat: 150, cost: 600 });
    expect(isBalanced(lines)).toBe(true);
    expect(byKey(lines)).toEqual({ RECEIVABLE: 1150, VAT_PAYABLE: -150, SALES_REVENUE: -1000, COGS: 600, INVENTORY: -600 });
  });

  it("posts a cash POS sale to cash instead of receivable", () => {
    expect(byKey(saleLines({ total: 500, vat: 0, cost: 0, debitKey: "CASH" }))).toEqual({ CASH: 500, SALES_REVENUE: -500 });
  });

  it("reverses a journal for returns and cancellations", () => {
    const lines = saleLines({ total: 1150, vat: 150, cost: 600 });
    const reversed = reverse(lines);
    expect(isBalanced(reversed)).toBe(true);
    expect(byKey(reversed).RECEIVABLE).toBe(-1150);
    expect(byKey(reversed).INVENTORY).toBe(600);
  });

  it("posts a collection net of bank charges to the chosen cash account", () => {
    const lines = collectionLines({ amount: 1000, method: "BANK", cashAccountId: "acc-bank", adjustAccountId: null, deductions: [{ accountId: "acc-charges", amount: 25 }] });
    expect(isBalanced(lines)).toBe(true);
    expect(byKey(lines)).toEqual({ "acc-bank": 975, "acc-charges": 25, RECEIVABLE: -1000 });
  });

  it("falls back to the cash or bank role when the collection has no cash account", () => {
    expect(byKey(collectionLines({ amount: 300, method: "CASH", deductions: [] }))).toEqual({ CASH: 300, RECEIVABLE: -300 });
  });

  it("posts purchases, bills and supplier payments against payables", () => {
    expect(byKey(receiptLines(800))).toEqual({ INVENTORY: 800, PAYABLE: -800 });
    expect(byKey(billLines(120))).toEqual({ PURCHASE_EXPENSE: 120, PAYABLE: -120 });
    expect(byKey(supplierPaymentLines(500, "CHEQUE"))).toEqual({ PAYABLE: 500, BANK: -500 });
    expect(byKey(supplierPaymentLines(50, "CASH"))).toEqual({ PAYABLE: 50, CASH: -50 });
  });

  it("posts stock gains and losses at cost", () => {
    expect(byKey(stockValueLines(40))).toEqual({ INVENTORY: 40, STOCK_ADJUSTMENT: -40 });
    expect(byKey(stockValueLines(-40))).toEqual({ STOCK_ADJUSTMENT: 40, INVENTORY: -40 });
  });

  it("posts payroll and skips zero amounts", () => {
    expect(total(payrollLines(25000), "debit")).toBe(25000);
    expect(isBalanced(payrollLines(0))).toBe(false);
    expect(saleLines({ total: 100, vat: 0, cost: 0 })).toHaveLength(2);
  });

  it("uses the July–June fiscal year", () => {
    expect(fiscalYearOf(new Date(Date.UTC(2026, 6, 1)))).toBe("2026-2027");
    expect(fiscalYearOf(new Date(Date.UTC(2026, 5, 30)))).toBe("2025-2026");
  });
});
