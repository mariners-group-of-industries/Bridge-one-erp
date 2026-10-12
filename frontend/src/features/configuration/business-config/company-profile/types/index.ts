import type { DateFormat } from "../schemas/business-unit.schema";
import type { AllowedAssetMimeType, OfficeAssetKind } from "../schemas/office.schema";
import type { TermsDocumentType, TermsDomain } from "../schemas/terms.schema";

// API data-transfer objects (dates serialised as ISO strings).

export interface CompanyDto {
  id: string;
  name: string;
  address: string;
  email: string;
  updatedAt: string;
}

export interface BusinessUnitDto {
  id: string;
  companyId: string;
  name: string;
  address: string;
  contactNumber: string;
  email: string;
  dateFormat: DateFormat;
  officeCount: number;
  updatedAt: string;
}

export interface OfficeAssetDto {
  kind: OfficeAssetKind;
  originalName: string;
  mimeType: AllowedAssetMimeType | string;
  sizeBytes: number;
  url: string;
  updatedAt: string;
}

export interface OfficeDto {
  id: string;
  businessUnitId: string;
  name: string;
  address: string;
  email: string | null;
  phone: string | null;
  binNumber: string | null;
  warehouseCount: number;
  assets: OfficeAssetDto[];
  updatedAt: string;
}

export interface WarehouseDto {
  id: string;
  officeId: string;
  name: string;
  updatedAt: string;
}

export interface TermDto {
  id: string;
  businessUnitId: string;
  domain: TermsDomain;
  content: string;
  isDefault: boolean;
  sortOrder: number;
  documentTypes: TermsDocumentType[];
  updatedAt: string;
}
