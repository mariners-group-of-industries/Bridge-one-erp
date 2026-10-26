-- Sales Quotation in the Managerium layout: billing / reference header, rich-text remarks, a terms list,
-- per-line discount / VAT / AIT, warranty and delivery date. VAT moves from the header to the lines.
-- sales_quotations was empty when this was written.

ALTER TABLE "sales_quotations" DROP CONSTRAINT IF EXISTS "sales_quotations_amounts_check";

-- AlterTable
ALTER TABLE "sales_quotations" DROP COLUMN "remarks",
DROP COLUMN "terms",
DROP COLUMN "vatPercent",
ADD COLUMN     "aitAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
ADD COLUMN     "approvedBy" VARCHAR(100),
ADD COLUMN     "billingAddress" VARCHAR(500),
ADD COLUMN     "billingContactNo" VARCHAR(30),
ADD COLUMN     "billingContactPerson" VARCHAR(150),
ADD COLUMN     "includingVat" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "quotationType" VARCHAR(30) NOT NULL DEFAULT 'Quotation',
ADD COLUMN     "reference" VARCHAR(150),
ADD COLUMN     "remarksBody" JSONB,
ADD COLUMN     "remarksFooter" JSONB,
ADD COLUMN     "subject" VARCHAR(300),
ADD COLUMN     "termsList" JSONB;

-- AlterTable
ALTER TABLE "sales_quotation_lines" ADD COLUMN     "aitAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
ADD COLUMN     "aitPercent" DECIMAL(5,2) NOT NULL DEFAULT 0,
ADD COLUMN     "deliveryDate" DATE,
ADD COLUMN     "discountAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
ADD COLUMN     "vatAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
ADD COLUMN     "vatPercent" DECIMAL(5,2) NOT NULL DEFAULT 0,
ADD COLUMN     "warranty" VARCHAR(100);


-- Hand-written checks
ALTER TABLE "sales_quotations" ADD CONSTRAINT "sales_quotations_amounts_check" CHECK (
  "totalQty" >= 0 AND "subTotal" >= 0 AND "discountAmount" >= 0 AND "discountAmount" <= "subTotal"
  AND "vatAmount" >= 0 AND "aitAmount" >= 0 AND "grandTotal" >= 0
);
ALTER TABLE "sales_quotation_lines" ADD CONSTRAINT "sales_quotation_lines_tax_check" CHECK (
  "discountAmount" >= 0 AND "vatPercent" BETWEEN 0 AND 100 AND "vatAmount" >= 0
  AND "aitPercent" BETWEEN 0 AND 100 AND "aitAmount" >= 0
);
