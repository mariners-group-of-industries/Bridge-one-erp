-- CreateTable
CREATE TABLE "leave_applications" (
    "id" UUID NOT NULL,
    "employeeId" UUID NOT NULL,
    "leaveType" VARCHAR(40) NOT NULL,
    "fromDate" DATE NOT NULL,
    "toDate" DATE NOT NULL,
    "days" INTEGER NOT NULL,
    "location" VARCHAR(150),
    "reason" VARCHAR(500) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'Pending',
    "createdById" UUID,
    "decidedByName" VARCHAR(150),
    "decidedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "leave_applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leave_attachments" (
    "id" UUID NOT NULL,
    "leaveApplicationId" UUID NOT NULL,
    "storageKey" VARCHAR(300) NOT NULL,
    "originalName" VARCHAR(255) NOT NULL,
    "mimeType" VARCHAR(100) NOT NULL,
    "size" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "leave_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "movement_applications" (
    "id" UUID NOT NULL,
    "employeeId" UUID NOT NULL,
    "movementType" VARCHAR(40) NOT NULL,
    "fromDate" DATE NOT NULL,
    "toDate" DATE NOT NULL,
    "startTime" VARCHAR(5) NOT NULL,
    "endTime" VARCHAR(5) NOT NULL,
    "location" VARCHAR(150) NOT NULL,
    "reason" VARCHAR(500) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'Pending',
    "createdById" UUID,
    "decidedByName" VARCHAR(150),
    "decidedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "movement_applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payroll_runs" (
    "id" UUID NOT NULL,
    "officeId" UUID NOT NULL,
    "month" VARCHAR(7) NOT NULL,
    "fromDate" DATE NOT NULL,
    "toDate" DATE NOT NULL,
    "employeeCount" INTEGER NOT NULL,
    "grossAmount" DECIMAL(14,2) NOT NULL,
    "netAmount" DECIMAL(14,2) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'Processed',
    "processedByName" VARCHAR(150),
    "processedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payroll_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payroll_run_lines" (
    "id" UUID NOT NULL,
    "payrollRunId" UUID NOT NULL,
    "employeeId" UUID NOT NULL,
    "employeeCode" VARCHAR(50) NOT NULL,
    "employeeName" VARCHAR(150) NOT NULL,
    "designation" VARCHAR(150),
    "monthDays" INTEGER NOT NULL,
    "payableDays" INTEGER NOT NULL,
    "grossSalary" DECIMAL(14,2) NOT NULL,
    "earnedSalary" DECIMAL(14,2) NOT NULL,
    "additions" DECIMAL(14,2) NOT NULL,
    "deductions" DECIMAL(14,2) NOT NULL,
    "netAmount" DECIMAL(14,2) NOT NULL,
    "disbursementMode" VARCHAR(20) NOT NULL,
    "bankOrProvider" VARCHAR(150),
    "accountNo" VARCHAR(50),

    CONSTRAINT "payroll_run_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bonus_runs" (
    "id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "officeId" UUID,
    "bonusDate" DATE NOT NULL,
    "percentOfGross" DECIMAL(6,2) NOT NULL,
    "minServiceMonths" INTEGER NOT NULL DEFAULT 0,
    "employeeCount" INTEGER NOT NULL,
    "totalAmount" DECIMAL(14,2) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'Pending',
    "createdByName" VARCHAR(150),
    "decidedByName" VARCHAR(150),
    "decidedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "bonus_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bonus_lines" (
    "id" UUID NOT NULL,
    "bonusRunId" UUID NOT NULL,
    "employeeId" UUID NOT NULL,
    "employeeCode" VARCHAR(50) NOT NULL,
    "employeeName" VARCHAR(150) NOT NULL,
    "officeName" VARCHAR(150) NOT NULL,
    "serviceMonths" INTEGER NOT NULL,
    "grossSalary" DECIMAL(14,2) NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "bonus_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "salary_increments" (
    "id" UUID NOT NULL,
    "employeeId" UUID NOT NULL,
    "effectiveDate" DATE NOT NULL,
    "incrementType" VARCHAR(10) NOT NULL,
    "value" DECIMAL(14,2) NOT NULL,
    "previousGross" DECIMAL(14,2) NOT NULL,
    "newGross" DECIMAL(14,2) NOT NULL,
    "remarks" VARCHAR(500),
    "status" VARCHAR(20) NOT NULL DEFAULT 'Pending',
    "createdByName" VARCHAR(150),
    "decidedByName" VARCHAR(150),
    "decidedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "salary_increments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "leave_applications_employeeId_fromDate_idx" ON "leave_applications"("employeeId", "fromDate");

-- CreateIndex
CREATE INDEX "leave_applications_fromDate_idx" ON "leave_applications"("fromDate");

-- CreateIndex
CREATE INDEX "leave_attachments_leaveApplicationId_idx" ON "leave_attachments"("leaveApplicationId");

-- CreateIndex
CREATE INDEX "movement_applications_employeeId_fromDate_idx" ON "movement_applications"("employeeId", "fromDate");

-- CreateIndex
CREATE INDEX "movement_applications_fromDate_idx" ON "movement_applications"("fromDate");

-- CreateIndex
CREATE INDEX "payroll_runs_month_idx" ON "payroll_runs"("month");

-- CreateIndex
CREATE UNIQUE INDEX "payroll_runs_officeId_month_key" ON "payroll_runs"("officeId", "month");

-- CreateIndex
CREATE INDEX "payroll_run_lines_payrollRunId_idx" ON "payroll_run_lines"("payrollRunId");

-- CreateIndex
CREATE INDEX "payroll_run_lines_employeeId_idx" ON "payroll_run_lines"("employeeId");

-- CreateIndex
CREATE INDEX "bonus_runs_bonusDate_idx" ON "bonus_runs"("bonusDate");

-- CreateIndex
CREATE INDEX "bonus_lines_bonusRunId_idx" ON "bonus_lines"("bonusRunId");

-- CreateIndex
CREATE INDEX "bonus_lines_employeeId_idx" ON "bonus_lines"("employeeId");

-- CreateIndex
CREATE INDEX "salary_increments_employeeId_idx" ON "salary_increments"("employeeId");

-- CreateIndex
CREATE INDEX "salary_increments_effectiveDate_idx" ON "salary_increments"("effectiveDate");

-- AddForeignKey
ALTER TABLE "leave_applications" ADD CONSTRAINT "leave_applications_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_attachments" ADD CONSTRAINT "leave_attachments_leaveApplicationId_fkey" FOREIGN KEY ("leaveApplicationId") REFERENCES "leave_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movement_applications" ADD CONSTRAINT "movement_applications_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_runs" ADD CONSTRAINT "payroll_runs_officeId_fkey" FOREIGN KEY ("officeId") REFERENCES "offices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_run_lines" ADD CONSTRAINT "payroll_run_lines_payrollRunId_fkey" FOREIGN KEY ("payrollRunId") REFERENCES "payroll_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_run_lines" ADD CONSTRAINT "payroll_run_lines_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bonus_runs" ADD CONSTRAINT "bonus_runs_officeId_fkey" FOREIGN KEY ("officeId") REFERENCES "offices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bonus_lines" ADD CONSTRAINT "bonus_lines_bonusRunId_fkey" FOREIGN KEY ("bonusRunId") REFERENCES "bonus_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bonus_lines" ADD CONSTRAINT "bonus_lines_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "salary_increments" ADD CONSTRAINT "salary_increments_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

