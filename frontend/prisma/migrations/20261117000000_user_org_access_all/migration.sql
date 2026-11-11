-- User Permission "All": the user gets every business unit / office / warehouse, including ones created later.
ALTER TABLE "users" ADD COLUMN "allBusinessUnits" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN "allOffices" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN "allWarehouses" BOOLEAN NOT NULL DEFAULT false;
