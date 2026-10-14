-- Ensure MGV-PLC and MBBL-HO offices exist.
-- Uses businessUnitId from Dhaka Head Office if present, else first available BU.
DO $$
DECLARE
  v_bu_id UUID;
BEGIN
  SELECT "businessUnitId" INTO v_bu_id
  FROM "offices"
  WHERE "id" = '0ef53eb4-ccb4-452a-be2b-13e3c2d8e3df'
  LIMIT 1;

  IF v_bu_id IS NULL THEN
    SELECT "id" INTO v_bu_id FROM "business_units" ORDER BY "createdAt" LIMIT 1;
  END IF;

  IF v_bu_id IS NOT NULL THEN
    INSERT INTO "offices" ("id", "businessUnitId", "name", "address", "createdAt", "updatedAt")
    VALUES ('cccccccc-0001-0001-0001-000000000001', v_bu_id, 'MGV-PLC', 'N/A', NOW(), NOW())
    ON CONFLICT ("id") DO NOTHING;

    INSERT INTO "offices" ("id", "businessUnitId", "name", "address", "createdAt", "updatedAt")
    VALUES ('cccccccc-0002-0002-0002-000000000002', v_bu_id, 'MBBL-HO', 'N/A', NOW(), NOW())
    ON CONFLICT ("id") DO NOTHING;
  END IF;
END $$;
