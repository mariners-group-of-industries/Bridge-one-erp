-- Sales order: Custom Offer (the one offer applied) and file attachments.
ALTER TABLE "sales_orders" ADD COLUMN "offerId" UUID;

ALTER TABLE "sales_orders" ADD CONSTRAINT "sales_orders_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "sales_offers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "sales_order_attachments" (
    "id" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "storageKey" VARCHAR(300) NOT NULL,
    "originalName" VARCHAR(255) NOT NULL,
    "mimeType" VARCHAR(100) NOT NULL,
    "size" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sales_order_attachments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "sales_order_attachments_storageKey_key" ON "sales_order_attachments"("storageKey");

CREATE INDEX "sales_order_attachments_orderId_idx" ON "sales_order_attachments"("orderId");

ALTER TABLE "sales_order_attachments" ADD CONSTRAINT "sales_order_attachments_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "sales_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
