-- AlterTable
ALTER TABLE "rtm_outlets" ADD COLUMN     "approvalStatus" "RtmDocStatus" NOT NULL DEFAULT 'APPROVED',
ADD COLUMN     "approvedBy" VARCHAR(150),
ADD COLUMN     "businessType" VARCHAR(60),
ADD COLUMN     "category" VARCHAR(60),
ADD COLUMN     "competitorItems" VARCHAR(300),
ADD COLUMN     "competitors" VARCHAR(300),
ADD COLUMN     "contactPerson" VARCHAR(150),
ADD COLUMN     "dateOfBirth" DATE,
ADD COLUMN     "districtId" INTEGER,
ADD COLUMN     "email" VARCHAR(150),
ADD COLUMN     "maritalStatus" VARCHAR(20),
ADD COLUMN     "nameBn" VARCHAR(150),
ADD COLUMN     "nid" VARCHAR(30),
ADD COLUMN     "outletGroup" VARCHAR(60),
ADD COLUMN     "ownerPhone" VARCHAR(30),
ADD COLUMN     "partnerCode" VARCHAR(30),
ADD COLUMN     "regularSales" DECIMAL(14,2),
ADD COLUMN     "salesPeriod" VARCHAR(10),
ADD COLUMN     "serial" INTEGER,
ADD COLUMN     "thanaId" UUID,
ADD COLUMN     "tradeLicense" VARCHAR(60);

-- CreateTable
CREATE TABLE "rtm_outlet_areas" (
    "id" UUID NOT NULL,
    "outletId" UUID NOT NULL,
    "nodeId" UUID NOT NULL,
    "lineNo" INTEGER NOT NULL,

    CONSTRAINT "rtm_outlet_areas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rtm_outlet_attachments" (
    "id" UUID NOT NULL,
    "outletId" UUID NOT NULL,
    "kind" VARCHAR(10) NOT NULL,
    "storageKey" VARCHAR(300) NOT NULL,
    "originalName" VARCHAR(255) NOT NULL,
    "mimeType" VARCHAR(100) NOT NULL,
    "size" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rtm_outlet_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "rtm_outlet_areas_nodeId_idx" ON "rtm_outlet_areas"("nodeId");

-- CreateIndex
CREATE UNIQUE INDEX "rtm_outlet_areas_outletId_nodeId_key" ON "rtm_outlet_areas"("outletId", "nodeId");

-- CreateIndex
CREATE UNIQUE INDEX "rtm_outlet_attachments_storageKey_key" ON "rtm_outlet_attachments"("storageKey");

-- CreateIndex
CREATE INDEX "rtm_outlet_attachments_outletId_idx" ON "rtm_outlet_attachments"("outletId");

-- AddForeignKey
ALTER TABLE "rtm_outlets" ADD CONSTRAINT "rtm_outlets_districtId_fkey" FOREIGN KEY ("districtId") REFERENCES "districts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rtm_outlets" ADD CONSTRAINT "rtm_outlets_thanaId_fkey" FOREIGN KEY ("thanaId") REFERENCES "thanas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rtm_outlet_areas" ADD CONSTRAINT "rtm_outlet_areas_outletId_fkey" FOREIGN KEY ("outletId") REFERENCES "rtm_outlets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rtm_outlet_areas" ADD CONSTRAINT "rtm_outlet_areas_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES "sales_territory_nodes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rtm_outlet_attachments" ADD CONSTRAINT "rtm_outlet_attachments_outletId_fkey" FOREIGN KEY ("outletId") REFERENCES "rtm_outlets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

