-- CreateTable
CREATE TABLE "attendance_devices" (
    "id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "ipAddress" VARCHAR(64) NOT NULL,
    "port" INTEGER NOT NULL DEFAULT 4370,
    "serialNumber" VARCHAR(60),
    "officeId" UUID,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastSyncAt" TIMESTAMPTZ(3),
    "lastSyncCount" INTEGER,
    "lastError" VARCHAR(500),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "attendance_devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance_punches" (
    "id" UUID NOT NULL,
    "deviceId" UUID NOT NULL,
    "deviceUserId" VARCHAR(30) NOT NULL,
    "employeeId" UUID,
    "punchTime" TIMESTAMPTZ(3) NOT NULL,
    "punchState" INTEGER,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attendance_punches_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "attendance_devices_ipAddress_port_key" ON "attendance_devices"("ipAddress", "port");

-- CreateIndex
CREATE INDEX "attendance_punches_employeeId_punchTime_idx" ON "attendance_punches"("employeeId", "punchTime");

-- CreateIndex
CREATE INDEX "attendance_punches_punchTime_idx" ON "attendance_punches"("punchTime");

-- CreateIndex
CREATE UNIQUE INDEX "attendance_punches_deviceId_deviceUserId_punchTime_key" ON "attendance_punches"("deviceId", "deviceUserId", "punchTime");

-- AddForeignKey
ALTER TABLE "attendance_devices" ADD CONSTRAINT "attendance_devices_officeId_fkey" FOREIGN KEY ("officeId") REFERENCES "offices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_punches" ADD CONSTRAINT "attendance_punches_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "attendance_devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_punches" ADD CONSTRAINT "attendance_punches_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

