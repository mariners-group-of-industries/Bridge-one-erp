import { describe, expect, it } from "vitest";
import { CreateRequisitionSchema, RequisitionItemSchema } from "@bridgeone/contracts";
import { priceLine, orderTotals } from "@/lib/purchase-store/rules";

describe("Purchase Requisition Validation & Business Rules", () => {
  it("validates a well-formed requisition payload", () => {
    const validPayload = {
      companyId: "comp-bridgeone-01",
      officeId: "87cdeab3-8b0c-43ae-97c0-e324e8892774",
      warehouseId: "d85836c4-1352-4d3b-a8d6-9662e12f9170",
      requestType: "LOCAL",
      department: "Operations",
      requesterName: "Md. Usuf Ali",
      purchaseMethod: "DIRECT",
      requestDate: "2026-11-12",
      requiredDeliveryDate: "2026-11-19",
      businessJustification: "Production maintenance replacement parts",
      remarks: "Urgent delivery requested",
      items: [
        {
          itemId: "afd5eaaf-f405-49c4-b922-e684970bdbe6",
          itemCode: "MT-000049",
          itemName: '1" GI pipe ( 10 Feet )',
          uom: "PCS",
          quantity: 10,
          estimatedUnitPrice: 400,
          lineTotal: 4000,
          remarks: "Line 1 note",
        },
      ],
    };

    const parsed = CreateRequisitionSchema.safeParse(validPayload);
    expect(parsed.success).toBe(true);
  });

  it("fails validation if no items are included", () => {
    const invalidPayload = {
      companyId: "comp-bridgeone-01",
      officeId: "87cdeab3-8b0c-43ae-97c0-e324e8892774",
      warehouseId: "d85836c4-1352-4d3b-a8d6-9662e12f9170",
      requestType: "LOCAL",
      department: "Operations",
      requesterName: "Md. Usuf Ali",
      purchaseMethod: "DIRECT",
      requestDate: "2026-11-12",
      requiredDeliveryDate: "2026-11-19",
      businessJustification: "Operations",
      items: [],
    };

    const parsed = CreateRequisitionSchema.safeParse(invalidPayload);
    expect(parsed.success).toBe(false);
  });

  it("calculates line price correctly with and without discounts", () => {
    const standardLine = priceLine(10, 400);
    expect(standardLine.gross).toBe(4000);
    expect(standardLine.discount).toBe(0);
    expect(standardLine.tax).toBe(0);
    expect(standardLine.lineTotal).toBe(4000);

    const discountedLine = priceLine(10, 400, 10, 5); // 10% discount, 5% VAT
    expect(discountedLine.gross).toBe(4000);
    expect(discountedLine.discount).toBe(400);
    expect(discountedLine.tax).toBe(180);
    expect(discountedLine.lineTotal).toBe(3780);
  });

  it("aggregates totals across multiple requisition lines", () => {
    const lines = [priceLine(5, 200), priceLine(10, 350)];
    const totals = orderTotals(lines);
    expect(totals.subtotal).toBe(4500);
    expect(totals.totalAmount).toBe(4500);
  });
});
