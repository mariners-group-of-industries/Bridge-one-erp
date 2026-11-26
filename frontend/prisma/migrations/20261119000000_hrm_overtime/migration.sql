-- HRM › Overtime: one employee's overtime on one day (from attendance or manual), approved before it is paid.
CREATE TABLE "overtime_entries" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "employeeId" UUID NOT NULL,
    "officeId" UUID NOT NULL,
    "date" DATE NOT NULL,
    "minutes" INTEGER NOT NULL,
    "source" VARCHAR(20) NOT NULL,
    "inTime" VARCHAR(5),
    "outTime" VARCHAR(5),
    "workedMinutes" INTEGER,
    "reason" VARCHAR(500),
    "status" VARCHAR(20) NOT NULL DEFAULT 'Pending',
    "createdByName" VARCHAR(150),
    "decidedByName" VARCHAR(150),
    "decidedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "overtime_entries_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "overtime_entries_employeeId_date_key" ON "overtime_entries"("employeeId", "date");
CREATE INDEX "overtime_entries_officeId_date_idx" ON "overtime_entries"("officeId", "date");
CREATE INDEX "overtime_entries_status_date_idx" ON "overtime_entries"("status", "date");

ALTER TABLE "overtime_entries" ADD CONSTRAINT "overtime_entries_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "overtime_entries" ADD CONSTRAINT "overtime_entries_officeId_fkey" FOREIGN KEY ("officeId") REFERENCES "offices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
