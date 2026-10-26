-- Production Entry: entries are booked against a production order, consume materials and add output to stock.
-- production_entries was empty when this was written.

-- CreateEnum
CREATE TYPE "ProductionEntryStatus" AS ENUM ('POSTED', 'CANCELLED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "StockSource" ADD VALUE 'PRODUCTION_CONSUMPTION';
ALTER TYPE "StockSource" ADD VALUE 'PRODUCTION_OUTPUT';

-- AlterTable
ALTER TABLE "production_entries" ADD COLUMN     "actualCost" DECIMAL(16,2) NOT NULL DEFAULT 0,
ADD COLUMN     "cancelReason" VARCHAR(500),
ADD COLUMN     "cancelledAt" TIMESTAMPTZ(3),
ADD COLUMN     "cancelledBy" VARCHAR(100),
ADD COLUMN     "departmentId" UUID,
ADD COLUMN     "departmentSectionId" UUID,
ADD COLUMN     "excessQty" DECIMAL(14,3) NOT NULL DEFAULT 0,
ADD COLUMN     "netQty" DECIMAL(14,3) NOT NULL,
ADD COLUMN     "netWeight" DECIMAL(16,4) NOT NULL DEFAULT 0,
ADD COLUMN     "orderId" UUID NOT NULL,
ADD COLUMN     "outputWarehouseId" UUID NOT NULL,
ADD COLUMN     "rejectQty" DECIMAL(14,3) NOT NULL DEFAULT 0,
ADD COLUMN     "sourceWarehouseId" UUID NOT NULL,
ADD COLUMN     "standardCost" DECIMAL(16,2) NOT NULL DEFAULT 0,
ADD COLUMN     "status" "ProductionEntryStatus" NOT NULL DEFAULT 'POSTED',
ADD COLUMN     "variance" DECIMAL(16,2) NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "production_entry_materials" (
    "id" UUID NOT NULL,
    "entryId" UUID NOT NULL,
    "lineNo" INTEGER NOT NULL,
    "itemId" UUID NOT NULL,
    "uom" VARCHAR(20) NOT NULL,
    "standardQty" DECIMAL(14,4) NOT NULL,
    "actualQty" DECIMAL(14,4) NOT NULL,
    "wastageQty" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "scrapQty" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "rate" DECIMAL(14,4) NOT NULL DEFAULT 0,

    CONSTRAINT "production_entry_materials_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "production_entry_materials_itemId_idx" ON "production_entry_materials"("itemId");

-- CreateIndex
CREATE UNIQUE INDEX "production_entry_materials_entryId_lineNo_key" ON "production_entry_materials"("entryId", "lineNo");

-- CreateIndex
CREATE INDEX "production_entries_orderId_idx" ON "production_entries"("orderId");

-- AddForeignKey
ALTER TABLE "production_entries" ADD CONSTRAINT "production_entries_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "production_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_entries" ADD CONSTRAINT "production_entries_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "production_departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_entries" ADD CONSTRAINT "production_entries_departmentSectionId_fkey" FOREIGN KEY ("departmentSectionId") REFERENCES "production_department_sections"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_entries" ADD CONSTRAINT "production_entries_sourceWarehouseId_fkey" FOREIGN KEY ("sourceWarehouseId") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_entries" ADD CONSTRAINT "production_entries_outputWarehouseId_fkey" FOREIGN KEY ("outputWarehouseId") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_entry_materials" ADD CONSTRAINT "production_entry_materials_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "production_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_entry_materials" ADD CONSTRAINT "production_entry_materials_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Hand-written checks
ALTER TABLE "production_entries" ADD CONSTRAINT "production_entries_net_check"
  CHECK ("rejectQty" >= 0 AND "rejectQty" <= "qty" AND "netQty" = "qty" - "rejectQty" AND "excessQty" >= 0 AND "excessQty" <= "netQty" AND "netWeight" >= 0);
ALTER TABLE "production_entry_materials" ADD CONSTRAINT "production_entry_materials_values_check"
  CHECK ("standardQty" >= 0 AND "actualQty" >= 0 AND "wastageQty" >= 0 AND "scrapQty" >= 0 AND "wastageQty" + "scrapQty" <= "actualQty" AND "rate" >= 0);
