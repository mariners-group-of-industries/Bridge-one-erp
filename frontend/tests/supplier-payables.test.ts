import { describe, expect, it } from "vitest";
import { allocateCredits, type PayableDocument } from "@/lib/purchase-store/payables";

const doc = (key: string, supplierId: string, day: number, amount: number): PayableDocument => ({
  key,
  supplierId,
  date: new Date(Date.UTC(2026, 10, day)),
  amount,
});

describe("supplier payables allocation", () => {
  const docs = [doc("R:old", "s1", 1, 1000), doc("R:new", "s1", 5, 500), doc("B:other", "s2", 2, 300)];

  it("settles the oldest open document first", () => {
    const { paidByDocument, unappliedBySupplier } = allocateCredits(docs, [{ supplierId: "s1", amount: 1200, documentKey: null }]);
    expect(paidByDocument.get("R:old")).toBe(1000);
    expect(paidByDocument.get("R:new")).toBe(200);
    expect(unappliedBySupplier.get("s1")).toBe(0);
  });

  it("settles a linked document before older ones", () => {
    const { paidByDocument } = allocateCredits(docs, [{ supplierId: "s1", amount: 500, documentKey: "R:new" }]);
    expect(paidByDocument.get("R:new")).toBe(500);
    expect(paidByDocument.get("R:old")).toBe(0);
  });

  it("keeps what no document needs as the supplier's advance", () => {
    const { paidByDocument, unappliedBySupplier } = allocateCredits(docs, [
      { supplierId: "s1", amount: 700, documentKey: "R:new" },
      { supplierId: "s1", amount: 1000, documentKey: null },
    ]);
    expect(paidByDocument.get("R:new")).toBe(500);
    expect(paidByDocument.get("R:old")).toBe(1000);
    expect(unappliedBySupplier.get("s1")).toBe(200);
  });

  it("never applies one supplier's credit to another supplier", () => {
    const { paidByDocument, unappliedBySupplier } = allocateCredits(docs, [{ supplierId: "s2", amount: 2000, documentKey: null }]);
    expect(paidByDocument.get("R:old")).toBe(0);
    expect(paidByDocument.get("B:other")).toBe(300);
    expect(unappliedBySupplier.get("s2")).toBe(1700);
  });
});
