import { apiHandler, ok, parseId } from "@/lib/api/handler";
import type { Actor } from "@/lib/auth/actor";

/**
 * Route handlers for RTM pages. Each page has its own API path
 * (/api/rtm/<page>/…), so the page's permissions apply to it.
 */
type Query = Record<string, string | undefined>;
type IdContext = { params: Promise<{ id: string }> };

const query = (request: Request): Query => Object.fromEntries([...new URL(request.url).searchParams].map(([k, v]) => [k, v || undefined]));
const body = (request: Request) => request.json().catch(() => ({}));

export const get = (fn: (actor: Actor, q: Query) => Promise<unknown>) =>
  apiHandler("sales:read", async (request, _c, actor) => ok(await fn(actor, query(request))));

export const write = (fn: (actor: Actor, body: unknown) => Promise<unknown>, status = 200) =>
  apiHandler("sales:write", async (request, _c, actor) => ok((await fn(actor, await body(request))) ?? null, status));

export const writeId = (fn: (actor: Actor, id: string, body: unknown) => Promise<unknown>) =>
  apiHandler<IdContext>("sales:write", async (request, { params }, actor) => ok((await fn(actor, parseId((await params).id, "Record"), await body(request))) ?? null));
