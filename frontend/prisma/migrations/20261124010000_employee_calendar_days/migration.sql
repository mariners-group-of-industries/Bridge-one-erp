-- HRM › Calendar Assign: the calendar (shift) an employee works on one day, or OFF / HOL.
CREATE TABLE "employee_calendar_days" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "employeeId" UUID NOT NULL,
    "date" DATE NOT NULL,
    "code" VARCHAR(20) NOT NULL,
    "calendarId" UUID,
    "updatedByName" VARCHAR(150),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "employee_calendar_days_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "employee_calendar_days_employeeId_date_key" ON "employee_calendar_days"("employeeId", "date");
CREATE INDEX "employee_calendar_days_date_idx" ON "employee_calendar_days"("date");
CREATE INDEX "employee_calendar_days_calendarId_idx" ON "employee_calendar_days"("calendarId");

ALTER TABLE "employee_calendar_days" ADD CONSTRAINT "employee_calendar_days_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "employee_calendar_days" ADD CONSTRAINT "employee_calendar_days_calendarId_fkey" FOREIGN KEY ("calendarId") REFERENCES "hr_policy_records"("id") ON DELETE SET NULL ON UPDATE CASCADE;
