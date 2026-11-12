-- Approval Setup: module, office/territory/item-category scope and per-stage amount threshold.

-- AlterTable
ALTER TABLE "approval_pipelines" ADD COLUMN "module" VARCHAR(30) NOT NULL DEFAULT '',
ADD COLUMN "isOfficeWise" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "isTerritoryWise" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "isItemCategoryWise" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "approval_stages" ADD COLUMN "allowThreshold" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "thresholdMin" DECIMAL(18,2),
ADD COLUMN "thresholdMax" DECIMAL(18,2);

-- Backfill the module of existing pipelines from their feature.
UPDATE "approval_pipelines" SET "module" = CASE
  WHEN "feature" IN ('Purchase Requisition', 'Purchase Order', 'Purchase Order Local', 'Goods Receipt', 'Purchase Return', 'Payment Approval') THEN 'Purchase'
  WHEN "feature" IN ('Sales Quotation', 'Sales Order', 'Sales Delivery', 'Sales Return', 'Sales Collection', 'Customer Price Setup', 'Offer Setup') THEN 'Sales'
  WHEN "feature" IN ('Production Order') THEN 'Production'
  ELSE "module"
END
WHERE "module" = '';
