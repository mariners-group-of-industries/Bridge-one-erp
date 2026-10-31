-- A work center may have several warehouses; production_work_centers."warehouseId" keeps the first.
CREATE TABLE "production_work_center_warehouses" (
    "id" UUID NOT NULL,
    "workCenterId" UUID NOT NULL,
    "warehouseId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "production_work_center_warehouses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "production_work_center_warehouses_warehouseId_idx" ON "production_work_center_warehouses"("warehouseId");

-- CreateIndex
CREATE UNIQUE INDEX "production_work_center_warehouses_workCenterId_warehouseId_key" ON "production_work_center_warehouses"("workCenterId", "warehouseId");

-- AddForeignKey
ALTER TABLE "production_work_center_warehouses" ADD CONSTRAINT "production_work_center_warehouses_workCenterId_fkey" FOREIGN KEY ("workCenterId") REFERENCES "production_work_centers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_work_center_warehouses" ADD CONSTRAINT "production_work_center_warehouses_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Existing single warehouses become the first entry of the list.
INSERT INTO "production_work_center_warehouses" ("id", "workCenterId", "warehouseId")
SELECT gen_random_uuid(), "id", "warehouseId" FROM "production_work_centers" WHERE "warehouseId" IS NOT NULL;
