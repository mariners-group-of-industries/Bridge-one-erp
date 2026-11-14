-- Purchase documents keep what the forms already collect (additive, nullable).
ALTER TABLE "purchase_orders" ADD COLUMN "paymentTerms" VARCHAR(100),
  ADD COLUMN "deliveryTerms" VARCHAR(100);

ALTER TABLE "goods_receipts" ADD COLUMN "supplierInvoiceNumber" VARCHAR(100),
  ADD COLUMN "vatChallanNumber" VARCHAR(100);

ALTER TABLE "purchase_returns" ADD COLUMN "createdBy" VARCHAR(150);
