import { unstable_rethrow } from "next/navigation";
import { after } from "next/server";
import { z, ZodError, type ZodType } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { auditRequest } from "@/lib/audit/record";
import { requireActor, type Actor, type Permission } from "@/lib/auth/actor";
import { AppError, badRequest, notFound, type ApiErrorBody } from "./errors";

type Handler<C> = (request: Request, context: C, actor: Actor) => Promise<Response>;

/**
 * Wraps a route handler with authentication, permission checks and uniform
 * error responses.
 */
export function apiHandler<C>(permission: Permission, handler: Handler<C>) {
  return async (request: Request, context: C): Promise<Response> => {
    try {
      const actor = await requireActor(request, permission);
      const response = await handler(request, context, actor);
      await auditRequest(request, response, actor);
      if (response.ok) scheduleGlPosting(request);
      return response;
    } catch (error) {
      // Next.js control-flow errors (prerender bail-out, notFound, redirect) must propagate.
      unstable_rethrow(error);
      return toErrorResponse(error);
    }
  };
}

/** Saves in these modules may create documents the general ledger has not seen yet. */
const POSTING_PATHS = /^\/api\/(sales|v1\/purchase|pos|inventory|hrm\/payroll)\//;
let posting: Promise<void> | null = null;
let postAgain = false;

/**
 * After a successful save, posts new documents to the general ledger
 * (src/lib/accounting/posting.service.ts) once the response has been sent.
 * Overlapping runs in this process are merged into one more run.
 */
function scheduleGlPosting(request: Request) {
  if (request.method === "GET" || request.method === "HEAD" || !POSTING_PATHS.test(new URL(request.url).pathname)) return;
  try {
    after(async () => {
      if (posting) {
        postAgain = true;
        return;
      }
      const run = async () => {
        do {
          postAgain = false;
          const { postPendingDocuments } = await import("@/lib/accounting/posting.service");
          await postPendingDocuments().catch((error: unknown) => console.error("[posting] run failed", error));
        } while (postAgain);
      };
      posting = run().finally(() => {
        posting = null;
      });
      await posting;
    });
  } catch {
    // Outside a request (tests, scripts): the next save or Accounts › Posting Setup posts it.
  }
}

export function ok<T>(data: T, status = 200): Response {
  return Response.json({ data }, { status });
}

export function noContent(): Response {
  return new Response(null, { status: 204 });
}

export async function parseJson<T>(request: Request, schema: ZodType<T>): Promise<T> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw badRequest("Request body must be valid JSON.");
  }
  return schema.parse(body);
}

// Loose UUID pattern — accepts any 8-4-4-4-12 hex string regardless of version/variant bits.
const idSchema = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Validates a UUID path parameter; malformed ids are reported as not found. */
export function parseId(value: string, entity: string): string {
  if (!idSchema.test(value)) throw notFound(entity);
  return value;
}

function errorResponse(status: number, body: ApiErrorBody): Response {
  return Response.json(body, { status });
}

export function toErrorResponse(error: unknown): Response {
  if (error instanceof AppError) {
    return errorResponse(error.status, {
      error: { code: error.code, message: error.message, details: error.details },
    });
  }

  if (error instanceof ZodError) {
    const flattened = z.flattenError(error);
    return errorResponse(400, {
      error: {
        code: "VALIDATION_ERROR",
        message: flattened.formErrors[0] ?? "Please correct the highlighted fields.",
        fieldErrors: flattened.fieldErrors as Record<string, string[]>,
      },
    });
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    switch (error.code) {
      case "P2002":
        return errorResponse(409, {
          error: { code: "CONFLICT", message: "A record with the same name already exists." },
        });
      case "P2003":
        return errorResponse(409, {
          error: {
            code: "IN_USE",
            message: "This record is referenced by other records and cannot be changed or removed.",
          },
        });
      case "P2025":
        return errorResponse(404, {
          error: { code: "NOT_FOUND", message: "Record not found." },
        });
    }
  }

  console.error("[api] unhandled error", error);
  return errorResponse(500, {
    error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred. Please try again." },
  });
}
