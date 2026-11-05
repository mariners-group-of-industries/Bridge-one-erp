import { apiHandler, ok, parseId } from "@/lib/api/handler";
import { INVENTORY_DOC_TYPES, type InventoryDocSlug } from "../schemas/document.schema";
import {
  approveDocument,
  completeGatePass,
  createDocument,
  getDocument,
  listDocuments,
  receiveTransfer,
  rejectDocument,
} from "./inventory.service";

/**
 * Route handlers for one inventory page's documents. Each page has its own API
 * path (/api/inventory/<page>/…), so its permissions are the page's permissions.
 */
type IdContext = { params: Promise<{ id: string }> };

const body = async (request: Request) => request.json().catch(() => ({}));

export function documentListRoutes(slug: InventoryDocSlug) {
  const type = INVENTORY_DOC_TYPES[slug];
  return {
    GET: apiHandler("purchase:read", async (request, _context, actor) => {
      const q = new URL(request.url).searchParams;
      return ok(await listDocuments(actor, type, { from: q.get("from") ?? undefined, to: q.get("to") ?? undefined, status: q.get("status") ?? undefined }));
    }),
    POST: apiHandler("purchase:write", async (request, _context, actor) => ok(await createDocument(actor, type, await body(request)), 201)),
  };
}

export function documentRoutes(slug: InventoryDocSlug) {
  const type = INVENTORY_DOC_TYPES[slug];
  return {
    GET: apiHandler<IdContext>("purchase:read", async (_request, { params }, actor) => ok(await getDocument(actor, type, parseId((await params).id, "Document")))),
  };
}

export function reviewRoutes(slug: InventoryDocSlug, decision: "approve" | "reject") {
  const type = INVENTORY_DOC_TYPES[slug];
  const run = decision === "approve" ? approveDocument : rejectDocument;
  return {
    POST: apiHandler<IdContext>("purchase:write", async (request, { params }, actor) =>
      ok(await run(actor, type, parseId((await params).id, "Document"), await body(request))),
    ),
  };
}

export const receiveRoute = {
  POST: apiHandler<IdContext>("purchase:write", async (request, { params }, actor) =>
    ok(await receiveTransfer(actor, parseId((await params).id, "Transfer"), await body(request))),
  ),
};

export const completeGatePassRoute = {
  POST: apiHandler<IdContext>("purchase:write", async (_request, { params }, actor) => ok(await completeGatePass(actor, parseId((await params).id, "Gate pass")))),
};
