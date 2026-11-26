import { unstable_rethrow } from "next/navigation";
import { AdmsError } from "./adms.service";

/** Largest punch upload accepted from a device (it sends its log in batches). */
const MAX_BODY_BYTES = 2 * 1024 * 1024;

const text = (body: string, status = 200) => new Response(body, { status, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });

/**
 * Wraps an /iclock handler: ZKTeco devices speak plain text, without ERP sign-in
 * (a device is known by its registered serial number, ?SN=…).
 */
export function admsRoute(handler: (query: URLSearchParams, body: string) => Promise<string>) {
  return async (request: Request): Promise<Response> => {
    try {
      const query = new URL(request.url).searchParams;
      let body = "";
      if (request.method === "POST") {
        if (Number(request.headers.get("content-length") ?? 0) > MAX_BODY_BYTES) return text("Upload too large", 413);
        body = await request.text();
        if (body.length > MAX_BODY_BYTES) return text("Upload too large", 413);
      }
      return text(await handler(query, body));
    } catch (error) {
      // Next.js control flow (the build's prerender bail-out on request.url) must propagate,
      // so the routes stay dynamic instead of being logged as device errors.
      unstable_rethrow(error);
      if (error instanceof AdmsError) return text(error.message, error.status);
      console.error("[adms]", error);
      return text("Server error", 500);
    }
  };
}
