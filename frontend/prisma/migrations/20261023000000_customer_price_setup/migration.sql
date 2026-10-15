-- Customer Price Setup (Configuration / Sales Config): customer DP/TP prices and
-- customer-group prices by date/quantity range. Additive only.

-- CreateTable
CREATE TABLE "customer_price_setups" (
    "id" UUID NOT NULL,
    "businessUnitId" UUID NOT NULL,
    "customerId" UUID NOT NULL,
    "priceListId" UUID,
    "itemType" VARCHAR(30),
    "categoryId" UUID,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "customer_price_setups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_price_lines" (
    "id" UUID NOT NULL,
    "setupId" UUID NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "itemId" UUID NOT NULL,
    "dpPrice" DECIMAL(14,2) NOT NULL,
    "tpPrice" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "customer_price_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_group_price_setups" (
    "id" UUID NOT NULL,
    "businessUnitId" UUID NOT NULL,
    "officeId" UUID NOT NULL,
    "customerGroupId" UUID NOT NULL,
    "priceListId" UUID,
    "createDate" DATE NOT NULL,
    "circularNo" VARCHAR(100),
    "remarks" VARCHAR(500),
    "isRunning" BOOLEAN NOT NULL DEFAULT true,
    "itemType" VARCHAR(30),
    "categoryId" UUID,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "customer_group_price_setups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_group_price_lines" (
    "id" UUID NOT NULL,
    "setupId" UUID NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "itemId" UUID NOT NULL,
    "fromDate" DATE,
    "toDate" DATE,
    "fromQty" DECIMAL(14,3),
    "toQty" DECIMAL(14,3),
    "dpPrice" DECIMAL(14,2) NOT NULL,
    "tpPrice" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "customer_group_price_lines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "customer_price_setups_businessUnitId_idx" ON "customer_price_setups"("businessUnitId");

-- CreateIndex
CREATE INDEX "customer_price_setups_customerId_idx" ON "customer_price_setups"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "customer_price_lines_setupId_itemId_key" ON "customer_price_lines"("setupId", "itemId");

-- CreateIndex
CREATE INDEX "customer_group_price_setups_businessUnitId_idx" ON "customer_group_price_setups"("businessUnitId");

-- CreateIndex
CREATE INDEX "customer_group_price_lines_setupId_idx" ON "customer_group_price_lines"("setupId");

-- AddForeignKey
ALTER TABLE "customer_price_setups" ADD CONSTRAINT "customer_price_setups_businessUnitId_fkey" FOREIGN KEY ("businessUnitId") REFERENCES "business_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_price_setups" ADD CONSTRAINT "customer_price_setups_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_price_setups" ADD CONSTRAINT "customer_price_setups_priceListId_fkey" FOREIGN KEY ("priceListId") REFERENCES "price_lists"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_price_lines" ADD CONSTRAINT "customer_price_lines_setupId_fkey" FOREIGN KEY ("setupId") REFERENCES "customer_price_setups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_price_lines" ADD CONSTRAINT "customer_price_lines_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_group_price_setups" ADD CONSTRAINT "customer_group_price_setups_businessUnitId_fkey" FOREIGN KEY ("businessUnitId") REFERENCES "business_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_group_price_setups" ADD CONSTRAINT "customer_group_price_setups_officeId_fkey" FOREIGN KEY ("officeId") REFERENCES "offices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_group_price_setups" ADD CONSTRAINT "customer_group_price_setups_customerGroupId_fkey" FOREIGN KEY ("customerGroupId") REFERENCES "customer_groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_group_price_setups" ADD CONSTRAINT "customer_group_price_setups_priceListId_fkey" FOREIGN KEY ("priceListId") REFERENCES "price_lists"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_group_price_lines" ADD CONSTRAINT "customer_group_price_lines_setupId_fkey" FOREIGN KEY ("setupId") REFERENCES "customer_group_price_setups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_group_price_lines" ADD CONSTRAINT "customer_group_price_lines_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

