-- Goods receipts and purchase returns post to the stock ledger.
ALTER TYPE "StockSource" ADD VALUE IF NOT EXISTS 'PURCHASE_RECEIPT';
ALTER TYPE "StockSource" ADD VALUE IF NOT EXISTS 'PURCHASE_RETURN';
