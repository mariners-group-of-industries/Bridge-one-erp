-- CreateTable
CREATE TABLE "hr_policy_records" (
    "id" UUID NOT NULL,
    "tab" VARCHAR(40) NOT NULL,
    "officeId" UUID,
    "employeeId" UUID,
    "effectiveFrom" DATE,
    "effectiveTo" DATE,
    "data" JSONB NOT NULL,
    "createdByName" VARCHAR(150),
    "updatedByName" VARCHAR(150),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "hr_policy_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "hr_policy_records_tab_effectiveFrom_idx" ON "hr_policy_records"("tab", "effectiveFrom");

-- CreateIndex
CREATE INDEX "hr_policy_records_employeeId_idx" ON "hr_policy_records"("employeeId");

-- AddForeignKey
ALTER TABLE "hr_policy_records" ADD CONSTRAINT "hr_policy_records_officeId_fkey" FOREIGN KEY ("officeId") REFERENCES "offices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_policy_records" ADD CONSTRAINT "hr_policy_records_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

