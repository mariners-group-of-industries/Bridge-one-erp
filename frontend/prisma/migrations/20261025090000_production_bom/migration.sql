-- Production Bill of Material: outputs, input materials, wastage output, overheads and child BOM links.

-- CreateEnum
CREATE TYPE "ProductionBomType" AS ENUM ('SINGLE_OUTPUT', 'MULTIPLE_OUTPUT');

-- CreateEnum
CREATE TYPE "ProductionOutputType" AS ENUM ('FINISHED_GOODS', 'SEMI_FINISHED_GOODS');

-- CreateTable
CREATE TABLE "production_boms" (
    "id" UUID NOT NULL,
    "businessUnitId" UUID NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "bomType" "ProductionBomType" NOT NULL DEFAULT 'SINGLE_OUTPUT',
    "departmentId" UUID,
    "departmentSectionId" UUID,
    "lotSize" DECIMAL(14,3) NOT NULL DEFAULT 1,
    "tolerancePercent" DECIMAL(5,2),
    "materialCost" DECIMAL(16,2) NOT NULL DEFAULT 0,
    "overheadCost" DECIMAL(16,2) NOT NULL DEFAULT 0,
    "totalCost" DECIMAL(16,2) NOT NULL DEFAULT 0,
    "remarks" VARCHAR(500),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" VARCHAR(100) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "production_boms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "production_bom_outputs" (
    "id" UUID NOT NULL,
    "bomId" UUID NOT NULL,
    "lineNo" INTEGER NOT NULL,
    "itemId" UUID NOT NULL,
    "outputType" "ProductionOutputType" NOT NULL,
    "netWeight" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "lotSizeQty" DECIMAL(14,3) NOT NULL,
    "totalWeight" DECIMAL(16,4) NOT NULL DEFAULT 0,
    "costPercent" DECIMAL(5,2) NOT NULL DEFAULT 100,

    CONSTRAINT "production_bom_outputs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "production_bom_materials" (
    "id" UUID NOT NULL,
    "bomId" UUID NOT NULL,
    "lineNo" INTEGER NOT NULL,
    "itemId" UUID NOT NULL,
    "materialType" VARCHAR(50),
    "excludeFromScrap" BOOLEAN NOT NULL DEFAULT false,
    "uom" VARCHAR(20) NOT NULL,
    "altUom" VARCHAR(20),
    "altQty" DECIMAL(14,4),
    "qty" DECIMAL(14,4) NOT NULL,
    "wastagePercent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "totalQty" DECIMAL(14,4) NOT NULL,
    "rate" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "amount" DECIMAL(16,2) NOT NULL DEFAULT 0,

    CONSTRAINT "production_bom_materials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "production_bom_wastages" (
    "id" UUID NOT NULL,
    "bomId" UUID NOT NULL,
    "lineNo" INTEGER NOT NULL,
    "itemId" UUID NOT NULL,
    "qty" DECIMAL(14,4) NOT NULL,
    "uom" VARCHAR(20) NOT NULL,
    "remarks" VARCHAR(200),

    CONSTRAINT "production_bom_wastages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "production_bom_overheads" (
    "id" UUID NOT NULL,
    "bomId" UUID NOT NULL,
    "lineNo" INTEGER NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "amount" DECIMAL(16,2) NOT NULL,

    CONSTRAINT "production_bom_overheads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "production_bom_links" (
    "id" UUID NOT NULL,
    "parentBomId" UUID NOT NULL,
    "childBomId" UUID NOT NULL,
    "stage" VARCHAR(50) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "production_bom_links_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "production_boms_businessUnitId_isActive_idx" ON "production_boms"("businessUnitId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "production_boms_businessUnitId_name_key" ON "production_boms"("businessUnitId", "name");

-- CreateIndex
CREATE INDEX "production_bom_outputs_itemId_idx" ON "production_bom_outputs"("itemId");

-- CreateIndex
CREATE UNIQUE INDEX "production_bom_outputs_bomId_lineNo_key" ON "production_bom_outputs"("bomId", "lineNo");

-- CreateIndex
CREATE UNIQUE INDEX "production_bom_outputs_bomId_itemId_key" ON "production_bom_outputs"("bomId", "itemId");

-- CreateIndex
CREATE INDEX "production_bom_materials_itemId_idx" ON "production_bom_materials"("itemId");

-- CreateIndex
CREATE UNIQUE INDEX "production_bom_materials_bomId_lineNo_key" ON "production_bom_materials"("bomId", "lineNo");

-- CreateIndex
CREATE UNIQUE INDEX "production_bom_materials_bomId_itemId_key" ON "production_bom_materials"("bomId", "itemId");

-- CreateIndex
CREATE UNIQUE INDEX "production_bom_wastages_bomId_lineNo_key" ON "production_bom_wastages"("bomId", "lineNo");

-- CreateIndex
CREATE UNIQUE INDEX "production_bom_wastages_bomId_itemId_key" ON "production_bom_wastages"("bomId", "itemId");

-- CreateIndex
CREATE UNIQUE INDEX "production_bom_overheads_bomId_lineNo_key" ON "production_bom_overheads"("bomId", "lineNo");

-- CreateIndex
CREATE INDEX "production_bom_links_childBomId_idx" ON "production_bom_links"("childBomId");

-- CreateIndex
CREATE UNIQUE INDEX "production_bom_links_parentBomId_childBomId_key" ON "production_bom_links"("parentBomId", "childBomId");

-- AddForeignKey
ALTER TABLE "production_boms" ADD CONSTRAINT "production_boms_businessUnitId_fkey" FOREIGN KEY ("businessUnitId") REFERENCES "business_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_boms" ADD CONSTRAINT "production_boms_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "production_departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_boms" ADD CONSTRAINT "production_boms_departmentSectionId_fkey" FOREIGN KEY ("departmentSectionId") REFERENCES "production_department_sections"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_bom_outputs" ADD CONSTRAINT "production_bom_outputs_bomId_fkey" FOREIGN KEY ("bomId") REFERENCES "production_boms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_bom_outputs" ADD CONSTRAINT "production_bom_outputs_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_bom_materials" ADD CONSTRAINT "production_bom_materials_bomId_fkey" FOREIGN KEY ("bomId") REFERENCES "production_boms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_bom_materials" ADD CONSTRAINT "production_bom_materials_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_bom_wastages" ADD CONSTRAINT "production_bom_wastages_bomId_fkey" FOREIGN KEY ("bomId") REFERENCES "production_boms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_bom_wastages" ADD CONSTRAINT "production_bom_wastages_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_bom_overheads" ADD CONSTRAINT "production_bom_overheads_bomId_fkey" FOREIGN KEY ("bomId") REFERENCES "production_boms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_bom_links" ADD CONSTRAINT "production_bom_links_parentBomId_fkey" FOREIGN KEY ("parentBomId") REFERENCES "production_boms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_bom_links" ADD CONSTRAINT "production_bom_links_childBomId_fkey" FOREIGN KEY ("childBomId") REFERENCES "production_boms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Hand-written checks
ALTER TABLE "production_boms" ADD CONSTRAINT "production_boms_values_check"
  CHECK ("lotSize" > 0 AND ("tolerancePercent" IS NULL OR "tolerancePercent" BETWEEN 0 AND 100)
         AND "materialCost" >= 0 AND "overheadCost" >= 0 AND "totalCost" >= 0);
ALTER TABLE "production_bom_outputs" ADD CONSTRAINT "production_bom_outputs_values_check"
  CHECK ("lotSizeQty" > 0 AND "netWeight" >= 0 AND "costPercent" >= 0 AND "costPercent" <= 100);
ALTER TABLE "production_bom_materials" ADD CONSTRAINT "production_bom_materials_values_check"
  CHECK ("qty" > 0 AND "wastagePercent" >= 0 AND "wastagePercent" < 100 AND "rate" >= 0 AND "amount" >= 0);
ALTER TABLE "production_bom_wastages" ADD CONSTRAINT "production_bom_wastages_qty_check" CHECK ("qty" > 0);
ALTER TABLE "production_bom_overheads" ADD CONSTRAINT "production_bom_overheads_amount_check" CHECK ("amount" >= 0);
ALTER TABLE "production_bom_links" ADD CONSTRAINT "production_bom_links_not_self_check" CHECK ("parentBomId" <> "childBomId");
