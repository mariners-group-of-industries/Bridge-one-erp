-- Customer Profile (Configuration / Entity Master Data): extends the sales
-- "customers", "customer_groups" (sub groups) and "customer_addresses" (shipping
-- details) tables and adds customer attachments. Additive only.

-- AlterTable
ALTER TABLE "customers" ADD COLUMN     "availableBalanceCheck" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "billingContactNo" VARCHAR(30),
ADD COLUMN     "billingName" VARCHAR(150),
ADD COLUMN     "birthDate" DATE,
ADD COLUMN     "creditLimitAllOutlets" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "districtId" INTEGER,
ADD COLUMN     "gender" VARCHAR(20),
ADD COLUMN     "isAnonymous" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isDistributor" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isEmployeeCustomer" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isForeign" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isMonthly" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isUser" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "maritalStatus" VARCHAR(20),
ADD COLUMN     "marriageDate" DATE,
ADD COLUMN     "nidNumber" VARCHAR(30),
ADD COLUMN     "officeId" UUID,
ADD COLUMN     "onlyBusinessUnitWise" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "priceListId" UUID,
ADD COLUMN     "remarks" VARCHAR(1000),
ADD COLUMN     "subGroupId" UUID,
ADD COLUMN     "taxBracketId" UUID,
ADD COLUMN     "tcsPercent" DECIMAL(5,2),
ADD COLUMN     "thanaId" UUID,
ADD COLUMN     "tinNumber" VARCHAR(50),
ADD COLUMN     "tolerancePercent" DECIMAL(5,2),
ADD COLUMN     "tradeLicenseNo" VARCHAR(50),
ADD COLUMN     "vatAccountingNotApplicable" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "vatRegistrationNo" VARCHAR(50);

-- AlterTable
ALTER TABLE "customer_groups" ADD COLUMN     "parentId" UUID;

-- AlterTable
ALTER TABLE "customer_addresses" ADD COLUMN     "code" VARCHAR(30),
ADD COLUMN     "contactNo" VARCHAR(30),
ADD COLUMN     "contactPerson" VARCHAR(150),
ADD COLUMN     "districtId" INTEGER,
ADD COLUMN     "gps" VARCHAR(100),
ADD COLUMN     "sectionId" UUID,
ADD COLUMN     "sortOrder" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "thanaId" UUID,
ADD COLUMN     "vatRegNo" VARCHAR(50);

-- CreateTable
CREATE TABLE "customer_attachments" (
    "id" UUID NOT NULL,
    "customerId" UUID NOT NULL,
    "storageKey" VARCHAR(300) NOT NULL,
    "originalName" VARCHAR(255) NOT NULL,
    "mimeType" VARCHAR(100) NOT NULL,
    "size" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "customer_attachments_storageKey_key" ON "customer_attachments"("storageKey");

-- CreateIndex
CREATE INDEX "customer_attachments_customerId_idx" ON "customer_attachments"("customerId");

-- CreateIndex
CREATE INDEX "customers_officeId_idx" ON "customers"("officeId");

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_officeId_fkey" FOREIGN KEY ("officeId") REFERENCES "offices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_subGroupId_fkey" FOREIGN KEY ("subGroupId") REFERENCES "customer_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_priceListId_fkey" FOREIGN KEY ("priceListId") REFERENCES "price_lists"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_districtId_fkey" FOREIGN KEY ("districtId") REFERENCES "districts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_thanaId_fkey" FOREIGN KEY ("thanaId") REFERENCES "thanas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_taxBracketId_fkey" FOREIGN KEY ("taxBracketId") REFERENCES "tax_brackets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_groups" ADD CONSTRAINT "customer_groups_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "customer_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_addresses" ADD CONSTRAINT "customer_addresses_districtId_fkey" FOREIGN KEY ("districtId") REFERENCES "districts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_addresses" ADD CONSTRAINT "customer_addresses_thanaId_fkey" FOREIGN KEY ("thanaId") REFERENCES "thanas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_addresses" ADD CONSTRAINT "customer_addresses_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "sales_areas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_attachments" ADD CONSTRAINT "customer_attachments_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

