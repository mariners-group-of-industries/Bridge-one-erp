-- CreateTable
CREATE TABLE "standard_prices" (
    "id" UUID NOT NULL,
    "businessUnitId" UUID NOT NULL,
    "itemId" UUID NOT NULL,
    "effectiveFrom" DATE NOT NULL,
    "costPrice" DECIMAL(14,2),
    "increaseType" VARCHAR(10) NOT NULL DEFAULT 'PERCENT',
    "increaseValue" DECIMAL(14,2),
    "etpPrice" DECIMAL(14,2),
    "dealerPrice" DECIMAL(14,2),
    "tradingPrice" DECIMAL(14,2),
    "mrp" DECIMAL(14,2),
    "minSalesPrice" DECIMAL(14,2),
    "remarks" VARCHAR(300),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "standard_prices_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "standard_prices_businessUnitId_idx" ON "standard_prices"("businessUnitId");

-- CreateIndex
CREATE UNIQUE INDEX "standard_prices_itemId_effectiveFrom_key" ON "standard_prices"("itemId", "effectiveFrom");

-- AddForeignKey
ALTER TABLE "standard_prices" ADD CONSTRAINT "standard_prices_businessUnitId_fkey" FOREIGN KEY ("businessUnitId") REFERENCES "business_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "standard_prices" ADD CONSTRAINT "standard_prices_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

