-- Offer Setup (Configuration / Sales Config): sales offers of four kinds and
-- their line tables. Additive only.

-- CreateTable
CREATE TABLE "sales_offers" (
    "id" UUID NOT NULL,
    "businessUnitId" UUID NOT NULL,
    "kind" VARCHAR(20) NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "fromDate" DATE,
    "toDate" DATE,
    "customerGroupId" UUID,
    "priceListId" UUID,
    "basedOn" VARCHAR(30),
    "categoryId" UUID,
    "remarks" VARCHAR(500),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "sales_offers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_offer_item_lines" (
    "id" UUID NOT NULL,
    "offerId" UUID NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "sellingItemId" UUID NOT NULL,
    "sellingUom" VARCHAR(20) NOT NULL,
    "sellingQty" DECIMAL(14,3) NOT NULL,
    "offerItemId" UUID NOT NULL,
    "offerUom" VARCHAR(20) NOT NULL,
    "offerQty" DECIMAL(14,3) NOT NULL,

    CONSTRAINT "sales_offer_item_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_offer_pair_lines" (
    "id" UUID NOT NULL,
    "offerId" UUID NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "categoryId" UUID,
    "itemId" UUID NOT NULL,
    "quantity" DECIMAL(14,3) NOT NULL,
    "minQty" DECIMAL(14,3),
    "maxQty" DECIMAL(14,3),

    CONSTRAINT "sales_offer_pair_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_offer_bonus_lines" (
    "id" UUID NOT NULL,
    "offerId" UUID NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "itemId" UUID NOT NULL,
    "quantity" DECIMAL(14,3) NOT NULL,

    CONSTRAINT "sales_offer_bonus_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_offer_discount_lines" (
    "id" UUID NOT NULL,
    "offerId" UUID NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "itemId" UUID NOT NULL,
    "discountType" VARCHAR(10) NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "quantity" DECIMAL(14,3),
    "minQty" DECIMAL(14,3),
    "maxQty" DECIMAL(14,3),
    "isRecurrent" BOOLEAN NOT NULL DEFAULT false,
    "supplierId" UUID,
    "supplierContribution" DECIMAL(5,2),
    "internalContribution" DECIMAL(5,2),

    CONSTRAINT "sales_offer_discount_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_offer_special_lines" (
    "id" UUID NOT NULL,
    "offerId" UUID NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "customerGroupId" UUID,
    "discountType" VARCHAR(10) NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "fromAmount" DECIMAL(16,2),
    "toAmount" DECIMAL(16,2),
    "supplierId" UUID,
    "supplierContribution" DECIMAL(5,2),
    "internalContribution" DECIMAL(5,2),
    "vatOnDiscounted" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "sales_offer_special_lines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sales_offers_businessUnitId_kind_idx" ON "sales_offers"("businessUnitId", "kind");

-- CreateIndex
CREATE INDEX "sales_offer_item_lines_offerId_idx" ON "sales_offer_item_lines"("offerId");

-- CreateIndex
CREATE INDEX "sales_offer_pair_lines_offerId_idx" ON "sales_offer_pair_lines"("offerId");

-- CreateIndex
CREATE INDEX "sales_offer_bonus_lines_offerId_idx" ON "sales_offer_bonus_lines"("offerId");

-- CreateIndex
CREATE INDEX "sales_offer_discount_lines_offerId_idx" ON "sales_offer_discount_lines"("offerId");

-- CreateIndex
CREATE INDEX "sales_offer_special_lines_offerId_idx" ON "sales_offer_special_lines"("offerId");

-- AddForeignKey
ALTER TABLE "sales_offers" ADD CONSTRAINT "sales_offers_businessUnitId_fkey" FOREIGN KEY ("businessUnitId") REFERENCES "business_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_offers" ADD CONSTRAINT "sales_offers_customerGroupId_fkey" FOREIGN KEY ("customerGroupId") REFERENCES "customer_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_offers" ADD CONSTRAINT "sales_offers_priceListId_fkey" FOREIGN KEY ("priceListId") REFERENCES "price_lists"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_offers" ADD CONSTRAINT "sales_offers_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "item_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_offer_item_lines" ADD CONSTRAINT "sales_offer_item_lines_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "sales_offers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_offer_item_lines" ADD CONSTRAINT "sales_offer_item_lines_sellingItemId_fkey" FOREIGN KEY ("sellingItemId") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_offer_item_lines" ADD CONSTRAINT "sales_offer_item_lines_offerItemId_fkey" FOREIGN KEY ("offerItemId") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_offer_pair_lines" ADD CONSTRAINT "sales_offer_pair_lines_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "sales_offers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_offer_pair_lines" ADD CONSTRAINT "sales_offer_pair_lines_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "item_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_offer_pair_lines" ADD CONSTRAINT "sales_offer_pair_lines_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_offer_bonus_lines" ADD CONSTRAINT "sales_offer_bonus_lines_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "sales_offers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_offer_bonus_lines" ADD CONSTRAINT "sales_offer_bonus_lines_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_offer_discount_lines" ADD CONSTRAINT "sales_offer_discount_lines_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "sales_offers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_offer_discount_lines" ADD CONSTRAINT "sales_offer_discount_lines_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_offer_discount_lines" ADD CONSTRAINT "sales_offer_discount_lines_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_offer_special_lines" ADD CONSTRAINT "sales_offer_special_lines_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "sales_offers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_offer_special_lines" ADD CONSTRAINT "sales_offer_special_lines_customerGroupId_fkey" FOREIGN KEY ("customerGroupId") REFERENCES "customer_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_offer_special_lines" ADD CONSTRAINT "sales_offer_special_lines_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

