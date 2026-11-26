-- Accounts form parity with iBOS: bank short name/signatory, journal employee/project/attachment and line partner,
-- expense header fields with GL lines, budget period/remarks and monthly line amounts, and an attachments table.
-- Every change adds a nullable column or a new table; existing rows are untouched.
-- AlterTable
ALTER TABLE "journal_vouchers" ADD COLUMN     "attachmentId" UUID,
ADD COLUMN     "employeeId" UUID,
ADD COLUMN     "employeeName" VARCHAR(150),
ADD COLUMN     "projectId" UUID,
ADD COLUMN     "projectName" VARCHAR(150);

-- AlterTable
ALTER TABLE "journal_voucher_lines" ADD COLUMN     "partnerId" UUID,
ADD COLUMN     "partnerName" VARCHAR(150),
ADD COLUMN     "partnerType" VARCHAR(20);

-- AlterTable
ALTER TABLE "expense_records" ADD COLUMN     "attachmentId" UUID,
ADD COLUMN     "department" VARCHAR(100),
ADD COLUMN     "employeeId" UUID,
ADD COLUMN     "employeeName" VARCHAR(150),
ADD COLUMN     "salesOrderId" UUID,
ADD COLUMN     "salesOrderNo" VARCHAR(30),
ADD COLUMN     "supplierId" UUID,
ADD COLUMN     "supplierName" VARCHAR(150);

-- AlterTable
ALTER TABLE "budgets" ADD COLUMN     "fromPeriod" DATE,
ADD COLUMN     "remarks" VARCHAR(500),
ADD COLUMN     "toPeriod" DATE;

-- AlterTable
ALTER TABLE "budget_lines" ADD COLUMN     "headCode" VARCHAR(50),
ADD COLUMN     "headName" VARCHAR(150),
ADD COLUMN     "monthlyAmounts" JSONB;

-- AlterTable
ALTER TABLE "bank_accounts" ADD COLUMN     "shortName" VARCHAR(50),
ADD COLUMN     "signatory" VARCHAR(500);

-- CreateTable
CREATE TABLE "expense_lines" (
    "id" UUID NOT NULL,
    "expenseId" UUID NOT NULL,
    "lineNo" INTEGER NOT NULL DEFAULT 1,
    "date" DATE NOT NULL,
    "accountId" UUID,
    "accountCode" VARCHAR(50) NOT NULL,
    "accountName" VARCHAR(150) NOT NULL,
    "subGl" VARCHAR(150),
    "remarks" VARCHAR(500),
    "amount" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "expense_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts_attachments" (
    "id" UUID NOT NULL,
    "storageKey" VARCHAR(300) NOT NULL,
    "originalName" VARCHAR(255) NOT NULL,
    "mimeType" VARCHAR(100) NOT NULL,
    "size" INTEGER NOT NULL,
    "createdBy" VARCHAR(150) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "accounts_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "expense_lines_expenseId_idx" ON "expense_lines"("expenseId");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_attachments_storageKey_key" ON "accounts_attachments"("storageKey");

-- AddForeignKey
ALTER TABLE "journal_vouchers" ADD CONSTRAINT "journal_vouchers_attachmentId_fkey" FOREIGN KEY ("attachmentId") REFERENCES "accounts_attachments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense_records" ADD CONSTRAINT "expense_records_attachmentId_fkey" FOREIGN KEY ("attachmentId") REFERENCES "accounts_attachments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense_lines" ADD CONSTRAINT "expense_lines_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "expense_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;

