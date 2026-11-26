-- Extend expense_records for Advance & Provision tracking alongside Expense.
ALTER TABLE "expense_records"
  ADD COLUMN "recordKind" VARCHAR(30) NOT NULL DEFAULT 'EXPENSE',
  ADD COLUMN "accountCode" VARCHAR(50),
  ADD COLUMN "settledAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN "effectivePeriod" VARCHAR(100);

-- Create coa_permissions table for Chart of Accounts Employee-Voucher-GL authorization.
CREATE TABLE "coa_permissions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "employeeUuid" UUID,
  "employeeId" VARCHAR(50) NOT NULL,
  "employeeName" VARCHAR(150) NOT NULL,
  "voucherType" VARCHAR(50) NOT NULL,
  "accountId" UUID,
  "accountHeadCode" VARCHAR(50) NOT NULL,
  "accountHeadName" VARCHAR(150) NOT NULL,
  "status" VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,

  CONSTRAINT "coa_permissions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "coa_permissions_employeeId_voucherType_accountHeadCode_key"
  ON "coa_permissions"("employeeId", "voucherType", "accountHeadCode");
CREATE INDEX "coa_permissions_accountHeadCode_idx" ON "coa_permissions"("accountHeadCode");
CREATE INDEX "coa_permissions_voucherType_idx" ON "coa_permissions"("voucherType");

ALTER TABLE "coa_permissions"
  ADD CONSTRAINT "coa_permissions_accountId_fkey"
    FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "coa_permissions_employeeUuid_fkey"
    FOREIGN KEY ("employeeUuid") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Create bank_facilities table for Deposits, Bank Loans, and Other Loan Partners.
CREATE TABLE "bank_facilities" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "facilityKind" VARCHAR(30) NOT NULL,
  "facilityNumber" VARCHAR(50) NOT NULL,
  "bankAccountId" UUID,
  "officeId" UUID,
  "officeName" VARCHAR(150),
  "partyName" VARCHAR(150) NOT NULL,
  "facilityType" VARCHAR(100) NOT NULL,
  "category" VARCHAR(50),
  "partnerGroup" VARCHAR(100),
  "glAccountId" UUID,
  "glAccountName" VARCHAR(150),
  "principalAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "interestRate" DECIMAL(6,2) NOT NULL DEFAULT 0,
  "openingDate" DATE,
  "maturityDate" DATE,
  "maturityValue" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "installmentAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "outstandingPrincipal" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "accruedInterest" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "tenureMonths" INTEGER,
  "status" VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,

  CONSTRAINT "bank_facilities_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "bank_facilities_facilityNumber_key" ON "bank_facilities"("facilityNumber");
CREATE INDEX "bank_facilities_facilityKind_idx" ON "bank_facilities"("facilityKind");

