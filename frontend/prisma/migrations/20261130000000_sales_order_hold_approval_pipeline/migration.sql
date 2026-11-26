-- A sales order can wait for its Sales Order approval pipeline (Configuration > Approval Setup)
-- even when it is within credit limit and has nothing overdue.
ALTER TYPE "OrderHoldReason" ADD VALUE IF NOT EXISTS 'APPROVAL_PIPELINE';
