-- POS counters and counter sales (stock leaves the counter warehouse).
-- CreateEnum
CREATE TYPE "PosPaymentMethod" AS ENUM ('CASH', 'CARD', 'MFS', 'VOUCHER');

-- CreateEnum
CREATE TYPE "PosSaleStatus" AS ENUM ('COMPLETED', 'VOIDED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "StockSource" ADD VALUE 'POS_SALE';
ALTER TYPE "StockSource" ADD VALUE 'POS_RETURN';

-- CreateTable
CREATE TABLE "pos_counters" (
    "id" UUID NOT NULL,
    "businessUnitId" UUID NOT NULL,
    "code" VARCHAR(20) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "warehouseId" UUID NOT NULL,
    "floorName" VARCHAR(200),
    "userName" VARCHAR(150),
    "receiptMessage" VARCHAR(300),
    "isEcommerce" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "pos_counters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pos_sales" (
    "id" UUID NOT NULL,
    "businessUnitId" UUID NOT NULL,
    "counterId" UUID NOT NULL,
    "warehouseId" UUID NOT NULL,
    "number" VARCHAR(30) NOT NULL,
    "saleDate" DATE NOT NULL,
    "soldAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "customerName" VARCHAR(150),
    "customerMobile" VARCHAR(30),
    "tableRef" VARCHAR(100),
    "subtotal" DECIMAL(14,2) NOT NULL,
    "discount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "vatPercent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "vatAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(14,2) NOT NULL,
    "paidAmount" DECIMAL(14,2) NOT NULL,
    "changeAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "paymentMethod" "PosPaymentMethod" NOT NULL DEFAULT 'CASH',
    "status" "PosSaleStatus" NOT NULL DEFAULT 'COMPLETED',
    "voidReason" VARCHAR(300),
    "createdBy" VARCHAR(150) NOT NULL,
    "voidedBy" VARCHAR(150),
    "voidedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pos_sales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pos_sale_lines" (
    "id" UUID NOT NULL,
    "saleId" UUID NOT NULL,
    "lineNo" INTEGER NOT NULL,
    "itemId" UUID NOT NULL,
    "qty" DECIMAL(14,3) NOT NULL,
    "rate" DECIMAL(14,2) NOT NULL,
    "discount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "amount" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "pos_sale_lines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "pos_counters_businessUnitId_code_key" ON "pos_counters"("businessUnitId", "code");

-- CreateIndex
CREATE INDEX "pos_sales_businessUnitId_saleDate_idx" ON "pos_sales"("businessUnitId", "saleDate");

-- CreateIndex
CREATE INDEX "pos_sales_counterId_idx" ON "pos_sales"("counterId");

-- CreateIndex
CREATE UNIQUE INDEX "pos_sales_businessUnitId_number_key" ON "pos_sales"("businessUnitId", "number");

-- CreateIndex
CREATE INDEX "pos_sale_lines_saleId_idx" ON "pos_sale_lines"("saleId");

-- CreateIndex
CREATE INDEX "pos_sale_lines_itemId_idx" ON "pos_sale_lines"("itemId");

-- AddForeignKey
ALTER TABLE "pos_counters" ADD CONSTRAINT "pos_counters_businessUnitId_fkey" FOREIGN KEY ("businessUnitId") REFERENCES "business_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_counters" ADD CONSTRAINT "pos_counters_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_sales" ADD CONSTRAINT "pos_sales_businessUnitId_fkey" FOREIGN KEY ("businessUnitId") REFERENCES "business_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_sales" ADD CONSTRAINT "pos_sales_counterId_fkey" FOREIGN KEY ("counterId") REFERENCES "pos_counters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_sales" ADD CONSTRAINT "pos_sales_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_sale_lines" ADD CONSTRAINT "pos_sale_lines_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "pos_sales"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_sale_lines" ADD CONSTRAINT "pos_sale_lines_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

