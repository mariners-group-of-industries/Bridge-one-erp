import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma/client", async () => {
  const { testPrisma } = await import("./helpers/test-db");
  return { db: testPrisma };
});
// Requests in these tests authenticate with tokens only (no session cookie).
vi.mock("@/lib/auth/cookies", () => ({ getAuthCookie: async () => undefined, setAuthCookie: async () => undefined, clearAuthCookie: async () => undefined }));

import { createApiToken, deleteApiToken, listApiTokens, revokeApiToken } from "@/features/configuration/gateways/server/api-token.service";
import { auditLogOptions, listAuditLogs } from "@/features/configuration/system-logs/server/audit-log.service";
import { GET as listUserGroupsRoute, POST as createUserGroupRoute } from "@/app/api/configuration/security/user-groups/route";
import { GET as listTokensRoute } from "@/app/api/configuration/gateways/api-tokens/route";
import { actionOf, featureOf, recordAudit } from "@/lib/audit/record";
import { AppError } from "@/lib/api/errors";
import { adminActor } from "./helpers/fixtures";
import { resetTestDb, startTestDb, stopTestDb, testPrisma } from "./helpers/test-db";

const BASE = "http://localhost/api/configuration/security/user-groups";
const call = (handler: (r: Request, c: unknown) => Promise<Response>, token: string | null, method = "GET", body?: unknown, url = BASE) =>
  handler(
    new Request(url, {
      method,
      headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), "content-type": "application/json", "user-agent": "vitest" },
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
    {},
  );

beforeAll(async () => {
  await startTestDb();
});
afterAll(async () => {
  await stopTestDb();
});
beforeEach(async () => {
  await resetTestDb();
});

describe("audit classification", () => {
  it("names the feature from the API path and the action from method and path", () => {
    expect(featureOf("/api/configuration/sales-config/wallets/0f8fad5b-d9cb-469f-a165-70867728950e")).toBe("Wallet Setup");
    expect(featureOf("/api/sales/orders")).toBe("Sales Order");
    expect(featureOf("/api/something/new-thing")).toBe("Something New Thing");
    expect(actionOf("POST", "/api/sales/orders")).toBe("CREATE");
    expect(actionOf("PUT", "/api/sales/orders/1")).toBe("UPDATE");
    expect(actionOf("DELETE", "/api/sales/orders/1")).toBe("DELETE");
    expect(actionOf("POST", "/api/configuration/sales-config/return-prices/import")).toBe("IMPORT");
    expect(actionOf("GET", "/api/configuration/sales-config/standard-prices/excel")).toBe("EXPORT");
    expect(actionOf("GET", "/api/sales/orders")).toBeNull();
  });
});

describe("API tokens", () => {
  it("authenticates with a token: read-only tokens can only read, revoked and expired tokens stop working", async () => {
    const read = await createApiToken(adminActor, { name: "Reports", access: "READ", expiry: "30" });
    expect(read.token).toMatch(/^b1_/);
    expect(read.tokenPrefix).toBe(read.token.slice(0, 11));
    // Only the hash is stored.
    expect(JSON.stringify(await testPrisma().apiToken.findMany())).not.toContain(read.token);

    expect((await call(listUserGroupsRoute, read.token)).status).toBe(200);
    expect((await call(listUserGroupsRoute, null)).status).toBe(401);
    expect((await call(listUserGroupsRoute, "b1_not-a-real-token-at-all-000000")).status).toBe(401);
    expect((await call(createUserGroupRoute, read.token, "POST", { name: "G", userIds: [] })).status).toBe(403);
    expect((await listApiTokens(adminActor))[0].lastUsedAt).not.toBeNull();

    await revokeApiToken(adminActor, read.id);
    expect((await call(listUserGroupsRoute, read.token)).status).toBe(401);
    expect((await listApiTokens(adminActor))[0].status).toBe("REVOKED");

    const old = await createApiToken(adminActor, { name: "Old", access: "READ", expiry: "30" });
    await testPrisma().apiToken.update({ where: { id: old.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    expect((await call(listUserGroupsRoute, old.token)).status).toBe(401);
    await deleteApiToken(adminActor, old.id);
    expect(await listApiTokens(adminActor)).toHaveLength(1);
  });

  it("lets read & write tokens change data (audited under the token's name) but never manage tokens", async () => {
    const write = await createApiToken(adminActor, { name: "ERP sync", access: "READ_WRITE", expiry: "never" });
    expect(write.expiresAt).toBeNull();
    const user = await testPrisma().user.create({ data: { name: "Ali", phone: "01700000099", passwordHash: "x" } });
    const created = await call(createUserGroupRoute, write.token, "POST", { name: "Synced", userIds: [user.id] });
    expect(created.status).toBe(201);
    expect((await call(listTokensRoute, write.token, "GET", undefined, "http://localhost/api/configuration/gateways/api-tokens")).status).toBe(403);
    await expect(createApiToken({ ...adminActor, role: "API" }, { name: "X", access: "READ", expiry: "30" })).rejects.toBeInstanceOf(AppError);

    const logs = await listAuditLogs(adminActor, {});
    expect(logs.rows).toEqual([expect.objectContaining({ feature: "User Group", actionType: "CREATE", userName: "API token: ERP sync", method: "POST", status: 201, userAgent: "vitest" })]);
  });
});

describe("audit log list", () => {
  it("filters by feature, user, action type and dates, newest first, with paging", async () => {
    const entry = (feature: string, actionType: "CREATE" | "DELETE" | "LOGIN", userId: string, at: string) =>
      recordAudit({ feature, actionType, userId, userName: userId.toUpperCase(), method: "POST", path: `/api/${feature}`, status: 200 }).then(() =>
        testPrisma().auditLog.updateMany({ where: { feature, createdAt: { gte: new Date(Date.now() - 60_000) }, userId }, data: { createdAt: new Date(at) } }),
      );
    await entry("Wallet Setup", "CREATE", "u1", "2026-10-01T10:00:00Z");
    await entry("Item Profile", "DELETE", "u2", "2026-10-05T10:00:00Z");
    await entry("Authentication", "LOGIN", "u1", "2026-10-09T23:30:00Z");

    expect((await listAuditLogs(adminActor, {})).rows.map((r) => r.feature)).toEqual(["Authentication", "Item Profile", "Wallet Setup"]);
    expect((await listAuditLogs(adminActor, { userId: "u1" })).total).toBe(2);
    expect((await listAuditLogs(adminActor, { actionType: "DELETE" })).rows[0].feature).toBe("Item Profile");
    expect((await listAuditLogs(adminActor, { feature: "Wallet Setup" })).total).toBe(1);
    expect((await listAuditLogs(adminActor, { from: "2026-10-02", to: "2026-10-09" })).rows.map((r) => r.feature)).toEqual(["Authentication", "Item Profile"]);
    const page2 = await listAuditLogs(adminActor, { page: 2, pageSize: 2 });
    expect([page2.total, page2.rows.length]).toEqual([3, 1]);
    await expect(listAuditLogs(adminActor, { from: "2026-10-09", to: "2026-10-01" })).rejects.toThrow();
    expect(await auditLogOptions(adminActor)).toEqual({
      features: ["Authentication", "Item Profile", "Wallet Setup"],
      users: [
        { id: "u1", name: "U1" },
        { id: "u2", name: "U2" },
      ],
    });
    await expect(listAuditLogs({ ...adminActor, role: "API" }, {})).rejects.toBeInstanceOf(AppError);
  });
});
