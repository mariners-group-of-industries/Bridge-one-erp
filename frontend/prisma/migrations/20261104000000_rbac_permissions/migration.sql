-- RBAC: ERP access and status on users, permission group metadata and extra actions,
-- user ↔ group assignments, individual overrides and a permission audit log.

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED');
CREATE TYPE "PermissionEffect" AS ENUM ('ALLOW', 'DENY');
CREATE TYPE "PermissionGroupStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- Users: new accounts start without ERP access; existing ones keep theirs until reviewed.
ALTER TABLE "users" ADD COLUMN "erpAccess" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE';
UPDATE "users" SET "erpAccess" = true;

-- Permission groups: code, description, status, full access, creator.
ALTER TABLE "permission_groups" ADD COLUMN "code" VARCHAR(60);
ALTER TABLE "permission_groups" ADD COLUMN "description" VARCHAR(500);
ALTER TABLE "permission_groups" ADD COLUMN "status" "PermissionGroupStatus" NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE "permission_groups" ADD COLUMN "fullAccess" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "permission_groups" ADD COLUMN "createdByName" VARCHAR(150);
UPDATE "permission_groups"
SET "code" = LEFT(UPPER(TRIM(BOTH '_' FROM REGEXP_REPLACE("name", '[^A-Za-z0-9]+', '_', 'g'))), 50) || '_' || UPPER(LEFT(REPLACE("id"::text, '-', ''), 6));
ALTER TABLE "permission_groups" ALTER COLUMN "code" SET NOT NULL;
CREATE UNIQUE INDEX "permission_groups_code_key" ON "permission_groups"("code");

-- Permission group entries: export, import, assign and manage actions.
ALTER TABLE "permission_group_entries" ADD COLUMN "canExport" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "permission_group_entries" ADD COLUMN "canImport" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "permission_group_entries" ADD COLUMN "canAssign" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "permission_group_entries" ADD COLUMN "canManage" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "user_permission_groups" (
    "userId" UUID NOT NULL,
    "groupId" UUID NOT NULL,
    "assignedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_permission_groups_pkey" PRIMARY KEY ("userId","groupId")
);

-- CreateTable
CREATE TABLE "user_permission_overrides" (
    "userId" UUID NOT NULL,
    "activityKey" VARCHAR(200) NOT NULL,
    "action" VARCHAR(20) NOT NULL,
    "effect" "PermissionEffect" NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_permission_overrides_pkey" PRIMARY KEY ("userId","activityKey","action")
);

-- CreateTable
CREATE TABLE "permission_audit_logs" (
    "id" UUID NOT NULL,
    "actorUserId" VARCHAR(100),
    "actorName" VARCHAR(150),
    "targetUserId" UUID,
    "targetGroupId" UUID,
    "operation" VARCHAR(40) NOT NULL,
    "previousValue" JSONB,
    "newValue" JSONB,
    "ipAddress" VARCHAR(64),
    "userAgent" VARCHAR(300),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "permission_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "user_permission_groups_groupId_idx" ON "user_permission_groups"("groupId");
CREATE INDEX "permission_audit_logs_targetUserId_createdAt_idx" ON "permission_audit_logs"("targetUserId", "createdAt");
CREATE INDEX "permission_audit_logs_targetGroupId_createdAt_idx" ON "permission_audit_logs"("targetGroupId", "createdAt");
CREATE INDEX "permission_audit_logs_createdAt_idx" ON "permission_audit_logs"("createdAt");

-- AddForeignKey
ALTER TABLE "user_permission_groups" ADD CONSTRAINT "user_permission_groups_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_permission_groups" ADD CONSTRAINT "user_permission_groups_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "permission_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_permission_overrides" ADD CONSTRAINT "user_permission_overrides_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Rollout: every existing non-master user keeps full access through "Legacy Full Access"
-- until an administrator reviews them and assigns real groups.
INSERT INTO "permission_groups" ("id", "name", "code", "description", "status", "fullAccess", "createdByName", "updatedByName", "createdAt", "updatedAt")
SELECT gen_random_uuid(), 'Legacy Full Access', 'LEGACY_FULL_ACCESS',
       'Created by the permissions migration so existing users keep their access. Review each user, assign proper groups, then remove this group.',
       'ACTIVE', true, 'System', 'System', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "permission_groups" WHERE "code" = 'LEGACY_FULL_ACCESS' OR "name" = 'Legacy Full Access');

INSERT INTO "user_permission_groups" ("userId", "groupId")
SELECT u."id", g."id"
FROM "users" u
CROSS JOIN "permission_groups" g
WHERE g."code" = 'LEGACY_FULL_ACCESS' AND u."isMaster" = false
ON CONFLICT DO NOTHING;
