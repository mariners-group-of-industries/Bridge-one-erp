import { describe, expect, it } from "vitest";
import { posWorkspace } from "@/features/pos/navigation";
import { saleSchema, saleTotals } from "@/features/pos/schemas/pos.schema";

describe("POS sale totals", () => {
  it("applies line discounts, then the invoice discount, then VAT", () => {
    const totals = saleTotals(
      [
        { qty: 2, rate: 150, discount: 20 }, // 280
        { qty: 1, rate: 100 }, // 100
      ],
      30,
      7.5,
    );
    expect(totals.subtotal).toBe(380);
    expect(totals.taxable).toBe(350);
    expect(totals.vatAmount).toBe(26.25);
    expect(totals.total).toBe(376.25);
  });

  it("never goes below zero", () => {
    expect(saleTotals([{ qty: 1, rate: 50, discount: 80 }], 0, 0).total).toBe(0);
    expect(saleTotals([{ qty: 1, rate: 50 }], 80, 10).total).toBe(0);
  });

  it("rejects a sale without items or with a zero quantity", () => {
    const base = { counterId: "00000000-0000-4000-8000-000000000000", paymentMethod: "CASH" as const, paidAmount: 0 };
    expect(saleSchema.safeParse({ ...base, lines: [] }).success).toBe(false);
    expect(saleSchema.safeParse({ ...base, lines: [{ itemId: base.counterId, qty: 0, rate: 1 }] }).success).toBe(false);
  });
});

describe("POS navigation", () => {
  it("lists the terminal next to the dashboard", () => {
    const links = posWorkspace.cards?.[0]?.links.map((l) => l.href) ?? [];
    expect(links.slice(0, 2)).toEqual(["/pos", "/pos/terminal"]);
  });
});
