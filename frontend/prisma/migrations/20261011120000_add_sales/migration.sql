-- CreateEnum
CREATE TYPE "SalesDocStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CollectionMethod" AS ENUM ('CASH', 'BANK', 'CHEQUE', 'MOBILE_BANKING');

-- CreateTable
CREATE TABLE "sales_persons" (
    "id" UUID NOT NULL,
    "businessUnitId" UUID NOT NULL,
    "code" VARCHAR(30) NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "designation" VARCHAR(100),
    "phone" VARCHAR(30),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "sales_persons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customers" (
    "id" UUID NOT NULL,
    "businessUnitId" UUID NOT NULL,
    "code" VARCHAR(30) NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "address" VARCHAR(500),
    "phone" VARCHAR(30),
    "territory" VARCHAR(100),
    "creditDays" INTEGER NOT NULL DEFAULT 0,
    "creditLimit" DECIMAL(14,2),
    "salesPersonId" UUID,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "items" (
    "id" UUID NOT NULL,
    "businessUnitId" UUID NOT NULL,
    "code" VARCHAR(30) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "uom" VARCHAR(20) NOT NULL DEFAULT 'Pcs',
    "salesRate" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_deliveries" (
    "id" UUID NOT NULL,
    "businessUnitId" UUID NOT NULL,
    "number" VARCHAR(30) NOT NULL,
    "customerId" UUID NOT NULL,
    "salesPersonId" UUID,
    "deliveryDate" DATE NOT NULL,
    "dueDate" DATE NOT NULL,
    "status" "SalesDocStatus" NOT NULL DEFAULT 'DRAFT',
    "totalQty" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "totalAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "remarks" VARCHAR(500),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "sales_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_delivery_lines" (
    "id" UUID NOT NULL,
    "deliveryId" UUID NOT NULL,
    "lineNo" INTEGER NOT NULL,
    "itemId" UUID NOT NULL,
    "qty" DECIMAL(14,3) NOT NULL,
    "rate" DECIMAL(14,2) NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "sales_delivery_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_returns" (
    "id" UUID NOT NULL,
    "businessUnitId" UUID NOT NULL,
    "number" VARCHAR(30) NOT NULL,
    "customerId" UUID NOT NULL,
    "salesPersonId" UUID,
    "deliveryId" UUID,
    "returnDate" DATE NOT NULL,
    "status" "SalesDocStatus" NOT NULL DEFAULT 'DRAFT',
    "totalQty" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "totalAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "reason" VARCHAR(500),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "sales_returns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_return_lines" (
    "id" UUID NOT NULL,
    "returnId" UUID NOT NULL,
    "lineNo" INTEGER NOT NULL,
    "itemId" UUID NOT NULL,
    "qty" DECIMAL(14,3) NOT NULL,
    "rate" DECIMAL(14,2) NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "sales_return_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_collections" (
    "id" UUID NOT NULL,
    "businessUnitId" UUID NOT NULL,
    "number" VARCHAR(30) NOT NULL,
    "customerId" UUID NOT NULL,
    "salesPersonId" UUID,
    "collectionDate" DATE NOT NULL,
    "method" "CollectionMethod" NOT NULL DEFAULT 'CASH',
    "amount" DECIMAL(14,2) NOT NULL,
    "reference" VARCHAR(100),
    "status" "SalesDocStatus" NOT NULL DEFAULT 'DRAFT',
    "remarks" VARCHAR(500),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "sales_collections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_targets" (
    "id" UUID NOT NULL,
    "businessUnitId" UUID NOT NULL,
    "salesPersonId" UUID NOT NULL,
    "month" DATE NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "sales_targets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sales_persons_businessUnitId_code_key" ON "sales_persons"("businessUnitId", "code");

-- CreateIndex
CREATE INDEX "customers_businessUnitId_name_idx" ON "customers"("businessUnitId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "customers_businessUnitId_code_key" ON "customers"("businessUnitId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "items_businessUnitId_code_key" ON "items"("businessUnitId", "code");

-- CreateIndex
CREATE INDEX "sales_deliveries_businessUnitId_status_deliveryDate_idx" ON "sales_deliveries"("businessUnitId", "status", "deliveryDate");

-- CreateIndex
CREATE INDEX "sales_deliveries_customerId_status_dueDate_idx" ON "sales_deliveries"("customerId", "status", "dueDate");

-- CreateIndex
CREATE UNIQUE INDEX "sales_deliveries_businessUnitId_number_key" ON "sales_deliveries"("businessUnitId", "number");

-- CreateIndex
CREATE INDEX "sales_delivery_lines_itemId_idx" ON "sales_delivery_lines"("itemId");

-- CreateIndex
CREATE UNIQUE INDEX "sales_delivery_lines_deliveryId_lineNo_key" ON "sales_delivery_lines"("deliveryId", "lineNo");

-- CreateIndex
CREATE INDEX "sales_returns_businessUnitId_status_returnDate_idx" ON "sales_returns"("businessUnitId", "status", "returnDate");

-- CreateIndex
CREATE INDEX "sales_returns_customerId_status_idx" ON "sales_returns"("customerId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "sales_returns_businessUnitId_number_key" ON "sales_returns"("businessUnitId", "number");

-- CreateIndex
CREATE INDEX "sales_return_lines_itemId_idx" ON "sales_return_lines"("itemId");

-- CreateIndex
CREATE UNIQUE INDEX "sales_return_lines_returnId_lineNo_key" ON "sales_return_lines"("returnId", "lineNo");

-- CreateIndex
CREATE INDEX "sales_collections_businessUnitId_status_collectionDate_idx" ON "sales_collections"("businessUnitId", "status", "collectionDate");

-- CreateIndex
CREATE INDEX "sales_collections_customerId_status_idx" ON "sales_collections"("customerId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "sales_collections_businessUnitId_number_key" ON "sales_collections"("businessUnitId", "number");

-- CreateIndex
CREATE INDEX "sales_targets_businessUnitId_month_idx" ON "sales_targets"("businessUnitId", "month");

-- CreateIndex
CREATE UNIQUE INDEX "sales_targets_salesPersonId_month_key" ON "sales_targets"("salesPersonId", "month");

-- AddForeignKey
ALTER TABLE "sales_persons" ADD CONSTRAINT "sales_persons_businessUnitId_fkey" FOREIGN KEY ("businessUnitId") REFERENCES "business_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_businessUnitId_fkey" FOREIGN KEY ("businessUnitId") REFERENCES "business_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_salesPersonId_fkey" FOREIGN KEY ("salesPersonId") REFERENCES "sales_persons"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "items" ADD CONSTRAINT "items_businessUnitId_fkey" FOREIGN KEY ("businessUnitId") REFERENCES "business_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_deliveries" ADD CONSTRAINT "sales_deliveries_businessUnitId_fkey" FOREIGN KEY ("businessUnitId") REFERENCES "business_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_deliveries" ADD CONSTRAINT "sales_deliveries_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_deliveries" ADD CONSTRAINT "sales_deliveries_salesPersonId_fkey" FOREIGN KEY ("salesPersonId") REFERENCES "sales_persons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_delivery_lines" ADD CONSTRAINT "sales_delivery_lines_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "sales_deliveries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_delivery_lines" ADD CONSTRAINT "sales_delivery_lines_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_returns" ADD CONSTRAINT "sales_returns_businessUnitId_fkey" FOREIGN KEY ("businessUnitId") REFERENCES "business_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_returns" ADD CONSTRAINT "sales_returns_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_returns" ADD CONSTRAINT "sales_returns_salesPersonId_fkey" FOREIGN KEY ("salesPersonId") REFERENCES "sales_persons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_returns" ADD CONSTRAINT "sales_returns_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "sales_deliveries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_return_lines" ADD CONSTRAINT "sales_return_lines_returnId_fkey" FOREIGN KEY ("returnId") REFERENCES "sales_returns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_return_lines" ADD CONSTRAINT "sales_return_lines_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_collections" ADD CONSTRAINT "sales_collections_businessUnitId_fkey" FOREIGN KEY ("businessUnitId") REFERENCES "business_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_collections" ADD CONSTRAINT "sales_collections_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_collections" ADD CONSTRAINT "sales_collections_salesPersonId_fkey" FOREIGN KEY ("salesPersonId") REFERENCES "sales_persons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_targets" ADD CONSTRAINT "sales_targets_businessUnitId_fkey" FOREIGN KEY ("businessUnitId") REFERENCES "business_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_targets" ADD CONSTRAINT "sales_targets_salesPersonId_fkey" FOREIGN KEY ("salesPersonId") REFERENCES "sales_persons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Data rules Prisma cannot express (kept by future diffs, which ignore CHECKs).
ALTER TABLE "customers" ADD CONSTRAINT "customers_creditDays_check" CHECK ("creditDays" >= 0);
ALTER TABLE "customers" ADD CONSTRAINT "customers_creditLimit_check" CHECK ("creditLimit" IS NULL OR "creditLimit" >= 0);
ALTER TABLE "items" ADD CONSTRAINT "items_salesRate_check" CHECK ("salesRate" >= 0);
ALTER TABLE "sales_deliveries" ADD CONSTRAINT "sales_deliveries_amounts_check" CHECK ("totalQty" >= 0 AND "totalAmount" >= 0);
ALTER TABLE "sales_deliveries" ADD CONSTRAINT "sales_deliveries_dueDate_check" CHECK ("dueDate" >= "deliveryDate");
ALTER TABLE "sales_delivery_lines" ADD CONSTRAINT "sales_delivery_lines_amounts_check" CHECK ("qty" > 0 AND "rate" >= 0 AND "amount" >= 0);
ALTER TABLE "sales_returns" ADD CONSTRAINT "sales_returns_amounts_check" CHECK ("totalQty" >= 0 AND "totalAmount" >= 0);
ALTER TABLE "sales_return_lines" ADD CONSTRAINT "sales_return_lines_amounts_check" CHECK ("qty" > 0 AND "rate" >= 0 AND "amount" >= 0);
ALTER TABLE "sales_collections" ADD CONSTRAINT "sales_collections_amount_check" CHECK ("amount" > 0);
ALTER TABLE "sales_targets" ADD CONSTRAINT "sales_targets_amount_check" CHECK ("amount" >= 0);
ALTER TABLE "sales_targets" ADD CONSTRAINT "sales_targets_month_check" CHECK (EXTRACT(DAY FROM "month") = 1);
