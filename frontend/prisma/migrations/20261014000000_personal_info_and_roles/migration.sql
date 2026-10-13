-- Add missing employee flags
ALTER TABLE "employees"
  ADD COLUMN IF NOT EXISTS "isMasterUser"        BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "loginWithEmployeeId" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "isAllCustomerView"   BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "isSR"                BOOLEAN NOT NULL DEFAULT false;

-- Dynamic roles (separate from the UserRole enum used for system access)
CREATE TABLE IF NOT EXISTS "roles" (
  "id"          UUID         NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  "name"        VARCHAR(100) NOT NULL,
  "description" VARCHAR(500),
  "createdAt"   TIMESTAMPTZ(3) NOT NULL DEFAULT now(),
  "updatedAt"   TIMESTAMPTZ(3) NOT NULL DEFAULT now(),
  CONSTRAINT "roles_name_key" UNIQUE ("name")
);

-- Organizational access assignments
CREATE TABLE IF NOT EXISTS "user_business_unit_access" (
  "userId"         UUID NOT NULL,
  "businessUnitId" UUID NOT NULL,
  "createdAt"      TIMESTAMPTZ(3) NOT NULL DEFAULT now(),
  PRIMARY KEY ("userId", "businessUnitId"),
  CONSTRAINT "user_bu_access_user_fk" FOREIGN KEY ("userId")         REFERENCES "users"("id")          ON DELETE CASCADE,
  CONSTRAINT "user_bu_access_bu_fk"   FOREIGN KEY ("businessUnitId") REFERENCES "business_units"("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "user_office_access" (
  "userId"    UUID NOT NULL,
  "officeId"  UUID NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT now(),
  PRIMARY KEY ("userId", "officeId"),
  CONSTRAINT "user_office_access_user_fk"   FOREIGN KEY ("userId")   REFERENCES "users"("id")   ON DELETE CASCADE,
  CONSTRAINT "user_office_access_office_fk" FOREIGN KEY ("officeId") REFERENCES "offices"("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "user_warehouse_access" (
  "userId"      UUID NOT NULL,
  "warehouseId" UUID NOT NULL,
  "createdAt"   TIMESTAMPTZ(3) NOT NULL DEFAULT now(),
  PRIMARY KEY ("userId", "warehouseId"),
  CONSTRAINT "user_wh_access_user_fk" FOREIGN KEY ("userId")      REFERENCES "users"("id")      ON DELETE CASCADE,
  CONSTRAINT "user_wh_access_wh_fk"   FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE CASCADE
);

-- Link user to a dynamic role (nullable)
ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "roleId" UUID REFERENCES "roles"("id") ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS "users_roleId_idx" ON "users"("roleId");
