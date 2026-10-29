-- CreateEnum
CREATE TYPE "TargetBasis" AS ENUM ('AMOUNT', 'QUANTITY');

-- CreateEnum
CREATE TYPE "CommissionBasis" AS ENUM ('AMOUNT', 'PERCENT');

-- DropIndex
DROP INDEX "sales_targets_salesPersonId_month_key";

-- AlterTable
ALTER TABLE "sales_targets" ADD COLUMN     "budgetId" UUID,
ADD COLUMN     "qty" DECIMAL(14,3);

-- CreateTable
CREATE TABLE "sales_target_budgets" (
    "id" UUID NOT NULL,
    "businessUnitId" UUID NOT NULL,
    "targetType" VARCHAR(20) NOT NULL DEFAULT 'EMPLOYEE',
    "basis" "TargetBasis" NOT NULL,
    "year" INTEGER NOT NULL,
    "createdBy" VARCHAR(100),
    "updatedBy" VARCHAR(100),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "sales_target_budgets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_target_plans" (
    "id" UUID NOT NULL,
    "businessUnitId" UUID NOT NULL,
    "number" VARCHAR(30) NOT NULL,
    "officeId" UUID NOT NULL,
    "createDate" DATE NOT NULL,
    "basis" "TargetBasis" NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "targetAmount" DECIMAL(14,2) NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "remarks" VARCHAR(500),
    "customerGroupWise" BOOLEAN NOT NULL DEFAULT false,
    "status" "SalesDocStatus" NOT NULL DEFAULT 'SUBMITTED',
    "createdBy" VARCHAR(100),
    "updatedBy" VARCHAR(100),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "sales_target_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_target_plan_lines" (
    "id" UUID NOT NULL,
    "planId" UUID NOT NULL,
    "lineNo" INTEGER NOT NULL,
    "customerId" UUID,
    "customerGroupId" UUID,
    "itemId" UUID,
    "rate" DECIMAL(14,2),
    "qty" DECIMAL(14,3),
    "amount" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "sales_target_plan_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_target_assignments" (
    "id" UUID NOT NULL,
    "planId" UUID NOT NULL,
    "salesPersonId" UUID NOT NULL,
    "customerGroupId" UUID,
    "targetAmount" DECIMAL(14,2) NOT NULL,
    "commissionBasis" "CommissionBasis" NOT NULL,
    "commissionRate" DECIMAL(14,4) NOT NULL,
    "minimumCollection" DECIMAL(14,2) NOT NULL,
    "createdBy" VARCHAR(100),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "sales_target_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_commissions" (
    "id" UUID NOT NULL,
    "businessUnitId" UUID NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "salesPersonId" UUID NOT NULL,
    "customerGroupId" UUID,
    "fromDate" DATE NOT NULL,
    "toDate" DATE NOT NULL,
    "status" "SalesDocStatus" NOT NULL DEFAULT 'SUBMITTED',
    "createdBy" VARCHAR(100),
    "updatedBy" VARCHAR(100),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "sales_commissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_commission_lines" (
    "id" UUID NOT NULL,
    "commissionId" UUID NOT NULL,
    "itemId" UUID NOT NULL,
    "basis" "CommissionBasis" NOT NULL,
    "value" DECIMAL(14,4) NOT NULL,

    CONSTRAINT "sales_commission_lines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sales_target_budgets_businessUnitId_year_basis_key" ON "sales_target_budgets"("businessUnitId", "year", "basis");

-- CreateIndex
CREATE INDEX "sales_target_plans_officeId_startDate_idx" ON "sales_target_plans"("officeId", "startDate");

-- CreateIndex
CREATE UNIQUE INDEX "sales_target_plans_businessUnitId_number_key" ON "sales_target_plans"("businessUnitId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "sales_target_plan_lines_planId_lineNo_key" ON "sales_target_plan_lines"("planId", "lineNo");

-- CreateIndex
CREATE INDEX "sales_target_assignments_salesPersonId_idx" ON "sales_target_assignments"("salesPersonId");

-- CreateIndex
CREATE UNIQUE INDEX "sales_target_assignments_planId_salesPersonId_key" ON "sales_target_assignments"("planId", "salesPersonId");

-- CreateIndex
CREATE INDEX "sales_commissions_salesPersonId_fromDate_idx" ON "sales_commissions"("salesPersonId", "fromDate");

-- CreateIndex
CREATE INDEX "sales_commission_lines_itemId_idx" ON "sales_commission_lines"("itemId");

-- CreateIndex
CREATE UNIQUE INDEX "sales_commission_lines_commissionId_itemId_key" ON "sales_commission_lines"("commissionId", "itemId");

-- CreateIndex
CREATE INDEX "sales_targets_salesPersonId_month_idx" ON "sales_targets"("salesPersonId", "month");

-- CreateIndex
CREATE UNIQUE INDEX "sales_targets_budgetId_salesPersonId_month_key" ON "sales_targets"("budgetId", "salesPersonId", "month");

-- AddForeignKey
ALTER TABLE "sales_targets" ADD CONSTRAINT "sales_targets_budgetId_fkey" FOREIGN KEY ("budgetId") REFERENCES "sales_target_budgets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_target_budgets" ADD CONSTRAINT "sales_target_budgets_businessUnitId_fkey" FOREIGN KEY ("businessUnitId") REFERENCES "business_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_target_plans" ADD CONSTRAINT "sales_target_plans_businessUnitId_fkey" FOREIGN KEY ("businessUnitId") REFERENCES "business_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_target_plans" ADD CONSTRAINT "sales_target_plans_officeId_fkey" FOREIGN KEY ("officeId") REFERENCES "offices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_target_plan_lines" ADD CONSTRAINT "sales_target_plan_lines_planId_fkey" FOREIGN KEY ("planId") REFERENCES "sales_target_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_target_plan_lines" ADD CONSTRAINT "sales_target_plan_lines_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_target_plan_lines" ADD CONSTRAINT "sales_target_plan_lines_customerGroupId_fkey" FOREIGN KEY ("customerGroupId") REFERENCES "customer_groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_target_plan_lines" ADD CONSTRAINT "sales_target_plan_lines_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_target_assignments" ADD CONSTRAINT "sales_target_assignments_planId_fkey" FOREIGN KEY ("planId") REFERENCES "sales_target_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_target_assignments" ADD CONSTRAINT "sales_target_assignments_salesPersonId_fkey" FOREIGN KEY ("salesPersonId") REFERENCES "sales_persons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_target_assignments" ADD CONSTRAINT "sales_target_assignments_customerGroupId_fkey" FOREIGN KEY ("customerGroupId") REFERENCES "customer_groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_commissions" ADD CONSTRAINT "sales_commissions_businessUnitId_fkey" FOREIGN KEY ("businessUnitId") REFERENCES "business_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_commissions" ADD CONSTRAINT "sales_commissions_salesPersonId_fkey" FOREIGN KEY ("salesPersonId") REFERENCES "sales_persons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_commissions" ADD CONSTRAINT "sales_commissions_customerGroupId_fkey" FOREIGN KEY ("customerGroupId") REFERENCES "customer_groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_commission_lines" ADD CONSTRAINT "sales_commission_lines_commissionId_fkey" FOREIGN KEY ("commissionId") REFERENCES "sales_commissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_commission_lines" ADD CONSTRAINT "sales_commission_lines_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Existing monthly targets become one amount budget per business unit and year.
INSERT INTO "sales_target_budgets" ("id", "businessUnitId", "targetType", "basis", "year", "updatedAt")
SELECT gen_random_uuid(), y."businessUnitId", 'EMPLOYEE', 'AMOUNT', y."year", CURRENT_TIMESTAMP
FROM (SELECT DISTINCT "businessUnitId", EXTRACT(YEAR FROM "month")::int AS "year" FROM "sales_targets") y;

UPDATE "sales_targets" s SET "budgetId" = b."id"
FROM "sales_target_budgets" b
WHERE b."businessUnitId" = s."businessUnitId" AND b."basis" = 'AMOUNT' AND b."year" = EXTRACT(YEAR FROM s."month")::int;
ALTER TABLE "sales_targets" ALTER COLUMN "budgetId" SET NOT NULL;

-- Hand-written checks (Prisma cannot express them).
ALTER TABLE "sales_targets" ADD CONSTRAINT "sales_targets_values_check" CHECK ("amount" >= 0 AND ("qty" IS NULL OR "qty" >= 0));
ALTER TABLE "sales_target_budgets" ADD CONSTRAINT "sales_target_budgets_year_check" CHECK ("year" BETWEEN 2000 AND 2100);
ALTER TABLE "sales_target_plans" ADD CONSTRAINT "sales_target_plans_check" CHECK ("targetAmount" >= 0 AND "endDate" >= "startDate");
ALTER TABLE "sales_target_plan_lines" ADD CONSTRAINT "sales_target_plan_lines_check" CHECK (
  "amount" >= 0 AND ("rate" IS NULL OR "rate" >= 0) AND ("qty" IS NULL OR "qty" >= 0)
  AND ("customerId" IS NULL) <> ("customerGroupId" IS NULL)
);
ALTER TABLE "sales_target_assignments" ADD CONSTRAINT "sales_target_assignments_check" CHECK (
  "targetAmount" >= 0 AND "commissionRate" >= 0 AND "minimumCollection" >= 0
  AND ("commissionBasis" <> 'PERCENT' OR "commissionRate" <= 100)
);
ALTER TABLE "sales_commissions" ADD CONSTRAINT "sales_commissions_dates_check" CHECK ("toDate" >= "fromDate");
ALTER TABLE "sales_commission_lines" ADD CONSTRAINT "sales_commission_lines_value_check" CHECK (
  "value" >= 0 AND ("basis" <> 'PERCENT' OR "value" <= 100)
);
