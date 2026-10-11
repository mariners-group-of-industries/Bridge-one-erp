import { z } from "zod";
import { optionalEmail, optionalPhone, optionalText, requiredText } from "@/lib/validation/fields";

export const officeInputSchema = z.object({
  name: requiredText("Office name", 150),
  address: requiredText("Office address", 500),
  email: optionalEmail("Office email"),
  phone: optionalPhone("Office phone"),
  binNumber: optionalText("BIN number", 30).refine(
    (value) => value === null || /^[A-Za-z0-9-]+$/.test(value),
    { message: "BIN number may contain only letters, digits and hyphens." },
  ),
});

export type OfficeInput = z.input<typeof officeInputSchema>;
export type OfficeData = z.output<typeof officeInputSchema>;

export const warehouseInputSchema = z.object({
  name: requiredText("Warehouse name", 150),
});

export type WarehouseInput = z.infer<typeof warehouseInputSchema>;

export const OFFICE_ASSET_KINDS = ["BRAND_LOGO", "HEADER", "FOOTER"] as const;
export type OfficeAssetKind = (typeof OFFICE_ASSET_KINDS)[number];

export const OFFICE_ASSET_LABELS: Record<OfficeAssetKind, string> = {
  BRAND_LOGO: "Brand logo",
  HEADER: "Header",
  FOOTER: "Footer",
};

/** URL segment <-> enum mapping for asset routes. */
export const ASSET_KIND_SLUGS: Record<OfficeAssetKind, string> = {
  BRAND_LOGO: "brand-logo",
  HEADER: "header",
  FOOTER: "footer",
};

export function assetKindFromSlug(slug: string): OfficeAssetKind | null {
  const entry = Object.entries(ASSET_KIND_SLUGS).find(([, value]) => value === slug);
  return entry ? (entry[0] as OfficeAssetKind) : null;
}

export const ALLOWED_ASSET_MIME_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;
export type AllowedAssetMimeType = (typeof ALLOWED_ASSET_MIME_TYPES)[number];
export const MAX_ASSET_BYTES = 2 * 1024 * 1024;
