import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma/client", async () => {
  const { testPrisma } = await import("./helpers/test-db");
  return { db: testPrisma };
});
import * as companyRoute from "@/app/api/configuration/company/route";
import * as unitsRoute from "@/app/api/configuration/business-units/route";
import * as unitRoute from "@/app/api/configuration/business-units/[businessUnitId]/route";
import * as officesRoute from "@/app/api/configuration/business-units/[businessUnitId]/offices/route";
import * as termsRoute from "@/app/api/configuration/business-units/[businessUnitId]/terms/route";
import * as assetRoute from "@/app/api/configuration/offices/[officeId]/assets/[kind]/route";
import { setStorage } from "@/lib/storage";
import { businessUnitInput, companyInput, MemoryStorage, officeInput, pngBytes } from "./helpers/fixtures";
import { resetTestDb, startTestDb, stopTestDb } from "./helpers/test-db";

const BASE = "http://localhost/api/configuration";

function jsonRequest(method: string, path: string, body?: unknown) {
  return new Request(`${BASE}${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body),
  });
}

const params = <T extends Record<string, string>>(value: T) => ({ params: Promise.resolve(value) });
const noParams = params({});

beforeAll(async () => {
  await startTestDb();
});
afterAll(async () => {
  await stopTestDb();
});
beforeEach(async () => {
  await resetTestDb();
  setStorage(new MemoryStorage());
  vi.stubEnv("ERP_DEV_AUTH_BYPASS", "true");
});
afterEach(() => {
  vi.unstubAllEnvs();
});

describe("authentication", () => {
  it("rejects requests when no authenticated actor is available", async () => {
    vi.stubEnv("ERP_DEV_AUTH_BYPASS", "false");
    const response = await companyRoute.GET(jsonRequest("GET", "/company"), noParams);
    expect(response.status).toBe(401);
    expect((await response.json()).error.code).toBe("UNAUTHORIZED");
  });

  it("never honours the development bypass in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const response = await companyRoute.PUT(jsonRequest("PUT", "/company", companyInput), noParams);
    expect(response.status).toBe(401);
  });
});

describe("company endpoint", () => {
  it("returns null before setup, then saves and returns the profile", async () => {
    const empty = await companyRoute.GET(jsonRequest("GET", "/company"), noParams);
    expect(await empty.json()).toEqual({ data: null });

    const saved = await companyRoute.PUT(jsonRequest("PUT", "/company", companyInput), noParams);
    expect(saved.status).toBe(200);
    expect((await saved.json()).data).toMatchObject(companyInput);
  });

  it("returns field errors for invalid input", async () => {
    const response = await companyRoute.PUT(
      jsonRequest("PUT", "/company", { name: " ", address: "x", email: "not-an-email" }),
      noParams,
    );
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(Object.keys(body.error.fieldErrors).sort()).toEqual(["email", "name"]);
  });

  it("rejects malformed JSON", async () => {
    const response = await companyRoute.PUT(jsonRequest("PUT", "/company", "{oops"), noParams);
    expect(response.status).toBe(400);
  });
});

describe("business unit, office and terms endpoints", () => {
  async function createUnit() {
    await companyRoute.PUT(jsonRequest("PUT", "/company", companyInput), noParams);
    const response = await unitsRoute.POST(jsonRequest("POST", "/business-units", businessUnitInput), noParams);
    expect(response.status).toBe(201);
    return (await response.json()).data as { id: string };
  }

  it("creates and lists business units, and reports duplicates as 409", async () => {
    const unit = await createUnit();
    const list = await unitsRoute.GET(jsonRequest("GET", "/business-units"), noParams);
    expect((await list.json()).data.map((u: { id: string }) => u.id)).toEqual([unit.id]);

    const duplicate = await unitsRoute.POST(jsonRequest("POST", "/business-units", businessUnitInput), noParams);
    expect(duplicate.status).toBe(409);
  });

  it("validates the date format", async () => {
    await companyRoute.PUT(jsonRequest("PUT", "/company", companyInput), noParams);
    const response = await unitsRoute.POST(
      jsonRequest("POST", "/business-units", { ...businessUnitInput, dateFormat: "YYYY/DD/MM" }),
      noParams,
    );
    expect(response.status).toBe(400);
    expect((await response.json()).error.fieldErrors.dateFormat).toBeDefined();
  });

  it("returns 404 for malformed or unknown ids", async () => {
    const malformed = await unitRoute.DELETE(
      jsonRequest("DELETE", "/business-units/abc"),
      params({ businessUnitId: "abc" }),
    );
    expect(malformed.status).toBe(404);

    const unknown = await unitRoute.DELETE(
      jsonRequest("DELETE", "/business-units/x"),
      params({ businessUnitId: "4b6f7a2e-1c3d-4e5f-8a9b-0c1d2e3f4a5b" }),
    );
    expect(unknown.status).toBe(404);
  });

  it("blocks deleting a unit with offices (409 IN_USE)", async () => {
    const unit = await createUnit();
    const office = await officesRoute.POST(
      jsonRequest("POST", `/business-units/${unit.id}/offices`, officeInput),
      params({ businessUnitId: unit.id }),
    );
    expect(office.status).toBe(201);

    const response = await unitRoute.DELETE(
      jsonRequest("DELETE", `/business-units/${unit.id}`),
      params({ businessUnitId: unit.id }),
    );
    expect(response.status).toBe(409);
    expect((await response.json()).error.code).toBe("IN_USE");
  });

  it("requires a valid terms domain and persists checkbox applicability", async () => {
    const unit = await createUnit();
    const ctx = params({ businessUnitId: unit.id });

    const invalid = await termsRoute.GET(jsonRequest("GET", `/business-units/${unit.id}/terms?domain=HR`), ctx);
    expect(invalid.status).toBe(400);

    const created = await termsRoute.POST(
      jsonRequest("POST", `/business-units/${unit.id}/terms`, {
        domain: "PURCHASE",
        content: "Goods must match the purchase order.",
        documentTypes: ["REQUEST_FOR_QUOTATION", "PURCHASE_ORDER"],
      }),
      ctx,
    );
    expect(created.status).toBe(201);
    expect((await created.json()).data).toMatchObject({ isDefault: false, sortOrder: 1 });

    const mismatched = await termsRoute.POST(
      jsonRequest("POST", `/business-units/${unit.id}/terms`, {
        domain: "PURCHASE",
        content: "x",
        documentTypes: ["SALES_ORDER"],
      }),
      ctx,
    );
    expect(mismatched.status).toBe(400);

    const list = await termsRoute.GET(
      jsonRequest("GET", `/business-units/${unit.id}/terms?domain=PURCHASE`),
      ctx,
    );
    const [term] = (await list.json()).data;
    expect(term.documentTypes.toSorted()).toEqual(["PURCHASE_ORDER", "REQUEST_FOR_QUOTATION"]);
  });

  it("uploads, serves and removes office assets via multipart", async () => {
    const unit = await createUnit();
    const officeResponse = await officesRoute.POST(
      jsonRequest("POST", `/business-units/${unit.id}/offices`, officeInput),
      params({ businessUnitId: unit.id }),
    );
    const office = (await officeResponse.json()).data as { id: string };
    const ctx = params({ officeId: office.id, kind: "brand-logo" });

    const form = new FormData();
    form.append("file", new File([pngBytes().slice()], "logo.png", { type: "image/png" }));
    const upload = await assetRoute.PUT(
      new Request(`${BASE}/offices/${office.id}/assets/brand-logo`, { method: "PUT", body: form }),
      ctx,
    );
    expect(upload.status).toBe(200);

    const served = await assetRoute.GET(new Request(`${BASE}/offices/${office.id}/assets/brand-logo`), ctx);
    expect(served.status).toBe(200);
    expect(served.headers.get("Content-Type")).toBe("image/png");
    expect(served.headers.get("X-Content-Type-Options")).toBe("nosniff");

    const badKind = await assetRoute.GET(
      new Request(`${BASE}/offices/${office.id}/assets/avatar`),
      params({ officeId: office.id, kind: "avatar" }),
    );
    expect(badKind.status).toBe(404);

    const removed = await assetRoute.DELETE(
      new Request(`${BASE}/offices/${office.id}/assets/brand-logo`, { method: "DELETE" }),
      ctx,
    );
    expect(removed.status).toBe(204);
  });
});
