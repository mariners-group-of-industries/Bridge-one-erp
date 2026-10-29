-- BOM wastage output gets output type, ratio % and calculation flags; overheads are booked to an expense account.
-- Both tables were empty when this was written.

ALTER TABLE "production_bom_wastages" DROP CONSTRAINT IF EXISTS "production_bom_wastages_qty_check";

-- CreateEnum
CREATE TYPE "ProductionWastageType" AS ENUM ('SCRAP', 'BY_PRODUCT', 'RUNNER', 'REWORK', 'DEFECT');

-- AlterTable
ALTER TABLE "production_bom_wastages" DROP COLUMN "qty",
DROP COLUMN "remarks",
ADD COLUMN     "calcWithNetWeight" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "calcWithProcessRunner" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isMandatory" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "itemType" VARCHAR(50),
ADD COLUMN     "outputType" "ProductionWastageType" NOT NULL,
ADD COLUMN     "ratioPercent" DECIMAL(6,2) NOT NULL;

-- AlterTable
ALTER TABLE "production_bom_overheads" DROP COLUMN "name",
ADD COLUMN     "accountId" UUID NOT NULL,
ADD COLUMN     "percentage" DECIMAL(6,2);

-- CreateIndex
CREATE INDEX "production_bom_overheads_accountId_idx" ON "production_bom_overheads"("accountId");

-- CreateIndex
CREATE UNIQUE INDEX "production_bom_overheads_bomId_accountId_key" ON "production_bom_overheads"("bomId", "accountId");

-- AddForeignKey
ALTER TABLE "production_bom_overheads" ADD CONSTRAINT "production_bom_overheads_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Hand-written checks
ALTER TABLE "production_bom_wastages" ADD CONSTRAINT "production_bom_wastages_ratio_check" CHECK ("ratioPercent" > 0 AND "ratioPercent" <= 100);
ALTER TABLE "production_bom_overheads" ADD CONSTRAINT "production_bom_overheads_percentage_check" CHECK ("percentage" IS NULL OR ("percentage" > 0 AND "percentage" <= 1000));
