-- CreateEnum
CREATE TYPE "RtmLayerTransferType" AS ENUM ('EMPLOYEE', 'AREA');

-- AlterTable
ALTER TABLE "rtm_stock_adjustments" ADD COLUMN     "rolledBackAt" TIMESTAMPTZ(3),
ADD COLUMN     "rolledBackBy" VARCHAR(150);

-- AlterTable
ALTER TABLE "rtm_stock_adjustment_lines" ADD COLUMN     "rate" DECIMAL(14,2);

-- AlterTable
ALTER TABLE "rtm_tour_plans" ADD COLUMN     "activity" VARCHAR(60),
ADD COLUMN     "endTime" VARCHAR(5),
ADD COLUMN     "pointNodeId" UUID,
ADD COLUMN     "priority" VARCHAR(10),
ADD COLUMN     "remarks" VARCHAR(300),
ADD COLUMN     "startTime" VARCHAR(5);

-- CreateTable
CREATE TABLE "rtm_layer_transfers" (
    "id" UUID NOT NULL,
    "businessUnitId" UUID NOT NULL,
    "number" VARCHAR(30) NOT NULL,
    "transferDate" DATE NOT NULL,
    "type" "RtmLayerTransferType" NOT NULL,
    "layerId" UUID NOT NULL,
    "sourceNodeId" UUID NOT NULL,
    "destinationNodeId" UUID NOT NULL,
    "employeeId" UUID,
    "remarks" VARCHAR(500),
    "status" "RtmDocStatus" NOT NULL DEFAULT 'PENDING',
    "requestedBy" VARCHAR(150) NOT NULL,
    "approvedBy" VARCHAR(150),
    "appliedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "rtm_layer_transfers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "rtm_layer_transfers_businessUnitId_transferDate_idx" ON "rtm_layer_transfers"("businessUnitId", "transferDate");

-- CreateIndex
CREATE UNIQUE INDEX "rtm_layer_transfers_businessUnitId_number_key" ON "rtm_layer_transfers"("businessUnitId", "number");

-- AddForeignKey
ALTER TABLE "rtm_tour_plans" ADD CONSTRAINT "rtm_tour_plans_pointNodeId_fkey" FOREIGN KEY ("pointNodeId") REFERENCES "sales_territory_nodes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rtm_layer_transfers" ADD CONSTRAINT "rtm_layer_transfers_businessUnitId_fkey" FOREIGN KEY ("businessUnitId") REFERENCES "business_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rtm_layer_transfers" ADD CONSTRAINT "rtm_layer_transfers_layerId_fkey" FOREIGN KEY ("layerId") REFERENCES "sales_territory_layers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rtm_layer_transfers" ADD CONSTRAINT "rtm_layer_transfers_sourceNodeId_fkey" FOREIGN KEY ("sourceNodeId") REFERENCES "sales_territory_nodes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rtm_layer_transfers" ADD CONSTRAINT "rtm_layer_transfers_destinationNodeId_fkey" FOREIGN KEY ("destinationNodeId") REFERENCES "sales_territory_nodes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rtm_layer_transfers" ADD CONSTRAINT "rtm_layer_transfers_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

