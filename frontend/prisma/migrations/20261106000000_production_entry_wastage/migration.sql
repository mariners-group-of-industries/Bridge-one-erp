-- Process Wise Wastage Entry: process master and the wastage lines of a production entry.
CREATE TABLE "production_processes" (
    "id" UUID NOT NULL,
    "businessUnitId" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "production_processes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "production_entry_wastages" (
    "id" UUID NOT NULL,
    "entryId" UUID NOT NULL,
    "lineNo" INTEGER NOT NULL,
    "processId" UUID NOT NULL,
    "itemId" UUID NOT NULL,
    "uom" VARCHAR(20) NOT NULL,
    "qty" DECIMAL(14,4) NOT NULL,
    "createdBy" VARCHAR(100),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "production_entry_wastages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "production_processes_businessUnitId_name_key" ON "production_processes"("businessUnitId", "name");

-- CreateIndex
CREATE INDEX "production_entry_wastages_processId_idx" ON "production_entry_wastages"("processId");

-- CreateIndex
CREATE INDEX "production_entry_wastages_itemId_idx" ON "production_entry_wastages"("itemId");

-- CreateIndex
CREATE UNIQUE INDEX "production_entry_wastages_entryId_lineNo_key" ON "production_entry_wastages"("entryId", "lineNo");

-- AddForeignKey
ALTER TABLE "production_processes" ADD CONSTRAINT "production_processes_businessUnitId_fkey" FOREIGN KEY ("businessUnitId") REFERENCES "business_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_entry_wastages" ADD CONSTRAINT "production_entry_wastages_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "production_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_entry_wastages" ADD CONSTRAINT "production_entry_wastages_processId_fkey" FOREIGN KEY ("processId") REFERENCES "production_processes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_entry_wastages" ADD CONSTRAINT "production_entry_wastages_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
