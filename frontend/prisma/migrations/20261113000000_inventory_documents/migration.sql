-- Inventory documents (stock updates, transfers, requisitions, issues, conversions, gate passes).
-- CreateEnum
CREATE TYPE "InventoryDocType" AS ENUM ('STOCK_UPDATE', 'TRANSFER_REQUEST', 'TRANSFER', 'STORE_REQUISITION', 'STORE_ISSUE', 'CONVERSION', 'GATE_PASS');

-- CreateEnum
CREATE TYPE "InventoryDocStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'IN_TRANSIT', 'COMPLETED', 'CANCELLED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "StockSource" ADD VALUE 'TRANSFER_OUT';
ALTER TYPE "StockSource" ADD VALUE 'TRANSFER_IN';
ALTER TYPE "StockSource" ADD VALUE 'STORE_ISSUE';
ALTER TYPE "StockSource" ADD VALUE 'CONVERSION_OUT';
ALTER TYPE "StockSource" ADD VALUE 'CONVERSION_IN';

-- CreateTable
CREATE TABLE "inventory_documents" (
    "id" UUID NOT NULL,
    "businessUnitId" UUID NOT NULL,
    "type" "InventoryDocType" NOT NULL,
    "number" VARCHAR(30) NOT NULL,
    "docDate" DATE NOT NULL,
    "expectedDate" DATE,
    "warehouseId" UUID,
    "toWarehouseId" UUID,
    "requestId" UUID,
    "status" "InventoryDocStatus" NOT NULL DEFAULT 'PENDING',
    "subtype" VARCHAR(60),
    "partyName" VARCHAR(150),
    "reference" VARCHAR(100),
    "meta" JSONB,
    "remarks" VARCHAR(500),
    "reviewComment" VARCHAR(500),
    "createdBy" VARCHAR(150) NOT NULL,
    "approvedBy" VARCHAR(150),
    "approvedAt" TIMESTAMPTZ(3),
    "completedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "inventory_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_document_lines" (
    "id" UUID NOT NULL,
    "documentId" UUID NOT NULL,
    "lineNo" INTEGER NOT NULL,
    "itemId" UUID NOT NULL,
    "qty" DECIMAL(14,3) NOT NULL,
    "processedQty" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "toItemId" UUID,
    "toQty" DECIMAL(14,3),
    "remarks" VARCHAR(300),

    CONSTRAINT "inventory_document_lines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "inventory_documents_businessUnitId_type_docDate_idx" ON "inventory_documents"("businessUnitId", "type", "docDate");

-- CreateIndex
CREATE INDEX "inventory_documents_requestId_idx" ON "inventory_documents"("requestId");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_documents_businessUnitId_number_key" ON "inventory_documents"("businessUnitId", "number");

-- CreateIndex
CREATE INDEX "inventory_document_lines_documentId_idx" ON "inventory_document_lines"("documentId");

-- CreateIndex
CREATE INDEX "inventory_document_lines_itemId_idx" ON "inventory_document_lines"("itemId");

-- AddForeignKey
ALTER TABLE "inventory_documents" ADD CONSTRAINT "inventory_documents_businessUnitId_fkey" FOREIGN KEY ("businessUnitId") REFERENCES "business_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_documents" ADD CONSTRAINT "inventory_documents_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_documents" ADD CONSTRAINT "inventory_documents_toWarehouseId_fkey" FOREIGN KEY ("toWarehouseId") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_documents" ADD CONSTRAINT "inventory_documents_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "inventory_documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_document_lines" ADD CONSTRAINT "inventory_document_lines_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "inventory_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_document_lines" ADD CONSTRAINT "inventory_document_lines_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_document_lines" ADD CONSTRAINT "inventory_document_lines_toItemId_fkey" FOREIGN KEY ("toItemId") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

