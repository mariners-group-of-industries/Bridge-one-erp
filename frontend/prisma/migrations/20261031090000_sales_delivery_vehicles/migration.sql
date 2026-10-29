
-- AlterTable
ALTER TABLE "customers" ADD COLUMN     "bankAccountNo" VARCHAR(50),
ADD COLUMN     "bankAccountType" VARCHAR(50),
ADD COLUMN     "bankBranch" VARCHAR(100),
ADD COLUMN     "bankName" VARCHAR(100),
ADD COLUMN     "bankRoutingNo" VARCHAR(30);

-- AlterTable
ALTER TABLE "sales_deliveries" ADD COLUMN     "buyerMobile" VARCHAR(30),
ADD COLUMN     "buyerName" VARCHAR(150),
ADD COLUMN     "driverEmployeeId" UUID,
ADD COLUMN     "referredBy" VARCHAR(150),
ADD COLUMN     "salesType" "SalesOrderType" NOT NULL DEFAULT 'SALES',
ADD COLUMN     "securityCode" VARCHAR(40),
ADD COLUMN     "vehicleId" UUID;

-- CreateTable
CREATE TABLE "vehicles" (
    "id" UUID NOT NULL,
    "businessUnitId" UUID NOT NULL,
    "vehicleNumber" VARCHAR(40) NOT NULL,
    "vehicleSize" VARCHAR(50),
    "chassisNumber" VARCHAR(60),
    "vehicleName" VARCHAR(100),
    "serviceProvider" VARCHAR(150),
    "contactNumber" VARCHAR(30),
    "isRent" BOOLEAN NOT NULL DEFAULT false,
    "isCargo" BOOLEAN NOT NULL DEFAULT false,
    "driverEmployeeId" UUID,
    "driverName" VARCHAR(100),
    "driverContact" VARCHAR(30),
    "securityCode" VARCHAR(40),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" VARCHAR(100) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "vehicles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehicle_compartments" (
    "id" UUID NOT NULL,
    "vehicleId" UUID NOT NULL,
    "compartmentNo" INTEGER NOT NULL,
    "compartmentType" VARCHAR(60) NOT NULL,
    "compartmentName" VARCHAR(60) NOT NULL,
    "capacity" DECIMAL(14,3) NOT NULL,
    "uom" VARCHAR(20) NOT NULL,

    CONSTRAINT "vehicle_compartments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_order_pending_notes" (
    "id" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "reason" VARCHAR(300) NOT NULL,
    "createdBy" VARCHAR(100) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sales_order_pending_notes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "vehicles_businessUnitId_vehicleNumber_key" ON "vehicles"("businessUnitId", "vehicleNumber");

-- CreateIndex
CREATE UNIQUE INDEX "vehicle_compartments_vehicleId_compartmentNo_key" ON "vehicle_compartments"("vehicleId", "compartmentNo");

-- CreateIndex
CREATE INDEX "sales_order_pending_notes_orderId_createdAt_idx" ON "sales_order_pending_notes"("orderId", "createdAt");

-- CreateIndex
CREATE INDEX "sales_deliveries_vehicleId_idx" ON "sales_deliveries"("vehicleId");

-- AddForeignKey
ALTER TABLE "sales_deliveries" ADD CONSTRAINT "sales_deliveries_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_deliveries" ADD CONSTRAINT "sales_deliveries_driverEmployeeId_fkey" FOREIGN KEY ("driverEmployeeId") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_businessUnitId_fkey" FOREIGN KEY ("businessUnitId") REFERENCES "business_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_driverEmployeeId_fkey" FOREIGN KEY ("driverEmployeeId") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_compartments" ADD CONSTRAINT "vehicle_compartments_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_order_pending_notes" ADD CONSTRAINT "sales_order_pending_notes_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "sales_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Checks
ALTER TABLE "vehicle_compartments" ADD CONSTRAINT "vehicle_compartments_capacity_check" CHECK ("capacity" > 0 AND "compartmentNo" > 0);
