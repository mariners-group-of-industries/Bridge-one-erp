-- CreateTable
CREATE TABLE "approval_pipelines" (
    "id" UUID NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "feature" VARCHAR(60) NOT NULL,
    "userType" VARCHAR(10) NOT NULL DEFAULT 'USER',
    "superApproverUserId" UUID,
    "superApproverEmployeeId" UUID,
    "remarks" VARCHAR(500),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "approval_pipelines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_stages" (
    "id" UUID NOT NULL,
    "pipelineId" UUID NOT NULL,
    "stageNo" INTEGER NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "approvalOrder" VARCHAR(20) NOT NULL,
    "requiredCount" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "approval_stages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_stage_approvers" (
    "id" UUID NOT NULL,
    "stageId" UUID NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "userType" VARCHAR(10) NOT NULL,
    "businessUnitId" UUID,
    "userId" UUID,
    "employeeId" UUID,
    "authorizationType" VARCHAR(20) NOT NULL,

    CONSTRAINT "approval_stage_approvers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "approval_pipelines_name_key" ON "approval_pipelines"("name");

-- CreateIndex
CREATE INDEX "approval_pipelines_feature_idx" ON "approval_pipelines"("feature");

-- CreateIndex
CREATE UNIQUE INDEX "approval_stages_pipelineId_stageNo_key" ON "approval_stages"("pipelineId", "stageNo");

-- CreateIndex
CREATE INDEX "approval_stage_approvers_stageId_idx" ON "approval_stage_approvers"("stageId");

-- AddForeignKey
ALTER TABLE "approval_pipelines" ADD CONSTRAINT "approval_pipelines_superApproverUserId_fkey" FOREIGN KEY ("superApproverUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_pipelines" ADD CONSTRAINT "approval_pipelines_superApproverEmployeeId_fkey" FOREIGN KEY ("superApproverEmployeeId") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_stages" ADD CONSTRAINT "approval_stages_pipelineId_fkey" FOREIGN KEY ("pipelineId") REFERENCES "approval_pipelines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_stage_approvers" ADD CONSTRAINT "approval_stage_approvers_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "approval_stages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_stage_approvers" ADD CONSTRAINT "approval_stage_approvers_businessUnitId_fkey" FOREIGN KEY ("businessUnitId") REFERENCES "business_units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_stage_approvers" ADD CONSTRAINT "approval_stage_approvers_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_stage_approvers" ADD CONSTRAINT "approval_stage_approvers_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

