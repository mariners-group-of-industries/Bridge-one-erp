-- CreateEnum
CREATE TYPE "QuotationStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'ORDERED', 'LOST', 'CANCELLED');

-- CreateTable
CREATE TABLE "document_sequences" (
    "businessUnitId" UUID NOT NULL,
    "docType" VARCHAR(40) NOT NULL,
    "year" INTEGER NOT NULL,
    "lastNumber" INTEGER NOT NULL,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "document_sequences_pkey" PRIMARY KEY ("businessUnitId","docType","year")
);

-- CreateTable
CREATE TABLE "sales_quotations" (
    "id" UUID NOT NULL,
    "businessUnitId" UUID NOT NULL,
    "officeId" UUID NOT NULL,
    "number" VARCHAR(30) NOT NULL,
    "customerId" UUID NOT NULL,
    "salesPersonId" UUID,
    "quotationDate" DATE NOT NULL,
    "validTill" DATE NOT NULL,
    "status" "QuotationStatus" NOT NULL DEFAULT 'DRAFT',
    "contactMobile" VARCHAR(30),
    "remarks" VARCHAR(500),
    "terms" VARCHAR(4000),
    "totalQty" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "subTotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "discountAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "vatPercent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "vatAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "grandTotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "lostReason" VARCHAR(500),
    "submittedAt" TIMESTAMPTZ(3),
    "cancelledAt" TIMESTAMPTZ(3),
    "createdBy" VARCHAR(100) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "sales_quotations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_quotation_lines" (
    "id" UUID NOT NULL,
    "quotationId" UUID NOT NULL,
    "lineNo" INTEGER NOT NULL,
    "itemId" UUID NOT NULL,
    "description" VARCHAR(500),
    "uom" VARCHAR(20) NOT NULL,
    "qty" DECIMAL(14,3) NOT NULL,
    "rate" DECIMAL(14,2) NOT NULL,
    "discountPercent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "amount" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "sales_quotation_lines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sales_quotations_businessUnitId_quotationDate_idx" ON "sales_quotations"("businessUnitId", "quotationDate");

-- CreateIndex
CREATE INDEX "sales_quotations_officeId_status_quotationDate_idx" ON "sales_quotations"("officeId", "status", "quotationDate");

-- CreateIndex
CREATE INDEX "sales_quotations_customerId_idx" ON "sales_quotations"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "sales_quotations_businessUnitId_number_key" ON "sales_quotations"("businessUnitId", "number");

-- CreateIndex
CREATE INDEX "sales_quotation_lines_itemId_idx" ON "sales_quotation_lines"("itemId");

-- CreateIndex
CREATE UNIQUE INDEX "sales_quotation_lines_quotationId_lineNo_key" ON "sales_quotation_lines"("quotationId", "lineNo");

-- AddForeignKey
ALTER TABLE "document_sequences" ADD CONSTRAINT "document_sequences_businessUnitId_fkey" FOREIGN KEY ("businessUnitId") REFERENCES "business_units"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_quotations" ADD CONSTRAINT "sales_quotations_businessUnitId_fkey" FOREIGN KEY ("businessUnitId") REFERENCES "business_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_quotations" ADD CONSTRAINT "sales_quotations_officeId_fkey" FOREIGN KEY ("officeId") REFERENCES "offices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_quotations" ADD CONSTRAINT "sales_quotations_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_quotations" ADD CONSTRAINT "sales_quotations_salesPersonId_fkey" FOREIGN KEY ("salesPersonId") REFERENCES "sales_persons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_quotation_lines" ADD CONSTRAINT "sales_quotation_lines_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "sales_quotations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_quotation_lines" ADD CONSTRAINT "sales_quotation_lines_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Data rules Prisma cannot express.
ALTER TABLE "document_sequences" ADD CONSTRAINT "document_sequences_lastNumber_check" CHECK ("lastNumber" >= 0);
ALTER TABLE "sales_quotations" ADD CONSTRAINT "sales_quotations_validTill_check" CHECK ("validTill" >= "quotationDate");
ALTER TABLE "sales_quotations" ADD CONSTRAINT "sales_quotations_amounts_check" CHECK (
  "totalQty" >= 0 AND "subTotal" >= 0 AND "discountAmount" >= 0 AND "discountAmount" <= "subTotal"
  AND "vatPercent" BETWEEN 0 AND 100 AND "vatAmount" >= 0 AND "grandTotal" >= 0
);
ALTER TABLE "sales_quotation_lines" ADD CONSTRAINT "sales_quotation_lines_amounts_check" CHECK (
  "qty" > 0 AND "rate" >= 0 AND "discountPercent" BETWEEN 0 AND 100 AND "amount" >= 0
);
