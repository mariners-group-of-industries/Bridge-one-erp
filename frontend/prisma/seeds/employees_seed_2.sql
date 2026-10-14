-- New offices (same business unit as Dhaka Head Office)
INSERT INTO "offices" ("id", "businessUnitId", "name", "address", "createdAt", "updatedAt")
SELECT
  'cccccccc-0001-0001-0001-000000000001',
  "businessUnitId",
  'MGV-PLC',
  'N/A',
  NOW(), NOW()
FROM "offices" WHERE "id" = '0ef53eb4-ccb4-452a-be2b-13e3c2d8e3df'
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "offices" ("id", "businessUnitId", "name", "address", "createdAt", "updatedAt")
SELECT
  'cccccccc-0002-0002-0002-000000000002',
  "businessUnitId",
  'MBBL-HO',
  'N/A',
  NOW(), NOW()
FROM "offices" WHERE "id" = '0ef53eb4-ccb4-452a-be2b-13e3c2d8e3df'
ON CONFLICT ("id") DO NOTHING;

-- New user: Md. Usuf Ali
INSERT INTO "users" ("id", "name", "phone", "passwordHash", "role", "isActive", "createdAt", "updatedAt")
VALUES (
  'aaaaaaaa-0002-0002-0002-000000000002',
  'Md. Usuf Ali',
  '00000000002',
  '$argon2id$v=19$m=65536,t=3,p=4$placeholder',
  'STAFF', true, NOW(), NOW()
)
ON CONFLICT ("phone") DO NOTHING;

-- 7 new employees
INSERT INTO "employees" (
  "id", "officeId", "employeeCode", "attendanceId", "name",
  "designation", "department", "employeeType",
  "joiningDate", "terminationDate",
  "userId", "isActive", "updatedById",
  "createdAt", "updatedAt"
) VALUES
-- 4: 30573
(
  'bbbbbbbb-0004-0004-0004-000000000004',
  '0ef53eb4-ccb4-452a-be2b-13e3c2d8e3df',
  '30573', '100120572',
  'SR-Jhenaidah+Magura - Md. Shajib Hossain',
  'SR', 'Khulna Region', 'User',
  '2026-10-07', NULL,
  NULL, true,
  'aaaaaaaa-0001-0001-0001-000000000001',
  '2026-10-11 04:33:00+00', '2026-10-11 04:33:00+00'
),
-- 5: 10003
(
  'bbbbbbbb-0005-0005-0005-000000000005',
  'cccccccc-0001-0001-0001-000000000001',
  '10003', '100120571',
  'Md. Roni Mridha',
  'Executive', 'Accounts & Finance', 'User',
  '2026-06-01', NULL,
  NULL, true, NULL,
  NOW(), NOW()
),
-- 6: 10065
(
  'bbbbbbbb-0006-0006-0006-000000000006',
  'cccccccc-0002-0002-0002-000000000002',
  '10065', '100120570',
  'Sakil Hossen',
  'Officer', 'MIS & Sales Admin', 'User',
  '2026-10-01', NULL,
  NULL, true,
  'aaaaaaaa-0001-0001-0001-000000000001',
  '2026-10-08 03:08:00+00', '2026-10-08 03:08:00+00'
),
-- 7: 30572
(
  'bbbbbbbb-0007-0007-0007-000000000007',
  '0ef53eb4-ccb4-452a-be2b-13e3c2d8e3df',
  '30572', '100120569',
  'SR-Tangail+Ghatail- Md. Habib',
  'SR', 'Tangail Region', 'User',
  '2026-10-04', NULL,
  NULL, true, NULL,
  NOW(), NOW()
),
-- 8: 30571
(
  'bbbbbbbb-0008-0008-0008-000000000008',
  '0ef53eb4-ccb4-452a-be2b-13e3c2d8e3df',
  '30571', '100120568',
  'SR-Patuakhali+Barguna- Md. Mahmud Pias',
  'SR', 'Barishal Region', 'User',
  '2026-10-04', NULL,
  NULL, true,
  'aaaaaaaa-0001-0001-0001-000000000001',
  '2026-10-06 10:41:00+00', '2026-10-06 10:41:00+00'
),
-- 9: 10064
(
  'bbbbbbbb-0009-0009-0009-000000000009',
  'cccccccc-0001-0001-0001-000000000001',
  '10064', '100120567',
  'Md. Jakaria',
  'Jr. Developer-(officer)', NULL, 'Employee',
  '2026-10-04', NULL,
  NULL, true, NULL,
  NOW(), NOW()
),
-- 10: 10063
(
  'bbbbbbbb-0010-0010-0010-000000000010',
  'cccccccc-0001-0001-0001-000000000001',
  '10063', '100120566',
  'Arif Arman',
  'Jr. Developer-(officer)', NULL, 'Employee',
  '2026-09-28', NULL,
  NULL, true,
  'aaaaaaaa-0002-0002-0002-000000000002',
  '2026-10-12 04:22:00+00', '2026-10-12 04:22:00+00'
)
ON CONFLICT ("id") DO NOTHING;
