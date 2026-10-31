-- Files attached to a sales collection (Advance Collection voucher).
CREATE TABLE "sales_collection_attachments" (
    "id" UUID NOT NULL,
    "collectionId" UUID NOT NULL,
    "storageKey" VARCHAR(300) NOT NULL,
    "originalName" VARCHAR(255) NOT NULL,
    "mimeType" VARCHAR(100) NOT NULL,
    "size" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sales_collection_attachments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "sales_collection_attachments_storageKey_key" ON "sales_collection_attachments"("storageKey");

CREATE INDEX "sales_collection_attachments_collectionId_idx" ON "sales_collection_attachments"("collectionId");

ALTER TABLE "sales_collection_attachments" ADD CONSTRAINT "sales_collection_attachments_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "sales_collections"("id") ON DELETE CASCADE ON UPDATE CASCADE;
