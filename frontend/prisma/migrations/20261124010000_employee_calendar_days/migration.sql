-- HRM › Calendar Assign: the calendar (shift) an employee works on one day, or OFF / HOL.
-- IF NOT EXISTS: a database may already hold this table from the superseded 20261124000000 migration;
-- 20261124020000_employee_calendar_days_reconcile brings that version to this shape.
CREATE TABLE IF NOT EXISTS "employee_calendar_days" (
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

CREATE UNIQUE INDEX IF NOT EXISTS "employee_calendar_days_employeeId_date_key" ON "employee_calendar_days"("employeeId", "date");
CREATE INDEX IF NOT EXISTS "employee_calendar_days_date_idx" ON "employee_calendar_days"("date");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'employee_calendar_days_employeeId_fkey') THEN
    ALTER TABLE "employee_calendar_days" ADD CONSTRAINT "employee_calendar_days_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
