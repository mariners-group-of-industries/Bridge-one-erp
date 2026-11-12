-- Supplier bills (invoice booking and approval) and payments linked to a receipt or bill.
-- CreateEnum
CREATE TYPE "SupplierBillStatus" AS ENUM ('PENDING', 'APPROVED', 'CANCELLED');

-- AlterTable
ALTER TABLE "supplier_payments" ADD COLUMN     "billId" UUID,
ADD COLUMN     "createdBy" VARCHAR(150),
ADD COLUMN     "isAdvance" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "receiptId" UUID;

-- CreateTable
CREATE TABLE "supplier_bills" (
    "id" UUID NOT NULL,
    "businessUnitId" UUID NOT NULL,
    "supplierId" UUID NOT NULL,
    "receiptId" UUID,
    "number" VARCHAR(60) NOT NULL,
    "billDate" DATE NOT NULL,
    "dueDate" DATE NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "status" "SupplierBillStatus" NOT NULL DEFAULT 'PENDING',
    "remarks" VARCHAR(500),
    "createdBy" VARCHAR(150) NOT NULL,
    "approvedBy" VARCHAR(150),
    "approvedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "supplier_bills_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "supplier_bills_receiptId_key" ON "supplier_bills"("receiptId");

-- CreateIndex
CREATE INDEX "supplier_bills_businessUnitId_status_idx" ON "supplier_bills"("businessUnitId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "supplier_bills_supplierId_number_key" ON "supplier_bills"("supplierId", "number");

-- AddForeignKey
ALTER TABLE "supplier_payments" ADD CONSTRAINT "supplier_payments_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "goods_receipts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_payments" ADD CONSTRAINT "supplier_payments_billId_fkey" FOREIGN KEY ("billId") REFERENCES "supplier_bills"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_bills" ADD CONSTRAINT "supplier_bills_businessUnitId_fkey" FOREIGN KEY ("businessUnitId") REFERENCES "business_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_bills" ADD CONSTRAINT "supplier_bills_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_bills" ADD CONSTRAINT "supplier_bills_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "goods_receipts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

