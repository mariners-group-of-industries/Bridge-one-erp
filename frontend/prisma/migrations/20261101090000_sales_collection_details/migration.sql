-- AlterTable
ALTER TABLE "sales_collections" ADD COLUMN     "adjustAccountId" UUID,
ADD COLUMN     "adjustmentAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
ADD COLUMN     "cashAccountId" UUID,
ADD COLUMN     "cashRemarks" VARCHAR(300),
ADD COLUMN     "cashType" VARCHAR(30),
ADD COLUMN     "controlAmount" DECIMAL(14,2),
ADD COLUMN     "deductionAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
ADD COLUMN     "employeeId" UUID,
ADD COLUMN     "moneyReceiptNo" VARCHAR(60),
ADD COLUMN     "narration" VARCHAR(500),
ADD COLUMN     "project" VARCHAR(150),
ADD COLUMN     "salesOrderId" UUID,
ADD COLUMN     "voucherType" VARCHAR(30);

-- AlterTable
ALTER TABLE "sales_bills" ADD COLUMN     "billType" VARCHAR(20) NOT NULL DEFAULT 'NORMAL',
ADD COLUMN     "terms" VARCHAR(4000);

-- AlterTable
ALTER TABLE "sales_bill_lines" ADD COLUMN     "challanManual" VARCHAR(60),
ADD COLUMN     "grnNumber" VARCHAR(60),
ADD COLUMN     "submissionDate" DATE;

-- CreateTable
CREATE TABLE "sales_collection_deductions" (
    "id" UUID NOT NULL,
    "collectionId" UUID NOT NULL,
    "expense" VARCHAR(150) NOT NULL,
    "accountId" UUID NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "sales_collection_deductions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sales_collection_deductions_collectionId_idx" ON "sales_collection_deductions"("collectionId");

-- AddForeignKey
ALTER TABLE "sales_collections" ADD CONSTRAINT "sales_collections_adjustAccountId_fkey" FOREIGN KEY ("adjustAccountId") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_collections" ADD CONSTRAINT "sales_collections_cashAccountId_fkey" FOREIGN KEY ("cashAccountId") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_collections" ADD CONSTRAINT "sales_collections_salesOrderId_fkey" FOREIGN KEY ("salesOrderId") REFERENCES "sales_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_collections" ADD CONSTRAINT "sales_collections_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_collection_deductions" ADD CONSTRAINT "sales_collection_deductions_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "sales_collections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_collection_deductions" ADD CONSTRAINT "sales_collection_deductions_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Checks
ALTER TABLE "sales_collection_deductions" ADD CONSTRAINT "sales_collection_deductions_amount_check" CHECK ("amount" > 0);
ALTER TABLE "sales_bills" ADD CONSTRAINT "sales_bills_bill_type_check" CHECK ("billType" IN ('NORMAL', 'FACTORING'));
