-- Work center details (type, department, section, warehouse, capacities, cost) and operator tagging.

-- AlterTable
ALTER TABLE "production_work_centers" ADD COLUMN     "costPerHour" DECIMAL(14,2),
ADD COLUMN     "createdBy" VARCHAR(100),
ADD COLUMN     "departmentId" UUID,
ADD COLUMN     "departmentSectionId" UUID,
ADD COLUMN     "ratedCapacityPerHour" DECIMAL(14,3) NOT NULL,
ADD COLUMN     "remarks" VARCHAR(500),
ADD COLUMN     "standardRunHour" DECIMAL(5,2) NOT NULL,
ADD COLUMN     "typeId" UUID NOT NULL,
ADD COLUMN     "warehouseId" UUID,
ALTER COLUMN "officeId" DROP NOT NULL,
ALTER COLUMN "capacityPerHour" SET NOT NULL;

-- CreateTable
CREATE TABLE "production_work_center_types" (
    "id" UUID NOT NULL,
    "businessUnitId" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "production_work_center_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "production_departments" (
    "id" UUID NOT NULL,
    "businessUnitId" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "production_departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "production_department_sections" (
    "id" UUID NOT NULL,
    "departmentId" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "production_department_sections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "production_work_center_operators" (
    "id" UUID NOT NULL,
    "workCenterId" UUID NOT NULL,
    "employeeId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "production_work_center_operators_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "production_work_center_types_businessUnitId_name_key" ON "production_work_center_types"("businessUnitId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "production_departments_businessUnitId_name_key" ON "production_departments"("businessUnitId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "production_department_sections_departmentId_name_key" ON "production_department_sections"("departmentId", "name");

-- CreateIndex
CREATE INDEX "production_work_center_operators_employeeId_idx" ON "production_work_center_operators"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "production_work_center_operators_workCenterId_employeeId_key" ON "production_work_center_operators"("workCenterId", "employeeId");

-- AddForeignKey
ALTER TABLE "production_work_centers" ADD CONSTRAINT "production_work_centers_typeId_fkey" FOREIGN KEY ("typeId") REFERENCES "production_work_center_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_work_centers" ADD CONSTRAINT "production_work_centers_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "production_departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_work_centers" ADD CONSTRAINT "production_work_centers_departmentSectionId_fkey" FOREIGN KEY ("departmentSectionId") REFERENCES "production_department_sections"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_work_centers" ADD CONSTRAINT "production_work_centers_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_work_center_types" ADD CONSTRAINT "production_work_center_types_businessUnitId_fkey" FOREIGN KEY ("businessUnitId") REFERENCES "business_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_departments" ADD CONSTRAINT "production_departments_businessUnitId_fkey" FOREIGN KEY ("businessUnitId") REFERENCES "business_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_department_sections" ADD CONSTRAINT "production_department_sections_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "production_departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_work_center_operators" ADD CONSTRAINT "production_work_center_operators_workCenterId_fkey" FOREIGN KEY ("workCenterId") REFERENCES "production_work_centers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_work_center_operators" ADD CONSTRAINT "production_work_center_operators_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Hand-written checks
ALTER TABLE "production_work_centers" ADD CONSTRAINT "production_work_centers_rates_check"
  CHECK ("standardRunHour" > 0 AND "standardRunHour" <= 24 AND "capacityPerHour" > 0 AND "ratedCapacityPerHour" > 0
         AND ("costPerHour" IS NULL OR "costPerHour" >= 0));
