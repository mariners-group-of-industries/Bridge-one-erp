-- Item (Multiple) offers: several pairs, each with its own selling condition and bonus items;
-- a selling condition may cover every item of a category ("All").
ALTER TABLE "sales_offer_pair_lines" ADD COLUMN "pairNo" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "sales_offer_pair_lines" ALTER COLUMN "itemId" DROP NOT NULL;
ALTER TABLE "sales_offer_bonus_lines" ADD COLUMN "pairNo" INTEGER NOT NULL DEFAULT 1;
