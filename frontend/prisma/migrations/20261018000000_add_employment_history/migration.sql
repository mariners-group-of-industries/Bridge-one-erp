CREATE TABLE "employment_histories" (
  "id"          UUID          NOT NULL DEFAULT gen_random_uuid(),
  "employeeId"  UUID          NOT NULL,
  "companyName" VARCHAR(200)  NOT NULL,
  "jobTitle"    VARCHAR(150)  NOT NULL,
  "location"    VARCHAR(150)  NOT NULL,
  "description" VARCHAR(1000),
  "fromDate"    DATE          NOT NULL,
  "toDate"      DATE          NOT NULL,
  "createdAt"   TIMESTAMPTZ(3) NOT NULL DEFAULT now(),
  "updatedAt"   TIMESTAMPTZ(3) NOT NULL DEFAULT now(),

  CONSTRAINT "employment_histories_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "employment_histories_employeeId_fkey"
    FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE
);

CREATE INDEX "employment_histories_employeeId_idx" ON "employment_histories"("employeeId");
