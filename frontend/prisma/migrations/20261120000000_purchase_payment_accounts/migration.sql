-- Link supplier payments to office, bank account and GL cash/bank account (additive, nullable).
ALTER TABLE "supplier_payments"
  ADD COLUMN "officeId" UUID,
  ADD COLUMN "bankAccountId" UUID,
  ADD COLUMN "cashAccountId" UUID;

ALTER TABLE "supplier_payments"
  ADD CONSTRAINT "supplier_payments_officeId_fkey"
    FOREIGN KEY ("officeId") REFERENCES "offices"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "supplier_payments_bankAccountId_fkey"
    FOREIGN KEY ("bankAccountId") REFERENCES "bank_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "supplier_payments_cashAccountId_fkey"
    FOREIGN KEY ("cashAccountId") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

