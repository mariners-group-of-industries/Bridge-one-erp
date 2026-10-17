-- CreateTable
CREATE TABLE "production_work_centers" (
    "id" UUID NOT NULL,
    "businessUnitId" UUID NOT NULL,
    "officeId" UUID NOT NULL,
    "code" VARCHAR(30) NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "capacityPerHour" DECIMAL(14,3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "production_work_centers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "production_entries" (
    "id" UUID NOT NULL,
    "businessUnitId" UUID NOT NULL,
    "number" VARCHAR(30) NOT NULL,
    "officeId" UUID NOT NULL,
    "workCenterId" UUID,
    "itemId" UUID NOT NULL,
    "productionDate" DATE NOT NULL,
    "shift" VARCHAR(30),
    "qty" DECIMAL(14,3) NOT NULL,
    "hours" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "remarks" VARCHAR(500),
    "createdBy" VARCHAR(100),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "production_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "production_work_centers_businessUnitId_code_key" ON "production_work_centers"("businessUnitId", "code");

-- CreateIndex
CREATE INDEX "production_entries_businessUnitId_productionDate_idx" ON "production_entries"("businessUnitId", "productionDate");

-- CreateIndex
CREATE INDEX "production_entries_workCenterId_productionDate_idx" ON "production_entries"("workCenterId", "productionDate");

-- CreateIndex
CREATE UNIQUE INDEX "production_entries_businessUnitId_number_key" ON "production_entries"("businessUnitId", "number");

-- AddForeignKey
ALTER TABLE "production_work_centers" ADD CONSTRAINT "production_work_centers_businessUnitId_fkey" FOREIGN KEY ("businessUnitId") REFERENCES "business_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_work_centers" ADD CONSTRAINT "production_work_centers_officeId_fkey" FOREIGN KEY ("officeId") REFERENCES "offices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_entries" ADD CONSTRAINT "production_entries_businessUnitId_fkey" FOREIGN KEY ("businessUnitId") REFERENCES "business_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_entries" ADD CONSTRAINT "production_entries_officeId_fkey" FOREIGN KEY ("officeId") REFERENCES "offices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_entries" ADD CONSTRAINT "production_entries_workCenterId_fkey" FOREIGN KEY ("workCenterId") REFERENCES "production_work_centers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_entries" ADD CONSTRAINT "production_entries_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Hand-written checks (Prisma cannot express them).
ALTER TABLE "production_work_centers" ADD CONSTRAINT "production_work_centers_capacity_check" CHECK ("capacityPerHour" IS NULL OR "capacityPerHour" >= 0);
ALTER TABLE "production_entries" ADD CONSTRAINT "production_entries_values_check" CHECK ("qty" > 0 AND "hours" >= 0);
