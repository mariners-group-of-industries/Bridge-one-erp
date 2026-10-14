CREATE TABLE "employee_academics" (
  "id"           UUID        NOT NULL DEFAULT gen_random_uuid(),
  "employeeId"   UUID        NOT NULL,
  "isForeigner"  BOOLEAN     NOT NULL DEFAULT false,
  "institute"    VARCHAR(200) NOT NULL,
  "degree"       VARCHAR(150) NOT NULL,
  "fieldOfStudy" VARCHAR(150) NOT NULL,
  "result"       VARCHAR(50)  NOT NULL,
  "scale"        VARCHAR(20)  NOT NULL,
  "startDate"    DATE         NOT NULL,
  "finishDate"   DATE         NOT NULL,
  "createdAt"    TIMESTAMPTZ(3) NOT NULL DEFAULT now(),
  "updatedAt"    TIMESTAMPTZ(3) NOT NULL DEFAULT now(),

  CONSTRAINT "employee_academics_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "employee_academics_employeeId_fkey"
    FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE
);

CREATE INDEX "employee_academics_employeeId_idx" ON "employee_academics"("employeeId");
