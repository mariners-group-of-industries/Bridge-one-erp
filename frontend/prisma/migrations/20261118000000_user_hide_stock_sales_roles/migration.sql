-- ERP Login "Hide Stock In Sales": the user does not see stock levels in the Sales module.
ALTER TABLE "users" ADD COLUMN "hideStockInSales" BOOLEAN NOT NULL DEFAULT false;

-- Standard sales roles for the ERP Login "User Role" list.
INSERT INTO "roles" ("id", "name", "description", "createdAt", "updatedAt") VALUES
  (gen_random_uuid(), 'RSM', 'Regional Sales Manager', now(), now()),
  (gen_random_uuid(), 'MIS & Sales Admin', 'MIS and sales administration', now(), now()),
  (gen_random_uuid(), 'TSM', 'Territory Sales Manager', now(), now())
ON CONFLICT ("name") DO NOTHING;
