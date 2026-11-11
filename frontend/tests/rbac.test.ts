import * as argon2 from "argon2";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma/client", async () => {
  const { testPrisma } = await import("./helpers/test-db");
  return { db: testPrisma };
});
// The session cookie is a stand-in "token" naming the session's jti; the real signing is covered elsewhere.
let cookie: string | undefined;
vi.mock("@/lib/auth/cookies", () => ({ getAuthCookie: async () => cookie, setAuthCookie: async () => undefined, clearAuthCookie: async () => undefined }));
vi.mock("@/lib/auth/jwt", () => ({
  verifyToken: async (token: string) => {
    const [jti, sub] = token.split("|");
    return { jti, sub, name: "x", phone: "x", role: "STAFF", isMaster: false };
  },
  signToken: async (payload: { sub: string }) => ({ token: `login|${payload.sub}`, jti: `login-${payload.sub}-${Math.random()}`, expiresAt: new Date(Date.now() + 3_600_000) }),
}));

import { GET as meRoute } from "@/app/api/auth/me/route";
import { POST as loginRoute } from "@/app/api/auth/login/route";
import { GET as listOrdersRoute } from "@/app/api/sales/orders/route";
import { DELETE as deleteOrderRoute, GET as getOrderRoute } from "@/app/api/sales/orders/[orderId]/route";
import { PATCH as accessRoute } from "@/app/api/configuration/security/users/[userId]/access/route";
import {
  deletePermissionGroup,
  duplicatePermissionGroup,
  effectivePermissions,
  getPermissionGroup,
  getUserAccess,
  savePermissionGroup,
  setGroupUsers,
  updateUserAccess,
} from "@/features/configuration/security/access/server/access.service";
import { AppError } from "@/lib/api/errors";
import { requireActor, resolveActor, type Actor } from "@/lib/auth/actor";
import { actionForRequest, checkApiAccess, ruleForRequest } from "@/lib/permissions/api-rules";
import { featureForPath, grantsFromList, pathAllowed, permissionFeatures, PERMISSION_ADMIN_FEATURE } from "@/lib/permissions/registry";
import { resetTestDb, startTestDb, stopTestDb, testPrisma } from "./helpers/test-db";

const ORDERS = "/sales/orders";
const QUOTATIONS = "/sales/quotations";
const JOURNAL = "/accounts/journal";
const ORDER_ID = "00000000-0000-4000-8000-000000000001";

beforeAll(async () => {
  await startTestDb();
});
afterAll(async () => {
  await stopTestDb();
});
beforeEach(async () => {
  await resetTestDb();
  cookie = undefined;
});

let n = 0;
/** A user with an open session; returns its id and a function that signs in as it. */
async function user(options: { isMaster?: boolean; erpAccess?: boolean; status?: "ACTIVE" | "INACTIVE" | "SUSPENDED"; password?: string } = {}) {
  n += 1;
  const created = await testPrisma().user.create({
    data: {
      name: `User ${n}`,
      phone: `0170000${String(n).padStart(4, "0")}`,
      passwordHash: await argon2.hash(options.password ?? "Secret#123"),
      isMaster: options.isMaster ?? false,
      erpAccess: options.erpAccess ?? true,
      status: options.status ?? "ACTIVE",
    },
  });
  const jti = `jti-${n}`;
  await testPrisma().userSession.create({ data: { userId: created.id, jti, expiresAt: new Date(Date.now() + 3_600_000) } });
  return { id: created.id, phone: created.phone, signIn: () => (cookie = `${jti}|${created.id}`) };
}

const request = (method: string, path: string, body?: unknown) =>
  new Request(`http://localhost${path}`, { method, headers: { "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });

/** The signed-in actor (like a route handler sees it). */
async function current(): Promise<Actor> {
  const actor = await resolveActor(request("GET", "/api/auth/me"));
  if (!actor) throw new Error("not signed in");
  return actor;
}

/** Whether the signed-in user passes authorization for `method path` (401/403 as status). */
async function status(method: string, path: string): Promise<number> {
  try {
    await requireActor(request(method, path), "sales:read");
    return 200;
  } catch (error) {
    return error instanceof AppError ? error.status : 500;
  }
}

async function group(grants: Record<string, string[]>, extra: { status?: "ACTIVE" | "INACTIVE"; name?: string } = {}) {
  n += 1;
  return savePermissionGroup(MASTER, { name: extra.name ?? `Group ${n}`, code: `G${n}`, status: extra.status ?? "ACTIVE", grants: grants as never });
}

const MASTER: Actor = { id: "master", name: "Master", role: "ADMINISTRATOR", isMaster: true, permissions: new Set(), companyScope: "ALL" };

describe("permission registry and API rules", () => {
  it("builds features from the menus with stable keys and applicable actions", () => {
    const features = permissionFeatures();
    expect(new Set(features.map((f) => f.key)).size).toBe(features.length);
    expect(features.find((f) => f.key === ORDERS)).toMatchObject({ permKey: "sales.orders", moduleId: "sales", submodule: "Transactions" });
    expect(features.find((f) => f.key === "/sales/dashboard")?.actions).toEqual(["view", "export"]);
    expect(features.find((f) => f.key === PERMISSION_ADMIN_FEATURE)?.actions).toContain("manage");
  });

  it("derives the action from method and path", () => {
    expect(actionForRequest("GET", "/api/sales/orders")).toBe("view");
    expect(actionForRequest("POST", "/api/sales/orders")).toBe("create");
    expect(actionForRequest("PUT", "/api/sales/orders/1")).toBe("edit");
    expect(actionForRequest("DELETE", "/api/sales/orders/1")).toBe("delete");
    expect(actionForRequest("POST", "/api/hrm/bonus/1/approve")).toBe("approve");
    expect(actionForRequest("GET", "/api/sales/orders/export")).toBe("export");
    expect(actionForRequest("POST", "/api/configuration/entity-master-data/items/import")).toBe("import");
    expect(actionForRequest("POST", "/api/sales/orders/1/status")).toBe("edit");
  });

  it("maps API paths to pages, including renamed and nested routes", () => {
    expect(ruleForRequest("/api/sales/orders/1")).toEqual({ feature: ORDERS });
    expect(ruleForRequest("/api/configuration/entity-master-data/employees/1/credentials")).toMatchObject({ feature: PERMISSION_ADMIN_FEATURE, action: "manage" });
    expect(ruleForRequest("/api/configuration/entity-master-data/employees/1/personal")).toMatchObject({ feature: "/configuration/entity-master-data/employee" });
    expect(ruleForRequest("/api/v1/purchase/orders/7")).toMatchObject({ feature: "/purchase/orders" });
    expect(ruleForRequest("/api/nothing/here")).toBeUndefined();
    expect(checkApiAccess(grantsFromList([]), "GET", "/api/nothing/here").allowed).toBe(false);
  });

  it("guards page URLs: a page needs View, a module landing page any page of it, child records follow their page", () => {
    const grants = grantsFromList(["sales.orders.view"]);
    expect(featureForPath("/sales/orders/123")?.key).toBe(ORDERS);
    expect(pathAllowed(grants, "/sales/orders")).toBe(true);
    expect(pathAllowed(grants, "/sales/orders/123")).toBe(true);
    expect(pathAllowed(grants, "/sales")).toBe(true);
    expect(pathAllowed(grants, "/sales/quotations")).toBe(false);
    expect(pathAllowed(grants, "/accounts")).toBe(false);
    expect(pathAllowed(grants, "/hrm")).toBe(false);
    expect(pathAllowed(grants, "/")).toBe(true);
    expect(pathAllowed(grantsFromList(["*"]), "/accounts/journal")).toBe(true);
  });
});

describe("signing in and ERP access", () => {
  it("lets an ERP user with access sign in and refuses non-ERP, suspended and inactive accounts", async () => {
    const ok = await user({ password: "Secret#123" });
    const login = (phone: string) => loginRoute(request("POST", "/api/auth/login", { phone, password: "Secret#123" }) as never);
    expect((await login(ok.phone)).status).toBe(200);
    for (const options of [{ erpAccess: false }, { status: "SUSPENDED" as const }, { status: "INACTIVE" as const }]) {
      const blocked = await user(options);
      const response = await login(blocked.phone);
      expect(response.status).toBe(403);
      expect((await response.json()).error).toMatch(/not enabled|suspended|inactive/);
      blocked.signIn();
      expect((await meRoute(request("GET", "/api/auth/me"))).status).toBe(401);
    }
    // The master account can never be locked out by these flags.
    const master = await user({ isMaster: true, erpAccess: false });
    expect((await login(master.phone)).status).toBe(200);
  });

  it("denies everything by default: an ERP user without groups or overrides has no permissions", async () => {
    const alice = await user();
    alice.signIn();
    expect((await meRoute(request("GET", "/api/auth/me")).then((r) => r.json())).permissions).toEqual([]);
    expect(await status("GET", "/api/sales/orders")).toBe(403);
    expect(await status("GET", "/api/home/overview")).toBe(200);
  });
});

describe("groups, overrides and effective permissions", () => {
  it("inherits from groups, unites several groups and ignores inactive groups", async () => {
    const alice = await user();
    const orders = await group({ [ORDERS]: ["view"] });
    const journal = await group({ [JOURNAL]: ["view", "create"] });
    const inactive = await group({ [QUOTATIONS]: ["view"] }, { status: "INACTIVE" });
    await updateUserAccess(MASTER, alice.id, { erpAccess: true, status: "ACTIVE", groupIds: [orders.id, journal.id, inactive.id], overrides: [] });
    alice.signIn();
    expect(await status("GET", "/api/sales/orders")).toBe(200);
    expect(await status("POST", "/api/accounts/journal")).toBe(200);
    expect(await status("GET", "/api/sales/quotations")).toBe(403);
    expect(await status("POST", "/api/sales/orders")).toBe(403);
  });

  it("CRITICAL: View allowed but Delete denied blocks deletes through the API, whatever the payload", async () => {
    const alice = await user();
    const full = await group({ [ORDERS]: ["view", "create", "edit", "delete"] });
    await updateUserAccess(MASTER, alice.id, { erpAccess: true, status: "ACTIVE", groupIds: [full.id], overrides: [{ featureKey: ORDERS, action: "delete", effect: "DENY" }] });
    alice.signIn();
    const list = await listOrdersRoute(request("GET", "/api/sales/orders"), {});
    expect(list.status).toBe(200);
    const params = { params: Promise.resolve({ orderId: ORDER_ID }) };
    // Reading one order reaches the service (404: it does not exist); deleting stops at authorization.
    expect((await getOrderRoute(request("GET", `/api/sales/orders/${ORDER_ID}`), params)).status).toBe(404);
    const denied = await deleteOrderRoute(request("DELETE", `/api/sales/orders/${ORDER_ID}`, { isMaster: true, permissions: ["*"] }), params);
    expect(denied.status).toBe(403);
    expect(await denied.json()).toMatchObject({ error: { code: "FORBIDDEN", details: { required: { feature: ORDERS, action: "delete" } } } });
    const effective = await effectivePermissions(MASTER, alice.id);
    expect(effective.permissions.find((p) => p.featureKey === ORDERS && p.action === "delete")).toMatchObject({ granted: false, source: "deny" });
    expect(effective.permissions.find((p) => p.featureKey === ORDERS && p.action === "view")).toMatchObject({ granted: true, source: "group" });
  });

  it("applies individual Allow over no group, and group changes reach members on their next request", async () => {
    const alice = await user();
    const g = await group({ [ORDERS]: ["view"] });
    await updateUserAccess(MASTER, alice.id, { erpAccess: true, status: "ACTIVE", groupIds: [g.id], overrides: [{ featureKey: JOURNAL, action: "view", effect: "ALLOW" }] });
    alice.signIn();
    expect(await status("GET", "/api/accounts/journal")).toBe(200);
    expect(await status("GET", "/api/sales/quotations")).toBe(403);
    await savePermissionGroup(MASTER, { name: g.name, code: g.code, grants: { [ORDERS]: ["view"], [QUOTATIONS]: ["view"] } }, g.id);
    expect(await status("GET", "/api/sales/quotations")).toBe(200);
    await savePermissionGroup(MASTER, { name: g.name, code: g.code, status: "INACTIVE", grants: { [QUOTATIONS]: ["view"] } }, g.id);
    expect(await status("GET", "/api/sales/quotations")).toBe(403);
  });

  it("revokes access of a signed-in user at once (sessions end, the next request is refused)", async () => {
    const alice = await user();
    const g = await group({ [ORDERS]: ["view"] });
    await updateUserAccess(MASTER, alice.id, { erpAccess: true, status: "ACTIVE", groupIds: [g.id], overrides: [] });
    alice.signIn();
    expect(await status("GET", "/api/sales/orders")).toBe(200);
    await updateUserAccess(MASTER, alice.id, { erpAccess: false, status: "ACTIVE", groupIds: [g.id], overrides: [] });
    expect(await status("GET", "/api/sales/orders")).toBe(401);
    expect(await testPrisma().userSession.count({ where: { userId: alice.id } })).toBe(0);
  });

  it("saves and reloads the group matrix, refuses unknown pages and actions that do not apply, copies and deletes groups", async () => {
    const g = await group({ [ORDERS]: ["view", "approve"], [JOURNAL]: [] });
    expect((await getPermissionGroup(MASTER, g.id)).grants).toEqual({ [ORDERS]: ["view", "approve"] });
    await expect(group({ "/nope": ["view"] })).rejects.toThrow(/Unknown page/);
    await expect(group({ "/sales/dashboard": ["delete"] })).rejects.toThrow(/does not apply/);
    const copy = await duplicatePermissionGroup(MASTER, g.id);
    expect(copy).toMatchObject({ name: `${g.name} (Copy)`, code: `${g.code}_COPY`, status: "INACTIVE", grants: { [ORDERS]: ["view", "approve"] } });
    const alice = await user();
    await setGroupUsers(MASTER, g.id, { userIds: [alice.id] });
    await expect(deletePermissionGroup(MASTER, g.id)).rejects.toThrow(/assigned to 1 user/);
    await deletePermissionGroup(MASTER, copy.id);
  });

  it("leaves out stored permissions of pages removed from the menus, so saving the access as loaded still works", async () => {
    const REMOVED = "/connect/retired-page";
    const g = await group({ [ORDERS]: ["view"] });
    await testPrisma().permissionGroupEntry.create({ data: { groupId: g.id, activityKey: REMOVED, moduleName: "Old", activityName: "Old", canView: true } });
    const alice = await user();
    await updateUserAccess(MASTER, alice.id, { erpAccess: true, status: "ACTIVE", groupIds: [g.id], overrides: [{ featureKey: ORDERS, action: "create", effect: "ALLOW" }] });
    await testPrisma().userPermissionOverride.create({ data: { userId: alice.id, activityKey: REMOVED, action: "view", effect: "ALLOW" } });

    expect((await getPermissionGroup(MASTER, g.id)).grants).toEqual({ [ORDERS]: ["view"] });
    const loaded = await getUserAccess(MASTER, alice.id);
    expect(loaded.overrides).toEqual([{ featureKey: ORDERS, action: "create", effect: "ALLOW" }]);

    // The access panel sends back what it loaded.
    await updateUserAccess(MASTER, alice.id, { erpAccess: loaded.user.erpAccess, status: loaded.user.status, groupIds: loaded.groupIds, overrides: loaded.overrides });
    expect(await testPrisma().userPermissionOverride.count({ where: { userId: alice.id, activityKey: REMOVED } })).toBe(0);
  });
});

describe("protection against privilege escalation", () => {
  async function permissionAdmin() {
    const admin = await user();
    const g = await group({ [PERMISSION_ADMIN_FEATURE]: ["view", "manage", "assign"], [ORDERS]: ["view"] });
    await updateUserAccess(MASTER, admin.id, { erpAccess: true, status: "ACTIVE", groupIds: [g.id], overrides: [] });
    admin.signIn();
    return { ...admin, actor: await current(), groupId: g.id };
  }

  it("lets a permission administrator hand out only what they hold", async () => {
    const admin = await permissionAdmin();
    const alice = await user();
    const ordersOnly = await group({ [ORDERS]: ["view"] });
    const accounts = await group({ [JOURNAL]: ["view"] });
    await updateUserAccess(admin.actor, alice.id, { erpAccess: true, status: "ACTIVE", groupIds: [ordersOnly.id], overrides: [{ featureKey: ORDERS, action: "delete", effect: "DENY" }] });
    await expect(updateUserAccess(admin.actor, alice.id, { erpAccess: true, status: "ACTIVE", groupIds: [accounts.id], overrides: [] })).rejects.toThrow(/only assign groups/);
    await expect(updateUserAccess(admin.actor, alice.id, { erpAccess: true, status: "ACTIVE", groupIds: [], overrides: [{ featureKey: JOURNAL, action: "view", effect: "ALLOW" }] })).rejects.toThrow(/only allow permissions/);
    await expect(updateUserAccess(admin.actor, alice.id, { erpAccess: true, status: "ACTIVE", isMaster: true, groupIds: [], overrides: [] })).rejects.toThrow(/master/);
    await expect(savePermissionGroup(admin.actor, { name: "Escalate", code: "ESC", grants: { [JOURNAL]: ["view"] } })).rejects.toThrow(/only grant permissions/);
    await expect(setGroupUsers(admin.actor, accounts.id, { userIds: [alice.id] })).rejects.toThrow(/only assign groups/);
    const legacy = await testPrisma().permissionGroup.create({ data: { name: "Everything", code: "ALL", fullAccess: true } });
    await expect(updateUserAccess(admin.actor, alice.id, { erpAccess: true, status: "ACTIVE", groupIds: [legacy.id], overrides: [] })).rejects.toThrow(/full-access/);
  });

  it("protects master accounts and the administrator's own access", async () => {
    const admin = await permissionAdmin();
    const master = await user({ isMaster: true });
    await expect(updateUserAccess(admin.actor, master.id, { erpAccess: false, status: "ACTIVE", groupIds: [], overrides: [] })).rejects.toThrow(/master account/);
    await expect(updateUserAccess(admin.actor, admin.id, { erpAccess: true, status: "ACTIVE", groupIds: [admin.groupId], overrides: [{ featureKey: JOURNAL, action: "view", effect: "ALLOW" }] })).rejects.toThrow(/your own access/);
    // Even the master account cannot lock itself out.
    master.signIn();
    const masterActor = await current();
    await expect(updateUserAccess(masterActor, master.id, { erpAccess: false, status: "SUSPENDED", groupIds: [], overrides: [] })).rejects.toThrow(/your own access/);
    expect((await getUserAccess(masterActor, master.id)).editable).toMatchObject({ access: false });
  });

  it("refuses permission management to users without Manage Permissions (403 from the API)", async () => {
    const clerk = await user();
    const alice = await user();
    const g = await group({ [ORDERS]: ["view"] });
    await updateUserAccess(MASTER, clerk.id, { erpAccess: true, status: "ACTIVE", groupIds: [g.id], overrides: [] });
    clerk.signIn();
    const response = await accessRoute(request("PATCH", `/api/configuration/security/users/${alice.id}/access`, { erpAccess: true, status: "ACTIVE", groupIds: [g.id], overrides: [] }), { params: Promise.resolve({ userId: alice.id }) });
    expect(response.status).toBe(403);
    expect(await status("PUT", `/api/configuration/entity-master-data/employees/${ORDER_ID}/credentials`)).toBe(403);
  });
});

describe("audit", () => {
  it("records every access and group change with the values before and after", async () => {
    const alice = await user();
    const g = await group({ [ORDERS]: ["view"] });
    await updateUserAccess(MASTER, alice.id, { erpAccess: true, status: "ACTIVE", groupIds: [g.id], overrides: [] }, { ipAddress: "10.0.0.1", userAgent: "vitest" });
    await savePermissionGroup(MASTER, { name: g.name, code: g.code, grants: { [ORDERS]: ["view", "create"] } }, g.id);
    const logs = await testPrisma().permissionAuditLog.findMany({ orderBy: { createdAt: "asc" } });
    expect(logs.map((l) => l.operation)).toEqual(["GROUP_CREATE", "USER_ACCESS_UPDATE", "GROUP_UPDATE"]);
    const access = logs[1];
    expect(access).toMatchObject({ targetUserId: alice.id, actorUserId: "master", ipAddress: "10.0.0.1", userAgent: "vitest" });
    expect(access.previousValue).toMatchObject({ groupIds: [] });
    expect(access.newValue).toMatchObject({ groupIds: [g.id] });
    expect(logs[2].previousValue).toMatchObject({ grants: { [ORDERS]: ["view"] } });
  });
});
