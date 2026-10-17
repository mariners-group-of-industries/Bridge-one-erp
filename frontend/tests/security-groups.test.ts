import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma/client", async () => {
  const { testPrisma } = await import("./helpers/test-db");
  return { db: testPrisma };
});
import { createBusinessUnit } from "@/features/configuration/business-config/company-profile/server/business-unit.service";
import { saveCompany } from "@/features/configuration/business-config/company-profile/server/company.service";
import { createOffice } from "@/features/configuration/business-config/company-profile/server/office.service";
import { permissionActivities } from "@/features/configuration/security/groups/activities";
import {
  deletePermissionGroup,
  deleteUserGroup,
  getPermissionGroup,
  getUserGroup,
  listPermissionGroups,
  listUserGroups,
  savePermissionGroup,
  saveUserGroup,
  userOptions,
} from "@/features/configuration/security/groups/server/groups.service";
import { securityPaths } from "@/features/configuration/security/paths";
import { AppError } from "@/lib/api/errors";
import { adminActor, businessUnitInput, companyInput, officeInput } from "./helpers/fixtures";
import { resetTestDb, startTestDb, stopTestDb, testPrisma } from "./helpers/test-db";

let aliId: string;
let rinaId: string;

beforeAll(async () => {
  await startTestDb();
});
afterAll(async () => {
  await stopTestDb();
});
beforeEach(async () => {
  await resetTestDb();
  await saveCompany(adminActor, companyInput);
  const unitId = (await createBusinessUnit(adminActor, businessUnitInput)).id;
  const officeId = (await createOffice(adminActor, unitId, officeInput)).id;
  aliId = (await testPrisma().user.create({ data: { name: "Ali", phone: "01700000011", passwordHash: "x" } })).id;
  rinaId = (await testPrisma().user.create({ data: { name: "Rina", phone: "01700000012", passwordHash: "x" } })).id;
  await testPrisma().employee.create({ data: { officeId, employeeCode: "E-77", name: "Ali", joiningDate: new Date("2024-01-01"), userId: aliId } });
});

describe("user group", () => {
  it("saves users with their employee code and lists the last action", async () => {
    expect((await userOptions(adminActor)).find((u) => u.id === aliId)).toEqual({ id: aliId, name: "Ali", employeeCode: "E-77" });
    const group = await saveUserGroup(adminActor, { name: "Approvers", userIds: [rinaId, aliId] });
    expect(group.members.map((m) => [m.name, m.employeeCode])).toEqual([
      ["Rina", null],
      ["Ali", "E-77"],
    ]);
    const updated = await saveUserGroup(adminActor, { name: "Approvers", userIds: [aliId] }, group.id);
    expect(updated.members).toHaveLength(1);
    expect((await listUserGroups(adminActor, { search: "appr" })).rows).toEqual([expect.objectContaining({ name: "Approvers", count: 1, lastActionBy: "Administrator" })]);
  });

  it("rejects empty, duplicate and unknown users and duplicate names", async () => {
    await expect(saveUserGroup(adminActor, { name: "G", userIds: [] })).rejects.toThrow();
    await expect(saveUserGroup(adminActor, { name: "G", userIds: [aliId, aliId] })).rejects.toThrow();
    await testPrisma().user.update({ where: { id: rinaId }, data: { isActive: false } });
    await expect(saveUserGroup(adminActor, { name: "G", userIds: [rinaId] })).rejects.toBeInstanceOf(AppError);
    await saveUserGroup(adminActor, { name: "G", userIds: [aliId] });
    await expect(saveUserGroup(adminActor, { name: "G", userIds: [aliId] })).rejects.toBeInstanceOf(AppError);
    const { id } = (await listUserGroups(adminActor, {})).rows[0];
    await deleteUserGroup(adminActor, id);
    await expect(getUserGroup(adminActor, id)).rejects.toBeInstanceOf(AppError);
  });
});

describe("permission group", () => {
  it("lists every built page once as an activity", () => {
    const activities = permissionActivities();
    expect(activities).toEqual(expect.arrayContaining([{ key: securityPaths.approvalSetup, moduleName: "Configuration", activityName: "Approval Setup" }]));
    expect(new Set(activities.map((a) => a.key)).size).toBe(activities.length);
  });

  it("stores only granted rows and refuses unknown activities", async () => {
    const group = await savePermissionGroup(adminActor, {
      name: "Sales Admin",
      entries: [{ activityKey: securityPaths.approvalSetup, canView: true, canApprove: true }, { activityKey: securityPaths.userGroup }],
    });
    expect(group.entries).toEqual([{ activityKey: securityPaths.approvalSetup, canCreate: false, canEdit: false, canView: true, canDelete: false, canApprove: true }]);
    expect((await listPermissionGroups(adminActor, {})).rows[0]).toMatchObject({ name: "Sales Admin", count: 1, lastActionBy: "Administrator" });
    await expect(savePermissionGroup(adminActor, { name: "X", entries: [{ activityKey: "/nope", canView: true }] })).rejects.toBeInstanceOf(AppError);

    const updated = await savePermissionGroup(adminActor, { name: "Sales Admin", entries: [{ activityKey: securityPaths.userGroup, canCreate: true }] }, group.id);
    expect(updated.entries.map((e) => e.activityKey)).toEqual([securityPaths.userGroup]);
    await deletePermissionGroup(adminActor, group.id);
    await expect(getPermissionGroup(adminActor, group.id)).rejects.toBeInstanceOf(AppError);
  });
});
