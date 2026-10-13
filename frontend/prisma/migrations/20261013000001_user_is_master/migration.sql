ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "isMaster" BOOLEAN NOT NULL DEFAULT false;

-- Mark the master account
UPDATE "users" SET "isMaster" = true WHERE "phone" = '01857055057';
