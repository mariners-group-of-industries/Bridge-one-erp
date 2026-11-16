-- HRM › Payroll: salary batches with a multilayer approval workflow (Draft → Under Processing → Approved).
-- New tables only; existing tables and rows are untouched.
-- CreateTable
CREATE TABLE "payroll_batches" (
    "id" UUID NOT NULL,
    "reference" VARCHAR(30) NOT NULL,
    "businessUnitId" UUID NOT NULL,
    "officeId" UUID NOT NULL,
    "salaryType" VARCHAR(30) NOT NULL,
    "month" VARCHAR(7) NOT NULL,
    "fromDate" DATE NOT NULL,
    "toDate" DATE NOT NULL,
    "payrollDate" DATE NOT NULL,
    "description" VARCHAR(500),
    "status" VARCHAR(20) NOT NULL DEFAULT 'Draft',
    "periodKey" VARCHAR(40),
    "eligibleCount" INTEGER NOT NULL DEFAULT 0,
    "employeeCount" INTEGER NOT NULL DEFAULT 0,
    "totalGross" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "totalBasic" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "totalAllowances" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "totalEarned" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "totalAdditions" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "totalAttendanceDeduction" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "totalOtherDeduction" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "totalNet" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "warningCount" INTEGER NOT NULL DEFAULT 0,
    "errorCount" INTEGER NOT NULL DEFAULT 0,
    "excluded" JSONB NOT NULL DEFAULT '[]',
    "policySnapshot" JSONB NOT NULL DEFAULT '[]',
    "sourceHash" VARCHAR(64) NOT NULL,
    "calculatedAt" TIMESTAMPTZ(3) NOT NULL,
    "submittedAt" TIMESTAMPTZ(3),
    "submittedByName" VARCHAR(150),
    "decidedAt" TIMESTAMPTZ(3),
    "decidedByName" VARCHAR(150),
    "rejectionReason" VARCHAR(500),
    "cancelReason" VARCHAR(500),
    "createdById" VARCHAR(100),
    "createdByName" VARCHAR(150),
    "updatedByName" VARCHAR(150),
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "payroll_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payroll_batch_lines" (
    "id" UUID NOT NULL,
    "batchId" UUID NOT NULL,
    "employeeId" UUID NOT NULL,
    "periodKey" VARCHAR(40),
    "sl" INTEGER NOT NULL,
    "employeeCode" VARCHAR(50) NOT NULL,
    "employeeName" VARCHAR(150) NOT NULL,
    "joiningDate" DATE NOT NULL,
    "designation" VARCHAR(150),
    "department" VARCHAR(150),
    "grossSalary" DECIMAL(14,2) NOT NULL,
    "basic" DECIMAL(14,2),
    "houseRent" DECIMAL(14,2),
    "medical" DECIMAL(14,2),
    "transport" DECIMAL(14,2),
    "components" JSONB NOT NULL DEFAULT '{}',
    "earnedGross" DECIMAL(14,2) NOT NULL,
    "additions" DECIMAL(14,2) NOT NULL,
    "attendanceDeduction" DECIMAL(14,2) NOT NULL,
    "otherDeduction" DECIMAL(14,2) NOT NULL,
    "totalDeduction" DECIMAL(14,2) NOT NULL,
    "netPayable" DECIMAL(14,2) NOT NULL,
    "payMethod" VARCHAR(20) NOT NULL,
    "bankOrProvider" VARCHAR(150),
    "accountNo" VARCHAR(50),
    "attendance" JSONB NOT NULL DEFAULT '{}',
    "trace" JSONB NOT NULL DEFAULT '[]',
    "warnings" JSONB NOT NULL DEFAULT '[]',
    "errors" JSONB NOT NULL DEFAULT '[]',
    "sourceHash" VARCHAR(64) NOT NULL,

    CONSTRAINT "payroll_batch_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payroll_batch_events" (
    "id" UUID NOT NULL,
    "batchId" UUID NOT NULL,
    "action" VARCHAR(30) NOT NULL,
    "fromStatus" VARCHAR(20),
    "toStatus" VARCHAR(20) NOT NULL,
    "stageNo" INTEGER,
    "stageName" VARCHAR(150),
    "actorId" VARCHAR(100),
    "actorName" VARCHAR(150) NOT NULL,
    "remarks" VARCHAR(500),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payroll_batch_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "payroll_batches_reference_key" ON "payroll_batches"("reference");

-- CreateIndex
CREATE INDEX "payroll_batches_month_officeId_idx" ON "payroll_batches"("month", "officeId");

-- CreateIndex
CREATE INDEX "payroll_batches_status_idx" ON "payroll_batches"("status");

-- CreateIndex
CREATE UNIQUE INDEX "payroll_batches_officeId_periodKey_key" ON "payroll_batches"("officeId", "periodKey");

-- CreateIndex
CREATE INDEX "payroll_batch_lines_batchId_sl_idx" ON "payroll_batch_lines"("batchId", "sl");

-- CreateIndex
CREATE UNIQUE INDEX "payroll_batch_lines_employeeId_periodKey_key" ON "payroll_batch_lines"("employeeId", "periodKey");

-- CreateIndex
CREATE INDEX "payroll_batch_events_batchId_createdAt_idx" ON "payroll_batch_events"("batchId", "createdAt");

-- AddForeignKey
ALTER TABLE "payroll_batches" ADD CONSTRAINT "payroll_batches_businessUnitId_fkey" FOREIGN KEY ("businessUnitId") REFERENCES "business_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_batches" ADD CONSTRAINT "payroll_batches_officeId_fkey" FOREIGN KEY ("officeId") REFERENCES "offices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_batch_lines" ADD CONSTRAINT "payroll_batch_lines_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "payroll_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_batch_lines" ADD CONSTRAINT "payroll_batch_lines_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_batch_events" ADD CONSTRAINT "payroll_batch_events_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "payroll_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Only the workflow's statuses.
ALTER TABLE "payroll_batches" ADD CONSTRAINT "payroll_batches_status_check" CHECK ("status" IN ('Draft', 'Under Processing', 'Approved', 'Rejected', 'Cancelled'));
