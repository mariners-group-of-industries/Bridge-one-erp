import { describe, expect, it } from "vitest";
import { businessUnitInputSchema } from "@/features/configuration/business-config/company-profile/schemas/business-unit.schema";
import { companyInputSchema } from "@/features/configuration/business-config/company-profile/schemas/company.schema";
import { officeInputSchema } from "@/features/configuration/business-config/company-profile/schemas/office.schema";
import {
  createTermSchema,
  updateTermSchema,
} from "@/features/configuration/business-config/company-profile/schemas/terms.schema";
import { sniffImageType } from "@/features/configuration/business-config/company-profile/server/office-asset.service";
import { businessUnitInput } from "./helpers/fixtures";

describe("company schema", () => {
  it("trims values and validates email format and lengths", () => {
    expect(
      companyInputSchema.parse({ name: "  Acme  ", address: " Dhaka ", email: " a@b.co " }),
    ).toEqual({ name: "Acme", address: "Dhaka", email: "a@b.co" });

    expect(companyInputSchema.safeParse({ name: "Acme", address: "x", email: "nope" }).success).toBe(false);
    expect(
      companyInputSchema.safeParse({ name: "x".repeat(151), address: "x", email: "a@b.co" }).success,
    ).toBe(false);
  });
});

describe("business unit schema", () => {
  it("accepts supported date formats and phone numbers only", () => {
    expect(businessUnitInputSchema.safeParse(businessUnitInput).success).toBe(true);
    expect(
      businessUnitInputSchema.safeParse({ ...businessUnitInput, dateFormat: "DD.MM.YYYY" }).success,
    ).toBe(false);
    expect(
      businessUnitInputSchema.safeParse({ ...businessUnitInput, contactNumber: "call me" }).success,
    ).toBe(false);
  });
});

describe("office schema", () => {
  it("normalises empty optional fields to null", () => {
    expect(
      officeInputSchema.parse({ name: "HO", address: "Dhaka", email: "", phone: "  ", binNumber: undefined }),
    ).toEqual({ name: "HO", address: "Dhaka", email: null, phone: null, binNumber: null });
  });

  it("validates optional fields when present", () => {
    expect(officeInputSchema.safeParse({ name: "HO", address: "D", email: "bad" }).success).toBe(false);
    expect(officeInputSchema.safeParse({ name: "HO", address: "D", binNumber: "12 34" }).success).toBe(false);
  });
});

describe("terms schemas", () => {
  it("defaults flags and enforces domain/document-type consistency", () => {
    expect(createTermSchema.parse({ domain: "SALES", content: "Pay on time" })).toEqual({
      domain: "SALES",
      content: "Pay on time",
      isDefault: false,
      documentTypes: [],
    });
    expect(
      createTermSchema.safeParse({ domain: "SALES", content: "x", documentTypes: ["PURCHASE_ORDER"] })
        .success,
    ).toBe(false);
    expect(
      createTermSchema.safeParse({
        domain: "SALES",
        content: "x",
        documentTypes: ["SALES_ORDER", "SALES_ORDER"],
      }).success,
    ).toBe(false);
  });

  it("rejects empty patches", () => {
    expect(updateTermSchema.safeParse({}).success).toBe(false);
    expect(updateTermSchema.safeParse({ isDefault: true }).success).toBe(true);
  });
});

describe("image sniffing", () => {
  it("detects PNG, JPEG and WebP signatures and rejects others", () => {
    expect(sniffImageType(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe("image/png");
    expect(sniffImageType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe("image/jpeg");
    expect(
      sniffImageType(new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50])),
    ).toBe("image/webp");
    expect(sniffImageType(new TextEncoder().encode("<svg></svg>"))).toBeNull();
  });
});
