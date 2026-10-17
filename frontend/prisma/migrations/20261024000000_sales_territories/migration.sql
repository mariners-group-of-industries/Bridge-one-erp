-- Sales Setup (Configuration / Sales Config): sales territory tree with
-- configurable layers and employee assignments. Additive only.

-- CreateTable
CREATE TABLE "sales_territory_layers" (
    "id" UUID NOT NULL,
    "businessUnitId" UUID NOT NULL,
    "level" INTEGER NOT NULL,
    "code" VARCHAR(20) NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "isTerritory" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sales_territory_layers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_territory_nodes" (
    "id" UUID NOT NULL,
    "businessUnitId" UUID NOT NULL,
    "layerId" UUID NOT NULL,
    "parentId" UUID,
    "code" VARCHAR(30) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "salesAreaId" UUID,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "sales_territory_nodes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_territory_employees" (
    "id" UUID NOT NULL,
    "nodeId" UUID NOT NULL,
    "employeeId" UUID NOT NULL,
    "distributionChannel" VARCHAR(100),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sales_territory_employees_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sales_territory_layers_businessUnitId_level_key" ON "sales_territory_layers"("businessUnitId", "level");

-- CreateIndex
CREATE UNIQUE INDEX "sales_territory_layers_businessUnitId_code_key" ON "sales_territory_layers"("businessUnitId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "sales_territory_nodes_salesAreaId_key" ON "sales_territory_nodes"("salesAreaId");

-- CreateIndex
CREATE INDEX "sales_territory_nodes_parentId_idx" ON "sales_territory_nodes"("parentId");

-- CreateIndex
CREATE UNIQUE INDEX "sales_territory_nodes_businessUnitId_code_key" ON "sales_territory_nodes"("businessUnitId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "sales_territory_employees_nodeId_employeeId_key" ON "sales_territory_employees"("nodeId", "employeeId");

-- AddForeignKey
ALTER TABLE "sales_territory_layers" ADD CONSTRAINT "sales_territory_layers_businessUnitId_fkey" FOREIGN KEY ("businessUnitId") REFERENCES "business_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_territory_nodes" ADD CONSTRAINT "sales_territory_nodes_businessUnitId_fkey" FOREIGN KEY ("businessUnitId") REFERENCES "business_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_territory_nodes" ADD CONSTRAINT "sales_territory_nodes_layerId_fkey" FOREIGN KEY ("layerId") REFERENCES "sales_territory_layers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_territory_nodes" ADD CONSTRAINT "sales_territory_nodes_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "sales_territory_nodes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_territory_nodes" ADD CONSTRAINT "sales_territory_nodes_salesAreaId_fkey" FOREIGN KEY ("salesAreaId") REFERENCES "sales_areas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_territory_employees" ADD CONSTRAINT "sales_territory_employees_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES "sales_territory_nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_territory_employees" ADD CONSTRAINT "sales_territory_employees_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

