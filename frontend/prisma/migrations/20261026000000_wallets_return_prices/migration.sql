-- CreateTable
CREATE TABLE "sales_return_prices" (
    "id" UUID NOT NULL,
    "businessUnitId" UUID NOT NULL,
    "itemId" UUID NOT NULL,
    "effectiveFrom" DATE NOT NULL,
    "damageRate" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "expireRate" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "damageExpireRate" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "soundStockRate" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "sales_return_prices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_wallets" (
    "id" UUID NOT NULL,
    "businessUnitId" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "commissionPercent" DECIMAL(5,2) NOT NULL,
    "isCash" BOOLEAN NOT NULL DEFAULT false,
    "bankAccountId" UUID,
    "officeId" UUID,
    "referenceCode" VARCHAR(50),
    "isRounding" BOOLEAN NOT NULL DEFAULT false,
    "isCoupon" BOOLEAN NOT NULL DEFAULT false,
    "isWalletCharge" BOOLEAN NOT NULL DEFAULT false,
    "isReferenceRequired" BOOLEAN NOT NULL DEFAULT false,
    "isMfs" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "attachmentKey" VARCHAR(300),
    "attachmentName" VARCHAR(255),
    "attachmentType" VARCHAR(100),
    "attachmentSize" INTEGER,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "sales_wallets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sales_return_prices_businessUnitId_idx" ON "sales_return_prices"("businessUnitId");

-- CreateIndex
CREATE UNIQUE INDEX "sales_return_prices_itemId_effectiveFrom_key" ON "sales_return_prices"("itemId", "effectiveFrom");

-- CreateIndex
CREATE UNIQUE INDEX "sales_wallets_attachmentKey_key" ON "sales_wallets"("attachmentKey");

-- CreateIndex
CREATE INDEX "sales_wallets_bankAccountId_idx" ON "sales_wallets"("bankAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "sales_wallets_businessUnitId_name_key" ON "sales_wallets"("businessUnitId", "name");

-- AddForeignKey
ALTER TABLE "sales_return_prices" ADD CONSTRAINT "sales_return_prices_businessUnitId_fkey" FOREIGN KEY ("businessUnitId") REFERENCES "business_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_return_prices" ADD CONSTRAINT "sales_return_prices_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_wallets" ADD CONSTRAINT "sales_wallets_businessUnitId_fkey" FOREIGN KEY ("businessUnitId") REFERENCES "business_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_wallets" ADD CONSTRAINT "sales_wallets_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "bank_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_wallets" ADD CONSTRAINT "sales_wallets_officeId_fkey" FOREIGN KEY ("officeId") REFERENCES "offices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

