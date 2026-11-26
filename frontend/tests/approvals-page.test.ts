import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma/client", async () => {
  const { testPrisma } = await import("./helpers/test-db");
  return { db: testPrisma };
});
// Session cookie stand-in: "<jti>|<userId>" of a real user_sessions row (as in rbac.test.ts).
let cookie: string | undefined;
vi.mock("@/lib/auth/cookies", () => ({ getAuthCookie: async () => cookie, setAuthCookie: async () => undefined, clearAuthCookie: async () => undefined }));
vi.mock("@/lib/auth/jwt", () => ({
  verifyToken: async (token: string) => {
    const [jti, sub] = token.split("|");
    return { jti, sub, name: "x", phone: "x", role: "STAFF", isMaster: false };
  },
}));

import type { PrismaClient } from "@/generated/prisma/client";
import { GET as pendingRoute } from "@/app/api/approvals/[categoryId]/pending/route";
import { GET as summaryRoute } from "@/app/api/approvals/summary/route";
import { POST as v1Post } from "@/app/api/v1/[...route]/route";
import { canDecideHere, decide, fetchPendingDocuments } from "@/features/approvals/services/decisions";
import { getApprovalSummary } from "@/features/approvals/server/summary.service";
import type { ApprovalSummary } from "@/features/approvals/types";
import { savePermissionGroup, setGroupUsers } from "@/features/configuration/security/access/server/access.service";
import { createPipeline } from "@/features/configuration/security/approval/server/approval.service";
import { createItem } from "@/features/sales/masters/services/masters.service";
import { approvalTrail } from "@/lib/approval/engine";
import type { Actor } from "@/lib/auth/actor";
import { checkApiAccess } from "@/lib/permissions/api-rules";
import { grantsFromList, permissionKey, type PermissionAction } from "@/lib/permissions/registry";
import { purchaseStore } from "@/lib/purchase-store/store";
import { adminActor, businessUnitInput, companyInput, officeInput } from "./helpers/fixtures";
import { startTestDb, stopTestDb } from "./helpers/test-db";

/**
 * The Multilayer Approval page decides documents in place: `decide()` calls the
 * module's own endpoint. Here the browser's fetch is routed into the real Next
 * route handlers, so paths, bodies, permissions and pipeline stages are all real.
 */

type Handler = (request: Request, context: { params: Promise<Record<string, unknown>> }) => Promise<Response>;
const ROUTES: { pattern: RegExp; method: string; handler: Handler; params: (m: RegExpMatchArray) => Record<string, unknown> }[] = [
  { pattern: /^\/api\/approvals\/summary$/, method: "GET", handler: summaryRoute as Handler, params: () => ({}) },
  { pattern: /^\/api\/approvals\/([^/]+)\/pending$/, method: "GET", handler: pendingRoute as Handler, params: (m) => ({ categoryId: decodeURIComponent(m[1]) }) },
  { pattern: /^\/api\/v1\/(.+)$/, method: "POST", handler: v1Post as Handler, params: (m) => ({ route: m[1].split("/").map(decodeURIComponent) }) },
];

const calls: { method: string; path: string; body: unknown }[] = [];
const realFetch = globalThis.fetch;

describe("Multilayer Approval page: deciding in place", () => {
  let prisma: PrismaClient;
  let officeId: string;
  let warehouseId: string;
  let flourId: string;
  const people: Record<"manager" | "finance" | "viewer" | "super", { id: string; jti: string }> = {} as never;
  const signInAs = (who: keyof typeof people) => (cookie = `${people[who].jti}|${people[who].id}`);

  beforeAll(async () => {
    prisma = await startTestDb();
    const companyId = (await prisma.company.create({ data: companyInput })).id;
    const businessUnitId = (await prisma.businessUnit.create({ data: { ...businessUnitInput, companyId } })).id;
    officeId = (await prisma.office.create({ data: { ...officeInput, businessUnitId } })).id;
    warehouseId = (await prisma.warehouse.create({ data: { officeId, name: "Material WH" } })).id;
    flourId = (await createItem(adminActor, { businessUnitId, name: "Wheat Flour", uom: "KG", salesRate: 60 })).id;

    let n = 0;
    for (const who of ["manager", "finance", "viewer", "super"] as const) {
      n += 1;
      const user = await prisma.user.create({ data: { name: { manager: "Store Manager", finance: "Finance Head", viewer: "Viewer", super: "Director" }[who], phone: `0173000000${n}`, passwordHash: "x", erpAccess: true, status: "ACTIVE" } });
      const jti = `jti-approvals-${who}`;
      await prisma.userSession.create({ data: { userId: user.id, jti, expiresAt: new Date(Date.now() + 3_600_000) } });
      people[who] = { id: user.id, jti };
    }

    // Approvers may approve requisitions and open the approvals page; the viewer may only look.
    const master = { ...adminActor, isMaster: true } as Actor;
    const approvers = await savePermissionGroup(master, { name: "Approvers", code: "APPR", status: "ACTIVE", grants: { "/approvals": ["view"], "/purchase/requisitions": ["view", "approve"] } as never });
    await setGroupUsers(master, approvers.id, { userIds: [people.manager.id, people.finance.id] });
    const viewers = await savePermissionGroup(master, { name: "Viewers", code: "VIEW", status: "ACTIVE", grants: { "/approvals": ["view"], "/purchase/requisitions": ["view"] } as never });
    await setGroupUsers(master, viewers.id, { userIds: [people.viewer.id] });

    const approver = (approverId: string) => ({ userType: "USER" as const, businessUnitId: "", approverId, authorizationType: "APPROVAL" as const });
    await createPipeline(adminActor, {
      name: "Requisition approval",
      feature: "Purchase Requisition",
      userType: "USER",
      superApproverId: people.super.id,
      remarks: "",
      stages: [
        { name: "Store Manager", approvalOrder: "ANY", requiredCount: 1, approvers: [approver(people.manager.id)] },
        { name: "Finance", approvalOrder: "ANY", requiredCount: 1, approvers: [approver(people.finance.id)] },
      ],
    } as Parameters<typeof createPipeline>[1]);

    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input), "http://localhost");
      const method = (init?.method ?? "GET").toUpperCase();
      calls.push({ method, path: url.pathname, body: init?.body ? JSON.parse(String(init.body)) : undefined });
      for (const r of ROUTES) {
        const m = url.pathname.match(r.pattern);
        if (m && r.method === method) {
          return r.handler(new Request(url, { method, headers: init?.headers, body: init?.body }), { params: Promise.resolve(r.params(m)) });
        }
      }
      throw new Error(`No route handler wired for ${method} ${url.pathname}`);
    }) as typeof fetch;
  });

  afterAll(async () => {
    globalThis.fetch = realFetch;
    await stopTestDb();
  });

  beforeEach(() => {
    calls.length = 0;
    cookie = undefined;
  });

  const requisition = (justification: string) =>
    purchaseStore.createRequisition(
      {
        companyId: "",
        officeId,
        warehouseId,
        requestType: "LOCAL",
        department: "Production",
        requesterName: "Line Supervisor",
        purchaseMethod: "DIRECT",
        requestDate: "2026-11-01",
        requiredDeliveryDate: "2026-11-08",
        businessJustification: justification,
        items: [{ itemId: flourId, itemCode: "", itemName: "", uom: "", quantity: 10, estimatedUnitPrice: 50, lineTotal: 0 }],
      },
      "Store Officer",
    );
  const statusOf = async (id: string) => (await prisma.purchaseRequisition.findUniqueOrThrow({ where: { id } })).status;

  it("has an approve action for every category the page shows", async () => {
    // Every category can be decided here; a category without an action is a gap.
    const MODULE_PAGE_ONLY = new Set<string>();
    const summary: ApprovalSummary = await getApprovalSummary({ ...adminActor, isMaster: true } as Actor);
    expect(summary.categories.length).toBeGreaterThan(20);
    for (const c of summary.categories) expect(canDecideHere(c.id, "approve"), c.id).toBe(!MODULE_PAGE_ONLY.has(c.id));
  });

  it("sends each category's decision to an endpoint guarded by that page's Approve (or matching) permission", async () => {
    const summary = await getApprovalSummary({ ...adminActor, isMaster: true } as Actor);
    const sent: { method: string; path: string }[] = [];
    const routed = globalThis.fetch;
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      sent.push({ method: (init?.method ?? "GET").toUpperCase(), path: new URL(String(input), "http://localhost").pathname });
      return Response.json({ success: true, data: null });
    }) as typeof fetch;
    const problems: string[] = [];
    try {
      for (const c of summary.categories) {
        const feature = c.href.split("?")[0];
        const doc = { id: "00000000-0000-4000-8000-000000000009", reference: "X", createdAt: new Date().toISOString(), version: c.id === "salary-sheet" ? "1" : new Date().toISOString() };
        for (const decision of ["approve", "reject"] as const) {
          if (!canDecideHere(c.id, decision)) continue;
          sent.length = 0;
          await decide(c.id, decision, { doc, remarks: "r" });
          const { method, path } = sent[0];
          const grant = (actions: PermissionAction[]) => grantsFromList(actions.map((a) => permissionKey(feature, a)));
          if (!checkApiAccess(grant(["view", "create", "edit", "delete", "approve"]), method, path).allowed) problems.push(`${c.id} ${decision}: ${method} ${path} is not allowed even with full access to ${feature}`);
          if (checkApiAccess(grant(["view"]), method, path).allowed) problems.push(`${c.id} ${decision}: ${method} ${path} is allowed with View only on ${feature}`);
        }
      }
    } finally {
      globalThis.fetch = routed;
    }
    expect(problems).toEqual([]);
  });

  it("lists pending documents and walks a 2-stage pipeline from the page", async () => {
    const a = await requisition("Weekly flour");
    const b = await requisition("Spare flour");

    signInAs("manager");
    const list = await fetchPendingDocuments("purchase-requisition");
    expect(list.documents.map((d) => d.id).sort()).toEqual([a.id, b.id].sort());
    expect(list.truncated).toBe(false);
    const docA = list.documents.find((d) => d.id === a.id)!;

    // Finance cannot jump stage 1.
    signInAs("finance");
    await expect(decide("purchase-requisition", "approve", { doc: docA, remarks: "" })).rejects.toThrow(/stage 1/);
    expect(await statusOf(a.id)).toBe("PENDING");

    // Stage 1 from the page: the document stays pending, waiting at Finance.
    signInAs("manager");
    await decide("purchase-requisition", "approve", { doc: docA, remarks: "Looks right" });
    expect(calls.at(-1)).toMatchObject({ method: "POST", path: `/api/v1/purchase/requisitions/${a.id}/approve`, body: { comments: "Looks right" } });
    expect(await statusOf(a.id)).toBe("PENDING");
    expect((await fetchPendingDocuments("purchase-requisition")).documents.map((d) => d.id)).toContain(a.id);

    // Stage 2: approved — the module's own record now says APPROVED, so its page shows it too.
    signInAs("finance");
    await decide("purchase-requisition", "approve", { doc: docA, remarks: "Budget OK" });
    expect(await statusOf(a.id)).toBe("APPROVED");
    expect((await approvalTrail("Purchase Requisition", a.id)).map((s) => [s.name, s.status])).toEqual([
      ["Store Manager", "APPROVED"],
      ["Finance", "APPROVED"],
    ]);

    // Off the list, and the tile counts follow.
    const after = await fetchPendingDocuments("purchase-requisition");
    expect(after.documents.map((d) => d.id)).toEqual([b.id]);
    const summary = await (await fetch("/api/approvals/summary")).json();
    expect(summary.data.categories.find((c: { id: string }) => c.id === "purchase-requisition")).toMatchObject({ pending: 1, approved: 1 });
  });

  it("rejects from the page", async () => {
    signInAs("manager");
    const pending = (await fetchPendingDocuments("purchase-requisition")).documents;
    const doc = pending[0];
    await decide("purchase-requisition", "reject", { doc, remarks: "Not needed this week" });
    expect(calls.at(-1)).toMatchObject({ path: `/api/v1/purchase/requisitions/${doc.id}/reject`, body: { comments: "Not needed this week" } });
    expect(await statusOf(doc.id)).toBe("REJECTED");
    expect((await fetchPendingDocuments("purchase-requisition")).documents).toEqual([]);
  });

  it("keeps the module's permission checks: a viewer cannot approve", async () => {
    const c = await requisition("Viewer test");
    signInAs("viewer");
    const doc = (await fetchPendingDocuments("purchase-requisition")).documents.find((d) => d.id === c.id)!;
    await expect(decide("purchase-requisition", "approve", { doc, remarks: "" })).rejects.toThrow(/permission/i);
    expect(await statusOf(c.id)).toBe("PENDING");
  });

  it("does not list a category the user cannot see, and refuses signed-out callers", async () => {
    signInAs("viewer");
    await expect(fetchPendingDocuments("sales-order")).rejects.toThrow(/not found/i);
    cookie = undefined;
    await expect(fetchPendingDocuments("purchase-requisition")).rejects.toThrow(/Authentication required/);
  });
});
