-- BOM production items get their own tolerance and a primary flag (one per BOM).

-- AlterTable
ALTER TABLE "production_bom_outputs" ADD COLUMN     "isPrimary" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "tolerancePercent" DECIMAL(5,2);


-- Existing BOMs: the first production item is the primary one and carries the BOM's tolerance.
UPDATE "production_bom_outputs" o SET "isPrimary" = true, "tolerancePercent" = b."tolerancePercent"
FROM "production_boms" b WHERE b."id" = o."bomId" AND o."lineNo" = 1;

-- Hand-written checks
ALTER TABLE "production_bom_outputs" ADD CONSTRAINT "production_bom_outputs_tolerance_check"
  CHECK ("tolerancePercent" IS NULL OR ("tolerancePercent" >= 0 AND "tolerancePercent" <= 100));
CREATE UNIQUE INDEX "production_bom_outputs_one_primary" ON "production_bom_outputs"("bomId") WHERE "isPrimary";
