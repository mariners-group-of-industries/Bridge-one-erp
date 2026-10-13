CREATE TABLE "employee_documents" (
  "id"           UUID         NOT NULL DEFAULT gen_random_uuid(),
  "employeeId"   UUID         NOT NULL,
  "documentType" VARCHAR(100) NOT NULL,
  "documentName" VARCHAR(150) NOT NULL,
  "issueDate"    DATE,
  "fileKey"      VARCHAR(300),
  "fileName"     VARCHAR(255),
  "createdAt"    TIMESTAMPTZ(3) NOT NULL DEFAULT NOW(),
  "updatedAt"    TIMESTAMPTZ(3) NOT NULL DEFAULT NOW(),

  CONSTRAINT "employee_documents_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "employee_documents_employeeId_fkey"
    FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE
);

CREATE INDEX "employee_documents_employeeId_idx" ON "employee_documents"("employeeId");
