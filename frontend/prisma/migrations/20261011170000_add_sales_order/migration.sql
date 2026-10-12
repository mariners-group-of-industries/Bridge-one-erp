-- CreateEnum
CREATE TYPE "CustomerType" AS ENUM ('GENERAL', 'DEALER', 'DISTRIBUTOR', 'RETAILER', 'CORPORATE');

-- CreateEnum
CREATE TYPE "SalesAreaKind" AS ENUM ('ZONE', 'TERRITORY', 'ROUTE', 'SECTION');

-- CreateEnum
CREATE TYPE "SalesOrderStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SalesOrderType" AS ENUM ('SALES', 'SAMPLE', 'EXPORT');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'CREDIT', 'BANK', 'CHEQUE', 'MOBILE_BANKING');

-- CreateEnum
CREATE TYPE "OrderHoldReason" AS ENUM ('CREDIT_LIMIT_EXCEEDED', 'OVERDUE_BALANCE');

-- AlterTable
ALTER TABLE "customers" ADD COLUMN     "binNumber" VARCHAR(30),
ADD COLUMN     "contactPerson" VARCHAR(150),
ADD COLUMN     "customerGroupId" UUID,
ADD COLUMN     "customerType" "CustomerType" NOT NULL DEFAULT 'GENERAL',
ADD COLUMN     "email" VARCHAR(254),
ADD COLUMN     "routeId" UUID,
ADD COLUMN     "sectionId" UUID,
ADD COLUMN     "territoryId" UUID,
ADD COLUMN     "zoneId" UUID;

-- AlterTable
ALTER TABLE "items" ADD COLUMN     "altUom" VARCHAR(20),
ADD COLUMN     "altUomFactor" DECIMAL(14,3),
ADD COLUMN     "categoryId" UUID,
ADD COLUMN     "mrp" DECIMAL(14,2),
ADD COLUMN     "vatPercent" DECIMAL(5,2) NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "sales_areas" (
    "id" UUID NOT NULL,
    "businessUnitId" UUID NOT NULL,
    "kind" "SalesAreaKind" NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "sales_areas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_groups" (
    "id" UUID NOT NULL,
    "businessUnitId" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "customer_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_addresses" (
    "id" UUID NOT NULL,
    "customerId" UUID NOT NULL,
    "label" VARCHAR(60) NOT NULL,
    "address" VARCHAR(500) NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "customer_addresses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "item_categories" (
    "id" UUID NOT NULL,
    "businessUnitId" UUID NOT NULL,
    "parentId" UUID,
    "level" INTEGER NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "item_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "price_lists" (
    "id" UUID NOT NULL,
    "businessUnitId" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "price_lists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "item_prices" (
    "priceListId" UUID NOT NULL,
    "itemId" UUID NOT NULL,
    "rate" DECIMAL(14,2) NOT NULL,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "item_prices_pkey" PRIMARY KEY ("priceListId","itemId")
);

-- CreateTable
CREATE TABLE "sales_orders" (
    "id" UUID NOT NULL,
    "businessUnitId" UUID NOT NULL,
    "officeId" UUID NOT NULL,
    "number" VARCHAR(30) NOT NULL,
    "customerId" UUID NOT NULL,
    "salesPersonId" UUID,
    "quotationId" UUID,
    "priceListId" UUID,
    "shipToAddressId" UUID,
    "orderType" "SalesOrderType" NOT NULL DEFAULT 'SALES',
    "paymentMethod" "PaymentMethod" NOT NULL DEFAULT 'CASH',
    "status" "SalesOrderStatus" NOT NULL DEFAULT 'DRAFT',
    "holdReason" "OrderHoldReason",
    "orderDate" DATE NOT NULL,
    "expectedDeliveryDate" DATE NOT NULL,
    "priceIncludesVat" BOOLEAN NOT NULL DEFAULT true,
    "isForeign" BOOLEAN NOT NULL DEFAULT false,
    "shippingAddress" VARCHAR(500),
    "billingAddress" VARCHAR(500),
    "contactPerson" VARCHAR(150),
    "referredBy" VARCHAR(150),
    "refCustomerPo" VARCHAR(60),
    "refCustomerPoDate" DATE,
    "refCustomerPoAmount" DECIMAL(14,2),
    "refInvoice" VARCHAR(60),
    "refProjectOutlet" VARCHAR(150),
    "paymentTermDays" INTEGER NOT NULL DEFAULT 0,
    "dueLimit" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "remarks" VARCHAR(500),
    "terms" VARCHAR(4000),
    "totalQty" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "itemsTotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "itemsBase" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "vatAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "aitAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "discountAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "deliveryCharge" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "unloadingCharge" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "salesTotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "createdBy" VARCHAR(100) NOT NULL,
    "updatedBy" VARCHAR(100) NOT NULL,
    "submittedAt" TIMESTAMPTZ(3),
    "approvedAt" TIMESTAMPTZ(3),
    "closedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "sales_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_order_lines" (
    "id" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "lineNo" INTEGER NOT NULL,
    "itemId" UUID NOT NULL,
    "uom" VARCHAR(20) NOT NULL,
    "altUom" VARCHAR(20),
    "altUomFactor" DECIMAL(14,3),
    "qty" DECIMAL(14,3) NOT NULL,
    "unitPrice" DECIMAL(14,4) NOT NULL,
    "mrp" DECIMAL(14,2),
    "discountPercent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "vatPercent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "aitPercent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "grossAmount" DECIMAL(14,2) NOT NULL,
    "lineTotal" DECIMAL(14,2) NOT NULL,
    "baseAmount" DECIMAL(14,2) NOT NULL,
    "vatAmount" DECIMAL(14,2) NOT NULL,
    "aitAmount" DECIMAL(14,2) NOT NULL,
    "deliveredQty" DECIMAL(14,3) NOT NULL DEFAULT 0,

    CONSTRAINT "sales_order_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_order_events" (
    "id" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "action" VARCHAR(30) NOT NULL,
    "fromStatus" "SalesOrderStatus",
    "toStatus" "SalesOrderStatus" NOT NULL,
    "remarks" VARCHAR(500),
    "actorId" VARCHAR(100) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sales_order_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sales_areas_businessUnitId_kind_name_key" ON "sales_areas"("businessUnitId", "kind", "name");

-- CreateIndex
CREATE UNIQUE INDEX "customer_groups_businessUnitId_name_key" ON "customer_groups"("businessUnitId", "name");

-- CreateIndex
CREATE INDEX "customer_addresses_customerId_idx" ON "customer_addresses"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "item_categories_businessUnitId_parentId_name_key" ON "item_categories"("businessUnitId", "parentId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "price_lists_businessUnitId_name_key" ON "price_lists"("businessUnitId", "name");

-- CreateIndex
CREATE INDEX "item_prices_itemId_idx" ON "item_prices"("itemId");

-- CreateIndex
CREATE INDEX "sales_orders_businessUnitId_orderDate_idx" ON "sales_orders"("businessUnitId", "orderDate");

-- CreateIndex
CREATE INDEX "sales_orders_officeId_status_orderDate_idx" ON "sales_orders"("officeId", "status", "orderDate");

-- CreateIndex
CREATE INDEX "sales_orders_customerId_status_idx" ON "sales_orders"("customerId", "status");

-- CreateIndex
CREATE INDEX "sales_orders_quotationId_idx" ON "sales_orders"("quotationId");

-- CreateIndex
CREATE UNIQUE INDEX "sales_orders_businessUnitId_number_key" ON "sales_orders"("businessUnitId", "number");

-- CreateIndex
CREATE INDEX "sales_order_lines_itemId_idx" ON "sales_order_lines"("itemId");

-- CreateIndex
CREATE UNIQUE INDEX "sales_order_lines_orderId_lineNo_key" ON "sales_order_lines"("orderId", "lineNo");

-- CreateIndex
CREATE INDEX "sales_order_events_orderId_createdAt_idx" ON "sales_order_events"("orderId", "createdAt");

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_customerGroupId_fkey" FOREIGN KEY ("customerGroupId") REFERENCES "customer_groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "sales_areas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_territoryId_fkey" FOREIGN KEY ("territoryId") REFERENCES "sales_areas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "sales_areas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "sales_areas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "items" ADD CONSTRAINT "items_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "item_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_areas" ADD CONSTRAINT "sales_areas_businessUnitId_fkey" FOREIGN KEY ("businessUnitId") REFERENCES "business_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_groups" ADD CONSTRAINT "customer_groups_businessUnitId_fkey" FOREIGN KEY ("businessUnitId") REFERENCES "business_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_addresses" ADD CONSTRAINT "customer_addresses_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_categories" ADD CONSTRAINT "item_categories_businessUnitId_fkey" FOREIGN KEY ("businessUnitId") REFERENCES "business_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_categories" ADD CONSTRAINT "item_categories_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "item_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_lists" ADD CONSTRAINT "price_lists_businessUnitId_fkey" FOREIGN KEY ("businessUnitId") REFERENCES "business_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_prices" ADD CONSTRAINT "item_prices_priceListId_fkey" FOREIGN KEY ("priceListId") REFERENCES "price_lists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_prices" ADD CONSTRAINT "item_prices_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_orders" ADD CONSTRAINT "sales_orders_businessUnitId_fkey" FOREIGN KEY ("businessUnitId") REFERENCES "business_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_orders" ADD CONSTRAINT "sales_orders_officeId_fkey" FOREIGN KEY ("officeId") REFERENCES "offices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_orders" ADD CONSTRAINT "sales_orders_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_orders" ADD CONSTRAINT "sales_orders_salesPersonId_fkey" FOREIGN KEY ("salesPersonId") REFERENCES "sales_persons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_orders" ADD CONSTRAINT "sales_orders_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "sales_quotations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_orders" ADD CONSTRAINT "sales_orders_priceListId_fkey" FOREIGN KEY ("priceListId") REFERENCES "price_lists"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_orders" ADD CONSTRAINT "sales_orders_shipToAddressId_fkey" FOREIGN KEY ("shipToAddressId") REFERENCES "customer_addresses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_order_lines" ADD CONSTRAINT "sales_order_lines_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "sales_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_order_lines" ADD CONSTRAINT "sales_order_lines_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_order_events" ADD CONSTRAINT "sales_order_events_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "sales_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Move free-text territories into sales_areas, then drop the old column.
INSERT INTO "sales_areas" ("id", "businessUnitId", "kind", "name", "updatedAt")
SELECT gen_random_uuid(), "businessUnitId", 'TERRITORY', LEFT(TRIM("territory"), 100), CURRENT_TIMESTAMP
FROM "customers"
WHERE "territory" IS NOT NULL AND TRIM("territory") <> ''
GROUP BY "businessUnitId", LEFT(TRIM("territory"), 100);

UPDATE "customers" c
SET "territoryId" = a."id"
FROM "sales_areas" a
WHERE a."businessUnitId" = c."businessUnitId" AND a."kind" = 'TERRITORY' AND a."name" = LEFT(TRIM(c."territory"), 100);

ALTER TABLE "customers" DROP COLUMN "territory";

-- Data rules Prisma cannot express.
ALTER TABLE "items" ADD CONSTRAINT "items_extra_check" CHECK (
  ("mrp" IS NULL OR "mrp" >= 0) AND "vatPercent" BETWEEN 0 AND 100
  AND ("altUomFactor" IS NULL OR "altUomFactor" > 0) AND (("altUom" IS NULL) = ("altUomFactor" IS NULL))
);
ALTER TABLE "item_categories" ADD CONSTRAINT "item_categories_level_check" CHECK (
  "level" BETWEEN 1 AND 3 AND (("level" = 1) = ("parentId" IS NULL))
);
ALTER TABLE "item_prices" ADD CONSTRAINT "item_prices_rate_check" CHECK ("rate" >= 0);
-- At most one default address per customer and one default price list per business unit.
CREATE UNIQUE INDEX "customer_addresses_one_default" ON "customer_addresses"("customerId") WHERE "isDefault";
CREATE UNIQUE INDEX "price_lists_one_default" ON "price_lists"("businessUnitId") WHERE "isDefault";
-- Top-level categories: the composite unique index ignores NULL parents.
CREATE UNIQUE INDEX "item_categories_root_name" ON "item_categories"("businessUnitId", "name") WHERE "parentId" IS NULL;
ALTER TABLE "sales_orders" ADD CONSTRAINT "sales_orders_checks" CHECK (
  "expectedDeliveryDate" >= "orderDate" AND "paymentTermDays" BETWEEN 0 AND 365 AND "dueLimit" >= 0
  AND ("refCustomerPoAmount" IS NULL OR "refCustomerPoAmount" >= 0)
  AND "totalQty" >= 0 AND "itemsTotal" >= 0 AND "itemsBase" >= 0 AND "vatAmount" >= 0 AND "aitAmount" >= 0
  AND "discountAmount" >= 0 AND "discountAmount" <= "itemsTotal" AND "deliveryCharge" >= 0 AND "unloadingCharge" >= 0
  AND "salesTotal" >= 0
  AND (("status" = 'PENDING_APPROVAL') = ("holdReason" IS NOT NULL))
);
ALTER TABLE "sales_order_lines" ADD CONSTRAINT "sales_order_lines_checks" CHECK (
  "qty" > 0 AND "unitPrice" >= 0 AND "discountPercent" BETWEEN 0 AND 100 AND "vatPercent" BETWEEN 0 AND 100
  AND "aitPercent" BETWEEN 0 AND 100 AND "grossAmount" >= 0 AND "lineTotal" >= 0 AND "baseAmount" >= 0
  AND "vatAmount" >= 0 AND "aitAmount" >= 0 AND "deliveredQty" >= 0 AND "deliveredQty" <= "qty"
);
