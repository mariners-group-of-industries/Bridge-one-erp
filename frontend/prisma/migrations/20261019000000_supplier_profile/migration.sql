-- Supplier Profile (Configuration › Entity Master Data): extends the purchase
-- "suppliers" table and adds groups, districts, thanas, tax brackets,
-- the supplier-details list and attachments.

-- AlterTable
ALTER TABLE "suppliers" ADD COLUMN     "billingContactNo" VARCHAR(30),
ADD COLUMN     "binNumber" VARCHAR(30),
ADD COLUMN     "creditDays" INTEGER,
ADD COLUMN     "districtId" INTEGER,
ADD COLUMN     "groupId" UUID,
ADD COLUMN     "isForeign" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isMonthly" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isUser" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "officeId" UUID,
ADD COLUMN     "remarks" VARCHAR(1000),
ADD COLUMN     "subGroupId" UUID,
ADD COLUMN     "taxBracketId" UUID,
ADD COLUMN     "tcsPercent" DECIMAL(5,2),
ADD COLUMN     "thanaId" UUID,
ADD COLUMN     "tinNumber" VARCHAR(50),
ADD COLUMN     "tolerancePercent" DECIMAL(5,2),
ADD COLUMN     "tradeLicenseNo" VARCHAR(50),
ADD COLUMN     "vatAccountingNotApplicable" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "vatRegistrationNo" VARCHAR(50),
ADD COLUMN     "vdsApplicable" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "supplier_groups" (
    "id" UUID NOT NULL,
    "businessUnitId" UUID NOT NULL,
    "parentId" UUID,
    "name" VARCHAR(100) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supplier_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "districts" (
    "id" INTEGER NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "division" VARCHAR(30) NOT NULL,

    CONSTRAINT "districts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "thanas" (
    "id" UUID NOT NULL,
    "districtId" INTEGER NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "thanas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tax_brackets" (
    "id" UUID NOT NULL,
    "businessUnitId" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "ratePercent" DECIMAL(5,2),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tax_brackets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_details" (
    "id" UUID NOT NULL,
    "supplierId" UUID NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "code" VARCHAR(30),
    "vendorName" VARCHAR(150),
    "address" VARCHAR(500) NOT NULL,
    "gps" VARCHAR(100),
    "contactPerson" VARCHAR(150),
    "contactNumber" VARCHAR(30),
    "vatRegNo" VARCHAR(50),

    CONSTRAINT "supplier_details_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_attachments" (
    "id" UUID NOT NULL,
    "supplierId" UUID NOT NULL,
    "storageKey" VARCHAR(300) NOT NULL,
    "originalName" VARCHAR(255) NOT NULL,
    "mimeType" VARCHAR(100) NOT NULL,
    "size" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supplier_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "supplier_groups_businessUnitId_parentId_name_key" ON "supplier_groups"("businessUnitId", "parentId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "districts_name_key" ON "districts"("name");

-- CreateIndex
CREATE UNIQUE INDEX "thanas_districtId_name_key" ON "thanas"("districtId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "tax_brackets_businessUnitId_name_key" ON "tax_brackets"("businessUnitId", "name");

-- CreateIndex
CREATE INDEX "supplier_details_supplierId_idx" ON "supplier_details"("supplierId");

-- CreateIndex
CREATE UNIQUE INDEX "supplier_attachments_storageKey_key" ON "supplier_attachments"("storageKey");

-- CreateIndex
CREATE INDEX "supplier_attachments_supplierId_idx" ON "supplier_attachments"("supplierId");

-- CreateIndex
CREATE INDEX "suppliers_officeId_idx" ON "suppliers"("officeId");

-- AddForeignKey
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_officeId_fkey" FOREIGN KEY ("officeId") REFERENCES "offices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "supplier_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_subGroupId_fkey" FOREIGN KEY ("subGroupId") REFERENCES "supplier_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_districtId_fkey" FOREIGN KEY ("districtId") REFERENCES "districts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_thanaId_fkey" FOREIGN KEY ("thanaId") REFERENCES "thanas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_taxBracketId_fkey" FOREIGN KEY ("taxBracketId") REFERENCES "tax_brackets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_groups" ADD CONSTRAINT "supplier_groups_businessUnitId_fkey" FOREIGN KEY ("businessUnitId") REFERENCES "business_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_groups" ADD CONSTRAINT "supplier_groups_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "supplier_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "thanas" ADD CONSTRAINT "thanas_districtId_fkey" FOREIGN KEY ("districtId") REFERENCES "districts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tax_brackets" ADD CONSTRAINT "tax_brackets_businessUnitId_fkey" FOREIGN KEY ("businessUnitId") REFERENCES "business_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_details" ADD CONSTRAINT "supplier_details_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_attachments" ADD CONSTRAINT "supplier_attachments_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Seed: the 64 districts of Bangladesh, by division.
INSERT INTO "districts" ("id", "name", "division") VALUES
  (1, 'Dhaka', 'Dhaka'), (2, 'Faridpur', 'Dhaka'), (3, 'Gazipur', 'Dhaka'), (4, 'Gopalganj', 'Dhaka'),
  (5, 'Kishoreganj', 'Dhaka'), (6, 'Madaripur', 'Dhaka'), (7, 'Manikganj', 'Dhaka'), (8, 'Munshiganj', 'Dhaka'),
  (9, 'Narayanganj', 'Dhaka'), (10, 'Narsingdi', 'Dhaka'), (11, 'Rajbari', 'Dhaka'), (12, 'Shariatpur', 'Dhaka'),
  (13, 'Tangail', 'Dhaka'),
  (14, 'Bandarban', 'Chattogram'), (15, 'Brahmanbaria', 'Chattogram'), (16, 'Chandpur', 'Chattogram'),
  (17, 'Chattogram', 'Chattogram'), (18, 'Cox''s Bazar', 'Chattogram'), (19, 'Cumilla', 'Chattogram'),
  (20, 'Feni', 'Chattogram'), (21, 'Khagrachhari', 'Chattogram'), (22, 'Lakshmipur', 'Chattogram'),
  (23, 'Noakhali', 'Chattogram'), (24, 'Rangamati', 'Chattogram'),
  (25, 'Bogura', 'Rajshahi'), (26, 'Chapainawabganj', 'Rajshahi'), (27, 'Joypurhat', 'Rajshahi'),
  (28, 'Naogaon', 'Rajshahi'), (29, 'Natore', 'Rajshahi'), (30, 'Pabna', 'Rajshahi'), (31, 'Rajshahi', 'Rajshahi'),
  (32, 'Sirajganj', 'Rajshahi'),
  (33, 'Bagerhat', 'Khulna'), (34, 'Chuadanga', 'Khulna'), (35, 'Jashore', 'Khulna'), (36, 'Jhenaidah', 'Khulna'),
  (37, 'Khulna', 'Khulna'), (38, 'Kushtia', 'Khulna'), (39, 'Magura', 'Khulna'), (40, 'Meherpur', 'Khulna'),
  (41, 'Narail', 'Khulna'), (42, 'Satkhira', 'Khulna'),
  (43, 'Barguna', 'Barishal'), (44, 'Barishal', 'Barishal'), (45, 'Bhola', 'Barishal'), (46, 'Jhalokathi', 'Barishal'),
  (47, 'Patuakhali', 'Barishal'), (48, 'Pirojpur', 'Barishal'),
  (49, 'Habiganj', 'Sylhet'), (50, 'Moulvibazar', 'Sylhet'), (51, 'Sunamganj', 'Sylhet'), (52, 'Sylhet', 'Sylhet'),
  (53, 'Dinajpur', 'Rangpur'), (54, 'Gaibandha', 'Rangpur'), (55, 'Kurigram', 'Rangpur'), (56, 'Lalmonirhat', 'Rangpur'),
  (57, 'Nilphamari', 'Rangpur'), (58, 'Panchagarh', 'Rangpur'), (59, 'Rangpur', 'Rangpur'), (60, 'Thakurgaon', 'Rangpur'),
  (61, 'Jamalpur', 'Mymensingh'), (62, 'Mymensingh', 'Mymensingh'), (63, 'Netrokona', 'Mymensingh'),
  (64, 'Sherpur', 'Mymensingh');
