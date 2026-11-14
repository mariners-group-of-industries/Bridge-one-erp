-- Multilayer approval: the approval stages of any document, copied from its feature's approval pipeline.
CREATE TABLE "document_approvals" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "feature" VARCHAR(60) NOT NULL,
    "documentId" VARCHAR(100) NOT NULL,
    "businessUnitId" UUID,
    "stageNo" INTEGER NOT NULL,
    "stageName" VARCHAR(150) NOT NULL,
    "approvalOrder" VARCHAR(20) NOT NULL,
    "requiredCount" INTEGER NOT NULL DEFAULT 1,
    "approverUserIds" UUID[],
    "approvedUserIds" VARCHAR(100)[] DEFAULT ARRAY[]::VARCHAR(100)[],
    "superApproverUserId" UUID,
    "status" VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    "actedBy" VARCHAR(100),
    "comment" VARCHAR(500),
    "actedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "document_approvals_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "document_approvals_feature_documentId_stageNo_key" ON "document_approvals"("feature", "documentId", "stageNo");
CREATE INDEX "document_approvals_feature_status_idx" ON "document_approvals"("feature", "status");
