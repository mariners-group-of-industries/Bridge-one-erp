-- Calendar Assign saves each employee's calendar per day (it was only kept in the browser before).
-- New table only; existing rows are untouched.
-- CreateTable
CREATE TABLE "employee_calendar_days" (
    "id" UUID NOT NULL,
    "employeeId" UUID NOT NULL,
    "date" DATE NOT NULL,
    "shortCode" VARCHAR(20) NOT NULL,
    "updatedByName" VARCHAR(150),
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "employee_calendar_days_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "employee_calendar_days_date_idx" ON "employee_calendar_days"("date");

-- CreateIndex
CREATE UNIQUE INDEX "employee_calendar_days_employeeId_date_key" ON "employee_calendar_days"("employeeId", "date");

-- AddForeignKey
ALTER TABLE "employee_calendar_days" ADD CONSTRAINT "employee_calendar_days_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
