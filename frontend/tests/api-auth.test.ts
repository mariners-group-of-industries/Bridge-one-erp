import { describe, expect, it, vi } from "vitest";

// No session cookie and no token: every request below is anonymous.
vi.mock("@/lib/auth/cookies", () => ({ getAuthCookie: async () => undefined, setAuthCookie: async () => undefined, clearAuthCookie: async () => undefined }));

/** Login, logout, "me" and profile handle their own (missing) session. */
const PUBLIC = ["/api/auth/"];
const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;

const routes = import.meta.glob<Record<string, unknown>>("../src/app/api/**/route.ts");

describe("API authentication", () => {
  it("finds the API routes", () => {
    expect(Object.keys(routes).length).toBeGreaterThan(50);
  });

  it("refuses every non-public route without a session or token", async () => {
    const open: string[] = [];
    for (const [file, load] of Object.entries(routes)) {
      const path = file.replace("../src/app", "").replace(/\/route\.ts$/, "");
      if (PUBLIC.some((p) => path.startsWith(p))) continue;
      const mod = await load();
      for (const method of METHODS) {
        const handler = mod[method];
        if (typeof handler !== "function") continue;
        // Dynamic segments get a valid-looking UUID; the request must stop at authentication anyway.
        const url = `http://localhost${path.replace(/\[\.\.\.[^\]]+\]/g, "x").replace(/\[[^\]]+\]/g, "00000000-0000-4000-8000-000000000000")}`;
        const params = Promise.resolve(new Proxy({}, { get: () => "00000000-0000-4000-8000-000000000000" }));
        const response = (await handler(new Request(url, { method, ...(method === "GET" ? {} : { body: "{}", headers: { "content-type": "application/json" } }) }), { params })) as Response;
        if (response.status !== 401) open.push(`${method} ${path} → ${response.status}`);
      }
    }
    expect(open).toEqual([]);
  });
});
