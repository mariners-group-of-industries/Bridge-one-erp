-- CreateEnum
CREATE TYPE "PurchaseRequisitionStatus" AS ENUM ('DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'ORDERED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PurchaseRequisitionPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "PurchaseOrderStatus" AS ENUM ('DRAFT', 'PENDING', 'APPROVED', 'PARTIAL_RECEIVED', 'RECEIVED', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "GoodsReceiptStatus" AS ENUM ('DRAFT', 'RECEIVED', 'INSPECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PurchaseReturnStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PurchasePaymentMethod" AS ENUM ('CASH', 'BANK', 'CHEQUE', 'ONLINE');

-- CreateEnum
CREATE TYPE "PurchasePaymentStatus" AS ENUM ('DRAFT', 'PAID', 'CANCELLED');

CREATE TABLE "suppliers" (
    "id" UUID NOT NULL,
    "businessUnitId" UUID NOT NULL,
    "code" VARCHAR(30) NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "contactPerson" VARCHAR(150),
    "email" VARCHAR(254),
    "phone" VARCHAR(30),
    "address" VARCHAR(500),
    "taxNumber" VARCHAR(50),
    "type" VARCHAR(30) NOT NULL DEFAULT 'LOCAL',
    "status" VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    "balance" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_requisitions" (
    "id" UUID NOT NULL,
    "businessUnitId" UUID NOT NULL,
    "officeId" UUID NOT NULL,
    "warehouseId" UUID,
    "number" VARCHAR(30) NOT NULL,
    "department" VARCHAR(100) NOT NULL,
    "requestedBy" VARCHAR(150) NOT NULL,
    "requisitionDate" DATE NOT NULL,
    "requiredDate" DATE NOT NULL,
    "status" "PurchaseRequisitionStatus" NOT NULL DEFAULT 'PENDING',
    "priority" "PurchaseRequisitionPriority" NOT NULL DEFAULT 'MEDIUM',
    "requestType" VARCHAR(30) NOT NULL DEFAULT 'LOCAL',
    "purchaseMethod" VARCHAR(30) NOT NULL DEFAULT 'DIRECT',
    "totalEstimated" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "notes" VARCHAR(1000),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "purchase_requisitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_requisition_lines" (
    "id" UUID NOT NULL,
    "requisitionId" UUID NOT NULL,
    "lineNo" INTEGER NOT NULL,
    "itemId" UUID,
    "itemCode" VARCHAR(50) NOT NULL,
    "itemName" VARCHAR(200) NOT NULL,
    "uom" VARCHAR(20) NOT NULL DEFAULT 'Pcs',
    "quantity" DECIMAL(14,3) NOT NULL,
    "estimatedUnitPrice" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "lineTotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "remarks" VARCHAR(500),

    CONSTRAINT "purchase_requisition_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_orders" (
    "id" UUID NOT NULL,
    "businessUnitId" UUID NOT NULL,
    "officeId" UUID NOT NULL,
    "warehouseId" UUID,
    "supplierId" UUID NOT NULL,
    "requisitionId" UUID,
    "number" VARCHAR(30) NOT NULL,
    "orderDate" DATE NOT NULL,
    "expectedDeliveryDate" DATE,
    "referenceNumber" VARCHAR(100),
    "projectCostCenter" VARCHAR(100),
    "status" "PurchaseOrderStatus" NOT NULL DEFAULT 'PENDING',
    "subtotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "totalDiscount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "totalTax" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "shippingFee" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "totalAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "notes" VARCHAR(1000),
    "createdBy" VARCHAR(150) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "purchase_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_order_lines" (
    "id" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "lineNo" INTEGER NOT NULL,
    "itemId" UUID,
    "itemCode" VARCHAR(50) NOT NULL,
    "itemName" VARCHAR(200) NOT NULL,
    "uom" VARCHAR(20) NOT NULL DEFAULT 'Pcs',
    "quantity" DECIMAL(14,3) NOT NULL,
    "unitPrice" DECIMAL(14,2) NOT NULL,
    "discountPercent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "vatPercent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "lineTotal" DECIMAL(14,2) NOT NULL,
    "receivedQuantity" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "remarks" VARCHAR(500),

    CONSTRAINT "purchase_order_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "goods_receipts" (
    "id" UUID NOT NULL,
    "businessUnitId" UUID NOT NULL,
    "officeId" UUID NOT NULL,
    "warehouseId" UUID,
    "orderId" UUID NOT NULL,
    "supplierId" UUID NOT NULL,
    "number" VARCHAR(30) NOT NULL,
    "challanNumber" VARCHAR(100),
    "challanDate" DATE,
    "receiveDate" DATE NOT NULL,
    "gatePassNumber" VARCHAR(100),
    "status" "GoodsReceiptStatus" NOT NULL DEFAULT 'RECEIVED',
    "totalReceivedQty" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "totalAcceptedQty" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "totalRejectedQty" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "totalAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "remarks" VARCHAR(1000),
    "receivedBy" VARCHAR(150) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "goods_receipts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "goods_receipt_lines" (
    "id" UUID NOT NULL,
    "receiptId" UUID NOT NULL,
    "lineNo" INTEGER NOT NULL,
    "itemId" UUID,
    "itemCode" VARCHAR(50) NOT NULL,
    "itemName" VARCHAR(200) NOT NULL,
    "uom" VARCHAR(20) NOT NULL DEFAULT 'Pcs',
    "orderedQty" DECIMAL(14,3) NOT NULL,
    "receivedQty" DECIMAL(14,3) NOT NULL,
    "acceptedQty" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "rejectedQty" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "unitPrice" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "lineTotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "remarks" VARCHAR(500),

    CONSTRAINT "goods_receipt_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_returns" (
    "id" UUID NOT NULL,
    "businessUnitId" UUID NOT NULL,
    "officeId" UUID NOT NULL,
    "warehouseId" UUID,
    "receiptId" UUID,
    "orderId" UUID,
    "supplierId" UUID NOT NULL,
    "number" VARCHAR(30) NOT NULL,
    "returnDate" DATE NOT NULL,
    "reason" VARCHAR(500),
    "status" "PurchaseReturnStatus" NOT NULL DEFAULT 'SUBMITTED',
    "totalQty" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "totalAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "purchase_returns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_return_lines" (
    "id" UUID NOT NULL,
    "returnId" UUID NOT NULL,
    "lineNo" INTEGER NOT NULL,
    "itemId" UUID,
    "itemCode" VARCHAR(50) NOT NULL,
    "itemName" VARCHAR(200) NOT NULL,
    "uom" VARCHAR(20) NOT NULL DEFAULT 'Pcs',
    "qty" DECIMAL(14,3) NOT NULL,
    "unitPrice" DECIMAL(14,2) NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "reason" VARCHAR(500),

    CONSTRAINT "purchase_return_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_payments" (
    "id" UUID NOT NULL,
    "businessUnitId" UUID NOT NULL,
    "supplierId" UUID NOT NULL,
    "orderId" UUID,
    "number" VARCHAR(30) NOT NULL,
    "paymentDate" DATE NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "method" "PurchasePaymentMethod" NOT NULL DEFAULT 'BANK',
    "referenceNumber" VARCHAR(100),
    "status" "PurchasePaymentStatus" NOT NULL DEFAULT 'PAID',
    "remarks" VARCHAR(500),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "supplier_payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "suppliers_businessUnitId_name_idx" ON "suppliers"("businessUnitId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "suppliers_businessUnitId_code_key" ON "suppliers"("businessUnitId", "code");

-- CreateIndex
CREATE INDEX "purchase_requisitions_businessUnitId_status_requisitionDate_idx" ON "purchase_requisitions"("businessUnitId", "status", "requisitionDate");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_requisitions_businessUnitId_number_key" ON "purchase_requisitions"("businessUnitId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_requisition_lines_requisitionId_lineNo_key" ON "purchase_requisition_lines"("requisitionId", "lineNo");

-- CreateIndex
CREATE INDEX "purchase_orders_businessUnitId_status_orderDate_idx" ON "purchase_orders"("businessUnitId", "status", "orderDate");

-- CreateIndex
CREATE INDEX "purchase_orders_supplierId_status_idx" ON "purchase_orders"("supplierId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_orders_businessUnitId_number_key" ON "purchase_orders"("businessUnitId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_order_lines_orderId_lineNo_key" ON "purchase_order_lines"("orderId", "lineNo");

-- CreateIndex
CREATE INDEX "goods_receipts_businessUnitId_status_receiveDate_idx" ON "goods_receipts"("businessUnitId", "status", "receiveDate");

-- CreateIndex
CREATE INDEX "goods_receipts_orderId_idx" ON "goods_receipts"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "goods_receipts_businessUnitId_number_key" ON "goods_receipts"("businessUnitId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "goods_receipt_lines_receiptId_lineNo_key" ON "goods_receipt_lines"("receiptId", "lineNo");

-- CreateIndex
CREATE INDEX "purchase_returns_businessUnitId_status_returnDate_idx" ON "purchase_returns"("businessUnitId", "status", "returnDate");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_returns_businessUnitId_number_key" ON "purchase_returns"("businessUnitId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_return_lines_returnId_lineNo_key" ON "purchase_return_lines"("returnId", "lineNo");

-- CreateIndex
CREATE INDEX "supplier_payments_businessUnitId_paymentDate_idx" ON "supplier_payments"("businessUnitId", "paymentDate");

-- CreateIndex
CREATE INDEX "supplier_payments_supplierId_idx" ON "supplier_payments"("supplierId");

-- CreateIndex
CREATE UNIQUE INDEX "supplier_payments_businessUnitId_number_key" ON "supplier_payments"("businessUnitId", "number");

-- AddForeignKey
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_businessUnitId_fkey" FOREIGN KEY ("businessUnitId") REFERENCES "business_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_requisitions" ADD CONSTRAINT "purchase_requisitions_businessUnitId_fkey" FOREIGN KEY ("businessUnitId") REFERENCES "business_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_requisitions" ADD CONSTRAINT "purchase_requisitions_officeId_fkey" FOREIGN KEY ("officeId") REFERENCES "offices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_requisitions" ADD CONSTRAINT "purchase_requisitions_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_requisition_lines" ADD CONSTRAINT "purchase_requisition_lines_requisitionId_fkey" FOREIGN KEY ("requisitionId") REFERENCES "purchase_requisitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_requisition_lines" ADD CONSTRAINT "purchase_requisition_lines_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_businessUnitId_fkey" FOREIGN KEY ("businessUnitId") REFERENCES "business_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_officeId_fkey" FOREIGN KEY ("officeId") REFERENCES "offices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_requisitionId_fkey" FOREIGN KEY ("requisitionId") REFERENCES "purchase_requisitions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_order_lines" ADD CONSTRAINT "purchase_order_lines_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "purchase_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_order_lines" ADD CONSTRAINT "purchase_order_lines_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_receipts" ADD CONSTRAINT "goods_receipts_businessUnitId_fkey" FOREIGN KEY ("businessUnitId") REFERENCES "business_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_receipts" ADD CONSTRAINT "goods_receipts_officeId_fkey" FOREIGN KEY ("officeId") REFERENCES "offices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_receipts" ADD CONSTRAINT "goods_receipts_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_receipts" ADD CONSTRAINT "goods_receipts_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "purchase_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_receipts" ADD CONSTRAINT "goods_receipts_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_receipt_lines" ADD CONSTRAINT "goods_receipt_lines_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "goods_receipts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_receipt_lines" ADD CONSTRAINT "goods_receipt_lines_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_returns" ADD CONSTRAINT "purchase_returns_businessUnitId_fkey" FOREIGN KEY ("businessUnitId") REFERENCES "business_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_returns" ADD CONSTRAINT "purchase_returns_officeId_fkey" FOREIGN KEY ("officeId") REFERENCES "offices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_returns" ADD CONSTRAINT "purchase_returns_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_returns" ADD CONSTRAINT "purchase_returns_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "goods_receipts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_returns" ADD CONSTRAINT "purchase_returns_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "purchase_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_returns" ADD CONSTRAINT "purchase_returns_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_return_lines" ADD CONSTRAINT "purchase_return_lines_returnId_fkey" FOREIGN KEY ("returnId") REFERENCES "purchase_returns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_return_lines" ADD CONSTRAINT "purchase_return_lines_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_payments" ADD CONSTRAINT "supplier_payments_businessUnitId_fkey" FOREIGN KEY ("businessUnitId") REFERENCES "business_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_payments" ADD CONSTRAINT "supplier_payments_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_payments" ADD CONSTRAINT "supplier_payments_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "purchase_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
