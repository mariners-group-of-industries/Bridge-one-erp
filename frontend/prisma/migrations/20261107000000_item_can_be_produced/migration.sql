-- Item "Can be Produced" flag, and batch tracking as in Managerium (None / Batch).
ALTER TABLE "items" ADD COLUMN "canBeProduced" BOOLEAN NOT NULL DEFAULT false;

-- Items that already come out of a BOM are produced.
UPDATE "items" SET "canBeProduced" = true
WHERE "id" IN (SELECT DISTINCT "itemId" FROM "production_bom_outputs");

UPDATE "items" SET "tracking" = 'BATCH' WHERE "tracking" = 'BOTH';
