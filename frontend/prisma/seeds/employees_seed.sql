-- Seed: Sabbir Sharon user (updatedById for employee 30574)
INSERT INTO "users" ("id", "name", "phone", "passwordHash", "role", "isActive", "createdAt", "updatedAt")
VALUES (
  'aaaaaaaa-0001-0001-0001-000000000001',
  'Sabbir Sharon',
  '00000000001',
  '$argon2id$v=19$m=65536,t=3,p=4$placeholder',
  'STAFF',
  true,
  NOW(),
  NOW()
)
ON CONFLICT ("phone") DO NOTHING;

-- Seed: 3 employees
INSERT INTO "employees" (
  "id", "officeId", "employeeCode", "attendanceId", "name",
  "designation", "department", "employeeType",
  "joiningDate", "terminationDate",
  "userId", "isActive", "updatedById",
  "createdAt", "updatedAt"
) VALUES
(
  'bbbbbbbb-0001-0001-0001-000000000001',
  '0ef53eb4-ccb4-452a-be2b-13e3c2d8e3df',
  '30576', '100120575',
  'SR-Narayangonj+Narshindi- Sameer Chandra Ghosh',
  'SR', 'Mymensingh Region', 'User',
  '2026-10-07', NULL,
  NULL, true, NULL,
  NOW(), NOW()
),
(
  'bbbbbbbb-0002-0002-0002-000000000002',
  '0ef53eb4-ccb4-452a-be2b-13e3c2d8e3df',
  '30575', '100120574',
  'SR-Narayangonj+Narshindi- Shahriar Kamal',
  'SR', 'Mymensingh Region', 'User',
  '2026-10-07', NULL,
  NULL, true, NULL,
  NOW(), NOW()
),
(
  'bbbbbbbb-0003-0003-0003-000000000003',
  '0ef53eb4-ccb4-452a-be2b-13e3c2d8e3df',
  '30574', '100120573',
  'SR-Kishoreganj +B.Baria-Md. Yeasin',
  'SR', 'Mymensingh Region', 'User',
  '2026-10-11', NULL,
  NULL, true,
  'aaaaaaaa-0001-0001-0001-000000000001',
  '2026-10-11 04:46:00+00', '2026-10-11 04:46:00+00'
)
ON CONFLICT ("id") DO NOTHING;
