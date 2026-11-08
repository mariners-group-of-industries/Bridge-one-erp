-- RTM: outlets, channels, retail orders, deliveries, collections, returns, distributor stock, field force, offers, targets, settings.
-- CreateEnum
CREATE TYPE "RtmDocStatus" AS ENUM ('PENDING', 'APPROVED', 'COMPLETED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "RtmStockSource" AS ENUM ('OPENING', 'ADJUSTMENT', 'DELIVERY', 'RETURN', 'TRANSFER_OUT', 'TRANSFER_IN');

-- CreateEnum
CREATE TYPE "RtmPaymentMethod" AS ENUM ('CASH', 'BANK', 'MFS', 'CHEQUE');

-- CreateEnum
CREATE TYPE "RtmDayType" AS ENUM ('WORKING', 'WEEKEND', 'HOLIDAY', 'LEAVE');

-- CreateEnum
CREATE TYPE "RtmVisitKind" AS ENUM ('CHECK_IN', 'VISIT', 'CHECK_OUT');

-- CreateTable
CREATE TABLE "rtm_channels" (
    "id" UUID NOT NULL,
    "businessUnitId" UUID NOT NULL,
    "code" VARCHAR(20) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" VARCHAR(300),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "rtm_channels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rtm_outlets" (
    "id" UUID NOT NULL,
    "businessUnitId" UUID NOT NULL,
    "code" VARCHAR(30) NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "ownerName" VARCHAR(150),
    "phone" VARCHAR(30),
    "address" VARCHAR(300),
    "channelId" UUID,
    "distributorId" UUID NOT NULL,
    "routeId" UUID,
    "latitude" DECIMAL(10,7),
    "longitude" DECIMAL(10,7),
    "creditLimit" DECIMAL(14,2),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" VARCHAR(150) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "rtm_outlets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rtm_orders" (
    "id" UUID NOT NULL,
    "businessUnitId" UUID NOT NULL,
    "number" VARCHAR(30) NOT NULL,
    "orderDate" DATE NOT NULL,
    "outletId" UUID NOT NULL,
    "distributorId" UUID NOT NULL,
    "srId" UUID,
    "status" "RtmDocStatus" NOT NULL DEFAULT 'PENDING',
    "subtotal" DECIMAL(14,2) NOT NULL,
    "discount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(14,2) NOT NULL,
    "offerId" UUID,
    "remarks" VARCHAR(500),
    "createdBy" VARCHAR(150) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "rtm_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rtm_order_lines" (
    "id" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "lineNo" INTEGER NOT NULL,
    "itemId" UUID NOT NULL,
    "qty" DECIMAL(14,3) NOT NULL,
    "rate" DECIMAL(14,2) NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "deliveredQty" DECIMAL(14,3) NOT NULL DEFAULT 0,

    CONSTRAINT "rtm_order_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rtm_deliveries" (
    "id" UUID NOT NULL,
    "businessUnitId" UUID NOT NULL,
    "number" VARCHAR(30) NOT NULL,
    "deliveryDate" DATE NOT NULL,
    "orderId" UUID,
    "outletId" UUID NOT NULL,
    "distributorId" UUID NOT NULL,
    "srId" UUID,
    "isDirect" BOOLEAN NOT NULL DEFAULT false,
    "status" "RtmDocStatus" NOT NULL DEFAULT 'COMPLETED',
    "subtotal" DECIMAL(14,2) NOT NULL,
    "discount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(14,2) NOT NULL,
    "remarks" VARCHAR(500),
    "createdBy" VARCHAR(150) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rtm_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rtm_delivery_lines" (
    "id" UUID NOT NULL,
    "deliveryId" UUID NOT NULL,
    "lineNo" INTEGER NOT NULL,
    "itemId" UUID NOT NULL,
    "qty" DECIMAL(14,3) NOT NULL,
    "rate" DECIMAL(14,2) NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "rtm_delivery_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rtm_collections" (
    "id" UUID NOT NULL,
    "businessUnitId" UUID NOT NULL,
    "number" VARCHAR(30) NOT NULL,
    "collectionDate" DATE NOT NULL,
    "outletId" UUID NOT NULL,
    "distributorId" UUID NOT NULL,
    "srId" UUID,
    "amount" DECIMAL(14,2) NOT NULL,
    "method" "RtmPaymentMethod" NOT NULL DEFAULT 'CASH',
    "reference" VARCHAR(100),
    "remarks" VARCHAR(500),
    "status" "RtmDocStatus" NOT NULL DEFAULT 'COMPLETED',
    "createdBy" VARCHAR(150) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rtm_collections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rtm_returns" (
    "id" UUID NOT NULL,
    "businessUnitId" UUID NOT NULL,
    "number" VARCHAR(30) NOT NULL,
    "returnDate" DATE NOT NULL,
    "outletId" UUID NOT NULL,
    "distributorId" UUID NOT NULL,
    "deliveryId" UUID,
    "reason" VARCHAR(300),
    "total" DECIMAL(14,2) NOT NULL,
    "status" "RtmDocStatus" NOT NULL DEFAULT 'COMPLETED',
    "createdBy" VARCHAR(150) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rtm_returns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rtm_return_lines" (
    "id" UUID NOT NULL,
    "returnId" UUID NOT NULL,
    "lineNo" INTEGER NOT NULL,
    "itemId" UUID NOT NULL,
    "qty" DECIMAL(14,3) NOT NULL,
    "rate" DECIMAL(14,2) NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "rtm_return_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rtm_stock_entries" (
    "id" UUID NOT NULL,
    "businessUnitId" UUID NOT NULL,
    "distributorId" UUID NOT NULL,
    "itemId" UUID NOT NULL,
    "qty" DECIMAL(14,3) NOT NULL,
    "source" "RtmStockSource" NOT NULL,
    "sourceId" UUID,
    "postingDate" DATE NOT NULL,
    "remarks" VARCHAR(300),
    "createdBy" VARCHAR(150) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rtm_stock_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rtm_stock_transfers" (
    "id" UUID NOT NULL,
    "businessUnitId" UUID NOT NULL,
    "number" VARCHAR(30) NOT NULL,
    "requestDate" DATE NOT NULL,
    "fromDistributorId" UUID NOT NULL,
    "toDistributorId" UUID NOT NULL,
    "status" "RtmDocStatus" NOT NULL DEFAULT 'PENDING',
    "remarks" VARCHAR(500),
    "requestedBy" VARCHAR(150) NOT NULL,
    "approvedBy" VARCHAR(150),
    "issuedBy" VARCHAR(150),
    "issuedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rtm_stock_transfers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rtm_stock_transfer_lines" (
    "id" UUID NOT NULL,
    "transferId" UUID NOT NULL,
    "lineNo" INTEGER NOT NULL,
    "itemId" UUID NOT NULL,
    "qty" DECIMAL(14,3) NOT NULL,
    "issuedQty" DECIMAL(14,3) NOT NULL DEFAULT 0,

    CONSTRAINT "rtm_stock_transfer_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rtm_stock_adjustments" (
    "id" UUID NOT NULL,
    "businessUnitId" UUID NOT NULL,
    "number" VARCHAR(30) NOT NULL,
    "adjustDate" DATE NOT NULL,
    "distributorId" UUID NOT NULL,
    "reason" VARCHAR(100) NOT NULL,
    "remarks" VARCHAR(500),
    "status" "RtmDocStatus" NOT NULL DEFAULT 'PENDING',
    "createdBy" VARCHAR(150) NOT NULL,
    "approvedBy" VARCHAR(150),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rtm_stock_adjustments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rtm_stock_adjustment_lines" (
    "id" UUID NOT NULL,
    "adjustmentId" UUID NOT NULL,
    "lineNo" INTEGER NOT NULL,
    "itemId" UUID NOT NULL,
    "qty" DECIMAL(14,3) NOT NULL,

    CONSTRAINT "rtm_stock_adjustment_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rtm_sr_calendar_days" (
    "id" UUID NOT NULL,
    "businessUnitId" UUID NOT NULL,
    "employeeId" UUID NOT NULL,
    "day" DATE NOT NULL,
    "dayType" "RtmDayType" NOT NULL,
    "remarks" VARCHAR(200),

    CONSTRAINT "rtm_sr_calendar_days_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rtm_tour_plans" (
    "id" UUID NOT NULL,
    "businessUnitId" UUID NOT NULL,
    "employeeId" UUID NOT NULL,
    "planDate" DATE NOT NULL,
    "routeId" UUID,
    "distributorId" UUID,
    "purpose" VARCHAR(300),
    "status" "RtmDocStatus" NOT NULL DEFAULT 'PENDING',
    "createdBy" VARCHAR(150) NOT NULL,
    "approvedBy" VARCHAR(150),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rtm_tour_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rtm_visits" (
    "id" UUID NOT NULL,
    "businessUnitId" UUID NOT NULL,
    "employeeId" UUID NOT NULL,
    "outletId" UUID,
    "kind" "RtmVisitKind" NOT NULL,
    "visitedAt" TIMESTAMPTZ(3) NOT NULL,
    "latitude" DECIMAL(10,7),
    "longitude" DECIMAL(10,7),
    "remarks" VARCHAR(300),
    "createdBy" VARCHAR(150) NOT NULL,

    CONSTRAINT "rtm_visits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rtm_offers" (
    "id" UUID NOT NULL,
    "businessUnitId" UUID NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "channelId" UUID,
    "itemId" UUID,
    "minQty" DECIMAL(14,3),
    "minAmount" DECIMAL(14,2),
    "discountPercent" DECIMAL(5,2),
    "discountAmount" DECIMAL(14,2),
    "validFrom" DATE NOT NULL,
    "validTo" DATE NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" VARCHAR(150) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rtm_offers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rtm_targets" (
    "id" UUID NOT NULL,
    "businessUnitId" UUID NOT NULL,
    "month" VARCHAR(7) NOT NULL,
    "employeeId" UUID,
    "distributorId" UUID,
    "itemId" UUID,
    "targetQty" DECIMAL(14,3),
    "targetValue" DECIMAL(14,2),
    "createdBy" VARCHAR(150) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rtm_targets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rtm_settings" (
    "businessUnitId" UUID NOT NULL,
    "key" VARCHAR(60) NOT NULL,
    "value" VARCHAR(300) NOT NULL,
    "updatedBy" VARCHAR(150),
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "rtm_settings_pkey" PRIMARY KEY ("businessUnitId","key")
);

-- CreateIndex
CREATE UNIQUE INDEX "rtm_channels_businessUnitId_code_key" ON "rtm_channels"("businessUnitId", "code");

-- CreateIndex
CREATE INDEX "rtm_outlets_distributorId_idx" ON "rtm_outlets"("distributorId");

-- CreateIndex
CREATE UNIQUE INDEX "rtm_outlets_businessUnitId_code_key" ON "rtm_outlets"("businessUnitId", "code");

-- CreateIndex
CREATE INDEX "rtm_orders_businessUnitId_orderDate_idx" ON "rtm_orders"("businessUnitId", "orderDate");

-- CreateIndex
CREATE INDEX "rtm_orders_outletId_idx" ON "rtm_orders"("outletId");

-- CreateIndex
CREATE UNIQUE INDEX "rtm_orders_businessUnitId_number_key" ON "rtm_orders"("businessUnitId", "number");

-- CreateIndex
CREATE INDEX "rtm_order_lines_orderId_idx" ON "rtm_order_lines"("orderId");

-- CreateIndex
CREATE INDEX "rtm_deliveries_businessUnitId_deliveryDate_idx" ON "rtm_deliveries"("businessUnitId", "deliveryDate");

-- CreateIndex
CREATE INDEX "rtm_deliveries_outletId_idx" ON "rtm_deliveries"("outletId");

-- CreateIndex
CREATE UNIQUE INDEX "rtm_deliveries_businessUnitId_number_key" ON "rtm_deliveries"("businessUnitId", "number");

-- CreateIndex
CREATE INDEX "rtm_delivery_lines_deliveryId_idx" ON "rtm_delivery_lines"("deliveryId");

-- CreateIndex
CREATE INDEX "rtm_collections_outletId_idx" ON "rtm_collections"("outletId");

-- CreateIndex
CREATE UNIQUE INDEX "rtm_collections_businessUnitId_number_key" ON "rtm_collections"("businessUnitId", "number");

-- CreateIndex
CREATE INDEX "rtm_returns_outletId_idx" ON "rtm_returns"("outletId");

-- CreateIndex
CREATE UNIQUE INDEX "rtm_returns_businessUnitId_number_key" ON "rtm_returns"("businessUnitId", "number");

-- CreateIndex
CREATE INDEX "rtm_return_lines_returnId_idx" ON "rtm_return_lines"("returnId");

-- CreateIndex
CREATE INDEX "rtm_stock_entries_distributorId_itemId_idx" ON "rtm_stock_entries"("distributorId", "itemId");

-- CreateIndex
CREATE INDEX "rtm_stock_entries_source_sourceId_idx" ON "rtm_stock_entries"("source", "sourceId");

-- CreateIndex
CREATE UNIQUE INDEX "rtm_stock_transfers_businessUnitId_number_key" ON "rtm_stock_transfers"("businessUnitId", "number");

-- CreateIndex
CREATE INDEX "rtm_stock_transfer_lines_transferId_idx" ON "rtm_stock_transfer_lines"("transferId");

-- CreateIndex
CREATE UNIQUE INDEX "rtm_stock_adjustments_businessUnitId_number_key" ON "rtm_stock_adjustments"("businessUnitId", "number");

-- CreateIndex
CREATE INDEX "rtm_stock_adjustment_lines_adjustmentId_idx" ON "rtm_stock_adjustment_lines"("adjustmentId");

-- CreateIndex
CREATE UNIQUE INDEX "rtm_sr_calendar_days_employeeId_day_key" ON "rtm_sr_calendar_days"("employeeId", "day");

-- CreateIndex
CREATE INDEX "rtm_tour_plans_employeeId_planDate_idx" ON "rtm_tour_plans"("employeeId", "planDate");

-- CreateIndex
CREATE INDEX "rtm_visits_employeeId_visitedAt_idx" ON "rtm_visits"("employeeId", "visitedAt");

-- CreateIndex
CREATE INDEX "rtm_visits_outletId_idx" ON "rtm_visits"("outletId");

-- CreateIndex
CREATE INDEX "rtm_targets_businessUnitId_month_idx" ON "rtm_targets"("businessUnitId", "month");

-- AddForeignKey
ALTER TABLE "rtm_channels" ADD CONSTRAINT "rtm_channels_businessUnitId_fkey" FOREIGN KEY ("businessUnitId") REFERENCES "business_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rtm_outlets" ADD CONSTRAINT "rtm_outlets_businessUnitId_fkey" FOREIGN KEY ("businessUnitId") REFERENCES "business_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rtm_outlets" ADD CONSTRAINT "rtm_outlets_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "rtm_channels"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rtm_outlets" ADD CONSTRAINT "rtm_outlets_distributorId_fkey" FOREIGN KEY ("distributorId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rtm_outlets" ADD CONSTRAINT "rtm_outlets_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "sales_areas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rtm_orders" ADD CONSTRAINT "rtm_orders_businessUnitId_fkey" FOREIGN KEY ("businessUnitId") REFERENCES "business_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rtm_orders" ADD CONSTRAINT "rtm_orders_outletId_fkey" FOREIGN KEY ("outletId") REFERENCES "rtm_outlets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rtm_orders" ADD CONSTRAINT "rtm_orders_distributorId_fkey" FOREIGN KEY ("distributorId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rtm_orders" ADD CONSTRAINT "rtm_orders_srId_fkey" FOREIGN KEY ("srId") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rtm_orders" ADD CONSTRAINT "rtm_orders_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "rtm_offers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rtm_order_lines" ADD CONSTRAINT "rtm_order_lines_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "rtm_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rtm_order_lines" ADD CONSTRAINT "rtm_order_lines_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rtm_deliveries" ADD CONSTRAINT "rtm_deliveries_businessUnitId_fkey" FOREIGN KEY ("businessUnitId") REFERENCES "business_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rtm_deliveries" ADD CONSTRAINT "rtm_deliveries_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "rtm_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rtm_deliveries" ADD CONSTRAINT "rtm_deliveries_outletId_fkey" FOREIGN KEY ("outletId") REFERENCES "rtm_outlets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rtm_deliveries" ADD CONSTRAINT "rtm_deliveries_distributorId_fkey" FOREIGN KEY ("distributorId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rtm_deliveries" ADD CONSTRAINT "rtm_deliveries_srId_fkey" FOREIGN KEY ("srId") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rtm_delivery_lines" ADD CONSTRAINT "rtm_delivery_lines_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "rtm_deliveries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rtm_delivery_lines" ADD CONSTRAINT "rtm_delivery_lines_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rtm_collections" ADD CONSTRAINT "rtm_collections_businessUnitId_fkey" FOREIGN KEY ("businessUnitId") REFERENCES "business_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rtm_collections" ADD CONSTRAINT "rtm_collections_outletId_fkey" FOREIGN KEY ("outletId") REFERENCES "rtm_outlets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rtm_collections" ADD CONSTRAINT "rtm_collections_distributorId_fkey" FOREIGN KEY ("distributorId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rtm_collections" ADD CONSTRAINT "rtm_collections_srId_fkey" FOREIGN KEY ("srId") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rtm_returns" ADD CONSTRAINT "rtm_returns_businessUnitId_fkey" FOREIGN KEY ("businessUnitId") REFERENCES "business_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rtm_returns" ADD CONSTRAINT "rtm_returns_outletId_fkey" FOREIGN KEY ("outletId") REFERENCES "rtm_outlets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rtm_returns" ADD CONSTRAINT "rtm_returns_distributorId_fkey" FOREIGN KEY ("distributorId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rtm_returns" ADD CONSTRAINT "rtm_returns_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "rtm_deliveries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rtm_return_lines" ADD CONSTRAINT "rtm_return_lines_returnId_fkey" FOREIGN KEY ("returnId") REFERENCES "rtm_returns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rtm_return_lines" ADD CONSTRAINT "rtm_return_lines_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rtm_stock_entries" ADD CONSTRAINT "rtm_stock_entries_businessUnitId_fkey" FOREIGN KEY ("businessUnitId") REFERENCES "business_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rtm_stock_entries" ADD CONSTRAINT "rtm_stock_entries_distributorId_fkey" FOREIGN KEY ("distributorId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rtm_stock_entries" ADD CONSTRAINT "rtm_stock_entries_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rtm_stock_transfers" ADD CONSTRAINT "rtm_stock_transfers_businessUnitId_fkey" FOREIGN KEY ("businessUnitId") REFERENCES "business_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rtm_stock_transfers" ADD CONSTRAINT "rtm_stock_transfers_fromDistributorId_fkey" FOREIGN KEY ("fromDistributorId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rtm_stock_transfers" ADD CONSTRAINT "rtm_stock_transfers_toDistributorId_fkey" FOREIGN KEY ("toDistributorId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rtm_stock_transfer_lines" ADD CONSTRAINT "rtm_stock_transfer_lines_transferId_fkey" FOREIGN KEY ("transferId") REFERENCES "rtm_stock_transfers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rtm_stock_transfer_lines" ADD CONSTRAINT "rtm_stock_transfer_lines_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rtm_stock_adjustments" ADD CONSTRAINT "rtm_stock_adjustments_businessUnitId_fkey" FOREIGN KEY ("businessUnitId") REFERENCES "business_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rtm_stock_adjustments" ADD CONSTRAINT "rtm_stock_adjustments_distributorId_fkey" FOREIGN KEY ("distributorId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rtm_stock_adjustment_lines" ADD CONSTRAINT "rtm_stock_adjustment_lines_adjustmentId_fkey" FOREIGN KEY ("adjustmentId") REFERENCES "rtm_stock_adjustments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rtm_stock_adjustment_lines" ADD CONSTRAINT "rtm_stock_adjustment_lines_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rtm_sr_calendar_days" ADD CONSTRAINT "rtm_sr_calendar_days_businessUnitId_fkey" FOREIGN KEY ("businessUnitId") REFERENCES "business_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rtm_sr_calendar_days" ADD CONSTRAINT "rtm_sr_calendar_days_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rtm_tour_plans" ADD CONSTRAINT "rtm_tour_plans_businessUnitId_fkey" FOREIGN KEY ("businessUnitId") REFERENCES "business_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rtm_tour_plans" ADD CONSTRAINT "rtm_tour_plans_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rtm_tour_plans" ADD CONSTRAINT "rtm_tour_plans_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "sales_areas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rtm_tour_plans" ADD CONSTRAINT "rtm_tour_plans_distributorId_fkey" FOREIGN KEY ("distributorId") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rtm_visits" ADD CONSTRAINT "rtm_visits_businessUnitId_fkey" FOREIGN KEY ("businessUnitId") REFERENCES "business_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rtm_visits" ADD CONSTRAINT "rtm_visits_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rtm_visits" ADD CONSTRAINT "rtm_visits_outletId_fkey" FOREIGN KEY ("outletId") REFERENCES "rtm_outlets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rtm_offers" ADD CONSTRAINT "rtm_offers_businessUnitId_fkey" FOREIGN KEY ("businessUnitId") REFERENCES "business_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rtm_offers" ADD CONSTRAINT "rtm_offers_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "rtm_channels"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rtm_offers" ADD CONSTRAINT "rtm_offers_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rtm_targets" ADD CONSTRAINT "rtm_targets_businessUnitId_fkey" FOREIGN KEY ("businessUnitId") REFERENCES "business_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rtm_targets" ADD CONSTRAINT "rtm_targets_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rtm_targets" ADD CONSTRAINT "rtm_targets_distributorId_fkey" FOREIGN KEY ("distributorId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rtm_targets" ADD CONSTRAINT "rtm_targets_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rtm_settings" ADD CONSTRAINT "rtm_settings_businessUnitId_fkey" FOREIGN KEY ("businessUnitId") REFERENCES "business_units"("id") ON DELETE CASCADE ON UPDATE CASCADE;

