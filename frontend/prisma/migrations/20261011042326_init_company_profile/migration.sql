-- CreateEnum
CREATE TYPE "DateFormat" AS ENUM ('DD_MM_YYYY_SLASH', 'MM_DD_YYYY_SLASH', 'YYYY_MM_DD_DASH', 'DD_MM_YYYY_DASH');

-- CreateEnum
CREATE TYPE "OfficeAssetKind" AS ENUM ('BRAND_LOGO', 'HEADER', 'FOOTER');

-- CreateEnum
CREATE TYPE "TermsDomain" AS ENUM ('SALES', 'PURCHASE');

-- CreateEnum
CREATE TYPE "TermsDocumentType" AS ENUM ('SALES_QUOTATION', 'SALES_ORDER', 'SALES_DELIVERY', 'PROFORMA_INVOICE', 'REQUEST_FOR_QUOTATION', 'PURCHASE_ORDER', 'PURCHASE_RECEIVE');

-- CreateTable
CREATE TABLE "companies" (
    "id" UUID NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "address" VARCHAR(500) NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_units" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "address" VARCHAR(500) NOT NULL,
    "contactNumber" VARCHAR(30) NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "dateFormat" "DateFormat" NOT NULL DEFAULT 'DD_MM_YYYY_SLASH',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "business_units_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "offices" (
    "id" UUID NOT NULL,
    "businessUnitId" UUID NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "address" VARCHAR(500) NOT NULL,
    "email" VARCHAR(254),
    "phone" VARCHAR(30),
    "binNumber" VARCHAR(30),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "offices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "warehouses" (
    "id" UUID NOT NULL,
    "officeId" UUID NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "warehouses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "office_assets" (
    "id" UUID NOT NULL,
    "officeId" UUID NOT NULL,
    "kind" "OfficeAssetKind" NOT NULL,
    "storageKey" VARCHAR(300) NOT NULL,
    "originalName" VARCHAR(255) NOT NULL,
    "mimeType" VARCHAR(100) NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "office_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "terms_conditions" (
    "id" UUID NOT NULL,
    "businessUnitId" UUID NOT NULL,
    "domain" "TermsDomain" NOT NULL,
    "content" VARCHAR(2000) NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "terms_conditions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "term_applicability" (
    "termId" UUID NOT NULL,
    "documentType" "TermsDocumentType" NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "term_applicability_pkey" PRIMARY KEY ("termId","documentType")
);

-- CreateIndex
CREATE UNIQUE INDEX "companies_name_key" ON "companies"("name");

-- CreateIndex
CREATE UNIQUE INDEX "business_units_companyId_name_key" ON "business_units"("companyId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "offices_businessUnitId_name_key" ON "offices"("businessUnitId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "warehouses_officeId_name_key" ON "warehouses"("officeId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "office_assets_storageKey_key" ON "office_assets"("storageKey");

-- CreateIndex
CREATE UNIQUE INDEX "office_assets_officeId_kind_key" ON "office_assets"("officeId", "kind");

-- CreateIndex
CREATE INDEX "terms_conditions_businessUnitId_domain_sortOrder_idx" ON "terms_conditions"("businessUnitId", "domain", "sortOrder");

-- CreateIndex
CREATE INDEX "term_applicability_documentType_idx" ON "term_applicability"("documentType");

-- AddForeignKey
ALTER TABLE "business_units" ADD CONSTRAINT "business_units_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offices" ADD CONSTRAINT "offices_businessUnitId_fkey" FOREIGN KEY ("businessUnitId") REFERENCES "business_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouses" ADD CONSTRAINT "warehouses_officeId_fkey" FOREIGN KEY ("officeId") REFERENCES "offices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "office_assets" ADD CONSTRAINT "office_assets_officeId_fkey" FOREIGN KEY ("officeId") REFERENCES "offices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "terms_conditions" ADD CONSTRAINT "terms_conditions_businessUnitId_fkey" FOREIGN KEY ("businessUnitId") REFERENCES "business_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "term_applicability" ADD CONSTRAINT "term_applicability_termId_fkey" FOREIGN KEY ("termId") REFERENCES "terms_conditions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
