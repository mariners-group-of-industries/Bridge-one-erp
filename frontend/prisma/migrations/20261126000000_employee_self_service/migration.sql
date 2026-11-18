-- Employee Self Service: personal notifications and payslip publication.
-- Additive only: a new table and two nullable columns.

CREATE TABLE IF NOT EXISTS "user_notifications" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "kind" VARCHAR(30) NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "body" VARCHAR(500),
    "link" VARCHAR(300),
    "readAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_notifications_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "user_notifications_userId_createdAt_idx" ON "user_notifications"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "user_notifications_userId_readAt_idx" ON "user_notifications"("userId", "readAt");

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_notifications_userId_fkey') THEN
        ALTER TABLE "user_notifications" ADD CONSTRAINT "user_notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

ALTER TABLE "payroll_batches" ADD COLUMN IF NOT EXISTS "payslipsPublishedAt" TIMESTAMPTZ(3);
ALTER TABLE "payroll_batches" ADD COLUMN IF NOT EXISTS "payslipsPublishedByName" VARCHAR(150);
