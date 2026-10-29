-- Production Order: order header, exploded BOM materials and approval stages.

-- CreateEnum
CREATE TYPE "ProductionOrderStatus" AS ENUM ('PENDING_APPROVAL', 'APPROVED', 'IN_PROGRESS', 'CLOSED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ProductionApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "production_orders" (
    "id" UUID NOT NULL,
    "businessUnitId" UUID NOT NULL,
    "number" VARCHAR(30) NOT NULL,
    "orderDate" DATE NOT NULL,
    "productionDate" DATE NOT NULL,
    "customerId" UUID,
    "salesOrderId" UUID,
    "customerPoNo" VARCHAR(60),
    "itemId" UUID NOT NULL,
    "bomId" UUID NOT NULL,
    "bomLotSize" DECIMAL(14,3) NOT NULL,
    "unitCost" DECIMAL(16,4) NOT NULL DEFAULT 0,
    "orderQty" DECIMAL(14,3) NOT NULL,
    "producedQty" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "officeId" UUID NOT NULL,
    "warehouseId" UUID NOT NULL,
    "workCenterId" UUID,
    "machineName" VARCHAR(100),
    "narration" VARCHAR(500),
    "status" "ProductionOrderStatus" NOT NULL DEFAULT 'PENDING_APPROVAL',
    "superApproverUserId" UUID,
    "statusReason" VARCHAR(500),
    "createdBy" VARCHAR(100) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "production_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "production_order_materials" (
    "id" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "lineNo" INTEGER NOT NULL,
    "itemId" UUID NOT NULL,
    "uom" VARCHAR(20) NOT NULL,
    "bomQty" DECIMAL(14,4) NOT NULL,
    "requiredQty" DECIMAL(14,4) NOT NULL,
    "issueQty" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "usedQty" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "returnQty" DECIMAL(14,4) NOT NULL DEFAULT 0,

    CONSTRAINT "production_order_materials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "production_order_approvals" (
    "id" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "stageNo" INTEGER NOT NULL,
    "stageName" VARCHAR(150) NOT NULL,
    "approvalOrder" VARCHAR(20) NOT NULL,
    "requiredCount" INTEGER NOT NULL DEFAULT 1,
    "approverUserIds" UUID[],
    "approvedUserIds" VARCHAR(100)[] DEFAULT ARRAY[]::VARCHAR(100)[],
    "status" "ProductionApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "actedBy" VARCHAR(100),
    "comment" VARCHAR(500),
    "actedAt" TIMESTAMPTZ(3),

    CONSTRAINT "production_order_approvals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "production_orders_businessUnitId_orderDate_idx" ON "production_orders"("businessUnitId", "orderDate");

-- CreateIndex
CREATE INDEX "production_orders_status_idx" ON "production_orders"("status");

-- CreateIndex
CREATE INDEX "production_orders_bomId_idx" ON "production_orders"("bomId");

-- CreateIndex
CREATE UNIQUE INDEX "production_orders_businessUnitId_number_key" ON "production_orders"("businessUnitId", "number");

-- CreateIndex
CREATE INDEX "production_order_materials_itemId_idx" ON "production_order_materials"("itemId");

-- CreateIndex
CREATE UNIQUE INDEX "production_order_materials_orderId_lineNo_key" ON "production_order_materials"("orderId", "lineNo");

-- CreateIndex
CREATE UNIQUE INDEX "production_order_approvals_orderId_stageNo_key" ON "production_order_approvals"("orderId", "stageNo");

-- AddForeignKey
ALTER TABLE "production_orders" ADD CONSTRAINT "production_orders_businessUnitId_fkey" FOREIGN KEY ("businessUnitId") REFERENCES "business_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_orders" ADD CONSTRAINT "production_orders_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_orders" ADD CONSTRAINT "production_orders_salesOrderId_fkey" FOREIGN KEY ("salesOrderId") REFERENCES "sales_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_orders" ADD CONSTRAINT "production_orders_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_orders" ADD CONSTRAINT "production_orders_bomId_fkey" FOREIGN KEY ("bomId") REFERENCES "production_boms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_orders" ADD CONSTRAINT "production_orders_officeId_fkey" FOREIGN KEY ("officeId") REFERENCES "offices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_orders" ADD CONSTRAINT "production_orders_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_orders" ADD CONSTRAINT "production_orders_workCenterId_fkey" FOREIGN KEY ("workCenterId") REFERENCES "production_work_centers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_order_materials" ADD CONSTRAINT "production_order_materials_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "production_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_order_materials" ADD CONSTRAINT "production_order_materials_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_order_approvals" ADD CONSTRAINT "production_order_approvals_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "production_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;



-- Hand-written checks
ALTER TABLE "production_orders" ADD CONSTRAINT "production_orders_values_check"
  CHECK ("orderQty" > 0 AND "producedQty" >= 0 AND "bomLotSize" > 0 AND "unitCost" >= 0 AND "productionDate" >= "orderDate");
ALTER TABLE "production_order_materials" ADD CONSTRAINT "production_order_materials_values_check"
  CHECK ("bomQty" > 0 AND "requiredQty" >= 0 AND "issueQty" >= 0 AND "usedQty" >= 0 AND "returnQty" >= 0);
ALTER TABLE "production_order_approvals" ADD CONSTRAINT "production_order_approvals_count_check" CHECK ("requiredCount" >= 1);
