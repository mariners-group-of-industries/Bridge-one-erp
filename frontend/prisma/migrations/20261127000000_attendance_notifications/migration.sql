-- CreateTable
CREATE TABLE "attendance_notification_settings" (
    "id" UUID NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "notifyCheckIn" BOOLEAN NOT NULL DEFAULT true,
    "notifyLate" BOOLEAN NOT NULL DEFAULT true,
    "notifyCheckOut" BOOLEAN NOT NULL DEFAULT false,
    "whatsappGroupId" VARCHAR(120),
    "whatsappGroupName" VARCHAR(200),
    "departmentFilter" VARCHAR(500),
    "messageTemplate" TEXT NOT NULL,
    "updatedBy" VARCHAR(150),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "attendance_notification_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance_notification_outbox" (
    "id" UUID NOT NULL,
    "employeeId" UUID,
    "employeeCode" VARCHAR(30) NOT NULL,
    "employeeName" VARCHAR(150) NOT NULL,
    "designation" VARCHAR(120),
    "department" VARCHAR(100),
    "attendanceDate" VARCHAR(10) NOT NULL,
    "eventType" VARCHAR(20) NOT NULL,
    "attendanceStatus" VARCHAR(30) NOT NULL,
    "punchTime" TIMESTAMPTZ(3) NOT NULL,
    "groupId" VARCHAR(120) NOT NULL,
    "messageText" TEXT NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "gatewayMessageId" VARCHAR(150),
    "lastError" VARCHAR(500),
    "nextRetryAt" TIMESTAMPTZ(3),
    "sentAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "attendance_notification_outbox_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "attendance_notification_outbox_employeeId_attendanceDate_eventT_key" ON "attendance_notification_outbox"("employeeId", "attendanceDate", "eventType");

-- CreateIndex
CREATE INDEX "attendance_notification_outbox_status_nextRetryAt_idx" ON "attendance_notification_outbox"("status", "nextRetryAt");

-- CreateIndex
CREATE INDEX "attendance_notification_outbox_createdAt_idx" ON "attendance_notification_outbox"("createdAt");
