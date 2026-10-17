-- Item Profile (Configuration / Entity Master Data): extends the sales "items"
-- and "item_categories" tables and adds divisions, units and opening stock.
-- Additive only.

-- AlterTable
ALTER TABLE "items" ADD COLUMN     "allowEbt" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "autoBarcode" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "barcode" VARCHAR(60),
ADD COLUMN     "brand" VARCHAR(100),
ADD COLUMN     "canBePurchased" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "canBeRented" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "canBeSold" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "dealerPrice" DECIMAL(14,2),
ADD COLUMN     "divisionId" UUID,
ADD COLUMN     "isDefault" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "itemType" VARCHAR(30),
ADD COLUMN     "netWeight" DECIMAL(14,3),
ADD COLUMN     "netWeightUnit" VARCHAR(20),
ADD COLUMN     "noDecimal" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "printedCode" VARCHAR(30),
ADD COLUMN     "printedName" VARCHAR(200),
ADD COLUMN     "purchasePrice" DECIMAL(14,2),
ADD COLUMN     "restrictedAge" VARCHAR(10),
ADD COLUMN     "tracking" VARCHAR(10) NOT NULL DEFAULT 'NONE',
ADD COLUMN     "tradingPrice" DECIMAL(14,2);

-- AlterTable
ALTER TABLE "item_categories" ADD COLUMN     "description" VARCHAR(300);

-- CreateTable
CREATE TABLE "item_divisions" (
    "id" UUID NOT NULL,
    "businessUnitId" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "item_divisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "item_uoms" (
    "id" UUID NOT NULL,
    "businessUnitId" UUID NOT NULL,
    "name" VARCHAR(20) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "item_uoms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "opening_stock_receipts" (
    "id" UUID NOT NULL,
    "businessUnitId" UUID NOT NULL,
    "number" VARCHAR(30) NOT NULL,
    "receiptDate" DATE NOT NULL,
    "officeId" UUID NOT NULL,
    "warehouseId" UUID NOT NULL,
    "itemType" VARCHAR(20) NOT NULL,
    "challanNo" VARCHAR(50),
    "remarks" VARCHAR(500),
    "creditAccountCode" VARCHAR(30),
    "creditAccountName" VARCHAR(200),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "opening_stock_receipts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "opening_stock_lines" (
    "id" UUID NOT NULL,
    "receiptId" UUID NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "itemId" UUID NOT NULL,
    "quantity" DECIMAL(14,3) NOT NULL,
    "rate" DECIMAL(14,2) NOT NULL,
    "amount" DECIMAL(16,2) NOT NULL,

    CONSTRAINT "opening_stock_lines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "item_divisions_businessUnitId_name_key" ON "item_divisions"("businessUnitId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "item_uoms_businessUnitId_name_key" ON "item_uoms"("businessUnitId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "opening_stock_receipts_businessUnitId_number_key" ON "opening_stock_receipts"("businessUnitId", "number");

-- CreateIndex
CREATE INDEX "opening_stock_lines_receiptId_idx" ON "opening_stock_lines"("receiptId");

-- CreateIndex
CREATE INDEX "opening_stock_lines_itemId_idx" ON "opening_stock_lines"("itemId");

-- AddForeignKey
ALTER TABLE "items" ADD CONSTRAINT "items_divisionId_fkey" FOREIGN KEY ("divisionId") REFERENCES "item_divisions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_divisions" ADD CONSTRAINT "item_divisions_businessUnitId_fkey" FOREIGN KEY ("businessUnitId") REFERENCES "business_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_uoms" ADD CONSTRAINT "item_uoms_businessUnitId_fkey" FOREIGN KEY ("businessUnitId") REFERENCES "business_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opening_stock_receipts" ADD CONSTRAINT "opening_stock_receipts_businessUnitId_fkey" FOREIGN KEY ("businessUnitId") REFERENCES "business_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opening_stock_receipts" ADD CONSTRAINT "opening_stock_receipts_officeId_fkey" FOREIGN KEY ("officeId") REFERENCES "offices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opening_stock_receipts" ADD CONSTRAINT "opening_stock_receipts_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opening_stock_lines" ADD CONSTRAINT "opening_stock_lines_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "opening_stock_receipts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opening_stock_lines" ADD CONSTRAINT "opening_stock_lines_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

