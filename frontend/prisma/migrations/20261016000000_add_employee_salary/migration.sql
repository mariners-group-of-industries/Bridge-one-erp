CREATE TABLE IF NOT EXISTS "employee_salaries" (
  "id"               UUID           NOT NULL DEFAULT gen_random_uuid(),
  "employeeId"       UUID           NOT NULL,
  "salaryType"       VARCHAR(20)    NOT NULL DEFAULT 'regular',
  "salaryOption"     VARCHAR(20)    NOT NULL DEFAULT 'gross',
  "grossOnly"        DECIMAL(14,2),
  "structBasic"      DECIMAL(14,2),
  "structGross"      DECIMAL(14,2),
  "sgGross"          DECIMAL(14,2),
  "sgBasic"          DECIMAL(14,2),
  "sgHouseRent"      DECIMAL(14,2),
  "sgMedical"        DECIMAL(14,2),
  "sgConveyance"     DECIMAL(14,2),
  "sgMobile"         DECIMAL(14,2),
  "sgFood"           DECIMAL(14,2),
  "sgExtra"          DECIMAL(14,2),
  "disbursementMode" VARCHAR(20)    NOT NULL DEFAULT 'cash',
  "eligibleOT"       BOOLEAN        NOT NULL DEFAULT false,
  "eligiblePF"       BOOLEAN        NOT NULL DEFAULT false,
  "bankName"         VARCHAR(150),
  "branchName"       VARCHAR(150),
  "bankAccountName"  VARCHAR(150),
  "bankAccountNo"    VARCHAR(50),
  "routingNo"        VARCHAR(50),
  "mfsProvider"      VARCHAR(50),
  "mfsNumber"        VARCHAR(30),
  "mfsAccountName"   VARCHAR(150),
  "createdAt"        TIMESTAMPTZ(3) NOT NULL DEFAULT now(),
  "updatedAt"        TIMESTAMPTZ(3) NOT NULL DEFAULT now(),
  CONSTRAINT "employee_salaries_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "employee_salaries_employeeId_key" UNIQUE ("employeeId"),
  CONSTRAINT "employee_salaries_employeeId_fkey"
    FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "employee_salary_adjustments" (
  "id"         UUID           NOT NULL DEFAULT gen_random_uuid(),
  "employeeId" UUID           NOT NULL,
  "fromMonth"  VARCHAR(7)     NOT NULL,
  "toMonth"    VARCHAR(7)     NOT NULL,
  "type"       VARCHAR(10)    NOT NULL,
  "amount"     DECIMAL(14,2)  NOT NULL,
  "createdAt"  TIMESTAMPTZ(3) NOT NULL DEFAULT now(),
  CONSTRAINT "employee_salary_adjustments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "employee_salary_adjustments_employeeId_fkey"
    FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "employee_salary_adjustments_employeeId_idx"
  ON "employee_salary_adjustments"("employeeId");
