-- Automatic GL posting: vouchers keep the document they came from; posting roles map to GL accounts.
-- AlterTable
ALTER TABLE "journal_vouchers" ADD COLUMN     "sourceId" UUID,
ADD COLUMN     "sourceType" VARCHAR(40);

-- CreateTable
CREATE TABLE "posting_accounts" (
    "key" VARCHAR(40) NOT NULL,
    "accountId" UUID NOT NULL,
    "updatedBy" VARCHAR(150),
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "posting_accounts_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "journal_vouchers_sourceType_sourceId_key" ON "journal_vouchers"("sourceType", "sourceId");

-- AddForeignKey
ALTER TABLE "posting_accounts" ADD CONSTRAINT "posting_accounts_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

