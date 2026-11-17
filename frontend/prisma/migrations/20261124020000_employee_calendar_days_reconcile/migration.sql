-- Brings "employee_calendar_days" to one shape on every database. Two branches each created this
-- table: one with "shortCode", one with "code" + "calendarId" + "createdAt". The app uses the second.
-- Every step is guarded, so this is a no-op where the table is already correct. Existing rows are kept.

DO $$
BEGIN
  -- Old "shortCode" column becomes "code" (or is folded into it if both exist).
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'employee_calendar_days' AND column_name = 'shortCode') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'employee_calendar_days' AND column_name = 'code') THEN
      UPDATE "employee_calendar_days" SET "code" = "shortCode" WHERE "code" IS NULL OR "code" = '';
      ALTER TABLE "employee_calendar_days" DROP COLUMN "shortCode";
    ELSE
      ALTER TABLE "employee_calendar_days" RENAME COLUMN "shortCode" TO "code";
    END IF;
  END IF;
END $$;

ALTER TABLE "employee_calendar_days" ADD COLUMN IF NOT EXISTS "calendarId" UUID;
ALTER TABLE "employee_calendar_days" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "employee_calendar_days" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();

CREATE INDEX IF NOT EXISTS "employee_calendar_days_calendarId_idx" ON "employee_calendar_days"("calendarId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'employee_calendar_days_calendarId_fkey') THEN
    ALTER TABLE "employee_calendar_days" ADD CONSTRAINT "employee_calendar_days_calendarId_fkey" FOREIGN KEY ("calendarId") REFERENCES "hr_policy_records"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
