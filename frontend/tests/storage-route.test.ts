import { describe, expect, it, vi } from "vitest";

// A signed-in master: the route itself must still refuse anything outside Connect uploads.
vi.mock("@/lib/auth/actor", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/auth/actor")>()),
  requireActor: async () => ({ id: "00000000-0000-4000-8000-000000000001", role: "ADMINISTRATOR", isMaster: true, permissions: new Set(), companyScope: "ALL" }),
}));
vi.mock("@/lib/audit/record", () => ({ auditRequest: async () => undefined }));
vi.mock("@/lib/storage/r2", () => ({ r2ConfigFromEnv: () => null, R2Storage: class {} }));

import { GET } from "@/app/api/storage/[...key]/route";

const get = (key: string[]) => GET(new Request("http://localhost/api/storage/x"), { params: Promise.resolve({ key }) });

describe("GET /api/storage/[...key]", () => {
  it.each([
    [["..", "..", "package.json"]],
    [["../../package.json"]],
    [["connect", "..", "..", "..", "package.json"]],
    [["connect/../../../package.json"]],
    [["customer", "doc.pdf"]],
    [["connect", "sub", "file.png"]],
  ])("refuses %j", async (key) => {
    const response = await get(key);
    expect(response.status).toBe(404);
  });
});
