-- CreateTable
CREATE TABLE "accounts" (
    "id" UUID NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "parentCode" VARCHAR(50),
    "accountType" VARCHAR(50) NOT NULL,
    "accountSubtype" VARCHAR(100) NOT NULL,
    "tierLevel" VARCHAR(50),
    "normalBalance" VARCHAR(20) NOT NULL,
    "description" VARCHAR(500),
    "openingBalance" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "currentBalance" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "currency" VARCHAR(10) NOT NULL DEFAULT 'BDT',
    "isGroup" BOOLEAN NOT NULL DEFAULT false,
    "status" VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    "officeId" UUID,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cost_centers" (
    "id" UUID NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "type" VARCHAR(50) NOT NULL DEFAULT 'DEPARTMENT',
    "parentCenterId" UUID,
    "officeId" UUID,
    "officeName" VARCHAR(150),
    "description" VARCHAR(500),
    "effectiveDate" DATE,
    "status" VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "cost_centers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "journal_vouchers" (
    "id" UUID NOT NULL,
    "voucherNumber" VARCHAR(50) NOT NULL,
    "transactionDate" DATE NOT NULL,
    "officeId" UUID,
    "officeName" VARCHAR(150),
    "fiscalYear" VARCHAR(30) NOT NULL,
    "journalType" VARCHAR(30) NOT NULL,
    "transType" VARCHAR(50),
    "narration" VARCHAR(1000) NOT NULL,
    "referenceNumber" VARCHAR(100),
    "totalDebit" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "totalCredit" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "amount" DECIMAL(14,2),
    "status" VARCHAR(30) NOT NULL DEFAULT 'POSTED',
    "reversalOfId" UUID,
    "reversedById" UUID,
    "createdBy" VARCHAR(150) NOT NULL,
    "preparedBy" VARCHAR(150),
    "approvedBy" VARCHAR(150),
    "postedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "journal_vouchers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "journal_voucher_lines" (
    "id" UUID NOT NULL,
    "voucherId" UUID NOT NULL,
    "lineNo" INTEGER NOT NULL DEFAULT 1,
    "accountId" UUID,
    "accountCode" VARCHAR(50) NOT NULL,
    "accountName" VARCHAR(150) NOT NULL,
    "debit" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "credit" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "narration" VARCHAR(500),
    "costCenterId" UUID,

    CONSTRAINT "journal_voucher_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expense_records" (
    "id" UUID NOT NULL,
    "expenseNumber" VARCHAR(50) NOT NULL,
    "officeId" UUID,
    "officeName" VARCHAR(150),
    "expenseType" VARCHAR(100) NOT NULL,
    "accountId" UUID,
    "accountName" VARCHAR(150) NOT NULL,
    "payeeName" VARCHAR(150) NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "date" DATE NOT NULL,
    "paymentMethod" VARCHAR(30) NOT NULL DEFAULT 'BANK',
    "referenceNumber" VARCHAR(100),
    "description" VARCHAR(500),
    "status" VARCHAR(30) NOT NULL DEFAULT 'APPROVED',
    "approvedBy" VARCHAR(150),
    "paidAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "expense_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fund_transfers" (
    "id" UUID NOT NULL,
    "transferNumber" VARCHAR(50) NOT NULL,
    "requestCode" VARCHAR(50),
    "outCode" VARCHAR(50),
    "receiveCode" VARCHAR(50),
    "returnCode" VARCHAR(50),
    "requestDate" DATE NOT NULL,
    "expectedDate" DATE,
    "fromOfficeId" UUID,
    "fromOfficeName" VARCHAR(150) NOT NULL,
    "toOfficeId" UUID,
    "toOfficeName" VARCHAR(150) NOT NULL,
    "fromAccountId" UUID,
    "fromAccountName" VARCHAR(150) NOT NULL,
    "toAccountId" UUID,
    "toAccountName" VARCHAR(150) NOT NULL,
    "requestedAmount" DECIMAL(14,2) NOT NULL,
    "approvedAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "transferredAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "receivedAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "responsiblePerson" VARCHAR(150) NOT NULL,
    "receivedPerson" VARCHAR(150),
    "purpose" VARCHAR(500) NOT NULL,
    "status" VARCHAR(50) NOT NULL DEFAULT 'Approved',
    "dispatchedAt" TIMESTAMPTZ(3),
    "receivedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "fund_transfers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cheque_books" (
    "id" UUID NOT NULL,
    "bookName" VARCHAR(150) NOT NULL,
    "bankAccountId" UUID,
    "bankName" VARCHAR(150) NOT NULL,
    "branchName" VARCHAR(150),
    "accountNumber" VARCHAR(50) NOT NULL,
    "startChequeNumber" VARCHAR(50) NOT NULL,
    "endChequeNumber" VARCHAR(50) NOT NULL,
    "totalLeaves" INTEGER NOT NULL DEFAULT 25,
    "usedLeaves" INTEGER NOT NULL DEFAULT 0,
    "remainingLeaves" INTEGER NOT NULL DEFAULT 25,
    "status" VARCHAR(30) NOT NULL DEFAULT 'Running',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "cheque_books_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cheque_issues" (
    "id" UUID NOT NULL,
    "chequeBookId" UUID,
    "chequeNumber" VARCHAR(50) NOT NULL,
    "bankAccountId" UUID,
    "bankName" VARCHAR(150) NOT NULL,
    "transactionNumber" VARCHAR(50) NOT NULL,
    "payeeName" VARCHAR(150) NOT NULL,
    "issueDate" DATE NOT NULL,
    "chequeDate" DATE NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "purpose" VARCHAR(500) NOT NULL,
    "referenceVoucher" VARCHAR(50),
    "status" VARCHAR(30) NOT NULL DEFAULT 'ISSUED',
    "cancellationReason" VARCHAR(500),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "cheque_issues_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "received_cheques" (
    "id" UUID NOT NULL,
    "chequeNumber" VARCHAR(50) NOT NULL,
    "customerName" VARCHAR(150) NOT NULL,
    "bankName" VARCHAR(150) NOT NULL,
    "branchName" VARCHAR(150),
    "receivedDate" DATE NOT NULL,
    "chequeDate" DATE NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "depositStatus" VARCHAR(30) NOT NULL DEFAULT 'NOT_DEPOSITED',
    "depositDate" DATE,
    "remarks" VARCHAR(500),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "received_cheques_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "budgets" (
    "id" UUID NOT NULL,
    "budgetCode" VARCHAR(50) NOT NULL,
    "budgetName" VARCHAR(150) NOT NULL,
    "budgetYear" VARCHAR(100) NOT NULL,
    "createDate" VARCHAR(50),
    "financialPeriod" VARCHAR(100) NOT NULL,
    "officeId" UUID,
    "officeName" VARCHAR(150),
    "costCenterId" UUID,
    "costCenterName" VARCHAR(150),
    "budgetType" VARCHAR(100) NOT NULL,
    "accountId" UUID,
    "accountName" VARCHAR(150),
    "allocatedAmount" DECIMAL(14,2) NOT NULL,
    "totalBudgetAmount" DECIMAL(14,2),
    "revisedAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "utilizedAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "committedAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "remainingAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "approvalStatus" VARCHAR(50) NOT NULL DEFAULT 'Approved',
    "status" VARCHAR(50) NOT NULL DEFAULT 'Approved',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdBy" VARCHAR(150) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "budgets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "budget_lines" (
    "id" UUID NOT NULL,
    "budgetId" UUID NOT NULL,
    "accountCode" VARCHAR(50) NOT NULL,
    "accountName" VARCHAR(150) NOT NULL,
    "costCenterName" VARCHAR(150),
    "allocatedAmount" DECIMAL(14,2) NOT NULL,
    "utilizedAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "remainingAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "remarks" VARCHAR(500),

    CONSTRAINT "budget_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bank_accounts" (
    "id" UUID NOT NULL,
    "accountNumber" VARCHAR(50) NOT NULL,
    "bankName" VARCHAR(150) NOT NULL,
    "branchName" VARCHAR(150) NOT NULL,
    "accountHolder" VARCHAR(150) NOT NULL,
    "accountType" VARCHAR(50) NOT NULL DEFAULT 'CURRENT',
    "currency" VARCHAR(10) NOT NULL DEFAULT 'BDT',
    "glAccountId" UUID,
    "glAccountName" VARCHAR(150),
    "openingBalance" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "currentBalance" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "reconciliationStatus" VARCHAR(50) NOT NULL DEFAULT 'RECONCILED',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "bank_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "accounts_code_key" ON "accounts"("code");

-- CreateIndex
CREATE UNIQUE INDEX "cost_centers_code_key" ON "cost_centers"("code");

-- CreateIndex
CREATE UNIQUE INDEX "journal_vouchers_voucherNumber_key" ON "journal_vouchers"("voucherNumber");

-- CreateIndex
CREATE UNIQUE INDEX "expense_records_expenseNumber_key" ON "expense_records"("expenseNumber");

-- CreateIndex
CREATE UNIQUE INDEX "fund_transfers_transferNumber_key" ON "fund_transfers"("transferNumber");

-- CreateIndex
CREATE UNIQUE INDEX "cheque_issues_transactionNumber_key" ON "cheque_issues"("transactionNumber");

-- CreateIndex
CREATE UNIQUE INDEX "budgets_budgetCode_key" ON "budgets"("budgetCode");

-- CreateIndex
CREATE UNIQUE INDEX "bank_accounts_accountNumber_key" ON "bank_accounts"("accountNumber");

-- AddForeignKey
ALTER TABLE "journal_voucher_lines" ADD CONSTRAINT "journal_voucher_lines_voucherId_fkey" FOREIGN KEY ("voucherId") REFERENCES "journal_vouchers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_voucher_lines" ADD CONSTRAINT "journal_voucher_lines_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_voucher_lines" ADD CONSTRAINT "journal_voucher_lines_costCenterId_fkey" FOREIGN KEY ("costCenterId") REFERENCES "cost_centers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cheque_issues" ADD CONSTRAINT "cheque_issues_chequeBookId_fkey" FOREIGN KEY ("chequeBookId") REFERENCES "cheque_books"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_lines" ADD CONSTRAINT "budget_lines_budgetId_fkey" FOREIGN KEY ("budgetId") REFERENCES "budgets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
