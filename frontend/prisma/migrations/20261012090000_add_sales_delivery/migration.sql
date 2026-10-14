-- CreateEnum
CREATE TYPE "DeliveryType" AS ENUM ('SALES_ORDER', 'DIRECT', 'EXCHANGE');

-- CreateEnum
CREATE TYPE "DeliveryConfirmation" AS ENUM ('PENDING', 'CONFIRMED');

-- CreateEnum
CREATE TYPE "StockSource" AS ENUM ('OPENING', 'ADJUSTMENT', 'SALES_DELIVERY', 'SALES_RETURN');

-- AlterTable
ALTER TABLE "items" ADD COLUMN     "deliveryTolerancePercent" DECIMAL(5,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "sales_collections" ADD COLUMN     "deliveryId" UUID;

-- AlterTable
ALTER TABLE "sales_deliveries" ADD COLUMN     "actualDeliveryDate" DATE,
ADD COLUMN     "aitAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
ADD COLUMN     "billingAddress" VARCHAR(500),
ADD COLUMN     "challanNo" VARCHAR(30),
ADD COLUMN     "confirmation" "DeliveryConfirmation" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "confirmedAt" TIMESTAMPTZ(3),
ADD COLUMN     "confirmedBy" VARCHAR(100),
ADD COLUMN     "contactPerson" VARCHAR(150),
ADD COLUMN     "createdBy" VARCHAR(100),
ADD COLUMN     "deleteReason" VARCHAR(500),
ADD COLUMN     "deletedAt" TIMESTAMPTZ(3),
ADD COLUMN     "deletedBy" VARCHAR(100),
ADD COLUMN     "deliveredAt" TIMESTAMPTZ(3),
ADD COLUMN     "deliveryCharge" DECIMAL(14,2) NOT NULL DEFAULT 0,
ADD COLUMN     "deliveryType" "DeliveryType" NOT NULL DEFAULT 'DIRECT',
ADD COLUMN     "discountAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
ADD COLUMN     "driverName" VARCHAR(100),
ADD COLUMN     "driverPhone" VARCHAR(30),
ADD COLUMN     "exchangeReturnId" UUID,
ADD COLUMN     "itemsBase" DECIMAL(14,2) NOT NULL DEFAULT 0,
ADD COLUMN     "itemsTotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
ADD COLUMN     "officeId" UUID,
ADD COLUMN     "paidAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
ADD COLUMN     "paymentMethod" "PaymentMethod" NOT NULL DEFAULT 'CASH',
ADD COLUMN     "paymentTermDays" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "priceIncludesVat" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "refCustomerPo" VARCHAR(60),
ADD COLUMN     "refCustomerPoDate" DATE,
ADD COLUMN     "refInvoice" VARCHAR(60),
ADD COLUMN     "refProjectOutlet" VARCHAR(150),
ADD COLUMN     "salesOrderId" UUID,
ADD COLUMN     "shipToAddressId" UUID,
ADD COLUMN     "shippingAddress" VARCHAR(500),
ADD COLUMN     "terms" VARCHAR(4000),
ADD COLUMN     "transporterName" VARCHAR(150),
ADD COLUMN     "unloadingCharge" DECIMAL(14,2) NOT NULL DEFAULT 0,
ADD COLUMN     "updatedBy" VARCHAR(100),
ADD COLUMN     "vatAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
ADD COLUMN     "vatChallanNo" VARCHAR(40),
ADD COLUMN     "vehicleNo" VARCHAR(40),
ADD COLUMN     "warehouseId" UUID;

-- AlterTable
ALTER TABLE "sales_delivery_lines" ADD COLUMN     "aitAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
ADD COLUMN     "aitPercent" DECIMAL(5,2) NOT NULL DEFAULT 0,
ADD COLUMN     "altUom" VARCHAR(20),
ADD COLUMN     "altUomFactor" DECIMAL(14,3),
ADD COLUMN     "baseAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
ADD COLUMN     "discountPercent" DECIMAL(5,2) NOT NULL DEFAULT 0,
ADD COLUMN     "grossAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
ADD COLUMN     "orderLineId" UUID,
ADD COLUMN     "uom" VARCHAR(20),
ADD COLUMN     "vatAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
ADD COLUMN     "vatPercent" DECIMAL(5,2) NOT NULL DEFAULT 0,
ALTER COLUMN "rate" SET DATA TYPE DECIMAL(14,4);

-- AlterTable
ALTER TABLE "sales_orders" ADD COLUMN     "deliveryPendingReasonId" UUID;

-- AlterTable
ALTER TABLE "sales_returns" ADD COLUMN     "createdBy" VARCHAR(100),
ADD COLUMN     "officeId" UUID,
ADD COLUMN     "warehouseId" UUID;

-- CreateTable
CREATE TABLE "delivery_pending_reasons" (
    "id" UUID NOT NULL,
    "businessUnitId" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "delivery_pending_reasons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_entries" (
    "id" UUID NOT NULL,
    "businessUnitId" UUID NOT NULL,
    "warehouseId" UUID NOT NULL,
    "itemId" UUID NOT NULL,
    "qty" DECIMAL(14,3) NOT NULL,
    "source" "StockSource" NOT NULL,
    "sourceId" UUID,
    "postingDate" DATE NOT NULL,
    "remarks" VARCHAR(500),
    "createdBy" VARCHAR(100) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "delivery_pending_reasons_businessUnitId_name_key" ON "delivery_pending_reasons"("businessUnitId", "name");

-- CreateIndex
CREATE INDEX "stock_entries_warehouseId_itemId_idx" ON "stock_entries"("warehouseId", "itemId");

-- CreateIndex
CREATE INDEX "stock_entries_itemId_idx" ON "stock_entries"("itemId");

-- CreateIndex
CREATE INDEX "stock_entries_source_sourceId_idx" ON "stock_entries"("source", "sourceId");

-- CreateIndex
CREATE UNIQUE INDEX "sales_deliveries_exchangeReturnId_key" ON "sales_deliveries"("exchangeReturnId");

-- CreateIndex
CREATE INDEX "sales_deliveries_salesOrderId_idx" ON "sales_deliveries"("salesOrderId");

-- CreateIndex
CREATE INDEX "sales_deliveries_officeId_deliveryType_deliveryDate_idx" ON "sales_deliveries"("officeId", "deliveryType", "deliveryDate");

-- CreateIndex
CREATE UNIQUE INDEX "sales_deliveries_businessUnitId_challanNo_key" ON "sales_deliveries"("businessUnitId", "challanNo");

-- CreateIndex
CREATE INDEX "sales_delivery_lines_orderLineId_idx" ON "sales_delivery_lines"("orderLineId");

-- AddForeignKey
ALTER TABLE "sales_deliveries" ADD CONSTRAINT "sales_deliveries_officeId_fkey" FOREIGN KEY ("officeId") REFERENCES "offices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_deliveries" ADD CONSTRAINT "sales_deliveries_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_deliveries" ADD CONSTRAINT "sales_deliveries_salesOrderId_fkey" FOREIGN KEY ("salesOrderId") REFERENCES "sales_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_deliveries" ADD CONSTRAINT "sales_deliveries_shipToAddressId_fkey" FOREIGN KEY ("shipToAddressId") REFERENCES "customer_addresses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_deliveries" ADD CONSTRAINT "sales_deliveries_exchangeReturnId_fkey" FOREIGN KEY ("exchangeReturnId") REFERENCES "sales_returns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_delivery_lines" ADD CONSTRAINT "sales_delivery_lines_orderLineId_fkey" FOREIGN KEY ("orderLineId") REFERENCES "sales_order_lines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_returns" ADD CONSTRAINT "sales_returns_officeId_fkey" FOREIGN KEY ("officeId") REFERENCES "offices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_returns" ADD CONSTRAINT "sales_returns_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_collections" ADD CONSTRAINT "sales_collections_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "sales_deliveries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_orders" ADD CONSTRAINT "sales_orders_deliveryPendingReasonId_fkey" FOREIGN KEY ("deliveryPendingReasonId") REFERENCES "delivery_pending_reasons"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_pending_reasons" ADD CONSTRAINT "delivery_pending_reasons_businessUnitId_fkey" FOREIGN KEY ("businessUnitId") REFERENCES "business_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_entries" ADD CONSTRAINT "stock_entries_businessUnitId_fkey" FOREIGN KEY ("businessUnitId") REFERENCES "business_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_entries" ADD CONSTRAINT "stock_entries_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_entries" ADD CONSTRAINT "stock_entries_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Data rules Prisma cannot express.
ALTER TABLE "items" ADD CONSTRAINT "items_tolerance_check" CHECK ("deliveryTolerancePercent" BETWEEN 0 AND 100);
ALTER TABLE "sales_deliveries" ADD CONSTRAINT "sales_deliveries_amounts_check2" CHECK (
  "paymentTermDays" BETWEEN 0 AND 365 AND "itemsTotal" >= 0 AND "itemsBase" >= 0 AND "vatAmount" >= 0
  AND "aitAmount" >= 0 AND "discountAmount" >= 0 AND "deliveryCharge" >= 0 AND "unloadingCharge" >= 0
  AND "paidAmount" >= 0 AND "paidAmount" <= "totalAmount"
  AND ("deliveryType" <> 'SALES_ORDER' OR "salesOrderId" IS NOT NULL)
  AND (("deliveryType" = 'EXCHANGE') = ("exchangeReturnId" IS NOT NULL) OR "status" <> 'SUBMITTED' OR "officeId" IS NULL)
  AND (("confirmation" = 'CONFIRMED') = ("confirmedAt" IS NOT NULL))
);
ALTER TABLE "sales_delivery_lines" ADD CONSTRAINT "sales_delivery_lines_amounts_check2" CHECK (
  "discountPercent" BETWEEN 0 AND 100 AND "vatPercent" BETWEEN 0 AND 100 AND "aitPercent" BETWEEN 0 AND 100
  AND "grossAmount" >= 0 AND "baseAmount" >= 0 AND "vatAmount" >= 0 AND "aitAmount" >= 0
);
ALTER TABLE "stock_entries" ADD CONSTRAINT "stock_entries_qty_check" CHECK ("qty" <> 0);
-- Tolerance lets a line deliver more than ordered (at most +100 %).
ALTER TABLE "sales_order_lines" DROP CONSTRAINT "sales_order_lines_checks";
ALTER TABLE "sales_order_lines" ADD CONSTRAINT "sales_order_lines_checks" CHECK (
  "qty" > 0 AND "unitPrice" >= 0 AND "discountPercent" BETWEEN 0 AND 100 AND "vatPercent" BETWEEN 0 AND 100
  AND "aitPercent" BETWEEN 0 AND 100 AND "grossAmount" >= 0 AND "lineTotal" >= 0 AND "baseAmount" >= 0
  AND "vatAmount" >= 0 AND "aitAmount" >= 0 AND "deliveredQty" >= 0 AND "deliveredQty" <= "qty" * 2
);
