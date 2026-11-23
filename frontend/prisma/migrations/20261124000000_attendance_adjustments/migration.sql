-- HRM › Attendance: manual attendance changes that go to HR for approval.
CREATE TABLE "attendance_adjustments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "employeeId" UUID NOT NULL,
    "date" DATE NOT NULL,
    "originalStatus" VARCHAR(20),
    "requestedStatus" VARCHAR(20) NOT NULL,
    "inTime" VARCHAR(20),
    "outTime" VARCHAR(20),
    "remarks" VARCHAR(500),
    "status" VARCHAR(20) NOT NULL DEFAULT 'Pending',
    "createdById" UUID,
    "createdByName" VARCHAR(150),
    "decidedByName" VARCHAR(150),
    "decidedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "attendance_adjustments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "attendance_adjustments_employeeId_date_idx" ON "attendance_adjustments"("employeeId", "date");
CREATE INDEX "attendance_adjustments_date_idx" ON "attendance_adjustments"("date");
CREATE INDEX "attendance_adjustments_status_idx" ON "attendance_adjustments"("status");

ALTER TABLE "attendance_adjustments" ADD CONSTRAINT "attendance_adjustments_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
