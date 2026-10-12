-- CreateEnum
CREATE TYPE "SalesReturnKind" AS ENUM ('SALES', 'MARKET');

-- CreateEnum
CREATE TYPE "SalesReturnMode" AS ENUM ('FULL', 'PARTIAL', 'WITHOUT_REFERENCE', 'EXCHANGE');

-- AlterTable
ALTER TABLE "sales_returns" ADD COLUMN     "aitAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
ADD COLUMN     "approvedAt" TIMESTAMPTZ(3),
ADD COLUMN     "approvedBy" VARCHAR(100),
ADD COLUMN     "deleteReason" VARCHAR(500),
ADD COLUMN     "deletedAt" TIMESTAMPTZ(3),
ADD COLUMN     "deletedBy" VARCHAR(100),
ADD COLUMN     "discountAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
ADD COLUMN     "factoryReceivedAt" TIMESTAMPTZ(3),
ADD COLUMN     "factoryReceivedBy" VARCHAR(100),
ADD COLUMN     "itemsBase" DECIMAL(14,2) NOT NULL DEFAULT 0,
ADD COLUMN     "itemsTotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
ADD COLUMN     "kind" "SalesReturnKind" NOT NULL DEFAULT 'SALES',
ADD COLUMN     "mode" "SalesReturnMode" NOT NULL DEFAULT 'WITHOUT_REFERENCE',
ADD COLUMN     "priceIncludesVat" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "qcAt" TIMESTAMPTZ(3),
ADD COLUMN     "qcBy" VARCHAR(100),
ADD COLUMN     "refAmount" DECIMAL(14,2),
ADD COLUMN     "refDate" DATE,
ADD COLUMN     "refNo" VARCHAR(60),
ADD COLUMN     "refProjectOutlet" VARCHAR(150),
ADD COLUMN     "remarks" VARCHAR(500),
ADD COLUMN     "requestNo" VARCHAR(60),
ADD COLUMN     "shippingAddress" VARCHAR(500),
ADD COLUMN     "updatedBy" VARCHAR(100),
ADD COLUMN     "vatAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
ADD COLUMN     "withoutInvoice" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "sales_return_lines" ADD COLUMN     "aitAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
ADD COLUMN     "baseAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
ADD COLUMN     "deliveryLineId" UUID,
ADD COLUMN     "qcQty" DECIMAL(14,3),
ADD COLUMN     "reason" VARCHAR(100),
ADD COLUMN     "receivedQty" DECIMAL(14,3),
ADD COLUMN     "uom" VARCHAR(20),
ADD COLUMN     "vatAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
ADD COLUMN     "vatPercent" DECIMAL(5,2) NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "sales_return_reasons" (
    "id" UUID NOT NULL,
    "businessUnitId" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "sales_return_reasons_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sales_return_reasons_businessUnitId_name_key" ON "sales_return_reasons"("businessUnitId", "name");

-- CreateIndex
CREATE INDEX "sales_returns_deliveryId_idx" ON "sales_returns"("deliveryId");

-- CreateIndex
CREATE INDEX "sales_return_lines_deliveryLineId_idx" ON "sales_return_lines"("deliveryLineId");

-- AddForeignKey
ALTER TABLE "sales_return_lines" ADD CONSTRAINT "sales_return_lines_deliveryLineId_fkey" FOREIGN KEY ("deliveryLineId") REFERENCES "sales_delivery_lines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_return_reasons" ADD CONSTRAINT "sales_return_reasons_businessUnitId_fkey" FOREIGN KEY ("businessUnitId") REFERENCES "business_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Returns made by exchange deliveries before this migration.
UPDATE "sales_returns" r SET "mode" = 'EXCHANGE', "approvedAt" = r."createdAt", "approvedBy" = r."createdBy",
  "itemsTotal" = r."totalAmount", "itemsBase" = r."totalAmount"
WHERE EXISTS (SELECT 1 FROM "sales_deliveries" d WHERE d."exchangeReturnId" = r."id");
UPDATE "sales_return_lines" l SET "baseAmount" = l."amount"
WHERE EXISTS (SELECT 1 FROM "sales_returns" r WHERE r."id" = l."returnId" AND r."mode" = 'EXCHANGE');

-- Hand-written checks (Prisma cannot express them).
ALTER TABLE "sales_returns" ADD CONSTRAINT "sales_returns_amounts_check2" CHECK (
  "itemsTotal" >= 0 AND "itemsBase" >= 0 AND "vatAmount" >= 0 AND "aitAmount" >= 0
  AND "discountAmount" >= 0 AND "discountAmount" <= "itemsTotal" AND ("refAmount" IS NULL OR "refAmount" >= 0)
);
ALTER TABLE "sales_returns" ADD CONSTRAINT "sales_returns_reference_check" CHECK (
  ("mode" IN ('FULL', 'PARTIAL')) = ("deliveryId" IS NOT NULL)
);
ALTER TABLE "sales_return_lines" ADD CONSTRAINT "sales_return_lines_amounts_check2" CHECK (
  "vatPercent" BETWEEN 0 AND 100 AND "baseAmount" >= 0 AND "vatAmount" >= 0 AND "aitAmount" >= 0
  AND ("receivedQty" IS NULL OR ("receivedQty" >= 0 AND "receivedQty" <= "qty"))
  AND ("qcQty" IS NULL OR ("qcQty" >= 0 AND "receivedQty" IS NOT NULL AND "qcQty" <= "receivedQty"))
);
