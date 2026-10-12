-- CreateEnum
CREATE TYPE "CollectionKind" AS ENUM ('INVOICE', 'ADVANCE');

-- AlterTable
ALTER TABLE "sales_collections" ADD COLUMN     "bankName" VARCHAR(100),
ADD COLUMN     "cancelReason" VARCHAR(500),
ADD COLUMN     "cancelledAt" TIMESTAMPTZ(3),
ADD COLUMN     "cancelledBy" VARCHAR(100),
ADD COLUMN     "createdBy" VARCHAR(100),
ADD COLUMN     "kind" "CollectionKind" NOT NULL DEFAULT 'INVOICE',
ADD COLUMN     "officeId" UUID;

-- CreateTable
CREATE TABLE "sales_collection_allocations" (
    "id" UUID NOT NULL,
    "collectionId" UUID NOT NULL,
    "deliveryId" UUID NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "sales_collection_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_bills" (
    "id" UUID NOT NULL,
    "businessUnitId" UUID NOT NULL,
    "number" VARCHAR(30) NOT NULL,
    "officeId" UUID NOT NULL,
    "customerId" UUID NOT NULL,
    "billDate" DATE NOT NULL,
    "status" "SalesDocStatus" NOT NULL DEFAULT 'SUBMITTED',
    "totalAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "remarks" VARCHAR(500),
    "createdBy" VARCHAR(100),
    "cancelledAt" TIMESTAMPTZ(3),
    "cancelledBy" VARCHAR(100),
    "cancelReason" VARCHAR(500),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "sales_bills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_bill_lines" (
    "id" UUID NOT NULL,
    "billId" UUID NOT NULL,
    "deliveryId" UUID NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "sales_bill_lines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sales_collection_allocations_deliveryId_idx" ON "sales_collection_allocations"("deliveryId");

-- CreateIndex
CREATE UNIQUE INDEX "sales_collection_allocations_collectionId_deliveryId_key" ON "sales_collection_allocations"("collectionId", "deliveryId");

-- CreateIndex
CREATE INDEX "sales_bills_customerId_status_idx" ON "sales_bills"("customerId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "sales_bills_businessUnitId_number_key" ON "sales_bills"("businessUnitId", "number");

-- CreateIndex
CREATE INDEX "sales_bill_lines_deliveryId_idx" ON "sales_bill_lines"("deliveryId");

-- CreateIndex
CREATE UNIQUE INDEX "sales_bill_lines_billId_deliveryId_key" ON "sales_bill_lines"("billId", "deliveryId");

-- AddForeignKey
ALTER TABLE "sales_collections" ADD CONSTRAINT "sales_collections_officeId_fkey" FOREIGN KEY ("officeId") REFERENCES "offices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_collection_allocations" ADD CONSTRAINT "sales_collection_allocations_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "sales_collections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_collection_allocations" ADD CONSTRAINT "sales_collection_allocations_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "sales_deliveries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_bills" ADD CONSTRAINT "sales_bills_businessUnitId_fkey" FOREIGN KEY ("businessUnitId") REFERENCES "business_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_bills" ADD CONSTRAINT "sales_bills_officeId_fkey" FOREIGN KEY ("officeId") REFERENCES "offices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_bills" ADD CONSTRAINT "sales_bills_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_bill_lines" ADD CONSTRAINT "sales_bill_lines_billId_fkey" FOREIGN KEY ("billId") REFERENCES "sales_bills"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_bill_lines" ADD CONSTRAINT "sales_bill_lines_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "sales_deliveries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Money collected on a delivery settles that invoice.
UPDATE "sales_collections" c SET "officeId" = d."officeId"
FROM "sales_deliveries" d WHERE c."deliveryId" = d."id";
INSERT INTO "sales_collection_allocations" ("id", "collectionId", "deliveryId", "amount", "updatedAt")
SELECT gen_random_uuid(), c."id", c."deliveryId", c."amount", CURRENT_TIMESTAMP
FROM "sales_collections" c WHERE c."deliveryId" IS NOT NULL;
-- Earlier collections not tied to an invoice stay on account until adjusted.
UPDATE "sales_collections" SET "kind" = 'ADVANCE' WHERE "deliveryId" IS NULL;

-- Hand-written checks (Prisma cannot express them).
ALTER TABLE "sales_collection_allocations" ADD CONSTRAINT "sales_collection_allocations_amount_check" CHECK ("amount" > 0);
ALTER TABLE "sales_bills" ADD CONSTRAINT "sales_bills_amount_check" CHECK ("totalAmount" >= 0);
ALTER TABLE "sales_bill_lines" ADD CONSTRAINT "sales_bill_lines_amount_check" CHECK ("amount" >= 0);
